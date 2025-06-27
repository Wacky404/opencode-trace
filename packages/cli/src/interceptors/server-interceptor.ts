import { patchGlobalFetch } from './fetch-patcher.js';
import { setupFileSystemMonitoring } from './fs-monitor.js';
import { setupToolExecutionTracing } from './tool-tracer.js';
import { setupEventLogging } from '../session/event-logger.js';
import type { InterceptionConfig } from '../types/cli.js';

export function initializeServerInterception(
  sessionId: string,
  config: InterceptionConfig = {}
): void {
  try {
    console.log(`🔌 Initializing server interception for session: ${sessionId}`);
    
    // Set up event logging first
    setupEventLogging(sessionId, config);
    
    // Patch global fetch for HTTP request interception
    patchGlobalFetch(sessionId, config);
    
    // Monitor file system operations
    setupFileSystemMonitoring(sessionId, config);
    
    // Trace tool executions
    setupToolExecutionTracing(sessionId, config);
    
    // Log initialization event
    logEvent({
      type: 'interception_initialized',
      sessionId,
      timestamp: Date.now(),
      data: {
        mode: 'server',
        config: {
          includeAllRequests: config.includeAllRequests,
          maxBodySize: config.maxBodySize,
          debug: config.debug
        }
      }
    });
    
    console.log('✅ Server interception initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize server interception:', error);
    throw error;
  }
}

// Global event logger (will be set up by setupEventLogging)
let globalEventLogger: ((event: any) => void) | null = null;

export function setGlobalEventLogger(logger: (event: any) => void): void {
  globalEventLogger = logger;
}

export function logEvent(event: any): void {
  if (globalEventLogger) {
    globalEventLogger(event);
  } else {
    console.warn('Event logger not initialized, dropping event:', event.type);
  }
}

// Cleanup function for graceful shutdown
export function cleanupInterception(): void {
  console.log('🧹 Cleaning up server interception...');
  
  // Restore original functions
  restoreFetch();
  restoreFileSystemMonitoring();
  restoreToolExecutionTracing();
  
  // Log cleanup event
  if (globalEventLogger) {
    globalEventLogger({
      type: 'interception_cleanup',
      timestamp: Date.now()
    });
  }
  
  console.log('✅ Server interception cleanup completed');
}

// Placeholder cleanup functions (will be implemented by each module)
let restoreFetch: () => void = () => {};
let restoreFileSystemMonitoring: () => void = () => {};
let restoreToolExecutionTracing: () => void = () => {};

export function setCleanupFunctions(
  fetch: () => void,
  fs: () => void,
  tools: () => void
): void {
  restoreFetch = fetch;
  restoreFileSystemMonitoring = fs;
  restoreToolExecutionTracing = tools;
}

// Export interface for other modules
export interface InterceptionAPI {
  logEvent: typeof logEvent;
  sessionId: string;
  config: InterceptionConfig;
}

let currentAPI: InterceptionAPI | null = null;

export function getInterceptionAPI(): InterceptionAPI | null {
  return currentAPI;
}

export function setInterceptionAPI(api: InterceptionAPI): void {
  currentAPI = api;
}