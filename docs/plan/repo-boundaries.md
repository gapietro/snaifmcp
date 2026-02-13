# Repository Boundaries

Decision tree for which repository to target when making changes.

## Repositories

| Repo | GitHub | Purpose |
|------|--------|---------|
| **foundry-mcp** | `Now-AI-Foundry/foundry-mcp` | MCP server code, tool implementations, tests |
| **foundry-golden** | `Now-AI-Foundry/foundry-golden` | Reusable content: context files, skills, templates, agent examples |
| **snaifmcp** | `gapietro/snaifmcp` | Planning docs, specs, coordination |

## Decision Tree

### "I'm changing..."

**Tool behavior or MCP server code** → `foundry-mcp`
- Adding/modifying/removing a tool definition
- Changing how a tool handler processes arguments
- Updating server setup, routing, or protocol handling
- Modifying shared utilities (exec-utils, fs-utils, config, errors)
- Updating ServiceNow client, connection manager, or tools

**Content that gets copied into projects** → `foundry-golden`
- Context files (e.g., `now-assist-overview.md`)
- Skills (e.g., `SKILL.md` files)
- Agent examples
- Template scaffolding (files inside `templates/*/`)
- Template metadata (`template.json`)

**Project templates (structure/config)** → `foundry-golden`
- Adding a new template directory under `templates/`
- Modifying `CLAUDE.md` template content
- Changing which resources a template includes

**Tests for MCP tools** → `foundry-mcp`
- Unit tests (`test/validate-*.ts`)
- Integration tests (`test/mcp-integration.ts`)
- Test utilities (`test/utils/`)

**Documentation** → depends on scope:
- **Specs, plans, architecture** → `snaifmcp` (`docs/spec/`, `docs/plan/`)
- **README for MCP server** → `foundry-mcp`
- **README for golden repo** → `foundry-golden`
- **This file and coordination docs** → `snaifmcp`

**Dependencies or build config** → `foundry-mcp`
- `package.json`, `tsconfig.json`, CI workflows

**Environment variable configuration** → `foundry-mcp`
- Changes to `src/shared/config.ts`

## Quick Reference

| Change Type | Repo | Example |
|-------------|------|---------|
| New tool | foundry-mcp | Adding `foundry_deploy` |
| New context file | foundry-golden | Adding `platform-security.md` |
| New skill | foundry-golden | Adding `api-testing/SKILL.md` |
| New template | foundry-golden | Adding `templates/minimal/` |
| Template metadata | foundry-golden | Editing `template.json` |
| Tool bug fix | foundry-mcp | Fixing `foundry_init` path handling |
| New test | foundry-mcp | Adding test for new tool |
| Spec update | snaifmcp | Updating `foundry-mvp-spec.md` |
| Architecture doc | snaifmcp | This file |
| Version bump | foundry-mcp | `package.json` + `CHANGELOG.md` |

## Common Mistakes

- **Don't** create PRs in snaifmcp for tool code changes
- **Don't** modify golden content directly in foundry-mcp (it gets cloned at runtime)
- **Don't** put specs or planning docs in foundry-mcp or foundry-golden
- **Do** create issues in the correct repo before starting work
- **Do** follow the branch naming convention (`feature/`, `fix/`, `chore/`, `docs/`)
