import type { SessionData, TraceEvent, MetricsReport } from '../types/trace.js';
import type { ViewportSize } from '../types/ui.js';
import { BaseComponent } from './base/base-component.js';
import { property, state } from 'lit/decorators.js';
import { html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import { classMap } from 'lit/directives/class-map.js';
import { formatTimestamp, formatDuration, formatFileSize } from './base/component-utils.js';

/**
 * Comparison result interfaces
 */
export interface SessionComparisonData {
  sessions: SessionData[];
  metrics: ComparisonMetrics;
  timeline: ComparisonTimelineData;
  requests: ComparisonRequestData;
  tools: ComparisonToolData;
  costs: ComparisonCostData;
  performance: ComparisonPerformanceData;
}

export interface ComparisonMetrics {
  totalCost: ComparisonValue<number>;
  totalRequests: ComparisonValue<number>;
  duration: ComparisonValue<number>;
  errorRate: ComparisonValue<number>;
  toolCalls: ComparisonValue<number>;
  providers: ComparisonValue<string[]>;
}

export interface ComparisonValue<T> {
  values: T[];
  min: T;
  max: T;
  average?: T;
  difference?: T;
  changePercent?: number;
}

export interface ComparisonTimelineData {
  commonEvents: string[];
  uniqueEvents: Record<string, string[]>; // sessionId -> unique event types
  timeline: ComparisonTimelinePoint[];
}

export interface ComparisonTimelinePoint {
  timestamp: number;
  sessionEvents: Record<string, TraceEvent[]>; // sessionId -> events at this time
}

export interface ComparisonRequestData {
  commonProviders: string[];
  providerBreakdown: Record<string, ComparisonValue<number>>;
  responseTimeComparison: ComparisonValue<number>;
  costPerRequest: ComparisonValue<number>;
}

export interface ComparisonToolData {
  commonTools: string[];
  toolUsage: Record<string, ComparisonValue<number>>;
  toolSuccess: ComparisonValue<number>;
}

export interface ComparisonCostData {
  totalByProvider: Record<string, ComparisonValue<number>>;
  costEfficiency: ComparisonValue<number>; // cost per successful request
  trends: ComparisonTrendData[];
}

export interface ComparisonTrendData {
  timestamp: number;
  sessionCosts: Record<string, number>; // sessionId -> cost at this time
}

export interface ComparisonPerformanceData {
  throughput: ComparisonValue<number>; // requests per minute
  latency: ComparisonValue<number>;
  errorRate: ComparisonValue<number>;
  reliability: ComparisonValue<number>; // successful requests / total requests
}

/**
 * Comparison view modes
 */
export type ComparisonViewMode = 
  | 'overview'     // Side-by-side overview
  | 'detailed'     // Detailed diff view
  | 'timeline'     // Timeline comparison
  | 'metrics'      // Metrics comparison
  | 'requests'     // Request-by-request comparison
  | 'costs';       // Cost analysis comparison

/**
 * Comparison events
 */
export interface SessionComparisonEvents {
  'comparison-changed': { comparison: SessionComparisonData };
  'view-mode-changed': { mode: ComparisonViewMode };
  'session-selected': { sessionId: string; session: SessionData };
  'difference-highlighted': { metric: string; sessions: string[] };
}

/**
 * Advanced session comparison component for analyzing multiple sessions
 * Provides side-by-side comparison with detailed metrics and visualizations
 */
@customElement('session-comparison')
export class SessionComparison extends BaseComponent {
  static styles = [
    BaseComponent.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--vs-bg);
        overflow: hidden;
      }

      /* Header */
      .comparison-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-md);
        background-color: var(--vs-bg-secondary);
        border-bottom: 1px solid var(--vs-border);
        flex-shrink: 0;
      }

      .header-title {
        font-size: var(--text-xl);
        font-weight: var(--font-semibold);
        color: var(--vs-text);
        margin: 0;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
      }

      .view-selector {
        display: flex;
        background-color: var(--vs-bg-elevated);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }

      .view-button {
        padding: var(--size-xs) var(--size-sm);
        background: none;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        transition: var(--transition-fast);
        font-size: var(--text-sm);
        white-space: nowrap;
      }

      .view-button:hover {
        background-color: var(--vs-hover);
        color: var(--vs-text);
      }

      .view-button.active {
        background-color: var(--vs-accent);
        color: var(--vs-text-inverse);
      }

      /* Session Headers */
      .session-headers {
        display: flex;
        background-color: var(--vs-bg-tertiary);
        border-bottom: 1px solid var(--vs-border);
      }

      .session-header {
        flex: 1;
        padding: var(--size-md);
        border-right: 1px solid var(--vs-border);
        text-align: center;
      }

      .session-header:last-child {
        border-right: none;
      }

      .session-title {
        font-size: var(--text-lg);
        font-weight: var(--font-medium);
        color: var(--vs-text);
        margin: 0 0 var(--size-xs) 0;
      }

      .session-subtitle {
        font-size: var(--text-sm);
        color: var(--vs-text-muted);
        margin: 0;
      }

      .session-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        margin-top: var(--size-xs);
      }

      .session-badge.winner {
        background-color: var(--vs-success-bg);
        color: var(--vs-success);
        border: 1px solid var(--vs-success);
      }

      .session-badge.neutral {
        background-color: var(--vs-bg-elevated);
        color: var(--vs-text-muted);
        border: 1px solid var(--vs-border);
      }

      /* Content */
      .comparison-content {
        flex: 1;
        overflow: auto;
        position: relative;
      }

      /* Overview Grid */
      .overview-grid {
        display: flex;
        padding: var(--size-md);
        gap: var(--size-md);
        overflow-x: auto;
      }

      .session-column {
        flex: 1;
        min-width: 300px;
        display: flex;
        flex-direction: column;
        gap: var(--size-md);
      }

      .metric-card {
        background-color: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        padding: var(--size-md);
        transition: var(--transition-fast);
      }

      .metric-card:hover {
        border-color: var(--vs-border-light);
      }

      .metric-card.highlight {
        border-color: var(--vs-accent);
        box-shadow: 0 0 0 1px var(--vs-accent);
      }

      .metric-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--size-sm);
      }

      .metric-label {
        font-size: var(--text-sm);
        color: var(--vs-text-muted);
        font-weight: var(--font-medium);
      }

      .metric-trend {
        font-size: var(--text-xs);
        padding: 2px 4px;
        border-radius: var(--radius-sm);
      }

      .metric-trend.positive {
        background-color: var(--vs-success-bg);
        color: var(--vs-success);
      }

      .metric-trend.negative {
        background-color: var(--vs-error-bg);
        color: var(--vs-error);
      }

      .metric-trend.neutral {
        background-color: var(--vs-bg-elevated);
        color: var(--vs-text-muted);
      }

      .metric-value {
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--vs-text);
        margin: 0;
        line-height: 1.2;
      }

      .metric-comparison {
        font-size: var(--text-xs);
        color: var(--vs-text-muted);
        margin-top: var(--size-xs);
      }

      /* Comparison Table */
      .comparison-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
        background-color: var(--vs-bg-secondary);
      }

      .table-header {
        background-color: var(--vs-bg-tertiary);
        border-bottom: 2px solid var(--vs-border);
      }

      .table-cell {
        padding: var(--size-sm) var(--size-md);
        border-bottom: 1px solid var(--vs-border);
        border-right: 1px solid var(--vs-border);
        text-align: center;
        vertical-align: middle;
      }

      .table-cell:first-child {
        text-align: left;
        font-weight: var(--font-medium);
        background-color: var(--vs-bg-tertiary);
      }

      .table-cell:last-child {
        border-right: none;
      }

      .table-row:hover {
        background-color: var(--vs-hover);
      }

      .cell-best {
        background-color: var(--vs-success-bg);
        color: var(--vs-success);
        font-weight: var(--font-medium);
      }

      .cell-worst {
        background-color: var(--vs-error-bg);
        color: var(--vs-error);
      }

      /* Timeline Comparison */
      .timeline-comparison {
        padding: var(--size-md);
      }

      .timeline-container {
        position: relative;
        height: 400px;
        overflow-x: auto;
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        background-color: var(--vs-bg-secondary);
      }

      .timeline-sessions {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .timeline-session {
        flex: 1;
        border-bottom: 1px solid var(--vs-border);
        position: relative;
        padding: var(--size-sm);
      }

      .timeline-session:last-child {
        border-bottom: none;
      }

      .timeline-session-label {
        position: absolute;
        left: var(--size-sm);
        top: var(--size-sm);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--vs-text);
        background-color: var(--vs-bg);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        z-index: 5;
      }

      .timeline-events {
        display: flex;
        align-items: center;
        height: 100%;
        padding-left: 100px;
        position: relative;
      }

      .timeline-event {
        position: absolute;
        height: 20px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-xs);
        color: var(--vs-text-inverse);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: var(--transition-fast);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .timeline-event:hover {
        transform: scaleY(1.2);
        z-index: 10;
      }

      .timeline-event.request {
        background-color: var(--vs-accent);
      }

      .timeline-event.tool {
        background-color: var(--vs-function);
      }

      .timeline-event.error {
        background-color: var(--vs-error);
      }

      .timeline-event.websocket {
        background-color: var(--vs-type);
      }

      /* Difference Indicators */
      .difference-indicator {
        display: inline-flex;
        align-items: center;
        gap: var(--size-xs);
        font-size: var(--text-xs);
        padding: 2px 4px;
        border-radius: var(--radius-sm);
        font-weight: var(--font-medium);
      }

      .difference-indicator.major {
        background-color: var(--vs-error-bg);
        color: var(--vs-error);
      }

      .difference-indicator.minor {
        background-color: var(--vs-warning-bg);
        color: var(--vs-warning);
      }

      .difference-indicator.none {
        background-color: var(--vs-success-bg);
        color: var(--vs-success);
      }

      /* Charts */
      .chart-container {
        background-color: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        padding: var(--size-md);
        margin-bottom: var(--size-md);
      }

      .chart-title {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--vs-text);
        margin: 0 0 var(--size-md) 0;
      }

      .chart-content {
        height: 200px;
        display: flex;
        align-items: end;
        gap: var(--size-sm);
        padding: var(--size-sm) 0;
      }

      .chart-bar-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--size-xs);
      }

      .chart-bars {
        display: flex;
        align-items: end;
        gap: 2px;
        height: 150px;
        width: 100%;
        justify-content: center;
      }

      .chart-bar {
        flex: 1;
        max-width: 30px;
        border-radius: var(--radius-sm) var(--radius-sm) 0 0;
        transition: var(--transition-fast);
        position: relative;
        min-height: 4px;
      }

      .chart-bar:hover {
        opacity: 0.8;
      }

      .chart-bar.session-0 {
        background-color: var(--vs-accent);
      }

      .chart-bar.session-1 {
        background-color: var(--vs-function);
      }

      .chart-bar.session-2 {
        background-color: var(--vs-type);
      }

      .chart-bar.session-3 {
        background-color: var(--vs-user);
      }

      .chart-label {
        font-size: var(--text-xs);
        color: var(--vs-text-muted);
        text-align: center;
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Summary Stats */
      .summary-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--size-md);
        padding: var(--size-md);
        background-color: var(--vs-bg-tertiary);
        margin-bottom: var(--size-md);
      }

      .summary-stat {
        text-align: center;
      }

      .summary-label {
        font-size: var(--text-sm);
        color: var(--vs-text-muted);
        margin-bottom: var(--size-xs);
      }

      .summary-value {
        font-size: var(--text-lg);
        font-weight: var(--font-bold);
        color: var(--vs-text);
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .overview-grid {
          flex-direction: column;
        }

        .session-column {
          min-width: auto;
        }

        .session-headers {
          flex-direction: column;
        }

        .session-header {
          border-right: none;
          border-bottom: 1px solid var(--vs-border);
        }

        .comparison-table {
          font-size: var(--text-xs);
        }

        .table-cell {
          padding: var(--size-xs) var(--size-sm);
        }

        .timeline-container {
          height: 300px;
        }

        .timeline-session-label {
          font-size: var(--text-xs);
        }

        .summary-stats {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 480px) {
        .comparison-header {
          flex-direction: column;
          gap: var(--size-sm);
          align-items: stretch;
        }

        .header-controls {
          justify-content: center;
        }

        .view-selector {
          width: 100%;
        }

        .view-button {
          flex: 1;
        }

        .summary-stats {
          grid-template-columns: 1fr;
        }

        .chart-content {
          height: 150px;
        }

        .chart-bars {
          height: 100px;
        }
      }

      /* Empty State */
      .empty-comparison {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--size-2xl);
        color: var(--vs-text-muted);
        text-align: center;
      }

      .empty-icon {
        font-size: 3rem;
        margin-bottom: var(--size-md);
        opacity: 0.5;
      }

      /* Loading State */
      .loading-comparison {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: var(--vs-text-muted);
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--vs-border);
        border-top: 3px solid var(--vs-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: var(--size-md);
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `
  ];

  @property({ type: Array })
  sessions: SessionData[] = [];

  @property({ type: String })
  viewMode: ComparisonViewMode = 'overview';

  @property({ type: Boolean })
  showTimeline: boolean = true;

  @property({ type: Boolean })
  showCharts: boolean = true;

  @state()
  private comparison: SessionComparisonData | null = null;

  @state()
  private viewportSize: ViewportSize = 'desktop';

  @state()
  private highlightedMetric: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.updateViewportSize();
    window.addEventListener('resize', this.handleResize);
    this.calculateComparison();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('sessions')) {
      this.calculateComparison();
    }
  }

  private handleResize = () => {
    this.updateViewportSize();
  };

  private updateViewportSize() {
    const width = window.innerWidth;
    if (width < 480) {
      this.viewportSize = 'mobile';
    } else if (width < 768) {
      this.viewportSize = 'tablet';
    } else {
      this.viewportSize = 'desktop';
    }
  }

  private getSessionCost(session: SessionData): number {
    return session.events
      ?.filter(e => e.type === 'ai_response')
      .reduce((sum, e) => sum + ((e as any).cost || 0), 0) || 0;
  }

  private getRequestCount(session: SessionData): number {
    return session.events?.filter(e => e.type === 'ai_request').length || 0;
  }

  private getErrorCount(session: SessionData): number {
    return session.events?.filter(e => e.type === 'error').length || 0;
  }

  private getToolCount(session: SessionData): number {
    return session.events?.filter(e => e.type === 'tool_execution').length || 0;
  }

  private calculateComparison() {
    if (this.sessions.length < 2) {
      this.comparison = null;
      return;
    }

    // Calculate comparison metrics
    const totalCosts = this.sessions.map(s => this.getSessionCost(s));
    const totalRequests = this.sessions.map(s => this.getRequestCount(s));
    const durations = this.sessions.map(s => s.duration || 0);
    const errorRates = this.sessions.map(s => {
      const requests = this.getRequestCount(s);
      const errors = this.getErrorCount(s);
      return requests > 0 ? (errors / requests) * 100 : 0;
    });
    const toolCalls = this.sessions.map(s => this.getToolCount(s));

    const providers = this.sessions.map(s => 
      Array.from(new Set(s.events?.filter(e => e.type === 'ai_request').map(e => (e as any).provider) || []))
    );

    const metrics: ComparisonMetrics = {
      totalCost: this.createComparisonValue(totalCosts),
      totalRequests: this.createComparisonValue(totalRequests),
      duration: this.createComparisonValue(durations),
      errorRate: this.createComparisonValue(errorRates),
      toolCalls: this.createComparisonValue(toolCalls),
      providers: {
        values: providers,
        min: providers[0] || [],
        max: providers[0] || [],
      }
    };

    // Calculate other comparison data
    const timeline = this.calculateTimelineComparison();
    const requests = this.calculateRequestComparison();
    const tools = this.calculateToolComparison();
    const costs = this.calculateCostComparison();
    const performance = this.calculatePerformanceComparison();

    this.comparison = {
      sessions: this.sessions,
      metrics,
      timeline,
      requests,
      tools,
      costs,
      performance
    };

    this.emitEvent('comparison-changed', { comparison: this.comparison });
  }

  private createComparisonValue<T extends number>(values: T[]): ComparisonValue<T> {
    const min = Math.min(...values) as T;
    const max = Math.max(...values) as T;
    const average = (values.reduce((sum, val) => sum + val, 0) / values.length) as T;
    const difference = (max - min) as T;
    const changePercent = min > 0 ? ((max - min) / min) * 100 : 0;

    return {
      values,
      min,
      max,
      average,
      difference,
      changePercent
    };
  }

  private calculateTimelineComparison(): ComparisonTimelineData {
    // Simplified timeline comparison - in a real implementation, this would be more sophisticated
    const allEventTypes = new Set<string>();
    const uniqueEvents: Record<string, string[]> = {};

    this.sessions.forEach(session => {
      uniqueEvents[session.id] = [];
      // Add event types analysis here
    });

    return {
      commonEvents: Array.from(allEventTypes),
      uniqueEvents,
      timeline: []
    };
  }

  private calculateRequestComparison(): ComparisonRequestData {
    const allProviders = new Set<string>();
    const providerBreakdown: Record<string, ComparisonValue<number>> = {};

    this.sessions.forEach(session => {
      const aiEvents = session.events?.filter(e => e.type === 'ai_request') || [];
      aiEvents.forEach(event => {
        const provider = (event as any).provider;
        if (provider) {
          allProviders.add(provider);
        }
      });
    });

    const responseTimes = this.sessions.map(session => {
      const aiEvents = session.events?.filter(e => e.type === 'ai_response') || [];
      const times = aiEvents.map(e => (e as any).response_time || 0).filter(t => t > 0);
      return times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
    });

    const costPerRequest = this.sessions.map(session => {
      const requests = this.getRequestCount(session);
      const cost = this.getSessionCost(session);
      return requests > 0 && cost ? cost / requests : 0;
    });

    return {
      commonProviders: Array.from(allProviders),
      providerBreakdown,
      responseTimeComparison: this.createComparisonValue(responseTimes),
      costPerRequest: this.createComparisonValue(costPerRequest)
    };
  }

  private calculateToolComparison(): ComparisonToolData {
    const toolSuccess = this.sessions.map(session => {
      // Calculate tool success rate
      return this.getToolCount(session);
    });

    return {
      commonTools: [],
      toolUsage: {},
      toolSuccess: this.createComparisonValue(toolSuccess)
    };
  }

  private calculateCostComparison(): ComparisonCostData {
    const costEfficiency = this.sessions.map(session => {
      const totalRequests = this.getRequestCount(session);
      const errors = this.getErrorCount(session);
      const successfulRequests = totalRequests - errors;
      const cost = this.getSessionCost(session);
      return successfulRequests > 0 && cost ? cost / successfulRequests : 0;
    });

    return {
      totalByProvider: {},
      costEfficiency: this.createComparisonValue(costEfficiency),
      trends: []
    };
  }

  private calculatePerformanceComparison(): ComparisonPerformanceData {
    const throughput = this.sessions.map(session => {
      const duration = session.duration || 0;
      const minutes = duration / (1000 * 60);
      const requests = this.getRequestCount(session);
      return minutes > 0 ? requests / minutes : 0;
    });

    const latency = this.sessions.map(session => {
      const aiEvents = session.events?.filter(e => e.type === 'ai_response') || [];
      const times = aiEvents.map(e => (e as any).response_time || 0).filter(t => t > 0);
      return times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
    });

    const errorRates = this.sessions.map(session => {
      const requests = this.getRequestCount(session);
      const errors = this.getErrorCount(session);
      return requests > 0 ? (errors / requests) * 100 : 0;
    });

    const reliability = this.sessions.map(session => {
      const requests = this.getRequestCount(session);
      const errors = this.getErrorCount(session);
      return requests > 0 ? ((requests - errors) / requests) * 100 : 0;
    });

    return {
      throughput: this.createComparisonValue(throughput),
      latency: this.createComparisonValue(latency),
      errorRate: this.createComparisonValue(errorRates),
      reliability: this.createComparisonValue(reliability)
    };
  }

  private handleViewModeChange(mode: ComparisonViewMode) {
    this.viewMode = mode;
    this.emitEvent('view-mode-changed', { mode });
  }

  private getBestSessionIndex(values: number[], lower: boolean = true): number {
    if (lower) {
      return values.indexOf(Math.min(...values));
    } else {
      return values.indexOf(Math.max(...values));
    }
  }

  private getWorstSessionIndex(values: number[], lower: boolean = true): number {
    if (lower) {
      return values.indexOf(Math.max(...values));
    } else {
      return values.indexOf(Math.min(...values));
    }
  }

  render() {
    if (this.sessions.length < 2) {
      return this.renderEmptyState();
    }

    if (!this.comparison) {
      return this.renderLoading();
    }

    return html`
      ${this.renderHeader()}
      ${this.renderSessionHeaders()}
      
      <div class="comparison-content">
        ${this.renderSummaryStats()}
        ${this.renderContent()}
      </div>
    `;
  }

  private renderHeader() {
    const viewModes: { key: ComparisonViewMode; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'detailed', label: 'Detailed' },
      { key: 'timeline', label: 'Timeline' },
      { key: 'metrics', label: 'Metrics' },
      { key: 'requests', label: 'Requests' },
      { key: 'costs', label: 'Costs' },
    ];

    return html`
      <div class="comparison-header">
        <h1 class="header-title">Session Comparison</h1>
        
        <div class="header-controls">
          <div class="view-selector">
            ${viewModes.map(mode => html`
              <button 
                class="view-button ${classMap({ active: this.viewMode === mode.key })}"
                @click=${() => this.handleViewModeChange(mode.key)}
              >
                ${mode.label}
              </button>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderSessionHeaders() {
    if (!this.comparison) return nothing;

    return html`
      <div class="session-headers">
        ${repeat(this.comparison.sessions, session => session.id, (session, index) => html`
          <div class="session-header">
            <h2 class="session-title">${session.summary || 'Untitled Session'}</h2>
            <p class="session-subtitle">
              ${formatTimestamp(session.startTime, 'datetime')}
            </p>
            ${this.renderSessionBadge(session, index)}
          </div>
        `)}
      </div>
    `;
  }

  private renderSessionBadge(session: SessionData, index: number) {
    if (!this.comparison) return nothing;

    const totalCosts = this.comparison.metrics.totalCost.values;
    const bestIndex = this.getBestSessionIndex(totalCosts, true);
    
    if (index === bestIndex) {
      return html`<div class="session-badge winner">Most Cost Effective</div>`;
    }
    
    return html`<div class="session-badge neutral">Session ${index + 1}</div>`;
  }

  private renderSummaryStats() {
    if (!this.comparison) return nothing;

    const metrics = this.comparison.metrics;
    
    return html`
      <div class="summary-stats">
        <div class="summary-stat">
          <div class="summary-label">Total Sessions</div>
          <div class="summary-value">${this.comparison.sessions.length}</div>
        </div>
        <div class="summary-stat">
          <div class="summary-label">Cost Range</div>
          <div class="summary-value">
            $${metrics.totalCost.min.toFixed(4)} - $${metrics.totalCost.max.toFixed(4)}
          </div>
        </div>
        <div class="summary-stat">
          <div class="summary-label">Request Range</div>
          <div class="summary-value">
            ${metrics.totalRequests.min} - ${metrics.totalRequests.max}
          </div>
        </div>
        <div class="summary-stat">
          <div class="summary-label">Duration Range</div>
          <div class="summary-value">
            ${formatDuration(metrics.duration.min)} - ${formatDuration(metrics.duration.max)}
          </div>
        </div>
      </div>
    `;
  }

  private renderContent() {
    switch (this.viewMode) {
      case 'overview':
        return this.renderOverview();
      case 'detailed':
        return this.renderDetailed();
      case 'timeline':
        return this.renderTimeline();
      case 'metrics':
        return this.renderMetrics();
      case 'requests':
        return this.renderRequests();
      case 'costs':
        return this.renderCosts();
      default:
        return this.renderOverview();
    }
  }

  private renderOverview() {
    if (!this.comparison) return nothing;

    return html`
      <div class="overview-grid">
        ${repeat(this.comparison.sessions, session => session.id, (session, index) => html`
          <div class="session-column">
            ${this.renderMetricCard('Total Cost', `$${this.getSessionCost(session).toFixed(4)}`, index, this.comparison!.metrics.totalCost.values)}
            ${this.renderMetricCard('Requests', this.getRequestCount(session).toString(), index, this.comparison!.metrics.totalRequests.values)}
            ${this.renderMetricCard('Duration', formatDuration(session.duration || 0), index, this.comparison!.metrics.duration.values)}
            ${this.renderMetricCard('Errors', this.getErrorCount(session).toString(), index, this.comparison!.metrics.errorRate.values, true)}
            ${this.renderMetricCard('Tools', this.getToolCount(session).toString(), index, this.comparison!.metrics.toolCalls.values)}
          </div>
        `)}
      </div>
    `;
  }

  private renderMetricCard(label: string, value: string, sessionIndex: number, allValues: number[], lowerIsBetter = false) {
    const bestIndex = this.getBestSessionIndex(allValues, lowerIsBetter);
    const worstIndex = this.getWorstSessionIndex(allValues, lowerIsBetter);
    
    let trendClass = 'neutral';
    if (sessionIndex === bestIndex) trendClass = 'positive';
    if (sessionIndex === worstIndex) trendClass = 'negative';

    return html`
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-label">${label}</span>
          <span class="metric-trend ${trendClass}">
            ${sessionIndex === bestIndex ? '🏆' : sessionIndex === worstIndex ? '⚠️' : '•'}
          </span>
        </div>
        <div class="metric-value">${value}</div>
      </div>
    `;
  }

  private renderDetailed() {
    if (!this.comparison) return nothing;

    const metrics = [
      { label: 'Total Cost', values: this.comparison.metrics.totalCost.values, format: (v: number) => `$${v.toFixed(4)}`, lowerIsBetter: true },
      { label: 'Total Requests', values: this.comparison.metrics.totalRequests.values, format: (v: number) => v.toString(), lowerIsBetter: false },
      { label: 'Duration', values: this.comparison.metrics.duration.values, format: (v: number) => formatDuration(v), lowerIsBetter: true },
      { label: 'Error Rate', values: this.comparison.metrics.errorRate.values, format: (v: number) => `${v.toFixed(1)}%`, lowerIsBetter: true },
      { label: 'Tool Calls', values: this.comparison.metrics.toolCalls.values, format: (v: number) => v.toString(), lowerIsBetter: false },
    ];

    return html`
      <div style="padding: var(--size-md);">
        <table class="comparison-table">
          <thead class="table-header">
            <tr>
              <th class="table-cell">Metric</th>
              ${repeat(this.comparison.sessions, session => session.id, (session, index) => html`
                <th class="table-cell">Session ${index + 1}</th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${repeat(metrics, metric => metric.label, metric => html`
              <tr class="table-row">
                <td class="table-cell">${metric.label}</td>
                ${repeat(metric.values, (value, index) => {
                  const bestIndex = this.getBestSessionIndex(metric.values, metric.lowerIsBetter);
                  const worstIndex = this.getWorstSessionIndex(metric.values, metric.lowerIsBetter);
                  
                  let cellClass = 'table-cell';
                  if (index === bestIndex) cellClass += ' cell-best';
                  if (index === worstIndex) cellClass += ' cell-worst';

                  return html`
                    <td class="${cellClass}">
                      ${metric.format(value)}
                    </td>
                  `;
                })}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderTimeline() {
    return html`
      <div class="timeline-comparison">
        <h3>Timeline Comparison</h3>
        <p>Timeline visualization would be implemented here with event synchronization across sessions.</p>
      </div>
    `;
  }

  private renderMetrics() {
    if (!this.comparison) return nothing;

    const chartData = [
      { label: 'Cost', values: this.comparison.metrics.totalCost.values },
      { label: 'Requests', values: this.comparison.metrics.totalRequests.values },
      { label: 'Duration', values: this.comparison.metrics.duration.values.map(d => d / 1000) }, // Convert to seconds
      { label: 'Errors', values: this.comparison.metrics.errorRate.values },
    ];

    return html`
      <div style="padding: var(--size-md);">
        ${repeat(chartData, chart => chart.label, chart => this.renderChart(chart.label, chart.values))}
      </div>
    `;
  }

  private renderChart(title: string, values: number[]) {
    const maxValue = Math.max(...values);
    
    return html`
      <div class="chart-container">
        <h3 class="chart-title">${title} Comparison</h3>
        <div class="chart-content">
          ${repeat(values, (value, index) => {
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return html`
              <div class="chart-bar-group">
                <div class="chart-bars">
                  <div 
                    class="chart-bar session-${index}" 
                    style="height: ${height}%"
                    title="Session ${index + 1}: ${value}"
                  ></div>
                </div>
                <div class="chart-label">Session ${index + 1}</div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderRequests() {
    return html`
      <div style="padding: var(--size-md);">
        <h3>Request Comparison</h3>
        <p>Request-by-request comparison would be implemented here.</p>
      </div>
    `;
  }

  private renderCosts() {
    return html`
      <div style="padding: var(--size-md);">
        <h3>Cost Analysis</h3>
        <p>Detailed cost breakdown and analysis would be implemented here.</p>
      </div>
    `;
  }

  private renderLoading() {
    return html`
      <div class="loading-comparison">
        <div class="loading-spinner"></div>
        <span>Calculating comparison...</span>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-comparison">
        <div class="empty-icon">⚖️</div>
        <h3>No Sessions to Compare</h3>
        <p>Select at least 2 sessions to see a detailed comparison.</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-comparison': SessionComparison;
  }
}