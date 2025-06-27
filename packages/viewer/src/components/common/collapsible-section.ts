import { html, css, TemplateResult, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';

/**
 * Reusable collapsible section component
 * Provides expandable/collapsible content areas with smooth animations
 */
@customElement('oc-collapsible-section')
export class CollapsibleSection extends BaseComponent {
  @property({ type: String })
  title = '';

  @property({ type: String })
  subtitle = '';

  @property({ type: Boolean, reflect: true })
  expanded = false;

  @property({ type: Boolean })
  collapsible = true;

  @property({ type: String })
  variant: 'default' | 'card' | 'minimal' | 'bordered' = 'default';

  @property({ type: String })
  headerIcon = '';

  @property({ type: String })
  headerBadge = '';

  @property({ type: Boolean })
  showCount = false;

  @property({ type: Number })
  count = 0;

  @property({ type: Boolean })
  enableAnimation = true;

  @property({ type: String })
  expandIcon = '▶';

  @property({ type: String })
  collapseIcon = '▼';

  @state()
  private contentHeight = 0;

  @state()
  private isAnimating = false;

  static styles: CSSResultGroup = [
    BaseComponent.styles,
    css`
      :host {
        display: block;
        overflow: hidden;
      }

      :host([variant="card"]) {
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        overflow: hidden;
      }

      :host([variant="bordered"]) {
        border: 1px solid var(--vs-border);
        border-radius: 4px;
      }

      :host([variant="minimal"]) {
        border-bottom: 1px solid var(--vs-border);
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        padding: var(--size-md);
        background: var(--vs-bg);
        border-bottom: 1px solid transparent;
        transition: all 0.2s ease;
        user-select: none;
      }

      :host([variant="card"]) .section-header {
        background: var(--vs-bg-tertiary);
      }

      :host([variant="minimal"]) .section-header {
        padding: var(--size-sm) 0;
        background: transparent;
      }

      .section-header.clickable {
        cursor: pointer;
      }

      .section-header.clickable:hover {
        background: var(--vs-hover);
      }

      :host([variant="card"]) .section-header.clickable:hover {
        background: var(--vs-bg-secondary);
      }

      :host([expanded]) .section-header {
        border-bottom-color: var(--vs-border);
      }

      .expand-icon {
        color: var(--vs-text-muted);
        font-size: 0.875rem;
        transition: transform 0.2s ease;
        min-width: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .expand-icon.expanded {
        transform: rotate(90deg);
      }

      :host([variant="minimal"]) .expand-icon.expanded {
        transform: rotate(0deg);
      }

      .header-icon {
        color: var(--vs-accent);
        font-size: 1rem;
        min-width: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .header-content {
        flex: 1;
        min-width: 0;
      }

      .section-title {
        font-weight: 600;
        color: var(--vs-text);
        margin: 0;
        font-size: 1rem;
        line-height: 1.4;
      }

      :host([variant="minimal"]) .section-title {
        font-size: 0.875rem;
      }

      .section-subtitle {
        color: var(--vs-text-muted);
        font-size: 0.875rem;
        margin: 2px 0 0 0;
        line-height: 1.3;
      }

      .header-meta {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
      }

      .header-badge {
        background: var(--vs-accent);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 600;
        min-width: 20px;
        text-align: center;
      }

      .header-count {
        background: var(--vs-bg-tertiary);
        color: var(--vs-text-muted);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid var(--vs-border);
      }

      .section-content {
        overflow: hidden;
        transition: max-height 0.3s ease, opacity 0.2s ease;
      }

      .section-content.expanded {
        max-height: none;
        opacity: 1;
      }

      .section-content.collapsed {
        max-height: 0;
        opacity: 0;
      }

      .section-content.no-animate {
        transition: none;
      }

      .content-inner {
        padding: var(--size-md);
      }

      :host([variant="minimal"]) .content-inner {
        padding: var(--size-sm) 0;
      }

      :host([variant="card"]) .content-inner {
        background: var(--vs-bg);
      }

      .content-slot {
        display: block;
      }

      .loading-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--size-xl);
        color: var(--vs-text-muted);
        font-size: 0.875rem;
      }

      .empty-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--size-xl);
        color: var(--vs-text-muted);
        text-align: center;
      }

      .empty-icon {
        font-size: 2rem;
        margin-bottom: var(--size-md);
        opacity: 0.5;
      }

      .empty-title {
        font-weight: 500;
        margin-bottom: var(--size-xs);
      }

      .empty-description {
        font-size: 0.875rem;
        opacity: 0.8;
      }

      /* Animation variants */
      .section-content.slide {
        transition: max-height 0.3s ease, opacity 0.2s ease;
      }

      .section-content.fade {
        transition: opacity 0.3s ease;
      }

      .section-content.scale {
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform-origin: top;
      }

      .section-content.scale.collapsed {
        transform: scaleY(0);
      }

      .section-content.scale.expanded {
        transform: scaleY(1);
      }

      /* Accessibility */
      .section-header:focus-visible {
        outline: 2px solid var(--vs-border-focus);
        outline-offset: 2px;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .section-header {
          padding: var(--size-sm);
        }

        .content-inner {
          padding: var(--size-sm);
        }

        .section-title {
          font-size: 0.875rem;
        }

        .section-subtitle {
          font-size: 0.75rem;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .section-header {
          border: 2px solid var(--vs-border);
        }

        .expand-icon {
          color: var(--vs-text);
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .section-content,
        .expand-icon {
          transition: none;
        }
      }
    `
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    
    // Set initial state
    if (!this.enableAnimation) {
      this.updateComplete.then(() => {
        const content = this.shadowRoot?.querySelector('.section-content') as HTMLElement;
        if (content) {
          content.classList.add('no-animate');
        }
      });
    }
  }

  override updated(changedProperties: Map<string, any>): void {
    super.updated(changedProperties);
    
    if (changedProperties.has('expanded') && this.enableAnimation) {
      this.animateContentChange();
    }
  }

  private async animateContentChange(): Promise<void> {
    if (!this.enableAnimation) return;

    const content = this.shadowRoot?.querySelector('.section-content') as HTMLElement;
    if (!content) return;

    this.isAnimating = true;

    if (this.expanded) {
      // Expanding
      content.style.maxHeight = 'none';
      const height = content.scrollHeight;
      content.style.maxHeight = '0px';
      
      requestAnimationFrame(() => {
        content.style.maxHeight = `${height}px`;
      });

      // Reset max-height after animation
      setTimeout(() => {
        if (this.expanded) {
          content.style.maxHeight = 'none';
        }
        this.isAnimating = false;
      }, 300);
    } else {
      // Collapsing
      const height = content.scrollHeight;
      content.style.maxHeight = `${height}px`;
      
      requestAnimationFrame(() => {
        content.style.maxHeight = '0px';
      });

      setTimeout(() => {
        this.isAnimating = false;
      }, 300);
    }
  }

  private handleHeaderClick(): void {
    if (!this.collapsible) return;
    
    this.expanded = !this.expanded;
    
    this.emitEvent('section-toggle', {
      expanded: this.expanded,
      title: this.title
    });
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.collapsible) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleHeaderClick();
    }
  }

  private getExpandIcon(): string {
    if (!this.collapsible) return '';
    return this.expanded ? (this.collapseIcon || '▼') : (this.expandIcon || '▶');
  }

  private renderHeader(): TemplateResult {
    return html`
      <div 
        class="section-header ${this.collapsible ? 'clickable' : ''}"
        @click=${this.handleHeaderClick}
        @keydown=${this.handleKeyDown}
        tabindex=${this.collapsible ? '0' : '-1'}
        role=${this.collapsible ? 'button' : 'heading'}
        aria-expanded=${this.collapsible ? String(this.expanded) : 'true'}
        aria-label=${this.collapsible ? `${this.expanded ? 'Collapse' : 'Expand'} ${this.title}` : this.title}
      >
        ${this.collapsible ? html`
          <span class="expand-icon ${this.expanded ? 'expanded' : ''}">
            ${this.getExpandIcon()}
          </span>
        ` : ''}
        
        ${this.headerIcon ? html`
          <span class="header-icon">${this.headerIcon}</span>
        ` : ''}
        
        <div class="header-content">
          <h3 class="section-title">${this.title}</h3>
          ${this.subtitle ? html`
            <p class="section-subtitle">${this.subtitle}</p>
          ` : ''}
        </div>
        
        <div class="header-meta">
          ${this.headerBadge ? html`
            <span class="header-badge">${this.headerBadge}</span>
          ` : ''}
          
          ${this.showCount ? html`
            <span class="header-count">${this.count}</span>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderContent(): TemplateResult {
    if (!this.expanded && this.collapsible) {
      return html``;
    }

    return html`
      <div 
        class="section-content ${this.expanded ? 'expanded' : 'collapsed'}"
        role="region"
        aria-labelledby="section-header"
      >
        <div class="content-inner">
          ${this.loading ? html`
            <div class="loading-placeholder">
              <div class="spinner" role="progressbar" aria-label="Loading content..."></div>
              Loading...
            </div>
          ` : html`
            <div class="content-slot">
              <slot></slot>
            </div>
          `}
        </div>
      </div>
    `;
  }

  private renderEmptyState(): TemplateResult {
    return html`
      <div class="empty-placeholder">
        <div class="empty-icon">📁</div>
        <div class="empty-title">No content</div>
        <div class="empty-description">
          This section doesn't have any content to display
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    return html`
      ${this.renderHeader()}
      ${this.renderContent()}
      ${this.renderError()}
    `;
  }

  /**
   * Public API methods
   */
  
  public toggle(): void {
    if (this.collapsible) {
      this.expanded = !this.expanded;
    }
  }

  public expand(): void {
    if (this.collapsible) {
      this.expanded = true;
    }
  }

  public collapse(): void {
    if (this.collapsible) {
      this.expanded = false;
    }
  }

  public setCount(count: number): void {
    this.count = count;
    this.requestUpdate();
  }

  public setBadge(badge: string): void {
    this.headerBadge = badge;
    this.requestUpdate();
  }

  public updateTitle(title: string, subtitle?: string): void {
    this.title = title;
    if (subtitle !== undefined) {
      this.subtitle = subtitle;
    }
    this.requestUpdate();
  }
}