# CLI Wrapper Architecture

## Overview

The `opencode-trace` CLI wrapper provides comprehensive tracing for opencode sessions through runtime interception, similar to claude-trace. This architecture enables transparent logging without modifying the opencode core.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           opencode-trace CLI Wrapper                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ Argument Parser │    │ Session Manager │    │ Process Coordinator         │ │
│  │ • CLI flags     │    │ • Session ID    │    │ • Spawn management          │ │
│  │ • Config        │    │ • Lifecycle     │    │ • IPC setup                 │ │
│  │ • Validation    │    │ • Metadata      │    │ • Error handling            │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Runtime Injection                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────────┐ │
│  │     TypeScript Server           │    │         Go TUI Client               │ │
│  │                                 │    │                                     │ │
│  │  ┌─────────────────────────────┐│    │  ┌─────────────────────────────────┐│ │
│  │  │ Fetch Interception          ││    │  │ HTTP Client Wrapping            ││ │
│  │  │ • Patch globalThis.fetch()  ││    │  │ • Wrap http.Client              ││ │
│  │  │ • AI Provider requests      ││    │  │ • TUI ↔ Server requests         ││ │
│  │  │ • Log to opencode-trace     ││    │  │ • Log to opencode-trace         ││ │
│  │  └─────────────────────────────┘│    │  └─────────────────────────────────┘│ │
│  │                                 │    │                                     │ │
│  │  ┌─────────────────────────────┐│    │  ┌─────────────────────────────────┐│ │
│  │  │ File System Monitoring      ││    │  │ Tool Execution Wrapping         ││ │
│  │  │ • fs operations             ││    │  │ • Bash commands                 ││ │
│  │  │ • File reads/writes         ││    │  │ • Editor launches               ││ │
│  │  │ • Directory changes         ││    │  │ • Process monitoring            ││ │
│  │  └─────────────────────────────┘│    │  └─────────────────────────────────┘│ │
│  └─────────────────────────────────┘    └─────────────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Trace Data Processing                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ Event Logger    │    │ Data Processor  │    │ HTML Generator              │ │
│  │ • JSONL format  │    │ • Correlation   │    │ • Auto-generation           │ │
│  │ • Session data  │    │ • Metrics       │    │ • Template system           │ │
│  │ • Performance   │    │ • Analysis      │    │ • Asset embedding           │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Output Files                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  .opencode-trace/                                                               │
│  ├── sessions/                                                                  │
│  │   ├── 2025-01-15_14-30-45_session-abc123.jsonl                             │
│  │   └── 2025-01-15_14-30-45_session-abc123.html                              │
│  └── index.html                                                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. CLI Wrapper (`packages/cli/`)

#### Main Entry Point
```typescript
// packages/cli/src/index.ts
export async function main(args: string[]) {
  const config = parseArguments(args)
  const session = await startSession(config)
  
  try {
    await spawnOpenCodeWithTracing(config, session)
  } finally {
    await finalizeSession(session)
  }
}
```

#### Argument Parser
```typescript
interface CLIConfig {
  // Core options
  prompt?: string                    // Direct prompt for opencode
  includeAllRequests: boolean       // Log all HTTP requests (not just AI)
  traceDir: string                  // Output directory
  
  // opencode forwarding
  opencodeArgs: string[]            // Arguments to pass to opencode
  nonInteractive: boolean           // Use opencode run mode
  
  // Tracing options
  autoGenerateHTML: boolean         // Generate HTML after session
  openBrowser: boolean              // Open HTML in browser
  maxBodySize: number               // Max request/response body size
  
  // Session options
  sessionId?: string                // Custom session ID
  sessionName?: string              // Human-readable session name
  tags: string[]                    // Session tags for organization
}
```

#### Process Coordinator
```typescript
class ProcessCoordinator {
  private typescriptServerProcess?: ChildProcess
  private goTUIProcess?: ChildProcess
  private sessionId: string
  
  async spawnOpenCode(config: CLIConfig): Promise<void> {
    // 1. Start TypeScript server with interception
    this.typescriptServerProcess = spawn('bun', [
      '--require', './interceptor-loader.js',
      'packages/opencode/src/index.ts'
    ], {
      env: {
        ...process.env,
        OPENCODE_TRACE_SESSION_ID: this.sessionId,
        OPENCODE_TRACE_INCLUDE_ALL: config.includeAllRequests.toString()
      }
    })
    
    // 2. Wait for server to be ready
    await this.waitForServer()
    
    // 3. Start Go TUI with HTTP client wrapping
    this.goTUIProcess = spawn('./opencode-tui', config.opencodeArgs, {
      env: {
        ...process.env,
        OPENCODE_TRACE: 'true',
        OPENCODE_TRACE_SESSION_ID: this.sessionId,
        OPENCODE_SERVER_URL: this.getServerURL()
      }
    })
    
    // 4. Monitor both processes
    await this.monitorProcesses()
  }
}
```

### 2. Runtime Interception

#### TypeScript Server Interception
```typescript
// packages/cli/src/interceptors/server-interceptor.ts
export function initializeServerInterception(sessionId: string) {
  // Patch global fetch for AI provider requests
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const startTime = performance.now()
    
    try {
      const response = await originalFetch(input, init)
      
      // Log successful requests
      await logHTTPEvent({
        type: 'http_request',
        session_id: sessionId,
        timestamp: Date.now(),
        request: {
          url: input.toString(),
          method: init?.method || 'GET',
          headers: sanitizeHeaders(init?.headers),
          body: await cloneAndSanitizeBody(init?.body)
        },
        response: {
          status: response.status,
          headers: sanitizeHeaders(response.headers),
          body: await cloneAndSanitizeBody(response.body)
        },
        timing: {
          duration: performance.now() - startTime
        }
      })
      
      return response
    } catch (error) {
      // Log failed requests
      await logHTTPEvent({
        type: 'http_request',
        session_id: sessionId,
        timestamp: Date.now(),
        request: { /* ... */ },
        error: error.message,
        timing: {
          duration: performance.now() - startTime
        }
      })
      
      throw error
    }
  }
  
  // Patch file system operations
  patchFileSystemOperations(sessionId)
  
  // Patch tool execution
  patchToolExecution(sessionId)
}
```

#### Go TUI Client Wrapping
```go
// packages/cli/src/wrappers/go-client-wrapper.go
package main

import (
  "context"
  "net/http"
  "os"
  
  "github.com/sst/opencode/packages/tracer/go-client"
)

func main() {
  if os.Getenv("OPENCODE_TRACE") == "true" {
    sessionID := os.Getenv("OPENCODE_TRACE_SESSION_ID")
    
    // Create tracing HTTP client
    tracingClient := trace.NewTracingHTTPClient(sessionID, trace.Config{
      OutputDir: os.Getenv("OPENCODE_TRACE_DIR"),
      MaxBodySize: parseMaxBodySize(),
      CaptureRequestBodies: true,
      CaptureResponseBodies: true,
    })
    
    // Replace default HTTP client
    http.DefaultClient = tracingClient.HTTPClient()
    
    // Wrap any opencode-specific HTTP clients
    wrapOpenCodeClients(tracingClient)
  }
  
  // Start normal opencode TUI
  startOpenCodeTUI()
}
```

### 3. Session Management

#### Session Lifecycle
```typescript
class SessionManager {
  async startSession(config: CLIConfig): Promise<Session> {
    const session: Session = {
      id: config.sessionId || generateSessionId(),
      name: config.sessionName || config.prompt?.substring(0, 50),
      start_time: Date.now(),
      config: config,
      metadata: {
        opencode_version: await getOpenCodeVersion(),
        working_directory: process.cwd(),
        user_agent: getUserAgent(),
        platform: process.platform,
        node_version: process.version
      },
      tags: config.tags,
      status: 'active'
    }
    
    // Create session directory
    await this.fileManager.ensureSessionDirectory(session.id)
    
    // Log session start event
    await this.logger.logEvent({
      type: 'session_start',
      session_id: session.id,
      timestamp: session.start_time,
      query: config.prompt,
      metadata: session.metadata
    })
    
    return session
  }
  
  async finalizeSession(session: Session): Promise<void> {
    const endTime = Date.now()
    const duration = endTime - session.start_time
    
    // Calculate session metrics
    const metrics = await this.calculateSessionMetrics(session.id)
    
    // Log session end event
    await this.logger.logEvent({
      type: 'session_end',
      session_id: session.id,
      timestamp: endTime,
      duration: duration,
      metrics: metrics,
      success: session.status === 'completed'
    })
    
    // Generate HTML if enabled
    if (session.config.autoGenerateHTML) {
      await this.generateSessionHTML(session)
    }
    
    // Update session browser index
    await this.updateSessionIndex(session)
  }
}
```

### 4. Inter-Process Communication

#### Event Coordination
```typescript
interface IPCMessage {
  type: 'trace_event' | 'session_update' | 'error' | 'shutdown'
  sessionId: string
  timestamp: number
  data: any
}

class IPCCoordinator {
  private socketPath: string
  private server: net.Server
  
  async setupIPC(sessionId: string): Promise<void> {
    this.socketPath = `/tmp/opencode-trace-${sessionId}.sock`
    
    this.server = net.createServer((socket) => {
      socket.on('data', (data) => {
        const message: IPCMessage = JSON.parse(data.toString())
        this.handleMessage(message)
      })
    })
    
    await this.server.listen(this.socketPath)
  }
  
  private async handleMessage(message: IPCMessage): Promise<void> {
    switch (message.type) {
      case 'trace_event':
        await this.logger.logEvent(message.data)
        break
      case 'session_update':
        await this.updateSessionStatus(message.data)
        break
      case 'error':
        await this.handleError(message.data)
        break
    }
  }
}
```

## Error Handling & Recovery

### Graceful Degradation
```typescript
class ErrorHandler {
  async handleTracingError(error: Error, context: string): Promise<void> {
    // Log error to separate trace error log
    console.warn(`[opencode-trace] ${context}:`, error.message)
    
    // Continue normal opencode operation
    // Never let tracing errors break opencode functionality
  }
  
  async recoverFromProcessFailure(processType: 'server' | 'tui'): Promise<void> {
    switch (processType) {
      case 'server':
        // Restart TypeScript server with basic interception
        await this.restartServerWithFallback()
        break
      case 'tui':
        // Continue with limited tracing (server-side only)
        await this.enableServerOnlyTracing()
        break
    }
  }
}
```

### Performance Monitoring
```typescript
class PerformanceMonitor {
  private baselineMetrics: ProcessMetrics
  
  async measurePerformanceImpact(): Promise<PerformanceReport> {
    const tracingMetrics = await this.getCurrentMetrics()
    
    return {
      memoryOverhead: tracingMetrics.memory - this.baselineMetrics.memory,
      cpuOverhead: tracingMetrics.cpu - this.baselineMetrics.cpu,
      responseTimeImpact: this.calculateResponseTimeImpact(),
      overheadPercentage: this.calculateOverheadPercentage()
    }
  }
}
```

## Integration with Plan v1 Components

### Reused Components
- **JSONLLogger** (`packages/tracer/src/logger.ts`) - Direct reuse
- **EventValidator** (`packages/tracer/src/validation.ts`) - Direct reuse  
- **HTMLGenerator** (`packages/viewer/src/generators/`) - Direct reuse
- **Go HTTP Client** (`go-client/`) - Modified for wrapper integration
- **Data Processors** (`packages/viewer/src/processors/`) - Direct reuse

### Adapted Components
- **Session Manager** - Extended for CLI wrapper lifecycle
- **Configuration** - New CLI-specific options
- **Error Handling** - Wrapper-specific error scenarios

This architecture provides comprehensive tracing while maintaining the non-invasive wrapper approach that makes deployment and maintenance much simpler than the original integration plan.