import type { TraceEvent } from './types.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

export interface FileSystemResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
}

export class FileSystemManager {
  private baseDir: string;
  private sessionsDir: string;

  constructor(baseDir: string = '.opencode-trace') {
    this.baseDir = baseDir;
    this.sessionsDir = join(baseDir, 'sessions');
  }

  async ensureDirectoryStructure(): Promise<FileSystemResult> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.mkdir(this.sessionsDir, { recursive: true });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  async createSessionFile(sessionId: string): Promise<FileSystemResult<string>> {
    try {
      const timestamp = this.formatTimestamp(new Date());
      const filename = `${timestamp}_session-${sessionId}.jsonl`;
      const filepath = join(this.sessionsDir, filename);
      
      // Create empty file to reserve the path
      await fs.writeFile(filepath, '', 'utf8');
      
      return { 
        success: true, 
        data: filepath 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  async appendToSessionFile(sessionId: string, line: string): Promise<FileSystemResult> {
    try {
      const filepath = await this.findSessionFile(sessionId);
      if (!filepath) {
        throw new Error(`Session file not found for session: ${sessionId}`);
      }

      const jsonLine = line.endsWith('\n') ? line : line + '\n';
      await fs.appendFile(filepath, jsonLine, 'utf8');
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  async finalizeSessionFile(sessionId: string): Promise<FileSystemResult> {
    try {
      const filepath = await this.findSessionFile(sessionId);
      if (!filepath) {
        throw new Error(`Session file not found for session: ${sessionId}`);
      }

      // Verify file integrity by reading and validating JSONL format
      const content = await fs.readFile(filepath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      // Validate each line is valid JSON
      for (let i = 0; i < lines.length; i++) {
        try {
          JSON.parse(lines[i]);
        } catch (parseError) {
          throw new Error(`Invalid JSON at line ${i + 1}: ${parseError}`);
        }
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  async cleanup(retentionDays: number): Promise<FileSystemResult<number>> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;

        const filepath = join(this.sessionsDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filepath);
          deletedCount++;
        }
      }

      return { 
        success: true, 
        data: deletedCount 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  async validateDiskSpace(requiredMB: number): Promise<FileSystemResult<boolean>> {
    try {
      // Node.js fs.promises doesn't have statvfs, so we'll use a simple approach
      // Try to write a small test file to check if we have write access
      const testFilePath = join(this.baseDir, '.diskspace-test');
      const testData = 'test';
      
      try {
        await fs.writeFile(testFilePath, testData, 'utf8');
        await fs.unlink(testFilePath);
        
        // If we can write and delete, assume we have space
        // In a production implementation, you might want to use a native module
        // or platform-specific commands to get actual disk space
        return { success: true, data: true };
      } catch (writeError) {
        // If we can't write, we probably don't have space or permissions
        return { success: true, data: false };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  async listSessionFiles(): Promise<FileSystemResult<string[]>> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(file => 
        file.endsWith('.jsonl') && file.includes('session-')
      );
      
      return { 
        success: true, 
        data: sessionFiles 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error as Error 
      };
    }
  }

  private async findSessionFile(sessionId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessionFile = files.find(file => 
        file.includes(`session-${sessionId}.jsonl`)
      );
      
      return sessionFile ? join(this.sessionsDir, sessionFile) : null;
    } catch {
      return null;
    }
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  getSessionsDir(): string {
    return this.sessionsDir;
  }
}