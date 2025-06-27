import { Command } from 'commander';
import chalk from 'chalk';
import { validateConfig } from './validation.js';
import { createDefaultConfig } from './config.js';
import { ProcessCoordinator } from '../process/coordinator.js';
import type { CLIConfig, CLIResult } from '../types/cli.js';

const program = new Command();

export async function runCLI(): Promise<CLIResult> {
  try {
    const config = await parseArguments();
    
    if (!config) {
      return { success: false, exitCode: 1, error: new Error('Invalid configuration') };
    }

    // Execute with ProcessCoordinator
    const coordinator = new ProcessCoordinator();
    const result = await coordinator.execute(config);
    
    return result;
    
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
    return { 
      success: false, 
      exitCode: 1, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

async function parseArguments(): Promise<CLIConfig | null> {
  program
    .name('opencode-trace')
    .description('CLI wrapper for opencode with comprehensive tracing')
    .version('0.1.0')
    .argument('[prompt]', 'Direct prompt for opencode')
    .option('--include-all-requests', 'Capture all HTTP requests, not just AI providers', false)
    .option('--trace-dir <dir>', 'Directory for trace files', '.opencode-trace')
    .option('--run', 'Use opencode run mode (non-interactive)', false)
    .option('--continue', 'Continue previous session', false)
    .option('--session <id>', 'Use specific session ID')
    .option('--share', 'Share session publicly', false)
    .option('--no-generate-html', 'Skip HTML generation after session')
    .option('--open', 'Open HTML viewer in browser', false)
    .option('--max-body-size <size>', 'Maximum request/response body size (bytes)', '1048576')
    .option('--session-name <name>', 'Custom session name')
    .option('--tag <tag>', 'Add session tag (repeatable)', collect, [])
    .option('--debug', 'Enable debug logging', false)
    .option('--verbose', 'Enable verbose output', false)
    .option('--quiet', 'Suppress non-essential output', false);

  // For now, let's remove subcommands to avoid conflicts
  // They can be re-added later with a different structure

  // Parse normally - let commander handle it
  program.parse();

  const opts = program.opts();
  const prompt = opts.prompt || program.args[0];

  // Create config from parsed options
  const config: CLIConfig = {
    ...createDefaultConfig(),
    prompt,
    includeAllRequests: opts.includeAllRequests,
    traceDir: opts.traceDir,
    nonInteractive: opts.run,
    continueSession: opts.continue,
    sessionId: opts.session,
    share: opts.share,
    autoGenerateHTML: opts.generateHtml !== false,
    openBrowser: opts.open,
    maxBodySize: parseInt(opts.maxBodySize, 10),
    sessionName: opts.sessionName,
    tags: opts.tag || [],
    debug: opts.debug,
    verbose: opts.verbose,
    quiet: opts.quiet,
    opencodeArgs: program.args.slice(1) // Additional args to pass to opencode
  };

  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error(chalk.red('Configuration errors:'));
    validation.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
    return null;
  }

  // Show warnings if any
  if (validation.warnings.length > 0) {
    console.warn(chalk.yellow('Configuration warnings:'));
    validation.warnings.forEach(warning => console.warn(chalk.yellow(`  • ${warning}`)));
  }

  return config;
}

// Helper function to collect repeatable options
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}