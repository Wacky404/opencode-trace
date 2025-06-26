package main

import (
	"time"
)

// HTTPRequestEvent represents an HTTP request event
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

// HTTPResponseEvent represents an HTTP response event
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

// TracingConfig holds configuration for the tracing client
type TracingConfig struct {
	Enabled              bool          `json:"enabled"`
	OutputDir            string        `json:"output_dir"`
	MaxBodySize          int64         `json:"max_body_size"`
	CaptureRequestBodies bool          `json:"capture_request_bodies"`
	CaptureResponseBodies bool         `json:"capture_response_bodies"`
	SensitiveHeaders     []string      `json:"sensitive_headers"`
	Timeout              time.Duration `json:"timeout"`
	MaxRetries           int           `json:"max_retries"`
}

// RequestCapture holds captured request data
type RequestCapture struct {
	StartTime   time.Time
	Method      string
	URL         string
	Headers     map[string]string
	Body        []byte
	ContentType string
	UserAgent   string
}

// ResponseCapture holds captured response data
type ResponseCapture struct {
	EndTime      time.Time
	StatusCode   int
	Status       string
	Headers      map[string]string
	Body         []byte
	ContentType  string
	ResponseSize int64
	Duration     time.Duration
	Success      bool
}