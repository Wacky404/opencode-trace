package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// LoadConfig loads configuration from environment variables and config files
func LoadConfig() *TracingConfig {
	config := getDefaultConfig()

	// Override with environment variables
	if enabled := os.Getenv("OPENCODE_TRACE"); enabled != "" {
		config.Enabled = enabled == "true" || enabled == "1"
	}

	if outputDir := os.Getenv("OPENCODE_TRACE_DIR"); outputDir != "" {
		config.OutputDir = outputDir
	}

	if maxBodySize := os.Getenv("OPENCODE_TRACE_MAX_BODY_SIZE"); maxBodySize != "" {
		if size, err := strconv.ParseInt(maxBodySize, 10, 64); err == nil {
			config.MaxBodySize = size
		}
	}

	if captureReq := os.Getenv("OPENCODE_TRACE_CAPTURE_REQUEST_BODIES"); captureReq != "" {
		config.CaptureRequestBodies = captureReq == "true" || captureReq == "1"
	}

	if captureResp := os.Getenv("OPENCODE_TRACE_CAPTURE_RESPONSE_BODIES"); captureResp != "" {
		config.CaptureResponseBodies = captureResp == "true" || captureResp == "1"
	}

	if timeout := os.Getenv("OPENCODE_TRACE_TIMEOUT"); timeout != "" {
		if duration, err := time.ParseDuration(timeout); err == nil {
			config.Timeout = duration
		}
	}

	if retries := os.Getenv("OPENCODE_TRACE_MAX_RETRIES"); retries != "" {
		if maxRetries, err := strconv.Atoi(retries); err == nil {
			config.MaxRetries = maxRetries
		}
	}

	// Try to load from config file
	loadConfigFromFile(config)

	return config
}

// getDefaultConfig returns the default configuration
func getDefaultConfig() *TracingConfig {
	return &TracingConfig{
		Enabled:               isTracingEnabled(),
		OutputDir:             ".opencode-trace",
		MaxBodySize:           1024 * 1024, // 1MB
		CaptureRequestBodies:  true,
		CaptureResponseBodies: true,
		SensitiveHeaders: []string{
			"authorization", "cookie", "x-api-key", "x-auth-token",
			"access-token", "refresh-token", "bearer", "api-key",
		},
		Timeout:    30 * time.Second,
		MaxRetries: 3,
	}
}

// isTracingEnabled checks if tracing is enabled via environment variables
func isTracingEnabled() bool {
	enabled := os.Getenv("OPENCODE_TRACE")
	return enabled == "true" || enabled == "1"
}

// loadConfigFromFile attempts to load configuration from a JSON file
func loadConfigFromFile(config *TracingConfig) {
	// Try multiple config file locations
	configPaths := []string{
		os.Getenv("OPENCODE_TRACE_CONFIG"),
		filepath.Join(os.Getenv("HOME"), ".opencode", "trace-config.json"),
		filepath.Join(".", ".opencode-trace", "config.json"),
	}

	for _, path := range configPaths {
		if path == "" {
			continue
		}

		if data, err := os.ReadFile(path); err == nil {
			var fileConfig TracingConfig
			if err := json.Unmarshal(data, &fileConfig); err == nil {
				// Merge file config with current config
				mergeConfig(config, &fileConfig)
				break
			}
		}
	}
}

// mergeConfig merges file configuration into the main config
func mergeConfig(config, fileConfig *TracingConfig) {
	if fileConfig.OutputDir != "" {
		config.OutputDir = fileConfig.OutputDir
	}
	if fileConfig.MaxBodySize != 0 {
		config.MaxBodySize = fileConfig.MaxBodySize
	}
	if fileConfig.Timeout != 0 {
		config.Timeout = fileConfig.Timeout
	}
	if fileConfig.MaxRetries != 0 {
		config.MaxRetries = fileConfig.MaxRetries
	}
	if len(fileConfig.SensitiveHeaders) > 0 {
		config.SensitiveHeaders = fileConfig.SensitiveHeaders
	}
}

// SaveConfig saves the current configuration to a file
func SaveConfig(config *TracingConfig, path string) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}