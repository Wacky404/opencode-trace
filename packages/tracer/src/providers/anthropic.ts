// Anthropic Claude provider-specific logic and utilities
import type { TokenUsage } from '../cost-calculator.js'

export interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{
    type: 'text' | 'image'
    text?: string
    source?: {
      type: 'base64'
      media_type: string
      data: string
    }
  }>
}

export interface AnthropicRequest {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number
  temperature?: number
  top_p?: number
  top_k?: number
  stop_sequences?: string[]
  stream?: boolean
  system?: string
  metadata?: {
    user_id?: string
    [key: string]: any
  }
}

export interface AnthropicResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<{
    type: 'text'
    text: string
  }>
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence'
  stop_sequence?: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export interface AnthropicStreamChunk {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop'
  message?: Partial<AnthropicResponse>
  content_block?: {
    type: 'text'
    text: string
  }
  delta?: {
    type: 'text_delta'
    text: string
  }
  index?: number
  usage?: {
    output_tokens: number
  }
}

export class AnthropicAdapter {
  private static readonly API_BASE = 'https://api.anthropic.com'
  private static readonly MODELS = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ]

  public static isAnthropicRequest(url: string): boolean {
    return url.includes('api.anthropic.com')
  }

  public static extractModel(requestBody: any): string {
    if (requestBody?.model && typeof requestBody.model === 'string') {
      return requestBody.model
    }
    return 'unknown'
  }

  public static extractMessages(requestBody: any): Array<{ role: string; content: string }> {
    if (!requestBody?.messages || !Array.isArray(requestBody.messages)) {
      return []
    }

    return requestBody.messages.map((msg: AnthropicMessage) => ({
      role: msg.role,
      content: this.extractMessageContent(msg.content)
    }))
  }

  private static extractMessageContent(content: AnthropicMessage['content']): string {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text || '')
        .join('')
    }

    return ''
  }

  public static extractTokenUsage(responseBody: any): TokenUsage | null {
    if (responseBody?.usage) {
      return {
        inputTokens: responseBody.usage.input_tokens || 0,
        outputTokens: responseBody.usage.output_tokens || 0
      }
    }
    return null
  }

  public static extractResponseText(responseBody: any): string {
    if (responseBody?.content && Array.isArray(responseBody.content)) {
      return responseBody.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('')
    }
    return ''
  }

  public static isStreamingResponse(headers: Record<string, string>): boolean {
    const contentType = headers['content-type'] || ''
    return contentType.includes('text/event-stream')
  }

  public static parseStreamChunk(line: string): AnthropicStreamChunk | null {
    try {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          return null
        }
        return JSON.parse(data) as AnthropicStreamChunk
      }
      return null
    } catch (error) {
      console.warn('Failed to parse Anthropic stream chunk:', line, error)
      return null
    }
  }

  public static mergeStreamChunks(chunks: AnthropicStreamChunk[]): Partial<AnthropicResponse> {
    const merged: Partial<AnthropicResponse> = {
      content: [],
      usage: { input_tokens: 0, output_tokens: 0 }
    }

    for (const chunk of chunks) {
      switch (chunk.type) {
        case 'message_start':
          if (chunk.message) {
            Object.assign(merged, chunk.message)
          }
          break

        case 'content_block_start':
          if (chunk.content_block) {
            merged.content = merged.content || []
            merged.content.push(chunk.content_block)
          }
          break

        case 'content_block_delta':
          if (chunk.delta && chunk.index !== undefined) {
            merged.content = merged.content || []
            if (!merged.content[chunk.index]) {
              merged.content[chunk.index] = { type: 'text', text: '' }
            }
            merged.content[chunk.index].text += chunk.delta.text || ''
          }
          break

        case 'message_delta':
          if (chunk.delta && merged.usage) {
            merged.usage.output_tokens = chunk.usage?.output_tokens || 0
          }
          break

        case 'message_stop':
          // Final chunk, no additional processing needed
          break
      }
    }

    return merged
  }

  public static estimateTokens(text: string): number {
    // Anthropic's tokenizer is similar to GPT-4's cl100k_base
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  public static validateRequest(requestBody: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!requestBody?.model) {
      errors.push('Missing required field: model')
    } else if (!this.MODELS.includes(requestBody.model)) {
      errors.push(`Unsupported model: ${requestBody.model}`)
    }

    if (!requestBody?.messages || !Array.isArray(requestBody.messages)) {
      errors.push('Missing or invalid field: messages')
    } else if (requestBody.messages.length === 0) {
      errors.push('Messages array cannot be empty')
    }

    if (!requestBody?.max_tokens || typeof requestBody.max_tokens !== 'number') {
      errors.push('Missing or invalid field: max_tokens')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  public static sanitizeRequest(requestBody: any): any {
    const sanitized = { ...requestBody }

    // Remove or redact sensitive fields
    if (sanitized.metadata?.user_id) {
      sanitized.metadata.user_id = '***'
    }

    // Truncate long content if needed
    if (sanitized.messages) {
      sanitized.messages = sanitized.messages.map((msg: any) => {
        if (typeof msg.content === 'string' && msg.content.length > 10000) {
          return {
            ...msg,
            content: msg.content.substring(0, 10000) + '... [truncated]'
          }
        }
        return msg
      })
    }

    return sanitized
  }

  public static estimateCost(inputTokens: number, outputTokens: number, model: string): number {
    // Pricing as of December 2024 (per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-5-haiku-20241022': { input: 0.001, output: 0.005 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
    }

    const modelPricing = pricing[model]
    if (!modelPricing) {
      return 0
    }

    const inputCost = (inputTokens / 1000) * modelPricing.input
    const outputCost = (outputTokens / 1000) * modelPricing.output

    return inputCost + outputCost
  }

  public static extractSystemPrompt(requestBody: any): string | null {
    return requestBody?.system || null
  }

  public static getModelCapabilities(model: string): {
    maxTokens: number
    supportsVision: boolean
    supportsFunctionCalling: boolean
    contextWindow: number
  } {
    const capabilities: Record<string, any> = {
      'claude-3-5-sonnet-20241022': {
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 200000
      },
      'claude-3-5-haiku-20241022': {
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 200000
      },
      'claude-3-opus-20240229': {
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctionCalling: false,
        contextWindow: 200000
      },
      'claude-3-sonnet-20240229': {
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctionCalling: false,
        contextWindow: 200000
      },
      'claude-3-haiku-20240307': {
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctionCalling: false,
        contextWindow: 200000
      }
    }

    return capabilities[model] || {
      maxTokens: 4096,
      supportsVision: false,
      supportsFunctionCalling: false,
      contextWindow: 100000
    }
  }

  public static formatForLogging(data: any): any {
    // Format Anthropic-specific data for consistent logging
    const formatted = { ...data }

    if (formatted.messages) {
      formatted.messages = formatted.messages.map((msg: any) => ({
        role: msg.role,
        content: typeof msg.content === 'string' 
          ? msg.content 
          : JSON.stringify(msg.content)
      }))
    }

    if (formatted.content) {
      formatted.content = formatted.content.map((block: any) => ({
        type: block.type,
        text: block.text || ''
      }))
    }

    return formatted
  }
}