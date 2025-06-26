// OpenAI provider-specific logic and utilities
import type { TokenUsage } from '../cost-calculator.js'

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool'
  content: string | null
  name?: string
  function_call?: {
    name: string
    arguments: string
  }
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
  tool_call_id?: string
}

export interface OpenAIRequest {
  model: string
  messages: OpenAIMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  n?: number
  stream?: boolean
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  logit_bias?: Record<string, number>
  user?: string
  functions?: Array<{
    name: string
    description?: string
    parameters: any
  }>
  function_call?: 'auto' | 'none' | { name: string }
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description?: string
      parameters: any
    }
  }>
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } }
}

export interface OpenAIResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: OpenAIMessage
    finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  system_fingerprint?: string
}

export interface OpenAIStreamChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant'
      content?: string
      function_call?: {
        name?: string
        arguments?: string
      }
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter'
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class OpenAIAdapter {
  private static readonly API_BASE = 'https://api.openai.com'
  private static readonly MODELS = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ]

  public static isOpenAIRequest(url: string): boolean {
    return url.includes('api.openai.com')
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

    return requestBody.messages.map((msg: OpenAIMessage) => ({
      role: msg.role,
      content: this.extractMessageContent(msg)
    }))
  }

  private static extractMessageContent(message: OpenAIMessage): string {
    if (typeof message.content === 'string') {
      return message.content
    }

    // Handle function calls and tool calls
    let content = ''
    
    if (message.function_call) {
      content += `Function call: ${message.function_call.name}(${message.function_call.arguments})`
    }

    if (message.tool_calls) {
      content += message.tool_calls
        .map(call => `Tool call: ${call.function.name}(${call.function.arguments})`)
        .join('; ')
    }

    return content || message.content || ''
  }

  public static extractTokenUsage(responseBody: any): TokenUsage | null {
    if (responseBody?.usage) {
      return {
        inputTokens: responseBody.usage.prompt_tokens || 0,
        outputTokens: responseBody.usage.completion_tokens || 0
      }
    }
    return null
  }

  public static extractResponseText(responseBody: any): string {
    if (responseBody?.choices?.[0]?.message?.content) {
      return responseBody.choices[0].message.content
    }

    // Handle function calls
    if (responseBody?.choices?.[0]?.message?.function_call) {
      const funcCall = responseBody.choices[0].message.function_call
      return `Function call: ${funcCall.name}(${funcCall.arguments})`
    }

    // Handle tool calls
    if (responseBody?.choices?.[0]?.message?.tool_calls) {
      return responseBody.choices[0].message.tool_calls
        .map((call: any) => `Tool call: ${call.function.name}(${call.function.arguments})`)
        .join('; ')
    }

    return ''
  }

  public static isStreamingResponse(headers: Record<string, string>): boolean {
    const contentType = headers['content-type'] || ''
    return contentType.includes('text/event-stream')
  }

  public static parseStreamChunk(line: string): OpenAIStreamChunk | null {
    try {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          return null
        }
        return JSON.parse(data) as OpenAIStreamChunk
      }
      return null
    } catch (error) {
      console.warn('Failed to parse OpenAI stream chunk:', line, error)
      return null
    }
  }

  public static mergeStreamChunks(chunks: OpenAIStreamChunk[]): Partial<OpenAIResponse> {
    const merged: Partial<OpenAIResponse> = {
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    }

    // Use the first chunk for metadata
    if (chunks.length > 0) {
      const firstChunk = chunks[0]
      merged.id = firstChunk.id
      merged.object = 'chat.completion'
      merged.created = firstChunk.created
      merged.model = firstChunk.model
    }

    // Merge all deltas
    for (const chunk of chunks) {
      for (const choice of chunk.choices) {
        // Ensure choice exists in merged response
        while (merged.choices!.length <= choice.index) {
          merged.choices!.push({
            index: merged.choices!.length,
            message: { role: 'assistant', content: '' },
            finish_reason: null as any
          })
        }

        const mergedChoice = merged.choices![choice.index]

        // Merge content
        if (choice.delta.content) {
          mergedChoice.message.content = (mergedChoice.message.content || '') + choice.delta.content
        }

        // Merge function calls
        if (choice.delta.function_call) {
          mergedChoice.message.function_call = mergedChoice.message.function_call || { name: '', arguments: '' }
          if (choice.delta.function_call.name) {
            mergedChoice.message.function_call.name += choice.delta.function_call.name
          }
          if (choice.delta.function_call.arguments) {
            mergedChoice.message.function_call.arguments += choice.delta.function_call.arguments
          }
        }

        // Merge tool calls
        if (choice.delta.tool_calls) {
          mergedChoice.message.tool_calls = mergedChoice.message.tool_calls || []
          
          for (const toolCall of choice.delta.tool_calls) {
            while (mergedChoice.message.tool_calls.length <= toolCall.index) {
              mergedChoice.message.tool_calls.push({
                id: '',
                type: 'function',
                function: { name: '', arguments: '' }
              })
            }

            const mergedToolCall = mergedChoice.message.tool_calls[toolCall.index]
            
            if (toolCall.id) {
              mergedToolCall.id = toolCall.id
            }
            if (toolCall.function?.name) {
              mergedToolCall.function.name += toolCall.function.name
            }
            if (toolCall.function?.arguments) {
              mergedToolCall.function.arguments += toolCall.function.arguments
            }
          }
        }

        // Set finish reason
        if (choice.finish_reason) {
          mergedChoice.finish_reason = choice.finish_reason
        }
      }

      // Update usage if provided
      if (chunk.usage) {
        merged.usage = chunk.usage
      }
    }

    return merged
  }

  public static estimateTokens(text: string, model: string): number {
    // Different models use different tokenizers
    const modelLower = model.toLowerCase()
    
    if (modelLower.includes('gpt-4o')) {
      // o200k_base encoding - roughly 3.5 chars per token
      return Math.ceil(text.length / 3.5)
    } else if (modelLower.includes('gpt-4') || modelLower.includes('gpt-3.5')) {
      // cl100k_base encoding - roughly 4 chars per token
      return Math.ceil(text.length / 4)
    } else {
      // Default estimation
      return Math.ceil(text.length / 4)
    }
  }

  public static validateRequest(requestBody: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!requestBody?.model) {
      errors.push('Missing required field: model')
    }

    if (!requestBody?.messages || !Array.isArray(requestBody.messages)) {
      errors.push('Missing or invalid field: messages')
    } else if (requestBody.messages.length === 0) {
      errors.push('Messages array cannot be empty')
    }

    // Validate message structure
    if (requestBody.messages) {
      for (let i = 0; i < requestBody.messages.length; i++) {
        const msg = requestBody.messages[i]
        if (!msg.role || !['system', 'user', 'assistant', 'function', 'tool'].includes(msg.role)) {
          errors.push(`Invalid role in message ${i}: ${msg.role}`)
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

    // Remove or redact sensitive fields
    if (sanitized.user) {
      sanitized.user = '***'
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
      'gpt-4o': { input: 0.0025, output: 0.01 },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    }

    const modelPricing = pricing[model]
    if (!modelPricing) {
      return 0
    }

    const inputCost = (inputTokens / 1000) * modelPricing.input
    const outputCost = (outputTokens / 1000) * modelPricing.output

    return inputCost + outputCost
  }

  public static getModelCapabilities(model: string): {
    maxTokens: number
    supportsVision: boolean
    supportsFunctionCalling: boolean
    contextWindow: number
  } {
    const capabilities: Record<string, any> = {
      'gpt-4o': {
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 128000
      },
      'gpt-4o-mini': {
        maxTokens: 16384,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 128000
      },
      'gpt-4-turbo': {
        maxTokens: 4096,
        supportsVision: true,
        supportsFunctionCalling: true,
        contextWindow: 128000
      },
      'gpt-4': {
        maxTokens: 4096,
        supportsVision: false,
        supportsFunctionCalling: true,
        contextWindow: 8192
      },
      'gpt-3.5-turbo': {
        maxTokens: 4096,
        supportsVision: false,
        supportsFunctionCalling: true,
        contextWindow: 16385
      }
    }

    return capabilities[model] || {
      maxTokens: 4096,
      supportsVision: false,
      supportsFunctionCalling: false,
      contextWindow: 4096
    }
  }

  public static formatForLogging(data: any): any {
    // Format OpenAI-specific data for consistent logging
    const formatted = { ...data }

    if (formatted.messages) {
      formatted.messages = formatted.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content || '',
        function_call: msg.function_call,
        tool_calls: msg.tool_calls
      }))
    }

    if (formatted.choices) {
      formatted.choices = formatted.choices.map((choice: any) => ({
        index: choice.index,
        message: choice.message,
        finish_reason: choice.finish_reason
      }))
    }

    return formatted
  }

  public static extractFunctionCalls(responseBody: any): Array<{ name: string; arguments: any }> {
    const functionCalls: Array<{ name: string; arguments: any }> = []

    if (responseBody?.choices?.[0]?.message?.function_call) {
      const funcCall = responseBody.choices[0].message.function_call
      try {
        functionCalls.push({
          name: funcCall.name,
          arguments: JSON.parse(funcCall.arguments || '{}')
        })
      } catch {
        functionCalls.push({
          name: funcCall.name,
          arguments: funcCall.arguments
        })
      }
    }

    if (responseBody?.choices?.[0]?.message?.tool_calls) {
      for (const toolCall of responseBody.choices[0].message.tool_calls) {
        try {
          functionCalls.push({
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments || '{}')
          })
        } catch {
          functionCalls.push({
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          })
        }
      }
    }

    return functionCalls
  }
}