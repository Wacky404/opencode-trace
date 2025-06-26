// AI Provider Interceptor for capturing AI API requests and responses
import type { 
  TraceEvent, 
  AIRequestEvent, 
  AIResponseEvent, 
  RequestTiming 
} from '../types.js'
import type { JSONLLogger } from '../logger.js'
import { StreamingHandler, type StreamingConfig } from './streaming-handler.js'
import { TokenTracker, type TokenizerConfig } from '../token-tracker.js'
import { CostCalculator, type TokenUsage } from '../cost-calculator.js'

export interface AIProviderConfig {
  sessionId: string
  logger: JSONLLogger
  enableCostTracking?: boolean
  enableTokenTracking?: boolean
  enableStreamingCapture?: boolean
  sanitizeHeaders?: boolean
  maxBodySize?: number
  maxChunkSize?: number
}

export interface ProviderInfo {
  name: string
  baseUrl: string
  modelEndpoint: string
  apiKeyHeader: string
  supportedModels: string[]
}

export interface AIRequestCapture {
  url: string
  method: string
  headers: Record<string, string>
  body: any
  provider: ProviderInfo
  model: string
  timestamp: number
}

export interface AIResponseCapture {
  status: number
  headers: Record<string, string>
  body: any
  timing: RequestTiming
  cost?: number
  tokensUsed?: TokenUsage
}

export class AIProviderInterceptor {
  private config: AIProviderConfig
  private originalFetch: typeof fetch
  private providers: Map<string, ProviderInfo>
  private streamingHandler: StreamingHandler | null = null
  private tokenTracker: TokenTracker | null = null
  private costCalculator: CostCalculator | null = null

  constructor(config: AIProviderConfig) {
    this.config = config
    this.originalFetch = global.fetch
    this.providers = new Map()
    this.initializeProviders()
    this.initializeOptionalComponents()
  }

  private initializeOptionalComponents(): void {
    // Initialize streaming handler if enabled
    if (this.config.enableStreamingCapture) {
      const streamingConfig: StreamingConfig = {
        sessionId: this.config.sessionId,
        logger: this.config.logger,
        captureIntermediateChunks: true,
        maxChunkSize: this.config.maxChunkSize,
        logFinalResponseOnly: false
      }
      this.streamingHandler = new StreamingHandler(streamingConfig)
    }

    // Initialize token tracker if enabled
    if (this.config.enableTokenTracking) {
      this.tokenTracker = new TokenTracker()
    }

    // Initialize cost calculator if enabled
    if (this.config.enableCostTracking) {
      this.costCalculator = new CostCalculator()
    }
  }

  private initializeProviders(): void {
    // Anthropic Claude
    this.providers.set('anthropic.com', {
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      modelEndpoint: '/v1/messages',
      apiKeyHeader: 'x-api-key',
      supportedModels: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022', 
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ]
    })

    // OpenAI
    this.providers.set('openai.com', {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com',
      modelEndpoint: '/v1/chat/completions',
      apiKeyHeader: 'authorization',
      supportedModels: [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo'
      ]
    })

    // Google Gemini
    this.providers.set('googleapis.com', {
      name: 'Google',
      baseUrl: 'https://generativelanguage.googleapis.com',
      modelEndpoint: '/v1beta/models/',
      apiKeyHeader: 'x-goog-api-key',
      supportedModels: [
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-pro'
      ]
    })
  }

  public wrapFetch(originalFetch: typeof fetch = global.fetch): typeof fetch {
    this.originalFetch = originalFetch

    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      
      // Check if this is an AI provider request
      const provider = this.detectProvider(url)
      if (!provider) {
        return this.originalFetch(input, init)
      }

      // Capture request details
      const requestCapture = await this.captureRequest(url, init, provider)
      
      // Log AI request event
      await this.logAIRequestEvent(requestCapture)

      const startTime = performance.now()
      
      try {
        // Make the actual request
        const response = await this.originalFetch(input, init)
        
        const endTime = performance.now()
        const timing: RequestTiming = {
          start: startTime,
          end: endTime,
          duration: endTime - startTime
        }

        // Handle streaming responses if enabled
        let finalResponse = response
        if (this.streamingHandler) {
          finalResponse = await this.streamingHandler.handleStreamingResponse(
            response, 
            provider, 
            requestCapture.model, 
            timing
          )
        }

        // Capture response details (after streaming handling)
        const responseCapture = await this.captureResponse(finalResponse, timing, provider)
        
        // Enhanced response logging with token and cost tracking
        await this.logEnhancedAIResponseEvent(requestCapture, responseCapture)

        return finalResponse

      } catch (error) {
        const endTime = performance.now()
        const timing: RequestTiming = {
          start: startTime,
          end: endTime,
          duration: endTime - startTime
        }

        // Log error response
        await this.logAIResponseEvent(requestCapture, {
          status: 0,
          headers: {},
          body: { error: error instanceof Error ? error.message : 'Unknown error' },
          timing
        })

        throw error
      }
    }
  }

  private detectProvider(url: string): ProviderInfo | null {
    for (const [domain, provider] of this.providers) {
      if (url.includes(domain)) {
        return provider
      }
    }
    return null
  }

  private async captureRequest(
    url: string, 
    init: RequestInit | undefined, 
    provider: ProviderInfo
  ): Promise<AIRequestCapture> {
    const method = init?.method || 'GET'
    const headers = this.sanitizeHeaders(init?.headers)
    const body = await this.parseRequestBody(init?.body)
    const model = this.extractModel(body, provider)

    return {
      url,
      method,
      headers,
      body: this.config.maxBodySize ? this.truncateBody(body) : body,
      provider,
      model,
      timestamp: Date.now()
    }
  }

  private async captureResponse(
    response: Response, 
    timing: RequestTiming, 
    provider: ProviderInfo
  ): Promise<AIResponseCapture> {
    // Clone response to avoid consuming the stream
    const responseClone = response.clone()
    const headers = this.sanitizeHeaders(responseClone.headers)
    
    let body: any
    try {
      const text = await responseClone.text()
      body = text ? JSON.parse(text) : null
    } catch (error) {
      body = { error: 'Failed to parse response body' }
    }

    return {
      status: response.status,
      headers,
      body: this.config.maxBodySize ? this.truncateBody(body) : body,
      timing
    }
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    if (!this.config.sanitizeHeaders) {
      return this.headersToRecord(headers)
    }

    const sanitized: Record<string, string> = {}
    const headersRecord = this.headersToRecord(headers)

    for (const [key, value] of Object.entries(headersRecord)) {
      const lowerKey = key.toLowerCase()
      
      // Sanitize sensitive headers
      if (lowerKey.includes('authorization') || 
          lowerKey.includes('api-key') || 
          lowerKey.includes('x-api-key') ||
          lowerKey.includes('token')) {
        sanitized[key] = this.redactHeader(value)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private headersToRecord(headers: any): Record<string, string> {
    if (!headers) return {}
    
    if (headers instanceof Headers) {
      const record: Record<string, string> = {}
      headers.forEach((value, key) => {
        record[key] = value
      })
      return record
    }
    
    if (Array.isArray(headers)) {
      const record: Record<string, string> = {}
      for (const [key, value] of headers) {
        record[key] = value
      }
      return record
    }
    
    return headers as Record<string, string>
  }

  private redactHeader(value: string): string {
    if (value.startsWith('Bearer ')) {
      return `Bearer ${'*'.repeat(Math.min(8, value.length - 7))}`
    }
    if (value.length > 8) {
      return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`
    }
    return '*'.repeat(value.length)
  }

  private async parseRequestBody(body: any): Promise<any> {
    if (!body) return null
    
    if (typeof body === 'string') {
      try {
        return JSON.parse(body)
      } catch {
        return body
      }
    }
    
    if (body instanceof FormData) {
      const formObject: Record<string, any> = {}
      for (const [key, value] of body.entries()) {
        formObject[key] = value
      }
      return formObject
    }
    
    if (body instanceof URLSearchParams) {
      const params: Record<string, string> = {}
      for (const [key, value] of body.entries()) {
        params[key] = value
      }
      return params
    }
    
    return body
  }

  private extractModel(body: any, provider: ProviderInfo): string {
    if (!body || typeof body !== 'object') {
      return 'unknown'
    }

    // Most providers use 'model' field
    if (body.model && typeof body.model === 'string') {
      return body.model
    }

    // Google Gemini uses URL-based model specification
    if (provider.name === 'Google' && body.model) {
      return body.model
    }

    return 'unknown'
  }

  private truncateBody(body: any): any {
    if (!this.config.maxBodySize) return body
    
    const bodyStr = JSON.stringify(body)
    if (bodyStr.length <= this.config.maxBodySize) {
      return body
    }
    
    return {
      ...body,
      _truncated: true,
      _originalSize: bodyStr.length,
      _truncatedAt: this.config.maxBodySize
    }
  }

  private async logAIRequestEvent(request: AIRequestCapture): Promise<void> {
    const event: AIRequestEvent = {
      type: 'ai_request',
      timestamp: request.timestamp,
      session_id: this.config.sessionId,
      provider: request.provider.name,
      model: request.model,
      messages: this.extractMessages(request.body),
      url: request.url,
      headers: request.headers
    }

    await this.config.logger.logEvent(event)
  }

  private async logAIResponseEvent(
    request: AIRequestCapture, 
    response: AIResponseCapture
  ): Promise<void> {
    const event: AIResponseEvent = {
      type: 'ai_response',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      provider: request.provider.name,
      model: request.model,
      cost: response.cost,
      tokens_used: response.tokensUsed,
      response: response.body
    }

    await this.config.logger.logEvent(event)
  }

  private async logEnhancedAIResponseEvent(
    request: AIRequestCapture, 
    response: AIResponseCapture
  ): Promise<void> {
    let enhancedResponse = { ...response }

    // Add token tracking if enabled
    if (this.tokenTracker) {
      try {
        const tokenizerConfig: TokenizerConfig = {
          provider: request.provider.name,
          model: request.model
        }

        // Try to get exact token usage from response first
        const exactTokens = await this.tokenTracker.extractTokenUsageFromResponse(
          response.body, 
          request.provider.name
        )

        if (exactTokens) {
          enhancedResponse.tokensUsed = exactTokens
        } else {
          // Fall back to estimation
          const tokenAnalysis = await this.tokenTracker.estimateFromRequest(
            request.body,
            response.body,
            tokenizerConfig
          )

          if (tokenAnalysis) {
            enhancedResponse.tokensUsed = {
              inputTokens: tokenAnalysis.inputTokens,
              outputTokens: tokenAnalysis.outputTokens
            }
          }
        }
      } catch (error) {
        console.warn('Failed to track tokens:', error)
      }
    }

    // Add cost calculation if enabled
    if (this.costCalculator && enhancedResponse.tokensUsed) {
      try {
        const costCalculation = this.costCalculator.calculateCost(
          request.provider.name,
          request.model,
          enhancedResponse.tokensUsed
        )

        if (costCalculation) {
          enhancedResponse.cost = costCalculation.totalCost
        }
      } catch (error) {
        console.warn('Failed to calculate cost:', error)
      }
    }

    const event: AIResponseEvent = {
      type: 'ai_response',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      provider: request.provider.name,
      model: request.model,
      cost: enhancedResponse.cost,
      tokens_used: enhancedResponse.tokensUsed,
      response: enhancedResponse.body
    }

    await this.config.logger.logEvent(event)
  }

  private extractMessages(body: any): Array<{ role: string; content: string }> {
    if (!body || !Array.isArray(body.messages)) {
      return []
    }

    return body.messages.map((msg: any) => ({
      role: msg.role || 'unknown',
      content: this.extractContent(msg.content)
    }))
  }

  private extractContent(content: any): string {
    if (typeof content === 'string') {
      return content
    }
    
    if (Array.isArray(content)) {
      return content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ')
    }
    
    if (content && typeof content === 'object' && content.text) {
      return content.text
    }
    
    return JSON.stringify(content)
  }

  public installGlobalInterceptor(): () => void {
    const wrappedFetch = this.wrapFetch()
    global.fetch = wrappedFetch

    // Return cleanup function
    return () => {
      global.fetch = this.originalFetch
    }
  }

  public isAIRequest(url: string): boolean {
    return this.detectProvider(url) !== null
  }

  public getSupportedProviders(): ProviderInfo[] {
    return Array.from(this.providers.values())
  }

  public async cleanup(): Promise<void> {
    // Cleanup streaming handler
    if (this.streamingHandler) {
      await this.streamingHandler.cleanup()
    }
    
    // Restore original fetch
    global.fetch = this.originalFetch
  }

  public getTokenTracker(): TokenTracker | null {
    return this.tokenTracker
  }

  public getCostCalculator(): CostCalculator | null {
    return this.costCalculator
  }

  public getStreamingHandler(): StreamingHandler | null {
    return this.streamingHandler
  }

  public updateConfig(updates: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...updates }
    
    // Reinitialize components if tracking options changed
    if (updates.enableStreamingCapture !== undefined ||
        updates.enableTokenTracking !== undefined ||
        updates.enableCostTracking !== undefined) {
      this.initializeOptionalComponents()
    }
  }
}