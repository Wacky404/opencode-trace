# Integration Points with opencode

## Overview

opencode-trace integrates with opencode at multiple levels to capture comprehensive network and execution data.

## opencode Architecture

```
┌─────────────────┐    HTTP/WebSocket    ┌──────────────────┐    HTTP    ┌─────────────────┐
│   Go TUI        │ ◄─────────────────► │ TypeScript       │ ◄────────► │ AI Providers    │
│   (Frontend)    │                     │ Server           │            │ (Anthropic/     │
│                 │                     │ (Backend)        │            │  OpenAI/etc)    │
└─────────────────┘                     └──────────────────┘            └─────────────────┘
        │                                        │
        ▼                                        ▼
┌─────────────────┐                     ┌──────────────────┐
│ File System     │                     │ Tool Execution   │
│ Operations      │                     │ (bash, edit,     │
│                 │                     │  read, write)    │
└─────────────────┘                     └──────────────────┘
```

## Integration Strategies

### 1. Environment Variable Activation

**Primary Method**: Enable tracing via environment variable

```bash
OPENCODE_TRACE=true opencode "Add a login form to my React app"
```

**Implementation**:

- Go TUI checks `OPENCODE_TRACE` environment variable on startup
- If enabled, wraps HTTP client with tracing functionality
- TypeScript server detects tracing mode and enables interceptors

### 2. CLI Flag Integration (Future)

**Enhanced Method**: Direct CLI flag support

```bash
opencode --trace "Debug this Python script"
opencode --trace --trace-dir=/custom/path "Fix the bug"
```

**Implementation**:

- Add `--trace` flag to opencode CLI parser
- Pass tracing configuration to both TUI and server
- Support custom output directory

### 3. Configuration File Integration

**Persistent Method**: Configuration-based activation

```json
// ~/.opencode/config.json
{
  "tracing": {
    "enabled": true,
    "output_dir": ".opencode-trace",
    "auto_generate_html": true,
    "capture_request_bodies": true,
    "capture_response_bodies": true
  }
}
```

## Capture Points

### 1. Go TUI → TypeScript Server

**Location**: Go HTTP client in TUI
**What to Capture**:

- Tool execution requests (read, write, edit, bash)
- Configuration requests
- Status updates
- Error responses

**Implementation**:

```go
// In opencode TUI
import "github.com/opencode-trace/go-client"

func main() {
    if os.Getenv("OPENCODE_TRACE") == "true" {
        client := trace.NewTracingHTTPClient(sessionID)
        // Use traced client for all server requests
    }
}
```

### 2. TypeScript Server → AI Providers

**Location**: HTTP client in TypeScript server
**What to Capture**:

- AI model requests (Claude, GPT, Gemini)
- Streaming responses
- Token usage and costs
- Error responses

**Implementation**:

```typescript
// In opencode server
import { TracingFetch } from "@opencode-trace/tracer";

if (process.env.OPENCODE_TRACE === "true") {
  const tracer = new TracingFetch(sessionID);
  // Replace fetch calls with traced version
}
```

### 3. WebSocket Communication

**Location**: WebSocket connections between TUI and server
**What to Capture**:

- Real-time tool execution updates
- Progress notifications
- Error messages
- Status changes

**Implementation**:

```typescript
// Wrap WebSocket in both TUI and server
const ws = new TracingWebSocket(url, sessionID);
```

### 4. Tool Execution

**Location**: Tool execution layer in TypeScript server
**What to Capture**:

- Bash command execution
- File read/write operations
- Tool parameters and results
- Execution timing

**Implementation**:

```typescript
// Wrap tool execution
const toolTracer = new ToolTracer(sessionID);
const result = await toolTracer.traceExecution("bash", params, executor);
```

## Session Lifecycle Integration

### 1. Session Start

**Trigger**: User runs opencode command with tracing enabled
**Actions**:

- Generate unique session ID
- Create `.opencode-trace/sessions/` directory if needed
- Log session start event with user query
- Initialize JSONL file

```typescript
// Session start integration
const sessionManager = new SessionManager();
const sessionId = sessionManager.startSession(userQuery, {
  opencode_version: getVersion(),
  working_directory: process.cwd(),
  timestamp: Date.now(),
});
```

### 2. Session End

**Trigger**: opencode command completes (success or failure)
**Actions**:

- Log session end event with summary
- Calculate total costs and metrics
- Generate HTML file from JSONL data
- Update session browser index

```typescript
// Session end integration
sessionManager.endSession({
  duration: Date.now() - sessionStart,
  summary: calculateSessionSummary(),
  success: exitCode === 0,
});

// Auto-generate HTML
if (config.auto_generate_html) {
  await generateHTMLFile(sessionId);
}
```

## File System Integration

### 1. Output Directory Management

**Default Location**: `.opencode-trace/` in current working directory
**Structure**:

```
.opencode-trace/
├── config.json
├── index.html
├── assets/
└── sessions/
    ├── 2025-01-15_14-30-45_session-abc123.jsonl
    └── 2025-01-15_14-30-45_session-abc123.html
```

### 2. File Operation Tracking

**Integration Point**: File system operations in opencode
**Captured Operations**:

- File reads (package.json, source files, etc.)
- File writes (new files, edits)
- Directory creation
- File deletion

```typescript
// Wrap fs operations
const fs = require("fs");
const originalReadFile = fs.readFile;

fs.readFile = function (path, options, callback) {
  const startTime = Date.now();
  return originalReadFile.call(this, path, options, (err, data) => {
    logFileOperation("read", path, startTime, !err, err?.message, data?.length);
    callback(err, data);
  });
};
```

## Performance Considerations

### 1. Minimal Impact Requirements

**Target Performance Impact**: <5% overhead
**Memory Usage**: <50MB additional
**Disk Usage**: Configurable with cleanup policies

### 2. Optimization Strategies

**Async Processing**: Non-blocking event logging

```typescript
// Don't block main execution
logger.logEventAsync(event);
```

**Smart Sampling**: Reduce data volume for high-frequency events

```typescript
if (shouldSample(eventType, currentLoad)) {
  logger.logEvent(event);
}
```

**Background HTML Generation**: Generate HTML files after session completion

```typescript
// Generate HTML in background process
process.nextTick(() => generateHTMLFile(sessionId));
```

## Error Handling

### 1. Graceful Degradation

**Principle**: Tracing failures should never break opencode functionality
**Implementation**:

- Wrap all tracing code in try-catch blocks
- Log tracing errors separately
- Continue normal operation if tracing fails

```typescript
try {
  logger.logEvent(event);
} catch (error) {
  console.warn("Tracing error:", error.message);
  // Continue normal operation
}
```

### 2. Recovery Mechanisms

**Corrupted Files**: Detect and recover from corrupted JSONL files
**Disk Space**: Handle disk full scenarios gracefully
**Permissions**: Handle permission errors for trace directory

## Configuration Integration

### 1. opencode Configuration

**Integration**: Extend opencode's existing configuration system

```json
{
  "tracing": {
    "enabled": false,
    "output_dir": ".opencode-trace",
    "auto_generate_html": true,
    "max_sessions": 100,
    "auto_cleanup_days": 30
  }
}
```

### 2. Runtime Configuration

**Environment Variables**:

- `OPENCODE_TRACE=true` - Enable tracing
- `OPENCODE_TRACE_DIR=/path` - Custom output directory
- `OPENCODE_TRACE_CONFIG=/path/config.json` - Custom config file

## Security Considerations

### 1. Data Sanitization

**Sensitive Data**: Automatically redact sensitive information

- API keys in headers
- Authentication tokens
- Personal information in file paths

```typescript
const sensitivePatterns = [
  /sk-[a-zA-Z0-9]+/g, // OpenAI API keys
  /Bearer [a-zA-Z0-9]+/g, // Bearer tokens
  /\/Users\/[^\/]+/g, // User home directories
];
```

### 2. Local Storage Only

**Principle**: All trace data stays local

- No external data transmission
- User controls data retention
- Clear data ownership

## Testing Integration

### 1. Integration Tests

**Test Scenarios**:

- Full opencode session with tracing enabled
- Error scenarios with tracing
- Performance impact measurement
- Cross-platform compatibility

### 2. Validation

**Automated Checks**:

- JSONL file format validation
- HTML file generation verification
- Performance benchmark comparison
- Memory usage monitoring
