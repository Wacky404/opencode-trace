import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CLIConfig, ValidationResult } from '../types/cli.js';

export function validateConfig(config: CLIConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate prompt
  if (!config.prompt && !config.continueSession) {
    errors.push('Either a prompt or --continue must be provided');
  }

  if (config.prompt && config.prompt.trim().length === 0) {
    errors.push('Prompt cannot be empty');
  }

  if (config.prompt && config.prompt.length > 10000) {
    warnings.push('Prompt is very long (>10k chars), consider breaking it down');
  }

  // Validate trace directory
  if (!config.traceDir || config.traceDir.trim().length === 0) {
    errors.push('Trace directory cannot be empty');
  }

  try {
    const resolvedTraceDir = resolve(config.traceDir);
    const parentDir = resolve(resolvedTraceDir, '..');
    
    if (!existsSync(parentDir)) {
      errors.push(`Parent directory of trace dir does not exist: ${parentDir}`);
    }
  } catch (error) {
    errors.push(`Invalid trace directory path: ${config.traceDir}`);
  }

  // Validate max body size
  if (config.maxBodySize < 0) {
    errors.push('Max body size cannot be negative');
  }

  if (config.maxBodySize > 100 * 1024 * 1024) { // 100MB
    warnings.push('Max body size is very large (>100MB), this may impact performance');
  }

  // Validate session ID format if provided
  if (config.sessionId && !/^[a-zA-Z0-9_-]+$/.test(config.sessionId)) {
    errors.push('Session ID can only contain letters, numbers, underscores, and hyphens');
  }

  // Validate session name if provided
  if (config.sessionName && config.sessionName.length > 100) {
    warnings.push('Session name is very long (>100 chars)');
  }

  // Validate tags
  config.tags.forEach((tag, index) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      errors.push(`Tag ${index + 1} contains invalid characters: ${tag}`);
    }
    if (tag.length > 50) {
      warnings.push(`Tag ${index + 1} is very long (>50 chars): ${tag}`);
    }
  });

  if (config.tags.length > 20) {
    warnings.push('Many tags specified (>20), consider consolidating');
  }

  // Validate conflicting options
  if (config.quiet && config.verbose) {
    errors.push('Cannot use both --quiet and --verbose options');
  }

  if (config.quiet && config.debug) {
    warnings.push('Debug output may still appear despite --quiet flag');
  }

  if (config.nonInteractive && config.continueSession) {
    errors.push('Cannot use --run and --continue together');
  }

  // Validate opencode args
  if (config.opencodeArgs.some(arg => arg.includes('--trace') || arg.includes('OPENCODE_TRACE'))) {
    warnings.push('opencode tracing args detected - this may conflict with wrapper tracing');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{1,50}$/.test(sessionId);
}

export function validateTraceDir(traceDir: string): boolean {
  try {
    const resolved = resolve(traceDir);
    return resolved.length > 0 && !resolved.includes('\0');
  } catch {
    return false;
  }
}

export function sanitizeSessionName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-\s]/g, '')
    .trim()
    .slice(0, 100);
}

export function sanitizeTag(tag: string): string {
  return tag
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 50);
}