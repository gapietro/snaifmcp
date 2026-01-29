# Foundry Resource Types Specification

## Overview

The Foundry MCP server manages six core resource types. Each has different storage formats, usage patterns, and distribution mechanisms.

---

## Resource Type Matrix

| Type | What It Is | File Format | How Claude Uses It | Distribution |
|------|-----------|-------------|-------------------|--------------|
| **Skills** | Instructions that teach Claude capabilities | `SKILL.md` | Read into context via settings | Copy to project |
| **Context** | Domain knowledge, project info, conventions | `CONTEXT.md` | Read into context | Copy to project |
| **Sub-Agents** | Specialized agent definitions with prompts | `AGENT.md` + config | Orchestrated by claude-flow | Copy to project |
| **Prompts** | Reusable prompt templates/fragments | `.md` files | Inserted into conversations | Copy to project |
| **MCP Servers** | External tool integrations | Package + config | Connected via MCP protocol | Install + configure |
| **Commands** | Custom slash commands | JSON + scripts | Available as /commands | Copy to project |

---

## 1. Skills (`@foundry/skills/*`)

**What:** Markdown instructions that teach Claude how to perform specific tasks.

**Structure:**
```
skills/
└── research/
    ├── SKILL.md              # Main skill definition
    ├── manifest.json         # Metadata, version, deps
    ├── examples/             # Usage examples
    │   ├── basic-search.md
    │   └── deep-dive.md
    └── tools/                # Supporting scripts (optional)
        └── fetch-helper.sh
```

**SKILL.md Format:**
```markdown
# @foundry/research

## Purpose
Deep research capability with web search, source synthesis, and citation.

## When to Use
- User asks for research on a topic
- Need to gather information from multiple sources
- Fact-checking or verification tasks

## Instructions
1. Start by understanding the research question
2. Break into sub-queries if complex
3. Search for authoritative sources first
4. Cross-reference claims across sources
5. Synthesize findings with citations

## Output Format
- Executive summary (2-3 sentences)
- Key findings (bulleted)
- Sources (linked)

## Examples
[See examples/ directory]

## Dependencies
- Requires: @foundry/context/team-conventions (for citation style)
```

**MCP Handling:**
```typescript
// foundry_add("skill", "research") does:
1. Fetch skill from golden repo
2. Copy to .foundry/linked/skills/@foundry/research/
3. Update project.json dependencies
4. Update .claude/settings.json to include skill path
```

---

## 2. Context (`@foundry/context/*`)

**What:** Domain knowledge, platform information, team conventions that Claude should know.

**Structure:**
```
context/
└── servicenow-base/
    ├── CONTEXT.md            # Main context document
    ├── manifest.json
    └── reference/            # Supporting docs (optional)
        ├── api-patterns.md
        └── data-model.md
```

**CONTEXT.md Format:**
```markdown
# @foundry/context/servicenow-base

## ServiceNow Platform Fundamentals

### Overview
ServiceNow is a cloud-based platform for enterprise service management...

### Key Concepts
- **Tables**: Core data storage (like sys_user, incident, task)
- **Scripts**: Server-side (Business Rules, Script Includes) and client-side
- **Flows**: Low-code automation via Flow Designer
- **Scoped Apps**: Isolated application containers

### API Patterns
- REST API: /api/now/table/{tableName}
- GlideRecord for server-side queries
- GlideAjax for client-server communication

### Team Conventions
- Always use scoped apps for new development
- Prefer Flow Designer over workflows
- Use Script Includes for reusable server logic

### Common Gotchas
- GlideRecord queries are lazy; call query() before iterating
- Client scripts can't directly access server data
- Always check ACLs when exposing APIs
```

**MCP Handling:**
```typescript
// foundry_add("context", "servicenow-base") does:
1. Fetch context from golden repo
2. Copy to .foundry/linked/context/@foundry/servicenow-base/
3. Update project.json
4. Optionally inject reference in CLAUDE.md header
```

---

## 3. Sub-Agents (`@foundry/agents/*`)

**What:** Specialized agent definitions for claude-flow orchestration with dedicated system prompts and tool configurations.

**Structure:**
```
agents/
└── sparc-planner/
    ├── AGENT.md              # Agent definition + behavior
    ├── manifest.json
    ├── system-prompt.md      # Full system prompt
    ├── config.json           # claude-flow config
    └── prompts/              # Phase-specific prompts
        ├── specification.md
        ├── pseudocode.md
        ├── architecture.md
        ├── refinement.md
        └── completion.md
```

**AGENT.md Format:**
```markdown
# @foundry/agents/sparc-planner

## Purpose
Orchestrates SPARC methodology phases for project planning and execution.

## Role
You are a SPARC Planning Agent responsible for guiding development through 
the five SPARC phases: Specification, Pseudocode, Architecture, Refinement, Completion.

## Capabilities
- Break down project requirements into SPARC phases
- Generate phase-appropriate artifacts
- Track progress and dependencies between phases
- Coordinate with specialist sub-agents

## Integration
Works with claude-flow as an orchestrator agent. Delegates to:
- @foundry/agents/code-writer (implementation)
- @foundry/agents/reviewer (quality checks)

## Configuration
See config.json for claude-flow integration settings.
```

**config.json Format:**
```json
{
  "name": "sparc-planner",
  "type": "orchestrator",
  "model": "claude-sonnet-4-20250514",
  "maxTurns": 50,
  "tools": ["read_file", "write_file", "execute_command"],
  "delegates": [
    "@foundry/agents/code-writer",
    "@foundry/agents/reviewer"
  ],
  "systemPrompt": "./system-prompt.md"
}
```

**MCP Handling:**
```typescript
// foundry_add("agent", "sparc-planner") does:
1. Fetch agent from golden repo
2. Resolve delegate dependencies (recursive)
3. Copy to .foundry/linked/agents/@foundry/sparc-planner/
4. Update project.json
5. Generate/update claude-flow config if present
```

---

## 4. Prompts (`@foundry/prompts/*`)

**What:** Reusable prompt templates and fragments for common tasks.

**Structure:**
```
prompts/
├── templates/                # Complete prompt templates
│   ├── feature-spec/
│   │   ├── PROMPT.md
│   │   ├── manifest.json
│   │   └── examples/
│   └── bug-analysis/
│       ├── PROMPT.md
│       └── manifest.json
│
└── fragments/                # Composable prompt pieces
    ├── output-json/
    │   ├── FRAGMENT.md
    │   └── manifest.json
    ├── chain-of-thought/
    │   ├── FRAGMENT.md
    │   └── manifest.json
    └── citations/
        ├── FRAGMENT.md
        └── manifest.json
```

**PROMPT.md Format (Template):**
```markdown
# @foundry/prompts/templates/feature-spec

## Purpose
Generate a comprehensive feature specification from requirements.

## Variables
- {{feature_name}}: Name of the feature
- {{requirements}}: Raw requirements input
- {{target_platform}}: Platform (web, mobile, ServiceNow, etc.)

## Template

### Feature Specification: {{feature_name}}

#### Requirements Analysis
Analyze the following requirements:
{{requirements}}

#### User Stories
Generate user stories in the format:
As a [user type], I want [goal] so that [benefit].

#### Acceptance Criteria
For each user story, define testable acceptance criteria.

#### Technical Considerations
Identify technical constraints and considerations for {{target_platform}}.

#### Dependencies
List any dependencies on other features or systems.

---

## Usage
```
Use @foundry/prompts/templates/feature-spec with:
- feature_name: "User Authentication"
- requirements: [paste requirements]
- target_platform: "ServiceNow"
```
```

**FRAGMENT.md Format:**
```markdown
# @foundry/prompts/fragments/output-json

## Purpose
Instruct Claude to output valid JSON.

## Fragment

Respond ONLY with valid JSON. No markdown code fences, no explanation, no preamble.
The response must be parseable by JSON.parse() directly.

## Usage
Append to any prompt where JSON output is required.
```

**MCP Handling:**
```typescript
// foundry_add("prompt", "templates/feature-spec") does:
1. Fetch prompt from golden repo
2. Copy to .foundry/linked/prompts/@foundry/templates/feature-spec/
3. Update project.json
4. Make available for interpolation via foundry_prompt tool

// New tool for using prompts:
@tool foundry_prompt(
  template: string,           // e.g., "templates/feature-spec"
  variables: Record<string, string>
): string                     // Returns interpolated prompt
```

---

## 5. MCP Servers (`@foundry/mcp/*`)

**What:** Pre-configured MCP server packages for external tool integrations.

**Structure:**
```
mcp/
└── servicenow-api/
    ├── README.md             # Setup and usage docs
    ├── manifest.json
    ├── package.json          # npm package definition
    ├── src/
    │   ├── index.ts
    │   └── tools/
    │       ├── records.ts
    │       ├── scripts.ts
    │       └── flows.ts
    └── config-template.json  # Template for user config
```

**manifest.json for MCP:**
```json
{
  "name": "servicenow-api",
  "type": "mcp",
  "version": "1.0.0",
  "description": "MCP server for ServiceNow REST API integration",
  
  "package": {
    "registry": "npm",
    "name": "@servicenow-aif/mcp-servicenow",
    "installCommand": "npm install -g @servicenow-aif/mcp-servicenow"
  },
  
  "config": {
    "template": "./config-template.json",
    "requiredEnv": ["SN_INSTANCE", "SN_USERNAME", "SN_PASSWORD"]
  },
  
  "tools": [
    "sn_query_records",
    "sn_create_record", 
    "sn_update_record",
    "sn_execute_script",
    "sn_trigger_flow"
  ]
}
```

**config-template.json:**
```json
{
  "mcpServers": {
    "servicenow": {
      "command": "npx",
      "args": ["@servicenow-aif/mcp-servicenow"],
      "env": {
        "SN_INSTANCE": "${SN_INSTANCE}",
        "SN_USERNAME": "${SN_USERNAME}",
        "SN_PASSWORD": "${SN_PASSWORD}"
      }
    }
  }
}
```

**MCP Handling:**
```typescript
// foundry_add("mcp", "servicenow-api") does:
1. Fetch MCP server manifest from golden repo
2. Run install command (npm install -g @servicenow-aif/mcp-servicenow)
3. Merge config-template.json into user's .claude/mcp.json
4. Prompt user for required env vars if not set
5. Update project.json

// Additional MCP-specific tools:
@tool foundry_mcp_list(): MCPServerInfo[]
// List all available MCP servers in golden repo

@tool foundry_mcp_configure(name: string, env: Record<string, string>): void
// Configure an installed MCP server's environment
```

---

## 6. Commands (`@foundry/commands/*`)

**What:** Custom slash commands for Claude Code.

**Structure:**
```
commands/
└── deploy/
    ├── command.json          # Command definition
    ├── manifest.json
    └── scripts/              # Supporting scripts
        └── deploy.sh
```

**command.json Format:**
```json
{
  "name": "deploy",
  "description": "Deploy current project to ServiceNow instance",
  "arguments": [
    {
      "name": "instance",
      "description": "Target ServiceNow instance",
      "required": true
    },
    {
      "name": "scope",
      "description": "Application scope",
      "required": false,
      "default": "current"
    }
  ],
  "steps": [
    {
      "type": "script",
      "path": "./scripts/deploy.sh",
      "args": ["$instance", "$scope"]
    }
  ]
}
```

**MCP Handling:**
```typescript
// foundry_add("command", "deploy") does:
1. Fetch command from golden repo
2. Copy to .claude/commands/@foundry/deploy/
3. Register command in Claude Code
4. Update project.json
```

---

## Complete MCP Server Tools

```typescript
// ============ DISCOVERY ============

@tool foundry_search(
  query: string,
  type?: "skill" | "context" | "agent" | "prompt" | "mcp" | "command",
  tags?: string[]
): SearchResult[]

@tool foundry_info(
  type: ResourceType,
  name: string,
  includeVersions?: boolean
): ResourceInfo

@tool foundry_catalog(
  type?: ResourceType
): CatalogEntry[]


// ============ PROJECT MANAGEMENT ============

@tool foundry_init(
  projectName: string,
  template?: string,
  resources?: ResourceSpec[]
): InitResult

@tool foundry_add(
  type: ResourceType,
  name: string,
  version?: string
): AddResult

@tool foundry_remove(
  type: ResourceType,
  name: string
): RemoveResult

@tool foundry_sync(
  dryRun?: boolean
): SyncResult

@tool foundry_list(
  type?: ResourceType,
  includeOutdated?: boolean
): ProjectResources


// ============ PROMPTS ============

@tool foundry_prompt(
  template: string,
  variables: Record<string, string>
): string


// ============ MCP SERVERS ============

@tool foundry_mcp_install(
  name: string
): InstallResult

@tool foundry_mcp_configure(
  name: string,
  env: Record<string, string>
): ConfigResult

@tool foundry_mcp_status(): MCPStatus[]


// ============ CONTRIBUTION ============

@tool foundry_new(
  type: ResourceType,
  name: string,
  description?: string
): NewResourceResult

@tool foundry_validate(
  type: ResourceType,
  name: string
): ValidationResult

@tool foundry_promote(
  type: ResourceType,
  name: string,
  message: string
): PromoteResult


// ============ UTILITY ============

@tool foundry_doctor(): HealthCheck
// Check Foundry setup, connectivity, permissions

@tool foundry_upgrade(): UpgradeResult
// Upgrade Foundry MCP server itself
```

---

## Resource Resolution

When Claude or a tool references a resource:

```
Resolution Order:
1. Explicit namespace (@foundry/research) → Golden repo only
2. Explicit local (@local/my-skill) → Project only
3. No namespace (research) → 
   a. Check project .foundry/linked/ 
   b. Check project local (./skills/, ./agents/, etc.)
   c. Check golden repo (if auto-fetch enabled)
```

---

## Project Structure After Full Setup

```
my-project/
├── .foundry/
│   ├── project.json              # Project manifest
│   ├── lock.json                 # Locked versions
│   └── linked/                   # All linked resources
│       ├── skills/
│       │   └── @foundry/
│       │       ├── research/
│       │       └── code-review/
│       ├── context/
│       │   └── @foundry/
│       │       ├── servicenow-base/
│       │       └── sparc-methodology/
│       ├── agents/
│       │   └── @foundry/
│       │       └── sparc-planner/
│       ├── prompts/
│       │   └── @foundry/
│       │       └── templates/
│       └── commands/
│           └── @foundry/
│               └── deploy/
│
├── .claude/
│   ├── settings.json             # Points to linked resources
│   ├── mcp.json                  # MCP server configs
│   └── commands/                 # Symlink to .foundry/linked/commands
│
├── CLAUDE.md                     # Project context (with Foundry header)
│
├── skills/                       # Project-local skills
├── agents/                       # Project-local agents
├── context/                      # Project-local context
│
└── src/                          # Your code
```

---

## Summary

| Need | Solution |
|------|----------|
| Teach Claude new capabilities | Skills |
| Give Claude domain knowledge | Context |
| Multi-agent orchestration | Sub-Agents (claude-flow) |
| Reusable prompt patterns | Prompts (templates + fragments) |
| External tool integrations | MCP Servers |
| Custom slash commands | Commands |

**All managed through the single Foundry MCP server**, with consistent:
- Versioning (semver)
- Namespacing (@foundry/*)
- Discovery (search, catalog, info)
- Distribution (add, sync)
- Contribution (new, validate, promote)
