// Cost calculation engine with up-to-date pricing for all major AI providers
export interface ModelPricing {
  inputCostPer1kTokens: number
  outputCostPer1kTokens: number
  currency: string
  lastUpdated: string
}

export interface CostCalculation {
  inputTokens: number
  outputTokens: number
  inputCost: number
  outputCost: number
  totalCost: number
  currency: string
  model: string
  provider: string
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export class CostCalculator {
  private pricing: Map<string, Map<string, ModelPricing>>

  constructor() {
    this.pricing = new Map()
    this.initializePricing()
  }

  private initializePricing(): void {
    // Anthropic Claude pricing (as of December 2024)
    const anthropicPricing = new Map<string, ModelPricing>([
      ['claude-3-5-sonnet-20241022', {
        inputCostPer1kTokens: 0.003,
        outputCostPer1kTokens: 0.015,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['claude-3-5-haiku-20241022', {
        inputCostPer1kTokens: 0.001,
        outputCostPer1kTokens: 0.005,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['claude-3-opus-20240229', {
        inputCostPer1kTokens: 0.015,
        outputCostPer1kTokens: 0.075,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['claude-3-sonnet-20240229', {
        inputCostPer1kTokens: 0.003,
        outputCostPer1kTokens: 0.015,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['claude-3-haiku-20240307', {
        inputCostPer1kTokens: 0.00025,
        outputCostPer1kTokens: 0.00125,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }]
    ])

    // OpenAI pricing (as of December 2024)
    const openaiPricing = new Map<string, ModelPricing>([
      ['gpt-4o', {
        inputCostPer1kTokens: 0.0025,
        outputCostPer1kTokens: 0.01,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['gpt-4o-mini', {
        inputCostPer1kTokens: 0.00015,
        outputCostPer1kTokens: 0.0006,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['gpt-4-turbo', {
        inputCostPer1kTokens: 0.01,
        outputCostPer1kTokens: 0.03,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['gpt-4', {
        inputCostPer1kTokens: 0.03,
        outputCostPer1kTokens: 0.06,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['gpt-3.5-turbo', {
        inputCostPer1kTokens: 0.0015,
        outputCostPer1kTokens: 0.002,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }]
    ])

    // Google Gemini pricing (as of December 2024)
    const googlePricing = new Map<string, ModelPricing>([
      ['gemini-2.0-flash-exp', {
        inputCostPer1kTokens: 0.00,  // Free tier
        outputCostPer1kTokens: 0.00,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['gemini-1.5-pro', {
        inputCostPer1kTokens: 0.00125,
        outputCostPer1kTokens: 0.005,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['gemini-1.5-flash', {
        inputCostPer1kTokens: 0.000075,
        outputCostPer1kTokens: 0.0003,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }],
      ['gemini-pro', {
        inputCostPer1kTokens: 0.0005,
        outputCostPer1kTokens: 0.0015,
        currency: 'USD',
        lastUpdated: '2024-12-26'
      }]
    ])

    this.pricing.set('Anthropic', anthropicPricing)
    this.pricing.set('OpenAI', openaiPricing)
    this.pricing.set('Google', googlePricing)
  }

  public calculateCost(
    provider: string,
    model: string,
    tokenUsage: TokenUsage
  ): CostCalculation | null {
    const providerPricing = this.pricing.get(provider)
    if (!providerPricing) {
      return null
    }

    const modelPricing = providerPricing.get(model)
    if (!modelPricing) {
      // Try to find similar model (e.g., version variations)
      const fallbackModel = this.findSimilarModel(model, providerPricing)
      if (!fallbackModel) {
        return null
      }
      return this.calculateWithPricing(provider, model, tokenUsage, fallbackModel)
    }

    return this.calculateWithPricing(provider, model, tokenUsage, modelPricing)
  }

  private calculateWithPricing(
    provider: string,
    model: string,
    tokenUsage: TokenUsage,
    pricing: ModelPricing
  ): CostCalculation {
    const inputCost = (tokenUsage.inputTokens / 1000) * pricing.inputCostPer1kTokens
    const outputCost = (tokenUsage.outputTokens / 1000) * pricing.outputCostPer1kTokens
    const totalCost = inputCost + outputCost

    return {
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      inputCost: Math.round(inputCost * 100000) / 100000,  // Round to 5 decimal places
      outputCost: Math.round(outputCost * 100000) / 100000,
      totalCost: Math.round(totalCost * 100000) / 100000,
      currency: pricing.currency,
      model,
      provider
    }
  }

  private findSimilarModel(
    targetModel: string,
    providerPricing: Map<string, ModelPricing>
  ): ModelPricing | null {
    // Normalize model name for comparison
    const normalizedTarget = this.normalizeModelName(targetModel)
    
    for (const [modelName, pricing] of providerPricing) {
      const normalizedModel = this.normalizeModelName(modelName)
      
      // Check for base model match (e.g., claude-3-sonnet matches claude-3-sonnet-20240229)
      if (normalizedModel.includes(normalizedTarget) || normalizedTarget.includes(normalizedModel)) {
        return pricing
      }
    }

    return null
  }

  private normalizeModelName(modelName: string): string {
    return modelName
      .toLowerCase()
      .replace(/-\d{8}/g, '')  // Remove date suffixes like -20240229
      .replace(/-\d{4}-\d{2}-\d{2}/g, '')  // Remove date suffixes like -2024-02-29
      .replace(/[^a-z0-9]/g, '')  // Remove special characters
  }

  public getSupportedModels(provider: string): string[] {
    const providerPricing = this.pricing.get(provider)
    if (!providerPricing) {
      return []
    }
    return Array.from(providerPricing.keys())
  }

  public getSupportedProviders(): string[] {
    return Array.from(this.pricing.keys())
  }

  public getModelPricing(provider: string, model: string): ModelPricing | null {
    const providerPricing = this.pricing.get(provider)
    if (!providerPricing) {
      return null
    }
    return providerPricing.get(model) || null
  }

  public addCustomPricing(
    provider: string,
    model: string,
    pricing: ModelPricing
  ): void {
    if (!this.pricing.has(provider)) {
      this.pricing.set(provider, new Map())
    }
    
    const providerPricing = this.pricing.get(provider)!
    providerPricing.set(model, pricing)
  }

  public updatePricing(
    provider: string,
    model: string,
    updates: Partial<ModelPricing>
  ): boolean {
    const providerPricing = this.pricing.get(provider)
    if (!providerPricing) {
      return false
    }

    const currentPricing = providerPricing.get(model)
    if (!currentPricing) {
      return false
    }

    const updatedPricing: ModelPricing = {
      ...currentPricing,
      ...updates
    }

    providerPricing.set(model, updatedPricing)
    return true
  }

  public estimateCost(
    provider: string,
    model: string,
    inputText: string,
    estimatedOutputTokens: number = 0
  ): CostCalculation | null {
    // Rough estimation: ~4 characters per token for most models
    const estimatedInputTokens = Math.ceil(inputText.length / 4)
    
    return this.calculateCost(provider, model, {
      inputTokens: estimatedInputTokens,
      outputTokens: estimatedOutputTokens
    })
  }

  public compareCosts(
    tokenUsage: TokenUsage,
    models: Array<{ provider: string; model: string }>
  ): Array<CostCalculation & { rank: number }> {
    const calculations = models
      .map(({ provider, model }) => this.calculateCost(provider, model, tokenUsage))
      .filter((calc): calc is CostCalculation => calc !== null)
      .sort((a, b) => a.totalCost - b.totalCost)
      .map((calc, index) => ({ ...calc, rank: index + 1 }))

    return calculations
  }

  public getCheapestOption(
    tokenUsage: TokenUsage,
    providers?: string[]
  ): CostCalculation | null {
    const allModels: Array<{ provider: string; model: string }> = []
    
    const providersToCheck = providers || this.getSupportedProviders()
    
    for (const provider of providersToCheck) {
      const models = this.getSupportedModels(provider)
      for (const model of models) {
        allModels.push({ provider, model })
      }
    }

    const costs = this.compareCosts(tokenUsage, allModels)
    return costs.length > 0 ? costs[0] : null
  }

  public getPricingLastUpdated(provider: string, model: string): string | null {
    const pricing = this.getModelPricing(provider, model)
    return pricing?.lastUpdated || null
  }

  public isPricingStale(provider: string, model: string, maxAgeDays: number = 30): boolean {
    const lastUpdated = this.getPricingLastUpdated(provider, model)
    if (!lastUpdated) {
      return true
    }

    const updatedDate = new Date(lastUpdated)
    const now = new Date()
    const ageInDays = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)
    
    return ageInDays > maxAgeDays
  }
}