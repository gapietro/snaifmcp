# {{PROJECT_NAME}}

## Project Overview

Add your project description here.

---

## Guidelines

- Add your project-specific guidelines
- Add coding conventions
- Add any other relevant information

### Git Workflow

**CRITICAL: NEVER commit directly to main. ALL changes require a branch and PR.**

This is a strict requirement with NO exceptions - not even for "small" or "config-only" changes.

#### Required Steps for ALL Changes
1. Create a feature branch from main (e.g., `feature/description` or `fix/description`)
2. Make changes on the feature branch
3. Commit to the feature branch (never to main)
4. Push the branch to origin
5. Create a Pull Request to merge into main
6. Merge via PR when approved

#### Branch Naming Convention
- `feature/` - New functionality
- `fix/` - Bug fixes
- `chore/` - Config changes, cleanup, maintenance
- `docs/` - Documentation only

**DO NOT rationalize skipping this workflow for "simple" changes. The workflow applies to everything.**

### Version Numbering

**REQUIRED:** Increment the version number whenever code is merged to main.

**Format:** `YYYY.MM.DDXX`

| Segment | Description | Example |
|---------|-------------|---------|
| YYYY | Year | 2026 |
| MM | Month (zero-padded) | 01 = January |
| DDXX | Day + daily increment | 0902 = 9th day, 2nd merge |

**Files to update:**
- `package.json` - Update the "version" field
- `README.md` - Update the version badge

**When to increment:**
- After every PR merge to main
- Increment daily counter (XX) for multiple same-day merges
- Reset daily counter to 01 on a new day

See full version history: `CHANGELOG.md`

---

## Issue Tracking

**CRITICAL: ALL work must be associated with a GitHub issue.**

Before starting any feature, bug fix, or task, ensure a GitHub issue exists.

### For Bugs/Improvements:
1. Capture a "before" screenshot showing the issue
2. Create the issue with screenshot and appropriate labels
3. After fixing, capture an "after" screenshot
4. Attach the "after" screenshot before closing

### Issue Assignment
Auto-assign to issue creator using `--assignee @me`

### Labels
| Label | When to Use |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New functionality or improvement |
| `ui` / `ux` | User interface or experience changes |

---

## Prompting Discipline

**CRITICAL: Do NOT build on insufficient information. Ask clarifying questions first.**

**Use the `AskUserQuestion` tool** to gather missing details before implementation. The goal is to get clarity, not to refuse work. Only after the user declines to provide details should Claude proceed with assumptions (clearly stated).

When the user provides a brief feature request (e.g., "Add a delete button"), Claude MUST use AskUserQuestion to clarify before implementation. Guessing leads to bugs.

### Required Clarifications

Before implementing any UI feature, ensure these are defined:

| Aspect | Question to Ask |
|--------|-----------------|
| **Placement** | Where exactly should this appear? |
| **Interaction** | What happens on click/hover/focus? |
| **Confirmation** | Is a confirmation dialog needed? What text? |
| **Error handling** | What if the operation fails? |
| **Edge cases** | What if the list is empty? Last item? |
| **Keyboard** | Any keyboard shortcuts needed? |
| **Loading state** | What shows during async operations? |

### When to Ask vs. When to Assume

**ASK** when:
- The request is 1-2 sentences with no specifics
- Multiple valid implementations exist
- User experience decisions are involved
- Error handling isn't specified

**ASSUME** (using existing patterns) when:
- User says "like we did for X"
- User references an existing component as the model
- User provides detailed acceptance criteria
- The feature is a direct copy of existing functionality

### Anti-Pattern

❌ "Add a delete button" → Claude builds something → User finds issues → Iteration

### Correct Pattern

✅ "Add a delete button" → Claude uses `AskUserQuestion` tool → User answers → Claude builds to spec

Example AskUserQuestion usage:
```
Questions: "Where should the delete button appear?", "Is confirmation needed?"
Options: ["Card header", "Card footer", "Hover only"], ["Yes with dialog", "No, delete immediately"]
```

---

## AI-Assisted Development Workflow (Superpowers)

**MANDATORY** for all development activities unless explicitly skipped.

### Philosophy
- **Test-Driven Development** - Write tests first, always
- **Systematic over ad-hoc** - Process over guessing
- **Complexity reduction** - Simplicity as primary goal (YAGNI, DRY)
- **Evidence over claims** - Verify before declaring success

### Standard Workflow

| Command | When |
|---------|------|
| Design | `/brainstorming` | Before ANY code |
| Isolation | `/using-git-worktrees` | After design approval |
| Planning | `/writing-plans` | Before implementation |
| Execution | `/subagent-driven-development` | During implementation |
| Testing | `/test-driven-development` | During ALL coding |
| **Code Review** | `/requesting-code-review` | **After each task completes** |
| **Security Review** | Manual or subagent | **For config, hooks, credentials** |
| **Verification** | `/verification-before-completion` | **Before ANY merge claim** |
| Completion | `/finishing-a-development-branch` | When done |
| Debugging | `/systematic-debugging` | When bugs occur |

### Mandatory Checkpoints (Non-Negotiable)

These checkpoints apply to ALL work, including "simple" config changes:

| Checkpoint | When | What to Check |
|------------|------|---------------|
| **Code Review** | After implementation, before PR | Does it meet requirements? Any regressions? |
| **Security Review** | For hooks, credentials, shell commands | Injection risks? Secrets exposed? Error handling? |
| **Verification** | Before claiming "done" or merging | Actually test it works. Evidence required. |

**TDD for Non-Code Changes:**
- Config files → Define expected behavior → Implement → Verify behavior works
- Hooks → What should trigger? → Add hook → Restart and test trigger
- Documentation → What should be documented? → Write it → Verify accuracy

**Subagent Checkpoint:**
When 3+ independent tasks exist, use `/dispatching-parallel-agents` instead of sequential execution.

### Skip Phrases
The developer may explicitly skip steps by saying:
- "Skip brainstorming" or "I know what I want, just build it"
- "No worktree needed" or "Work on current branch"
- "Skip planning" or "This is a quick fix"
- "Skip TDD" or "No tests needed for this"

**Without explicit permission, ALL steps are mandatory.**

### Anti-Patterns to Avoid
- Jumping straight to code without understanding requirements
- Writing code before tests
- Skipping design validation with the developer
- Large monolithic changes instead of small incremental tasks
- Claiming work is complete without running verification
- **Skipping code review** because changes seem "straightforward"
- **Skipping security review** for hooks, shell commands, or config
- **Sequential execution** when 3+ tasks could run in parallel
- **Merging without testing** - "it should work" is not verification

---

## Resources

This is a minimal template with no pre-loaded resources.

Use Foundry tools to add resources as needed:

```
# Add context files
foundry_add type="context" name="now-assist-platform"
foundry_add type="context" name="genai-framework"

# Add skills
foundry_add type="skill" name="api-integration"
foundry_add type="skill" name="servicenow-troubleshooting"
```

Use `foundry_list` to see all available resources.

---

## Notes

- Created with Foundry minimal template
- Add sections as needed for your project
