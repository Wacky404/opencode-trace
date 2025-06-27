import { ChildProcess } from 'node:child_process';
import { logEvent } from './server-interceptor.js';
import type { InterceptionConfig } from '../types/cli.js';

// Placeholder for dynamic patching implementation

// Store original functions (placeholder for future implementation)
const originalChildProcess = {};

let currentSessionId: string = '';
let currentConfig: InterceptionConfig = {};
let isPatched = false;

export function setupToolExecutionTracing(sessionId: string, config: InterceptionConfig): void {
  currentSessionId = sessionId;
  currentConfig = config;
  
  // TODO: Implement proper tool execution tracing without dynamic requires
  console.log('🔧 Tool execution tracing configured (implementation pending)');
  
  // Log a placeholder event
  logEvent({
    type: 'tool_tracing_initialized',
    sessionId,
    timestamp: Date.now(),
    data: {
      note: 'Tool execution tracing is configured but not yet patching (ES module limitations)'
    }
  });
}

function patchSpawn(): void {
  const childProcess = require('node:child_process');
  
  childProcess.spawn = function(command: string, args?: readonly string[], options?: any) {
    const executionId = generateExecutionId();
    const startTime = Date.now();
    
    // Log tool execution start
    logEvent({
      type: 'tool_execution_start',
      sessionId: currentSessionId,
      timestamp: startTime,
      executionId,
      data: {
        command,
        args: args || [],
        options: sanitizeOptions(options),
        tool: detectToolType(command)
      }
    });
    
    try {
      const childProcess = originalChildProcess.spawn.call(this, command, args, options);
      
      // Set up output monitoring
      setupProcessMonitoring(childProcess, executionId, command, startTime);
      
      return childProcess;
      
    } catch (error) {
      logEvent({
        type: 'tool_execution_error',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        executionId,
        data: {
          command,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        }
      });
      throw error;
    }
  };
}

function patchExec(): void {
  const childProcess = require('node:child_process');
  
  childProcess.exec = function(command: string, options?: any, callback?: any) {
    // Handle overloaded function signatures
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    const executionId = generateExecutionId();
    const startTime = Date.now();
    
    logEvent({
      type: 'tool_execution_start',
      sessionId: currentSessionId,
      timestamp: startTime,
      executionId,
      data: {
        command,
        options: sanitizeOptions(options),
        tool: detectToolType(command),
        method: 'exec'
      }
    });
    
    const wrappedCallback = (error: any, stdout: any, stderr: any) => {
      const endTime = Date.now();
      
      if (error) {
        logEvent({
          type: 'tool_execution_error',
          sessionId: currentSessionId,
          timestamp: endTime,
          executionId,
          data: {
            command,
            error: error.message,
            stderr: truncateOutput(stderr?.toString()),
            duration: endTime - startTime,
            exitCode: error.code
          }
        });
      } else {
        logEvent({
          type: 'tool_execution_complete',
          sessionId: currentSessionId,
          timestamp: endTime,
          executionId,
          data: {
            command,
            stdout: truncateOutput(stdout?.toString()),
            stderr: truncateOutput(stderr?.toString()),
            duration: endTime - startTime,
            exitCode: 0
          }
        });
      }
      
      if (callback) callback(error, stdout, stderr);
    };
    
    return originalChildProcess.exec.call(this, command, options, wrappedCallback);
  };
}

function patchExecSync(): void {
  const childProcess = require('node:child_process');
  
  childProcess.execSync = function(command: string, options?: any) {
    const executionId = generateExecutionId();
    const startTime = Date.now();
    
    logEvent({
      type: 'tool_execution_start',
      sessionId: currentSessionId,
      timestamp: startTime,
      executionId,
      data: {
        command,
        options: sanitizeOptions(options),
        tool: detectToolType(command),
        method: 'execSync'
      }
    });
    
    try {
      const result = originalChildProcess.execSync.call(this, command, options);
      
      logEvent({
        type: 'tool_execution_complete',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        executionId,
        data: {
          command,
          stdout: truncateOutput(result?.toString()),
          duration: Date.now() - startTime,
          exitCode: 0
        }
      });
      
      return result;
      
    } catch (error: any) {
      logEvent({
        type: 'tool_execution_error',
        sessionId: currentSessionId,
        timestamp: Date.now(),
        executionId,
        data: {
          command,
          error: error.message,
          stderr: truncateOutput(error.stderr?.toString()),
          duration: Date.now() - startTime,
          exitCode: error.status
        }
      });
      throw error;
    }
  };
}

function setupProcessMonitoring(
  childProcess: ChildProcess,
  executionId: string,
  command: string,
  startTime: number
): void {
  let stdoutData = '';
  let stderrData = '';
  
  // Monitor stdout
  if (childProcess.stdout) {
    childProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
      
      if (currentConfig.debug) {
        logEvent({
          type: 'tool_output',
          sessionId: currentSessionId,
          timestamp: Date.now(),
          executionId,
          data: {
            command,
            output: data.toString(),
            stream: 'stdout'
          }
        });
      }
    });
  }
  
  // Monitor stderr
  if (childProcess.stderr) {
    childProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      
      if (currentConfig.debug) {
        logEvent({
          type: 'tool_output',
          sessionId: currentSessionId,
          timestamp: Date.now(),
          executionId,
          data: {
            command,
            output: data.toString(),
            stream: 'stderr'
          }
        });
      }
    });
  }
  
  // Monitor process exit
  childProcess.on('exit', (code, signal) => {
    const endTime = Date.now();
    
    if (code === 0) {
      logEvent({
        type: 'tool_execution_complete',
        sessionId: currentSessionId,
        timestamp: endTime,
        executionId,
        data: {
          command,
          stdout: truncateOutput(stdoutData),
          stderr: truncateOutput(stderrData),
          duration: endTime - startTime,
          exitCode: code
        }
      });
    } else {
      logEvent({
        type: 'tool_execution_error',
        sessionId: currentSessionId,
        timestamp: endTime,
        executionId,
        data: {
          command,
          stdout: truncateOutput(stdoutData),
          stderr: truncateOutput(stderrData),
          duration: endTime - startTime,
          exitCode: code,
          signal
        }
      });
    }
  });
  
  childProcess.on('error', (error) => {
    logEvent({
      type: 'tool_execution_error',
      sessionId: currentSessionId,
      timestamp: Date.now(),
      executionId,
      data: {
        command,
        error: error.message,
        duration: Date.now() - startTime
      }
    });
  });
}

function detectToolType(command: string): string {
  const cmd = command.toLowerCase().split(' ')[0];
  
  // Common development tools
  if (cmd.includes('npm') || cmd.includes('yarn') || cmd.includes('pnpm')) return 'package_manager';
  if (cmd.includes('git')) return 'version_control';
  if (cmd.includes('docker')) return 'container';
  if (cmd.includes('kubectl')) return 'kubernetes';
  if (cmd.includes('node') || cmd.includes('python') || cmd.includes('go')) return 'runtime';
  if (cmd.includes('make') || cmd.includes('cmake') || cmd.includes('gradle')) return 'build_system';
  if (cmd.includes('curl') || cmd.includes('wget')) return 'http_client';
  if (cmd.includes('ssh') || cmd.includes('scp')) return 'remote_access';
  if (cmd.includes('ls') || cmd.includes('cat') || cmd.includes('grep')) return 'file_system';
  
  return 'unknown';
}

function sanitizeOptions(options: any): any {
  if (!options) return {};
  
  // Remove sensitive information
  const sanitized = { ...options };
  
  // Remove environment variables that might contain secrets
  if (sanitized.env) {
    const env = { ...sanitized.env };
    for (const key in env) {
      if (key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('key')) {
        env[key] = '[REDACTED]';
      }
    }
    sanitized.env = env;
  }
  
  return sanitized;
}

function truncateOutput(output: string): string {
  if (!output) return '';
  
  const maxSize = 4096; // 4KB limit for tool output
  
  if (output.length <= maxSize) {
    return output;
  }
  
  return output.substring(0, maxSize) + `\n[... truncated ${output.length - maxSize} characters]`;
}

function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function restoreToolExecutionTracing(): void {
  console.log('🔧 Tool execution tracing cleanup (no-op)');
}