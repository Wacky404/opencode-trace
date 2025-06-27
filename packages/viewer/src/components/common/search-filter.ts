import { html, css, TemplateResult, type CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/base-component.js';
import type { FilterState, SearchConfig, DateRange, NumberRange, SessionStatus } from '../../types/ui.js';

/**
 * Advanced search and filter component
 * Provides comprehensive filtering capabilities for sessions and events
 */
@customElement('oc-search-filter')
export class SearchFilterComponent extends BaseComponent {
  @property({ type: Object })
  filters: FilterState = {
    providers: [],
    models: [],
    status: [],
    dateRange: {},
    costRange: {},
    durationRange: {},
    hasErrors: null,
    eventTypes: []
  };

  @property({ type: Object })
  config: SearchConfig = {
    placeholder: 'Search sessions...',
    debounceMs: 300,
    minLength: 1,
    caseSensitive: false,
    regex: false,
    fields: ['query', 'provider', 'model']
  };

  @property({ type: Array })
  availableProviders: string[] = [];

  @property({ type: Array })
  availableModels: string[] = [];

  @property({ type: Array })
  availableEventTypes: string[] = [];

  @property({ type: Boolean })
  expanded = false;

  @property({ type: String })
  searchQuery = '';

  @state()
  private searchDebounceTimer?: number;

  @state()
  private activeFilters = 0;

  @state()
  private showAdvanced = false;

  @state()
  private filterPresets: Record<string, Partial<FilterState>> = {
    'recent': {
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        end: new Date()
      }
    },
    'errors': {
      hasErrors: true
    },
    'expensive': {
      costRange: { min: 1 }
    },
    'slow': {
      durationRange: { min: 10000 } // 10+ seconds
    }
  };

  static styles: CSSResultGroup = [
    BaseComponent.styles,
    css`
      :host {
        display: block;
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        overflow: hidden;
      }

      .search-container {
        padding: var(--size-md);
        background: var(--vs-bg);
      }

      .search-header {
        display: flex;
        align-items: center;
        gap: var(--size-sm);
        margin-bottom: var(--size-md);
      }

      .search-input-wrapper {
        position: relative;
        flex: 1;
      }

      .search-input {
        width: 100%;
        padding: var(--size-sm) var(--size-sm) var(--size-sm) 2.5rem;
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 4px;
        color: var(--vs-text);
        font-family: inherit;
        font-size: 0.875rem;
        transition: all 0.2s;
      }

      .search-input:focus {
        outline: none;
        border-color: var(--vs-accent);
        background: var(--vs-bg);
      }

      .search-input::placeholder {
        color: var(--vs-text-muted);
      }

      .search-icon {
        position: absolute;
        left: var(--size-sm);
        top: 50%;
        transform: translateY(-50%);
        color: var(--vs-text-muted);
        font-size: 0.875rem;
      }

      .search-clear {
        position: absolute;
        right: var(--size-sm);
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: var(--vs-text-muted);
        cursor: pointer;
        padding: 2px;
        border-radius: 2px;
        transition: all 0.2s;
      }

      .search-clear:hover {
        color: var(--vs-text);
        background: var(--vs-hover);
      }

      .filter-toggle {
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        color: var(--vs-text-muted);
        padding: var(--size-sm);
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--size-xs);
        font-size: 0.875rem;
        transition: all 0.2s;
        position: relative;
      }

      .filter-toggle:hover {
        color: var(--vs-text);
        border-color: var(--vs-accent);
      }

      .filter-toggle.active {
        background: var(--vs-accent);
        color: white;
        border-color: var(--vs-accent);
      }

      .filter-badge {
        background: var(--vs-error);
        color: white;
        font-size: 0.625rem;
        padding: 1px 4px;
        border-radius: 2px;
        min-width: 16px;
        text-align: center;
        position: absolute;
        top: -6px;
        right: -6px;
      }

      .search-options {
        display: flex;
        gap: var(--size-sm);
        margin-bottom: var(--size-md);
      }

      .search-option {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
        font-size: 0.875rem;
      }

      .search-option input[type="checkbox"] {
        accent-color: var(--vs-accent);
      }

      .quick-filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--size-xs);
        margin-bottom: var(--size-md);
      }

      .quick-filter {
        background: var(--vs-bg-tertiary);
        border: 1px solid var(--vs-border);
        color: var(--vs-text-muted);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .quick-filter:hover {
        border-color: var(--vs-accent);
        color: var(--vs-text);
      }

      .quick-filter.active {
        background: var(--vs-accent);
        color: white;
        border-color: var(--vs-accent);
      }

      .filters-content {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }

      .filters-content.expanded {
        max-height: 2000px;
      }

      .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: var(--size-md);
        padding: var(--size-md);
        background: var(--vs-bg-secondary);
      }

      .filter-group {
        background: var(--vs-bg);
        border: 1px solid var(--vs-border);
        border-radius: 6px;
        padding: var(--size-md);
      }

      .filter-group-title {
        font-weight: 600;
        color: var(--vs-text);
        margin-bottom: var(--size-sm);
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .filter-options {
        display: flex;
        flex-direction: column;
        gap: var(--size-xs);
      }

      .filter-option {
        display: flex;
        align-items: center;
        gap: var(--size-xs);
        font-size: 0.875rem;
        cursor: pointer;
        padding: 2px 0;
      }

      .filter-option:hover {
        color: var(--vs-accent);
      }

      .filter-option input[type="checkbox"] {
        accent-color: var(--vs-accent);
      }

      .filter-option-count {
        color: var(--vs-text-muted);
        font-size: 0.75rem;
        margin-left: auto;
      }

      .range-inputs {
        display: flex;
        gap: var(--size-sm);
        align-items: center;
      }

      .range-input {
        flex: 1;
        padding: 4px 6px;
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 3px;
        color: var(--vs-text);
        font-size: 0.75rem;
      }

      .range-input:focus {
        outline: none;
        border-color: var(--vs-accent);
      }

      .range-separator {
        color: var(--vs-text-muted);
        font-size: 0.75rem;
      }

      .date-inputs {
        display: flex;
        flex-direction: column;
        gap: var(--size-xs);
      }

      .date-input {
        padding: 4px 6px;
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: 3px;
        color: var(--vs-text);
        font-size: 0.75rem;
        width: 100%;
      }

      .date-input:focus {
        outline: none;
        border-color: var(--vs-accent);
      }

      .error-filter {
        display: flex;
        gap: var(--size-sm);
      }

      .error-option {
        flex: 1;
        background: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        color: var(--vs-text-muted);
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        text-align: center;
        font-size: 0.75rem;
        transition: all 0.2s;
      }

      .error-option:hover {
        border-color: var(--vs-accent);
        color: var(--vs-text);
      }

      .error-option.active {
        background: var(--vs-accent);
        color: white;
        border-color: var(--vs-accent);
      }

      .filters-actions {
        display: flex;
        justify-content: space-between;
        padding: var(--size-md);
        background: var(--vs-bg-tertiary);
        border-top: 1px solid var(--vs-border);
      }

      .action-btn {
        background: transparent;
        border: 1px solid var(--vs-border);
        color: var(--vs-text-muted);
        padding: var(--size-xs) var(--size-md);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s;
      }

      .action-btn:hover {
        border-color: var(--vs-accent);
        color: var(--vs-text);
      }

      .action-btn.primary {
        background: var(--vs-accent);
        color: white;
        border-color: var(--vs-accent);
      }

      .action-btn.primary:hover {
        background: var(--vs-accent-hover);
      }

      .active-filters-summary {
        padding: var(--size-sm) var(--size-md);
        background: rgba(86, 156, 214, 0.1);
        border-top: 1px solid var(--vs-border);
        font-size: 0.875rem;
        color: var(--vs-text-muted);
      }

      .filter-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--size-xs);
        margin-top: var(--size-xs);
      }

      .filter-tag {
        background: var(--vs-accent);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        gap: var(--size-xs);
      }

      .filter-tag-remove {
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 0.75rem;
        opacity: 0.8;
      }

      .filter-tag-remove:hover {
        opacity: 1;
      }

      @media (max-width: 768px) {
        .filters-grid {
          grid-template-columns: 1fr;
        }

        .search-header {
          flex-direction: column;
          align-items: stretch;
        }

        .quick-filters {
          justify-content: center;
        }
      }
    `
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateActiveFiltersCount();
  }

  override updated(changedProperties: Map<string, any>): void {
    if (changedProperties.has('filters')) {
      this.updateActiveFiltersCount();
    }
  }

  private updateActiveFiltersCount(): void {
    let count = 0;
    
    if (this.filters.providers.length) count++;
    if (this.filters.models.length) count++;
    if (this.filters.status.length) count++;
    if (this.filters.dateRange.start || this.filters.dateRange.end) count++;
    if (this.filters.costRange.min !== undefined || this.filters.costRange.max !== undefined) count++;
    if (this.filters.durationRange.min !== undefined || this.filters.durationRange.max !== undefined) count++;
    if (this.filters.hasErrors !== null) count++;
    if (this.filters.eventTypes.length) count++;
    
    this.activeFilters = count;
  }

  private handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;
    
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    
    this.searchDebounceTimer = window.setTimeout(() => {
      this.emitSearchChange();
    }, this.config.debounceMs);
  }

  private clearSearch(): void {
    this.searchQuery = '';
    this.emitSearchChange();
  }

  private toggleFilters(): void {
    this.expanded = !this.expanded;
    this.requestUpdate();
  }

  private toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
    this.requestUpdate();
  }

  private applyPreset(presetName: string): void {
    const preset = this.filterPresets[presetName];
    if (preset) {
      this.filters = { ...this.filters, ...preset };
      this.emitFilterChange();
    }
  }

  private toggleProvider(provider: string): void {
    const index = this.filters.providers.indexOf(provider);
    if (index >= 0) {
      this.filters.providers.splice(index, 1);
    } else {
      this.filters.providers.push(provider);
    }
    this.emitFilterChange();
  }

  private toggleModel(model: string): void {
    const index = this.filters.models.indexOf(model);
    if (index >= 0) {
      this.filters.models.splice(index, 1);
    } else {
      this.filters.models.push(model);
    }
    this.emitFilterChange();
  }

  private toggleStatus(status: SessionStatus): void {
    const index = this.filters.status.indexOf(status);
    if (index >= 0) {
      this.filters.status.splice(index, 1);
    } else {
      this.filters.status.push(status);
    }
    this.emitFilterChange();
  }

  private toggleEventType(eventType: string): void {
    const index = this.filters.eventTypes.indexOf(eventType);
    if (index >= 0) {
      this.filters.eventTypes.splice(index, 1);
    } else {
      this.filters.eventTypes.push(eventType);
    }
    this.emitFilterChange();
  }

  private updateDateRange(field: 'start' | 'end', value: string): void {
    if (value) {
      this.filters.dateRange[field] = new Date(value);
    } else {
      delete this.filters.dateRange[field];
    }
    this.emitFilterChange();
  }

  private updateCostRange(field: 'min' | 'max', value: string): void {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      this.filters.costRange[field] = numValue;
    } else {
      delete this.filters.costRange[field];
    }
    this.emitFilterChange();
  }

  private updateDurationRange(field: 'min' | 'max', value: string): void {
    const numValue = parseFloat(value) * 1000; // Convert to ms
    if (!isNaN(numValue)) {
      this.filters.durationRange[field] = numValue;
    } else {
      delete this.filters.durationRange[field];
    }
    this.emitFilterChange();
  }

  private setErrorFilter(value: boolean | null): void {
    this.filters.hasErrors = value;
    this.emitFilterChange();
  }

  private clearAllFilters(): void {
    this.filters = {
      providers: [],
      models: [],
      status: [],
      dateRange: {},
      costRange: {},
      durationRange: {},
      hasErrors: null,
      eventTypes: []
    };
    this.searchQuery = '';
    this.emitFilterChange();
    this.emitSearchChange();
  }

  private removeFilter(type: string, value?: string): void {
    switch (type) {
      case 'provider':
        if (value) this.toggleProvider(value);
        break;
      case 'model':
        if (value) this.toggleModel(value);
        break;
      case 'status':
        if (value) this.toggleStatus(value as SessionStatus);
        break;
      case 'dateRange':
        this.filters.dateRange = {};
        break;
      case 'costRange':
        this.filters.costRange = {};
        break;
      case 'durationRange':
        this.filters.durationRange = {};
        break;
      case 'hasErrors':
        this.filters.hasErrors = null;
        break;
      case 'eventType':
        if (value) this.toggleEventType(value);
        break;
    }
    this.emitFilterChange();
  }

  private emitSearchChange(): void {
    this.emitEvent('search-changed', {
      query: this.searchQuery,
      config: this.config
    });
  }

  private emitFilterChange(): void {
    this.updateActiveFiltersCount();
    this.emitEvent('filters-changed', {
      filters: this.filters
    });
    this.requestUpdate();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private renderFilterTags(): TemplateResult {
    const tags: TemplateResult[] = [];

    // Provider tags
    this.filters.providers.forEach(provider => {
      tags.push(html`
        <div class="filter-tag">
          Provider: ${provider}
          <button class="filter-tag-remove" @click=${() => this.removeFilter('provider', provider)}>
            ×
          </button>
        </div>
      `);
    });

    // Model tags
    this.filters.models.forEach(model => {
      tags.push(html`
        <div class="filter-tag">
          Model: ${model}
          <button class="filter-tag-remove" @click=${() => this.removeFilter('model', model)}>
            ×
          </button>
        </div>
      `);
    });

    // Status tags
    this.filters.status.forEach(status => {
      tags.push(html`
        <div class="filter-tag">
          Status: ${status}
          <button class="filter-tag-remove" @click=${() => this.removeFilter('status', status)}>
            ×
          </button>
        </div>
      `);
    });

    // Date range tag
    if (this.filters.dateRange.start || this.filters.dateRange.end) {
      tags.push(html`
        <div class="filter-tag">
          Date Range
          <button class="filter-tag-remove" @click=${() => this.removeFilter('dateRange')}>
            ×
          </button>
        </div>
      `);
    }

    // Cost range tag
    if (this.filters.costRange.min !== undefined || this.filters.costRange.max !== undefined) {
      tags.push(html`
        <div class="filter-tag">
          Cost Range
          <button class="filter-tag-remove" @click=${() => this.removeFilter('costRange')}>
            ×
          </button>
        </div>
      `);
    }

    // Duration range tag
    if (this.filters.durationRange.min !== undefined || this.filters.durationRange.max !== undefined) {
      tags.push(html`
        <div class="filter-tag">
          Duration Range
          <button class="filter-tag-remove" @click=${() => this.removeFilter('durationRange')}>
            ×
          </button>
        </div>
      `);
    }

    // Error filter tag
    if (this.filters.hasErrors !== null) {
      tags.push(html`
        <div class="filter-tag">
          ${this.filters.hasErrors ? 'With Errors' : 'Without Errors'}
          <button class="filter-tag-remove" @click=${() => this.removeFilter('hasErrors')}>
            ×
          </button>
        </div>
      `);
    }

    return html`${tags}`;
  }

  override render(): TemplateResult {
    return html`
      <div class="search-container">
        <div class="search-header">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              class="search-input"
              placeholder="${this.config.placeholder}"
              .value=${this.searchQuery}
              @input=${this.handleSearchInput}
            />
            ${this.searchQuery ? html`
              <button class="search-clear" @click=${this.clearSearch}>
                ×
              </button>
            ` : ''}
          </div>
          
          <button 
            class="filter-toggle ${this.expanded ? 'active' : ''}"
            @click=${this.toggleFilters}
          >
            🎛️ Filters
            ${this.activeFilters > 0 ? html`
              <span class="filter-badge">${this.activeFilters}</span>
            ` : ''}
          </button>
        </div>

        ${this.config.caseSensitive !== undefined || this.config.regex !== undefined ? html`
          <div class="search-options">
            <label class="search-option">
              <input
                type="checkbox"
                .checked=${this.config.caseSensitive}
                @change=${(e: Event) => {
                  this.config.caseSensitive = (e.target as HTMLInputElement).checked;
                  this.emitSearchChange();
                }}
              />
              Case sensitive
            </label>
            
            <label class="search-option">
              <input
                type="checkbox"
                .checked=${this.config.regex}
                @change=${(e: Event) => {
                  this.config.regex = (e.target as HTMLInputElement).checked;
                  this.emitSearchChange();
                }}
              />
              Regex
            </label>
          </div>
        ` : ''}

        <div class="quick-filters">
          ${Object.keys(this.filterPresets).map(preset => html`
            <button 
              class="quick-filter"
              @click=${() => this.applyPreset(preset)}
            >
              ${preset}
            </button>
          `)}
        </div>
      </div>

      <div class="filters-content ${this.expanded ? 'expanded' : ''}">
        <div class="filters-grid">
          <!-- Providers Filter -->
          <div class="filter-group">
            <div class="filter-group-title">Providers</div>
            <div class="filter-options">
              ${this.availableProviders.map(provider => html`
                <label class="filter-option">
                  <input
                    type="checkbox"
                    .checked=${this.filters.providers.includes(provider)}
                    @change=${() => this.toggleProvider(provider)}
                  />
                  ${provider}
                </label>
              `)}
            </div>
          </div>

          <!-- Models Filter -->
          <div class="filter-group">
            <div class="filter-group-title">Models</div>
            <div class="filter-options">
              ${this.availableModels.map(model => html`
                <label class="filter-option">
                  <input
                    type="checkbox"
                    .checked=${this.filters.models.includes(model)}
                    @change=${() => this.toggleModel(model)}
                  />
                  ${model}
                </label>
              `)}
            </div>
          </div>

          <!-- Status Filter -->
          <div class="filter-group">
            <div class="filter-group-title">Status</div>
            <div class="filter-options">
              ${(['active', 'completed', 'error', 'cancelled'] as SessionStatus[]).map(status => html`
                <label class="filter-option">
                  <input
                    type="checkbox"
                    .checked=${this.filters.status.includes(status)}
                    @change=${() => this.toggleStatus(status)}
                  />
                  ${status}
                </label>
              `)}
            </div>
          </div>

          <!-- Date Range Filter -->
          <div class="filter-group">
            <div class="filter-group-title">Date Range</div>
            <div class="date-inputs">
              <input
                type="date"
                class="date-input"
                placeholder="Start date"
                .value=${this.filters.dateRange.start ? this.formatDate(this.filters.dateRange.start) : ''}
                @change=${(e: Event) => this.updateDateRange('start', (e.target as HTMLInputElement).value)}
              />
              <input
                type="date"
                class="date-input"
                placeholder="End date"
                .value=${this.filters.dateRange.end ? this.formatDate(this.filters.dateRange.end) : ''}
                @change=${(e: Event) => this.updateDateRange('end', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <!-- Cost Range Filter -->
          <div class="filter-group">
            <div class="filter-group-title">Cost Range ($)</div>
            <div class="range-inputs">
              <input
                type="number"
                class="range-input"
                placeholder="Min"
                step="0.01"
                .value=${this.filters.costRange.min?.toString() || ''}
                @change=${(e: Event) => this.updateCostRange('min', (e.target as HTMLInputElement).value)}
              />
              <span class="range-separator">-</span>
              <input
                type="number"
                class="range-input"
                placeholder="Max"
                step="0.01"
                .value=${this.filters.costRange.max?.toString() || ''}
                @change=${(e: Event) => this.updateCostRange('max', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <!-- Duration Range Filter -->
          <div class="filter-group">
            <div class="filter-group-title">Duration (seconds)</div>
            <div class="range-inputs">
              <input
                type="number"
                class="range-input"
                placeholder="Min"
                step="0.1"
                .value=${this.filters.durationRange.min ? (this.filters.durationRange.min / 1000).toString() : ''}
                @change=${(e: Event) => this.updateDurationRange('min', (e.target as HTMLInputElement).value)}
              />
              <span class="range-separator">-</span>
              <input
                type="number"
                class="range-input"
                placeholder="Max"
                step="0.1"
                .value=${this.filters.durationRange.max ? (this.filters.durationRange.max / 1000).toString() : ''}
                @change=${(e: Event) => this.updateDurationRange('max', (e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <!-- Error Filter -->
          <div class="filter-group">
            <div class="filter-group-title">Errors</div>
            <div class="error-filter">
              <button
                class="error-option ${this.filters.hasErrors === null ? 'active' : ''}"
                @click=${() => this.setErrorFilter(null)}
              >
                All
              </button>
              <button
                class="error-option ${this.filters.hasErrors === true ? 'active' : ''}"
                @click=${() => this.setErrorFilter(true)}
              >
                With Errors
              </button>
              <button
                class="error-option ${this.filters.hasErrors === false ? 'active' : ''}"
                @click=${() => this.setErrorFilter(false)}
              >
                No Errors
              </button>
            </div>
          </div>

          <!-- Event Types Filter -->
          ${this.availableEventTypes.length > 0 ? html`
            <div class="filter-group">
              <div class="filter-group-title">Event Types</div>
              <div class="filter-options">
                ${this.availableEventTypes.map(eventType => html`
                  <label class="filter-option">
                    <input
                      type="checkbox"
                      .checked=${this.filters.eventTypes.includes(eventType)}
                      @change=${() => this.toggleEventType(eventType)}
                    />
                    ${eventType}
                  </label>
                `)}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="filters-actions">
          <button class="action-btn" @click=${this.clearAllFilters}>
            Clear All
          </button>
          <button class="action-btn primary" @click=${this.toggleFilters}>
            Apply Filters
          </button>
        </div>
      </div>

      ${this.activeFilters > 0 ? html`
        <div class="active-filters-summary">
          Active filters (${this.activeFilters}):
          <div class="filter-tags">
            ${this.renderFilterTags()}
          </div>
        </div>
      ` : ''}

      ${this.renderLoadingOverlay()}
      ${this.renderError()}
    `;
  }
}