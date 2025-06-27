import { EventEmitter } from 'node:events';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { SessionContext } from '../types/cli.js';

interface ComponentState {
  name: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  lastSeen: number;
  pid?: number;
  metadata?: any;
}

interface SessionState {
  sessionId: string;
  status: 'initializing' | 'active' | 'finalizing' | 'completed' | 'error';
  startTime: number;
  lastUpdateTime: number;
  components: Map<string, ComponentState>;
  metrics: {
    eventsProcessed: number;
    errorsEncountered: number;
    httpRequests: number;
    fileOperations: number;
    toolExecutions: number;
  };
  config: any;
}

export class StateSync extends EventEmitter {
  private session: SessionContext | null = null;
  private state: SessionState | null = null;
  private stateFile: string = '';
  private syncInterval: NodeJS.Timeout | null = null;

  async initialize(session: SessionContext): Promise<void> {
    this.session = session;
    this.stateFile = join(session.traceDir, 'sessions', session.sessionId, 'state.json');
    
    // Ensure session directory exists
    await this.ensureSessionDirectory();
    
    // Initialize state
    this.state = {
      sessionId: session.sessionId,
      status: 'initializing',
      startTime: session.startTime,
      lastUpdateTime: Date.now(),
      components: new Map(),
      metrics: {
        eventsProcessed: 0,
        errorsEncountered: 0,
        httpRequests: 0,
        fileOperations: 0,
        toolExecutions: 0
      },
      config: {
        traceDir: session.traceDir,
        sessionName: session.sessionName,
        tags: session.tags,
        debug: session.config.debug
      }
    };
    
    // Load existing state if it exists
    await this.loadStateFromFile();
    
    // Update status to active
    this.state.status = 'active';
    
    // Start periodic sync
    this.startPeriodicSync();
    
    console.log('🔄 State synchronization initialized');
  }

  async updateState(event: any): Promise<void> {
    if (!this.state) {
      throw new Error('State sync not initialized');
    }

    try {
      // Update last update time
      this.state.lastUpdateTime = Date.now();
      
      // Update metrics based on event type
      this.updateMetrics(event);
      
      // Update component state if applicable
      this.updateComponentState(event);
      
      // Emit state update event
      this.emit('stateUpdated', this.state);
      
      // Save to file (debounced via periodic sync)
      
    } catch (error) {
      console.error('Failed to update state:', error);
      this.emit('error', error);
    }
  }

  private updateMetrics(event: any): void {
    if (!this.state) return;
    
    this.state.metrics.eventsProcessed++;
    
    switch (event.type) {
      case 'http_request':
      case 'http_request_start':
      case 'http_request_complete':
      case 'http_response':
        this.state.metrics.httpRequests++;
        break;
      
      case 'file_write_start':
      case 'file_write_complete':
      case 'file_read_start':
      case 'file_read_complete':
      case 'directory_create_start':
      case 'directory_create_complete':
        this.state.metrics.fileOperations++;
        break;
      
      case 'tool_execution_start':
      case 'tool_execution_complete':
      case 'tool_output':
        this.state.metrics.toolExecutions++;
        break;
      
      case 'http_request_error':
      case 'file_write_error':
      case 'file_read_error':
      case 'tool_execution_error':
      case 'error':
        this.state.metrics.errorsEncountered++;
        break;
    }
  }

  private updateComponentState(event: any): void {
    if (!this.state || !event.source) return;
    
    const componentName = event.source;
    const now = Date.now();
    
    let component = this.state.components.get(componentName);
    
    if (!component) {
      component = {
        name: componentName,
        status: 'running',
        lastSeen: now
      };
      this.state.components.set(componentName, component);
    } else {
      component.lastSeen = now;
    }
    
    // Update component status based on event type
    switch (event.type) {
      case 'session_start':
      case 'interception_initialized':
        component.status = 'running';
        if (event.data?.pid) {
          component.pid = event.data.pid;
        }
        break;
      
      case 'session_end':
      case 'interception_cleanup':
        component.status = 'stopping';
        break;
      
      case 'error':
        component.status = 'error';
        break;
    }
    
    // Update metadata
    if (event.data && typeof event.data === 'object') {
      component.metadata = {
        ...component.metadata,
        lastEventType: event.type,
        lastEventTime: now
      };
    }
  }

  private startPeriodicSync(): void {
    // Sync state to file every 5 seconds
    this.syncInterval = setInterval(async () => {
      try {
        await this.saveStateToFile();
      } catch (error) {
        console.error('Failed to sync state to file:', error);
      }
    }, 5000);
  }

  private async loadStateFromFile(): Promise<void> {
    if (!existsSync(this.stateFile)) {
      return;
    }
    
    try {
      const content = await readFile(this.stateFile, 'utf-8');
      const savedState = JSON.parse(content);
      
      // Merge saved state with current state
      if (this.state && savedState) {
        this.state.metrics = { ...this.state.metrics, ...savedState.metrics };
        
        // Restore component states
        if (savedState.components) {
          for (const [name, componentData] of Object.entries(savedState.components)) {
            this.state.components.set(name, componentData as ComponentState);
          }
        }
      }
      
      console.log('📂 State loaded from file');
      
    } catch (error) {
      console.warn('Failed to load state from file:', error);
    }
  }

  private async ensureSessionDirectory(): Promise<void> {
    try {
      const sessionDir = dirname(this.stateFile);
      await mkdir(sessionDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create session directory:', error);
      throw error;
    }
  }

  private async saveStateToFile(): Promise<void> {
    if (!this.state) return;
    
    try {
      // Ensure directory exists before writing
      await this.ensureSessionDirectory();
      
      // Convert Map to object for JSON serialization
      const stateToSave = {
        ...this.state,
        components: Object.fromEntries(this.state.components)
      };
      
      const content = JSON.stringify(stateToSave, null, 2);
      await writeFile(this.stateFile, content);
      
    } catch (error) {
      console.error('Failed to save state to file:', error);
    }
  }

  async finalizeState(): Promise<void> {
    if (!this.state) return;
    
    this.state.status = 'finalizing';
    this.state.lastUpdateTime = Date.now();
    
    // Mark all components as stopping
    for (const component of this.state.components.values()) {
      if (component.status === 'running') {
        component.status = 'stopping';
      }
    }
    
    // Save final state
    await this.saveStateToFile();
    
    console.log('🏁 State finalized');
  }

  async cleanup(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.state) {
      this.state.status = 'completed';
      await this.saveStateToFile();
    }
    
    console.log('🧹 State sync cleaned up');
  }

  // Public accessors
  
  getCurrentState(): SessionState | null {
    return this.state;
  }

  getComponentStates(): ComponentState[] {
    if (!this.state) return [];
    return Array.from(this.state.components.values());
  }

  getComponentState(name: string): ComponentState | undefined {
    if (!this.state) return undefined;
    return this.state.components.get(name);
  }

  getMetrics(): any {
    return this.state?.metrics || {};
  }

  getSessionStatus(): string {
    return this.state?.status || 'unknown';
  }

  isComponentHealthy(name: string): boolean {
    const component = this.getComponentState(name);
    if (!component) return false;
    
    const now = Date.now();
    const healthThreshold = 30000; // 30 seconds
    
    return component.status === 'running' && 
           (now - component.lastSeen) < healthThreshold;
  }

  getUnhealthyComponents(): ComponentState[] {
    return this.getComponentStates().filter(
      component => !this.isComponentHealthy(component.name)
    );
  }

  getSessionDuration(): number {
    if (!this.state) return 0;
    return Date.now() - this.state.startTime;
  }

  getTimeSinceLastUpdate(): number {
    if (!this.state) return 0;
    return Date.now() - this.state.lastUpdateTime;
  }

  // Component registration methods
  
  registerComponent(name: string, metadata?: any): void {
    if (!this.state) return;
    
    const component: ComponentState = {
      name,
      status: 'starting',
      lastSeen: Date.now(),
      metadata
    };
    
    this.state.components.set(name, component);
    this.emit('componentRegistered', component);
  }

  updateComponentStatus(name: string, status: ComponentState['status']): void {
    if (!this.state) return;
    
    const component = this.state.components.get(name);
    if (component) {
      component.status = status;
      component.lastSeen = Date.now();
      this.emit('componentStatusChanged', component);
    }
  }

  removeComponent(name: string): void {
    if (!this.state) return;
    
    this.state.components.delete(name);
    this.emit('componentRemoved', name);
  }
}