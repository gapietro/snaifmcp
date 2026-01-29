# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Foundry Team Context

**AI Foundry** is a team within ServiceNow focused on rapid POC/POV development for agentic use cases using **ServiceNow Now Assist** and the **ServiceNow Agentic framework**. The team uses **Claude Code** as the primary tool for designing and deploying customer agents quickly.

## What This Repository Is

Design documents from a brainstorming session on how to:
- **Bootstrap projects quickly** with all necessary tools, plugins, context, and resources
- **Create a central "Golden Repo"** storing reusable, vetted resources
- **Accelerate onboarding** so new team members become productive fast
- **Speed up experienced team members** by eliminating repetitive setup

**Status:** MVP complete - `foundry_init` MCP tool operational with golden repo content.

## The Problem We're Solving

Every new POC currently requires manually gathering:
- ServiceNow platform context and patterns
- Team coding conventions
- Useful Claude Code skills
- MCP server configurations
- Project scaffolding

This is slow and inconsistent. Foundry centralizes and automates this.

## Proposed Solution: Foundry

### Two Repositories
| Repo | Purpose |
|------|---------|
| **foundry-golden** | Central store of vetted resources (skills, context, agents, prompts, MCP configs, commands) |
| **foundry-mcp** | MCP server that Claude Code uses to interact with the golden repo |

### Workflow for Team Members

**New team member:**
```
foundry init my-poc --template sparc-full
```
Gets a project pre-loaded with ServiceNow context, SPARC methodology, team conventions, and approved skills.

**Adding resources mid-project:**
```
foundry add skill @foundry/servicenow-api
foundry add context @foundry/now-assist-patterns
```

**Contributing back:**
```
foundry new skill my-useful-skill
foundry validate skill my-useful-skill
foundry promote skill my-useful-skill --message "Adds X capability"
```

### Resource Types
| Type | What It Provides |
|------|------------------|
| **Skills** | Teach Claude specific capabilities (research, code review, etc.) |
| **Context** | Domain knowledge (ServiceNow platform, Now Assist, team conventions) |
| **Agents** | Pre-configured sub-agents for claude-flow orchestration |
| **Prompts** | Reusable templates and fragments |
| **MCP Servers** | Pre-approved external tool integrations |
| **Commands** | Custom slash commands |

### Three-Tier Resource System
- `@foundry/*` - Team-created, fully controlled
- `@approved/*` - External plugins vetted and pinned by the team
- `@github/*` / `@npm/*` - Direct references (use at own risk)

## Repository Structure

```
snaifmcp/
├── CLAUDE.md                 # This file
├── .mcp.json                 # MCP server configuration
├── foundry-mcp/              # MCP server implementation (MVP complete)
├── foundry-golden/           # Golden repo content (context, skills, templates)
└── docs/
    ├── spec/                 # Specifications
    ├── plan/                 # Implementation plans & designs
    └── archive/              # Reference docs & future phase designs
```

## Documentation

### Spec (`docs/spec/`)
| Document | Covers |
|----------|--------|
| `foundry-mvp-spec.md` | MVP requirements, acceptance criteria, validation plan |

### Plan (`docs/plan/`)
| Document | Covers |
|----------|--------|
| `foundry-implementation-plan.md` | Full implementation roadmap with TypeScript code |
| `foundry-mcp-server-design.md` | MCP architecture, tools, conversation examples |

### Archive (`docs/archive/`) - Future Phases
| Document | Covers |
|----------|--------|
| `foundry-resource-types.md` | Detailed specs for all six resource types |
| `foundry-golden-repo-framework.md` | Golden repo structure, CLI, linking mechanism |
| `foundry-external-plugins.md` | External plugin approval and management |
| `foundry-claudemd-templates.md` | Composable CLAUDE.md templates |
| `default-claude-md-template.md` | Template reference |
| `foundry-presentation.jsx` | Concept presentation |

## Implementation Phases

1. **MVP (Complete)** - `foundry_init` tool, golden repo with Now Assist context, skills, SPARC template
2. **Foundation** - Add `foundry add`, `foundry sync`, `foundry list` tools
3. **Discovery** - Search, catalog, info tools; external registry support
4. **Contribution** - New, validate, promote workflow
5. **Rollout** - Documentation, content migration, team pilot

## Development Guidelines

- Target stack: TypeScript with @modelcontextprotocol/sdk
- Focus on practical workflows that save team members time
- Keep ServiceNow/Now Assist context central to resource design
- Test with `npm test` in foundry-mcp/ to validate against acceptance criteria
