# Foundry MCP Server

MCP (Model Context Protocol) server providing 20 tools for Now Assist POC development and ServiceNow integration.

## Overview

The Foundry MCP server provides two sets of tools:
- **Foundry Tools (12)**: Project bootstrapping, resource management, and contribution workflow
- **ServiceNow Tools (8)**: Instance connectivity, querying, and script execution

**Current Status:** All phases complete - 20 tools operational

## Quick Start

### Prerequisites

- Node.js 18+
- **GitHub CLI authenticated** (`gh auth login`) - required for private golden repo access

### 1. Install and Build

```bash
cd foundry-mcp
npm install
npm run build
```

### 2. Configure Claude Code

Add to your MCP configuration (`.mcp.json` or `~/.claude/config.json`):

```json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/absolute/path/to/foundry-mcp/dist/index.js"]
    }
  }
}
```

### 3. Run Tests

```bash
npm test
# Expected: Passed: 90/90
```

---

## Tools Reference

### Foundry Tools (12)

| Tool | Description | Example |
|------|-------------|---------|
| `foundry_init` | Bootstrap new project | "Create a POC called my-project" |
| `foundry_list` | List available resources | "List all Foundry resources" |
| `foundry_add` | Add resource to project | "Add the testing-patterns skill" |
| `foundry_sync` | Update project resources | "Sync resources with golden repo" |
| `foundry_info` | Get resource details | "Info about agent-builder skill" |
| `foundry_search` | Search all resources | "Search for GlideRecord" |
| `foundry_new` | Create new resource | "Create a new context file" |
| `foundry_validate` | Validate resource | "Validate the new context" |
| `foundry_promote` | Submit to golden repo | "Promote to golden repo" |
| `foundry_external` | Manage external plugins | "Add @approved/utils" |
| `foundry_version` | Version management | "Check version status" |
| `foundry_templates` | List templates | "Show available templates" |

### ServiceNow Tools (8)

| Tool | Description | Example |
|------|-------------|---------|
| `servicenow_connect` | Connect to instance | "Connect to dev.service-now.com" |
| `servicenow_disconnect` | Disconnect | "Disconnect from ServiceNow" |
| `servicenow_status` | Check connection | "Check ServiceNow status" |
| `servicenow_syslogs` | Query system logs | "Get syslogs from last hour" |
| `servicenow_aia_logs` | AI Agent logs | "Get AIA logs from today" |
| `servicenow_query` | Query tables | "Query incidents where active=true" |
| `servicenow_script` | Execute scripts | "Run this script in read-only mode" |
| `servicenow_instance` | Instance info | "Get instance health info" |

---

## Project Structure

```
foundry-mcp/
├── src/
│   ├── index.ts              # Main server (Foundry tools)
│   └── servicenow/
│       ├── index.ts          # ServiceNow exports
│       ├── tools.ts          # ServiceNow tool definitions
│       ├── client.ts         # HTTP client
│       ├── connection-manager.ts  # Session management
│       └── types.ts          # Type definitions
├── dist/                     # Built JavaScript
├── test/
│   └── validate-init.ts      # Test suite (90 tests)
├── package.json
├── tsconfig.json
├── README.md                 # This file
└── HOWTO.md                  # Development guide
```

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Build TypeScript |
| `npm run dev` | Watch mode |
| `npm test` | Run all tests |
| `npm run test:keep` | Tests with output preserved |

### Testing

```bash
# Run all 90 tests
npm test

# Run with output preserved for inspection
npm run test:keep
ls .test-output/
```

### Test Categories

| Category | Tests | What's Tested |
|----------|-------|---------------|
| Pre-flight | 2 | Golden repo, MCP build |
| Init (AC) | 5 | Project creation, structure |
| Bonus | 2 | Examples, gitignore |
| List | 3 | Context, skills, templates |
| Add | 3 | Context, skill, duplicate detection |
| Sync | 3 | Unchanged, modified, new detection |
| Info | 3 | Context, skill, template readability |
| Search | 4 | Name, content, skills, scoring |
| New | 3 | Context, skill creation, validation |
| Validate | 4 | Valid/invalid content, placeholders |
| Promote | 4 | Validation, branch, PR, gh CLI |
| External | 4 | @approved, @github, validation, config |
| Version | 3 | Lock file, hash, semver |
| Templates | 5 | Definitions, settings, validation |

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│   foundry-mcp    │────▶│ foundry-golden  │
│                 │◀────│   (MCP Server)   │◀────│   (Content)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       ├────▶ ServiceNow Instance
        │                       │
        │               ┌──────────────────┐
        │               │  ~/.foundry/     │
        │               │  golden/         │
        │               │  (cached repo)   │
        │               └──────────────────┘
        │
        ▼
┌──────────────────┐
│  New Project     │
│  my-poc/         │
│  ├── CLAUDE.md   │
│  └── .claude/    │
│      ├── context/│
│      └── skills/ │
└──────────────────┘
```

### Golden Repo Caching

1. **First use**: Clones from GitHub to `~/.foundry/golden/`
2. **Subsequent use**: Uses cached copy
3. **Cache refresh**: Pulls updates if cache > 24 hours old
4. **Offline fallback**: Uses stale cache if network unavailable
5. **Development**: Use `goldenPath` parameter to bypass cache

### ServiceNow Connection

1. **Connect**: Authenticates with Basic Auth or OAuth
2. **Session cache**: Maintains active session
3. **Credentials file**: Optional `~/.servicenow/credentials.json`
4. **Audit logging**: Script executions are logged

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid project name" | Special characters | Use letters, numbers, hyphens, underscores |
| "Project exists" | Name collision | Choose different name |
| "GitHub auth required" | Not logged in | Run `gh auth login` |
| "Clone failed" | Network/auth issue | Check `gh auth status` |
| "ServiceNow auth failed" | Invalid credentials | Check username/password |
| "Script blocked" | Safety violation | Remove dangerous operations |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `typescript` | Development |
| `tsx` | Test runner |

---

## See Also

- [HOWTO.md](HOWTO.md) - Development guide
- [Parent README](../README.md) - Project overview
- [Golden Repo](../foundry-golden/) - Content repository
- [Test Suite](test/validate-init.ts) - 90 test cases
