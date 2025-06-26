// opencode-trace tracer library
// Core tracing functionality for capturing network requests

// Phase 1 - Core Infrastructure
export * from './types.js'
export * from './logger.js'
export * from './session.js'
export * from './config.js'
export * from './filesystem.js'
export * from './validation.js'
export * from './serialization.js'

// Phase 2 - AI Provider Interceptors
export * from './interceptors/ai-provider.js'
export * from './interceptors/streaming-handler.js'
export * from './cost-calculator.js'
export * from './token-tracker.js'
export * from './providers/anthropic.js'
export * from './providers/openai.js'
export * from './providers/google.js'

// Phase 2 - WebSocket Message Capture
export * from './websocket/tracer.js'
export * from './websocket/message-handler.js'
export * from './websocket/connection-manager.js'

// Phase 2 - Tool Execution Tracer
export { ToolExecutionTracer, type ToolExecutionTracerConfig } from './tools/execution-tracer.js'
export { FileMonitor, type FileMonitorConfig } from './tools/file-monitor.js'
export { BashTracer, type BashTracerConfig, type CommandResult } from './tools/bash-tracer.js'
export { DataSanitizer, type SanitizationConfig } from './tools/sanitizer.js'
export { PerformanceMonitor, type PerformanceMetrics, type PerformanceThresholds } from './tools/performance-monitor.js'

// Version info
export const VERSION = '0.1.0'