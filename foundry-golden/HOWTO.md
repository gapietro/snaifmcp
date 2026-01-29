# Foundry Golden Repository: How-To Guide

Guide for adding, updating, and maintaining content in the golden repository.

---

## Table of Contents

1. [Adding Context Files](#adding-context-files)
2. [Creating Skills](#creating-skills)
3. [Building Templates](#building-templates)
4. [Testing Your Content](#testing-your-content)
5. [Updating Existing Content](#updating-existing-content)
6. [Content Review Process](#content-review-process)

---

## Adding Context Files

Context files provide domain knowledge that Claude uses when working on projects.

### Step 1: Create the File

```bash
# Create a new context file
touch context/my-new-context.md
```

### Step 2: Write the Content

Follow this structure:

```markdown
# Topic Name

Brief overview of what this context covers.

## Key Concepts

### Concept 1
Explanation with examples...

### Concept 2
Explanation with examples...

## Common Patterns

### Pattern Name
```code
// Example implementation
```

**When to use:** Description of use case

**Gotchas:** Common mistakes to avoid

## API Reference (if applicable)

### Endpoint Name
- **URL**: `/api/endpoint`
- **Method**: POST
- **Parameters**: ...

## Best Practices

1. First best practice
2. Second best practice
3. Third best practice

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Error X | Reason | Fix |

## See Also

- Related documentation
- External references
```

### Step 3: Validate

1. Review for clarity and accuracy
2. Ensure code examples work
3. Check for sensitive information
4. Get team review

### Example: Context File

```markdown
# ServiceNow Table API

Context for working with ServiceNow's Table API.

## Overview

The Table API provides RESTful access to ServiceNow tables...

## Authentication

### Basic Auth
```javascript
const auth = Buffer.from(`${username}:${password}`).toString('base64');
headers['Authorization'] = `Basic ${auth}`;
```

### OAuth
```javascript
// OAuth flow example...
```

## Common Operations

### Query Records
```javascript
const response = await fetch(
  `${instance}/api/now/table/incident?sysparm_query=active=true`,
  { headers }
);
```

## Best Practices

1. Always use pagination for large result sets
2. Specify `sysparm_fields` to limit response size
3. Use `sysparm_display_value=true` for human-readable values
```

---

## Creating Skills

Skills teach Claude how to perform specific tasks with step-by-step guidance.

### Step 1: Create the Directory Structure

```bash
mkdir -p skills/my-new-skill/examples
touch skills/my-new-skill/SKILL.md
```

### Step 2: Write SKILL.md

```markdown
# Skill Name

One-line description of what this skill does.

## Overview

Detailed description of the skill's purpose and when to use it.

## Prerequisites

- Required knowledge
- Required access/permissions
- Required tools

## Instructions

### Step 1: First Step
Detailed instructions for the first step.

```code
// Example code if applicable
```

### Step 2: Second Step
Detailed instructions for the second step.

### Step 3: Continue...

## Examples

### Example 1: Basic Usage
Description of the example scenario.

See `examples/basic-example.js` for implementation.

### Example 2: Advanced Usage
Description of advanced scenario.

## Common Mistakes

1. **Mistake**: Description
   **Fix**: How to avoid/fix

2. **Mistake**: Description
   **Fix**: How to avoid/fix

## Validation

How to verify the skill was applied correctly:
- [ ] Check 1
- [ ] Check 2
- [ ] Check 3

## Related Skills

- Link to related skill
- Link to related context
```

### Step 3: Add Examples

Create working examples in the `examples/` directory:

```javascript
// examples/basic-example.js

/**
 * Basic Example: [Description]
 *
 * This example demonstrates...
 */

// Implementation here
```

### Step 4: Test the Skill

1. Create a test project with `foundry_init`
2. Ask Claude to use the skill
3. Verify the guidance is helpful
4. Iterate based on results

### Example: Complete Skill

```
skills/
└── data-import/
    ├── SKILL.md
    └── examples/
        ├── csv-import.js
        └── json-import.js
```

**SKILL.md:**
```markdown
# Data Import Skill

Import external data into ServiceNow tables.

## Overview

This skill guides you through importing data from various
formats (CSV, JSON, XML) into ServiceNow tables.

## Prerequisites

- ServiceNow instance with Table API access
- Source data file
- Target table identified

## Instructions

### Step 1: Analyze Source Data
First, examine your source data structure...

### Step 2: Map to Target Table
Create a mapping between source fields and target columns...

### Step 3: Transform Data
Apply any necessary transformations...

### Step 4: Import Records
Use the Table API to create records...

## Examples

### CSV Import
See `examples/csv-import.js` for a complete CSV import implementation.

### JSON Import
See `examples/json-import.js` for handling JSON data.
```

---

## Building Templates

Templates provide starting points for new projects.

### Step 1: Create the Directory

```bash
mkdir -p templates/my-template
touch templates/my-template/CLAUDE.md
```

### Step 2: Write the Template

Use `{{PROJECT_NAME}}` for project name substitution:

```markdown
# {{PROJECT_NAME}}

## Project Overview

[Describe your project here]

## Goals

- [ ] Goal 1
- [ ] Goal 2

## Methodology

### Phase 1: Planning
- Define requirements
- Identify stakeholders

### Phase 2: Implementation
- Build core features
- Integrate with ServiceNow

### Phase 3: Validation
- Test functionality
- Get stakeholder approval

## Resources

### Context
This project has access to pre-loaded context in `.claude/context/`:
- Now Assist platform documentation
- GenAI framework patterns
- Agentic development patterns

### Skills
Available skills in `.claude/skills/`:
- Now Assist Skill Builder
- API Integration

## Conventions

- Use TypeScript for implementation
- Follow ServiceNow best practices
- Document decisions in this file

## Notes

[Add project-specific notes here]
```

### Step 3: Test the Template

1. Run `foundry_init test-project`
2. Verify `{{PROJECT_NAME}}` is replaced
3. Check the template makes sense for new projects
4. Adjust based on feedback

---

## Testing Your Content

### Method 1: Create Test Project

```bash
# From the snaifmcp directory
cd foundry-mcp
npm test
```

This runs the acceptance tests against your golden repo content.

### Method 2: Manual Testing

1. Create a project pointing to local golden repo:
   ```
   In Claude Code: Create a POC called "test" using goldenPath /path/to/foundry-golden
   ```

2. Verify your content appears:
   ```bash
   cat test/.claude/context/your-new-file.md
   cat test/.claude/skills/your-skill/SKILL.md
   ```

3. Test with Claude:
   ```
   Using the [your context/skill], help me [task]
   ```

4. Clean up:
   ```bash
   rm -rf test/
   ```

### Method 3: Direct Validation

Check your content directly:

```bash
# Verify file exists and has content
cat context/my-new-context.md

# Check skill structure
ls -la skills/my-new-skill/
cat skills/my-new-skill/SKILL.md

# Verify template placeholder
grep "{{PROJECT_NAME}}" templates/my-template/CLAUDE.md
```

---

## Updating Existing Content

### When to Update

- Platform changes (new APIs, deprecated features)
- Team feedback (unclear instructions, missing info)
- New patterns discovered during POCs
- Bug fixes (incorrect examples, typos)

### Update Process

1. **Identify the change needed**
   ```bash
   # Find the file to update
   cat context/now-assist-platform.md
   ```

2. **Make the change**
   - Keep existing structure where possible
   - Add "Updated: YYYY-MM-DD" note for significant changes
   - Don't remove content without reason

3. **Test the change**
   - Run acceptance tests
   - Create test project
   - Verify with Claude

4. **Commit with clear message**
   ```bash
   git add context/now-assist-platform.md
   git commit -m "Update Now Assist context: add new API endpoint documentation"
   ```

### Deprecating Content

If content is no longer relevant:

1. Add deprecation notice at top:
   ```markdown
   > **Deprecated**: This content is outdated. See [new-content.md] instead.
   ```

2. Keep file for reference (don't delete immediately)

3. Remove from active use after transition period

---

## Content Review Process

### Self-Review Checklist

Before submitting content:

- [ ] **Accuracy**: Information is correct and current
- [ ] **Clarity**: Instructions are clear and actionable
- [ ] **Examples**: Code examples work correctly
- [ ] **Formatting**: Follows markdown conventions
- [ ] **Completeness**: Covers topic adequately
- [ ] **Security**: No sensitive information included

### Team Review

1. **Create PR/share for review**
   - Describe what you added/changed
   - Explain why it's needed

2. **Reviewer checks**
   - Technical accuracy
   - Alignment with existing content
   - Practical usefulness

3. **Address feedback**
   - Make requested changes
   - Discuss disagreements

4. **Merge when approved**

### Quality Standards

| Aspect | Standard |
|--------|----------|
| Code examples | Must be syntactically correct |
| Instructions | Must be testable/verifiable |
| Formatting | Consistent with existing content |
| Length | Comprehensive but not verbose |
| Updates | Note significant changes with dates |

---

## Quick Reference

### File Locations

| Content Type | Location | Required Files |
|--------------|----------|----------------|
| Context | `context/` | `*.md` |
| Skills | `skills/{name}/` | `SKILL.md`, optional `examples/` |
| Templates | `templates/{name}/` | `CLAUDE.md` |

### Placeholders

| Placeholder | Replaced With |
|-------------|---------------|
| `{{PROJECT_NAME}}` | User-provided project name |

### Commands

```bash
# Test content
cd ../foundry-mcp && npm test

# Create test project
# In Claude Code: Create POC using goldenPath /path/to/foundry-golden

# Check content
cat context/file.md
ls skills/skill-name/
```
