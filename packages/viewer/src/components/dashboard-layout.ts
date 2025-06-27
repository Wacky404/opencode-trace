import type { SessionData, TraceEvent } from '../types/trace.js';
import type { ViewportSize } from '../types/ui.js';
import { BaseComponent } from './base/base-component.js';
import { property, state } from 'lit/decorators.js';
import { html, css, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { classMap } from 'lit/directives/class-map.js';

/**
 * Layout configuration interfaces
 */
export interface DashboardLayoutConfig {
  type: 'single' | 'split' | 'tabs' | 'grid' | 'masonry';
  orientation?: 'horizontal' | 'vertical';
  sizes?: number[]; // For split layouts
  responsive?: boolean;
  showSidebar?: boolean;
  sidebarPosition?: 'left' | 'right';
  sidebarWidth?: number;
  showHeader?: boolean;
  showFooter?: boolean;
  maxColumns?: number; // For grid layout
  columnWidth?: number; // For masonry layout
}

/**
 * Panel definition for dashboard
 */
export interface DashboardPanel {
  id: string;
  title: string;
  component: string;
  props?: Record<string, any>;
  size?: 'small' | 'medium' | 'large' | 'full';
  position?: { row?: number; col?: number; span?: number };
  collapsible?: boolean;
  removable?: boolean;
  resizable?: boolean;
  minimized?: boolean;
}

/**
 * Dashboard view modes
 */
export type DashboardViewMode = 
  | 'overview'    // High-level summary with key metrics
  | 'detailed'    // Full session analysis view
  | 'comparison'  // Side-by-side session comparison
  | 'timeline'    // Timeline-focused view
  | 'analytics'   // Analytics-focused dashboard
  | 'custom';     // User-defined layout

/**
 * Layout state interface
 */
export interface LayoutState {
  viewMode: DashboardViewMode;
  config: DashboardLayoutConfig;
  panels: DashboardPanel[];
  selectedSessions: string[];
  sidebarCollapsed: boolean;
  fullscreenPanel?: string;
}

/**
 * Dashboard layout events
 */
export interface DashboardLayoutEvents {
  'layout-changed': { state: LayoutState };
  'panel-added': { panel: DashboardPanel };
  'panel-removed': { panelId: string };
  'panel-resized': { panelId: string; size: { width: number; height: number } };
  'panel-moved': { panelId: string; position: { row: number; col: number } };
  'view-mode-changed': { mode: DashboardViewMode };
  'fullscreen-toggled': { panelId?: string };
}

/**
 * Advanced dashboard layout component for organizing multi-session views
 * Supports multiple layout types, responsive design, and drag-and-drop
 */
@customElement('dashboard-layout')
export class DashboardLayout extends BaseComponent {
  static styles = [
    BaseComponent.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background-color: var(--vs-bg);
        overflow: hidden;
      }

      /* Header */
      .dashboard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-md);
        background-color: var(--vs-bg-secondary);
        border-bottom: 1px solid var(--vs-border);
        flex-shrink: 0;
        z-index: 10;
      }

      .header-title {
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        color: var(--vs-text);
        margin: 0;
      }

      .header-controls {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
      }

      .view-mode-selector {
        display: flex;
        background-color: var(--vs-bg-elevated);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }

      .view-mode-button {
        padding: var(--size-xs) var(--size-md);
        background: none;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        transition: var(--transition-fast);
        font-size: var(--text-sm);
        white-space: nowrap;
      }

      .view-mode-button:hover {
        background-color: var(--vs-hover);
        color: var(--vs-text);
      }

      .view-mode-button.active {
        background-color: var(--vs-accent);
        color: var(--vs-text-inverse);
      }

      .layout-controls {
        display: flex;
        gap: var(--size-xs);
      }

      .layout-button {
        padding: var(--size-xs) var(--size-sm);
        background: none;
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-sm);
        color: var(--vs-text-muted);
        cursor: pointer;
        transition: var(--transition-fast);
        font-size: var(--text-sm);
      }

      .layout-button:hover {
        color: var(--vs-text);
        border-color: var(--vs-border-light);
      }

      .layout-button.active {
        background-color: var(--vs-accent);
        border-color: var(--vs-accent);
        color: var(--vs-text-inverse);
      }

      /* Main Content */
      .dashboard-main {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      /* Sidebar */
      .dashboard-sidebar {
        width: var(--sidebar-width, 280px);
        background-color: var(--vs-sidebar-bg);
        border-right: 1px solid var(--vs-border);
        display: flex;
        flex-direction: column;
        transition: var(--transition-normal);
        z-index: 5;
      }

      .dashboard-sidebar.collapsed {
        width: 48px;
        overflow: hidden;
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-md);
        border-bottom: 1px solid var(--vs-border);
      }

      .sidebar-title {
        font-size: var(--text-md);
        font-weight: var(--font-semibold);
        color: var(--vs-text);
        margin: 0;
      }

      .sidebar-toggle {
        padding: var(--size-xs);
        background: none;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: var(--transition-fast);
      }

      .sidebar-toggle:hover {
        background-color: var(--vs-hover);
        color: var(--vs-text);
      }

      .sidebar-content {
        flex: 1;
        overflow-y: auto;
        padding: var(--size-sm);
      }

      /* Content Area */
      .dashboard-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
      }

      /* Layout Types */
      .layout-single {
        padding: var(--size-md);
        overflow: auto;
      }

      .layout-split {
        display: flex;
        height: 100%;
      }

      .layout-split.horizontal {
        flex-direction: row;
      }

      .layout-split.vertical {
        flex-direction: column;
      }

      .layout-tabs {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .layout-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--size-md);
        padding: var(--size-md);
        overflow: auto;
      }

      .layout-masonry {
        padding: var(--size-md);
        overflow: auto;
      }

      /* Tab Navigation */
      .tab-navigation {
        display: flex;
        background-color: var(--vs-bg-tertiary);
        border-bottom: 1px solid var(--vs-border);
        overflow-x: auto;
      }

      .tab-item {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
        padding: var(--size-sm) var(--size-md);
        background: none;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        transition: var(--transition-fast);
        white-space: nowrap;
        border-bottom: 2px solid transparent;
      }

      .tab-item:hover {
        color: var(--vs-text);
        background-color: var(--vs-hover);
      }

      .tab-item.active {
        color: var(--vs-text);
        border-bottom-color: var(--vs-accent);
        background-color: var(--vs-bg);
      }

      .tab-close {
        margin-left: var(--size-xs);
        padding: 2px;
        background: none;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: var(--transition-fast);
      }

      .tab-close:hover {
        background-color: var(--vs-error);
        color: var(--vs-text-inverse);
      }

      .tab-content {
        flex: 1;
        overflow: hidden;
      }

      /* Panel Container */
      .panel-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        overflow: hidden;
        position: relative;
        transition: var(--transition-fast);
      }

      .panel-container:hover {
        border-color: var(--vs-border-light);
      }

      .panel-container.resizing {
        border-color: var(--vs-accent);
        box-shadow: 0 0 0 1px var(--vs-accent);
      }

      .panel-container.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100;
        border-radius: 0;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-sm) var(--size-md);
        background-color: var(--vs-bg-elevated);
        border-bottom: 1px solid var(--vs-border);
        cursor: grab;
      }

      .panel-header:active {
        cursor: grabbing;
      }

      .panel-title {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--vs-text);
        margin: 0;
      }

      .panel-actions {
        display: flex;
        gap: var(--size-xs);
      }

      .panel-action {
        padding: var(--size-xs);
        background: none;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        border-radius: var(--radius-sm);
        transition: var(--transition-fast);
        font-size: var(--text-xs);
      }

      .panel-action:hover {
        background-color: var(--vs-hover);
        color: var(--vs-text);
      }

      .panel-action.danger:hover {
        background-color: var(--vs-error);
        color: var(--vs-text-inverse);
      }

      .panel-content {
        flex: 1;
        overflow: auto;
        padding: var(--size-md);
      }

      .panel-content.minimized {
        display: none;
      }

      /* Resize Handles */
      .resize-handle {
        position: absolute;
        background-color: transparent;
        z-index: 10;
      }

      .resize-handle:hover {
        background-color: var(--vs-accent);
        opacity: 0.5;
      }

      .resize-handle.horizontal {
        width: 100%;
        height: 4px;
        cursor: ns-resize;
      }

      .resize-handle.vertical {
        width: 4px;
        height: 100%;
        cursor: ew-resize;
      }

      .resize-handle.bottom {
        bottom: 0;
        left: 0;
      }

      .resize-handle.right {
        top: 0;
        right: 0;
      }

      .resize-handle.corner {
        width: 12px;
        height: 12px;
        bottom: 0;
        right: 0;
        cursor: nw-resize;
      }

      /* Split Panes */
      .split-pane {
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      .split-pane:not(:last-child) {
        border-right: 1px solid var(--vs-border);
      }

      .split-pane.vertical:not(:last-child) {
        border-right: none;
        border-bottom: 1px solid var(--vs-border);
      }

      .split-divider {
        position: absolute;
        background-color: var(--vs-border);
        z-index: 10;
        transition: var(--transition-fast);
      }

      .split-divider:hover {
        background-color: var(--vs-accent);
      }

      .split-divider.horizontal {
        width: 100%;
        height: 2px;
        cursor: ns-resize;
      }

      .split-divider.vertical {
        width: 2px;
        height: 100%;
        cursor: ew-resize;
      }

      /* Drag and Drop */
      .drop-zone {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(86, 156, 214, 0.1);
        border: 2px dashed var(--vs-accent);
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--vs-accent);
        font-weight: var(--font-medium);
        z-index: 20;
        opacity: 0;
        pointer-events: none;
        transition: var(--transition-fast);
      }

      .drop-zone.active {
        opacity: 1;
      }

      /* Footer */
      .dashboard-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--size-sm) var(--size-md);
        background-color: var(--vs-bg-secondary);
        border-top: 1px solid var(--vs-border);
        flex-shrink: 0;
        font-size: var(--text-sm);
        color: var(--vs-text-muted);
      }

      .footer-status {
        display: flex;
        align-items: center;
        gap: var(--size-md);
      }

      .footer-actions {
        display: flex;
        gap: var(--size-sm);
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .dashboard-header {
          flex-direction: column;
          gap: var(--size-sm);
          align-items: stretch;
        }

        .header-controls {
          justify-content: center;
        }

        .view-mode-selector {
          width: 100%;
        }

        .view-mode-button {
          flex: 1;
        }

        .dashboard-sidebar {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 20;
          transform: translateX(-100%);
        }

        .dashboard-sidebar.open {
          transform: translateX(0);
        }

        .layout-grid {
          grid-template-columns: 1fr;
        }

        .split-pane {
          min-height: 300px;
        }
      }

      @media (max-width: 480px) {
        .dashboard-header {
          padding: var(--size-sm);
        }

        .panel-container {
          margin: var(--size-xs);
        }

        .panel-content {
          padding: var(--size-sm);
        }

        .layout-controls {
          display: none;
        }
      }

      /* Animation Classes */
      .panel-enter {
        animation: panelEnter var(--transition-normal) ease-out;
      }

      .panel-exit {
        animation: panelExit var(--transition-normal) ease-in;
      }

      @keyframes panelEnter {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes panelExit {
        from {
          opacity: 1;
          transform: scale(1);
        }
        to {
          opacity: 0;
          transform: scale(0.95);
        }
      }

      /* Loading State */
      .layout-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--vs-text-muted);
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--vs-border);
        border-top: 3px solid var(--vs-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: var(--size-md);
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `
  ];

  @property({ type: Array })
  sessions: SessionData[] = [];

  @property({ type: String })
  viewMode: DashboardViewMode = 'overview';

  @property({ type: Object })
  layoutConfig: DashboardLayoutConfig = {
    type: 'single',
    responsive: true,
    showSidebar: true,
    sidebarPosition: 'left',
    showHeader: true,
    showFooter: true,
  };

  @property({ type: Array })
  panels: DashboardPanel[] = [];

  @property({ type: Array })
  selectedSessions: string[] = [];

  @state()
  private sidebarCollapsed = false;

  @state()
  private fullscreenPanel: string | null = null;

  @state()
  private activeTab = 0;

  @state()
  private viewportSize: ViewportSize = 'desktop';

  @state()
  private draggedPanel: DashboardPanel | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.updateViewportSize();
    window.addEventListener('resize', this.handleResize);
    this.initializeDefaultPanels();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.handleResize);
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

  private initializeDefaultPanels() {
    if (this.panels.length === 0) {
      // Set default panels based on view mode
      switch (this.viewMode) {
        case 'overview':
          this.panels = [
            {
              id: 'session-list',
              title: 'Sessions',
              component: 'session-list',
              size: 'large',
              props: { sessions: this.sessions }
            },
            {
              id: 'session-stats',
              title: 'Analytics',
              component: 'session-stats',
              size: 'medium',
              props: { sessions: this.sessions }
            }
          ];
          break;
        case 'analytics':
          this.panels = [
            {
              id: 'session-stats',
              title: 'Analytics Dashboard',
              component: 'session-stats',
              size: 'full',
              props: { sessions: this.sessions, showDetailedMetrics: true }
            }
          ];
          break;
        case 'comparison':
          this.panels = [
            {
              id: 'session-comparison',
              title: 'Session Comparison',
              component: 'session-comparison',
              size: 'full',
              props: { sessions: this.sessions.filter(s => this.selectedSessions.includes(s.id)) }
            }
          ];
          break;
        default:
          this.panels = [
            {
              id: 'session-browser',
              title: 'Session Browser',
              component: 'session-browser',
              size: 'full',
              props: { sessions: this.sessions }
            }
          ];
      }
    }
  }

  private handleViewModeChange(mode: DashboardViewMode) {
    this.viewMode = mode;
    this.initializeDefaultPanels();
    this.emitEvent('view-mode-changed', { mode });
  }

  private handleLayoutTypeChange(type: DashboardLayoutConfig['type']) {
    this.layoutConfig = { ...this.layoutConfig, type };
    this.emitEvent('layout-changed', { state: this.getLayoutState() });
  }

  private toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  private toggleFullscreen(panelId?: string) {
    this.fullscreenPanel = this.fullscreenPanel === panelId ? null : panelId || null;
    this.emitEvent('fullscreen-toggled', { panelId: this.fullscreenPanel || undefined });
  }

  private handlePanelAction(action: string, panelId: string) {
    const panel = this.panels.find(p => p.id === panelId);
    if (!panel) return;

    switch (action) {
      case 'minimize':
        panel.minimized = !panel.minimized;
        this.requestUpdate();
        break;
      case 'fullscreen':
        this.toggleFullscreen(panelId);
        break;
      case 'remove':
        this.panels = this.panels.filter(p => p.id !== panelId);
        this.emitEvent('panel-removed', { panelId });
        this.requestUpdate();
        break;
    }
  }

  private getLayoutState(): LayoutState {
    return {
      viewMode: this.viewMode,
      config: this.layoutConfig,
      panels: this.panels,
      selectedSessions: this.selectedSessions,
      sidebarCollapsed: this.sidebarCollapsed,
      fullscreenPanel: this.fullscreenPanel || undefined,
    };
  }

  render() {
    const showSidebar = this.layoutConfig.showSidebar && this.viewportSize !== 'mobile';
    const fullscreenPanel = this.fullscreenPanel ? this.panels.find(p => p.id === this.fullscreenPanel) : null;

    return html`
      ${when(this.layoutConfig.showHeader && !fullscreenPanel, () => this.renderHeader())}
      
      <div class="dashboard-main">
        ${when(showSidebar && !fullscreenPanel, () => this.renderSidebar())}
        
        <div class="dashboard-content">
          ${this.renderContent()}
        </div>
      </div>

      ${when(this.layoutConfig.showFooter && !fullscreenPanel, () => this.renderFooter())}
      ${when(fullscreenPanel, () => this.renderFullscreenPanel(fullscreenPanel!))}
    `;
  }

  private renderHeader() {
    const viewModes: { key: DashboardViewMode; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'detailed', label: 'Detailed' },
      { key: 'comparison', label: 'Compare' },
      { key: 'timeline', label: 'Timeline' },
      { key: 'analytics', label: 'Analytics' },
    ];

    const layoutTypes: { key: DashboardLayoutConfig['type']; label: string }[] = [
      { key: 'single', label: '⊞' },
      { key: 'split', label: '⊟' },
      { key: 'tabs', label: '⊡' },
      { key: 'grid', label: '⊞' },
    ];

    return html`
      <div class="dashboard-header">
        <h1 class="header-title">Dashboard</h1>
        
        <div class="header-controls">
          <div class="view-mode-selector">
            ${viewModes.map(mode => html`
              <button 
                class="view-mode-button ${classMap({ active: this.viewMode === mode.key })}"
                @click=${() => this.handleViewModeChange(mode.key)}
              >
                ${mode.label}
              </button>
            `)}
          </div>

          <div class="layout-controls">
            ${layoutTypes.map(layout => html`
              <button 
                class="layout-button ${classMap({ active: this.layoutConfig.type === layout.key })}"
                @click=${() => this.handleLayoutTypeChange(layout.key)}
                title="${layout.key} layout"
              >
                ${layout.label}
              </button>
            `)}
          </div>
        </div>
      </div>
    `;
  }

  private renderSidebar() {
    return html`
      <div class="dashboard-sidebar ${classMap({ collapsed: this.sidebarCollapsed })}">
        <div class="sidebar-header">
          <h3 class="sidebar-title">Controls</h3>
          <button class="sidebar-toggle" @click=${this.toggleSidebar}>
            ${this.sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        
        <div class="sidebar-content">
          ${when(!this.sidebarCollapsed, () => html`
            <div class="panel-library">
              <h4>Available Panels</h4>
              <!-- Panel library would go here -->
            </div>
            
            <div class="session-selector">
              <h4>Sessions (${this.selectedSessions.length})</h4>
              <!-- Session selector would go here -->
            </div>
          `)}
        </div>
      </div>
    `;
  }

  private renderContent() {
    switch (this.layoutConfig.type) {
      case 'single':
        return this.renderSingleLayout();
      case 'split':
        return this.renderSplitLayout();
      case 'tabs':
        return this.renderTabsLayout();
      case 'grid':
        return this.renderGridLayout();
      default:
        return this.renderSingleLayout();
    }
  }

  private renderSingleLayout() {
    const mainPanel = this.panels[0];
    if (!mainPanel) {
      return html`
        <div class="layout-loading">
          <div class="loading-spinner"></div>
          Loading dashboard...
        </div>
      `;
    }

    return html`
      <div class="layout-single">
        ${this.renderPanel(mainPanel)}
      </div>
    `;
  }

  private renderSplitLayout() {
    const orientation = this.layoutConfig.orientation || 'horizontal';
    
    return html`
      <div class="layout-split ${orientation}">
        ${this.panels.map((panel, index) => html`
          <div class="split-pane" style="flex: ${this.layoutConfig.sizes?.[index] || 1}">
            ${this.renderPanel(panel)}
          </div>
        `)}
      </div>
    `;
  }

  private renderTabsLayout() {
    return html`
      <div class="layout-tabs">
        <div class="tab-navigation">
          ${this.panels.map((panel, index) => html`
            <button 
              class="tab-item ${classMap({ active: this.activeTab === index })}"
              @click=${() => { this.activeTab = index; }}
            >
              ${panel.title}
              ${when(panel.removable !== false, () => html`
                <button 
                  class="tab-close"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this.handlePanelAction('remove', panel.id);
                  }}
                >
                  ×
                </button>
              `)}
            </button>
          `)}
        </div>
        
        <div class="tab-content">
          ${when(this.panels[this.activeTab], () => this.renderPanel(this.panels[this.activeTab]))}
        </div>
      </div>
    `;
  }

  private renderGridLayout() {
    const maxColumns = this.layoutConfig.maxColumns || 3;
    const gridStyle = `grid-template-columns: repeat(${Math.min(this.panels.length, maxColumns)}, 1fr)`;

    return html`
      <div class="layout-grid" style="${gridStyle}">
        ${this.panels.map(panel => this.renderPanel(panel))}
      </div>
    `;
  }

  private renderPanel(panel: DashboardPanel) {
    const isFullscreen = this.fullscreenPanel === panel.id;
    
    return html`
      <div class="panel-container ${classMap({ 
        fullscreen: isFullscreen,
        minimized: panel.minimized || false 
      })}">
        <div class="panel-header" draggable="true">
          <h3 class="panel-title">${panel.title}</h3>
          
          <div class="panel-actions">
            ${when(panel.collapsible !== false, () => html`
              <button 
                class="panel-action"
                @click=${() => this.handlePanelAction('minimize', panel.id)}
                title="${panel.minimized ? 'Expand' : 'Minimize'}"
              >
                ${panel.minimized ? '□' : '−'}
              </button>
            `)}
            
            <button 
              class="panel-action"
              @click=${() => this.handlePanelAction('fullscreen', panel.id)}
              title="${isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}"
            >
              ${isFullscreen ? '⇱' : '⇲'}
            </button>
            
            ${when(panel.removable !== false, () => html`
              <button 
                class="panel-action danger"
                @click=${() => this.handlePanelAction('remove', panel.id)}
                title="Remove panel"
              >
                ×
              </button>
            `)}
          </div>
        </div>
        
        <div class="panel-content ${classMap({ minimized: panel.minimized || false })}">
          ${this.renderPanelContent(panel)}
        </div>

        ${when(panel.resizable !== false && !isFullscreen, () => html`
          <div class="resize-handle bottom horizontal"></div>
          <div class="resize-handle right vertical"></div>
          <div class="resize-handle corner"></div>
        `)}
      </div>
    `;
  }

  private renderPanelContent(panel: DashboardPanel) {
    // This would dynamically render the appropriate component
    // For now, return a placeholder based on the component type
    switch (panel.component) {
      case 'session-list':
        return html`<session-list .sessions=${this.sessions} .selectedSessions=${new Set(this.selectedSessions)}></session-list>`;
      case 'session-stats':
        return html`<session-stats .sessions=${this.sessions}></session-stats>`;
      case 'session-browser':
        return html`<session-browser .sessions=${this.sessions}></session-browser>`;
      default:
        return html`
          <div class="panel-placeholder">
            <p>Panel: ${panel.component}</p>
            <p>Props: ${JSON.stringify(panel.props, null, 2)}</p>
          </div>
        `;
    }
  }

  private renderFullscreenPanel(panel: DashboardPanel) {
    return html`
      <div class="panel-container fullscreen">
        <div class="panel-header">
          <h3 class="panel-title">${panel.title}</h3>
          <div class="panel-actions">
            <button 
              class="panel-action"
              @click=${() => this.toggleFullscreen()}
              title="Exit fullscreen"
            >
              ⇱
            </button>
          </div>
        </div>
        
        <div class="panel-content">
          ${this.renderPanelContent(panel)}
        </div>
      </div>
    `;
  }

  private renderFooter() {
    return html`
      <div class="dashboard-footer">
        <div class="footer-status">
          <span>${this.panels.length} panels</span>
          <span>${this.sessions.length} sessions</span>
          <span>${this.selectedSessions.length} selected</span>
        </div>
        
        <div class="footer-actions">
          <button class="layout-button" @click=${() => this.toggleSidebar()}>
            ${this.sidebarCollapsed ? 'Show' : 'Hide'} Sidebar
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-layout': DashboardLayout;
  }
}