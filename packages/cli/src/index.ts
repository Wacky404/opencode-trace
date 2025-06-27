#!/usr/bin/env node

export * from './cli/parser.js';
export * from './cli/config.js';
export * from './cli/validation.js';
export * from './types/cli.js';

// Main CLI execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('./cli/parser.js');
  
  try {
    const result = await runCLI();
    process.exit(result.exitCode);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}