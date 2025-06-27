import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { CLIConfig } from '../types/cli.js';

export interface ConfigFile {
  traceDir?: string;
  includeAllRequests?: boolean;
  autoGenerateHTML?: boolean;
  maxBodySize?: number;
  tags?: string[];
  debug?: boolean;
  verbose?: boolean;
}

export function createDefaultConfig(): CLIConfig {
  return {
    includeAllRequests: false,
    traceDir: '.opencode-trace',
    opencodeArgs: [],
    nonInteractive: false,
    continueSession: false,
    share: false,
    autoGenerateHTML: true,
    openBrowser: false,
    maxBodySize: 1048576, // 1MB
    tags: [],
    debug: false,
    verbose: false,
    quiet: false
  };
}

export async function loadConfigFile(): Promise<Partial<CLIConfig>> {
  const configPaths = [
    join(process.cwd(), '.opencode-trace.json'),
    join(homedir(), '.opencode-trace.json'),
    join(homedir(), '.config', 'opencode-trace', 'config.json')
  ];

  for (const configPath of configPaths) {
    try {
      if (existsSync(configPath)) {
        const content = await readFile(configPath, 'utf-8');
        const config: ConfigFile = JSON.parse(content);
        return normalizeConfigFile(config);
      }
    } catch (error) {
      console.warn(`Failed to load config from ${configPath}:`, error);
    }
  }

  return {};
}

export async function saveConfigFile(config: Partial<CLIConfig>): Promise<void> {
  const configDir = join(homedir(), '.config', 'opencode-trace');
  const configPath = join(configDir, 'config.json');

  try {
    await mkdir(configDir, { recursive: true });
    const configFile: ConfigFile = {
      traceDir: config.traceDir,
      includeAllRequests: config.includeAllRequests,
      autoGenerateHTML: config.autoGenerateHTML,
      maxBodySize: config.maxBodySize,
      tags: config.tags,
      debug: config.debug,
      verbose: config.verbose
    };

    await writeFile(configPath, JSON.stringify(configFile, null, 2));
  } catch (error) {
    throw new Error(`Failed to save config file: ${error}`);
  }
}

export function mergeConfigs(defaults: CLIConfig, file: Partial<CLIConfig>, cli: Partial<CLIConfig>): CLIConfig {
  return {
    ...defaults,
    ...file,
    ...cli
  };
}

export function resolveTraceDir(traceDir: string): string {
  if (traceDir.startsWith('~')) {
    return traceDir.replace('~', homedir());
  }
  return resolve(traceDir);
}

export function getSessionDir(traceDir: string, sessionId: string): string {
  return join(resolveTraceDir(traceDir), 'sessions', sessionId);
}

export function getSessionFile(traceDir: string, sessionId: string, extension: 'jsonl' | 'html'): string {
  const sessionDir = getSessionDir(traceDir, sessionId);
  return join(sessionDir, `session.${extension}`);
}

function normalizeConfigFile(config: ConfigFile): Partial<CLIConfig> {
  return {
    traceDir: config.traceDir,
    includeAllRequests: config.includeAllRequests,
    autoGenerateHTML: config.autoGenerateHTML,
    maxBodySize: config.maxBodySize,
    tags: config.tags || [],
    debug: config.debug,
    verbose: config.verbose
  };
}