import type { TraceEvent } from './types.js';
import type { TracerConfig } from './config.js';
import stringify from 'fast-json-stable-stringify';

export interface SerializationResult {
  success: boolean;
  data?: string;
  error?: Error;
  truncated?: boolean;
}

export interface DeserializationResult {
  success: boolean;
  data?: TraceEvent;
  error?: Error;
}

export class JSONLSerializer {
  private config: TracerConfig;

  constructor(config: TracerConfig) {
    this.config = config;
  }

  serialize(event: TraceEvent): SerializationResult {
    try {
      // Create a copy to avoid modifying the original
      const eventCopy = this.prepareForSerialization(event);
      
      // Use fast-json-stable-stringify for consistent ordering
      const jsonString = stringify(eventCopy);
      
      if (!jsonString) {
        return {
          success: false,
          error: new Error('Failed to serialize event to JSON')
        };
      }

      // Check if the serialized string is too large
      const sizeInBytes = Buffer.byteLength(jsonString, 'utf8');
      if (sizeInBytes > this.config.maxBodySize) {
        // Attempt to truncate large fields
        const truncatedEvent = this.truncateLargeFields(eventCopy);
        const truncatedJson = stringify(truncatedEvent);
        
        if (truncatedJson && Buffer.byteLength(truncatedJson, 'utf8') <= this.config.maxBodySize) {
          return {
            success: true,
            data: truncatedJson,
            truncated: true
          };
        } else {
          return {
            success: false,
            error: new Error(`Event size (${sizeInBytes} bytes) exceeds maximum allowed size (${this.config.maxBodySize} bytes)`)
          };
        }
      }

      return {
        success: true,
        data: jsonString,
        truncated: false
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  deserialize(line: string): DeserializationResult {
    try {
      if (!line || typeof line !== 'string') {
        return {
          success: false,
          error: new Error('Input must be a non-empty string')
        };
      }

      const trimmedLine = line.trim();
      if (!trimmedLine) {
        return {
          success: false,
          error: new Error('Input line is empty after trimming')
        };
      }

      const parsed = JSON.parse(trimmedLine);
      
      if (!parsed || typeof parsed !== 'object') {
        return {
          success: false,
          error: new Error('Parsed JSON is not an object')
        };
      }

      // Basic validation that it looks like a TraceEvent
      if (!parsed.type || !parsed.timestamp || !parsed.session_id) {
        return {
          success: false,
          error: new Error('Parsed object is missing required TraceEvent fields (type, timestamp, session_id)')
        };
      }

      return {
        success: true,
        data: parsed as TraceEvent
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  serializeBatch(events: TraceEvent[]): SerializationResult {
    try {
      const lines: string[] = [];
      let totalTruncated = 0;

      for (const event of events) {
        const result = this.serialize(event);
        
        if (!result.success) {
          return {
            success: false,
            error: new Error(`Failed to serialize event in batch: ${result.error?.message}`)
          };
        }

        if (result.data) {
          lines.push(result.data);
          if (result.truncated) {
            totalTruncated++;
          }
        }
      }

      return {
        success: true,
        data: lines.join('\n'),
        truncated: totalTruncated > 0
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  deserializeBatch(content: string): DeserializationResult[] {
    if (!content || typeof content !== 'string') {
      return [{
        success: false,
        error: new Error('Content must be a non-empty string')
      }];
    }

    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => this.deserialize(line));
  }

  private prepareForSerialization(event: TraceEvent): any {
    const prepared = this.deepClone(event);
    
    // Handle circular references
    const seen = new WeakSet();
    this.removeCircularReferences(prepared, seen);
    
    // Ensure timestamp is a valid number
    if (prepared.timestamp && typeof prepared.timestamp === 'number') {
      // Round to milliseconds to avoid floating point precision issues
      prepared.timestamp = Math.round(prepared.timestamp);
    }
    
    return prepared;
  }

  private removeCircularReferences(obj: any, seen: WeakSet<object>): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (seen.has(obj)) {
      return '[Circular Reference]';
    }

    seen.add(obj);

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = this.removeCircularReferences(obj[i], seen);
      }
    } else {
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = this.removeCircularReferences(value, seen);
      }
    }

    seen.delete(obj);
    return obj;
  }

  private truncateLargeFields(event: any): any {
    const truncated = this.deepClone(event);
    const maxFieldSize = Math.floor(this.config.maxBodySize / 4); // Reserve space for other fields
    
    this.truncateFieldsRecursively(truncated, maxFieldSize);
    return truncated;
  }

  private truncateFieldsRecursively(obj: any, maxSize: number): void {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      // Truncate array if it's too large
      if (obj.length > 100) {
        obj.splice(100);
        obj.push('[... truncated array]');
      }
      
      obj.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          this.truncateFieldsRecursively(item, maxSize);
        }
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && value.length > maxSize) {
          obj[key] = value.substring(0, maxSize) + '[... truncated]';
        } else if (typeof value === 'object' && value !== null) {
          this.truncateFieldsRecursively(value, maxSize);
        }
      }
    }
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof RegExp) {
      return new RegExp(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    const cloned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.deepClone(value);
    }
    return cloned;
  }

  updateConfig(config: TracerConfig): void {
    this.config = config;
  }

  static validateJSONL(content: string): { isValid: boolean; errors: string[]; lineCount: number } {
    const errors: string[] = [];
    let lineCount = 0;

    if (!content || typeof content !== 'string') {
      return {
        isValid: false,
        errors: ['Content must be a non-empty string'],
        lineCount: 0
      };
    }

    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        continue;
      }

      lineCount++;

      try {
        const parsed = JSON.parse(line);
        
        // Basic TraceEvent validation
        if (!parsed || typeof parsed !== 'object') {
          errors.push(`Line ${i + 1}: Not a valid object`);
        } else if (!parsed.type || !parsed.timestamp || !parsed.session_id) {
          errors.push(`Line ${i + 1}: Missing required TraceEvent fields`);
        }
      } catch (parseError) {
        errors.push(`Line ${i + 1}: Invalid JSON - ${parseError}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      lineCount
    };
  }
}