# Foundry MCP Server Design

## Overview

An MCP (Model Context Protocol) server that provides Claude Code with native access to the Foundry Golden Repo. This enables conversational project bootstrapping and resource management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FOUNDRY ECOSYSTEM                           │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────────┐        ┌─────────────┐
  │              │         │                  │        │             │
  │  Golden Repo │◄───────►│  Foundry MCP     │◄──────►│ Claude Code │
  │  (GitHub)    │  fetch  │  Server          │  MCP   │             │
  │              │         │                  │        │             │
  └──────────────┘         └──────────────────┘        └─────────────┘
         ▲                         │
         │                         │
         │ PR                      │ file ops
         │                         ▼
         │                 ┌──────────────────┐
         └─────────────────│  Local Project   │
                promote    │  (.foundry/)     │
                           └──────────────────┘
```

---

## MCP Server Tools

### Discovery Tools

```typescript
// Search the golden repo for resources
@tool foundry_search(
  query: string,
  type?: "skill" | "agent" | "context" | "prompt",
  tags?: string[]
): SearchResult[]

// Get detailed info about a resource
@tool foundry_info(
  type: "skill" | "agent" | "context" | "prompt",
  name: string,
  includeVersions?: boolean
): ResourceInfo

// List all available resources
@tool foundry_catalog(
  type?: "skill" | "agent" | "context" | "prompt"
): CatalogEntry[]
```

### Project Management Tools

```typescript
// Initialize a new Foundry project
@tool foundry_init(
  projectName: string,
  template?: "minimal" | "standard" | "sparc-full",
  resources?: ResourceSpec[]
): InitResult

// Add a resource to current project
@tool foundry_add(
  type: "skill" | "agent" | "context" | "prompt",
  name: string,
  version?: string  // defaults to "latest"
): AddResult

// Remove a resource from current project
@tool foundry_remove(
  type: "skill" | "agent" | "context" | "prompt",
  name: string
): RemoveResult

// Sync project with golden repo (update linked resources)
@tool foundry_sync(
  dryRun?: boolean
): SyncResult

// List resources in current project
@tool foundry_list(
  includeOutdated?: boolean
): ProjectResources
```

### Contribution Tools

```typescript
// Scaffold a new local resource
@tool foundry_new(
  type: "skill" | "agent" | "context" | "prompt",
  name: string,
  description?: string
): NewResourceResult

// Validate a resource before promotion
@tool foundry_validate(
  type: "skill" | "agent" | "context" | "prompt",
  name: string
): ValidationResult

// Promote local resource to golden repo (creates PR)
@tool foundry_promote(
  type: "skill" | "agent" | "context" | "prompt",
  name: string,
  message: string
): PromoteResult
```

---

## MCP Server Resources

The server also exposes resources for Claude to read:

```typescript
// Current project manifest
@resource foundry://project/manifest
// Returns: project.json contents

// Golden repo registry (cached)
@resource foundry://golden/registry
// Returns: full registry.json

// Specific resource content
@resource foundry://golden/{type}/{name}
// Returns: SKILL.md, AGENT.md, etc.

// Resource manifest
@resource foundry://golden/{type}/{name}/manifest
// Returns: manifest.json for resource
```

---

## Conversation Examples

### Bootstrapping a New Project

**User:** "Start a new ServiceNow integration project using SPARC"

**Claude:** 
```
I'll set up a new Foundry project with the SPARC template and relevant ServiceNow resources.

[calls foundry_init with template="sparc-full"]
[calls foundry_add for context/servicenow-base]
[calls foundry_add for skills/servicenow-api]

Created project with:
- SPARC methodology context and planning agent
- ServiceNow platform context
- ServiceNow API skill

Your project is ready at ./servicenow-integration/
```

### Discovering Resources

**User:** "What skills do we have for code review?"

**Claude:**
```
[calls foundry_search with query="code review", type="skill"]

Found 2 skills:

1. @foundry/code-review (v2.1.0)
   Automated code review patterns for JS/TS/Python
   Tags: review, quality, linting
   
2. @foundry/pr-reviewer (v1.0.0)  
   GitHub PR review assistant with inline comments
   Tags: review, github, pr

Want me to add either to your current project?
```

### Contributing Back

**User:** "I built a skill for Glide API integration, let's share it with the team"

**Claude:**
```
[calls foundry_validate for skills/glide-api]

Validation passed ✓
- manifest.json valid
- Dependencies resolved
- Documentation present

[calls foundry_promote with message="Add Glide API integration skill"]

Created PR #47 in foundry-golden repo.
Assigned to @reviewer for approval.

You can track it at: github.com/servicenow-aif/foundry-golden/pull/47
```

---

## Server Configuration

Users add to their Claude Code MCP settings:

```json
// .claude/mcp.json or global config
{
  "mcpServers": {
    "foundry": {
      "command": "npx",
      "args": ["@servicenow-aif/foundry-mcp"],
      "env": {
        "FOUNDRY_GOLDEN_REPO": "github.com/servicenow-aif/foundry-golden",
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Or for team-wide deployment, host it as a remote MCP server.

---

## Implementation Stack

```
foundry-mcp/
├── src/
│   ├── index.ts              # MCP server entry
│   ├── tools/
│   │   ├── discovery.ts      # search, info, catalog
│   │   ├── project.ts        # init, add, remove, sync, list
│   │   └── contribute.ts     # new, validate, promote
│   ├── resources/
│   │   └── handlers.ts       # Resource URI handlers
│   ├── golden/
│   │   ├── client.ts         # GitHub API wrapper
│   │   ├── cache.ts          # Local cache management
│   │   └── registry.ts       # Registry parsing
│   └── project/
│       ├── manager.ts        # Project file operations
│       └── linker.ts         # Resource linking logic
├── package.json
└── tsconfig.json

Dependencies:
- @modelcontextprotocol/sdk
- @octokit/rest (GitHub API)
- simple-git
- semver
```

---

## Namespace Convention

All golden repo resources use `@foundry/` prefix:

```
@foundry/research           # skill
@foundry/code-review        # skill
@foundry/orchestrator       # agent
@foundry/servicenow-base    # context
@foundry/sparc-methodology  # context
```

Local project resources have no prefix (or could use `@local/`):

```
my-custom-skill             # local skill
@local/my-custom-skill      # explicit local (optional)
```

Resolution order:
1. Explicit `@foundry/` → golden repo
2. Explicit `@local/` → project local
3. No prefix → check local first, then golden

---

## Distribution Options

### Option A: npm Package (Recommended for team)
```bash
npm install -g @servicenow-aif/foundry-mcp
# or
npx @servicenow-aif/foundry-mcp
```

Publish to:
- Internal npm registry, or
- Install directly from GitHub: `npm install github:servicenow-aif/foundry-mcp`

### Option B: Docker Container
```bash
docker run -p 3000:3000 servicenow-aif/foundry-mcp
```

Good for hosted/shared MCP server.

### Option C: Binary Release
Use `pkg` or `bun build --compile` to create standalone executables.
Distribute via GitHub releases.

---

## Foundry Meta-Skill

In addition to the MCP server, include a skill in the golden repo that teaches Claude about Foundry itself:

```markdown
# @foundry/foundry-usage

## Purpose
This skill helps Claude understand and work with the Foundry ecosystem.

## When to Use
- User asks about available team resources
- User wants to start a new project
- User is looking for existing skills/agents/context
- User wants to contribute a new resource

## Key Concepts
- Golden Repo: Central repository of vetted team resources
- Resources: Skills, Agents, Context files, Prompt templates
- Namespacing: @foundry/ for shared, no prefix for local
- Versioning: Semver, with lock files for reproducibility

## Available MCP Tools
[documents all the foundry_* tools]

## Common Workflows
[documents init, add, contribute flows]
```

This way Claude always knows how to help with Foundry even without explicit instructions.

---

## Migration Path

1. **Week 1-2:** Build core MCP server (init, add, sync, list)
2. **Week 3:** Add discovery tools (search, info, catalog)
3. **Week 4:** Add contribution tools (new, validate, promote)
4. **Week 5:** Polish, documentation, team rollout
5. **Ongoing:** Build out golden repo content as team uses it

Start with the CLI equivalent functionality, MCP just makes it conversational.
