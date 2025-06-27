import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';
import type { SessionContext } from '../types/cli.js';

export interface HTMLGenerationOptions {
  template?: 'default' | 'minimal' | 'dashboard' | 'debug';
  compress?: boolean;
  sanitize?: boolean;
  includeDebugInfo?: boolean;
  title?: string;
}

export interface HTMLGenerationResult {
  success: boolean;
  htmlFile?: string;
  error?: Error;
  warnings?: string[];
}

export class SessionHTMLGenerator {
  private htmlGenerator: any;
  private jsonlProcessor: any;
  private domSetup = false;
  private viewerLoaded = false;

  constructor() {
    // Defer viewer loading until DOM is set up
  }

  private async setupDOMEnvironment(): Promise<void> {
    if (this.domSetup) return;

    // Set up JSDOM environment for web components
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    // Safely assign DOM globals
    Object.defineProperty(global, 'window', { value: dom.window, configurable: true });
    Object.defineProperty(global, 'document', { value: dom.window.document, configurable: true });
    Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
    Object.defineProperty(global, 'HTMLElement', { value: dom.window.HTMLElement, configurable: true });
    Object.defineProperty(global, 'customElements', { value: dom.window.customElements, configurable: true });

    this.domSetup = true;
  }

  private async loadViewerComponents(): Promise<void> {
    if (this.viewerLoaded) return;

    // Now safely import viewer components after DOM is set up
    const { HTMLGenerator, JSONLProcessor } = await import('@opencode-trace/viewer');
    this.htmlGenerator = new HTMLGenerator();
    this.jsonlProcessor = new JSONLProcessor();
    
    this.viewerLoaded = true;
  }

  async generateHTML(session: SessionContext, options: HTMLGenerationOptions = {}): Promise<HTMLGenerationResult> {
    try {
      console.log(chalk.blue('📄 Generating HTML viewer...'));

      // Setup DOM environment for web components
      await this.setupDOMEnvironment();
      
      // Load viewer components after DOM is ready
      await this.loadViewerComponents();

      // Set up options with defaults
      const opts = {
        template: options.template || 'default',
        compress: options.compress !== false, // Default to true
        sanitize: options.sanitize !== false, // Default to true
        includeDebugInfo: options.includeDebugInfo || session.config.debug,
        title: options.title || `OpenCode Trace - ${session.sessionName || session.sessionId}`,
        ...options
      };

      // Find JSONL trace file
      const traceFile = await this.findTraceFile(session);
      if (!traceFile) {
        return {
          success: false,
          error: new Error('No trace file found for session'),
          warnings: ['HTML generation skipped - no trace data available']
        };
      }

      // Process JSONL data
      const jsonlContent = await readFile(traceFile, 'utf-8');
      if (!jsonlContent.trim()) {
        return {
          success: false,
          error: new Error('Empty trace file'),
          warnings: ['HTML generation skipped - trace file is empty']
        };
      }

      console.log(chalk.gray(`  Processing JSONL data from: ${traceFile}`));
      const processingResult = await this.jsonlProcessor.parseContent(jsonlContent);
      
      if (!processingResult.success || !processingResult.events || processingResult.events.length === 0) {
        return {
          success: false,
          error: new Error('Failed to process JSONL data or no events found'),
          warnings: processingResult.warnings || ['No trace events found in file']
        };
      }

      console.log(chalk.gray(`  Found ${processingResult.events.length} trace events`));

      // Generate HTML
      console.log(chalk.gray(`  Generating HTML with ${opts.template} template...`));
      const htmlResult = await this.htmlGenerator.generateHTML({
        sessionData: {
          sessionId: session.sessionId,
          sessionName: session.sessionName,
          startTime: session.startTime,
          endTime: Date.now(),
          duration: Date.now() - session.startTime,
          tags: session.tags,
          config: {
            traceDir: session.traceDir,
            debug: session.config.debug,
            includeAllRequests: session.config.includeAllRequests
          }
        },
        events: processingResult.events,
        title: opts.title,
        template: opts.template,
        compress: opts.compress,
        sanitize: opts.sanitize,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: 'opencode-trace CLI v0.1.0',
          sessionDuration: Date.now() - session.startTime,
          eventCount: processingResult.events.length,
          includeDebugInfo: opts.includeDebugInfo
        }
      });

      if (!htmlResult.success || !htmlResult.html) {
        return {
          success: false,
          error: htmlResult.error || new Error('HTML generation failed'),
          warnings: htmlResult.warnings
        };
      }

      // Write HTML file
      const sessionDir = join(session.traceDir, 'sessions', session.sessionId);
      const htmlFile = join(sessionDir, 'session.html');
      
      console.log(chalk.gray(`  Writing HTML to: ${htmlFile}`));
      await writeFile(htmlFile, htmlResult.html, 'utf-8');

      // Calculate file sizes for reporting
      const htmlSize = Buffer.byteLength(htmlResult.html, 'utf-8');
      const jsonlSize = Buffer.byteLength(jsonlContent, 'utf-8');
      
      console.log(chalk.green(`✅ HTML viewer generated successfully`));
      console.log(chalk.gray(`  📊 File size: ${this.formatFileSize(htmlSize)} (JSONL: ${this.formatFileSize(jsonlSize)})`));
      console.log(chalk.gray(`  🎨 Template: ${opts.template}`));
      console.log(chalk.gray(`  📈 Events: ${processingResult.events.length}`));

      return {
        success: true,
        htmlFile,
        warnings: htmlResult.warnings
      };

    } catch (error) {
      console.error(chalk.red('❌ HTML generation failed:'), error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  private async findTraceFile(session: SessionContext): Promise<string | null> {
    const sessionDir = join(session.traceDir, 'sessions', session.sessionId);
    const sessionsDir = join(session.traceDir, 'sessions');
    
    // Try different possible trace file locations
    const possibleFiles = [
      join(sessionDir, 'session.jsonl'),
      join(sessionDir, `${session.sessionId}.jsonl`),
      join(session.traceDir, 'sessions', `${new Date().toISOString().slice(0, 10)}_session-${session.sessionId}.jsonl`)
    ];

    for (const file of possibleFiles) {
      if (existsSync(file)) {
        return file;
      }
    }

    // Check for any .jsonl files in the session directory
    try {
      const { readdir } = await import('node:fs/promises');
      if (existsSync(sessionDir)) {
        const files = await readdir(sessionDir);
        const jsonlFile = files.find(f => f.endsWith('.jsonl'));
        if (jsonlFile) {
          return join(sessionDir, jsonlFile);
        }
      }
    } catch {
      // Directory might not exist
    }

    // Check for the most recent .jsonl file in the main sessions directory
    // (JSONLLogger creates files directly in sessions/ with timestamp naming)
    try {
      const { readdir, stat } = await import('node:fs/promises');
      if (existsSync(sessionsDir)) {
        const files = await readdir(sessionsDir);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
        
        if (jsonlFiles.length > 0) {
          // Find the most recent .jsonl file by modification time
          const fileStats = await Promise.all(
            jsonlFiles.map(async (file) => {
              const filePath = join(sessionsDir, file);
              const stats = await stat(filePath);
              return { file: filePath, mtime: stats.mtime };
            })
          );
          
          fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
          return fileStats[0].file;
        }
      }
    } catch (error) {
      console.warn('Failed to search for trace files:', error);
    }

    return null;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  async generateMinimalHTML(session: SessionContext): Promise<HTMLGenerationResult> {
    return this.generateHTML(session, { 
      template: 'minimal', 
      compress: true,
      title: `OpenCode Session ${session.sessionId.slice(-8)}`
    });
  }

  async generateDebugHTML(session: SessionContext): Promise<HTMLGenerationResult> {
    return this.generateHTML(session, { 
      template: 'debug', 
      compress: false,
      includeDebugInfo: true,
      title: `OpenCode Debug - ${session.sessionId}`
    });
  }

  async generateDashboardHTML(sessions: SessionContext[]): Promise<HTMLGenerationResult> {
    // For dashboard view, we'll generate a multi-session HTML
    // This would require collecting data from multiple sessions
    // For now, just generate a default view for the first session
    if (sessions.length === 0) {
      return {
        success: false,
        error: new Error('No sessions provided for dashboard generation')
      };
    }

    return this.generateHTML(sessions[0], { 
      template: 'dashboard',
      title: 'OpenCode Dashboard'
    });
  }
}