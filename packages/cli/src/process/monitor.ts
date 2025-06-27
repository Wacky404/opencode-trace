import { EventEmitter } from 'node:events';
import type { ProcessInfo } from '../types/cli.js';

export class ProcessMonitor extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  startMonitoring(processes: Map<string, ProcessInfo>): void {
    this.processes = processes;
    this.isMonitoring = true;
    
    // Start monitoring intervals
    this.monitorInterval = setInterval(() => {
      this.checkProcessHealth();
    }, 5000); // Check every 5 seconds
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 15000); // Health check every 15 seconds
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private checkProcessHealth(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    for (const [name, processInfo] of this.processes) {
      const health = this.assessProcessHealth(processInfo);
      
      if (health.status === 'unhealthy') {
        this.emit('processUnhealthy', name, health.reason);
      } else if (health.status === 'healthy' && health.wasUnhealthy) {
        this.emit('processRecovered', name);
      }
    }
  }

  private assessProcessHealth(processInfo: ProcessInfo): {
    status: 'healthy' | 'unhealthy';
    reason?: string;
    wasUnhealthy?: boolean;
  } {
    const process = processInfo.process;
    
    // Check if process is still running
    if (process.killed || process.exitCode !== null) {
      return {
        status: 'unhealthy',
        reason: `Process exited with code ${process.exitCode}`
      };
    }
    
    // Check if process PID is valid
    if (processInfo.pid <= 0) {
      return {
        status: 'unhealthy',
        reason: 'Invalid process ID'
      };
    }
    
    // Check if process is responding (basic check)
    try {
      // On Unix systems, sending signal 0 checks if process exists
      process.kill(0);
    } catch (error) {
      return {
        status: 'unhealthy',
        reason: 'Process not responding to signals'
      };
    }
    
    // Check runtime duration
    const runtime = Date.now() - processInfo.startTime;
    const maxRuntime = 24 * 60 * 60 * 1000; // 24 hours
    
    if (runtime > maxRuntime) {
      return {
        status: 'unhealthy',
        reason: 'Process running for too long'
      };
    }
    
    return { status: 'healthy' };
  }

  private performHealthChecks(): void {
    if (!this.isMonitoring) {
      return;
    }
    
    // Emit health check events for components to respond to
    this.emit('healthCheckRequested');
    
    // Check memory usage if available
    this.checkSystemResources();
  }

  private checkSystemResources(): void {
    try {
      const memUsage = process.memoryUsage();
      const maxMemory = 512 * 1024 * 1024; // 512MB limit
      
      if (memUsage.heapUsed > maxMemory) {
        this.emit('highMemoryUsage', {
          current: memUsage.heapUsed,
          limit: maxMemory,
          percentage: (memUsage.heapUsed / maxMemory) * 100
        });
      }
      
      // Check if any process is consuming too much CPU (basic check)
      for (const [name, processInfo] of this.processes) {
        // This is a simplified check - in a real implementation,
        // you might want to use more sophisticated CPU monitoring
        if (processInfo.status === 'running') {
          this.emit('processResourceCheck', name, {
            memory: memUsage,
            pid: processInfo.pid
          });
        }
      }
      
    } catch (error) {
      console.warn('Failed to check system resources:', error);
    }
  }

  getProcessStats(): Map<string, ProcessStats> {
    const stats = new Map<string, ProcessStats>();
    
    for (const [name, processInfo] of this.processes) {
      const runtime = Date.now() - processInfo.startTime;
      
      stats.set(name, {
        name: processInfo.name,
        pid: processInfo.pid,
        status: processInfo.status,
        runtime,
        startTime: processInfo.startTime,
        isHealthy: this.assessProcessHealth(processInfo).status === 'healthy'
      });
    }
    
    return stats;
  }

  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: string[];
  } {
    const details: string[] = [];
    let healthyCount = 0;
    let totalCount = 0;
    
    for (const [name, processInfo] of this.processes) {
      totalCount++;
      const health = this.assessProcessHealth(processInfo);
      
      if (health.status === 'healthy') {
        healthyCount++;
      } else {
        details.push(`${name}: ${health.reason}`);
      }
    }
    
    if (healthyCount === totalCount) {
      return { status: 'healthy', details: [] };
    } else if (healthyCount > 0) {
      return { status: 'degraded', details };
    } else {
      return { status: 'unhealthy', details };
    }
  }
}

interface ProcessStats {
  name: string;
  pid: number;
  status: string;
  runtime: number;
  startTime: number;
  isHealthy: boolean;
}