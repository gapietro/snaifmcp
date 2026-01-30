# Foundry

**Bootstrap Now Assist POC projects with pre-loaded context, skills, and templates.**

Foundry is an MCP (Model Context Protocol) server that helps the AI Foundry team rapidly spin up new POC/POV projects with consistent structure, ServiceNow context, and reusable skills.

## Quick Start

### Prerequisites

- **GitHub CLI authenticated**: The golden repo is private. Run `gh auth login` first.
- **Node.js 18+**: Required to run the MCP server.

### 1. Configure Claude Code

Add Foundry to your Claude Code MCP configuration:

**Option A: Project-level** (`.mcp.json` in your working directory)
```json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/path/to/foundry-mcp/dist/index.js"]
    }
  }
}
```

**Option B: Global** (`~/.claude/config.json`)
```json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/path/to/foundry-mcp/dist/index.js"]
    }
  }
}
```

### 2. Bootstrap a New Project

In Claude Code, use the `foundry_init` tool:

```
Create a new Now Assist POC called "customer-demo"
```

Claude will use `foundry_init` to create:
```
customer-demo/
├── CLAUDE.md                    # SPARC methodology template
├── .gitignore
└── .claude/
    ├── context/                 # 6 context files
    │   ├── now-assist-platform.md
    │   ├── genai-framework.md
    │   ├── agentic-patterns.md
    │   ├── troubleshooting-guide.md
    │   ├── security-patterns.md
    │   └── performance-tuning.md
    └── skills/                  # 6 skills with examples
        ├── now-assist-skill-builder/
        ├── api-integration/
        ├── servicenow-troubleshooting/
        ├── agent-builder/
        ├── testing-patterns/
        └── deployment-automation/
```

### 3. Start Building

```bash
cd customer-demo
claude   # Opens Claude Code with pre-loaded context
```

---

## Available Tools

### Foundry Tools (12)

| Tool | Description |
|------|-------------|
| `foundry_init` | Bootstrap a new Now Assist POC project |
| `foundry_list` | List available resources (context, skills, templates) |
| `foundry_add` | Add resources to an existing project |
| `foundry_sync` | Update project resources to latest versions |
| `foundry_info` | Get detailed information about a resource |
| `foundry_search` | Search across all resources |
| `foundry_new` | Create a new resource (context file or skill) |
| `foundry_validate` | Validate resources before promotion |
| `foundry_promote` | Submit resources to the golden repo |
| `foundry_external` | Manage external plugins (@approved/*, @github/*) |
| `foundry_version` | Manage resource versions and check for updates |
| `foundry_templates` | List and preview available templates |

### ServiceNow Tools (8)

| Tool | Description |
|------|-------------|
| `servicenow_connect` | Connect to a ServiceNow instance |
| `servicenow_disconnect` | Disconnect from current instance |
| `servicenow_status` | Check connection status |
| `servicenow_syslogs` | Query system logs with filters |
| `servicenow_aia_logs` | Get AI Agent execution traces |
| `servicenow_query` | Execute GlideRecord-style queries |
| `servicenow_script` | Execute background scripts (with safety rails) |
| `servicenow_instance` | Get instance info and health status |

---

## Golden Repository Content

### Context Files (6)

| File | Description |
|------|-------------|
| `now-assist-platform.md` | Now Assist architecture, capabilities, APIs |
| `genai-framework.md` | GenAI Controller, skill invocation patterns |
| `agentic-patterns.md` | Agentic framework, tool use, orchestration |
| `troubleshooting-guide.md` | Common issues, debug patterns, syslogs |
| `security-patterns.md` | ACLs, roles, secure coding practices |
| `performance-tuning.md` | Query optimization, caching, best practices |

### Skills (6)

| Skill | Description |
|-------|-------------|
| `now-assist-skill-builder` | Creating custom Now Assist skills |
| `api-integration` | ServiceNow REST API patterns |
| `servicenow-troubleshooting` | Debug with syslogs, AIA logs, scripts |
| `agent-builder` | Creating AI Agents |
| `testing-patterns` | Unit testing, ATF, mocking |
| `deployment-automation` | CI/CD, update sets, app publishing |

### Templates (3)

| Template | Description |
|----------|-------------|
| `sparc-starter` | Full SPARC methodology with all context and skills (default) |
| `standard` | Context files only, no pre-loaded skills |
| `minimal` | Bare-bones CLAUDE.md only |

---

## Repository Structure

```
snaifmcp/
├── README.md                 # This file
├── CLAUDE.md                 # Project guidance for Claude Code
├── DEMO_SCRIPT.md            # Demo walkthrough guide
├── .mcp.json                 # MCP server configuration
├── foundry-mcp/              # MCP server implementation
│   ├── src/
│   │   ├── index.ts          # Main server (Foundry tools)
│   │   └── servicenow/       # ServiceNow tools
│   ├── dist/                 # Built server (ready to use)
│   └── test/                 # Test suite
├── foundry-golden/           # Golden repository content
│   ├── context/              # 6 context files
│   ├── skills/               # 6 skills with examples
│   └── templates/            # 3 project templates
└── docs/
    ├── spec/                 # Specifications
    ├── plan/                 # Implementation plans & backlog
    └── archive/              # Reference documentation
```

---

## Development

### Building the MCP Server

```bash
cd foundry-mcp
npm install
npm run build
```

### Running Tests

```bash
cd foundry-mcp
npm test              # Run all tests (90 tests)
npm run test:keep     # Run tests, keep output for inspection
```

### Local Development

```bash
cd foundry-mcp
npm run dev   # Watch mode for TypeScript compilation
```

---

## Documentation

- [Demo Script](DEMO_SCRIPT.md) - Complete demo walkthrough
- [How-To Guide](docs/HOWTO.md) - Day-to-day usage and testing
- [MCP Server README](foundry-mcp/README.md) - Server development guide
- [Golden Repo README](foundry-golden/README.md) - Content contribution guide
- [Backlog](docs/plan/backlog.md) - Feature tracking and roadmap

---

## Example Workflows

### Create a New POC

```
Create a new Now Assist POC called "acme-incident-assistant"
```

### Use a Different Template

```
Create a project called "quick-test" using the minimal template
```

### Add a Skill to Existing Project

```
Add the testing-patterns skill to this project
```

### Search for Resources

```
Search Foundry for "GlideRecord" content
```

### Connect to ServiceNow and Debug

```
Connect to my-dev-instance.service-now.com
Query recent syslogs with source "AI Agent"
Get the AIA logs for the last hour
```

### Execute a Background Script

```
Run this script on ServiceNow in read-only mode:
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(5);
gr.query();
while(gr.next()) { gs.info(gr.number); }
```

---

## Roadmap

- [x] **Phase 1 (MVP)**: `foundry_init` with context, skills, and SPARC template
- [x] **Phase 2**: `foundry_list`, `foundry_add`, `foundry_sync`
- [x] **Phase 3**: `foundry_info`, `foundry_search`
- [x] **Phase 4**: `foundry_new`, `foundry_validate`, `foundry_promote`
- [x] **Phase 5**: External plugins, versioning, multiple templates
- [x] **ServiceNow Tools**: Connect, query, syslogs, AIA logs, scripts
- [ ] **Technical Debt**: TypeScript strict mode, ESLint, integration tests

---

## License

MIT

## Team

AI Foundry - ServiceNow
