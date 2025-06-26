package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNewTracingHTTPClient(t *testing.T) {
	// Set up test environment
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	client := NewTracingHTTPClient("test-session")
	defer client.Close()

	if client.GetSessionID() != "test-session" {
		t.Errorf("Expected session ID 'test-session', got '%s'", client.GetSessionID())
	}

	if !client.IsEnabled() {
		t.Error("Expected tracing to be enabled")
	}
}

func TestNewTracingHTTPClientWithEmptySessionID(t *testing.T) {
	client := NewTracingHTTPClient("")
	defer client.Close()

	sessionID := client.GetSessionID()
	if sessionID == "" {
		t.Error("Expected auto-generated session ID, got empty string")
	}

	// UUID format check (basic)
	if len(sessionID) != 36 {
		t.Errorf("Expected UUID format (36 chars), got %d chars: %s", len(sessionID), sessionID)
	}
}

func TestHTTPMethods(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		
		response := map[string]string{
			"method": r.Method,
			"path":   r.URL.Path,
		}
		
		if r.Body != nil {
			body, _ := io.ReadAll(r.Body)
			if len(body) > 0 {
				response["body"] = string(body)
			}
		}
		
		w.Write([]byte(`{"success": true, "method": "` + r.Method + `"}`))
	}))
	defer server.Close()

	// Set up tracing
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	// Create temp directory for test output
	tempDir, err := os.MkdirTemp("", "trace-test-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	os.Setenv("OPENCODE_TRACE_DIR", tempDir)
	defer os.Unsetenv("OPENCODE_TRACE_DIR")

	client := NewTracingHTTPClient("test-methods")
	defer client.Close()

	tests := []struct {
		name   string
		method func() (*http.Response, error)
	}{
		{"GET", func() (*http.Response, error) {
			return client.Get(server.URL + "/test")
		}},
		{"POST", func() (*http.Response, error) {
			return client.Post(server.URL+"/test", "application/json", strings.NewReader(`{"test": true}`))
		}},
		{"PUT", func() (*http.Response, error) {
			return client.Put(server.URL+"/test", "application/json", strings.NewReader(`{"update": true}`))
		}},
		{"DELETE", func() (*http.Response, error) {
			return client.Delete(server.URL + "/test")
		}},
		{"PATCH", func() (*http.Response, error) {
			return client.Patch(server.URL+"/test", "application/json", strings.NewReader(`{"patch": true}`))
		}},
		{"HEAD", func() (*http.Response, error) {
			return client.Head(server.URL + "/test")
		}},
		{"OPTIONS", func() (*http.Response, error) {
			return client.Options(server.URL + "/test")
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := tt.method()
			if err != nil {
				t.Fatalf("HTTP %s failed: %v", tt.name, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Expected status 200, got %d", resp.StatusCode)
			}
		})
	}

	// Verify trace files were created
	sessionDir := filepath.Join(tempDir, "sessions")
	if _, err := os.Stat(sessionDir); os.IsNotExist(err) {
		t.Error("Session directory was not created")
	}
}

func TestJSONMethods(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type: application/json, got %s", r.Header.Get("Content-Type"))
		}
		
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success": true}`))
	}))
	defer server.Close()

	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	client := NewTracingHTTPClient("test-json")
	defer client.Close()

	jsonBody := []byte(`{"test": "data"}`)

	// Test POST JSON
	resp, err := client.PostJSON(server.URL+"/test", jsonBody)
	if err != nil {
		t.Fatalf("PostJSON failed: %v", err)
	}
	resp.Body.Close()

	// Test PUT JSON
	resp, err = client.PutJSON(server.URL+"/test", jsonBody)
	if err != nil {
		t.Fatalf("PutJSON failed: %v", err)
	}
	resp.Body.Close()
}

func TestContextMethods(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success": true}`))
	}))
	defer server.Close()

	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	client := NewTracingHTTPClient("test-context")
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Test context methods
	resp, err := client.GetWithContext(ctx, server.URL+"/test")
	if err != nil {
		t.Fatalf("GetWithContext failed: %v", err)
	}
	resp.Body.Close()

	resp, err = client.PostWithContext(ctx, server.URL+"/test", "text/plain", strings.NewReader("test"))
	if err != nil {
		t.Fatalf("PostWithContext failed: %v", err)
	}
	resp.Body.Close()
}

func TestRetryLogic(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success": true}`))
	}))
	defer server.Close()

	config := &TracingConfig{
		Enabled:               true,
		OutputDir:             os.TempDir(),
		MaxBodySize:           1024,
		CaptureRequestBodies:  true,
		CaptureResponseBodies: true,
		Timeout:               5 * time.Second,
		MaxRetries:            3,
		SensitiveHeaders:      []string{"authorization"},
	}

	client := NewTracingHTTPClientWithConfig("test-retry", config)
	defer client.Close()

	req, err := http.NewRequest("GET", server.URL+"/test", nil)
	if err != nil {
		t.Fatal(err)
	}

	resp, err := client.DoWithRetry(req)
	if err != nil {
		t.Fatalf("DoWithRetry failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	if attempts != 3 {
		t.Errorf("Expected 3 attempts, got %d", attempts)
	}
}

func TestSensitiveHeaderSanitization(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "trace-sanitize-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	config := &TracingConfig{
		Enabled:               true,
		OutputDir:             tempDir,
		MaxBodySize:           1024,
		CaptureRequestBodies:  true,
		CaptureResponseBodies: true,
		Timeout:               5 * time.Second,
		MaxRetries:            0,
		SensitiveHeaders:      []string{"authorization", "x-api-key"},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success": true}`))
	}))
	defer server.Close()

	client := NewTracingHTTPClientWithConfig("test-sanitize", config)
	defer client.Close()

	req, err := http.NewRequest("GET", server.URL+"/test", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Add sensitive headers
	req.Header.Set("Authorization", "Bearer secret-token")
	req.Header.Set("X-API-Key", "secret-api-key")
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	resp.Body.Close()

	// Give time for the log to be written
	time.Sleep(100 * time.Millisecond)

	// Read the session file to verify sanitization
	sessionDir := filepath.Join(tempDir, "sessions")
	files, err := os.ReadDir(sessionDir)
	if err != nil {
		t.Fatalf("Failed to read session directory: %v", err)
	}

	if len(files) == 0 {
		t.Fatal("No session files found")
	}

	sessionFile := filepath.Join(sessionDir, files[0].Name())
	content, err := os.ReadFile(sessionFile)
	if err != nil {
		t.Fatalf("Failed to read session file: %v", err)
	}

	contentStr := string(content)
	
	// Check that sensitive headers are redacted
	if strings.Contains(contentStr, "secret-token") {
		t.Error("Sensitive authorization token was not redacted")
	}
	
	if strings.Contains(contentStr, "secret-api-key") {
		t.Error("Sensitive API key was not redacted")
	}
	
	// Check that [REDACTED] appears in the logs
	if !strings.Contains(contentStr, "[REDACTED]") {
		t.Error("Expected [REDACTED] to appear in logs for sensitive headers")
	}
	
	// Check that non-sensitive headers are preserved
	if !strings.Contains(contentStr, "application/json") {
		t.Error("Non-sensitive Content-Type header was incorrectly redacted")
	}
}

func TestConfigurationLoading(t *testing.T) {
	// Test environment variable configuration
	os.Setenv("OPENCODE_TRACE", "true")
	os.Setenv("OPENCODE_TRACE_DIR", "/custom/trace/dir")
	os.Setenv("OPENCODE_TRACE_MAX_BODY_SIZE", "2048")
	os.Setenv("OPENCODE_TRACE_TIMEOUT", "10s")
	
	defer func() {
		os.Unsetenv("OPENCODE_TRACE")
		os.Unsetenv("OPENCODE_TRACE_DIR")
		os.Unsetenv("OPENCODE_TRACE_MAX_BODY_SIZE")
		os.Unsetenv("OPENCODE_TRACE_TIMEOUT")
	}()

	config := LoadConfig()

	if !config.Enabled {
		t.Error("Expected tracing to be enabled")
	}

	if config.OutputDir != "/custom/trace/dir" {
		t.Errorf("Expected output dir '/custom/trace/dir', got '%s'", config.OutputDir)
	}

	if config.MaxBodySize != 2048 {
		t.Errorf("Expected max body size 2048, got %d", config.MaxBodySize)
	}

	if config.Timeout != 10*time.Second {
		t.Errorf("Expected timeout 10s, got %v", config.Timeout)
	}
}

func TestClientDisabled(t *testing.T) {
	// Ensure tracing is disabled
	os.Setenv("OPENCODE_TRACE", "false")
	defer os.Unsetenv("OPENCODE_TRACE")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success": true}`))
	}))
	defer server.Close()

	client := NewTracingHTTPClient("test-disabled")
	defer client.Close()

	if client.IsEnabled() {
		t.Error("Expected tracing to be disabled")
	}

	// Request should still work when disabled
	resp, err := client.Get(server.URL + "/test")
	if err != nil {
		t.Fatalf("Request failed even when tracing disabled: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}