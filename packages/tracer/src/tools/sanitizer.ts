export interface SanitizationConfig {
  enableDataSanitization: boolean;
  enablePathSanitization: boolean;
  enableOutputSanitization: boolean;
  maxDataSize: number;
  customPatterns: Array<{
    pattern: RegExp;
    replacement: string;
    description: string;
  }>;
  sensitivityLevel: 'low' | 'medium' | 'high';
}

export interface SanitizationResult {
  sanitized: any;
  wasSanitized: boolean;
  sanitizedFields: string[];
  truncated: boolean;
  originalSize: number;
  sanitizedSize: number;
}

export class DataSanitizer {
  private config: SanitizationConfig;
  private sensitivePatterns: Array<{
    pattern: RegExp;
    replacement: string | ((match: string, ...args: any[]) => string);
    description: string;
    level: 'low' | 'medium' | 'high';
  }> = [];

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = {
      enableDataSanitization: true,
      enablePathSanitization: true,
      enableOutputSanitization: true,
      maxDataSize: 10 * 1024 * 1024, // 10MB
      customPatterns: [],
      sensitivityLevel: 'medium',
      ...config
    };

    this.initializeSensitivePatterns();
  }

  public sanitizeData(data: any): SanitizationResult {
    if (!this.config.enableDataSanitization) {
      return {
        sanitized: data,
        wasSanitized: false,
        sanitizedFields: [],
        truncated: false,
        originalSize: this.calculateSize(data),
        sanitizedSize: this.calculateSize(data)
      };
    }

    const originalSize = this.calculateSize(data);
    const result = this.sanitizeValue(data, []);
    const sanitizedSize = this.calculateSize(result.value);

    return {
      sanitized: result.value,
      wasSanitized: result.sanitizedFields.length > 0 || result.truncated,
      sanitizedFields: result.sanitizedFields,
      truncated: result.truncated,
      originalSize,
      sanitizedSize
    };
  }

  public sanitizeFilePath(filePath: string): SanitizationResult {
    if (!this.config.enablePathSanitization) {
      return {
        sanitized: filePath,
        wasSanitized: false,
        sanitizedFields: [],
        truncated: false,
        originalSize: filePath.length,
        sanitizedSize: filePath.length
      };
    }

    const originalPath = filePath;
    let sanitized = filePath;
    const sanitizedFields: string[] = [];

    // Sanitize sensitive path components
    const pathPatterns = [
      {
        pattern: /\/Users\/([^\/]+)\/\.ssh\//g,
        replacement: '/Users/[USER]/.ssh/',
        field: 'ssh_path'
      },
      {
        pattern: /\/home\/([^\/]+)\/\.ssh\//g,
        replacement: '/home/[USER]/.ssh/',
        field: 'ssh_path'
      },
      {
        pattern: /\/Users\/([^\/]+)\/\.aws\//g,
        replacement: '/Users/[USER]/.aws/',
        field: 'aws_path'
      },
      {
        pattern: /\/home\/([^\/]+)\/\.aws\//g,
        replacement: '/home/[USER]/.aws/',
        field: 'aws_path'
      },
      {
        pattern: /\/Users\/([^\/]+)\//g,
        replacement: '/Users/[USER]/',
        field: 'user_path'
      },
      {
        pattern: /\/home\/([^\/]+)\//g,
        replacement: '/home/[USER]/',
        field: 'user_path'
      }
    ];

    for (const { pattern, replacement, field } of pathPatterns) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, replacement);
        sanitizedFields.push(field);
      }
    }

    return {
      sanitized,
      wasSanitized: sanitized !== originalPath,
      sanitizedFields,
      truncated: false,
      originalSize: originalPath.length,
      sanitizedSize: sanitized.length
    };
  }

  public sanitizeCommandOutput(output: string): SanitizationResult {
    if (!this.config.enableOutputSanitization) {
      return {
        sanitized: output,
        wasSanitized: false,
        sanitizedFields: [],
        truncated: false,
        originalSize: output.length,
        sanitizedSize: output.length
      };
    }

    const originalSize = output.length;
    let sanitized = output;
    const sanitizedFields: string[] = [];

    // Apply all sensitive patterns
    for (const { pattern, replacement, description, level } of this.sensitivePatterns) {
      // Skip patterns that are above the configured sensitivity level
      if (this.shouldSkipPattern(level)) continue;

      if (pattern.test(sanitized)) {
        if (typeof replacement === 'function') {
          sanitized = sanitized.replace(pattern, replacement);
        } else {
          sanitized = sanitized.replace(pattern, replacement);
        }
        sanitizedFields.push(description);
      }
    }

    // Apply custom patterns
    for (const { pattern, replacement, description } of this.config.customPatterns) {
      if (pattern.test(sanitized)) {
        if (typeof replacement === 'function') {
          sanitized = sanitized.replace(pattern, replacement);
        } else {
          sanitized = sanitized.replace(pattern, replacement);
        }
        sanitizedFields.push(description);
      }
    }

    // Truncate if necessary
    let truncated = false;
    if (sanitized.length > this.config.maxDataSize) {
      sanitized = sanitized.substring(0, this.config.maxDataSize - 100) + 
                  '\n\n... [OUTPUT TRUNCATED] ...';
      truncated = true;
    }

    return {
      sanitized,
      wasSanitized: sanitizedFields.length > 0 || truncated,
      sanitizedFields: [...new Set(sanitizedFields)], // Remove duplicates
      truncated,
      originalSize,
      sanitizedSize: sanitized.length
    };
  }

  public addCustomPattern(pattern: RegExp, replacement: string, description: string): void {
    this.config.customPatterns.push({ pattern, replacement, description });
  }

  public removeCustomPattern(description: string): void {
    this.config.customPatterns = this.config.customPatterns.filter(
      p => p.description !== description
    );
  }

  public updateConfig(newConfig: Partial<SanitizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SanitizationConfig {
    return { ...this.config };
  }

  private sanitizeValue(value: any, path: string[]): { value: any; sanitizedFields: string[]; truncated: boolean } {
    const sanitizedFields: string[] = [];
    let truncated = false;

    if (value === null || value === undefined) {
      return { value, sanitizedFields, truncated };
    }

    if (typeof value === 'string') {
      const result = this.sanitizeString(value, path.join('.'));
      return {
        value: result.sanitized,
        sanitizedFields: result.wasSanitized ? [result.sanitizedFields.join(', ')] : [],
        truncated: result.truncated
      };
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return { value, sanitizedFields, truncated };
    }

    if (Array.isArray(value)) {
      const sanitizedArray = value.map((item, index) => {
        const result = this.sanitizeValue(item, [...path, index.toString()]);
        sanitizedFields.push(...result.sanitizedFields);
        truncated = truncated || result.truncated;
        return result.value;
      });
      return { value: sanitizedArray, sanitizedFields, truncated };
    }

    if (typeof value === 'object') {
      const sanitizedObject: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Check if the property name itself is sensitive
        if (this.config.enableDataSanitization && this.isSensitiveFieldName(key)) {
          // Sanitize the entire value if the field name is sensitive
          sanitizedObject[key] = '[REDACTED]';
          sanitizedFields.push(`${path.concat(key).join('.')} (sensitive field)`);
        } else {
          // Otherwise, recursively sanitize the value
          const result = this.sanitizeValue(val, [...path, key]);
          sanitizedFields.push(...result.sanitizedFields);
          truncated = truncated || result.truncated;
          sanitizedObject[key] = result.value;
        }
      }
      return { value: sanitizedObject, sanitizedFields, truncated };
    }

    return { value, sanitizedFields, truncated };
  }

  private sanitizeString(str: string, fieldPath: string): SanitizationResult {
    const originalSize = str.length;
    let sanitized = str;
    const sanitizedFields: string[] = [];

    // Apply sensitive patterns
    for (const { pattern, replacement, description, level } of this.sensitivePatterns) {
      if (this.shouldSkipPattern(level)) continue;

      if (pattern.test(sanitized)) {
        if (typeof replacement === 'function') {
          sanitized = sanitized.replace(pattern, replacement);
        } else {
          sanitized = sanitized.replace(pattern, replacement);
        }
        sanitizedFields.push(`${description} (${fieldPath})`);
      }
    }

    // Apply custom patterns
    for (const { pattern, replacement, description } of this.config.customPatterns) {
      if (pattern.test(sanitized)) {
        if (typeof replacement === 'function') {
          sanitized = sanitized.replace(pattern, replacement);
        } else {
          sanitized = sanitized.replace(pattern, replacement);
        }
        sanitizedFields.push(`${description} (${fieldPath})`);
      }
    }

    // Truncate if necessary
    let truncated = false;
    if (sanitized.length > this.config.maxDataSize) {
      sanitized = sanitized.substring(0, this.config.maxDataSize - 50) + '... [TRUNCATED]';
      truncated = true;
    }

    return {
      sanitized,
      wasSanitized: sanitizedFields.length > 0 || truncated,
      sanitizedFields,
      truncated,
      originalSize,
      sanitizedSize: sanitized.length
    };
  }

  private initializeSensitivePatterns(): void {
    this.sensitivePatterns = [
      // High sensitivity - Always sanitize these
      {
        pattern: /-----BEGIN [A-Z\s]+ KEY-----[\s\S]*?-----END [A-Z\s]+ KEY-----/gi,
        replacement: '[REDACTED_PRIVATE_KEY]',
        description: 'private_key',
        level: 'high' as const
      },
      {
        pattern: /(?:password|passwd|pwd)['":\s]*:?\s*['"]*([^\s'",]+)['"]*,?/gi,
        replacement: (match: string, capture: string) => match.replace(capture, '[REDACTED]'),
        description: 'password',
        level: 'high' as const
      },

      // Medium sensitivity - Sanitize by default
      {
        pattern: /(?:api[_-]?key|apikey|apiKey)['":\s]*:?\s*['"]*([a-zA-Z0-9\-_]{10,})['"]*,?/gi,
        replacement: (match: string, capture: string) => match.replace(capture, '[REDACTED]'),
        description: 'api_key',
        level: 'medium' as const
      },
      {
        pattern: /(?:secret|token)['":\s]*:?\s*['"]*([a-zA-Z0-9\-_]{10,})['"]*,?/gi,
        replacement: (match: string, capture: string) => match.replace(capture, '[REDACTED]'),
        description: 'secret_token',
        level: 'medium' as const
      },
      {
        pattern: /(?:bearer\s+)([a-zA-Z0-9\-_]{20,})/gi,
        replacement: (match: string, capture: string) => match.replace(capture, '[REDACTED]'),
        description: 'bearer_token',
        level: 'medium' as const
      },
      {
        pattern: /https?:\/\/[^:]+:[^@]+@[^\s]+/gi,
        replacement: '[REDACTED_URL_WITH_CREDENTIALS]',
        description: 'url_with_credentials',
        level: 'medium' as const
      },

      // Low sensitivity - Only sanitize in high security mode
      {
        pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
        replacement: '[REDACTED_EMAIL]',
        description: 'email_address',
        level: 'low' as const
      },
      {
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: '[REDACTED_IP]',
        description: 'ip_address',
        level: 'low' as const
      },
      {
        pattern: /\b(?:\+?1-?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g,
        replacement: '[REDACTED_PHONE]',
        description: 'phone_number',
        level: 'low' as const
      }
    ];
  }

  private shouldSkipPattern(patternLevel: 'low' | 'medium' | 'high'): boolean {
    const levels = { low: 1, medium: 2, high: 3 };
    const configLevel = levels[this.config.sensitivityLevel];
    const patternLevelNum = levels[patternLevel];
    
    return patternLevelNum < configLevel;
  }

  private isSensitiveFieldName(fieldName: string): boolean {
    // Common sensitive field names to check
    const sensitiveFieldPatterns = [
      /^(password|passwd|pwd)$/i,
      /^(api[_-]?key|apikey|apiKey)$/i,
      /^(secret|token|auth[_-]?token|authToken)$/i,
      /^(bearer[_-]?token|bearerToken)$/i,
      /^(access[_-]?token|accessToken)$/i,
      /^(refresh[_-]?token|refreshToken)$/i,
      /^(private[_-]?key|privateKey)$/i,
      /^(ssh[_-]?key|sshKey)$/i,
      /^(client[_-]?secret|clientSecret)$/i,
      /^(session[_-]?id|sessionId)$/i,
      /^(credit[_-]?card|creditCard)$/i,
      /^(ssn|social[_-]?security|socialSecurity)$/i
    ];

    // Check if field name matches any sensitive pattern
    return sensitiveFieldPatterns.some(pattern => pattern.test(fieldName));
  }

  private calculateSize(data: any): number {
    if (data === null || data === undefined) return 0;
    if (typeof data === 'string') return data.length;
    if (typeof data === 'number' || typeof data === 'boolean') return 8;
    
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
}