import type { 
  TraceEvent, 
  SessionData, 
  MetricsReport,
  PerformanceMetrics,
  CostAnalysis,
  UsageStats,
  MetricsTrend,
  BenchmarkData,
  AIRequestEvent,
  AIResponseEvent,
  ToolExecutionEvent
} from '../types/trace.js';

/**
 * Metrics calculator for performance and cost analysis
 * Processes trace events to generate insights and analytics
 */
export class MetricsCalculator {
  private events: TraceEvent[] = [];
  private sessions: SessionData[] = [];

  /**
   * Calculate comprehensive metrics from events and sessions
   */
  calculateMetrics(events: TraceEvent[], sessions: SessionData[]): MetricsReport {
    this.events = events;
    this.sessions = sessions;

    return {
      performance: this.calculatePerformanceMetrics(),
      cost: this.calculateCostAnalysis(),
      usage: this.calculateUsageStats(),
      trends: this.calculateTrends(),
      benchmarks: this.calculateBenchmarks(),
      summary: this.generateSummary(),
      timestamp: Date.now()
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(): PerformanceMetrics {
    const aiRequests = this.events.filter(e => e.type === 'ai_request');
    const aiResponses = this.events.filter(e => e.type === 'ai_response');
    const toolExecutions = this.events.filter(e => e.type === 'tool_execution');

    // Response times
    const responseTimes = aiResponses
      .map(response => {
        const request = this.findRequestForResponse(response);
        return request ? response.timestamp - request.timestamp : null;
      })
      .filter(Boolean) as number[];

    // Tool execution times
    const toolDurations = toolExecutions
      .map(tool => tool.duration)
      .filter(Boolean) as number[];

    // Session durations
    const sessionDurations = this.sessions.map(s => s.duration);

    // Calculate percentiles
    const responseTimePercentiles = this.calculatePercentiles(responseTimes);
    const toolDurationPercentiles = this.calculatePercentiles(toolDurations);
    const sessionDurationPercentiles = this.calculatePercentiles(sessionDurations);

    // Error rates
    const totalRequests = aiRequests.length;
    const errorEvents = this.events.filter(e => e.type === 'error');
    const errorRate = totalRequests > 0 ? errorEvents.length / totalRequests : 0;

    // Tool success rates
    const successfulTools = toolExecutions.filter(t => t.status === 'success').length;
    const toolSuccessRate = toolExecutions.length > 0 ? successfulTools / toolExecutions.length : 0;

    // Throughput (requests per minute)
    const timeSpan = this.getTimeSpan();
    const throughput = timeSpan > 0 ? (totalRequests * 60000) / timeSpan : 0;

    return {
      responseTime: {
        mean: this.calculateMean(responseTimes),
        median: responseTimePercentiles.p50,
        p95: responseTimePercentiles.p95,
        p99: responseTimePercentiles.p99,
        min: Math.min(...responseTimes) || 0,
        max: Math.max(...responseTimes) || 0,
        stdDev: this.calculateStandardDeviation(responseTimes)
      },
      toolExecution: {
        mean: this.calculateMean(toolDurations),
        median: toolDurationPercentiles.p50,
        p95: toolDurationPercentiles.p95,
        p99: toolDurationPercentiles.p99,
        min: Math.min(...toolDurations) || 0,
        max: Math.max(...toolDurations) || 0,
        stdDev: this.calculateStandardDeviation(toolDurations)
      },
      sessionDuration: {
        mean: this.calculateMean(sessionDurations),
        median: sessionDurationPercentiles.p50,
        p95: sessionDurationPercentiles.p95,
        p99: sessionDurationPercentiles.p99,
        min: Math.min(...sessionDurations) || 0,
        max: Math.max(...sessionDurations) || 0,
        stdDev: this.calculateStandardDeviation(sessionDurations)
      },
      errorRate,
      toolSuccessRate,
      throughput,
      totalRequests,
      totalSessions: this.sessions.length
    };
  }

  /**
   * Calculate cost analysis
   */
  private calculateCostAnalysis(): CostAnalysis {
    const aiResponses = this.events.filter(e => e.type === 'ai_response');
    const costsWithProvider = aiResponses
      .filter(r => r.cost !== undefined)
      .map(r => {
        const request = this.findRequestForResponse(r);
        return {
          cost: r.cost!,
          provider: (request as AIRequestEvent)?.provider || 'unknown',
          model: (request as AIRequestEvent)?.model || 'unknown',
          timestamp: r.timestamp
        };
      });

    const totalCost = costsWithProvider.reduce((sum, item) => sum + item.cost, 0);
    const costs = costsWithProvider.map(item => item.cost);

    // Cost by provider
    const costByProvider = this.groupBy(costsWithProvider, 'provider');
    const providerCosts = Object.entries(costByProvider).map(([provider, items]) => ({
      provider,
      totalCost: items.reduce((sum, item) => sum + item.cost, 0),
      requestCount: items.length,
      averageCost: items.reduce((sum, item) => sum + item.cost, 0) / items.length
    }));

    // Cost by model
    const costByModel = this.groupBy(costsWithProvider, 'model');
    const modelCosts = Object.entries(costByModel).map(([model, items]) => ({
      model,
      totalCost: items.reduce((sum, item) => sum + item.cost, 0),
      requestCount: items.length,
      averageCost: items.reduce((sum, item) => sum + item.cost, 0) / items.length
    }));

    // Cost trends (daily)
    const costTrends = this.calculateCostTrends(costsWithProvider);

    // Cost efficiency (cost per session)
    const costPerSession = this.sessions.length > 0 ? totalCost / this.sessions.length : 0;

    return {
      totalCost,
      averageCost: costs.length > 0 ? totalCost / costs.length : 0,
      costRange: {
        min: Math.min(...costs) || 0,
        max: Math.max(...costs) || 0
      },
      costByProvider: providerCosts.sort((a, b) => b.totalCost - a.totalCost),
      costByModel: modelCosts.sort((a, b) => b.totalCost - a.totalCost),
      costTrends,
      costPerSession,
      projectedMonthlyCost: this.projectMonthlyCost(costsWithProvider)
    };
  }

  /**
   * Calculate usage statistics
   */
  private calculateUsageStats(): UsageStats {
    const aiRequests = this.events.filter(e => e.type === 'ai_request');
    const aiResponses = this.events.filter(e => e.type === 'ai_response');
    const toolExecutions = this.events.filter(e => e.type === 'tool_execution');

    // Token usage
    const tokenUsage = aiResponses
      .filter(r => r.usage)
      .map(r => r.usage!);

    const totalInputTokens = tokenUsage.reduce((sum, u) => sum + (u.prompt_tokens || 0), 0);
    const totalOutputTokens = tokenUsage.reduce((sum, u) => sum + (u.completion_tokens || 0), 0);
    const totalTokens = tokenUsage.reduce((sum, u) => sum + (u.total_tokens || 0), 0);

    // Provider usage
    const providerUsage = this.groupBy(aiRequests.map(r => ({ provider: (r as AIRequestEvent).provider })), 'provider');
    const providerStats = Object.entries(providerUsage).map(([provider, requests]) => ({
      provider,
      requestCount: requests.length,
      percentage: (requests.length / aiRequests.length) * 100
    }));

    // Model usage
    const requestsWithModel = aiRequests.filter(r => (r as AIRequestEvent).model);
    const modelUsage = this.groupBy(requestsWithModel.map(r => ({ model: (r as AIRequestEvent).model! })), 'model');
    const modelStats = Object.entries(modelUsage).map(([model, requests]) => ({
      model,
      requestCount: requests.length,
      percentage: (requests.length / aiRequests.length) * 100
    }));

    // Tool usage
    const toolUsage = this.groupBy(toolExecutions.map(e => ({ toolName: (e as ToolExecutionEvent).toolName, status: (e as ToolExecutionEvent).status })), 'toolName');
    const toolStats = Object.entries(toolUsage).map(([toolName, executions]) => ({
      toolName,
      executionCount: executions.length,
      successCount: executions.filter(e => e.status === 'success').length,
      successRate: executions.filter(e => e.status === 'success').length / executions.length
    }));

    // Peak usage times
    const hourlyUsage = this.calculateHourlyUsage(aiRequests);
    const peakHour = hourlyUsage.reduce((max, current) => 
      current.requestCount > max.requestCount ? current : max
    );

    return {
      tokenUsage: {
        total: totalTokens,
        input: totalInputTokens,
        output: totalOutputTokens,
        averagePerRequest: aiResponses.length > 0 ? totalTokens / aiResponses.length : 0
      },
      providerUsage: providerStats.sort((a, b) => b.requestCount - a.requestCount),
      modelUsage: modelStats.sort((a, b) => b.requestCount - a.requestCount),
      toolUsage: toolStats.sort((a, b) => b.executionCount - a.executionCount),
      peakUsage: {
        hour: peakHour.hour,
        requestCount: peakHour.requestCount,
        timeframe: 'hourly'
      },
      sessionPatterns: this.analyzeSessionPatterns()
    };
  }

  /**
   * Calculate trends over time
   */
  private calculateTrends(): MetricsTrend[] {
    const timeWindow = 3600000; // 1 hour windows
    const timeSpan = this.getTimeSpan();
    const windowCount = Math.ceil(timeSpan / timeWindow);

    const trends: MetricsTrend[] = [];
    const startTime = Math.min(...this.events.map(e => e.timestamp));

    for (let i = 0; i < windowCount; i++) {
      const windowStart = startTime + (i * timeWindow);
      const windowEnd = windowStart + timeWindow;
      
      const windowEvents = this.events.filter(e => 
        e.timestamp >= windowStart && e.timestamp < windowEnd
      );

      const requests = windowEvents.filter(e => e.type === 'ai_request');
      const responses = windowEvents.filter(e => e.type === 'ai_response');
      const errors = windowEvents.filter(e => e.type === 'error');

      const responseTimes = responses
        .map(r => {
          const req = this.findRequestForResponse(r);
          return req ? r.timestamp - req.timestamp : null;
        })
        .filter(Boolean) as number[];

      const costs = responses
        .map(r => r.cost)
        .filter(Boolean) as number[];

      trends.push({
        timestamp: windowStart,
        timeWindow,
        metrics: {
          requestCount: requests.length,
          errorCount: errors.length,
          averageResponseTime: this.calculateMean(responseTimes),
          totalCost: costs.reduce((sum, c) => sum + c, 0),
          errorRate: requests.length > 0 ? errors.length / requests.length : 0
        }
      });
    }

    return trends;
  }

  /**
   * Calculate benchmark data
   */
  private calculateBenchmarks(): BenchmarkData {
    const performance = this.calculatePerformanceMetrics();
    const cost = this.calculateCostAnalysis();

    // Industry benchmarks (example values - these would come from external data)
    const industryBenchmarks = {
      averageResponseTime: 2000, // 2 seconds
      errorRate: 0.02, // 2%
      costPerThousandTokens: 0.002,
      throughput: 10 // requests per minute
    };

    return {
      responseTime: {
        current: performance.responseTime.mean,
        benchmark: industryBenchmarks.averageResponseTime,
        percentile: this.calculatePercentileRank(
          performance.responseTime.mean,
          [industryBenchmarks.averageResponseTime]
        )
      },
      errorRate: {
        current: performance.errorRate,
        benchmark: industryBenchmarks.errorRate,
        percentile: this.calculatePercentileRank(
          performance.errorRate,
          [industryBenchmarks.errorRate]
        )
      },
      costEfficiency: {
        current: cost.averageCost,
        benchmark: industryBenchmarks.costPerThousandTokens,
        percentile: this.calculatePercentileRank(
          cost.averageCost,
          [industryBenchmarks.costPerThousandTokens]
        )
      },
      throughput: {
        current: performance.throughput,
        benchmark: industryBenchmarks.throughput,
        percentile: this.calculatePercentileRank(
          performance.throughput,
          [industryBenchmarks.throughput]
        )
      }
    };
  }

  /**
   * Generate summary insights
   */
  private generateSummary(): string[] {
    const performance = this.calculatePerformanceMetrics();
    const cost = this.calculateCostAnalysis();
    const usage = this.calculateUsageStats();
    
    const insights: string[] = [];

    // Performance insights
    if (performance.errorRate > 0.05) {
      insights.push(`High error rate detected: ${(performance.errorRate * 100).toFixed(1)}%`);
    }

    if (performance.responseTime.p95 > 5000) {
      insights.push(`Slow response times: 95th percentile is ${(performance.responseTime.p95 / 1000).toFixed(1)}s`);
    }

    // Cost insights
    if (cost.totalCost > 100) {
      insights.push(`High cost usage: $${cost.totalCost.toFixed(2)} total`);
    }

    const topProvider = cost.costByProvider[0];
    if (topProvider && topProvider.totalCost > cost.totalCost * 0.8) {
      insights.push(`${topProvider.provider} accounts for ${((topProvider.totalCost / cost.totalCost) * 100).toFixed(1)}% of costs`);
    }

    // Usage insights
    const topTool = usage.toolUsage[0];
    if (topTool && topTool.successRate < 0.9) {
      insights.push(`${topTool.toolName} has low success rate: ${(topTool.successRate * 100).toFixed(1)}%`);
    }

    if (insights.length === 0) {
      insights.push('System performance is within normal parameters');
    }

    return insights;
  }

  // Helper methods
  private findRequestForResponse(response: TraceEvent): TraceEvent | null {
    if (response.parentId) {
      return this.events.find(e => e.id === response.parentId && e.type === 'ai_request') || null;
    }

    // Fallback: find most recent request in same session
    const sessionEvents = this.events
      .filter(e => e.sessionId === response.sessionId && e.type === 'ai_request')
      .filter(e => e.timestamp < response.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp);

    return sessionEvents[0] || null;
  }

  private calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
    if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };
    
    const sorted = [...values].sort((a, b) => a - b);
    return {
      p50: this.getPercentile(sorted, 50),
      p95: this.getPercentile(sorted, 95),
      p99: this.getPercentile(sorted, 99)
    };
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) return sortedValues[lower];
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const value = String(item[key]);
      (groups[value] = groups[value] || []).push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private getTimeSpan(): number {
    if (this.events.length === 0) return 0;
    const timestamps = this.events.map(e => e.timestamp);
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  private calculateCostTrends(costsWithProvider: Array<{ cost: number; timestamp: number }>): Array<{ date: string; cost: number }> {
    const dailyCosts = this.groupBy(
      costsWithProvider.map(item => ({
        ...item,
        date: new Date(item.timestamp).toISOString().split('T')[0]
      })),
      'date'
    );

    return Object.entries(dailyCosts).map(([date, items]) => ({
      date,
      cost: items.reduce((sum, item) => sum + item.cost, 0)
    }));
  }

  private projectMonthlyCost(costsWithProvider: Array<{ cost: number; timestamp: number }>): number {
    if (costsWithProvider.length === 0) return 0;
    
    const timeSpan = this.getTimeSpan();
    const totalCost = costsWithProvider.reduce((sum, item) => sum + item.cost, 0);
    
    if (timeSpan === 0) return 0;
    
    const monthlyMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    return (totalCost / timeSpan) * monthlyMs;
  }

  private calculateHourlyUsage(requests: TraceEvent[]): Array<{ hour: number; requestCount: number }> {
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({ hour, requestCount: 0 }));
    
    requests.forEach(request => {
      const hour = new Date(request.timestamp).getHours();
      hourlyData[hour].requestCount++;
    });
    
    return hourlyData;
  }

  private analyzeSessionPatterns(): any {
    // Analyze common session patterns
    const sessionLengths = this.sessions.map(s => s.eventCount);
    const avgSessionLength = this.calculateMean(sessionLengths);
    
    return {
      averageEventsPerSession: avgSessionLength,
      shortSessions: this.sessions.filter(s => s.eventCount < 5).length,
      longSessions: this.sessions.filter(s => s.eventCount > 20).length
    };
  }

  private calculatePercentileRank(value: number, dataset: number[]): number {
    const sorted = [...dataset].sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  }
}

/**
 * Utility functions for metrics calculation
 */
export const MetricsUtils = {
  /**
   * Format duration for display
   */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  },

  /**
   * Format cost for display
   */
  formatCost(cost: number): string {
    if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}‰`; // per mille
    if (cost < 1) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  },

  /**
   * Format percentage for display
   */
  formatPercentage(ratio: number): string {
    return `${(ratio * 100).toFixed(1)}%`;
  },

  /**
   * Calculate rate of change between two values
   */
  calculateChangeRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 1 : 0;
    return (current - previous) / previous;
  },

  /**
   * Generate color based on performance threshold
   */
  getPerformanceColor(value: number, thresholds: { good: number; warning: number }): string {
    if (value <= thresholds.good) return 'green';
    if (value <= thresholds.warning) return 'yellow';
    return 'red';
  }
};