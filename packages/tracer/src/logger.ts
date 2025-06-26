import type { TraceEvent } from './types.js';
import type { SessionMetadata, SessionSummary } from './session.js';
import { ConfigManager, type TracerConfig } from './config.js';
import { SessionManager } from './session.js';
import { FileSystemManager } from './filesystem.js';
import { EventValidator } from './validation.js';
import { JSONLSerializer } from './serialization.js';

export interface LoggerResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
  warnings?: string[];
}

export interface BatchLogResult {
  success: boolean;
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  errors: Error[];
}

export class JSONLLogger {
  private config: TracerConfig;
  private sessionManager: SessionManager;
  private fileManager: FileSystemManager;
  private validator: EventValidator;
  private serializer: JSONLSerializer;
  
  private eventQueue: { sessionId: string; event: TraceEvent }[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;
  private processingPromise: Promise<void> | null = null;

  constructor(outputDir?: string) {
    // Initialize with default config first, then load actual config
    this.config = ConfigManager.getDefaultConfig();
    if (outputDir) {
      this.config.outputDir = outputDir;
    }

    this.fileManager = new FileSystemManager(this.config.outputDir);
    this.sessionManager = new SessionManager(this.config);
    this.validator = new EventValidator(this.config);
    this.serializer = new JSONLSerializer(this.config);

    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    try {
      // Load configuration
      const configResult = await ConfigManager.loadConfig();
      if (configResult.success && configResult.data) {
        this.config = configResult.data;
        this.updateComponentConfigs();
      }

      // Ensure directory structure exists
      const dirResult = await this.fileManager.ensureDirectoryStructure();
      if (!dirResult.success) {
        console.error('Failed to create directory structure:', dirResult.error);
      }

      // Start the batch processing timer
      this.scheduleFlush();
    } catch (error) {
      console.error('Failed to initialize JSONLLogger:', error);
    }
  }

  async startSession(userQuery: string, metadata?: SessionMetadata): Promise<LoggerResult<string>> {
    try {
      if (this.isShuttingDown) {
        return {
          success: false,
          error: new Error('Logger is shutting down')
        };
      }

      const defaultMetadata: SessionMetadata = {
        opencode_version: metadata?.opencode_version || 'unknown',
        working_directory: metadata?.working_directory || process.cwd(),
        user_agent: metadata?.user_agent,
        environment: metadata?.environment || process.env.NODE_ENV || 'development',
        git_branch: metadata?.git_branch,
        git_commit: metadata?.git_commit
      };

      const sessionResult = await this.sessionManager.startSession(userQuery, defaultMetadata);
      if (!sessionResult.success || !sessionResult.data) {
        return {
          success: false,
          error: sessionResult.error || new Error('Failed to start session')
        };
      }

      const sessionId = sessionResult.data;

      // Create session file
      const fileResult = await this.fileManager.createSessionFile(sessionId);
      if (!fileResult.success || !fileResult.data) {
        return {
          success: false,
          error: fileResult.error || new Error('Failed to create session file')
        };
      }

      // Set the file path in session manager
      await this.sessionManager.setSessionFilePath(sessionId, fileResult.data);

      // Log the session start event
      const sessionStartEvent = {
        type: 'session_start' as const,
        timestamp: Date.now(),
        session_id: sessionId,
        user_query: userQuery,
        opencode_version: defaultMetadata.opencode_version,
        working_directory: defaultMetadata.working_directory
      };

      const logResult = await this.logEvent(sessionStartEvent);
      if (!logResult.success) {
        return {
          success: false,
          error: logResult.error || new Error('Failed to log session start event'),
          warnings: ['Session was created but start event failed to log']
        };
      }

      return {
        success: true,
        data: sessionId
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async logEvent(event: TraceEvent): Promise<LoggerResult> {
    try {
      if (this.isShuttingDown) {
        return {
          success: false,
          error: new Error('Logger is shutting down')
        };
      }

      // Validate event
      const validationResult = this.validator.validateEvent(event);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: new Error(`Event validation failed: ${validationResult.errors.join(', ')}`)
        };
      }

      const sanitizedEvent = validationResult.sanitizedEvent || event;

      // Check if session exists
      const sessionResult = await this.sessionManager.getSession(sanitizedEvent.session_id);
      if (!sessionResult.success) {
        return {
          success: false,
          error: new Error(`Session not found: ${sanitizedEvent.session_id}`)
        };
      }

      // Add to session metrics
      await this.sessionManager.addEventToSession(sanitizedEvent.session_id, sanitizedEvent);

      // Add to event queue for batch processing
      this.eventQueue.push({
        sessionId: sanitizedEvent.session_id,
        event: sanitizedEvent
      });

      // If queue is getting full, flush immediately
      if (this.eventQueue.length >= this.config.batchSize) {
        await this.flushEventsImmediate();
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async endSession(sessionId: string, summary?: SessionSummary): Promise<LoggerResult<SessionSummary>> {
    try {
      if (this.isShuttingDown) {
        return {
          success: false,
          error: new Error('Logger is shutting down')
        };
      }

      // Flush any pending events for this session first
      await this.flushEventsImmediate();

      // End the session
      const endResult = await this.sessionManager.endSession(sessionId, summary);
      if (!endResult.success || !endResult.data) {
        return {
          success: false,
          error: endResult.error || new Error('Failed to end session')
        };
      }

      const finalSummary = endResult.data;

      // Log the session end event
      const sessionEndEvent = {
        type: 'session_end' as const,
        timestamp: Date.now(),
        session_id: sessionId,
        duration: Date.now() - (await this.sessionManager.getSession(sessionId)).data!.startTime,
        summary: finalSummary
      };

      const logResult = await this.logEvent(sessionEndEvent);
      if (!logResult.success) {
        return {
          success: false,
          error: logResult.error || new Error('Failed to log session end event'),
          warnings: ['Session was ended but end event failed to log']
        };
      }

      // Final flush to ensure all events are written
      await this.flushEventsImmediate();

      // Finalize the session file
      const finalizeResult = await this.fileManager.finalizeSessionFile(sessionId);
      if (!finalizeResult.success) {
        return {
          success: true, // Session ended successfully, but file finalization failed
          data: finalSummary,
          warnings: [`Failed to finalize session file: ${finalizeResult.error?.message}`]
        };
      }

      return {
        success: true,
        data: finalSummary
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async logBatch(events: TraceEvent[]): Promise<BatchLogResult> {
    const result: BatchLogResult = {
      success: true,
      totalEvents: events.length,
      successfulEvents: 0,
      failedEvents: 0,
      errors: []
    };

    for (const event of events) {
      const logResult = await this.logEvent(event);
      if (logResult.success) {
        result.successfulEvents++;
      } else {
        result.failedEvents++;
        if (logResult.error) {
          result.errors.push(logResult.error);
        }
      }
    }

    result.success = result.failedEvents === 0;
    return result;
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0 || this.processingPromise) {
      return;
    }

    this.processingPromise = this.flushEventsImmediate();
    await this.processingPromise;
    this.processingPromise = null;
  }

  private async flushEventsImmediate(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToProcess = this.eventQueue.splice(0);
    
    // Group events by session
    const eventsBySession = new Map<string, TraceEvent[]>();
    for (const { sessionId, event } of eventsToProcess) {
      if (!eventsBySession.has(sessionId)) {
        eventsBySession.set(sessionId, []);
      }
      eventsBySession.get(sessionId)!.push(event);
    }

    // Process each session's events
    for (const [sessionId, events] of eventsBySession) {
      try {
        await this.writeEventsToFile(sessionId, events);
      } catch (error) {
        await this.handleLogError(error as Error, sessionId, events);
      }
    }
  }

  private async writeEventsToFile(sessionId: string, events: TraceEvent[]): Promise<void> {
    const lines: string[] = [];

    for (const event of events) {
      const serializeResult = this.serializer.serialize(event);
      if (!serializeResult.success || !serializeResult.data) {
        throw new Error(`Failed to serialize event: ${serializeResult.error?.message}`);
      }
      lines.push(serializeResult.data);
    }

    const content = lines.join('\n') + '\n';
    
    const writeResult = await this.fileManager.appendToSessionFile(sessionId, content);
    if (!writeResult.success) {
      throw writeResult.error || new Error('Failed to write to session file');
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushEvents().catch(error => {
        console.error('Error during scheduled flush:', error);
      });
      
      if (!this.isShuttingDown) {
        this.scheduleFlush();
      }
    }, this.config.flushIntervalMs);
  }

  private async handleLogError(error: Error, sessionId: string, events: TraceEvent[]): Promise<void> {
    console.error(`Failed to log events for session ${sessionId}:`, error);
    
    // Mark session as failed if it still exists
    try {
      await this.sessionManager.markSessionFailed(sessionId, error);
    } catch (sessionError) {
      console.error('Failed to mark session as failed:', sessionError);
    }

    // Attempt to write error event to file
    try {
      const errorEvent = {
        type: 'error' as const,
        timestamp: Date.now(),
        session_id: sessionId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        failed_events_count: events.length
      };

      const serializeResult = this.serializer.serialize(errorEvent);
      if (serializeResult.success && serializeResult.data) {
        await this.fileManager.appendToSessionFile(sessionId, serializeResult.data + '\n');
      }
    } catch (errorLogError) {
      console.error('Failed to log error event:', errorLogError);
    }
  }

  async getSessionStats(sessionId: string): Promise<LoggerResult<any>> {
    try {
      const sessionResult = await this.sessionManager.getSession(sessionId);
      if (!sessionResult.success || !sessionResult.data) {
        return {
          success: false,
          error: sessionResult.error || new Error('Session not found')
        };
      }

      return {
        success: true,
        data: {
          session: sessionResult.data,
          queueLength: this.eventQueue.length,
          isProcessing: this.processingPromise !== null
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  getActiveSessions(): string[] {
    return this.sessionManager.getActiveSessions();
  }

  async cleanup(retentionDays?: number): Promise<LoggerResult<number>> {
    try {
      const days = retentionDays ?? this.config.autoCleanupDays;
      const cleanupResult = await this.fileManager.cleanup(days);
      
      if (!cleanupResult.success) {
        return {
          success: false,
          error: cleanupResult.error || new Error('Cleanup failed')
        };
      }

      return {
        success: true,
        data: cleanupResult.data || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Cancel the flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Wait for any pending processing to complete
    if (this.processingPromise) {
      await this.processingPromise;
    }

    // Flush any remaining events
    await this.flushEventsImmediate();

    // Shutdown session manager
    await this.sessionManager.shutdown();
  }

  private updateComponentConfigs(): void {
    this.sessionManager.updateConfig(this.config);
    this.validator.updateConfig(this.config);
    this.serializer.updateConfig(this.config);
  }

  async updateConfig(newConfig: Partial<TracerConfig>): Promise<LoggerResult> {
    try {
      const validatedConfig = ConfigManager.validateConfig({ ...this.config, ...newConfig });
      this.config = validatedConfig;
      this.updateComponentConfigs();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  isEnabled(): boolean {
    return ConfigManager.isTracingEnabled();
  }
}