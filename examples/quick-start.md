# opencode-trace Quick Start Examples

Ready-to-use commands for common scenarios.

## Basic Usage

```bash
# Simple tracing
opencode-trace "Create a simple REST API with authentication"

# With debug output to see what's happening
opencode-trace --debug "Fix the database connection issue"

# Include all HTTP requests (not just AI APIs)
opencode-trace --include-all "Set up the development environment"
```

## Development Workflows

### Bug Fixing
```bash
opencode-trace \
  --session-name "bug-fix-$(date +%Y%m%d)" \
  --tags "bug" "urgent" \
  --debug \
  "The user login is failing with a 500 error. Investigate and fix the issue."
```

### Feature Development
```bash
opencode-trace \
  --session-name "feature-notifications" \
  --tags "feature" "frontend" \
  "Implement real-time notifications using WebSockets with proper error handling."
```

### Code Review
```bash
opencode-trace \
  --session-name "review-pr-123" \
  --tags "review" "quality" \
  "Review the current pull request and suggest improvements for security and performance."
```

### Refactoring
```bash
opencode-trace \
  --session-name "refactor-auth-service" \
  --tags "refactor" "cleanup" \
  "Refactor the authentication service to improve maintainability and reduce technical debt."
```

## Team Collaboration

### Daily Standup Preparation
```bash
opencode-trace \
  --session-name "standup-$(date +%Y%m%d)" \
  --tags "standup" "planning" \
  "Summarize yesterday's work and plan today's priorities based on current project status."
```

### Documentation Generation
```bash
opencode-trace \
  --session-name "docs-api" \
  --tags "documentation" "api" \
  "Generate comprehensive API documentation with examples and best practices."
```

### Architecture Planning
```bash
opencode-trace \
  --session-name "arch-microservices" \
  --tags "architecture" "planning" \
  "Design a microservices architecture for the e-commerce platform with scalability considerations."
```

## Testing & Quality

### Test Coverage Analysis
```bash
opencode-trace \
  --session-name "test-coverage" \
  --tags "testing" "quality" \
  "Analyze current test coverage and suggest additional test cases for critical functionality."
```

### Performance Optimization
```bash
opencode-trace \
  --session-name "perf-optimization" \
  --tags "performance" "optimization" \
  --include-all \
  "Analyze application performance bottlenecks and suggest optimization strategies."
```

### Security Audit
```bash
opencode-trace \
  --session-name "security-audit" \
  --tags "security" "audit" \
  "Perform a security audit focusing on authentication, authorization, and data protection."
```

## Specialized Use Cases

### Database Work
```bash
opencode-trace \
  --tags "database" "migration" \
  "Design and implement database migrations for the new user roles feature."
```

### Frontend Development
```bash
opencode-trace \
  --tags "frontend" "react" \
  "Create responsive React components with accessibility compliance and proper state management."
```

### DevOps & Infrastructure
```bash
opencode-trace \
  --tags "devops" "infrastructure" \
  --include-all \
  "Set up CI/CD pipeline with automated testing, security scanning, and deployment strategies."
```

### API Development
```bash
opencode-trace \
  --tags "api" "backend" \
  "Design RESTful API endpoints with proper validation, error handling, and rate limiting."
```

## CI/CD Integration

### GitHub Actions
```bash
# In your workflow
npx @opencode-trace/cli \
  --non-interactive \
  --session-name "ci-analysis-${{ github.run_number }}" \
  --tags "ci" "automated" \
  "Analyze the pull request changes and provide quality feedback."
```

### Pre-commit Hook
```bash
# .git/hooks/pre-commit
opencode-trace \
  --quiet \
  --session-name "pre-commit-$(git rev-parse --short HEAD)" \
  --tags "git" "pre-commit" \
  "Quick analysis of changes being committed for potential issues."
```

### Daily Reports
```bash
# Cron job for daily analysis
0 9 * * * opencode-trace \
  --session-name "daily-report-$(date +%Y%m%d)" \
  --tags "report" "daily" \
  "Generate daily project health report and identify priority tasks."
```

## Advanced Configuration

### Custom Trace Directory
```bash
opencode-trace \
  --trace-dir "./project-traces" \
  --session-name "feature-implementation" \
  "Implement the user dashboard with data visualization components."
```

### Large Request Bodies
```bash
opencode-trace \
  --max-body-size 5242880 \
  --include-all \
  "Process and analyze large file uploads with proper validation and error handling."
```

### Organized Sessions
```bash
opencode-trace \
  --session-name "sprint-$(date +%Y%U)-day-1" \
  --tags "sprint" "planning" "$(date +%A)" \
  "Plan the current sprint goals and break down tasks into manageable chunks."
```

## One-liners for Common Tasks

```bash
# Quick bug investigation
opencode-trace --debug "Why is the API returning 500 errors?"

# Fast feature brainstorming
opencode-trace "How should I implement user preferences storage?"

# Code quality check
opencode-trace "Review this code for best practices and potential issues"

# Performance question
opencode-trace "What's causing the slow database queries?"

# Security concern
opencode-trace "How can I secure this API endpoint properly?"

# Testing strategy
opencode-trace "What tests should I write for this component?"

# Documentation help
opencode-trace "Generate README documentation for this project"

# Deployment planning
opencode-trace "Plan deployment strategy for this application"
```

## Configuration Examples

### Personal Development
Create `~/.opencode-trace/config.json`:
```json
{
  "traceDir": "~/dev/traces",
  "autoGenerateHTML": true,
  "tags": ["personal", "development"],
  "debug": false
}
```

### Team Environment
```json
{
  "traceDir": "/shared/project/traces",
  "includeAllRequests": false,
  "maxBodySize": 2097152,
  "tags": ["team", "project-alpha"],
  "sessionName": "team-${USER}-${date}"
}
```

### CI/CD Environment
```json
{
  "traceDir": "./build/traces",
  "nonInteractive": true,
  "quiet": true,
  "autoGenerateHTML": true,
  "tags": ["ci", "automated"]
}
```

## Tips for Better Results

1. **Be Specific**: More detailed prompts yield better analysis
   ```bash
   # Good
   opencode-trace "Fix the memory leak in UserService.authenticate() method"
   
   # Better  
   opencode-trace "The UserService.authenticate() method is causing memory leaks when processing concurrent requests. Investigate callback handling and connection pooling."
   ```

2. **Use Appropriate Tags**: Helps with session organization
   ```bash
   opencode-trace --tags "urgent" "security" "auth" "Fix authentication bypass vulnerability"
   ```

3. **Include Context**: Reference specific files or components
   ```bash
   opencode-trace "Review the changes in src/auth/middleware.ts for security best practices"
   ```

4. **Set Expectations**: Specify what kind of output you want
   ```bash
   opencode-trace "Create step-by-step implementation plan for user role management system"
   ```

This quick start guide provides copy-paste commands for immediate use across common development scenarios.