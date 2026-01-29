# Foundry Golden Repository

Central repository of vetted resources for AI Foundry team's Now Assist POC development.

## Overview

This repository contains pre-loaded context, skills, and templates that accelerate POC development. Resources are automatically included in new projects created with `foundry_init`.

**Current Status:** MVP content complete

## Quick Reference

| Resource Type | Count | Location |
|---------------|-------|----------|
| Context files | 3 | `context/` |
| Skills | 2 | `skills/` |
| Templates | 1 | `templates/` |

## Repository Structure

```
foundry-golden/
├── README.md               # This file
├── HOWTO.md               # Guide for adding content
├── CONTENT-GUIDE.md       # Writing standards
├── context/               # Domain knowledge files
│   ├── now-assist-platform.md
│   ├── genai-framework.md
│   └── agentic-patterns.md
├── skills/                # Reusable Claude Code skills
│   ├── now-assist-skill-builder/
│   │   ├── SKILL.md
│   │   └── examples/
│   └── api-integration/
│       ├── SKILL.md
│       └── examples/
└── templates/             # Project starter templates
    └── sparc-starter/
        └── CLAUDE.md
```

## Content Overview

### Context Files

Files in `context/` provide domain knowledge to Claude Code.

| File | Description | Use When |
|------|-------------|----------|
| `now-assist-platform.md` | Now Assist architecture, capabilities, APIs | Building any Now Assist feature |
| `genai-framework.md` | GenAI Controller, skill invocation patterns | Creating AI skills, working with prompts |
| `agentic-patterns.md` | Tool definitions, orchestration, error handling | Building agentic workflows |

### Skills

Skills in `skills/` teach Claude how to perform specific tasks.

| Skill | Description | Includes |
|-------|-------------|----------|
| `now-assist-skill-builder` | Create Now Assist skills | Manifest structure, testing, deployment |
| `api-integration` | ServiceNow API patterns | REST auth, CRUD, error handling |

### Templates

Templates in `templates/` provide project starting points.

| Template | Description | Best For |
|----------|-------------|----------|
| `sparc-starter` | SPARC methodology template | All POCs (default) |

## How Resources Are Used

### Automatic Loading

When `foundry_init` creates a project:

1. Context files → `.claude/context/`
2. Skills → `.claude/skills/`
3. Template → `CLAUDE.md`

### In Claude Code

Claude automatically has access to:
- **Context**: Background knowledge for informed responses
- **Skills**: Step-by-step guidance for specific tasks
- **Template**: Project structure and methodology

## Content Guidelines

### Context Files

- **Format**: Markdown with code examples
- **Focus**: Practical patterns over theory
- **Length**: Comprehensive but scannable
- **Updates**: Keep current as platform evolves

### Skills

- **Required**: `SKILL.md` with clear instructions
- **Optional**: `examples/` directory with samples
- **Style**: Step-by-step, actionable guidance
- **Testing**: Validate with real POC scenarios

### Templates

- **Placeholders**: Use `{{PROJECT_NAME}}` for substitution
- **Structure**: Include methodology and conventions
- **References**: Point to context and skills appropriately

## Adding New Content

See [HOWTO.md](HOWTO.md) for detailed instructions on:
- Adding context files
- Creating new skills
- Building templates
- Testing your additions

See [CONTENT-GUIDE.md](CONTENT-GUIDE.md) for:
- Writing standards
- Formatting conventions
- Example structures

## Quality Standards

### Before Adding Content

- [ ] Tested with real POC scenario
- [ ] Follows formatting conventions
- [ ] No sensitive/proprietary information
- [ ] Reviewed by team member

### Content Review Checklist

- [ ] Clear, actionable instructions
- [ ] Working code examples
- [ ] Appropriate level of detail
- [ ] Consistent with existing content

## Roadmap

### Current (MVP)
- [x] Core Now Assist context
- [x] GenAI framework patterns
- [x] Agentic patterns
- [x] Skill builder guidance
- [x] API integration patterns
- [x] SPARC starter template

### Planned
- [ ] Additional skills based on POC feedback
- [ ] More specialized templates
- [ ] Integration patterns for common use cases
- [ ] Testing and validation guidance

## Maintenance

### Update Frequency

| Content Type | Review Cycle |
|--------------|--------------|
| Context files | Quarterly or on platform changes |
| Skills | As patterns evolve |
| Templates | Based on team feedback |

### Version History

Content changes are tracked via git. Major updates should be noted in commit messages.

## Contributing

1. Create/edit content in appropriate directory
2. Test with a real POC scenario
3. Get team review
4. Merge to main

See [HOWTO.md](HOWTO.md) for detailed contribution workflow.

## License

MIT

## See Also

- [HOWTO.md](HOWTO.md) - Adding and maintaining content
- [CONTENT-GUIDE.md](CONTENT-GUIDE.md) - Writing standards
- [foundry-mcp](../foundry-mcp/) - MCP server that uses this content
- [Parent README](../README.md) - Overall project documentation
