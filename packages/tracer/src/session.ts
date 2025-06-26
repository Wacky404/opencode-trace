import type { TraceEvent } from './types.js';
import type { TracerConfig } from './config.js';
import { v4 as uuidv4 } from 'uuid';

export interface SessionMetadata {
  opencode_version: string;
  working_directory: string;
  user_agent?: string;
  environment?: string;
  git_branch?: string;
  git_commit?: string;
}

export interface SessionSummary {
  total_requests: number;
  ai_requests: number;
  file_operations: number;
  total_cost: number;
  tokens_used: {
    input: number;
    output: number;
  };
  duration_ms?: number;
  error_count?: number;
}

export interface SessionMetrics {
  totalRequests: number;
  aiRequests: number;
  fileOperations: number;
  networkRequests: number;
  toolExecutions: number;
  totalCost: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  errorCount: number;
  lastActivityTime: number;
}

export interface SessionState {
  id: string;
  startTime: number;
  userQuery: string;
  metadata: SessionMetadata;
  metrics: SessionMetrics;
  status: 'active' | 'completed' | 'failed' | 'expired';
  filePath?: string;
  eventCount: number;
  lastFlushTime: number;
}

export interface SessionResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
}

export class SessionManager {
  private activeSessions: Map<string, SessionState> = new Map();
  private config: TracerConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly sessionTimeoutMs = 2 * 60 * 60 * 1000; // 2 hours

  constructor(config: TracerConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  async startSession(userQuery: string, metadata: SessionMetadata): Promise<SessionResult<string>> {
    try {
      const sessionId = uuidv4();
      const now = Date.now();

      const sessionState: SessionState = {
        id: sessionId,
        startTime: now,
        userQuery: userQuery.trim(),
        metadata: { ...metadata },
        metrics: {
          totalRequests: 0,
          aiRequests: 0,
          fileOperations: 0,
          networkRequests: 0,
          toolExecutions: 0,
          totalCost: 0,
          tokensUsed: { input: 0, output: 0 },
          errorCount: 0,
          lastActivityTime: now
        },
        status: 'active',
        eventCount: 0,
        lastFlushTime: now
      };

      // Check if we've exceeded the maximum number of sessions
      if (this.activeSessions.size >= this.config.maxSessionsRetained) {
        await this.cleanupOldestSession();
      }

      this.activeSessions.set(sessionId, sessionState);

      return {
        success: true,
        data: sessionId
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async getSession(sessionId: string): Promise<SessionResult<SessionState>> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: new Error(`Session not found: ${sessionId}`)
        };
      }

      // Check if session has expired
      if (this.isSessionExpired(session)) {
        session.status = 'expired';
        return {
          success: false,
          error: new Error(`Session expired: ${sessionId}`)
        };
      }

      return {
        success: true,
        data: { ...session } // Return a copy to prevent external modification
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async endSession(sessionId: string, summary?: SessionSummary): Promise<SessionResult<SessionSummary>> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: new Error(`Session not found: ${sessionId}`)
        };
      }

      if (session.status !== 'active') {
        return {
          success: false,
          error: new Error(`Session is not active: ${sessionId} (status: ${session.status})`)
        };
      }

      const now = Date.now();
      const duration = now - session.startTime;

      // Update session state
      session.status = 'completed';
      session.metrics.lastActivityTime = now;

      // Generate final summary
      const finalSummary: SessionSummary = {
        total_requests: summary?.total_requests ?? session.metrics.totalRequests,
        ai_requests: summary?.ai_requests ?? session.metrics.aiRequests,
        file_operations: summary?.file_operations ?? session.metrics.fileOperations,
        total_cost: summary?.total_cost ?? session.metrics.totalCost,
        tokens_used: {
          input: summary?.tokens_used?.input ?? session.metrics.tokensUsed.input,
          output: summary?.tokens_used?.output ?? session.metrics.tokensUsed.output
        },
        duration_ms: duration,
        error_count: summary?.error_count ?? session.metrics.errorCount
      };

      return {
        success: true,
        data: finalSummary
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async updateSessionMetrics(sessionId: string, updates: Partial<SessionMetrics>): Promise<SessionResult> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: new Error(`Session not found: ${sessionId}`)
        };
      }

      if (session.status !== 'active') {
        return {
          success: false,
          error: new Error(`Cannot update metrics for non-active session: ${sessionId}`)
        };
      }

      // Update metrics
      const metrics = session.metrics;
      if (updates.totalRequests !== undefined) metrics.totalRequests = Math.max(0, updates.totalRequests);
      if (updates.aiRequests !== undefined) metrics.aiRequests = Math.max(0, updates.aiRequests);
      if (updates.fileOperations !== undefined) metrics.fileOperations = Math.max(0, updates.fileOperations);
      if (updates.networkRequests !== undefined) metrics.networkRequests = Math.max(0, updates.networkRequests);
      if (updates.toolExecutions !== undefined) metrics.toolExecutions = Math.max(0, updates.toolExecutions);
      if (updates.totalCost !== undefined) metrics.totalCost = Math.max(0, updates.totalCost);
      if (updates.errorCount !== undefined) metrics.errorCount = Math.max(0, updates.errorCount);
      
      if (updates.tokensUsed) {
        if (updates.tokensUsed.input !== undefined) {
          metrics.tokensUsed.input = Math.max(0, updates.tokensUsed.input);
        }
        if (updates.tokensUsed.output !== undefined) {
          metrics.tokensUsed.output = Math.max(0, updates.tokensUsed.output);
        }
      }

      metrics.lastActivityTime = Date.now();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async addEventToSession(sessionId: string, event: TraceEvent): Promise<SessionResult> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: new Error(`Session not found: ${sessionId}`)
        };
      }

      if (session.status !== 'active') {
        return {
          success: false,
          error: new Error(`Cannot add event to non-active session: ${sessionId}`)
        };
      }

      // Update session activity
      session.eventCount++;
      session.metrics.lastActivityTime = Date.now();

      // Update metrics based on event type
      await this.updateMetricsFromEvent(session, event);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async setSessionFilePath(sessionId: string, filePath: string): Promise<SessionResult> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: new Error(`Session not found: ${sessionId}`)
        };
      }

      session.filePath = filePath;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  async markSessionFailed(sessionId: string, error: Error): Promise<SessionResult> {
    try {
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        return {
          success: false,
          error: new Error(`Session not found: ${sessionId}`)
        };
      }

      session.status = 'failed';
      session.metrics.errorCount++;
      session.metrics.lastActivityTime = Date.now();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys()).filter(sessionId => {
      const session = this.activeSessions.get(sessionId);
      return session && session.status === 'active' && !this.isSessionExpired(session);
    });
  }

  getSessionCount(): number {
    return this.activeSessions.size;
  }

  async cleanupExpiredSessions(): Promise<SessionResult<number>> {
    try {
      let cleanedCount = 0;
      const now = Date.now();

      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (this.isSessionExpired(session)) {
          session.status = 'expired';
          this.activeSessions.delete(sessionId);
          cleanedCount++;
        }
      }

      return {
        success: true,
        data: cleanedCount
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  private async updateMetricsFromEvent(session: SessionState, event: TraceEvent): Promise<void> {
    const metrics = session.metrics;
    metrics.totalRequests++;

    switch (event.type) {
      case 'ai_request':
        metrics.aiRequests++;
        break;
      case 'ai_response':
        const aiResponse = event as any;
        if (aiResponse.cost) {
          metrics.totalCost += aiResponse.cost;
        }
        if (aiResponse.tokens_used) {
          metrics.tokensUsed.input += aiResponse.tokens_used.input || 0;
          metrics.tokensUsed.output += aiResponse.tokens_used.output || 0;
        }
        break;
      case 'tool_execution':
        metrics.toolExecutions++;
        const toolEvent = event as any;
        if (toolEvent.tool_name && ['read', 'write', 'edit'].includes(toolEvent.tool_name)) {
          metrics.fileOperations++;
        }
        if (!toolEvent.success) {
          metrics.errorCount++;
        }
        break;
      case 'network_request':
        metrics.networkRequests++;
        break;
      case 'network_response':
        const networkResponse = event as any;
        if (networkResponse.status >= 400) {
          metrics.errorCount++;
        }
        break;
    }
  }

  private isSessionExpired(session: SessionState): boolean {
    const now = Date.now();
    return (now - session.metrics.lastActivityTime) > this.sessionTimeoutMs;
  }

  private async cleanupOldestSession(): Promise<void> {
    let oldestSession: SessionState | null = null;
    let oldestSessionId: string | null = null;

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (!oldestSession || session.startTime < oldestSession.startTime) {
        oldestSession = session;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      this.activeSessions.delete(oldestSessionId);
    }
  }

  private startCleanupTimer(): void {
    // Clean up expired sessions every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        console.error('Error during session cleanup:', error);
      });
    }, 5 * 60 * 1000);
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Mark all active sessions as completed
    for (const session of this.activeSessions.values()) {
      if (session.status === 'active') {
        session.status = 'completed';
      }
    }
  }

  updateConfig(config: TracerConfig): void {
    this.config = config;
  }
}