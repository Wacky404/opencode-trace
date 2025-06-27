# Agent Specifications - Plan v2: CLI Wrapper

## Overview

This document defines the specialized sub-agents required for implementing the `opencode-trace` CLI wrapper. Each agent has specific expertise, clear responsibilities, and defined deliverables.

## Agent Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Project Coordinator                         │
│                 • Overall project management                   │
│                 • Cross-agent coordination                     │
│                 • Quality assurance                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Phase 1 Agents  │  │ Phase 2 Agents  │  │ Phase 3 Agents  │
│ Foundation      │  │ Interception    │  │ Integration     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Phase 1 Agents: Foundation (Days 1-4)

### Agent 1.1: CLI Foundation Agent

**Agent ID**: `cli-foundation-agent`  
**Specialization**: TypeScript CLI development, argument parsing, package management  
**Experience Level**: Senior TypeScript developer with CLI tool experience  

#### Core Responsibilities
- Design and implement CLI argument parsing system
- Set up TypeScript package structure and build pipeline
- Create executable script and package distribution setup
- Implement configuration management and validation
- Establish foundation for other agents to build upon

#### Required Expertise
- **TypeScript/Node.js**: Advanced (5+ years)
- **CLI Tools**: Expert experience with commander.js, yargs, or similar
- **Package Management**: npm/yarn/pnpm, package.json configuration
- **Build Tools**: TypeScript compiler, bundling, executable scripts
- **Testing**: Jest/Vitest for CLI testing

#### Deliverables
```typescript
// Primary deliverables with acceptance criteria
interface CLIFoundationDeliverables {
  packageStructure: {
    packageJson: string          // ✅ Valid package.json with all dependencies
    tsconfig: string            // ✅ TypeScript config with proper paths
    binScript: string           // ✅ Executable script that works cross-platform
  }
  
  cliParser: {
    argumentParser: string      // ✅ Handles all CLI flags and options
    configValidator: string     // ✅ Validates and provides defaults
    helpSystem: string          // ✅ Clear help text and usage examples
  }
  
  buildSystem: {
    buildScript: string         // ✅ Compiles TypeScript to runnable JS
    devMode: string            // ✅ Development mode with watch
    testSetup: string          // ✅ Testing infrastructure ready
  }
}
```

#### Success Criteria
```bash
# All of these commands must work:
npx opencode-trace --help                    # Shows comprehensive help
npx opencode-trace --version                 # Shows correct version
npx opencode-trace "test prompt"             # Parses arguments correctly
npx opencode-trace --trace-dir=/tmp/test     # Handles custom directories
npx opencode-trace run "prompt" --quiet      # Forwards opencode arguments

# Performance requirements:
# • CLI startup time < 500ms
# • Help text generation < 100ms
# • Argument parsing < 50ms
```

#### Knowledge Requirements
- Understanding of opencode CLI interface and arguments
- Familiarity with Plan v1 configuration patterns
- Experience with cross-platform executable creation
- Knowledge of semantic versioning and npm publishing

#### Handoff to Next Agent
- Complete package structure ready for process management
- All CLI argument parsing working and tested
- Clear interface for ProcessCoordinator to consume configuration
- Documentation for configuration options and validation

---

### Agent 1.2: Process Manager Agent

**Agent ID**: `process-manager-agent`  
**Specialization**: Process management, IPC, system programming  
**Experience Level**: Senior Node.js developer with systems programming experience  

#### Core Responsibilities
- Design and implement process spawning for opencode components
- Set up inter-process communication (IPC) between wrapper and opencode
- Handle process lifecycle management and cleanup
- Implement health monitoring and error recovery
- Create robust process coordination system

#### Required Expertise
- **Node.js Process Management**: Expert level with child_process, cluster
- **Inter-Process Communication**: Unix sockets, named pipes, message passing
- **System Programming**: Process signals, cleanup handlers, resource management
- **Error Handling**: Graceful degradation, recovery mechanisms
- **Cross-Platform Development**: Windows, macOS, Linux process differences

#### Deliverables
```typescript
interface ProcessManagerDeliverables {
  processCoordination: {
    coordinator: string         // ✅ Main coordination class
    spawner: string            // ✅ Process spawning utilities
    monitor: string            // ✅ Health monitoring and restart logic
  }
  
  ipcSystem: {
    ipcManager: string         // ✅ Message passing between processes
    protocolDefinition: string // ✅ IPC message format and protocol
    eventAggregator: string    // ✅ Collects events from all processes
  }
  
  lifecycleManagement: {
    startup: string            // ✅ Orchestrated startup sequence
    shutdown: string           // ✅ Graceful shutdown with cleanup
    errorRecovery: string      // ✅ Handle process failures gracefully
  }
}
```

#### Success Criteria
```bash
# Process management tests:
opencode-trace "test prompt"
# ✅ TypeScript server starts with correct environment
# ✅ Go TUI starts with tracing enabled
# ✅ IPC communication established between processes
# ✅ Graceful shutdown on Ctrl+C
# ✅ Cleanup removes all temporary files and sockets

# Error handling tests:
# ✅ Handles TypeScript server crash and recovery
# ✅ Handles Go TUI exit and cleanup
# ✅ Continues opencode execution if tracing fails
# ✅ No zombie processes left after abnormal termination
```

#### Knowledge Requirements
- Understanding of opencode's dual architecture (Go TUI + TypeScript server)
- Experience with process orchestration and container-like management
- Knowledge of signal handling and cleanup procedures
- Familiarity with debugging multi-process applications

#### Dependencies
- **Agent 1.1 Output**: CLI configuration and argument parsing
- **Plan v1 Components**: Session management patterns from tracer package

#### Handoff to Next Agent
- Robust process spawning and coordination system
- Working IPC for event collection and process management
- Health monitoring and error recovery mechanisms
- Clear interfaces for runtime injection agents

---

## Phase 2 Agents: Runtime Interception (Days 5-9)

### Agent 2.1: TypeScript Interceptor Agent

**Agent ID**: `typescript-interceptor-agent`  
**Specialization**: Runtime injection, fetch patching, Node.js internals  
**Experience Level**: Expert JavaScript/TypeScript developer with runtime modification experience  

#### Core Responsibilities
- Create runtime interceptor for TypeScript server using Node.js `--require`
- Implement fetch() patching for AI provider request capture
- Add file system operation monitoring and tool execution tracing
- Integrate with Plan v1 AI provider interceptors and cost calculation
- Set up event logging to opencode-trace session

#### Required Expertise
- **Runtime Injection**: Expert level with Node.js `--require`, module patching
- **JavaScript Internals**: Global object modification, prototype patching
- **HTTP Interception**: Fetch API, XMLHttpRequest, Node.js http module
- **File System Monitoring**: fs module patching, file operation capture
- **Async Programming**: Promises, async/await, event handling

#### Deliverables
```typescript
interface TypeScriptInterceptorDeliverables {
  runtimeInjection: {
    interceptorLoader: string   // ✅ Node.js --require loader script
    serverInterceptor: string  // ✅ Main server interception logic
    modulePatching: string     // ✅ Safe module patching utilities
  }
  
  requestInterception: {
    fetchPatcher: string       // ✅ Global fetch() patching
    httpInterceptor: string    // ✅ Node.js http module interception
    responseHandler: string    // ✅ Response body capture and sanitization
  }
  
  systemMonitoring: {
    fsMonitor: string          // ✅ File system operation tracking
    toolTracer: string         // ✅ Tool execution capture
    processMonitor: string     // ✅ Child process monitoring
  }
  
  planV1Integration: {
    aiProviderAdapter: string  // ✅ Integrates Plan v1 AI interceptors
    costCalculation: string    // ✅ Real-time cost tracking
    tokenTracking: string      // ✅ Token usage monitoring
  }
}
```

#### Success Criteria
```bash
# Interception verification:
opencode-trace "make a request to Anthropic Claude"
# ✅ All fetch() calls intercepted and logged
# ✅ AI provider detection working (Anthropic/OpenAI/Google)
# ✅ Cost calculation accurate and real-time
# ✅ Token usage tracked correctly
# ✅ Request/response bodies captured and sanitized

# File system monitoring:
opencode-trace "create and edit a new file"
# ✅ File read operations captured
# ✅ File write operations captured with diffs
# ✅ Directory operations monitored
# ✅ Tool executions (bash, editor) traced

# Performance requirements:
# ✅ < 2ms overhead per HTTP request
# ✅ < 1ms overhead per file operation
# ✅ No memory leaks in long-running sessions
```

#### Knowledge Requirements
- Deep understanding of Node.js module system and global objects
- Experience with HTTP request/response interception patterns
- Knowledge of claude-trace interception techniques
- Understanding of Plan v1 AI provider interceptor architecture
- Experience with secure data handling and sanitization

#### Dependencies
- **Agent 1.2 Output**: Process coordination and IPC system
- **Plan v1 Components**: AI provider interceptors, cost calculator, token tracker
- **opencode Knowledge**: TypeScript server architecture and API patterns

#### Handoff to Next Agent
- Complete TypeScript server interception working
- All HTTP and file system operations traced
- Integration with Plan v1 AI components functional
- Event logging to wrapper session established

---

### Agent 2.2: Go Wrapper Agent

**Agent ID**: `go-wrapper-agent`  
**Specialization**: Go development, HTTP client wrapping, cgo/system integration  
**Experience Level**: Senior Go developer with system programming experience  

#### Core Responsibilities
- Create Go wrapper for opencode TUI that injects tracing
- Integrate Plan v1 Go HTTP client wrapper for TUI ↔ Server requests
- Implement session coordination between Go and TypeScript components
- Handle Go-specific tool execution and system call tracing
- Ensure seamless integration with existing opencode TUI functionality

#### Required Expertise
- **Go Programming**: Expert level (5+ years) with HTTP clients, system programming
- **HTTP Client Wrapping**: Experience with http.Transport and http.Client customization
- **System Integration**: Process injection, environment variable handling
- **Build Systems**: Go modules, build scripts, cross-compilation
- **Testing**: Go testing, benchmarking, integration tests

#### Deliverables
```go
type GoWrapperDeliverables struct {
    TUIIntegration struct {
        TUIWrapper      string // ✅ Main wrapper for opencode TUI
        HTTPInjector    string // ✅ HTTP client injection logic
        SessionCoord    string // ✅ Session coordination with TypeScript
    }
    
    TracingIntegration struct {
        PlanV1Client    string // ✅ Integration with Plan v1 Go client
        RequestTracing  string // ✅ TUI ↔ Server request capture
        ToolExecution   string // ✅ Tool command capture and monitoring
    }
    
    BuildSystem struct {
        BuildScript     string // ✅ Cross-platform build automation
        TestSuite       string // ✅ Comprehensive Go testing
        Integration     string // ✅ Integration with CLI wrapper
    }
}
```

#### Success Criteria
```bash
# Go TUI integration tests:
opencode-trace "create a file using the TUI"
# ✅ TUI starts with tracing HTTP client injected
# ✅ TUI ↔ Server requests captured and logged
# ✅ Tool executions (bash, file operations) traced
# ✅ Session data coordinated with TypeScript server
# ✅ No disruption to normal TUI functionality

# Performance verification:
# ✅ HTTP client wrapping adds < 1ms per request
# ✅ No memory leaks in HTTP client wrapper
# ✅ TUI startup time impact < 100ms
# ✅ Tool execution overhead < 5ms per command
```

#### Knowledge Requirements
- Understanding of opencode TUI architecture and main execution flow
- Experience with HTTP middleware and transport wrapping in Go
- Knowledge of Plan v1 Go HTTP client implementation
- Understanding of Go build systems and cross-compilation

#### Dependencies
- **Agent 2.1 Output**: TypeScript server interception and session coordination
- **Plan v1 Components**: Go HTTP client wrapper from `go-client/`
- **opencode TUI**: Understanding of TUI main.go and HTTP client usage

#### Handoff to Next Agent
- Working Go TUI wrapper with HTTP client injection
- Session coordination between Go and TypeScript components
- Tool execution tracing from Go side
- Build system for Go wrapper integration

---

### Agent 2.3: Session Coordination Agent

**Agent ID**: `session-coordination-agent`  
**Specialization**: Distributed systems, event aggregation, session management  
**Experience Level**: Senior developer with distributed systems experience  

#### Core Responsibilities
- Design and implement session lifecycle coordination across processes
- Create event aggregation system to prevent duplicates and ensure consistency
- Implement session state synchronization between wrapper, server, and TUI
- Handle temporal event ordering and correlation across processes
- Create robust error handling for coordination failures

#### Required Expertise
- **Distributed Systems**: Event ordering, consensus, state synchronization
- **Event Processing**: Stream processing, deduplication, temporal correlation
- **Database/Storage**: Session state persistence, transaction handling
- **Async Systems**: Message queues, event buses, coordination patterns
- **Error Handling**: Distributed failure modes, recovery strategies

#### Deliverables
```typescript
interface SessionCoordinationDeliverables {
  sessionLifecycle: {
    sessionManager: string      // ✅ Central session lifecycle management
    stateSync: string          // ✅ State synchronization across processes
    metadataCollection: string // ✅ Session metadata aggregation
  }
  
  eventAggregation: {
    eventCollector: string     // ✅ Collects events from all processes
    deduplicator: string       // ✅ Prevents duplicate events
    temporalOrdering: string   // ✅ Orders events by timestamp
    correlationEngine: string  // ✅ Correlates related events
  }
  
  coordinationProtocol: {
    messageProtocol: string    // ✅ IPC message format and protocol
    heartbeatSystem: string    // ✅ Process health monitoring
    failureRecovery: string    // ✅ Handle process failures gracefully
  }
}
```

#### Success Criteria
```bash
# Session coordination tests:
opencode-trace "complex multi-step workflow"
# ✅ Events from TypeScript server and Go TUI collected
# ✅ No duplicate events in final JSONL output
# ✅ Events properly ordered by timestamp
# ✅ Related events (request/response) correlated correctly
# ✅ Session metadata accurate and complete

# Failure handling tests:
# ✅ Handles TypeScript server crash during session
# ✅ Handles Go TUI exit during session
# ✅ Recovers partial session data when possible
# ✅ Never corrupts session files during failures
```

#### Knowledge Requirements
- Understanding of Plan v1 session management patterns
- Experience with event-driven architectures and stream processing
- Knowledge of temporal event ordering and correlation algorithms
- Understanding of distributed system failure modes

#### Dependencies
- **Agent 2.1 Output**: TypeScript server event generation
- **Agent 2.2 Output**: Go TUI event generation
- **Plan v1 Components**: Session management and event schemas

#### Handoff to Next Agent
- Robust session coordination across all processes
- Event aggregation preventing duplicates and ensuring consistency
- Session state synchronization working reliably
- Clear interface for integration agent to consume coordinated data

---

## Phase 3 Agents: Integration & Testing (Days 10-12)

### Agent 3.1: Integration Agent

**Agent ID**: `integration-agent`  
**Specialization**: System integration, end-to-end testing, performance optimization  
**Experience Level**: Senior full-stack developer with integration experience  

#### Core Responsibilities
- Complete end-to-end integration of all wrapper components
- Implement HTML auto-generation using Plan v1 viewer components
- Integrate with session browser for wrapper-generated sessions
- Optimize performance and memory usage across the entire system
- Handle all error scenarios with graceful degradation

#### Required Expertise
- **System Integration**: Large system integration, component orchestration
- **Performance Optimization**: Profiling, memory management, bottleneck identification
- **Testing**: End-to-end testing, integration testing, performance testing
- **HTML Generation**: Understanding of Plan v1 viewer architecture
- **Error Handling**: Comprehensive error scenarios and recovery

#### Deliverables
```typescript
interface IntegrationDeliverables {
  endToEndIntegration: {
    systemOrchestrator: string  // ✅ Coordinates all components
    dataFlow: string           // ✅ Complete data flow from capture to HTML
    sessionPipeline: string    // ✅ Session processing pipeline
  }
  
  htmlGeneration: {
    autoGenerator: string      // ✅ Automatic HTML generation after sessions
    viewerIntegration: string  // ✅ Integration with Plan v1 viewer
    browserIntegration: string // ✅ Session browser updates
  }
  
  performanceOptimization: {
    memoryOptimization: string // ✅ Memory usage optimization
    performanceMonitor: string // ✅ Real-time performance monitoring
    bottleneckResolver: string // ✅ Performance bottleneck resolution
  }
  
  errorHandling: {
    gracefulDegradation: string // ✅ Handle all failure scenarios
    recoveryMechanisms: string  // ✅ Recovery from partial failures
    userNotification: string    // ✅ Clear error reporting to users
  }
}
```

#### Success Criteria
```bash
# End-to-end integration tests:
opencode-trace "build a complete React application"
# ✅ Complete session captured (TUI + Server + AI requests)
# ✅ All events properly correlated and ordered
# ✅ HTML generated automatically using Plan v1 components
# ✅ Session browser updated with new session
# ✅ Performance impact < 5% compared to vanilla opencode

# Error scenario tests:
# ✅ opencode crashes - session data preserved and HTML generated
# ✅ Network failures - partial session captured gracefully
# ✅ Disk full - graceful degradation with user notification
# ✅ Permission errors - clear error messages and fallback behavior

# Performance requirements:
# ✅ Memory overhead < 50MB for typical sessions
# ✅ HTML generation < 2 seconds for sessions with 1000+ events
# ✅ No memory leaks during long-running sessions
```

#### Knowledge Requirements
- Deep understanding of Plan v1 architecture and all components
- Experience with performance profiling and optimization
- Knowledge of HTML generation pipeline and viewer components
- Understanding of opencode usage patterns and typical session sizes

#### Dependencies
- **All Phase 2 Agents**: Complete runtime interception system
- **Plan v1 Components**: HTML generator, viewer, session browser
- **Performance Requirements**: Defined performance targets and benchmarks

#### Handoff to Next Agent
- Complete end-to-end system working reliably
- Performance optimized and meeting all targets
- Error handling comprehensive and tested
- Clear documentation of integration points and data flows

---

### Agent 3.2: Testing & Documentation Agent

**Agent ID**: `testing-documentation-agent`  
**Specialization**: QA testing, technical writing, test automation  
**Experience Level**: Senior QA engineer with development background  

#### Core Responsibilities
- Create comprehensive test suite covering all wrapper functionality
- Write user-facing documentation, tutorials, and troubleshooting guides
- Implement performance benchmarks and regression tests
- Create developer documentation for future maintenance
- Establish CI/CD pipeline for automated testing

#### Required Expertise
- **Test Engineering**: Unit testing, integration testing, E2E testing frameworks
- **Technical Writing**: User documentation, API documentation, tutorials
- **Performance Testing**: Benchmarking, load testing, regression detection
- **CI/CD**: GitHub Actions, automated testing pipelines
- **Quality Assurance**: Test planning, coverage analysis, defect tracking

#### Deliverables
```typescript
interface TestingDocumentationDeliverables {
  testSuite: {
    unitTests: string          // ✅ Comprehensive unit test coverage
    integrationTests: string   // ✅ Integration test scenarios
    e2eTests: string          // ✅ End-to-end workflow tests
    performanceTests: string   // ✅ Performance benchmark suite
  }
  
  documentation: {
    userGuide: string         // ✅ Complete user documentation
    installationGuide: string // ✅ Installation and setup guide
    troubleshooting: string   // ✅ Common issues and solutions
    apiDocumentation: string  // ✅ Developer API documentation
  }
  
  qualityAssurance: {
    testPlan: string          // ✅ Comprehensive test plan
    coverageReports: string   // ✅ Test coverage analysis
    performanceBenchmarks: string // ✅ Performance regression detection
    cicdPipeline: string      // ✅ Automated testing pipeline
  }
}
```

#### Success Criteria
```bash
# Test coverage requirements:
npm run test:coverage
# ✅ Unit test coverage > 90%
# ✅ Integration test coverage > 85%
# ✅ All critical paths covered
# ✅ All error scenarios tested

# Performance benchmarks:
npm run benchmark
# ✅ All benchmarks pass performance targets
# ✅ Regression detection working
# ✅ Performance monitoring integrated

# Documentation verification:
# ✅ Installation guide tested on clean systems
# ✅ User guide covers all CLI options
# ✅ Troubleshooting guide addresses common issues
# ✅ API documentation complete and accurate
```

#### Knowledge Requirements
- Understanding of entire wrapper system architecture
- Experience with opencode usage patterns and common user scenarios
- Knowledge of testing best practices and coverage analysis
- Understanding of performance testing and benchmarking

#### Dependencies
- **Agent 3.1 Output**: Complete integrated system
- **All Previous Agents**: Understanding of all components for comprehensive testing

#### Handoff to Distribution
- Complete test suite with high coverage
- Comprehensive documentation ready for users
- Performance benchmarks and monitoring established
- CI/CD pipeline for ongoing quality assurance

---

## Phase 4 Agents: Distribution & Polish (Days 13-15)

### Agent 4.1: Distribution Agent

**Agent ID**: `distribution-agent`  
**Specialization**: Package management, distribution, release engineering  
**Experience Level**: DevOps engineer with npm/release experience  

#### Core Responsibilities
- Set up npm package distribution for global installation
- Create cross-platform installation scripts and compatibility
- Implement automated release pipeline with versioning
- Create package management and update mechanisms
- Ensure cross-platform compatibility and testing

#### Required Expertise
- **Package Management**: npm publishing, semantic versioning, package.json
- **Cross-Platform Development**: Windows, macOS, Linux compatibility
- **Release Engineering**: Automated releases, CI/CD, version management
- **Distribution**: CDN, mirrors, installation scripts
- **DevOps**: Build automation, deployment pipelines

#### Deliverables
```json
{
  "packageDistribution": {
    "npmPackage": "✅ npm package ready for global installation",
    "installationScript": "✅ Cross-platform installation script",
    "versionManagement": "✅ Semantic versioning and update checking",
    "releaseAutomation": "✅ Automated release pipeline"
  },
  
  "crossPlatformSupport": {
    "windowsSupport": "✅ Windows compatibility (WSL and native)",
    "macosSupport": "✅ macOS compatibility (Intel and Apple Silicon)",
    "linuxSupport": "✅ Linux compatibility (major distros)",
    "compatibilityTesting": "✅ Cross-platform testing suite"
  },
  
  "distributionInfrastructure": {
    "releaseWorkflow": "✅ GitHub Actions release workflow",
    "packageRegistry": "✅ npm registry configuration",
    "updateMechanism": "✅ Automatic update checking and installation",
    "installationVerification": "✅ Post-install verification tests"
  }
}
```

#### Success Criteria
```bash
# Installation tests:
npm install -g opencode-trace     # ✅ Global installation works
opencode-trace --version          # ✅ Version command works
opencode-trace "test prompt"      # ✅ Basic functionality works

# Cross-platform tests:
# ✅ Works on Windows (WSL and native)
# ✅ Works on macOS (Intel and Apple Silicon)
# ✅ Works on Linux (Ubuntu, CentOS, Arch)
# ✅ Installation script works on all platforms

# Update mechanism tests:
# ✅ Automatic update checking works
# ✅ Update installation works correctly
# ✅ Version compatibility maintained
```

### Agent 4.2: Performance Agent

**Agent ID**: `performance-agent`  
**Specialization**: Performance optimization, profiling, monitoring  
**Experience Level**: Senior performance engineer  

#### Core Responsibilities
- Optimize memory usage and CPU performance across all components
- Implement real-time performance monitoring and alerting
- Create performance regression detection and prevention
- Optimize for large sessions and high-frequency usage
- Establish performance baselines and monitoring dashboards

#### Success Criteria
- < 5% CPU overhead compared to vanilla opencode
- < 50MB additional memory usage
- < 2 second HTML generation for sessions with 1000+ events
- Support for sessions with 10,000+ events without degradation

### Agent 4.3: Polish Agent

**Agent ID**: `polish-agent`  
**Specialization**: UX/UI, developer experience, feature completion  
**Experience Level**: Senior developer with UX focus  

#### Core Responsibilities
- Implement advanced CLI features and commands
- Create developer debugging and diagnostic tools
- Polish user experience and error messages
- Add shell completion and developer convenience features
- Final quality assurance and user acceptance testing

#### Deliverables
- Advanced CLI commands (`list`, `view`, `export`, `clean`)
- Configuration management commands
- Shell completion scripts (bash, zsh, fish)
- Developer debugging tools
- Polished user experience

## Agent Coordination & Communication

### Handoff Protocol
Each agent must provide:
1. **Complete deliverables** as specified in their requirements
2. **Working test suite** demonstrating all functionality
3. **Integration documentation** for the next agent
4. **Known issues list** and mitigation strategies
5. **Performance metrics** meeting specified targets

### Quality Gates
Before handoff to next agent:
- [ ] All unit tests passing
- [ ] Integration tests with previous components passing
- [ ] Performance benchmarks meeting targets
- [ ] Code review completed
- [ ] Documentation updated

### Escalation Process
If an agent encounters blockers:
1. **Technical Issues**: Escalate to project coordinator for cross-agent consultation
2. **Requirement Conflicts**: Project coordinator mediates with stakeholders
3. **Performance Issues**: Engage performance agent for consultation
4. **Integration Issues**: Coordinate with dependent agents for resolution

This agent specification ensures clear responsibility boundaries while maintaining coordination and quality throughout the implementation process.