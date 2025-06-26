import type { 
  WebSocketConfig,
  WebSocketMetrics,
  RequestTiming
} from '../types.js';
import type { JSONLLogger } from '../logger.js';

export interface ConnectionManagerConfig extends WebSocketConfig {
  sessionId: string;
  logger: JSONLLogger;
  url: string;
}

export interface ConnectionState {
  id: string;
  url: string;
  state: 'connecting' | 'open' | 'closing' | 'closed';
  startTime: number;
  endTime?: number;
  duration?: number;
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
  lastActivity: number;
}

export class ConnectionManager {
  private config: ConnectionManagerConfig;
  private connectionState: ConnectionState;
  private performanceTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: ConnectionManagerConfig) {
    this.config = config;
    this.connectionState = this.initializeConnectionState();
    
    if (this.config.enablePerformanceMetrics) {
      this.startPerformanceMonitoring();
    }
  }

  private initializeConnectionState(): ConnectionState {
    return {
      id: this.generateConnectionId(),
      url: this.config.url,
      state: 'connecting',
      startTime: Date.now(),
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      errors: 0,
      lastActivity: Date.now()
    };
  }

  private generateConnectionId(): string {
    return `ws-${this.config.sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public updateConnectionState(state: 'connecting' | 'open' | 'closing' | 'closed'): void {
    const now = Date.now();
    
    this.connectionState.state = state;
    this.connectionState.lastActivity = now;

    if (state === 'closed') {
      this.connectionState.endTime = now;
      this.connectionState.duration = now - this.connectionState.startTime;
    }
  }

  public recordMessageActivity(direction: 'sent' | 'received', bytes: number): void {
    const now = Date.now();
    
    if (direction === 'sent') {
      this.connectionState.messagesSent++;
      this.connectionState.bytesSent += bytes;
    } else {
      this.connectionState.messagesReceived++;
      this.connectionState.bytesReceived += bytes;
    }
    
    this.connectionState.lastActivity = now;
  }

  public recordError(): void {
    this.connectionState.errors++;
    this.connectionState.lastActivity = Date.now();
  }

  public getConnectionState(): Readonly<ConnectionState> {
    return { ...this.connectionState };
  }

  public getConnectionMetrics(): WebSocketMetrics {
    const duration = this.connectionState.duration || 
                    (Date.now() - this.connectionState.startTime);
    
    const totalMessages = this.connectionState.messagesReceived + this.connectionState.messagesSent;
    const averageLatency = totalMessages > 0 ? duration / totalMessages : 0;

    return {
      connectionCount: 1, // This manager handles one connection
      messagesInbound: this.connectionState.messagesReceived,
      messagesOutbound: this.connectionState.messagesSent,
      bytesInbound: this.connectionState.bytesReceived,
      bytesOutbound: this.connectionState.bytesSent,
      averageLatency,
      connectionDuration: duration,
      errors: this.connectionState.errors
    };
  }

  public isConnectionHealthy(): boolean {
    const now = Date.now();
    const timeSinceLastActivity = now - this.connectionState.lastActivity;
    
    // Consider connection unhealthy if no activity for 30 seconds
    const maxInactivity = 30 * 1000;
    
    return this.connectionState.state === 'open' && 
           timeSinceLastActivity < maxInactivity &&
           this.connectionState.errors < 10; // Arbitrary error threshold
  }

  private startPerformanceMonitoring(): void {
    // Log performance metrics every 10 seconds
    this.performanceTimer = setInterval(async () => {
      await this.logPerformanceMetrics();
    }, 10000);

    // Health check every 5 seconds
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, 5000);
  }

  private async logPerformanceMetrics(): Promise<void> {
    if (this.connectionState.state !== 'open') return;

    const metrics = this.getConnectionMetrics();
    
    // Create a performance event (we could add this to types.ts if needed)
    const performanceEvent = {
      type: 'websocket_performance',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      connection_id: this.connectionState.id,
      metrics,
      connection_state: this.connectionState.state
    };

    try {
      await this.config.logger.logEvent(performanceEvent);
    } catch (error) {
      console.error('Failed to log WebSocket performance metrics:', error);
    }
  }

  private performHealthCheck(): void {
    if (!this.isConnectionHealthy()) {
      this.logHealthIssue();
    }
  }

  private async logHealthIssue(): Promise<void> {
    const healthEvent = {
      type: 'websocket_health_warning',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      connection_id: this.connectionState.id,
      issue: 'Connection health check failed',
      state: this.connectionState.state,
      last_activity: this.connectionState.lastActivity,
      errors: this.connectionState.errors
    };

    try {
      await this.config.logger.logEvent(healthEvent);
    } catch (error) {
      console.error('Failed to log WebSocket health warning:', error);
    }
  }

  public async cleanup(): Promise<void> {
    // Clear timers
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Update final state
    this.updateConnectionState('closed');
    
    // Log final metrics
    if (this.config.enablePerformanceMetrics) {
      await this.logFinalMetrics();
    }
  }

  private async logFinalMetrics(): Promise<void> {
    const finalMetrics = this.getConnectionMetrics();
    
    const finalEvent = {
      type: 'websocket_connection_summary',
      timestamp: Date.now(),
      session_id: this.config.sessionId,
      connection_id: this.connectionState.id,
      metrics: finalMetrics,
      connection_duration: this.connectionState.duration || 0,
      total_messages: this.connectionState.messagesReceived + this.connectionState.messagesSent,
      total_bytes: this.connectionState.bytesReceived + this.connectionState.bytesSent,
      error_rate: finalMetrics.errors > 0 ? 
        finalMetrics.errors / (finalMetrics.messagesInbound + finalMetrics.messagesOutbound) : 0
    };

    try {
      await this.config.logger.logEvent(finalEvent);
    } catch (error) {
      console.error('Failed to log final WebSocket metrics:', error);
    }
  }

  // Utility methods for connection management
  public getConnectionAge(): number {
    return Date.now() - this.connectionState.startTime;
  }

  public getTimeSinceLastActivity(): number {
    return Date.now() - this.connectionState.lastActivity;
  }

  public getThroughputMetrics(): {
    messagesPerSecond: number;
    bytesPerSecond: number;
  } {
    const duration = this.getConnectionAge() / 1000; // Convert to seconds
    
    if (duration === 0) {
      return { messagesPerSecond: 0, bytesPerSecond: 0 };
    }

    const totalMessages = this.connectionState.messagesReceived + this.connectionState.messagesSent;
    const totalBytes = this.connectionState.bytesReceived + this.connectionState.bytesSent;

    return {
      messagesPerSecond: totalMessages / duration,
      bytesPerSecond: totalBytes / duration
    };
  }
}