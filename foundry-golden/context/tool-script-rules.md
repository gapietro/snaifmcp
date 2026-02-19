# Tool Script Rules — ServiceNow AI Agents (Zurich)

> Critical rules for writing tool scripts that run inside the ServiceNow AI Agent framework. Violating these rules causes **silent hangs**, **security violations**, or **runtime failures** with no error messages.

---

## All 13 Tool Types in Zurich

ServiceNow Zurich supports 13 distinct tool types for AI Agents. Most rules in this document focus on **Script** tools, but understanding all types is essential for choosing the right approach.

| Tool Type | Description | Key Notes |
|-----------|-------------|-----------|
| **Script** | Custom editable scripts and APIs | GlideRecordSecure mandatory, not GlideRecord |
| **Catalog item** | Service catalog items | Links to existing catalog items |
| **Conversational topic** | VA conversation topics | Links to Virtual Agent topics |
| **Desktop action** | Actions on workspace | Workspace-specific actions |
| **File upload** | PDF, DOCX, TXT files | For voice agents too |
| **Flow action** | IntegrationHub spoke actions | Links to existing flow actions |
| **Knowledge graph** | Knowledge retrieval | Uses knowledge graphs |
| **Now Assist skill** | Invoke Now Assist skills | References existing skills |
| **Record operation** | CRUD on ServiceNow tables | Standard table operations |
| **Search retrieval** | Text search across sources | Use dedicated search profile for voice to reduce latency |
| **Subflow** | Execute subflows | Links to existing subflows |
| **Web search** | Internet search | NOT supported by Azure OpenAI |
| **MCP server tool** | External MCP server tools | Requires `sn_aia.enable_mcp_tool = true` |

### Choosing the Right Tool Type

- **Script** — Use when you need custom logic, conditional branching, or complex data transformations that cannot be achieved by other tool types.
- **Record operation** — Prefer over Script for simple CRUD (create, read, update, delete) on a single table. No code required.
- **Flow action / Subflow** — Use when the logic already exists in IntegrationHub or Flow Designer. Avoids duplicating code.
- **Search retrieval** — Use for text-based search across knowledge bases, catalogs, or custom tables. For voice agents, configure a dedicated search profile to reduce latency.
- **Knowledge graph** — Use for structured knowledge retrieval where relationships between articles matter.
- **File upload** — Use when the agent needs to accept or process uploaded files (PDF, DOCX, TXT).
- **MCP server tool** — Use for integrating external MCP servers. Must enable `sn_aia.enable_mcp_tool = true` in system properties.
- **Web search** — Use for internet search capabilities. Note: **NOT supported** when using Azure OpenAI as the LLM provider.

---

## Tool Naming Rules

### CRITICAL: CamelCase is Forbidden for Tool Names

The `internal_name` of a tool must use **snake_case**. CamelCase will cause failures.

```
get_incident_details      (snake_case)
getIncidentDetails        (CamelCase - FORBIDDEN)

lookup_user_by_email      (snake_case)
lookupUserByEmail         (CamelCase - FORBIDDEN)

create_change_request     (snake_case)
createChangeRequest       (CamelCase - FORBIDDEN)
```

---

## Execution Modes

Each tool has an `execution_mode` that controls whether human approval is required before the tool runs.

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Supervised** | Requires human approval before execution | Destructive operations (update, delete), sensitive data access, external API calls |
| **Autonomous** | Executes without human approval | Read-only operations, safe queries, lookups |

### Guidelines

- **Default to Supervised** for any tool that modifies data (insert, update, delete).
- **Use Autonomous** only for read-only tools that return non-sensitive data.
- When in doubt, use Supervised. It is always safer to require approval.

---

## Platform Limits

These system properties control agent and tool behavior. Exceeding them causes errors or throttling.

| Limit | Default Value | System Property |
|-------|---------------|-----------------|
| Max tools per agent | 20 | `sn_aia.maximum_agent_tools` |
| Max consecutive same-tool executions | 7 | `sn_aia.continuous_tool_execution_limit` |
| Max continuous communicator outputs | 3 | `sn_aia.continuous_communicator_output_limit` |
| Max retries on failure | 3 | `sn_aia.react_failure_retry_max_limit` |
| Tool execution record expiry | 13 months | (automatic, not configurable) |

### Implications for Tool Design

- If your agent needs more than 20 tools, split into multiple specialized agents.
- If a tool is called 7 times in a row, the agent will stop. Design tools to return complete data in fewer calls.
- Tool execution records are automatically purged after 13 months. Plan any audit or reporting accordingly.

---

## Voice Agent Considerations

When building tools for **voice agents**, input and output data types **must be string** for optimal experience. Voice channels cannot render complex objects, arrays, or nested structures.

```javascript
// For voice agents - inputs and outputs must be string type
[{"name": "incident_number", "type": "string", "mandatory": true}]

// For voice agents - output should be a flat string
outputs.result = "Incident INC0010001 is currently In Progress, priority 2.";
```

For **Search retrieval** tools used by voice agents, configure a **dedicated search profile** to reduce latency. Voice interactions are time-sensitive and cannot tolerate slow search responses.

---

## Rule 1: FORBIDDEN APIs (Cause Silent Hangs)

These APIs **hang indefinitely** when called from tool scripts. There is no error, no timeout, no log — the tool simply never returns.

| Forbidden API | What Happens | Use Instead |
|---------------|-------------|-------------|
| `new GlideDateTime()` | Hangs forever | `new Date()` |
| `gs.getUserName()` | Hangs forever | Pass as tool input |
| `gs.getUserID()` | Hangs forever | Pass as tool input |
| `gs.getSessionID()` | Hangs forever | Not needed |
| `gs.log()` | Hangs forever | `outputs.log = "message"` |
| `gs.print()` | Hangs forever | Return in outputs |
| `gs.info()` | Hangs forever | Return in outputs |
| `gs.error()` | Hangs forever | `outputs.error = "message"` |
| `gs.debug()` | Hangs forever | Return in outputs |
| `gs.warn()` | Hangs forever | Return in outputs |

**Bottom line:** Never use `gs.*` or `GlideDateTime` in tool scripts.

---

## Rule 2: GlideRecordSecure is MANDATORY (Security)

### CRITICAL: Use GlideRecordSecure, NOT GlideRecord

In Zurich, **GlideRecordSecure** is the required pattern for all AI Agent tool scripts. GlideRecord technically works but **bypasses ACL enforcement**, creating a security vulnerability where the agent can access data the user is not authorized to see.

```javascript
// WRONG for AI agent scripts — bypasses user permissions
var gr = new GlideRecord('incident');
gr.addQuery('priority', 1);
gr.query();

// REQUIRED for AI agent scripts — enforces user permissions
var gr = new GlideRecordSecure('incident');
gr.addUserEncodedQuery();  // ALSO REQUIRED — enforces ACLs of the executing user
gr.addQuery('priority', 1);
gr.query();
```

### Why Both GlideRecordSecure AND addUserEncodedQuery()?

| Method | What It Does |
|--------|-------------|
| `GlideRecordSecure` | Enforces field-level ACLs — prevents reading fields the user cannot see |
| `addUserEncodedQuery()` | Enforces row-level ACLs — prevents returning records the user cannot access |

**Both are required together.** Using only one leaves a gap:
- `GlideRecordSecure` without `addUserEncodedQuery()` — user might see records they should not access (row-level gap)
- `addUserEncodedQuery()` on plain `GlideRecord` — user might see field values they should not read (field-level gap)

### GlideRecordSecure — Full API Reference

GlideRecordSecure has the same API as GlideRecord. All query methods work identically:

```javascript
// Query building
var gr = new GlideRecordSecure('table_name');
gr.addUserEncodedQuery();                         // ALWAYS call this first
gr.addQuery('field', 'value');                    // Equals
gr.addQuery('field', '!=', 'value');              // Not equals
gr.addQuery('field', 'CONTAINS', 'value');        // Contains
gr.addQuery('field', 'STARTSWITH', 'value');       // Starts with
gr.addQuery('field', '>', 100);                   // Greater than
gr.addQuery('field', 'IN', 'val1,val2,val3');     // In list
gr.addActiveQuery();                              // active = true
gr.addNullQuery('field');                         // IS NULL
gr.addNotNullQuery('field');                      // IS NOT NULL
gr.setLimit(100);                                 // Limit results
gr.orderBy('field');                              // ASC order
gr.orderByDesc('field');                          // DESC order

// Execution
gr.query();                                       // Execute query
gr.hasNext();                                     // Check if results exist

// Record traversal
while (gr.next()) {
    // Process record
}

// Single record fetch
gr.get('sys_id', 'specific-sys-id');              // By sys_id
gr.get('number', 'INC0010001');                   // By field

// Field access
gr.getValue('field_name');                        // Raw value
gr.getDisplayValue('field_name');                 // Display value
gr.getElement('field_name');                      // GlideElement

// Related records
gr.caller_id.getDisplayValue();                   // Reference field display
gr.assigned_to.sys_id.toString();                 // Reference sys_id

// Mutations (use with Supervised execution mode)
gr.setValue('field', 'value');                     // Set field
gr.update();                                      // Save changes
gr.insert();                                      // Create record
gr.initialize();                                  // Prepare for insert
```

### Native JavaScript — Always Safe

```javascript
new Date().toISOString();           // Current timestamp
new Date().toLocaleDateString();    // Formatted date
Date.now();                         // Unix timestamp
String(value);                      // Type conversion
Number(value);                      // Type conversion
JSON.parse(jsonString);             // Parse JSON
JSON.stringify(object);             // Serialize JSON
Math.min(a, b);                     // Math operations
parseInt(str, 10);                  // Parse integer
```

---

## Rule 3: Input Schema MUST Include "mandatory"

Without `mandatory: true`, the agent may skip collecting required inputs, leading to null values.

```javascript
// BROKEN - Agent may skip this input
[{"name": "incident_number", "type": "string"}]

// CORRECT - Forces agent to collect this input
[{"name": "incident_number", "type": "string", "mandatory": true}]
```

### Supported Schema Types

| Type | Example |
|------|---------|
| `string` | `{"name": "message", "type": "string", "mandatory": true}` |
| `number` | `{"name": "priority", "type": "number", "mandatory": false}` |
| `boolean` | `{"name": "urgent", "type": "boolean", "mandatory": false}` |
| `array` | `{"name": "items", "type": "array", "items": {"type": "string"}}` |
| `object` | `{"name": "data", "type": "object", "properties": {...}}` |

**Voice agent note:** For voice agents, use `string` type for all inputs and outputs to ensure compatibility.

---

## Rule 4: Always Include Error Handling

Every tool script must follow this pattern:

```javascript
(function(inputs) {
    var outputs = {};
    try {
        // Your logic here
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Standard Error Output Format

```javascript
{
    status: "error",
    error: "Descriptive error message",
    error_type: "not_found|validation|system"
}
```

### Standard Success Output Format

```javascript
{
    status: "success",
    data: {},  // Response data
}
```

---

## Rule 5: Performance

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Simple tool | < 100ms | < 500ms |
| GlideRecordSecure query | < 200ms | < 1s |
| Agent with 1 tool | < 500ms | < 2s |
| Agent with 3 tools | < 2s | < 5s |

**Always use `gr.setLimit()`** to prevent unbounded queries.

**Note:** GlideRecordSecure has a slight overhead compared to GlideRecord due to ACL checking. This is expected and acceptable — security takes precedence over micro-optimization.

---

## Common Tool Script Templates

### Get Single Record

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var recordId = String(inputs.incident_number || "");
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', recordId);
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.record = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority')
            };
            outputs.status = "success";
        } else {
            outputs.error = "Record not found: " + recordId;
            outputs.status = "not_found";
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Query Multiple Records

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var limit = Math.min(parseInt(inputs.limit || 10), 100);
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addActiveQuery();
        gr.setLimit(limit);
        gr.orderByDesc('sys_updated_on');
        gr.query();

        outputs.records = [];
        while (gr.next()) {
            outputs.records.push({
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority')
            });
        }
        outputs.count = outputs.records.length;
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Update Record (Supervised Execution Mode)

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incidentNumber = String(inputs.incident_number || "");
        var updates = inputs.updates || {};

        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        if (!gr.get('number', incidentNumber)) {
            outputs.error = "Incident not found: " + incidentNumber;
            outputs.status = "not_found";
            return outputs;
        }

        var updatedFields = [];
        if (updates.state) { gr.setValue('state', updates.state); updatedFields.push('state'); }
        if (updates.priority) { gr.setValue('priority', updates.priority); updatedFields.push('priority'); }
        if (updates.work_notes) { gr.setValue('work_notes', updates.work_notes); updatedFields.push('work_notes'); }

        gr.update();
        outputs.updated_fields = updatedFields;
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Voice-Compatible Tool (String-Only I/O)

```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incidentNumber = String(inputs.incident_number || "");
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', incidentNumber);
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.result = "Incident " + gr.getValue('number') +
                " is currently " + gr.getDisplayValue('state') +
                " with priority " + gr.getDisplayValue('priority') +
                ". Short description: " + gr.getValue('short_description');
            outputs.status = "success";
        } else {
            outputs.result = "No incident found with number " + incidentNumber;
            outputs.status = "not_found";
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

---

## Security Best Practices

1. **Use GlideRecordSecure + addUserEncodedQuery()** in every script tool — this is mandatory, not optional
2. **Never hardcode credentials** in tool scripts
3. **Validate all inputs** before database operations
4. **Use setLimit()** to prevent unbounded queries
5. **Set execution_mode to Supervised** for any tool that modifies data
6. **Sanitize user inputs** to prevent injection — use `String()` on all inputs
7. **Use HTTPS** for any external API calls
8. **Respect the 20-tool limit** per agent — split agents if necessary
9. **Use snake_case** for all tool internal names — CamelCase is forbidden
10. **For voice agents**, restrict input/output types to string

### Migration Checklist: GlideRecord to GlideRecordSecure

If you have existing tool scripts using `GlideRecord`, update them:

1. Replace `new GlideRecord(` with `new GlideRecordSecure(`
2. Add `gr.addUserEncodedQuery();` immediately after instantiation
3. Test that the tool still returns expected results for the user's role
4. Verify that users without access to certain records no longer see them

```javascript
// BEFORE (insecure)
var gr = new GlideRecord('incident');
gr.addQuery('priority', 1);
gr.query();

// AFTER (secure)
var gr = new GlideRecordSecure('incident');
gr.addUserEncodedQuery();
gr.addQuery('priority', 1);
gr.query();
```

---

## Quick Reference Card

| Topic | Rule |
|-------|------|
| Database API | GlideRecordSecure + addUserEncodedQuery() (mandatory) |
| Forbidden APIs | gs.*, GlideDateTime (cause silent hangs) |
| Tool naming | snake_case only, no CamelCase |
| Input schema | Always include `mandatory: true` for required fields |
| Error handling | try/catch with status in every script |
| Execution mode | Supervised for writes, Autonomous for reads |
| Max tools | 20 per agent |
| Max same-tool calls | 7 consecutive |
| Voice agents | String-only inputs and outputs |
| Performance | Always use setLimit() |

---

*Validated against ServiceNow Zurich instances. The gs.* hang behavior is a known platform characteristic of the AI Agent tool execution sandbox. GlideRecordSecure enforcement is a Zurich security requirement for all AI Agent tool scripts.*
