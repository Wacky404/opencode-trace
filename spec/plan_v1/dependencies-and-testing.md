# Dependencies and Testing Strategy

## Package Dependencies Analysis

### Current Dependencies Status

#### Root Package (opencode-trace)
```json
// package.json - Root level dependencies
{
  "devDependencies": {
    "@types/node": "^20.0.0",                    // ✅ Installed
    "@typescript-eslint/eslint-plugin": "^6.0.0", // ✅ Installed  
    "@typescript-eslint/parser": "^6.0.0",       // ✅ Installed
    "eslint": "^8.0.0",                          // ✅ Installed
    "typescript": "^5.0.0",                      // ✅ Installed
    "vitest": "^1.0.0"                           // ✅ Installed
  }
}
```

#### Tracer Package (@opencode-trace/tracer)
```json
// packages/tracer/package.json - Current
{
  "dependencies": {
    "uuid": "^9.0.0"                             // ✅ Installed
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",                     // ✅ Installed
    "tsup": "^8.0.0",                            // ✅ Installed
    "vitest": "^1.0.0"                           // ✅ Installed
  }
}
```

### Required Dependencies for Task 1.2

#### Additional Tracer Package Dependencies
```json
// packages/tracer/package.json - Additions needed
{
  "dependencies": {
    "uuid": "^9.0.0",                            // ✅ Already installed
    "fast-json-stable-stringify": "^2.1.0",     // 🆕 For consistent JSON serialization
    "graceful-fs": "^4.2.11"                    // 🆕 For safer file operations
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",                     // ✅ Already installed
    "tsup": "^8.0.0",                            // ✅ Already installed
    "vitest": "^1.0.0",                          // ✅ Already installed
    "tmp": "^0.2.1",                             // 🆕 For temporary test directories
    "@types/tmp": "^0.2.0",                      // 🆕 Types for tmp
    "@types/graceful-fs": "^4.1.6"               // 🆕 Types for graceful-fs
  }
}
```

#### Viewer Package Dependencies (Future Phase)
```json
// packages/viewer/package.json - Current status
{
  "dependencies": {
    "lit": "^3.0.0",                             // ✅ Installed
    "marked": "^11.0.0",                         // ✅ Installed
    "diff": "^5.0.0"                             // ✅ Installed
  },
  "devDependencies": {
    "@types/diff": "^5.0.0",                     // ✅ Installed
    "autoprefixer": "^10.0.0",                   // ✅ Installed
    "concurrently": "^8.0.0",                    // ✅ Installed
    "postcss": "^8.0.0",                         // ✅ Installed
    "tailwindcss": "^3.0.0",                     // ✅ Installed
    "tsup": "^8.0.0",                            // ✅ Installed
    "vitest": "^1.0.0"                           // ✅ Installed
  }
}
```

## Testing Strategy

### Test Structure Overview
```
tests/
├── unit/                          # Unit tests for individual components
│   ├── tracer/
│   │   ├── logger.test.ts         # JSONLLogger tests
│   │   ├── session.test.ts        # SessionManager tests
│   │   ├── filesystem.test.ts     # FileSystemManager tests
│   │   ├── config.test.ts         # ConfigManager tests
│   │   └── validation.test.ts     # EventValidator tests
│   └── viewer/                    # Future viewer tests
├── integration/                   # Cross-component integration tests
│   ├── jsonl-logger.test.js       # End-to-end JSONL functionality
│   ├── session-lifecycle.test.js  # Complete session workflow
│   └── run-tests.js               # ✅ Exists (basic smoke test)
└── performance/                   # Performance and load tests
    ├── logging-performance.test.js
    └── concurrent-sessions.test.js
```

### Task 1.2 Testing Priorities

#### 1. Unit Tests (Priority: Critical)

**FileSystemManager Tests**
```typescript
// packages/tracer/src/filesystem.test.ts
describe('FileSystemManager', () => {
  test('creates directory structure', async () => {
    const fsManager = new FileSystemManager('./test-trace')
    await fsManager.ensureDirectoryStructure()
    // Verify .test-trace/sessions/ exists
  })
  
  test('handles disk full scenario', async () => {
    // Mock fs operations to simulate ENOSPC error
    // Verify graceful error handling
  })
  
  test('validates disk space before operations', async () => {
    const fsManager = new FileSystemManager('./test-trace')
    const hasSpace = await fsManager.validateDiskSpace(100)
    expect(typeof hasSpace).toBe('boolean')
  })
})
```

**ConfigManager Tests**
```typescript
// packages/tracer/src/config.test.ts  
describe('ConfigManager', () => {
  test('loads default configuration', () => {
    const config = ConfigManager.getDefaultConfig()
    expect(config.outputDir).toBe('.opencode-trace')
    expect(config.maxSessionsRetained).toBeGreaterThan(0)
  })
  
  test('respects environment variables', async () => {
    process.env.OPENCODE_TRACE_DIR = '/custom/path'
    const config = await ConfigManager.loadConfig()
    expect(config.outputDir).toBe('/custom/path')
  })
  
  test('validates configuration values', () => {
    const invalidConfig = { maxSessionsRetained: -1 }
    const config = ConfigManager.validateConfig(invalidConfig)
    expect(config.maxSessionsRetained).toBeGreaterThan(0)
  })
})
```

**EventValidator Tests**
```typescript
// packages/tracer/src/validation.test.ts
describe('EventValidator', () => {
  test('validates session start events', () => {
    const validator = new EventValidator()
    const event: SessionStartEvent = {
      type: 'session_start',
      timestamp: Date.now(),
      session_id: 'test-123',
      user_query: 'test query',
      opencode_version: '0.1.140',
      working_directory: '/test'
    }
    const result = validator.validateEvent(event)
    expect(result.isValid).toBe(true)
  })
  
  test('sanitizes sensitive data', () => {
    const validator = new EventValidator()
    const event = {
      type: 'ai_request',
      headers: { authorization: 'Bearer sk-1234567890abcdef' },
      // ... other fields
    }
    const sanitized = validator.sanitizeEvent(event)
    expect(sanitized.headers.authorization).toBe('Bearer [REDACTED]')
  })
})
```

#### 2. Integration Tests (Priority: High)

**Complete JSONL Logger Workflow**
```javascript
// tests/integration/jsonl-logger.test.js
import { JSONLLogger } from '../../packages/tracer/dist/index.js'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('JSONL Logger Integration', () => {
  let testDir
  let logger
  
  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'opencode-trace-test-'))
    logger = new JSONLLogger(testDir)
  })
  
  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })
  
  test('complete session workflow', async () => {
    // 1. Start session
    const sessionId = await logger.startSession('test query', {
      opencode_version: '0.1.140',
      working_directory: '/test'
    })
    
    // 2. Log various events
    await logger.logEvent({
      type: 'tool_execution',
      timestamp: Date.now(),
      session_id: sessionId,
      tool_name: 'read',
      parameters: { path: 'test.txt' },
      result: { content: 'file content' },
      timing: { start: Date.now(), end: Date.now() + 50, duration: 50 },
      success: true
    })
    
    await logger.logEvent({
      type: 'ai_request',
      timestamp: Date.now(),
      session_id: sessionId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      // ... other fields
    })
    
    // 3. End session
    await logger.endSession(sessionId, {
      total_requests: 2,
      ai_requests: 1,
      file_operations: 1,
      total_cost: 0.023,
      tokens_used: { input: 100, output: 200 }
    })
    
    // 4. Verify output file
    const sessionFiles = await fs.readdir(join(testDir, 'sessions'))
    expect(sessionFiles).toHaveLength(1)
    
    const sessionFile = sessionFiles[0]
    expect(sessionFile).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_session-.+\.jsonl$/)
    
    // 5. Verify JSONL content
    const content = await fs.readFile(join(testDir, 'sessions', sessionFile), 'utf8')
    const lines = content.trim().split('\n')
    expect(lines.length).toBeGreaterThan(2) // At least session_start, events, session_end
    
    // Verify each line is valid JSON
    lines.forEach((line, index) => {
      expect(() => JSON.parse(line)).not.toThrow(`Line ${index + 1} is invalid JSON`)
    })
    
    // Verify first and last events
    const firstEvent = JSON.parse(lines[0])
    const lastEvent = JSON.parse(lines[lines.length - 1])
    
    expect(firstEvent.type).toBe('session_start')
    expect(firstEvent.session_id).toBe(sessionId)
    expect(lastEvent.type).toBe('session_end')
    expect(lastEvent.session_id).toBe(sessionId)
  })
  
  test('concurrent sessions', async () => {
    // Test multiple sessions running simultaneously
    const promises = Array.from({ length: 5 }, async (_, i) => {
      const sessionId = await logger.startSession(`query ${i}`)
      await logger.logEvent({
        type: 'test_event',
        timestamp: Date.now(),
        session_id: sessionId,
        data: { index: i }
      })
      await logger.endSession(sessionId)
      return sessionId
    })
    
    const sessionIds = await Promise.all(promises)
    expect(sessionIds).toHaveLength(5)
    expect(new Set(sessionIds).size).toBe(5) // All unique
  })
})
```

#### 3. Performance Tests (Priority: Medium)

**Logging Performance**
```javascript
// tests/performance/logging-performance.test.js
describe('Logging Performance', () => {
  test('handles high-volume event logging', async () => {
    const logger = new JSONLLogger('./perf-test')
    const sessionId = await logger.startSession('performance test')
    
    const startTime = Date.now()
    const eventCount = 1000
    
    // Log 1000 events
    const promises = Array.from({ length: eventCount }, async (_, i) => {
      await logger.logEvent({
        type: 'test_event',
        timestamp: Date.now(),
        session_id: sessionId,
        data: { index: i, payload: 'x'.repeat(100) } // 100 char payload
      })
    })
    
    await Promise.all(promises)
    await logger.endSession(sessionId)
    
    const duration = Date.now() - startTime
    const eventsPerSecond = (eventCount / duration) * 1000
    
    console.log(`Performance: ${eventsPerSecond.toFixed(2)} events/second`)
    expect(eventsPerSecond).toBeGreaterThan(100) // At least 100 events/second
  })
  
  test('memory usage stays reasonable', async () => {
    const initialMemory = process.memoryUsage().heapUsed
    
    const logger = new JSONLLogger('./memory-test')
    const sessionId = await logger.startSession('memory test')
    
    // Log many events
    for (let i = 0; i < 500; i++) {
      await logger.logEvent({
        type: 'test_event',
        timestamp: Date.now(),
        session_id: sessionId,
        data: { index: i }
      })
    }
    
    await logger.endSession(sessionId)
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024 // MB
    
    console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`)
    expect(memoryIncrease).toBeLessThan(50) // Less than 50MB increase
  })
})
```

### Testing Commands

```json
// package.json scripts for comprehensive testing
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:performance",
    "test:unit": "cd packages/tracer && npm test",
    "test:integration": "vitest tests/integration",
    "test:performance": "vitest tests/performance",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}
```

## Quality Assurance Checklist

### Before Implementation
- [ ] All required dependencies are identified and documented
- [ ] Test structure is planned and created
- [ ] Performance benchmarks are defined
- [ ] Error scenarios are identified and planned

### During Development
- [ ] Write tests before implementing features (TDD approach)
- [ ] Run tests frequently during development
- [ ] Ensure code coverage meets minimum thresholds (>80%)
- [ ] Performance tests pass defined benchmarks

### Before Task Completion
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Performance tests meet requirements
- [ ] Error handling tests pass
- [ ] Code coverage requirements met
- [ ] Manual testing scenarios completed

### Success Metrics for Task 1.2

**Functional Success Criteria:**
1. ✅ JSONL files are created correctly with proper naming convention
2. ✅ All events are serialized as valid JSON with required fields
3. ✅ Session lifecycle (start → events → end) works correctly
4. ✅ Concurrent sessions are handled without conflicts
5. ✅ Configuration system works with environment variables and files
6. ✅ Error handling prevents data loss and corruption

**Performance Success Criteria:**
1. ✅ Event logging latency < 5ms average
2. ✅ Memory usage < 50MB for typical session (100-500 events)
3. ✅ Supports concurrent sessions (tested up to 10 simultaneous)
4. ✅ No blocking operations in main thread
5. ✅ File I/O operations are properly batched and optimized

**Quality Success Criteria:**
1. ✅ Code coverage > 80% for all new components
2. ✅ All error scenarios have corresponding tests
3. ✅ Performance benchmarks are established and met
4. ✅ Documentation is complete and accurate
5. ✅ Integration tests cover end-to-end workflows

This testing strategy ensures robust, performant, and reliable implementation of the JSONL Logger Core functionality.