import type { 
  ComponentBundle, 
  ComponentBundlingOptions, 
  ComponentManifest 
} from '../types/html.js';

/**
 * Component bundler for packaging Lit components with optimization
 * Handles tree-shaking, minification, and dependency resolution
 */
export class ComponentBundler {
  private componentRegistry = new Map<string, ComponentDefinition>();
  private dependencyGraph = new Map<string, string[]>();
  private componentSources = new Map<string, string>();

  constructor() {
    this.initializeComponentRegistry();
  }

  /**
   * Bundle components into a single JavaScript bundle
   */
  async bundleComponents(options: ComponentBundlingOptions): Promise<ComponentBundle> {
    const startTime = performance.now();
    const warnings: string[] = [];

    try {
      // Resolve component dependencies
      const resolvedComponents = this.resolveComponentDependencies(options.components);
      
      // Load component sources
      const sources = await this.loadComponentSources(resolvedComponents);
      
      // Process components (tree-shake, optimize)
      const processed = await this.processComponents(sources, {
        optimize: options.optimize,
        treeshake: options.treeshake !== false,
        externals: options.externals || []
      });

      // Bundle JavaScript
      const javascript = await this.bundleJavaScript(processed, {
        minify: options.minify,
        includeSourceMaps: options.includeSourceMaps
      });

      // Bundle CSS
      const styles = await this.bundleStyles(processed, {
        minify: options.minify
      });

      // Create manifest
      const manifest = this.createManifest(resolvedComponents, processed);

      const processingTime = performance.now() - startTime;

      return {
        javascript: javascript.code,
        styles: styles.code,
        componentCount: resolvedComponents.length,
        manifest,
        warnings,
        sourceMap: javascript.sourceMap
      };

    } catch (error) {
      throw new Error(`Component bundling failed: ${(error as Error).message}`);
    }
  }

  /**
   * Register a component for bundling
   */
  registerComponent(name: string, definition: ComponentDefinition): void {
    this.componentRegistry.set(name, definition);
    this.dependencyGraph.set(name, definition.dependencies || []);
  }

  /**
   * Get available components
   */
  getAvailableComponents(): string[] {
    return Array.from(this.componentRegistry.keys());
  }

  /**
   * Analyze component dependencies
   */
  analyzeDependencies(componentName: string): ComponentDependencyAnalysis {
    const visited = new Set<string>();
    const dependencies: string[] = [];
    const circularDeps: Array<{ from: string; to: string }> = [];

    const visit = (name: string, path: string[] = []) => {
      if (path.includes(name)) {
        circularDeps.push({ from: path[path.length - 1], to: name });
        return;
      }

      if (visited.has(name)) return;
      visited.add(name);

      const deps = this.dependencyGraph.get(name) || [];
      dependencies.push(...deps);

      for (const dep of deps) {
        visit(dep, [...path, name]);
      }
    };

    visit(componentName);

    return {
      component: componentName,
      dependencies: [...new Set(dependencies)],
      circularDependencies: circularDeps,
      depth: this.calculateDependencyDepth(componentName),
      size: this.estimateComponentSize(componentName)
    };
  }

  private initializeComponentRegistry(): void {
    // Register all available components
    const components: Array<{ name: string; definition: ComponentDefinition }> = [
      {
        name: 'base-component',
        definition: {
          path: './components/base/base-component.js',
          dependencies: [],
          exports: ['BaseComponent'],
          styles: ['./components/base/base-component.css'],
          size: 2048
        }
      },
      {
        name: 'session-timeline',
        definition: {
          path: './components/session/session-timeline.js',
          dependencies: ['base-component', 'collapsible-section'],
          exports: ['SessionTimeline'],
          styles: ['./components/session/session-timeline.css'],
          size: 15360
        }
      },
      {
        name: 'request-detail',
        definition: {
          path: './components/session/request-detail.js',
          dependencies: ['base-component', 'collapsible-section'],
          exports: ['RequestDetailComponent'],
          styles: ['./components/session/request-detail.css'],
          size: 20480
        }
      },
      {
        name: 'tool-execution',
        definition: {
          path: './components/session/tool-execution.js',
          dependencies: ['base-component', 'collapsible-section'],
          exports: ['ToolExecutionComponent'],
          styles: ['./components/session/tool-execution.css'],
          size: 22528
        }
      },
      {
        name: 'search-filter',
        definition: {
          path: './components/common/search-filter.js',
          dependencies: ['base-component'],
          exports: ['SearchFilterComponent'],
          styles: ['./components/common/search-filter.css'],
          size: 25600
        }
      },
      {
        name: 'collapsible-section',
        definition: {
          path: './components/common/collapsible-section.js',
          dependencies: ['base-component'],
          exports: ['CollapsibleSection'],
          styles: ['./components/common/collapsible-section.css'],
          size: 12288
        }
      },
      {
        name: 'session-browser',
        definition: {
          path: './components/dashboard/session-browser.js',
          dependencies: ['base-component', 'session-list', 'session-stats'],
          exports: ['SessionBrowser'],
          styles: ['./components/dashboard/session-browser.css'],
          size: 18432
        }
      },
      {
        name: 'session-list',
        definition: {
          path: './components/dashboard/session-list.js',
          dependencies: ['base-component', 'search-filter'],
          exports: ['SessionList'],
          styles: ['./components/dashboard/session-list.css'],
          size: 16384
        }
      },
      {
        name: 'session-stats',
        definition: {
          path: './components/dashboard/session-stats.js',
          dependencies: ['base-component'],
          exports: ['SessionStats'],
          styles: ['./components/dashboard/session-stats.css'],
          size: 14336
        }
      }
    ];

    for (const { name, definition } of components) {
      this.registerComponent(name, definition);
    }
  }

  private resolveComponentDependencies(requestedComponents: string[]): string[] {
    const resolved = new Set<string>();
    const visited = new Set<string>();

    const resolve = (componentName: string) => {
      if (visited.has(componentName)) return;
      visited.add(componentName);

      const dependencies = this.dependencyGraph.get(componentName) || [];
      for (const dep of dependencies) {
        resolve(dep);
      }

      resolved.add(componentName);
    };

    for (const component of requestedComponents) {
      if (this.componentRegistry.has(component)) {
        resolve(component);
      }
    }

    return Array.from(resolved);
  }

  private async loadComponentSources(components: string[]): Promise<Map<string, string>> {
    const sources = new Map<string, string>();

    for (const componentName of components) {
      const definition = this.componentRegistry.get(componentName);
      if (!definition) continue;

      // In a real implementation, this would load the actual file content
      // For now, we'll generate mock component code
      const source = this.generateComponentSource(componentName, definition);
      sources.set(componentName, source);
    }

    return sources;
  }

  private async processComponents(
    sources: Map<string, string>, 
    options: { optimize: boolean; treeshake: boolean; externals: string[] }
  ): Promise<Map<string, ProcessedComponent>> {
    const processed = new Map<string, ProcessedComponent>();

    for (const [name, source] of sources) {
      let processedSource = source;

      if (options.treeshake) {
        processedSource = this.treeShakeComponent(processedSource);
      }

      if (options.optimize) {
        processedSource = this.optimizeComponent(processedSource);
      }

      const definition = this.componentRegistry.get(name)!;
      processed.set(name, {
        name,
        source: processedSource,
        originalSize: source.length,
        processedSize: processedSource.length,
        definition
      });
    }

    return processed;
  }

  private async bundleJavaScript(
    components: Map<string, ProcessedComponent>, 
    options: { minify: boolean; includeSourceMaps: boolean }
  ): Promise<{ code: string; sourceMap?: string }> {
    const parts: string[] = [];

    // Add Lit imports
    parts.push(`
// Lit framework imports
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
`);

    // Add utility functions
    parts.push(`
// Utility functions
const TraceViewerUtils = {
  formatDuration: (ms) => {
    if (ms < 1000) return \`\${ms}ms\`;
    if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`;
    if (ms < 3600000) return \`\${(ms / 60000).toFixed(1)}m\`;
    return \`\${(ms / 3600000).toFixed(1)}h\`;
  },
  
  formatCost: (cost) => {
    if (cost < 0.01) return \`$\${(cost * 1000).toFixed(2)}‰\`;
    if (cost < 1) return \`$\${cost.toFixed(4)}\`;
    return \`$\${cost.toFixed(2)}\`;
  },
  
  formatBytes: (bytes) => {
    if (bytes < 1024) return \`\${bytes}B\`;
    if (bytes < 1048576) return \`\${(bytes / 1024).toFixed(1)}KB\`;
    return \`\${(bytes / 1048576).toFixed(1)}MB\`;
  }
};

window.TraceViewerUtils = TraceViewerUtils;
`);

    // Add component sources in dependency order
    const sortedComponents = this.topologicalSort(Array.from(components.keys()));
    for (const componentName of sortedComponents) {
      const component = components.get(componentName);
      if (component) {
        parts.push(`\n// Component: ${componentName}\n${component.source}`);
      }
    }

    // Add application bootstrap
    parts.push(`
// Application class
class TraceViewerApp {
  constructor(data) {
    this.data = data;
    this.components = new Map();
  }

  mount(selector) {
    const container = document.querySelector(selector);
    if (!container) return;

    this.initializeComponents(container);
    this.bindEvents();
    this.loadData();
  }

  initializeComponents(container) {
    // Initialize all components with data
    const timeline = container.querySelector('oc-session-timeline');
    if (timeline) {
      timeline.sessionData = this.data.sessionData;
      this.components.set('timeline', timeline);
    }

    const requestDetail = container.querySelector('oc-request-detail');
    if (requestDetail) {
      this.components.set('requestDetail', requestDetail);
    }

    const toolExecution = container.querySelector('oc-tool-execution');
    if (toolExecution) {
      this.components.set('toolExecution', toolExecution);
    }

    const searchFilter = container.querySelector('oc-search-filter');
    if (searchFilter) {
      this.components.set('searchFilter', searchFilter);
    }
  }

  bindEvents() {
    // Bind component events
    const timeline = this.components.get('timeline');
    if (timeline) {
      timeline.addEventListener('event-selected', (e) => {
        this.showEventDetails(e.detail.event);
      });
    }

    const searchFilter = this.components.get('searchFilter');
    if (searchFilter) {
      searchFilter.addEventListener('filter-changed', (e) => {
        this.applyFilters(e.detail.filters);
      });
    }
  }

  showEventDetails(event) {
    const requestDetail = this.components.get('requestDetail');
    const toolExecution = this.components.get('toolExecution');

    if (event.type === 'ai_request' || event.type === 'ai_response') {
      if (requestDetail) {
        requestDetail.event = event;
        requestDetail.style.display = 'block';
      }
      if (toolExecution) {
        toolExecution.style.display = 'none';
      }
    } else if (event.type === 'tool_execution') {
      if (toolExecution) {
        toolExecution.event = event;
        toolExecution.style.display = 'block';
      }
      if (requestDetail) {
        requestDetail.style.display = 'none';
      }
    }
  }

  applyFilters(filters) {
    const timeline = this.components.get('timeline');
    if (timeline) {
      timeline.filters = filters;
    }
  }

  loadData() {
    // Process and load data into components
    if (this.data.events) {
      this.processEvents();
    }
    if (this.data.metrics) {
      this.processMetrics();
    }
  }

  processEvents() {
    // Process events for timeline
    const timeline = this.components.get('timeline');
    if (timeline && this.data.events) {
      timeline.events = this.data.events;
    }
  }

  processMetrics() {
    // Process metrics for display
    const metricsContainer = document.getElementById('metrics-dashboard');
    if (metricsContainer && this.data.metrics) {
      this.renderMetrics(metricsContainer);
    }
  }

  renderMetrics(container) {
    const metrics = this.data.metrics;
    container.innerHTML = \`
      <div class="metrics-summary">
        <div class="metric">
          <label>Total Cost</label>
          <value>\${TraceViewerUtils.formatCost(metrics.cost?.totalCost || 0)}</value>
        </div>
        <div class="metric">
          <label>Avg Response Time</label>
          <value>\${TraceViewerUtils.formatDuration(metrics.performance?.responseTime?.mean || 0)}</value>
        </div>
        <div class="metric">
          <label>Total Requests</label>
          <value>\${metrics.performance?.totalRequests || 0}</value>
        </div>
        <div class="metric">
          <label>Error Rate</label>
          <value>\${((metrics.performance?.errorRate || 0) * 100).toFixed(1)}%</value>
        </div>
      </div>
    \`;
  }
}

// Dashboard application for multi-session view
class TraceDashboardApp {
  constructor(data) {
    this.data = data;
  }

  mount(selector) {
    const container = document.querySelector(selector);
    if (!container) return;

    const sessionBrowser = container.querySelector('oc-session-browser');
    if (sessionBrowser) {
      sessionBrowser.sessions = this.data.sessions || [];
    }
  }
}

window.TraceViewerApp = TraceViewerApp;
window.TraceDashboardApp = TraceDashboardApp;
`);

    let code = parts.join('\n');

    if (options.minify) {
      code = this.minifyJavaScript(code);
    }

    return { code };
  }

  private async bundleStyles(
    components: Map<string, ProcessedComponent>, 
    options: { minify: boolean }
  ): Promise<{ code: string }> {
    const parts: string[] = [];

    // Add base styles
    parts.push(`
/* OpenCode Trace Viewer Styles */

/* CSS Reset and base styles */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--vscode-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
  background: var(--vscode-editor-background, #1e1e1e);
  color: var(--vscode-editor-foreground, #d4d4d4);
}

/* Application layout */
.trace-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--vscode-panel-border, #2d2d30);
  background: var(--vscode-panel-background, #252526);
}

.trace-header h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.trace-metadata {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  opacity: 0.8;
}

.trace-main {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
}

.trace-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.trace-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.trace-metrics {
  width: 300px;
  border-left: 1px solid var(--vscode-panel-border, #2d2d30);
  background: var(--vscode-sidebar-background, #252526);
  padding: 1rem;
  overflow-y: auto;
}

.metrics-summary {
  display: grid;
  gap: 1rem;
}

.metric {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  background: var(--vscode-input-background, #3c3c3c);
  border-radius: 4px;
  border: 1px solid var(--vscode-input-border, #3c3c3c);
}

.metric label {
  font-size: 0.75rem;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
}

.metric value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--vscode-charts-blue, #007acc);
}

/* Responsive design */
@media (max-width: 768px) {
  .trace-content {
    flex-direction: column;
  }
  
  .trace-metrics {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--vscode-panel-border, #2d2d30);
    max-height: 200px;
  }
  
  .trace-header {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
  
  .trace-metadata {
    justify-content: center;
  }
}
`);

    // Add component styles
    for (const [name, component] of components) {
      if (component.definition.styles) {
        for (const stylePath of component.definition.styles) {
          const styles = this.generateComponentStyles(name);
          parts.push(`\n/* ${name} styles */\n${styles}`);
        }
      }
    }

    let code = parts.join('\n');

    if (options.minify) {
      code = this.minifyCSS(code);
    }

    return { code };
  }

  private generateComponentSource(name: string, definition: ComponentDefinition): string {
    // Generate mock component source - in real implementation, would load from files
    const className = this.toPascalCase(name);
    const tagName = `oc-${name.replace(/_/g, '-')}`;

    return `
@customElement('${tagName}')
export class ${className} extends BaseComponent {
  static styles = [
    BaseComponent.styles,
    css\`
      :host {
        display: block;
        position: relative;
      }
    \`
  ];

  render() {
    return html\`
      <div class="${name}-container">
        <slot></slot>
      </div>
    \`;
  }
}

// Export for bundling
window.customElements.define('${tagName}', ${className});
`;
  }

  private generateComponentStyles(name: string): string {
    // Generate mock styles - in real implementation, would load from files
    return `
.${name}-container {
  padding: 1rem;
  border: 1px solid var(--vscode-panel-border, #2d2d30);
  border-radius: 4px;
  background: var(--vscode-editor-background, #1e1e1e);
}

.${name}-container:focus-within {
  border-color: var(--vscode-focusBorder, #007fd4);
}
`;
  }

  private treeShakeComponent(source: string): string {
    // Simple tree-shaking simulation - remove unused imports and functions
    return source;
  }

  private optimizeComponent(source: string): string {
    // Simple optimization - remove comments and extra whitespace
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private minifyJavaScript(code: string): string {
    // Simple minification - in real implementation would use proper minifier
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/;\s*}/g, '}')
      .replace(/{\s*/g, '{')
      .replace(/}\s*/g, '}')
      .trim();
  }

  private minifyCSS(code: string): string {
    // Simple CSS minification
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/;\s*}/g, '}')
      .replace(/{\s*/g, '{')
      .replace(/}\s*/g, '}')
      .replace(/:\s*/g, ':')
      .replace(/;\s*/g, ';')
      .trim();
  }

  private createManifest(components: string[], processed: Map<string, ProcessedComponent>): ComponentManifest {
    const manifestComponents = components.map(name => {
      const component = processed.get(name);
      const definition = this.componentRegistry.get(name);
      
      return {
        name,
        size: component?.processedSize || 0,
        dependencies: definition?.dependencies || [],
        version: '1.0.0'
      };
    });

    const totalSize = manifestComponents.reduce((sum, comp) => sum + comp.size, 0);
    const originalSize = Array.from(processed.values()).reduce((sum, comp) => sum + comp.originalSize, 0);

    return {
      components: manifestComponents,
      totalSize,
      treeShakenSize: totalSize,
      compressionRatio: originalSize > 0 ? totalSize / originalSize : 1
    };
  }

  private topologicalSort(components: string[]): string[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const result: string[] = [];

    const visit = (name: string) => {
      if (temp.has(name)) {
        throw new Error(`Circular dependency detected involving ${name}`);
      }
      if (visited.has(name)) return;

      temp.add(name);
      const deps = this.dependencyGraph.get(name) || [];
      for (const dep of deps) {
        if (components.includes(dep)) {
          visit(dep);
        }
      }
      temp.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const component of components) {
      visit(component);
    }

    return result;
  }

  private calculateDependencyDepth(componentName: string): number {
    const visited = new Set<string>();
    
    const getDepth = (name: string): number => {
      if (visited.has(name)) return 0;
      visited.add(name);

      const deps = this.dependencyGraph.get(name) || [];
      if (deps.length === 0) return 0;

      return 1 + Math.max(...deps.map(dep => getDepth(dep)));
    };

    return getDepth(componentName);
  }

  private estimateComponentSize(componentName: string): number {
    const definition = this.componentRegistry.get(componentName);
    return definition?.size || 0;
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

/**
 * Component definition interface
 */
interface ComponentDefinition {
  path: string;
  dependencies: string[];
  exports: string[];
  styles: string[];
  size: number;
}

/**
 * Processed component interface
 */
interface ProcessedComponent {
  name: string;
  source: string;
  originalSize: number;
  processedSize: number;
  definition: ComponentDefinition;
}

/**
 * Component dependency analysis result
 */
interface ComponentDependencyAnalysis {
  component: string;
  dependencies: string[];
  circularDependencies: Array<{ from: string; to: string }>;
  depth: number;
  size: number;
}