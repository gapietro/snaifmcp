# AI Foundry Golden Repo Framework

## Overview

A centralized repository of vetted, versioned Claude Code resources (skills, sub-agents, context files, prompts) that team members can pull into projects via linking, with a contribution workflow for adding new resources back to the commons.

---

## Golden Repo Structure

```
foundry-golden/
├── .foundry/
│   ├── registry.json          # Master index of all resources + versions
│   └── schemas/               # JSON schemas for validation
│       ├── skill.schema.json
│       ├── agent.schema.json
│       └── manifest.schema.json
│
├── skills/
│   ├── research/
│   │   ├── SKILL.md
│   │   ├── manifest.json      # version, deps, metadata
│   │   └── tools/             # supporting scripts if needed
│   │
│   ├── code-review/
│   │   ├── SKILL.md
│   │   └── manifest.json
│   │
│   └── servicenow-api/
│       ├── SKILL.md
│       ├── manifest.json
│       └── examples/
│
├── agents/
│   ├── orchestrator/
│   │   ├── AGENT.md           # Agent definition + system prompt
│   │   ├── manifest.json
│   │   └── sub-prompts/       # Decomposed prompt fragments
│   │
│   └── sparc-planner/
│       ├── AGENT.md
│       └── manifest.json
│
├── context/
│   ├── servicenow-base/
│   │   ├── CONTEXT.md         # Shared context about SN platform
│   │   └── manifest.json
│   │
│   ├── team-conventions/
│   │   ├── CONTEXT.md         # Coding standards, PR process, etc.
│   │   └── manifest.json
│   │
│   └── sparc-methodology/
│       ├── CONTEXT.md
│       └── manifest.json
│
├── prompts/
│   ├── templates/
│   │   ├── feature-spec.md
│   │   ├── bug-analysis.md
│   │   └── manifest.json
│   │
│   └── fragments/             # Reusable prompt components
│       ├── output-format-json.md
│       ├── chain-of-thought.md
│       └── manifest.json
│
├── bootstrap/
│   ├── templates/             # Project scaffolding templates
│   │   ├── standard/
│   │   ├── sparc-full/
│   │   └── minimal/
│   └── hooks/                 # Post-init scripts
│
└── bin/
    └── foundry-cli            # The bootstrap/management CLI
```

---

## Resource Manifest Format

Each resource has a `manifest.json`:

```json
{
  "name": "research",
  "type": "skill",
  "version": "1.2.0",
  "description": "Deep research skill with web search and synthesis capabilities",
  "author": "gfernandez",
  "created": "2025-01-15",
  "updated": "2025-01-25",
  
  "dependencies": [
    { "type": "context", "name": "team-conventions", "version": ">=1.0.0" },
    { "type": "prompt", "name": "fragments/chain-of-thought", "version": "*" }
  ],
  
  "tags": ["research", "web", "synthesis"],
  
  "compatibility": {
    "claude-code": ">=1.0.0",
    "claude-flow": ">=0.5.0"
  },
  
  "entrypoint": "SKILL.md",
  
  "status": "stable"  // draft | stable | deprecated
}
```

---

## Project Structure (After Bootstrap)

When you run `foundry-init`, you get:

```
my-new-project/
├── .foundry/
│   ├── project.json           # Project manifest with linked resources
│   ├── lock.json              # Locked versions (like package-lock)
│   └── local/                 # Local overrides (not pushed to golden)
│
├── .claude/
│   ├── settings.json          # Claude Code settings
│   └── commands/              # Project-specific slash commands
│
├── CLAUDE.md                  # Main project context (auto-generated header)
│
├── context/                   # Project-specific context
│   └── project-specific.md
│
├── skills/                    # Project-specific skills (can promote to golden)
│
├── agents/                    # Project-specific agents
│
└── src/                       # Your actual code
```

---

## Project Manifest (project.json)

```json
{
  "name": "my-new-project",
  "template": "sparc-full",
  "created": "2025-01-28",
  
  "golden": {
    "repo": "github.com/servicenow-aif/foundry-golden",
    "branch": "main"
  },
  
  "resources": {
    "skills": [
      { "name": "research", "version": "1.2.0" },
      { "name": "code-review", "version": "^2.0.0" }
    ],
    "agents": [
      { "name": "sparc-planner", "version": "1.0.0" }
    ],
    "context": [
      { "name": "servicenow-base", "version": "latest" },
      { "name": "team-conventions", "version": "latest" },
      { "name": "sparc-methodology", "version": "1.1.0" }
    ],
    "prompts": [
      { "name": "templates/feature-spec", "version": "*" }
    ]
  },
  
  "localOverrides": {
    "skills/research": ".foundry/local/research-override"
  }
}
```

---

## CLI Commands

### Bootstrap a New Project

```bash
# Interactive mode - walks through options
foundry init my-project

# Quick start with template
foundry init my-project --template sparc-full

# With specific resources
foundry init my-project \
  --with skills/research@1.2.0 \
  --with agents/orchestrator \
  --with context/servicenow-base

# From existing project.json (clone a config)
foundry init my-project --from ../other-project/.foundry/project.json
```

### Manage Resources

```bash
# Add a resource to current project
foundry add skill research
foundry add skill research@1.2.0      # specific version
foundry add context servicenow-base

# Update resources
foundry update                         # all to latest compatible
foundry update skill research          # specific resource
foundry update --lock                  # update lock file only

# List what's linked
foundry list
foundry list --outdated

# Sync/refresh from golden repo
foundry sync
```

### Develop & Contribute

```bash
# Create a new local skill (scaffolds structure)
foundry new skill my-new-skill

# Validate a resource before contributing
foundry validate skills/my-new-skill

# Promote local resource to golden repo (opens PR)
foundry promote skill my-new-skill --message "Add new skill for X"

# Check status of your contributions
foundry contributions
```

### Discovery

```bash
# Search golden repo
foundry search "servicenow"
foundry search --type skill --tag api

# Show resource details
foundry info skill research
foundry info skill research --versions
```

---

## Linking Mechanism

Two approaches (can support both):

### Option A: Git Submodule + Symlinks
```bash
# Golden repo as submodule in known location
~/.foundry/golden/  (git submodule, auto-updated)

# Projects symlink to specific versions
my-project/.claude/skills/research -> ~/.foundry/golden/skills/research@1.2.0
```

**Pros:** Simple, works offline, git-native
**Cons:** Symlinks can be fragile, version switching is clunky

### Option B: Direct File Injection (Recommended)
```bash
# On `foundry sync`, CLI copies/generates files into project
# But marks them as managed (don't edit directly)

my-project/.foundry/linked/
  skills/
    research/           # Copied from golden, version tracked
      SKILL.md
      .foundry-source   # Metadata: origin, version, checksum
```

Claude Code's settings.json points to these:
```json
{
  "skills": [
    ".foundry/linked/skills/research",
    "./skills"  // local skills second
  ]
}
```

**Pros:** No symlink issues, works everywhere, clear separation
**Cons:** Duplication (but small files), need sync discipline

---

## Contribution Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTRIBUTION FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

  Developer                        Golden Repo                    
  ─────────                        ───────────                    
      │                                 │                         
      │  1. foundry new skill foo       │                         
      │  ────────────────────────►      │                         
      │  (creates local scaffold)       │                         
      │                                 │                         
      │  2. Develop & test locally      │                         
      │  ◄────────────────────────      │                         
      │                                 │                         
      │  3. foundry validate            │                         
      │  ────────────────────────►      │                         
      │  (checks structure, deps)       │                         
      │                                 │                         
      │  4. foundry promote             │                         
      │  ────────────────────────►      │                         
      │       │                         │                         
      │       │  Creates PR             │                         
      │       └────────────────────►    │                         
      │                                 │                         
      │                           5. Reviewer approves            
      │                              (designated team member)     
      │                                 │                         
      │                           6. Merge + auto-tag version     
      │                                 │                         
      │  7. foundry sync                │                         
      │  ◄────────────────────────      │                         
      │  (pulls new resource)           │                         
      │                                 │                         
```

### PR Requirements (Lightweight)

- [ ] `manifest.json` is valid and complete
- [ ] Version follows semver
- [ ] Dependencies exist in golden repo
- [ ] SKILL.md / AGENT.md / CONTEXT.md has description + usage
- [ ] At least one example or test case
- [ ] No hardcoded project-specific values

---

## Auto-Generated CLAUDE.md Header

When `foundry sync` runs, it can inject/update a header in CLAUDE.md:

```markdown
<!-- FOUNDRY:BEGIN - Do not edit this section manually -->
## Project Resources (Foundry Managed)

This project uses the following shared resources from the AI Foundry Golden Repo:

### Skills
- **research** (v1.2.0) - Deep research with web search and synthesis
- **code-review** (v2.0.0) - Automated code review patterns

### Context
- **servicenow-base** (v1.5.0) - ServiceNow platform fundamentals
- **sparc-methodology** (v1.1.0) - SPARC development approach

### Agents
- **sparc-planner** (v1.0.0) - SPARC phase planning orchestrator

Run `foundry sync` to update. Run `foundry list --outdated` to check for updates.
<!-- FOUNDRY:END -->

## Project-Specific Context

[Your project context here...]
```

---

## Version Strategy

| Specifier | Meaning |
|-----------|---------|
| `1.2.0` | Exact version |
| `^1.2.0` | Compatible (>=1.2.0 <2.0.0) |
| `~1.2.0` | Patch only (>=1.2.0 <1.3.0) |
| `>=1.0.0` | Minimum version |
| `latest` | Always newest stable |
| `*` | Any version |

Lock file (`lock.json`) captures exact resolved versions for reproducibility.

---

## Design Decisions

1. **Namespace isolation**: ✅ YES
   - Golden repo resources use `@foundry/` prefix
   - e.g., `@foundry/research`, `@foundry/servicenow-base`
   - Local project resources have no prefix
   - Resolution: local first, then golden

2. **Breaking changes**: Defer for now
   - Future consideration: migration guides in manifest, deprecation periods
   - For now: semver + communication in PR descriptions

3. **Private/experimental resources**: Not needed
   - Team members use their own repos for experimentation
   - Golden repo is for vetted, ready-to-use resources only

4. **Metrics**: Not needed at this stage

5. **CI integration**: Manual PR approval only for now

---

## Next Steps

1. [ ] Finalize directory structure decisions
2. [ ] Build minimal CLI (init, add, sync, list)
3. [ ] Create first batch of skills/context from existing team knowledge
4. [ ] Document contribution guidelines
5. [ ] Pilot with 2-3 team members
6. [ ] Iterate based on friction points

---

## Implementation Notes

The CLI could be built as:
- **Node.js** - familiar, good GitHub API support, easy to distribute
- **Python** - if team prefers, works well with existing tooling
- **Bash + jq** - minimal, but limited for complex logic

Recommendation: **Node.js** with Commander.js for CLI framework. Can publish to internal npm registry or just `npm install` from the GitHub repo directly.
