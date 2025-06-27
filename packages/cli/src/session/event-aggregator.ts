import { EventEmitter } from 'node:events';
import { logEvent } from '../interceptors/server-interceptor.js';
import type { SessionContext } from '../types/cli.js';

export class EventAggregator extends EventEmitter {
  private session: SessionContext | null = null;
  private events: Map<string, any> = new Map();
  private eventCount = 0;
  private duplicateCount = 0;
  private lastEventTime = 0;

  async initialize(session: SessionContext): Promise<void> {
    this.session = session;
    this.events.clear();
    this.eventCount = 0;
    this.duplicateCount = 0;
    this.lastEventTime = Date.now();
    
    console.log('📊 Event aggregator initialized');
  }

  async processEvent(event: any): Promise<void> {
    if (!this.session) {
      throw new Error('Event aggregator not initialized');
    }

    try {
      // Add early validation to prevent crashes
      if (!event || typeof event !== 'object') {
        console.warn('⚠️  Received invalid event (not an object):', event);
        return;
      }

      if (this.session.config.debug) {
        console.log(`🔄 Processing event: ${event.type || 'unknown'}`);
      }
      
      // Validate event structure
      const validatedEvent = this.validateEvent(event);
      
      // Check for duplicates
      const isDuplicate = this.checkForDuplicate(validatedEvent);
      
      if (isDuplicate) {
        this.duplicateCount++;
        const existingEvent = this.events.get(validatedEvent.id);
        if (existingEvent && validatedEvent) {
          this.emit('duplicateDetected', existingEvent, validatedEvent);
        }
        if (this.session.config.debug) {
          console.log(`⚠️  Duplicate event filtered: ${event.type || 'unknown'}`);
        }
        return;
      }
      
      // Enrich event with session context
      const enrichedEvent = this.enrichEvent(validatedEvent);
      
      // Store event
      this.events.set(enrichedEvent.id, enrichedEvent);
      this.eventCount++;
      this.lastEventTime = Date.now();
      
      if (this.session.config.debug) {
        console.log(`💾 Writing event to JSONL: ${enrichedEvent.type}`);
      }
      
      // Log to file
      logEvent(enrichedEvent);
      
      // Emit aggregated event
      this.emit('eventAggregated', enrichedEvent);
      
      if (this.session.config.debug) {
        console.log(`📈 Event processed: ${enrichedEvent.type} (total: ${this.eventCount})`);
      }
      
    } catch (error) {
      console.error('Failed to process event:', error);
      this.emit('error', error);
    }
  }

  private validateEvent(event: any): any {
    // Ensure required fields
    if (!event.type) {
      throw new Error('Event missing required field: type');
    }
    
    // Generate ID if not present
    if (!event.id) {
      event.id = this.generateEventId(event);
    }
    
    // Ensure timestamp
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }
    
    // Ensure session ID
    if (!event.sessionId) {
      event.sessionId = this.session!.sessionId;
    }
    
    return event;
  }

  private checkForDuplicate(event: any): boolean {
    // Check if we've seen this exact event before
    if (this.events.has(event.id)) {
      return true;
    }
    
    // Check for functional duplicates (same type, timestamp, and key data)
    const duplicateThreshold = 1000; // 1 second
    
    for (const existingEvent of this.events.values()) {
      // Validate existing event before comparison
      if (!existingEvent || typeof existingEvent !== 'object' || !existingEvent.type) {
        continue;
      }
      
      if (existingEvent.type === event.type &&
          Math.abs(existingEvent.timestamp - event.timestamp) < duplicateThreshold &&
          this.areEventsSimilar(existingEvent, event)) {
        return true;
      }
    }
    
    return false;
  }

  private areEventsSimilar(event1: any, event2: any): boolean {
    // Validate both events before comparing
    if (!event1 || !event2 || typeof event1 !== 'object' || typeof event2 !== 'object') {
      return false;
    }

    if (!event1.type || !event2.type) {
      return false;
    }

    // Define similarity checks based on event type
    switch (event1.type) {
      case 'http_request':
      case 'http_request_start':
      case 'https_connect_start':
        return event1.data?.url === event2.data?.url &&
               event1.data?.method === event2.data?.method;
      
      case 'http_response':
      case 'http_request_complete':
      case 'https_connect_complete':
        return event1.data?.url === event2.data?.url &&
               event1.data?.status === event2.data?.status;
      
      case 'file_write_start':
      case 'file_write_complete':
      case 'file_read_start':
      case 'file_read_complete':
        return event1.data?.path === event2.data?.path &&
               event1.data?.operation === event2.data?.operation;
      
      case 'tool_execution_start':
      case 'tool_execution_complete':
        return event1.data?.command === event2.data?.command &&
               event1.executionId === event2.executionId;
      
      default:
        // For unknown types, check if data objects are similar
        return JSON.stringify(event1.data) === JSON.stringify(event2.data);
    }
  }

  private enrichEvent(event: any): any {
    const enriched = {
      ...event,
      sessionId: this.session!.sessionId,
      metadata: {
        aggregated: true,
        eventIndex: this.eventCount + 1,
        processingTime: Date.now(),
        source: event.source || 'unknown'
      }
    };
    
    // Add correlation information for related events
    enriched.correlations = this.findCorrelations(enriched);
    
    // Add performance metrics if applicable
    if (this.isPerformanceEvent(enriched)) {
      enriched.performance = this.calculatePerformanceMetrics(enriched);
    }
    
    return enriched;
  }

  private findCorrelations(event: any): string[] {
    const correlations: string[] = [];
    
    // Find related events based on type and data
    switch (event.type) {
      case 'http_request_complete':
        // Find corresponding request start
        for (const [id, existingEvent] of this.events) {
          if (existingEvent.type === 'http_request_start' &&
              existingEvent.data?.url === event.data?.url &&
              existingEvent.requestId === event.requestId) {
            correlations.push(id);
          }
        }
        break;
      
      case 'file_write_complete':
        // Find corresponding write start
        for (const [id, existingEvent] of this.events) {
          if (existingEvent.type === 'file_write_start' &&
              existingEvent.data?.path === event.data?.path &&
              Math.abs(existingEvent.timestamp - event.timestamp) < 10000) {
            correlations.push(id);
          }
        }
        break;
      
      case 'tool_execution_complete':
        // Find corresponding execution start
        for (const [id, existingEvent] of this.events) {
          if (existingEvent.type === 'tool_execution_start' &&
              existingEvent.executionId === event.executionId) {
            correlations.push(id);
          }
        }
        break;
    }
    
    return correlations;
  }

  private isPerformanceEvent(event: any): boolean {
    const performanceEventTypes = [
      'http_request_complete',
      'file_write_complete',
      'file_read_complete',
      'tool_execution_complete'
    ];
    
    return performanceEventTypes.includes(event.type) && event.data?.duration;
  }

  private calculatePerformanceMetrics(event: any): any {
    const duration = event.data?.duration || 0;
    
    return {
      duration,
      category: this.categorizePerformance(duration, event.type),
      percentile: this.calculatePercentile(duration, event.type),
      trend: this.calculateTrend(event.type)
    };
  }

  private categorizePerformance(duration: number, eventType: string): string {
    // Define performance categories based on event type
    const thresholds = {
      'http_request_complete': { fast: 500, slow: 2000 },
      'file_write_complete': { fast: 100, slow: 1000 },
      'file_read_complete': { fast: 50, slow: 500 },
      'tool_execution_complete': { fast: 1000, slow: 10000 }
    };
    
    const threshold = thresholds[eventType] || { fast: 1000, slow: 5000 };
    
    if (duration < threshold.fast) return 'fast';
    if (duration < threshold.slow) return 'medium';
    return 'slow';
  }

  private calculatePercentile(duration: number, eventType: string): number {
    // Calculate percentile among similar events
    const similarEvents = Array.from(this.events.values())
      .filter(e => e.type === eventType && e.data?.duration)
      .map(e => e.data.duration)
      .sort((a, b) => a - b);
    
    if (similarEvents.length === 0) return 50;
    
    const index = similarEvents.findIndex(d => d >= duration);
    return index === -1 ? 100 : Math.round((index / similarEvents.length) * 100);
  }

  private calculateTrend(eventType: string): string {
    // Calculate performance trend for this event type
    const recentEvents = Array.from(this.events.values())
      .filter(e => e.type === eventType && e.data?.duration)
      .slice(-10); // Last 10 events
    
    if (recentEvents.length < 3) return 'stable';
    
    const durations = recentEvents.map(e => e.data.duration);
    const firstHalf = durations.slice(0, Math.floor(durations.length / 2));
    const secondHalf = durations.slice(Math.floor(durations.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (changePercent > 20) return 'degrading';
    if (changePercent < -20) return 'improving';
    return 'stable';
  }

  private generateEventId(event: any): string {
    // Generate a unique ID based on event content
    const timestamp = event.timestamp || Date.now();
    const type = event.type || 'unknown';
    const hash = this.simpleHash(JSON.stringify(event.data || {}));
    
    return `${type}_${timestamp}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async finalizeAggregation(): Promise<any> {
    console.log('🏁 Finalizing event aggregation...');
    
    const summary = {
      totalEvents: this.eventCount,
      duplicatesFiltered: this.duplicateCount,
      eventTypes: this.getEventTypeSummary(),
      timeRange: this.getTimeRange(),
      performance: this.getPerformanceSummary()
    };
    
    // Log final summary
    if (this.session) {
      logEvent({
        type: 'aggregation_summary',
        sessionId: this.session.sessionId,
        timestamp: Date.now(),
        data: summary
      });
    }
    
    console.log(`📊 Aggregation complete: ${this.eventCount} events processed, ${this.duplicateCount} duplicates filtered`);
    
    return summary;
  }

  private getEventTypeSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    
    for (const event of this.events.values()) {
      summary[event.type] = (summary[event.type] || 0) + 1;
    }
    
    return summary;
  }

  private getTimeRange(): { start: number; end: number; duration: number } {
    const timestamps = Array.from(this.events.values()).map(e => e.timestamp);
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    
    return {
      start,
      end,
      duration: end - start
    };
  }

  private getPerformanceSummary(): any {
    const performanceEvents = Array.from(this.events.values())
      .filter(e => this.isPerformanceEvent(e));
    
    if (performanceEvents.length === 0) {
      return { message: 'No performance events recorded' };
    }
    
    const durations = performanceEvents.map(e => e.data.duration);
    durations.sort((a, b) => a - b);
    
    return {
      count: performanceEvents.length,
      min: durations[0],
      max: durations[durations.length - 1],
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }

  async cleanup(): Promise<void> {
    this.events.clear();
    this.eventCount = 0;
    this.duplicateCount = 0;
    console.log('🧹 Event aggregator cleaned up');
  }

  // Public accessors
  
  getEventCount(): number {
    return this.eventCount;
  }

  getDuplicateCount(): number {
    return this.duplicateCount;
  }

  getEvents(): any[] {
    return Array.from(this.events.values());
  }

  getEventById(id: string): any | undefined {
    return this.events.get(id);
  }

  getEventsByType(type: string): any[] {
    return Array.from(this.events.values()).filter(e => e.type === type);
  }
}