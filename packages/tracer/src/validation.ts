import type { TraceEvent, SessionStartEvent, SessionEndEvent, AIRequestEvent, AIResponseEvent, ToolExecutionEvent, NetworkRequestEvent, NetworkResponseEvent } from './types.js';
import type { TracerConfig } from './config.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedEvent?: TraceEvent;
}

export interface ValidationSanitizationResult {
  sanitized: any;
  redactedFields: string[];
}

export class EventValidator {
  private config: TracerConfig;
  private sensitivePatterns: RegExp[];

  constructor(config: TracerConfig) {
    this.config = config;
    this.sensitivePatterns = this.config.redactPatterns.map(pattern => new RegExp(pattern, 'gi'));
  }

  validateEvent(event: TraceEvent): ValidationResult {
    const errors: string[] = [];

    // Basic structure validation
    if (!event || typeof event !== 'object') {
      return {
        isValid: false,
        errors: ['Event must be a valid object']
      };
    }

    // Required fields validation
    if (!event.type || typeof event.type !== 'string') {
      errors.push('Event type is required and must be a string');
    }

    if (!event.timestamp || typeof event.timestamp !== 'number') {
      errors.push('Event timestamp is required and must be a number');
    }

    if (!event.session_id || typeof event.session_id !== 'string') {
      errors.push('Event session_id is required and must be a string');
    }

    // Timestamp validation
    if (event.timestamp && typeof event.timestamp === 'number') {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);
      const oneHourFuture = now + (60 * 60 * 1000);
      
      if (event.timestamp < twoHoursAgo || event.timestamp > oneHourFuture) {
        errors.push('Event timestamp seems unrealistic (more than 2 hours old or 1 hour in future)');
      }
    }

    // Type-specific validation
    switch (event.type) {
      case 'session_start':
        this.validateSessionStartEvent(event as SessionStartEvent, errors);
        break;
      case 'session_end':
        this.validateSessionEndEvent(event as SessionEndEvent, errors);
        break;
      case 'ai_request':
        this.validateAIRequestEvent(event as AIRequestEvent, errors);
        break;
      case 'ai_response':
        this.validateAIResponseEvent(event as AIResponseEvent, errors);
        break;
      case 'tool_execution':
        this.validateToolExecutionEvent(event as ToolExecutionEvent, errors);
        break;
      case 'network_request':
        this.validateNetworkRequestEvent(event as NetworkRequestEvent, errors);
        break;
      case 'network_response':
        this.validateNetworkResponseEvent(event as NetworkResponseEvent, errors);
        break;
      default:
        // Allow custom event types but warn
        if (!event.type.startsWith('custom_')) {
          errors.push(`Unknown event type: ${event.type}. Custom events should start with 'custom_'`);
        }
    }

    const sanitizedEvent = this.sanitizeEvent(event);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedEvent
    };
  }

  sanitizeEvent(event: TraceEvent): TraceEvent {
    const sanitized = this.deepClone(event);
    this.sanitizeObjectRecursively(sanitized, []);
    return sanitized;
  }

  private validateSessionStartEvent(event: SessionStartEvent, errors: string[]): void {
    if (!event.user_query || typeof event.user_query !== 'string') {
      errors.push('session_start event must have a user_query string');
    }

    if (!event.opencode_version || typeof event.opencode_version !== 'string') {
      errors.push('session_start event must have an opencode_version string');
    }

    if (!event.working_directory || typeof event.working_directory !== 'string') {
      errors.push('session_start event must have a working_directory string');
    }
  }

  private validateSessionEndEvent(event: SessionEndEvent, errors: string[]): void {
    if (event.summary) {
      if (typeof event.summary.total_requests !== 'number' || event.summary.total_requests < 0) {
        errors.push('session_end summary.total_requests must be a non-negative number');
      }
      
      if (typeof event.summary.ai_requests !== 'number' || event.summary.ai_requests < 0) {
        errors.push('session_end summary.ai_requests must be a non-negative number');
      }
      
      if (typeof event.summary.total_cost !== 'number' || event.summary.total_cost < 0) {
        errors.push('session_end summary.total_cost must be a non-negative number');
      }
    }
  }

  private validateAIRequestEvent(event: AIRequestEvent, errors: string[]): void {
    if (!event.provider || typeof event.provider !== 'string') {
      errors.push('ai_request event must have a provider string');
    }

    if (!event.model || typeof event.model !== 'string') {
      errors.push('ai_request event must have a model string');
    }

    if (!Array.isArray(event.messages)) {
      errors.push('ai_request event must have a messages array');
    }

    if (event.url && typeof event.url !== 'string') {
      errors.push('ai_request event url must be a string if provided');
    }
  }

  private validateAIResponseEvent(event: AIResponseEvent, errors: string[]): void {
    if (!event.provider || typeof event.provider !== 'string') {
      errors.push('ai_response event must have a provider string');
    }

    if (!event.model || typeof event.model !== 'string') {
      errors.push('ai_response event must have a model string');
    }

    if (event.cost !== undefined && (typeof event.cost !== 'number' || event.cost < 0)) {
      errors.push('ai_response event cost must be a non-negative number if provided');
    }

    if (event.tokens_used) {
      if (typeof event.tokens_used.inputTokens !== 'number' || event.tokens_used.inputTokens < 0) {
        errors.push('ai_response tokens_used.inputTokens must be a non-negative number');
      }
      if (typeof event.tokens_used.outputTokens !== 'number' || event.tokens_used.outputTokens < 0) {
        errors.push('ai_response tokens_used.outputTokens must be a non-negative number');
      }
    }
  }

  private validateToolExecutionEvent(event: ToolExecutionEvent, errors: string[]): void {
    if (!event.tool_name || typeof event.tool_name !== 'string') {
      errors.push('tool_execution event must have a tool_name string');
    }

    if (typeof event.success !== 'boolean') {
      errors.push('tool_execution event must have a success boolean');
    }

    if (event.timing) {
      if (typeof event.timing.duration !== 'number' || event.timing.duration < 0) {
        errors.push('tool_execution timing.duration must be a non-negative number');
      }
    }
  }

  private validateNetworkRequestEvent(event: NetworkRequestEvent, errors: string[]): void {
    if (!event.url || typeof event.url !== 'string') {
      errors.push('network_request event must have a url string');
    }

    if (!event.method || typeof event.method !== 'string') {
      errors.push('network_request event must have a method string');
    }

    // Validate URL format
    if (event.url) {
      try {
        new URL(event.url);
      } catch {
        errors.push('network_request event url must be a valid URL');
      }
    }

    // Validate HTTP method
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    if (event.method && !validMethods.includes(event.method.toUpperCase())) {
      errors.push(`network_request event method must be one of: ${validMethods.join(', ')}`);
    }
  }

  private validateNetworkResponseEvent(event: NetworkResponseEvent, errors: string[]): void {
    if (typeof event.status !== 'number' || event.status < 100 || event.status >= 600) {
      errors.push('network_response event status must be a valid HTTP status code (100-599)');
    }

    if (event.timing) {
      if (typeof event.timing.duration !== 'number' || event.timing.duration < 0) {
        errors.push('network_response timing.duration must be a non-negative number');
      }
    }
  }

  private sanitizeObjectRecursively(obj: any, path: string[]): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'string') {
      // This should not happen in recursive calls, but handle it
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          this.sanitizeObjectRecursively(item, [...path, index.toString()]);
        } else if (typeof item === 'string') {
          obj[index] = this.sanitizeString(item);
        }
      });
      return;
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];
        const fieldName = currentPath.join('.');

        // Check if this field should be redacted based on name
        if (this.isSensitiveField(key)) {
          obj[key] = '[REDACTED]';
          continue;
        }

        if (typeof value === 'string') {
          obj[key] = this.sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          this.sanitizeObjectRecursively(value, currentPath);
        }
      }
    }
  }

  private sanitizeString(str: string): string {
    let sanitized = str;
    
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return sanitized;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.config.sensitiveHeaders.some(header => 
      lowerFieldName.includes(header) || header.includes(lowerFieldName)
    );
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
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
    this.sensitivePatterns = this.config.redactPatterns.map(pattern => new RegExp(pattern, 'gi'));
  }
}