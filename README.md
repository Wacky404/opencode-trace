# opencode-trace

Network request tracing for [opencode](https://opencode.ai) - beautiful HTML viewer for debugging AI coding sessions.

## What is opencode-trace?

opencode-trace captures all network requests made during opencode sessions and generates beautiful HTML viewers to help you understand:

- 🔍 **Request/Response Flow**: See all HTTP requests between TUI ↔ Server ↔ AI Providers
- 💰 **Cost Tracking**: Monitor AI API costs and token usage across providers
- ⚡ **Performance Metrics**: Analyze request timing and identify bottlenecks  
- 🛠️ **Tool Execution**: Visualize bash commands, file operations, and tool results
- 🎨 **Beautiful UI**: VS Code themed interface inspired by claude-trace

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/opencode-trace/opencode-trace.git
cd opencode-trace

# Install dependencies
npm install

# Build the project
npm run build
```

### Usage

Enable tracing for any opencode session:

```bash
# Enable tracing with environment variable
OPENCODE_TRACE=true opencode "Add a login form to my React app"

# Or use CLI flag (coming soon)
opencode --trace "Debug this Python script"
```

After the session completes, check the `.opencode-trace/` folder:

```
.opencode-trace/
├── sessions/
│   ├── 2025-01-15_14-30-45_session-abc123.jsonl    # Raw data
│   └── 2025-01-15_14-30-45_session-abc123.html     # Beautiful viewer
└── index.html                                       # Session browser
```

Open the HTML file in your browser to explore the trace!

## Features

### 📊 Session Overview
- Timeline of all requests and tool executions
- Cost breakdown by AI provider
- Performance metrics and timing analysis
- File operations and changes

### 🔍 Request Details
- Full HTTP request/response data
- AI provider detection (Anthropic, OpenAI, Google)
- Token usage and cost calculations
- WebSocket message capture

### 🛠️ Tool Visualization
- Bash command execution with output
- File read/write/edit operations with diffs
- Tool parameter and result inspection
- Error handling and debugging info

### 🎨 Beautiful Interface
- VS Code dark theme
- Collapsible sections for easy navigation
- Syntax highlighting for code
- Responsive design

## Architecture

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
│ captures all    │                     │ (bash, edit,     │
│ network traffic │                     │  read, write)    │
└─────────────────┘                     └──────────────────┘
```

## Development

### Project Structure

```
opencode-trace/
├── packages/
│   ├── tracer/          # Core tracing library (TypeScript)
│   └── viewer/          # HTML viewer components (Lit + Tailwind)
├── go-client/           # Go HTTP client wrapper
├── examples/            # Example usage and demos
└── tests/              # Integration tests
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build:tracer
npm run build:viewer
npm run build:go

# Development mode with watching
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run specific package tests
npm run test:tracer
npm run test:viewer
npm run test:go
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by [claude-trace](https://github.com/badlogic/lemmy/tree/main/apps/claude-trace) by badlogic
- Built for the amazing [opencode](https://opencode.ai) project by SST
- UI design inspired by VS Code's beautiful dark theme
