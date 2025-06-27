# UI Design Specification

Based on claude-trace's excellent UI design, adapted for opencode sessions.

## Technology Stack

- **Framework**: Lit (Web Components)
- **Language**: TypeScript with strict typing
- **Styling**: Tailwind CSS with VS Code theme colors
- **Build**: tsup for bundling, PostCSS for CSS processing

## Visual Design Theme

### VS Code Dark Theme Colors

```css
:root {
  --vs-bg: #1e1e1e;           /* Main background */
  --vs-bg-secondary: #2d2d30; /* Secondary backgrounds */
  --vs-text: #d4d4d4;         /* Primary text */
  --vs-muted: #8c8c8c;        /* Secondary text */
  --vs-accent: #569cd6;       /* Links/accents */
  --vs-user: #6a9955;         /* User messages */
  --vs-assistant: #ce9178;    /* Assistant messages */
  --vs-function: #dcdcaa;     /* Function names */
  --vs-type: #4ec9b0;         /* Tool names */
  --vs-error: #f44747;        /* Error states */
  --vs-warning: #ffcc02;      /* Warning states */
  --vs-success: #4ec9b0;      /* Success states */
  --vs-border: #3e3e42;       /* Borders */
  --vs-hover: #2a2d2e;        /* Hover states */
  --vs-selection: #264f78;    /* Selection */
}
```

### Typography
- **Font Family**: Monospace (Consolas, Monaco, Courier New)
- **Reading Width**: Max 60em for optimal readability
- **Line Height**: 1.5 for comfortable reading

## Application Structure

### Three-View Architecture

1. **Sessions View** (main) - Processed opencode sessions
2. **Raw Network View** - All HTTP request/response pairs  
3. **Debug View** - Raw JSON data structures

### Navigation Pattern
- Tab-based switching with counts for each view type
- Model filtering with checkbox-style selection
- Search and filtering capabilities

## Core Components

### 1. Main App Component (`OpenCodeTraceApp`)

```typescript
@customElement('opencode-trace-app')
export class OpenCodeTraceApp extends LitElement {
  @state() sessions: OpenCodeSession[] = []
  @state() currentView: 'sessions' | 'network' | 'debug' = 'sessions'
  @state() selectedModels: Set<string> = new Set()
  @state() searchQuery: string = ''
  
  render() {
    return html`
      <div class="trace-app">
        <header class="trace-header">
          <h1>opencode-trace</h1>
          <nav class="view-tabs">
            <button @click=${() => this.currentView = 'sessions'}>
              Sessions (${this.sessions.length})
            </button>
            <button @click=${() => this.currentView = 'network'}>
              Network (${this.getTotalRequests()})
            </button>
            <button @click=${() => this.currentView = 'debug'}>
              Debug
            </button>
          </nav>
        </header>
        
        <main class="trace-content">
          ${this.renderCurrentView()}
        </main>
      </div>
    `
  }
}
```

### 2. Session View Component

```typescript
@customElement('session-view')
export class SessionView extends LitElement {
  @property() session!: OpenCodeSession
  @state() expandedSections: Set<string> = new Set()
  
  render() {
    return html`
      <div class="session-container">
        <div class="session-header">
          <h2>${this.session.userQuery}</h2>
          <div class="session-meta">
            <span class="timestamp">${formatTimestamp(this.session.timestamp)}</span>
            <span class="duration">${formatDuration(this.session.duration)}</span>
            <span class="cost">$${this.session.totalCost.toFixed(4)}</span>
          </div>
        </div>
        
        <div class="session-timeline">
          ${this.renderTimeline()}
        </div>
        
        <div class="session-details">
          ${this.renderToolCalls()}
          ${this.renderNetworkRequests()}
        </div>
      </div>
    `
  }
}
```

### 3. Tool Call Component

```typescript
@customElement('tool-call')
export class ToolCall extends LitElement {
  @property() tool!: ToolExecution
  @state() expanded: boolean = false
  
  render() {
    return html`
      <div class="tool-call ${this.tool.success ? 'success' : 'error'}">
        <div class="tool-header" @click=${this.toggleExpanded}>
          <span class="toggle-icon">${this.expanded ? '[-]' : '[+]'}</span>
          <span class="tool-name">${this.getToolDisplayName()}</span>
          <span class="tool-timing">${this.tool.timing.duration}ms</span>
        </div>
        
        ${this.expanded ? html`
          <div class="tool-content">
            <div class="tool-parameters">
              <h4>Parameters</h4>
              <pre><code>${JSON.stringify(this.tool.parameters, null, 2)}</code></pre>
            </div>
            
            <div class="tool-result">
              <h4>Result</h4>
              ${this.renderToolResult()}
            </div>
          </div>
        ` : ''}
      </div>
    `
  }
  
  private getToolDisplayName(): string {
    switch (this.tool.name) {
      case 'read':
        return `Read(${this.tool.parameters.path})`
      case 'edit':
        return `Edit(${this.tool.parameters.filePath})`
      case 'bash':
        return `Bash: ${this.tool.parameters.command}`
      default:
        return this.tool.name
    }
  }
}
```

### 4. Request Detail Component

```typescript
@customElement('request-detail')
export class RequestDetail extends LitElement {
  @property() request!: NetworkRequest
  @state() showRequestBody: boolean = false
  @state() showResponseBody: boolean = false
  
  render() {
    return html`
      <div class="request-detail">
        <div class="request-summary">
          <span class="method ${this.request.method.toLowerCase()}">${this.request.method}</span>
          <span class="url">${this.request.url}</span>
          <span class="status status-${Math.floor(this.request.response.status / 100)}xx">
            ${this.request.response.status}
          </span>
          <span class="timing">${this.request.timing.duration}ms</span>
        </div>
        
        ${this.renderAIProviderInfo()}
        
        <div class="request-headers">
          <h4>Request Headers</h4>
          ${this.renderHeaders(this.request.headers)}
        </div>
        
        <div class="response-headers">
          <h4>Response Headers</h4>
          ${this.renderHeaders(this.request.response.headers)}
        </div>
        
        ${this.renderRequestBody()}
        ${this.renderResponseBody()}
      </div>
    `
  }
}
```

## UI Patterns

### 1. Collapsible Content System

**Toggle Pattern**: `[+]`/`[-]` indicators for expand/collapse
```css
.collapsible-toggle {
  @apply cursor-pointer select-none hover:bg-vs-hover px-2 py-1 rounded;
}

.collapsible-content {
  @apply overflow-hidden transition-all duration-200;
}

.collapsible-content.collapsed {
  max-height: 0;
}

.collapsible-content.expanded {
  max-height: 1000px; /* or auto */
}
```

### 2. Status Indicators

```css
.trace-status {
  @apply px-2 py-1 rounded text-xs font-medium;
}

.trace-status-success {
  @apply bg-vs-success/20 text-vs-success;
}

.trace-status-error {
  @apply bg-vs-error/20 text-vs-error;
}

.trace-status-warning {
  @apply bg-vs-warning/20 text-vs-warning;
}
```

### 3. Code Display

```css
pre {
  @apply bg-vs-bg-secondary p-4 rounded overflow-x-auto;
}

code {
  @apply bg-vs-bg-secondary px-1 py-0.5 rounded text-sm;
}

.diff-added {
  @apply bg-green-900/30 text-green-300;
}

.diff-removed {
  @apply bg-red-900/30 text-red-300;
}
```

## Specific Features

### 1. Session Timeline

Visual timeline showing chronological flow:
```
User Query: "Add a login form to my React app"
  ↓ 0ms
🔍 Read package.json (50ms)
  ↓ 100ms  
🤖 AI Request: Anthropic Claude (1600ms) - $0.0048
  ↓ 1700ms
✏️ Edit src/LoginForm.tsx (50ms)
  ↓ 1750ms
🔧 Bash: npm install react-hook-form (2000ms)
  ↓ 3750ms
✅ Session Complete (4900ms total)
```

### 2. Tool Visualization Patterns

**File Operations**:
- **Read**: Show file path and content preview
- **Write**: Show file path and content with "click to expand"
- **Edit**: Show diff view with additions/deletions highlighted

**Bash Commands**:
- Show command and output
- Syntax highlighting for common commands
- Error highlighting for failed commands

**AI Requests**:
- Show provider, model, and cost
- Token usage breakdown
- Request/response content with formatting

### 3. Performance Metrics

Dashboard showing:
- Total session duration
- Number of requests by type
- AI API costs breakdown
- Token usage statistics
- File operations count

### 4. Search and Filtering

- **Text Search**: Search across all session content
- **Model Filter**: Filter by AI model used
- **Time Range**: Filter by date/time
- **Status Filter**: Show only errors, successes, etc.
- **Tool Filter**: Filter by specific tools used

## Responsive Design

- **Fixed Width Layout**: `max-w-[60em]` for optimal reading
- **Horizontal Scrolling**: For code blocks and long content
- **Compact Information Density**: Efficient use of vertical space
- **Mobile Considerations**: Collapsible sections work well on mobile

## Accessibility

- **Keyboard Navigation**: All interactive elements accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **High Contrast**: VS Code theme provides good contrast ratios
- **Focus Indicators**: Clear focus states for all interactive elements