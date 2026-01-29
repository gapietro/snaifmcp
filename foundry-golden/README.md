# Foundry Golden Repository

Central repository of vetted resources for AI Foundry team's Now Assist POC development.

## Purpose

This repository provides pre-loaded context, skills, and templates that accelerate POC development by eliminating repetitive setup work.

## Structure

```
foundry-golden/
├── context/                    # Domain knowledge and platform context
│   ├── now-assist-platform.md  # Now Assist architecture and capabilities
│   ├── genai-framework.md      # GenAI Controller and skill patterns
│   └── agentic-patterns.md     # Agentic framework and orchestration
├── skills/                     # Reusable Claude Code skills
│   ├── now-assist-skill-builder/
│   └── api-integration/
└── templates/                  # Project starter templates
    └── sparc-starter/
```

## Usage

This repository is consumed by the `foundry-mcp` server. Team members interact via Claude Code:

```
# In Claude Code
foundry_init my-poc
```

This creates a new project with all resources pre-loaded.

## Content Guidelines

### Context Files
- Written in Markdown
- Focus on practical patterns over theory
- Include code examples where helpful
- Keep updated as platform evolves

### Skills
- Each skill has a `SKILL.md` with instructions
- Include `examples/` directory with sample usage
- Test with real POC scenarios before adding

### Templates
- Provide ready-to-use `CLAUDE.md` files
- Include SPARC methodology structure
- Reference context and skills appropriately

## Contributing

1. Create content in appropriate directory
2. Test with a real POC scenario
3. Get team review
4. Merge to main

## Maintainers

AI Foundry Team
