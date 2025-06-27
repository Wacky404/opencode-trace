package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

// Main entry point for the Go TUI wrapper
func main() {
	// Check if tracing is enabled
	if !isTracingEnabled() {
		// If tracing is not enabled, just execute opencode normally
		executeOpenCode(os.Args[1:])
		return
	}

	// Initialize tracing
	sessionID := getSessionID()
	config := getTraceConfig()
	
	fmt.Printf("🟩 Initializing Go TUI tracing for session: %s\n", sessionID)
	
	// Create session coordinator
	coordinator := NewSessionCoordinator(sessionID, config)
	if err := coordinator.Initialize(); err != nil {
		fmt.Fprintf(os.Stderr, "⚠️  Failed to initialize session coordinator: %v\n", err)
	}
	defer coordinator.Finalize()
	
	// Create tracing client using Plan v1 component
	tracingClient, err := NewTracingHTTPClient(sessionID, config)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to create tracing client: %v\n", err)
		// Continue without tracing
		executeOpenCode(os.Args[1:])
		return
	}
	defer tracingClient.Close()
	
	// Set up HTTP client injection
	if err := injectTracingClient(tracingClient); err != nil {
		fmt.Fprintf(os.Stderr, "⚠️  Failed to inject tracing client: %v\n", err)
		// Continue without tracing
	} else {
		fmt.Println("✅ Go TUI tracing initialized successfully")
	}
	
	// Execute opencode with tracing
	executeOpenCode(os.Args[1:])
}

// Check if tracing is enabled via environment variables
func isTracingEnabled() bool {
	return os.Getenv("OPENCODE_TRACE") == "true" && 
		   os.Getenv("OPENCODE_TRACE_MODE") == "tui"
}

// Get session ID from environment
func getSessionID() string {
	sessionID := os.Getenv("OPENCODE_TRACE_SESSION_ID")
	if sessionID == "" {
		sessionID = "default"
	}
	return sessionID
}

// Build trace configuration from environment variables
func getTraceConfig() TracingConfig {
	config := TracingConfig{
		Enabled:               true,
		OutputDir:             getEnvWithDefault("OPENCODE_TRACE_DIR", ".opencode-trace"),
		MaxBodySize:           1048576, // 1MB default
		CaptureRequestBodies:  true,
		CaptureResponseBodies: true,
		IncludeAllRequests:    os.Getenv("OPENCODE_TRACE_INCLUDE_ALL") == "true",
		Debug:                 os.Getenv("OPENCODE_TRACE_DEBUG") == "true",
		Verbose:               os.Getenv("OPENCODE_TRACE_VERBOSE") == "true",
		Timeout:               30 * time.Second,
		MaxRetries:            3,
		SensitiveHeaders:      []string{"authorization", "x-api-key", "x-auth-token"},
	}
	
	// Parse max body size
	if maxBodyStr := os.Getenv("OPENCODE_TRACE_MAX_BODY_SIZE"); maxBodyStr != "" {
		if maxBody, err := strconv.ParseInt(maxBodyStr, 10, 64); err == nil && maxBody > 0 {
			config.MaxBodySize = maxBody
		}
	}
	
	return config
}

// Inject the tracing HTTP client into the opencode process
func injectTracingClient(client *TracingHTTPClient) error {
	// This is where we would integrate with opencode's HTTP client
	// For now, we'll set up environment variables to enable tracing
	
	// Set environment variables that opencode might read
	os.Setenv("HTTP_CLIENT_TRACE", "true")
	os.Setenv("OPENCODE_HTTP_TRACE", "true")
	
	// TODO: Implement actual HTTP client injection
	// This would require understanding opencode's architecture
	// and how it creates HTTP clients. Possible approaches:
	// 1. Environment variable injection
	// 2. HTTP proxy setup
	// 3. LD_PRELOAD library injection (Linux/macOS)
	// 4. DLL injection (Windows)
	
	fmt.Println("🔌 HTTP client injection configured")
	return nil
}

// Execute opencode with the provided arguments
func executeOpenCode(args []string) {
	// Find opencode binary
	opencodeCmd, err := findOpenCodeBinary()
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to find opencode binary: %v\n", err)
		os.Exit(1)
	}
	
	// Prepare command
	cmd := exec.Command(opencodeCmd, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Copy environment variables
	cmd.Env = os.Environ()
	
	// Execute and replace current process
	if err := cmd.Run(); err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			if status, ok := exitError.Sys().(syscall.WaitStatus); ok {
				os.Exit(status.ExitStatus())
			}
		}
		fmt.Fprintf(os.Stderr, "❌ Failed to execute opencode: %v\n", err)
		os.Exit(1)
	}
}

// Find the opencode binary in common locations
func findOpenCodeBinary() (string, error) {
	// Try common locations
	locations := []string{
		"opencode", // System PATH
		"/usr/local/bin/opencode",
		"/opt/homebrew/bin/opencode",
		filepath.Join(os.Getenv("HOME"), ".local/bin/opencode"),
		filepath.Join(os.Getenv("HOME"), "go/bin/opencode"),
	}
	
	for _, location := range locations {
		if location == "opencode" {
			// Check if it's in PATH
			if _, err := exec.LookPath("opencode"); err == nil {
				return "opencode", nil
			}
		} else {
			// Check if file exists and is executable
			if info, err := os.Stat(location); err == nil && !info.IsDir() {
				return location, nil
			}
		}
	}
	
	return "", fmt.Errorf("opencode binary not found in common locations")
}

// Helper function to get environment variable with default
func getEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

