// opencode-trace Go HTTP client wrapper
// Task 1.3: Complete implementation

package main

import (
	"fmt"
	"strings"
)

func main() {
	fmt.Println("opencode-trace Go client v1.0.0")
	
	// Check if tracing is enabled
	if !isTracingEnabled() {
		fmt.Println("Tracing is disabled. Set OPENCODE_TRACE=true to enable.")
		return
	}

	// Demo usage
	fmt.Println("Tracing is enabled!")
	
	// Create a tracing client
	client := NewTracingHTTPClient("demo-session")
	defer client.Close()
	
	fmt.Printf("Created tracing client with session ID: %s\n", client.GetSessionID())
	
	// Example usage would go here
	// This is a library, so main() is just for demo/testing
	fmt.Println("HTTP client wrapper ready for use")
	
	// Show configuration
	config := LoadConfig()
	fmt.Printf("Configuration:\n")
	fmt.Printf("  Output Directory: %s\n", config.OutputDir)
	fmt.Printf("  Max Body Size: %d bytes\n", config.MaxBodySize)
	fmt.Printf("  Capture Request Bodies: %v\n", config.CaptureRequestBodies)
	fmt.Printf("  Capture Response Bodies: %v\n", config.CaptureResponseBodies)
	fmt.Printf("  Timeout: %v\n", config.Timeout)
	fmt.Printf("  Max Retries: %d\n", config.MaxRetries)
	fmt.Printf("  Sensitive Headers: %s\n", strings.Join(config.SensitiveHeaders, ", "))
}