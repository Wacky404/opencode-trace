/**
 * UI Type Definitions for opencode-trace viewer
 * Comprehensive types for all UI components and interactions
 */

import type { LitElement, TemplateResult } from 'lit';

// ================================================
// Base Component Types
// ================================================

/**
 * Base properties that all components can accept
 */
export interface BaseComponentProps {
  loading?: boolean;
  disabled?: boolean;
  theme?: 'dark' | 'light';
  size?: 'small' | 'medium' | 'large';
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

/**
 * Component event detail types
 */
export interface ComponentEventDetail<T = any> {
  value: T;
  source: string;
  timestamp: number;
}

/**
 * Generic component event
 */
export type ComponentEvent<T = any> = CustomEvent<ComponentEventDetail<T>>;

/**
 * Viewport size breakpoints
 */
export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

// ================================================
// Theme and Styling Types
// ================================================

/**
 * VS Code theme color variants
 */
export type ThemeColor = 
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'muted'
  | 'subtle';

/**
 * Component size variants
 */
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

/**
 * Animation timing variants
 */
export type AnimationTiming = 'fast' | 'normal' | 'slow';

/**
 * Border radius variants
 */
export type BorderRadius = 'sm' | 'md' | 'lg' | 'xl' | 'full';

// ================================================
// Layout Component Types
// ================================================

/**
 * Main application state
 */
export interface AppState {
  currentView: ViewType;
  sessions: SessionSummary[];
  selectedSession?: string;
  searchQuery: string;
  filters: FilterState;
  loading: boolean;
  error?: string;
}

/**
 * Available view types in the application
 */
export type ViewType = 'sessions' | 'network' | 'debug' | 'settings';

/**
 * Tab configuration for navigation
 */
export interface TabConfig {
  id: ViewType;
  label: string;
  count?: number;
  icon?: string;
  disabled?: boolean;
}

/**
 * Sidebar configuration
 */
export interface SidebarConfig {
  collapsed?: boolean;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
}

// ================================================
// Session and Data Types
// ================================================

/**
 * Session summary for display in lists
 */
export interface SessionSummary {
  id: string;
  query: string;
  timestamp: number;
  duration: number;
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  status: SessionStatus;
  providers: string[];
  tools: string[];
  hasErrors: boolean;
}

/**
 * Session status variants
 */
export type SessionStatus = 'active' | 'completed' | 'error' | 'cancelled';

/**
 * Detailed session data for viewer
 */
export interface SessionData {
  summary: SessionSummary;
  events: TraceEvent[];
  metrics: SessionMetrics;
  timeline: TimelineItem[];
  requests: RequestSummary[];
  tools: ToolExecution[];
}

/**
 * Session performance metrics
 */
export interface SessionMetrics {
  totalDuration: number;
  averageRequestTime: number;
  requestsPerSecond: number;
  totalBytes: number;
  errorRate: number;
  costBreakdown: CostBreakdown;
  tokenUsage: TokenUsage;
}

/**
 * Cost breakdown by provider/model
 */
export interface CostBreakdown {
  total: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  currency: string;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  total: number;
  input: number;
  output: number;
  byModel: Record<string, { input: number; output: number }>;
}

// ================================================
// Timeline Component Types
// ================================================

/**
 * Timeline item for display
 */
export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  timestamp: number;
  duration?: number;
  title: string;
  description?: string;
  status: 'success' | 'error' | 'warning' | 'info';
  data: any;
  children?: TimelineItem[];
}

/**
 * Timeline item types
 */
export type TimelineItemType = 
  | 'session_start'
  | 'session_end'
  | 'ai_request'
  | 'tool_execution'
  | 'file_operation'
  | 'bash_command'
  | 'websocket_message'
  | 'error'
  | 'custom';

/**
 * Timeline configuration
 */
export interface TimelineConfig {
  showDuration?: boolean;
  showChildren?: boolean;
  collapsible?: boolean;
  maxItems?: number;
  grouping?: 'none' | 'by-type' | 'by-time';
  sortOrder?: 'asc' | 'desc';
}

// ================================================
// Request Detail Component Types
// ================================================

/**
 * HTTP request summary
 */
export interface RequestSummary {
  id: string;
  method: string;
  url: string;
  timestamp: number;
  duration: number;
  status: number;
  statusText: string;
  provider: string;
  model?: string;
  cost?: number;
  tokens?: { input: number; output: number };
  size: { request: number; response: number };
  headers: Record<string, string>;
  hasBody: boolean;
}

/**
 * Detailed request data
 */
export interface RequestDetail extends RequestSummary {
  requestBody?: any;
  responseBody?: any;
  timing: RequestTiming;
  error?: string;
}

/**
 * Request timing breakdown
 */
export interface RequestTiming {
  dns?: number;
  connect?: number;
  tls?: number;
  send: number;
  wait: number;
  receive: number;
  total: number;
}

// ================================================
// Tool Execution Component Types
// ================================================

/**
 * Tool execution summary
 */
export interface ToolExecution {
  id: string;
  name: string;
  timestamp: number;
  duration: number;
  status: 'success' | 'error' | 'running';
  parameters?: Record<string, any>;
  result?: any;
  error?: string;
  operations: ToolOperation[];
}

/**
 * Individual tool operation
 */
export interface ToolOperation {
  id: string;
  type: 'file' | 'bash' | 'network' | 'custom';
  timestamp: number;
  duration: number;
  status: 'success' | 'error';
  details: any;
  diff?: DiffData;
}

/**
 * Diff data for file operations
 */
export interface DiffData {
  type: 'unified' | 'split';
  additions: number;
  deletions: number;
  changes: DiffChange[];
}

/**
 * Individual diff change
 */
export interface DiffChange {
  type: 'add' | 'remove' | 'modify' | 'context';
  lineNumber: number;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// ================================================
// Search and Filter Types
// ================================================

/**
 * Filter state for sessions and events
 */
export interface FilterState {
  providers: string[];
  models: string[];
  status: SessionStatus[];
  dateRange: DateRange;
  costRange: NumberRange;
  durationRange: NumberRange;
  hasErrors: boolean | null;
  eventTypes: string[];
}

/**
 * Date range filter
 */
export interface DateRange {
  start?: Date;
  end?: Date;
}

/**
 * Number range filter
 */
export interface NumberRange {
  min?: number;
  max?: number;
}

/**
 * Search configuration
 */
export interface SearchConfig {
  placeholder?: string;
  debounceMs?: number;
  minLength?: number;
  caseSensitive?: boolean;
  regex?: boolean;
  fields?: string[];
}

/**
 * Search result
 */
export interface SearchResult<T = any> {
  item: T;
  matches: SearchMatch[];
  score: number;
}

/**
 * Search match detail
 */
export interface SearchMatch {
  field: string;
  value: string;
  indices: [number, number][];
}

// ================================================
// Code Display Types
// ================================================

/**
 * Syntax highlighting configuration
 */
export interface SyntaxHighlightConfig {
  language: string;
  theme?: 'vs-dark' | 'vs-light';
  showLineNumbers?: boolean;
  lineNumberStart?: number;
  highlightLines?: number[];
  maxLines?: number;
  wrapLines?: boolean;
}

/**
 * Code block data
 */
export interface CodeBlock {
  content: string;
  language: string;
  filename?: string;
  title?: string;
  size: number;
  lineCount: number;
}

// ================================================
// Modal and Dialog Types
// ================================================

/**
 * Modal configuration
 */
export interface ModalConfig {
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  backdrop?: boolean;
  keyboard?: boolean;
  persistent?: boolean;
}

/**
 * Dialog button configuration
 */
export interface DialogButton {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger';
  action: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Toast notification configuration
 */
export interface ToastConfig {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  actions?: ToastAction[];
}

/**
 * Toast action button
 */
export interface ToastAction {
  text: string;
  action: () => void;
  style?: 'link' | 'button';
}

// ================================================
// Data Processing Types
// ================================================

/**
 * Data processing status
 */
export interface ProcessingStatus {
  stage: ProcessingStage;
  progress: number;
  total: number;
  message: string;
  error?: string;
}

/**
 * Processing stages
 */
export type ProcessingStage = 
  | 'loading'
  | 'parsing'
  | 'validating'
  | 'correlating'
  | 'transforming'
  | 'rendering'
  | 'complete'
  | 'error';

/**
 * Data export configuration
 */
export interface ExportConfig {
  format: 'json' | 'csv' | 'html' | 'pdf';
  filename?: string;
  includeMetadata?: boolean;
  includeTimeline?: boolean;
  includeRequests?: boolean;
  includeTools?: boolean;
  dateRange?: DateRange;
  filters?: Partial<FilterState>;
}

// ================================================
// Accessibility Types
// ================================================

/**
 * ARIA role types for components
 */
export type AriaRole = 
  | 'button'
  | 'link'
  | 'tab'
  | 'tabpanel'
  | 'dialog'
  | 'alertdialog'
  | 'alert'
  | 'status'
  | 'progressbar'
  | 'menu'
  | 'menuitem'
  | 'listbox'
  | 'option'
  | 'tree'
  | 'treeitem'
  | 'grid'
  | 'gridcell'
  | 'region'
  | 'article'
  | 'main'
  | 'navigation'
  | 'complementary'
  | 'banner'
  | 'contentinfo';

/**
 * Accessibility attributes
 */
export interface A11yAttributes {
  role?: AriaRole;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean;
  'aria-pressed'?: boolean;
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-haspopup'?: boolean | 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-level'?: number;
  'aria-setsize'?: number;
  'aria-posinset'?: number;
  tabindex?: number;
}

// ================================================
// Event Types (reexport from tracer)
// ================================================

/**
 * Base trace event (from tracer package)
 */
export interface TraceEvent {
  type: string;
  timestamp: number;
  session_id: string;
  [key: string]: any;
}

// ================================================
// Component Reference Types
// ================================================

/**
 * Base component reference for parent components
 */
export interface ComponentRef<T extends LitElement = LitElement> {
  element: T;
  focus(): void;
  blur(): void;
  scrollIntoView(options?: ScrollIntoViewOptions): void;
}

/**
 * Virtualized list configuration
 */
export interface VirtualListConfig {
  itemHeight: number | ((index: number) => number);
  overscan?: number;
  scrollToIndex?: number;
  scrollToAlignment?: 'start' | 'center' | 'end' | 'auto';
}

/**
 * Performance monitoring for components
 */
export interface ComponentPerformance {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  memoryUsage?: number;
}

// ================================================
// Utility Types
// ================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract event handler function type
 */
export type EventHandler<T = Event> = (event: T) => void | Promise<void>;

/**
 * Render function type for templates
 */
export type RenderFunction<T = any> = (data: T, index?: number) => TemplateResult;

/**
 * Validator function type
 */
export type ValidatorFunction<T = any> = (value: T) => boolean | string;

/**
 * Formatter function type
 */
export type FormatterFunction<T = any, R = string> = (value: T) => R;

/**
 * Comparator function type for sorting
 */
export type ComparatorFunction<T = any> = (a: T, b: T) => number;