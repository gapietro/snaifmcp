# Foundry Backlog

**Last Updated:** 2026-01-29

This document tracks all planned features, enhancements, and technical debt items.

---

## Legend

| Status | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| `[!]` | Blocked |

| Priority | Meaning |
|----------|---------|
| P0 | Critical - blocks other work |
| P1 | High - significant value, do soon |
| P2 | Medium - good to have |
| P3 | Low - nice to have |
| P4 | Future - track but don't plan yet |

---

## Track A: Foundry Core

### Phase 2: Foundation Expansion

| ID | Priority | Status | Feature | Description |
|----|----------|--------|---------|-------------|
| A-001 | P1 | `[x]` | `foundry_list` | List available resources (context, skills, templates) |
| A-002 | P1 | `[x]` | `foundry_add` | Add resources to existing projects |
| A-003 | P2 | `[x]` | `foundry_sync` | Update project resources to latest versions |

### Phase 3: Discovery & Information

| ID | Priority | Status | Feature | Description |
|----|----------|--------|---------|-------------|
| A-004 | P2 | `[x]` | `foundry_info` | Get detailed resource information |
| A-005 | P3 | `[x]` | `foundry_search` | Search across all resources |
| A-006 | P3 | `[ ]` | Resource Catalog | Generate browsable catalog.md |

### Phase 4: Contribution Workflow

| ID | Priority | Status | Feature | Description |
|----|----------|--------|---------|-------------|
| A-007 | P3 | `[x]` | `foundry_new` | Scaffold new resources |
| A-008 | P4 | `[x]` | `foundry_validate` | Validate resources before promotion |
| A-009 | P4 | `[x]` | `foundry_promote` | Submit resources to golden repo |

### Phase 5: Advanced Features

| ID | Priority | Status | Feature | Description |
|----|----------|--------|---------|-------------|
| A-010 | P4 | `[x]` | External Plugins | @approved/*, @github/* support |
| A-011 | P4 | `[x]` | Resource Versioning | Semver, lock files, upgrade notifications |
| A-012 | P4 | `[x]` | Multiple Templates | minimal, standard, sparc-full, custom |

---

## Track B: ServiceNow Superpowers

### Phase SN-1: Foundation

| ID | Priority | Status | Feature | Description |
|----|----------|--------|---------|-------------|
| B-001 | P0 | `[x]` | Connection Manager | Auth handling, session cache, token refresh |
| B-002 | P0 | `[x]` | ServiceNow HTTP Client | Request/response, error handling, retries |
| B-003 | P1 | `[x]` | `servicenow_connect` | Authenticate to instance |
| B-004 | P2 | `[x]` | Credentials File | ~/.servicenow/credentials.json support |

### Phase SN-2: Read Operations

| ID | Priority | Status | Feature | Description |
|----|----------|--------|---------|-------------|
| B-005 | P1 | `[x]` | `servicenow_syslogs` | Query system logs with filters |
| B-006 | P1 | `[x]` | `servicenow_aia_logs` | Get AI Agent execution traces |
| B-007 | P2 | `[x]` | `servicenow_query` | Generic GlideRecord-style queries |
| B-008 | P2 | `[x]` | `servicenow_instance` | Instance info and health |

### Phase SN-3: Script Execution

| ID | Priority | Status | Feature | Description |
|----|----------|--------|---------|-------------|
| B-009 | P2 | `[x]` | Script Safety Analyzer | Pattern detection, blocked operations |
| B-010 | P2 | `[x]` | `servicenow_script` (readonly) | Execute read-only background scripts |
| B-011 | P2 | `[x]` | Audit Logging | Execution audit trail |
| B-012 | P3 | `[-]` | Dry-run Mode | Deferred - requires custom ServiceNow app |
| B-013 | P3 | `[x]` | `servicenow_script` (execute) | Full execution with safety rails |

---

## Golden Repo Content

### Context Files

| ID | Priority | Status | Content | Description |
|----|----------|--------|---------|-------------|
| C-001 | P1 | `[x]` | now-assist-platform.md | Now Assist architecture & APIs |
| C-002 | P1 | `[x]` | genai-framework.md | GenAI Controller & skill development |
| C-003 | P1 | `[x]` | agentic-patterns.md | Agentic framework & tools |
| C-004 | P2 | `[x]` | troubleshooting-guide.md | Common issues, debug patterns |
| C-005 | P2 | `[x]` | security-patterns.md | ACLs, roles, secure coding |
| C-006 | P3 | `[x]` | performance-tuning.md | Optimization techniques |

### Skills

| ID | Priority | Status | Skill | Description |
|----|----------|--------|-------|-------------|
| S-001 | P1 | `[x]` | now-assist-skill-builder | Creating custom Now Assist skills |
| S-002 | P1 | `[x]` | api-integration | ServiceNow REST API patterns |
| S-003 | P1 | `[x]` | servicenow-troubleshooting | Debug with syslogs, AIA logs, scripts |
| S-004 | P2 | `[x]` | agent-builder | Creating AI Agents |
| S-005 | P2 | `[x]` | testing-patterns | Unit testing, ATF, mocking |
| S-006 | P3 | `[x]` | deployment-automation | CI/CD, update sets, app publishing |

### Templates

| ID | Priority | Status | Template | Description |
|----|----------|--------|----------|-------------|
| T-001 | P1 | `[x]` | sparc-starter | SPARC methodology template |
| T-002 | P3 | `[x]` | minimal | Bare-bones CLAUDE.md |
| T-003 | P3 | `[x]` | standard | Standard setup with context |

---

## Technical Debt

| ID | Priority | Status | Item | Description |
|----|----------|--------|------|-------------|
| D-001 | P2 | `[ ]` | TypeScript strict mode | Enable strict: true in tsconfig |
| D-002 | P2 | `[ ]` | ESLint configuration | Add linting rules |
| D-003 | P2 | `[ ]` | Integration tests | End-to-end test coverage |
| D-004 | P3 | `[ ]` | Windows path support | Handle backslashes in paths |
| D-005 | P3 | `[ ]` | Progress indicators | Show progress for long operations |
| D-006 | P4 | `[ ]` | npm publishing | Publish foundry-mcp to npm |
| D-007 | P4 | `[ ]` | VS Code extension | IDE integration |

---

## Ideas / Future Exploration

These items are captured for future consideration but not prioritized yet:

| Idea | Description | Source |
|------|-------------|--------|
| Web catalog | Browse resources in a web UI | Original design |
| Telemetry (opt-in) | Usage insights for improvement | Original design |
| Team dashboards | See what resources teams are using | Brainstorm |
| AI-powered search | Semantic search across resources | Brainstorm |
| Auto-update notifications | Notify when resources update | Original design |
| Skill marketplace | Share skills across teams | Future vision |

---

## Recently Completed

| ID | Feature | Completed |
|----|---------|-----------|
| MVP-001 | `foundry_init` tool | 2026-01-29 |
| MVP-002 | Golden repo structure | 2026-01-29 |
| MVP-003 | 3 context files | 2026-01-29 |
| MVP-004 | 2 skills with examples | 2026-01-29 |
| MVP-005 | SPARC template | 2026-01-29 |
| MVP-006 | Validation test suite | 2026-01-29 |
| B-001 | Connection Manager | 2026-01-29 |
| B-002 | ServiceNow HTTP Client | 2026-01-29 |
| B-003 | `servicenow_connect` tool | 2026-01-29 |
| B-004 | Credentials file support | 2026-01-29 |
| B-extra | `servicenow_disconnect` tool | 2026-01-29 |
| B-extra | `servicenow_status` tool | 2026-01-29 |
| B-005 | `servicenow_syslogs` tool | 2026-01-29 |
| B-006 | `servicenow_aia_logs` tool | 2026-01-29 |
| B-007 | `servicenow_query` tool | 2026-01-29 |
| B-009 | Script safety analyzer | 2026-01-29 |
| B-010 | `servicenow_script` (readonly) | 2026-01-29 |
| B-011 | Audit logging for scripts | 2026-01-29 |
| B-013 | `servicenow_script` (execute) | 2026-01-29 |
| B-008 | `servicenow_instance` tool | 2026-01-29 |
| A-001 | `foundry_list` tool | 2026-01-29 |
| A-002 | `foundry_add` tool | 2026-01-29 |
| A-003 | `foundry_sync` tool | 2026-01-29 |
| A-004 | `foundry_info` tool | 2026-01-29 |
| A-005 | `foundry_search` tool | 2026-01-29 |
| A-007 | `foundry_new` tool | 2026-01-29 |
| A-008 | `foundry_validate` tool | 2026-01-29 |
| A-009 | `foundry_promote` tool | 2026-01-29 |
| A-010 | `foundry_external` tool | 2026-01-29 |
| A-011 | `foundry_version` tool | 2026-01-29 |
| A-012 | `foundry_templates` tool | 2026-01-29 |
| C-004 | troubleshooting-guide.md | 2026-01-29 |
| C-005 | security-patterns.md | 2026-01-29 |
| C-006 | performance-tuning.md | 2026-01-29 |
| S-003 | servicenow-troubleshooting skill | 2026-01-29 |
| S-004 | agent-builder skill | 2026-01-29 |
| T-002 | minimal template | 2026-01-29 |
| T-003 | standard template | 2026-01-29 |
| S-005 | testing-patterns skill | 2026-01-29 |
| S-006 | deployment-automation skill | 2026-01-29 |

---

## Notes

- **Parallel Execution:** Track A and B can proceed independently
- **Shared Infrastructure:** Both tracks share MCP server, TypeScript patterns
- **Content First:** Adding golden repo content provides immediate value without code
- **Safety First:** Track B requires careful safety rail implementation before script execution
