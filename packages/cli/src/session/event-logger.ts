import { JSONLLogger } from '@opencode-trace/tracer';
import { setGlobalEventLogger } from '../interceptors/server-interceptor.js';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { InterceptionConfig } from '../types/cli.js';

let logger: JSONLLogger | null = null;
let currentSessionId: string = '';
let loggerSessionId: string = '';

async function ensureTraceDirectories(traceDir: string, sessionId: string): Promise<void> {
  try {
    // Create main trace directory
    await mkdir(traceDir, { recursive: true });
    
    // Create sessions directory
    await mkdir(join(traceDir, 'sessions'), { recursive: true });
    
    // Create session-specific directory
    await mkdir(join(traceDir, 'sessions', sessionId), { recursive: true });
    
  } catch (error) {
    console.error('Failed to create trace directories:', error);
    throw error;
  }
}

export async function setupEventLogging(sessionId: string, config: InterceptionConfig): Promise<void> {
  currentSessionId = sessionId;
  
  try {
    const traceDir = config.traceDir || '.opencode-trace';
    
    // Ensure trace directory structure exists
    await ensureTraceDirectories(traceDir, sessionId);
    
    // Initialize the Plan v1 JSONLLogger
    logger = new JSONLLogger(traceDir);
    
    // Start a session with the JSONLLogger
    const sessionResult = await logger.startSession('CLI Wrapper Session', {
      opencode_version: 'CLI-0.1.0',
      working_directory: process.cwd(),
      user_agent: 'opencode-trace-cli',
      environment: 'cli_wrapper'
    });
    
    if (!sessionResult.success || !sessionResult.data) {
      throw new Error('Failed to start logger session: ' + sessionResult.error?.message);
    }
    
    // Store the logger session ID
    loggerSessionId = sessionResult.data;
    
    // Set up the global event logger
    setGlobalEventLogger(logEventToFile);
    
    console.log(`📝 Event logging initialized for session: ${sessionId}`);
    
  } catch (error) {
    console.error('❌ Failed to initialize event logging:', error);
    throw error;
  }
}

function logEventToFile(event: any): void {
  if (!logger || !loggerSessionId) {
    console.warn('Event logger not initialized, dropping event:', event.type);
    return;
  }
  
  try {
    // Ensure event has required fields for the logger
    const logEvent = {
      ...event,
      session_id: event.session_id || loggerSessionId,
      timestamp: event.timestamp || Date.now()
    };
    
    // Log the event asynchronously
    logger.logEvent(logEvent).catch(error => {
      console.error('Failed to log event:', error);
    });
    
    if (event.type && ['error', 'tool_execution_error', 'http_request_error'].includes(event.type)) {
      console.warn(`⚠️  Logged error event: ${event.type}`);
    }
    
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

export async function flushEventLogs(): Promise<void> {
  if (logger) {
    try {
      // JSONLLogger handles flushing internally via timers
      // We can trigger immediate processing by logging an end event
      console.log('✅ Event logs will be flushed automatically');
    } catch (error) {
      console.error('Failed to flush event logs:', error);
    }
  }
}

export async function finalizeEventLogging(): Promise<void> {
  if (logger) {
    try {
      // End the logger session properly  
      await logger.endSession(loggerSessionId, {
        success: true,
        endTime: Date.now(),
        totalEvents: 0, // Will be calculated by the logger
        summary: 'CLI wrapper session completed'
      });
      
      // Shutdown the logger properly
      await logger.shutdown();
      
      console.log('📝 Event logging finalized');
      
    } catch (error) {
      console.error('Failed to finalize event logging:', error);
    } finally {
      logger = null;
    }
  }
}

export function getLogger(): JSONLLogger | null {
  return logger;
}

export function isLoggingActive(): boolean {
  return logger !== null;
}