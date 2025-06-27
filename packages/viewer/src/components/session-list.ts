import type { SessionData, TraceEvent } from '../types/trace.js';
import type { ViewportSize } from '../types/ui.js';
import { BaseComponent } from './base/base-component.js';
import { property, state } from 'lit/decorators.js';
import { html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import { classMap } from 'lit/directives/class-map.js';
import { formatTimestamp, formatDuration, formatFileSize } from './base/component-utils.js';

/**
 * Session list item data interface
 */
export interface SessionListItem {
  session: SessionData;
  isSelected: boolean;
  status: 'active' | 'completed' | 'error';
  duration: number;
  primaryProvider?: string;
  errorCount: number;
  toolCount: number;
}

/**
 * Column definition for session list
 */
export interface SessionListColumn {
  key: string;
  label: string;
  sortable: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, session: SessionData) => string;
}

/**
 * Session list events
 */
export interface SessionListEvents {
  'session-selected': { sessionId: string; selected: boolean };
  'session-opened': { sessionId: string; session: SessionData };
  'session-context-menu': { sessionId: string; session: SessionData; event: MouseEvent };
  'column-sort': { column: string; direction: 'asc' | 'desc' };
}

/**
 * Advanced session list component with sorting, filtering, and multi-select
 * Supports both compact and detailed view modes
 */
@customElement('session-list')
export class SessionList extends BaseComponent {
  static styles = [
    BaseComponent.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--vs-bg);
      }

      /* Table Container */
      .list-container {
        flex: 1;
        overflow: auto;
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
      }

      .list-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--text-sm);
        font-family: var(--font-mono);
      }

      /* Table Header */
      .table-header {
        background-color: var(--vs-bg-secondary);
        border-bottom: 2px solid var(--vs-border);
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .header-cell {
        padding: var(--size-md);
        text-align: left;
        font-weight: var(--font-semibold);
        color: var(--vs-text);
        border-right: 1px solid var(--vs-border);
        user-select: none;
        white-space: nowrap;
      }

      .header-cell:last-child {
        border-right: none;
      }

      .header-cell.sortable {
        cursor: pointer;
        transition: var(--transition-fast);
        position: relative;
      }

      .header-cell.sortable:hover {
        background-color: var(--vs-hover);
      }

      .sort-indicator {
        margin-left: var(--size-xs);
        opacity: 0.6;
        font-size: 0.8em;
      }

      .sort-indicator.active {
        opacity: 1;
        color: var(--vs-accent);
      }

      .checkbox-cell {
        width: 40px;
        text-align: center;
        padding: var(--size-sm);
      }

      /* Table Body */
      .table-row {
        border-bottom: 1px solid var(--vs-border);
        transition: var(--transition-fast);
        cursor: pointer;
      }

      .table-row:hover {
        background-color: var(--vs-hover);
      }

      .table-row.selected {
        background-color: var(--vs-selection);
      }

      .table-row.error {
        border-left: 3px solid var(--vs-error);
      }

      .table-row.active {
        border-left: 3px solid var(--vs-warning);
      }

      .table-cell {
        padding: var(--size-sm) var(--size-md);
        border-right: 1px solid var(--vs-border);
        vertical-align: top;
        word-break: break-word;
      }

      .table-cell:last-child {
        border-right: none;
      }

      .cell-checkbox {
        text-align: center;
        padding: var(--size-sm);
      }

      .cell-primary {
        font-weight: var(--font-medium);
        color: var(--vs-text);
      }

      .cell-secondary {
        color: var(--vs-text-muted);
        font-size: var(--text-xs);
        margin-top: 2px;
      }

      .cell-right {
        text-align: right;
      }

      .cell-center {
        text-align: center;
      }

      /* Status Indicators */
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: var(--size-xs);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
      }

      .status-badge.completed {
        background-color: var(--vs-success-bg);
        color: var(--vs-success);
        border: 1px solid var(--vs-success);
      }

      .status-badge.active {
        background-color: var(--vs-warning-bg);
        color: var(--vs-warning);
        border: 1px solid var(--vs-warning);
      }

      .status-badge.error {
        background-color: var(--vs-error-bg);
        color: var(--vs-error);
        border: 1px solid var(--vs-error);
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      .status-dot.completed {
        background-color: var(--vs-success);
      }

      .status-dot.active {
        background-color: var(--vs-warning);
        animation: pulse 2s infinite;
      }

      .status-dot.error {
        background-color: var(--vs-error);
      }

      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }

      /* Provider Icons */
      .provider-icon {
        width: 16px;
        height: 16px;
        border-radius: var(--radius-sm);
        margin-right: var(--size-xs);
        vertical-align: middle;
      }

      .provider-anthropic {
        background-color: #ff6b35;
      }

      .provider-openai {
        background-color: #412991;
      }

      .provider-google {
        background-color: #4285f4;
      }

      .provider-unknown {
        background-color: var(--vs-text-muted);
      }

      /* Metrics */
      .metric-value {
        font-weight: var(--font-medium);
        color: var(--vs-text);
      }

      .metric-cost {
        color: var(--vs-success);
      }

      .metric-error {
        color: var(--vs-error);
      }

      .metric-duration {
        color: var(--vs-accent);
      }

      /* Query Preview */
      .query-preview {
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .query-text {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--vs-text-muted);
        background-color: var(--vs-bg-tertiary);
        padding: 2px 4px;
        border-radius: var(--radius-sm);
        display: inline-block;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Context Menu */
      .context-menu {
        position: fixed;
        background-color: var(--vs-bg-elevated);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        box-shadow: 0 4px 12px var(--vs-shadow);
        z-index: var(--z-popover);
        min-width: 160px;
        padding: var(--size-xs) 0;
      }

      .context-menu-item {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        padding: var(--size-sm) var(--size-md);
        color: var(--vs-text);
        cursor: pointer;
        transition: var(--transition-fast);
        font-size: var(--text-sm);
      }

      .context-menu-item:hover {
        background-color: var(--vs-hover);
      }

      .context-menu-item.danger {
        color: var(--vs-error);
      }

      .context-menu-separator {
        height: 1px;
        background-color: var(--vs-border);
        margin: var(--size-xs) 0;
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .table-cell {
          padding: var(--size-xs) var(--size-sm);
          font-size: var(--text-xs);
        }

        .header-cell {
          padding: var(--size-sm);
          font-size: var(--text-xs);
        }

        .query-preview {
          max-width: 150px;
        }

        .cell-secondary {
          display: none;
        }
      }

      @media (max-width: 480px) {
        .list-table {
          font-size: var(--text-xs);
        }

        .status-badge {
          padding: 1px 4px;
        }

        .provider-icon {
          width: 12px;
          height: 12px;
        }
      }

      /* Loading State */
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(30, 30, 30, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--vs-border);
        border-top: 3px solid var(--vs-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* Empty State */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--size-2xl);
        color: var(--vs-text-muted);
        text-align: center;
      }

      .empty-icon {
        font-size: 2rem;
        margin-bottom: var(--size-md);
        opacity: 0.5;
      }
    `
  ];

  @property({ type: Array })
  sessions: SessionData[] = [];

  @property({ type: Object })
  selectedSessions: Set<string> = new Set();

  @property({ type: Boolean })
  multiSelect: boolean = false;

  @property({ type: String })
  sortColumn: string = 'date';

  @property({ type: String })
  sortDirection: 'asc' | 'desc' = 'desc';

  @property({ type: Boolean })
  showActions: boolean = true;

  @state()
  private viewportSize: ViewportSize = 'desktop';

  @state()
  private contextMenu: { x: number; y: number; sessionId: string } | null = null;

  private columns: SessionListColumn[] = [
    { key: 'select', label: '', sortable: false, width: '40px', align: 'center' },
    { key: 'status', label: 'Status', sortable: true, width: '80px', align: 'center' },
    { key: 'query', label: 'Query', sortable: true },
    { key: 'provider', label: 'Provider', sortable: true, width: '120px' },
    { key: 'date', label: 'Started', sortable: true, width: '140px' },
    { key: 'duration', label: 'Duration', sortable: true, width: '100px', align: 'right' },
    { key: 'requests', label: 'Requests', sortable: true, width: '80px', align: 'right' },
    { key: 'cost', label: 'Cost', sortable: true, width: '80px', align: 'right' },
    { key: 'tools', label: 'Tools', sortable: true, width: '60px', align: 'right' },
    { key: 'errors', label: 'Errors', sortable: true, width: '60px', align: 'right' },
  ];

  connectedCallback() {
    super.connectedCallback();
    this.updateViewportSize();
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('click', this.handleDocumentClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('click', this.handleDocumentClick);
  }

  private handleResize = () => {
    this.updateViewportSize();
  };

  private handleDocumentClick = (e: Event) => {
    // Close context menu if clicking outside
    if (this.contextMenu && !(e.target as Element).closest('.context-menu')) {
      this.contextMenu = null;
      this.requestUpdate();
    }
  };

  private updateViewportSize() {
    const width = window.innerWidth;
    if (width < 480) {
      this.viewportSize = 'mobile';
    } else if (width < 768) {
      this.viewportSize = 'tablet';
    } else {
      this.viewportSize = 'desktop';
    }
  }

  private getSessionStatus(session: SessionData): 'active' | 'completed' | 'error' {
    if (session.status === 'active') return 'active';
    if (session.status === 'error') return 'error';
    return 'completed';
  }

  private getSessionCost(session: SessionData): number {
    return session.events
      ?.filter(e => e.type === 'ai_response')
      .reduce((sum, e) => sum + ((e as any).cost || 0), 0) || 0;
  }

  private getRequestCount(session: SessionData): number {
    return session.events?.filter(e => e.type === 'ai_request').length || 0;
  }

  private getErrorCount(session: SessionData): number {
    return session.events?.filter(e => e.type === 'error').length || 0;
  }

  private getToolCount(session: SessionData): number {
    return session.events?.filter(e => e.type === 'tool_execution').length || 0;
  }

  private getSessionDuration(session: SessionData): number {
    return session.duration || 0;
  }

  private getPrimaryProvider(session: SessionData): string {
    const aiEvents = session.events?.filter(e => e.type === 'ai_request') || [];
    if (aiEvents.length === 0) return 'unknown';
    
    // Count providers and return the most used one
    const providerCounts: Record<string, number> = {};
    aiEvents.forEach(event => {
      const provider = (event as any).provider?.toLowerCase() || 'unknown';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });

    return Object.entries(providerCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
  }

  private handleHeaderClick(column: SessionListColumn) {
    if (!column.sortable) return;

    const newDirection = this.sortColumn === column.key && this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.sortColumn = column.key;
    this.sortDirection = newDirection;

    this.emitEvent('column-sort', { 
      column: column.key, 
      direction: newDirection 
    });
  }

  private handleRowClick(sessionId: string, event: MouseEvent) {
    if (event.detail === 2) { // Double click
      const session = this.sessions.find(s => s.id === sessionId);
      if (session) {
        this.emitEvent('session-opened', { sessionId, session });
      }
    }
  }

  private handleCheckboxChange(sessionId: string, event: Event) {
    event.stopPropagation();
    const checkbox = event.target as HTMLInputElement;
    this.emitEvent('session-selected', { 
      sessionId, 
      selected: checkbox.checked 
    });
  }

  private handleContextMenu(sessionId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    this.contextMenu = {
      x: event.clientX,
      y: event.clientY,
      sessionId
    };
    this.requestUpdate();

    const session = this.sessions.find(s => s.id === sessionId);
    if (session) {
      this.emitEvent('session-context-menu', { sessionId, session, event });
    }
  }

  private handleContextMenuAction(action: string, sessionId: string) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    switch (action) {
      case 'open':
        this.emitEvent('session-opened', { sessionId, session });
        break;
      case 'select':
        this.emitEvent('session-selected', { sessionId, selected: true });
        break;
      case 'export':
        this.emitEvent('session-exported', { sessionIds: [sessionId], format: 'json' });
        break;
      case 'delete':
        this.emitEvent('session-deleted', { sessionId, session });
        break;
    }

    this.contextMenu = null;
    this.requestUpdate();
  }

  render() {
    if (this.sessions.length === 0) {
      return this.renderEmptyState();
    }

    const visibleColumns = this.getVisibleColumns();

    return html`
      <div class="list-container" style="position: relative;">
        ${when(this.loading, () => html`
          <div class="loading-overlay">
            <div class="loading-spinner"></div>
          </div>
        `)}

        <table class="list-table">
          <thead class="table-header">
            <tr>
              ${repeat(visibleColumns, col => col.key, col => html`
                <th 
                  class="header-cell ${classMap({ sortable: col.sortable })}"
                  style=${col.width ? `width: ${col.width}` : ''}
                  @click=${() => this.handleHeaderClick(col)}
                >
                  ${col.label}
                  ${when(col.sortable && this.sortColumn === col.key, () => html`
                    <span class="sort-indicator active">
                      ${this.sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  `)}
                </th>
              `)}
            </tr>
          </thead>

          <tbody>
            ${repeat(this.sessions, session => session.id, session => {
              const isSelected = this.selectedSessions.has(session.id);
              const status = this.getSessionStatus(session);
              const duration = this.getSessionDuration(session);
              const provider = this.getPrimaryProvider(session);

              return html`
                <tr 
                  class="table-row ${classMap({ 
                    selected: isSelected, 
                    [status]: true 
                  })}"
                  @click=${(e: MouseEvent) => this.handleRowClick(session.id, e)}
                  @contextmenu=${(e: MouseEvent) => this.handleContextMenu(session.id, e)}
                >
                  ${this.renderRowCells(session, visibleColumns, { isSelected, status, duration, provider })}
                </tr>
              `;
            })}
          </tbody>
        </table>

        ${when(this.contextMenu, () => this.renderContextMenu())}
      </div>
    `;
  }

  private getVisibleColumns(): SessionListColumn[] {
    // Hide some columns on smaller screens
    if (this.viewportSize === 'mobile') {
      return this.columns.filter(col => 
        ['select', 'status', 'query', 'date', 'cost'].includes(col.key)
      );
    }
    if (this.viewportSize === 'tablet') {
      return this.columns.filter(col => 
        !['tools', 'errors'].includes(col.key)
      );
    }
    return this.columns;
  }

  private renderRowCells(
    session: SessionData, 
    columns: SessionListColumn[], 
    computed: { isSelected: boolean; status: string; duration: number; provider: string }
  ) {
    return repeat(columns, col => col.key, col => {
      const cellClass = `table-cell ${col.align ? `cell-${col.align}` : ''}`;
      
      switch (col.key) {
        case 'select':
          return html`
            <td class="cell-checkbox">
              ${when(this.multiSelect, () => html`
                <input 
                  type="checkbox" 
                  .checked=${computed.isSelected}
                  @change=${(e: Event) => this.handleCheckboxChange(session.id, e)}
                />
              `)}
            </td>
          `;

        case 'status':
          return html`
            <td class="${cellClass}">
              <div class="status-badge ${computed.status}">
                <div class="status-dot ${computed.status}"></div>
                ${computed.status}
              </div>
            </td>
          `;

        case 'query':
          return html`
            <td class="${cellClass}">
              <div class="cell-primary">
                <div class="query-preview">${session.summary || 'Untitled Session'}</div>
              </div>
              <div class="cell-secondary">
                ID: ${session.id.substring(0, 8)}...
              </div>
            </td>
          `;

        case 'provider':
          return html`
            <td class="${cellClass}">
              <div class="provider-icon provider-${computed.provider}"></div>
              ${computed.provider}
            </td>
          `;

        case 'date':
          return html`
            <td class="${cellClass}">
              <div class="cell-primary">
                ${formatTimestamp(new Date(session.startTime).getTime(), 'time')}
              </div>
              <div class="cell-secondary">
                ${formatTimestamp(new Date(session.startTime).getTime(), 'date')}
              </div>
            </td>
          `;

        case 'duration':
          return html`
            <td class="${cellClass}">
              <span class="metric-value metric-duration">
                ${computed.duration > 0 ? formatDuration(computed.duration) : '–'}
              </span>
            </td>
          `;

        case 'requests':
          return html`
            <td class="${cellClass}">
              <span class="metric-value">
                ${this.getRequestCount(session) || 0}
              </span>
            </td>
          `;

        case 'cost':
          return html`
            <td class="${cellClass}">
              <span class="metric-value metric-cost">
                ${this.getSessionCost(session) ? `$${this.getSessionCost(session).toFixed(4)}` : '–'}
              </span>
            </td>
          `;

        case 'tools':
          return html`
            <td class="${cellClass}">
              <span class="metric-value">
                ${this.getToolCount(session) || 0}
              </span>
            </td>
          `;

        case 'errors':
          return html`
            <td class="${cellClass}">
              <span class="metric-value ${this.getErrorCount(session) ? 'metric-error' : ''}">
                ${this.getErrorCount(session) || 0}
              </span>
            </td>
          `;

        default:
          return html`<td class="${cellClass}">–</td>`;
      }
    });
  }

  private renderContextMenu() {
    if (!this.contextMenu) return nothing;

    const { x, y, sessionId } = this.contextMenu;
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return nothing;

    return html`
      <div 
        class="context-menu" 
        style="left: ${x}px; top: ${y}px;"
      >
        <div 
          class="context-menu-item"
          @click=${() => this.handleContextMenuAction('open', sessionId)}
        >
          📖 Open Session
        </div>
        <div 
          class="context-menu-item"
          @click=${() => this.handleContextMenuAction('select', sessionId)}
        >
          ☑️ Select
        </div>
        <div class="context-menu-separator"></div>
        <div 
          class="context-menu-item"
          @click=${() => this.handleContextMenuAction('export', sessionId)}
        >
          💾 Export
        </div>
        <div class="context-menu-separator"></div>
        <div 
          class="context-menu-item danger"
          @click=${() => this.handleContextMenuAction('delete', sessionId)}
        >
          🗑️ Delete
        </div>
      </div>
    `;
  }

  private renderEmptyState() {
    return html`
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No sessions to display</h3>
        <p>Sessions will appear here when they are loaded.</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-list': SessionList;
  }
}