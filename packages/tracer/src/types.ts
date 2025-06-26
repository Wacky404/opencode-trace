// Type definitions for opencode-trace events

import type { SessionSummary } from './session.js';
import type { TokenUsage } from './cost-calculator.js';

export interface TraceEvent {
  type: string
  timestamp: number
  session_id: string
}

export interface SessionStartEvent extends TraceEvent {
  type: 'session_start'
  user_query: string
  opencode_version: string
  working_directory: string
}

export interface SessionEndEvent extends TraceEvent {
  type: 'session_end'
  duration: number
  summary: SessionSummary
}

export interface AIRequestEvent extends TraceEvent {
  type: 'ai_request'
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  url?: string
  headers?: Record<string, string>
}

export interface AIResponseEvent extends TraceEvent {
  type: 'ai_response'
  provider: string
  model: string
  cost?: number
  tokens_used?: TokenUsage
  response?: any
}

export interface ToolExecutionEvent extends TraceEvent {
  type: 'tool_execution'
  tool_name: string
  parameters?: any
  result?: any
  timing?: RequestTiming
  success: boolean
  error?: string
}

export interface NetworkRequestEvent extends TraceEvent {
  type: 'network_request'
  url: string
  method: string
  headers?: Record<string, string>
  body?: any
}

export interface NetworkResponseEvent extends TraceEvent {
  type: 'network_response'
  status: number
  headers?: Record<string, string>
  body?: any
  timing?: RequestTiming
}

export interface RequestTiming {
  start: number
  end: number
  duration: number
}

// WebSocket-specific event types
export interface WebSocketConnectionEvent extends TraceEvent {
  type: 'websocket_connection'
  url: string
  protocols?: string[]
  state: 'connecting' | 'open' | 'closing' | 'closed'
  timing?: RequestTiming
}

export interface WebSocketMessageEvent extends TraceEvent {
  type: 'websocket_message'
  direction: 'sent' | 'received'
  message_type: 'text' | 'binary' | 'ping' | 'pong' | 'close'
  data?: any
  size: number
  timing?: RequestTiming
}

export interface WebSocketErrorEvent extends TraceEvent {
  type: 'websocket_error'
  error: string
  code?: number
  reason?: string
}

// WebSocket configuration and state
export interface WebSocketConfig {
  captureMessages: boolean
  maxMessageSize: number
  sanitizeData: boolean
  enablePerformanceMetrics: boolean
}

export interface WebSocketMetrics {
  connectionCount: number
  messagesInbound: number
  messagesOutbound: number
  bytesInbound: number
  bytesOutbound: number
  averageLatency: number
  connectionDuration: number
  errors: number
}

// Tool execution specific event types
export interface FileOperationEvent extends TraceEvent {
  type: 'file_operation'
  operation: 'read' | 'write' | 'edit' | 'delete' | 'create' | 'move' | 'copy'
  file_path: string
  content_preview?: string
  size?: number
  timing?: RequestTiming
  success: boolean
  error?: string
  diff?: {
    additions: number
    deletions: number
    preview: string
  }
}

export interface BashCommandEvent extends TraceEvent {
  type: 'bash_command'
  command: string
  args?: string[]
  working_directory: string
  exit_code: number
  stdout?: string
  stderr?: string
  timing?: RequestTiming
  success: boolean
  sanitized_output?: boolean
}

export interface ToolResultEvent extends TraceEvent {
  type: 'tool_result'
  tool_name: string
  input_data?: any
  output_data?: any
  size_bytes: number
  processing_time: number
  success: boolean
  error?: string
  sanitized?: boolean
}

// Tool execution configuration
export interface ToolExecutionConfig {
  captureFileOperations: boolean
  captureBashCommands: boolean
  sanitizeOutput: boolean
  maxOutputSize: number
  maxFileSize: number
  enablePerformanceMetrics: boolean
  whitelistedCommands?: string[]
  blacklistedPaths?: string[]
}

// Tool execution metrics
export interface ToolExecutionMetrics {
  fileOperations: number
  bashCommands: number
  totalToolCalls: number
  averageExecutionTime: number
  totalDataProcessed: number
  sanitizedOperations: number
  errors: number
}