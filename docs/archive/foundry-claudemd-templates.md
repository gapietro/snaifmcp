# Foundry CLAUDE.md Template System

## Overview

Foundry provides layered CLAUDE.md templates that combine:
1. **Base template** — Universal best practices for all projects
2. **Stack templates** — Technology-specific guidance (ServiceNow, React, Python, etc.)
3. **Methodology templates** — Process-specific guidance (SPARC, Agile, etc.)
4. **Foundry header** — Auto-generated resource listing

These are composed during `foundry init` based on template selection.

---

## Template Structure in Golden Repo

```
foundry-golden/
├── bootstrap/
│   └── claude-md/
│       ├── base.md                    # Universal best practices
│       ├── stacks/
│       │   ├── servicenow.md          # ServiceNow-specific
│       │   ├── react.md               # React/frontend
│       │   ├── python.md              # Python projects
│       │   ├── node.md                # Node.js projects
│       │   └── ios.md                 # iOS/Swift projects
│       ├── methodologies/
│       │   ├── sparc.md               # SPARC methodology
│       │   └── agile.md               # Agile/Scrum
│       └── fragments/
│           ├── testing.md             # Testing best practices
│           ├── git.md                 # Git workflow
│           ├── security.md            # Security considerations
│           └── documentation.md       # Doc standards
```

---

## Base Template (base.md)

```markdown
# {{PROJECT_NAME}}

<!-- FOUNDRY:BEGIN -->
<!-- Auto-generated section - do not edit manually -->
<!-- FOUNDRY:END -->

## Project Overview

<!-- Describe what this project does and its primary purpose -->

## Quick Reference

### Key Commands
```bash
# Development
{{DEV_COMMANDS}}

# Testing
{{TEST_COMMANDS}}

# Build/Deploy
{{BUILD_COMMANDS}}
```

### Important Paths
| Path | Purpose |
|------|---------|
| `src/` | Source code |
| `tests/` | Test files |
| `docs/` | Documentation |

---

## Architecture

<!-- 
Describe the high-level architecture:
- Main components and their responsibilities
- Data flow between components
- External dependencies and integrations
-->

### Component Diagram
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │
│  Component  │────▶│  Component  │────▶│  Component  │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Development Guidelines

### Code Style
- Follow established patterns in existing codebase
- Prioritize readability over cleverness
- Keep functions focused and small (< 50 lines preferred)
- Use meaningful variable and function names

### File Organization
- Group related functionality together
- Keep files focused on single responsibility
- Use index files for clean exports

### Error Handling
- Always handle errors explicitly
- Provide meaningful error messages
- Log errors with sufficient context for debugging

### Comments
- Comment "why" not "what"
- Keep comments up to date with code changes
- Use TODO/FIXME with context and owner

---

## Working with Claude

### What Claude Should Know
- This project uses {{TECH_STACK}}
- Primary coding patterns: {{PATTERNS}}
- Key constraints: {{CONSTRAINTS}}

### What Claude Should Do
- Follow existing code patterns and style
- Run tests before considering work complete
- Ask clarifying questions when requirements are ambiguous
- Break large tasks into smaller, verifiable steps

### What Claude Should Avoid
- Making assumptions about unclear requirements
- Large refactors without explicit approval
- Introducing new dependencies without discussion
- Skipping tests for "simple" changes

---

## Testing Strategy

### Test Types
- **Unit tests**: Test individual functions/components in isolation
- **Integration tests**: Test component interactions
- **E2E tests**: Test complete user workflows

### Running Tests
```bash
{{TEST_RUN_COMMAND}}
```

### Test Coverage Expectations
- New code should include tests
- Bug fixes should include regression tests
- Critical paths require comprehensive coverage

---

## Git Workflow

### Branch Naming
```
feature/{{ticket}}-short-description
bugfix/{{ticket}}-short-description
hotfix/{{ticket}}-short-description
```

### Commit Messages
```
type(scope): short description

- Detail 1
- Detail 2

Refs: {{ticket}}
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Checklist
- [ ] Tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed
- [ ] No unnecessary console.logs or debug code
- [ ] Reviewed own diff before requesting review

---

## Troubleshooting

### Common Issues

#### Issue: {{COMMON_ISSUE_1}}
**Symptoms**: {{symptoms}}
**Solution**: {{solution}}

#### Issue: {{COMMON_ISSUE_2}}
**Symptoms**: {{symptoms}}
**Solution**: {{solution}}

### Debug Tips
- {{DEBUG_TIP_1}}
- {{DEBUG_TIP_2}}

### Getting Help
- Check existing documentation first
- Search codebase for similar patterns
- Ask team in {{TEAM_CHANNEL}}

---

## Resources

### Internal
- {{INTERNAL_RESOURCE_1}}
- {{INTERNAL_RESOURCE_2}}

### External
- {{EXTERNAL_RESOURCE_1}}
- {{EXTERNAL_RESOURCE_2}}

---

## Project-Specific Context

<!-- Add any project-specific information below -->
```

---

## Stack Template: ServiceNow (stacks/servicenow.md)

```markdown
## ServiceNow Development Context

### Platform Version
- Instance: {{SN_INSTANCE}}
- Version: {{SN_VERSION}}
- Scope: {{APP_SCOPE}}

### Development Patterns

#### GlideRecord Queries
```javascript
// Always use GlideRecord for server-side queries
var gr = new GlideRecord('table_name');
gr.addQuery('field', 'value');
gr.query();
while (gr.next()) {
    // Process records
}
```

#### Script Include Pattern
```javascript
var MyScriptInclude = Class.create();
MyScriptInclude.prototype = {
    initialize: function() {
    },
    
    myMethod: function(param) {
        // Implementation
    },
    
    type: 'MyScriptInclude'
};
```

#### GlideAjax Pattern (Client → Server)
```javascript
// Client-side
var ga = new GlideAjax('MyAjaxUtil');
ga.addParam('sysparm_name', 'myMethod');
ga.addParam('sysparm_param', value);
ga.getXMLAnswer(function(response) {
    // Handle response
});

// Server-side Script Include
var MyAjaxUtil = Class.create();
MyAjaxUtil.prototype = Object.extendsObject(AbstractAjaxProcessor, {
    myMethod: function() {
        var param = this.getParameter('sysparm_param');
        return JSON.stringify({ result: 'success' });
    },
    type: 'MyAjaxUtil'
});
```

### API Patterns

#### REST API (Scripted)
```javascript
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var body = request.body.data;
    
    // Process request
    
    response.setStatus(200);
    response.setBody({ result: 'success' });
})(request, response);
```

#### Table API Usage
```
GET /api/now/table/{tableName}
POST /api/now/table/{tableName}
PUT /api/now/table/{tableName}/{sys_id}
DELETE /api/now/table/{tableName}/{sys_id}
```

### Common Gotchas

1. **GlideRecord is lazy** - Call `query()` before iterating
2. **Client scripts can't access server data directly** - Use GlideAjax
3. **Business Rules run in order** - Check execution order
4. **ACLs apply to APIs** - Test with appropriate roles
5. **Scoped apps have restrictions** - Check scope access

### Testing in ServiceNow

- Use ATF (Automated Test Framework) for unit tests
- Create test data in setup, clean up in teardown
- Test with different user roles
- Verify Business Rules fire correctly

### Deployment

1. Develop in dev instance
2. Capture in Update Set
3. Move to test, validate
4. Move to prod with approval

### Useful Tables Reference
| Table | Purpose |
|-------|---------|
| `sys_user` | Users |
| `sys_user_group` | Groups |
| `task` | Base task table |
| `incident` | Incidents |
| `sc_request` | Service Requests |
| `sys_script_include` | Script Includes |
| `sys_ui_policy` | UI Policies |
```

---

## Stack Template: React (stacks/react.md)

```markdown
## React Development Context

### Project Setup
- Framework: {{REACT_FRAMEWORK}} (Next.js / Vite / CRA)
- State Management: {{STATE_MANAGEMENT}}
- Styling: {{STYLING_APPROACH}}
- Testing: {{TESTING_FRAMEWORK}}

### Component Patterns

#### Functional Components (Preferred)
```tsx
interface Props {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: Props) {
  const [state, setState] = useState<string>('');
  
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

#### Custom Hooks
```tsx
function useMyHook(initialValue: string) {
  const [value, setValue] = useState(initialValue);
  
  const updateValue = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);
  
  return { value, updateValue };
}
```

### File Structure
```
src/
├── components/
│   ├── common/          # Reusable components
│   ├── features/        # Feature-specific components
│   └── layouts/         # Layout components
├── hooks/               # Custom hooks
├── services/            # API services
├── stores/              # State management
├── types/               # TypeScript types
└── utils/               # Utility functions
```

### State Management Patterns

#### Local State
- Use `useState` for component-local state
- Use `useReducer` for complex local state

#### Global State
- Keep global state minimal
- Colocate state with components when possible
- Use context for theme/auth/i18n

### Performance Guidelines
- Memoize expensive computations with `useMemo`
- Memoize callbacks with `useCallback`
- Use `React.memo` for pure components
- Lazy load routes and heavy components

### Testing
```tsx
import { render, screen, fireEvent } from '@testing-library/react';

test('renders and responds to click', () => {
  const handleClick = jest.fn();
  render(<MyComponent title="Test" onAction={handleClick} />);
  
  expect(screen.getByText('Test')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalled();
});
```
```

---

## Methodology Template: SPARC (methodologies/sparc.md)

```markdown
## SPARC Methodology

This project follows the SPARC development methodology.

### Phases

#### 1. Specification
- Define clear requirements and acceptance criteria
- Identify constraints and dependencies
- Document assumptions

#### 2. Pseudocode
- Outline logic in plain language before coding
- Identify edge cases and error conditions
- Plan data structures and interfaces

#### 3. Architecture
- Design component structure
- Define interfaces between components
- Plan for testability and maintainability

#### 4. Refinement
- Implement in small, verifiable increments
- Test each increment before proceeding
- Refactor as patterns emerge

#### 5. Completion
- Verify all acceptance criteria met
- Ensure tests provide adequate coverage
- Document any deviations from original spec

### SPARC Artifacts

For each significant feature, create:
- [ ] `specs/{{feature}}.md` - Specification document
- [ ] `specs/{{feature}}-pseudocode.md` - Pseudocode/logic outline
- [ ] `specs/{{feature}}-architecture.md` - Design decisions

### Working with Claude in SPARC

When starting a new feature:
1. Ask Claude to help draft the specification
2. Review and refine spec with Claude
3. Have Claude generate pseudocode
4. Discuss architecture decisions
5. Implement incrementally with Claude's help
6. Have Claude verify completion criteria

### SPARC Prompts

**Starting a feature:**
> "Let's follow SPARC for {{feature}}. First, help me write a specification that covers requirements, constraints, and acceptance criteria."

**Moving to pseudocode:**
> "Based on our spec, let's write pseudocode for {{feature}}. Focus on the main logic flow and edge cases."

**Architecture phase:**
> "Now let's design the architecture. What components do we need and how should they interact?"
```

---

## Template Composition Logic

During `foundry init`, templates are composed:

```typescript
async function composeClaudeMd(
  projectName: string,
  template: TemplateConfig,
  resources: Resource[]
): Promise<string> {
  // 1. Start with base
  let content = await loadTemplate('base.md');
  
  // 2. Replace project placeholders
  content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
  
  // 3. Inject Foundry header
  const foundryHeader = generateFoundryHeader(resources);
  content = content.replace(
    '<!-- FOUNDRY:BEGIN -->\n<!-- Auto-generated section - do not edit manually -->\n<!-- FOUNDRY:END -->',
    foundryHeader
  );
  
  // 4. Append stack templates
  if (template.stacks) {
    for (const stack of template.stacks) {
      const stackContent = await loadTemplate(`stacks/${stack}.md`);
      content += '\n\n---\n\n' + stackContent;
    }
  }
  
  // 5. Append methodology templates
  if (template.methodologies) {
    for (const method of template.methodologies) {
      const methodContent = await loadTemplate(`methodologies/${method}.md`);
      content += '\n\n---\n\n' + methodContent;
    }
  }
  
  // 6. Append selected fragments
  if (template.fragments) {
    for (const fragment of template.fragments) {
      const fragmentContent = await loadTemplate(`fragments/${fragment}.md`);
      content += '\n\n---\n\n' + fragmentContent;
    }
  }
  
  return content;
}
```

---

## Template Configs

### minimal/template.json
```json
{
  "name": "minimal",
  "claudeMd": {
    "base": true,
    "stacks": [],
    "methodologies": [],
    "fragments": []
  }
}
```

### standard/template.json
```json
{
  "name": "standard",
  "claudeMd": {
    "base": true,
    "stacks": [],
    "methodologies": [],
    "fragments": ["git", "testing"]
  }
}
```

### sparc-full/template.json
```json
{
  "name": "sparc-full",
  "claudeMd": {
    "base": true,
    "stacks": ["servicenow"],
    "methodologies": ["sparc"],
    "fragments": ["git", "testing", "documentation"]
  }
}
```

### Custom template example
```json
{
  "name": "react-app",
  "claudeMd": {
    "base": true,
    "stacks": ["react", "node"],
    "methodologies": [],
    "fragments": ["git", "testing"]
  }
}
```

---

## CLI Extensions

```bash
# Init with specific stacks
foundry init my-project --stack servicenow --stack node

# Init with methodology
foundry init my-project --methodology sparc

# Init with fragments
foundry init my-project --fragment security --fragment documentation

# Full example
foundry init my-sn-project \
  --template standard \
  --stack servicenow \
  --methodology sparc \
  --fragment security
```

---

## Updating CLAUDE.md Templates

When the base template or stack templates are updated in the golden repo:

```bash
# Check if local CLAUDE.md has template updates available
foundry doctor

# Output:
# ⚠️  CLAUDE.md template has updates available
#    Base template: v1.0.0 → v1.1.0
#    Stack (servicenow): v1.2.0 → v1.3.0

# Preview what would change
foundry update-claudemd --dry-run

# Apply updates (preserves custom sections)
foundry update-claudemd
```

The update process:
1. Identifies Foundry-managed sections (between markers)
2. Preserves user-customized sections
3. Updates template sections with new content
4. Regenerates Foundry header with current resources

---

## Best Practices Encoded in Templates

### Universal (in base.md)
- Clear project structure documentation
- Explicit commands for common tasks
- Architecture documentation expectations
- Code style guidelines
- Error handling patterns
- Git workflow standards
- Testing expectations
- Troubleshooting guide structure

### ServiceNow-Specific
- GlideRecord patterns
- Script Include structure
- GlideAjax client-server communication
- REST API patterns
- Common gotchas and pitfalls
- ATF testing approach
- Update Set workflow

### SPARC-Specific
- Phase definitions and artifacts
- Prompts for each phase
- Artifact checklist
- Integration with Claude workflows
