package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Logger handles integration with the TypeScript JSONL logger
type Logger struct {
	config    *TracingConfig
	sessionID string
}

// NewLogger creates a new logger instance
func NewLogger(config *TracingConfig, sessionID string) *Logger {
	return &Logger{
		config:    config,
		sessionID: sessionID,
	}
}

// LogHTTPRequest logs an HTTP request event
func (l *Logger) LogHTTPRequest(capture *RequestCapture) error {
	if !l.config.Enabled {
		return nil
	}

	event := HTTPRequestEvent{
		Type:        "http_request",
		Timestamp:   capture.StartTime.UnixMilli(),
		SessionID:   l.sessionID,
		Method:      capture.Method,
		URL:         capture.URL,
		Headers:     l.sanitizeHeaders(capture.Headers),
		ContentType: capture.ContentType,
		UserAgent:   capture.UserAgent,
	}

	// Add body if enabled and within size limits
	if l.config.CaptureRequestBodies && len(capture.Body) > 0 {
		if int64(len(capture.Body)) <= l.config.MaxBodySize {
			event.Body = string(capture.Body)
		} else {
			event.Body = fmt.Sprintf("[TRUNCATED - Body size %d bytes exceeds limit %d bytes]",
				len(capture.Body), l.config.MaxBodySize)
		}
	}

	return l.writeEvent(event)
}

// LogHTTPResponse logs an HTTP response event
func (l *Logger) LogHTTPResponse(capture *ResponseCapture) error {
	if !l.config.Enabled {
		return nil
	}

	event := HTTPResponseEvent{
		Type:         "http_response",
		Timestamp:    capture.EndTime.UnixMilli(),
		SessionID:    l.sessionID,
		StatusCode:   capture.StatusCode,
		Status:       capture.Status,
		Headers:      l.sanitizeHeaders(capture.Headers),
		ContentType:  capture.ContentType,
		ResponseSize: capture.ResponseSize,
		Duration:     capture.Duration.Milliseconds(),
		Success:      capture.Success,
	}

	// Add body if enabled and within size limits
	if l.config.CaptureResponseBodies && len(capture.Body) > 0 {
		if int64(len(capture.Body)) <= l.config.MaxBodySize {
			event.Body = string(capture.Body)
		} else {
			event.Body = fmt.Sprintf("[TRUNCATED - Body size %d bytes exceeds limit %d bytes]",
				len(capture.Body), l.config.MaxBodySize)
		}
	}

	return l.writeEvent(event)
}

// LogError logs an error event
func (l *Logger) LogError(err error, context string) error {
	if !l.config.Enabled {
		return nil
	}

	errorEvent := map[string]interface{}{
		"type":       "error",
		"timestamp":  time.Now().UnixMilli(),
		"session_id": l.sessionID,
		"error": map[string]string{
			"message": err.Error(),
			"context": context,
		},
	}

	return l.writeEvent(errorEvent)
}

// writeEvent writes an event to the JSONL file
func (l *Logger) writeEvent(event interface{}) error {
	// Serialize event to JSON
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Get session file path
	sessionFile, err := l.getSessionFilePath()
	if err != nil {
		return fmt.Errorf("failed to get session file path: %w", err)
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(sessionFile), 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Append to session file (JSONL format - one JSON object per line)
	file, err := os.OpenFile(sessionFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open session file: %w", err)
	}
	defer file.Close()

	// Write JSON line
	if _, err := file.Write(append(data, '\n')); err != nil {
		return fmt.Errorf("failed to write event: %w", err)
	}

	return nil
}

// getSessionFilePath returns the path to the session JSONL file
func (l *Logger) getSessionFilePath() (string, error) {
	if l.sessionID == "" {
		return "", fmt.Errorf("session ID is empty")
	}

	// Create filename with timestamp pattern: YYYY-MM-DD_HH-mm-ss_session-{id}.jsonl
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := fmt.Sprintf("%s_session-%s.jsonl", timestamp, l.sessionID)
	
	return filepath.Join(l.config.OutputDir, "sessions", filename), nil
}

// sanitizeHeaders removes sensitive headers and returns a clean copy
func (l *Logger) sanitizeHeaders(headers map[string]string) map[string]string {
	if headers == nil {
		return nil
	}

	sanitized := make(map[string]string)
	
	for key, value := range headers {
		if l.isSensitiveHeader(key) {
			sanitized[key] = "[REDACTED]"
		} else {
			sanitized[key] = value
		}
	}

	return sanitized
}

// isSensitiveHeader checks if a header contains sensitive information
func (l *Logger) isSensitiveHeader(headerName string) bool {
	lowerHeader := strings.ToLower(headerName)
	
	for _, sensitive := range l.config.SensitiveHeaders {
		if strings.Contains(lowerHeader, strings.ToLower(sensitive)) {
			return true
		}
	}
	
	return false
}

// Flush ensures all pending writes are flushed (placeholder for future buffering)
func (l *Logger) Flush() error {
	// Currently writing synchronously, but this could be enhanced
	// with buffering in the future
	return nil
}

// Close cleans up the logger (placeholder for future cleanup)
func (l *Logger) Close() error {
	return l.Flush()
}