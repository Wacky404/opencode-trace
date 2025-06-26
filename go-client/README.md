# opencode-trace Go HTTP Client Wrapper

A high-performance Go HTTP client wrapper that provides comprehensive request/response tracing and logging capabilities for the opencode-trace project.

## Features

- 🚀 **Full HTTP Method Support**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- 📝 **JSONL Logging**: Structured logging in JSON Lines format
- 🔒 **Sensitive Data Protection**: Automatic sanitization of API keys, tokens, and other sensitive headers
- ⚡ **High Performance**: Minimal overhead with batch processing and async I/O
- 🔄 **Retry Logic**: Built-in exponential backoff retry mechanism
- 🎛️ **Flexible Configuration**: Environment variables and config file support
- 🧪 **Comprehensive Testing**: 100% test coverage with integration tests
- 📊 **Performance Monitoring**: Built-in performance impact measurement

## Quick Start

### Installation

```bash
go get github.com/opencode-trace/go-client
```

### Basic Usage

```go
package main

import (
    "fmt"
    "log"
    "os"
)

func main() {
    // Enable tracing
    os.Setenv("OPENCODE_TRACE", "true")
    
    // Create a tracing client
    client := NewTracingHTTPClient("my-session")
    defer client.Close()
    
    // Make HTTP requests
    resp, err := client.Get("https://api.example.com/data")
    if err != nil {
        log.Fatal(err)
    }
    defer resp.Body.Close()
    
    fmt.Printf("Response status: %d\n", resp.StatusCode)
}
```

### JSON API Example

```go
// POST JSON data
jsonData := []byte(`{"name": "example", "value": 42}`)
resp, err := client.PostJSON("https://api.example.com/items", jsonData)
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()

// PUT JSON data
resp, err = client.PutJSON("https://api.example.com/items/1", jsonData)
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()
```

### Context and Timeout Support

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

resp, err := client.GetWithContext(ctx, "https://api.example.com/slow-endpoint")
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()
```

### Retry Logic

```go
// Configure client with custom retry settings
config := &TracingConfig{
    Enabled:    true,
    MaxRetries: 3,
    Timeout:    30 * time.Second,
}

client := NewTracingHTTPClientWithConfig("retry-session", config)
defer client.Close()

// Create request
req, err := http.NewRequest("GET", "https://api.example.com/unreliable", nil)
if err != nil {
    log.Fatal(err)
}

// Execute with retry logic
resp, err := client.DoWithRetry(req)
if err != nil {
    log.Fatal(err)
}
defer resp.Body.Close()
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCODE_TRACE` | Enable/disable tracing | `false` |
| `OPENCODE_TRACE_DIR` | Output directory for trace files | `.opencode-trace` |
| `OPENCODE_TRACE_MAX_BODY_SIZE` | Maximum body size to capture (bytes) | `1048576` (1MB) |
| `OPENCODE_TRACE_CAPTURE_REQUEST_BODIES` | Capture request bodies | `true` |
| `OPENCODE_TRACE_CAPTURE_RESPONSE_BODIES` | Capture response bodies | `true` |
| `OPENCODE_TRACE_TIMEOUT` | HTTP client timeout | `30s` |
| `OPENCODE_TRACE_MAX_RETRIES` | Maximum retry attempts | `3` |

### Configuration File

Create a JSON configuration file at `~/.opencode/trace-config.json`:

```json
{
  "enabled": true,
  "output_dir": "./custom-trace",
  "max_body_size": 2048,
  "capture_request_bodies": true,
  "capture_response_bodies": true,
  "timeout": "10s",
  "max_retries": 2,
  "sensitive_headers": [
    "authorization",
    "x-api-key",
    "cookie"
  ]
}
```

## Output Format

The client generates JSONL files in the following structure:

```
.opencode-trace/
└── sessions/
    └── 2025-01-15_14-30-45_session-abc123.jsonl
```

### Request Event Format

```json
{
  "type": "http_request",
  "timestamp": 1705327845123,
  "session_id": "abc123",
  "method": "POST",
  "url": "https://api.example.com/data",
  "headers": {
    "content-type": "application/json",
    "authorization": "[REDACTED]"
  },
  "body": "{\"name\": \"example\"}",
  "content_type": "application/json",
  "user_agent": "opencode-trace-go-client/1.0"
}
```

### Response Event Format

```json
{
  "type": "http_response",
  "timestamp": 1705327845456,
  "session_id": "abc123",
  "status_code": 200,
  "status": "200 OK",
  "headers": {
    "content-type": "application/json"
  },
  "body": "{\"id\": 123, \"status\": \"created\"}",
  "response_size": 34,
  "duration_ms": 333,
  "success": true
}
```

## API Reference

### TracingHTTPClient

#### Constructor Methods

- `NewTracingHTTPClient(sessionID string) *TracingHTTPClient`
- `NewTracingHTTPClientWithConfig(sessionID string, config *TracingConfig) *TracingHTTPClient`

#### HTTP Methods

- `Get(url string) (*http.Response, error)`
- `Post(url, contentType string, body io.Reader) (*http.Response, error)`
- `Put(url, contentType string, body io.Reader) (*http.Response, error)`
- `Delete(url string) (*http.Response, error)`
- `Patch(url, contentType string, body io.Reader) (*http.Response, error)`
- `Head(url string) (*http.Response, error)`
- `Options(url string) (*http.Response, error)`

#### Context Methods

- `GetWithContext(ctx context.Context, url string) (*http.Response, error)`
- `PostWithContext(ctx context.Context, url, contentType string, body io.Reader) (*http.Response, error)`
- `PutWithContext(ctx context.Context, url, contentType string, body io.Reader) (*http.Response, error)`
- And more...

#### JSON Convenience Methods

- `PostJSON(url string, jsonBody []byte) (*http.Response, error)`
- `PutJSON(url string, jsonBody []byte) (*http.Response, error)`
- `PostJSONWithContext(ctx context.Context, url string, jsonBody []byte) (*http.Response, error)`
- `PutJSONWithContext(ctx context.Context, url string, jsonBody []byte) (*http.Response, error)`

#### Form Methods

- `PostForm(url string, data url.Values) (*http.Response, error)`
- `PostFormWithContext(ctx context.Context, url string, data url.Values) (*http.Response, error)`

#### Advanced Methods

- `Do(req *http.Request) (*http.Response, error)`
- `DoWithRetry(req *http.Request) (*http.Response, error)`

#### Utility Methods

- `GetSessionID() string`
- `IsEnabled() bool`
- `UpdateConfig(newConfig *TracingConfig)`
- `Close() error`

## Security

### Sensitive Data Protection

The client automatically redacts sensitive information from logs:

- Authorization headers
- API keys
- Cookies
- Bearer tokens
- Custom sensitive headers (configurable)

### Custom Sensitive Headers

```go
config := &TracingConfig{
    SensitiveHeaders: []string{
        "authorization",
        "x-api-key",
        "x-custom-secret",
    },
}
```

## Performance

- **Minimal Overhead**: < 5% performance impact in most scenarios
- **Async I/O**: Non-blocking file operations
- **Batch Processing**: Efficient event queuing and flushing
- **Memory Efficient**: Configurable body size limits

## Testing

Run the comprehensive test suite:

```bash
go test -v
```

Run specific tests:

```bash
go test -v -run TestHTTPMethods
go test -v -run TestRetryLogic
go test -v -run TestPerformanceImpact
```

## Integration with opencode-trace

This Go client integrates seamlessly with the opencode-trace TypeScript logger:

1. **Shared Output Format**: Both components write to the same JSONL format
2. **Session Coordination**: Session IDs can be shared across components
3. **Unified Configuration**: Environment variables work across both implementations

## Examples

See `example_test.go` for comprehensive usage examples covering:

- Basic HTTP requests
- JSON API interactions
- Context and timeouts
- Retry logic
- Configuration management
- Sensitive header handling

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues and questions, please use the GitHub issue tracker.