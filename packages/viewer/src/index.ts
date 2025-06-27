/**
 * opencode-trace viewer components
 * Beautiful HTML viewer for trace data with VS Code theming
 */

// Version
export const VERSION = '0.1.0';

// Base Components
export { BaseComponent } from './components/base/base-component.js';
export * from './components/base/component-utils.js';

// Session View Components (Phase 3.2)
export { SessionTimeline } from './components/session/session-timeline.js';
export { RequestDetailComponent } from './components/session/request-detail.js';
export { ToolExecutionComponent } from './components/session/tool-execution.js';

// Common Utility Components
export { SearchFilterComponent } from './components/common/search-filter.js';
export { CollapsibleSection } from './components/common/collapsible-section.js';

// Test Component (for Phase 3.1 verification) - temporarily disabled for build
// export { TestComponent } from './components/test-component.js';

// Data Processing Pipeline (Phase 3.3)
export { JSONLProcessor, JSONLUtils } from './processors/jsonl-processor.js';
export { EventCorrelator, CorrelationUtils } from './processors/event-correlator.js';
export { MetricsCalculator, MetricsUtils } from './processors/metrics-calculator.js';

// HTML Generation & Integration (Phase 4.1)
export { HTMLGenerator, HTMLGeneratorFactory } from './generators/html-generator.js';
export { ComponentBundler } from './generators/component-bundler.js';
export { AssetInliner, AssetUtils } from './generators/asset-inliner.js';
export { DataEmbedder, DataEmbeddingUtils } from './generators/data-embedder.js';

// Session Browser Dashboard (Phase 4.2)
export { SessionBrowser } from './components/session-browser.js';
export { SessionList } from './components/session-list.js';
export { SessionStats } from './components/session-stats.js';
export { DashboardLayout } from './components/dashboard-layout.js';
export { SessionComparison } from './components/session-comparison.js';

// Types
export type * from './types/ui.js';
export type * from './types/data.js';
// HTML types contain references to trace types which creates conflicts
// export type * from './types/html.js';
// Trace types are imported by processors but not re-exported to avoid conflicts

// Utilities
export * from './utils/accessibility.js';

// Styles (CSS imports - these will be bundled)
import './styles/vs-code-theme.css';
import './styles/components.css';

console.log(`opencode-trace viewer v${VERSION} loaded with VS Code theming`);