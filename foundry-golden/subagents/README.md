# Sub-Agents

**Status:** Placeholder - Future capability

This directory will contain Claude Code sub-agents for workflow orchestration.

## Purpose

Sub-agents are specialized Claude Code agents that handle specific tasks within a larger workflow. They enable:
- Parallel execution of independent tasks
- Specialized expertise for different domains
- Consistent patterns across projects

## Current Approach

The AI Foundry team currently uses **Superpowers** for workflow orchestration:

```
# Add superpowers to your project
foundry_external action="add" source="@approved/superpowers"
```

Superpowers provides:
- Design-first workflow with socratic dialogue
- Subagent-driven development
- Test-driven development patterns
- Code review automation

## Future Structure

When sub-agents are added, they will follow this structure:

```
subagents/
├── README.md                 # This file
├── _template/                # Template for new sub-agents
│   ├── SUBAGENT.md           # Configuration and instructions
│   └── examples/             # Usage examples
└── <subagent-name>/          # Actual sub-agents
    ├── SUBAGENT.md
    └── examples/
```

### SUBAGENT.md Format

```markdown
# Sub-Agent Name

## Purpose
What this sub-agent specializes in.

## Tools
What tools it has access to (Read, Write, Bash, etc.)

## Instructions
Detailed instructions for the sub-agent's behavior.

## Examples
How to invoke and what to expect.
```

## Planned Sub-Agents

*These are future capabilities, not yet implemented:*

| Sub-Agent | Purpose |
|-----------|---------|
| `code-reviewer` | Review code changes for quality and patterns |
| `security-reviewer` | Check for security vulnerabilities |
| `servicenow-validator` | Validate ServiceNow artifacts |
| `documentation-writer` | Generate documentation from code |

## Contributing

When ready to add sub-agents:

1. Create directory following the structure above
2. Define clear purpose and boundaries
3. Include working examples
4. Test with real workflows
5. Document integration patterns

## See Also

- [Superpowers](https://github.com/obra/superpowers) - Current workflow framework
- [foundry-resource-types.md](../../docs/archive/foundry-resource-types.md) - Full specification
- [Skills directory](../skills/) - Reusable Claude Code skills
