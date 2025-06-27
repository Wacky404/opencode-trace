import type { ChildProcess } from 'node:child_process';

export interface CLIConfig {
  // Core options
  prompt?: string;                    // Direct prompt for opencode
  includeAllRequests: boolean;        // --include-all-requests
  traceDir: string;                   // --trace-dir (default: .opencode-trace)
  
  // opencode forwarding
  opencodeArgs: string[];             // Remaining args passed to opencode
  nonInteractive: boolean;            // --run (use opencode run mode)
  continueSession: boolean;           // --continue
  sessionId?: string;                 // --session
  share: boolean;                     // --share
  
  // Tracing options
  autoGenerateHTML: boolean;          // --generate-html (default: true)
  openBrowser: boolean;               // --open (default: false)
  maxBodySize: number;                // --max-body-size (default: 1MB)
  
  // Session options
  sessionName?: string;               // --session-name
  tags: string[];                     // --tag (repeatable)
  
  // Debug options
  debug: boolean;                     // --debug
  verbose: boolean;                   // --verbose
  quiet: boolean;                     // --quiet
  proxyPort?: number;                 // --proxy-port
}

export interface ProcessInfo {
  process: ChildProcess;
  pid: number;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startTime: number;
  name: string;
}

export interface SessionContext {
  sessionId: string;
  sessionName?: string;
  traceDir: string;
  config: CLIConfig;
  processes: Map<string, ProcessInfo>;
  startTime: number;
  tags: string[];
}

export interface IPCMessage {
  type: 'session_start' | 'session_end' | 'event' | 'status' | 'error' | 'health_check';
  sessionId: string;
  timestamp: number;
  data?: any;
  source: 'wrapper' | 'server' | 'tui';
}

export interface CLIResult {
  success: boolean;
  sessionId?: string;
  traceFile?: string;
  htmlFile?: string;
  error?: Error;
  exitCode: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface InterceptionConfig {
  traceDir?: string;
  debug?: boolean;
  includeAllRequests?: boolean;
  maxBodySize?: number;
  verbose?: boolean;
}