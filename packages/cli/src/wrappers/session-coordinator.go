package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// SessionCoordinator manages the integration between the Go TUI wrapper and the CLI wrapper
type SessionCoordinator struct {
	sessionID string
	config    TracingConfig
}

// NewSessionCoordinator creates a new session coordinator
func NewSessionCoordinator(sessionID string, config TracingConfig) *SessionCoordinator {
	return &SessionCoordinator{
		sessionID: sessionID,
		config:    config,
	}
}

// Initialize sets up the session coordination
func (sc *SessionCoordinator) Initialize() error {
	// Create session directory structure
	sessionDir := filepath.Join(sc.config.OutputDir, "sessions", sc.sessionID)
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		return fmt.Errorf("failed to create session directory: %v", err)
	}

	// Write session metadata
	if err := sc.writeSessionMetadata(); err != nil {
		return fmt.Errorf("failed to write session metadata: %v", err)
	}

	// Send session start event to CLI wrapper via IPC
	if err := sc.sendIPCMessage("session_start", map[string]interface{}{
		"mode":      "go_tui",
		"pid":       os.Getpid(),
		"timestamp": time.Now().UnixMilli(),
	}); err != nil {
		// Don't fail if IPC is not available
		if sc.config.Debug {
			fmt.Fprintf(os.Stderr, "Warning: Failed to send IPC message: %v\n", err)
		}
	}

	return nil
}

// Finalize cleans up the session coordination
func (sc *SessionCoordinator) Finalize() error {
	// Send session end event to CLI wrapper via IPC
	if err := sc.sendIPCMessage("session_end", map[string]interface{}{
		"mode":      "go_tui",
		"pid":       os.Getpid(),
		"timestamp": time.Now().UnixMilli(),
	}); err != nil {
		// Don't fail if IPC is not available
		if sc.config.Debug {
			fmt.Fprintf(os.Stderr, "Warning: Failed to send IPC message: %v\n", err)
		}
	}

	return nil
}

// writeSessionMetadata writes session metadata to a file
func (sc *SessionCoordinator) writeSessionMetadata() error {
	sessionDir := filepath.Join(sc.config.OutputDir, "sessions", sc.sessionID)
	metadataPath := filepath.Join(sessionDir, "metadata.json")

	metadata := map[string]interface{}{
		"session_id":  sc.sessionID,
		"start_time":  time.Now().Unix(),
		"mode":        "go_tui",
		"pid":         os.Getpid(),
		"config":      sc.config,
		"environment": getEnvironmentInfo(),
	}

	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(metadataPath, data, 0644)
}

// sendIPCMessage sends a message to the CLI wrapper via IPC
func (sc *SessionCoordinator) sendIPCMessage(messageType string, data map[string]interface{}) error {
	// Create IPC message structure (compatible with CLI wrapper)
	message := map[string]interface{}{
		"type":       messageType,
		"session_id": sc.sessionID,
		"timestamp":  time.Now().UnixMilli(),
		"source":     "tui",
		"data":       data,
	}

	// Write to temporary IPC file that the CLI wrapper will pick up
	tmpDir := os.TempDir()
	ipcDir := filepath.Join(tmpDir, "opencode-trace", sc.sessionID)

	// Create IPC directory if it doesn't exist
	if err := os.MkdirAll(ipcDir, 0755); err != nil {
		return err
	}

	// Generate unique message file name
	messageFile := filepath.Join(ipcDir, fmt.Sprintf("msg-%d-%d.json", time.Now().UnixMilli(), os.Getpid()))

	// Marshal and write the message
	messageData, err := json.Marshal(message)
	if err != nil {
		return err
	}

	return os.WriteFile(messageFile, messageData, 0644)
}

// getEnvironmentInfo collects relevant environment information
func getEnvironmentInfo() map[string]interface{} {
	env := make(map[string]interface{})

	// Collect relevant environment variables
	relevantVars := []string{
		"OPENCODE_TRACE",
		"OPENCODE_TRACE_MODE",
		"OPENCODE_TRACE_SESSION_ID",
		"OPENCODE_TRACE_DIR",
		"OPENCODE_TRACE_DEBUG",
		"OPENCODE_TRACE_VERBOSE",
		"OPENCODE_TRACE_INCLUDE_ALL",
		"OPENCODE_TRACE_MAX_BODY_SIZE",
		"NODE_ENV",
		"GO_VERSION",
		"GOOS",
		"GOARCH",
	}

	for _, varName := range relevantVars {
		if value := os.Getenv(varName); value != "" {
			env[varName] = value
		}
	}

	// Add system information
	env["working_directory"] = getCurrentWorkingDirectory()
	env["command_line"] = os.Args

	return env
}

// getCurrentWorkingDirectory safely gets the current working directory
func getCurrentWorkingDirectory() string {
	if cwd, err := os.Getwd(); err == nil {
		return cwd
	}
	return "unknown"
}