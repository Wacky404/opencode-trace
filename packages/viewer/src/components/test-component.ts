import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from './base/base-component.js';

/**
 * Test component to verify our foundation is working
 * This demonstrates the VS Code theme, Lit integration, and accessibility features
 */
@customElement('oc-test-component')
export class TestComponent extends BaseComponent {
  @property({ type: String })
  message = 'Hello from opencode-trace!';

  static get styles() {
    return [
      BaseComponent.styles,
      css`
      :host {
        display: block;
        padding: var(--size-lg);
      }

      .test-container {
        max-width: 600px;
        margin: 0 auto;
      }

      .test-header {
        margin-bottom: var(--size-lg);
        padding-bottom: var(--size-md);
        border-bottom: 1px solid var(--vs-border);
      }

      .test-title {
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        margin: 0 0 var(--size-sm) 0;
      }

      .test-subtitle {
        color: var(--vs-text-muted);
        margin: 0;
      }

      .test-section {
        margin-bottom: var(--size-xl);
        padding: var(--size-lg);
        background-color: var(--vs-bg-secondary);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-lg);
      }

      .test-section h3 {
        margin: 0 0 var(--size-md) 0;
        color: var(--vs-accent);
        font-size: var(--text-lg);
      }

      .color-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--size-sm);
        margin-top: var(--size-md);
      }

      .color-swatch {
        padding: var(--size-md);
        border-radius: var(--radius-md);
        text-align: center;
        font-size: var(--text-sm);
        border: 1px solid var(--vs-border);
      }

      .btn-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--size-sm);
        margin-top: var(--size-md);
      }

      .test-code {
        background-color: var(--vs-code-bg);
        border: 1px solid var(--vs-border);
        border-radius: var(--radius-md);
        padding: var(--size-md);
        margin-top: var(--size-md);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        overflow-x: auto;
      }

      .syntax-keyword { color: var(--vs-keyword); }
      .syntax-string { color: var(--vs-string); }
      .syntax-function { color: var(--vs-function); }
      .syntax-comment { color: var(--vs-comment); }
      `
    ];
  }

  render() {
    return html`
      <div class="test-container">
        <header class="test-header">
          <h1 class="test-title vs-text">${this.message}</h1>
          <p class="test-subtitle">
            Phase 3 Foundation Test - VS Code Theme, Lit Components & Accessibility
          </p>
        </header>

        <section class="test-section">
          <h3>🎨 VS Code Theme Colors</h3>
          <p class="vs-text-muted">
            Our complete VS Code theme system with all color variables
          </p>
          <div class="color-grid">
            <div class="color-swatch vs-bg-tertiary vs-text">
              Background
            </div>
            <div class="color-swatch" style="background-color: var(--vs-accent); color: white;">
              Accent
            </div>
            <div class="color-swatch" style="background-color: var(--vs-success); color: white;">
              Success
            </div>
            <div class="color-swatch" style="background-color: var(--vs-error); color: white;">
              Error
            </div>
            <div class="color-swatch" style="background-color: var(--vs-warning); color: black;">
              Warning
            </div>
            <div class="color-swatch" style="background-color: var(--vs-user); color: white;">
              User
            </div>
            <div class="color-swatch" style="background-color: var(--vs-assistant); color: white;">
              Assistant
            </div>
            <div class="color-swatch" style="background-color: var(--vs-function); color: black;">
              Function
            </div>
          </div>
        </section>

        <section class="test-section">
          <h3>🚀 Tailwind Integration</h3>
          <p class="vs-text-muted">
            Custom Tailwind configuration with VS Code theme integration
          </p>
          <div class="btn-grid">
            <button class="btn-vs">Primary Button</button>
            <button class="btn-vs btn-vs-secondary">Secondary Button</button>
            <input class="input-vs" placeholder="Test input field" />
          </div>
        </section>

        <section class="test-section">
          <h3>⚡ Lit Components</h3>
          <p class="vs-text-muted">
            Modern Lit 3.0 web components with TypeScript
          </p>
          <div class="test-code">
            <span class="syntax-keyword">import</span> { <span class="syntax-function">html</span>, <span class="syntax-function">css</span> } <span class="syntax-keyword">from</span> <span class="syntax-string">'lit'</span>;<br>
            <span class="syntax-keyword">import</span> { <span class="syntax-function">BaseComponent</span> } <span class="syntax-keyword">from</span> <span class="syntax-string">'./base/base-component.js'</span>;<br><br>
            <span class="syntax-comment">// Beautiful VS Code themed components!</span>
          </div>
        </section>

        <section class="test-section">
          <h3>♿ Accessibility</h3>
          <p class="vs-text-muted">
            WCAG 2.1 AA compliant with screen reader support
          </p>
          <div>
            <button 
              class="btn-vs"
              aria-label="Test accessibility features"
              @click=${this.handleA11yTest}
            >
              Test Screen Reader
            </button>
            <button 
              class="btn-vs btn-vs-secondary"
              @click=${this.handleFocusTest}
              style="margin-left: var(--size-sm);"
            >
              Test Focus Management
            </button>
          </div>
        </section>

        <section class="test-section">
          <h3>📊 Component Status</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--size-md);">
            <div>
              <strong class="vs-success">✅ Base Components</strong><br>
              <small class="vs-text-muted">BaseComponent, utilities</small>
            </div>
            <div>
              <strong class="vs-success">✅ VS Code Theme</strong><br>
              <small class="vs-text-muted">Complete color system</small>
            </div>
            <div>
              <strong class="vs-success">✅ Tailwind Integration</strong><br>
              <small class="vs-text-muted">Custom configuration</small>
            </div>
            <div>
              <strong class="vs-success">✅ TypeScript Types</strong><br>
              <small class="vs-text-muted">UI and data types</small>
            </div>
            <div>
              <strong class="vs-success">✅ Accessibility</strong><br>
              <small class="vs-text-muted">WCAG 2.1 AA compliant</small>
            </div>
            <div>
              <strong class="vs-info">🔄 Build Pipeline</strong><br>
              <small class="vs-text-muted">Testing in progress</small>
            </div>
          </div>
        </section>

        ${this.renderLoadingOverlay()}
        ${this.renderError()}
      </div>
    `;
  }

  private async handleA11yTest(): Promise<void> {
    const { ScreenReader } = await import('../utils/accessibility.js');
    ScreenReader.announce('Accessibility test successful! Screen reader integration working.');
  }

  private async handleFocusTest(): Promise<void> {
    const { FocusManager } = await import('../utils/accessibility.js');
    const firstButton = this.shadowRoot?.querySelector('button') as HTMLElement;
    if (firstButton) {
      FocusManager.moveFocus(firstButton);
      setTimeout(() => FocusManager.restoreFocus(), 2000);
    }
  }
}