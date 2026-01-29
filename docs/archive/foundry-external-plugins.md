# Foundry External Plugins Specification

## Overview

Foundry supports three resource origins:

| Origin | Namespace | Example | Control Level |
|--------|-----------|---------|---------------|
| **Internal** | `@foundry/*` | `@foundry/research` | Full (you own it) |
| **External Approved** | `@approved/*` | `@approved/superpowers` | Pinned (vetted, version-locked) |
| **External Direct** | `@github/*`, `@npm/*` | `@github/anthropics/courses` | Reference (use at your own risk) |

---

## External Approved Plugins

These are community plugins the team has vetted and approved for use. They're registered in the golden repo but hosted externally.

### Registry Entry

In `foundry-golden/.foundry/external-registry.json`:

```json
{
  "approved": [
    {
      "name": "superpowers",
      "description": "Collection of powerful Claude Code skills from the community",
      "source": {
        "type": "github",
        "repo": "NickBelev/superpowers",
        "ref": "v2.1.0"
      },
      "resourceType": "skill-collection",
      "approved": {
        "by": "gfernandez",
        "date": "2025-01-28",
        "notes": "Vetted core skills, excluded experimental/"
      },
      "include": [
        "skills/code-maestro/",
        "skills/web-researcher/",
        "skills/file-organizer/"
      ],
      "exclude": [
        "skills/experimental/",
        "skills/deprecated/"
      ],
      "installHook": null
    },
    {
      "name": "claude-courses",
      "description": "Anthropic's official prompt engineering courses as context",
      "source": {
        "type": "github",
        "repo": "anthropics/courses", 
        "ref": "main"
      },
      "resourceType": "context-collection",
      "approved": {
        "by": "jsmith",
        "date": "2025-01-20",
        "notes": "Official Anthropic content, always approved"
      },
      "include": ["*"],
      "exclude": []
    },
    {
      "name": "mcp-filesystem",
      "description": "Official MCP filesystem server",
      "source": {
        "type": "npm",
        "package": "@anthropic/mcp-filesystem",
        "version": "^1.2.0"
      },
      "resourceType": "mcp",
      "approved": {
        "by": "gfernandez",
        "date": "2025-01-25",
        "notes": "Official Anthropic MCP server"
      },
      "configTemplate": {
        "command": "npx",
        "args": ["@anthropic/mcp-filesystem", "${PROJECT_ROOT}"]
      }
    }
  ]
}
```

---

## Resource Types from External Sources

### Skill Collections
Some external repos (like superpowers) contain multiple skills. Foundry can:

1. **Import entire collection:**
   ```bash
   foundry add @approved/superpowers
   # Adds all included skills
   ```

2. **Import specific skills:**
   ```bash
   foundry add @approved/superpowers/code-maestro
   foundry add @approved/superpowers/web-researcher
   ```

### Context Collections
Educational content, documentation, reference material:
```bash
foundry add @approved/claude-courses
foundry add @approved/claude-courses/prompt-engineering
```

### MCP Servers
Pre-approved community or official MCP servers:
```bash
foundry add @approved/mcp-filesystem
foundry add @approved/mcp-github
foundry add @approved/mcp-postgres
```

---

## Bootstrap with External Plugins

### In project templates:

```json
// foundry-golden/bootstrap/templates/standard/template.json
{
  "name": "standard",
  "description": "Standard Foundry project with common tools",
  "resources": {
    "internal": [
      { "type": "context", "name": "@foundry/team-conventions" },
      { "type": "context", "name": "@foundry/servicenow-base" },
      { "type": "skill", "name": "@foundry/research" }
    ],
    "external": [
      { "type": "skill-collection", "name": "@approved/superpowers" },
      { "type": "mcp", "name": "@approved/mcp-filesystem" }
    ]
  }
}
```

### CLI usage:

```bash
# Bootstrap with approved externals
foundry init my-project --template standard
# Automatically includes @approved/superpowers, @approved/mcp-filesystem

# Or explicitly add
foundry init my-project \
  --with @foundry/research \
  --with @approved/superpowers \
  --with @approved/mcp-github
```

---

## MCP Server Tools for External

```typescript
// Search includes external approved
@tool foundry_search(
  query: string,
  type?: ResourceType,
  origin?: "internal" | "approved" | "all"  // NEW
): SearchResult[]

// Catalog shows origin
@tool foundry_catalog(
  type?: ResourceType,
  origin?: "internal" | "approved" | "all"  // NEW
): CatalogEntry[]
// Returns: [
//   { name: "research", origin: "internal", namespace: "@foundry" },
//   { name: "superpowers", origin: "approved", namespace: "@approved" },
// ]

// Add works with any approved resource
@tool foundry_add(
  type: ResourceType,
  name: string,  // "@foundry/research" or "@approved/superpowers"
  version?: string
): AddResult

// Info shows external source details
@tool foundry_info(
  name: string  // "@approved/superpowers"
): ResourceInfo
// Returns: {
//   name: "superpowers",
//   origin: "approved",
//   source: { type: "github", repo: "NickBelev/superpowers", ref: "v2.1.0" },
//   approvedBy: "gfernandez",
//   skills: ["code-maestro", "web-researcher", "file-organizer"]
// }
```

---

## Adding New External Approvals

Team members can propose new external plugins:

```bash
# Propose a new external plugin for approval
foundry propose-external \
  --name "awesome-skills" \
  --source github:someuser/awesome-claude-skills \
  --ref v1.0.0 \
  --type skill-collection \
  --message "Great collection for X use cases"
```

This creates a PR to add to `external-registry.json`, requiring review from designated approver.

### Approval Checklist (for reviewer)
- [ ] Source repo is actively maintained
- [ ] License is compatible (MIT, Apache, etc.)
- [ ] No malicious or unsafe code
- [ ] Skills/resources actually work as advertised
- [ ] Pinned to specific version/tag (not `main`)
- [ ] Include/exclude patterns are appropriate

---

## Version Pinning Strategy

| Origin | Pinning | Rationale |
|--------|---------|-----------|
| `@foundry/*` | Semver ranges OK | You control releases |
| `@approved/*` | **Exact version required** | External changes could break things |
| `@github/*` direct | Commit SHA required | Maximum reproducibility |

Example in `external-registry.json`:
```json
{
  "name": "superpowers",
  "source": {
    "type": "github",
    "repo": "NickBelev/superpowers",
    "ref": "v2.1.0"  // Tag, not "main"
  }
}
```

When external releases new version:
1. Team member tests new version locally
2. Proposes update to `external-registry.json` via PR
3. Reviewer approves
4. `foundry sync` picks up new version

---

## Direct External References (Advanced)

For one-off usage without team approval (use at own risk):

```bash
# Direct GitHub reference
foundry add @github/someuser/some-skills --ref abc123

# Direct npm package  
foundry add @npm/some-mcp-server --version 1.2.3
```

These are **not** added to project.json by default (ephemeral), unless:
```bash
foundry add @github/someuser/some-skills --ref abc123 --save
# Warns: "This external resource is not team-approved. Save anyway? (y/n)"
```

---

## Project Manifest with Externals

```json
// my-project/.foundry/project.json
{
  "name": "my-project",
  "resources": {
    "skills": [
      { "name": "@foundry/research", "version": "1.2.0" },
      { "name": "@approved/superpowers/code-maestro", "version": "v2.1.0" },
      { "name": "@approved/superpowers/web-researcher", "version": "v2.1.0" }
    ],
    "context": [
      { "name": "@foundry/servicenow-base", "version": "latest" },
      { "name": "@approved/claude-courses/prompt-engineering", "version": "main" }
    ],
    "mcp": [
      { "name": "@approved/mcp-filesystem", "version": "^1.2.0" },
      { "name": "@approved/mcp-github", "version": "1.0.0" }
    ]
  }
}
```

---

## Lock File with Externals

```json
// my-project/.foundry/lock.json
{
  "resources": {
    "@foundry/research": {
      "version": "1.2.0",
      "resolved": "foundry-golden/skills/research@1.2.0",
      "integrity": "sha256-abc123..."
    },
    "@approved/superpowers/code-maestro": {
      "version": "v2.1.0",
      "resolved": "github:NickBelev/superpowers/skills/code-maestro@v2.1.0",
      "integrity": "sha256-def456..."
    },
    "@approved/mcp-filesystem": {
      "version": "1.2.3",
      "resolved": "npm:@anthropic/mcp-filesystem@1.2.3",
      "integrity": "sha256-ghi789..."
    }
  }
}
```

---

## Sync Behavior for Externals

```bash
foundry sync
```

1. **Internal resources**: Pull from golden repo
2. **Approved externals**: 
   - Check if approved version changed in `external-registry.json`
   - If yes, fetch new version from source
   - If no, use cached version
3. **Direct externals**: Warn if ref no longer exists

---

## Summary: Three-Tier Resource System

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FOUNDRY RESOURCE ORIGINS                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   @foundry/*    │  │  @approved/*    │  │ @github/@npm/*  │
│   (Internal)    │  │  (Vetted Ext.)  │  │ (Direct Ref)    │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│                 │  │                 │  │                 │
│ Your team's     │  │ Community       │  │ Anything on     │
│ custom skills,  │  │ plugins your    │  │ GitHub/npm      │
│ agents, context │  │ team approved   │  │ (at your risk)  │
│                 │  │                 │  │                 │
│ Examples:       │  │ Examples:       │  │ Examples:       │
│ - research      │  │ - superpowers   │  │ - experimental  │
│ - servicenow-   │  │ - claude-       │  │   repos         │
│   base          │  │   courses       │  │ - testing new   │
│ - sparc-planner │  │ - mcp-          │  │   plugins       │
│                 │  │   filesystem    │  │                 │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ Versioning:     │  │ Versioning:     │  │ Versioning:     │
│ Semver ranges   │  │ Pinned exact    │  │ Commit SHA      │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ Bootstrap: ✅   │  │ Bootstrap: ✅   │  │ Bootstrap: ❌   │
│ Default         │  │ Opt-in          │  │ Manual only     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

All managed through the same Foundry MCP server—unified discovery, installation, and sync.
