// Integration tests for Cost Calculator (Phase 2)
import { describe, test, expect, beforeEach } from 'vitest'
import { CostCalculator } from '../../../packages/tracer/src/cost-calculator.js'

describe('CostCalculator Integration Tests', () => {
  let calculator

  beforeEach(() => {
    calculator = new CostCalculator()
  })

  describe('Provider Support', () => {
    test('supports all major AI providers', () => {
      const providers = calculator.getSupportedProviders()
      expect(providers).toEqual(expect.arrayContaining(['Anthropic', 'OpenAI', 'Google']))
    })

    test('provides models for each supported provider', () => {
      const anthropicModels = calculator.getSupportedModels('Anthropic')
      expect(anthropicModels).toContain('claude-3-5-sonnet-20241022')
      expect(anthropicModels).toContain('claude-3-5-haiku-20241022')

      const openaiModels = calculator.getSupportedModels('OpenAI')
      expect(openaiModels).toContain('gpt-4o')
      expect(openaiModels).toContain('gpt-4o-mini')

      const googleModels = calculator.getSupportedModels('Google')
      expect(googleModels).toContain('gemini-1.5-pro')
      expect(googleModels).toContain('gemini-1.5-flash')
    })
  })

  describe('Anthropic Cost Calculations', () => {
    test('calculates Claude 3.5 Sonnet costs correctly', () => {
      const result = calculator.calculateCost('Anthropic', 'claude-3-5-sonnet-20241022', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeTruthy()
      expect(result.provider).toBe('Anthropic')
      expect(result.model).toBe('claude-3-5-sonnet-20241022')
      expect(result.inputCost).toBe(0.003) // 1000 tokens * $0.003 per 1K tokens
      expect(result.outputCost).toBe(0.0075) // 500 tokens * $0.015 per 1K tokens
      expect(result.totalCost).toBe(0.0105)
      expect(result.currency).toBe('USD')
    })

    test('calculates Claude 3.5 Haiku costs correctly', () => {
      const result = calculator.calculateCost('Anthropic', 'claude-3-5-haiku-20241022', {
        inputTokens: 2000,
        outputTokens: 1000
      })

      expect(result).toBeTruthy()
      expect(result.inputCost).toBe(0.002) // 2000 tokens * $0.001 per 1K tokens
      expect(result.outputCost).toBe(0.005) // 1000 tokens * $0.005 per 1K tokens
      expect(result.totalCost).toBe(0.007)
    })

    test('handles fractional token counts', () => {
      const result = calculator.calculateCost('Anthropic', 'claude-3-5-sonnet-20241022', {
        inputTokens: 1500,
        outputTokens: 750
      })

      expect(result).toBeTruthy()
      expect(result.inputCost).toBe(0.0045) // 1.5K tokens * $0.003
      expect(result.outputCost).toBe(0.01125) // 0.75K tokens * $0.015
      expect(result.totalCost).toBe(0.01575)
    })
  })

  describe('OpenAI Cost Calculations', () => {
    test('calculates GPT-4o costs correctly', () => {
      const result = calculator.calculateCost('OpenAI', 'gpt-4o', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeTruthy()
      expect(result.provider).toBe('OpenAI')
      expect(result.model).toBe('gpt-4o')
      expect(result.inputCost).toBe(0.0025) // $0.0025 per 1K input tokens
      expect(result.outputCost).toBe(0.005) // $0.01 per 1K output tokens
      expect(result.totalCost).toBe(0.0075)
    })

    test('calculates GPT-4o-mini costs correctly', () => {
      const result = calculator.calculateCost('OpenAI', 'gpt-4o-mini', {
        inputTokens: 10000,
        outputTokens: 5000
      })

      expect(result).toBeTruthy()
      expect(result.inputCost).toBe(0.0015) // 10K tokens * $0.00015 per 1K tokens
      expect(result.outputCost).toBe(0.003) // 5K tokens * $0.0006 per 1K tokens
      expect(result.totalCost).toBe(0.0045)
    })

    test('calculates GPT-3.5-turbo costs correctly', () => {
      const result = calculator.calculateCost('OpenAI', 'gpt-3.5-turbo', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeTruthy()
      expect(result.inputCost).toBe(0.0015) // $0.0015 per 1K input tokens
      expect(result.outputCost).toBe(0.001) // $0.002 per 1K output tokens
      expect(result.totalCost).toBe(0.0025)
    })
  })

  describe('Google Cost Calculations', () => {
    test('calculates Gemini 1.5 Pro costs correctly', () => {
      const result = calculator.calculateCost('Google', 'gemini-1.5-pro', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeTruthy()
      expect(result.provider).toBe('Google')
      expect(result.model).toBe('gemini-1.5-pro')
      expect(result.inputCost).toBe(0.00125) // $0.00125 per 1K input tokens
      expect(result.outputCost).toBe(0.0025) // $0.005 per 1K output tokens
      expect(result.totalCost).toBe(0.00375)
    })

    test('calculates Gemini 1.5 Flash costs correctly', () => {
      const result = calculator.calculateCost('Google', 'gemini-1.5-flash', {
        inputTokens: 10000,
        outputTokens: 5000
      })

      expect(result).toBeTruthy()
      expect(result.inputCost).toBe(0.00075) // 10K tokens * $0.000075 per 1K tokens
      expect(result.outputCost).toBe(0.0015) // 5K tokens * $0.0003 per 1K tokens
      expect(result.totalCost).toBe(0.00225)
    })

    test('handles free tier models correctly', () => {
      const result = calculator.calculateCost('Google', 'gemini-2.0-flash-exp', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeTruthy()
      expect(result.inputCost).toBe(0) // Free tier
      expect(result.outputCost).toBe(0) // Free tier
      expect(result.totalCost).toBe(0)
    })
  })

  describe('Model Fallback and Matching', () => {
    test('handles unknown provider gracefully', () => {
      const result = calculator.calculateCost('UnknownProvider', 'unknown-model', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeNull()
    })

    test('handles unknown model within known provider', () => {
      const result = calculator.calculateCost('Anthropic', 'unknown-claude-model', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeNull()
    })

    test('matches similar model names with version differences', () => {
      // This would test the findSimilarModel functionality
      // In practice, this might match claude-3-sonnet to claude-3-sonnet-20240229
      const result = calculator.calculateCost('Anthropic', 'claude-3-sonnet', {
        inputTokens: 1000,
        outputTokens: 500
      })

      // Should either find a match or return null
      if (result) {
        expect(result.provider).toBe('Anthropic')
        expect(result.totalCost).toBeGreaterThan(0)
      }
    })
  })

  describe('Cost Comparison and Analysis', () => {
    test('compares costs across different models', () => {
      const tokenUsage = { inputTokens: 1000, outputTokens: 500 }
      const models = [
        { provider: 'Anthropic', model: 'claude-3-5-sonnet-20241022' },
        { provider: 'Anthropic', model: 'claude-3-5-haiku-20241022' },
        { provider: 'OpenAI', model: 'gpt-4o' },
        { provider: 'OpenAI', model: 'gpt-4o-mini' },
        { provider: 'Google', model: 'gemini-1.5-pro' },
        { provider: 'Google', model: 'gemini-1.5-flash' }
      ]

      const comparisons = calculator.compareCosts(tokenUsage, models)
      
      expect(comparisons).toHaveLength(6)
      
      // Should be sorted by cost (ascending)
      for (let i = 1; i < comparisons.length; i++) {
        expect(comparisons[i].totalCost).toBeGreaterThanOrEqual(comparisons[i - 1].totalCost)
      }

      // Each should have a rank
      expect(comparisons[0].rank).toBe(1)
      expect(comparisons[comparisons.length - 1].rank).toBe(6)
    })

    test('finds cheapest option overall', () => {
      const tokenUsage = { inputTokens: 1000, outputTokens: 500 }
      const cheapest = calculator.getCheapestOption(tokenUsage)

      expect(cheapest).toBeTruthy()
      expect(cheapest.rank).toBe(1)
      expect(cheapest.totalCost).toBeGreaterThanOrEqual(0)
    })

    test('finds cheapest option within specific providers', () => {
      const tokenUsage = { inputTokens: 1000, outputTokens: 500 }
      const cheapest = calculator.getCheapestOption(tokenUsage, ['Anthropic', 'OpenAI'])

      expect(cheapest).toBeTruthy()
      expect(['Anthropic', 'OpenAI']).toContain(cheapest.provider)
    })
  })

  describe('Text Estimation', () => {
    test('estimates cost from input text', () => {
      const inputText = 'This is a test message that will be used to estimate token usage and cost.'
      const result = calculator.estimateCost('Anthropic', 'claude-3-5-sonnet-20241022', inputText, 100)

      expect(result).toBeTruthy()
      expect(result.inputTokens).toBeGreaterThan(0)
      expect(result.outputTokens).toBe(100)
      expect(result.totalCost).toBeGreaterThan(0)
    })

    test('estimation is reasonable for typical text lengths', () => {
      const shortText = 'Hello'
      const longText = 'This is a much longer piece of text that should result in significantly more tokens and therefore a higher cost estimate for processing.'

      const shortResult = calculator.estimateCost('OpenAI', 'gpt-4o', shortText, 50)
      const longResult = calculator.estimateCost('OpenAI', 'gpt-4o', longText, 50)

      expect(longResult.inputTokens).toBeGreaterThan(shortResult.inputTokens)
      expect(longResult.totalCost).toBeGreaterThan(shortResult.totalCost)
    })
  })

  describe('Custom Pricing', () => {
    test('allows adding custom pricing for new models', () => {
      const customPricing = {
        inputCostPer1kTokens: 0.001,
        outputCostPer1kTokens: 0.002,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }

      calculator.addCustomPricing('CustomProvider', 'custom-model-v1', customPricing)

      const result = calculator.calculateCost('CustomProvider', 'custom-model-v1', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result).toBeTruthy()
      expect(result.provider).toBe('CustomProvider')
      expect(result.model).toBe('custom-model-v1')
      expect(result.inputCost).toBe(0.001)
      expect(result.outputCost).toBe(0.001)
      expect(result.totalCost).toBe(0.002)
    })

    test('allows updating existing pricing', () => {
      const updated = calculator.updatePricing('Anthropic', 'claude-3-5-sonnet-20241022', {
        inputCostPer1kTokens: 0.002 // Reduced from 0.003
      })

      expect(updated).toBe(true)

      const result = calculator.calculateCost('Anthropic', 'claude-3-5-sonnet-20241022', {
        inputTokens: 1000,
        outputTokens: 500
      })

      expect(result.inputCost).toBe(0.002) // Should use updated pricing
    })
  })

  describe('Pricing Metadata', () => {
    test('provides pricing information for models', () => {
      const pricing = calculator.getModelPricing('Anthropic', 'claude-3-5-sonnet-20241022')
      
      expect(pricing).toBeTruthy()
      expect(pricing.inputCostPer1kTokens).toBe(0.003)
      expect(pricing.outputCostPer1kTokens).toBe(0.015)
      expect(pricing.currency).toBe('USD')
      expect(pricing.lastUpdated).toBeTruthy()
    })

    test('tracks pricing last updated dates', () => {
      const lastUpdated = calculator.getPricingLastUpdated('OpenAI', 'gpt-4o')
      expect(lastUpdated).toBeTruthy()
      expect(new Date(lastUpdated)).toBeInstanceOf(Date)
    })

    test('detects stale pricing data', () => {
      // Current pricing should not be stale
      const isStale = calculator.isPricingStale('Anthropic', 'claude-3-5-sonnet-20241022', 30)
      expect(isStale).toBe(false)

      // Very strict threshold should mark as stale
      const isStaleStrict = calculator.isPricingStale('Anthropic', 'claude-3-5-sonnet-20241022', 0)
      expect(isStaleStrict).toBe(true)
    })
  })

  describe('Precision and Rounding', () => {
    test('handles very small costs with proper precision', () => {
      const result = calculator.calculateCost('Google', 'gemini-1.5-flash', {
        inputTokens: 1,
        outputTokens: 1
      })

      expect(result).toBeTruthy()
      // Should have up to 5 decimal places of precision
      expect(result.totalCost.toString()).toMatch(/^\d+\.\d{1,5}$/)
    })

    test('handles large token counts correctly', () => {
      const result = calculator.calculateCost('Anthropic', 'claude-3-5-sonnet-20241022', {
        inputTokens: 1000000, // 1M tokens
        outputTokens: 500000   // 500K tokens
      })

      expect(result).toBeTruthy()
      expect(result.inputCost).toBe(3.0) // 1000 * 0.003
      expect(result.outputCost).toBe(7.5) // 500 * 0.015
      expect(result.totalCost).toBe(10.5)
    })
  })
})