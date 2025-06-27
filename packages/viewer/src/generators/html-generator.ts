import type { 
  HTMLGenerationOptions,
  GeneratedHTML,
  TemplateContext,
  ComponentBundle,
  AssetManifest
} from '../types/html.js';
import type { SessionData, TraceEvent, MetricsReport } from '../types/trace.js';
import { ComponentBundler } from './component-bundler.js';
import { AssetInliner } from './asset-inliner.js';
import { DataEmbedder } from './data-embedder.js';

/**
 * HTML Generator for creating self-contained trace viewer files
 * Combines components, data, and assets into a single HTML file
 */
export class HTMLGenerator {
  private bundler: ComponentBundler;
  private inliner: AssetInliner;
  private embedder: DataEmbedder;
  private templates = new Map<string, string>();

  constructor() {
    this.bundler = new ComponentBundler();
    this.inliner = new AssetInliner();
    this.embedder = new DataEmbedder();
    this.loadTemplates();
  }

  /**
   * Generate a complete HTML file with embedded components and data
   */
  async generateHTML(options: HTMLGenerationOptions): Promise<GeneratedHTML> {
    const startTime = performance.now();

    try {
      // Step 1: Bundle components
      const componentBundle = await this.bundler.bundleComponents({
        components: options.components || this.getDefaultComponents(),
        optimize: options.optimize !== false,
        minify: options.minify !== false,
        includeSourceMaps: options.includeSourceMaps === true
      });

      // Step 2: Process and embed data
      const embeddedData = await this.embedder.embedData({
        sessionData: options.sessionData,
        events: options.events,
        metrics: options.metrics,
        compress: options.compress !== false,
        sanitize: options.sanitize !== false
      });

      // Step 3: Inline assets
      const inlinedAssets = await this.inliner.inlineAssets({
        css: componentBundle.styles,
        fonts: options.includeFonts !== false,
        images: options.includeImages !== false
      });

      // Step 4: Create template context
      const context: TemplateContext = {
        title: options.title || this.generateTitle(options.sessionData),
        description: options.description || this.generateDescription(options.sessionData),
        componentJS: componentBundle.javascript,
        componentCSS: inlinedAssets.css,
        embeddedData: embeddedData.data,
        metadata: {
          generatedAt: new Date().toISOString(),
          version: this.getVersion(),
          sessionId: options.sessionData?.id || 'unknown',
          eventCount: options.events?.length || 0,
          fileSize: 0, // Will be calculated after generation
          processingTime: 0, // Will be calculated after generation
          componentCount: 0, // Will be calculated after generation
          assetCount: 0, // Will be calculated after generation
          compressed: options.compress !== false
        },
        options: {
          theme: options.theme || 'vs-dark',
          showMetrics: options.showMetrics !== false,
          showTimeline: options.showTimeline !== false,
          showTools: options.showTools !== false,
          enableSearch: options.enableSearch !== false
        }
      };

      // Step 5: Render template
      const template = options.template || 'default';
      const htmlContent = await this.renderTemplate(template, context);

      // Step 6: Calculate final file size and update metadata
      const fileSize = new Blob([htmlContent]).size;
      context.metadata.fileSize = fileSize;
      context.metadata.processingTime = performance.now() - startTime;
      context.metadata.componentCount = componentBundle.componentCount;
      context.metadata.assetCount = inlinedAssets.assetCount;

      const processingTime = context.metadata.processingTime;

      return {
        html: htmlContent,
        metadata: {
          ...context.metadata,
          processingTime,
          fileSize,
          componentCount: componentBundle.componentCount,
          assetCount: inlinedAssets.assetCount,
          compressionRatio: embeddedData.compressionRatio
        },
        assets: {
          components: componentBundle.manifest,
          inlined: inlinedAssets.manifest
        },
        warnings: [
          ...componentBundle.warnings,
          ...embeddedData.warnings,
          ...inlinedAssets.warnings
        ]
      };

    } catch (error) {
      throw new Error(`HTML generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Generate HTML for multiple sessions (dashboard view)
   */
  async generateDashboard(options: {
    sessions: SessionData[];
    title?: string;
    template?: string;
    options?: Partial<HTMLGenerationOptions>;
  }): Promise<GeneratedHTML> {
    const dashboardOptions: HTMLGenerationOptions = {
      title: options.title || 'OpenCode Trace Dashboard',
      template: options.template || 'dashboard',
      sessionData: null,
      events: [],
      metrics: null,
      components: ['session-browser', 'session-list', 'session-stats'],
      ...options.options
    };

    // Embed multiple sessions data
    const embeddedData = await this.embedder.embedData({
      sessions: options.sessions,
      compress: dashboardOptions.compress !== false,
      sanitize: dashboardOptions.sanitize !== false
    });

    return this.generateHTML({
      ...dashboardOptions,
      sessionData: { 
        id: 'dashboard',
        sessions: options.sessions 
      } as any,
      events: []
    });
  }

  /**
   * Validate generated HTML
   */
  async validateHTML(html: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    performance: {
      size: number;
      loadTime: number;
      renderTime: number;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic HTML validation
    if (!html.includes('<!DOCTYPE html>')) {
      errors.push('Missing DOCTYPE declaration');
    }

    if (!html.includes('<html')) {
      errors.push('Missing HTML root element');
    }

    if (!html.includes('<head>') || !html.includes('</head>')) {
      errors.push('Missing or malformed head section');
    }

    if (!html.includes('<body>') || !html.includes('</body>')) {
      errors.push('Missing or malformed body section');
    }

    // Check for required components
    const requiredElements = [
      'oc-session-timeline',
      'oc-request-detail',
      'oc-tool-execution'
    ];

    for (const element of requiredElements) {
      if (!html.includes(element)) {
        warnings.push(`Missing component: ${element}`);
      }
    }

    // Performance checks
    const size = new Blob([html]).size;
    if (size > 5 * 1024 * 1024) { // 5MB
      warnings.push(`Large file size: ${(size / 1024 / 1024).toFixed(1)}MB`);
    }

    // Estimate load/render times
    const loadTime = Math.max(size / (1024 * 1024) * 100, 50); // ~100ms per MB, min 50ms
    const renderTime = html.split('<').length * 0.01; // ~0.01ms per element

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        size,
        loadTime,
        renderTime
      }
    };
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Register a custom template
   */
  registerTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  private async loadTemplates(): Promise<void> {
    // Default template
    this.templates.set('default', this.getDefaultTemplate());
    
    // Dashboard template
    this.templates.set('dashboard', this.getDashboardTemplate());
    
    // Minimal template (for embedding)
    this.templates.set('minimal', this.getMinimalTemplate());
    
    // Debug template (with additional debugging info)
    this.templates.set('debug', this.getDebugTemplate());
  }

  private async renderTemplate(templateName: string, context: TemplateContext): Promise<string> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Simple template engine - replace {{variable}} patterns
    let html = template;
    
    // Replace all context variables
    html = html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      return value !== undefined ? String(value) : match;
    });

    // Replace conditional blocks {{#if condition}}...{{/if}}
    html = html.replace(/\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, path, content) => {
      const value = this.getNestedValue(context, path);
      return value ? content : '';
    });

    // Replace loops {{#each array}}...{{/each}}
    html = html.replace(/\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, path, content) => {
      const array = this.getNestedValue(context, path);
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        let itemContent = content;
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        return itemContent;
      }).join('');
    });

    return html;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private getDefaultComponents(): string[] {
    return [
      'base-component',
      'session-timeline', 
      'request-detail',
      'tool-execution',
      'search-filter',
      'collapsible-section'
    ];
  }

  private generateTitle(sessionData: SessionData | null): string {
    if (!sessionData) return 'OpenCode Trace Viewer';
    
    const date = new Date(sessionData.startTime).toLocaleDateString();
    const time = new Date(sessionData.startTime).toLocaleTimeString();
    return `Session ${sessionData.id} - ${date} ${time}`;
  }

  private generateDescription(sessionData: SessionData | null): string {
    if (!sessionData) return 'Interactive trace viewer for OpenCode sessions';
    
    return `Trace session with ${sessionData.eventCount} events, duration: ${this.formatDuration(sessionData.duration)}`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  private getVersion(): string {
    return '1.0.0'; // Would be loaded from package.json in real implementation
  }

  private getDefaultTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en" data-theme="{{options.theme}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{{description}}">
  <title>{{title}}</title>
  <style>
    {{componentCSS}}
  </style>
</head>
<body>
  <div id="app">
    <header class="trace-header">
      <h1>{{title}}</h1>
      <div class="trace-metadata">
        <span>Generated: {{metadata.generatedAt}}</span>
        <span>Events: {{metadata.eventCount}}</span>
        <span>Session: {{metadata.sessionId}}</span>
      </div>
    </header>

    <main class="trace-main">
      {{#if options.showSearch}}
      <oc-search-filter id="search"></oc-search-filter>
      {{/if}}

      {{#if options.showTimeline}}
      <oc-session-timeline id="timeline"></oc-session-timeline>
      {{/if}}

      <div class="trace-content">
        <div class="trace-details">
          <oc-request-detail id="request-detail"></oc-request-detail>
          {{#if options.showTools}}
          <oc-tool-execution id="tool-execution"></oc-tool-execution>
          {{/if}}
        </div>

        {{#if options.showMetrics}}
        <aside class="trace-metrics">
          <div id="metrics-dashboard"></div>
        </aside>
        {{/if}}
      </div>
    </main>
  </div>

  <script>
    // Embedded data
    window.__TRACE_DATA__ = {{embeddedData}};
    
    // Component initialization
    {{componentJS}}
    
    // Initialize application
    document.addEventListener('DOMContentLoaded', () => {
      const app = new TraceViewerApp(window.__TRACE_DATA__);
      app.mount('#app');
    });
  </script>
</body>
</html>`;
  }

  private getDashboardTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en" data-theme="{{options.theme}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    {{componentCSS}}
  </style>
</head>
<body>
  <div id="dashboard">
    <oc-session-browser></oc-session-browser>
  </div>

  <script>
    window.__DASHBOARD_DATA__ = {{embeddedData}};
    {{componentJS}}
    
    document.addEventListener('DOMContentLoaded', () => {
      const dashboard = new TraceDashboardApp(window.__DASHBOARD_DATA__);
      dashboard.mount('#dashboard');
    });
  </script>
</body>
</html>`;
  }

  private getMinimalTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>{{componentCSS}}</style>
</head>
<body>
  <oc-session-timeline></oc-session-timeline>
  <script>
    window.__TRACE_DATA__ = {{embeddedData}};
    {{componentJS}}
  </script>
</body>
</html>`;
  }

  private getDebugTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en" data-theme="{{options.theme}}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} [DEBUG]</title>
  <style>
    {{componentCSS}}
    .debug-info { 
      position: fixed; 
      top: 10px; 
      right: 10px; 
      background: #000; 
      color: #fff; 
      padding: 10px; 
      font-family: monospace; 
      font-size: 12px;
      z-index: 10000;
    }
  </style>
</head>
<body>
  <div class="debug-info">
    <div>File Size: {{metadata.fileSize}} bytes</div>
    <div>Components: {{metadata.componentCount}}</div>
    <div>Assets: {{metadata.assetCount}}</div>
    <div>Processing: {{metadata.processingTime}}ms</div>
  </div>
  
  <div id="app">
    <oc-session-timeline></oc-session-timeline>
    <oc-request-detail></oc-request-detail>
    <oc-tool-execution></oc-tool-execution>
  </div>

  <script>
    console.log('Debug metadata:', {{metadata}});
    window.__TRACE_DATA__ = {{embeddedData}};
    {{componentJS}}
  </script>
</body>
</html>`;
  }
}

/**
 * Factory function for creating HTML generators with common configurations
 */
export const HTMLGeneratorFactory = {
  /**
   * Create generator optimized for production use
   */
  production(): HTMLGenerator {
    return new HTMLGenerator();
  },

  /**
   * Create generator optimized for development/debugging
   */
  development(): HTMLGenerator {
    const generator = new HTMLGenerator();
    // Could add development-specific configurations here
    return generator;
  },

  /**
   * Create generator for embedded use (minimal output)
   */
  embedded(): HTMLGenerator {
    const generator = new HTMLGenerator();
    // Could add embedded-specific configurations here
    return generator;
  }
};