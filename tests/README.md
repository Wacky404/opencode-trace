# opencode-trace Testing Guide

## Overview

This guide provides practical examples and patterns for implementing tests across the opencode-trace project.

## Test Structure

```
tests/
├── unit/                    # Unit tests (70% of coverage)
│   ├── tracer/             # Core tracer components
│   ├── viewer/             # UI components
│   └── processors/         # Data processors
├── integration/            # Integration tests (20% of coverage)
│   ├── phase1/            # Phase 1 features
│   ├── phase2/            # Phase 2 features
│   └── components/        # Component integration
├── e2e/                   # End-to-end tests (10% of coverage)
│   ├── workflows/         # Complete user workflows
│   └── scenarios/         # Specific scenarios
├── performance/           # Performance benchmarks
├── security/             # Security tests
├── fixtures/             # Test data and utilities
└── helpers/              # Test helper functions
```

## Unit Test Examples

### 1. Testing Core Components

```typescript
// tests/unit/tracer/filesystem.test.ts
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { FileSystemManager } from '@/packages/tracer/src/filesystem'

// Mock fs module
vi.mock('fs/promises')

describe('FileSystemManager', () => {
  let fsManager: FileSystemManager
  let testDir: string

  beforeEach(() => {
    testDir = '/tmp/test-trace'
    fsManager = new FileSystemManager(testDir)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('ensureDirectoryStructure', () => {
    test('creates directory structure when it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'))
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)

      const result = await fsManager.ensureDirectoryStructure()

      expect(result.success).toBe(true)
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(testDir, 'sessions'),
        { recursive: true }
      )
    })

    test('handles permission errors gracefully', async () => {
      const error = new Error('EACCES: Permission denied')
      vi.mocked(fs.access).mockRejectedValue(error)

      const result = await fsManager.ensureDirectoryStructure()

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Permission denied')
    })

    test('validates disk space before creating directories', async () => {
      vi.mocked(fs.statfs).mockResolvedValue({
        bavail: 1000,
        bsize: 4096,
        // ... other statfs properties
      } as any)

      const result = await fsManager.ensureDirectoryStructure()

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Insufficient disk space')
    })
  })

  describe('writeFile', () => {
    test('writes file atomically with temp file', async () => {
      const content = 'test content'
      const fileName = 'test.jsonl'

      vi.mocked(fs.writeFile).mockResolvedValue()
      vi.mocked(fs.rename).mockResolvedValue()

      const result = await fsManager.writeFile(fileName, content)

      expect(result.success).toBe(true)
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        content,
        'utf8'
      )
      expect(fs.rename).toHaveBeenCalled()
    })

    test('cleans up temp file on write failure', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'))
      vi.mocked(fs.unlink).mockResolvedValue()

      const result = await fsManager.writeFile('test.jsonl', 'content')

      expect(result.success).toBe(false)
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'))
    })
  })

  describe('cleanupOldSessions', () => {
    test('removes sessions older than retention period', async () => {
      const oldSession = {
        name: 'old-session.jsonl',
        isFile: () => true,
        birthtime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days old
      }
      const newSession = {
        name: 'new-session.jsonl',
        isFile: () => true,
        birthtime: new Date() // Today
      }

      vi.mocked(fs.readdir).mockResolvedValue([oldSession, newSession] as any)
      vi.mocked(fs.unlink).mockResolvedValue()

      await fsManager.cleanupOldSessions(7) // 7 day retention

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-session.jsonl')
      )
      expect(fs.unlink).not.toHaveBeenCalledWith(
        expect.stringContaining('new-session.jsonl')
      )
    })
  })
})
```

### 2. Testing Event Validation

```typescript
// tests/unit/tracer/validator.test.ts
import { describe, test, expect } from 'vitest'
import { EventValidator } from '@/packages/tracer/src/validation'
import type { TraceEvent } from '@/packages/tracer/src/types'

describe('EventValidator', () => {
  let validator: EventValidator

  beforeEach(() => {
    validator = new EventValidator({
      sanitizationPatterns: [
        /api[_-]?key/i,
        /password/i,
        /token/i,
        /secret/i
      ]
    })
  })

  describe('validateEvent', () => {
    test('validates required fields', () => {
      const invalidEvent = {
        type: 'http_request',
        // Missing required fields
      } as any

      const result = validator.validateEvent(invalidEvent)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Missing required field')
    })

    test('validates event type enum', () => {
      const event: TraceEvent = {
        type: 'invalid_type' as any,
        timestamp: Date.now(),
        session_id: 'test-123'
      }

      const result = validator.validateEvent(event)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Invalid event type')
    })

    test('validates nested structures', () => {
      const event = {
        type: 'http_request',
        timestamp: Date.now(),
        session_id: 'test-123',
        request: {
          method: 'INVALID_METHOD', // Should be GET, POST, etc.
          url: 'not-a-url'          // Should be valid URL
        }
      }

      const result = validator.validateEvent(event)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Invalid request')
    })
  })

  describe('sanitizeEvent', () => {
    test('sanitizes sensitive headers', () => {
      const event = {
        type: 'http_request',
        headers: {
          'Authorization': 'Bearer sk-1234567890',
          'X-API-Key': 'secret-key-123',
          'Content-Type': 'application/json'
        }
      }

      const sanitized = validator.sanitizeEvent(event)

      expect(sanitized.headers['Authorization']).toBe('[REDACTED]')
      expect(sanitized.headers['X-API-Key']).toBe('[REDACTED]')
      expect(sanitized.headers['Content-Type']).toBe('application/json')
    })

    test('sanitizes nested sensitive data', () => {
      const event = {
        type: 'ai_request',
        request_body: {
          api_key: 'sk-123',
          messages: [
            { 
              role: 'user', 
              content: 'My password is secret123' 
            }
          ]
        }
      }

      const sanitized = validator.sanitizeEvent(event)

      expect(sanitized.request_body.api_key).toBe('[REDACTED]')
      expect(sanitized.request_body.messages[0].content).toContain('[REDACTED]')
    })

    test('preserves non-sensitive data', () => {
      const event = {
        type: 'tool_execution',
        tool_name: 'bash',
        command: 'ls -la',
        output: 'file1.txt file2.txt'
      }

      const sanitized = validator.sanitizeEvent(event)

      expect(sanitized).toEqual(event)
    })
  })

  describe('performance', () => {
    test('validates 1000 events in under 100ms', () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        type: 'http_request',
        timestamp: Date.now(),
        session_id: `session-${i}`,
        method: 'GET',
        url: `https://api.example.com/endpoint/${i}`
      }))

      const start = performance.now()
      
      for (const event of events) {
        validator.validateEvent(event)
      }
      
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })
  })
})
```

### 3. Testing Lit Components

```typescript
// tests/unit/viewer/session-timeline.test.ts
import { describe, test, expect, beforeEach } from 'vitest'
import { fixture, html, expect as litExpect } from '@open-wc/testing'
import { SessionTimeline } from '@/packages/viewer/src/components/session/session-timeline'
import type { ProcessedSession } from '@/packages/viewer/src/types'

// Register custom element
customElements.define('session-timeline', SessionTimeline)

describe('SessionTimeline Component', () => {
  let element: SessionTimeline
  let testSession: ProcessedSession

  beforeEach(async () => {
    testSession = {
      id: 'test-123',
      events: [
        {
          type: 'session_start',
          timestamp: Date.now() - 10000,
          session_id: 'test-123'
        },
        {
          type: 'http_request',
          timestamp: Date.now() - 5000,
          session_id: 'test-123',
          method: 'GET',
          url: 'https://api.example.com'
        },
        {
          type: 'session_end',
          timestamp: Date.now(),
          session_id: 'test-123'
        }
      ],
      metadata: {
        duration: 10000,
        total_requests: 1
      }
    }

    element = await fixture(html`
      <session-timeline .sessionData=${testSession}></session-timeline>
    `)
  })

  test('renders timeline with all events', () => {
    const events = element.shadowRoot!.querySelectorAll('.timeline-event')
    
    expect(events.length).toBe(3)
    expect(events[0]).toHaveClass('event-session-start')
    expect(events[1]).toHaveClass('event-http-request')
    expect(events[2]).toHaveClass('event-session-end')
  })

  test('displays event timestamps correctly', () => {
    const timestamps = element.shadowRoot!.querySelectorAll('.event-timestamp')
    
    expect(timestamps.length).toBe(3)
    expect(timestamps[0].textContent).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  test('handles zoom interactions', async () => {
    const zoomInBtn = element.shadowRoot!.querySelector('.zoom-in')
    const zoomOutBtn = element.shadowRoot!.querySelector('.zoom-out')
    
    // Initial scale
    expect(element.zoomLevel).toBe(1)
    
    // Zoom in
    zoomInBtn!.dispatchEvent(new Event('click'))
    await element.updateComplete
    expect(element.zoomLevel).toBe(1.2)
    
    // Zoom out
    zoomOutBtn!.dispatchEvent(new Event('click'))
    await element.updateComplete
    expect(element.zoomLevel).toBe(1)
  })

  test('filters events by type', async () => {
    // Apply filter
    element.filterEventTypes = ['http_request']
    await element.updateComplete
    
    const visibleEvents = element.shadowRoot!.querySelectorAll('.timeline-event:not(.hidden)')
    
    expect(visibleEvents.length).toBe(1)
    expect(visibleEvents[0]).toHaveClass('event-http-request')
  })

  test('handles event selection', async () => {
    const httpEvent = element.shadowRoot!.querySelector('.event-http-request')
    
    httpEvent!.dispatchEvent(new Event('click'))
    await element.updateComplete
    
    expect(element.selectedEvent).toBeDefined()
    expect(element.selectedEvent?.type).toBe('http_request')
    
    // Check event detail panel appears
    const detailPanel = element.shadowRoot!.querySelector('.event-detail-panel')
    expect(detailPanel).toBeTruthy()
  })

  test('performance with large sessions', async () => {
    // Create session with 1000 events
    const largeSession = {
      id: 'large-session',
      events: Array.from({ length: 1000 }, (_, i) => ({
        type: 'http_request',
        timestamp: Date.now() - (1000 - i) * 100,
        session_id: 'large-session',
        method: 'GET',
        url: `https://api.example.com/endpoint/${i}`
      })),
      metadata: {
        duration: 100000,
        total_requests: 1000
      }
    }

    const start = performance.now()
    
    element.sessionData = largeSession
    await element.updateComplete
    
    const renderTime = performance.now() - start
    
    expect(renderTime).toBeLessThan(100) // Should render in under 100ms
    
    // Check virtual scrolling is active
    const viewport = element.shadowRoot!.querySelector('.timeline-viewport')
    const visibleEvents = viewport!.querySelectorAll('.timeline-event')
    
    expect(visibleEvents.length).toBeLessThan(100) // Should only render visible events
  })
})
```

### 4. Testing Data Processors

```typescript
// tests/unit/processors/metrics-calculator.test.ts
import { describe, test, expect } from 'vitest'
import { MetricsCalculator } from '@/packages/viewer/src/processors/metrics-calculator'
import type { TraceEvent } from '@/packages/viewer/src/types'

describe('MetricsCalculator', () => {
  let calculator: MetricsCalculator

  beforeEach(() => {
    calculator = new MetricsCalculator()
  })

  describe('calculateSessionMetrics', () => {
    test('calculates basic session metrics', () => {
      const events: TraceEvent[] = [
        {
          type: 'session_start',
          timestamp: 1000,
          session_id: 'test'
        },
        {
          type: 'http_request',
          timestamp: 2000,
          session_id: 'test',
          timing: { duration: 500 }
        },
        {
          type: 'http_request',
          timestamp: 3000,
          session_id: 'test',
          timing: { duration: 300 },
          error: 'Timeout'
        },
        {
          type: 'session_end',
          timestamp: 4000,
          session_id: 'test'
        }
      ]

      const metrics = calculator.calculateSessionMetrics(events)

      expect(metrics).toEqual({
        duration: 3000,
        totalRequests: 2,
        failedRequests: 1,
        successRate: 0.5,
        avgResponseTime: 400,
        p95ResponseTime: 500,
        p99ResponseTime: 500
      })
    })

    test('calculates AI cost metrics', () => {
      const events: TraceEvent[] = [
        {
          type: 'ai_request',
          timestamp: 1000,
          session_id: 'test',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 500,
            total_tokens: 1500
          },
          cost: {
            input: 0.003,
            output: 0.015,
            total: 0.018
          }
        },
        {
          type: 'ai_request',
          timestamp: 2000,
          session_id: 'test',
          provider: 'openai',
          model: 'gpt-4',
          usage: {
            prompt_tokens: 500,
            completion_tokens: 300,
            total_tokens: 800
          },
          cost: {
            input: 0.01,
            output: 0.03,
            total: 0.04
          }
        }
      ]

      const metrics = calculator.calculateAICosts(events)

      expect(metrics).toEqual({
        totalCost: 0.058,
        byProvider: {
          anthropic: {
            cost: 0.018,
            tokens: 1500,
            requests: 1
          },
          openai: {
            cost: 0.04,
            tokens: 800,
            requests: 1
          }
        },
        byModel: {
          'claude-3-5-sonnet': {
            cost: 0.018,
            tokens: 1500,
            requests: 1
          },
          'gpt-4': {
            cost: 0.04,
            tokens: 800,
            requests: 1
          }
        },
        totalTokens: 2300,
        totalRequests: 2
      })
    })
  })

  describe('performance analysis', () => {
    test('identifies performance bottlenecks', () => {
      const events = [
        {
          type: 'http_request',
          timestamp: 1000,
          url: '/api/slow',
          timing: { duration: 5000 } // 5 second request
        },
        {
          type: 'http_request',
          timestamp: 2000,
          url: '/api/fast',
          timing: { duration: 100 }
        }
      ]

      const bottlenecks = calculator.findBottlenecks(events)

      expect(bottlenecks).toHaveLength(1)
      expect(bottlenecks[0]).toMatchObject({
        event: expect.objectContaining({ url: '/api/slow' }),
        severity: 'high',
        recommendation: expect.stringContaining('optimize')
      })
    })
  })
})
```

## E2E Test Examples

```typescript
// tests/e2e/workflows/complete-session.test.ts
import { test, expect } from '@playwright/test'
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import * as path from 'path'

test.describe('Complete opencode Session', () => {
  let sessionDir: string

  test.beforeAll(async () => {
    sessionDir = path.join(process.cwd(), '.opencode-trace-test')
    await fs.mkdir(sessionDir, { recursive: true })
  })

  test.afterAll(async () => {
    await fs.rm(sessionDir, { recursive: true, force: true })
  })

  test('captures and displays React app creation', async ({ page }) => {
    // 1. Start opencode with tracing enabled
    const opencodeProcess = spawn('opencode', ['create a React app'], {
      env: {
        ...process.env,
        OPENCODE_TRACE: 'true',
        OPENCODE_TRACE_DIR: sessionDir
      },
      cwd: process.cwd()
    })

    // 2. Wait for session to complete
    await new Promise((resolve) => {
      opencodeProcess.on('exit', resolve)
    })

    // 3. Verify JSONL file was created
    const sessionFiles = await fs.readdir(path.join(sessionDir, 'sessions'))
    const jsonlFile = sessionFiles.find(f => f.endsWith('.jsonl'))
    
    expect(jsonlFile).toBeTruthy()

    // 4. Verify HTML file was generated
    const htmlFile = sessionFiles.find(f => f.endsWith('.html'))
    
    expect(htmlFile).toBeTruthy()

    // 5. Load HTML file in browser
    const htmlPath = path.join(sessionDir, 'sessions', htmlFile!)
    await page.goto(`file://${htmlPath}`)

    // 6. Verify timeline is rendered
    await expect(page.locator('.session-timeline')).toBeVisible()

    // 7. Verify AI requests are captured
    const aiRequests = page.locator('.timeline-event.ai-request')
    await expect(aiRequests).toHaveCount(expect.any(Number))

    // 8. Test interactive features
    // Click on first AI request
    await aiRequests.first().click()
    
    // Verify details panel opens
    await expect(page.locator('.request-detail-panel')).toBeVisible()
    
    // Verify request/response data is shown
    await expect(page.locator('.request-body')).toContainText('messages')
    await expect(page.locator('.response-body')).toContainText('content')

    // 9. Test search functionality
    await page.fill('.search-input', 'React')
    await expect(page.locator('.timeline-event:visible')).toHaveCount(
      await page.locator('.timeline-event:has-text("React")').count()
    )

    // 10. Test export functionality
    await page.click('.export-button')
    await page.click('.export-json')
    
    // Verify download started
    const download = await page.waitForEvent('download')
    expect(download.suggestedFilename()).toContain('.json')
  })

  test('handles large sessions efficiently', async ({ page }) => {
    // Create a large test session
    const largeSession = {
      events: Array.from({ length: 10000 }, (_, i) => ({
        type: 'http_request',
        timestamp: Date.now() + i * 100,
        session_id: 'large-test',
        url: `https://api.example.com/endpoint/${i}`
      }))
    }

    // Save as JSONL
    const jsonlPath = path.join(sessionDir, 'sessions', 'large-session.jsonl')
    await fs.writeFile(
      jsonlPath,
      largeSession.events.map(e => JSON.stringify(e)).join('\n')
    )

    // Generate HTML
    const { HTMLGenerator } = await import('@/packages/viewer/src/generators/html-generator')
    const generator = new HTMLGenerator()
    
    const startTime = performance.now()
    const html = await generator.generateHTML({
      sessionData: largeSession,
      template: 'default'
    })
    const generationTime = performance.now() - startTime

    // Performance assertion
    expect(generationTime).toBeLessThan(5000) // Should generate in under 5 seconds

    // Save HTML
    const htmlPath = path.join(sessionDir, 'sessions', 'large-session.html')
    await fs.writeFile(htmlPath, html)

    // Load in browser
    await page.goto(`file://${htmlPath}`)

    // Measure render performance
    const renderStart = await page.evaluate(() => performance.now())
    await expect(page.locator('.session-timeline')).toBeVisible()
    const renderTime = await page.evaluate((start) => performance.now() - start, renderStart)

    expect(renderTime).toBeLessThan(1000) // Should render in under 1 second

    // Verify virtual scrolling is working
    const visibleEvents = await page.locator('.timeline-event:visible').count()
    expect(visibleEvents).toBeLessThan(100) // Should virtualize rendering
  })
})
```

## Performance Benchmark Examples

```typescript
// tests/performance/benchmarks.test.ts
import { bench, describe } from 'vitest'
import { JSONLLogger } from '@/packages/tracer/src/logger'
import { HTMLGenerator } from '@/packages/viewer/src/generators/html-generator'

describe('Performance Benchmarks', () => {
  bench('JSONL logging throughput', async () => {
    const logger = new JSONLLogger('/tmp/bench')
    const event = {
      type: 'http_request',
      timestamp: Date.now(),
      session_id: 'bench-test',
      method: 'GET',
      url: 'https://api.example.com'
    }

    // Log 1000 events
    for (let i = 0; i < 1000; i++) {
      await logger.logEvent({ ...event, url: `${event.url}/${i}` })
    }
  }, {
    iterations: 10,
    time: 1000, // Run for 1 second
    warmupIterations: 2,
    warmupTime: 100
  })

  bench('HTML generation for large sessions', async () => {
    const generator = new HTMLGenerator()
    const sessionData = {
      id: 'bench-session',
      events: Array.from({ length: 1000 }, (_, i) => ({
        type: 'http_request',
        timestamp: Date.now() + i * 100,
        session_id: 'bench-session',
        url: `https://api.example.com/${i}`
      }))
    }

    await generator.generateHTML({
      sessionData,
      template: 'default',
      options: { compress: true }
    })
  }, {
    iterations: 5,
    time: 2000
  })

  bench('Event correlation performance', async () => {
    const { EventCorrelator } = await import('@/packages/viewer/src/processors/event-correlator')
    const correlator = new EventCorrelator()
    
    const events = Array.from({ length: 5000 }, (_, i) => ({
      type: i % 3 === 0 ? 'ai_request' : 'http_request',
      timestamp: Date.now() + i * 10,
      session_id: 'correlation-test',
      correlation_id: i % 10 === 0 ? `group-${Math.floor(i / 10)}` : undefined
    }))

    correlator.correlateEvents(events)
  })
})
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- tests/unit/tracer/filesystem.test.ts

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui
```

## Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      enabled: true,
      reporter: ['text', 'lcov', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    },
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
    }
  }
})
```

## Best Practices

1. **Test Naming**: Use descriptive test names that explain what is being tested
2. **Test Isolation**: Each test should be independent and not rely on other tests
3. **Mock External Dependencies**: Use vi.mock() for file system, network, etc.
4. **Test Data**: Use fixtures and factories for consistent test data
5. **Performance**: Keep unit tests fast (< 50ms per test)
6. **Coverage**: Aim for 85%+ coverage but focus on critical paths
7. **Assertions**: Use specific assertions that clearly indicate what failed
8. **Error Cases**: Always test error scenarios and edge cases