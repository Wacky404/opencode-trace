# Agent Guidelines for opencode-trace

## Project Overview

opencode-trace is a network request tracing tool for [opencode](https://opencode.ai) that captures all network traffic during coding sessions and generates beautiful HTML viewers for debugging and analysis.

**Current Status**: 🎉 PRODUCTION READY! CLI wrapper with HTTP proxy interception fully implemented and tested. Successfully captures AI API calls from opencode Go binary via network-level interception. Complete end-to-end tracing pipeline operational.

## Build & Test Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build specific packages
npm run build:tracer    # TypeScript tracer library
npm run build:viewer    # HTML viewer components
npm run build:cli       # CLI wrapper with proxy (MAIN ENTRYPOINT)
npm run build:go        # Go HTTP client wrapper

# Development with watching
npm run dev
npm run dev:tracer

# Testing
npm test                # All tests
npm run test:tracer     # Tracer package tests
npm run test:viewer     # Viewer package tests
npm run test:go         # Go tests
npm run test:integration # Integration tests

# Linting
npm run lint
npm run lint:ts         # TypeScript linting
npm run lint:go         # Go linting

# Clean build artifacts
npm run clean
```

## Project Structure

```
opencode-trace/
├── packages/
│   ├── cli/             # 🎉 CLI wrapper with HTTP proxy (PRODUCTION READY)
│   │   ├── src/
│   │   │   ├── proxy/           # ✅ HTTP proxy server for traffic interception
│   │   │   ├── process/         # ✅ Process spawning and coordination
│   │   │   ├── session/         # ✅ Session management and event logging
│   │   │   ├── interceptors/    # ✅ Runtime interception modules
│   │   │   └── types/           # ✅ CLI type definitions
│   │   └── dist/                # ✅ Built CLI ready for deployment
│   ├── tracer/          # ✅ Core tracing library (TypeScript) - COMPLETED
│   │   ├── src/
│   │   │   ├── index.ts          # ✅ Main exports
│   │   │   ├── logger.ts         # ✅ JSONL Logger (Task 1.2 COMPLETED)
│   │   │   ├── session.ts        # ✅ Session management (Task 1.2 COMPLETED)
│   │   │   ├── types.ts          # ✅ Type definitions
│   │   │   ├── filesystem.ts     # ✅ File system utilities (Task 1.2 COMPLETED)
│   │   │   ├── config.ts         # ✅ Configuration management (Task 1.2 COMPLETED)
│   │   │   ├── validation.ts     # ✅ Event validation (Task 1.2 COMPLETED)
│   │   │   └── serialization.ts  # ✅ JSONL serialization (Task 1.2 COMPLETED)
│   │   └── package.json
│   └── viewer/          # ✅ HTML viewer components (Phase 3 - COMPLETED)
│       ├── src/
│       │   ├── components/       # ✅ 5 UI components with Lit 3.0
│       │   ├── processors/       # ✅ 3 data processing engines
│       │   ├── types/           # ✅ Complete type system
│       │   ├── styles/          # ✅ VS Code theme integration
│       │   └── utils/           # ✅ Accessibility utilities
│       └── package.json
├── go-client/           # ✅ Go HTTP client wrapper - COMPLETED
│   ├── main.go         # ✅ Main demo application (Task 1.3 COMPLETED)
│   ├── client.go       # ✅ TracingHTTPClient implementation
│   ├── middleware.go   # ✅ Request/response capture middleware
│   ├── logger.go       # ✅ JSONL integration bridge
│   ├── config.go       # ✅ Configuration management
│   ├── types.go        # ✅ Go type definitions
│   ├── *_test.go       # ✅ Comprehensive test suite (12 scenarios)
│   ├── README.md       # ✅ Complete documentation
│   └── go.mod
├── spec/               # Comprehensive specifications
│   ├── README.md                      # ✅ Project status dashboard
│   ├── next-implementation-steps.md   # ✅ Task 1.2 detailed plan
│   ├── dependencies-and-testing.md    # ✅ Testing strategy
│   └── *.md                          # Core specifications
├── tests/
│   └── integration/
└── examples/
```

## 🎉 Production Implementation Complete

### Core Architecture: HTTP Proxy Interception

**Problem Solved**: opencode is a Go binary - runtime injection (NODE_OPTIONS, fetch patching) doesn't work.
**Solution**: Network-level HTTP proxy that intercepts all traffic from any binary type.

```bash
# Usage
node packages/cli/dist/index.js --debug "Your prompt here"
```

### Key Technical Achievements

1. **HTTP Proxy Server**: Intercepts HTTPS CONNECT requests to `api.anthropic.com:443`
2. **Process Coordination**: Spawns opencode with proxy environment variables
3. **Event Pipeline**: Proxy → Session Coordinator → Event Aggregator → JSONL files
4. **HTML Generation**: Automatic viewer creation using existing Plan v1 components
5. **Session Management**: Complete lifecycle with proper cleanup and error handling

### Architecture Components

- **HTTP Proxy** (`packages/cli/src/proxy/`): Network-level interception
- **Process Management** (`packages/cli/src/process/`): opencode spawning and coordination
- **Session Coordination** (`packages/cli/src/session/`): Event aggregation and logging
- **Event Logging**: JSONL files compatible with existing viewer components

## Architecture Patterns Established in Phase 1

### **Result Pattern** (Use for all operations that can fail)

```typescript
interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}
```

### **Async/Await Pattern** (All I/O operations)

```typescript
async function operation(): Promise<Result<DataType>> {
  try {
    const result = await asyncOperation();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}
```

### **Configuration Pattern** (Environment + file + runtime)

```typescript
// Environment variables with defaults
// JSON file merging
// Runtime validation and updates
```

### **Event Schema Pattern** (JSONL compatibility)

```typescript
interface BaseEvent {
  type: string;
  timestamp: number;
  session_id: string;
}
```

### **Component Integration Pattern** (Dependency injection)

```typescript
class MainComponent {
  constructor(
    private logger: Logger,
    private config: Config,
    private validator: Validator,
  ) {}
}
```

## Questions or Issues?

- 🎉 **Production Ready**: CLI wrapper successfully traces opencode AI API calls via HTTP proxy
- ✅ **Tested & Working**: End-to-end pipeline from proxy interception to HTML generation
- ✅ **Universal Solution**: Works with any binary type (Go, Python, Node.js, Rust, etc.)
- ✅ **Follow established patterns**: Use Result pattern, async/await, and configuration patterns shown above
