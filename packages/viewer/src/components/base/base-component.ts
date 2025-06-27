import { LitElement, css, html, type CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';

/**
 * Base component class that all opencode-trace components extend.
 * Provides shared functionality, theming, and accessibility features.
 */
export abstract class BaseComponent extends LitElement {
  /**
   * Whether the component is in a loading state
   */
  @property({ type: Boolean, reflect: true })
  loading = false;

  /**
   * Whether the component is disabled
   */
  @property({ type: Boolean, reflect: true })
  disabled = false;

  /**
   * Accessibility label for screen readers
   */
  @property({ type: String, attribute: 'aria-label' })
  ariaLabel: string | null = null;

  /**
   * Theme variant for the component
   */
  @property({ type: String, reflect: true })
  theme: 'dark' | 'light' = 'dark';

  /**
   * Size variant for the component
   */
  @property({ type: String, reflect: true })
  size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Internal error state
   */
  @state()
  protected hasError = false;

  /**
   * Internal error message
   */
  @state()
  protected errorMessage?: string;

  static override styles: CSSResultGroup = css`
    :host {
      /* VS Code theme CSS custom properties */
      --vs-bg: #1e1e1e;
      --vs-bg-secondary: #2d2d30;
      --vs-bg-tertiary: #252526;
      --vs-text: #d4d4d4;
      --vs-text-muted: #8c8c8c;
      --vs-text-subtle: #6a6a6a;
      --vs-accent: #569cd6;
      --vs-accent-hover: #4a8bc2;
      --vs-user: #6a9955;
      --vs-assistant: #ce9178;
      --vs-function: #dcdcaa;
      --vs-type: #4ec9b0;
      --vs-error: #f44747;
      --vs-warning: #ffcc02;
      --vs-success: #4ec9b0;
      --vs-border: #3e3e42;
      --vs-border-focus: #569cd6;
      --vs-hover: #2a2d2e;
      --vs-selection: #264f78;
      --vs-shadow: rgba(0, 0, 0, 0.3);

      /* Component sizing */
      --size-xs: 0.25rem;
      --size-sm: 0.5rem;
      --size-md: 1rem;
      --size-lg: 1.5rem;
      --size-xl: 2rem;
      --size-2xl: 3rem;

      /* Typography */
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      color: var(--vs-text);
      line-height: 1.5;

      /* Base component styles */
      display: block;
      box-sizing: border-box;
    }

    :host([hidden]) {
      display: none !important;
    }

    :host([disabled]) {
      opacity: 0.6;
      pointer-events: none;
      cursor: not-allowed;
    }

    :host([loading]) {
      position: relative;
      pointer-events: none;
    }

    :host([size="small"]) {
      font-size: 0.875rem;
    }

    :host([size="medium"]) {
      font-size: 1rem;
    }

    :host([size="large"]) {
      font-size: 1.125rem;
    }

    /* Focus styles for accessibility */
    :host(:focus-visible) {
      outline: 2px solid var(--vs-border-focus);
      outline-offset: 2px;
    }

    /* Loading spinner */
    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(30, 30, 30, 0.8);
      z-index: 10;
    }

    .spinner {
      width: 1.5rem;
      height: 1.5rem;
      border: 2px solid var(--vs-border);
      border-top: 2px solid var(--vs-accent);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Error state styles */
    .error-message {
      color: var(--vs-error);
      font-size: 0.875rem;
      margin-top: var(--size-sm);
      padding: var(--size-sm);
      background: rgba(244, 71, 71, 0.1);
      border: 1px solid var(--vs-error);
      border-radius: 4px;
    }

    /* Utility classes */
    .vs-bg { background-color: var(--vs-bg); }
    .vs-bg-secondary { background-color: var(--vs-bg-secondary); }
    .vs-bg-tertiary { background-color: var(--vs-bg-tertiary); }
    .vs-text { color: var(--vs-text); }
    .vs-text-muted { color: var(--vs-text-muted); }
    .vs-text-subtle { color: var(--vs-text-subtle); }
    .vs-accent { color: var(--vs-accent); }
    .vs-user { color: var(--vs-user); }
    .vs-assistant { color: var(--vs-assistant); }
    .vs-function { color: var(--vs-function); }
    .vs-type { color: var(--vs-type); }
    .vs-error { color: var(--vs-error); }
    .vs-warning { color: var(--vs-warning); }
    .vs-success { color: var(--vs-success); }
    .vs-border { border-color: var(--vs-border); }
  `;

  /**
   * Handle errors in a consistent way across all components
   */
  protected handleError(error: Error | string, context?: string): void {
    console.error(`[${this.constructor.name}] Error${context ? ` in ${context}` : ''}:`, error);
    this.hasError = true;
    this.errorMessage = typeof error === 'string' ? error : error.message;
    this.requestUpdate();
  }

  /**
   * Clear any error state
   */
  protected clearError(): void {
    this.hasError = false;
    this.errorMessage = undefined;
    this.requestUpdate();
  }

  /**
   * Set loading state
   */
  protected setLoading(loading: boolean): void {
    this.loading = loading;
    this.requestUpdate();
  }

  /**
   * Render loading overlay if component is in loading state
   */
  protected renderLoadingOverlay() {
    if (!this.loading) return html``;
    
    return html`
      <div class="loading-overlay">
        <div class="spinner" role="progressbar" aria-label="Loading..."></div>
      </div>
    `;
  }

  /**
   * Render error message if component has an error
   */
  protected renderError() {
    if (!this.hasError || !this.errorMessage) return html``;
    
    return html`
      <div class="error-message" role="alert" aria-live="polite">
        ${this.errorMessage}
      </div>
    `;
  }

  /**
   * Get accessibility attributes for the component
   */
  protected getA11yAttributes(): Record<string, string> {
    const attrs: Record<string, string> = {};
    
    if (this.ariaLabel) {
      attrs['aria-label'] = this.ariaLabel;
    }
    
    if (this.disabled) {
      attrs['aria-disabled'] = 'true';
    }
    
    if (this.hasError) {
      attrs['aria-invalid'] = 'true';
    }
    
    return attrs;
  }

  /**
   * Emit a custom event with proper bubbling and composition
   */
  protected emitEvent<T = any>(eventName: string, detail?: T, options?: CustomEventInit): void {
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true,
      ...options
    });
    this.dispatchEvent(event);
  }

  /**
   * Abstract render method that must be implemented by subclasses
   */
  abstract render(): unknown;

  /**
   * Called when component connects to DOM
   * Override for component-specific initialization
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', this.getAttribute('role') || 'region');
  }
}