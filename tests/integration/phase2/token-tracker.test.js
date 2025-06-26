// Integration tests for Token Tracker (Phase 2)
import { describe, test, expect, beforeEach, beforeAll } from 'vitest'
import { TokenTracker } from '../../../packages/tracer/src/token-tracker.js'

describe('TokenTracker Integration Tests', () => {
  let tracker

  beforeAll(async () => {
    // Allow time for tokenizer initialization
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  beforeEach(() => {
    tracker = new TokenTracker()
  })

  describe('Tokenizer Initialization', () => {
    test('initializes available tokenizers', async () => {
      const status = tracker.getTokenizerStatus()
      
      expect(status.initialized).toBe(true)
      // At least one tokenizer should be available (fallback always works)
      expect(
        status.tiktoken || 
        status.anthropicTokenizer || 
        status.gptTokenizer
      ).toBe(true)
    })

    test('validates tokenizers work correctly', async () => {
      const results = await tracker.validateTokenizers()
      
      // Should return status for all tokenizers
      expect(results).toHaveProperty('tiktoken')
      expect(results).toHaveProperty('anthropicTokenizer')
      expect(results).toHaveProperty('gptTokenizer')
      
      // At least fallback should work
      const anyWorking = Object.values(results).some(working => working === true)
      expect(anyWorking).toBe(true)
    })
  })

  describe('Basic Token Counting', () => {
    test('counts tokens for simple text', async () => {
      const text = 'Hello, world! This is a test message.'
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const result = await tracker.countTokens(text, config)
      
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.tokens).toBeLessThan(50) // Reasonable upper bound
      expect(['exact', 'approximate', 'fallback']).toContain(result.method)
    })

    test('counts more tokens for longer text', async () => {
      const shortText = 'Hello'
      const longText = 'This is a much longer piece of text that contains many more words and should therefore result in a significantly higher token count when processed by any reasonable tokenizer implementation.'
      
      const config = { provider: 'OpenAI', model: 'gpt-4o' }
      
      const shortResult = await tracker.countTokens(shortText, config)
      const longResult = await tracker.countTokens(longText, config)
      
      expect(longResult.tokens).toBeGreaterThan(shortResult.tokens)
    })

    test('handles empty text gracefully', async () => {
      const result = await tracker.countTokens('', { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' })
      
      expect(result.tokens).toBe(0)
      expect(result.method).toBeTruthy()
    })
  })

  describe('Provider-Specific Token Counting', () => {
    test('uses appropriate tokenizer for Anthropic models', async () => {
      const text = 'This is a test message for Anthropic Claude models.'
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const result = await tracker.countTokens(text, config)
      
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.method).toBeTruthy()
    })

    test('uses appropriate tokenizer for OpenAI models', async () => {
      const text = 'This is a test message for OpenAI GPT models.'
      const configs = [
        { provider: 'OpenAI', model: 'gpt-4o' },
        { provider: 'OpenAI', model: 'gpt-4' },
        { provider: 'OpenAI', model: 'gpt-3.5-turbo' }
      ]
      
      for (const config of configs) {
        const result = await tracker.countTokens(text, config)
        expect(result.tokens).toBeGreaterThan(0)
        expect(result.method).toBeTruthy()
      }
    })

    test('uses appropriate tokenizer for Google models', async () => {
      const text = 'This is a test message for Google Gemini models.'
      const config = { provider: 'Google', model: 'gemini-1.5-pro' }
      
      const result = await tracker.countTokens(text, config)
      
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.method).toBeTruthy()
    })

    test('falls back gracefully for unknown providers', async () => {
      const text = 'This is a test message for an unknown provider.'
      const config = { provider: 'UnknownProvider', model: 'unknown-model' }
      
      const result = await tracker.countTokens(text, config)
      
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.method).toBe('fallback')
    })
  })

  describe('Token Usage Analysis', () => {
    test('analyzes input and output token usage', async () => {
      const inputText = 'What is the capital of France?'
      const outputText = 'The capital of France is Paris.'
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const analysis = await tracker.analyzeTokenUsage(inputText, outputText, config)
      
      expect(analysis.inputTokens).toBeGreaterThan(0)
      expect(analysis.outputTokens).toBeGreaterThan(0)
      expect(analysis.totalTokens).toBe(analysis.inputTokens + analysis.outputTokens)
      expect(analysis.provider).toBe('Anthropic')
      expect(analysis.model).toBe('claude-3-5-sonnet-20241022')
      expect(analysis.timestamp).toBeCloseTo(Date.now(), -2) // Within ~100ms
    })

    test('analyzes token usage from message format', async () => {
      const messages = [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' },
        { role: 'user', content: 'What is 2 + 2?' }
      ]
      const response = 'The answer is 4.'
      const config = { provider: 'OpenAI', model: 'gpt-4o' }
      
      const analysis = await tracker.analyzeFromMessages(messages, response, config)
      
      expect(analysis.inputTokens).toBeGreaterThan(0)
      expect(analysis.outputTokens).toBeGreaterThan(0)
      expect(analysis.provider).toBe('OpenAI')
      expect(analysis.model).toBe('gpt-4o')
    })
  })

  describe('Response Token Extraction', () => {
    test('extracts token usage from Anthropic response', async () => {
      const anthropicResponse = {
        id: 'msg_test123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        usage: {
          input_tokens: 15,
          output_tokens: 8
        }
      }
      
      const usage = await tracker.extractTokenUsageFromResponse(anthropicResponse, 'Anthropic')
      
      expect(usage).toBeTruthy()
      expect(usage.inputTokens).toBe(15)
      expect(usage.outputTokens).toBe(8)
    })

    test('extracts token usage from OpenAI response', async () => {
      const openaiResponse = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        choices: [{ message: { content: 'Hello!' } }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 6,
          total_tokens: 18
        }
      }
      
      const usage = await tracker.extractTokenUsageFromResponse(openaiResponse, 'OpenAI')
      
      expect(usage).toBeTruthy()
      expect(usage.inputTokens).toBe(12)
      expect(usage.outputTokens).toBe(6)
    })

    test('extracts token usage from Google response', async () => {
      const googleResponse = {
        candidates: [{ content: { parts: [{ text: 'Hello!' }] } }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15
        }
      }
      
      const usage = await tracker.extractTokenUsageFromResponse(googleResponse, 'Google')
      
      expect(usage).toBeTruthy()
      expect(usage.inputTokens).toBe(10)
      expect(usage.outputTokens).toBe(5)
    })

    test('returns null for responses without usage data', async () => {
      const responseWithoutUsage = {
        choices: [{ message: { content: 'Hello!' } }]
      }
      
      const usage = await tracker.extractTokenUsageFromResponse(responseWithoutUsage, 'OpenAI')
      
      expect(usage).toBeNull()
    })
  })

  describe('Request/Response Estimation', () => {
    test('estimates from Anthropic request/response pair', async () => {
      const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'What is machine learning?' }
        ],
        max_tokens: 100
      }
      
      const responseBody = {
        content: [{ type: 'text', text: 'Machine learning is a subset of artificial intelligence.' }],
        usage: {
          input_tokens: 8,
          output_tokens: 12
        }
      }
      
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const analysis = await tracker.estimateFromRequest(requestBody, responseBody, config)
      
      expect(analysis).toBeTruthy()
      expect(analysis.inputTokens).toBe(8)
      expect(analysis.outputTokens).toBe(12)
      expect(analysis.estimationMethod).toBe('exact')
    })

    test('estimates from OpenAI request/response pair', async () => {
      const requestBody = {
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Explain quantum computing.' }
        ]
      }
      
      const responseBody = {
        choices: [{
          message: { content: 'Quantum computing uses quantum mechanics principles.' }
        }],
        usage: {
          prompt_tokens: 6,
          completion_tokens: 9,
          total_tokens: 15
        }
      }
      
      const config = { provider: 'OpenAI', model: 'gpt-4o' }
      
      const analysis = await tracker.estimateFromRequest(requestBody, responseBody, config)
      
      expect(analysis).toBeTruthy()
      expect(analysis.inputTokens).toBe(6)
      expect(analysis.outputTokens).toBe(9)
      expect(analysis.estimationMethod).toBe('exact')
    })

    test('falls back to tokenizer when no usage data available', async () => {
      const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      }
      
      const responseBody = {
        content: [{ type: 'text', text: 'Hi there!' }]
        // No usage field
      }
      
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const analysis = await tracker.estimateFromRequest(requestBody, responseBody, config)
      
      if (analysis) {
        expect(analysis.inputTokens).toBeGreaterThan(0)
        expect(analysis.outputTokens).toBeGreaterThan(0)
        expect(['approximate', 'fallback']).toContain(analysis.estimationMethod)
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('handles malformed request body gracefully', async () => {
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const analysis = await tracker.estimateFromRequest(null, null, config)
      
      expect(analysis).toBeNull()
    })

    test('handles very long text inputs', async () => {
      const veryLongText = 'A'.repeat(50000) // 50k characters
      const config = { provider: 'OpenAI', model: 'gpt-4o' }
      
      const result = await tracker.countTokens(veryLongText, config)
      
      expect(result.tokens).toBeGreaterThan(1000) // Should be many tokens
      expect(result.method).toBeTruthy()
    })

    test('handles special characters and unicode', async () => {
      const unicodeText = '🤖 AI systems can process émojis and ünïcödé characters! 中文 العربية'
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const result = await tracker.countTokens(unicodeText, config)
      
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.method).toBeTruthy()
    })

    test('provides reasonable estimates even when all tokenizers fail', async () => {
      // This test simulates the scenario where all tokenizers fail
      const text = 'This should still get a reasonable token count estimate.'
      const config = { provider: 'UnknownProvider', model: 'unknown-model' }
      
      const result = await tracker.countTokens(text, config)
      
      expect(result.tokens).toBeGreaterThan(0)
      expect(result.method).toBe('fallback')
      
      // Fallback estimation should be roughly text.length / 4
      const expectedTokens = Math.ceil(text.length / 4)
      expect(result.tokens).toBeCloseTo(expectedTokens, 2)
    })
  })

  describe('Performance', () => {
    test('processes multiple token counting requests efficiently', async () => {
      const texts = [
        'Short text',
        'Medium length text with more words and complexity',
        'This is a much longer piece of text that should test the performance of the token counting system when processing multiple requests in sequence or parallel.'
      ]
      
      const config = { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' }
      
      const startTime = performance.now()
      
      const results = await Promise.all(
        texts.map(text => tracker.countTokens(text, config))
      )
      
      const duration = performance.now() - startTime
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.tokens).toBeGreaterThan(0)
      })
      
      // Should complete 3 token counting operations in under 1 second
      expect(duration).toBeLessThan(1000)
    })

    test('maintains consistent performance with repeated requests', async () => {
      const text = 'This is a test message for performance testing.'
      const config = { provider: 'OpenAI', model: 'gpt-4o' }
      
      const durations = []
      
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        await tracker.countTokens(text, config)
        durations.push(performance.now() - start)
      }
      
      // Performance should be consistent (no significant degradation)
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length
      const maxDuration = Math.max(...durations)
      
      // Max duration shouldn't be more than 3x the average
      expect(maxDuration).toBeLessThan(avgDuration * 3)
    })
  })

  describe('Memory Management', () => {
    test('does not leak memory with repeated usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Perform many token counting operations
      for (let i = 0; i < 100; i++) {
        await tracker.countTokens(`Test message ${i}`, {
          provider: 'Anthropic',
          model: 'claude-3-5-sonnet-20241022'
        })
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024)
    })
  })
})