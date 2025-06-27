import type { SessionData, TraceEvent, MetricsReport } from '../types/trace.js';
import type { ViewportSize } from '../types/ui.js';
import { BaseComponent } from './base/base-component.js';
import { property, state } from 'lit/decorators.js';
import { html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import { classMap } from 'lit/directives/class-map.js';

/**
 * Session browser interface for managing multiple session views
 */
export interface SessionBrowserState {
  sessions: SessionData[];
  selectedSessions: Set<string>;
  currentView: 'list' | 'grid' | 'timeline' | 'analytics';
  searchQuery: string;
  filters: SessionBrowserFilters;
  sortBy: SessionSortField;
  sortOrder: 'asc' | 'desc';
  viewportSize: ViewportSize;
  isLoading: boolean;
  error?: string;
}

/**
 * Filter options for session browser
 */
export interface SessionBrowserFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: Array<'active' | 'completed' | 'error'>;
  providers?: string[];
  costRange?: {
    min: number;
    max: number;
  };
  duration?: {
    min: number; // ms
    max: number; // ms
  };
  hasErrors?: boolean;
  hasTools?: boolean;
}

/**
 * Sort field options for sessions
 */
export type SessionSortField = 
  | 'date' 
  | 'duration' 
  | 'cost' 
  | 'requests' 
  | 'errors' 
  | 'name'
  | 'provider';

/**
 * Session browser events
 */
export interface SessionBrowserEvents {
  'session-selected': { sessionId: string; session: SessionData };
  'sessions-selected': { sessionIds: string[]; sessions: SessionData[] };
  'session-opened': { sessionId: string; session: SessionData };
  'session-compared': { sessionIds: string[]; sessions: SessionData[] };
  'session-exported': { sessionIds: string[]; format: 'json' | 'csv' | 'pdf' };
  'view-changed': { view: SessionBrowserState['currentView'] };
  'filter-changed': { filters: SessionBrowserFilters };
  'sort-changed': { sortBy: SessionSortField; sortOrder: 'asc' | 'desc' };
}

/**
 * Main session browser component for managing multiple trace sessions
 * Provides list, grid, timeline, and analytics views with advanced filtering
 */
@customElement('session-browser')
export class SessionBrowser extends BaseComponent {
  static styles = [
    BaseComponent.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--vs-bg);
        color: var(--vs-text);
      }

      /* Header */
      .browser-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-md);
        background-color: var(--vs-bg-secondary);
        border-bottom: 1px solid var(--vs-border);
        flex-shrink: 0;
      }

      .header-title {
        font-size: var(--text-lg);
        font-weight: var(--font-semibold);
        margin: 0;
      }

      .header-actions {
        display: flex;
        gap: var(--size-sm);
        align-items: center;
      }

      /* Toolbar */
      .browser-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-sm) var(--size-md);
        background-color: var(--vs-bg-tertiary);
        border-bottom: 1px solid var(--vs-border);
        flex-wrap: wrap;
        gap: var(--size-sm);
      }

      .toolbar-section {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
      }

      .view-switcher {
        display: flex;
        background-color: var(--vs-bg-elevated);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }

      .view-button {
        padding: var(--size-xs) var(--size-sm);
        background: none;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        transition: var(--transition-fast);
        font-size: var(--text-sm);
      }

      .view-button:hover {
        background-color: var(--vs-hover);
        color: var(--vs-text);
      }

      .view-button.active {
        background-color: var(--vs-accent);
        color: var(--vs-text-inverse);
      }

      .search-container {
        position: relative;
        flex: 1;
        max-width: 400px;
      }

      .search-input {
        width: 100%;
        padding: var(--size-sm) var(--size-md);
        padding-left: 2.5rem;
        background-color: var(--vs-bg-input);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        color: var(--vs-text);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        transition: var(--transition-fast);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--vs-border-focus);
        box-shadow: 0 0 0 1px var(--vs-border-focus);
      }

      .search-icon {
        position: absolute;
        left: var(--size-sm);
        top: 50%;
        transform: translateY(-50%);
        color: var(--vs-text-muted);
        pointer-events: none;
      }

      /* Content */
      .browser-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Stats Bar */
      .stats-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-sm) var(--size-md);
        background-color: var(--vs-bg-secondary);
        border-bottom: 1px solid var(--vs-border);
        font-size: var(--text-sm);
        color: var(--vs-text-muted);
      }

      .stats-item {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
      }

      .stats-value {
        font-weight: var(--font-medium);
        color: var(--vs-text);
      }

      /* Empty State */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        gap: var(--size-md);
        color: var(--vs-text-muted);
        text-align: center;
      }

      .empty-icon {
        font-size: 3rem;
        opacity: 0.5;
      }

      .empty-title {
        font-size: var(--text-lg);
        font-weight: var(--font-medium);
        margin: 0;
      }

      .empty-description {
        max-width: 400px;
        line-height: var(--leading-relaxed);
      }

      /* Bulk Actions */
      .bulk-actions {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        padding: var(--size-sm) var(--size-md);
        background-color: var(--vs-accent);
        color: var(--vs-text-inverse);
        border-bottom: 1px solid var(--vs-border);
        transform: translateY(-100%);
        transition: transform var(--transition-normal);
      }

      .bulk-actions.visible {
        transform: translateY(0);
      }

      .bulk-count {
        font-weight: var(--font-medium);
      }

      .bulk-button {
        padding: var(--size-xs) var(--size-sm);
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: var(--radius-sm);
        color: var(--vs-text-inverse);
        font-size: var(--text-sm);
        cursor: pointer;
        transition: var(--transition-fast);
      }

      .bulk-button:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .browser-toolbar {
          flex-direction: column;
          align-items: stretch;
        }

        .toolbar-section {
          justify-content: center;
        }

        .search-container {
          max-width: none;
        }

        .stats-bar {
          flex-direction: column;
          gap: var(--size-xs);
          text-align: center;
        }

        .view-switcher {
          width: 100%;
        }

        .view-button {
          flex: 1;
        }
      }

      @media (max-width: 480px) {
        .header-actions {
          flex-direction: column;
          gap: var(--size-xs);
        }

        .bulk-actions {
          flex-direction: column;
          align-items: stretch;
          gap: var(--size-xs);
        }
      }
    `
  ];

  @property({ type: Array })
  sessions: SessionData[] = [];

  @property({ type: String })
  currentView: SessionBrowserState['currentView'] = 'list';

  @property({ type: String })
  searchQuery: string = '';

  @property({ type: Object })
  filters: SessionBrowserFilters = {};

  @property({ type: String })
  sortBy: SessionSortField = 'date';

  @property({ type: String })
  sortOrder: 'asc' | 'desc' = 'desc';

  @property({ type: Boolean })
  multiSelect: boolean = false;

  @state()
  private selectedSessions = new Set<string>();

  @state()
  private filteredSessions: SessionData[] = [];

  @state()
  private viewportSize: ViewportSize = 'desktop';

  @state()
  private showBulkActions = false;

  connectedCallback() {
    super.connectedCallback();
    this.updateViewportSize();
    window.addEventListener('resize', this.handleResize);
    this.filterSessions();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('sessions') || 
        changedProperties.has('searchQuery') || 
        changedProperties.has('filters') ||
        changedProperties.has('sortBy') ||
        changedProperties.has('sortOrder')) {
      this.filterSessions();
    }

    if (changedProperties.has('selectedSessions')) {
      this.showBulkActions = this.selectedSessions.size > 0;
    }
  }

  private handleResize = () => {
    this.updateViewportSize();
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

  private filterSessions() {
    let filtered = [...this.sessions];

    // Apply search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(session => 
        session.summary?.toLowerCase().includes(query) ||
        session.id.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (this.filters.dateRange) {
      filtered = filtered.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= this.filters.dateRange!.start && 
               sessionDate <= this.filters.dateRange!.end;
      });
    }

    if (this.filters.status?.length) {
      filtered = filtered.filter(session => 
        this.filters.status!.includes(this.getSessionStatus(session))
      );
    }

    if (this.filters.providers?.length) {
      filtered = filtered.filter(session => 
        this.filters.providers!.some(provider => 
          session.events?.some(event => 
            event.type === 'ai_request' && 
            (event as any).provider?.toLowerCase().includes(provider.toLowerCase())
          )
        )
      );
    }

    if (this.filters.costRange) {
      filtered = filtered.filter(session => {
        const cost = this.getSessionCost(session);
        return cost >= this.filters.costRange!.min && 
               cost <= this.filters.costRange!.max;
      });
    }

    if (this.filters.duration) {
      filtered = filtered.filter(session => {
        const duration = session.endTime ? session.duration : 0;
        return duration >= this.filters.duration!.min && 
               duration <= this.filters.duration!.max;
      });
    }

    if (this.filters.hasErrors !== undefined) {
      filtered = filtered.filter(session => 
        this.filters.hasErrors ? 
          this.hasErrors(session) : 
          !this.hasErrors(session)
      );
    }

    if (this.filters.hasTools !== undefined) {
      filtered = filtered.filter(session => 
        this.filters.hasTools ? 
          this.hasTools(session) : 
          !this.hasTools(session)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (this.sortBy) {
        case 'date':
          aValue = a.startTime;
          bValue = b.startTime;
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        case 'cost':
          aValue = this.getSessionCost(a);
          bValue = this.getSessionCost(b);
          break;
        case 'requests':
          aValue = this.getRequestCount(a);
          bValue = this.getRequestCount(b);
          break;
        case 'errors':
          aValue = this.getErrorCount(a);
          bValue = this.getErrorCount(b);
          break;
        case 'name':
          aValue = a.summary || '';
          bValue = b.summary || '';
          break;
        case 'provider':
          aValue = this.getPrimaryProvider(a);
          bValue = this.getPrimaryProvider(b);
          break;
        default:
          aValue = a.startTime;
          bValue = b.startTime;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });

    this.filteredSessions = filtered;
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

  private hasErrors(session: SessionData): boolean {
    return this.getErrorCount(session) > 0;
  }

  private hasTools(session: SessionData): boolean {
    return this.getToolCount(session) > 0;
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

  private handleViewChange(view: SessionBrowserState['currentView']) {
    this.currentView = view;
    this.emitEvent('view-changed', { view });
  }

  private handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;
  }

  private handleSessionSelect(sessionId: string, selected: boolean) {
    if (selected) {
      this.selectedSessions.add(sessionId);
    } else {
      this.selectedSessions.delete(sessionId);
    }
    this.requestUpdate();

    const selectedSessionsData = this.sessions.filter(s => this.selectedSessions.has(s.id));
    this.emitEvent('sessions-selected', { 
      sessionIds: Array.from(this.selectedSessions), 
      sessions: selectedSessionsData 
    });
  }

  private handleBulkAction(action: 'compare' | 'export' | 'delete') {
    const selectedSessionsData = this.sessions.filter(s => this.selectedSessions.has(s.id));
    const sessionIds = Array.from(this.selectedSessions);

    switch (action) {
      case 'compare':
        this.emitEvent('session-compared', { sessionIds, sessions: selectedSessionsData });
        break;
      case 'export':
        this.emitEvent('session-exported', { sessionIds, format: 'json' });
        break;
      case 'delete':
        // Emit delete event - parent component handles the actual deletion
        this.emitEvent('sessions-deleted', { sessionIds, sessions: selectedSessionsData });
        break;
    }
  }

  private clearSelection() {
    this.selectedSessions.clear();
    this.requestUpdate();
    this.emitEvent('sessions-selected', { sessionIds: [], sessions: [] });
  }

  render() {
    const hasSelection = this.selectedSessions.size > 0;
    const filteredCount = this.filteredSessions.length;
    const totalCount = this.sessions.length;

    return html`
      <div class="browser-header">
        <h1 class="header-title">Session Browser</h1>
        <div class="header-actions">
          <button class="bulk-button" @click=${() => this.handleBulkAction('export')}>
            Export All
          </button>
        </div>
      </div>

      ${when(hasSelection, () => html`
        <div class="bulk-actions ${classMap({ visible: this.showBulkActions })}">
          <span class="bulk-count">${this.selectedSessions.size} selected</span>
          <button class="bulk-button" @click=${() => this.handleBulkAction('compare')}>
            Compare
          </button>
          <button class="bulk-button" @click=${() => this.handleBulkAction('export')}>
            Export
          </button>
          <button class="bulk-button" @click=${this.clearSelection}>
            Clear
          </button>
        </div>
      `)}

      <div class="browser-toolbar">
        <div class="toolbar-section">
          <div class="view-switcher">
            <button 
              class="view-button ${classMap({ active: this.currentView === 'list' })}"
              @click=${() => this.handleViewChange('list')}
            >
              List
            </button>
            <button 
              class="view-button ${classMap({ active: this.currentView === 'grid' })}"
              @click=${() => this.handleViewChange('grid')}
            >
              Grid
            </button>
            <button 
              class="view-button ${classMap({ active: this.currentView === 'timeline' })}"
              @click=${() => this.handleViewChange('timeline')}
            >
              Timeline
            </button>
            <button 
              class="view-button ${classMap({ active: this.currentView === 'analytics' })}"
              @click=${() => this.handleViewChange('analytics')}
            >
              Analytics
            </button>
          </div>
        </div>

        <div class="toolbar-section">
          <div class="search-container">
            <div class="search-icon">🔍</div>
            <input 
              type="text" 
              class="search-input" 
              placeholder="Search sessions..."
              .value=${this.searchQuery}
              @input=${this.handleSearchInput}
            />
          </div>
        </div>
      </div>

      <div class="stats-bar">
        <div class="stats-item">
          <span>Showing:</span>
          <span class="stats-value">${filteredCount}</span>
          ${when(filteredCount !== totalCount, () => html`
            <span>of ${totalCount}</span>
          `)}
          <span>sessions</span>
        </div>
        ${when(hasSelection, () => html`
          <div class="stats-item">
            <span class="stats-value">${this.selectedSessions.size}</span>
            <span>selected</span>
          </div>
        `)}
      </div>

      <div class="browser-content">
        ${when(this.filteredSessions.length === 0, 
          () => this.renderEmptyState(),
          () => this.renderContent()
        )}
      </div>
    `;
  }

  private renderEmptyState() {
    const hasFilter = this.searchQuery.trim() || Object.keys(this.filters).length > 0;
    
    return html`
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h2 class="empty-title">
          ${hasFilter ? 'No matching sessions' : 'No sessions found'}
        </h2>
        <p class="empty-description">
          ${hasFilter 
            ? 'Try adjusting your search query or filters to find sessions.'
            : 'Start tracing sessions with opencode to see them here.'
          }
        </p>
      </div>
    `;
  }

  private renderContent() {
    // Content rendering will be handled by child components based on currentView
    // This is a placeholder for the actual content
    return html`
      <div class="view-content">
        <!-- Session List/Grid/Timeline/Analytics components will be rendered here -->
        ${when(this.currentView === 'list', () => html`
          <session-list 
            .sessions=${this.filteredSessions}
            .selectedSessions=${this.selectedSessions}
            .multiSelect=${this.multiSelect}
            @session-selected=${(e: CustomEvent) => {
              const { sessionId, selected } = e.detail;
              this.handleSessionSelect(sessionId, selected);
            }}
          ></session-list>
        `)}
        ${when(this.currentView === 'analytics', () => html`
          <session-stats 
            .sessions=${this.filteredSessions}
          ></session-stats>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'session-browser': SessionBrowser;
  }
}