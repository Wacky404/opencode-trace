import type { 
  TraceEvent, 
  SessionData, 
  TimelineItem, 
  CorrelationResult,
  RequestResponsePair,
  ToolExecutionFlow,
  EventRelationship,
  AIRequestEvent,
  AIResponseEvent,
  ToolExecutionEvent
} from '../types/trace.js';

/**
 * Event correlator for linking related trace events
 * Builds session timelines and tracks event relationships
 */
export class EventCorrelator {
  private events: Map<string, TraceEvent> = new Map();
  private sessions: Map<string, SessionData> = new Map();
  private relationships: Map<string, EventRelationship[]> = new Map();

  /**
   * Process and correlate a batch of trace events
   */
  correlateEvents(events: TraceEvent[]): CorrelationResult {
    // Clear previous state
    this.reset();

    // Index all events
    for (const event of events) {
      this.events.set(event.id, event);
    }

    // Build relationships
    this.buildRelationships();

    // Create sessions
    this.createSessions();

    // Build timelines
    this.buildTimelines();

    // Calculate flows
    const requestResponsePairs = this.findRequestResponsePairs();
    const toolExecutionFlows = this.findToolExecutionFlows();

    return {
      sessions: Array.from(this.sessions.values()),
      relationships: Array.from(this.relationships.values()).flat(),
      requestResponsePairs,
      toolExecutionFlows,
      totalEvents: events.length,
      totalSessions: this.sessions.size
    };
  }

  /**
   * Get session data by ID
   */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all events for a session
   */
  getSessionEvents(sessionId: string): TraceEvent[] {
    return Array.from(this.events.values())
      .filter(event => event.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Find events related to a specific event
   */
  getRelatedEvents(eventId: string): TraceEvent[] {
    const relationships = this.relationships.get(eventId) || [];
    return relationships
      .map(rel => this.events.get(rel.targetId))
      .filter(Boolean) as TraceEvent[];
  }

  /**
   * Get timeline for a specific session
   */
  getSessionTimeline(sessionId: string): TimelineItem[] {
    const session = this.sessions.get(sessionId);
    return session?.timeline || [];
  }

  private reset(): void {
    this.events.clear();
    this.sessions.clear();
    this.relationships.clear();
  }

  private buildRelationships(): void {
    for (const event of this.events.values()) {
      const relationships: EventRelationship[] = [];

      // Parent-child relationships
      if (event.parentId) {
        const parent = this.events.get(event.parentId);
        if (parent) {
          relationships.push({
            sourceId: event.id,
            targetId: parent.id,
            type: 'parent',
            strength: 1.0
          });
        }
      }

      // Request-response pairs
      if (event.type === 'ai_response') {
        const request = this.findRequestForResponse(event);
        if (request) {
          relationships.push({
            sourceId: event.id,
            targetId: request.id,
            type: 'response_to_request',
            strength: 1.0
          });
        }
      }

      // Tool execution relationships
      if (event.type === 'tool_execution') {
        const relatedRequest = this.findRequestForTool(event);
        if (relatedRequest) {
          relationships.push({
            sourceId: event.id,
            targetId: relatedRequest.id,
            type: 'tool_for_request',
            strength: 0.8
          });
        }
      }

      // Error relationships
      if (event.type === 'error') {
        const relatedEvents = this.findEventsAroundError(event);
        for (const related of relatedEvents) {
          relationships.push({
            sourceId: event.id,
            targetId: related.id,
            type: 'error_in_context',
            strength: 0.6
          });
        }
      }

      // Temporal relationships (events close in time)
      const temporallyRelated = this.findTemporallyRelatedEvents(event);
      for (const related of temporallyRelated) {
        relationships.push({
          sourceId: event.id,
          targetId: related.id,
          type: 'temporal',
          strength: 0.3
        });
      }

      if (relationships.length > 0) {
        this.relationships.set(event.id, relationships);
      }
    }
  }

  private createSessions(): void {
    // Group events by session
    const sessionEvents = new Map<string, TraceEvent[]>();
    
    for (const event of this.events.values()) {
      const sessionId = event.sessionId || 'unknown';
      if (!sessionEvents.has(sessionId)) {
        sessionEvents.set(sessionId, []);
      }
      sessionEvents.get(sessionId)!.push(event);
    }

    // Create session data
    for (const [sessionId, events] of sessionEvents) {
      const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);
      const firstEvent = sortedEvents[0];
      const lastEvent = sortedEvents[sortedEvents.length - 1];

      const session: SessionData = {
        id: sessionId,
        startTime: firstEvent.timestamp,
        endTime: lastEvent.timestamp,
        duration: lastEvent.timestamp - firstEvent.timestamp,
        eventCount: events.length,
        status: this.calculateSessionStatus(events),
        events: sortedEvents,
        timeline: [], // Will be built in buildTimelines
        summary: this.generateSessionSummary(events)
      };

      this.sessions.set(sessionId, session);
    }
  }

  private buildTimelines(): void {
    for (const session of this.sessions.values()) {
      const timeline = this.createTimelineFromEvents(session.events);
      session.timeline = timeline;
    }
  }

  private createTimelineFromEvents(events: TraceEvent[]): TimelineItem[] {
    const timeline: TimelineItem[] = [];
    const processedEvents = new Set<string>();

    for (const event of events) {
      if (processedEvents.has(event.id)) continue;

      const timelineItem = this.eventToTimelineItem(event);
      
      // Find children (events that reference this one as parent)
      const children = events.filter(e => e.parentId === event.id);
      if (children.length > 0) {
        timelineItem.children = children.map(child => {
          processedEvents.add(child.id);
          return this.eventToTimelineItem(child);
        });
      }

      timeline.push(timelineItem);
      processedEvents.add(event.id);
    }

    return timeline.sort((a, b) => a.timestamp - b.timestamp);
  }

  private eventToTimelineItem(event: TraceEvent): TimelineItem {
    const base: TimelineItem = {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      title: this.generateEventTitle(event),
      description: this.generateEventDescription(event),
      status: this.getEventStatus(event),
      metadata: event.metadata || {}
    };

    // Add duration if available
    if ('duration' in event && event.duration) {
      base.duration = event.duration;
    }

    // Add type-specific data
    switch (event.type) {
      case 'ai_request':
        base.data = {
          provider: event.provider,
          model: event.model,
          requestSize: JSON.stringify(event.request).length
        };
        break;

      case 'ai_response':
        base.data = {
          usage: event.usage,
          cost: event.cost,
          responseSize: JSON.stringify(event.response).length
        };
        break;

      case 'tool_execution':
        base.data = {
          toolName: event.toolName,
          status: event.status,
          hasResult: !!event.result
        };
        break;

      case 'error':
        base.data = {
          error: event.error,
          hasStack: !!event.stack
        };
        break;
    }

    return base;
  }

  private findRequestResponsePairs(): RequestResponsePair[] {
    const pairs: RequestResponsePair[] = [];
    
    for (const event of this.events.values()) {
      if (event.type === 'ai_response') {
        const request = this.findRequestForResponse(event);
        if (request) {
          pairs.push({
            requestId: request.id,
            responseId: event.id,
            sessionId: event.sessionId || 'unknown',
            timestamp: request.timestamp,
            duration: event.timestamp - request.timestamp,
            provider: (request as AIRequestEvent).provider,
            model: (request as AIRequestEvent).model,
            cost: (event as AIResponseEvent).cost,
            tokens: (event as AIResponseEvent).usage
          });
        }
      }
    }

    return pairs.sort((a, b) => a.timestamp - b.timestamp);
  }

  private findToolExecutionFlows(): ToolExecutionFlow[] {
    const flows: ToolExecutionFlow[] = [];
    
    for (const event of this.events.values()) {
      if (event.type === 'tool_execution') {
        const relatedRequest = this.findRequestForTool(event);
        
        flows.push({
          toolExecutionId: event.id,
          requestId: relatedRequest?.id,
          sessionId: event.sessionId || 'unknown',
          toolName: (event as ToolExecutionEvent).toolName,
          timestamp: event.timestamp,
          duration: (event as ToolExecutionEvent).duration || 0,
          status: (event as ToolExecutionEvent).status || 'unknown',
          hasError: !!(event as ToolExecutionEvent).error
        });
      }
    }

    return flows.sort((a, b) => a.timestamp - b.timestamp);
  }

  private findRequestForResponse(response: TraceEvent): TraceEvent | null {
    if (response.parentId) {
      const parent = this.events.get(response.parentId);
      if (parent && parent.type === 'ai_request') {
        return parent;
      }
    }

    // Fallback: find most recent request in same session
    const sessionEvents = Array.from(this.events.values())
      .filter(e => e.sessionId === response.sessionId && e.type === 'ai_request')
      .filter(e => e.timestamp < response.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp);

    return sessionEvents[0] || null;
  }

  private findRequestForTool(tool: TraceEvent): TraceEvent | null {
    if (tool.parentId) {
      const parent = this.events.get(tool.parentId);
      if (parent && parent.type === 'ai_request') {
        return parent;
      }
    }

    // Find request within reasonable time window (10 seconds)
    const timeWindow = 10000;
    const candidates = Array.from(this.events.values())
      .filter(e => e.sessionId === tool.sessionId && e.type === 'ai_request')
      .filter(e => Math.abs(e.timestamp - tool.timestamp) <= timeWindow)
      .sort((a, b) => Math.abs(a.timestamp - tool.timestamp) - Math.abs(b.timestamp - tool.timestamp));

    return candidates[0] || null;
  }

  private findEventsAroundError(error: TraceEvent): TraceEvent[] {
    const timeWindow = 5000; // 5 seconds
    return Array.from(this.events.values())
      .filter(e => e.sessionId === error.sessionId && e.id !== error.id)
      .filter(e => Math.abs(e.timestamp - error.timestamp) <= timeWindow)
      .slice(0, 3); // Limit to 3 related events
  }

  private findTemporallyRelatedEvents(event: TraceEvent): TraceEvent[] {
    const timeWindow = 1000; // 1 second
    return Array.from(this.events.values())
      .filter(e => e.sessionId === event.sessionId && e.id !== event.id)
      .filter(e => Math.abs(e.timestamp - event.timestamp) <= timeWindow)
      .slice(0, 2); // Limit to 2 temporally related events
  }

  private calculateSessionStatus(events: TraceEvent[]): 'active' | 'completed' | 'error' | 'cancelled' {
    const hasErrors = events.some(e => e.type === 'error');
    if (hasErrors) return 'error';

    const hasActiveTools = events.some(e => 
      e.type === 'tool_execution' && 
      'status' in e && 
      e.status === 'running'
    );
    if (hasActiveTools) return 'active';

    return 'completed';
  }

  private generateSessionSummary(events: TraceEvent[]): string {
    const requestCount = events.filter(e => e.type === 'ai_request').length;
    const toolCount = events.filter(e => e.type === 'tool_execution').length;
    const errorCount = events.filter(e => e.type === 'error').length;

    const parts: string[] = [];
    if (requestCount > 0) parts.push(`${requestCount} AI request${requestCount !== 1 ? 's' : ''}`);
    if (toolCount > 0) parts.push(`${toolCount} tool execution${toolCount !== 1 ? 's' : ''}`);
    if (errorCount > 0) parts.push(`${errorCount} error${errorCount !== 1 ? 's' : ''}`);

    return parts.join(', ') || 'No events';
  }

  private generateEventTitle(event: TraceEvent): string {
    switch (event.type) {
      case 'ai_request':
        return `${event.provider} ${event.model || 'request'}`;
      case 'ai_response':
        return 'AI Response';
      case 'tool_execution':
        return `Tool: ${event.toolName}`;
      case 'error':
        return 'Error';
      default:
        return event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  private generateEventDescription(event: TraceEvent): string {
    switch (event.type) {
      case 'ai_request':
        if ('request' in event && event.request?.messages) {
          const messageCount = Array.isArray(event.request.messages) ? event.request.messages.length : 0;
          return `${messageCount} message${messageCount !== 1 ? 's' : ''}`;
        }
        return 'AI request';

      case 'ai_response':
        if ('usage' in event && event.usage) {
          return `${event.usage.total_tokens || 0} tokens`;
        }
        return 'AI response';

      case 'tool_execution':
        return `Status: ${event.status || 'unknown'}`;

      case 'error':
        return typeof event.error === 'string' ? event.error : 'Error occurred';

      default:
        return '';
    }
  }

  private getEventStatus(event: TraceEvent): 'success' | 'error' | 'warning' | 'info' {
    switch (event.type) {
      case 'error':
        return 'error';
      
      case 'tool_execution':
        if ('status' in event) {
          switch (event.status) {
            case 'success': return 'success';
            case 'error': return 'error';
            case 'running': return 'warning';
            default: return 'info';
          }
        }
        return 'info';

      case 'ai_request':
      case 'ai_response':
        return 'success';

      default:
        return 'info';
    }
  }
}

/**
 * Utility functions for event correlation
 */
export const CorrelationUtils = {
  /**
   * Find gaps in timeline (periods with no events)
   */
  findTimelineGaps(events: TraceEvent[], minGapMs = 1000): Array<{ start: number; end: number; duration: number }> {
    if (events.length < 2) return [];

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const gaps: Array<{ start: number; end: number; duration: number }> = [];

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
      if (gap >= minGapMs) {
        gaps.push({
          start: sorted[i - 1].timestamp,
          end: sorted[i].timestamp,
          duration: gap
        });
      }
    }

    return gaps;
  },

  /**
   * Calculate event density over time
   */
  calculateEventDensity(events: TraceEvent[], windowMs = 60000): Array<{ timestamp: number; count: number }> {
    if (events.length === 0) return [];

    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const start = sorted[0].timestamp;
    const end = sorted[sorted.length - 1].timestamp;
    const density: Array<{ timestamp: number; count: number }> = [];

    for (let t = start; t <= end; t += windowMs) {
      const count = events.filter(e => e.timestamp >= t && e.timestamp < t + windowMs).length;
      density.push({ timestamp: t, count });
    }

    return density;
  },

  /**
   * Find event patterns (repeating sequences)
   */
  findEventPatterns(events: TraceEvent[]): Array<{ pattern: string[]; occurrences: number }> {
    const patterns = new Map<string, number>();
    const windowSize = 3; // Look for patterns of 3 events

    for (let i = 0; i <= events.length - windowSize; i++) {
      const pattern = events.slice(i, i + windowSize).map(e => e.type);
      const key = pattern.join('-');
      patterns.set(key, (patterns.get(key) || 0) + 1);
    }

    return Array.from(patterns.entries())
      .filter(([_, count]) => count > 1)
      .map(([pattern, count]) => ({ pattern: pattern.split('-'), occurrences: count }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }
};