# Foundry Golden Repository

Central repository of vetted resources for AI Foundry team's Now Assist POC development.

## Overview

This repository contains pre-loaded context, skills, and templates that accelerate POC development. Resources are automatically included in new projects created with `foundry_init`.

**Current Status:** Agent team operational — 20 context files, 13 skills, 6 sub-agents

**Access:** This repository is **private**. Team members must authenticate with GitHub CLI (`gh auth login`) before using Foundry tools.

---

## Content Summary

| Resource Type | Count | Location |
|---------------|-------|----------|
| Context files | 20 | `context/` |
| Skills | 13 | `skills/` |
| Templates | 3 | `templates/` |
| Agent Examples | 0 | `agent_examples/` |
| Sub-Agents | 6 | `subagents/` |
| Hooks | - | `hooks/` (placeholder) |

---

## Repository Structure

```
foundry-golden/
├── README.md                     # This file
├── HOWTO.md                      # Content contribution guide
├── context/                                # Domain knowledge (20 files)
│   ├── now-assist-platform.md              # Platform architecture & APIs
│   ├── genai-framework.md                  # GenAI Controller & skills
│   ├── agentic-patterns.md                 # Agentic framework & tools
│   ├── troubleshooting-guide.md            # Debug patterns & syslogs
│   ├── security-patterns.md                # ACLs, roles, secure coding
│   ├── performance-tuning.md               # Query optimization & caching
│   ├── tool-script-rules.md                # Tool script safety rules
│   ├── servicenow-ai-data-model.md         # AI table reference
│   ├── servicenow-ai-system-properties.md  # System properties
│   ├── servicenow-mcp-integration.md       # MCP integration patterns
│   ├── building-discipline.md              # Development discipline
│   ├── now-assist-guardian-governance.md    # Guardian safety filters
│   ├── prompt-engineering-patterns.md      # [NEW] Prompt templates & debugging
│   ├── tool-script-cookbook.md              # [NEW] 12 tool script recipes
│   ├── agent-instruction-templates.md      # [NEW] Strategy-specific templates
│   ├── iterative-development-workflow.md   # [NEW] MCP dev loop
│   ├── flow-designer-for-ai.md             # [NEW] Flow + AI integration
│   ├── customer-interaction-patterns.md    # [NEW] End-user channels
│   ├── multi-agent-handoff-patterns.md     # [NEW] Multi-agent wiring
│   └── data-kit-retrieval-patterns.md      # [NEW] RAG & Data Kit
├── skills/                                 # Reusable skills (13)
│   ├── now-assist-skill-builder/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── api-integration/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── servicenow-troubleshooting/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── servicenow-agent-builder/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── testing-patterns/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── deployment-automation/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── agentic-workflow-builder/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── voice-agent-builder/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── servicenow-ai-evaluation/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── solution-design/                    # [NEW] Use case intake → spec
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── tool-script-writer/                 # [NEW] Description → safe script
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── agent-prompt-writer/                # [NEW] Use case → instructions
│   │   ├── SKILL.md
│   │   └── examples/
│   └── iterative-test-fix/                 # [NEW] Test → trace → fix loop
│       ├── SKILL.md
│       └── examples/
├── templates/                    # Project templates (3)
│   ├── sparc-starter/            # Full setup (default)
│   │   └── CLAUDE.md
│   ├── standard/                 # Context only
│   │   └── CLAUDE.md
│   └── minimal/                  # Bare-bones
│       └── CLAUDE.md
├── agent_examples/               # ServiceNow agent implementations
│   ├── README.md                 # Structure and contribution guide
│   └── _template/                # Starter template for new examples
│       ├── AGENT.md              # Documentation template
│       ├── config.json           # Metadata template
│       └── src/                  # ServiceNow artifacts
├── subagents/                    # Claude sub-agents (6 agents)
│   ├── README.md                 # Agent team documentation
│   ├── solution-architect/       # Lead — intake, design, dispatch
│   │   ├── AGENT.md
│   │   └── config.json
│   ├── tool-builder/             # Safe tool scripts + schemas
│   │   ├── AGENT.md
│   │   └── config.json
│   ├── skill-designer/           # Now Assist skills + prompts
│   │   ├── AGENT.md
│   │   └── config.json
│   ├── agent-configurator/       # Agent instructions + strategy
│   │   ├── AGENT.md
│   │   └── config.json
│   ├── workflow-orchestrator/    # Multi-agent wiring + triggers
│   │   ├── AGENT.md
│   │   └── config.json
│   └── qa-debugger/              # Test, trace, diagnose, fix
│       ├── AGENT.md
│       └── config.json
└── hooks/                        # Lifecycle hooks (placeholder)
    └── README.md                 # Future use documentation
```

---

## Context Files (20)

Files in `context/` provide domain knowledge to Claude Code.

### Core Platform

| File | Description | Topics Covered |
|------|-------------|----------------|
| `now-assist-platform.md` | Now Assist architecture | Capabilities, APIs, configuration |
| `genai-framework.md` | GenAI Controller | Skill invocation, prompt engineering |
| `agentic-patterns.md` | Agentic framework | Tool definitions, orchestration |
| `troubleshooting-guide.md` | Debug patterns | Syslogs, AIA logs, common issues |
| `security-patterns.md` | Security best practices | ACLs, roles, input validation |
| `performance-tuning.md` | Optimization | Query optimization, caching, N+1 |
| `tool-script-rules.md` | Tool script safety | Forbidden APIs, GlideRecordSecure |
| `servicenow-ai-data-model.md` | AI table reference | All AIA/skill/execution tables |
| `servicenow-ai-system-properties.md` | System properties | All sn_aia.* properties |
| `servicenow-mcp-integration.md` | MCP integration | MCP server tools and patterns |
| `building-discipline.md` | Development discipline | Team conventions |
| `now-assist-guardian-governance.md` | Guardian safety | 16 safety categories, filtering |

### New Content (Agent Team Dependencies)

| File | Description | Topics Covered |
|------|-------------|----------------|
| `prompt-engineering-patterns.md` | Prompt templates | Agent type prompts, few-shot, chain-of-thought, debugging |
| `tool-script-cookbook.md` | Script recipes | 12 complete tool scripts with schemas |
| `agent-instruction-templates.md` | Instruction guide | Templates per strategy, pitfalls, length guidance |
| `iterative-development-workflow.md` | Development loop | Write → deploy → test → trace → fix with MCP tools |
| `flow-designer-for-ai.md` | Flow + AI patterns | Flow actions as tools, triggers, flow-agent integration |
| `customer-interaction-patterns.md` | User channels | Now Assist panel, VA, portal, voice, API |
| `multi-agent-handoff-patterns.md` | Multi-agent patterns | Context sharing, failure propagation, handoffs |
| `data-kit-retrieval-patterns.md` | RAG patterns | Data Kit setup, search profiles, retrieval tuning |

---

## Skills (13)

Skills in `skills/` teach Claude how to perform specific tasks.

### Core Skills

| Skill | Description | Examples Included |
|-------|-------------|-------------------|
| `now-assist-skill-builder` | Creating Now Assist skills | Case summarizer skill |
| `api-integration` | ServiceNow REST APIs | Outbound REST client |
| `servicenow-troubleshooting` | Debug with tools | Skill failure, performance |
| `servicenow-agent-builder` | Creating AI Agents | Incident triage agent |
| `testing-patterns` | Unit testing, ATF | Business rule tests |
| `deployment-automation` | CI/CD, update sets | Pipeline workflow |
| `agentic-workflow-builder` | Multi-agent workflows | Incident resolution workflow |
| `voice-agent-builder` | Voice agent creation | ITSM voice agent |
| `servicenow-ai-evaluation` | AI evaluation framework | Evaluation setup |

### New Skills (Agent Team Workflows)

| Skill | Description | Key Outputs |
|-------|-------------|-------------|
| `solution-design` | Structured use case intake → architecture spec | Solution spec document |
| `tool-script-writer` | Tool description → safe script + schemas | Working tool + deployment report |
| `agent-prompt-writer` | Use case → agent instructions | Instructions text + strategy recommendation |
| `iterative-test-fix` | Test → trace → diagnose → fix loop | Test report with pass/fail and root causes |

---

## Templates (3)

Templates in `templates/` provide project starting points.

| Template | Description | Includes |
|----------|-------------|----------|
| `sparc-starter` | Full SPARC methodology (default) | All context + all skills |
| `standard` | Standard setup | All context, no skills |
| `minimal` | Bare-bones | CLAUDE.md only |

### Template Settings

| Template | Context Files | Skills | Sub-Agents |
|----------|---------------|--------|------------|
| sparc-starter | Yes (20) | Yes (13) | Yes (6) |
| standard | Yes (20) | No | No |
| minimal | No | No | No |

---

## Agent Examples

Complete, working ServiceNow agent implementations for reference and learning.

| Status | Description |
|--------|-------------|
| **Current** | Template structure ready, no examples yet |
| **Planned** | incident-summarizer, knowledge-recommender |

Each agent example includes:
- `AGENT.md` - Documentation, architecture, lessons learned
- `config.json` - Metadata (type, complexity, platform requirements)
- `src/` - ServiceNow artifacts (skills, flows, scripts)

See [agent_examples/README.md](agent_examples/README.md) for details.

---

## Sub-Agents (Agent Team)

Directory: `subagents/`

The AI Foundry agent team — 6 specialist sub-agents coordinated by a Lead Solution Architect. Each specialist is loaded with exactly the right context, skills, and MCP tools to handle one aspect of the AI POC build pipeline.

| Agent | Role | Dispatched By |
|-------|------|---------------|
| **Solution Architect** | Lead — intake, design, dispatch, validate | Developer (direct) |
| **Tool Builder** | Safe tool scripts + schemas + deployment | Solution Architect |
| **Skill Designer** | Now Assist skills + prompts + RAG | Solution Architect |
| **Agent Configurator** | Agent instructions + strategy selection | Solution Architect |
| **Workflow Orchestrator** | Multi-agent wiring + triggers | Solution Architect |
| **QA & Debugger** | Test, trace, diagnose, fix, re-test | Solution Architect |

See [subagents/README.md](subagents/README.md) for full architecture documentation.

## Placeholders (Future)

### Hooks

Directory: `hooks/`

Future home for lifecycle hooks (post-init, pre-commit, etc.). Not yet implemented.

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

## External Plugins (Approved)

The team has vetted external plugins available via `foundry_external`:

| Plugin | Source | Description |
|--------|--------|-------------|
| `superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | Agentic skills framework with design-first workflow, TDD, and subagent-driven development |
| `servicenow-utils` | gapietro/servicenow-utils | Common ServiceNow utility scripts and patterns |
| `now-assist-testing` | gapietro/now-assist-testing | Testing patterns for Now Assist skills |

### Adding Superpowers to Your Project

Superpowers provides a complete software development workflow for AI agents:
- **Design phase** with socratic dialogue to refine specs
- **Planning** with bite-sized tasks
- **Subagent-driven development** with code review
- **Test-driven development** (RED-GREEN-REFACTOR)

```
# List available external plugins
List external Foundry plugins

# Add superpowers to your project
Add the superpowers external plugin to this project
```

This registers superpowers in `.claude/foundry-external.json` and provides instructions for setup.

### Direct GitHub References

You can also add any GitHub repo directly (at your own risk):

```
Add external plugin @github/owner/repo-name
```

---

## See Also

- [HOWTO.md](HOWTO.md) - Detailed content guide
- [foundry-mcp](../foundry-mcp/) - MCP server
- [Parent README](../README.md) - Project overview
