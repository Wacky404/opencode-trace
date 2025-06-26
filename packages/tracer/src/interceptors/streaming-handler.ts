// Streaming response handler for real-time AI response capture
import type { TraceEvent, AIResponseEvent, RequestTiming } from '../types.js'
import type { JSONLLogger } from '../logger.js'
import type { ProviderInfo } from './ai-provider.js'

export interface StreamingConfig {
  sessionId: string
  logger: JSONLLogger
  captureIntermediateChunks?: boolean
  maxChunkSize?: number
  logFinalResponseOnly?: boolean
}

export interface StreamChunk {
  id: string
  data: any
  timestamp: number
  chunkIndex: number
  isFinal: boolean
}

export interface StreamCapture {
  streamId: string
  chunks: StreamChunk[]
  startTime: number
  endTime?: number
  finalResponse?: any
  provider: ProviderInfo
  model: string
  totalChunks: number
}

export class StreamingHandler {
  private config: StreamingConfig
  private activeStreams: Map<string, StreamCapture>

  constructor(config: StreamingConfig) {
    this.config = config
    this.activeStreams = new Map()
  }

  public async handleStreamingResponse(
    response: Response,
    provider: ProviderInfo,
    model: string,
    timing: RequestTiming
  ): Promise<Response> {
    // Check if response is actually streaming
    if (!this.isStreamingResponse(response)) {
      return response
    }

    const streamId = this.generateStreamId()
    const streamCapture: StreamCapture = {
      streamId,
      chunks: [],
      startTime: timing.start,
      provider,
      model,
      totalChunks: 0
    }

    this.activeStreams.set(streamId, streamCapture)

    // Create a new ReadableStream that captures chunks while passing them through
    const capturedStream = new ReadableStream({
      start: (controller) => {
        this.processStream(response, controller, streamCapture)
      }
    })

    // Return a new Response with the captured stream
    return new Response(capturedStream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }

  private async processStream(
    response: Response,
    controller: ReadableStreamDefaultController,
    streamCapture: StreamCapture
  ): Promise<void> {
    const reader = response.body?.getReader()
    if (!reader) {
      controller.close()
      return
    }

    const decoder = new TextDecoder()
    let chunkIndex = 0
    let buffer = ''
    let finalResponse: any = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          // Process any remaining buffer content
          if (buffer.trim()) {
            await this.processBufferContent(buffer, streamCapture, chunkIndex, true)
          }
          
          // Finalize stream capture
          streamCapture.endTime = Date.now()
          streamCapture.totalChunks = chunkIndex
          streamCapture.finalResponse = finalResponse

          // Log final streaming response event
          await this.logStreamingResponseEvent(streamCapture)
          
          // Clean up
          this.activeStreams.delete(streamCapture.streamId)
          controller.close()
          break
        }

        // Decode chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Process complete lines from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            const processedChunk = await this.processStreamLine(line, streamCapture, chunkIndex)
            if (processedChunk) {
              finalResponse = this.mergeFinalResponse(finalResponse, processedChunk)
              chunkIndex++
            }
          }
        }

        // Pass the original chunk through to the consumer
        controller.enqueue(value)
      }
    } catch (error) {
      console.error('Error processing stream:', error)
      controller.error(error)
      
      // Log error and clean up
      await this.logStreamingErrorEvent(streamCapture, error)
      this.activeStreams.delete(streamCapture.streamId)
    }
  }

  private async processBufferContent(
    buffer: string,
    streamCapture: StreamCapture,
    chunkIndex: number,
    isFinal: boolean
  ): Promise<void> {
    const lines = buffer.split('\n')
    for (const line of lines) {
      if (line.trim()) {
        await this.processStreamLine(line, streamCapture, chunkIndex, isFinal)
      }
    }
  }

  private async processStreamLine(
    line: string,
    streamCapture: StreamCapture,
    chunkIndex: number,
    isFinal: boolean = false
  ): Promise<any> {
    try {
      // Handle Server-Sent Events format
      if (line.startsWith('data: ')) {
        const data = line.slice(6) // Remove 'data: ' prefix
        
        if (data === '[DONE]') {
          return null // Stream completion marker
        }

        const parsedData = JSON.parse(data)
        
        // Create chunk record
        const chunk: StreamChunk = {
          id: this.generateChunkId(),
          data: parsedData,
          timestamp: Date.now(),
          chunkIndex,
          isFinal
        }

        streamCapture.chunks.push(chunk)

        // Log intermediate chunks if configured
        if (this.config.captureIntermediateChunks && !this.config.logFinalResponseOnly) {
          await this.logStreamChunkEvent(streamCapture, chunk)
        }

        return parsedData
      }

      // Handle raw JSON lines
      const parsedData = JSON.parse(line)
      
      const chunk: StreamChunk = {
        id: this.generateChunkId(),
        data: parsedData,
        timestamp: Date.now(),
        chunkIndex,
        isFinal
      }

      streamCapture.chunks.push(chunk)

      if (this.config.captureIntermediateChunks && !this.config.logFinalResponseOnly) {
        await this.logStreamChunkEvent(streamCapture, chunk)
      }

      return parsedData

    } catch (error) {
      // Log parsing errors but continue processing
      console.warn('Failed to parse stream line:', line, error)
      return null
    }
  }

  private mergeFinalResponse(existing: any, newChunk: any): any {
    if (!existing) {
      return newChunk
    }

    // Provider-specific merging logic
    if (newChunk.choices) {
      // OpenAI format
      return this.mergeOpenAIResponse(existing, newChunk)
    } else if (newChunk.content || newChunk.delta) {
      // Anthropic format
      return this.mergeAnthropicResponse(existing, newChunk)
    } else if (newChunk.candidates) {
      // Google format
      return this.mergeGoogleResponse(existing, newChunk)
    }

    // Generic merge - just overlay properties
    return { ...existing, ...newChunk }
  }

  private mergeOpenAIResponse(existing: any, newChunk: any): any {
    const merged = { ...existing }
    
    if (newChunk.choices) {
      merged.choices = merged.choices || []
      
      for (const newChoice of newChunk.choices) {
        const existingChoice = merged.choices[newChoice.index] || {}
        
        if (newChoice.delta?.content) {
          existingChoice.message = existingChoice.message || { content: '', role: 'assistant' }
          existingChoice.message.content += newChoice.delta.content
        }
        
        if (newChoice.finish_reason) {
          existingChoice.finish_reason = newChoice.finish_reason
        }

        merged.choices[newChoice.index] = existingChoice
      }
    }

    if (newChunk.usage) {
      merged.usage = newChunk.usage
    }

    return merged
  }

  private mergeAnthropicResponse(existing: any, newChunk: any): any {
    const merged = { ...existing }

    if (newChunk.content) {
      merged.content = merged.content || []
      
      for (const contentBlock of newChunk.content) {
        if (contentBlock.type === 'text') {
          const existingBlock = merged.content.find((block: any) => 
            block.type === 'text' && block.index === contentBlock.index
          )
          
          if (existingBlock) {
            existingBlock.text += contentBlock.text || ''
          } else {
            merged.content.push(contentBlock)
          }
        }
      }
    }

    if (newChunk.delta?.text) {
      merged.content = merged.content || [{ type: 'text', text: '' }]
      merged.content[0].text += newChunk.delta.text
    }

    if (newChunk.usage) {
      merged.usage = newChunk.usage
    }

    return merged
  }

  private mergeGoogleResponse(existing: any, newChunk: any): any {
    const merged = { ...existing }

    if (newChunk.candidates) {
      merged.candidates = merged.candidates || []
      
      for (let i = 0; i < newChunk.candidates.length; i++) {
        const newCandidate = newChunk.candidates[i]
        const existingCandidate = merged.candidates[i] || {}

        if (newCandidate.content?.parts) {
          existingCandidate.content = existingCandidate.content || { parts: [] }
          
          for (let j = 0; j < newCandidate.content.parts.length; j++) {
            const newPart = newCandidate.content.parts[j]
            const existingPart = existingCandidate.content.parts[j] || {}

            if (newPart.text) {
              existingPart.text = (existingPart.text || '') + newPart.text
            }

            existingCandidate.content.parts[j] = existingPart
          }
        }

        merged.candidates[i] = existingCandidate
      }
    }

    if (newChunk.usageMetadata) {
      merged.usageMetadata = newChunk.usageMetadata
    }

    return merged
  }

  private isStreamingResponse(response: Response): boolean {
    const contentType = response.headers.get('content-type') || ''
    return contentType.includes('text/event-stream') || 
           contentType.includes('application/x-ndjson') ||
           contentType.includes('text/plain') // Some providers use text/plain for streams
  }

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async logStreamChunkEvent(
    streamCapture: StreamCapture,
    chunk: StreamChunk
  ): Promise<void> {
    const event: TraceEvent = {
      type: 'ai_stream_chunk',
      timestamp: chunk.timestamp,
      session_id: this.config.sessionId,
      // Add stream-specific data
      ...{
        stream_id: streamCapture.streamId,
        chunk_index: chunk.chunkIndex,
        chunk_id: chunk.id,
        provider: streamCapture.provider.name,
        model: streamCapture.model,
        data: this.config.maxChunkSize 
          ? this.truncateChunkData(chunk.data) 
          : chunk.data
      }
    }

    await this.config.logger.logEvent(event)
  }

  private async logStreamingResponseEvent(streamCapture: StreamCapture): Promise<void> {
    const event: AIResponseEvent = {
      type: 'ai_response',
      timestamp: streamCapture.endTime || Date.now(),
      session_id: this.config.sessionId,
      provider: streamCapture.provider.name,
      model: streamCapture.model,
      response: {
        ...streamCapture.finalResponse,
        _streaming: true,
        _stream_id: streamCapture.streamId,
        _total_chunks: streamCapture.totalChunks,
        _stream_duration: streamCapture.endTime ? 
          streamCapture.endTime - streamCapture.startTime : 0
      }
    }

    await this.config.logger.logEvent(event)
  }

  private async logStreamingErrorEvent(
    streamCapture: StreamCapture,
    error: any
  ): Promise<void> {
    const event: TraceEvent = {
      type: 'ai_stream_error',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      ...{
        stream_id: streamCapture.streamId,
        provider: streamCapture.provider.name,
        model: streamCapture.model,
        error: error instanceof Error ? error.message : 'Unknown streaming error',
        chunks_processed: streamCapture.chunks.length
      }
    }

    await this.config.logger.logEvent(event)
  }

  private truncateChunkData(data: any): any {
    if (!this.config.maxChunkSize) return data
    
    const dataStr = JSON.stringify(data)
    if (dataStr.length <= this.config.maxChunkSize) {
      return data
    }
    
    return {
      ...data,
      _truncated: true,
      _originalSize: dataStr.length,
      _truncatedAt: this.config.maxChunkSize
    }
  }

  public getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys())
  }

  public getStreamStatus(streamId: string): StreamCapture | null {
    return this.activeStreams.get(streamId) || null
  }

  public async cleanup(): Promise<void> {
    // Force close any remaining active streams
    for (const [streamId, capture] of this.activeStreams) {
      if (!capture.endTime) {
        capture.endTime = Date.now()
        await this.logStreamingResponseEvent(capture)
      }
    }
    this.activeStreams.clear()
  }
}