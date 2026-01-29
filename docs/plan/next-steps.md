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

## Phase 2: Foundation Expansion

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

## Phase 3: Discovery & Information

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

## Phase 4: Contribution Workflow

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

## Phase 5: Advanced Features

### 5.1 External Plugin Support

Allow referencing external resources with approval workflow.

**Tiers:**
- `@foundry/*` - Internal, fully trusted
- `@approved/*` - External, vetted and pinned
- `@github/*` / `@npm/*` - Direct reference (at own risk)

### 5.2 Resource Versioning

Track resource versions and allow pinning.

**Features:**
- Semantic versioning for resources
- Lock file for project dependencies
- Upgrade notifications

### 5.3 Multiple Templates

Support different project templates.

**Templates:**
- `minimal` - Just CLAUDE.md
- `standard` - Context + basic skills
- `sparc-full` - Everything + SPARC methodology
- `custom` - User-defined combination

---

## Implementation Priority

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

### Phase 2 Success
- Team members use `foundry_add` to customize projects
- < 5 minutes to add new resources
- Zero manual file copying

### Phase 3 Success
- New team members find resources without asking
- Search returns relevant results
- Info provides actionable guidance

### Phase 4 Success
- Team members contribute new resources
- Validation catches common issues
- Promotion workflow is self-service

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
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Golden repo unavailable | Low | High | Local cache, goldenPath fallback |
| MCP API changes | Low | Medium | Pin SDK version, test on updates |
| Content becomes stale | Medium | Medium | Regular review cycle, sync tool |
| Adoption resistance | Medium | High | Demonstrate value, gather feedback |

---

## Next Actions

1. **Immediate**: Gather feedback on MVP from team usage
2. **This Week**: Prioritize Phase 2 features based on feedback
3. **Next Sprint**: Implement `foundry_list` and `foundry_add`
4. **Ongoing**: Add content to golden repo based on POC needs
