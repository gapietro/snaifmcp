# Foundry MVP Specification (SPARC-lite)

> **Goal:** Prove that pre-loaded Now Assist context and reusable skills make POC development faster.

---

## 1. Problem Statement

### Current Pain
Every Now Assist POC requires manually gathering:
- GenAI context and patterns
- Skill development patterns
- API references and examples
- Agentic framework knowledge
- Project structure and conventions

This takes hours per POC and results in inconsistent setups across team members.

### Desired State
One command bootstraps a project with everything needed to start building immediately:
```bash
# Via MCP tool in Claude Code
foundry_init my-poc
```

---

## 2. MVP Scope

### In Scope

| Component | Description |
|-----------|-------------|
| `foundry_init` MCP tool | Single tool that bootstraps a new POC project |
| Golden repo content | Now Assist context, GenAI patterns, agentic framework docs |
| Reusable skills | 2-3 skills for common POC tasks |
| SPARC starter template | Pre-configured CLAUDE.md with team conventions |
| Simple file copy | Clone golden repo → copy to project directory |

### Out of Scope (Explicitly Deferred)

These features are intentionally excluded from MVP to keep scope minimal:

- Versioning / lock files
- External plugins (`@approved`, `@github`, `@npm`)
- Contribution workflow (`foundry new`, `foundry promote`)
- Search/catalog/info tools
- Multiple templates (MVP has one: `sparc-starter`)
- Namespacing (`@foundry/*`)
- `foundry add` for incremental resource addition
- Resource validation

---

## 3. User Stories

### Story 1: New Team Member Onboarding
**As a** new AI Foundry team member
**I want to** run `foundry_init my-poc`
**So that** I get a project with Now Assist context pre-loaded and can start coding immediately without asking teammates for resources.

### Story 2: Experienced Member Starting Fresh POC
**As an** experienced team member
**I want to** bootstrap new POCs with consistent structure
**So that** I don't waste time recreating skills and context I've built before.

---

## 4. Technical Design

### 4.1 Repository Structure

#### foundry-golden (GitHub repo)
```
foundry-golden/
├── README.md
├── context/
│   ├── now-assist-platform.md      # Now Assist architecture, capabilities, APIs
│   ├── genai-framework.md          # GenAI Controller, skill invocation patterns
│   └── agentic-patterns.md         # Agentic framework, tool use, orchestration
├── skills/
│   ├── now-assist-skill-builder/
│   │   ├── SKILL.md                # Skill definition and instructions
│   │   └── examples/               # Example skill implementations
│   └── api-integration/
│       ├── SKILL.md
│       └── examples/
└── templates/
    └── sparc-starter/
        └── CLAUDE.md               # Pre-configured project instructions
```

#### foundry-mcp (npm package)
```
foundry-mcp/
├── src/
│   └── index.ts                    # MCP server with foundry_init tool
├── package.json
├── tsconfig.json
└── README.md
```

### 4.2 MCP Server Implementation

**Single Tool: `foundry_init`**

```typescript
// Tool definition
{
  name: "foundry_init",
  description: "Bootstrap a new Now Assist POC project with pre-loaded context, skills, and SPARC template",
  inputSchema: {
    type: "object",
    properties: {
      projectName: {
        type: "string",
        description: "Name of the project directory to create"
      },
      path: {
        type: "string",
        description: "Parent directory for the project (defaults to current directory)"
      }
    },
    required: ["projectName"]
  }
}
```

**Behavior:**
1. Clone/fetch `foundry-golden` repo (or use cached local copy)
2. Create project directory at `{path}/{projectName}`
3. Copy context files to `{project}/.claude/context/`
4. Copy skills to `{project}/.claude/skills/`
5. Copy SPARC template to `{project}/CLAUDE.md`
6. Return success message with next steps

### 4.3 Generated Project Structure

After running `foundry_init my-poc`:

```
my-poc/
├── CLAUDE.md                       # SPARC-starter template (customizable)
└── .claude/
    ├── context/
    │   ├── now-assist-platform.md
    │   ├── genai-framework.md
    │   └── agentic-patterns.md
    └── skills/
        ├── now-assist-skill-builder/
        │   └── SKILL.md
        └── api-integration/
            └── SKILL.md
```

### 4.4 SPARC Starter Template

The generated `CLAUDE.md` will include:

```markdown
# Project: {projectName}

## AI Foundry Context
This project was bootstrapped with Foundry. Pre-loaded resources are in `.claude/`.

## SPARC Methodology
[Specification → Pseudocode → Architecture → Refinement → Completion]

### Current Phase: Specification
- [ ] Define the problem and success criteria
- [ ] Identify stakeholders and constraints
- [ ] Document API contracts

## Now Assist Context
See `.claude/context/` for:
- Now Assist platform architecture
- GenAI framework patterns
- Agentic framework guidance

## Available Skills
See `.claude/skills/` for reusable capabilities.

## Conventions
- Use TypeScript for all implementation
- Follow ServiceNow API patterns from context docs
- Document decisions in this file
```

---

## 5. Acceptance Criteria

| # | Criterion | Validation |
|---|-----------|------------|
| 1 | `foundry_init my-poc` creates project directory | Directory exists at specified path |
| 2 | Project contains Now Assist context files | All 3 context files present in `.claude/context/` |
| 3 | Project contains useful skills | At least 2 skill directories in `.claude/skills/` |
| 4 | Project has SPARC-starter CLAUDE.md | CLAUDE.md exists with SPARC structure |
| 5 | Works with Claude Code MCP integration | Tool appears in Claude Code and executes successfully |
| 6 | Team member can start coding immediately | No additional setup required after init |

---

## 6. Content Requirements

### 6.1 Context Files (Priority Order)

1. **now-assist-platform.md** (High Priority)
   - Now Assist architecture overview
   - Available capabilities (summarization, generation, Q&A)
   - API endpoints and authentication
   - Configuration options

2. **genai-framework.md** (High Priority)
   - GenAI Controller concepts
   - Skill invocation patterns
   - Prompt engineering guidelines
   - Response handling

3. **agentic-patterns.md** (Medium Priority)
   - Tool definition patterns
   - Multi-step orchestration
   - Error handling strategies
   - Testing approaches

### 6.2 Skills (Priority Order)

1. **now-assist-skill-builder** (High Priority)
   - Instructions for creating new Now Assist skills
   - Skill manifest structure
   - Testing and deployment steps

2. **api-integration** (Medium Priority)
   - ServiceNow REST API patterns
   - Authentication handling
   - Common CRUD operations

---

## 7. Validation Plan

### Phase 1: Internal Testing
- Team members use on 1 internal test project
- Collect feedback on content usefulness

### Phase 2: Real POC Usage
- Use on 2-3 real customer POCs
- Track metrics:
  - What content was actually used?
  - What was missing that had to be added?
  - What was ignored/unnecessary?

### Phase 3: Iterate
- Decide next features based on actual friction
- Candidates for next iteration:
  - `foundry add` for incremental additions
  - Additional templates
  - More skills based on POC patterns

---

## 8. Implementation Checklist

### Repo Setup
- [ ] Create `foundry-golden` GitHub repo
- [ ] Create `foundry-mcp` GitHub repo
- [ ] Set up repo permissions for AI Foundry team

### Golden Repo Content
- [ ] Write `now-assist-platform.md`
- [ ] Write `genai-framework.md`
- [ ] Write `agentic-patterns.md`
- [ ] Create `now-assist-skill-builder` skill
- [ ] Create `api-integration` skill
- [ ] Create `sparc-starter` template

### MCP Server
- [ ] Initialize TypeScript project
- [ ] Implement `foundry_init` tool
- [ ] Add golden repo fetch/cache logic
- [ ] Test with Claude Code
- [ ] Publish to npm (or use local)

### Documentation
- [ ] Write setup instructions for team
- [ ] Document MCP configuration for Claude Code

---

## 9. Open Questions

> To be resolved before implementation:

1. **Golden repo hosting:** Public GitHub? Private ServiceNow repo?
2. **MCP distribution:** npm publish or local install?
3. **Cache location:** Where to store cached golden repo locally?
4. **Content ownership:** Who maintains/updates each context file?

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first commit on new POC | < 30 minutes (vs current ~2 hours) |
| Team adoption rate | 100% of new POCs use Foundry init |
| Content utilization | > 70% of pre-loaded content referenced |
| Missing content additions | Track what teams add manually |
