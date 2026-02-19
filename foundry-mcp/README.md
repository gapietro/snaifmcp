# Foundry MCP Server

MCP (Model Context Protocol) server providing 30 tools for Now Assist POC development and ServiceNow integration.

## Overview

The Foundry MCP server provides three sets of tools:
- **Foundry Tools (12)**: Project bootstrapping, resource management, and contribution workflow
- **ServiceNow Tools (8)**: Instance connectivity, querying, and script execution
- **ServiceNow AI Tools (10)**: AI Agent management (6) and Now Assist Skill management (4)

**Current Status:** All phases complete - 30 tools operational

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

**Recommended: Use the official CLI command**

```bash
# Add foundry MCP server (user scope - available in all projects)
claude mcp add --scope user --transport stdio foundry -- \
  node /absolute/path/to/foundry-mcp/dist/index.js

# Or add to current project only (local scope)
claude mcp add --transport stdio foundry -- \
  node /absolute/path/to/foundry-mcp/dist/index.js
```

**Alternative: Manual configuration**

Add to `~/.claude.json` (note: `.json` not `.claude/config.json`):

```json
{
  "mcpServers": {
    "foundry": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/foundry-mcp/dist/index.js"]
    }
  }
}
```

**Or** create `.mcp.json` in your project root (for team sharing):

```json
{
  "mcpServers": {
    "foundry": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/foundry-mcp/dist/index.js"]
    }
  }
}
```

**Important:** After configuration, **restart Claude Code completely** (exit and relaunch) for changes to take effect.

**Verify installation:**

```bash
# Check if foundry is listed and connected
claude mcp list

# In Claude Code, check available MCP servers
/mcp
```

### 3. Run Tests

```bash
npm run test:all
# Expected: 152 total tests (55 + 65 + 22 + 10)
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

### AI Agent Tools (6)

| Tool | Description | Example |
|------|-------------|---------|
| `servicenow_aia_list` | List AI Agents | "List all active agents" |
| `servicenow_aia_get` | Get agent details | "Show config for Incident Triage agent" |
| `servicenow_aia_trace` | Execution trace | "Trace execution abc123" |
| `servicenow_aia_errors` | Error patterns | "Show agent errors from last 24h" |
| `servicenow_aia_execute` | Run agent | "Test the triage agent with this input" |
| `servicenow_aia_create` | Create agent | "Create an agent with these tools" |

### Now Assist Skill Tools (4)

| Tool | Description | Example |
|------|-------------|---------|
| `servicenow_skill_list` | List skills | "List all active Now Assist skills" |
| `servicenow_skill_get` | Get skill details | "Show the summarizer skill config" |
| `servicenow_skill_execute` | Invoke skill | "Test the skill with this input" |
| `servicenow_skill_create` | Create skill | "Create a skill with this prompt" |

---

## Configuration

All settings can be overridden via environment variables:

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `FOUNDRY_GOLDEN_REPO` | `Now-AI-Foundry/foundry-golden` | GitHub repo for golden content |
| `FOUNDRY_CACHE_DIR` | `~/.foundry/golden` | Local cache directory |
| `FOUNDRY_CACHE_TTL` | `24` | Cache max age in hours |
| `FOUNDRY_BRANCH` | `main` | Golden repo branch to track |
| `FOUNDRY_DEFAULT_TEMPLATE` | `sparc-starter` | Default project template |
| `FOUNDRY_REQUEST_TIMEOUT` | `30000` | Request timeout in ms |
| `SERVICENOW_CREDENTIALS_PATH` | `~/.servicenow/credentials.json` | ServiceNow credentials file |

---

## Project Structure

```
foundry-mcp/
├── src/
│   ├── index.ts              # Server setup + routing (~100 lines)
│   ├── foundry/
│   │   ├── tools.ts          # 12 tool definitions + handler dispatcher
│   │   ├── golden-repo.ts    # Golden repo cache, listing functions
│   │   ├── project.ts        # Project init, add, sync
│   │   ├── resources.ts      # List, info, search
│   │   ├── contribute.ts     # New, validate, promote
│   │   ├── external.ts       # External registry support
│   │   ├── version.ts        # Version management
│   │   ├── templates.ts      # Template loading (data-driven)
│   │   └── types.ts          # Foundry type definitions
│   ├── servicenow/
│   │   ├── index.ts          # ServiceNow exports
│   │   ├── tools.ts          # 8 core tool definitions + handlers
│   │   ├── tools-aia.ts      # 6 AI Agent tools (list, get, trace, errors, execute, create)
│   │   ├── tools-skills.ts   # 4 Now Assist Skill tools (list, get, execute, create)
│   │   ├── guards.ts         # Connection guard helpers
│   │   ├── table-discovery.ts # Version-aware table probing + cache
│   │   ├── client.ts         # HTTP client (query, create, update, delete)
│   │   ├── connection-manager.ts  # Session management
│   │   └── types.ts          # ServiceNow type definitions
│   └── shared/
│       ├── config.ts         # Centralized config with env var support
│       ├── errors.ts         # FoundryError class + error helpers
│       ├── fs-utils.ts       # File system utilities
│       └── exec-utils.ts     # Safe exec (spawn, no shell)
├── dist/                     # Built JavaScript
├── test/
│   ├── validate-init.ts      # Foundry tool tests (55 tests)
│   ├── validate-servicenow.ts # ServiceNow tool tests (65 tests)
│   ├── test-exec-utils.ts    # Exec utility tests (22 tests)
│   ├── mcp-integration.ts    # MCP protocol tests (10 tests)
│   └── utils/
│       └── test-runner.ts    # Shared test framework
├── package.json
├── tsconfig.json
├── README.md                 # This file
└── HOWTO.md                  # Development guide
```

---

## Development

### Development Setup

**Option 1: Clone both repos manually (as siblings)**

```bash
# Clone both repos as siblings in any parent directory
git clone https://github.com/Now-AI-Foundry/foundry-mcp.git
git clone https://github.com/Now-AI-Foundry/foundry-golden.git

# Install and build
cd foundry-mcp
npm install
npm run build
```

**Option 2: Use the bootstrap script**

```bash
git clone https://github.com/Now-AI-Foundry/foundry-mcp.git
cd foundry-mcp
npm run dev:setup
```

The bootstrap script:
1. Clones `foundry-golden` as a sibling (if not present)
2. Pulls latest changes (if already cloned)
3. Installs dependencies
4. Builds the MCP server

**Custom golden repo location**

If your golden repo is elsewhere, use the environment variable:

```bash
FOUNDRY_GOLDEN_PATH=/path/to/foundry-golden npm test
```

### Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Build TypeScript |
| `npm run dev` | Watch mode |
| `npm test` | Run Foundry tool tests (55 tests) |
| `npm run test:keep` | Tests with output preserved |
| `npm run test:servicenow` | ServiceNow tool tests (65 tests) |
| `npm run test:exec` | Exec utility tests (22 tests) |
| `npm run test:mcp` | MCP protocol integration tests (10 tests) |
| `npm run test:all` | Run all 152 tests |

### Testing

```bash
# Run all 152 tests
npm run test:all

# Run individual test suites
npm test                    # Foundry tools (55 tests)
npm run test:servicenow     # ServiceNow tools (65 tests)
npm run test:exec           # Exec utilities (22 tests)
npm run test:mcp            # MCP protocol integration (10 tests)

# Run with output preserved for inspection
npm run test:keep
ls .test-output/
```

### Test Suites

| Suite | Tests | What's Tested |
|-------|-------|---------------|
| **validate-init** | 55 | Foundry tool definitions, project init, list, add, sync, info, search, new, validate, promote, external, version, templates |
| **validate-servicenow** | 65 | ServiceNow tool definitions (core + AIA + skill), schemas, handler logic, connection guards, URL normalization, error types, table discovery |
| **test-exec-utils** | 22 | Safe exec (spawn), shell metacharacter rejection, resource name validation, timeout handling |
| **mcp-integration** | 10 | MCP protocol handshake (NDJSON), tool listing, servicenow_status, foundry_init end-to-end |

### Contributing & Branch Protection

This repository enforces branch protection via GitHub Actions workflows:

**Rules:**
- All changes must go through Pull Requests
- PRs require approval from org owners (@dalestubblefield, @gapietro, @michaelbuckner)
- Org owners can approve and merge their own PRs
- Other contributors cannot self-approve
- No direct pushes to main
- No force pushes to main
- Linear history required (use squash or rebase merge)

**Workflows:**
- `.github/workflows/branch-protection.yml` - PR approval and linear history enforcement
- `.github/workflows/block-direct-push.yml` - Prevents direct commits to main
- `.github/workflows/prevent-force-push.yml` - Blocks force pushes

**Note:** As a private repo on GitHub Free, these workflows provide visibility (red ❌ / green ✅) but cannot technically block merges. Please respect the workflow checks.

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

## Troubleshooting

### MCP server not showing in Claude Code

**Symptom:** `claude mcp list` shows foundry as connected, but `/mcp` in Claude Code doesn't list it.

**Solution:**
1. **Exit Claude Code completely** (not just close conversation)
2. Restart Claude Code from terminal: `claude`
3. Type `/mcp` to verify foundry appears

MCP servers are loaded at startup, not per conversation. Changes to MCP configuration require a full restart.

### "Cannot find module" or dependency errors

**Solution:**
```bash
cd /path/to/foundry-mcp
rm -rf node_modules package-lock.json
npm install
npm run build
```

### MCP server not starting

**Check the basics:**
```bash
# Verify file exists
ls -la /path/to/foundry-mcp/dist/index.js

# Test server directly
node /path/to/foundry-mcp/dist/index.js
# Should output: "Foundry MCP server started"

# Check GitHub authentication (required for golden repo)
gh auth status
# If not logged in: gh auth login
```

### Config file confusion

**Claude Code reads MCP config from:**
- `~/.claude.json` - User and local scope settings (correct)
- `.mcp.json` - Project scope (team sharing)

**NOT from:**
- `~/.claude/config.json` - This file doesn't exist in Claude Code
- `~/claude-code/.mcp.json` - This is project-specific, not global

**Verify which config is being used:**
```bash
# Show all configured servers
claude mcp list

# Show specific server details
claude mcp get foundry
```

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
- [Test Suite](test/) - 152 test cases across 4 suites
