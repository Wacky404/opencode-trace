# Data Formats Specification

## JSONL Format

Each line in the `.jsonl` file represents one event in the opencode session.

### File Naming Convention
```
Format: YYYY-MM-DD_HH-mm-ss_session-{session_id}.jsonl
Example: 2025-01-15_14-30-45_session-abc123.jsonl
```

### Event Schema

#### Base Event Interface
```typescript
interface TraceEvent {
  type: string
  timestamp: number
  session_id: string
}
```

#### Session Lifecycle Events

**Session Start**
```typescript
interface SessionStartEvent extends TraceEvent {
  type: 'session_start'
  user_query: string
  opencode_version: string
  working_directory: string
}
```

**Session End**
```typescript
interface SessionEndEvent extends TraceEvent {
  type: 'session_end'
  duration: number
  summary: SessionSummary
}

interface SessionSummary {
  total_requests: number
  ai_requests: number
  file_operations: number
  total_cost: number
  tokens_used: {
    input: number
    output: number
  }
}
```

#### Network Request Events

**TUI Request (Go → TypeScript Server)**
```typescript
interface TUIRequestEvent extends TraceEvent {
  type: 'tui_request'
  request_id: string
  method: string
  url: string
  headers: Record<string, string>
  body?: any
  response: {
    status: number
    headers: Record<string, string>
    body: any
  }
  timing: RequestTiming
}
```

**AI Request (Server → AI Provider)**
```typescript
interface AIRequestEvent extends TraceEvent {
  type: 'ai_request'
  request_id: string
  provider: 'anthropic' | 'openai' | 'google'
  model: string
  url: string
  headers: Record<string, string>
  body: any
  response: any
  timing: RequestTiming
  cost?: CostBreakdown
}

interface CostBreakdown {
  input_cost: number
  output_cost: number
  total_cost: number
}
```

#### WebSocket Events
```typescript
interface WebSocketMessageEvent extends TraceEvent {
  type: 'websocket_message'
  direction: 'inbound' | 'outbound'
  data: any
  size: number
}
```

#### Tool Execution Events
```typescript
interface ToolExecutionEvent extends TraceEvent {
  type: 'tool_execution'
  tool_name: string
  parameters: Record<string, any>
  result: any
  timing: RequestTiming
  success: boolean
  error?: string
}
```

#### File Operation Events
```typescript
interface FileOperationEvent extends TraceEvent {
  type: 'file_operation'
  operation: 'read' | 'write' | 'delete' | 'create'
  path: string
  size?: number
  success: boolean
  error?: string
}
```

#### Common Types
```typescript
interface RequestTiming {
  start: number
  end: number
  duration: number
}
```

### Example JSONL File

```jsonl
{"type":"session_start","timestamp":1705320645000,"session_id":"abc123","user_query":"Add a login form to my React app","opencode_version":"0.1.140","working_directory":"/Users/cole/my-app"}
{"type":"tui_request","timestamp":1705320645100,"session_id":"abc123","request_id":"req_001","method":"POST","url":"http://localhost:3000/api/tools/read","headers":{"content-type":"application/json"},"body":{"path":"package.json"},"response":{"status":200,"headers":{"content-type":"application/json"},"body":{"content":"{\n  \"name\": \"my-app\"\n}"}},"timing":{"start":1705320645100,"end":1705320645150,"duration":50}}
{"type":"ai_request","timestamp":1705320645200,"session_id":"abc123","request_id":"req_002","provider":"anthropic","model":"claude-3-5-sonnet-20241022","url":"https://api.anthropic.com/v1/messages","headers":{"authorization":"Bearer sk-***","content-type":"application/json"},"body":{"model":"claude-3-5-sonnet-20241022","max_tokens":4096,"messages":[{"role":"user","content":"Add a login form"}]},"response":{"status":200,"body":{"content":[{"type":"text","text":"I'll help you add a login form..."}],"usage":{"input_tokens":45,"output_tokens":312}}},"timing":{"start":1705320645200,"end":1705320646800,"duration":1600},"cost":{"input_cost":0.000135,"output_cost":0.00468,"total_cost":0.004815}}
{"type":"websocket_message","timestamp":1705320645300,"session_id":"abc123","direction":"outbound","data":{"type":"tool_call","tool":"edit","parameters":{"filePath":"/src/LoginForm.tsx"}},"size":245}
{"type":"tool_execution","timestamp":1705320645400,"session_id":"abc123","tool_name":"edit","parameters":{"filePath":"/src/LoginForm.tsx","content":"..."},"result":{"success":true},"timing":{"start":1705320645400,"end":1705320645450,"duration":50},"success":true}
{"type":"file_operation","timestamp":1705320645450,"session_id":"abc123","operation":"write","path":"/src/LoginForm.tsx","size":245,"success":true}
{"type":"session_end","timestamp":1705320650000,"session_id":"abc123","duration":4900,"summary":{"total_requests":15,"ai_requests":3,"file_operations":4,"total_cost":0.0234,"tokens_used":{"input":234,"output":1456}}}
```

## HTML Output Format

### Self-Contained HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>opencode-trace: Session abc123</title>
    <style>
        /* Embedded VS Code theme CSS */
        /* All trace-viewer styles */
    </style>
</head>
<body>
    <div id="trace-app"></div>
    
    <script>
        // Embedded trace data from JSONL
        window.TRACE_DATA = [
            {"type":"session_start","timestamp":1705320645000,...},
            {"type":"tui_request","timestamp":1705320645100,...},
            // ... all JSONL events
        ];
        
        // Embedded trace viewer JavaScript
        // (Lit components compiled to vanilla JS)
    </script>
</body>
</html>
```

### Session Browser (index.html)

```html
<!DOCTYPE html>
<html>
<head>
    <title>opencode-trace Sessions</title>
    <style>/* VS Code theme styles */</style>
</head>
<body>
    <div class="session-browser">
        <h1>opencode-trace Sessions</h1>
        <div class="session-list">
            <div class="session-card" data-session="abc123">
                <h3>2025-01-15 14:30:45</h3>
                <p>Add a login form to my React app</p>
                <div class="session-stats">
                    <span>15 requests</span>
                    <span>3 AI calls</span>
                    <span>$0.023</span>
                    <span>4.9s</span>
                </div>
                <a href="sessions/2025-01-15_14-30-45_session-abc123.html">View</a>
            </div>
        </div>
    </div>
</body>
</html>
```

## Folder Structure

```
.opencode-trace/
├── config.json                                      # Configuration
├── index.html                                       # Session browser
├── assets/                                          # Shared resources
│   ├── trace-viewer.css
│   ├── trace-viewer.js
│   └── vs-code-theme.css
└── sessions/                                        # Session files
    ├── 2025-01-15_14-30-45_session-abc123.jsonl    # Raw data
    ├── 2025-01-15_14-30-45_session-abc123.html     # Viewer
    ├── 2025-01-15_15-22-10_session-def456.jsonl
    └── 2025-01-15_15-22-10_session-def456.html
```

## Configuration Format

```json
{
  "version": "1.0.0",
  "capture": {
    "enabled": true,
    "capture_request_bodies": true,
    "capture_response_bodies": true,
    "max_body_size": 1048576,
    "sensitive_headers": ["authorization", "cookie", "x-api-key"],
    "redact_patterns": ["sk-[a-zA-Z0-9]+", "Bearer [a-zA-Z0-9]+"]
  },
  "storage": {
    "max_sessions": 100,
    "auto_cleanup_days": 30,
    "compress_old_sessions": true
  },
  "html_generation": {
    "auto_generate": true,
    "include_raw_data": true,
    "theme": "vs-code-dark"
  }
}
```