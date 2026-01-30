# Foundry Golden Repository: Content Guide

Guide for adding, updating, and maintaining content in the golden repository.

---

## Quick Reference

| Content Type | Location | Required Files |
|--------------|----------|----------------|
| Context | `context/` | `*.md` |
| Skills | `skills/{name}/` | `SKILL.md`, optional `examples/` |
| Templates | `templates/{name}/` | `CLAUDE.md` |

---

## Current Content

### Context Files (6)

| File | Topics |
|------|--------|
| `now-assist-platform.md` | Platform architecture, APIs, configuration |
| `genai-framework.md` | GenAI Controller, skill invocation |
| `agentic-patterns.md` | Tool definitions, orchestration |
| `troubleshooting-guide.md` | Debug patterns, syslogs, common issues |
| `security-patterns.md` | ACLs, roles, secure coding |
| `performance-tuning.md` | Query optimization, caching, N+1 |

### Skills (6)

| Skill | Examples |
|-------|----------|
| `now-assist-skill-builder` | Manifest, testing, deployment |
| `api-integration` | Inbound/outbound patterns |
| `servicenow-troubleshooting` | Debug skill failure, performance |
| `agent-builder` | Incident triage agent |
| `testing-patterns` | Business rule tests |
| `deployment-automation` | Pipeline workflow |

### Templates (3)

| Template | Includes |
|----------|----------|
| `sparc-starter` | All context + all skills |
| `standard` | All context, no skills |
| `minimal` | CLAUDE.md only |

---

## Adding Context Files

### Using foundry_new (Recommended)

```
Create a new context file called "my-patterns"
```

### Manual Creation

```bash
touch context/my-patterns.md
```

### Required Structure

```markdown
# Topic Name

Brief overview (1-2 sentences).

---

## Overview

Detailed explanation of the topic.

## Key Concepts

### Concept 1
Explanation with context.

### Concept 2
More explanation.

## Code Examples

```javascript
// Working example
var gr = new GlideRecord('incident');
gr.query();
```

## Best Practices

1. Practice one
2. Practice two
3. Practice three

## Common Issues

| Issue | Solution |
|-------|----------|
| Problem X | Fix Y |

## Related Resources

- Link to other context
- External references

---

*Part of the Foundry golden repository*
```

### Validation Requirements

- **Minimum 50 words** of content
- **Has title** (# header)
- **No placeholders** (TODO, FIXME, "Add description here")
- **Working code examples**

---

## Creating Skills

### Using foundry_new (Recommended)

```
Create a new skill called "my-workflow"
```

### Manual Creation

```bash
mkdir -p skills/my-skill/examples
touch skills/my-skill/SKILL.md
```

### Required Structure

```markdown
# Skill Name

One-line description of what this skill teaches.

---

## Purpose

Use this skill when you need to:
- Task one
- Task two
- Task three

---

## Instructions

### Step 1: First Step

Detailed instructions for step one.

```javascript
// Code example
```

### Step 2: Second Step

Continue with clear guidance.

### Step 3: Continue...

---

## Examples

### Example 1: Basic Usage

Description of the scenario.

See `examples/basic-example.md` for implementation.

### Example 2: Advanced Usage

More complex scenario.

---

## Best Practices

1. Practice one
2. Practice two

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Doing X | Do Y instead |

---

## Related Resources

- [Related Skill](../related-skill/SKILL.md)
- [Related Context](../../context/related.md)

---

*Part of the Foundry golden repository*
```

### Skill Examples

Create in `examples/` directory:

```markdown
# Example: Scenario Name

Brief description of what this example demonstrates.

---

## Use Case

**Problem:** What problem does this solve?

**Solution:** How does this example address it?

---

## Implementation

```javascript
// Complete working code
```

---

## Testing

How to verify this works.

---

*Part of the {skill-name} skill*
```

---

## Building Templates

### Template Structure

```bash
mkdir -p templates/my-template
touch templates/my-template/CLAUDE.md
```

### Template Content

Use `{{PROJECT_NAME}}` for substitution:

```markdown
# {{PROJECT_NAME}}

## Project Overview

Add your project description here.

---

## Methodology

This project follows [methodology name].

### Phase 1: Planning
- Define requirements
- Identify stakeholders

### Phase 2: Implementation
- Build core features
- Integrate systems

### Phase 3: Validation
- Test functionality
- Get approval

---

## Context

This project has access to pre-loaded context in `.claude/context/`.

## Skills

Available skills in `.claude/skills/`.

---

## Guidelines

- Follow coding standards
- Document decisions
- Test thoroughly

---

## Notes

Add project-specific notes here.
```

### Template Settings

Define in `foundry-mcp/src/index.ts`:

```typescript
const templateSettings = {
  "my-template": { context: true, skills: false },
};
```

---

## Validation

### Before Promoting

Use `foundry_validate`:

```
Validate the my-patterns context file
```

### Validation Checks

- [ ] Minimum word count (50 words)
- [ ] Has title (# header)
- [ ] No placeholder text
- [ ] Working code examples
- [ ] No sensitive information
- [ ] Consistent formatting

---

## Promotion Workflow

### 1. Create Content

```
Create a new context file called "my-patterns"
```

### 2. Edit Content

Fill in the scaffold with real content.

### 3. Validate

```
Validate the my-patterns context file
```

### 4. Promote

```
Promote my-patterns to the golden repo with message "Add caching patterns"
```

### What Happens

1. Creates branch: `foundry/context/my-patterns-YYYYMMDD`
2. Copies content to golden repo
3. Creates PR with formatted description
4. Requires team review

---

## Testing Content

### Method 1: Local Project

```
Create a test POC using goldenPath /path/to/foundry-golden
```

### Method 2: Verify Files

```bash
cat context/my-patterns.md
ls -la skills/my-skill/
```

### Method 3: Search Test

```
Search Foundry for "keyword in my content"
```

---

## Quality Standards

### Code Examples

- Must be syntactically correct
- Include comments for complex logic
- Test before publishing

### Instructions

- Step-by-step and actionable
- Include expected outcomes
- Cover error cases

### Formatting

- Consistent markdown style
- Proper heading hierarchy
- Tables for structured data

---

## Maintenance

### Update Frequency

| Content | Review Cycle |
|---------|--------------|
| Context | Quarterly or on platform changes |
| Skills | As patterns evolve |
| Templates | Based on team feedback |

### Deprecating Content

Add deprecation notice:

```markdown
> **Deprecated**: This content is outdated. See [new-content.md] instead.
```

Keep file for reference, remove after transition.
