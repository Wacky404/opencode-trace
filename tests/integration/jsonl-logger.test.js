import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { JSONLLogger } from '../../packages/tracer/dist/index.js';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';

describe('JSONL Logger Integration Tests', () => {
  let testDir;
  let logger;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'opencode-trace-test-'));
    logger = new JSONLLogger(testDir);
    
    // Wait a bit for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (logger) {
      await logger.shutdown();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  test('complete session workflow', async () => {
    // 1. Start session
    const sessionResult = await logger.startSession('test query', {
      opencode_version: '0.1.140',
      working_directory: '/test/dir'
    });

    expect(sessionResult.success).toBe(true);
    expect(sessionResult.data).toBeDefined();
    const sessionId = sessionResult.data;

    // 2. Log various events
    const toolEvent = {
      type: 'tool_execution',
      timestamp: Date.now(),
      session_id: sessionId,
      tool_name: 'read',
      parameters: { path: 'test.txt' },
      result: { content: 'file content' },
      timing: { start: Date.now(), end: Date.now() + 50, duration: 50 },
      success: true
    };

    const logResult1 = await logger.logEvent(toolEvent);
    expect(logResult1.success).toBe(true);

    const aiEvent = {
      type: 'ai_request',
      timestamp: Date.now(),
      session_id: sessionId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'test message' }],
      url: 'https://api.anthropic.com/v1/messages'
    };

    const logResult2 = await logger.logEvent(aiEvent);
    expect(logResult2.success).toBe(true);

    // 3. End session
    const endResult = await logger.endSession(sessionId, {
      total_requests: 3,
      ai_requests: 1,
      file_operations: 1,
      total_cost: 0.023,
      tokens_used: { input: 100, output: 200 }
    });

    expect(endResult.success).toBe(true);
    expect(endResult.data).toBeDefined();
    expect(endResult.data.total_requests).toBe(3);

    // 4. Verify output file exists
    const sessionFiles = await fs.readdir(join(testDir, 'sessions'));
    expect(sessionFiles).toHaveLength(1);

    const sessionFile = sessionFiles[0];
    expect(sessionFile).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_session-.+\.jsonl$/);

    // 5. Verify JSONL content
    const content = await fs.readFile(join(testDir, 'sessions', sessionFile), 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    expect(lines.length).toBeGreaterThanOrEqual(3); // At least session_start, tool_execution, ai_request, session_end

    // Verify each line is valid JSON
    lines.forEach((line, index) => {
      expect(() => JSON.parse(line)).not.toThrow(`Line ${index + 1} is invalid JSON`);
    });

    // Verify first and last events
    const firstEvent = JSON.parse(lines[0]);
    const lastEvent = JSON.parse(lines[lines.length - 1]);

    expect(firstEvent.type).toBe('session_start');
    expect(firstEvent.session_id).toBe(sessionId);
    expect(firstEvent.user_query).toBe('test query');
    expect(firstEvent.opencode_version).toBe('0.1.140');

    expect(lastEvent.type).toBe('session_end');
    expect(lastEvent.session_id).toBe(sessionId);
    expect(lastEvent.summary).toBeDefined();
    expect(lastEvent.summary.total_requests).toBe(3);
  }, 10000);

  test('concurrent sessions handling', async () => {
    // Start multiple sessions concurrently
    const sessionPromises = Array.from({ length: 3 }, async (_, i) => {
      const sessionResult = await logger.startSession(`query ${i}`, {
        opencode_version: '0.1.140',
        working_directory: `/test/dir${i}`
      });
      
      expect(sessionResult.success).toBe(true);
      const sessionId = sessionResult.data;

      // Log some events
      await logger.logEvent({
        type: 'tool_execution',
        timestamp: Date.now(),
        session_id: sessionId,
        tool_name: 'test',
        parameters: { index: i },
        result: { success: true },
        timing: { duration: 10 },
        success: true
      });

      // End session
      const endResult = await logger.endSession(sessionId, {
        total_requests: 1,
        ai_requests: 0,
        file_operations: 1,
        total_cost: 0,
        tokens_used: { input: 0, output: 0 }
      });

      expect(endResult.success).toBe(true);
      return sessionId;
    });

    const sessionIds = await Promise.all(sessionPromises);
    expect(sessionIds).toHaveLength(3);
    expect(new Set(sessionIds).size).toBe(3); // All unique

    // Verify all session files were created
    const sessionFiles = await fs.readdir(join(testDir, 'sessions'));
    expect(sessionFiles).toHaveLength(3);
  }, 15000);

  test('event validation and sanitization', async () => {
    const sessionResult = await logger.startSession('validation test', {
      opencode_version: '0.1.140',
      working_directory: '/test'
    });

    const sessionId = sessionResult.data;

    // Test event with sensitive data
    const sensitiveEvent = {
      type: 'ai_request',
      timestamp: Date.now(),
      session_id: sessionId,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'test message' }],
      headers: {
        'authorization': 'Bearer sk-ant-1234567890abcdef',
        'x-api-key': 'secret-key-12345',
        'content-type': 'application/json'
      }
    };

    const logResult = await logger.logEvent(sensitiveEvent);
    expect(logResult.success).toBe(true);

    await logger.endSession(sessionId);

    // Read the file and verify sanitization
    const sessionFiles = await fs.readdir(join(testDir, 'sessions'));
    const content = await fs.readFile(join(testDir, 'sessions', sessionFiles[0]), 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    // Find the AI request event
    const aiRequestLine = lines.find(line => {
      const event = JSON.parse(line);
      return event.type === 'ai_request';
    });

    expect(aiRequestLine).toBeDefined();
    const aiRequestEvent = JSON.parse(aiRequestLine);
    
    // Verify sensitive headers are redacted
    expect(aiRequestEvent.headers.authorization).toBe('[REDACTED]');
    expect(aiRequestEvent.headers['x-api-key']).toBe('[REDACTED]');
    expect(aiRequestEvent.headers['content-type']).toBe('application/json'); // Non-sensitive should remain
  }, 10000);

  test('error handling and recovery', async () => {
    const sessionResult = await logger.startSession('error test', {
      opencode_version: '0.1.140',
      working_directory: '/test'
    });

    const sessionId = sessionResult.data;

    // Test invalid event (missing required fields)
    const invalidEvent = {
      type: 'invalid_event',
      // Missing timestamp and session_id
    };

    const logResult = await logger.logEvent(invalidEvent);
    expect(logResult.success).toBe(false);
    expect(logResult.error).toBeDefined();

    // Test valid event after error
    const validEvent = {
      type: 'tool_execution',
      timestamp: Date.now(),
      session_id: sessionId,
      tool_name: 'test',
      parameters: {},
      result: { success: true },
      timing: { duration: 5 },
      success: true
    };

    const validLogResult = await logger.logEvent(validEvent);
    expect(validLogResult.success).toBe(true);

    await logger.endSession(sessionId);

    // Verify the valid event was logged despite the previous error
    const sessionFiles = await fs.readdir(join(testDir, 'sessions'));
    const content = await fs.readFile(join(testDir, 'sessions', sessionFiles[0]), 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const toolEventLine = lines.find(line => {
      const event = JSON.parse(line);
      return event.type === 'tool_execution';
    });

    expect(toolEventLine).toBeDefined();
  }, 10000);

  test('batch event logging', async () => {
    const sessionResult = await logger.startSession('batch test', {
      opencode_version: '0.1.140',
      working_directory: '/test'
    });

    const sessionId = sessionResult.data;

    // Create multiple events
    const events = Array.from({ length: 5 }, (_, i) => ({
      type: 'tool_execution',
      timestamp: Date.now() + i,
      session_id: sessionId,
      tool_name: `tool_${i}`,
      parameters: { index: i },
      result: { data: `result_${i}` },
      timing: { duration: 10 + i },
      success: true
    }));

    const batchResult = await logger.logBatch(events);
    expect(batchResult.success).toBe(true);
    expect(batchResult.totalEvents).toBe(5);
    expect(batchResult.successfulEvents).toBe(5);
    expect(batchResult.failedEvents).toBe(0);

    await logger.endSession(sessionId);

    // Verify all events were logged
    const sessionFiles = await fs.readdir(join(testDir, 'sessions'));
    const content = await fs.readFile(join(testDir, 'sessions', sessionFiles[0]), 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const toolEvents = lines.filter(line => {
      const event = JSON.parse(line);
      return event.type === 'tool_execution';
    });

    expect(toolEvents).toHaveLength(5);
  }, 10000);

  test('configuration and environment variables', async () => {
    // Test with custom configuration
    const customLogger = new JSONLLogger(testDir);
    
    await customLogger.updateConfig({
      batchSize: 2,
      flushIntervalMs: 500
    });

    const sessionResult = await customLogger.startSession('config test', {
      opencode_version: '0.1.140',
      working_directory: '/test'
    });

    const sessionId = sessionResult.data;

    // Log events to test batch size
    await customLogger.logEvent({
      type: 'tool_execution',
      timestamp: Date.now(),
      session_id: sessionId,
      tool_name: 'test1',
      parameters: {},
      result: {},
      timing: { duration: 5 },
      success: true
    });

    await customLogger.logEvent({
      type: 'tool_execution',
      timestamp: Date.now(),
      session_id: sessionId,
      tool_name: 'test2',
      parameters: {},
      result: {},
      timing: { duration: 5 },
      success: true
    });

    await customLogger.endSession(sessionId);
    await customLogger.shutdown();

    // Verify events were logged
    const sessionFiles = await fs.readdir(join(testDir, 'sessions'));
    expect(sessionFiles).toHaveLength(1);
  }, 10000);
});