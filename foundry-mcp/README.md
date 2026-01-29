# Foundry MCP Server

MCP (Model Context Protocol) server that bootstraps Now Assist POC projects with pre-loaded context, skills, and templates.

## Overview

Foundry MCP provides tools that help the AI Foundry team rapidly create and manage Now Assist POC projects. The server interfaces with Claude Code to provide project bootstrapping capabilities.

**Current Status:** MVP Complete - `foundry_init` tool operational

## Quick Start

### 1. Install Dependencies

```bash
cd foundry-mcp
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure Claude Code

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

### 4. Use in Claude Code

```
Create a new Now Assist POC called "my-project"
```

## Tools

### `foundry_init` (MVP)

Bootstrap a new Now Assist POC project with pre-loaded resources.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectName` | Yes | Project directory name (alphanumeric, hyphens, underscores) |
| `path` | No | Parent directory (defaults to current working directory) |
| `goldenPath` | No | Local path to foundry-golden repo (for development/offline) |

**Creates:**
```
project-name/
├── CLAUDE.md           # SPARC methodology template
├── .gitignore          # Standard ignores
└── .claude/
    ├── context/        # Now Assist, GenAI, Agentic patterns
    └── skills/         # Skill builder, API integration
```

### Planned Tools

| Tool | Phase | Description |
|------|-------|-------------|
| `foundry_list` | 2 | List available resources in golden repo |
| `foundry_add` | 2 | Add resource to existing project |
| `foundry_sync` | 2 | Update project resources to latest |
| `foundry_info` | 3 | Get detailed resource information |
| `foundry_search` | 3 | Search across all resources |

## Project Structure

```
foundry-mcp/
├── src/
│   └── index.ts        # MCP server implementation
├── dist/               # Built JavaScript (ready to use)
│   └── index.js
├── test/
│   └── validate-init.ts  # Acceptance test suite
├── package.json
├── tsconfig.json
├── README.md           # This file
├── HOWTO.md            # Development guide
└── DEVELOPMENT.md      # Architecture & contribution guide
```

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Watch mode for development |
| `npm test` | Run acceptance tests |
| `npm run test:keep` | Run tests, keep output for inspection |

### Testing

Run the acceptance test suite:

```bash
npm test
```

Tests validate all MVP acceptance criteria:
- Project directory creation
- Context files present (3 files)
- Skills present (2 directories)
- CLAUDE.md with SPARC structure
- MCP server built
- No additional setup required

### Local Development Workflow

1. Make changes to `src/index.ts`
2. Build: `npm run build`
3. Test manually in Claude Code
4. Run acceptance tests: `npm test`
5. Commit changes

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│   foundry-mcp    │────▶│ foundry-golden  │
│                 │◀────│   (MCP Server)   │◀────│   (Content)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
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
└──────────────────┘
```

### Golden Repo Caching

The server manages a local cache of the golden repository:

1. **First use**: Clones from GitHub to `~/.foundry/golden/`
2. **Subsequent use**: Uses cached copy
3. **Cache refresh**: Pulls updates if cache > 24 hours old
4. **Offline fallback**: Uses stale cache if network unavailable
5. **Development**: Use `goldenPath` parameter to bypass cache

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HOME` / `USERPROFILE` | User home directory | System default |

### Cache Location

- macOS/Linux: `~/.foundry/golden/`
- Windows: `%USERPROFILE%\.foundry\golden\`

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid project name" | Special characters in name | Use only letters, numbers, hyphens, underscores |
| "Project directory already exists" | Name collision | Choose different name or delete existing |
| "Failed to clone golden repository" | Network/GitHub issue | Use `goldenPath` for local golden repo |
| "Golden repo missing context directory" | Corrupted cache | Delete `~/.foundry/golden/` and retry |

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.0.0 | MCP server framework |
| `typescript` | ^5.3.0 | Development |
| `tsx` | ^4.7.0 | Test runner |

## License

MIT

## See Also

- [HOWTO.md](HOWTO.md) - Detailed development guide
- [DEVELOPMENT.md](DEVELOPMENT.md) - Architecture and contribution guidelines
- [Parent README](../README.md) - Overall project documentation
- [foundry-golden](../foundry-golden/) - Golden repository content
