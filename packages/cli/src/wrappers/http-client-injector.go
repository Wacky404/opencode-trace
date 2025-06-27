package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// TracingConfig holds configuration for the tracing client (from Plan v1)
type TracingConfig struct {
	Enabled               bool          `json:"enabled"`
	OutputDir             string        `json:"output_dir"`
	MaxBodySize           int64         `json:"max_body_size"`
	CaptureRequestBodies  bool          `json:"capture_request_bodies"`
	CaptureResponseBodies bool          `json:"capture_response_bodies"`
	SensitiveHeaders      []string      `json:"sensitive_headers"`
	Timeout               time.Duration `json:"timeout"`
	MaxRetries            int           `json:"max_retries"`
	IncludeAllRequests    bool          `json:"include_all_requests"`
	Debug                 bool          `json:"debug"`
	Verbose               bool          `json:"verbose"`
}

// HTTPRequestEvent represents an HTTP request event (from Plan v1)
type HTTPRequestEvent struct {
	Type        string            `json:"type"`
	Timestamp   int64             `json:"timestamp"`
	SessionID   string            `json:"session_id"`
	Method      string            `json:"method"`
	URL         string            `json:"url"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body,omitempty"`
	ContentType string            `json:"content_type,omitempty"`
	UserAgent   string            `json:"user_agent,omitempty"`
}

// HTTPResponseEvent represents an HTTP response event (from Plan v1)
type HTTPResponseEvent struct {
	Type         string            `json:"type"`
	Timestamp    int64             `json:"timestamp"`
	SessionID    string            `json:"session_id"`
	StatusCode   int               `json:"status_code"`
	Status       string            `json:"status"`
	Headers      map[string]string `json:"headers"`
	Body         string            `json:"body,omitempty"`
	ContentType  string            `json:"content_type,omitempty"`
	ResponseSize int64             `json:"response_size"`
	Duration     int64             `json:"duration_ms"`
	Success      bool              `json:"success"`
}

// TracingHTTPClient wraps http.Client with tracing capabilities
type TracingHTTPClient struct {
	client    *http.Client
	sessionID string
	config    TracingConfig
	logFile   *os.File
}

// NewTracingHTTPClient creates a new tracing HTTP client
func NewTracingHTTPClient(sessionID string, config TracingConfig) (*TracingHTTPClient, error) {
	// Create session directory
	sessionDir := filepath.Join(config.OutputDir, "sessions", sessionID)
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create session directory: %v", err)
	}

	// Open log file
	logPath := filepath.Join(sessionDir, "session.jsonl")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %v", err)
	}

	// Create HTTP client with tracing transport
	client := &http.Client{
		Timeout: config.Timeout,
	}

	tracingClient := &TracingHTTPClient{
		client:    client,
		sessionID: sessionID,
		config:    config,
		logFile:   logFile,
	}

	// Replace the transport with our tracing transport
	client.Transport = &TracingTransport{
		base:          http.DefaultTransport,
		tracingClient: tracingClient,
	}

	return tracingClient, nil
}

// TracingTransport wraps http.RoundTripper to add tracing
type TracingTransport struct {
	base          http.RoundTripper
	tracingClient *TracingHTTPClient
}

// RoundTrip implements http.RoundTripper
func (t *TracingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	startTime := time.Now()

	// Capture request
	requestEvent := t.captureRequest(req, startTime)
	t.logEvent(requestEvent)

	// Execute request
	resp, err := t.base.RoundTrip(req)
	endTime := time.Now()

	// Capture response
	if err != nil {
		errorEvent := t.captureError(req, err, startTime, endTime)
		t.logEvent(errorEvent)
		return nil, err
	}

	responseEvent := t.captureResponse(req, resp, startTime, endTime)
	t.logEvent(responseEvent)

	return resp, nil
}

func (t *TracingTransport) captureRequest(req *http.Request, startTime time.Time) HTTPRequestEvent {
	headers := make(map[string]string)
	for key, values := range req.Header {
		if !t.isSensitiveHeader(key) {
			headers[key] = strings.Join(values, ", ")
		} else {
			headers[key] = "[REDACTED]"
		}
	}

	body := ""
	if t.tracingClient.config.CaptureRequestBodies && req.Body != nil {
		bodyBytes, err := io.ReadAll(req.Body)
		if err == nil {
			// Restore body for actual request
			req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			
			// Capture body content
			if len(bodyBytes) <= int(t.tracingClient.config.MaxBodySize) {
				body = string(bodyBytes)
			} else {
				body = string(bodyBytes[:t.tracingClient.config.MaxBodySize]) + "[TRUNCATED]"
			}
		}
	}

	return HTTPRequestEvent{
		Type:        "http_request",
		Timestamp:   startTime.UnixMilli(),
		SessionID:   t.tracingClient.sessionID,
		Method:      req.Method,
		URL:         req.URL.String(),
		Headers:     headers,
		Body:        body,
		ContentType: req.Header.Get("Content-Type"),
		UserAgent:   req.Header.Get("User-Agent"),
	}
}

func (t *TracingTransport) captureResponse(req *http.Request, resp *http.Response, startTime, endTime time.Time) HTTPResponseEvent {
	headers := make(map[string]string)
	for key, values := range resp.Header {
		headers[key] = strings.Join(values, ", ")
	}

	body := ""
	var responseSize int64 = 0

	if t.tracingClient.config.CaptureResponseBodies && resp.Body != nil {
		bodyBytes, err := io.ReadAll(resp.Body)
		if err == nil {
			responseSize = int64(len(bodyBytes))
			
			// Restore body for caller
			resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			
			// Capture body content
			if len(bodyBytes) <= int(t.tracingClient.config.MaxBodySize) {
				body = string(bodyBytes)
			} else {
				body = string(bodyBytes[:t.tracingClient.config.MaxBodySize]) + "[TRUNCATED]"
			}
		}
	}

	return HTTPResponseEvent{
		Type:         "http_response",
		Timestamp:    endTime.UnixMilli(),
		SessionID:    t.tracingClient.sessionID,
		StatusCode:   resp.StatusCode,
		Status:       resp.Status,
		Headers:      headers,
		Body:         body,
		ContentType:  resp.Header.Get("Content-Type"),
		ResponseSize: responseSize,
		Duration:     endTime.Sub(startTime).Milliseconds(),
		Success:      resp.StatusCode >= 200 && resp.StatusCode < 400,
	}
}

func (t *TracingTransport) captureError(req *http.Request, err error, startTime, endTime time.Time) HTTPRequestEvent {
	return HTTPRequestEvent{
		Type:      "http_error",
		Timestamp: endTime.UnixMilli(),
		SessionID: t.tracingClient.sessionID,
		Method:    req.Method,
		URL:       req.URL.String(),
		Body:      fmt.Sprintf("Error: %v", err),
	}
}

func (t *TracingTransport) isSensitiveHeader(key string) bool {
	sensitiveHeaders := []string{
		"authorization", "x-api-key", "x-auth-token", "cookie",
		"x-anthropic-api-key", "openai-api-key", "google-api-key",
	}
	
	keyLower := strings.ToLower(key)
	for _, sensitive := range sensitiveHeaders {
		if keyLower == sensitive || strings.Contains(keyLower, "token") || strings.Contains(keyLower, "key") {
			return true
		}
	}
	return false
}

func (t *TracingTransport) logEvent(event interface{}) {
	if t.tracingClient.logFile == nil {
		return
	}

	jsonData, err := json.Marshal(event)
	if err != nil {
		if t.tracingClient.config.Debug {
			fmt.Fprintf(os.Stderr, "Failed to marshal event: %v\n", err)
		}
		return
	}

	// Write to log file
	if _, err := t.tracingClient.logFile.Write(append(jsonData, '\n')); err != nil {
		if t.tracingClient.config.Debug {
			fmt.Fprintf(os.Stderr, "Failed to write event: %v\n", err)
		}
	}
}

// Close closes the tracing client and flushes logs
func (t *TracingHTTPClient) Close() error {
	if t.logFile != nil {
		return t.logFile.Close()
	}
	return nil
}

// GetClient returns the underlying HTTP client
func (t *TracingHTTPClient) GetClient() *http.Client {
	return t.client
}