# Agent Builder Skill

This skill teaches Claude how to design and build AI Agents using ServiceNow's Agentic framework.

---

## Purpose

Use this skill when you need to:
- Design new AI Agents for automation
- Configure agent tools and capabilities
- Define agent workflows and decision logic
- Integrate agents with ServiceNow processes

---

## AI Agent Architecture

### Components

| Component | Purpose |
|-----------|---------|
| **Agent** | Orchestrates tasks using tools and reasoning |
| **Tools** | Discrete capabilities the agent can invoke |
| **Context** | Information available to the agent |
| **Guardrails** | Safety constraints and limits |

### Agent Lifecycle

1. **Receive Input** - User request or trigger event
2. **Plan** - Determine approach using available tools
3. **Execute** - Invoke tools to accomplish tasks
4. **Evaluate** - Check results and decide next steps
5. **Respond** - Return results to user/system

---

## Designing an Agent

### Step 1: Define the Use Case

Ask these questions:
- What problem does this agent solve?
- Who will use it and how?
- What data/systems does it need to access?
- What actions should it be able to take?

### Step 2: Identify Required Tools

Common tool categories:
- **Query Tools** - Read data from tables
- **Action Tools** - Create, update, delete records
- **Integration Tools** - Call external systems
- **Utility Tools** - Calculations, formatting, etc.

### Step 3: Define Guardrails

Safety considerations:
- What actions should never be allowed?
- What confirmation is required for mutations?
- What data should be restricted?
- What are the rate/volume limits?

### Step 4: Design the Workflow

Consider:
- Happy path flow
- Error handling
- Edge cases
- Escalation paths

---

## Tool Design Patterns

### Query Tool

```javascript
{
    name: 'get_incidents',
    description: 'Retrieve incidents based on criteria',
    parameters: {
        priority: { type: 'string', enum: ['1', '2', '3', '4', '5'] },
        state: { type: 'string' },
        limit: { type: 'number', default: 10 }
    },
    execute: function(params) {
        var gr = new GlideRecord('incident');
        if (params.priority) {
            gr.addQuery('priority', params.priority);
        }
        if (params.state) {
            gr.addQuery('state', params.state);
        }
        gr.setLimit(params.limit || 10);
        gr.query();

        var results = [];
        while (gr.next()) {
            results.push({
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                priority: gr.getValue('priority'),
                state: gr.getDisplayValue('state')
            });
        }
        return results;
    }
}
```

### Action Tool

```javascript
{
    name: 'update_incident',
    description: 'Update an incident record',
    parameters: {
        incident_id: { type: 'string', required: true },
        fields: { type: 'object', description: 'Fields to update' }
    },
    confirmation_required: true,  // Guardrail
    execute: function(params) {
        var gr = new GlideRecord('incident');
        if (!gr.get(params.incident_id)) {
            return { success: false, error: 'Incident not found' };
        }

        // Apply updates
        for (var field in params.fields) {
            if (gr.isValidField(field)) {
                gr.setValue(field, params.fields[field]);
            }
        }

        gr.update();
        return {
            success: true,
            number: gr.getValue('number'),
            updated_fields: Object.keys(params.fields)
        };
    }
}
```

### Integration Tool

```javascript
{
    name: 'check_external_status',
    description: 'Check status from external system',
    parameters: {
        reference_id: { type: 'string', required: true }
    },
    execute: function(params) {
        try {
            var rest = new sn_ws.RESTMessageV2('ExternalSystem', 'getStatus');
            rest.setStringParameterNoEscape('id', params.reference_id);
            var response = rest.execute();

            if (response.getStatusCode() == 200) {
                return JSON.parse(response.getBody());
            } else {
                return { error: 'External system error', code: response.getStatusCode() };
            }
        } catch (e) {
            return { error: e.message };
        }
    }
}
```

---

## Agent Configuration

### Basic Agent Definition

```javascript
{
    name: 'IT Support Agent',
    description: 'Helps users with IT support requests',
    category: 'IT Service Management',

    // Available tools
    tools: [
        'get_incidents',
        'create_incident',
        'update_incident',
        'get_knowledge_articles'
    ],

    // System prompt
    instructions: `You are an IT support agent. Help users with:
    - Checking incident status
    - Creating new incidents
    - Finding knowledge articles
    Always confirm before making changes.`,

    // Guardrails
    guardrails: {
        max_tool_calls: 10,
        require_confirmation: ['update_incident', 'create_incident'],
        blocked_operations: ['delete']
    }
}
```

### Agent Persona

Define clear instructions:
```
You are [role]. Your purpose is [goal].

You can help with:
- [capability 1]
- [capability 2]

You should NOT:
- [restriction 1]
- [restriction 2]

Always:
- [behavior 1]
- [behavior 2]
```

---

## Testing Agents

### Test Scenarios

1. **Happy Path** - Normal expected usage
2. **Edge Cases** - Boundary conditions
3. **Error Handling** - Invalid inputs, missing data
4. **Security** - Unauthorized access attempts
5. **Performance** - High volume, complex queries

### Test Script Template

```javascript
// Test agent tool execution
function testTool(toolName, params) {
    gs.info('Testing: ' + toolName);
    gs.info('Params: ' + JSON.stringify(params));

    try {
        var result = executeTool(toolName, params);
        gs.info('Result: ' + JSON.stringify(result));
        return { success: true, result: result };
    } catch (e) {
        gs.error('Error: ' + e.message);
        return { success: false, error: e.message };
    }
}

// Run tests
testTool('get_incidents', { priority: '1', limit: 5 });
testTool('get_incidents', { priority: 'invalid' });  // Error case
```

---

## Best Practices

### Design

1. **Single Responsibility** - Each tool does one thing well
2. **Clear Descriptions** - Help the agent choose the right tool
3. **Sensible Defaults** - Reduce required parameters
4. **Consistent Patterns** - Similar tools behave similarly

### Safety

1. **Confirm Mutations** - Always confirm before changing data
2. **Limit Scope** - Don't give access to unnecessary tables
3. **Log Actions** - Track what the agent does
4. **Rate Limit** - Prevent runaway loops

### Performance

1. **Paginate Results** - Don't return unbounded data
2. **Cache Lookups** - Reuse reference data
3. **Async Operations** - Don't block on long operations

---

## Example Agents

### 1. Incident Triage Agent

Purpose: Automatically categorize and prioritize new incidents

Tools:
- `analyze_incident` - Extract key information
- `suggest_category` - Recommend categorization
- `suggest_priority` - Recommend priority
- `update_incident` - Apply suggestions

### 2. Knowledge Assistant Agent

Purpose: Help users find relevant knowledge articles

Tools:
- `search_knowledge` - Search KB articles
- `get_article_details` - Retrieve full article
- `log_feedback` - Record article usefulness

### 3. Change Approval Agent

Purpose: Review and route change requests

Tools:
- `get_change_details` - Retrieve change info
- `check_conflicts` - Find scheduling conflicts
- `get_approvers` - Identify required approvers
- `route_for_approval` - Send to approval workflow

---

## Related Resources

- [Agentic Patterns](../../context/agentic-patterns.md) - Framework details
- [Now Assist Platform](../../context/now-assist-platform.md) - Platform overview
- [API Integration](../api-integration/SKILL.md) - Tool development

---

*Part of the Foundry golden repository*
