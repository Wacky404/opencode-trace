# opencode-trace CLI

A CLI wrapper for [opencode](https://opencode.ai) that captures comprehensive network traffic during coding sessions and generates beautiful HTML viewers for debugging and analysis.

## Installation

```bash
# Install globally
npm install -g @opencode-trace/cli

# Or use npx
npx @opencode-trace/cli "your prompt here"
```

## Quick Start

```bash
# Basic usage - trace a single prompt
opencode-trace "Create a simple React component"

# With debug output
opencode-trace --debug "Implement user authentication"

# Include all HTTP requests (not just AI APIs)
opencode-trace --include-all "Fix the database connection issue"

# Custom session name and tags
opencode-trace --session-name "auth-feature" --tags "backend,auth" "Add JWT middleware"
```

## Usage

```
opencode-trace [options] <prompt>

Arguments:
  prompt                     The prompt to send to opencode

Options:
  --include-all             Include all HTTP requests in trace (default: false)
  --trace-dir <dir>         Directory for trace files (default: ~/.opencode-trace)
  --non-interactive         Run in non-interactive mode (default: false)
  --continue-session        Continue previous session (default: false)
  --session-id <id>         Specific session ID to use
  --share                   Share session results (default: false)
  --auto-generate-html      Auto-generate HTML viewer (default: true)
  --open-browser            Open browser after generating HTML (default: false)
  --max-body-size <size>    Maximum request/response body size in bytes (default: 1048576)
  --session-name <name>     Custom name for the session
  --tags <tags...>          Tags for categorizing the session
  --debug                   Enable debug output (default: false)
  --verbose                 Enable verbose output (default: false)
  --quiet                   Suppress non-essential output (default: false)
  -h, --help                Display help for command
```

## How It Works

The CLI wrapper uses **HTTP proxy interception** to capture all network traffic:

1. **Starts HTTP Proxy**: Creates a local proxy server (default: `127.0.0.1:8888`)
2. **Configures Environment**: Sets `HTTP_PROXY`/`HTTPS_PROXY` environment variables
3. **Spawns opencode**: Runs opencode with proxy configuration
4. **Captures Traffic**: Intercepts and logs all HTTPS CONNECT requests
5. **Generates Reports**: Creates JSONL trace files and HTML viewers

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   opencode      │───▶│  HTTP Proxy  │───▶│  API Servers    │
│   (Go binary)   │    │  (Node.js)   │    │  (anthropic.com)│
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ Event Logger │
                       │   (JSONL)    │
                       └──────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ HTML Viewer  │
                       │  Generator   │
                       └──────────────┘
```

## Output Files

Each session creates the following files in `~/.opencode-trace/sessions/{sessionId}/`:

- **`trace.jsonl`** - Line-delimited JSON events (requests, responses, timings)
- **`session.html`** - Self-contained HTML viewer with embedded assets
- **`metadata.json`** - Session metadata (start time, configuration, summary)
- **`state.json`** - Internal state and coordination data

## Examples

### Basic Tracing

```bash
# Simple prompt tracing
opencode-trace "Add error handling to the user service"
```

**Output:**
```
🚀 Starting opencode-trace session...
📝 Event logging initialized for session: 2025-06-27T05-18-22-abc123
🌐 HTTP proxy started on 127.0.0.1:8888
✓ All processes spawned successfully
🌐 Proxy event: https_connect_start - https://api.anthropic.com:443
📈 Event processed: https_connect_start (total: 1)
...
📄 Generating HTML viewer...
✅ Session completed successfully

Session Results:
📁 Trace File: ~/.opencode-trace/sessions/2025-06-27T05-18-22-abc123/trace.jsonl
🌐 HTML Viewer: ~/.opencode-trace/sessions/2025-06-27T05-18-22-abc123/session.html
📊 Events Captured: 24 (6 duplicates filtered)
⏱️  Duration: 45.2s
```

### Debug Mode

```bash
# Enable detailed debug output
opencode-trace --debug "Optimize database queries"
```

**Additional Debug Output:**
```
[proxy] CONNECT api.anthropic.com:443
[proxy] https_connect_start: CONNECT https://api.anthropic.com:443
🌐 Proxy event: https_connect_start - https://api.anthropic.com:443
📝 Logging event: https_connect_start
🔄 Processing event: https_connect_start
💾 Writing event to JSONL: https_connect_start
📈 Event processed: https_connect_start (total: 1)
```

### Include All Requests

```bash
# Capture all HTTP traffic, not just AI APIs
opencode-trace --include-all "Set up CI/CD pipeline"
```

This will also capture:
- Package registry requests (`registry.npmjs.org`)
- GitHub API calls (`api.github.com`)
- Documentation lookups (`docs.github.com`)
- Any other HTTP/HTTPS traffic

### Custom Session Configuration

```bash
# Organized session with metadata
opencode-trace \
  --session-name "frontend-refactor" \
  --tags "react" "typescript" "ui" \
  --trace-dir "./project-traces" \
  "Refactor the user dashboard components"
```

### Non-Interactive Mode

```bash
# For CI/CD or automated workflows
opencode-trace \
  --non-interactive \
  --quiet \
  --auto-generate-html \
  "Run tests and fix any failures"
```

## Advanced Usage

### Session Management

```bash
# Continue a previous session
opencode-trace --continue-session --session-id "2025-06-27T05-18-22-abc123" "Additional improvements"

# Custom trace directory
opencode-trace --trace-dir "/project/traces" "Debug the API integration"
```

### Output Control

```bash
# Generate HTML and open in browser
opencode-trace --open-browser "Create API documentation"

# Large request bodies (10MB limit)
opencode-trace --max-body-size 10485760 "Process large file uploads"

# Minimal output
opencode-trace --quiet "Quick syntax fix"
```

## Configuration File

Create `~/.opencode-trace/config.json` for default settings:

```json
{
  "traceDir": "~/dev/traces",
  "includeAllRequests": false,
  "autoGenerateHTML": true,
  "maxBodySize": 2097152,
  "tags": ["development"],
  "debug": false,
  "verbose": false
}
```

## Troubleshooting

### Port Conflicts

If port 8888 is in use, the CLI will automatically find an available port:

```
⚠️  Port 8888 in use, trying 8889...
🌐 HTTP proxy started on 127.0.0.1:8889
```

### Permission Issues

```bash
# If you get permission errors, try:
sudo npm install -g @opencode-trace/cli

# Or use npx (no global install required):
npx @opencode-trace/cli "your prompt"
```

### Empty Trace Files

If trace files are empty, check:

1. **opencode version**: Ensure you have opencode v0.1.150+
2. **Network connectivity**: Verify opencode can reach AI APIs
3. **Proxy bypass**: Some corporate networks may bypass HTTP_PROXY

```bash
# Test proxy connectivity
opencode-trace --debug "test prompt"
# Look for: "🌐 Proxy event: https_connect_start"
```

### Debug Mode

Always use `--debug` when troubleshooting:

```bash
opencode-trace --debug "your prompt"
```

This shows:
- Proxy server startup
- HTTP CONNECT requests
- Event processing pipeline
- File generation steps

## Integration

### CI/CD Pipelines

```yaml
# GitHub Actions example
- name: Trace opencode session
  run: |
    npx @opencode-trace/cli \
      --non-interactive \
      --session-name "ci-${{ github.run_number }}" \
      --tags "ci" "automated" \
      "Review and improve code quality"
    
    # Upload trace files as artifacts
    - uses: actions/upload-artifact@v3
      with:
        name: opencode-traces
        path: ~/.opencode-trace/sessions/
```

### Development Workflows

```bash
# Morning standup prep
opencode-trace --session-name "standup-$(date +%Y%m%d)" "Summarize yesterday's progress and today's goals"

# Code review assistance  
opencode-trace --tags "review" "Review the pull request and suggest improvements"

# Debugging session
opencode-trace --debug --session-name "bug-investigation" "Investigate the memory leak in the user service"
```

## API Reference

The CLI also exposes programmatic APIs for integration:

```typescript
import { runCLI, createDefaultConfig } from '@opencode-trace/cli';

const config = createDefaultConfig();
config.debug = true;
config.sessionName = 'automated-session';

const result = await runCLI(config);
console.log(`Session completed: ${result.sessionId}`);
console.log(`Trace file: ${result.traceFile}`);
console.log(`HTML viewer: ${result.htmlFile}`);
```

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) for details.