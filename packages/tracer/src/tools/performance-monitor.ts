import type { ToolExecutionMetrics } from '../types.js';

export interface PerformanceMetrics {
  // Timing metrics
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  totalExecutionTime: number;
  
  // Throughput metrics
  operationsPerSecond: number;
  bytesProcessedPerSecond: number;
  
  // Resource usage
  memoryUsageMB: number;
  peakMemoryUsageMB: number;
  cpuUsagePercent: number;
  
  // Error metrics
  errorRate: number;
  timeoutRate: number;
  
  // Tool-specific metrics
  fileOperationsPerSecond: number;
  bashCommandsPerSecond: number;
  sanitizationOverheadMs: number;
  
  // System impact
  systemImpactPercent: number;
  baselinePerformance?: number;
  degradationPercent: number;
}

export interface PerformanceSample {
  timestamp: number;
  operationType: 'file_operation' | 'bash_command' | 'tool_execution' | 'sanitization';
  executionTime: number;
  memoryUsage: number;
  success: boolean;
  dataSize: number;
}

export interface PerformanceThresholds {
  maxExecutionTimeMs: number;
  maxMemoryUsageMB: number;
  maxSystemImpactPercent: number;
  maxErrorRate: number;
  minOperationsPerSecond: number;
}

export class PerformanceMonitor {
  private samples: PerformanceSample[] = [];
  private startTime: number;
  private baselineMetrics?: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private sampleWindowSize: number;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(
    thresholds: Partial<PerformanceThresholds> = {},
    sampleWindowSize: number = 1000,
    enableAutoMonitoring: boolean = true
  ) {
    this.startTime = Date.now();
    this.sampleWindowSize = sampleWindowSize;
    this.thresholds = {
      maxExecutionTimeMs: 5000, // 5 seconds
      maxMemoryUsageMB: 100,
      maxSystemImpactPercent: 5,
      maxErrorRate: 0.05, // 5%
      minOperationsPerSecond: 1,
      ...thresholds
    };

    if (enableAutoMonitoring) {
      this.startMonitoring();
    }
  }

  public recordSample(sample: PerformanceSample): void {
    this.samples.push(sample);
    
    // Keep only recent samples within the window
    if (this.samples.length > this.sampleWindowSize) {
      this.samples = this.samples.slice(-this.sampleWindowSize);
    }
  }

  public recordOperation(
    operationType: PerformanceSample['operationType'],
    executionTime: number,
    success: boolean,
    dataSize: number = 0
  ): void {
    const sample: PerformanceSample = {
      timestamp: Date.now(),
      operationType,
      executionTime,
      memoryUsage: this.getCurrentMemoryUsage(),
      success,
      dataSize
    };

    this.recordSample(sample);
  }

  public measureAsync<T>(
    operationType: PerformanceSample['operationType'],
    operation: () => Promise<T>,
    dataSize: number = 0
  ): Promise<{ result: T; metrics: { executionTime: number; success: boolean } }> {
    const startTime = Date.now();
    
    return operation()
      .then((result) => {
        const executionTime = Date.now() - startTime;
        this.recordOperation(operationType, executionTime, true, dataSize);
        return { result, metrics: { executionTime, success: true } };
      })
      .catch((error) => {
        const executionTime = Date.now() - startTime;
        this.recordOperation(operationType, executionTime, false, dataSize);
        throw error;
      });
  }

  public measureSync<T>(
    operationType: PerformanceSample['operationType'],
    operation: () => T,
    dataSize: number = 0
  ): { result: T; metrics: { executionTime: number; success: boolean } } {
    const startTime = Date.now();
    
    try {
      const result = operation();
      const executionTime = Date.now() - startTime;
      this.recordOperation(operationType, executionTime, true, dataSize);
      return { result, metrics: { executionTime, success: true } };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordOperation(operationType, executionTime, false, dataSize);
      throw error;
    }
  }

  public getCurrentMetrics(): PerformanceMetrics {
    if (this.samples.length === 0) {
      return this.createEmptyMetrics();
    }

    // Phase 1: Calculate base metrics without circular dependencies
    const baseMetrics = this.calculateBaseMetrics();
    
    // Phase 2: Calculate derived metrics using base metrics
    const systemImpactPercent = this.calculateSystemImpact(baseMetrics);
    const degradationPercent = this.calculateDegradation(baseMetrics);

    return {
      ...baseMetrics,
      systemImpactPercent,
      degradationPercent,
      baselinePerformance: this.baselineMetrics?.operationsPerSecond
    };
  }

  private calculateBaseMetrics(): Omit<PerformanceMetrics, 'systemImpactPercent' | 'degradationPercent' | 'baselinePerformance'> {
    const now = Date.now();
    const recentSamples = this.samples.filter(s => now - s.timestamp < 60000); // Last minute
    const executionTimes = recentSamples.map(s => s.executionTime);
    const successfulOperations = recentSamples.filter(s => s.success);
    
    // Calculate timing metrics
    const averageExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length || 0;
    const minExecutionTime = Math.min(...executionTimes) || 0;
    const maxExecutionTime = Math.max(...executionTimes) || 0;
    const totalExecutionTime = executionTimes.reduce((a, b) => a + b, 0);

    // Calculate throughput
    const timeWindowSeconds = 60; // Last minute
    const operationsPerSecond = recentSamples.length / timeWindowSeconds;
    const totalBytesProcessed = recentSamples.reduce((sum, s) => sum + s.dataSize, 0);
    const bytesProcessedPerSecond = totalBytesProcessed / timeWindowSeconds;

    // Calculate operation-specific metrics
    const fileOperations = recentSamples.filter(s => s.operationType === 'file_operation');
    const bashCommands = recentSamples.filter(s => s.operationType === 'bash_command');
    const sanitizations = recentSamples.filter(s => s.operationType === 'sanitization');
    
    const fileOperationsPerSecond = fileOperations.length / timeWindowSeconds;
    const bashCommandsPerSecond = bashCommands.length / timeWindowSeconds;
    const sanitizationOverheadMs = sanitizations.length > 0 
      ? sanitizations.reduce((sum, s) => sum + s.executionTime, 0) / sanitizations.length 
      : 0;

    // Calculate error rates
    const errorRate = recentSamples.length > 0 
      ? (recentSamples.length - successfulOperations.length) / recentSamples.length 
      : 0;
    
    const timeoutRate = recentSamples.filter(s => s.executionTime > this.thresholds.maxExecutionTimeMs).length / recentSamples.length || 0;

    // Memory metrics
    const memoryUsages = recentSamples.map(s => s.memoryUsage);
    const memoryUsageMB = memoryUsages.length > 0 ? memoryUsages[memoryUsages.length - 1] : this.getCurrentMemoryUsage();
    const peakMemoryUsageMB = Math.max(...memoryUsages) || memoryUsageMB;

    return {
      averageExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      totalExecutionTime,
      operationsPerSecond,
      bytesProcessedPerSecond,
      memoryUsageMB,
      peakMemoryUsageMB,
      cpuUsagePercent: this.getCurrentCpuUsage(),
      errorRate,
      timeoutRate,
      fileOperationsPerSecond,
      bashCommandsPerSecond,
      sanitizationOverheadMs
    };
  }

  public setBaseline(): void {
    this.baselineMetrics = this.getCurrentMetrics();
  }

  public checkThresholds(): { passed: boolean; violations: string[] } {
    // Use base metrics to avoid circular dependency
    if (this.samples.length === 0) {
      return { passed: true, violations: [] };
    }

    const baseMetrics = this.calculateBaseMetrics();
    const violations: string[] = [];

    if (baseMetrics.averageExecutionTime > this.thresholds.maxExecutionTimeMs) {
      violations.push(`Average execution time (${baseMetrics.averageExecutionTime.toFixed(2)}ms) exceeds threshold (${this.thresholds.maxExecutionTimeMs}ms)`);
    }

    if (baseMetrics.memoryUsageMB > this.thresholds.maxMemoryUsageMB) {
      violations.push(`Memory usage (${baseMetrics.memoryUsageMB.toFixed(2)}MB) exceeds threshold (${this.thresholds.maxMemoryUsageMB}MB)`);
    }

    // Calculate system impact for threshold check
    const systemImpactPercent = this.calculateSystemImpact(baseMetrics);
    if (systemImpactPercent > this.thresholds.maxSystemImpactPercent) {
      violations.push(`System impact (${systemImpactPercent.toFixed(2)}%) exceeds threshold (${this.thresholds.maxSystemImpactPercent}%)`);
    }

    if (baseMetrics.errorRate > this.thresholds.maxErrorRate) {
      violations.push(`Error rate (${(baseMetrics.errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.thresholds.maxErrorRate * 100).toFixed(2)}%)`);
    }

    if (baseMetrics.operationsPerSecond < this.thresholds.minOperationsPerSecond) {
      violations.push(`Operations per second (${baseMetrics.operationsPerSecond.toFixed(2)}) below threshold (${this.thresholds.minOperationsPerSecond})`);
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  public exportMetrics(): {
    summary: PerformanceMetrics;
    thresholdCheck: { passed: boolean; violations: string[] };
    samples: PerformanceSample[];
    uptime: number;
  } {
    return {
      summary: this.getCurrentMetrics(),
      thresholdCheck: this.checkThresholds(),
      samples: [...this.samples],
      uptime: Date.now() - this.startTime
    };
  }

  public clearSamples(): void {
    this.samples = [];
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  private startMonitoring(): void {
    // Monitor system metrics every 5 seconds
    this.monitoringInterval = setInterval(() => {
      try {
        this.recordSample({
          timestamp: Date.now(),
          operationType: 'tool_execution',
          executionTime: 0,
          memoryUsage: this.getCurrentMemoryUsage(),
          success: true,
          dataSize: 0
        });
      } catch (error) {
        // Prevent monitoring from crashing the system
        console.warn('Performance monitoring error:', error);
      }
    }, 5000);
  }

  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024; // Convert to MB
    }
    return 0;
  }

  private getCurrentCpuUsage(): number {
    // Simplified CPU usage calculation
    // In a real implementation, you might use process.cpuUsage()
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const usage = process.cpuUsage();
      return (usage.user + usage.system) / 1000000; // Convert to percentage
    }
    return 0;
  }

  private calculateSystemImpact(metrics: Partial<PerformanceMetrics>): number {
    // Calculate the performance impact of tracing on the system
    // This is a simplified calculation
    if (!this.baselineMetrics) {
      return 0;
    }

    const impactFactors = [
      (metrics.memoryUsageMB || 0) / 100, // Memory impact
      (metrics.averageExecutionTime || 0) / 1000, // Execution time impact
      (metrics.cpuUsagePercent || 0) / 100 // CPU impact
    ];

    return Math.min(100, impactFactors.reduce((sum, factor) => sum + factor, 0) * 100);
  }

  private calculateDegradation(metrics: Partial<PerformanceMetrics>): number {
    if (!this.baselineMetrics) {
      return 0;
    }

    const baselineOps = this.baselineMetrics.operationsPerSecond;
    const currentOps = metrics.operationsPerSecond || 0;

    if (baselineOps === 0) return 0;

    return Math.max(0, ((baselineOps - currentOps) / baselineOps) * 100);
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      averageExecutionTime: 0,
      minExecutionTime: 0,
      maxExecutionTime: 0,
      totalExecutionTime: 0,
      operationsPerSecond: 0,
      bytesProcessedPerSecond: 0,
      memoryUsageMB: this.getCurrentMemoryUsage(),
      peakMemoryUsageMB: this.getCurrentMemoryUsage(),
      cpuUsagePercent: this.getCurrentCpuUsage(),
      errorRate: 0,
      timeoutRate: 0,
      fileOperationsPerSecond: 0,
      bashCommandsPerSecond: 0,
      sanitizationOverheadMs: 0,
      systemImpactPercent: 0,
      degradationPercent: 0
    };
  }
}