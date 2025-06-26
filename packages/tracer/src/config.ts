import { promises as fs } from 'fs';
import { join } from 'path';

export interface TracerConfig {
  outputDir: string;
  maxSessionsRetained: number;
  autoCleanupDays: number;
  captureRequestBodies: boolean;
  captureResponseBodies: boolean;
  maxBodySize: number;
  sensitiveHeaders: string[];
  redactPatterns: string[];
  batchSize: number;
  flushIntervalMs: number;
  maxMemoryUsageMB: number;
}

export interface ConfigResult<T = TracerConfig> {
  success: boolean;
  data?: T;
  error?: Error;
}

export class ConfigManager {
  private static readonly DEFAULT_CONFIG: TracerConfig = {
    outputDir: '.opencode-trace',
    maxSessionsRetained: 50,
    autoCleanupDays: 30,
    captureRequestBodies: true,
    captureResponseBodies: true,
    maxBodySize: 1024 * 1024, // 1MB
    sensitiveHeaders: [
      'authorization',
      'x-api-key',
      'x-auth-token',
      'cookie',
      'set-cookie',
      'x-openai-key',
      'x-anthropic-key'
    ],
    redactPatterns: [
      'sk-[a-zA-Z0-9]{48}', // OpenAI API keys
      'sk-ant-[a-zA-Z0-9-_]{95}', // Anthropic API keys
      'Bearer [a-zA-Z0-9-_.~+/]+=*', // Bearer tokens
      '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' // Email addresses
    ],
    batchSize: 10,
    flushIntervalMs: 1000,
    maxMemoryUsageMB: 50
  };

  static async loadConfig(configPath?: string): Promise<ConfigResult> {
    try {
      // Start with default configuration
      let config = { ...this.DEFAULT_CONFIG };

      // Override with environment variables
      config = this.applyEnvironmentVariables(config);

      // Override with config file if it exists
      const fileConfig = await this.loadConfigFile(configPath);
      if (fileConfig.success && fileConfig.data) {
        config = { ...config, ...fileConfig.data };
      }

      // Validate the final configuration
      const validatedConfig = this.validateConfig(config);

      return {
        success: true,
        data: validatedConfig
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  static getDefaultConfig(): TracerConfig {
    return { ...this.DEFAULT_CONFIG };
  }

  static validateConfig(config: Partial<TracerConfig>): TracerConfig {
    const validated: TracerConfig = { ...this.DEFAULT_CONFIG };

    // Validate and set each field
    if (typeof config.outputDir === 'string' && config.outputDir.trim()) {
      validated.outputDir = config.outputDir.trim();
    }

    if (typeof config.maxSessionsRetained === 'number' && config.maxSessionsRetained > 0) {
      validated.maxSessionsRetained = Math.max(1, Math.floor(config.maxSessionsRetained));
    }

    if (typeof config.autoCleanupDays === 'number' && config.autoCleanupDays >= 0) {
      validated.autoCleanupDays = Math.max(0, Math.floor(config.autoCleanupDays));
    }

    if (typeof config.captureRequestBodies === 'boolean') {
      validated.captureRequestBodies = config.captureRequestBodies;
    }

    if (typeof config.captureResponseBodies === 'boolean') {
      validated.captureResponseBodies = config.captureResponseBodies;
    }

    if (typeof config.maxBodySize === 'number' && config.maxBodySize > 0) {
      validated.maxBodySize = Math.max(1024, Math.floor(config.maxBodySize)); // Min 1KB
    }

    if (Array.isArray(config.sensitiveHeaders)) {
      validated.sensitiveHeaders = config.sensitiveHeaders
        .filter(header => typeof header === 'string')
        .map(header => header.toLowerCase().trim())
        .filter(header => header.length > 0);
    }

    if (Array.isArray(config.redactPatterns)) {
      validated.redactPatterns = config.redactPatterns
        .filter(pattern => typeof pattern === 'string')
        .filter(pattern => {
          try {
            new RegExp(pattern);
            return true;
          } catch {
            return false;
          }
        });
    }

    if (typeof config.batchSize === 'number' && config.batchSize > 0) {
      validated.batchSize = Math.max(1, Math.min(100, Math.floor(config.batchSize)));
    }

    if (typeof config.flushIntervalMs === 'number' && config.flushIntervalMs > 0) {
      validated.flushIntervalMs = Math.max(100, Math.floor(config.flushIntervalMs));
    }

    if (typeof config.maxMemoryUsageMB === 'number' && config.maxMemoryUsageMB > 0) {
      validated.maxMemoryUsageMB = Math.max(10, Math.floor(config.maxMemoryUsageMB));
    }

    return validated;
  }

  private static applyEnvironmentVariables(config: TracerConfig): TracerConfig {
    const envConfig = { ...config };

    // Environment variable mappings
    const envMappings: Array<[string, keyof TracerConfig, (value: string) => any]> = [
      ['OPENCODE_TRACE_DIR', 'outputDir', (v) => v],
      ['OPENCODE_TRACE_MAX_SESSIONS', 'maxSessionsRetained', (v) => parseInt(v, 10)],
      ['OPENCODE_TRACE_CLEANUP_DAYS', 'autoCleanupDays', (v) => parseInt(v, 10)],
      ['OPENCODE_TRACE_CAPTURE_REQUESTS', 'captureRequestBodies', (v) => v.toLowerCase() === 'true'],
      ['OPENCODE_TRACE_CAPTURE_RESPONSES', 'captureResponseBodies', (v) => v.toLowerCase() === 'true'],
      ['OPENCODE_TRACE_MAX_BODY_SIZE', 'maxBodySize', (v) => parseInt(v, 10)],
      ['OPENCODE_TRACE_BATCH_SIZE', 'batchSize', (v) => parseInt(v, 10)],
      ['OPENCODE_TRACE_FLUSH_INTERVAL', 'flushIntervalMs', (v) => parseInt(v, 10)],
      ['OPENCODE_TRACE_MAX_MEMORY', 'maxMemoryUsageMB', (v) => parseInt(v, 10)]
    ];

    for (const [envVar, configKey, parser] of envMappings) {
      const envValue = process.env[envVar];
      if (envValue !== undefined && envValue.trim() !== '') {
        try {
          const parsedValue = parser(envValue.trim());
          if (parsedValue !== undefined && !isNaN(parsedValue as number)) {
            (envConfig as any)[configKey] = parsedValue;
          }
        } catch {
          // Ignore invalid environment variable values
        }
      }
    }

    // Handle array environment variables
    const sensitiveHeadersEnv = process.env.OPENCODE_TRACE_SENSITIVE_HEADERS;
    if (sensitiveHeadersEnv) {
      try {
        const headers = sensitiveHeadersEnv.split(',').map(h => h.trim().toLowerCase());
        envConfig.sensitiveHeaders = [...envConfig.sensitiveHeaders, ...headers];
      } catch {
        // Ignore invalid format
      }
    }

    const redactPatternsEnv = process.env.OPENCODE_TRACE_REDACT_PATTERNS;
    if (redactPatternsEnv) {
      try {
        const patterns = redactPatternsEnv.split('||').map(p => p.trim());
        envConfig.redactPatterns = [...envConfig.redactPatterns, ...patterns];
      } catch {
        // Ignore invalid format
      }
    }

    return envConfig;
  }

  private static async loadConfigFile(configPath?: string): Promise<ConfigResult<Partial<TracerConfig>>> {
    try {
      const defaultPaths = [
        configPath,
        join(process.cwd(), '.opencode-trace', 'config.json'),
        join(process.env.HOME || '~', '.opencode', 'trace-config.json'),
        join(process.cwd(), 'opencode-trace.config.json')
      ].filter(path => path !== undefined) as string[];

      for (const path of defaultPaths) {
        try {
          const content = await fs.readFile(path, 'utf8');
          const parsed = JSON.parse(content);
          
          return {
            success: true,
            data: parsed
          };
        } catch {
          // Try next path
          continue;
        }
      }

      // No config file found, return empty config
      return {
        success: true,
        data: {}
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  static async saveConfig(config: TracerConfig, configPath?: string): Promise<ConfigResult<void>> {
    try {
      const outputPath = configPath || join(config.outputDir, 'config.json');
      const content = JSON.stringify(config, null, 2);
      
      await fs.writeFile(outputPath, content, 'utf8');
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error as Error
      };
    }
  }

  static isTracingEnabled(): boolean {
    const envValue = process.env.OPENCODE_TRACE;
    return envValue !== undefined && envValue.toLowerCase() !== 'false' && envValue !== '0';
  }

  static getSessionId(): string | null {
    return process.env.OPENCODE_TRACE_SESSION_ID || null;
  }
}