# Testing Strategy Summary & Recommendations

## Executive Summary

After thorough analysis of the opencode-trace testing infrastructure, we've identified critical gaps that must be addressed before proceeding to Task 4.3 (opencode Integration). The most significant finding is **0% unit test coverage** despite our target of 85%.

## Current Testing State

### ✅ Strengths
- **Integration Tests**: Good coverage for Phase 1-2 features
- **Go Client**: Comprehensive unit and integration tests
- **Test Framework**: Vitest is configured and ready
- **CI Pipeline**: Basic infrastructure exists

### ❌ Critical Gaps
1. **Unit Tests**: 0% coverage (Target: 85%)
2. **Component Tests**: No tests for 20+ Lit components
3. **E2E Tests**: No complete workflow tests
4. **Performance Tests**: No benchmarks established
5. **Security Tests**: No vulnerability testing
6. **Coverage Reporting**: Not configured

## Risk Assessment

### High Risk Areas Without Tests

1. **Core Tracer Components** (HIGH RISK)
   - FileSystemManager: Handles all file I/O operations
   - ConfigManager: Critical for system configuration
   - EventValidator: Data integrity and security
   - JSONLLogger: Core logging functionality

2. **UI Components** (MEDIUM RISK)
   - SessionTimeline: Main visualization component
   - RequestDetail: Displays sensitive data
   - SessionBrowser: Dashboard functionality
   - No regression protection for UI changes

3. **Data Processing** (HIGH RISK)
   - JSONLProcessor: Parses untrusted input
   - MetricsCalculator: Financial calculations
   - EventCorrelator: Data relationships
   - No validation of calculation accuracy

## Recommended Testing Approach

### Phase 1: Critical Path Testing (2-3 days) - MUST DO

Focus on core components that handle data integrity and security:

1. **Day 1**: Core Tracer Unit Tests
   - FileSystemManager (file operations, error handling)
   - ConfigManager (environment variables, validation)
   - EventValidator (schema validation, sanitization)
   - Target: 85% coverage for these components

2. **Day 2**: Session & Logger Tests
   - SessionManager (concurrency, lifecycle)
   - JSONLLogger (formatting, batching)
   - JSONLSerializer (data integrity)
   - Target: 85% coverage for core functionality

3. **Day 3**: Critical UI Components
   - SessionTimeline (rendering, performance)
   - RequestDetail (data display, sanitization)
   - HTMLGenerator (security, self-containment)
   - Target: Basic smoke tests for all components

### Phase 2: Comprehensive Testing (3-4 days) - RECOMMENDED

4. **Day 4-5**: Complete Component Coverage
   - All remaining Lit components
   - Data processors and calculators
   - HTML generation pipeline
   - Target: 85% overall coverage

5. **Day 6**: E2E and Performance Tests
   - Complete session workflow
   - Performance benchmarks
   - Load testing scenarios
   - Target: Critical paths covered

6. **Day 7**: Security and Integration
   - Data sanitization tests
   - XSS prevention tests
   - Cross-platform testing
   - Target: Security vulnerabilities addressed

## Implementation Priority

### Immediate Actions (Before Task 4.3)

1. **Install Testing Dependencies**
   ```bash
   npm install -D @vitest/coverage-v8 @open-wc/testing @playwright/test
   ```

2. **Create Unit Tests for Critical Components**
   - Minimum 10 test files covering core functionality
   - Focus on error handling and edge cases
   - Achieve 85% coverage for critical paths

3. **Set Up Coverage Reporting**
   - Configure Vitest coverage
   - Add coverage thresholds
   - Integrate with CI pipeline

### Can Be Done in Parallel with Task 4.3

- E2E tests
- Performance benchmarks
- Additional component tests
- Security testing suite

## Cost-Benefit Analysis

### Cost of Not Testing
- **High Risk**: Data corruption in production
- **Medium Risk**: Security vulnerabilities exposed
- **High Risk**: Performance regressions undetected
- **Medium Risk**: UI bugs affecting user experience
- **High Risk**: Integration failures with opencode

### Benefits of Testing
- **Confidence**: Safe refactoring during integration
- **Quality**: Catch bugs before users
- **Documentation**: Tests serve as usage examples
- **Regression Prevention**: Protect against breaking changes
- **Performance**: Establish and maintain benchmarks

## Recommended Minimum Test Suite

Before proceeding to Task 4.3, implement these tests at minimum:

```typescript
// 1. FileSystemManager Tests
- ✓ Creates directories atomically
- ✓ Handles permission errors
- ✓ Validates disk space
- ✓ Cleans up old sessions

// 2. JSONLLogger Tests
- ✓ Writes valid JSONL format
- ✓ Handles concurrent sessions
- ✓ Recovers from write errors
- ✓ Batches events efficiently

// 3. EventValidator Tests
- ✓ Validates all event types
- ✓ Sanitizes sensitive data
- ✓ Handles malformed input
- ✓ Performance under load

// 4. SessionManager Tests
- ✓ Generates unique IDs
- ✓ Tracks lifecycle correctly
- ✓ Handles timeouts
- ✓ Cleans up resources

// 5. HTMLGenerator Tests
- ✓ Generates valid HTML
- ✓ Embeds assets correctly
- ✓ Sanitizes data
- ✓ Self-contained output

// 6. Basic UI Component Tests
- ✓ SessionTimeline renders
- ✓ RequestDetail displays data
- ✓ SessionBrowser lists sessions
- ✓ Components handle errors
```

## Decision Framework

### Option 1: Minimal Testing (2-3 days)
- **Pros**: Faster to Task 4.3, covers critical paths
- **Cons**: Higher risk, technical debt
- **Recommendation**: Minimum viable option

### Option 2: Comprehensive Testing (5-7 days)
- **Pros**: Full coverage, high confidence, best practices
- **Cons**: Delays Task 4.3
- **Recommendation**: Ideal approach

### Option 3: Hybrid Approach (3-4 days)
- **Pros**: Balance of speed and safety
- **Cons**: Some areas remain untested
- **Recommendation**: Pragmatic choice

## Final Recommendation

**Implement Option 3: Hybrid Approach**

1. **Days 1-2**: Critical unit tests (85% coverage for core)
2. **Day 3**: Basic component tests and setup
3. **Day 4**: Coverage reporting and CI integration
4. **In Parallel with Task 4.3**: E2E, performance, security

This approach:
- Addresses highest risks first
- Enables safe Task 4.3 development
- Establishes testing foundation
- Allows parallel work on remaining tests

## Success Metrics

By the end of testing implementation:
- [ ] 85% coverage for critical components
- [ ] All core functionality has tests
- [ ] CI pipeline runs all tests
- [ ] Coverage reports generated
- [ ] No failing tests
- [ ] Test execution < 5 minutes

## Next Steps

1. **Review and approve this plan**
2. **Install testing dependencies**
3. **Create test structure**
4. **Begin with FileSystemManager tests**
5. **Track progress in todo list**

The investment in testing will pay dividends during Task 4.3 integration work and beyond.