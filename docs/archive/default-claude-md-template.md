# {{PROJECT_NAME}}

<!-- FOUNDRY:BEGIN - Do not edit this section manually -->
## Project Resources (Foundry Managed)

This project uses shared resources from the AI Foundry Golden Repo.
Run `foundry sync` to update. Run `foundry list --outdated` to check for updates.

*No resources linked yet. Use `foundry add` to add resources.*
<!-- FOUNDRY:END -->

---

## Project Overview

**Purpose**: <!-- Describe what this project does in 1-2 sentences -->

**Status**: 🟡 In Development | 🟢 Production | 🔴 Deprecated

**Owner**: <!-- Team or individual responsible -->

**Repository**: <!-- Link to repo -->

---

## Quick Start

```bash
# Clone and setup
git clone {{REPO_URL}}
cd {{PROJECT_NAME}}
npm install  # or pip install -r requirements.txt

# Run locally
npm run dev  # or python main.py

# Run tests
npm test     # or pytest
```

---

## Architecture Overview

<!-- 
Describe the high-level architecture. Include:
- Main components and their responsibilities
- How data flows through the system
- External services and integrations
-->

```
┌─────────────────────────────────────────────────────────┐
│                     Architecture                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐        │
│   │          │    │          │    │          │        │
│   │  Input   │───▶│ Process  │───▶│  Output  │        │
│   │          │    │          │    │          │        │
│   └──────────┘    └──────────┘    └──────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| <!-- Component 1 --> | <!-- What it does --> | `src/...` |
| <!-- Component 2 --> | <!-- What it does --> | `src/...` |

### External Dependencies

| Service | Purpose | Docs |
|---------|---------|------|
| <!-- Service 1 --> | <!-- Why we use it --> | <!-- Link --> |

---

## Project Structure

```
{{PROJECT_NAME}}/
├── src/                    # Source code
│   ├── components/         # UI components (if applicable)
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions
│   └── index.ts            # Entry point
├── tests/                  # Test files
├── docs/                   # Documentation
├── .foundry/               # Foundry configuration
│   ├── project.json        # Project manifest
│   └── linked/             # Linked golden repo resources
├── CLAUDE.md               # This file
└── README.md               # Public readme
```

---

## Working with Claude

### Context Claude Needs

**This project is**: <!-- Brief description of what Claude is working with -->

**Tech stack**: <!-- e.g., TypeScript, Node.js, React, ServiceNow -->

**Key patterns used**:
- <!-- Pattern 1: e.g., "Repository pattern for data access" -->
- <!-- Pattern 2: e.g., "React hooks for state management" -->

**Important constraints**:
- <!-- Constraint 1: e.g., "Must support IE11" -->
- <!-- Constraint 2: e.g., "No external API calls from client" -->

### Claude's Guidelines

#### ✅ DO
- Follow existing code patterns visible in the codebase
- Write tests for new functionality
- Break large tasks into smaller, verifiable steps
- Ask clarifying questions when requirements are unclear
- Run tests and linting before marking work complete
- Use the Foundry skills and context available to this project

#### ❌ DON'T
- Make assumptions about unclear requirements
- Introduce new dependencies without discussion
- Perform large refactors without explicit approval
- Skip tests for "simple" changes
- Leave TODO comments without context

#### 🔄 WHEN STUCK
1. Re-read the relevant code and this CLAUDE.md
2. Check if a Foundry skill exists that might help (`foundry search`)
3. Ask for clarification rather than guessing
4. Propose multiple approaches if uncertain

### Preferred Patterns

**Error Handling**:
```typescript
// Always handle errors explicitly with context
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Failed to perform operation', { error, context: relevantData });
  throw new AppError('Operation failed', { cause: error });
}
```

**Async Operations**:
```typescript
// Prefer async/await over .then() chains
const data = await fetchData();
const processed = await processData(data);
return processed;
```

**Component Structure** (if React):
```tsx
// Props interface at top, component below
interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  // Hooks at top
  const [state, setState] = useState('');
  
  // Handlers
  const handleClick = () => { /* ... */ };
  
  // Render
  return ( /* ... */ );
}
```

---

## Development Workflow

### Branch Strategy

```
main                 # Production-ready code
├── develop          # Integration branch (if used)
├── feature/*        # New features
├── bugfix/*         # Bug fixes
└── hotfix/*         # Urgent production fixes
```

### Branch Naming
```
feature/ABC-123-add-user-authentication
bugfix/ABC-456-fix-login-redirect
hotfix/ABC-789-critical-security-patch
```

### Commit Messages

Follow conventional commits:
```
type(scope): description

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
```
feat(auth): add OAuth2 login support
fix(api): handle null response from external service
docs(readme): update installation instructions
refactor(utils): extract date formatting to separate module
```

### Pull Request Checklist

Before requesting review:
- [ ] Tests pass locally
- [ ] New code has test coverage
- [ ] No linting errors
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions
- [ ] Self-reviewed the diff
- [ ] Removed debug code and console.logs

---

## Testing

### Test Structure
```
tests/
├── unit/              # Isolated function/component tests
├── integration/       # Component interaction tests
└── e2e/               # End-to-end user flow tests
```

### Running Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Tests

```typescript
describe('MyService', () => {
  describe('myMethod', () => {
    it('should return expected result for valid input', () => {
      // Arrange
      const input = 'test';
      const expected = 'TEST';
      
      // Act
      const result = myService.myMethod(input);
      
      // Assert
      expect(result).toBe(expected);
    });
    
    it('should throw error for invalid input', () => {
      expect(() => myService.myMethod(null)).toThrow('Input required');
    });
  });
});
```

### Coverage Expectations
- New features: 80%+ coverage
- Bug fixes: Include regression test
- Critical paths: 90%+ coverage

---

## Environment Setup

### Prerequisites
- Node.js >= 18.x (or Python >= 3.10)
- npm >= 9.x (or pip)
- Git

### Environment Variables

Create `.env.local` from template:
```bash
cp .env.example .env.local
```

| Variable | Purpose | Required |
|----------|---------|----------|
| `API_URL` | Backend API endpoint | Yes |
| `DEBUG` | Enable debug logging | No |

### IDE Setup

**VS Code Extensions**:
- ESLint
- Prettier
- GitLens

**Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

---

## Common Tasks

### Adding a New Feature

1. Create feature branch: `git checkout -b feature/ABC-123-description`
2. If using SPARC, create spec: `specs/ABC-123-feature.md`
3. Implement with tests
4. Update documentation if needed
5. Create PR

### Fixing a Bug

1. Create bugfix branch: `git checkout -b bugfix/ABC-456-description`
2. Write failing test that reproduces bug
3. Fix bug
4. Verify test passes
5. Create PR

### Adding a Dependency

1. Discuss with team first
2. Check license compatibility
3. Add with exact version: `npm install package@1.2.3 --save-exact`
4. Document why it's needed in PR

---

## Troubleshooting

### Common Issues

#### Build fails with "Module not found"
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Tests timeout
- Check for missing async/await
- Look for unresolved promises
- Increase timeout for integration tests if needed

#### TypeScript errors after pulling
```bash
# Regenerate types
npm run build:types
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=* npm run dev

# Node.js debugging
node --inspect src/index.js
```

### Getting Help

1. Check this CLAUDE.md and linked Foundry resources
2. Search codebase for similar patterns
3. Check project documentation in `docs/`
4. Ask in team channel: #ai-foundry

---

## Deployment

### Environments

| Environment | URL | Branch | Auto-deploy |
|-------------|-----|--------|-------------|
| Development | dev.example.com | `develop` | Yes |
| Staging | staging.example.com | `release/*` | Yes |
| Production | example.com | `main` | No (manual) |

### Deployment Process

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production (requires approval)
npm run deploy:prod
```

### Rollback

```bash
# Rollback to previous version
npm run rollback
```

---

## API Reference

<!-- If this project has an API, document key endpoints -->

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/items` | List all items |
| POST | `/api/items` | Create new item |
| GET | `/api/items/:id` | Get single item |

### Authentication

```bash
# Include token in header
Authorization: Bearer <token>
```

---

## Changelog

### [Unreleased]
- <!-- Current work in progress -->

### [1.0.0] - YYYY-MM-DD
- Initial release

---

## Resources

### Internal
- [Team Wiki](<!-- link -->)
- [Design Docs](<!-- link -->)
- [Runbooks](<!-- link -->)

### External
- [Framework Docs](<!-- link -->)
- [API Reference](<!-- link -->)

---

## Project-Specific Notes

<!-- 
Add any project-specific context that doesn't fit above.
This section is fully customizable and won't be overwritten by Foundry updates.
-->
