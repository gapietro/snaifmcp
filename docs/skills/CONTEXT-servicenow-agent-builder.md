# ServiceNow Agent Builder - Reference Context

## Quick Reference Tables

### Tool Script API Compatibility

| API | Status | Alternative | Notes |
|-----|--------|-------------|-------|
| `new GlideRecord()` | ✅ Working | - | Primary database API |
| `gr.getValue()` | ✅ Working | - | Get raw field value |
| `gr.getDisplayValue()` | ✅ Working | - | Get display value |
| `gr.query()` | ✅ Working | - | Execute query |
| `gr.next()` | ✅ Working | - | Iterate results |
| `gr.get()` | ✅ Working | - | Get single record |
| `gr.addQuery()` | ✅ Working | - | Add filter |
| `gr.setLimit()` | ✅ Working | - | Limit results |
| `gr.update()` | ✅ Working | - | Save changes |
| `gr.insert()` | ✅ Working | - | Create record |
| `new GlideDateTime()` | ❌ Hangs | `new Date()` | Never use in tool scripts |
| `gs.getUserName()` | ❌ Hangs | Hardcode or input | Not available |
| `gs.getUserID()` | ❌ Hangs | Hardcode or input | Not available |
| `gs.getSessionID()` | ❌ Hangs | N/A | Not available |
| `gs.log()` | ❌ Hangs | Return in outputs | Use outputs for logging |
| `gs.print()` | ❌ Hangs | Return in outputs | Use outputs for logging |
| `gs.info()` | ❌ Hangs | Return in outputs | Use outputs for logging |

### Native JavaScript Equivalents

| ServiceNow API | Native JS Equivalent | Example |
|----------------|----------------------|---------|
| `new GlideDateTime()` | `new Date()` | `new Date().toISOString()` |
| `gs.getUserName()` | Pass as input | `inputs.currentUser` |
| `gs.getUserID()` | Pass as input | `inputs.currentUserId` |
| `gs.getSessionID()` | N/A | Not needed in tool scripts |
| `gs.log()` | Return values | `outputs.log = "message"` |

### GlideRecord Methods Reference

```javascript
// Query building
var gr = new GlideRecord('table_name');
gr.addQuery('field', 'value');                    // Equals
gr.addQuery('field', '!=', 'value');              // Not equals
gr.addQuery('field', 'CONTAINS', 'value');        // Contains
gr.addQuery('field', 'STARTSWITH', 'value');      // Starts with
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
```

## 8-Table Schema Reference

### Table 1: sn_aia_tool
```javascript
{
    sys_id: "pre-generated-16-char-hex",
    name: "Human-readable name",
    internal_name: "unique_internal_name",
    description: "What this tool does",
    active: true,
    script: "(function(inputs) { ... })(inputs)",
    input_schema: JSON.stringify([{
        name: "inputName",
        type: "string|number|boolean",
        mandatory: true|false
    }]),
    output_schema: JSON.stringify([{
        name: "outputName",
        type: "string|number|boolean|object"
    }])
}
```

### Table 2: sn_aia_agent_tool_m2m
```javascript
{
    agent: "agent_sys_id",
    tool: "tool_sys_id",
    active: true
}
```

### Table 3: sys_one_extend_capability
```javascript
{
    sys_id: "pre-generated",
    name: "Skill Display Name",
    description: "Skill description",
    type: "skill",
    active: true
}
```

### Table 4: sn_nowassist_skill_config
```javascript
{
    sys_id: "pre-generated",
    name: "Skill Name",
    description: "Description",
    active: true,
    skill_type: "agentic",
    capability: "capability_sys_id"
}
```

### Table 5: sys_generative_ai_config
```javascript
{
    sys_id: "pre-generated",
    name: "Config Name",
    active: true,
    prompt: "System prompt for LLM",
    model: "model_sys_id"
}
```

### Table 6: sys_one_extend_capability_definition
```javascript
{
    sys_id: "pre-generated",
    capability: "capability_sys_id",
    api: "api_name",
    api_type: "api_type",
    active: true
}
```

### Table 7: sys_one_extend_definition_config
```javascript
{
    definition: "definition_sys_id",
    default: true,
    active: true
}
```

### Table 8: sys_one_extend_definition_attribute
```javascript
{
    definition: "definition_sys_id",
    name: "attribute_name",
    type: "string|reference",
    value: "attribute_value"
}
```

## API Endpoints

### REST API Base URL
```
https://{instance}.service-now.com/api/now/table/{table_name}
```

### Common Endpoints

| Table | Endpoint | Method |
|-------|----------|--------|
| sn_aia_tool | `/api/now/table/sn_aia_tool` | GET, POST |
| sn_aia_agent | `/api/now/table/sn_aia_agent` | GET, POST |
| sn_aia_agent_tool_m2m | `/api/now/table/sn_aia_agent_tool_m2m` | GET, POST |
| sys_one_extend_capability | `/api/now/table/sys_one_extend_capability` | GET, POST |
| sn_nowassist_skill_config | `/api/now/table/sn_nowassist_skill_config` | GET, POST |
| sys_generative_ai_config | `/api/now/table/sys_generative_ai_config` | GET, POST |
| sys_one_extend_capability_definition | `/api/now/table/sys_one_extend_capability_definition` | GET, POST |
| sys_one_extend_definition_config | `/api/now/table/sys_one_extend_definition_config` | GET, POST |
| sys_one_extend_definition_attribute | `/api/now/table/sys_one_extend_definition_attribute` | GET, POST |
| incident | `/api/now/table/incident` | GET, POST, PUT, PATCH |

### Authentication
```bash
# Basic Auth
curl -u "username:password" \
  "https://instance.service-now.com/api/now/table/incident"

# With token
curl -H "Authorization: Bearer ${TOKEN}" \
  "https://instance.service-now.com/api/now/table/incident"
```

## Agent Strategy Details

### ReAct (Reasoning + Acting)
```
Loop:
  1. Reason about current state
  2. Choose tool to call
  3. Execute tool
  4. Observe result
  5. Repeat until goal achieved
```
**Best for:** Dynamic problem-solving, data investigation

### ReActive Planner
```
1. Plan entire workflow upfront
2. Execute steps sequentially
3. Return final result
```
**Best for:** Predictable multi-step processes
**Caution:** May skip tools if not configured properly

### Execution Modes

| Mode | Interaction | Use Case |
|------|-------------|----------|
| Copilot | Interactive | User asks agent for help |
| AutoPilot | Automated | Background processing |

## Input Schema Types

```javascript
// String
{
    name: "description",
    type: "string",
    mandatory: true
}

// Number
{
    name: "priority",
    type: "number",
    mandatory: false
}

// Boolean
{
    name: "urgent",
    type: "boolean",
    mandatory: false
}

// Array
{
    name: "incidents",
    type: "array",
    items: { type: "string" }
}

// Object
{
    name: "incident",
    type: "object",
    properties: {
        number: { type: "string" },
        priority: { type: "number" }
    }
}
```

## Common Tool Script Templates

### Template 1: Get Single Record
```javascript
(function(inputs) {
    var outputs = {};
    try {
        var recordId = String(inputs.record_id || "");
        var gr = new GlideRecord('incident');
        
        if (gr.get('number', recordId)) {
            outputs.record = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                description: gr.getValue('description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority'),
                urgency: gr.getDisplayValue('urgency'),
                impact: gr.getDisplayValue('impact'),
                category: gr.getDisplayValue('category'),
                subcategory: gr.getDisplayValue('subcategory'),
                caller: gr.getDisplayValue('caller_id'),
                assigned_to: gr.getDisplayValue('assigned_to'),
                opened_at: gr.getValue('opened_at'),
                updated_at: gr.getValue('sys_updated_on')
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

### Template 2: Query Multiple Records
```javascript
(function(inputs) {
    var outputs = {};
    try {
        var state = String(inputs.state || "active");
        var limit = Math.min(parseInt(inputs.limit || 10), 100);
        
        var gr = new GlideRecord('incident');
        
        if (state === "active") {
            gr.addActiveQuery();
        } else {
            gr.addQuery('state', state);
        }
        
        gr.setLimit(limit);
        gr.orderByDesc('sys_updated_on');
        gr.query();
        
        outputs.records = [];
        while (gr.next()) {
            outputs.records.push({
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority'),
                assigned_to: gr.getDisplayValue('assigned_to'),
                updated_at: gr.getValue('sys_updated_on')
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

### Template 3: Update Record
```javascript
(function(inputs) {
    var outputs = {};
    try {
        var incidentNumber = String(inputs.incident_number || "");
        var updates = inputs.updates || {};
        
        var gr = new GlideRecord('incident');
        if (!gr.get('number', incidentNumber)) {
            outputs.error = "Incident not found: " + incidentNumber;
            outputs.status = "not_found";
            return outputs;
        }
        
        // Apply updates
        if (updates.state) gr.setValue('state', updates.state);
        if (updates.priority) gr.setValue('priority', updates.priority);
        if (updates.assigned_to) gr.setValue('assigned_to', updates.assigned_to);
        if (updates.work_notes) gr.setValue('work_notes', updates.work_notes);
        
        gr.update();
        
        outputs.incident_number = incidentNumber;
        outputs.updated_fields = Object.keys(updates);
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

### Template 4: Create Record
```javascript
(function(inputs) {
    var outputs = {};
    try {
        var gr = new GlideRecord('incident');
        gr.initialize();
        
        gr.setValue('short_description', String(inputs.short_description || ""));
        gr.setValue('description', String(inputs.description || ""));
        gr.setValue('caller_id', String(inputs.caller_id || ""));
        gr.setValue('category', String(inputs.category || ""));
        gr.setValue('subcategory', String(inputs.subcategory || ""));
        
        if (inputs.priority) {
            gr.setValue('priority', inputs.priority);
        }
        if (inputs.urgency) {
            gr.setValue('urgency', inputs.urgency);
        }
        if (inputs.impact) {
            gr.setValue('impact', inputs.impact);
        }
        
        var newId = gr.insert();
        
        outputs.sys_id = newId;
        outputs.number = gr.getValue('number');
        outputs.status = "success";
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = "error";
    }
    return outputs;
})(inputs);
```

## Error Handling Patterns

### Standard Error Output
```javascript
{
    status: "error",
    error: "Descriptive error message",
    error_type: "not_found|validation|system",
    details: {}  // Optional additional context
}
```

### Standard Success Output
```javascript
{
    status: "success",
    data: {},  // Response data
    metadata: {
        timestamp: "2026-02-06T15:30:00Z",
        execution_time_ms: 143
    }
}
```

## Testing Commands

```bash
# Test tool via REST API
curl -X POST \
  -u "admin:password" \
  -H "Content-Type: application/json" \
  -d '{"inputs": {"incident_number": "INC0010001"}}' \
  "https://instance.service-now.com/api/now/table/sn_aia_tool/{tool_sys_id}/execute"

# Query agent executions
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent_execution?sysparm_limit=10"

# Query tool executions
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_tool_execution?sysparm_limit=10"
```

## Useful System Properties

| Property | Description |
|----------|-------------|
| `glide.servlet.uri` | Instance base URL |
| `sn_aia.log.level` | AI Agent logging level |
| `sn_aia.max_tokens` | Max LLM tokens |
| `sn_aia.timeout` | Agent execution timeout |

---

*Keep this reference handy when building ServiceNow agents.*
