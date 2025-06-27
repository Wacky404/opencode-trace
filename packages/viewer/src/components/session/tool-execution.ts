import { html, css, TemplateResult, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';
import type { ToolExecution, ToolOperation, DiffData, DiffChange } from '../../types/ui.js';

/**
 * Tool execution visualization component with diff display
 * Shows tool parameters, operations, file changes, and execution results
 */
@customElement('oc-tool-execution')
export class ToolExecutionComponent extends BaseComponent {
  @property({ type: Object })
  execution?: ToolExecution;

  @property({ type: String })
  activeTab: 'overview' | 'operations' | 'parameters' | 'result' | 'diff' = 'overview';

  @property({ type: Boolean })
  showDiff = true;

  @property({ type: String })
  diffMode: 'unified' | 'split' = 'unified';

  @state()
  private expandedOperations = new Set<string>();

  @state()
  private selectedOperation?: ToolOperation;

  @state()
  private formattedParameters?: string;

  @state()
  private formattedResult?: string;

  static styles: CSSResultGroup = [
    BaseComponent.styles,
    css`
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
      }

      .tool-execution-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--vs-bg);
      }

      .execution-header {
        padding: var(--size-md);
        border-bottom: 1px solid var(--vs-border);
        background: var(--vs-bg-secondary);
      }

      .execution-title {
        display: flex;
        align-items: center;
        gap: var(--size-md);
        margin-bottom: var(--size-sm);
      }

      .tool-name {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--vs-text);
      }

      .tool-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      .status-success {
        background: rgba(78, 201, 176, 0.2);
        color: var(--vs-success);
      }

      .status-error {
        background: rgba(244, 71, 71, 0.2);
        color: var(--vs-error);
      }

      .status-running {
        background: rgba(255, 204, 2, 0.2);
        color: var(--vs-warning);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .execution-meta {
        display: flex;
        gap: var(--size-lg);
        font-size: 0.875rem;
        color: var(--vs-text-muted);
      }

      .meta-item {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
      }

      .meta-value {
        color: var(--vs-text);
        font-weight: 500;
      }

      .execution-tabs {
        display: flex;
        background: var(--vs-bg-tertiary);
        border-bottom: 1px solid var(--vs-border);
      }

      .tab-button {
        background: transparent;
        border: none;
        padding: var(--size-sm) var(--size-md);
        color: var(--vs-text-muted);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
        font-size: 0.875rem;
        font-weight: 500;
        position: relative;
      }

      .tab-button:hover {
        color: var(--vs-text);
        background: var(--vs-hover);
      }

      .tab-button.active {
        color: var(--vs-accent);
        border-bottom-color: var(--vs-accent);
        background: var(--vs-bg);
      }

      .tab-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        background: var(--vs-accent);
        color: white;
        font-size: 0.625rem;
        padding: 1px 4px;
        border-radius: 2px;
        min-width: 16px;
        text-align: center;
      }

      .execution-content {
        flex: 1;
        overflow: auto;
        padding: var(--size-md);
      }

      .overview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--size-md);
        margin-bottom: var(--size-xl);
      }

      .overview-item {
        padding: var(--size-md);
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
      }

      .overview-label {
        font-size: 0.75rem;
        color: var(--vs-text-muted);
        text-transform: uppercase;
        font-weight: 600;
        margin-bottom: var(--size-xs);
      }

      .overview-value {
        font-size: 1rem;
        color: var(--vs-text);
        font-weight: 500;
      }

      .operations-list {
        space-y: var(--size-md);
      }

      .operation-item {
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: var(--size-md);
      }

      .operation-header {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        padding: var(--size-sm) var(--size-md);
        background: var(--vs-bg-tertiary);
        cursor: pointer;
      }

      .operation-header:hover {
        background: var(--vs-hover);
      }

      .operation-expand {
        color: var(--vs-text-muted);
        transition: transform 0.2s;
      }

      .operation-expand.expanded {
        transform: rotate(90deg);
      }

      .operation-type {
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .type-file {
        background: rgba(86, 156, 214, 0.2);
        color: var(--vs-accent);
      }

      .type-bash {
        background: rgba(106, 153, 85, 0.2);
        color: var(--vs-user);
      }

      .type-network {
        background: rgba(206, 145, 120, 0.2);
        color: var(--vs-assistant);
      }

      .type-custom {
        background: rgba(220, 220, 170, 0.2);
        color: var(--vs-function);
      }

      .operation-title {
        flex: 1;
        font-weight: 500;
        color: var(--vs-text);
      }

      .operation-status {
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .operation-duration {
        font-size: 0.75rem;
        color: var(--vs-text-muted);
        font-family: var(--font-mono, 'Consolas', monospace);
      }

      .operation-content {
        padding: var(--size-md);
      }

      .operation-details {
        background: var(--vs-bg-tertiary);
        border: 1px solid var(--vs-border);
        border-radius: 4px;
        padding: var(--size-sm);
        font-family: var(--font-mono, 'Consolas', monospace);
        font-size: 0.875rem;
        overflow-x: auto;
      }

      .code-block {
        background: var(--vs-bg-tertiary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        overflow: hidden);
      }

      .code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-sm) var(--size-md);
        background: var(--vs-bg-secondary);
        border-bottom: 1px solid var(--vs-border);
      }

      .code-language {
        font-size: 0.75rem;
        color: var(--vs-text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }

      .code-actions {
        display: flex;
        gap: var(--size-xs);
      }

      .code-action-btn {
        background: transparent;
        border: 1px solid var(--vs-border);
        color: var(--vs-text-muted);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .code-action-btn:hover {
        background: var(--vs-hover);
        color: var(--vs-text);
        border-color: var(--vs-accent);
      }

      .code-content {
        padding: var(--size-md);
        max-height: 400px;
        overflow: auto;
        font-family: var(--font-mono, 'Consolas', monospace);
        font-size: 0.875rem;
        line-height: 1.5;
      }

      .diff-container {
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .diff-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-sm) var(--size-md);
        background: var(--vs-bg-tertiary);
        border-bottom: 1px solid var(--vs-border);
      }

      .diff-info {
        display: flex;
        gap: var(--size-md);
        font-size: 0.875rem;
      }

      .diff-stat {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
      }

      .diff-add {
        color: var(--vs-success);
      }

      .diff-remove {
        color: var(--vs-error);
      }

      .diff-mode-toggle {
        display: flex;
        background: var(--vs-bg);
        border: 1px solid var(--vs-border);
        border-radius: 4px;
        overflow: hidden;
      }

      .diff-mode-btn {
        background: transparent;
        border: none;
        padding: 4px 8px;
        color: var(--vs-text-muted);
        cursor: pointer;
        font-size: 0.75rem;
        transition: all 0.2s;
      }

      .diff-mode-btn:hover {
        background: var(--vs-hover);
        color: var(--vs-text);
      }

      .diff-mode-btn.active {
        background: var(--vs-accent);
        color: white;
      }

      .diff-content {
        max-height: 500px;
        overflow: auto;
        font-family: var(--font-mono, 'Consolas', monospace);
        font-size: 0.875rem;
        line-height: 1.4;
      }

      .diff-line {
        display: flex;
        align-items: stretch;
        min-height: 20px;
      }

      .diff-line-number {
        width: 50px;
        padding: 0 var(--size-sm);
        text-align: right;
        color: var(--vs-text-muted);
        background: var(--vs-bg-tertiary);
        border-right: 1px solid var(--vs-border);
        user-select: none;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      .diff-line-content {
        flex: 1;
        padding: 0 var(--size-sm);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .diff-line.add {
        background: rgba(78, 201, 176, 0.1);
        border-left: 3px solid var(--vs-success);
      }

      .diff-line.add .diff-line-content {
        color: var(--vs-success);
      }

      .diff-line.remove {
        background: rgba(244, 71, 71, 0.1);
        border-left: 3px solid var(--vs-error);
      }

      .diff-line.remove .diff-line-content {
        color: var(--vs-error);
      }

      .diff-line.modify {
        background: rgba(255, 204, 2, 0.1);
        border-left: 3px solid var(--vs-warning);
      }

      .diff-line.context {
        color: var(--vs-text-muted);
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: var(--vs-text-muted);
        text-align: center;
      }

      .empty-icon {
        font-size: 2rem;
        margin-bottom: var(--size-md);
        opacity: 0.5;
      }

      .error-details {
        background: rgba(244, 71, 71, 0.1);
        border: 1px solid var(--vs-error);
        border-radius: 6px;
        padding: var(--size-md);
        color: var(--vs-error);
        font-family: var(--font-mono, 'Consolas', monospace);
        font-size: 0.875rem;
      }

      @media (max-width: 768px) {
        .execution-title {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--size-sm);
        }

        .execution-meta {
          flex-direction: column;
          gap: var(--size-sm);
        }

        .overview-grid {
          grid-template-columns: 1fr;
        }

        .diff-mode-toggle {
          display: none;
        }
      }
    `
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.formatExecutionData();
  }

  override updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('execution')) {
      this.formatExecutionData();
    }
  }

  private formatExecutionData(): void {
    if (!this.execution) return;

    try {
      // Format parameters
      if (this.execution.parameters) {
        this.formattedParameters = JSON.stringify(this.execution.parameters, null, 2);
      }

      // Format result
      if (this.execution.result) {
        this.formattedResult = typeof this.execution.result === 'string' 
          ? this.execution.result 
          : JSON.stringify(this.execution.result, null, 2);
      }
    } catch (error) {
      this.handleError(error as Error, 'formatting execution data');
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  private toggleOperation(operationId: string): void {
    if (this.expandedOperations.has(operationId)) {
      this.expandedOperations.delete(operationId);
    } else {
      this.expandedOperations.add(operationId);
    }
    this.requestUpdate();
  }

  private switchTab(tab: string): void {
    this.activeTab = tab as any;
    this.requestUpdate();
  }

  private toggleDiffMode(): void {
    this.diffMode = this.diffMode === 'unified' ? 'split' : 'unified';
    this.requestUpdate();
  }

  private async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      this.handleError(error as Error, 'copying to clipboard');
    }
  }

  private renderOverview(): TemplateResult {
    if (!this.execution) return html``;

    const successOps = this.execution.operations.filter(op => op.status === 'success').length;
    const errorOps = this.execution.operations.filter(op => op.status === 'error').length;

    return html`
      <div class="overview-grid">
        <div class="overview-item">
          <div class="overview-label">Tool Name</div>
          <div class="overview-value">${this.execution.name}</div>
        </div>
        
        <div class="overview-item">
          <div class="overview-label">Status</div>
          <div class="overview-value">
            <span class="tool-status status-${this.execution.status}">
              ${this.execution.status}
            </span>
          </div>
        </div>
        
        <div class="overview-item">
          <div class="overview-label">Duration</div>
          <div class="overview-value">${this.formatDuration(this.execution.duration)}</div>
        </div>
        
        <div class="overview-item">
          <div class="overview-label">Started</div>
          <div class="overview-value">${this.formatTimestamp(this.execution.timestamp)}</div>
        </div>
        
        <div class="overview-item">
          <div class="overview-label">Operations</div>
          <div class="overview-value">${this.execution.operations.length}</div>
        </div>
        
        <div class="overview-item">
          <div class="overview-label">Success Rate</div>
          <div class="overview-value">
            ${Math.round((successOps / this.execution.operations.length) * 100)}%
          </div>
        </div>
      </div>

      ${this.execution.error ? html`
        <div class="error-details">
          <strong>Error:</strong><br>
          ${this.execution.error}
        </div>
      ` : ''}
    `;
  }

  private renderOperations(): TemplateResult {
    if (!this.execution?.operations.length) {
      return html`
        <div class="empty-state">
          <div class="empty-icon">🔧</div>
          <div>No operations recorded</div>
        </div>
      `;
    }

    return html`
      <div class="operations-list">
        ${this.execution.operations.map(operation => this.renderOperation(operation))}
      </div>
    `;
  }

  private renderOperation(operation: ToolOperation): TemplateResult {
    const isExpanded = this.expandedOperations.has(operation.id);

    return html`
      <div class="operation-item">
        <div class="operation-header" @click=${() => this.toggleOperation(operation.id)}>
          <span class="operation-expand ${isExpanded ? 'expanded' : ''}">▶</span>
          <span class="operation-type type-${operation.type}">${operation.type}</span>
          <span class="operation-title">${this.getOperationTitle(operation)}</span>
          <span class="operation-status status-${operation.status}">${operation.status}</span>
          <span class="operation-duration">${this.formatDuration(operation.duration)}</span>
        </div>
        
        ${isExpanded ? html`
          <div class="operation-content">
            <div class="operation-details">
              ${JSON.stringify(operation.details, null, 2)}
            </div>
            
            ${operation.diff ? html`
              <div style="margin-top: var(--size-md);">
                ${this.renderDiff(operation.diff)}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  private getOperationTitle(operation: ToolOperation): string {
    switch (operation.type) {
      case 'file':
        return operation.details.path || 'File operation';
      case 'bash':
        return operation.details.command || 'Bash command';
      case 'network':
        return operation.details.url || 'Network request';
      default:
        return operation.details.name || 'Custom operation';
    }
  }

  private renderCodeBlock(content: string, language: string, title: string): TemplateResult {
    return html`
      <div class="code-block">
        <div class="code-header">
          <div class="code-language">${language}</div>
          <div class="code-actions">
            <button class="code-action-btn" @click=${() => this.copyToClipboard(content)}>
              Copy
            </button>
          </div>
        </div>
        <div class="code-content">
          <pre>${content}</pre>
        </div>
      </div>
    `;
  }

  private renderDiff(diff: DiffData): TemplateResult {
    return html`
      <div class="diff-container">
        <div class="diff-header">
          <div class="diff-info">
            <div class="diff-stat">
              <span class="diff-add">+${diff.additions}</span>
            </div>
            <div class="diff-stat">
              <span class="diff-remove">-${diff.deletions}</span>
            </div>
          </div>
          
          <div class="diff-mode-toggle">
            <button 
              class="diff-mode-btn ${this.diffMode === 'unified' ? 'active' : ''}"
              @click=${() => this.diffMode = 'unified'}
            >
              Unified
            </button>
            <button 
              class="diff-mode-btn ${this.diffMode === 'split' ? 'active' : ''}"
              @click=${() => this.diffMode = 'split'}
            >
              Split
            </button>
          </div>
        </div>
        
        <div class="diff-content">
          ${diff.changes.map(change => this.renderDiffLine(change))}
        </div>
      </div>
    `;
  }

  private renderDiffLine(change: DiffChange): TemplateResult {
    return html`
      <div class="diff-line ${change.type}">
        <div class="diff-line-number">${change.lineNumber}</div>
        <div class="diff-line-content">${change.content}</div>
      </div>
    `;
  }

  override render(): TemplateResult {
    if (!this.execution) {
      return html`
        <div class="tool-execution-container">
          <div class="empty-state">
            <div class="empty-icon">🔧</div>
            <div>No tool execution selected</div>
            <div style="font-size: 0.875rem; margin-top: var(--size-xs);">
              Select a tool execution from the timeline to view details
            </div>
          </div>
        </div>
      `;
    }

    const hasOperations = this.execution.operations.length > 0;
    const hasDiff = this.execution.operations.some(op => op.diff);

    return html`
      <div class="tool-execution-container">
        <div class="execution-header">
          <div class="execution-title">
            <span class="tool-name">${this.execution.name}</span>
            <span class="tool-status status-${this.execution.status}">
              ${this.execution.status}
            </span>
          </div>
          
          <div class="execution-meta">
            <div class="meta-item">
              <span>Duration:</span>
              <span class="meta-value">${this.formatDuration(this.execution.duration)}</span>
            </div>
            <div class="meta-item">
              <span>Operations:</span>
              <span class="meta-value">${this.execution.operations.length}</span>
            </div>
            <div class="meta-item">
              <span>Started:</span>
              <span class="meta-value">${this.formatTimestamp(this.execution.timestamp)}</span>
            </div>
          </div>
        </div>

        <div class="execution-tabs">
          <button 
            class="tab-button ${this.activeTab === 'overview' ? 'active' : ''}"
            @click=${() => this.switchTab('overview')}
          >
            Overview
          </button>
          
          ${hasOperations ? html`
            <button 
              class="tab-button ${this.activeTab === 'operations' ? 'active' : ''}"
              @click=${() => this.switchTab('operations')}
            >
              Operations
              <span class="tab-badge">${this.execution.operations.length}</span>
            </button>
          ` : ''}
          
          ${this.execution.parameters ? html`
            <button 
              class="tab-button ${this.activeTab === 'parameters' ? 'active' : ''}"
              @click=${() => this.switchTab('parameters')}
            >
              Parameters
            </button>
          ` : ''}
          
          ${this.execution.result ? html`
            <button 
              class="tab-button ${this.activeTab === 'result' ? 'active' : ''}"
              @click=${() => this.switchTab('result')}
            >
              Result
            </button>
          ` : ''}
          
          ${hasDiff ? html`
            <button 
              class="tab-button ${this.activeTab === 'diff' ? 'active' : ''}"
              @click=${() => this.switchTab('diff')}
            >
              Diff
            </button>
          ` : ''}
        </div>

        <div class="execution-content">
          ${this.activeTab === 'overview' ? this.renderOverview() : ''}
          
          ${this.activeTab === 'operations' ? this.renderOperations() : ''}
          
          ${this.activeTab === 'parameters' && this.formattedParameters ? 
            this.renderCodeBlock(this.formattedParameters, 'json', 'Parameters') : ''}
          
          ${this.activeTab === 'result' && this.formattedResult ? 
            this.renderCodeBlock(this.formattedResult, 'text', 'Result') : ''}
          
          ${this.activeTab === 'diff' ? html`
            ${this.execution.operations
              .filter(op => op.diff)
              .map(op => this.renderDiff(op.diff!))
            }
          ` : ''}
        </div>

        ${this.renderLoadingOverlay()}
        ${this.renderError()}
      </div>
    `;
  }
}