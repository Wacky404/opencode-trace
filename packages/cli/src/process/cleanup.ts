import { unlink, rmdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import chalk from 'chalk';
import type { SessionContext } from '../types/cli.js';

export class CleanupManager {
  async cleanup(session: SessionContext): Promise<void> {
    console.log(chalk.yellow('🧹 Running cleanup tasks...'));
    
    try {
      // Cleanup temporary files
      await this.cleanupTempFiles(session);
      
      // Cleanup IPC files
      await this.cleanupIPCFiles(session.sessionId);
      
      // Cleanup orphaned processes (if any)
      await this.cleanupOrphanedProcesses(session);
      
      console.log(chalk.green('✓ Cleanup completed'));
      
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Some cleanup tasks failed:'), error);
    }
  }

  private async cleanupTempFiles(session: SessionContext): Promise<void> {
    // Clean up any temporary files created during the session
    const tempDir = join(tmpdir(), 'opencode-trace');
    
    if (!existsSync(tempDir)) {
      return;
    }
    
    try {
      const files = await readdir(tempDir);
      
      for (const file of files) {
        const filePath = join(tempDir, file);
        
        try {
          const stats = await stat(filePath);
          
          // Remove files older than 1 hour
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          if (stats.mtime.getTime() < oneHourAgo) {
            await unlink(filePath);
            console.log(chalk.gray(`  Removed temp file: ${file}`));
          }
        } catch (error) {
          // Ignore individual file errors
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
  }

  private async cleanupIPCFiles(sessionId: string): Promise<void> {
    const ipcDir = join(tmpdir(), 'opencode-trace', sessionId);
    
    if (!existsSync(ipcDir)) {
      return;
    }
    
    try {
      const files = await readdir(ipcDir);
      
      // Remove all IPC message files
      for (const file of files) {
        const filePath = join(ipcDir, file);
        try {
          await unlink(filePath);
        } catch (error) {
          // Ignore individual file errors
        }
      }
      
      // Try to remove the IPC directory
      try {
        await rmdir(ipcDir);
        console.log(chalk.gray(`  Removed IPC directory: ${sessionId}`));
      } catch (error) {
        // Directory might not be empty, ignore
      }
      
    } catch (error) {
      console.warn('Failed to cleanup IPC files:', error);
    }
  }

  private async cleanupOrphanedProcesses(session: SessionContext): Promise<void> {
    // Check for any processes that might still be running
    for (const [name, processInfo] of session.processes) {
      if (processInfo.status === 'running' || processInfo.status === 'starting') {
        console.warn(chalk.yellow(`⚠️  Process ${name} still running, attempting cleanup`));
        
        try {
          // Send termination signal
          processInfo.process.kill('SIGTERM');
          
          // Wait a bit for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Force kill if still running
          if (!processInfo.process.killed) {
            processInfo.process.kill('SIGKILL');
            console.log(chalk.gray(`  Force killed process: ${name}`));
          }
        } catch (error) {
          console.warn(`Failed to cleanup process ${name}:`, error);
        }
      }
    }
  }


  async cleanupOldSessions(traceDir: string, olderThanDays: number = 30): Promise<void> {
    console.log(chalk.blue(`🗑️  Cleaning up sessions older than ${olderThanDays} days...`));
    
    const sessionsDir = join(traceDir, 'sessions');
    
    if (!existsSync(sessionsDir)) {
      return;
    }
    
    try {
      const sessions = await readdir(sessionsDir);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let removedCount = 0;
      
      for (const sessionDir of sessions) {
        const sessionPath = join(sessionsDir, sessionDir);
        
        try {
          const stats = await stat(sessionPath);
          
          if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
            await this.removeDirectory(sessionPath);
            removedCount++;
            console.log(chalk.gray(`  Removed old session: ${sessionDir}`));
          }
        } catch (error) {
          console.warn(`Failed to process session ${sessionDir}:`, error);
        }
      }
      
      console.log(chalk.green(`✓ Removed ${removedCount} old sessions`));
      
    } catch (error) {
      console.warn('Failed to cleanup old sessions:', error);
    }
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const entryPath = join(dirPath, entry);
        const stats = await stat(entryPath);
        
        if (stats.isDirectory()) {
          await this.removeDirectory(entryPath);
        } else {
          await unlink(entryPath);
        }
      }
      
      await rmdir(dirPath);
    } catch (error) {
      throw new Error(`Failed to remove directory ${dirPath}: ${error}`);
    }
  }

  async emergencyCleanup(): Promise<void> {
    console.log(chalk.red('🚨 Running emergency cleanup...'));
    
    try {
      // Kill any processes with opencode-trace in the name
      const { spawn } = await import('node:child_process');
      
      // On Unix systems, find and kill opencode-trace processes
      if (process.platform !== 'win32') {
        const pkill = spawn('pkill', ['-f', 'opencode-trace'], { stdio: 'ignore' });
        await new Promise<void>((resolve) => {
          pkill.on('exit', () => resolve());
          pkill.on('error', () => resolve()); // Ignore errors
        });
      }
      
      // Cleanup all temp files
      const tempDir = join(tmpdir(), 'opencode-trace');
      if (existsSync(tempDir)) {
        await this.removeDirectory(tempDir).catch(() => {});
      }
      
      console.log(chalk.green('✓ Emergency cleanup completed'));
      
    } catch (error) {
      console.error(chalk.red('❌ Emergency cleanup failed:'), error);
    }
  }
}