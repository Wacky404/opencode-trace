import { html, css, TemplateResult, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';
import type { TimelineItem, TimelineConfig, SessionData } from '../../types/ui.js';

/**
 * Interactive timeline component for visualizing session events
 * Shows chronological sequence of AI requests, tool executions, and other events
 */
@customElement('oc-session-timeline')
export class SessionTimeline extends BaseComponent {
  @property({ type: Object })
  sessionData?: SessionData;

  @property({ type: Object })
  config: TimelineConfig = {
    showDuration: true,
    showChildren: true,
    collapsible: true,
    maxItems: 100,
    grouping: 'none',
    sortOrder: 'asc'
  };

  @property({ type: Array })
  selectedItems: string[] = [];

  @state()
  private expandedItems = new Set<string>();

  @state()
  private filteredItems: TimelineItem[] = [];

  @state()
  private zoomLevel = 1;

  @state()
  private viewportStart = 0;

  @state()
  private viewportEnd = 0;

  static styles: CSSResultGroup = [
    BaseComponent.styles,
    css`
      :host {
        display: block;
        height: 100%;
        overflow: hidden;
      }

      .timeline-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--vs-bg);
      }

      .timeline-header {
        padding: var(--size-md);
        border-bottom: 1px solid var(--vs-border);
        background: var(--vs-bg-secondary);
      }

      .timeline-controls {
        display: flex;
        align-items: center;
        gap: var(--size-md);
        margin-bottom: var(--size-sm);
      }

      .timeline-stats {
        display: flex;
        gap: var(--size-lg);
        font-size: 0.875rem;
        color: var(--vs-text-muted);
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
      }

      .stat-value {
        color: var(--vs-accent);
        font-weight: 600;
      }

      .timeline-content {
        flex: 1;
        overflow: auto;
        position: relative;
      }

      .timeline-viewport {
        position: relative;
        min-height: 100%;
      }

      .timeline-track {
        position: absolute;
        left: 80px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--vs-border);
      }

      .timeline-items {
        padding: var(--size-md) 0;
      }

      .timeline-item {
        position: relative;
        margin-bottom: var(--size-sm);
        padding-left: 100px;
        min-height: 48px;
        display: flex;
        align-items: flex-start;
      }

      .timeline-item:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .timeline-item.selected {
        background: rgba(86, 156, 214, 0.1);
        border-left: 3px solid var(--vs-accent);
      }

      .timeline-marker {
        position: absolute;
        left: 72px;
        top: 16px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid var(--vs-border);
        background: var(--vs-bg);
        z-index: 2;
      }

      .timeline-marker.success {
        background: var(--vs-success);
        border-color: var(--vs-success);
      }

      .timeline-marker.error {
        background: var(--vs-error);
        border-color: var(--vs-error);
      }

      .timeline-marker.warning {
        background: var(--vs-warning);
        border-color: var(--vs-warning);
      }

      .timeline-marker.info {
        background: var(--vs-accent);
        border-color: var(--vs-accent);
      }

      .timeline-timestamp {
        position: absolute;
        left: 0;
        top: 16px;
        width: 64px;
        font-size: 0.75rem;
        color: var(--vs-text-muted);
        text-align: right;
      }

      .timeline-content-area {
        flex: 1;
        padding: var(--size-sm) var(--size-md);
      }

      .timeline-item-header {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        margin-bottom: var(--size-xs);
      }

      .timeline-item-type {
        font-size: 0.75rem;
        padding: 2px 6px;
        border-radius: 3px;
        background: var(--vs-bg-tertiary);
        color: var(--vs-text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }

      .timeline-item-title {
        font-weight: 600;
        color: var(--vs-text);
        flex: 1;
      }

      .timeline-item-duration {
        font-size: 0.75rem;
        color: var(--vs-text-muted);
        background: var(--vs-bg-tertiary);
        padding: 2px 6px;
        border-radius: 3px;
      }

      .timeline-item-description {
        color: var(--vs-text-muted);
        font-size: 0.875rem;
        margin-bottom: var(--size-xs);
      }

      .timeline-item-actions {
        display: flex;
        gap: var(--size-xs);
        margin-top: var(--size-xs);
      }

      .timeline-action-btn {
        background: transparent;
        border: 1px solid var(--vs-border);
        color: var(--vs-text-muted);
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .timeline-action-btn:hover {
        background: var(--vs-hover);
        color: var(--vs-text);
        border-color: var(--vs-accent);
      }

      .timeline-children {
        margin-top: var(--size-sm);
        padding-left: var(--size-md);
        border-left: 1px solid var(--vs-border);
      }

      .timeline-child-item {
        padding: var(--size-xs) var(--size-sm);
        margin-bottom: var(--size-xs);
        background: var(--vs-bg-tertiary);
        border-radius: 4px;
        font-size: 0.875rem;
      }

      .timeline-child-header {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
        margin-bottom: 2px;
      }

      .timeline-child-title {
        font-weight: 500;
        flex: 1;
      }

      .timeline-child-status {
        font-size: 0.75rem;
        padding: 1px 4px;
        border-radius: 2px;
      }

      .timeline-child-status.success {
        background: rgba(78, 201, 176, 0.2);
        color: var(--vs-success);
      }

      .timeline-child-status.error {
        background: rgba(244, 71, 71, 0.2);
        color: var(--vs-error);
      }

      .timeline-zoom-controls {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
      }

      .zoom-btn {
        background: var(--vs-bg-tertiary);
        border: 1px solid var(--vs-border);
        color: var(--vs-text);
        width: 32px;
        height: 32px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .zoom-btn:hover {
        background: var(--vs-hover);
        border-color: var(--vs-accent);
      }

      .zoom-level {
        font-size: 0.875rem;
        color: var(--vs-text-muted);
        min-width: 60px;
        text-align: center;
      }

      .timeline-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: var(--vs-text-muted);
        text-align: center;
      }

      .timeline-empty-icon {
        font-size: 2rem;
        margin-bottom: var(--size-md);
        opacity: 0.5;
      }

      .expand-btn {
        background: transparent;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        padding: 2px;
        margin-right: var(--size-xs);
        transition: color 0.2s;
      }

      .expand-btn:hover {
        color: var(--vs-accent);
      }

      .expand-btn.expanded {
        transform: rotate(90deg);
      }

      @media (max-width: 768px) {
        .timeline-item {
          padding-left: 60px;
        }

        .timeline-marker {
          left: 44px;
        }

        .timeline-timestamp {
          width: 36px;
          font-size: 0.625rem;
        }

        .timeline-track {
          left: 52px;
        }
      }
    `
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateFilteredItems();
  }

  override updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('sessionData') || changedProperties.has('config')) {
      this.updateFilteredItems();
    }
  }

  private updateFilteredItems(): void {
    if (!this.sessionData?.timeline) {
      this.filteredItems = [];
      return;
    }

    let items = [...this.sessionData.timeline];

    // Apply sorting
    if (this.config.sortOrder === 'desc') {
      items.reverse();
    }

    // Apply max items limit
    if (this.config.maxItems && items.length > this.config.maxItems) {
      items = items.slice(0, this.config.maxItems);
    }

    this.filteredItems = items;
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private formatDuration(duration?: number): string {
    if (!duration) return '';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  }

  private toggleExpanded(itemId: string): void {
    if (this.expandedItems.has(itemId)) {
      this.expandedItems.delete(itemId);
    } else {
      this.expandedItems.add(itemId);
    }
    this.requestUpdate();
  }

  private selectItem(itemId: string, event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey) {
      const index = this.selectedItems.indexOf(itemId);
      if (index >= 0) {
        this.selectedItems.splice(index, 1);
      } else {
        this.selectedItems.push(itemId);
      }
    } else {
      this.selectedItems = [itemId];
    }
    
    this.emitEvent('timeline-selection-changed', {
      selectedItems: this.selectedItems,
      item: this.filteredItems.find(item => item.id === itemId)
    });
    
    this.requestUpdate();
  }

  private handleZoomIn(): void {
    this.zoomLevel = Math.min(this.zoomLevel * 1.5, 5);
    this.requestUpdate();
  }

  private handleZoomOut(): void {
    this.zoomLevel = Math.max(this.zoomLevel / 1.5, 0.5);
    this.requestUpdate();
  }

  private handleZoomReset(): void {
    this.zoomLevel = 1;
    this.requestUpdate();
  }

  private renderTimelineItem(item: TimelineItem): TemplateResult {
    const isExpanded = this.expandedItems.has(item.id);
    const isSelected = this.selectedItems.includes(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return html`
      <div 
        class="timeline-item ${isSelected ? 'selected' : ''}"
        @click=${(e: MouseEvent) => this.selectItem(item.id, e)}
      >
        <div class="timeline-timestamp">
          ${this.formatTimestamp(item.timestamp)}
        </div>
        
        <div class="timeline-marker ${item.status}"></div>
        
        <div class="timeline-content-area">
          <div class="timeline-item-header">
            ${hasChildren && this.config.collapsible ? html`
              <button 
                class="expand-btn ${isExpanded ? 'expanded' : ''}"
                @click=${(e: MouseEvent) => {
                  e.stopPropagation();
                  this.toggleExpanded(item.id);
                }}
                aria-label="${isExpanded ? 'Collapse' : 'Expand'} item"
              >
                ▶
              </button>
            ` : ''}
            
            <span class="timeline-item-type">${item.type.replace('_', ' ')}</span>
            <span class="timeline-item-title">${item.title}</span>
            
            ${this.config.showDuration && item.duration ? html`
              <span class="timeline-item-duration">
                ${this.formatDuration(item.duration)}
              </span>
            ` : ''}
          </div>
          
          ${item.description ? html`
            <div class="timeline-item-description">
              ${item.description}
            </div>
          ` : ''}
          
          <div class="timeline-item-actions">
            <button class="timeline-action-btn" @click=${(e: MouseEvent) => {
              e.stopPropagation();
              this.emitEvent('timeline-item-details', { item });
            }}>
              Details
            </button>
            
            ${item.type === 'ai_request' ? html`
              <button class="timeline-action-btn" @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.emitEvent('timeline-show-request', { item });
              }}>
                Request
              </button>
            ` : ''}
            
            ${item.type === 'tool_execution' ? html`
              <button class="timeline-action-btn" @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.emitEvent('timeline-show-tool', { item });
              }}>
                Tool
              </button>
            ` : ''}
          </div>
          
          ${hasChildren && this.config.showChildren && isExpanded ? html`
            <div class="timeline-children">
              ${item.children!.map(child => this.renderChildItem(child))}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderChildItem(child: TimelineItem): TemplateResult {
    return html`
      <div class="timeline-child-item">
        <div class="timeline-child-header">
          <span class="timeline-child-title">${child.title}</span>
          <span class="timeline-child-status ${child.status}">${child.status}</span>
        </div>
        ${child.description ? html`
          <div style="color: var(--vs-text-muted); font-size: 0.75rem;">
            ${child.description}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderStats(): TemplateResult {
    if (!this.sessionData) return html``;

    const totalEvents = this.filteredItems.length;
    const successEvents = this.filteredItems.filter(item => item.status === 'success').length;
    const errorEvents = this.filteredItems.filter(item => item.status === 'error').length;
    const totalDuration = this.filteredItems.reduce((sum, item) => sum + (item.duration || 0), 0);

    return html`
      <div class="timeline-stats">
        <div class="stat-item">
          <span>Events:</span>
          <span class="stat-value">${totalEvents}</span>
        </div>
        <div class="stat-item">
          <span>Success:</span>
          <span class="stat-value" style="color: var(--vs-success);">${successEvents}</span>
        </div>
        <div class="stat-item">
          <span>Errors:</span>
          <span class="stat-value" style="color: var(--vs-error);">${errorEvents}</span>
        </div>
        <div class="stat-item">
          <span>Duration:</span>
          <span class="stat-value">${this.formatDuration(totalDuration)}</span>
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    if (!this.sessionData || this.filteredItems.length === 0) {
      return html`
        <div class="timeline-container">
          <div class="timeline-empty">
            <div class="timeline-empty-icon">⏱️</div>
            <div>No timeline events to display</div>
            <div style="font-size: 0.875rem; margin-top: var(--size-xs);">
              Timeline events will appear here when session data is loaded
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <div class="timeline-container">
        <div class="timeline-header">
          <div class="timeline-controls">
            <div class="timeline-zoom-controls">
              <button class="zoom-btn" @click=${this.handleZoomOut} title="Zoom Out">
                −
              </button>
              <div class="zoom-level">${Math.round(this.zoomLevel * 100)}%</div>
              <button class="zoom-btn" @click=${this.handleZoomIn} title="Zoom In">
                +
              </button>
              <button class="zoom-btn" @click=${this.handleZoomReset} title="Reset Zoom">
                ⊡
              </button>
            </div>
          </div>
          
          ${this.renderStats()}
        </div>
        
        <div class="timeline-content">
          <div class="timeline-viewport" style="transform: scale(${this.zoomLevel});">
            <div class="timeline-track"></div>
            <div class="timeline-items">
              ${this.filteredItems.map(item => this.renderTimelineItem(item))}
            </div>
          </div>
        </div>
        
        ${this.renderLoadingOverlay()}
        ${this.renderError()}
      </div>
    `;
  }
}