# opencode-trace Architecture

## Overview

opencode-trace is a network request tracing tool specifically designed for [opencode](https://opencode.ai). It captures all network traffic during coding sessions and generates beautiful HTML viewers for debugging and analysis.

## System Architecture

```
┌─────────────────┐    HTTP/WebSocket    ┌──────────────────┐    HTTP    ┌─────────────────┐
│   Go TUI        │ ◄─────────────────► │ TypeScript       │ ◄────────► │ AI Providers    │
│   (Frontend)    │                     │ Server           │            │ (Anthropic/     │
│                 │                     │ (Backend)        │            │  OpenAI/etc)    │
└─────────────────┘                     └──────────────────┘            └─────────────────┘
        │                                        │
        ▼                                        ▼
┌─────────────────┐                     ┌──────────────────┐
│ opencode-trace  │                     │ Tool Execution   │
│ Network Capture │                     │ (bash, edit,     │
│                 │                     │  read, write)    │
└─────────────────┘                     └──────────────────┘
        │
        ▼
┌─────────────────┐
│ .opencode-trace │
│ ├── sessions/   │
│ │   ├── *.jsonl │
│ │   └── *.html  │
│ └── index.html  │
└─────────────────┘
```

## Core Components

### 1. Network Interceptors

#### Go TUI Interceptor

- **Purpose**: Capture HTTP requests from Go TUI to TypeScript server
- **Implementation**: Wrap `http.Client` in Go
- **Activation**: Environment variable `OPENCODE_TRACE=true`

#### TypeScript Server Interceptor

- **Purpose**: Capture HTTP requests from server to AI providers
- **Implementation**: Wrap `fetch`/`axios` calls
- **Features**: AI provider detection, cost calculation, token tracking

#### WebSocket Interceptor

- **Purpose**: Capture real-time communication
- **Implementation**: Wrap WebSocket class
- **Data**: Bidirectional message capture with timing

### 2. Data Processing Pipeline

```
Raw Network Events → JSONL Logger → Session Processor → HTML Generator
```

#### JSONL Logger

- **Format**: One event per line in JSON format
- **Schema**: Strongly typed event interfaces
- **Storage**: `.opencode-trace/sessions/` directory

#### Session Processor

- **Purpose**: Convert raw events into structured session data
- **Features**: Event correlation, performance metrics, cost calculation
- **Output**: Processed data for UI components

#### HTML Generator

- **Purpose**: Create self-contained HTML files
- **Technology**: Lit components + Tailwind CSS + VS Code theme
- **Features**: Embedded data, offline viewing, beautiful UI

### 3. User Interface

#### Session Viewer

- **Technology**: Lit Web Components
- **Theme**: VS Code dark theme colors
- **Features**:
  - Timeline view of all events
  - Collapsible request/response details
  - Tool execution visualization
  - Performance metrics dashboard

#### Session Browser

- **Purpose**: Navigate between multiple sessions
- **Features**: Search, filtering, session comparison
- **Location**: `.opencode-trace/index.html`

## Data Flow

### 1. Session Lifecycle

```
User runs: OPENCODE_TRACE=true opencode "create a React app"
    ↓
Session Start Event → JSONL
    ↓
Network Requests → Interceptors → JSONL Events
    ↓
Tool Executions → Tracer → JSONL Events
    ↓
Session End Event → JSONL
    ↓
HTML Generation → Beautiful Viewer
```

### 2. Event Types

- **session_start**: Session initialization
- **session_end**: Session completion with summary
- **tui_request**: Go TUI → TypeScript server
- **ai_request**: Server → AI provider
- **websocket_message**: Real-time communication
- **tool_execution**: bash, edit, read, write operations
- **file_operation**: File system changes

### 3. Integration Points

#### Environment Variable Activation

```bash
OPENCODE_TRACE=true opencode "your query"
```

#### CLI Flag (Future)

```bash
opencode --trace "your query"
```

#### Configuration File

```json
{
  "tracing": {
    "enabled": true,
    "output_dir": ".opencode-trace",
    "auto_generate_html": true
  }
}
```

## Performance Considerations

### Minimal Impact

- **Target**: <5% performance overhead
- **Memory**: <50MB additional usage
- **Async Processing**: Non-blocking event logging

### Optimization Strategies

- Object pooling for frequent allocations
- Streaming for large payloads
- Smart sampling for high-volume scenarios
- Background HTML generation

## Security & Privacy

### Data Sanitization

- Redact API keys and sensitive headers
- Configurable sensitive data patterns
- Optional request/response body capture

### Local Storage

- All data stored locally in `.opencode-trace/`
- No external data transmission
- User controls data retention

## Extensibility

### Plugin Architecture

- Custom event types
- Additional AI providers
- Custom UI components
- Export formats

### API Design

- Clean TypeScript interfaces
- Modular component architecture
- Well-defined extension points
