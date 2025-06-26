package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"time"
)

// Example demonstrates basic usage of the TracingHTTPClient
func ExampleTracingHTTPClient_basic() {
	// Enable tracing
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	// Create a tracing client
	client := NewTracingHTTPClient("example-session")
	defer client.Close()

	// Create a test server for demonstration
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message": "Hello from server"}`))
	}))
	defer server.Close()

	// Make a GET request
	resp, err := client.Get(server.URL + "/api/test")
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	fmt.Printf("GET response status: %d\n", resp.StatusCode)
	// Output: GET response status: 200
}

// Example demonstrates POST with JSON
func ExampleTracingHTTPClient_postJSON() {
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	client := NewTracingHTTPClient("json-example")
	defer client.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"id": 123, "status": "created"}`))
	}))
	defer server.Close()

	// POST JSON data
	jsonData := []byte(`{"name": "test", "value": 42}`)
	resp, err := client.PostJSON(server.URL+"/api/data", jsonData)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	fmt.Printf("POST JSON response status: %d\n", resp.StatusCode)
	// Output: POST JSON response status: 201
}

// Example demonstrates context usage with timeout
func ExampleTracingHTTPClient_withContext() {
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	client := NewTracingHTTPClient("context-example")
	defer client.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Simulate slow response
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"data": "response"}`))
	}))
	defer server.Close()

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Make request with context
	resp, err := client.GetWithContext(ctx, server.URL+"/api/slow")
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	fmt.Printf("Context request status: %d\n", resp.StatusCode)
	// Output: Context request status: 200
}

// Example demonstrates retry functionality
func ExampleTracingHTTPClient_withRetry() {
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	// Create client with custom config for retries
	config := &TracingConfig{
		Enabled:               true,
		OutputDir:             ".opencode-trace",
		MaxBodySize:           1024 * 1024,
		CaptureRequestBodies:  true,
		CaptureResponseBodies: true,
		Timeout:               5 * time.Second,
		MaxRetries:            2,
		SensitiveHeaders:      []string{"authorization"},
	}

	client := NewTracingHTTPClientWithConfig("retry-example", config)
	defer client.Close()

	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 2 {
			// Fail first attempt
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		// Succeed on second attempt
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"retry": "success"}`))
	}))
	defer server.Close()

	// Create request
	req, err := http.NewRequest("GET", server.URL+"/api/unreliable", nil)
	if err != nil {
		log.Fatal(err)
	}

	// Execute with retry logic
	resp, err := client.DoWithRetry(req)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	fmt.Printf("Retry request status: %d (attempts: %d)\n", resp.StatusCode, attempts)
	// Output: Retry request status: 200 (attempts: 2)
}

// Example demonstrates all HTTP methods
func ExampleTracingHTTPClient_allMethods() {
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	client := NewTracingHTTPClient("methods-example")
	defer client.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Method-Used", r.Method)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(fmt.Sprintf(`{"method": "%s"}`, r.Method)))
	}))
	defer server.Close()

	baseURL := server.URL + "/api/test"

	// Test all HTTP methods
	methods := []struct {
		name string
		fn   func() (*http.Response, error)
	}{
		{"GET", func() (*http.Response, error) { return client.Get(baseURL) }},
		{"POST", func() (*http.Response, error) {
			return client.Post(baseURL, "text/plain", strings.NewReader("test data"))
		}},
		{"PUT", func() (*http.Response, error) {
			return client.Put(baseURL, "text/plain", strings.NewReader("update data"))
		}},
		{"DELETE", func() (*http.Response, error) { return client.Delete(baseURL) }},
		{"PATCH", func() (*http.Response, error) {
			return client.Patch(baseURL, "text/plain", strings.NewReader("patch data"))
		}},
		{"HEAD", func() (*http.Response, error) { return client.Head(baseURL) }},
		{"OPTIONS", func() (*http.Response, error) { return client.Options(baseURL) }},
	}

	for _, method := range methods {
		resp, err := method.fn()
		if err != nil {
			log.Printf("Error with %s: %v", method.name, err)
			continue
		}
		resp.Body.Close()
		fmt.Printf("%s: %d\n", method.name, resp.StatusCode)
	}

	// Output:
	// GET: 200
	// POST: 200
	// PUT: 200
	// DELETE: 200
	// PATCH: 200
	// HEAD: 200
	// OPTIONS: 200
}

// Example demonstrates configuration and environment variables
func ExampleTracingHTTPClient_configuration() {
	// Set environment variables
	os.Setenv("OPENCODE_TRACE", "true")
	os.Setenv("OPENCODE_TRACE_DIR", "./custom-trace")
	os.Setenv("OPENCODE_TRACE_MAX_BODY_SIZE", "512")
	os.Setenv("OPENCODE_TRACE_TIMEOUT", "30s")

	defer func() {
		os.Unsetenv("OPENCODE_TRACE")
		os.Unsetenv("OPENCODE_TRACE_DIR")
		os.Unsetenv("OPENCODE_TRACE_MAX_BODY_SIZE")
		os.Unsetenv("OPENCODE_TRACE_TIMEOUT")
	}()

	// Load configuration
	config := LoadConfig()

	fmt.Printf("Tracing enabled: %v\n", config.Enabled)
	fmt.Printf("Output directory: %s\n", config.OutputDir)
	fmt.Printf("Max body size: %d bytes\n", config.MaxBodySize)
	fmt.Printf("Timeout: %v\n", config.Timeout)

	// Create client with loaded config
	client := NewTracingHTTPClientWithConfig("config-example", config)
	defer client.Close()

	fmt.Printf("Client session ID: %s\n", client.GetSessionID())

	// Output:
	// Tracing enabled: true
	// Output directory: ./custom-trace
	// Max body size: 512 bytes
	// Timeout: 30s
	// Client session ID: config-example
}

// Example demonstrates sensitive header sanitization
func ExampleTracingHTTPClient_sensitiveHeaders() {
	os.Setenv("OPENCODE_TRACE", "true")
	defer os.Unsetenv("OPENCODE_TRACE")

	// Custom config with sensitive headers
	config := &TracingConfig{
		Enabled:               true,
		OutputDir:             "./example-trace",
		MaxBodySize:           1024,
		CaptureRequestBodies:  true,
		CaptureResponseBodies: true,
		Timeout:               10 * time.Second,
		MaxRetries:            1,
		SensitiveHeaders:      []string{"authorization", "x-api-key", "cookie"},
	}

	client := NewTracingHTTPClientWithConfig("sensitive-example", config)
	defer client.Close()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"message": "Headers received"}`))
	}))
	defer server.Close()

	// Create request with sensitive headers
	req, err := http.NewRequest("GET", server.URL+"/api/secure", nil)
	if err != nil {
		log.Fatal(err)
	}

	// Add headers (these will be sanitized in logs)
	req.Header.Set("Authorization", "Bearer secret-token-12345")
	req.Header.Set("X-API-Key", "api-key-secret")
	req.Header.Set("Content-Type", "application/json") // This will NOT be sanitized
	req.Header.Set("User-Agent", "example-client")     // This will NOT be sanitized

	resp, err := client.Do(req)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	fmt.Printf("Request with sensitive headers: %d\n", resp.StatusCode)
	fmt.Println("Sensitive headers will be logged as [REDACTED]")

	// Output:
	// Request with sensitive headers: 200
	// Sensitive headers will be logged as [REDACTED]
}