# Foundry Golden Repository

Central repository of vetted resources for AI Foundry team's Now Assist POC development.

## Overview

This repository contains pre-loaded context, skills, and templates that accelerate POC development. Resources are automatically included in new projects created with `foundry_init`.

**Current Status:** All content complete

**Access:** This repository is **private**. Team members must authenticate with GitHub CLI (`gh auth login`) before using Foundry tools.

---

## Content Summary

| Resource Type | Count | Location |
|---------------|-------|----------|
| Context files | 6 | `context/` |
| Skills | 6 | `skills/` |
| Templates | 3 | `templates/` |

---

## Repository Structure

```
foundry-golden/
├── README.md                     # This file
├── HOWTO.md                      # Content contribution guide
├── context/                      # Domain knowledge (6 files)
│   ├── now-assist-platform.md    # Platform architecture & APIs
│   ├── genai-framework.md        # GenAI Controller & skills
│   ├── agentic-patterns.md       # Agentic framework & tools
│   ├── troubleshooting-guide.md  # Debug patterns & syslogs
│   ├── security-patterns.md      # ACLs, roles, secure coding
│   └── performance-tuning.md     # Query optimization & caching
├── skills/                       # Reusable skills (6)
│   ├── now-assist-skill-builder/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── api-integration/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── servicenow-troubleshooting/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── agent-builder/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── testing-patterns/
│   │   ├── SKILL.md
│   │   └── examples/
│   └── deployment-automation/
│       ├── SKILL.md
│       └── examples/
└── templates/                    # Project templates (3)
    ├── sparc-starter/            # Full setup (default)
    │   └── CLAUDE.md
    ├── standard/                 # Context only
    │   └── CLAUDE.md
    └── minimal/                  # Bare-bones
        └── CLAUDE.md
```

---

## Context Files (6)

Files in `context/` provide domain knowledge to Claude Code.

| File | Description | Topics Covered |
|------|-------------|----------------|
| `now-assist-platform.md` | Now Assist architecture | Capabilities, APIs, configuration |
| `genai-framework.md` | GenAI Controller | Skill invocation, prompt engineering |
| `agentic-patterns.md` | Agentic framework | Tool definitions, orchestration |
| `troubleshooting-guide.md` | Debug patterns | Syslogs, AIA logs, common issues |
| `security-patterns.md` | Security best practices | ACLs, roles, input validation |
| `performance-tuning.md` | Optimization | Query optimization, caching, N+1 |

---

## Skills (6)

Skills in `skills/` teach Claude how to perform specific tasks.

| Skill | Description | Examples Included |
|-------|-------------|-------------------|
| `now-assist-skill-builder` | Creating Now Assist skills | Manifest, testing, deployment |
| `api-integration` | ServiceNow REST APIs | Inbound/outbound patterns |
| `servicenow-troubleshooting` | Debug with tools | Skill failure, performance |
| `agent-builder` | Creating AI Agents | Incident triage agent |
| `testing-patterns` | Unit testing, ATF | Business rule tests |
| `deployment-automation` | CI/CD, update sets | Pipeline workflow |

---

## Templates (3)

Templates in `templates/` provide project starting points.

| Template | Description | Includes |
|----------|-------------|----------|
| `sparc-starter` | Full SPARC methodology (default) | All context + all skills |
| `standard` | Standard setup | All context, no skills |
| `minimal` | Bare-bones | CLAUDE.md only |

### Template Settings

| Template | Context Files | Skills |
|----------|---------------|--------|
| sparc-starter | Yes (6) | Yes (6) |
| standard | Yes (6) | No |
| minimal | No | No |

---

## How Resources Are Used

### Automatic Loading

When `foundry_init` creates a project:

1. Template's CLAUDE.md → `CLAUDE.md`
2. Context files → `.claude/context/`
3. Skills → `.claude/skills/`

### In Claude Code

Claude automatically has access to:
- **Context**: Background knowledge for informed responses
- **Skills**: Step-by-step guidance for specific tasks
- **Template**: Project structure and methodology

---

## Adding Content

### Using foundry_new

The easiest way to create new content:

```
Create a new context file called "my-patterns"
Create a new skill called "my-workflow"
```

### Manual Creation

#### Context File

```bash
# Create context file
touch context/my-patterns.md
```

Structure:
```markdown
# Topic Name

Overview of the topic.

## Key Concepts

### Concept 1
Explanation with examples...

## Code Examples

```javascript
// Working code example
```

## Best Practices

1. Practice one
2. Practice two
```

#### Skill

```bash
# Create skill directory
mkdir -p skills/my-skill/examples
touch skills/my-skill/SKILL.md
```

Structure:
```markdown
# Skill Name

Purpose and when to use.

## Instructions

### Step 1
Detailed instructions...

### Step 2
More instructions...

## Examples

See `examples/` directory.
```

---

## Quality Standards

### Content Checklist

- [ ] Minimum 50 words for context files
- [ ] Working code examples
- [ ] No placeholder text (TODO, FIXME)
- [ ] No sensitive information
- [ ] Follows markdown conventions

### Validation

Use `foundry_validate` before promoting:

```
Validate the my-patterns context file
```

### Promotion

Submit to golden repo:

```
Promote my-patterns to the golden repo with message "Add API caching patterns"
```

---

## See Also

- [HOWTO.md](HOWTO.md) - Detailed content guide
- [foundry-mcp](../foundry-mcp/) - MCP server
- [Parent README](../README.md) - Project overview
