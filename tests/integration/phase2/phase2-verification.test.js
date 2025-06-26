// Phase 2 verification test
import { describe, test, expect } from 'vitest'

describe('Phase 2 Implementation Verification', () => {
  test('Task 2.1 verifiable outcomes', async () => {
    // Import modules to ensure they can be loaded
    const { CostCalculator } = await import('../../../packages/tracer/dist/index.js')
    const { TokenTracker } = await import('../../../packages/tracer/dist/index.js')
    
    // Test CostCalculator
    const calculator = new CostCalculator()
    expect(calculator.getSupportedProviders()).toContain('Anthropic')
    expect(calculator.getSupportedProviders()).toContain('OpenAI')
    expect(calculator.getSupportedProviders()).toContain('Google')

    const cost = calculator.calculateCost('Anthropic', 'claude-3-5-sonnet-20241022', {
      inputTokens: 1000,
      outputTokens: 500
    })
    expect(cost).toBeTruthy()
    expect(cost.totalCost).toBeGreaterThan(0)

    // Test TokenTracker  
    const tracker = new TokenTracker()
    const tokenResult = await tracker.countTokens('Hello world!', {
      provider: 'Anthropic',
      model: 'claude-3-5-sonnet-20241022'
    })
    expect(tokenResult.tokens).toBeGreaterThan(0)
    expect(['exact', 'approximate', 'fallback']).toContain(tokenResult.method)

    console.log('✅ Phase 2 Core Components Verified:')
    console.log(`   - CostCalculator: ${calculator.getSupportedProviders().length} providers supported`)
    console.log(`   - TokenTracker: Working with ${tokenResult.method} method`)
    console.log(`   - Sample cost calculation: $${cost.totalCost.toFixed(5)} for 1000 input + 500 output tokens`)
  })

  test('Provider detection works correctly', async () => {
    const { AIProviderInterceptor } = await import('../../../packages/tracer/dist/index.js')
    const { JSONLLogger } = await import('../../../packages/tracer/dist/index.js')
    
    // Create a mock logger for testing
    const logger = { logEvent: async () => {} }
    
    const interceptor = new AIProviderInterceptor({
      sessionId: 'test-session',
      logger,
      enableCostTracking: true,
      enableTokenTracking: true,
      enableStreamingCapture: true
    })

    // Test provider detection
    expect(interceptor.isAIRequest('https://api.anthropic.com/v1/messages')).toBe(true)
    expect(interceptor.isAIRequest('https://api.openai.com/v1/chat/completions')).toBe(true)
    expect(interceptor.isAIRequest('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent')).toBe(true)
    expect(interceptor.isAIRequest('https://example.com/api')).toBe(false)

    const providers = interceptor.getSupportedProviders()
    expect(providers).toHaveLength(3)
    expect(providers.map(p => p.name)).toEqual(expect.arrayContaining(['Anthropic', 'OpenAI', 'Google']))

    await interceptor.cleanup()

    console.log('✅ AI Provider Interceptor Verified:')
    console.log(`   - Provider detection working for all 3 providers`)
    console.log(`   - Supports: ${providers.map(p => p.name).join(', ')}`)
  })

  test('Phase 2 integration components can be imported', async () => {
    // Verify all Phase 2 components can be imported without errors
    const tracer = await import('../../../packages/tracer/dist/index.js')
    
    // Check that all expected exports are available
    const expectedExports = [
      'AIProviderInterceptor',
      'StreamingHandler', 
      'CostCalculator',
      'TokenTracker',
      'AnthropicAdapter',
      'OpenAIAdapter',
      'GoogleAdapter'
    ]
    
    const availableExports = Object.keys(tracer)
    
    for (const expected of expectedExports) {
      expect(availableExports).toContain(expected)
    }

    console.log('✅ All Phase 2 modules imported successfully:')
    console.log('   - AIProviderInterceptor')
    console.log('   - StreamingHandler') 
    console.log('   - CostCalculator')
    console.log('   - TokenTracker')
    console.log('   - AnthropicAdapter')
    console.log('   - OpenAIAdapter')
    console.log('   - GoogleAdapter')
  })
})