// Token usage tracking and analysis with multiple tokenizer support
import type { TokenUsage } from './cost-calculator.js'

export interface TokenizerConfig {
  provider: string
  model: string
  encoding?: string
}

export interface TokenAnalysis {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimationMethod: 'exact' | 'approximate' | 'fallback'
  provider: string
  model: string
  timestamp: number
}

export interface TokenizerResult {
  tokens: number
  method: 'exact' | 'approximate' | 'fallback'
  error?: string
}

export class TokenTracker {
  private tiktoken: any
  private anthropicTokenizer: any
  private gptTokenizer: any
  private initialized: boolean = false

  constructor() {
    this.initializeTokenizers()
  }

  private async initializeTokenizers(): Promise<void> {
    try {
      // Import tokenizers dynamically to handle optional dependencies
      try {
        const tiktokenModule = await import('tiktoken')
        this.tiktoken = tiktokenModule
      } catch (error) {
        console.warn('tiktoken not available:', error)
      }

      try {
        const anthropicModule = await import('@anthropic-ai/tokenizer')
        this.anthropicTokenizer = anthropicModule
      } catch (error) {
        console.warn('@anthropic-ai/tokenizer not available:', error)
      }

      try {
        const gptTokenizerModule = await import('gpt-tokenizer')
        this.gptTokenizer = gptTokenizerModule
      } catch (error) {
        console.warn('gpt-tokenizer not available:', error)
      }

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize tokenizers:', error)
      this.initialized = true // Mark as initialized even with errors
    }
  }

  public async countTokens(
    text: string,
    config: TokenizerConfig
  ): Promise<TokenizerResult> {
    if (!this.initialized) {
      await this.initializeTokenizers()
    }

    const provider = config.provider.toLowerCase()
    const model = config.model.toLowerCase()

    // Try provider-specific tokenizers first
    if (provider === 'anthropic' || model.includes('claude')) {
      return this.countAnthropicTokens(text, config)
    }

    if (provider === 'openai' || model.includes('gpt')) {
      return this.countOpenAITokens(text, config)
    }

    if (provider === 'google' || model.includes('gemini')) {
      return this.countGoogleTokens(text, config)
    }

    // Fallback to generic tokenizer
    return this.countTokensFallback(text, config)
  }

  private async countAnthropicTokens(
    text: string,
    config: TokenizerConfig
  ): Promise<TokenizerResult> {
    if (this.anthropicTokenizer) {
      try {
        const tokens = await this.anthropicTokenizer.countTokens(text)
        return {
          tokens,
          method: 'exact'
        }
      } catch (error) {
        return {
          tokens: this.estimateTokens(text),
          method: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Try tiktoken with cl100k_base encoding (close to Claude's tokenizer)
    if (this.tiktoken) {
      try {
        const encoding = this.tiktoken.get_encoding('cl100k_base')
        const tokens = encoding.encode(text).length
        encoding.free()
        return {
          tokens,
          method: 'approximate'
        }
      } catch (error) {
        return {
          tokens: this.estimateTokens(text),
          method: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return {
      tokens: this.estimateTokens(text),
      method: 'fallback'
    }
  }

  private async countOpenAITokens(
    text: string,
    config: TokenizerConfig
  ): Promise<TokenizerResult> {
    if (this.tiktoken) {
      try {
        // Get the appropriate encoding for the model
        const encoding = this.getOpenAIEncoding(config.model)
        const tokenizer = this.tiktoken.get_encoding(encoding)
        const tokens = tokenizer.encode(text).length
        tokenizer.free()
        return {
          tokens,
          method: 'exact'
        }
      } catch (error) {
        return {
          tokens: this.estimateTokens(text),
          method: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    if (this.gptTokenizer) {
      try {
        const tokens = this.gptTokenizer.encode(text).length
        return {
          tokens,
          method: 'approximate'
        }
      } catch (error) {
        return {
          tokens: this.estimateTokens(text),
          method: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return {
      tokens: this.estimateTokens(text),
      method: 'fallback'
    }
  }

  private async countGoogleTokens(
    text: string,
    config: TokenizerConfig
  ): Promise<TokenizerResult> {
    // Google doesn't have a public tokenizer, use approximation
    // Gemini models use a SentencePiece tokenizer similar to other models
    
    if (this.tiktoken) {
      try {
        // Use cl100k_base as approximation for Gemini
        const encoding = this.tiktoken.get_encoding('cl100k_base')
        const tokens = encoding.encode(text).length
        encoding.free()
        return {
          tokens,
          method: 'approximate'
        }
      } catch (error) {
        return {
          tokens: this.estimateTokens(text),
          method: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return {
      tokens: this.estimateTokens(text),
      method: 'fallback'
    }
  }

  private async countTokensFallback(
    text: string,
    config: TokenizerConfig
  ): Promise<TokenizerResult> {
    // Use the most appropriate tokenizer available
    if (this.tiktoken) {
      try {
        const encoding = this.tiktoken.get_encoding('cl100k_base')
        const tokens = encoding.encode(text).length
        encoding.free()
        return {
          tokens,
          method: 'approximate'
        }
      } catch (error) {
        return {
          tokens: this.estimateTokens(text),
          method: 'fallback',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return {
      tokens: this.estimateTokens(text),
      method: 'fallback'
    }
  }

  private getOpenAIEncoding(model: string): string {
    const modelLower = model.toLowerCase()
    
    if (modelLower.includes('gpt-4o') || modelLower.includes('gpt-4-turbo')) {
      return 'o200k_base'
    }
    
    if (modelLower.includes('gpt-4') || modelLower.includes('gpt-3.5')) {
      return 'cl100k_base'
    }
    
    if (modelLower.includes('gpt-3')) {
      return 'p50k_base'
    }
    
    // Default to cl100k_base for unknown models
    return 'cl100k_base'
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for most models
    // This is a conservative estimate that works reasonably well across providers
    return Math.ceil(text.length / 4)
  }

  public async analyzeTokenUsage(
    inputText: string,
    outputText: string,
    config: TokenizerConfig
  ): Promise<TokenAnalysis> {
    const inputResult = await this.countTokens(inputText, config)
    const outputResult = await this.countTokens(outputText, config)

    // Use the less accurate method as the overall estimation method
    const estimationMethod = inputResult.method === 'fallback' || outputResult.method === 'fallback' 
      ? 'fallback' 
      : inputResult.method === 'approximate' || outputResult.method === 'approximate'
      ? 'approximate'
      : 'exact'

    return {
      inputTokens: inputResult.tokens,
      outputTokens: outputResult.tokens,
      totalTokens: inputResult.tokens + outputResult.tokens,
      estimationMethod,
      provider: config.provider,
      model: config.model,
      timestamp: Date.now()
    }
  }

  public async analyzeFromMessages(
    messages: Array<{ role: string; content: string }>,
    response: string,
    config: TokenizerConfig
  ): Promise<TokenAnalysis> {
    // Combine all message content for input token counting
    const inputText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    return this.analyzeTokenUsage(inputText, response, config)
  }

  public async extractTokenUsageFromResponse(
    responseBody: any,
    provider: string
  ): Promise<TokenUsage | null> {
    if (!responseBody || typeof responseBody !== 'object') {
      return null
    }

    const providerLower = provider.toLowerCase()

    // Anthropic Claude response format
    if (providerLower === 'anthropic') {
      if (responseBody.usage) {
        return {
          inputTokens: responseBody.usage.input_tokens || 0,
          outputTokens: responseBody.usage.output_tokens || 0
        }
      }
    }

    // OpenAI response format
    if (providerLower === 'openai') {
      if (responseBody.usage) {
        return {
          inputTokens: responseBody.usage.prompt_tokens || 0,
          outputTokens: responseBody.usage.completion_tokens || 0
        }
      }
    }

    // Google response format (varies by API version)
    if (providerLower === 'google') {
      if (responseBody.usageMetadata) {
        return {
          inputTokens: responseBody.usageMetadata.promptTokenCount || 0,
          outputTokens: responseBody.usageMetadata.candidatesTokenCount || 0
        }
      }
      
      if (responseBody.usage) {
        return {
          inputTokens: responseBody.usage.promptTokenCount || 0,
          outputTokens: responseBody.usage.candidatesTokenCount || 0
        }
      }
    }

    return null
  }

  public async estimateFromRequest(
    requestBody: any,
    responseBody: any,
    config: TokenizerConfig
  ): Promise<TokenAnalysis | null> {
    try {
      // Try to extract exact token usage from response first
      const exactUsage = await this.extractTokenUsageFromResponse(responseBody, config.provider)
      
      if (exactUsage) {
        return {
          inputTokens: exactUsage.inputTokens,
          outputTokens: exactUsage.outputTokens,
          totalTokens: exactUsage.inputTokens + exactUsage.outputTokens,
          estimationMethod: 'exact',
          provider: config.provider,
          model: config.model,
          timestamp: Date.now()
        }
      }

      // Fall back to tokenizer-based estimation
      if (requestBody?.messages && responseBody?.content) {
        const inputText = Array.isArray(requestBody.messages)
          ? requestBody.messages.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')
          : ''
        
        const outputText = this.extractResponseText(responseBody)
        
        if (inputText && outputText) {
          return this.analyzeTokenUsage(inputText, outputText, config)
        }
      }

      return null
    } catch (error) {
      console.error('Error estimating token usage:', error)
      return null
    }
  }

  private extractResponseText(responseBody: any): string {
    if (typeof responseBody === 'string') {
      return responseBody
    }

    if (responseBody?.content) {
      if (typeof responseBody.content === 'string') {
        return responseBody.content
      }
      
      if (Array.isArray(responseBody.content)) {
        return responseBody.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('')
      }
    }

    if (responseBody?.choices?.[0]?.message?.content) {
      return responseBody.choices[0].message.content
    }

    if (responseBody?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return responseBody.candidates[0].content.parts[0].text
    }

    return JSON.stringify(responseBody)
  }

  public getTokenizerStatus(): {
    tiktoken: boolean
    anthropicTokenizer: boolean
    gptTokenizer: boolean
    initialized: boolean
  } {
    return {
      tiktoken: !!this.tiktoken,
      anthropicTokenizer: !!this.anthropicTokenizer,
      gptTokenizer: !!this.gptTokenizer,
      initialized: this.initialized
    }
  }

  public async validateTokenizers(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    const testText = "Hello, this is a test message for token counting validation."

    if (this.tiktoken) {
      try {
        const encoding = this.tiktoken.get_encoding('cl100k_base')
        const tokens = encoding.encode(testText)
        encoding.free()
        results.tiktoken = tokens.length > 0
      } catch {
        results.tiktoken = false
      }
    } else {
      results.tiktoken = false
    }

    if (this.anthropicTokenizer) {
      try {
        const tokens = await this.anthropicTokenizer.countTokens(testText)
        results.anthropicTokenizer = tokens > 0
      } catch {
        results.anthropicTokenizer = false
      }
    } else {
      results.anthropicTokenizer = false
    }

    if (this.gptTokenizer) {
      try {
        const tokens = this.gptTokenizer.encode(testText)
        results.gptTokenizer = tokens.length > 0
      } catch {
        results.gptTokenizer = false
      }
    } else {
      results.gptTokenizer = false
    }

    return results
  }
}