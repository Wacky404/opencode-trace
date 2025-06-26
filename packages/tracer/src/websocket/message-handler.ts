import type { 
  WebSocketMessageEvent, 
  WebSocketConfig,
  RequestTiming
} from '../types.js';
import type { JSONLLogger } from '../logger.js';

export interface MessageHandlerConfig extends WebSocketConfig {
  sessionId: string;
  logger: JSONLLogger;
}

export class MessageHandler {
  private config: MessageHandlerConfig;
  private messageQueue: Array<{ event: WebSocketMessageEvent; timestamp: number }> = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config: MessageHandlerConfig) {
    this.config = config;
    this.startMessageProcessing();
  }

  public async handleIncomingMessage(data: any, startTime: number): Promise<void> {
    const endTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: endTime,
      duration: endTime - startTime
    };

    const messageEvent = this.createMessageEvent('received', data, timing);
    
    if (this.config.enablePerformanceMetrics) {
      // Queue for batch processing to avoid blocking
      this.messageQueue.push({ event: messageEvent, timestamp: endTime });
    } else {
      // Log immediately
      await this.config.logger.logEvent(messageEvent);
    }
  }

  public async handleOutgoingMessage(data: any, startTime: number): Promise<void> {
    const endTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: endTime,
      duration: endTime - startTime
    };

    const messageEvent = this.createMessageEvent('sent', data, timing);
    
    if (this.config.enablePerformanceMetrics) {
      // Queue for batch processing
      this.messageQueue.push({ event: messageEvent, timestamp: endTime });
    } else {
      // Log immediately
      await this.config.logger.logEvent(messageEvent);
    }
  }

  private createMessageEvent(
    direction: 'sent' | 'received', 
    data: any, 
    timing: RequestTiming
  ): WebSocketMessageEvent {
    const messageType = this.determineMessageType(data);
    const size = this.calculateMessageSize(data);
    const processedData = this.processMessageData(data);

    return {
      type: 'websocket_message',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      direction,
      message_type: messageType,
      data: processedData,
      size,
      timing
    };
  }

  private determineMessageType(data: any): 'text' | 'binary' | 'ping' | 'pong' | 'close' {
    if (typeof data === 'string') {
      return 'text';
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data) || data instanceof Blob) {
      return 'binary';
    }
    // For ping/pong/close, these would typically be handled at the WebSocket level
    // and might not reach this handler, but we include them for completeness
    return 'text'; // Default fallback
  }

  private calculateMessageSize(data: any): number {
    if (typeof data === 'string') {
      return new Blob([data]).size;
    } else if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof Blob) {
      return data.size;
    } else if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }
    return 0;
  }

  private processMessageData(data: any): any {
    if (!this.config.captureMessages) {
      return null; // Don't capture message content
    }

    const size = this.calculateMessageSize(data);
    
    if (size > this.config.maxMessageSize) {
      return {
        _truncated: true,
        _originalSize: size,
        _preview: this.createDataPreview(data)
      };
    }

    if (this.config.sanitizeData) {
      return this.sanitizeMessageData(data);
    }

    return data;
  }

  private createDataPreview(data: any): any {
    const previewSize = Math.min(200, this.config.maxMessageSize / 10);
    
    if (typeof data === 'string') {
      return data.substring(0, previewSize) + (data.length > previewSize ? '...' : '');
    } else if (data instanceof ArrayBuffer) {
      const preview = new Uint8Array(data.slice(0, previewSize));
      return `Binary data (${data.byteLength} bytes): [${Array.from(preview).join(', ')}${data.byteLength > previewSize ? '...' : ''}]`;
    } else if (data instanceof Blob) {
      return `Blob data (${data.size} bytes, type: ${data.type})`;
    }
    
    return String(data).substring(0, previewSize);
  }

  private sanitizeMessageData(data: any): any {
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return this.sanitizeObject(parsed);
      } catch {
        // Not JSON, sanitize as string
        return this.sanitizeString(data);
      }
    }
    
    return data; // Binary data doesn't need string-based sanitization
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(str: string): string {
    // Common patterns for sensitive data
    const sensitivePatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\bsk-[a-zA-Z0-9]{20,}\b/g, // API keys (OpenAI style)
      /\bxoxb-[a-zA-Z0-9-]+\b/g, // Slack tokens
      /\bAIza[0-9A-Za-z-_]{35}\b/g, // Google API keys
      /\b[A-Z0-9]{32}\b/g, // Generic 32-char hex keys
    ];

    let sanitized = str;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'passwd', 'pwd',
      'secret', 'key', 'token', 'auth',
      'api_key', 'apikey', 'api-key',
      'authorization', 'bearer',
      'private', 'confidential',
      'credential', 'credentials'
    ];

    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  private startMessageProcessing(): void {
    if (!this.config.enablePerformanceMetrics) return;

    // Process queued messages every 100ms to batch them
    this.processingInterval = setInterval(async () => {
      if (this.messageQueue.length > 0) {
        const batch = this.messageQueue.splice(0, 10); // Process up to 10 at a time
        
        for (const { event } of batch) {
          try {
            await this.config.logger.logEvent(event);
          } catch (error) {
            console.error('Failed to log WebSocket message event:', error);
          }
        }
      }
    }, 100);
  }

  public async cleanup(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Process any remaining messages
    while (this.messageQueue.length > 0) {
      const batch = this.messageQueue.splice(0, 10);
      
      for (const { event } of batch) {
        try {
          await this.config.logger.logEvent(event);
        } catch (error) {
          console.error('Failed to log WebSocket message event during cleanup:', error);
        }
      }
    }
  }
}