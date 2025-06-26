// Google Gemini provider-specific logic and utilities
import type { TokenUsage } from '../cost-calculator.js'

export interface GoogleMessage {
  role: 'user' | 'model'
  parts: Array<{
    text?: string
    inline_data?: {
      mime_type: string
      data: string
    }
    function_call?: {
      name: string
      args: any
    }
    function_response?: {
      name: string
      response: any
    }
  }>
}

export interface GoogleRequest {
  model?: string  // Can be in URL path
  contents: GoogleMessage[]
  generationConfig?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    stopSequences?: string[]
    candidateCount?: number
  }
  safetySettings?: Array<{
    category: string
    threshold: string
  }>
  tools?: Array<{
    functionDeclarations: Array<{
      name: string
      description?: string
      parameters: any
    }>
  }>
  systemInstruction?: {
    parts: Array<{
      text: string
    }>
  }
}

export interface GoogleResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string
        function_call?: {
          name: string
          args: any
        }
      }>
      role: 'model'
    }
    finishReason: 'FINISH_REASON_UNSPECIFIED' | 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER'
    index: number
    safetyRatings?: Array<{
      category: string
      probability: string
    }>
  }>
  promptFeedback?: {
    safetyRatings: Array<{
      category: string
      probability: string
    }>
  }
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export interface GoogleStreamChunk {
  candidates?: Array<{
    content?: {
      parts: Array<{
        text?: string
        function_call?: {
          name: string
          args: any
        }
      }>
      role: 'model'
    }
    finishReason?: string
    index: number
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export class GoogleAdapter {
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com'
  private static readonly MODELS = [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro'
  ]

  public static isGoogleRequest(url: string): boolean {
    return url.includes('generativelanguage.googleapis.com') || url.includes('ai.google.dev')
  }

  public static extractModel(requestBody: any, url: string): string {
    // Google Gemini uses URL-based model specification
    // e.g., https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent
    const urlMatch = url.match(/\/models\/([^:\/\?]+)/)
    if (urlMatch) {
      return urlMatch[1]
    }

    if (requestBody?.model && typeof requestBody.model === 'string') {
      return requestBody.model
    }

    return 'unknown'
  }

  public static extractMessages(requestBody: any): Array<{ role: string; content: string }> {
    if (!requestBody?.contents || !Array.isArray(requestBody.contents)) {
      return []
    }

    return requestBody.contents.map((msg: GoogleMessage) => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: this.extractMessageContent(msg.parts)
    }))
  }

  private static extractMessageContent(parts: GoogleMessage['parts']): string {
    if (!Array.isArray(parts)) {
      return ''
    }

    return parts
      .map(part => {
        if (part.text) {
          return part.text
        }
        if (part.function_call) {
          return `Function call: ${part.function_call.name}(${JSON.stringify(part.function_call.args)})`
        }
        if (part.function_response) {
          return `Function response: ${part.function_response.name}`
        }
        return ''
      })
      .filter(text => text.length > 0)
      .join(' ')
  }

  public static extractTokenUsage(responseBody: any): TokenUsage | null {
    if (responseBody?.usageMetadata) {
      return {
        inputTokens: responseBody.usageMetadata.promptTokenCount || 0,
        outputTokens: responseBody.usageMetadata.candidatesTokenCount || 0
      }
    }

    // Alternative field names
    if (responseBody?.usage) {
      return {
        inputTokens: responseBody.usage.promptTokenCount || 0,
        outputTokens: responseBody.usage.candidatesTokenCount || 0
      }
    }

    return null
  }

  public static extractResponseText(responseBody: any): string {
    if (responseBody?.candidates?.[0]?.content?.parts) {
      return responseBody.candidates[0].content.parts
        .filter((part: any) => part.text)
        .map((part: any) => part.text)
        .join('')
    }
    return ''
  }

  public static isStreamingResponse(headers: Record<string, string>): boolean {
    const contentType = headers['content-type'] || ''
    return contentType.includes('application/x-ndjson') || contentType.includes('text/plain')
  }

  public static parseStreamChunk(line: string): GoogleStreamChunk | null {
    try {
      // Google uses newline-delimited JSON
      if (line.trim()) {
        return JSON.parse(line) as GoogleStreamChunk
      }
      return null
    } catch (error) {
      console.warn('Failed to parse Google stream chunk:', line, error)
      return null
    }
  }

  public static mergeStreamChunks(chunks: GoogleStreamChunk[]): Partial<GoogleResponse> {
    const merged: Partial<GoogleResponse> = {
      candidates: [],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }
    }

    for (const chunk of chunks) {
      if (chunk.candidates) {
        for (let i = 0; i < chunk.candidates.length; i++) {
          const candidate = chunk.candidates[i]
          
          // Ensure candidate exists in merged response
          while (merged.candidates!.length <= i) {
            merged.candidates!.push({
              content: { parts: [], role: 'model' },
              finishReason: 'FINISH_REASON_UNSPECIFIED',
              index: merged.candidates!.length
            })
          }

          const mergedCandidate = merged.candidates![i]

          // Merge content parts
          if (candidate.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.text) {
                // Find existing text part or create new one
                let textPart = mergedCandidate.content.parts.find(p => p.text !== undefined)
                if (!textPart) {
                  textPart = { text: '' }
                  mergedCandidate.content.parts.push(textPart)
                }
                textPart.text = (textPart.text || '') + part.text
              } else if (part.function_call) {
                // Add function calls as separate parts
                mergedCandidate.content.parts.push(part)
              }
            }
          }

          // Update finish reason
          if (candidate.finishReason) {
            mergedCandidate.finishReason = candidate.finishReason as any
          }
        }
      }

      // Update usage metadata
      if (chunk.usageMetadata) {
        merged.usageMetadata = chunk.usageMetadata
      }
    }

    return merged
  }

  public static estimateTokens(text: string): number {
    // Google Gemini uses SentencePiece tokenizer
    // Rough estimation: ~4 characters per token (similar to other models)
    return Math.ceil(text.length / 4)
  }

  public static validateRequest(requestBody: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!requestBody?.contents || !Array.isArray(requestBody.contents)) {
      errors.push('Missing or invalid field: contents')
    } else if (requestBody.contents.length === 0) {
      errors.push('Contents array cannot be empty')
    }

    // Validate message structure
    if (requestBody.contents) {
      for (let i = 0; i < requestBody.contents.length; i++) {
        const content = requestBody.contents[i]
        if (!content.role || !['user', 'model'].includes(content.role)) {
          errors.push(`Invalid role in content ${i}: ${content.role}`)
        }
        if (!content.parts || !Array.isArray(content.parts)) {
          errors.push(`Missing or invalid parts in content ${i}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  public static sanitizeRequest(requestBody: any): any {
    const sanitized = { ...requestBody }

    // Truncate long content if needed
    if (sanitized.contents) {
      sanitized.contents = sanitized.contents.map((content: any) => {
        if (content.parts) {
          content.parts = content.parts.map((part: any) => {
            if (part.text && part.text.length > 10000) {
              return {
                ...part,
                text: part.text.substring(0, 10000) + '... [truncated]'
              }
            }
            return part
          })
        }
        return content
      })
    }

    return sanitized
  }

  public static estimateCost(inputTokens: number, outputTokens: number, model: string): number {
    // Pricing as of December 2024 (per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.0-flash-exp': { input: 0.00, output: 0.00 },  // Free tier
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
      'gemini-pro': { input: 0.0005, output: 0.0015 }
    }

    const modelPricing = pricing[model]
    if (!modelPricing) {
      return 0
    }

    const inputCost = (inputTokens / 1000) * modelPricing.input
    const outputCost = (outputTokens / 1000) * modelPricing.output

    return inputCost + outputCost
  }

  public static extractSystemInstruction(requestBody: any): string | null {
    if (requestBody?.systemInstruction?.parts?.[0]?.text) {
      return requestBody.systemInstruction.parts[0].text
    }
    return null
  }

  public static getModelCapabilities(model: string): {
    maxTokens: number
    supportsVision: boolean
    supportsFunctionCalling: boolean
    contextWindow: number
  } {
    const capabilities: Record<string, any> = {
      'gemini-2.0-flash-exp': {
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 1000000
      },
      'gemini-1.5-pro': {
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 2000000
      },
      'gemini-1.5-flash': {
        maxTokens: 8192,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 1000000
      },
      'gemini-pro': {
        maxTokens: 2048,
        supportsVision: false,
        supportsFunctionCalling: true,
        contextWindow: 32768
      }
    }

    return capabilities[model] || {
      maxTokens: 2048,
      supportsVision: false,
      supportsFunctionCalling: false,
      contextWindow: 32768
    }
  }

  public static formatForLogging(data: any): any {
    // Format Google-specific data for consistent logging
    const formatted = { ...data }

    if (formatted.contents) {
      formatted.contents = formatted.contents.map((content: any) => ({
        role: content.role,
        parts: content.parts?.map((part: any) => ({
          text: part.text,
          function_call: part.function_call,
          function_response: part.function_response
        }))
      }))
    }

    if (formatted.candidates) {
      formatted.candidates = formatted.candidates.map((candidate: any) => ({
        content: candidate.content,
        finishReason: candidate.finishReason,
        index: candidate.index
      }))
    }

    return formatted
  }

  public static extractFunctionCalls(responseBody: any): Array<{ name: string; arguments: any }> {
    const functionCalls: Array<{ name: string; arguments: any }> = []

    if (responseBody?.candidates?.[0]?.content?.parts) {
      for (const part of responseBody.candidates[0].content.parts) {
        if (part.function_call) {
          functionCalls.push({
            name: part.function_call.name,
            arguments: part.function_call.args
          })
        }
      }
    }

    return functionCalls
  }

  public static convertToStandardFormat(googleResponse: GoogleResponse): any {
    // Convert Google response format to a more standard format for consistent processing
    const choices = googleResponse.candidates.map(candidate => ({
      index: candidate.index,
      message: {
        role: 'assistant',
        content: candidate.content.parts
          .filter(part => part.text)
          .map(part => part.text)
          .join(''),
        function_calls: candidate.content.parts
          .filter(part => part.function_call)
          .map(part => part.function_call)
      },
      finish_reason: this.mapFinishReason(candidate.finishReason)
    }))

    return {
      choices,
      usage: googleResponse.usageMetadata ? {
        prompt_tokens: googleResponse.usageMetadata.promptTokenCount,
        completion_tokens: googleResponse.usageMetadata.candidatesTokenCount,
        total_tokens: googleResponse.usageMetadata.totalTokenCount
      } : undefined
    }
  }

  private static mapFinishReason(reason: string): string {
    const mapping: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'stop'
    }
    return mapping[reason] || 'stop'
  }
}