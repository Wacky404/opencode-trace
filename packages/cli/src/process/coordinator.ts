import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import chalk from 'chalk';
import { ProcessSpawner } from './spawner.js';
import { IPCManager } from './ipc.js';
import { ProcessMonitor } from './monitor.js';
import { CleanupManager } from './cleanup.js';
import { SessionCoordinator } from '../session/coordinator.js';
import { setupEventLogging } from '../session/event-logger.js';
import type { CLIConfig, SessionContext, ProcessInfo, CLIResult } from '../types/cli.js';

export class ProcessCoordinator extends EventEmitter {
  private spawner: ProcessSpawner;
  private ipcManager: IPCManager;
  private monitor: ProcessMonitor;
  private cleanup: CleanupManager;
  private sessionCoordinator: SessionCoordinator;
  private session: SessionContext | null = null;
  private isShuttingDown = false;

  constructor() {
    super();
    this.spawner = new ProcessSpawner();
    this.ipcManager = new IPCManager();
    this.monitor = new ProcessMonitor();
    this.cleanup = new CleanupManager();
    this.sessionCoordinator = new SessionCoordinator();

    // Setup cleanup on process signals
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error(chalk.red('Uncaught exception:'), error);
      this.gracefulShutdown('ERROR');
    });
  }

  async execute(config: CLIConfig): Promise<CLIResult> {
    try {
      console.log(chalk.blue('🚀 Starting opencode-trace session...'));
      
      // Create session context
      this.session = this.createSessionContext(config);
      
      // Setup event logging
      await setupEventLogging(this.session.sessionId, {
        traceDir: config.traceDir,
        debug: config.debug,
        includeAllRequests: config.includeAllRequests,
        maxBodySize: config.maxBodySize,
        verbose: config.verbose
      });
      
      // Start session coordination
      await this.sessionCoordinator.startSession(this.session);
      
      // Setup IPC communication
      await this.setupIPC();
      
      // Spawn opencode processes
      await this.spawnOpenCode(config);
      
      // Connect proxy events to session logging (after proxy is created)
      this.connectProxyEvents();
      
      // Wait for processes to be ready
      await this.waitForReady();
      
      // Monitor processes
      this.monitorProcesses();
      
      // Wait for completion
      const result = await this.waitForCompletion();
      
      console.log(chalk.green('✅ Session completed successfully'));
      return result;
      
    } catch (error) {
      console.error(chalk.red('❌ Session failed:'), error);
      await this.shutdown();
      return {
        success: false,
        exitCode: 1,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async spawnOpenCode(config: CLIConfig): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    console.log(chalk.yellow('📦 Spawning opencode processes...'));
    
    try {
      // Spawn TypeScript server first
      const serverProcess = await this.spawner.spawnTypescriptServer(config);
      this.addProcess('server', serverProcess);
      
      // Spawn Go TUI
      const tuiProcess = await this.spawner.spawnGoTUI(config);
      this.addProcess('tui', tuiProcess);
      
      console.log(chalk.green('✓ All processes spawned successfully'));
      
    } catch (error) {
      throw new Error(`Failed to spawn opencode processes: ${error}`);
    }
  }

  async waitForReady(): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    console.log(chalk.yellow('⏳ Waiting for processes to be ready...'));
    
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkReady = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for processes to be ready'));
          return;
        }

        const processes = Array.from(this.session!.processes.values());
        const allReady = processes.every(proc => proc.status === 'running');
        const anyCompleted = processes.some(proc => proc.status === 'stopped');
        
        if (allReady) {
          console.log(chalk.green('✓ All processes ready'));
          resolve();
        } else if (anyCompleted) {
          console.log(chalk.blue('✓ Processes completed quickly, proceeding...'));
          resolve();
        } else {
          setTimeout(checkReady, 500);
        }
      };

      // Also listen for session completion during readiness check
      this.once('sessionComplete', () => {
        console.log(chalk.blue('✓ Session completed during startup, proceeding...'));
        resolve();
      });

      checkReady();
    });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    console.log(chalk.yellow('🔄 Shutting down processes...'));
    
    if (this.session) {
      // Stop all processes gracefully
      for (const [name, procInfo] of this.session.processes) {
        await this.stopProcess(name, procInfo);
      }
      
      // Stop proxy server
      await this.spawner.stopProxy();
      
      // Cleanup IPC
      await this.ipcManager.cleanup();
      
      // Run cleanup tasks
      await this.cleanup.cleanup(this.session);
    }
    
    console.log(chalk.green('✓ Shutdown complete'));
  }

  private connectProxyEvents(): void {
    const proxy = this.spawner.getProxy();
    if (!proxy) return;

    // Forward proxy events to session coordinator for logging
    proxy.on('event', (event) => {
      // Add validation to prevent undefined events from crashing the system
      if (!event || typeof event !== 'object') {
        console.warn(chalk.yellow('⚠️  Received invalid proxy event (not an object):'), event);
        return;
      }

      if (!event.type) {
        console.warn(chalk.yellow('⚠️  Received proxy event without type field:'), event);
        return;
      }

      if (this.session?.config.debug) {
        console.log(chalk.green(`🌐 Proxy event: ${event.type} - ${event.data?.url || event.data?.host || 'unknown'}`));
      }
      
      // Convert proxy event to session event and forward with proper validation
      const sessionEvent = {
        type: event.type,
        sessionId: event.sessionId || this.session?.sessionId || 'unknown',
        timestamp: event.timestamp || Date.now(),
        data: {
          ...(event.data || {}),
          source: 'proxy'
        }
      };

      this.sessionCoordinator.logEvent(sessionEvent);
    });
  }

  private createSessionContext(config: CLIConfig): SessionContext {
    const sessionId = config.sessionId || this.generateSessionId();
    
    return {
      sessionId,
      sessionName: config.sessionName,
      traceDir: config.traceDir,
      config,
      processes: new Map(),
      startTime: Date.now(),
      tags: config.tags
    };
  }

  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  private async setupIPC(): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }
    
    await this.ipcManager.setupIPC(this.session.sessionId);
    
    // Handle IPC messages
    this.ipcManager.on('message', (message) => {
      this.handleIPCMessage(message);
    });
  }

  private addProcess(name: string, process: ChildProcess): void {
    if (!this.session) {
      throw new Error('Session not initialized');
    }
    
    const processInfo: ProcessInfo = {
      process,
      pid: process.pid || -1,
      status: 'starting',
      startTime: Date.now(),
      name
    };
    
    this.session.processes.set(name, processInfo);
    
    // Setup process event handlers
    process.on('exit', (code) => {
      processInfo.status = code === 0 ? 'stopped' : 'error';
      this.emit('processExit', name, code);
      
      // If the TUI process exits, trigger session completion
      if (name === 'tui') {
        console.log(chalk.blue('🏁 Main opencode process completed, finalizing session...'));
        this.emit('sessionComplete', code);
      }
    });
    
    process.on('error', (error) => {
      processInfo.status = 'error';
      this.emit('processError', name, error);
    });
    
    // Mark as running after a short delay
    setTimeout(() => {
      if (processInfo.status === 'starting') {
        processInfo.status = 'running';
      }
    }, 1000);
  }

  private async stopProcess(name: string, processInfo: ProcessInfo): Promise<void> {
    if (processInfo.status === 'stopped') {
      return;
    }
    
    processInfo.status = 'stopping';
    
    // Try graceful shutdown first
    processInfo.process.kill('SIGTERM');
    
    // Wait for graceful shutdown
    const gracefulTimeout = 5000;
    const startTime = Date.now();
    
    while (processInfo.status === 'stopping' && Date.now() - startTime < gracefulTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Force kill if still running
    if (processInfo.status === 'stopping') {
      console.warn(chalk.yellow(`⚠️  Force killing process ${name}`));
      processInfo.process.kill('SIGKILL');
    }
  }

  private monitorProcesses(): void {
    if (!this.session) {
      return;
    }
    
    this.monitor.startMonitoring(this.session.processes);
    
    this.monitor.on('processUnhealthy', (name) => {
      console.warn(chalk.yellow(`⚠️  Process ${name} appears unhealthy`));
    });
    
    this.monitor.on('processRecovered', (name) => {
      console.log(chalk.green(`✓ Process ${name} recovered`));
    });
  }

  private async waitForCompletion(): Promise<CLIResult> {
    return new Promise(async (resolve) => {
      // Set up completion handlers
      const completionHandler = async (exitCode: number) => {
        try {
          console.log(chalk.blue('📄 Finalizing session and generating outputs...'));
          const result = await this.sessionCoordinator.finalizeSession();
          resolve({
            ...result,
            exitCode: exitCode || result.exitCode
          });
        } catch (error) {
          resolve({
            success: false,
            exitCode: 1,
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      };

      // Listen for session completion (when main opencode process exits)
      this.once('sessionComplete', completionHandler);

      // Fallback timeout in case processes don't exit properly
      const fallbackTimeout = setTimeout(async () => {
        console.log(chalk.yellow('⏰ Session timeout reached, forcing finalization...'));
        this.removeListener('sessionComplete', completionHandler);
        await completionHandler(0);
      }, 60000); // 60 second timeout

      // Clean up timeout if session completes normally
      this.once('sessionComplete', () => {
        clearTimeout(fallbackTimeout);
      });
    });
  }

  private handleIPCMessage(message: any): void {
    // Handle different types of IPC messages
    console.log(chalk.gray(`📨 IPC message: ${JSON.stringify(message)}`));
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(chalk.yellow(`\n🛑 Received ${signal}, shutting down gracefully...`));
    await this.shutdown();
    process.exit(signal === 'ERROR' ? 1 : 0);
  }
}