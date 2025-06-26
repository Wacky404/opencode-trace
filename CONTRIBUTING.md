# Contributing to opencode-trace

Thank you for your interest in contributing to opencode-trace! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 18+ 
- Go 1.21+
- npm or yarn

### Getting Started

1. Fork and clone the repository:
```bash
git clone https://github.com/your-username/opencode-trace.git
cd opencode-trace
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Run tests:
```bash
npm test
```

## Project Structure

```
opencode-trace/
├── packages/
│   ├── tracer/          # Core tracing library (TypeScript)
│   │   ├── src/
│   │   │   ├── logger.ts      # JSONL logging
│   │   │   ├── session.ts     # Session management
│   │   │   ├── types.ts       # Type definitions
│   │   │   └── index.ts       # Main exports
│   │   └── package.json
│   └── viewer/          # HTML viewer components (Lit + Tailwind)
│       ├── src/
│       │   ├── components/    # Lit components
│       │   ├── styles/        # CSS and themes
│       │   └── index.ts       # Main exports
│       └── package.json
├── go-client/           # Go HTTP client wrapper
│   ├── client.go        # HTTP client wrapper
│   ├── tracer.go        # Tracing logic
│   └── go.mod
├── examples/            # Example usage
├── tests/              # Integration tests
└── .github/            # CI/CD workflows
```

## Development Workflow

### Making Changes

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and add tests

3. Run the development server:
```bash
npm run dev
```

4. Test your changes:
```bash
npm test
npm run test:integration
```

5. Lint your code:
```bash
npm run lint
```

### Code Style

- **TypeScript**: Follow the ESLint configuration
- **Go**: Use `gofmt` and follow Go conventions
- **Commits**: Use conventional commit format

### Testing

- Write unit tests for new functionality
- Add integration tests for end-to-end scenarios
- Ensure all tests pass before submitting PR

## Submitting Changes

1. Push your branch to your fork
2. Create a Pull Request with:
   - Clear description of changes
   - Link to any related issues
   - Screenshots for UI changes
   - Test results

## Reporting Issues

When reporting bugs, please include:

- opencode version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or screenshots

## Feature Requests

For new features:

- Check existing issues first
- Describe the use case
- Explain why it would be valuable
- Consider implementation complexity

## Code of Conduct

Be respectful and inclusive. We want this to be a welcoming community for everyone.

## Questions?

Feel free to open an issue for questions or join discussions in existing issues.