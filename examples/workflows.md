# opencode-trace Workflow Examples

This document provides practical examples of using opencode-trace in different development workflows.

## Development Workflows

### 1. Bug Investigation Workflow

```bash
# Start a debugging session with detailed tracking
opencode-trace \
  --debug \
  --session-name "bug-memory-leak-$(date +%Y%m%d)" \
  --tags "bug" "memory" "investigation" \
  --include-all \
  "Investigate the memory leak in the user authentication service. Check for resource cleanup and potential circular references."
```

**Expected Output:**
- Detailed proxy logs showing API calls
- Memory-related API requests to documentation
- Code analysis and debugging suggestions
- HTML report with timeline of investigation steps

### 2. Feature Development Workflow

```bash
# Feature implementation session
opencode-trace \
  --session-name "feature-user-roles" \
  --tags "feature" "auth" "backend" \
  --trace-dir "./features/user-roles/traces" \
  "Implement role-based access control with user roles: admin, editor, viewer. Include database migrations, API endpoints, and middleware."
```

**Use Case:**
- Track all API calls made during feature implementation
- Document decision-making process through AI interactions
- Generate implementation timeline for project tracking

### 3. Code Review Assistance

```bash
# Automated code review
opencode-trace \
  --session-name "review-pr-$(git rev-parse --short HEAD)" \
  --tags "review" "quality" \
  --non-interactive \
  "Review the current changes and suggest improvements for code quality, security, and performance."
```

**Integration with Git:**
```bash
#!/bin/bash
# .git/hooks/pre-push
echo "Running opencode-trace code review..."
opencode-trace \
  --quiet \
  --session-name "pre-push-review" \
  "Review the changes being pushed and flag any potential issues"
```

### 4. Daily Standup Preparation

```bash
# Morning standup preparation
opencode-trace \
  --session-name "standup-$(date +%Y%m%d)" \
  --tags "standup" "planning" \
  "Analyze yesterday's commits and current project status. Prepare standup notes with progress summary and today's priorities."
```

### 5. Performance Optimization

```bash
# Performance analysis session
opencode-trace \
  --debug \
  --include-all \
  --session-name "perf-optimization" \
  --tags "performance" "optimization" \
  --max-body-size 5242880 \
  "Analyze the application performance and suggest optimizations for the API endpoints and database queries."
```

## CI/CD Integration Examples

### GitHub Actions

```yaml
# .github/workflows/opencode-trace.yml
name: AI Code Analysis

on:
  pull_request:
    branches: [ main ]

jobs:
  ai-analysis:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Run opencode-trace analysis
      run: |
        npx @opencode-trace/cli \
          --non-interactive \
          --quiet \
          --session-name "ci-pr-${{ github.event.number }}" \
          --tags "ci" "pr-analysis" \
          --trace-dir "./traces" \
          "Analyze this pull request for code quality, security issues, and suggest improvements."
    
    - name: Upload trace artifacts
      uses: actions/upload-artifact@v3
      with:
        name: opencode-traces
        path: ./traces/
        retention-days: 30
    
    - name: Comment PR with analysis
      if: always()
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const path = require('path');
          
          // Find the latest session HTML file
          const tracesDir = './traces/sessions';
          if (fs.existsSync(tracesDir)) {
            const sessions = fs.readdirSync(tracesDir);
            const latestSession = sessions.sort().pop();
            const htmlPath = path.join(tracesDir, latestSession, 'session.html');
            
            if (fs.existsSync(htmlPath)) {
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: `🤖 AI Code Analysis completed! View the detailed report in the [artifacts](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}).`
              });
            }
          }
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    stages {
        stage('AI Code Analysis') {
            steps {
                script {
                    def sessionName = "jenkins-${env.BUILD_NUMBER}"
                    def branchName = env.BRANCH_NAME ?: 'main'
                    
                    sh """
                        npx @opencode-trace/cli \
                            --non-interactive \
                            --session-name "${sessionName}" \
                            --tags "ci" "jenkins" "${branchName}" \
                            --trace-dir "./build/traces" \
                            "Analyze the code changes in this ${branchName} branch build and provide quality assessment."
                    """
                }
            }
            
            post {
                always {
                    archiveArtifacts artifacts: 'build/traces/**/*', fingerprint: true
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'build/traces/sessions',
                        reportFiles: '*/session.html',
                        reportName: 'AI Code Analysis Report'
                    ])
                }
            }
        }
    }
}
```

## Team Collaboration Workflows

### 1. Knowledge Sharing Session

```bash
# Document architecture decisions
opencode-trace \
  --session-name "arch-decision-$(date +%Y%m%d)" \
  --tags "architecture" "documentation" "team" \
  "Explain the current system architecture and document the rationale behind key design decisions for new team members."
```

### 2. Onboarding New Developers

```bash
# Create onboarding documentation
opencode-trace \
  --session-name "onboarding-guide" \
  --tags "onboarding" "documentation" \
  --include-all \
  "Create a comprehensive onboarding guide for new developers including setup instructions, codebase walkthrough, and development workflows."
```

### 3. Technical Debt Assessment

```bash
# Analyze technical debt
opencode-trace \
  --session-name "tech-debt-audit-$(date +%Y%m%d)" \
  --tags "technical-debt" "refactoring" "audit" \
  --debug \
  "Analyze the codebase for technical debt, identify refactoring opportunities, and prioritize improvements."
```

## Project-Specific Examples

### React/Frontend Projects

```bash
# Component optimization
opencode-trace \
  --session-name "react-performance" \
  --tags "react" "frontend" "performance" \
  "Analyze React components for performance issues and suggest optimizations for rendering and state management."

# Accessibility audit
opencode-trace \
  --session-name "a11y-audit" \
  --tags "accessibility" "frontend" "compliance" \
  "Audit the frontend application for accessibility compliance and suggest improvements for WCAG 2.1 AA standards."
```

### Backend/API Projects

```bash
# API design review
opencode-trace \
  --session-name "api-design-review" \
  --tags "api" "backend" "design" \
  "Review the REST API design for consistency, security, and best practices. Suggest improvements for documentation and error handling."

# Database optimization
opencode-trace \
  --session-name "db-optimization" \
  --tags "database" "performance" "sql" \
  "Analyze database queries and schema for optimization opportunities. Suggest indexing strategies and query improvements."
```

### DevOps/Infrastructure

```bash
# Infrastructure review
opencode-trace \
  --session-name "infra-security-audit" \
  --tags "infrastructure" "security" "devops" \
  --include-all \
  "Review the infrastructure configuration for security best practices and cost optimization opportunities."

# Deployment automation
opencode-trace \
  --session-name "deployment-automation" \
  --tags "deployment" "automation" "ci-cd" \
  "Design an automated deployment pipeline with proper testing, rollback strategies, and monitoring."
```

## Advanced Usage Patterns

### 1. Multi-Session Projects

```bash
# Session 1: Analysis
opencode-trace \
  --session-name "project-analysis" \
  --tags "analysis" "planning" \
  "Analyze the project requirements and create a high-level implementation plan."

# Session 2: Implementation (continue from analysis)
opencode-trace \
  --continue-session \
  --session-name "project-implementation" \
  --tags "implementation" "development" \
  "Implement the planned features based on the previous analysis session."

# Session 3: Testing and refinement
opencode-trace \
  --continue-session \
  --session-name "project-testing" \
  --tags "testing" "refinement" \
  "Create comprehensive tests and refine the implementation based on testing results."
```

### 2. Data-Driven Development

```bash
# Capture all requests for analysis
opencode-trace \
  --include-all \
  --debug \
  --max-body-size 10485760 \
  --session-name "data-analysis-$(date +%Y%m%d)" \
  --tags "data" "analysis" "research" \
  "Analyze large datasets and implement data processing algorithms with proper error handling and optimization."
```

### 3. Security-Focused Sessions

```bash
# Security audit
opencode-trace \
  --session-name "security-audit" \
  --tags "security" "audit" "vulnerability" \
  --include-all \
  "Perform a comprehensive security audit of the application including authentication, authorization, input validation, and data protection."
```

## Integration with Development Tools

### VS Code Integration

Create a VS Code task (`.vscode/tasks.json`):

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "opencode-trace: Quick Analysis",
            "type": "shell",
            "command": "opencode-trace",
            "args": [
                "--session-name",
                "vscode-${workspaceFolderBasename}",
                "--tags",
                "vscode",
                "quick-analysis",
                "Analyze the current workspace and suggest improvements"
            ],
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "always",
                "focus": false,
                "panel": "shared"
            },
            "problemMatcher": []
        }
    ]
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "trace:analyze": "opencode-trace --session-name 'project-analysis' 'Analyze the project structure and suggest improvements'",
    "trace:test": "opencode-trace --tags 'testing' 'Review test coverage and suggest additional test cases'",
    "trace:docs": "opencode-trace --tags 'documentation' 'Generate comprehensive documentation for the project'",
    "trace:security": "opencode-trace --tags 'security' 'Perform security analysis and suggest improvements'"
  }
}
```

### Git Hooks Integration

```bash
# .git/hooks/post-commit
#!/bin/bash
if [ "$1" = "--trace" ]; then
    echo "Running post-commit analysis..."
    opencode-trace \
        --session-name "post-commit-$(git rev-parse --short HEAD)" \
        --tags "git" "post-commit" \
        --quiet \
        "Analyze the latest commit and suggest any improvements or potential issues."
fi
```

## Monitoring and Analytics

### Usage Analytics

```bash
# Weekly code quality report
opencode-trace \
  --session-name "weekly-report-$(date +%Y%U)" \
  --tags "analytics" "weekly-report" \
  "Generate a weekly code quality report analyzing commits, issues resolved, and overall project health."
```

### Performance Tracking

```bash
# Performance baseline
opencode-trace \
  --session-name "perf-baseline" \
  --tags "performance" "baseline" \
  --include-all \
  "Establish performance baselines for the application and create monitoring recommendations."
```

## Best Practices

### 1. Session Naming Convention

Use descriptive, searchable session names:
- `feature-{feature-name}-{date}`
- `bug-{issue-number}-{description}`
- `review-{pr-number}`
- `refactor-{component}-{date}`

### 2. Tagging Strategy

Organize sessions with consistent tags:
- **Type**: `feature`, `bug`, `refactor`, `docs`, `test`
- **Component**: `frontend`, `backend`, `api`, `database`
- **Priority**: `urgent`, `high`, `medium`, `low`
- **Environment**: `development`, `staging`, `production`

### 3. Trace Directory Organization

```
project-traces/
├── daily/           # Daily development sessions
├── features/        # Feature-specific traces
├── bugs/           # Bug investigation traces
├── reviews/        # Code review sessions
└── ci/             # CI/CD generated traces
```

### 4. Automation Guidelines

- Use `--non-interactive` in CI/CD pipelines
- Set appropriate `--max-body-size` for your use case
- Use `--quiet` to reduce log noise in automated systems
- Always specify `--session-name` and `--tags` for traceability

These examples provide a comprehensive foundation for integrating opencode-trace into various development workflows and team processes.