import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import chalk from 'chalk';
import { HTTPProxy } from '../proxy/http-proxy.js';
import type { CLIConfig } from '../types/cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ProcessSpawner {
  private proxy: HTTPProxy | null = null;
  async spawnTypescriptServer(config: CLIConfig): Promise<ChildProcess> {
    // opencode doesn't have a separate server mode, skip this
    console.log(chalk.blue('🟦 Skipping TypeScript server (opencode is single-process)'));
    
    // Return a dummy process that exits immediately
    const dummyProcess = spawn('echo', ['TypeScript server simulation complete'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return dummyProcess;
  }

  async spawnGoTUI(config: CLIConfig): Promise<ChildProcess> {
    console.log(chalk.blue('🟩 Starting Go TUI with HTTP proxy tracing...'));
    
    // Start HTTP proxy first
    await this.startProxy(config);
    
    const command = await this.findOpenCodeCommand();
    const args = this.buildTUICommand(config);
    const env = this.buildTUIEnvironment(config);
    
    console.log(chalk.gray(`[tui] Command: ${command} ${args.join(' ')}`));
    console.log(chalk.gray(`[tui] Proxy: ${env.HTTP_PROXY || 'none'}`));
    console.log(chalk.gray(`[tui] Environment vars: ${Object.keys(env).join(', ')}`));
    
    const childProcess = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['inherit', 'pipe', 'pipe'], // Inherit stdin for interactive mode
      detached: false
    });
    
    // Setup output handling
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        if (config.debug) {
          console.log(chalk.gray(`[tui] ${data.toString().trim()}`));
        }
      });
    }
    
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.error(chalk.red(`[tui] ${output}`));
        }
      });
    }
    
    childProcess.on('error', (error) => {
      console.error(chalk.red('Failed to start Go TUI:'), error);
    });
    
    return childProcess;
  }

  private async findOpenCodeCommand(): Promise<string> {
    // Try common locations for opencode
    const possiblePaths = [
      'opencode', // System PATH
      '/usr/local/bin/opencode',
      '/opt/homebrew/bin/opencode',
      resolve(process.env.HOME || '~', '.local/bin/opencode'),
      resolve(process.env.HOME || '~', 'go/bin/opencode')
    ];
    
    for (const path of possiblePaths) {
      if (path === 'opencode') {
        // Check if it's in PATH
        try {
          const { spawn } = await import('node:child_process');
          const result = spawn('which', ['opencode'], { stdio: 'pipe' });
          const found = await new Promise<boolean>((resolve) => {
            result.on('exit', (code) => resolve(code === 0));
            result.on('error', () => resolve(false));
          });
          if (found) return path;
        } catch {
          continue;
        }
      } else if (existsSync(path)) {
        return path;
      }
    }
    
    // If not found, assume it's in PATH and let the system handle the error
    console.warn(chalk.yellow('⚠️  opencode command not found in common locations, trying system PATH'));
    return 'opencode';
  }

  private buildTUICommand(config: CLIConfig): string[] {
    const args: string[] = [];
    
    // Add the prompt if provided
    if (config.prompt) {
      // Always use 'run' command for prompts
      args.push('run', config.prompt);
    } else {
      // No prompt, start regular TUI mode (default project in current directory)
      args.push('.');
    }
    
    // Add common opencode arguments
    if (config.share) {
      args.push('--share');
    }
    
    if (config.continueSession && config.sessionId) {
      args.push('--continue', config.sessionId);
    }
    
    // Add any additional opencode args
    args.push(...config.opencodeArgs);
    
    return args;
  }

  private buildServerEnvironment(config: CLIConfig): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Enable tracing
    env.OPENCODE_TRACE = 'true';
    env.OPENCODE_TRACE_MODE = 'server';
    env.OPENCODE_TRACE_SESSION_ID = config.sessionId || 'default';
    env.OPENCODE_TRACE_DIR = config.traceDir;
    
    // Configuration options
    env.OPENCODE_TRACE_INCLUDE_ALL = config.includeAllRequests ? 'true' : 'false';
    env.OPENCODE_TRACE_MAX_BODY_SIZE = config.maxBodySize.toString();
    
    // Debug settings
    if (config.debug) {
      env.OPENCODE_TRACE_DEBUG = 'true';
      env.NODE_ENV = 'development';
    }
    
    if (config.verbose) {
      env.OPENCODE_TRACE_VERBOSE = 'true';
    }
    
    // Runtime interception using Node.js require hook  
    // In built code, __dirname points to dist/, so interceptors are at dist/interceptors/
    const interceptorPath = resolve(__dirname, 'interceptors/interceptor-loader.cjs');
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --require ${interceptorPath}`.trim();
    
    return env;
  }

  private buildTUIEnvironment(config: CLIConfig): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Enable tracing
    env.OPENCODE_TRACE = 'true';
    env.OPENCODE_TRACE_MODE = 'tui';
    env.OPENCODE_TRACE_SESSION_ID = config.sessionId || 'default';
    env.OPENCODE_TRACE_DIR = config.traceDir;
    
    // Configuration options
    env.OPENCODE_TRACE_INCLUDE_ALL = config.includeAllRequests ? 'true' : 'false';
    env.OPENCODE_TRACE_MAX_BODY_SIZE = config.maxBodySize.toString();
    
    // Debug settings
    if (config.debug) {
      env.OPENCODE_TRACE_DEBUG = 'true';
    }
    
    if (config.verbose) {
      env.OPENCODE_TRACE_VERBOSE = 'true';
    }
    
    // Add proxy configuration if proxy is running
    if (this.proxy) {
      const proxyConfig = this.proxy.getProxyConfig();
      Object.assign(env, proxyConfig);
    }
    
    return env;
  }

  private async startProxy(config: CLIConfig): Promise<void> {
    if (this.proxy) {
      console.log(chalk.yellow('⚠️  Proxy already running, skipping'));
      return;
    }

    this.proxy = new HTTPProxy(config.sessionId || 'default', {
      port: config.proxyPort || 8888, // Default proxy port
      host: '127.0.0.1',
      debug: config.debug,
      verbose: config.verbose,
      includeAllRequests: config.includeAllRequests,
      maxBodySize: config.maxBodySize
    });

    // Forward proxy events to external handlers (will be connected later)
    this.proxy.on('event', (event) => {
      // TODO: Forward to event logger
      if (config.debug) {
        console.log(chalk.gray(`[proxy] ${event.type}: ${event.data.method || ''} ${event.data.url || ''}`));
      }
    });

    await this.proxy.start();
  }

  async stopProxy(): Promise<void> {
    if (this.proxy) {
      await this.proxy.stop();
      this.proxy = null;
    }
  }

  getProxy(): HTTPProxy | null {
    return this.proxy;
  }
}