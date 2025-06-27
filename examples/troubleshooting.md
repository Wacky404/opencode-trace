# opencode-trace Troubleshooting Guide

This guide helps you diagnose and resolve common issues with opencode-trace.

## Quick Diagnostics

### First Steps
Always start troubleshooting with debug mode:

```bash
opencode-trace --debug "test prompt"
```

Look for these key indicators:
- ✅ `🌐 HTTP proxy started on 127.0.0.1:XXXX`
- ✅ `🌐 Proxy event: https_connect_start`
- ✅ `📈 Event processed: https_connect_start`

## Common Issues

### 1. Empty Trace Files

**Symptoms:**
- `⚠️ HTML generation failed: Empty trace file`
- No events captured in JSONL files
- HTML viewer shows "No data"

**Diagnosis:**
```bash
# Check if proxy is receiving events
opencode-trace --debug "test prompt" 2>&1 | grep "Proxy event"
```

**Solutions:**

#### A. opencode Not Using Proxy
**Cause:** opencode might be bypassing HTTP_PROXY environment variables

**Check:**
```bash
# Verify proxy environment variables are set
opencode-trace --debug "test" 2>&1 | grep "Environment vars"
```

**Fix:**
```bash
# Force proxy usage (if supported by your opencode version)
export HTTPS_PROXY=http://127.0.0.1:8888
export HTTP_PROXY=http://127.0.0.1:8888
opencode-trace "test prompt"
```

#### B. Network Configuration Issues
**Check corporate proxy/firewall:**
```bash
# Test direct connectivity
curl -v https://api.anthropic.com
```

**Workaround for corporate networks:**
```bash
# Use your corporate proxy as upstream
opencode-trace \
  --proxy-upstream "http://corporate-proxy:8080" \
  "test prompt"
```

#### C. opencode Version Compatibility
**Check opencode version:**
```bash
opencode --version
```

**Required:** opencode v0.1.150+

**Fix:**
```bash
# Update opencode
npm install -g opencode@latest
# or
brew upgrade opencode
```

### 2. Port Conflicts

**Symptoms:**
- `Error: listen EADDRINUSE :::8888`
- Proxy startup failures

**Diagnosis:**
```bash
# Check what's using port 8888
lsof -i :8888
netstat -an | grep 8888
```

**Solutions:**

#### A. Automatic Port Selection
opencode-trace automatically tries alternative ports (8889, 8890, etc.)

**Manual port specification:**
```bash
# This feature needs to be implemented
# Currently investigating: packages/cli/src/types/cli.ts
```

#### B. Kill Conflicting Process
```bash
# Find and kill process using port 8888
sudo lsof -ti:8888 | xargs kill -9
```

#### C. Change Default Port Range
Modify proxy configuration in the code (temporary workaround):
```typescript
// packages/cli/src/proxy/http-proxy.ts
// Change default port from 8888 to available range
```

### 3. Permission Errors

**Symptoms:**
- `EACCES: permission denied`
- Cannot write to trace directories
- NPM global install failures

**Solutions:**

#### A. Directory Permissions
```bash
# Fix trace directory permissions
mkdir -p ~/.opencode-trace
chmod 755 ~/.opencode-trace
```

#### B. NPM Global Install Issues
```bash
# Use npx instead of global install
npx @opencode-trace/cli "test prompt"

# Or fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

#### C. macOS Security Restrictions
```bash
# Grant terminal/iTerm2 full disk access in:
# System Preferences > Security & Privacy > Privacy > Full Disk Access
```

### 4. Process Management Issues

**Symptoms:**
- `Timeout waiting for processes to be ready`
- Hanging sessions
- Zombie processes

**Diagnosis:**
```bash
# Check for hanging opencode processes
ps aux | grep opencode
ps aux | grep "node.*opencode-trace"
```

**Solutions:**

#### A. Clean Up Processes
```bash
# Kill all opencode-trace related processes
pkill -f "opencode-trace"
pkill -f "opencode"

# More aggressive cleanup
sudo pkill -f "node.*proxy"
```

#### B. Increase Timeout
Currently hardcoded to 30 seconds. For slower systems:

```bash
# Temporary workaround: edit coordinator.ts
# const timeout = 30000; // Change to 60000
```

#### C. Check System Resources
```bash
# Monitor system resources during execution
top -pid $(pgrep -f opencode-trace)
```

### 5. Event Processing Errors

**Symptoms:**
- `Failed to process event: TypeError`
- Event aggregation failures
- Duplicate filtering issues

**Recent Fix Applied:**
The "Cannot read properties of undefined (reading 'type')" error has been resolved with validation layers.

**If still occurring:**
```bash
# Capture detailed error logs
opencode-trace --debug "test" 2>&1 | tee debug.log

# Check for specific error patterns
grep -A5 -B5 "Failed to process event" debug.log
```

**Additional Debugging:**
```bash
# Enable Node.js debugging
NODE_OPTIONS="--inspect" opencode-trace --debug "test"
```

### 6. HTML Generation Issues

**Symptoms:**
- `HTML generation failed`
- Empty or corrupted HTML files
- Missing CSS/JS assets

**Diagnosis:**
```bash
# Check HTML generator logs
opencode-trace --debug "test" 2>&1 | grep -i "html\|viewer"
```

**Solutions:**

#### A. JSDOM Issues
```bash
# Check Node.js version compatibility
node --version  # Requires Node.js 18+

# Clear Node.js module cache
rm -rf node_modules/.cache
```

#### B. Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" opencode-trace "test"
```

#### C. Asset Loading Problems
Check viewer component dependencies:
```bash
# Verify viewer package integrity
npm ls @opencode-trace/viewer
```

### 7. Network Connectivity Issues

**Symptoms:**
- Connection timeouts
- SSL certificate errors
- API request failures

**Diagnosis:**
```bash
# Test network connectivity
curl -v https://api.anthropic.com
dig api.anthropic.com

# Test through proxy
curl -v --proxy http://127.0.0.1:8888 https://api.anthropic.com
```

**Solutions:**

#### A. Corporate Firewall
```bash
# Add proxy authentication if required
export HTTPS_PROXY=http://username:password@proxy:8080
```

#### B. DNS Issues
```bash
# Use alternative DNS
export DNS_SERVER=8.8.8.8
# or modify /etc/hosts if needed
```

#### C. SSL Certificate Issues
```bash
# Temporary workaround (not recommended for production)
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Performance Issues

### 1. Slow Session Startup

**Symptoms:**
- Long delays before proxy starts
- Timeout during process initialization

**Solutions:**
```bash
# Pre-build dependencies
npm run build:cli

# Use SSD storage for trace directory
opencode-trace --trace-dir "/fast-ssd-path" "prompt"
```

### 2. High Memory Usage

**Monitoring:**
```bash
# Monitor memory usage
ps -o pid,vsz,rss,comm -p $(pgrep -f opencode-trace)
```

**Solutions:**
```bash
# Limit request body size
opencode-trace --max-body-size 524288 "prompt"  # 512KB limit

# Use minimal event capture
opencode-trace --exclude-duplicates "prompt"
```

### 3. Large Trace Files

**Issue:** JSONL files growing too large

**Solutions:**
```bash
# Compress trace files
gzip ~/.opencode-trace/sessions/*/trace.jsonl

# Implement log rotation (manual)
find ~/.opencode-trace -name "*.jsonl" -size +100M -exec gzip {} \;
```

## Environment-Specific Issues

### macOS

#### Homebrew Installation Issues
```bash
# Reinstall with Homebrew
brew uninstall opencode
brew install opencode

# Fix PATH issues
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Code Signing Issues
```bash
# Allow unsigned binaries (if needed)
sudo spctl --master-disable
```

### Linux

#### Missing Dependencies
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install nodejs npm curl

# CentOS/RHEL
sudo yum install nodejs npm curl
```

#### systemd Integration
```bash
# Create systemd service for persistent proxy
sudo tee /etc/systemd/system/opencode-trace-proxy.service << EOF
[Unit]
Description=opencode-trace HTTP Proxy
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/opencode-trace-proxy --daemon
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

### Windows

#### PowerShell Execution Policy
```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Windows Defender Issues
```powershell
# Add exclusion for Node.js processes
Add-MpPreference -ExclusionPath "C:\Program Files\nodejs"
Add-MpPreference -ExclusionProcess "node.exe"
```

### Docker/Containers

#### Network Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine

# Install opencode-trace
RUN npm install -g @opencode-trace/cli

# Configure proxy for container networking
ENV HTTP_PROXY=http://host.docker.internal:8888
ENV HTTPS_PROXY=http://host.docker.internal:8888

WORKDIR /app
CMD ["opencode-trace", "--non-interactive", "Container analysis prompt"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  opencode-trace:
    image: node:18-alpine
    command: >
      sh -c "npm install -g @opencode-trace/cli &&
             opencode-trace --non-interactive 'Docker analysis'"
    volumes:
      - ./traces:/root/.opencode-trace
    environment:
      - HTTP_PROXY=http://host.docker.internal:8888
    network_mode: host
```

## Advanced Debugging

### 1. Enable Comprehensive Logging

```bash
# Environment variables for debugging
export DEBUG=opencode-trace:*
export NODE_ENV=development
export OPENCODE_TRACE_DEBUG=1

opencode-trace --debug "test prompt"
```

### 2. Network Traffic Analysis

```bash
# Capture network traffic
sudo tcpdump -i any -w trace.pcap port 8888

# Analyze with Wireshark
wireshark trace.pcap
```

### 3. Process Monitoring

```bash
# Real-time process monitoring
watch -n 1 'ps aux | grep -E "(opencode|proxy)" | grep -v grep'

# System call tracing (Linux)
strace -f -e network -p $(pgrep opencode-trace)

# macOS equivalent
sudo dtruss -f -n opencode-trace
```

### 4. Memory Leak Detection

```bash
# Node.js heap analysis
NODE_OPTIONS="--inspect --expose-gc" opencode-trace "test"

# Connect Chrome DevTools to ws://127.0.0.1:9229
# Take heap snapshots before/after sessions
```

## Reporting Issues

When reporting issues, include:

### 1. Environment Information
```bash
# System info
uname -a
node --version
npm --version
opencode --version

# opencode-trace version
npm ls @opencode-trace/cli
```

### 2. Debug Output
```bash
# Capture full debug log
opencode-trace --debug "reproduction case" 2>&1 | tee issue-debug.log
```

### 3. Configuration Files
```bash
# Include relevant config
cat ~/.opencode-trace/config.json
env | grep -i proxy
```

### 4. Minimal Reproduction Case
```bash
# Simplest command that reproduces the issue
opencode-trace --debug "hello world"
```

## Recovery Procedures

### 1. Complete Reset
```bash
# Stop all processes
pkill -f "opencode-trace"
pkill -f "opencode"

# Clear all data
rm -rf ~/.opencode-trace

# Reinstall
npm uninstall -g @opencode-trace/cli
npm install -g @opencode-trace/cli@latest
```

### 2. Configuration Reset
```bash
# Reset to defaults
rm ~/.opencode-trace/config.json

# Clear caches
rm -rf ~/.npm/_npx
npm cache clean --force
```

### 3. Emergency Session Recovery
```bash
# Recover from incomplete sessions
find ~/.opencode-trace/sessions -name "*.tmp" -delete
find ~/.opencode-trace/sessions -name "state.json" -exec rm {} \;
```

This troubleshooting guide covers the most common issues and their solutions. For persistent problems, enable debug mode and examine the logs for specific error patterns.