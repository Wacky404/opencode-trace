import { logEvent } from './server-interceptor.js';
import type { InterceptionConfig } from '../types/cli.js';

// For now, disable fs monitoring to avoid ES module issues
// This would require a different approach in production (e.g., using Module.wrap)
let fs: any = null;
let fsPromises: any = null;

async function loadFsModules() {
  try {
    fs = await import('node:fs');
    fsPromises = await import('node:fs/promises');
  } catch (error) {
    console.warn('Failed to load fs modules for monitoring:', error);
  }
}

// Store original functions (placeholder for future implementation)
const originalFs = {};
const originalFsPromises = {};

let currentSessionId: string = '';
let currentConfig: InterceptionConfig = {};
let isPatched = false;

export function setupFileSystemMonitoring(sessionId: string, config: InterceptionConfig): void {
  currentSessionId = sessionId;
  currentConfig = config;
  
  // TODO: Implement proper fs monitoring without dynamic requires
  // For now, just log that it would be enabled
  console.log('📁 File system monitoring configured (implementation pending)');
  
  // Log a placeholder event
  logEvent({
    type: 'fs_monitoring_initialized',
    sessionId,
    timestamp: Date.now(),
    data: {
      note: 'File system monitoring is configured but not yet patching (ES module limitations)'
    }
  });
}

function patchSyncFunctions(): void {
  // Patch writeFileSync
  fs.writeFileSync = function(file: fs.PathLike, data: any, options?: any) {
    const filePath = file.toString();
    
    logEvent({
      type: 'file_write_start',
      sessionId: currentSessionId,
      timestamp: Date.now(),
      data: {
        path: filePath,
        size: getDataSize(data),
        operation: 'writeFileSync'
      }
    });
    
    try {
      const result = originalFs.writeFileSync.call(this, file, data, options);
      
      logEvent({
        type: 'file_write_complete',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'writeFileSync',
          success: true
        }
      });
      
      return result;
    } catch (error) {
      logEvent({
        type: 'file_write_error',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'writeFileSync',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  };
  
  // Patch readFileSync
  fs.readFileSync = function(path: fs.PathLike, options?: any) {
    const filePath = path.toString();
    
    logEvent({
      type: 'file_read_start',
      sessionId: currentSessionId,
      timestamp: Date.now(),
      data: {
        path: filePath,
        operation: 'readFileSync'
      }
    });
    
    try {
      const result = originalFs.readFileSync.call(this, path, options);
      
      logEvent({
        type: 'file_read_complete',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'readFileSync',
          size: getDataSize(result),
          success: true
        }
      });
      
      return result;
    } catch (error) {
      logEvent({
        type: 'file_read_error',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'readFileSync',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  };
  
  // Patch mkdirSync
  fs.mkdirSync = function(path: fs.PathLike, options?: any) {
    const dirPath = path.toString();
    
    logEvent({
      type: 'directory_create_start',
      sessionId: currentSessionId,
      timestamp: Date.now(),
      data: {
        path: dirPath,
        operation: 'mkdirSync'
      }
    });
    
    try {
      const result = originalFs.mkdirSync.call(this, path, options);
      
      logEvent({
        type: 'directory_create_complete',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: dirPath,
          operation: 'mkdirSync',
          success: true
        }
      });
      
      return result;
    } catch (error) {
      logEvent({
        type: 'directory_create_error',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: dirPath,
          operation: 'mkdirSync',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  };
}

function patchAsyncFunctions(): void {
  // Patch writeFile
  fs.writeFile = function(file: fs.PathLike, data: any, options: any, callback?: any) {
    // Handle overloaded function signatures
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    const filePath = file.toString();
    
    logEvent({
      type: 'file_write_start',
      sessionId: currentSessionId,
      timestamp: Date.now(),
      data: {
        path: filePath,
        size: getDataSize(data),
        operation: 'writeFile'
      }
    });
    
    const wrappedCallback = (error: NodeJS.ErrnoException | null) => {
      if (error) {
        logEvent({
          type: 'file_write_error',
          sessionId: currentSessionId,
          timestamp: Date.now(),
          data: {
            path: filePath,
            operation: 'writeFile',
            error: error.message
          }
        });
      } else {
        logEvent({
          type: 'file_write_complete',
          sessionId: currentSessionId,
          timestamp: Date.now(),
          data: {
            path: filePath,
            operation: 'writeFile',
            success: true
          }
        });
      }
      
      if (callback) callback(error);
    };
    
    return originalFs.writeFile.call(this, file, data, options, wrappedCallback);
  };
}

function patchPromiseFunctions(): void {
  // Patch promises.writeFile
  fsPromises.writeFile = async function(file: fs.PathLike, data: any, options?: any) {
    const filePath = file.toString();
    
    logEvent({
      type: 'file_write_start',
      sessionId: currentSessionId,
      timestamp: Date.now(),
      data: {
        path: filePath,
        size: getDataSize(data),
        operation: 'writeFile (promise)'
      }
    });
    
    try {
      const result = await originalFsPromises.writeFile.call(this, file, data, options);
      
      logEvent({
        type: 'file_write_complete',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'writeFile (promise)',
          success: true
        }
      });
      
      return result;
    } catch (error) {
      logEvent({
        type: 'file_write_error',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'writeFile (promise)',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  };
  
  // Patch promises.readFile
  fsPromises.readFile = async function(path: fs.PathLike, options?: any) {
    const filePath = path.toString();
    
    logEvent({
      type: 'file_read_start',
      sessionId: currentSessionId,
      timestamp: Date.now(),
      data: {
        path: filePath,
        operation: 'readFile (promise)'
      }
    });
    
    try {
      const result = await originalFsPromises.readFile.call(this, path, options);
      
      logEvent({
        type: 'file_read_complete',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'readFile (promise)',
          size: getDataSize(result),
          success: true
        }
      });
      
      return result;
    } catch (error) {
      logEvent({
        type: 'file_read_error',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        data: {
          path: filePath,
          operation: 'readFile (promise)',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  };
}

function getDataSize(data: any): number {
  if (typeof data === 'string') {
    return Buffer.byteLength(data, 'utf8');
  } else if (Buffer.isBuffer(data)) {
    return data.length;
  } else if (data instanceof ArrayBuffer) {
    return data.byteLength;
  } else if (data && typeof data === 'object') {
    try {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch {
      return 0;
    }
  }
  return 0;
}

function shouldMonitorPath(path: string): boolean {
  // Skip monitoring trace files and common temporary files
  const skipPatterns = [
    '.opencode-trace',
    'node_modules',
    '.git',
    '.cache',
    'tmp',
    'temp',
    '.log'
  ];
  
  return !skipPatterns.some(pattern => path.includes(pattern));
}

export function restoreFileSystemMonitoring(): void {
  console.log('📁 File system monitoring cleanup (no-op)');
}