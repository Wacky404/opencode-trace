import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import type {
  BashCommandEvent,
  RequestTiming
} from '../types.js';
import type { JSONLLogger } from '../logger.js';

const execAsync = promisify(exec);

export interface BashTracerConfig {
  sessionId: string;
  logger: JSONLLogger;
  maxOutputSize: number;
  timeout: number;
  whitelistedCommands: string[];
  blacklistedCommands: string[];
  sanitizeOutput: boolean;
  enablePerformanceMetrics: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timedOut: boolean;
}

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export class BashTracer {
  private config: BashTracerConfig;

  constructor(config: BashTracerConfig) {
    this.config = {
      ...config,
      maxOutputSize: config.maxOutputSize ?? 10 * 1024 * 1024, // 10MB
      timeout: config.timeout ?? 30000, // 30 seconds
      whitelistedCommands: config.whitelistedCommands ?? [
        'npm', 'node', 'git', 'ls', 'cat', 'echo', 'mkdir', 'touch', 
        'mv', 'cp', 'rm', 'grep', 'find', 'wc', 'sort', 'uniq', 'head', 'tail',
        'curl', 'wget', 'ping', 'ps', 'kill', 'chmod', 'chown', 'du', 'df',
        'which', 'whereis', 'pwd', 'cd', 'tar', 'gzip', 'gunzip', 'zip', 'unzip'
      ],
      blacklistedCommands: config.blacklistedCommands ?? [
        'rm -rf /', 'dd', 'mkfs', 'fdisk', 'sudo', 'su', 'passwd', 'useradd',
        'userdel', 'usermod', 'groupadd', 'groupdel', 'crontab', 'at', 'reboot',
        'shutdown', 'halt', 'poweroff', 'mount', 'umount', 'systemctl', 'service'
      ],
      sanitizeOutput: config.sanitizeOutput ?? true,
      enablePerformanceMetrics: config.enablePerformanceMetrics ?? true
    };
  }

  public async traceCommand(
    command: string,
    options: {
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<Result<CommandResult>> {
    const startTime = Date.now();
    const timing: RequestTiming = {
      start: startTime,
      end: 0,
      duration: 0
    };

    try {
      // Security check - validate command
      const securityCheck = this.validateCommand(command);
      if (!securityCheck.success) {
        return { success: false, error: securityCheck.error };
      }

      const result = await this.executeCommand(command, {
        ...options,
        timeout: options.timeout || this.config.timeout
      });

      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: BashCommandEvent = {
        type: 'bash_command',
        timestamp: startTime,
        session_id: this.config.sessionId,
        command,
        args: options.args,
        working_directory: options.cwd || process.cwd(),
        exit_code: result.exitCode,
        timing,
        success: result.exitCode === 0 && !result.timedOut
      };

      // Process output based on configuration
      if (this.config.sanitizeOutput) {
        event.stdout = this.sanitizeOutput(result.stdout);
        event.stderr = this.sanitizeOutput(result.stderr);
        event.sanitized_output = true;
      } else {
        event.stdout = this.truncateOutput(result.stdout);
        event.stderr = this.truncateOutput(result.stderr);
      }

      await this.logEvent(event);
      return { success: true, data: result };

    } catch (error) {
      timing.end = Date.now();
      timing.duration = timing.end - timing.start;

      const event: BashCommandEvent = {
        type: 'bash_command',
        timestamp: startTime,
        session_id: this.config.sessionId,
        command,
        args: options.args,
        working_directory: options.cwd || process.cwd(),
        exit_code: -1,
        timing,
        success: false
      };

      await this.logEvent(event);
      return { success: false, error: error as Error };
    }
  }

  public async traceInteractiveCommand(
    command: string,
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<Result<{ process: any; cleanup: () => void }>> {
    const startTime = Date.now();

    try {
      // Security check
      const securityCheck = this.validateCommand(command);
      if (!securityCheck.success) {
        return { success: false, error: securityCheck.error };
      }

      const args = command.split(' ').slice(1);
      const baseCommand = command.split(' ')[0];

      const childProcess = spawn(baseCommand, args, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Log streaming output if enabled
        if (this.config.enablePerformanceMetrics) {
          this.logStreamingOutput('stdout', chunk, startTime);
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        
        if (this.config.enablePerformanceMetrics) {
          this.logStreamingOutput('stderr', chunk, startTime);
        }
      });

      const cleanup = () => {
        if (!childProcess.killed) {
          childProcess.kill('SIGTERM');
        }

        // Log final results
        const event: BashCommandEvent = {
          type: 'bash_command',
          timestamp: startTime,
          session_id: this.config.sessionId,
          command,
          working_directory: options.cwd || process.cwd(),
          exit_code: childProcess.exitCode || -1,
          stdout: this.config.sanitizeOutput ? this.sanitizeOutput(stdout) : this.truncateOutput(stdout),
          stderr: this.config.sanitizeOutput ? this.sanitizeOutput(stderr) : this.truncateOutput(stderr),
          timing: {
            start: startTime,
            end: Date.now(),
            duration: Date.now() - startTime
          },
          success: childProcess.exitCode === 0,
          sanitized_output: this.config.sanitizeOutput
        };

        this.logEvent(event).catch(console.error);
      };

      return {
        success: true,
        data: {
          process: childProcess,
          cleanup
        }
      };

    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private validateCommand(command: string): Result<void> {
    const baseCommand = command.trim().split(' ')[0].toLowerCase();
    
    // Check blacklisted commands
    for (const blacklisted of this.config.blacklistedCommands) {
      if (command.toLowerCase().includes(blacklisted.toLowerCase())) {
        return { 
          success: false, 
          error: new Error(`Command contains blacklisted operation: ${blacklisted}`) 
        };
      }
    }

    // Check if base command is whitelisted (if whitelist is enforced)
    if (this.config.whitelistedCommands.length > 0) {
      const isWhitelisted = this.config.whitelistedCommands.some(allowed => 
        baseCommand === allowed.toLowerCase()
      );
      
      if (!isWhitelisted) {
        return { 
          success: false, 
          error: new Error(`Command not in whitelist: ${baseCommand}`) 
        };
      }
    }

    // Additional security checks
    const dangerousPatterns = [
      /&&\s*rm\s+-rf/i,
      /;\s*rm\s+-rf/i,
      /\|\s*rm\s+-rf/i,
      />\s*\/dev\/sd[a-z]/i,
      /mkfs\./i,
      /dd\s+if=/i,
      /:\(\)\{.*:\|:&\}/i // Fork bomb pattern
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return { 
          success: false, 
          error: new Error('Command contains potentially dangerous pattern') 
        };
      }
    }

    return { success: true };
  }

  private async executeCommand(
    command: string,
    options: {
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      timeout: number;
    }
  ): Promise<CommandResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve({
          stdout: '',
          stderr: 'Command timed out',
          exitCode: -1,
          duration: Date.now() - startTime,
          timedOut: true
        });
      }, options.timeout);

      try {
        exec(command, {
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...options.env },
          maxBuffer: this.config.maxOutputSize,
          timeout: options.timeout
        }, (error, stdout, stderr) => {
          clearTimeout(timeoutId);

          const duration = Date.now() - startTime;
          const result: CommandResult = {
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: error?.code || 0,
            duration,
            timedOut: false
          };

          resolve(result);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private sanitizeOutput(output: string): string {
    if (!output) return '';

    const sensitivePatterns = [
      // API keys and tokens
      /(?:api[_-]?key|apikey)['":\s]*([a-zA-Z0-9\-_]{20,})/gi,
      /(?:secret|token)['":\s]*([a-zA-Z0-9\-_]{20,})/gi,
      /(?:bearer\s+)([a-zA-Z0-9\-_]{20,})/gi,
      
      // Passwords
      /(?:password|passwd|pwd)['":\s]*([^\s'"]+)/gi,
      
      // SSH keys
      /-----BEGIN [A-Z\s]+ KEY-----[\s\S]*?-----END [A-Z\s]+ KEY-----/gi,
      
      // File paths containing sensitive directories
      /\/Users\/[^\/\s]+\/\.ssh\/[^\s]+/gi,
      /\/home\/[^\/\s]+\/\.ssh\/[^\s]+/gi,
      /\/Users\/[^\/\s]+\/\.aws\/[^\s]+/gi,
      /\/home\/[^\/\s]+\/\.aws\/[^\s]+/gi,
      
      // URLs with credentials
      /https?:\/\/[^:]+:[^@]+@[^\s]+/gi,
      
      // Environment variables that might contain secrets
      /(?:export\s+)?[A-Z_]+(?:API_?KEY|SECRET|TOKEN|PASSWORD)['":\s]*=([^\s'"]+)/gi
    ];

    let sanitized = output;
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, (match, capture) => {
        if (capture) {
          return match.replace(capture, '[REDACTED]');
        }
        return '[REDACTED]';
      });
    }

    return this.truncateOutput(sanitized);
  }

  private truncateOutput(output: string): string {
    if (output.length <= this.config.maxOutputSize) {
      return output;
    }

    const truncated = output.substring(0, this.config.maxOutputSize - 100);
    return truncated + '\n\n... [OUTPUT TRUNCATED - Total size: ' + output.length + ' bytes] ...';
  }

  private async logStreamingOutput(
    stream: 'stdout' | 'stderr',
    chunk: string,
    startTime: number
  ): Promise<void> {
    // For streaming commands, we might want to log intermediate output
    // This is optional and can be disabled for performance
    if (!this.config.enablePerformanceMetrics) return;

    try {
      const event: BashCommandEvent = {
        type: 'bash_command',
        timestamp: Date.now(),
        session_id: this.config.sessionId,
        command: '[STREAMING]',
        working_directory: process.cwd(),
        exit_code: 0,
        [stream]: this.config.sanitizeOutput ? this.sanitizeOutput(chunk) : chunk,
        timing: {
          start: startTime,
          end: Date.now(),
          duration: Date.now() - startTime
        },
        success: true,
        sanitized_output: this.config.sanitizeOutput
      };

      await this.logEvent(event);
    } catch (error) {
      // Silently ignore streaming log errors to not disrupt the main process
    }
  }

  private async logEvent(event: BashCommandEvent): Promise<void> {
    try {
      await this.config.logger.logEvent(event);
    } catch (error) {
      console.error('Failed to log bash command event:', error);
    }
  }
}