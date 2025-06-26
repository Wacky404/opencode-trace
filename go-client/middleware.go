package main

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"time"
)

// TracingRoundTripper wraps http.RoundTripper to capture requests and responses
type TracingRoundTripper struct {
	wrapped   http.RoundTripper
	logger    *Logger
	config    *TracingConfig
	sessionID string
}

// NewTracingRoundTripper creates a new tracing round tripper
func NewTracingRoundTripper(wrapped http.RoundTripper, logger *Logger, config *TracingConfig, sessionID string) *TracingRoundTripper {
	if wrapped == nil {
		wrapped = http.DefaultTransport
	}

	return &TracingRoundTripper{
		wrapped:   wrapped,
		logger:    logger,
		config:    config,
		sessionID: sessionID,
	}
}

// RoundTrip implements http.RoundTripper interface with tracing
func (t *TracingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if !t.config.Enabled {
		return t.wrapped.RoundTrip(req)
	}

	// Capture request
	requestCapture, err := t.captureRequest(req)
	if err != nil {
		// Log error but continue with request
		t.logger.LogError(err, "request capture failed")
	} else {
		// Log request event
		if err := t.logger.LogHTTPRequest(requestCapture); err != nil {
			// Don't fail the request if logging fails
			t.logger.LogError(err, "failed to log HTTP request")
		}
	}

	// Execute the actual request
	startTime := time.Now()
	resp, err := t.wrapped.RoundTrip(req)
	endTime := time.Now()
	duration := endTime.Sub(startTime)

	// Capture response (even if there was an error)
	if resp != nil {
		responseCapture, captureErr := t.captureResponse(resp, endTime, duration, err == nil)
		if captureErr != nil {
			t.logger.LogError(captureErr, "response capture failed")
		} else {
			// Log response event
			if logErr := t.logger.LogHTTPResponse(responseCapture); logErr != nil {
				t.logger.LogError(logErr, "failed to log HTTP response")
			}
		}
	}

	// Log error if request failed
	if err != nil {
		t.logger.LogError(err, "HTTP request failed")
	}

	return resp, err
}

// captureRequest captures request data for logging
func (t *TracingRoundTripper) captureRequest(req *http.Request) (*RequestCapture, error) {
	capture := &RequestCapture{
		StartTime: time.Now(),
		Method:    req.Method,
		URL:       req.URL.String(),
		Headers:   make(map[string]string),
	}

	// Capture headers
	for key, values := range req.Header {
		if len(values) > 0 {
			capture.Headers[key] = values[0] // Take first value
		}
	}

	// Extract common headers
	capture.ContentType = req.Header.Get("Content-Type")
	capture.UserAgent = req.Header.Get("User-Agent")

	// Capture request body if enabled
	if t.config.CaptureRequestBodies && req.Body != nil {
		bodyBytes, err := t.readBody(req.Body, t.config.MaxBodySize)
		if err != nil {
			return nil, err
		}

		capture.Body = bodyBytes

		// Restore body for the actual request
		req.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	}

	return capture, nil
}

// captureResponse captures response data for logging
func (t *TracingRoundTripper) captureResponse(resp *http.Response, endTime time.Time, duration time.Duration, success bool) (*ResponseCapture, error) {
	capture := &ResponseCapture{
		EndTime:    endTime,
		StatusCode: resp.StatusCode,
		Status:     resp.Status,
		Headers:    make(map[string]string),
		Duration:   duration,
		Success:    success && resp.StatusCode < 400,
	}

	// Capture headers
	for key, values := range resp.Header {
		if len(values) > 0 {
			capture.Headers[key] = values[0] // Take first value
		}
	}

	// Extract common headers
	capture.ContentType = resp.Header.Get("Content-Type")

	// Get response size from headers
	if contentLength := resp.Header.Get("Content-Length"); contentLength != "" {
		if size, err := strconv.ParseInt(contentLength, 10, 64); err == nil {
			capture.ResponseSize = size
		}
	}

	// Capture response body if enabled
	if t.config.CaptureResponseBodies && resp.Body != nil {
		bodyBytes, err := t.readBody(resp.Body, t.config.MaxBodySize)
		if err != nil {
			return nil, err
		}

		capture.Body = bodyBytes
		capture.ResponseSize = int64(len(bodyBytes))

		// Restore body for the caller
		resp.Body = io.NopCloser(bytes.NewReader(bodyBytes))
	}

	return capture, nil
}

// readBody reads and returns body content up to maxSize
func (t *TracingRoundTripper) readBody(body io.ReadCloser, maxSize int64) ([]byte, error) {
	defer body.Close()

	// Limit read size to prevent memory issues
	limitedReader := io.LimitReader(body, maxSize+1) // +1 to detect if truncated
	bodyBytes, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, err
	}

	// Truncate if body exceeds max size
	if int64(len(bodyBytes)) > maxSize {
		bodyBytes = bodyBytes[:maxSize]
	}

	return bodyBytes, nil
}

// TracingTransport creates a new HTTP transport with tracing capabilities
func NewTracingTransport(baseTransport http.RoundTripper, logger *Logger, config *TracingConfig, sessionID string) http.RoundTripper {
	return NewTracingRoundTripper(baseTransport, logger, config, sessionID)
}

// WrapClient wraps an existing http.Client with tracing
func WrapClient(client *http.Client, logger *Logger, config *TracingConfig, sessionID string) *http.Client {
	if client == nil {
		client = &http.Client{}
	}

	// Create a copy to avoid modifying the original
	tracingClient := &http.Client{
		Transport:     NewTracingTransport(client.Transport, logger, config, sessionID),
		CheckRedirect: client.CheckRedirect,
		Jar:           client.Jar,
		Timeout:       client.Timeout,
	}

	// Use config timeout if client timeout is not set
	if tracingClient.Timeout == 0 && config.Timeout > 0 {
		tracingClient.Timeout = config.Timeout
	}

	return tracingClient
}