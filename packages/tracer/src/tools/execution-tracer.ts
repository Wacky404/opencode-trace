import type {
  TraceEvent,
  ToolExecutionEvent,
  FileOperationEvent,
  BashCommandEvent,
  ToolResultEvent,
  ToolExecutionConfig,
  ToolExecutionMetrics,
  RequestTiming
} from '../types.js';
import type { JSONLLogger } from '../logger.js';

export interface ToolExecutionTracerConfig extends ToolExecutionConfig {
  sessionId: string;
  logger: JSONLLogger;
}

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export class ToolExecutionTracer {
  private config: ToolExecutionTracerConfig;
  private metrics: ToolExecutionMetrics;
  private startTime: number;

  constructor(config: ToolExecutionTracerConfig) {
    this.config = {
      ...config,
      captureFileOperations: config.captureFileOperations ?? true,
      captureBashCommands: config.captureBashCommands ?? true,
      sanitizeOutput: config.sanitizeOutput ?? true,
      maxOutputSize: config.maxOutputSize ?? 10 * 1024 * 1024, // 10MB
      maxFileSize: config.maxFileSize ?? 5 * 1024 * 1024, // 5MB
      enablePerformanceMetrics: config.enablePerformanceMetrics ?? true,
      whitelistedCommands: config.whitelistedCommands ?? [
        'npm', 'node', 'git', 'ls', 'cat', 'echo', 'mkdir', 'touch', 'mv', 'cp', 'rm'
      ],
      blacklistedPaths: config.blacklistedPaths ?? [
        '/etc/passwd', '/etc/shadow', '~/.ssh/', '~/.aws/', '~/.env'
      ]
    };

    this.metrics = {
      fileOperations: 0,
      bashCommands: 0,
      totalToolCalls: 0,
      averageExecutionTime: 0,
      totalDataProcessed: 0,
      sanitizedOperations: 0,
      errors: 0
    };

    this.startTime = Date.now();
  }

  public async traceToolExecution<T>(
    toolName: string,
    operation: () => Promise<T>,
    parameters?: any
  ): Promise<Result<T>> {
    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      const result = await operation();
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      // Update metrics
      this.metrics.totalToolCalls++;
      this.updateAverageExecutionTime(timing.duration);

      // Create tool execution event
      const event: ToolExecutionEvent = {
        type: 'tool_execution',
        timestamp: startTime,
        session_id: this.config.sessionId,
        tool_name: toolName,
        parameters: this.sanitizeData(parameters),
        result: this.sanitizeData(result),
        timing,
        success: true
      };

      await this.logEvent(event);
      return { success: true, data: result };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;
      
      this.metrics.errors++;

      const event: ToolExecutionEvent = {
        type: 'tool_execution',
        timestamp: startTime,
        session_id: this.config.sessionId,
        tool_name: toolName,
        parameters: this.sanitizeData(parameters),
        timing,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public async traceFileOperation(
    operation: 'read' | 'write' | 'edit' | 'delete' | 'create' | 'move' | 'copy',
    filePath: string,
    content?: any,
    previousContent?: any
  ): Promise<Result<void>> {
    if (!this.config.captureFileOperations) {
      return { success: true };
    }

    // Check if path is blacklisted
    if (this.isPathBlacklisted(filePath)) {
      return { success: true }; // Skip silently for security
    }

    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: Date.now(),
      duration: 0
    };

    try {
      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation,
        file_path: filePath,
        timing,
        success: true
      };

      // Add content preview if available
      if (content !== undefined) {
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        event.content_preview = this.truncateContent(contentStr, 500);
        event.size = contentStr.length;
        this.metrics.totalDataProcessed += contentStr.length;
      }

      // Add diff information for edit operations
      if (operation === 'edit' && previousContent !== undefined && content !== undefined) {
        event.diff = this.calculateDiff(previousContent, content);
      }

      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      this.metrics.fileOperations++;
      await this.logEvent(event);

      return { success: true };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;
      
      this.metrics.errors++;

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation,
        file_path: filePath,
        timing,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public async traceBashCommand(
    command: string,
    options: {
      args?: string[];
      cwd?: string;
      timeout?: number;
    } = {}
  ): Promise<Result<{ stdout: string; stderr: string; exitCode: number }>> {
    if (!this.config.captureBashCommands) {
      return { success: true, data: { stdout: '', stderr: '', exitCode: 0 } };
    }

    // Check if command is whitelisted
    const baseCommand = command.split(' ')[0];
    if (this.config.whitelistedCommands && !this.config.whitelistedCommands.includes(baseCommand)) {
      return { success: false, error: new Error(`Command not whitelisted: ${baseCommand}`) };
    }

    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      // Execute command (placeholder - in real implementation would use child_process)
      const result = await this.executeCommand(command, options);
      
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: BashCommandEvent = {
        type: 'bash_command',
        timestamp: startTime,
        session_id: this.config.sessionId,
        command,
        args: options.args,
        working_directory: options.cwd || process.cwd(),
        exit_code: result.exitCode,
        timing,
        success: result.exitCode === 0
      };

      // Sanitize and truncate output
      if (this.config.sanitizeOutput) {
        event.stdout = this.sanitizeOutput(result.stdout);
        event.stderr = this.sanitizeOutput(result.stderr);
        event.sanitized_output = true;
        this.metrics.sanitizedOperations++;
      } else {
        event.stdout = this.truncateContent(result.stdout, this.config.maxOutputSize);
        event.stderr = this.truncateContent(result.stderr, this.config.maxOutputSize);
      }

      this.metrics.bashCommands++;
      this.metrics.totalDataProcessed += result.stdout.length + result.stderr.length;
      
      await this.logEvent(event);
      return { success: true, data: result };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;
      
      this.metrics.errors++;

      const event: BashCommandEvent = {
        type: 'bash_command',
        timestamp: startTime,
        session_id: this.config.sessionId,
        command,
        args: options.args,
        working_directory: options.cwd || process.cwd(),
        exit_code: -1,
        timing,
        success: false
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public getMetrics(): ToolExecutionMetrics {
    return { ...this.metrics };
  }

  public async shutdown(): Promise<void> {
    // Log final metrics
    const event: ToolResultEvent = {
      type: 'tool_result',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      tool_name: 'ToolExecutionTracer',
      output_data: this.metrics,
      size_bytes: JSON.stringify(this.metrics).length,
      processing_time: Date.now() - this.startTime,
      success: true
    };

    await this.logEvent(event);
  }

  private async logEvent(event: TraceEvent): Promise<void> {
    try {
      await this.config.logger.logEvent(event);
    } catch (error) {
      console.error('Failed to log tool execution event:', error);
    }
  }

  private sanitizeData(data: any): any {
    if (!this.config.sanitizeOutput || data === undefined) {
      return data;
    }

    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const sensitivePatterns = [
      /(?:password|passwd|pwd)['":\s]*([^\s'"]+)/gi,
      /(?:api[_-]?key|apikey)['":\s]*([^\s'"]+)/gi,
      /(?:secret|token)['":\s]*([^\s'"]+)/gi,
      /(?:bearer\s+)([a-zA-Z0-9\-_]+)/gi,
      /(?:authorization['":\s]*bearer\s+)([^\s'"]+)/gi
    ];

    let sanitized = dataStr;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, (match, capture) => {
        return match.replace(capture, '[REDACTED]');
      });
    }

    try {
      return JSON.parse(sanitized);
    } catch {
      return sanitized;
    }
  }

  private sanitizeOutput(output: string): string {
    if (!output) return '';
    
    const sensitivePatterns = [
      /(?:password|passwd|pwd)['":\s]*([^\s'"]+)/gi,
      /(?:api[_-]?key|apikey)['":\s]*([^\s'"]+)/gi,
      /(?:secret|token)['":\s]*([^\s'"]+)/gi,
      /(?:bearer\s+)([a-zA-Z0-9\-_]+)/gi,
      /\/Users\/[^\/\s]+\/\.ssh\/[^\s]+/gi,
      /\/home\/[^\/\s]+\/\.ssh\/[^\s]+/gi
    ];

    let sanitized = output;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return this.truncateContent(sanitized, this.config.maxOutputSize);
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength - 3) + '...';
  }

  private isPathBlacklisted(filePath: string): boolean {
    if (!this.config.blacklistedPaths) return false;
    
    return this.config.blacklistedPaths.some(blacklistedPath => 
      filePath.includes(blacklistedPath)
    );
  }

  private calculateDiff(oldContent: string, newContent: string): { additions: number; deletions: number; preview: string } {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Simple diff calculation (in real implementation would use a proper diff library)
    const additions = Math.max(0, newLines.length - oldLines.length);
    const deletions = Math.max(0, oldLines.length - newLines.length);
    
    const preview = `+${additions} -${deletions} lines`;
    
    return { additions, deletions, preview };
  }

  private updateAverageExecutionTime(duration: number): void {
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.totalToolCalls - 1) + duration;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalToolCalls;
  }

  private async executeCommand(
    command: string,
    options: { args?: string[]; cwd?: string; timeout?: number }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Placeholder implementation - in real implementation would use child_process
    // For now, return mock data
    return {
      stdout: `Mock output for: ${command}`,
      stderr: '',
      exitCode: 0
    };
  }
}