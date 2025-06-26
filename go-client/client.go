package main

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

// TracingHTTPClient wraps http.Client with comprehensive tracing capabilities
type TracingHTTPClient struct {
	client    *http.Client
	logger    *Logger
	config    *TracingConfig
	sessionID string
}

// NewTracingHTTPClient creates a new tracing HTTP client
func NewTracingHTTPClient(sessionID string) *TracingHTTPClient {
	if sessionID == "" {
		// Generate a session ID if not provided
		sessionID = uuid.New().String()
	}

	config := LoadConfig()
	logger := NewLogger(config, sessionID)

	baseClient := &http.Client{
		Timeout: config.Timeout,
	}

	// Wrap the client with tracing middleware
	tracingClient := WrapClient(baseClient, logger, config, sessionID)

	return &TracingHTTPClient{
		client:    tracingClient,
		logger:    logger,
		config:    config,
		sessionID: sessionID,
	}
}

// NewTracingHTTPClientWithConfig creates a new tracing HTTP client with custom config
func NewTracingHTTPClientWithConfig(sessionID string, config *TracingConfig) *TracingHTTPClient {
	if sessionID == "" {
		sessionID = uuid.New().String()
	}

	logger := NewLogger(config, sessionID)

	baseClient := &http.Client{
		Timeout: config.Timeout,
	}

	// Wrap the client with tracing middleware
	tracingClient := WrapClient(baseClient, logger, config, sessionID)

	return &TracingHTTPClient{
		client:    tracingClient,
		logger:    logger,
		config:    config,
		sessionID: sessionID,
	}
}

// GetSessionID returns the session ID
func (t *TracingHTTPClient) GetSessionID() string {
	return t.sessionID
}

// IsEnabled returns whether tracing is enabled
func (t *TracingHTTPClient) IsEnabled() bool {
	return t.config.Enabled
}

// GET performs a GET request
func (t *TracingHTTPClient) Get(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// GetWithContext performs a GET request with context
func (t *TracingHTTPClient) GetWithContext(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// POST performs a POST request
func (t *TracingHTTPClient) Post(url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return t.Do(req)
}

// PostWithContext performs a POST request with context
func (t *TracingHTTPClient) PostWithContext(ctx context.Context, url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return t.Do(req)
}

// PostForm performs a POST request with form data
func (t *TracingHTTPClient) PostForm(url string, data url.Values) (*http.Response, error) {
	return t.Post(url, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
}

// PostFormWithContext performs a POST request with form data and context
func (t *TracingHTTPClient) PostFormWithContext(ctx context.Context, url string, data url.Values) (*http.Response, error) {
	return t.PostWithContext(ctx, url, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
}

// PostJSON performs a POST request with JSON body
func (t *TracingHTTPClient) PostJSON(url string, jsonBody []byte) (*http.Response, error) {
	return t.Post(url, "application/json", bytes.NewReader(jsonBody))
}

// PostJSONWithContext performs a POST request with JSON body and context
func (t *TracingHTTPClient) PostJSONWithContext(ctx context.Context, url string, jsonBody []byte) (*http.Response, error) {
	return t.PostWithContext(ctx, url, "application/json", bytes.NewReader(jsonBody))
}

// PUT performs a PUT request
func (t *TracingHTTPClient) Put(url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPut, url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return t.Do(req)
}

// PutWithContext performs a PUT request with context
func (t *TracingHTTPClient) PutWithContext(ctx context.Context, url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return t.Do(req)
}

// PutJSON performs a PUT request with JSON body
func (t *TracingHTTPClient) PutJSON(url string, jsonBody []byte) (*http.Response, error) {
	return t.Put(url, "application/json", bytes.NewReader(jsonBody))
}

// PutJSONWithContext performs a PUT request with JSON body and context
func (t *TracingHTTPClient) PutJSONWithContext(ctx context.Context, url string, jsonBody []byte) (*http.Response, error) {
	return t.PutWithContext(ctx, url, "application/json", bytes.NewReader(jsonBody))
}

// DELETE performs a DELETE request
func (t *TracingHTTPClient) Delete(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// DeleteWithContext performs a DELETE request with context
func (t *TracingHTTPClient) DeleteWithContext(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// PATCH performs a PATCH request
func (t *TracingHTTPClient) Patch(url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodPatch, url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return t.Do(req)
}

// PatchWithContext performs a PATCH request with context
func (t *TracingHTTPClient) PatchWithContext(ctx context.Context, url, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, url, body)
	if err != nil {
		return nil, err
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return t.Do(req)
}

// HEAD performs a HEAD request
func (t *TracingHTTPClient) Head(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodHead, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// HeadWithContext performs a HEAD request with context
func (t *TracingHTTPClient) HeadWithContext(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// OPTIONS performs an OPTIONS request
func (t *TracingHTTPClient) Options(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodOptions, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// OptionsWithContext performs an OPTIONS request with context
func (t *TracingHTTPClient) OptionsWithContext(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodOptions, url, nil)
	if err != nil {
		return nil, err
	}
	return t.Do(req)
}

// Do executes an HTTP request with tracing
func (t *TracingHTTPClient) Do(req *http.Request) (*http.Response, error) {
	// Add default headers if not present
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "opencode-trace-go-client/1.0")
	}

	// Execute the request through the tracing client
	return t.client.Do(req)
}

// DoWithRetry executes an HTTP request with retry logic
func (t *TracingHTTPClient) DoWithRetry(req *http.Request) (*http.Response, error) {
	var lastErr error
	var resp *http.Response

	// Setup GetBody function if request has a body and GetBody is not set
	if req.Body != nil && req.GetBody == nil {
		if bodyBytes, err := io.ReadAll(req.Body); err == nil {
			req.Body.Close()
			req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			req.GetBody = func() (io.ReadCloser, error) {
				return io.NopCloser(bytes.NewReader(bodyBytes)), nil
			}
		}
	}

	for attempt := 0; attempt <= t.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Wait before retry (exponential backoff)
			backoff := time.Duration(attempt) * time.Second
			time.Sleep(backoff)
		}

		// Clone request for retry (in case body was consumed)
		clonedReq := t.cloneRequest(req)
		
		resp, lastErr = t.Do(clonedReq)
		
		// Check if we should continue retrying
		shouldRetry := lastErr != nil || t.isRetryableError(resp, lastErr)
		if !shouldRetry {
			break
		}

		// Close response body if it exists (to prevent resource leaks)
		if resp != nil && resp.Body != nil {
			resp.Body.Close()
		}
	}

	return resp, lastErr
}

// cloneRequest creates a copy of the request for retries
func (t *TracingHTTPClient) cloneRequest(req *http.Request) *http.Request {
	// Clone the request
	cloned := req.Clone(req.Context())
	
	// If there's a body, we need to handle it carefully
	if req.Body != nil && req.GetBody != nil {
		body, err := req.GetBody()
		if err == nil {
			cloned.Body = body
		}
	}
	
	return cloned
}

// isRetryableError determines if an error/response should be retried
func (t *TracingHTTPClient) isRetryableError(resp *http.Response, err error) bool {
	// Network errors are retryable
	if err != nil {
		return true
	}

	// HTTP status codes that are retryable
	if resp != nil {
		switch resp.StatusCode {
		case http.StatusRequestTimeout,
			http.StatusTooManyRequests,
			http.StatusInternalServerError,
			http.StatusBadGateway,
			http.StatusServiceUnavailable,
			http.StatusGatewayTimeout:
			return true
		}
	}

	return false
}

// Close cleans up the client resources
func (t *TracingHTTPClient) Close() error {
	if t.logger != nil {
		return t.logger.Close()
	}
	return nil
}

// UpdateConfig updates the client configuration
func (t *TracingHTTPClient) UpdateConfig(newConfig *TracingConfig) {
	t.config = newConfig
	t.client.Timeout = newConfig.Timeout

	// Update logger config
	if t.logger != nil {
		t.logger.config = newConfig
	}
}