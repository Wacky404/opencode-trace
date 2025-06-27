import { EventEmitter } from 'node:events';
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { IPCManager } from '../process/ipc.js';
import { EventAggregator } from './event-aggregator.js';
import { StateSync } from './state-sync.js';
import { finalizeEventLogging, flushEventLogs } from './event-logger.js';
import { SessionHTMLGenerator } from './html-generator.js';
import type { SessionContext, IPCMessage, CLIResult } from '../types/cli.js';

export class SessionCoordinator extends EventEmitter {
  private ipcManager: IPCManager;
  private eventAggregator: EventAggregator;
  private stateSync: StateSync;
  private htmlGenerator: SessionHTMLGenerator;
  private session: SessionContext | null = null;
  private isActive = false;

  constructor() {
    super();
    this.ipcManager = new IPCManager();
    this.eventAggregator = new EventAggregator();
    this.stateSync = new StateSync();
    this.htmlGenerator = new SessionHTMLGenerator();
  }

  async startSession(session: SessionContext): Promise<void> {
    this.session = session;
    this.isActive = true;

    console.log(chalk.blue(`🎬 Starting session coordination: ${session.sessionId}`));

    // Initialize IPC
    await this.ipcManager.setupIPC(session.sessionId);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Initialize event aggregation
    await this.eventAggregator.initialize(session);
    
    // Initialize state synchronization
    await this.stateSync.initialize(session);
    
    // Send session start notification
    await this.ipcManager.sendSessionStart();
    
    console.log(chalk.green('✅ Session coordination initialized'));
  }

  async finalizeSession(): Promise<CLIResult> {
    if (!this.session) {
      throw new Error('No active session to finalize');
    }

    console.log(chalk.blue('🏁 Finalizing session...'));

    try {
      // Send session end notification
      await this.ipcManager.sendSessionEnd();
      
      // Wait for any pending events
      await this.waitForPendingEvents();
      
      // Aggregate all events
      const aggregationResult = await this.eventAggregator.finalizeAggregation();
      
      // Flush event logs
      await flushEventLogs();
      
      // Generate session outputs
      const outputs = await this.generateSessionOutputs();
      
      // Cleanup
      await this.cleanup();
      
      console.log(chalk.green('✅ Session finalized successfully'));
      
      return {
        success: true,
        exitCode: 0,
        sessionId: this.session.sessionId,
        traceFile: outputs.traceFile,
        htmlFile: outputs.htmlFile
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Session finalization failed:'), error);
      
      return {
        success: false,
        exitCode: 1,
        error: error instanceof Error ? error : new Error(String(error))
      };
    } finally {
      await this.cleanup();
    }
  }

  async handleEvent(event: any): Promise<void> {
    if (!this.isActive || !this.session) {
      console.warn('Received event but session is not active');
      return;
    }

    try {
      // Process event through aggregator
      await this.eventAggregator.processEvent(event);
      
      // Update session state
      await this.stateSync.updateState(event);
      
      // Emit for other listeners
      this.emit('eventProcessed', event);
      
    } catch (error) {
      console.error('Failed to handle event:', error);
      this.emit('error', error);
    }
  }

  private setupEventHandlers(): void {
    // Handle IPC messages
    this.ipcManager.on('message', (message: IPCMessage) => {
      this.handleIPCMessage(message);
    });

    this.ipcManager.on('sessionStart', (message: IPCMessage) => {
      console.log(chalk.green(`📡 Component started: ${message.source}`));
    });

    this.ipcManager.on('sessionEnd', (message: IPCMessage) => {
      console.log(chalk.yellow(`📡 Component ended: ${message.source}`));
    });

    this.ipcManager.on('traceEvent', (message: IPCMessage) => {
      this.handleEvent(message.data);
    });

    this.ipcManager.on('error', (message: IPCMessage) => {
      console.error(chalk.red(`❌ Component error from ${message.source}:`), message.data);
    });

    // Handle aggregator events
    this.eventAggregator.on('eventAggregated', (aggregatedEvent) => {
      this.emit('eventAggregated', aggregatedEvent);
    });

    this.eventAggregator.on('duplicateDetected', (originalEvent, duplicateEvent) => {
      if (this.session?.config.debug) {
        console.warn(chalk.yellow('⚠️  Duplicate event detected:'), originalEvent.type);
      }
    });

    // Handle state sync events
    this.stateSync.on('stateUpdated', (newState) => {
      this.emit('stateUpdated', newState);
    });
  }

  private async handleIPCMessage(message: IPCMessage): Promise<void> {
    if (this.session?.config.debug) {
      console.log(chalk.gray(`📨 IPC: ${message.type} from ${message.source}`));
    }

    switch (message.type) {
      case 'event':
        await this.handleEvent(message.data);
        break;
      
      case 'status':
        await this.handleStatusUpdate(message);
        break;
      
      case 'health_check':
        await this.handleHealthCheck(message);
        break;
    }
  }

  private async handleStatusUpdate(message: IPCMessage): Promise<void> {
    console.log(chalk.blue(`📊 Status from ${message.source}:`), message.data);
  }

  private async handleHealthCheck(message: IPCMessage): Promise<void> {
    // Respond to health check
    await this.ipcManager.broadcastToComponents({
      type: 'health_check',
      sessionId: this.session!.sessionId,
      timestamp: Date.now(),
      source: 'wrapper',
      data: {
        status: 'healthy',
        uptime: Date.now() - this.session!.startTime
      }
    });
  }

  private async waitForPendingEvents(): Promise<void> {
    console.log(chalk.yellow('⏳ Waiting for pending events...'));
    
    // Give components time to send final events
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Process any remaining IPC messages
    await this.processRemainingIPCMessages();
  }

  private async processRemainingIPCMessages(): Promise<void> {
    if (!this.session) return;
    
    try {
      // Manually check for any remaining IPC files
      const ipcDir = join(process.env.TMPDIR || '/tmp', 'opencode-trace', this.session.sessionId);
      
      if (existsSync(ipcDir)) {
        const files = await readdir(ipcDir);
        
        for (const file of files) {
          if (file.startsWith('msg-') && file.endsWith('.json')) {
            const filePath = join(ipcDir, file);
            try {
              const content = await readFile(filePath, 'utf-8');
              const message: IPCMessage = JSON.parse(content);
              await this.handleIPCMessage(message);
              await unlink(filePath);
            } catch (error) {
              console.warn(`Failed to process remaining IPC message ${file}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to process remaining IPC messages:', error);
    }
  }

  private async generateSessionOutputs(): Promise<{ traceFile: string; htmlFile?: string }> {
    if (!this.session) {
      throw new Error('No active session');
    }

    const sessionDir = join(this.session.traceDir, 'sessions', this.session.sessionId);
    const traceFile = join(sessionDir, 'session.jsonl');
    
    // The JSONL file should already be created by the event logger
    console.log(chalk.blue('📄 Generating session outputs...'));
    
    let htmlFile: string | undefined;
    
    // Generate HTML if auto-generation is enabled
    if (this.session.config.autoGenerateHTML) {
      try {
        const htmlResult = await this.htmlGenerator.generateHTML(this.session, {
          template: this.session.config.debug ? 'debug' : 'default',
          compress: !this.session.config.debug,
          includeDebugInfo: this.session.config.debug
        });
        
        if (htmlResult.success && htmlResult.htmlFile) {
          htmlFile = htmlResult.htmlFile;
          console.log(chalk.green(`✅ HTML viewer generated: ${htmlResult.htmlFile}`));
        } else {
          console.warn(chalk.yellow('⚠️  HTML generation failed:'), htmlResult.error?.message);
          if (htmlResult.warnings) {
            htmlResult.warnings.forEach(warning => 
              console.warn(chalk.yellow(`    ${warning}`))
            );
          }
        }
      } catch (error) {
        console.error(chalk.red('❌ HTML generation error:'), error);
      }
    } else {
      console.log(chalk.gray('  HTML generation disabled (use --auto-generate-html to enable)'));
    }
    
    return {
      traceFile,
      htmlFile
    };
  }

  private async cleanup(): Promise<void> {
    this.isActive = false;
    
    try {
      // Finalize event logging
      await finalizeEventLogging();
      
      // Cleanup aggregator
      await this.eventAggregator.cleanup();
      
      // Cleanup state sync
      await this.stateSync.cleanup();
      
      // Cleanup IPC
      await this.ipcManager.cleanup();
      
      console.log(chalk.green('🧹 Session coordination cleanup completed'));
      
    } catch (error) {
      console.error('Failed to cleanup session coordination:', error);
    }
  }

  // Public methods for external interaction
  
  async sendEvent(event: any): Promise<void> {
    await this.handleEvent(event);
  }

  async logEvent(event: any): Promise<void> {
    if (this.session?.config.debug) {
      console.log(chalk.cyan(`📝 Logging event: ${event.type}`));
    }
    await this.handleEvent(event);
  }

  async broadcastMessage(message: Omit<IPCMessage, 'sessionId' | 'timestamp'>): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    await this.ipcManager.broadcastToComponents({
      ...message,
      sessionId: this.session.sessionId,
      timestamp: Date.now()
    });
  }

  getSessionState(): any {
    return this.stateSync.getCurrentState();
  }

  getSessionStats(): any {
    return {
      sessionId: this.session?.sessionId,
      startTime: this.session?.startTime,
      runtime: this.session ? Date.now() - this.session.startTime : 0,
      eventsProcessed: this.eventAggregator.getEventCount(),
      components: this.stateSync.getComponentStates(),
      isActive: this.isActive
    };
  }
}