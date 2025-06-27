import { html, css, TemplateResult, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';
import type { RequestDetail, RequestSummary, SyntaxHighlightConfig } from '../../types/ui.js';

/**
 * Detailed view component for HTTP requests with syntax highlighting
 * Shows request/response data, headers, timing, and performance metrics
 */
@customElement('oc-request-detail')
export class RequestDetailComponent extends BaseComponent {
  @property({ type: Object })
  request?: RequestDetail;

  @property({ type: Boolean })
  showHeaders = true;

  @property({ type: Boolean })
  showTiming = true;

  @property({ type: Boolean })
  showBody = true;

  @property({ type: String })
  activeTab: 'overview' | 'request' | 'response' | 'headers' | 'timing' = 'overview';

  @state()
  private expandedSections = new Set<string>(['overview']);

  @state()
  private formattedRequestBody?: string;

  @state()
  private formattedResponseBody?: string;

  @state()
  private syntaxHighlightConfig: SyntaxHighlightConfig = {
    language: 'json',
    theme: 'vs-dark',
    showLineNumbers: true,
    maxLines: 500,
    wrapLines: false
  };

  static styles: CSSResultGroup = [
    BaseComponent.styles,
    css`
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
      }

      .request-detail-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--vs-bg);
      }

      .request-header {
        padding: var(--size-md);
        border-bottom: 1px solid var(--vs-border);
        background: var(--vs-bg-secondary);
      }

      .request-title {
        display: flex;
        align-items: center;
        gap: var(--size-md);
        margin-bottom: var(--size-sm);
      }

      .request-method {
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      .method-get { background: rgba(78, 201, 176, 0.2); color: var(--vs-success); }
      .method-post { background: rgba(86, 156, 214, 0.2); color: var(--vs-accent); }
      .method-put { background: rgba(255, 204, 2, 0.2); color: var(--vs-warning); }
      .method-delete { background: rgba(244, 71, 71, 0.2); color: var(--vs-error); }
      .method-patch { background: rgba(206, 145, 120, 0.2); color: var(--vs-assistant); }

      .request-url {
        font-family: var(--font-mono, 'Consolas', monospace);
        font-size: 0.875rem;
        color: var(--vs-text);
        flex: 1;
        word-break: break-all;
      }

      .request-status {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        font-size: 0.875rem;
      }

      .status-code {
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
        font-family: var(--font-mono, 'Consolas', monospace);
      }

      .status-2xx { background: rgba(78, 201, 176, 0.2); color: var(--vs-success); }
      .status-3xx { background: rgba(255, 204, 2, 0.2); color: var(--vs-warning); }
      .status-4xx { background: rgba(244, 71, 71, 0.2); color: var(--vs-error); }
      .status-5xx { background: rgba(244, 71, 71, 0.3); color: var(--vs-error); }

      .request-meta {
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

      .request-tabs {
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

      .request-content {
        flex: 1;
        overflow: auto;
        padding: var(--size-md);
      }

      .content-section {
        margin-bottom: var(--size-xl);
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        margin-bottom: var(--size-md);
        cursor: pointer;
        user-select: none;
      }

      .section-header:hover {
        color: var(--vs-accent);
      }

      .section-title {
        font-weight: 600;
        font-size: 1rem;
      }

      .section-toggle {
        color: var(--vs-text-muted);
        transition: transform 0.2s;
      }

      .section-toggle.expanded {
        transform: rotate(90deg);
      }

      .section-content {
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .overview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--size-md);
        padding: var(--size-md);
      }

      .overview-item {
        padding: var(--size-sm);
        background: var(--vs-bg-tertiary);
        border-radius: 4px;
      }

      .overview-label {
        font-size: 0.75rem;
        color: var(--vs-text-muted);
        text-transform: uppercase;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .overview-value {
        font-size: 0.875rem;
        color: var(--vs-text);
        font-weight: 500;
      }

      .headers-table {
        width: 100%;
        border-collapse: collapse;
      }

      .headers-table th,
      .headers-table td {
        padding: var(--size-sm);
        text-align: left;
        border-bottom: 1px solid var(--vs-border);
        font-size: 0.875rem;
      }

      .headers-table th {
        background: var(--vs-bg-tertiary);
        color: var(--vs-text-muted);
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.75rem;
      }

      .headers-table td {
        font-family: var(--font-mono, 'Consolas', monospace);
      }

      .header-name {
        color: var(--vs-accent);
        font-weight: 500;
      }

      .header-value {
        color: var(--vs-text);
        word-break: break-all;
      }

      .timing-chart {
        padding: var(--size-md);
      }

      .timing-bars {
        margin-bottom: var(--size-md);
      }

      .timing-bar {
        display: flex;
        align-items: center;
        margin-bottom: var(--size-sm);
        font-size: 0.875rem;
      }

      .timing-label {
        width: 80px;
        color: var(--vs-text-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
      }

      .timing-visual {
        flex: 1;
        height: 20px;
        background: var(--vs-bg-tertiary);
        border-radius: 2px;
        position: relative;
        margin: 0 var(--size-sm);
      }

      .timing-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .timing-dns { background: var(--vs-user); }
      .timing-connect { background: var(--vs-accent); }
      .timing-tls { background: var(--vs-function); }
      .timing-send { background: var(--vs-success); }
      .timing-wait { background: var(--vs-warning); }
      .timing-receive { background: var(--vs-assistant); }

      .timing-value {
        width: 60px;
        text-align: right;
        color: var(--vs-text);
        font-weight: 500;
        font-family: var(--font-mono, 'Consolas', monospace);
      }

      .code-block {
        background: var(--vs-bg-tertiary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        overflow: hidden;
        font-family: var(--font-mono, 'Consolas', monospace);
        font-size: 0.875rem;
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
        line-height: 1.5;
      }

      .code-line {
        display: flex;
        align-items: flex-start;
      }

      .line-number {
        color: var(--vs-text-muted);
        width: 40px;
        text-align: right;
        padding-right: var(--size-sm);
        user-select: none;
        font-size: 0.75rem;
      }

      .line-content {
        flex: 1;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .syntax-keyword { color: var(--vs-accent); }
      .syntax-string { color: var(--vs-success); }
      .syntax-number { color: var(--vs-function); }
      .syntax-boolean { color: var(--vs-accent); }
      .syntax-null { color: var(--vs-text-muted); }
      .syntax-property { color: var(--vs-user); }

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

      .size-info {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        font-size: 0.75rem;
        color: var(--vs-text-muted);
      }

      .size-value {
        color: var(--vs-text);
        font-weight: 500;
      }

      @media (max-width: 768px) {
        .request-title {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--size-sm);
        }

        .request-meta {
          flex-direction: column;
          gap: var(--size-sm);
        }

        .overview-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.formatRequestData();
  }

  override updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('request')) {
      this.formatRequestData();
    }
  }

  private async formatRequestData(): Promise<void> {
    if (!this.request) return;

    try {
      // Format request body
      if (this.request.requestBody) {
        this.formattedRequestBody = this.formatJSON(this.request.requestBody);
      }

      // Format response body
      if (this.request.responseBody) {
        this.formattedResponseBody = this.formatJSON(this.request.responseBody);
      }
    } catch (error) {
      this.handleError(error as Error, 'formatting request data');
    }
  }

  private formatJSON(data: any): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private getStatusClass(status: number): string {
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 300 && status < 400) return 'status-3xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    return 'status-5xx';
  }

  private getMethodClass(method: string): string {
    return `method-${method.toLowerCase()}`;
  }

  private toggleSection(sectionId: string): void {
    if (this.expandedSections.has(sectionId)) {
      this.expandedSections.delete(sectionId);
    } else {
      this.expandedSections.add(sectionId);
    }
    this.requestUpdate();
  }

  private switchTab(tab: string): void {
    this.activeTab = tab as any;
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
    if (!this.request) return html``;

    return html`
      <div class="content-section">
        <div class="section-content">
          <div class="overview-grid">
            <div class="overview-item">
              <div class="overview-label">Provider</div>
              <div class="overview-value">${this.request.provider}</div>
            </div>
            
            ${this.request.model ? html`
              <div class="overview-item">
                <div class="overview-label">Model</div>
                <div class="overview-value">${this.request.model}</div>
              </div>
            ` : ''}
            
            <div class="overview-item">
              <div class="overview-label">Duration</div>
              <div class="overview-value">${this.formatDuration(this.request.duration)}</div>
            </div>
            
            <div class="overview-item">
              <div class="overview-label">Request Size</div>
              <div class="overview-value">${this.formatBytes(this.request.size.request)}</div>
            </div>
            
            <div class="overview-item">
              <div class="overview-label">Response Size</div>
              <div class="overview-value">${this.formatBytes(this.request.size.response)}</div>
            </div>
            
            ${this.request.cost ? html`
              <div class="overview-item">
                <div class="overview-label">Cost</div>
                <div class="overview-value">$${this.request.cost.toFixed(4)}</div>
              </div>
            ` : ''}
            
            ${this.request.tokens ? html`
              <div class="overview-item">
                <div class="overview-label">Input Tokens</div>
                <div class="overview-value">${this.request.tokens.input.toLocaleString()}</div>
              </div>
              
              <div class="overview-item">
                <div class="overview-label">Output Tokens</div>
                <div class="overview-value">${this.request.tokens.output.toLocaleString()}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  private renderCodeBlock(content: string, language: string, title: string): TemplateResult {
    const lines = content.split('\n');
    
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
          ${lines.map((line, index) => html`
            <div class="code-line">
              ${this.syntaxHighlightConfig.showLineNumbers ? html`
                <div class="line-number">${index + 1}</div>
              ` : ''}
              <div class="line-content">${this.highlightSyntax(line, language)}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private highlightSyntax(line: string, language: string): TemplateResult {
    if (language !== 'json') {
      return html`${line}`;
    }

    // Simple JSON syntax highlighting
    let highlighted = line
      .replace(/"([^"]+)":/g, '<span class="syntax-property">"$1":</span>')
      .replace(/:\s*"([^"]*)"/g, ': <span class="syntax-string">"$1"</span>')
      .replace(/:\s*(\d+)/g, ': <span class="syntax-number">$1</span>')
      .replace(/:\s*(true|false)/g, ': <span class="syntax-boolean">$1</span>')
      .replace(/:\s*null/g, ': <span class="syntax-null">null</span>');

    return html`${highlighted}`;
  }

  private renderTimingChart(): TemplateResult {
    if (!this.request?.timing) return html``;

    const maxTime = this.request.timing.total;
    const timing = this.request.timing;

    const timingData = [
      { label: 'DNS', value: timing.dns || 0, class: 'timing-dns' },
      { label: 'Connect', value: timing.connect || 0, class: 'timing-connect' },
      { label: 'TLS', value: timing.tls || 0, class: 'timing-tls' },
      { label: 'Send', value: timing.send, class: 'timing-send' },
      { label: 'Wait', value: timing.wait, class: 'timing-wait' },
      { label: 'Receive', value: timing.receive, class: 'timing-receive' }
    ].filter(item => item.value > 0);

    return html`
      <div class="timing-chart">
        <div class="timing-bars">
          ${timingData.map(item => html`
            <div class="timing-bar">
              <div class="timing-label">${item.label}</div>
              <div class="timing-visual">
                <div 
                  class="timing-fill ${item.class}"
                  style="width: ${(item.value / maxTime) * 100}%"
                ></div>
              </div>
              <div class="timing-value">${this.formatDuration(item.value)}</div>
            </div>
          `)}
        </div>
        
        <div class="size-info">
          <span>Total Duration:</span>
          <span class="size-value">${this.formatDuration(maxTime)}</span>
        </div>
      </div>
    `;
  }

  private renderHeaders(): TemplateResult {
    if (!this.request?.headers || Object.keys(this.request.headers).length === 0) {
      return html`
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div>No headers available</div>
        </div>
      `;
    }

    return html`
      <table class="headers-table">
        <thead>
          <tr>
            <th>Header Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(this.request.headers).map(([name, value]) => html`
            <tr>
              <td class="header-name">${name}</td>
              <td class="header-value">${value}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }

  override render(): TemplateResult {
    if (!this.request) {
      return html`
        <div class="request-detail-container">
          <div class="empty-state">
            <div class="empty-icon">📄</div>
            <div>No request selected</div>
            <div style="font-size: 0.875rem; margin-top: var(--size-xs);">
              Select a request from the timeline to view details
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="request-detail-container">
        <div class="request-header">
          <div class="request-title">
            <span class="request-method ${this.getMethodClass(this.request.method)}">
              ${this.request.method}
            </span>
            <span class="request-url">${this.request.url}</span>
            <div class="request-status">
              <span class="status-code ${this.getStatusClass(this.request.status)}">
                ${this.request.status}
              </span>
              <span>${this.request.statusText}</span>
            </div>
          </div>
          
          <div class="request-meta">
            <div class="meta-item">
              <span>Provider:</span>
              <span class="meta-value">${this.request.provider}</span>
            </div>
            <div class="meta-item">
              <span>Duration:</span>
              <span class="meta-value">${this.formatDuration(this.request.duration)}</span>
            </div>
            <div class="meta-item">
              <span>Size:</span>
              <span class="meta-value">
                ${this.formatBytes(this.request.size.request + this.request.size.response)}
              </span>
            </div>
          </div>
        </div>

        <div class="request-tabs">
          <button 
            class="tab-button ${this.activeTab === 'overview' ? 'active' : ''}"
            @click=${() => this.switchTab('overview')}
          >
            Overview
          </button>
          <button 
            class="tab-button ${this.activeTab === 'request' ? 'active' : ''}"
            @click=${() => this.switchTab('request')}
          >
            Request
          </button>
          <button 
            class="tab-button ${this.activeTab === 'response' ? 'active' : ''}"
            @click=${() => this.switchTab('response')}
          >
            Response
          </button>
          <button 
            class="tab-button ${this.activeTab === 'headers' ? 'active' : ''}"
            @click=${() => this.switchTab('headers')}
          >
            Headers
          </button>
          <button 
            class="tab-button ${this.activeTab === 'timing' ? 'active' : ''}"
            @click=${() => this.switchTab('timing')}
          >
            Timing
          </button>
        </div>

        <div class="request-content">
          ${this.activeTab === 'overview' ? this.renderOverview() : ''}
          
          ${this.activeTab === 'request' ? html`
            ${this.formattedRequestBody ? 
              this.renderCodeBlock(this.formattedRequestBody, 'json', 'Request Body') :
              html`
                <div class="empty-state">
                  <div class="empty-icon">📤</div>
                  <div>No request body</div>
                </div>
              `
            }
          ` : ''}
          
          ${this.activeTab === 'response' ? html`
            ${this.formattedResponseBody ? 
              this.renderCodeBlock(this.formattedResponseBody, 'json', 'Response Body') :
              html`
                <div class="empty-state">
                  <div class="empty-icon">📥</div>
                  <div>No response body</div>
                </div>
              `
            }
          ` : ''}
          
          ${this.activeTab === 'headers' ? this.renderHeaders() : ''}
          
          ${this.activeTab === 'timing' ? this.renderTimingChart() : ''}
        </div>

        ${this.renderLoadingOverlay()}
        ${this.renderError()}
      </div>
    `;
  }
}