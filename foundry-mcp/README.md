# Foundry MCP Server

MCP (Model Context Protocol) server that bootstraps Now Assist POC projects with pre-loaded context, skills, and templates.

## Overview

Foundry MCP provides a single tool (`foundry_init`) that creates new project directories with everything needed to start building Now Assist POCs immediately.

## Installation

### From npm (once published)
```bash
npm install -g foundry-mcp
```

### From source
```bash
git clone https://github.com/ai-foundry/foundry-mcp.git
cd foundry-mcp
npm install
npm run build
```

## Configuration for Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project `.claude/settings.json`):

### Using npm global install
```json
{
  "mcpServers": {
    "foundry": {
      "command": "foundry-mcp"
    }
  }
}
```

### Using local install
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

### Using npx
```json
{
  "mcpServers": {
    "foundry": {
      "command": "npx",
      "args": ["foundry-mcp"]
    }
  }
}
```

## Usage

Once configured, use the `foundry_init` tool in Claude Code:

```
# Basic usage - creates project in current directory
foundry_init my-poc

# Specify parent directory
foundry_init my-poc --path /path/to/projects

# Use local golden repo (for development/offline use)
foundry_init my-poc --goldenPath /path/to/foundry-golden
```

## What Gets Created

```
my-poc/
├── CLAUDE.md                    # SPARC methodology template
├── .gitignore                   # Standard gitignore
└── .claude/
    ├── context/
    │   ├── now-assist-platform.md
    │   ├── genai-framework.md
    │   └── agentic-patterns.md
    └── skills/
        ├── now-assist-skill-builder/
        │   ├── SKILL.md
        │   └── examples/
        └── api-integration/
            ├── SKILL.md
            └── examples/
```

## Tool Reference

### foundry_init

Bootstrap a new Now Assist POC project.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectName` | string | Yes | Name of the project directory to create |
| `path` | string | No | Parent directory (defaults to cwd) |
| `goldenPath` | string | No | Local path to foundry-golden repo |

**Returns:**
- Success message with project path and next steps
- Error message if project creation fails

## Golden Repository

The server fetches resources from the [foundry-golden](https://github.com/ai-foundry/foundry-golden) repository. By default, it:

1. Clones the repo to `~/.foundry/golden` on first use
2. Caches for 24 hours before checking for updates
3. Falls back to cached version if network unavailable

For offline or development use, specify `goldenPath` to use a local copy.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run locally
node dist/index.js
```

### Testing with Claude Code

1. Build the project: `npm run build`
2. Add to Claude Code settings with local path
3. Restart Claude Code
4. Test: "Use foundry_init to create a test project"

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│   foundry-mcp    │────▶│ foundry-golden  │
│                 │◀────│   (MCP Server)   │◀────│   (GitHub)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  New Project     │
                        │  my-poc/         │
                        │  ├── CLAUDE.md   │
                        │  └── .claude/    │
                        └──────────────────┘
```

## License

MIT
