import { EventEmitter } from 'node:events';
import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { IPCMessage } from '../types/cli.js';

export class IPCManager extends EventEmitter {
  private sessionId: string = '';
  private ipcDir: string = '';
  private isActive: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;

  async setupIPC(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.ipcDir = join(tmpdir(), 'opencode-trace', sessionId);
    
    // Create IPC directory
    await mkdir(this.ipcDir, { recursive: true });
    
    // Start polling for messages
    this.startPolling();
    this.isActive = true;
  }

  async broadcastToComponents(message: IPCMessage): Promise<void> {
    if (!this.isActive) {
      throw new Error('IPC not initialized');
    }
    
    const messageFile = join(this.ipcDir, `msg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    
    try {
      await writeFile(messageFile, JSON.stringify(message, null, 2));
    } catch (error) {
      console.error('Failed to broadcast IPC message:', error);
    }
  }

  async handleComponentMessage(message: IPCMessage): Promise<void> {
    // Process incoming message from components
    this.emit('message', message);
    
    // Handle specific message types
    switch (message.type) {
      case 'session_start':
        this.emit('sessionStart', message);
        break;
      case 'session_end':
        this.emit('sessionEnd', message);
        break;
      case 'event':
        this.emit('traceEvent', message);
        break;
      case 'status':
        this.emit('statusUpdate', message);
        break;
      case 'error':
        this.emit('error', message);
        break;
      case 'health_check':
        this.emit('healthCheck', message);
        break;
    }
  }

  async cleanup(): Promise<void> {
    if (!this.isActive) {
      return;
    }
    
    this.isActive = false;
    
    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    
    // Clean up IPC directory
    try {
      if (existsSync(this.ipcDir)) {
        const { readdir } = await import('node:fs/promises');
        const files = await readdir(this.ipcDir);
        
        // Remove all message files
        await Promise.all(
          files.map(file => 
            unlink(join(this.ipcDir, file)).catch(() => {}) // Ignore errors
          )
        );
        
        // Try to remove the directory (will fail if not empty, which is fine)
        await unlink(this.ipcDir).catch(() => {});
      }
    } catch (error) {
      console.warn('Failed to cleanup IPC directory:', error);
    }
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollForMessages();
      } catch (error) {
        console.error('IPC polling error:', error);
      }
    }, 500); // Poll every 500ms
  }

  private async pollForMessages(): Promise<void> {
    if (!existsSync(this.ipcDir)) {
      return;
    }
    
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(this.ipcDir);
      
      // Process message files
      for (const file of files) {
        if (file.startsWith('msg-') && file.endsWith('.json')) {
          await this.processMessageFile(join(this.ipcDir, file));
        }
      }
    } catch (error) {
      // Directory might not exist or be readable, ignore
    }
  }

  private async processMessageFile(filePath: string): Promise<void> {
    try {
      // Check if file still exists (race condition protection)
      if (!existsSync(filePath)) {
        return;
      }
      
      const content = await readFile(filePath, 'utf-8');
      const message: IPCMessage = JSON.parse(content);
      
      // Validate message
      if (this.isValidMessage(message)) {
        await this.handleComponentMessage(message);
      }
      
      // Remove processed message file (ignore errors if already removed)
      try {
        await unlink(filePath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.warn('Failed to remove processed message file:', filePath, error);
        }
      }
      
    } catch (error: any) {
      // Don't log ENOENT errors (file already processed by another instance)
      if (error.code !== 'ENOENT') {
        console.warn('Failed to process message file:', filePath, error);
      }
      
      // Try to remove invalid file (only if it exists)
      if (existsSync(filePath)) {
        try {
          await unlink(filePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  private isValidMessage(message: any): message is IPCMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.type === 'string' &&
      typeof message.sessionId === 'string' &&
      typeof message.timestamp === 'number' &&
      typeof message.source === 'string'
    );
  }

  // Utility methods for specific message types
  async sendSessionStart(): Promise<void> {
    const message: IPCMessage = {
      type: 'session_start',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      source: 'wrapper'
    };
    
    await this.broadcastToComponents(message);
  }

  async sendSessionEnd(): Promise<void> {
    const message: IPCMessage = {
      type: 'session_end',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      source: 'wrapper'
    };
    
    await this.broadcastToComponents(message);
  }

  async sendHealthCheck(): Promise<void> {
    const message: IPCMessage = {
      type: 'health_check',
      sessionId: this.sessionId,
      timestamp: Date.now(),
      source: 'wrapper'
    };
    
    await this.broadcastToComponents(message);
  }
}