# Foundry Content Writing Guide

Standards and conventions for writing content in the golden repository.

---

## General Principles

### Write for Claude

Remember that Claude Code will read this content to help users. Write content that:

1. **Is actionable** - Provide clear steps, not just concepts
2. **Includes examples** - Show, don't just tell
3. **Anticipates questions** - Cover common edge cases
4. **Is current** - Keep updated with platform changes

### Write for Humans Too

Team members will also read and maintain this content:

1. **Use clear structure** - Headings, lists, tables
2. **Be scannable** - Key info visible at a glance
3. **Stay consistent** - Follow established patterns
4. **Document decisions** - Explain why, not just what

---

## Markdown Conventions

### Headings

```markdown
# Document Title (H1) - One per file

## Major Section (H2)

### Subsection (H3)

#### Minor Subsection (H4) - Use sparingly
```

### Code Blocks

Always specify language for syntax highlighting:

```markdown
```javascript
// JavaScript code
const example = "value";
```

```typescript
// TypeScript code
const example: string = "value";
```

```bash
# Shell commands
npm install
```

```json
{
  "key": "value"
}
```
```

### Tables

Use tables for structured information:

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
| Value 4  | Value 5  | Value 6  |
```

### Lists

Use bullet points for unordered items:
```markdown
- Item one
- Item two
- Item three
```

Use numbered lists for sequential steps:
```markdown
1. First step
2. Second step
3. Third step
```

### Callouts

Use blockquotes for important notes:

```markdown
> **Note**: Important information here.

> **Warning**: Caution about something.

> **Tip**: Helpful suggestion.
```

---

## Context File Structure

### Standard Template

```markdown
# [Topic Name]

[One paragraph overview - what this covers and why it matters]

## Overview

[Expanded explanation of the topic, 2-3 paragraphs]

## Key Concepts

### [Concept 1]

[Explanation with examples]

### [Concept 2]

[Explanation with examples]

## Patterns

### [Pattern Name]

**Use case**: When to use this pattern

**Implementation**:
```code
// Example
```

**Considerations**: Things to keep in mind

## API Reference

### [Endpoint/Method Name]

- **Purpose**: What it does
- **URL/Signature**: How to call it
- **Parameters**: What it accepts
- **Returns**: What it returns
- **Example**:
```code
// Usage example
```

## Best Practices

1. **[Practice 1]**: Explanation
2. **[Practice 2]**: Explanation
3. **[Practice 3]**: Explanation

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| [Problem] | [Why it happens] | [How to fix] |

## Related Resources

- [Link to related context]
- [Link to external docs]
```

### Example: Well-Structured Context

```markdown
# ServiceNow REST API

This context covers the ServiceNow REST API for table operations,
authentication, and common integration patterns.

## Overview

ServiceNow provides a comprehensive REST API for interacting with
platform data. The Table API is the most commonly used endpoint
for CRUD operations on any table.

## Key Concepts

### Tables and Records

ServiceNow stores data in tables. Each row is a record with a
unique `sys_id`. The Table API provides access to any table
the authenticated user can access.

### GlideRecord vs REST

- **GlideRecord**: Server-side scripting within ServiceNow
- **REST API**: External access from other systems

## Patterns

### Query with Pagination

**Use case**: Retrieving large datasets efficiently

**Implementation**:
```javascript
async function getAllRecords(table, query) {
  const limit = 100;
  let offset = 0;
  let allRecords = [];

  while (true) {
    const response = await fetch(
      `${instance}/api/now/table/${table}?` +
      `sysparm_query=${query}&` +
      `sysparm_limit=${limit}&` +
      `sysparm_offset=${offset}`
    );
    const data = await response.json();

    allRecords = allRecords.concat(data.result);

    if (data.result.length < limit) break;
    offset += limit;
  }

  return allRecords;
}
```

**Considerations**:
- Respect rate limits
- Consider using async iteration for memory efficiency
```

---

## Skill File Structure

### SKILL.md Template

```markdown
# [Skill Name]

[One-line description of what this skill enables]

## Overview

[2-3 paragraphs explaining:
- What the skill does
- When to use it
- What you'll learn/accomplish]

## Prerequisites

- [Required knowledge]
- [Required access/tools]
- [Required setup]

## Instructions

### Step 1: [Action Verb] [Object]

[Detailed instructions]

```code
// Example if applicable
```

> **Note**: Important consideration for this step

### Step 2: [Action Verb] [Object]

[Detailed instructions]

### Step 3: [Continue pattern...]

## Examples

### Example 1: [Scenario Name]

[Brief description of the scenario]

**Goal**: What we're trying to achieve

**Approach**: How we'll do it

See `examples/[filename]` for complete implementation.

## Validation

Verify your implementation:

- [ ] [Checkpoint 1]
- [ ] [Checkpoint 2]
- [ ] [Checkpoint 3]

## Troubleshooting

### [Problem 1]

**Symptoms**: What you see

**Cause**: Why it happens

**Solution**: How to fix it

## Next Steps

After completing this skill, you might want to:
- [Related task 1]
- [Related task 2]
```

### Writing Good Instructions

**Do:**
- Start steps with action verbs (Create, Configure, Add, Run)
- Be specific about what to do
- Include expected outcomes
- Provide code examples

**Don't:**
- Be vague ("Set up the thing")
- Assume prior knowledge without stating prerequisites
- Skip steps that seem obvious
- Leave out error handling

### Example: Well-Written Skill

```markdown
# Create a Now Assist Summarization Skill

Build a custom Now Assist skill that summarizes incident descriptions.

## Overview

This skill walks you through creating a summarization skill for
Now Assist. You'll learn the skill manifest structure, implementation
pattern, and deployment process.

By the end, you'll have a working skill that can summarize any
incident's description field into 2-3 sentences.

## Prerequisites

- ServiceNow instance with Now Assist enabled
- Admin or skill_admin role
- Basic understanding of ServiceNow scripting

## Instructions

### Step 1: Create the Skill Record

Navigate to **Now Assist > Skills** and click **New**.

Fill in the basic information:
- **Name**: Incident Summarizer
- **Description**: Summarizes incident descriptions
- **Category**: Productivity

### Step 2: Define the Input Schema

In the **Input Schema** field, add:

```json
{
  "type": "object",
  "properties": {
    "incident_sys_id": {
      "type": "string",
      "description": "Sys ID of the incident to summarize"
    }
  },
  "required": ["incident_sys_id"]
}
```

This tells Now Assist what data the skill needs.

### Step 3: Implement the Skill Logic

In the **Script** field:

```javascript
(function execute(inputs, outputs) {
  var gr = new GlideRecord('incident');
  if (gr.get(inputs.incident_sys_id)) {
    var description = gr.getValue('description');

    // Call GenAI to summarize
    var summary = sn_genai.summarize(description, {
      maxLength: 100,
      style: 'concise'
    });

    outputs.summary = summary;
  }
})(inputs, outputs);
```

> **Note**: The `sn_genai.summarize()` function is a simplified
> example. See GenAI framework context for actual API.
```

---

## Template Conventions

### Using Placeholders

Available placeholders:

| Placeholder | Replaced With | Example |
|-------------|---------------|---------|
| `{{PROJECT_NAME}}` | Project name from init | `my-poc` |

### Template Structure

```markdown
# {{PROJECT_NAME}}

## Project Overview

[Instructions for user to fill in]

## Methodology

[Your methodology structure]

## Resources

### Pre-loaded Context
- `.claude/context/now-assist-platform.md` - Now Assist docs
- `.claude/context/genai-framework.md` - GenAI patterns

### Available Skills
- `.claude/skills/now-assist-skill-builder/` - Create skills
- `.claude/skills/api-integration/` - API patterns

## Conventions

[Project conventions to follow]
```

---

## Code Example Standards

### JavaScript/TypeScript

```javascript
/**
 * Brief description of what this code does.
 *
 * @param {string} param1 - Description of param1
 * @returns {Promise<Object>} Description of return value
 */
async function exampleFunction(param1) {
  // Implementation with comments explaining non-obvious parts
  const result = await someOperation(param1);

  // Handle edge cases
  if (!result) {
    throw new Error('Descriptive error message');
  }

  return result;
}
```

### Include Error Handling

Always show how to handle errors:

```javascript
try {
  const data = await fetchData();
  processData(data);
} catch (error) {
  console.error('Failed to fetch data:', error.message);
  // Show recovery or fallback
}
```

### Show Real-World Usage

```javascript
// Real example with actual ServiceNow patterns
const incident = await fetch(
  `${instance}/api/now/table/incident/${sysId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
```

---

## Quality Checklist

Before submitting content, verify:

### Accuracy
- [ ] Technical information is correct
- [ ] Code examples are syntactically valid
- [ ] API references match current platform

### Clarity
- [ ] Purpose is clear from the title/intro
- [ ] Instructions are step-by-step
- [ ] Jargon is explained or avoided

### Completeness
- [ ] Prerequisites are listed
- [ ] Common errors are addressed
- [ ] Examples cover main use cases

### Formatting
- [ ] Headings follow hierarchy
- [ ] Code blocks have language specified
- [ ] Tables are properly formatted
- [ ] Links work correctly

### Maintenance
- [ ] No hardcoded values that will change
- [ ] Version-specific info is noted
- [ ] Update process is clear
