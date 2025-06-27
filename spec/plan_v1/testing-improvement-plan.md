# Testing Improvement Plan for opencode-trace

## Executive Summary

Before proceeding to Task 4.3 (opencode Integration), we need to establish comprehensive test coverage to ensure reliability and maintainability. Currently, we have strong integration test coverage but **ZERO unit tests**, which violates our testing pyramid strategy (70% unit, 20% integration, 10% E2E).

## Current State Analysis

### ✅ What We Have
- **Integration Tests**: Good coverage for Phase 1-2 features
- **Go Tests**: Comprehensive unit and integration tests for Go client
- **Test Framework**: Vitest configured and ready
- **CI Pipeline**: Basic test runner in place

### ❌ Critical Gaps
1. **0% Unit Test Coverage** (Target: 85% minimum)
2. **No Component Tests** for 20+ Lit components
3. **No E2E Tests** for complete workflows
4. **No Performance Benchmarks**
5. **No Security Tests**
6. **No Coverage Reporting**

## Testing Pyramid Requirements

```
                 E2E Tests (10%)
              ┌─────────────────┐
              │  0% → 10%       │ ❌ Missing
              └─────────────────┘
           
         Integration Tests (20%)
      ┌─────────────────────────┐
      │  ~15% → 20%             │ ⚠️  Close
      └─────────────────────────┘
   
      Unit Tests (70%)
┌─────────────────────────────────┐
│  0% → 70%                       │ ❌ Critical Gap
└─────────────────────────────────┘
```

## Prioritized Testing Plan

### Phase 1: Critical Unit Tests (1-2 days)
**Goal**: Achieve 85% coverage for core components

#### 1.1 Core Tracer Components
```typescript
// packages/tracer/src/__tests__/filesystem.test.ts
describe('FileSystemManager', () => {
  test('creates directory structure atomically')
  test('handles EACCES permission errors')
  test('validates disk space before write')
  test('cleans up old sessions')
})

// packages/tracer/src/__tests__/config.test.ts
describe('ConfigManager', () => {
  test('loads environment variables correctly')
  test('merges JSON config with defaults')
  test('validates configuration schema')
  test('handles missing config files')
})

// packages/tracer/src/__tests__/validator.test.ts
describe('EventValidator', () => {
  test('validates all event types')
  test('sanitizes sensitive data')
  test('handles malformed events')
  test('performance under load')
})
```

#### 1.2 Session Management
```typescript
// packages/tracer/src/__tests__/session.test.ts
describe('SessionManager', () => {
  test('generates unique session IDs')
  test('tracks concurrent sessions')
  test('handles session timeouts')
  test('cleans up on shutdown')
})

// packages/tracer/src/__tests__/logger.test.ts
describe('JSONLLogger', () => {
  test('writes valid JSONL format')
  test('batches events efficiently')
  test('handles write failures')
  test('recovers from errors')
})
```

### Phase 2: Component Tests (1-2 days)
**Goal**: Test all UI components with DOM utilities

#### 2.1 Viewer Components
```typescript
// packages/viewer/src/components/__tests__/session-timeline.test.ts
describe('SessionTimeline', () => {
  test('renders timeline with events')
  test('handles zoom interactions')
  test('filters events correctly')
  test('performance with 1000+ events')
})

// packages/viewer/src/components/__tests__/request-detail.test.ts
describe('RequestDetail', () => {
  test('displays request/response data')
  test('syntax highlighting works')
  test('handles large payloads')
  test('copy functionality')
})
```

#### 2.2 Dashboard Components
```typescript
// packages/viewer/src/components/__tests__/session-browser.test.ts
describe('SessionBrowser', () => {
  test('lists all sessions')
  test('search functionality')
  test('sorting works correctly')
  test('exports data properly')
})
```

### Phase 3: E2E Tests (1 day)
**Goal**: Test complete user workflows

```typescript
// tests/e2e/complete-workflow.test.ts
describe('opencode-trace E2E', () => {
  test('captures and displays React app creation', async () => {
    // Start opencode with tracing
    const process = spawn('opencode', ['create React app'], {
      env: { ...process.env, OPENCODE_TRACE: 'true' }
    })
    
    // Verify JSONL creation
    await waitForFile('.opencode-trace/sessions/*.jsonl')
    
    // Verify HTML generation
    await waitForFile('.opencode-trace/sessions/*.html')
    
    // Open and verify HTML viewer
    const browser = await chromium.launch()
    const page = await browser.newPage()
    await page.goto('file://.../*.html')
    
    // Verify UI components
    await expect(page.locator('.session-timeline')).toBeVisible()
    await expect(page.locator('.ai-request')).toHaveCount('>= 1')
  })
})
```

### Phase 4: Performance & Security Tests (1 day)
**Goal**: Ensure performance and security requirements

#### 4.1 Performance Benchmarks
```typescript
// tests/performance/benchmarks.test.ts
describe('Performance Benchmarks', () => {
  benchmark('JSONL logging throughput', {
    target: '> 10,000 events/second',
    test: async () => {
      const logger = new JSONLLogger()
      for (let i = 0; i < 10000; i++) {
        await logger.logEvent(generateEvent())
      }
    }
  })
  
  benchmark('Memory usage under load', {
    target: '< 50MB for 10k events',
    test: async () => {
      const before = process.memoryUsage().heapUsed
      await processLargeSession()
      const after = process.memoryUsage().heapUsed
      expect(after - before).toBeLessThan(50 * 1024 * 1024)
    }
  })
})
```

#### 4.2 Security Tests
```typescript
// tests/security/sanitization.test.ts
describe('Security Tests', () => {
  test('sanitizes API keys in headers')
  test('redacts passwords in bodies')
  test('prevents XSS in HTML generation')
  test('validates file paths')
})
```

### Phase 5: Test Infrastructure (1 day)
**Goal**: Set up comprehensive test infrastructure

1. **Coverage Reporting**
   ```json
   // vitest.config.ts
   {
     "test": {
       "coverage": {
         "enabled": true,
         "reporter": ["text", "lcov", "html"],
         "thresholds": {
           "lines": 85,
           "functions": 85,
           "branches": 80,
           "statements": 85
         }
       }
     }
   }
   ```

2. **Test Fixtures**
   ```typescript
   // tests/fixtures/sessions.ts
   export const generateReactSession = () => ({...})
   export const generateLargeSession = () => ({...})
   export const generateCorruptedSession = () => ({...})
   ```

3. **CI Pipeline Update**
   ```yaml
   # .github/workflows/test.yml
   - name: Unit Tests
     run: npm run test:unit -- --coverage
   - name: Component Tests  
     run: npm run test:components
   - name: Integration Tests
     run: npm run test:integration
   - name: E2E Tests
     run: npm run test:e2e
   - name: Upload Coverage
     uses: codecov/codecov-action@v3
   ```

## Implementation Timeline

**Total Time: 5-7 days**

1. **Day 1-2**: Core unit tests (tracer package)
2. **Day 3-4**: Component tests (viewer package)  
3. **Day 5**: E2E tests
4. **Day 6**: Performance & security tests
5. **Day 7**: Infrastructure & CI setup

## Success Criteria

### Coverage Targets
- [ ] Unit test coverage > 85%
- [ ] All critical paths have tests
- [ ] All components have tests
- [ ] E2E tests for main workflows

### Quality Metrics
- [ ] All tests pass reliably (< 1% flaky)
- [ ] Test execution < 10 minutes for unit tests
- [ ] Performance benchmarks established
- [ ] Security vulnerabilities tested

### Infrastructure
- [ ] Coverage reporting automated
- [ ] CI pipeline comprehensive
- [ ] Test data generators created
- [ ] Documentation updated

## Risks & Mitigation

1. **Risk**: Time investment delays Task 4.3
   - **Mitigation**: Focus on critical path tests first
   
2. **Risk**: Test maintenance overhead
   - **Mitigation**: Use test generators and fixtures
   
3. **Risk**: Flaky tests slow development
   - **Mitigation**: Proper test isolation and mocking

## Recommendation

**We should implement at least Phase 1-2 (unit and component tests) before proceeding to Task 4.3.** This will:

1. Ensure core functionality is properly tested
2. Catch regressions during integration work
3. Meet minimum coverage requirements (85%)
4. Establish testing patterns for the team

The remaining phases (E2E, performance, security) can be implemented in parallel with Task 4.3 work.

## Next Steps

1. [ ] Review and approve this plan
2. [ ] Begin Phase 1 implementation
3. [ ] Set up coverage reporting
4. [ ] Create test templates
5. [ ] Update documentation