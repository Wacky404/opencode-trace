import type { SessionData, TraceEvent, MetricsReport } from './trace.js';

/**
 * HTML Generation Options
 */
export interface HTMLGenerationOptions {
  // Data
  sessionData: SessionData | null;
  events?: TraceEvent[];
  metrics?: MetricsReport | null;

  // Template and styling
  template?: string;
  title?: string;
  description?: string;
  theme?: 'vs-dark' | 'vs-light' | 'high-contrast';

  // Components to include
  components?: string[];
  showTimeline?: boolean;
  showMetrics?: boolean;
  showTools?: boolean;
  enableSearch?: boolean;

  // Asset handling
  includeFonts?: boolean;
  includeImages?: boolean;
  embedAssets?: boolean;

  // Optimization
  optimize?: boolean;
  minify?: boolean;
  compress?: boolean;
  sanitize?: boolean;
  includeSourceMaps?: boolean;

  // Output options
  standalone?: boolean;
  crossBrowser?: boolean;
}

/**
 * Generated HTML result
 */
export interface GeneratedHTML {
  html: string;
  metadata: HTMLMetadata;
  assets: {
    components: ComponentManifest;
    inlined: AssetManifest;
  };
  warnings: string[];
}

/**
 * HTML generation metadata
 */
export interface HTMLMetadata {
  generatedAt: string;
  version: string;
  sessionId: string;
  eventCount: number;
  fileSize: number;
  processingTime: number;
  componentCount: number;
  assetCount: number;
  compressionRatio?: number;
  compressed: boolean;
}

/**
 * Template context for rendering
 */
export interface TemplateContext {
  title: string;
  description: string;
  componentJS: string;
  componentCSS: string;
  embeddedData: string;
  metadata: HTMLMetadata;
  options: {
    theme: string;
    showMetrics: boolean;
    showTimeline: boolean;
    showTools: boolean;
    enableSearch: boolean;
  };
}

/**
 * Component bundle result
 */
export interface ComponentBundle {
  javascript: string;
  styles: string;
  componentCount: number;
  manifest: ComponentManifest;
  warnings: string[];
  sourceMap?: string;
}

/**
 * Component manifest
 */
export interface ComponentManifest {
  components: Array<{
    name: string;
    size: number;
    dependencies: string[];
    version: string;
  }>;
  totalSize: number;
  treeShakenSize: number;
  compressionRatio: number;
}

/**
 * Asset inlining result
 */
export interface InlinedAssets {
  css: string;
  fonts: string[];
  images: Array<{ name: string; data: string; type: string }>;
  assetCount: number;
  manifest: AssetManifest;
  warnings: string[];
}

/**
 * Asset manifest
 */
export interface AssetManifest {
  assets: Array<{
    type: 'css' | 'font' | 'image' | 'other';
    name: string;
    size: number;
    inlined: boolean;
    optimized: boolean;
  }>;
  totalSize: number;
  inlinedSize: number;
  optimizationRatio: number;
}

/**
 * Data embedding result
 */
export interface EmbeddedData {
  data: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: 'json' | 'jsonl' | 'compressed';
  warnings: string[];
}

/**
 * Component bundling options
 */
export interface ComponentBundlingOptions {
  components: string[];
  optimize: boolean;
  minify: boolean;
  includeSourceMaps: boolean;
  treeshake?: boolean;
  externals?: string[];
}

/**
 * Asset inlining options
 */
export interface AssetInliningOptions {
  css: string;
  fonts: boolean;
  images: boolean;
  optimize?: boolean;
  maxSize?: number; // Maximum size for inlining (in bytes)
}

/**
 * Data embedding options
 */
export interface DataEmbeddingOptions {
  sessionData?: SessionData | null;
  sessions?: SessionData[];
  events?: TraceEvent[];
  metrics?: MetricsReport | null;
  compress: boolean;
  sanitize: boolean;
  format?: 'json' | 'jsonl';
}

/**
 * Template rendering context
 */
export interface TemplateRenderingContext {
  data: any;
  helpers: Record<string, Function>;
  partials: Record<string, string>;
}

/**
 * HTML validation result
 */
export interface HTMLValidationResult {
  valid: boolean;
  errors: Array<{
    code: string;
    message: string;
    line?: number;
    column?: number;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    line?: number;
    column?: number;
  }>;
  performance: {
    size: number;
    estimatedLoadTime: number;
    estimatedRenderTime: number;
    complexityScore: number;
  };
  accessibility: {
    score: number;
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      rule: string;
      message: string;
      element?: string;
    }>;
  };
  compatibility: {
    browsers: Array<{
      name: string;
      version: string;
      supported: boolean;
      issues?: string[];
    }>;
  };
}

/**
 * Cross-browser compatibility options
 */
export interface CrossBrowserOptions {
  targets: string[]; // Browser targets (e.g., ['chrome >= 80', 'firefox >= 75'])
  polyfills: boolean;
  fallbacks: boolean;
  vendorPrefixes: boolean;
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  minifyHTML: boolean;
  minifyCSS: boolean;
  minifyJS: boolean;
  compressImages: boolean;
  optimizeFonts: boolean;
  removeUnusedCSS: boolean;
  inlineCritical: boolean;
  lazyLoad: boolean;
}

/**
 * Security options
 */
export interface SecurityOptions {
  sanitizeData: boolean;
  removeScripts: boolean;
  removeComments: boolean;
  csp?: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
  integrity?: {
    enabled: boolean;
    algorithm: 'sha256' | 'sha384' | 'sha512';
  };
}

/**
 * Template engine interface
 */
export interface TemplateEngine {
  render(template: string, context: TemplateRenderingContext): Promise<string>;
  registerHelper(name: string, helper: Function): void;
  registerPartial(name: string, partial: string): void;
  compile(template: string): CompiledTemplate;
}

/**
 * Compiled template
 */
export interface CompiledTemplate {
  render(context: TemplateRenderingContext): string;
  dependencies: string[];
  metadata: {
    variables: string[];
    helpers: string[];
    partials: string[];
  };
}

/**
 * Build pipeline options
 */
export interface BuildPipelineOptions {
  input: {
    components: string[];
    templates: string[];
    assets: string[];
  };
  output: {
    format: 'single' | 'chunked';
    directory?: string;
    filename?: string;
  };
  optimization: OptimizationOptions;
  security: SecurityOptions;
  compatibility: CrossBrowserOptions;
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  name: string;
  displayName: string;
  type: 'dark' | 'light' | 'high-contrast';
  colors: Record<string, string>;
  fonts: {
    ui: string;
    mono: string;
    sizes: Record<string, string>;
  };
  spacing: Record<string, string>;
  breakpoints: Record<string, string>;
  animations: {
    enabled: boolean;
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
}

/**
 * Analytics configuration for HTML generation
 */
export interface AnalyticsConfig {
  enabled: boolean;
  provider?: 'google' | 'plausible' | 'custom';
  trackingId?: string;
  events: {
    pageView: boolean;
    interactions: boolean;
    performance: boolean;
    errors: boolean;
  };
  privacy: {
    anonymizeIp: boolean;
    respectDnt: boolean;
    cookieConsent: boolean;
  };
}