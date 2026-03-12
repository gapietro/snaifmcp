# tool-foundry-mcp

## Repository Rename (2026-02-25)

This repo was renamed from `foundry-mcp` to `tool-foundry-mcp`.
If your local remote still points to the old name, update it:

    git remote set-url origin https://github.com/Now-AI-Foundry/tool-foundry-mcp.git

## Companion Repo

`lib-foundry-golden` is cloned at `~/Projects/lib-foundry-golden`.
It is the single source for all skills, context, and templates consumed by this MCP server.
Skills use YAML frontmatter (`scope`, `recommended`, `triggers`, `tags`, `version`) parsed by `parseSkillFrontmatter()` in `src/foundry/golden-repo.ts`.
