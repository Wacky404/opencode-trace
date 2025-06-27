/**
 * Trace Data Types for opencode-trace viewer
 * Types for processing JSONL trace files and metrics calculation
 */

// ================================================
// Raw Trace Event Types (from JSONL)
// ================================================

/**
 * Base structure for raw trace events from JSONL files
 */
export interface RawTraceEvent {
  id: string;
  type: 'ai_request' | 'ai_response' | 'tool_execution' | 'error' | string;
  timestamp: number;
  session_id?: string;
  parent_id?: string;
  metadata?: Record<string, any>;
  
  // AI Request fields
  provider?: string;
  model?: string;
  request?: any;
  config?: any;
  
  // AI Response fields
  response?: any;
  usage?: TokenUsage;
  cost?: number;
  duration?: number;
  
  // Tool execution fields
  tool_name?: string;
  parameters?: any;
  result?: any;
  status?: 'running' | 'success' | 'error';
  
  // Error fields
  error?: any;
  stack?: string;
  context?: any;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

// ================================================
// Processed Event Types
// ================================================

/**
 * Base processed event structure
 */
interface BaseTraceEvent {
  id: string;
  type: string;
  timestamp: number;
  sessionId?: string;
  parentId?: string;
  metadata: Record<string, any>;
}

/**
 * AI Request event
 */
export interface AIRequestEvent extends BaseTraceEvent {
  type: 'ai_request';
  provider: string;
  model?: string;
  request: any;
  config?: any;
}

/**
 * AI Response event
 */
export interface AIResponseEvent extends BaseTraceEvent {
  type: 'ai_response';
  response: any;
  usage?: TokenUsage;
  cost?: number;
  duration?: number;
}

/**
 * Tool execution event
 */
export interface ToolExecutionEvent extends BaseTraceEvent {
  type: 'tool_execution';
  toolName: string;
  parameters?: any;
  result?: any;
  status: 'running' | 'success' | 'error';
  duration?: number;
  error?: any;
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseTraceEvent {
  type: 'error';
  error: any;
  stack?: string;
  context?: any;
}

/**
 * Custom event (fallback)
 */
export interface CustomEvent extends BaseTraceEvent {
  type: 'custom';
  data: any;
}

/**
 * Union type for all processed events
 */
export type TraceEvent = AIRequestEvent | AIResponseEvent | ToolExecutionEvent | ErrorEvent | CustomEvent;

// ================================================
// Session and Timeline Types
// ================================================

/**
 * Timeline item for visualization
 */
export interface TimelineItem {
  id: string;
  type: string;
  timestamp: number;
  title: string;
  description?: string;
  status: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  children?: TimelineItem[];
  data?: Record<string, any>;
  metadata: Record<string, any>;
}

/**
 * Session data container
 */
export interface SessionData {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  eventCount: number;
  status: 'active' | 'completed' | 'error' | 'cancelled';
  events: TraceEvent[];
  timeline: TimelineItem[];
  summary: string;
}

/**
 * Event relationship
 */
export interface EventRelationship {
  sourceId: string;
  targetId: string;
  type: 'parent' | 'response_to_request' | 'tool_for_request' | 'error_in_context' | 'temporal';
  strength: number; // 0-1 confidence score
}

/**
 * Request-response pair
 */
export interface RequestResponsePair {
  requestId: string;
  responseId: string;
  sessionId: string;
  timestamp: number;
  duration: number;
  provider: string;
  model?: string;
  cost?: number;
  tokens?: TokenUsage;
}

/**
 * Tool execution flow
 */
export interface ToolExecutionFlow {
  toolExecutionId: string;
  requestId?: string;
  sessionId: string;
  toolName: string;
  timestamp: number;
  duration: number;
  status: string;
  hasError: boolean;
}

// ================================================
// Processing and Validation Types
// ================================================

/**
 * Parse options for JSONL processor
 */
export interface ParseOptions {
  strict?: boolean;
  maxErrors?: number;
  skipInvalidLines?: boolean;
  validateSchema?: boolean;
  encoding?: string;
  bufferSize?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  events: TraceEvent[];
  metadata: TraceMetadata;
  errors: ErrorDetails[];
}

/**
 * Trace metadata
 */
export interface TraceMetadata {
  totalLines: number;
  validLines: number;
  invalidLines: number;
  totalBytes: number;
  processingTime: number;
  firstEventTime: number | null;
  lastEventTime: number | null;
}

/**
 * Error details
 */
export interface ErrorDetails {
  code: string;
  message: string;
  line?: number;
  context?: any;
  timestamp: number;
}

/**
 * Correlation result
 */
export interface CorrelationResult {
  sessions: SessionData[];
  relationships: EventRelationship[];
  requestResponsePairs: RequestResponsePair[];
  toolExecutionFlows: ToolExecutionFlow[];
  totalEvents: number;
  totalSessions: number;
}

// ================================================
// Metrics and Analytics Types
// ================================================

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  responseTime: {
    mean: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    stdDev: number;
  };
  toolExecution: {
    mean: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    stdDev: number;
  };
  sessionDuration: {
    mean: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    stdDev: number;
  };
  errorRate: number;
  toolSuccessRate: number;
  throughput: number;
  totalRequests: number;
  totalSessions: number;
}

/**
 * Cost analysis
 */
export interface CostAnalysis {
  totalCost: number;
  averageCost: number;
  costRange: {
    min: number;
    max: number;
  };
  costByProvider: Array<{
    provider: string;
    totalCost: number;
    requestCount: number;
    averageCost: number;
  }>;
  costByModel: Array<{
    model: string;
    totalCost: number;
    requestCount: number;
    averageCost: number;
  }>;
  costTrends: Array<{
    date: string;
    cost: number;
  }>;
  costPerSession: number;
  projectedMonthlyCost: number;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  tokenUsage: {
    total: number;
    input: number;
    output: number;
    averagePerRequest: number;
  };
  providerUsage: Array<{
    provider: string;
    requestCount: number;
    percentage: number;
  }>;
  modelUsage: Array<{
    model: string;
    requestCount: number;
    percentage: number;
  }>;
  toolUsage: Array<{
    toolName: string;
    executionCount: number;
    successCount: number;
    successRate: number;
  }>;
  peakUsage: {
    hour: number;
    requestCount: number;
    timeframe: string;
  };
  sessionPatterns: any;
}

/**
 * Metrics trend
 */
export interface MetricsTrend {
  timestamp: number;
  timeWindow: number;
  metrics: {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    totalCost: number;
    errorRate: number;
  };
}

/**
 * Benchmark data
 */
export interface BenchmarkData {
  responseTime: {
    current: number;
    benchmark: number;
    percentile: number;
  };
  errorRate: {
    current: number;
    benchmark: number;
    percentile: number;
  };
  costEfficiency: {
    current: number;
    benchmark: number;
    percentile: number;
  };
  throughput: {
    current: number;
    benchmark: number;
    percentile: number;
  };
}

/**
 * Complete metrics report
 */
export interface MetricsReport {
  performance: PerformanceMetrics;
  cost: CostAnalysis;
  usage: UsageStats;
  trends: MetricsTrend[];
  benchmarks: BenchmarkData;
  summary: string[];
  timestamp: number;
}

// ================================================
// Configuration Types
// ================================================

/**
 * Timeline configuration
 */
export interface TimelineConfig {
  showDuration: boolean;
  showChildren: boolean;
  collapsible: boolean;
  maxItems: number;
  grouping: 'none' | 'session' | 'type' | 'provider';
  sortOrder: 'asc' | 'desc';
}

/**
 * Filter state for search/filtering
 */
export interface FilterState {
  providers: string[];
  models: string[];
  status: string[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
  costRange: {
    min?: number;
    max?: number;
  };
  durationRange: {
    min?: number;
    max?: number;
  };
  hasErrors: boolean | null;
  eventTypes: string[];
}

/**
 * Search configuration
 */
export interface SearchConfig {
  placeholder: string;
  debounceMs: number;
  minLength: number;
  caseSensitive: boolean;
  regex: boolean;
  fields: string[];
}

/**
 * Date range selector
 */
export interface DateRange {
  start?: Date;
  end?: Date;
}

/**
 * Number range selector
 */
export interface NumberRange {
  min?: number;
  max?: number;
}

/**
 * Session status options
 */
export type SessionStatus = 'active' | 'completed' | 'error' | 'cancelled';

// ================================================
// Component-Specific Types
// ================================================

/**
 * Request detail for display
 */
export interface RequestDetail {
  id: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  provider: string;
  model?: string;
  duration: number;
  size: {
    request: number;
    response: number;
  };
  headers?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  cost?: number;
  tokens?: TokenUsage;
  timing?: {
    dns?: number;
    connect?: number;
    tls?: number;
    send: number;
    wait: number;
    receive: number;
    total: number;
  };
}

/**
 * Tool execution details
 */
export interface ToolExecution {
  id: string;
  name: string;
  status: 'running' | 'success' | 'error';
  timestamp: number;
  duration: number;
  operations: ToolOperation[];
  parameters?: any;
  result?: any;
  error?: string;
}

/**
 * Tool operation
 */
export interface ToolOperation {
  id: string;
  type: 'file' | 'bash' | 'network' | 'custom';
  status: 'running' | 'success' | 'error';
  duration: number;
  details: any;
  diff?: DiffData;
}

/**
 * Diff data for visualization
 */
export interface DiffData {
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
}

/**
 * Syntax highlighting configuration
 */
export interface SyntaxHighlightConfig {
  language: string;
  theme: string;
  showLineNumbers: boolean;
  maxLines: number;
  wrapLines: boolean;
}

/**
 * Request summary for lists
 */
export interface RequestSummary {
  id: string;
  timestamp: number;
  provider: string;
  model?: string;
  status: string;
  duration: number;
  cost?: number;
  hasError: boolean;
}

// ================================================
// Export utility types
// ================================================

/**
 * Generic pagination info
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Generic list response
 */
export interface ListResponse<T> {
  items: T[];
  pagination: PaginationInfo;
  filters?: FilterState;
  sort?: SortConfig;
}