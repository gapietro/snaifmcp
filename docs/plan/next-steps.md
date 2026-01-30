# Foundry: Post-MVP Implementation Plan

This document outlines the implementation plan for features beyond the MVP.

---

## Current State (MVP Complete)

### What's Done
- [x] `foundry_init` MCP tool - bootstraps new projects
- [x] Golden repo structure with context, skills, templates
- [x] 3 context files (Now Assist, GenAI, Agentic patterns)
- [x] 2 skills (Now Assist Skill Builder, API Integration)
- [x] SPARC starter template
- [x] Validation test suite
- [x] Documentation (README, HOWTO)

### What's Working
- Team members can bootstrap new POCs with one command
- Pre-loaded context is automatically available to Claude Code
- Skills provide consistent guidance for common tasks
- SPARC methodology template ensures consistent project structure

---

## Implementation Tracks

We're now building on **two parallel tracks**:

| Track | Focus | Description |
|-------|-------|-------------|
| **Track A** | Foundry Core | Resource management tools (list, add, sync) |
| **Track B** | ServiceNow Superpowers | Live instance integration for troubleshooting |

Both tracks can proceed independently with different team members.

---

## Track A: Foundry Core

### Phase 2: Foundation Expansion

**Goal:** Enable incremental resource management after project creation

### 2.1 `foundry_list` Tool

List available resources in the golden repo.

**Implementation:**
```typescript
const FOUNDRY_LIST_TOOL: Tool = {
  name: "foundry_list",
  description: "List available Foundry resources (context, skills, templates)",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["context", "skills", "templates", "all"],
        description: "Type of resources to list"
      }
    }
  }
};
```

**Behavior:**
1. Read golden repo directory structure
2. Return formatted list of available resources
3. Include brief descriptions from manifest/README files

**Acceptance Criteria:**
- [ ] Lists all context files with descriptions
- [ ] Lists all skills with descriptions
- [ ] Lists all templates with descriptions
- [ ] Works without network access (local golden repo)

### 2.2 `foundry_add` Tool

Add resources to an existing project.

**Implementation:**
```typescript
const FOUNDRY_ADD_TOOL: Tool = {
  name: "foundry_add",
  description: "Add a Foundry resource to the current project",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["context", "skill"],
        description: "Type of resource to add"
      },
      name: {
        type: "string",
        description: "Name of the resource to add"
      },
      projectPath: {
        type: "string",
        description: "Path to the project (defaults to current directory)"
      }
    },
    required: ["type", "name"]
  }
};
```

**Behavior:**
1. Verify project has `.claude/` directory
2. Check if resource already exists
3. Copy resource from golden repo
4. Report success with usage instructions

**Acceptance Criteria:**
- [ ] Adds context files to `.claude/context/`
- [ ] Adds skills to `.claude/skills/`
- [ ] Prevents duplicate additions
- [ ] Works on existing Foundry projects

### 2.3 `foundry_sync` Tool

Update project resources to latest versions.

**Implementation:**
```typescript
const FOUNDRY_SYNC_TOOL: Tool = {
  name: "foundry_sync",
  description: "Sync project resources with latest from golden repo",
  inputSchema: {
    type: "object",
    properties: {
      projectPath: {
        type: "string",
        description: "Path to the project (defaults to current directory)"
      },
      dryRun: {
        type: "boolean",
        description: "Preview changes without applying them"
      }
    }
  }
};
```

**Behavior:**
1. Compare project resources with golden repo
2. Identify outdated files
3. Update or report differences
4. Preserve any local modifications (optional)

**Acceptance Criteria:**
- [ ] Identifies outdated resources
- [ ] Updates resources without data loss
- [ ] Dry-run mode shows changes without applying
- [ ] Reports sync status

---

### Phase 3: Discovery & Information

**Goal:** Help users find and understand available resources

### 3.1 `foundry_info` Tool

Get detailed information about a specific resource.

**Parameters:**
- `type`: Resource type (context, skill, template)
- `name`: Resource name

**Returns:**
- Full description
- Usage instructions
- Dependencies
- Examples
- Last updated date

### 3.2 `foundry_search` Tool

Search across all resources.

**Parameters:**
- `query`: Search term
- `type`: Optional filter by resource type

**Returns:**
- Matching resources with relevance ranking
- Snippets showing match context

### 3.3 Resource Catalog

Create a browsable catalog of all resources.

**Implementation:**
- Generate `catalog.md` from golden repo
- Include descriptions, tags, dependencies
- Auto-update on golden repo changes

---

### Phase 4: Contribution Workflow

**Goal:** Enable team members to contribute new resources

### 4.1 `foundry_new` Tool

Scaffold a new resource.

**Parameters:**
- `type`: Resource type
- `name`: Resource name
- `description`: Brief description

**Creates:**
- Resource directory structure
- Manifest file with metadata
- Template files to fill in

### 4.2 `foundry_validate` Tool

Validate a resource before promotion.

**Checks:**
- Required files present
- Manifest schema valid
- No broken references
- Examples execute successfully

### 4.3 `foundry_promote` Tool

Submit resource for inclusion in golden repo.

**Workflow:**
1. Validate resource
2. Create PR to golden repo
3. Notify maintainers
4. Track approval status

---

### Phase 5: Advanced Features

#### 5.1 External Plugin Support

Allow referencing external resources with approval workflow.

**Tiers:**
- `@foundry/*` - Internal, fully trusted
- `@approved/*` - External, vetted and pinned
- `@github/*` / `@npm/*` - Direct reference (at own risk)

#### 5.2 Resource Versioning

Track resource versions and allow pinning.

**Features:**
- Semantic versioning for resources
- Lock file for project dependencies
- Upgrade notifications

#### 5.3 Multiple Templates

Support different project templates.

**Templates:**
- `minimal` - Just CLAUDE.md
- `standard` - Context + basic skills
- `sparc-full` - Everything + SPARC methodology
- `custom` - User-defined combination

---

## Track B: ServiceNow Superpowers

**Goal:** Give Claude direct access to ServiceNow instances for troubleshooting, debugging, and testing.

> **Full Design:** See [servicenow-troubleshooting-design.md](./servicenow-troubleshooting-design.md)

### Overview

These tools turn Claude into a powerful ServiceNow debugging assistant with live instance access:

| Tool | Description |
|------|-------------|
| `servicenow_connect` | Authenticate to instance (OAuth, basic auth, token) |
| `servicenow_syslogs` | Query/filter system logs |
| `servicenow_aia_logs` | Get AI Agent execution traces |
| `servicenow_script` | Execute background scripts (with safety rails) |
| `servicenow_query` | Run GlideRecord queries (read-only by default) |
| `servicenow_instance` | Get instance metadata and health |

### Why This Matters

Current troubleshooting workflow:
1. Developer sees issue in Now Assist / AI Agent
2. Manually navigates to System Logs in ServiceNow
3. Copies log entries
4. Pastes to Claude for analysis
5. Claude suggests a test
6. Developer manually runs background script
7. Copies results back to Claude
8. Repeat...

With ServiceNow tools:
1. Developer: "The IT Support agent is failing, can you check why?"
2. Claude connects, pulls AIA logs, identifies root cause, suggests fix
3. Done.

### Implementation Phases

#### Phase SN-1: Foundation (Target: 2 weeks)

| Task | Description |
|------|-------------|
| Connection Manager | Auth handling, session cache, token refresh |
| ServiceNow HTTP Client | Request/response, error handling, retries |
| `servicenow_connect` | Basic auth and OAuth support |
| Credentials file | ~/.servicenow/credentials.json support |

**Acceptance Criteria:**
- [ ] Connect to PDI with basic auth
- [ ] Connect with OAuth 2.0 (token refresh works)
- [ ] Session persists across tool calls
- [ ] Clear error messages for auth failures

#### Phase SN-2: Read Operations (Target: 2 weeks)

| Task | Description |
|------|-------------|
| `servicenow_syslogs` | Syslog querying with filters |
| `servicenow_aia_logs` | AIA execution trace retrieval |
| `servicenow_query` | Generic table queries |
| `servicenow_instance` | Instance info and health |

**Acceptance Criteria:**
- [ ] Query syslogs by level, source, time range
- [ ] Get full AIA execution traces with tool calls
- [ ] Query arbitrary tables with encoded queries
- [ ] Get instance version, plugins, health status

#### Phase SN-3: Script Execution (Target: 2 weeks)

| Task | Description |
|------|-------------|
| Script safety analyzer | Pattern detection, blocked operations |
| `servicenow_script` | Background script execution |
| Audit logging | Execution audit trail |
| Dry-run mode | Transaction rollback support |

**Acceptance Criteria:**
- [ ] Execute read-only scripts
- [ ] Block dangerous operations (delete, drop, credentials)
- [ ] Dry-run mode shows changes without committing
- [ ] Audit trail for all executions

### Authentication Strategy

| Method | Use Case | Security Level |
|--------|----------|----------------|
| **Basic Auth** | PDI/dev instances | Low (dev only) |
| **OAuth 2.0** | Production instances | High |
| **API Token** | Service accounts, CI/CD | Medium |

Credentials stored in `~/.servicenow/credentials.json` with encryption.

### Safety Rails

**Blocked by default:**
- Table drops and deletes
- Credential/password access
- System property changes
- Mass update/delete operations
- External HTTP calls

**Execution modes:**
- `readonly` - No mutations allowed
- `dryrun` - Execute in transaction, log, rollback
- `execute` - Full execution with audit

---

## Combined Implementation Priority

### Track A: Foundry Core

| Priority | Feature | Effort | Value |
|----------|---------|--------|-------|
| P1 | `foundry_list` | Small | High - enables discovery |
| P1 | `foundry_add` | Medium | High - enables incremental use |
| P2 | `foundry_info` | Small | Medium - improves UX |
| P2 | `foundry_sync` | Medium | Medium - keeps projects current |
| P3 | `foundry_search` | Medium | Medium - scales with content |
| P3 | `foundry_new` | Medium | Medium - enables contribution |
| P4 | `foundry_validate` | Medium | Low until contribution needed |
| P4 | `foundry_promote` | Large | Low until contribution needed |
| P5 | External plugins | Large | Low - future need |
| P5 | Versioning | Large | Low - future need |

### Track B: ServiceNow Superpowers

| Priority | Feature | Effort | Value |
|----------|---------|--------|-------|
| P1 | `servicenow_connect` | Medium | Critical - enables all other tools |
| P1 | `servicenow_syslogs` | Medium | High - immediate debugging value |
| P1 | `servicenow_aia_logs` | Medium | High - AI Agent debugging |
| P2 | `servicenow_query` | Small | High - flexible data access |
| P2 | `servicenow_script` (readonly) | Medium | High - testing capabilities |
| P3 | `servicenow_instance` | Small | Medium - instance awareness |
| P3 | `servicenow_script` (execute) | Large | Medium - full automation |

---

## Success Metrics

| Priority | Feature | Effort | Value |
|----------|---------|--------|-------|
| P1 | `foundry_list` | Small | High - enables discovery |
| P1 | `foundry_add` | Medium | High - enables incremental use |
| P2 | `foundry_info` | Small | Medium - improves UX |
| P2 | `foundry_sync` | Medium | Medium - keeps projects current |
| P3 | `foundry_search` | Medium | Medium - scales with content |
| P3 | `foundry_new` | Medium | Medium - enables contribution |
| P4 | `foundry_validate` | Medium | Low until contribution needed |
| P4 | `foundry_promote` | Large | Low until contribution needed |
| P5 | External plugins | Large | Low - future need |
| P5 | Versioning | Large | Low - future need |

---

## Success Metrics

### Track A Success

**Phase 2:**
- Team members use `foundry_add` to customize projects
- < 5 minutes to add new resources
- Zero manual file copying

**Phase 3:**
- New team members find resources without asking
- Search returns relevant results
- Info provides actionable guidance

**Phase 4:**
- Team members contribute new resources
- Validation catches common issues
- Promotion workflow is self-service

### Track B Success

**Phase SN-1:**
- Connect to any team instance in < 30 seconds
- OAuth token refresh works automatically
- Clear error messages guide auth setup

**Phase SN-2:**
- Pull relevant logs in one Claude conversation turn
- AIA execution traces show full tool call history
- Queries return useful, formatted data

**Phase SN-3:**
- Diagnostic scripts run safely without mutations
- Dangerous operations blocked with explanation
- Audit trail available for compliance

---

## Technical Debt & Improvements

### Short Term
- [ ] Add TypeScript strict mode
- [ ] Add ESLint configuration
- [ ] Improve error messages
- [ ] Add logging for debugging

### Medium Term
- [ ] Add integration tests
- [ ] Cache golden repo locally with TTL
- [ ] Support Windows paths
- [ ] Add progress indicators for long operations

### Long Term
- [ ] Publish to npm for easy installation
- [ ] Create VS Code extension
- [ ] Add telemetry (opt-in) for usage insights
- [ ] Build web catalog for browsing resources

---

## Dependencies & Risks

### Dependencies
- Claude Code MCP support (stable)
- @modelcontextprotocol/sdk (actively maintained)
- Golden repo hosting (GitHub assumed)

### Risks

**Track A Risks:**
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Golden repo unavailable | Low | High | Local cache, goldenPath fallback |
| MCP API changes | Low | Medium | Pin SDK version, test on updates |
| Content becomes stale | Medium | Medium | Regular review cycle, sync tool |
| Adoption resistance | Medium | High | Demonstrate value, gather feedback |

**Track B Risks:**
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Instance auth complexity | Medium | Medium | Multiple auth methods, clear docs |
| Accidental data mutation | Low | High | Safety rails, readonly default, audit |
| Rate limiting by ServiceNow | Medium | Low | Throttling, batch requests |
| Credential security | Medium | High | Encryption, no persistence, OS keychain |
| API changes across versions | Medium | Medium | Version detection, fallback behavior |

---

## Next Actions

### Track A: Foundry Core
1. **Immediate**: Gather feedback on MVP from team usage
2. **This Week**: Prioritize Phase 2 features based on feedback
3. **Next Sprint**: Implement `foundry_list` and `foundry_add`
4. **Ongoing**: Add content to golden repo based on POC needs

### Track B: ServiceNow Superpowers
1. **Immediate**: Review [servicenow-troubleshooting-design.md](./servicenow-troubleshooting-design.md)
2. **This Week**: Set up test PDI instance for development
3. **Next Sprint**: Implement `servicenow_connect` and `servicenow_syslogs`
4. **Ongoing**: Expand safety rails based on real-world usage

### Parallel Execution
- Track A and B can proceed independently
- Share common infrastructure (MCP server, TypeScript patterns)
- Weekly sync to align on shared concerns (auth, error handling)
