# Changelog

All notable changes to the Foundry MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project uses date-based versioning (`YYYY.MM.DDXX`).

## [Unreleased]

## [2026.02.1901] - 2026-02-19

### Fixed
- AIA table discovery now uses correct Zurich table names: `sn_aia_execution_plan`, `sn_aia_execution_task`, `sn_aia_tools_execution`, `sn_aia_message` (#42)
- Strategy field no longer shows `[object Object]` — added `resolveRefField()` helper for ServiceNow reference fields (#43)
- Consolidated table name candidates into single source of truth in `table-discovery.ts` (#42)

### Security
- Scrubbed plaintext credentials from session output file (#45)
- Added `agent-test/` and `session-raw-output.txt` to `.gitignore` (#45)

## [2026.02.1303] - 2026-02-13

### Added
- 6 AI Agent tools: `servicenow_aia_list`, `servicenow_aia_get`, `servicenow_aia_trace`, `servicenow_aia_errors`, `servicenow_aia_execute`, `servicenow_aia_create` (#36)
- 4 Now Assist Skill tools: `servicenow_skill_list`, `servicenow_skill_get`, `servicenow_skill_execute`, `servicenow_skill_create` (#36)
- Connection guard helper (`guards.ts`) — `requireConnection()` / `isConnectionError()` (#36)
- Table discovery utility (`table-discovery.ts`) — version-aware table probing with session cache (#36)
- CRUD methods on `ServiceNowClient`: `createRecord()`, `updateRecord()`, `deleteRecord()` (#36)
- Create tools default to dry-run mode for safety (`dryRun: true`)
- 23 new ServiceNow tests (65 total, up from 42)

### Changed
- Total tool count: 30 (12 foundry + 8 core SN + 6 AIA + 4 skill)
- MCP integration test updated for 30-tool verification

## [2026.02.1302] - 2026-02-13

### Added
- MCP protocol integration test (`test/mcp-integration.ts`) — spawns server over stdio, validates NDJSON handshake, verifies all 20 tools, exercises `servicenow_status` and `foundry_init` end-to-end (#33)
- `test:mcp` npm script and updated `test:all` to include it

### Changed
- Centralize configuration with environment variable support (`shared/config.ts`) — 7 env vars for golden repo, cache, ServiceNow settings (#29)
- Standardize error handling with `FoundryError` class and `errorToResult()` boundary helper (#29)
- Shared test runner utility (`test/utils/test-runner.ts`) — eliminates duplicated test infrastructure across 4 test files (#31)
- Data-driven templates: `loadTemplates()` reads `template.json` from golden repo with hardcoded fallback (#31)

## [2026.02.1301] - 2026-02-13

### Security
- Fix shell command injection by replacing `execAsync` with `safeExec` using `spawn` with `shell: false` (#24)
- Add `validateResourceName()` to enforce safe characters in resource names

### Changed
- **BREAKING (internal):** Modularize monolithic `src/index.ts` (4200 lines) into 13 focused modules (#26)
  - `src/foundry/` — 9 modules (tools, golden-repo, project, resources, contribute, external, version, templates, types)
  - `src/shared/` — 4 modules (config, errors, fs-utils, exec-utils)
  - `src/index.ts` reduced to 98 lines (server setup + routing only)
- Add input validation at tool handler boundary via `validateRequired()` helper

## [2026.02.1101] - 2026-02-11

### Added
- GitHub Actions workflows for branch protection enforcement (#22)
  - Require PR approval from org owners
  - Block direct pushes to main
  - Prevent force pushes
  - Enforce linear history
- Contributing & Branch Protection section in README
- Complete historical CHANGELOG with all releases from 1.0.0

## [2026.01.3011] - 2026-01-30

### Fixed
- Force cache refresh when listing resources to ensure latest content (#20)

## [2026.01.3010] - 2026-01-30

### Changed
- Transform `gs.info()` to results array for ServiceNow script output capture (#18)

## [2026.01.3009] - 2026-01-30

### Fixed
- Version check now uses fresh cache when checking for updates (#16)

## [2026.01.3008] - 2026-01-30

### Fixed
- Force cache refresh when syncing resources to detect updates (#14)

## [2026.01.3007] - 2026-01-30

### Added
- Documentation for `gs.info()` requirement in ServiceNow script output capture (#12)

## [2026.01.3006] - 2026-01-30

### Added
- Dev bootstrap script (`npm run dev:setup`) for automated foundry-golden setup (#9)
  - Automatically clones foundry-golden as sibling repo
  - Pulls latest changes if already exists
  - Installs dependencies and builds

## [2026.01.3005] - 2026-01-30

### Fixed
- Golden repo config updated to point to Now-AI-Foundry organization (#5)

## [2026.01.3004] - 2026-01-30

### Added
- Agent examples support with placeholders (#2)
- External registry support for @approved and @github packages

## [2026.01.3001] - 2026-01-30

### Added
- ServiceNow troubleshooting tools (#1)
  - `servicenow_connect` - Connect to ServiceNow instance
  - `servicenow_disconnect` - Disconnect from instance
  - `servicenow_status` - Check connection status
  - `servicenow_syslogs` - Query system logs
  - `servicenow_aia_logs` - Query AI Agent execution logs
  - `servicenow_query` - Query any table with GlideRecord syntax
  - `servicenow_script` - Execute background scripts
  - `servicenow_instance` - Get instance info and health
- Additional Foundry tools
  - Workflow guidelines and skills management
  - Project structure improvements

## [1.0.0] - 2026-01-30

### Added
- Initial release of Foundry MCP Server
- 12 Foundry tools for POC development
  - `foundry_init` - Bootstrap new projects
  - `foundry_list` - List available resources
  - `foundry_add` - Add resources to projects
  - `foundry_sync` - Sync with golden repo
  - `foundry_info` - Get resource details
  - `foundry_search` - Search across resources
  - `foundry_new` - Create new resources
  - `foundry_validate` - Validate resources
  - `foundry_promote` - Promote to golden repo
  - `foundry_external` - Manage external plugins
  - `foundry_version` - Version management
  - `foundry_templates` - Template management
- Golden repository integration with local caching
- Comprehensive test suite (90 tests)
- MCP protocol implementation

---

## Version Number Format

Versions use the format `YYYY.MM.DDXX`:
- `YYYY` - Year (e.g., 2026)
- `MM` - Month (01-12, zero-padded)
- `DD` - Day (01-31, zero-padded)
- `XX` - Daily increment (01, 02, 03...)

Example: `2026.01.3001` = First release on January 30, 2026

---

## Links

- [GitHub Repository](https://github.com/Now-AI-Foundry/foundry-mcp)
- [GitHub Releases](https://github.com/Now-AI-Foundry/foundry-mcp/releases)
- [Pull Requests](https://github.com/Now-AI-Foundry/foundry-mcp/pulls?q=is%3Apr+is%3Amerged)
