# Testing Strategy

## Overview

Comprehensive testing strategy for opencode-trace ensuring reliability, performance, and user experience across all supported platforms and use cases.

## Testing Pyramid

```
                    E2E Tests (10%)
                 ┌─────────────────┐
                 │ User Workflows  │
                 │ Integration     │
                 │ Performance     │
                 └─────────────────┘
              
            Integration Tests (20%)
         ┌─────────────────────────┐
         │ Component Integration   │
         │ API Contracts          │
         │ Cross-Platform         │
         └─────────────────────────┘
      
        Unit Tests (70%)
   ┌─────────────────────────────────┐
   │ Individual Functions/Classes    │
   │ Edge Cases & Error Handling     │
   │ Performance & Memory           │
   └─────────────────────────────────┘
```

## Test Categories

### 1. Unit Tests (70% of test coverage)

#### TypeScript/JavaScript Tests
**Framework**: Vitest with TypeScript support
**Location**: `packages/*/src/**/*.test.ts`

**Coverage Requirements**:
- **Minimum**: 85% line coverage
- **Target**: 95% line coverage
- **Critical Path**: 100% coverage for core logging and session management

**Test Categories**:
```typescript
// Logger Tests
describe('JSONLLogger', () => {
  test('creates session with valid ID format')
  test('logs events in correct JSONL format')
  test('handles file system errors gracefully')
  test('validates event schema before logging')
  test('manages concurrent session access')
  test('cleans up resources on session end')
})

// Session Management Tests
describe('SessionManager', () => {
  test('tracks multiple concurrent sessions')
  test('prevents session ID collisions')
  test('handles session timeout scenarios')
  test('recovers from corrupted session files')
})

// Event Processing Tests
describe('EventProcessor', () => {
  test('parses JSONL with malformed lines')
  test('correlates related events correctly')
  test('calculates metrics accurately')
  test('handles large datasets efficiently')
})
```

#### Go Tests
**Framework**: Go testing package with testify
**Location**: `go-client/**/*_test.go`

**Coverage Requirements**:
- **Minimum**: 80% line coverage
- **Target**: 90% line coverage

**Test Categories**:
```go
// HTTP Client Tests
func TestTracingHTTPClient(t *testing.T) {
    t.Run("captures GET requests correctly", testGETCapture)
    t.Run("captures POST requests with body", testPOSTCapture)
    t.Run("handles network errors gracefully", testNetworkErrors)
    t.Run("respects timeout configurations", testTimeouts)
    t.Run("integrates with JSONL logger", testJSONLIntegration)
}

// Performance Tests
func BenchmarkHTTPClientOverhead(b *testing.B) {
    // Measure performance impact of tracing
}
```

### 2. Integration Tests (20% of test coverage)

#### Component Integration Tests
**Framework**: Vitest with DOM testing utilities
**Location**: `tests/integration/components/`

**Test Scenarios**:
```typescript
// UI Component Integration
describe('Session Viewer Integration', () => {
  test('loads and displays real session data')
  test('handles large sessions without performance issues')
  test('search and filtering work across all data')
  test('export functionality generates correct files')
})

// Data Pipeline Integration
describe('JSONL to HTML Pipeline', () => {
  test('processes real opencode session files')
  test('generates valid HTML with embedded data')
  test('handles corrupted or incomplete sessions')
  test('maintains data integrity through pipeline')
})
```

#### API Contract Tests
**Framework**: Pact or similar contract testing
**Location**: `tests/integration/contracts/`

**Test Scenarios**:
- Go client ↔ TypeScript logger communication
- TypeScript server ↔ AI provider API contracts
- WebSocket message format validation
- File system operation contracts

### 3. End-to-End Tests (10% of test coverage)

#### Real opencode Session Tests
**Framework**: Playwright or Puppeteer for browser automation
**Location**: `tests/e2e/`

**Test Scenarios**:
```javascript
// Complete User Workflows
describe('opencode-trace E2E', () => {
  test('captures complete React app creation session', async () => {
    // 1. Start opencode with tracing enabled
    const session = await startOpenCode('OPENCODE_TRACE=true opencode "create React app"')
    
    // 2. Verify JSONL file is created and populated
    await waitForFile('.opencode-trace/sessions/*.jsonl')
    
    // 3. Verify HTML file is generated
    await waitForFile('.opencode-trace/sessions/*.html')
    
    // 4. Open HTML file in browser
    const page = await browser.newPage()
    await page.goto(`file://${htmlFile}`)
    
    // 5. Verify UI components render correctly
    await expect(page.locator('.session-timeline')).toBeVisible()
    await expect(page.locator('.ai-request')).toHaveCount(expectedAIRequests)
    
    // 6. Test interactive features
    await page.click('.collapsible-toggle')
    await expect(page.locator('.request-details')).toBeVisible()
  })
  
  test('handles error scenarios gracefully', async () => {
    // Test network failures, disk full, permission errors
  })
  
  test('performance impact within acceptable limits', async () => {
    // Measure execution time with/without tracing
    const baseline = await measureOpenCodeExecution(false)
    const withTracing = await measureOpenCodeExecution(true)
    
    const overhead = (withTracing - baseline) / baseline
    expect(overhead).toBeLessThan(0.05) // < 5% overhead
  })
})
```

## Performance Testing

### 1. Benchmark Suite
**Framework**: Custom benchmarking with statistical analysis
**Location**: `tests/performance/`

**Benchmark Categories**:
```typescript
// Logging Performance
benchmark('JSONL logging throughput', {
  setup: () => new JSONLLogger('.test-trace'),
  test: (logger) => {
    for (let i = 0; i < 1000; i++) {
      logger.logEvent(generateTestEvent())
    }
  },
  target: '> 10,000 events/second'
})

// Memory Usage
benchmark('Memory usage under load', {
  test: async () => {
    const initialMemory = process.memoryUsage().heapUsed
    await simulateHighVolumeSession()
    const finalMemory = process.memoryUsage().heapUsed
    
    expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024) // < 50MB
  }
})

// HTML Generation Performance
benchmark('HTML generation speed', {
  test: async () => {
    const sessionData = generateLargeSessionData()
    const startTime = performance.now()
    await generateHTML(sessionData)
    const duration = performance.now() - startTime
    
    expect(duration).toBeLessThan(2000) // < 2 seconds
  }
})
```

### 2. Load Testing
**Framework**: Custom load testing framework
**Location**: `tests/load/`

**Load Test Scenarios**:
- High-frequency event logging (1000+ events/second)
- Large session files (100MB+ JSONL files)
- Concurrent session handling (10+ simultaneous sessions)
- Memory pressure testing (limited heap scenarios)

### 3. Performance Regression Detection
**Framework**: Continuous benchmarking in CI
**Location**: `.github/workflows/performance.yml`

**Regression Detection**:
- Automated performance tests on every PR
- Historical performance tracking
- Alert on >10% performance degradation
- Performance budgets for critical paths

## Cross-Platform Testing

### 1. Platform Matrix
**Platforms**:
- **macOS**: 12.0+, 13.0+, 14.0+
- **Linux**: Ubuntu 20.04, 22.04, CentOS 8, Alpine
- **Windows**: Windows 10, Windows 11

**Node.js Versions**:
- Node.js 18.x (LTS)
- Node.js 20.x (LTS)
- Node.js 21.x (Current)

**Go Versions**:
- Go 1.20.x
- Go 1.21.x

### 2. Platform-Specific Tests
```yaml
# .github/workflows/cross-platform.yml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node-version: [18.x, 20.x]
    go-version: [1.20.x, 1.21.x]

steps:
  - name: Run platform-specific tests
    run: |
      npm run test:platform
      go test ./... -tags=platform
```

## Security Testing

### 1. Data Sanitization Tests
**Location**: `tests/security/sanitization.test.ts`

**Test Categories**:
```typescript
describe('Data Sanitization', () => {
  test('redacts API keys from headers', () => {
    const event = createEventWithAPIKey()
    const sanitized = sanitizeEvent(event)
    expect(sanitized.headers.authorization).toBe('Bearer ***')
  })
  
  test('removes sensitive file paths', () => {
    const event = createEventWithSensitivePath()
    const sanitized = sanitizeEvent(event)
    expect(sanitized.path).not.toContain('/Users/username')
  })
  
  test('sanitizes request/response bodies', () => {
    const event = createEventWithSensitiveBody()
    const sanitized = sanitizeEvent(event)
    expect(sanitized.body).not.toContain('password')
  })
})
```

### 2. Security Vulnerability Tests
**Framework**: npm audit, Snyk, or similar
**Location**: `.github/workflows/security.yml`

**Security Checks**:
- Dependency vulnerability scanning
- Code security analysis (ESLint security rules)
- Input validation testing
- XSS prevention in HTML generation

## Error Handling Testing

### 1. Error Scenario Tests
**Location**: `tests/error-handling/`

**Error Categories**:
```typescript
describe('Error Handling', () => {
  test('handles disk full scenarios', async () => {
    mockDiskFull()
    const logger = new JSONLLogger('.test-trace')
    
    await expect(logger.logEvent(testEvent)).not.toThrow()
    expect(logger.getErrorCount()).toBeGreaterThan(0)
  })
  
  test('recovers from corrupted JSONL files', async () => {
    createCorruptedJSONLFile()
    const processor = new JSONLProcessor()
    
    const result = await processor.processFile('corrupted.jsonl')
    expect(result.errors).toHaveLength(1)
    expect(result.validEvents).toHaveLength(0)
  })
  
  test('handles network timeouts gracefully', async () => {
    mockNetworkTimeout()
    const client = new TracingHTTPClient('session-123')
    
    const result = await client.get('http://slow-server.com')
    expect(result.error).toBeDefined()
    expect(result.logged).toBe(true)
  })
})
```

### 2. Graceful Degradation Tests
**Test Scenarios**:
- Tracing disabled due to errors
- Partial session recovery
- Fallback to basic logging
- User notification of issues

## Test Data Management

### 1. Test Data Generation
**Location**: `tests/fixtures/`

**Data Categories**:
```typescript
// Realistic Session Data
export const generateReactAppSession = () => ({
  sessionId: 'test-react-app-123',
  events: [
    createSessionStartEvent('Create a React app'),
    createFileReadEvent('package.json'),
    createAIRequestEvent('anthropic', 'claude-3-5-sonnet'),
    createToolExecutionEvent('bash', 'npx create-react-app'),
    createFileWriteEvent('src/App.js'),
    createSessionEndEvent()
  ]
})

// Edge Case Data
export const generateLargeSession = () => ({
  sessionId: 'test-large-session',
  events: Array.from({ length: 10000 }, generateRandomEvent)
})

// Error Scenario Data
export const generateCorruptedSession = () => ({
  jsonl: 'valid-line\n{invalid-json\nvalid-line-2'
})
```

### 2. Test Environment Management
**Framework**: Docker Compose for consistent environments
**Location**: `tests/docker-compose.yml`

```yaml
version: '3.8'
services:
  test-environment:
    build: .
    environment:
      - NODE_ENV=test
      - OPENCODE_TRACE=true
    volumes:
      - ./tests:/app/tests
      - ./test-data:/app/test-data
```

## Continuous Integration

### 1. CI Pipeline
**Platform**: GitHub Actions
**Location**: `.github/workflows/test.yml`

**Pipeline Stages**:
1. **Lint & Type Check** (2-3 minutes)
2. **Unit Tests** (5-10 minutes)
3. **Integration Tests** (10-15 minutes)
4. **E2E Tests** (15-20 minutes)
5. **Performance Tests** (10-15 minutes)
6. **Security Scan** (5-10 minutes)

### 2. Test Reporting
**Tools**: 
- Jest/Vitest coverage reports
- Codecov for coverage tracking
- GitHub Actions test summaries
- Performance trend reporting

### 3. Quality Gates
**Requirements for PR Merge**:
- All tests pass
- Coverage > 85%
- Performance within budgets
- Security scan passes
- Code review approved

## Test Maintenance

### 1. Test Review Process
- Monthly test suite review
- Quarterly performance benchmark updates
- Annual cross-platform compatibility review
- Continuous test data refresh

### 2. Test Metrics Tracking
- Test execution time trends
- Flaky test identification
- Coverage trend analysis
- Performance regression tracking

### 3. Test Infrastructure
- Automated test environment provisioning
- Test data backup and versioning
- Test result archival and analysis
- Performance baseline management

## Success Criteria

### 1. Coverage Targets
- **Unit Tests**: 95% line coverage
- **Integration Tests**: 90% API coverage
- **E2E Tests**: 100% critical path coverage

### 2. Performance Targets
- **Test Suite Execution**: < 45 minutes total
- **Unit Tests**: < 10 minutes
- **Integration Tests**: < 15 minutes
- **E2E Tests**: < 20 minutes

### 3. Quality Metrics
- **Flaky Test Rate**: < 1%
- **Test Maintenance Overhead**: < 10% of development time
- **Bug Escape Rate**: < 5% (bugs found in production vs. caught in testing)