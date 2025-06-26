import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  FileOperationEvent,
  RequestTiming
} from '../types.js';
import type { JSONLLogger } from '../logger.js';

export interface FileMonitorConfig {
  sessionId: string;
  logger: JSONLLogger;
  maxFileSize: number;
  maxPreviewLength: number;
  enableDiffTracking: boolean;
  monitoredPaths: string[];
  excludedPaths: string[];
}

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export class FileMonitor {
  private config: FileMonitorConfig;
  private fileCache: Map<string, { content: string; timestamp: number }> = new Map();

  constructor(config: FileMonitorConfig) {
    this.config = {
      ...config,
      maxFileSize: config.maxFileSize ?? 5 * 1024 * 1024, // 5MB
      maxPreviewLength: config.maxPreviewLength ?? 1000,
      enableDiffTracking: config.enableDiffTracking ?? true,
      monitoredPaths: config.monitoredPaths ?? [],
      excludedPaths: config.excludedPaths ?? [
        'node_modules',
        '.git',
        '.env',
        '.ssh',
        'dist',
        'build',
        'coverage'
      ]
    };
  }

  public async traceRead(filePath: string): Promise<Result<string>> {
    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      if (this.isPathExcluded(filePath)) {
        return { success: false, error: new Error('Path excluded from monitoring') };
      }

      const content = await fs.readFile(filePath, 'utf8');
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      // Cache content for diff tracking
      if (this.config.enableDiffTracking) {
        this.fileCache.set(filePath, { content, timestamp: Date.now() });
      }

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'read',
        file_path: filePath,
        content_preview: this.createContentPreview(content),
        size: content.length,
        timing,
        success: true
      };

      await this.logEvent(event);
      return { success: true, data: content };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'read',
        file_path: filePath,
        timing,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public async traceWrite(filePath: string, content: string): Promise<Result<void>> {
    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      if (this.isPathExcluded(filePath)) {
        return { success: false, error: new Error('Path excluded from monitoring') };
      }

      if (content.length > this.config.maxFileSize) {
        return { success: false, error: new Error('File size exceeds maximum allowed size') };
      }

      await fs.writeFile(filePath, content, 'utf8');
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      // Cache content for diff tracking
      if (this.config.enableDiffTracking) {
        this.fileCache.set(filePath, { content, timestamp: Date.now() });
      }

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'write',
        file_path: filePath,
        content_preview: this.createContentPreview(content),
        size: content.length,
        timing,
        success: true
      };

      await this.logEvent(event);
      return { success: true };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'write',
        file_path: filePath,
        timing,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public async traceEdit(filePath: string, newContent: string): Promise<Result<void>> {
    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      if (this.isPathExcluded(filePath)) {
        return { success: false, error: new Error('Path excluded from monitoring') };
      }

      if (newContent.length > this.config.maxFileSize) {
        return { success: false, error: new Error('File size exceeds maximum allowed size') };
      }

      // Get previous content for diff
      let previousContent = '';
      let diff: { additions: number; deletions: number; preview: string } | undefined;

      if (this.config.enableDiffTracking) {
        const cached = this.fileCache.get(filePath);
        if (cached) {
          previousContent = cached.content;
        } else {
          try {
            previousContent = await fs.readFile(filePath, 'utf8');
          } catch {
            // File might not exist, that's ok
          }
        }
        
        if (previousContent) {
          diff = this.calculateDiff(previousContent, newContent);
        }
      }

      await fs.writeFile(filePath, newContent, 'utf8');
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      // Update cache
      if (this.config.enableDiffTracking) {
        this.fileCache.set(filePath, { content: newContent, timestamp: Date.now() });
      }

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'edit',
        file_path: filePath,
        content_preview: this.createContentPreview(newContent),
        size: newContent.length,
        timing,
        success: true,
        diff
      };

      await this.logEvent(event);
      return { success: true };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'edit',
        file_path: filePath,
        timing,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public async traceDelete(filePath: string): Promise<Result<void>> {
    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      if (this.isPathExcluded(filePath)) {
        return { success: false, error: new Error('Path excluded from monitoring') };
      }

      // Get file info before deletion
      let size = 0;
      try {
        const stats = await fs.stat(filePath);
        size = stats.size;
      } catch {
        // File might not exist
      }

      await fs.unlink(filePath);
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      // Remove from cache
      this.fileCache.delete(filePath);

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'delete',
        file_path: filePath,
        size,
        timing,
        success: true
      };

      await this.logEvent(event);
      return { success: true };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'delete',
        file_path: filePath,
        timing,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public async traceCreate(filePath: string, content: string = ''): Promise<Result<void>> {
    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      if (this.isPathExcluded(filePath)) {
        return { success: false, error: new Error('Path excluded from monitoring') };
      }

      if (content.length > this.config.maxFileSize) {
        return { success: false, error: new Error('File size exceeds maximum allowed size') };
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      await fs.mkdir(parentDir, { recursive: true });

      await fs.writeFile(filePath, content, 'utf8');
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      // Cache content for diff tracking
      if (this.config.enableDiffTracking) {
        this.fileCache.set(filePath, { content, timestamp: Date.now() });
      }

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'create',
        file_path: filePath,
        content_preview: this.createContentPreview(content),
        size: content.length,
        timing,
        success: true
      };

      await this.logEvent(event);
      return { success: true };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: FileOperationEvent = {
        type: 'file_operation',
        timestamp: startTime,
        session_id: this.config.sessionId,
        operation: 'create',
        file_path: filePath,
        timing,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public clearCache(): void {
    this.fileCache.clear();
  }

  public getCacheSize(): number {
    return this.fileCache.size;
  }

  private createContentPreview(content: string): string {
    if (content.length <= this.config.maxPreviewLength) {
      return content;
    }

    const preview = content.substring(0, this.config.maxPreviewLength - 3) + '...';
    return this.sanitizePreview(preview);
  }

  private sanitizePreview(preview: string): string {
    // Remove sensitive patterns from preview
    const sensitivePatterns = [
      /(?:password|passwd|pwd)['":\s]*([^\s'"]+)/gi,
      /(?:api[_-]?key|apikey)['":\s]*([^\s'"]+)/gi,
      /(?:secret|token)['":\s]*([^\s'"]+)/gi,
      /(?:bearer\s+)([a-zA-Z0-9\-_]+)/gi
    ];

    let sanitized = preview;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, (match, capture) => {
        return match.replace(capture, '[REDACTED]');
      });
    }

    return sanitized;
  }

  private isPathExcluded(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    
    // Check if path is in excluded paths
    for (const excludedPath of this.config.excludedPaths) {
      if (normalizedPath.includes(excludedPath)) {
        return true;
      }
    }

    // If monitored paths are specified, check if path is included
    if (this.config.monitoredPaths.length > 0) {
      return !this.config.monitoredPaths.some(monitoredPath => 
        normalizedPath.startsWith(path.normalize(monitoredPath))
      );
    }

    return false;
  }

  private calculateDiff(oldContent: string, newContent: string): { additions: number; deletions: number; preview: string } {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Simple line-based diff calculation
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);
    
    const additions = newLines.filter(line => !oldSet.has(line)).length;
    const deletions = oldLines.filter(line => !newSet.has(line)).length;
    const unchanged = Math.min(oldLines.length, newLines.length) - deletions;
    
    const preview = `+${additions} -${deletions} lines (${unchanged} unchanged)`;
    
    return { additions, deletions, preview };
  }

  private async logEvent(event: FileOperationEvent): Promise<void> {
    try {
      await this.config.logger.logEvent(event);
    } catch (error) {
      console.error('Failed to log file operation event:', error);
    }
  }
}