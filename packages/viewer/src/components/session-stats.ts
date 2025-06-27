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
 * Analytics data interfaces
 */
export interface SessionAnalytics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  errorSessions: number;
  totalCost: number;
  totalRequests: number;
  totalDuration: number;
  averageDuration: number;
  totalErrors: number;
  totalTools: number;
  providerBreakdown: ProviderStats[];
  costTrend: CostTrendData[];
  requestsOverTime: RequestTimeData[];
  errorRate: number;
  topQueries: QueryStats[];
  performanceMetrics: PerformanceStats;
}

export interface ProviderStats {
  provider: string;
  count: number;
  cost: number;
  percentage: number;
  averageLatency: number;
}

export interface CostTrendData {
  date: string;
  cost: number;
  requests: number;
}

export interface RequestTimeData {
  hour: string;
  requests: number;
  cost: number;
}

export interface QueryStats {
  query: string;
  count: number;
  averageCost: number;
  averageDuration: number;
}

export interface PerformanceStats {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
}

/**
 * Chart data interfaces
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: any;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area';
  title: string;
  xAxis?: string;
  yAxis?: string;
  showLegend?: boolean;
  responsive?: boolean;
}

/**
 * Advanced session analytics component with charts and detailed metrics
 * Provides comprehensive insights into session data and performance
 */
@customElement('session-stats')
export class SessionStats extends BaseComponent {
  static styles = [
    BaseComponent.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--vs-bg);
        overflow-y: auto;
      }

      /* Stats Container */
      .stats-container {
        padding: var(--size-md);
        display: flex;
        flex-direction: column;
        gap: var(--size-lg);
      }

      /* Overview Cards */
      .overview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--size-md);
        margin-bottom: var(--size-lg);
      }

      .stat-card {
        background-color: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        padding: var(--size-md);
        transition: var(--transition-fast);
      }

      .stat-card:hover {
        border-color: var(--vs-border-light);
        box-shadow: 0 2px 8px var(--vs-shadow);
      }

      .stat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--size-sm);
      }

      .stat-title {
        font-size: var(--text-sm);
        color: var(--vs-text-muted);
        font-weight: var(--font-medium);
        margin: 0;
      }

      .stat-icon {
        font-size: var(--text-lg);
        opacity: 0.8;
      }

      .stat-value {
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--vs-text);
        margin: 0;
        line-height: 1.2;
      }

      .stat-change {
        font-size: var(--text-xs);
        color: var(--vs-text-muted);
        margin-top: var(--size-xs);
      }

      .stat-change.positive {
        color: var(--vs-success);
      }

      .stat-change.negative {
        color: var(--vs-error);
      }

      /* Charts Section */
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: var(--size-md);
        margin-bottom: var(--size-lg);
      }

      .chart-container {
        background-color: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        padding: var(--size-md);
        min-height: 300px;
      }

      .chart-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--size-md);
        padding-bottom: var(--size-sm);
        border-bottom: 1px solid var(--vs-border);
      }

      .chart-title {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--vs-text);
        margin: 0;
      }

      .chart-controls {
        display: flex;
        gap: var(--size-xs);
      }

      .chart-control {
        padding: var(--size-xs) var(--size-sm);
        background: none;
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-sm);
        color: var(--vs-text-muted);
        font-size: var(--text-xs);
        cursor: pointer;
        transition: var(--transition-fast);
      }

      .chart-control:hover {
        color: var(--vs-text);
        border-color: var(--vs-border-light);
      }

      .chart-control.active {
        background-color: var(--vs-accent);
        border-color: var(--vs-accent);
        color: var(--vs-text-inverse);
      }

      /* Simple Chart Implementations */
      .chart-content {
        position: relative;
        height: 250px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bar-chart {
        display: flex;
        align-items: end;
        gap: var(--size-xs);
        height: 200px;
        padding: var(--size-sm) 0;
      }

      .bar-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        min-width: 40px;
      }

      .bar {
        width: 100%;
        background-color: var(--vs-accent);
        border-radius: var(--radius-sm) var(--radius-sm) 0 0;
        transition: var(--transition-fast);
        position: relative;
        min-height: 4px;
      }

      .bar:hover {
        background-color: var(--vs-accent-hover);
      }

      .bar-label {
        font-size: var(--text-xs);
        color: var(--vs-text-muted);
        margin-top: var(--size-xs);
        text-align: center;
      }

      .bar-value {
        font-size: var(--text-xs);
        color: var(--vs-text);
        font-weight: var(--font-medium);
        position: absolute;
        top: -20px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
      }

      .pie-chart {
        position: relative;
        width: 200px;
        height: 200px;
        margin: 0 auto;
      }

      .pie-slice {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
      }

      .line-chart {
        position: relative;
        height: 200px;
        overflow: hidden;
      }

      .line-path {
        stroke: var(--vs-accent);
        stroke-width: 2;
        fill: none;
        vector-effect: non-scaling-stroke;
      }

      .line-area {
        fill: var(--vs-accent);
        opacity: 0.1;
      }

      .line-point {
        fill: var(--vs-accent);
        stroke: var(--vs-bg);
        stroke-width: 2;
        r: 4;
      }

      .line-point:hover {
        r: 6;
        fill: var(--vs-accent-hover);
      }

      /* Data Tables */
      .data-table {
        background-color: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }

      .table-header {
        background-color: var(--vs-bg-tertiary);
        padding: var(--size-md);
        border-bottom: 1px solid var(--vs-border);
      }

      .table-title {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        color: var(--vs-text);
        margin: 0;
      }

      .table-content {
        max-height: 300px;
        overflow-y: auto;
      }

      .table-row {
        display: flex;
        align-items: center;
        padding: var(--size-sm) var(--size-md);
        border-bottom: 1px solid var(--vs-border);
        transition: var(--transition-fast);
      }

      .table-row:hover {
        background-color: var(--vs-hover);
      }

      .table-row:last-child {
        border-bottom: none;
      }

      .table-cell {
        flex: 1;
        color: var(--vs-text);
        font-size: var(--text-sm);
      }

      .table-cell.primary {
        font-weight: var(--font-medium);
      }

      .table-cell.secondary {
        color: var(--vs-text-muted);
        font-size: var(--text-xs);
      }

      .table-cell.number {
        text-align: right;
        font-family: var(--font-mono);
      }

      /* Provider Badges */
      .provider-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--size-xs);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
      }

      .provider-anthropic {
        background-color: rgba(255, 107, 53, 0.2);
        color: #ff6b35;
        border: 1px solid #ff6b35;
      }

      .provider-openai {
        background-color: rgba(65, 41, 145, 0.2);
        color: #412991;
        border: 1px solid #412991;
      }

      .provider-google {
        background-color: rgba(66, 133, 244, 0.2);
        color: #4285f4;
        border: 1px solid #4285f4;
      }

      .provider-unknown {
        background-color: var(--vs-bg-elevated);
        color: var(--vs-text-muted);
        border: 1px solid var(--vs-border);
      }

      /* Metrics Grid */
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--size-md);
      }

      .metric-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-sm);
        background-color: var(--vs-bg-tertiary);
        border-radius: var(--radius-sm);
      }

      .metric-label {
        font-size: var(--text-sm);
        color: var(--vs-text-muted);
      }

      .metric-value {
        font-weight: var(--font-medium);
        color: var(--vs-text);
        font-family: var(--font-mono);
      }

      /* Loading State */
      .loading-chart {
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

      /* Responsive Design */
      @media (max-width: 768px) {
        .overview-grid {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }

        .charts-grid {
          grid-template-columns: 1fr;
        }

        .chart-container {
          min-height: 250px;
        }

        .chart-content {
          height: 200px;
        }

        .bar-chart {
          height: 150px;
        }

        .metrics-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 480px) {
        .stats-container {
          padding: var(--size-sm);
        }

        .overview-grid {
          grid-template-columns: 1fr;
        }

        .stat-value {
          font-size: var(--text-xl);
        }

        .chart-header {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--size-sm);
        }
      }

      /* Empty State */
      .empty-analytics {
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
    `
  ];

  @property({ type: Array })
  sessions: SessionData[] = [];

  @property({ type: String })
  timeRange: '24h' | '7d' | '30d' | '90d' | 'all' = '7d';

  @property({ type: Boolean })
  showDetailedMetrics: boolean = true;

  @state()
  private analytics: SessionAnalytics | null = null;

  @state()
  private viewportSize: ViewportSize = 'desktop';

  @state()
  private selectedChart: string = 'cost';

  connectedCallback() {
    super.connectedCallback();
    this.updateViewportSize();
    window.addEventListener('resize', this.handleResize);
    this.calculateAnalytics();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('sessions') || changedProperties.has('timeRange')) {
      this.calculateAnalytics();
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

  private calculateAnalytics() {
    if (this.sessions.length === 0) {
      this.analytics = null;
      return;
    }

    const filteredSessions = this.filterSessionsByTimeRange(this.sessions);
    
    // Calculate basic metrics
    const totalSessions = filteredSessions.length;
    const activeSessions = filteredSessions.filter(s => s.status === 'active').length;
    const completedSessions = filteredSessions.filter(s => s.status === 'completed').length;
    const errorSessions = filteredSessions.filter(s => s.status === 'error').length;

    const totalCost = filteredSessions.reduce((sum, s) => sum + this.getSessionCost(s), 0);
    const totalRequests = filteredSessions.reduce((sum, s) => sum + this.getRequestCount(s), 0);
    const totalErrors = filteredSessions.reduce((sum, s) => sum + this.getErrorCount(s), 0);
    const totalTools = filteredSessions.reduce((sum, s) => sum + this.getToolCount(s), 0);

    // Calculate durations
    const durations = filteredSessions
      .filter(s => s.endTime)
      .map(s => s.duration);
    
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = durations.length > 0 ? totalDuration / durations.length : 0;

    // Provider breakdown
    const providerCounts: Record<string, { count: number; cost: number; latencies: number[] }> = {};
    filteredSessions.forEach(session => {
      const aiEvents = session.events?.filter(e => e.type === 'ai_request') || [];
      aiEvents.forEach(event => {
        const provider = (event as any).provider?.toLowerCase() || 'unknown';
        if (!providerCounts[provider]) {
          providerCounts[provider] = { count: 0, cost: 0, latencies: [] };
        }
        providerCounts[provider].count++;
        providerCounts[provider].cost += (event as any).cost || 0;
        if ((event as any).response_time) {
          providerCounts[provider].latencies.push((event as any).response_time);
        }
      });
    });

    const providerBreakdown: ProviderStats[] = Object.entries(providerCounts).map(([provider, data]) => ({
      provider,
      count: data.count,
      cost: data.cost,
      percentage: (data.count / totalRequests) * 100,
      averageLatency: data.latencies.length > 0 ? 
        data.latencies.reduce((sum, l) => sum + l, 0) / data.latencies.length : 0
    })).sort((a, b) => b.count - a.count);

    // Cost trend (last 7 days)
    const costTrend = this.calculateCostTrend(filteredSessions);

    // Requests over time (24 hours)
    const requestsOverTime = this.calculateRequestsOverTime(filteredSessions);

    // Error rate
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Top queries
    const queryStats: Record<string, { count: number; cost: number; durations: number[] }> = {};
    filteredSessions.forEach(session => {
      const query = session.summary || 'Untitled';
      if (!queryStats[query]) {
        queryStats[query] = { count: 0, cost: 0, durations: [] };
      }
      queryStats[query].count++;
      queryStats[query].cost += this.getSessionCost(session);
      if (session.endTime) {
        queryStats[query].durations.push(session.duration);
      }
    });

    const topQueries: QueryStats[] = Object.entries(queryStats)
      .map(([query, data]) => ({
        query,
        count: data.count,
        averageCost: data.cost / data.count,
        averageDuration: data.durations.length > 0 ? 
          data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Performance metrics
    const responseTimes = filteredSessions
      .flatMap(s => s.events?.filter(e => e.type === 'ai_response') || [])
      .map(event => (event as any).response_time || 0)
      .filter(t => t > 0)
      .sort((a, b) => a - b);

    const performanceMetrics: PerformanceStats = {
      averageResponseTime: responseTimes.length > 0 ? 
        responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0,
      p95ResponseTime: responseTimes.length > 0 ? 
        responseTimes[Math.floor(responseTimes.length * 0.95)] : 0,
      p99ResponseTime: responseTimes.length > 0 ? 
        responseTimes[Math.floor(responseTimes.length * 0.99)] : 0,
      errorRate,
      throughput: totalRequests / Math.max(1, durations.length)
    };

    this.analytics = {
      totalSessions,
      activeSessions,
      completedSessions,
      errorSessions,
      totalCost,
      totalRequests,
      totalDuration,
      averageDuration,
      totalErrors,
      totalTools,
      providerBreakdown,
      costTrend,
      requestsOverTime,
      errorRate,
      topQueries,
      performanceMetrics
    };
  }

  private filterSessionsByTimeRange(sessions: SessionData[]): SessionData[] {
    if (this.timeRange === 'all') return sessions;

    const now = new Date();
    const cutoff = new Date();

    switch (this.timeRange) {
      case '24h':
        cutoff.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoff.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoff.setDate(now.getDate() - 90);
        break;
    }

    return sessions.filter(session => new Date(session.startTime) >= cutoff);
  }

  private calculateCostTrend(sessions: SessionData[]): CostTrendData[] {
    const trends: Record<string, { cost: number; requests: number }> = {};
    
    sessions.forEach(session => {
      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!trends[date]) {
        trends[date] = { cost: 0, requests: 0 };
      }
      trends[date].cost += this.getSessionCost(session);
      trends[date].requests += this.getRequestCount(session);
    });

    return Object.entries(trends)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateRequestsOverTime(sessions: SessionData[]): RequestTimeData[] {
    const hourly: Record<string, { requests: number; cost: number }> = {};
    
    sessions.forEach(session => {
      const hour = new Date(session.startTime).getHours().toString().padStart(2, '0') + ':00';
      if (!hourly[hour]) {
        hourly[hour] = { requests: 0, cost: 0 };
      }
      hourly[hour].requests += this.getRequestCount(session);
      hourly[hour].cost += this.getSessionCost(session);
    });

    return Object.entries(hourly)
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }

  private handleTimeRangeChange(range: '24h' | '7d' | '30d' | '90d' | 'all') {
    this.timeRange = range;
  }

  render() {
    if (this.sessions.length === 0) {
      return this.renderEmptyState();
    }

    if (!this.analytics) {
      return this.renderLoading();
    }

    return html`
      <div class="stats-container">
        <!-- Overview Cards -->
        <div class="overview-grid">
          ${this.renderStatCard('Total Sessions', this.analytics.totalSessions.toString(), '📊')}
          ${this.renderStatCard('Total Cost', `$${this.analytics.totalCost.toFixed(4)}`, '💰')}
          ${this.renderStatCard('Total Requests', this.analytics.totalRequests.toString(), '🔄')}
          ${this.renderStatCard('Error Rate', `${this.analytics.errorRate.toFixed(1)}%`, '⚠️')}
          ${this.renderStatCard('Avg Duration', formatDuration(this.analytics.averageDuration), '⏱️')}
          ${this.renderStatCard('Tool Calls', this.analytics.totalTools.toString(), '🔧')}
        </div>

        <!-- Time Range Selector -->
        <div class="chart-controls">
          ${['24h', '7d', '30d', '90d', 'all'].map(range => html`
            <button 
              class="chart-control ${classMap({ active: this.timeRange === range })}"
              @click=${() => this.handleTimeRangeChange(range as any)}
            >
              ${range}
            </button>
          `)}
        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">
          ${this.renderCostTrendChart()}
          ${this.renderProviderBreakdownChart()}
          ${this.renderRequestsOverTimeChart()}
          ${this.renderPerformanceChart()}
        </div>

        <!-- Data Tables -->
        ${this.renderTopQueries()}
        ${when(this.showDetailedMetrics, () => this.renderDetailedMetrics())}
      </div>
    `;
  }

  private renderStatCard(title: string, value: string, icon: string) {
    return html`
      <div class="stat-card">
        <div class="stat-header">
          <h3 class="stat-title">${title}</h3>
          <span class="stat-icon">${icon}</span>
        </div>
        <p class="stat-value">${value}</p>
      </div>
    `;
  }

  private renderCostTrendChart() {
    if (!this.analytics) return nothing;

    const maxCost = Math.max(...this.analytics.costTrend.map(d => d.cost));
    
    return html`
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Cost Trend</h3>
        </div>
        <div class="chart-content">
          <div class="bar-chart">
            ${repeat(this.analytics.costTrend, data => data.date, data => {
              const height = maxCost > 0 ? (data.cost / maxCost) * 100 : 0;
              return html`
                <div class="bar-item">
                  <div class="bar" style="height: ${height}%">
                    <div class="bar-value">$${data.cost.toFixed(3)}</div>
                  </div>
                  <div class="bar-label">${data.date.slice(-5)}</div>
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }

  private renderProviderBreakdownChart() {
    if (!this.analytics) return nothing;

    return html`
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Provider Breakdown</h3>
        </div>
        <div class="chart-content">
          <div class="table-content">
            ${repeat(this.analytics.providerBreakdown, provider => provider.provider, provider => html`
              <div class="table-row">
                <div class="table-cell">
                  <div class="provider-badge provider-${provider.provider}">
                    ${provider.provider}
                  </div>
                </div>
                <div class="table-cell number">${provider.count}</div>
                <div class="table-cell number">$${provider.cost.toFixed(4)}</div>
                <div class="table-cell number">${provider.percentage.toFixed(1)}%</div>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderRequestsOverTimeChart() {
    if (!this.analytics) return nothing;

    const maxRequests = Math.max(...this.analytics.requestsOverTime.map(d => d.requests));
    
    return html`
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Requests by Hour</h3>
        </div>
        <div class="chart-content">
          <div class="bar-chart">
            ${repeat(this.analytics.requestsOverTime, data => data.hour, data => {
              const height = maxRequests > 0 ? (data.requests / maxRequests) * 100 : 0;
              return html`
                <div class="bar-item">
                  <div class="bar" style="height: ${height}%">
                    <div class="bar-value">${data.requests}</div>
                  </div>
                  <div class="bar-label">${data.hour}</div>
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }

  private renderPerformanceChart() {
    if (!this.analytics) return nothing;

    const metrics = [
      { label: 'Avg Response', value: this.analytics.performanceMetrics.averageResponseTime },
      { label: 'P95 Response', value: this.analytics.performanceMetrics.p95ResponseTime },
      { label: 'P99 Response', value: this.analytics.performanceMetrics.p99ResponseTime },
    ];

    const maxValue = Math.max(...metrics.map(m => m.value));

    return html`
      <div class="chart-container">
        <div class="chart-header">
          <h3 class="chart-title">Response Times (ms)</h3>
        </div>
        <div class="chart-content">
          <div class="bar-chart">
            ${repeat(metrics, metric => metric.label, metric => {
              const height = maxValue > 0 ? (metric.value / maxValue) * 100 : 0;
              return html`
                <div class="bar-item">
                  <div class="bar" style="height: ${height}%">
                    <div class="bar-value">${metric.value.toFixed(0)}</div>
                  </div>
                  <div class="bar-label">${metric.label}</div>
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }

  private renderTopQueries() {
    if (!this.analytics) return nothing;

    return html`
      <div class="data-table">
        <div class="table-header">
          <h3 class="table-title">Top Queries</h3>
        </div>
        <div class="table-content">
          ${repeat(this.analytics.topQueries, query => query.query, query => html`
            <div class="table-row">
              <div class="table-cell primary">${query.query}</div>
              <div class="table-cell number">${query.count}</div>
              <div class="table-cell number">$${query.averageCost.toFixed(4)}</div>
              <div class="table-cell number">${formatDuration(query.averageDuration)}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderDetailedMetrics() {
    if (!this.analytics) return nothing;

    const metrics = [
      { label: 'Average Response Time', value: `${this.analytics.performanceMetrics.averageResponseTime.toFixed(0)}ms` },
      { label: 'P95 Response Time', value: `${this.analytics.performanceMetrics.p95ResponseTime.toFixed(0)}ms` },
      { label: 'P99 Response Time', value: `${this.analytics.performanceMetrics.p99ResponseTime.toFixed(0)}ms` },
      { label: 'Throughput', value: `${this.analytics.performanceMetrics.throughput.toFixed(2)} req/session` },
      { label: 'Error Rate', value: `${this.analytics.performanceMetrics.errorRate.toFixed(2)}%` },
      { label: 'Total Duration', value: formatDuration(this.analytics.totalDuration) },
    ];

    return html`
      <div class="data-table">
        <div class="table-header">
          <h3 class="table-title">Performance Metrics</h3>
        </div>
        <div class="metrics-grid">
          ${repeat(metrics, metric => metric.label, metric => html`
            <div class="metric-item">
              <span class="metric-label">${metric.label}</span>
              <span class="metric-value">${metric.value}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderLoading() {
    return html`
      <div class="loading-chart">
        <div class="loading-spinner"></div>
        <span>Calculating analytics...</span>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-analytics">
        <div class="empty-icon">📈</div>
        <h3>No Analytics Available</h3>
        <p>Load some sessions to see detailed analytics and insights.</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-stats': SessionStats;
  }
}