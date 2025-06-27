/**
 * Data Processing Types for opencode-trace viewer
 * Types for JSONL processing, event correlation, and data transformation
 */

// ================================================
// JSONL Processing Types
// ================================================

/**
 * JSONL processing configuration
 */
export interface JSONLProcessorConfig {
  validateSchema?: boolean;
  ignoreErrors?: boolean;
  maxFileSize?: number;
  chunkSize?: number;
  enableStreaming?: boolean;
}

/**
 * JSONL processing result
 */
export interface JSONLProcessingResult<T = any> {
  success: boolean;
  events: T[];
  errors: ProcessingError[];
  metadata: ProcessingMetadata;
}

/**
 * Processing error details
 */
export interface ProcessingError {
  line: number;
  column?: number;
  message: string;
  code: string;
  severity: 'error' | 'warning';
  context?: string;
}

/**
 * Processing metadata
 */
export interface ProcessingMetadata {
  totalLines: number;
  validLines: number;
  errorLines: number;
  processingTime: number;
  memoryUsage: number;
  fileSize: number;
  encoding: string;
}

// ================================================
// Event Correlation Types
// ================================================

/**
 * Event correlation configuration
 */
export interface CorrelationConfig {
  timeWindow?: number;
  sessionGrouping?: boolean;
  requestResponseMatching?: boolean;
  toolExecutionGrouping?: boolean;
  customMatchers?: CorrelationMatcher[];
}

/**
 * Custom correlation matcher
 */
export interface CorrelationMatcher {
  name: string;
  pattern: (event: any) => boolean;
  groupBy: (event: any) => string;
  sortBy?: (a: any, b: any) => number;
}

/**
 * Correlated event group
 */
export interface CorrelatedEventGroup {
  id: string;
  type: string;
  events: any[];
  startTime: number;
  endTime: number;
  duration: number;
  status: 'success' | 'error' | 'partial';
  metadata: Record<string, any>;
}

/**
 * Correlation result
 */
export interface CorrelationResult {
  groups: CorrelatedEventGroup[];
  orphanedEvents: any[];
  statistics: CorrelationStatistics;
}

/**
 * Correlation statistics
 */
export interface CorrelationStatistics {
  totalEvents: number;
  groupedEvents: number;
  orphanedEvents: number;
  groupCount: number;
  averageGroupSize: number;
  correlationRate: number;
}

// ================================================
// Metrics Calculation Types
// ================================================

/**
 * Metrics calculation configuration
 */
export interface MetricsConfig {
  includeTimingMetrics?: boolean;
  includeCostMetrics?: boolean;
  includeTokenMetrics?: boolean;
  includePerformanceMetrics?: boolean;
  includeErrorMetrics?: boolean;
  customMetrics?: CustomMetric[];
  aggregationWindow?: number;
}

/**
 * Custom metric definition
 */
export interface CustomMetric {
  name: string;
  description: string;
  calculator: (events: any[]) => number;
  unit: string;
  format?: (value: number) => string;
}

/**
 * Calculated metrics result
 */
export interface CalculatedMetrics {
  timing: TimingMetrics;
  cost: CostMetrics;
  tokens: TokenMetrics;
  performance: PerformanceMetrics;
  errors: ErrorMetrics;
  custom: Record<string, number>;
}

/**
 * Timing metrics
 */
export interface TimingMetrics {
  totalDuration: number;
  averageDuration: number;
  medianDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
  requestsPerSecond: number;
  concurrentRequests: number;
}

/**
 * Cost metrics
 */
export interface CostMetrics {
  totalCost: number;
  averageCostPerRequest: number;
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
  currency: string;
  projectedMonthlyCost: number;
}

/**
 * Token metrics
 */
export interface TokenMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  averageTokensPerRequest: number;
  tokensByModel: Record<string, { input: number; output: number }>;
  tokensPerSecond: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  memoryUsage: MemoryMetrics;
  cpuUsage: number;
  networkMetrics: NetworkMetrics;
  diskMetrics: DiskMetrics;
  errorRate: number;
  availability: number;
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  peak: number;
  average: number;
  current: number;
  allocations: number;
  deallocations: number;
  leaks: number;
}

/**
 * Network metrics
 */
export interface NetworkMetrics {
  totalBytes: number;
  uploadBytes: number;
  downloadBytes: number;
  averageLatency: number;
  connectionCount: number;
  retries: number;
}

/**
 * Disk metrics
 */
export interface DiskMetrics {
  readBytes: number;
  writeBytes: number;
  readOperations: number;
  writeOperations: number;
  averageReadTime: number;
  averageWriteTime: number;
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  errorsByProvider: Record<string, number>;
  criticalErrors: number;
  recoverableErrors: number;
  mttr: number; // Mean Time To Recovery
}

// ================================================
// Data Transformation Types
// ================================================

/**
 * Data transformation pipeline
 */
export interface TransformationPipeline {
  stages: TransformationStage[];
  parallel?: boolean;
  errorHandling?: 'stop' | 'skip' | 'continue';
}

/**
 * Transformation stage
 */
export interface TransformationStage {
  name: string;
  transformer: DataTransformer;
  condition?: (data: any) => boolean;
  config?: Record<string, any>;
}

/**
 * Data transformer function
 */
export type DataTransformer<TInput = any, TOutput = any> = (
  input: TInput,
  config?: Record<string, any>
) => Promise<TOutput> | TOutput;

/**
 * Transformation result
 */
export interface TransformationResult<T = any> {
  success: boolean;
  data: T;
  errors: TransformationError[];
  metadata: TransformationMetadata;
}

/**
 * Transformation error
 */
export interface TransformationError {
  stage: string;
  message: string;
  input?: any;
  stack?: string;
}

/**
 * Transformation metadata
 */
export interface TransformationMetadata {
  stages: string[];
  processingTime: number;
  inputSize: number;
  outputSize: number;
  compressionRatio: number;
}

// ================================================
// Session Summary Types
// ================================================

/**
 * Session summary generator configuration
 */
export interface SummaryConfig {
  includeMetrics?: boolean;
  includeTimeline?: boolean;
  includeTopRequests?: boolean;
  includeErrors?: boolean;
  includeRecommendations?: boolean;
  maxTimelineItems?: number;
  maxTopRequests?: number;
}

/**
 * Generated session summary
 */
export interface SessionSummaryData {
  overview: SessionOverview;
  metrics: CalculatedMetrics;
  timeline: TimelineSummary;
  topRequests: any[]; // Will be properly typed when RequestSummary is imported
  errors: ErrorSummary[];
  recommendations: Recommendation[];
  insights: SessionInsight[];
}

/**
 * Session overview
 */
export interface SessionOverview {
  id: string;
  query: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'completed' | 'error' | 'timeout' | 'cancelled';
  providers: string[];
  models: string[];
  tools: string[];
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
}

/**
 * Timeline summary
 */
export interface TimelineSummary {
  phases: TimelinePhase[];
  criticalPath: string[];
  bottlenecks: Bottleneck[];
}

/**
 * Timeline phase
 */
export interface TimelinePhase {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  events: number;
  description: string;
}

/**
 * Performance bottleneck
 */
export interface Bottleneck {
  type: 'request' | 'tool' | 'processing';
  location: string;
  duration: number;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
}

/**
 * Error summary
 */
export interface ErrorSummary {
  type: string;
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  impact: 'low' | 'medium' | 'high';
  message: string;
  suggestions: string[];
}

/**
 * Performance recommendation
 */
export interface Recommendation {
  type: 'performance' | 'cost' | 'reliability' | 'security';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  category: string;
}

/**
 * Session insight
 */
export interface SessionInsight {
  type: 'trend' | 'anomaly' | 'pattern' | 'optimization';
  title: string;
  description: string;
  value: number;
  unit: string;
  change?: number;
  comparison?: string;
  significance: 'low' | 'medium' | 'high';
}

// ================================================
// Data Validation Types
// ================================================

/**
 * Event schema definition
 */
export interface EventSchema {
  type: string;
  version: string;
  required: string[];
  properties: Record<string, PropertySchema>;
  additionalProperties?: boolean;
}

/**
 * Property schema definition
 */
export interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  format?: string;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  enum?: any[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  value: any;
  schema: PropertySchema;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string;
  message: string;
  suggestion: string;
}

// ================================================
// Data Export Types
// ================================================

/**
 * Export format definitions
 */
export type ExportFormat = 'json' | 'csv' | 'excel' | 'html' | 'pdf' | 'markdown';

/**
 * Export configuration
 */
export interface DataExportConfig {
  format: ExportFormat;
  filename?: string;
  compression?: boolean;
  includeMetadata?: boolean;
  filters?: ExportFilter[];
  transformations?: DataTransformer[];
}

/**
 * Export filter
 */
export interface ExportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  filename: string;
  size: number;
  format: ExportFormat;
  recordCount: number;
  generatedAt: number;
  downloadUrl?: string;
  error?: string;
}

// ================================================
// Memory Management Types
// ================================================

/**
 * Memory management configuration
 */
export interface MemoryConfig {
  maxMemoryUsage: number;
  cleanupThreshold: number;
  enableLazyLoading: boolean;
  chunkSize: number;
  cacheSize: number;
}

/**
 * Memory usage tracking
 */
export interface MemoryUsage {
  used: number;
  available: number;
  total: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Data chunk for lazy loading
 */
export interface DataChunk<T = any> {
  id: string;
  offset: number;
  size: number;
  loaded: boolean;
  data?: T[];
  metadata?: Record<string, any>;
}

// ================================================
// Utility Types
// ================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  page: number;
  size: number;
  total?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * Sorting configuration
 */
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  type?: 'string' | 'number' | 'date';
}

/**
 * Generic data provider interface
 */
export interface DataProvider<T = any> {
  load(config?: any): AsyncResult<T[]>;
  count(filters?: any): AsyncResult<number>;
  search(query: string, config?: any): AsyncResult<T[]>;
  sort(data: T[], config: SortConfig): T[];
  filter(data: T[], filters: any): T[];
  paginate(data: T[], config: PaginationConfig): T[];
}