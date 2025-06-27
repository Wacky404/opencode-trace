# Testing Setup Guide for opencode-trace

## Required Testing Dependencies

### 1. Unit Testing Dependencies

```bash
# Core testing framework (already installed)
npm install -D vitest @vitest/ui @vitest/coverage-v8

# Mocking utilities
npm install -D @vitest/spy

# Test utilities
npm install -D @testing-library/dom @testing-library/user-event
```

### 2. Component Testing Dependencies (for Lit components)

```bash
# Web component testing
npm install -D @open-wc/testing @open-wc/testing-helpers

# DOM testing utilities
npm install -D @testing-library/web-components happy-dom

# Component test setup
npm install -D @web/test-runner @web/test-runner-playwright
```

### 3. E2E Testing Dependencies

```bash
# Playwright for E2E tests
npm install -D @playwright/test playwright

# Process management
npm install -D execa wait-on
```

### 4. Performance Testing Dependencies

```bash
# Benchmarking
npm install -D tinybench

# Memory profiling
npm install -D memlab
```

### 5. Coverage and Reporting

```bash
# Coverage reporting
npm install -D c8 nyc

# Test reporters
npm install -D @vitest/reporter-junit vitest-sonar-reporter
```

### 6. Additional Test Utilities

```bash
# Fixtures and factories
npm install -D @faker-js/faker factory.ts

# Snapshot testing
npm install -D vitest-snapshot-serializer-raw

# API mocking
npm install -D msw nock
```

## Installation Commands

### For Root Package

```bash
cd /Users/cole/Documents/GitHub/opencode-trace
npm install -D @vitest/ui @vitest/coverage-v8 @playwright/test playwright execa wait-on c8 @faker-js/faker
```

### For Tracer Package

```bash
cd packages/tracer
npm install -D @vitest/spy msw nock memlab tinybench
```

### For Viewer Package

```bash
cd packages/viewer
npm install -D @open-wc/testing @testing-library/dom @testing-library/user-event happy-dom @web/test-runner @web/test-runner-playwright
```

## Test Configuration Files

### 1. Vitest Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'build'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        '**/index.ts'
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      },
      clean: true,
      all: true
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default', 'junit', 'json'],
    outputFile: {
      junit: './test-results/junit.xml',
      json: './test-results/results.json'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@tracer': path.resolve(__dirname, './packages/tracer/src'),
      '@viewer': path.resolve(__dirname, './packages/viewer/src')
    }
  }
})
```

### 2. Viewer Component Testing (packages/viewer/vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test-setup.ts'],
    transformMode: {
      web: [/\.[jt]sx?$/]
    },
    deps: {
      inline: [/lit/]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### 3. Playwright Configuration (playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
})
```

### 4. Test Setup File (tests/setup.ts)

```typescript
import { beforeAll, afterAll, afterEach } from 'vitest'
import { cleanup } from '@testing-library/dom'
import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

// Extend Vitest matchers
expect.extend(matchers)

// Global test setup
beforeAll(() => {
  // Set up test environment
  process.env.NODE_ENV = 'test'
  process.env.OPENCODE_TRACE_DIR = '/tmp/test-trace'
})

// Clean up after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Global teardown
afterAll(() => {
  vi.restoreAllMocks()
})

// Mock global objects if needed
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))
```

## NPM Scripts Update

Add these scripts to the root package.json:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:unit": "vitest run --coverage tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:components": "cd packages/viewer && npm run test:components",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:coverage:ui": "vitest --ui --coverage",
    "test:benchmark": "vitest bench",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "coverage:report": "c8 report --reporter=text-lcov > coverage/lcov.info",
    "pretest": "npm run lint",
    "posttest": "npm run coverage:report"
  }
}
```

## GitHub Actions CI Update

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18.x, 20.x]
        
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run linting
      run: npm run lint
      
    - name: Run unit tests
      run: npm run test:unit
      
    - name: Run integration tests
      run: npm run test:integration
      
    - name: Install Playwright browsers
      run: npx playwright install --with-deps
      
    - name: Run E2E tests
      run: npm run test:e2e
      
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
        
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results-${{ matrix.os }}-${{ matrix.node-version }}
        path: |
          test-results/
          playwright-report/
          coverage/
```

## Quick Start

1. Install all dependencies:
   ```bash
   npm run install:test-deps
   ```

2. Run tests:
   ```bash
   npm test              # Run all tests
   npm run test:ui       # Run with UI
   npm run test:coverage # Run with coverage
   ```

3. View coverage:
   ```bash
   open coverage/index.html
   ```

4. Run specific test types:
   ```bash
   npm run test:unit
   npm run test:integration
   npm run test:e2e
   npm run test:benchmark
   ```