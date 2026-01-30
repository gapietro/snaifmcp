# Hooks

**Status:** Placeholder - Future capability

This directory will contain lifecycle hooks for Foundry projects.

## Purpose

Hooks enable automated actions at specific points in the development lifecycle:
- Pre/post project initialization
- Pre/post resource addition
- Validation before commits
- Custom workflow automation

## Current State

Foundry does not yet support hooks. This directory serves as a placeholder documenting the planned capability.

## Future Structure

When hooks are implemented, they will follow this structure:

```
hooks/
├── README.md                 # This file
├── _template/                # Template for new hooks
│   ├── HOOK.md               # Hook documentation
│   └── hook.sh               # Shell script template
└── <hook-name>/              # Actual hooks
    ├── HOOK.md               # Documentation
    ├── hook.sh               # Implementation (shell)
    └── hook.js               # Implementation (Node.js, optional)
```

### HOOK.md Format

```markdown
# Hook Name

## Trigger
When this hook runs (e.g., post-init, pre-commit).

## Purpose
What this hook accomplishes.

## Prerequisites
Required tools or configuration.

## Configuration
How to customize behavior.

## Examples
Sample invocations and outputs.
```

## Potential Hook Types

*These are planned capabilities, not yet implemented:*

| Hook | Trigger | Purpose |
|------|---------|---------|
| `post-init` | After `foundry_init` | Set up additional tooling |
| `pre-add` | Before `foundry_add` | Validate resource compatibility |
| `post-add` | After `foundry_add` | Configure added resources |
| `pre-commit` | Before git commit | Lint, format, validate |
| `post-sync` | After `foundry_sync` | Notify of updates |

## Example Use Cases

### Post-Init Hook
```bash
#!/bin/bash
# Install project dependencies
npm install

# Set up git hooks
npx husky install

# Configure IDE settings
cp .vscode/settings.template.json .vscode/settings.json
```

### Pre-Commit Hook
```bash
#!/bin/bash
# Validate CLAUDE.md structure
foundry_validate context CLAUDE.md

# Run linters
npm run lint

# Check for secrets
git secrets --scan
```

## Contributing

When ready to add hooks:

1. Create directory following the structure above
2. Document the trigger and purpose clearly
3. Make hooks idempotent (safe to run multiple times)
4. Handle errors gracefully with clear messages
5. Test on multiple platforms (macOS, Linux)

## See Also

- [Git hooks](https://git-scm.com/docs/githooks) - Standard git hook patterns
- [Claude Code hooks](https://docs.anthropic.com/claude-code/hooks) - Claude Code hook system
- [foundry-resource-types.md](../../docs/archive/foundry-resource-types.md) - Full specification
