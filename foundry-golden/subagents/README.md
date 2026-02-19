# Sub-Agents — AI Foundry Agent Team

**Status:** Active — 6 specialist agents + 1 lead

This directory contains the AI Foundry agent team — a coordinated set of Claude Code sub-agents that work together to build ServiceNow AI solutions end-to-end.

## Architecture

```
Developer
    │
    ▼
┌─────────────────────┐
│  Solution Architect  │ ◄── Lead agent, dispatches specialists
│  (orchestrator)      │
└─────────┬───────────┘
          │ Dispatches via Task tool
          ├──────────────┬──────────────┬──────────────┬──────────────┐
          ▼              ▼              ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │   Tool   │  │  Skill   │  │  Agent   │  │ Workflow │  │   QA &   │
    │ Builder  │  │ Designer │  │Configurer│  │Orchestrtr│  │ Debugger │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Agent Roster

| Agent | Role | Context Files | Skills | MCP Tools |
|-------|------|--------------|--------|-----------|
| **Solution Architect** | Lead — intake, design, dispatch, validate | 6 | 3 | 4 (read-only) |
| **Tool Builder** | Script tools with schemas, test, deploy | 4 | 2 | 3 |
| **Skill Designer** | Now Assist skills with prompts and RAG | 5 | 2 | 3 |
| **Agent Configurator** | Agent creation, instructions, strategy | 5 | 2 | 4 |
| **Workflow Orchestrator** | Multi-agent wiring, triggers, handoffs | 4 | 2 | 3 |
| **QA & Debugger** | End-to-end testing, tracing, diagnosis | 6 | 3 | 7 |

## Directory Structure

```
subagents/
├── README.md                           # This file
├── solution-architect/
│   ├── AGENT.md                        # System prompt, workflow, dispatch logic
│   └── config.json                     # Context refs, skill refs, MCP tool list
├── tool-builder/
│   ├── AGENT.md
│   └── config.json
├── skill-designer/
│   ├── AGENT.md
│   └── config.json
├── agent-configurator/
│   ├── AGENT.md
│   └── config.json
├── workflow-orchestrator/
│   ├── AGENT.md
│   └── config.json
└── qa-debugger/
    ├── AGENT.md
    └── config.json
```

## How It Works

### 1. Developer Describes a Use Case

The developer talks to the **Solution Architect** agent. Example:

> "Build an agent that triages incoming P1 incidents — categorize them, set priority, and assign to the right group."

### 2. Solution Architect Designs and Dispatches

The architect:
1. Asks clarifying questions (what data, who uses it, success criteria)
2. Queries the instance for existing agents/skills
3. Produces a solution spec
4. Gets developer approval
5. Dispatches to specialists:
   - **Tool Builder** → creates `get_incident_details`, `update_incident`, `search_knowledge`
   - **Agent Configurator** → creates the triage agent with instructions
   - **QA & Debugger** → tests everything end-to-end

### 3. Specialists Build

Each specialist follows their domain-specific skill:
- Tool Builder follows `tool-script-writer`
- Skill Designer follows `now-assist-skill-builder`
- Agent Configurator follows `agent-prompt-writer`
- QA & Debugger follows `iterative-test-fix`

### 4. QA Validates

The QA & Debugger runs test cases, traces failures, categorizes root causes, and dispatches fixes back to the right specialist.

### 5. Architect Reports

Once all tests pass, the Solution Architect compiles a build report for the developer.

## Configuration Format

### AGENT.md

Each agent's AGENT.md contains:
- **Role** — What the agent does and doesn't do
- **Boundaries** — Explicit scope limits
- **Context to Read First** — Context files loaded at session start
- **Skills to Follow** — Skills that guide the workflow
- **Available MCP Tools** — Tools with when-to-use guidance
- **Workflow** — Step-by-step procedure
- **Output Format** — Exactly what to return

### config.json

```json
{
  "name": "agent-name",
  "description": "One-line purpose",
  "role": "lead | specialist",
  "context": ["context-file-1", "context-file-2"],
  "skills": ["skill-1", "skill-2"],
  "mcpTools": ["tool_1", "tool_2"],
  "outputFormat": "report-type"
}
```

## Dependencies

These agents depend on content from the golden repository:

### Context Files Required
- `servicenow-ai-data-model.md`
- `agentic-patterns.md`
- `prompt-engineering-patterns.md`
- `tool-script-rules.md`
- `tool-script-cookbook.md`
- `agent-instruction-templates.md`
- `iterative-development-workflow.md`
- `flow-designer-for-ai.md`
- `customer-interaction-patterns.md`
- `multi-agent-handoff-patterns.md`
- `data-kit-retrieval-patterns.md`
- `genai-framework.md`
- `now-assist-platform.md`
- `security-patterns.md`
- `troubleshooting-guide.md`
- `now-assist-guardian-governance.md`

### Skills Required
- `solution-design`
- `tool-script-writer`
- `agent-prompt-writer`
- `iterative-test-fix`
- `now-assist-skill-builder`
- `servicenow-agent-builder`
- `agentic-workflow-builder`
- `testing-patterns`
- `servicenow-troubleshooting`
- `servicenow-ai-evaluation`

## See Also

- [Context files](../context/) — Domain knowledge loaded by agents
- [Skills](../skills/) — Workflow skills followed by agents
- [Superpowers](https://github.com/obra/superpowers) — General-purpose workflow framework
