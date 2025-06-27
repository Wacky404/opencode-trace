# Technical Specifications - Plan v2: CLI Wrapper

## Overview

This document provides detailed technical specifications for the `opencode-trace` CLI wrapper, including APIs, data formats, integration patterns, and implementation details.

## System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           opencode-trace CLI Wrapper                           │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│ │ Arg Parser  │ │ Config Mgr  │ │ Session Mgr │ │ Process Coordinator         │ │
│ │ • CLI flags │ │ • Validation│ │ • Lifecycle │ │ • IPC setup                 │ │
│ │ • Defaults  │ │ • Defaults  │ │ • Metadata  │ │ • Process orchestration     │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Runtime Injection Layer                               │
│ ┌───────────────────────────────────────┐ ┌───────────────────────────────────┐ │
│ │         TypeScript Server             │ │            Go TUI Client          │ │
│ │ ┌───────────────────────────────────┐ │ │ ┌───────────────────────────────┐ │ │
│ │ │ --require interceptor-loader.js   │ │ │ │ HTTP Client Injection         │ │ │
│ │ │ • Patches globalThis.fetch()      │ │ │ │ • Wraps http.Client           │ │ │
│ │ │ • Monitors fs operations          │ │ │ │ • Traces TUI ↔ Server calls   │ │ │
│ │ │ • Captures tool executions        │ │ │ │ • Logs tool executions        │ │ │
│ │ └───────────────────────────────────┘ │ │ └───────────────────────────────┘ │ │
│ └───────────────────────────────────────┘ └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Event Collection & Processing                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│ │ Event       │ │ Data        │ │ HTML        │ │ Session Browser             │ │
│ │ Aggregator  │ │ Processor   │ │ Generator   │ │ Integration                 │ │
│ │ • Collect   │ │ • Correlate │ │ • Template  │ │ • Index updates            │ │
│ │ • Dedupe    │ │ • Metrics   │ │ • Embed     │ │ • Multi-session view       │ │
│ │ • Order     │ │ • Analysis  │ │ • Optimize  │ │ • Search & filter          │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## API Specifications

### CLI Interface

#### Command Structure
```bash
opencode-trace [OPTIONS] [PROMPT]
opencode-trace [COMMAND] [OPTIONS]
```

#### Main Commands
```typescript
interface CLICommands {
  // Primary usage
  default: {
    usage: "opencode-trace [options] <prompt>"
    description: "Run opencode with comprehensive tracing"
    examples: [
      'opencode-trace "Create a React component"',
      'opencode-trace --include-all-requests "Debug this issue"'
    ]
  }
  
  // Explicit run command
  run: {
    usage: "opencode-trace run [options] <prompt>"
    description: "Run opencode in non-interactive mode with tracing"
    examples: [
      'opencode-trace run "What is this error?" --quiet',
      'opencode-trace run --continue "Continue the previous task"'
    ]
  }
  
  // Session management
  list: {
    usage: "opencode-trace list [options]"
    description: "List all traced sessions"
    options: ["--limit", "--filter", "--sort"]
  }
  
  view: {
    usage: "opencode-trace view <session-id>"
    description: "Open session in browser or display info"
    options: ["--browser", "--json", "--summary"]
  }
  
  export: {
    usage: "opencode-trace export <session-id> [format]"
    description: "Export session data"
    formats: ["json", "csv", "html"]
  }
  
  clean: {
    usage: "opencode-trace clean [options]"
    description: "Clean old sessions"
    options: ["--older-than", "--keep", "--dry-run"]
  }
  
  // Configuration
  config: {
    usage: "opencode-trace config <command>"
    subcommands: ["get", "set", "list", "reset"]
  }
}
```

#### Option Specifications
```typescript
interface CLIOptions {
  // Core tracing options
  includeAllRequests: {
    flag: "--include-all-requests"
    type: "boolean"
    default: false
    description: "Log all HTTP requests, not just AI provider calls"
  }
  
  traceDir: {
    flag: "--trace-dir <path>"
    type: "string"
    default: ".opencode-trace"
    description: "Directory for trace output files"
    validation: "Must be writable directory path"
  }
  
  // HTML generation options
  generateHtml: {
    flag: "--generate-html / --no-generate-html"
    type: "boolean"
    default: true
    description: "Automatically generate HTML viewer after session"
  }
  
  openBrowser: {
    flag: "--open"
    type: "boolean"
    default: false
    description: "Open HTML viewer in browser after generation"
  }
  
  // Session options
  sessionName: {
    flag: "--session-name <name>"
    type: "string"
    description: "Human-readable name for the session"
    validation: "Max 100 characters, no special characters"
  }
  
  sessionId: {
    flag: "--session <id>"
    type: "string"
    description: "Custom session ID or resume existing session"
    validation: "Valid UUID format or existing session ID"
  }
  
  tags: {
    flag: "--tag <tag>"
    type: "string[]"
    repeatable: true
    description: "Add tags to session for organization"
  }
  
  // Performance options
  maxBodySize: {
    flag: "--max-body-size <bytes>"
    type: "number"
    default: 1048576  // 1MB
    description: "Maximum request/response body size to capture"
    validation: "Positive integer, max 10MB"
  }
  
  // Debug options
  debug: {
    flag: "--debug"
    type: "boolean"
    default: false
    description: "Enable debug logging"
  }
  
  verbose: {
    flag: "--verbose"
    type: "boolean"
    default: false
    description: "Verbose output"
  }
  
  quiet: {
    flag: "--quiet"
    type: "boolean"
    default: false
    description: "Suppress non-essential output"
  }
}
```

### Configuration System

#### Configuration File Format
```typescript
interface WrapperConfig {
  // Tracing configuration
  tracing: {
    enabled: boolean                   // Default: true
    includeAllRequests: boolean        // Default: false
    maxBodySize: number               // Default: 1MB
    autoGenerateHtml: boolean         // Default: true
    openBrowser: boolean              // Default: false
  }
  
  // Session configuration
  sessions: {
    defaultTraceDir: string           // Default: ".opencode-trace"
    autoCleanup: boolean              // Default: true
    retentionDays: number             // Default: 30
    maxSessions: number               // Default: 100
  }
  
  // Performance configuration
  performance: {
    enableMonitoring: boolean         // Default: true
    maxMemoryUsage: number            // Default: 50MB
    performanceThresholds: {
      cpuOverhead: number             // Default: 5%
      memoryOverhead: number          // Default: 50MB
      responseTime: number            // Default: 2000ms
    }
  }
  
  // Output configuration
  output: {
    htmlTemplate: "default" | "minimal" | "debug"
    includeSourceMaps: boolean        // Default: false
    compressAssets: boolean           // Default: true
    embedAssets: boolean              // Default: true
  }
  
  // Developer options
  debug: {
    enableDebugMode: boolean          // Default: false
    logLevel: "error" | "warn" | "info" | "debug"
    enablePerformanceLogging: boolean // Default: false
  }
}
```

#### Configuration File Locations
```typescript
const configLocations = [
  // Project-specific (highest priority)
  path.join(process.cwd(), '.opencode-trace.json'),
  path.join(process.cwd(), '.opencode-trace', 'config.json'),
  
  // User-specific
  path.join(os.homedir(), '.opencode-trace', 'config.json'),
  path.join(os.homedir(), '.config', 'opencode-trace', 'config.json'),
  
  // Global (lowest priority)
  '/etc/opencode-trace/config.json'
]
```

### Process Coordination

#### IPC Message Protocol
```typescript
interface IPCMessage {
  version: "1.0"
  timestamp: number
  sessionId: string
  processId: string
  messageId: string
  
  type: IPCMessageType
  data: unknown
}

type IPCMessageType = 
  | "session_start"
  | "session_end" 
  | "trace_event"
  | "health_check"
  | "shutdown"
  | "error"
  | "performance_update"

// Event logging message
interface TraceEventMessage extends IPCMessage {
  type: "trace_event"
  data: {
    event: TraceEvent
    source: "typescript-server" | "go-tui"
    metadata?: Record<string, unknown>
  }
}

// Health check message
interface HealthCheckMessage extends IPCMessage {
  type: "health_check"
  data: {
    status: "healthy" | "degraded" | "unhealthy"
    metrics: {
      memoryUsage: number
      cpuUsage: number
      eventCount: number
      lastActivity: number
    }
  }
}
```

#### Process Lifecycle Management
```typescript
interface ProcessLifecycle {
  // Startup sequence
  startup: {
    1: "Initialize wrapper configuration"
    2: "Create session and IPC infrastructure"
    3: "Start TypeScript server with interception"
    4: "Wait for server ready signal"
    5: "Start Go TUI with HTTP client wrapping"
    6: "Establish IPC communication"
    7: "Begin session monitoring"
  }
  
  // Runtime coordination
  runtime: {
    eventCollection: "Aggregate events from all processes"
    healthMonitoring: "Monitor process health and performance"
    errorHandling: "Handle process failures gracefully"
    stateSync: "Synchronize session state across processes"
  }
  
  // Shutdown sequence
  shutdown: {
    1: "Send shutdown signal to all processes"
    2: "Wait for graceful process termination"
    3: "Collect final events and finalize session"
    4: "Generate HTML output if enabled"
    5: "Update session browser index"
    6: "Clean up IPC resources"
    7: "Cleanup temporary files"
  }
}
```

## Runtime Interception

### TypeScript Server Interception

#### Fetch Patching Implementation
```typescript
interface FetchInterceptionConfig {
  sessionId: string
  includeAllRequests: boolean
  maxBodySize: number
  sanitizationPatterns: RegExp[]
}

function patchGlobalFetch(config: FetchInterceptionConfig): void {
  const originalFetch = globalThis.fetch
  
  globalThis.fetch = async function(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const requestId = generateRequestId()
    const startTime = performance.now()
    
    try {
      // Capture request data
      const requestData = await captureRequest(input, init, config)
      
      // Execute original request
      const response = await originalFetch(input, init)
      
      // Capture response data
      const responseData = await captureResponse(response, config)
      
      // Log trace event
      await logHTTPEvent({
        type: 'http_request',
        session_id: config.sessionId,
        request_id: requestId,
        timestamp: Date.now(),
        request: requestData,
        response: responseData,
        timing: {
          duration: performance.now() - startTime
        }
      })
      
      return response
      
    } catch (error) {
      // Log failed request
      await logHTTPEvent({
        type: 'http_request',
        session_id: config.sessionId,
        request_id: requestId,
        timestamp: Date.now(),
        request: await captureRequest(input, init, config),
        error: error.message,
        timing: {
          duration: performance.now() - startTime
        }
      })
      
      throw error
    }
  }
}
```

#### File System Monitoring
```typescript
interface FileSystemMonitorConfig {
  sessionId: string
  monitoredOperations: FileOperation[]
  excludePatterns: RegExp[]
}

type FileOperation = 'read' | 'write' | 'append' | 'delete' | 'rename' | 'mkdir'

function patchFileSystemOperations(config: FileSystemMonitorConfig): void {
  const fs = require('fs')
  const fsPromises = require('fs').promises
  
  // Patch fs.readFile
  const originalReadFile = fs.readFile
  fs.readFile = function(path: string, options: any, callback?: Function) {
    const startTime = performance.now()
    
    const wrappedCallback = (err: Error | null, data: any) => {
      logFileOperation({
        type: 'file_operation',
        session_id: config.sessionId,
        timestamp: Date.now(),
        operation: 'read',
        file_path: path,
        success: !err,
        error: err?.message,
        size: data?.length,
        timing: {
          duration: performance.now() - startTime
        }
      })
      
      if (callback) callback(err, data)
    }
    
    return originalReadFile.call(this, path, options, wrappedCallback)
  }
  
  // Similar patches for other fs operations...
}
```

### Go TUI Integration

#### HTTP Client Wrapping
```go
package main

import (
    "context"
    "net/http"
    "os"
    "time"
    
    trace "github.com/sst/opencode-trace/go-client"
)

type WrappedTUIConfig struct {
    SessionID      string
    TraceDir       string
    MaxBodySize    int64
    DebugMode      bool
    ServerURL      string
}

func initializeTUIWrapper() (*WrappedTUIConfig, error) {
    config := &WrappedTUIConfig{
        SessionID:   os.Getenv("OPENCODE_TRACE_SESSION_ID"),
        TraceDir:    os.Getenv("OPENCODE_TRACE_DIR"),
        MaxBodySize: parseMaxBodySize(),
        DebugMode:   os.Getenv("OPENCODE_TRACE_DEBUG") == "true",
        ServerURL:   os.Getenv("OPENCODE_SERVER_URL"),
    }
    
    if config.SessionID == "" {
        return nil, fmt.Errorf("OPENCODE_TRACE_SESSION_ID not provided")
    }
    
    return config, nil
}

func wrapHTTPClient(config *WrappedTUIConfig) *http.Client {
    // Create tracing HTTP client using Plan v1 component
    tracingClient := trace.NewTracingHTTPClient(config.SessionID, trace.Config{
        OutputDir:               config.TraceDir,
        MaxBodySize:            config.MaxBodySize,
        CaptureRequestBodies:   true,
        CaptureResponseBodies:  true,
        SensitiveHeaders:       getSensitiveHeaders(),
        Timeout:                30 * time.Second,
    })
    
    return tracingClient.HTTPClient()
}

func injectIntoOpenCodeTUI(config *WrappedTUIConfig) error {
    // Replace default HTTP client
    http.DefaultClient = wrapHTTPClient(config)
    
    // Set up tool execution tracing
    if err := setupToolExecutionTracing(config); err != nil {
        return fmt.Errorf("failed to setup tool execution tracing: %w", err)
    }
    
    // Initialize IPC communication with wrapper
    if err := initializeIPC(config); err != nil {
        return fmt.Errorf("failed to initialize IPC: %w", err)
    }
    
    return nil
}
```

## Data Formats & Integration

### Event Schema Extensions

#### Wrapper-Specific Events
```typescript
interface WrapperTraceEvent extends TraceEvent {
  // Standard Plan v1 fields
  type: string
  timestamp: number
  session_id: string
  
  // Wrapper-specific metadata
  wrapper_metadata: {
    version: string                    // opencode-trace version
    process_source: "typescript-server" | "go-tui" | "wrapper"
    correlation_id?: string            // For correlating related events
    process_id: string                // Process identifier
    ipc_message_id?: string           // IPC message correlation
  }
}

// Wrapper session start event
interface WrapperSessionStartEvent extends WrapperTraceEvent {
  type: 'wrapper_session_start'
  data: {
    cli_config: CLIConfig             // CLI configuration used
    opencode_version: string          // opencode version detected
    wrapper_version: string           // opencode-trace version
    process_info: {
      platform: string
      node_version: string
      go_version?: string
    }
  }
}

// Process coordination events
interface ProcessCoordinationEvent extends WrapperTraceEvent {
  type: 'process_coordination'
  data: {
    event: 'process_start' | 'process_ready' | 'process_error' | 'process_exit'
    process_type: 'typescript-server' | 'go-tui'
    process_id: string
    details?: Record<string, unknown>
  }
}
```

### HTML Generation Integration

#### Template Extensions for Wrapper
```typescript
interface WrapperHTMLTemplate extends HTMLTemplate {
  // Wrapper-specific template sections
  sections: {
    // Standard Plan v1 sections
    header: HTMLSection
    timeline: HTMLSection
    details: HTMLSection
    
    // Wrapper-specific sections
    processCoordination: {
      enabled: boolean
      showProcessMetrics: boolean
      showIPCMessages: boolean
      showPerformanceData: boolean
    }
    
    wrapperMetadata: {
      enabled: boolean
      showCLIConfig: boolean
      showProcessInfo: boolean
      showCoordinationEvents: boolean
    }
  }
  
  // Enhanced data processing for wrapper events
  dataProcessors: {
    processCoordination: (events: WrapperTraceEvent[]) => ProcessCoordinationData
    performanceAnalysis: (events: WrapperTraceEvent[]) => PerformanceAnalysisData
    wrapperMetrics: (events: WrapperTraceEvent[]) => WrapperMetricsData
  }
}
```

#### Session Browser Integration
```typescript
interface WrapperSessionMetadata extends SessionMetadata {
  // Standard Plan v1 metadata
  id: string
  name: string
  start_time: number
  end_time?: number
  duration?: number
  
  // Wrapper-specific metadata
  wrapper_info: {
    version: string
    cli_config: Partial<CLIConfig>
    process_coordination: {
      typescript_server: ProcessInfo
      go_tui: ProcessInfo
      coordination_events: number
    }
    performance_metrics: {
      cpu_overhead: number
      memory_overhead: number
      total_events: number
      ipc_messages: number
    }
  }
}

interface ProcessInfo {
  started: boolean
  start_time?: number
  end_time?: number
  exit_code?: number
  error?: string
  health_checks: number
  events_generated: number
}
```

## Performance Specifications

### Performance Targets
```typescript
interface PerformanceTargets {
  // Runtime overhead
  cpuOverhead: {
    target: "< 5%"
    measurement: "Compared to vanilla opencode execution"
    monitoring: "Real-time CPU usage monitoring"
  }
  
  memoryOverhead: {
    target: "< 50MB"
    measurement: "Additional memory usage by wrapper and interception"
    monitoring: "Real-time memory usage monitoring"
  }
  
  // Response time impact
  httpRequestOverhead: {
    target: "< 2ms per request"
    measurement: "Additional latency per HTTP request"
    monitoring: "Request timing analysis"
  }
  
  fileOperationOverhead: {
    target: "< 1ms per operation"
    measurement: "Additional latency per file operation"
    monitoring: "File operation timing"
  }
  
  // HTML generation performance
  htmlGenerationTime: {
    target: "< 2 seconds for 1000 events"
    measurement: "Time to generate HTML from JSONL"
    monitoring: "HTML generation benchmarks"
  }
  
  // Startup time
  wrapperStartup: {
    target: "< 1 second"
    measurement: "Time from CLI invocation to opencode start"
    monitoring: "Startup timing measurement"
  }
}
```

### Performance Monitoring
```typescript
interface PerformanceMonitor {
  // Real-time metrics
  metrics: {
    cpuUsage: number                  // Current CPU percentage
    memoryUsage: number               // Current memory usage in bytes
    eventCount: number                // Total events captured
    httpRequestCount: number          // Total HTTP requests intercepted
    fileOperationCount: number        // Total file operations captured
    ipcMessageCount: number           // Total IPC messages exchanged
  }
  
  // Performance thresholds
  thresholds: {
    maxCpuUsage: number              // Alert if CPU usage exceeds
    maxMemoryUsage: number           // Alert if memory usage exceeds
    maxResponseTime: number          // Alert if response time exceeds
  }
  
  // Monitoring methods
  startMonitoring(): void
  stopMonitoring(): void
  getMetrics(): PerformanceMetrics
  checkThresholds(): ThresholdViolation[]
  generateReport(): PerformanceReport
}
```

## Security & Data Handling

### Data Sanitization
```typescript
interface WrapperSanitizationConfig extends SanitizationConfig {
  // Plan v1 sanitization patterns
  sensitivePatterns: RegExp[]
  
  // Wrapper-specific sanitization
  wrapperSpecific: {
    sanitizeIPCMessages: boolean      // Sanitize IPC message content
    sanitizeProcessInfo: boolean      // Sanitize process-specific data
    sanitizeCLIConfig: boolean        // Sanitize CLI configuration
    redactSystemPaths: boolean        // Redact system file paths
  }
  
  // Enhanced sanitization patterns
  patterns: {
    systemPaths: RegExp[]             // System-specific paths to redact
    processIds: RegExp[]              // Process ID patterns
    temporaryFiles: RegExp[]          // Temporary file patterns
    ipcIdentifiers: RegExp[]          // IPC socket/pipe identifiers
  }
}
```

### Error Handling & Recovery
```typescript
interface ErrorHandlingStrategy {
  // Graceful degradation levels
  degradationLevels: {
    full: "All tracing disabled, opencode continues normally"
    partial: "Core tracing continues, advanced features disabled"
    essential: "Only critical events captured"
  }
  
  // Recovery mechanisms
  recovery: {
    processRestart: "Restart failed processes automatically"
    fallbackModes: "Switch to fallback interception methods"
    sessionRecovery: "Recover partial session data"
    cleanShutdown: "Ensure clean shutdown even on failures"
  }
  
  // Error reporting
  reporting: {
    userNotification: "Clear error messages for users"
    debugLogging: "Detailed error logs for debugging"
    telemetry: "Anonymous error reporting (opt-in)"
  }
}
```

This technical specification provides the detailed implementation guidance needed for each agent while ensuring integration with the robust Plan v1 foundation and maintaining the non-invasive wrapper approach.