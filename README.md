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
    ├── context/
    │   ├── now-assist-platform.md
    │   ├── genai-framework.md
    │   └── agentic-patterns.md
    └── skills/
        ├── now-assist-skill-builder/
        └── api-integration/
```

### 3. Start Building

```bash
cd customer-demo
claude   # Opens Claude Code with pre-loaded context
```

## What's Included

### Context Files
| File | Description |
|------|-------------|
| `now-assist-platform.md` | Now Assist architecture, capabilities, APIs |
| `genai-framework.md` | GenAI Controller, skill invocation patterns |
| `agentic-patterns.md` | Agentic framework, tool use, orchestration |

### Skills
| Skill | Description |
|-------|-------------|
| `now-assist-skill-builder` | Instructions for creating Now Assist skills |
| `api-integration` | ServiceNow REST API patterns and examples |

### Template
- **SPARC Starter**: Pre-configured CLAUDE.md with Specification → Pseudocode → Architecture → Refinement → Completion methodology

## Repository Structure

```
snaifmcp/
├── README.md                 # This file
├── CLAUDE.md                 # Project guidance for Claude Code
├── .mcp.json                 # MCP server configuration
├── foundry-mcp/              # MCP server implementation
│   ├── src/index.ts          # Server source code
│   ├── dist/                 # Built server (ready to use)
│   └── test/                 # Validation tests
├── foundry-golden/           # Golden repository content
│   ├── context/              # Pre-loaded context files
│   ├── skills/               # Reusable skills
│   └── templates/            # Project templates
└── docs/
    ├── spec/                 # Specifications
    ├── plan/                 # Implementation plans
    └── archive/              # Reference documentation
```

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
npm test
```

### Local Development

```bash
cd foundry-mcp
npm run dev   # Watch mode for TypeScript compilation
```

## Tool Reference

### `foundry_init`

Bootstrap a new Now Assist POC project.

**Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectName` | Yes | Name of the project directory (alphanumeric, hyphens, underscores) |
| `path` | No | Parent directory for the project (defaults to current directory) |
| `goldenPath` | No | Local path to foundry-golden repo (for development/testing) |

**Example:**
```
Use foundry_init to create a project called "acme-poc" in /Users/me/projects
```

## Roadmap

- [x] **MVP**: `foundry_init` with context, skills, and SPARC template
- [ ] **Phase 2**: `foundry_add` for incremental resource addition
- [ ] **Phase 3**: Search, catalog, and discovery tools
- [ ] **Phase 4**: Contribution workflow (`foundry_new`, `foundry_promote`)

## Documentation

- [How-To Guide](docs/HOWTO.md) - Day-to-day usage and testing
- [MVP Specification](docs/spec/foundry-mvp-spec.md) - Requirements and acceptance criteria
- [Implementation Plan](docs/plan/foundry-implementation-plan.md) - Technical roadmap
- [Next Steps](docs/plan/next-steps.md) - Post-MVP implementation plan

## License

MIT

## Team

AI Foundry - ServiceNow
