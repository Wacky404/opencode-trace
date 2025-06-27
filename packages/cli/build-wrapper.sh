#!/bin/bash
set -e

echo "🔨 Building Go TUI wrapper..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER_DIR="$SCRIPT_DIR/src/wrappers"
OUTPUT_DIR="$SCRIPT_DIR/dist"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Build the Go wrapper
cd "$WRAPPER_DIR"

# Initialize Go module if it doesn't exist
if [ ! -f "go.mod" ]; then
    echo "📦 Initializing Go module..."
    go mod init opencode-trace-wrapper
fi

echo "🏗️  Building wrapper binary..."

# Build for the current platform
go build -o "$OUTPUT_DIR/opencode-trace-wrapper" \
    -ldflags "-s -w" \
    ./*.go

# Make it executable
chmod +x "$OUTPUT_DIR/opencode-trace-wrapper"

echo "✅ Go wrapper built successfully: $OUTPUT_DIR/opencode-trace-wrapper"
