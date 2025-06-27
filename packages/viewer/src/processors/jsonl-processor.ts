import type { 
  RawTraceEvent, 
  TraceEvent, 
  ValidationResult, 
  ParseOptions,
  TraceMetadata,
  ErrorDetails
} from '../types/trace.js';

/**
 * JSONL processor for parsing and validating OpenAI trace files
 * Handles streaming parsing, validation, and error recovery
 */
export class JSONLProcessor {
  private options: Required<ParseOptions>;
  private lineNumber = 0;
  private bytesProcessed = 0;
  private errors: ErrorDetails[] = [];

  constructor(options: Partial<ParseOptions> = {}) {
    this.options = {
      strict: true,
      maxErrors: 100,
      skipInvalidLines: false,
      validateSchema: true,
      encoding: 'utf-8',
      bufferSize: 64 * 1024, // 64KB chunks
      ...options
    };
  }

  /**
   * Parse complete JSONL content from string
   */
  async parseContent(content: string): Promise<ValidationResult> {
    this.reset();
    
    const lines = content.split('\n');
    const events: TraceEvent[] = [];
    const metadata: TraceMetadata = {
      totalLines: lines.length,
      validLines: 0,
      invalidLines: 0,
      totalBytes: content.length,
      processingTime: 0,
      firstEventTime: null,
      lastEventTime: null
    };

    const startTime = performance.now();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      this.lineNumber = i + 1;
      this.bytesProcessed += line.length + 1; // +1 for newline

      if (line === '') continue;

      try {
        const event = await this.parseLine(line);
        if (event) {
          events.push(event);
          metadata.validLines++;
          
          // Track timing
          if (!metadata.firstEventTime || event.timestamp < metadata.firstEventTime) {
            metadata.firstEventTime = event.timestamp;
          }
          if (!metadata.lastEventTime || event.timestamp > metadata.lastEventTime) {
            metadata.lastEventTime = event.timestamp;
          }
        }
      } catch (error) {
        metadata.invalidLines++;
        this.handleParseError(error as Error, line, i + 1);
        
        if (!this.options.skipInvalidLines) {
          break;
        }
      }

      // Check error limit
      if (this.errors.length >= this.options.maxErrors) {
        this.addError('MAX_ERRORS_EXCEEDED', `Maximum error limit (${this.options.maxErrors}) exceeded`);
        break;
      }
    }

    metadata.processingTime = performance.now() - startTime;

    return {
      success: this.errors.length === 0 || this.options.skipInvalidLines,
      events,
      metadata,
      errors: this.errors
    };
  }

  /**
   * Parse JSONL content from File object with streaming
   */
  async parseFile(file: File): Promise<ValidationResult> {
    this.reset();
    
    const events: TraceEvent[] = [];
    const metadata: TraceMetadata = {
      totalLines: 0,
      validLines: 0,
      invalidLines: 0,
      totalBytes: file.size,
      processingTime: 0,
      firstEventTime: null,
      lastEventTime: null
    };

    const startTime = performance.now();

    try {
      const stream = file.stream();
      const reader = stream.getReader();
      const decoder = new TextDecoder(this.options.encoding);
      
      let buffer = '';
      let chunk: ReadableStreamReadResult<Uint8Array>;

      while (!(chunk = await reader.read()).done) {
        const text = decoder.decode(chunk.value, { stream: true });
        buffer += text;

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          metadata.totalLines++;
          await this.processLine(line.trim(), events, metadata);

          // Check error limit
          if (this.errors.length >= this.options.maxErrors) {
            this.addError('MAX_ERRORS_EXCEEDED', `Maximum error limit (${this.options.maxErrors}) exceeded`);
            break;
          }
        }
      }

      // Process final line if exists
      if (buffer.trim()) {
        metadata.totalLines++;
        await this.processLine(buffer.trim(), events, metadata);
      }

    } catch (error) {
      this.addError('FILE_READ_ERROR', `Failed to read file: ${(error as Error).message}`);
    }

    metadata.processingTime = performance.now() - startTime;

    return {
      success: this.errors.length === 0 || this.options.skipInvalidLines,
      events,
      metadata,
      errors: this.errors
    };
  }

  /**
   * Validate a single trace event
   */
  validateEvent(event: RawTraceEvent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!event.type) errors.push('Missing required field: type');
    if (typeof event.timestamp !== 'number') errors.push('Invalid or missing timestamp');
    if (!event.id) errors.push('Missing required field: id');

    // Type-specific validation
    switch (event.type) {
      case 'ai_request':
        if (!event.provider) errors.push('AI request missing provider');
        if (!event.request) errors.push('AI request missing request data');
        break;
      
      case 'ai_response':
        if (!event.response) errors.push('AI response missing response data');
        break;
      
      case 'tool_execution':
        if (!event.tool_name) errors.push('Tool execution missing tool_name');
        break;
      
      case 'error':
        if (!event.error) errors.push('Error event missing error data');
        break;
    }

    // Timestamp validation
    if (event.timestamp && (event.timestamp < 0 || event.timestamp > Date.now() + 86400000)) {
      errors.push('Timestamp is outside valid range');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      lineNumber: this.lineNumber,
      bytesProcessed: this.bytesProcessed,
      errorCount: this.errors.length,
      hasErrors: this.errors.length > 0
    };
  }

  private async processLine(line: string, events: TraceEvent[], metadata: TraceMetadata): Promise<void> {
    this.lineNumber++;
    this.bytesProcessed += line.length + 1;

    if (line === '') return;

    try {
      const event = await this.parseLine(line);
      if (event) {
        events.push(event);
        metadata.validLines++;
        
        // Track timing
        if (!metadata.firstEventTime || event.timestamp < metadata.firstEventTime) {
          metadata.firstEventTime = event.timestamp;
        }
        if (!metadata.lastEventTime || event.timestamp > metadata.lastEventTime) {
          metadata.lastEventTime = event.timestamp;
        }
      }
    } catch (error) {
      metadata.invalidLines++;
      this.handleParseError(error as Error, line, this.lineNumber);
      
      if (!this.options.skipInvalidLines) {
        throw error;
      }
    }
  }

  private async parseLine(line: string): Promise<TraceEvent | null> {
    if (!line.trim()) return null;

    let rawEvent: RawTraceEvent;
    
    try {
      rawEvent = JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON: ${(error as Error).message}`);
    }

    // Validate if schema validation is enabled
    if (this.options.validateSchema) {
      const validation = this.validateEvent(rawEvent);
      if (!validation.valid) {
        throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Transform to internal format
    return this.transformEvent(rawEvent);
  }

  private transformEvent(raw: RawTraceEvent): TraceEvent {
    const base = {
      id: raw.id,
      type: raw.type,
      timestamp: raw.timestamp,
      sessionId: raw.session_id,
      parentId: raw.parent_id,
      metadata: raw.metadata || {}
    };

    switch (raw.type) {
      case 'ai_request':
        return {
          ...base,
          type: 'ai_request',
          provider: raw.provider!,
          model: raw.model,
          request: raw.request!,
          config: raw.config
        };

      case 'ai_response':
        return {
          ...base,
          type: 'ai_response',
          response: raw.response!,
          usage: raw.usage,
          cost: raw.cost,
          duration: raw.duration
        };

      case 'tool_execution':
        return {
          ...base,
          type: 'tool_execution',
          toolName: raw.tool_name!,
          parameters: raw.parameters,
          result: raw.result,
          status: raw.status || 'running',
          duration: raw.duration,
          error: raw.error
        };

      case 'error':
        return {
          ...base,
          type: 'error',
          error: raw.error!,
          stack: raw.stack,
          context: raw.context
        };

      default:
        return {
          ...base,
          type: 'custom',
          data: raw
        };
    }
  }

  private handleParseError(error: Error, line: string, lineNumber: number): void {
    this.addError('PARSE_ERROR', error.message, {
      line: lineNumber,
      content: line.length > 100 ? line.substring(0, 100) + '...' : line
    });
  }

  private addError(code: string, message: string, context?: any): void {
    this.errors.push({
      code,
      message,
      line: this.lineNumber,
      context,
      timestamp: Date.now()
    });
  }

  private reset(): void {
    this.lineNumber = 0;
    this.bytesProcessed = 0;
    this.errors = [];
  }
}

/**
 * Utility functions for JSONL processing
 */
export const JSONLUtils = {
  /**
   * Estimate processing time based on file size
   */
  estimateProcessingTime(fileSize: number): number {
    // Rough estimate: ~1MB per second
    return Math.max(fileSize / (1024 * 1024), 0.1);
  },

  /**
   * Validate JSONL file format
   */
  async validateFileFormat(file: File): Promise<{ valid: boolean; reason?: string }> {
    if (file.size === 0) {
      return { valid: false, reason: 'File is empty' };
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      return { valid: false, reason: 'File too large (max 100MB)' };
    }

    // Check first few lines
    const slice = file.slice(0, 1024);
    const text = await slice.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return { valid: false, reason: 'No valid lines found' };
    }

    // Try to parse first line
    try {
      JSON.parse(lines[0]);
      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid JSON in first line' };
    }
  },

  /**
   * Create sample events for testing
   */
  createSampleEvents(): TraceEvent[] {
    const now = Date.now();
    return [
      {
        id: 'req_1',
        type: 'ai_request',
        timestamp: now - 5000,
        sessionId: 'session_1',
        provider: 'openai',
        model: 'gpt-4',
        request: {
          messages: [{ role: 'user', content: 'Hello, world!' }],
          temperature: 0.7
        },
        metadata: {}
      },
      {
        id: 'resp_1',
        type: 'ai_response',
        timestamp: now - 3000,
        sessionId: 'session_1',
        parentId: 'req_1',
        response: {
          choices: [{ message: { role: 'assistant', content: 'Hello! How can I help you?' } }]
        },
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        cost: 0.0022,
        duration: 2000,
        metadata: {}
      },
      {
        id: 'tool_1',
        type: 'tool_execution',
        timestamp: now - 1000,
        sessionId: 'session_1',
        toolName: 'file_read',
        parameters: { path: '/example.txt' },
        result: 'File contents...',
        status: 'success',
        duration: 150,
        metadata: {}
      }
    ];
  }
};