import type { 
  EmbeddedData, 
  DataEmbeddingOptions 
} from '../types/html.js';
import type { SessionData, TraceEvent, MetricsReport } from '../types/trace.js';

/**
 * Data embedder for compressing and securing trace data for HTML embedding
 * Handles data sanitization, compression, and secure embedding
 */
export class DataEmbedder {
  private compressionThreshold = 1024; // Compress data larger than 1KB
  private maxDataSize = 50 * 1024 * 1024; // 50MB maximum
  
  /**
   * Embed trace data into HTML-safe format
   */
  async embedData(options: DataEmbeddingOptions): Promise<EmbeddedData> {
    const warnings: string[] = [];

    try {
      // Collect all data
      const rawData = this.collectData(options);
      
      // Validate data size
      const originalSize = JSON.stringify(rawData).length;
      if (originalSize > this.maxDataSize) {
        throw new Error(`Data too large: ${this.formatBytes(originalSize)} exceeds maximum ${this.formatBytes(this.maxDataSize)}`);
      }

      // Sanitize data if requested
      const sanitizedData = options.sanitize ? this.sanitizeData(rawData, warnings) : rawData;
      
      // Compress data if requested and beneficial
      const shouldCompress = options.compress && originalSize > this.compressionThreshold;
      const compressedData = shouldCompress ? this.compressData(sanitizedData) : sanitizedData;
      
      // Convert to embeddable format
      const embeddedString = this.toEmbeddableString(compressedData, shouldCompress);
      
      const compressedSize = embeddedString.length;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

      return {
        data: embeddedString,
        originalSize,
        compressedSize,
        compressionRatio,
        format: shouldCompress ? 'compressed' : (options.format || 'json'),
        warnings
      };

    } catch (error) {
      throw new Error(`Data embedding failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract embedded data from HTML
   */
  extractEmbeddedData(embeddedString: string, format: 'json' | 'jsonl' | 'compressed' = 'json'): any {
    try {
      if (format === 'compressed') {
        return this.decompressData(embeddedString);
      } else {
        return JSON.parse(embeddedString);
      }
    } catch (error) {
      throw new Error(`Failed to extract embedded data: ${(error as Error).message}`);
    }
  }

  /**
   * Validate embedded data integrity
   */
  validateEmbeddedData(data: any): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required structure
    if (!data || typeof data !== 'object') {
      errors.push('Invalid data format: must be an object');
      return { valid: false, errors, warnings };
    }

    // Validate session data
    if (data.sessionData) {
      const sessionValidation = this.validateSessionData(data.sessionData);
      errors.push(...sessionValidation.errors);
      warnings.push(...sessionValidation.warnings);
    }

    // Validate events
    if (data.events && Array.isArray(data.events)) {
      const eventValidation = this.validateEvents(data.events);
      errors.push(...eventValidation.errors);
      warnings.push(...eventValidation.warnings);
    }

    // Validate metrics
    if (data.metrics) {
      const metricsValidation = this.validateMetrics(data.metrics);
      errors.push(...metricsValidation.errors);
      warnings.push(...metricsValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private collectData(options: DataEmbeddingOptions): any {
    const data: any = {};

    if (options.sessionData) {
      data.sessionData = options.sessionData;
    }

    if (options.sessions) {
      data.sessions = options.sessions;
    }

    if (options.events) {
      data.events = options.events;
    }

    if (options.metrics) {
      data.metrics = options.metrics;
    }

    // Add metadata
    data._metadata = {
      embedVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      format: options.format || 'json',
      compressed: options.compress,
      sanitized: options.sanitize
    };

    return data;
  }

  private sanitizeData(data: any, warnings: string[]): any {
    // Deep clone to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Sanitize sensitive fields
    this.sanitizeObject(sanitized, '', warnings);
    
    return sanitized;
  }

  private sanitizeObject(obj: any, path: string, warnings: string[]): void {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      // Check for sensitive field names
      if (this.isSensitiveField(key)) {
        (obj as any)[key] = '[REDACTED]';
        warnings.push(`Sanitized sensitive field: ${fullPath}`);
        continue;
      }

      // Check for sensitive values
      if (typeof value === 'string' && this.isSensitiveValue(value)) {
        (obj as any)[key] = this.sanitizeValue(value);
        warnings.push(`Sanitized sensitive value: ${fullPath}`);
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            this.sanitizeObject(item, `${fullPath}[${index}]`, warnings);
          });
        } else {
          this.sanitizeObject(value, fullPath, warnings);
        }
      }
    }
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'credential',
      'apikey', 'api_key', 'authorization', 'bearer', 'session_id',
      'private_key', 'private', 'ssl_key', 'ssh_key', 'access_token',
      'refresh_token', 'jwt', 'cookie', 'x-api-key'
    ];
    
    const lowerField = fieldName.toLowerCase();
    return sensitiveFields.some(sensitive => 
      lowerField.includes(sensitive) || sensitive.includes(lowerField)
    );
  }

  private isSensitiveValue(value: string): boolean {
    // Check for common sensitive patterns
    const sensitivePatterns = [
      /^sk-[a-zA-Z0-9]{40,}$/, // OpenAI API keys
      /^sk_live_[a-zA-Z0-9]{24,}$/, // Stripe keys
      /^xoxb-[a-zA-Z0-9-]{40,}$/, // Slack bot tokens
      /^ya29\.[a-zA-Z0-9_-]{68,}$/, // Google OAuth tokens
      /^[A-Za-z0-9+/]{40,}={0,2}$/, // Base64 encoded (potential keys)
      /^[0-9a-f]{32,}$/, // Hex strings (potential keys)
      /^Bearer\s+[A-Za-z0-9+/=._-]+$/i, // Bearer tokens
      /^Basic\s+[A-Za-z0-9+/=]+$/i // Basic auth
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(value));
  }

  private sanitizeValue(value: string): string {
    // Keep first and last few characters for debugging
    if (value.length <= 8) return '[REDACTED]';
    
    const start = value.substring(0, 3);
    const end = value.substring(value.length - 3);
    const middle = '*'.repeat(Math.min(value.length - 6, 20));
    
    return `${start}${middle}${end}`;
  }

  private compressData(data: any): string {
    try {
      // Simple compression using JSON + LZ-like compression
      const jsonString = JSON.stringify(data);
      return this.simpleCompress(jsonString);
    } catch (error) {
      throw new Error(`Compression failed: ${(error as Error).message}`);
    }
  }

  private decompressData(compressedString: string): any {
    try {
      const decompressed = this.simpleDecompress(compressedString);
      return JSON.parse(decompressed);
    } catch (error) {
      throw new Error(`Decompression failed: ${(error as Error).message}`);
    }
  }

  private simpleCompress(input: string): string {
    // Simple run-length encoding for repetitive JSON data
    let compressed = '';
    let i = 0;
    
    while (i < input.length) {
      let count = 1;
      const char = input[i];
      
      // Count consecutive identical characters
      while (i + count < input.length && input[i + count] === char && count < 255) {
        count++;
      }
      
      if (count > 3) {
        // Use run-length encoding for sequences of 4 or more
        compressed += `~${char}${count.toString(36)}`;
      } else {
        // Use characters as-is for short sequences
        compressed += char.repeat(count);
      }
      
      i += count;
    }
    
    return compressed;
  }

  private simpleDecompress(compressed: string): string {
    let decompressed = '';
    let i = 0;
    
    while (i < compressed.length) {
      if (compressed[i] === '~') {
        // Run-length encoded sequence
        const char = compressed[i + 1];
        const countStr = compressed[i + 2];
        const count = parseInt(countStr, 36);
        
        decompressed += char.repeat(count);
        i += 3;
      } else {
        decompressed += compressed[i];
        i++;
      }
    }
    
    return decompressed;
  }

  private toEmbeddableString(data: any, compressed: boolean): string {
    let jsonString: string;
    
    if (compressed && typeof data === 'string') {
      jsonString = data;
    } else {
      jsonString = JSON.stringify(data);
    }
    
    // Make safe for HTML embedding
    return jsonString
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/'/g, '\\u0027')
      .replace(/"/g, '\\u0022');
  }

  private validateSessionData(sessionData: SessionData): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!sessionData.id) {
      errors.push('Session data missing ID');
    }

    if (typeof sessionData.startTime !== 'number') {
      errors.push('Session data missing or invalid startTime');
    }

    if (typeof sessionData.duration !== 'number') {
      warnings.push('Session data missing duration');
    }

    if (!Array.isArray(sessionData.events)) {
      warnings.push('Session data missing events array');
    }

    return { errors, warnings };
  }

  private validateEvents(events: TraceEvent[]): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(events)) {
      errors.push('Events must be an array');
      return { errors, warnings };
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      if (!event.id) {
        errors.push(`Event ${i} missing ID`);
      }
      
      if (!event.type) {
        errors.push(`Event ${i} missing type`);
      }
      
      if (typeof event.timestamp !== 'number') {
        errors.push(`Event ${i} missing or invalid timestamp`);
      }
    }

    return { errors, warnings };
  }

  private validateMetrics(metrics: MetricsReport): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!metrics.timestamp) {
      warnings.push('Metrics missing timestamp');
    }

    if (!metrics.performance) {
      warnings.push('Metrics missing performance data');
    }

    if (!metrics.cost) {
      warnings.push('Metrics missing cost data');
    }

    return { errors, warnings };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}MB`;
    return `${(bytes / 1073741824).toFixed(1)}GB`;
  }
}

/**
 * Utility functions for data embedding
 */
export const DataEmbeddingUtils = {
  /**
   * Estimate compression ratio for given data
   */
  estimateCompressionRatio(data: any): number {
    const jsonString = JSON.stringify(data);
    const repetitiveChars = this.countRepetitiveSequences(jsonString);
    
    // Rough estimate based on repetitive content
    const compressionRatio = Math.max(0.3, 1 - (repetitiveChars / jsonString.length * 0.7));
    return compressionRatio;
  },

  /**
   * Count repetitive character sequences
   */
  countRepetitiveSequences(input: string): number {
    let repetitive = 0;
    let i = 0;
    
    while (i < input.length) {
      let count = 1;
      const char = input[i];
      
      while (i + count < input.length && input[i + count] === char) {
        count++;
      }
      
      if (count > 3) {
        repetitive += count - 3; // Count extra repetitions
      }
      
      i += count;
    }
    
    return repetitive;
  },

  /**
   * Check if data contains sensitive information
   */
  containsSensitiveData(data: any): boolean {
    const jsonString = JSON.stringify(data);
    
    // Check for common sensitive patterns
    const sensitivePatterns = [
      /sk-[a-zA-Z0-9]{40,}/,
      /password/i,
      /token/i,
      /secret/i,
      /api_?key/i,
      /authorization/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(jsonString));
  },

  /**
   * Calculate data complexity score (affects compression effectiveness)
   */
  calculateComplexityScore(data: any): number {
    const jsonString = JSON.stringify(data);
    const uniqueChars = new Set(jsonString).size;
    const totalChars = jsonString.length;
    
    // Higher unique character ratio = higher complexity
    const complexity = uniqueChars / totalChars;
    return Math.min(1, complexity * 2); // Scale to 0-1
  },

  /**
   * Suggest optimal embedding options
   */
  suggestOptions(data: any): Partial<DataEmbeddingOptions> {
    const size = JSON.stringify(data).length;
    const complexity = this.calculateComplexityScore(data);
    const hasSensitive = this.containsSensitiveData(data);
    
    return {
      compress: size > 1024 && complexity < 0.8, // Compress if large and not too complex
      sanitize: hasSensitive, // Sanitize if sensitive data detected
      format: 'json' // Always use JSON format for consistency
    };
  }
};