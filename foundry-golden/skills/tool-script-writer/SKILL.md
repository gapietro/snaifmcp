---
name: tool-script-writer
scope: project
recommended: false
version: 1.0.0
---
# Skill: Tool Script Writer

> Take a tool description and produce a complete, safe ServiceNow AI Agent tool script with GlideRecordSecure, input/output schemas, error handling, and naming conventions.

---

## Overview

This skill transforms a natural language tool description into a production-ready tool script for ServiceNow AI Agents. Every script produced follows the mandatory safety rules from `tool-script-rules.md` and uses patterns from `tool-script-cookbook.md`.

The output is a complete package: script + input schema + output schema + deployment configuration — ready to deploy via MCP.

## When to Use

Use this skill when:
- You need to create a new tool script for an AI agent
- You're converting a tool requirement from a solution spec into code
- You need to refactor an existing tool to follow safety rules
- You're building tools for voice agents (string-only I/O)

## Prerequisites

**CRITICAL:** Read these context files FIRST before writing any script:
1. `tool-script-rules.md` — Mandatory safety rules (forbidden APIs, GlideRecordSecure)
2. `tool-script-cookbook.md` — Tested patterns to base your script on
3. `servicenow-ai-data-model.md` — Table reference
4. `security-patterns.md` — ACL and role considerations

**MCP Tools Available:**
- `servicenow_script` — Test scripts in read-only mode
- `servicenow_query` — Verify tables and data exist
- `servicenow_aia_create` — Deploy the tool

---

## Instructions

### Step 1: Gather Tool Requirements (REQUIRED — DO NOT SKIP)

**STOP.** Before writing any code, clarify these questions with the user:

| # | Question | Default if Not Answered |
|---|----------|------------------------|
| 1 | **What should this tool do?** (one sentence) | — (required) |
| 2 | **Which tables does it access?** | — (required) |
| 3 | **Does it read, write, or both?** | Read-only |
| 4 | **What inputs does it need?** | Derive from description |
| 5 | **Is this for a voice agent?** | No |
| 6 | **What fields should be in the output?** | Derive from description |

### Step 2: Choose the Base Pattern

Select the closest pattern from the cookbook:

| Tool Purpose | Base Pattern | Cookbook Recipe # |
|-------------|-------------|-----------------|
| Get one record by ID/number | Get Single Record | Recipe 1 |
| Query multiple records | Query and Summarize | Recipe 2 |
| Create a new record | Create Record | Recipe 3 |
| Update existing record | Update Fields | Recipe 4 |
| Count/aggregate records | Query with Aggregation | Recipe 5 |
| Call external API | Call REST API | Recipe 6 |
| Read → decide → act | Chain Operations | Recipe 7 |
| Branch based on data | Conditional Logic | Recipe 8 |
| Voice-compatible tool | Voice-Compatible Script | Recipe 9 |
| Batch processing | Bulk Operations | Recipe 10 |
| Follow references | Reference Field Resolution | Recipe 11 |
| Time-based queries | Date-Based Filtering | Recipe 12 |

### Step 3: Write the Tool Script

Follow this exact structure:

```javascript
(function(inputs) {
    var outputs = {};
    try {
        // 1. VALIDATE INPUTS
        var requiredField = String(inputs.field_name || "").trim();
        if (!requiredField) {
            outputs.error = "field_name is required";
            outputs.status = "error";
            return outputs;
        }

        // 2. QUERY DATA (GlideRecordSecure + addUserEncodedQuery)
        var gr = new GlideRecordSecure('table_name');
        gr.addUserEncodedQuery();  // MANDATORY — enforces ACLs
        gr.addQuery('field', requiredField);
        gr.setLimit(N);  // MANDATORY — prevent unbounded queries
        gr.query();

        // 3. PROCESS RESULTS
        if (gr.next()) {
            outputs.data = {
                // Return only needed fields
            };
            outputs.status = "success";
        } else {
            outputs.error = "Record not found: " + requiredField;
            outputs.status = "not_found";
        }

    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Step 4: Write the Input Schema

```json
[
  {"name": "field_name", "type": "string", "mandatory": true, "description": "Clear description of this input"},
  {"name": "optional_field", "type": "string", "mandatory": false, "description": "Clear description"}
]
```

**Rules:**
- Every required input MUST have `mandatory: true`
- Use `string` type for voice agent tools (all inputs and outputs)
- Include clear `description` — the agent reads this to decide what to ask the user
- Keep inputs minimal — only what the script actually uses

### Step 5: Write the Output Schema

```json
[
  {"name": "status", "type": "string", "description": "success, error, or not_found"},
  {"name": "data", "type": "object", "description": "The result data"},
  {"name": "error", "type": "string", "description": "Error message if status is error"}
]
```

### Step 6: Run the Safety Checklist

Before deploying, verify EVERY item:

- [ ] **GlideRecordSecure** used (NOT GlideRecord)
- [ ] **addUserEncodedQuery()** called immediately after `new GlideRecordSecure()`
- [ ] **No `gs.*` calls** — no `gs.log`, `gs.getUserName`, `gs.getUserID`, `gs.info`, etc.
- [ ] **No `GlideDateTime`** — uses `new Date()` for dates
- [ ] **All inputs validated** with `String()` conversion
- [ ] **`setLimit()` called** on every query
- [ ] **`try/catch`** wraps the entire function
- [ ] **`outputs.status`** is always set (success, error, or not_found)
- [ ] **Tool name** uses `snake_case` (no CamelCase)
- [ ] **Input schema** has `mandatory: true` for required fields
- [ ] **Execution mode** is Supervised for writes, Autonomous for reads
- [ ] **Voice compatible** if for voice agents (string-only I/O)

**If ANY item fails, fix it before deploying.** Do not skip this checklist.

### Step 7: Test the Script

Use the `servicenow_script` MCP tool to test in read-only mode:

```
MCP call: servicenow_script
  script: "<your tool script>"
  readonly: true
```

Verify:
- Script executes without errors
- Output structure matches the output schema
- Data returned is correct

### Step 8: Deploy the Tool

Use dry-run first, then deploy:

```
MCP call: servicenow_aia_create
  type: "tool"
  name: "your_tool_name"
  description: "Clear description for the agent"
  script: "<your script>"
  input_schema: [...]
  output_schema: [...]
  execution_mode: "autonomous"  (or "supervised" for writes)
  dry_run: true  ← FIRST

Then repeat without dry_run to actually create.
```

### Step 9: Return the Deployment Report

Output this report to the orchestrator or user:

```
## Tool Deployment Report

**Tool Name:** [snake_case_name]
**sys_id:** [from deployment]
**Execution Mode:** [Autonomous/Supervised]
**Tables Accessed:** [list]

### Input Schema
| Name | Type | Mandatory | Description |
|------|------|-----------|-------------|
| ... | ... | ... | ... |

### Output Schema
| Name | Type | Description |
|------|------|-------------|
| ... | ... | ... |

### Test Results
- Script execution: [PASS/FAIL]
- Dry-run deployment: [PASS/FAIL]
- Live deployment: [PASS/FAIL]

### Safety Checklist
- GlideRecordSecure: PASS
- addUserEncodedQuery: PASS
- No forbidden APIs: PASS
- Input validation: PASS
- Error handling: PASS
```

---

## Validation Checklist

Before declaring this skill complete, verify:

- [ ] Script follows the exact structure from Step 3
- [ ] Input schema has all mandatory fields marked
- [ ] Safety checklist (Step 6) passes with no exceptions
- [ ] Script has been tested via `servicenow_script`
- [ ] Deployment report is complete

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Tool hangs, no response | Using `gs.log()` or `GlideDateTime` | Replace with allowed alternatives |
| "Access denied" or empty results | Missing `addUserEncodedQuery()` or user lacks roles | Add `addUserEncodedQuery()`, check user roles |
| Agent doesn't collect required input | `mandatory: true` missing from schema | Add `mandatory: true` to required inputs |
| Tool name rejected | CamelCase in tool name | Use `snake_case` only |
| Script error on insert/update | Using `GlideRecord` for mutations | Switch to `GlideRecordSecure` |

## Tips

- **Copy from the cookbook.** Don't write from scratch — adapt the closest recipe.
- **Less is more.** Return only the fields the agent needs, not every field on the record.
- **Validate inputs defensively.** Always use `String(inputs.x || "")` — inputs can be null.
- **Name tools for the agent.** The tool name and description are what the agent reads to decide when to use it. Make them clear and distinct.

---

*Skill designed for safe tool script production on ServiceNow Zurich. All patterns enforce GlideRecordSecure + addUserEncodedQuery() as mandatory.*
