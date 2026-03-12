---
name: servicenow-agent-builder
scope: project
recommended: false
version: 1.0.0
---
# Claude Code Skill: ServiceNow Agentic Workflow Builder

## Skill Metadata
- **Name:** servicenow-agent-builder
- **Version:** 1.0.0
- **Author:** Scout (Greg's AI Assistant)
- **Date:** 2026-02-06
- **Claude Code Compatible:** Yes

---

## Overview

This skill enables Claude Code to build complete ServiceNow AI Agentic Workflows including:
- Custom AI Agents with tool orchestration
- Tool scripts using validated patterns
- Skills via API (8-table pattern)
- Programmatic execution workflows

All patterns are validated against ServiceNow Vancouver+ instances.

---

## Prerequisites (Before Starting)

1. **ServiceNow Instance:** Vancouver or later with AI Agent features enabled
2. **Credentials:** Admin or sn_aia.admin role
3. **API Access:** REST API enabled, basic auth or OAuth configured
4. **Claude Code:** Running in project directory with `claude` CLI available

---

## Core Rules

### Rule 1: Tool Scripts Use Native JS Only
**NEVER use these in tool scripts (they hang indefinitely):**
```javascript
// ❌ FORBIDDEN - Causes silent hangs
new GlideDateTime().getDisplayValue();
gs.getUserName();
gs.getSessionID();
gs.getUserID();
gs.log();
gs.print();
gs.info();
```

**ALWAYS use these instead:**
```javascript
// ✅ REQUIRED - Native JavaScript only
new Date().toISOString();
new Date().toLocaleDateString();
Date.now();
String(value);
Number(value);
JSON.parse();
JSON.stringify();
```

### Rule 2: GlideRecord is the ONLY Database API
**GlideRecord works perfectly in tool scripts:**
```javascript
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(10);
gr.query();

while (gr.next()) {
    outputs.records.push({
        number: gr.getValue('number'),
        short_description: gr.getValue('short_description'),
        state: gr.getDisplayValue('state')
    });
}
```

### Rule 3: Input Schema MUST Include "mandatory"
```javascript
// ❌ BROKEN - Agent may skip inputs
[{"name":"message","type":"string"}]

// ✅ WORKING - Forces agent to collect input
[{"name":"message","type":"string","mandatory":true}]
```

### Rule 4: Always Include Error Handling
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

---

## 8-Table API Skill Creation Pattern

When creating skills via API, create records in this exact order:

### Step 1: Pre-generate sys_id
```javascript
const crypto = require('crypto');
const sys_id = crypto.randomBytes(16).toString('hex');
```

### Step 2: Create sn_aia_tool (with pre-generated sys_id)
```javascript
const toolPayload = {
    sys_id: sys_id,
    name: "Your Tool Name",
    internal_name: `prefix_tool_name_${sys_id}`,
    description: "What this tool does",
    active: true,
    script: `(function(inputs) { /* tool script */ })(inputs)`,
    input_schema: JSON.stringify([{
        name: "input_name",
        type: "string",
        mandatory: true
    }]),
    output_schema: JSON.stringify([{
        name: "output_name",
        type: "string"
    }])
};
```

### Step 3: Create sn_aia_agent_tool_m2m
Maps tool to agent.

### Step 4: Create sys_one_extend_capability
Registers as Now Assist skill.

### Step 5: Create sn_nowassist_skill_config
Skill configuration and metadata.

### Step 6: Create sys_generative_ai_config
LLM prompt and model settings.

### Step 7: Create sys_one_extend_capability_definition
**CRITICAL:** Must set `api` and `api_type` fields.

### Step 8: Create sys_one_extend_definition_config
**CRITICAL:** Must set `default=true`.

### Step 9: Create sys_one_extend_definition_attribute
Input/output parameter definitions.

### Table 10-17 (Optional for full functionality)
- ACLs, notifications, UI actions, etc.

---

## Agent Strategy Selection

| Strategy | Use When | Tool Calling |
|----------|----------|--------------|
| **ReAct** | Agent needs to query data, reason, act | ✅ Yes |
| **ReActive Planner** | Complex multi-step planning | ⚠️ May skip tools |
| **CoPilot** | Interactive user assistance | ✅ Yes (86% OOTB) |
| **AutoPilot** | Fully automated execution | ✅ Yes (7% OOTB) |

**Default Recommendation:** Use **ReAct** for most use cases.

---

## Programmatic Execution

Use `AiAgentRuntimeUtil` for automated workflows:

```javascript
// Business Rule, Scheduled Job, Flow Designer, or Background Script
var runtime = new sn_aia.AiAgentRuntimeUtil();

var req = {
    targetRecordId: gr.sys_id.toString(),
    targetTable: "incident",
    agentId: "your_agent_sys_id",
    objective: "Analyze and categorize this incident",
    conversationUser: "admin",
    canInteractWithUser: false  // ← FALSE for automation!
};

var resp = runtime.startAiAgentConversation(req);

if (resp.status == "success") {
    gs.info("Agent completed: " + resp.data.conversationId);
} else {
    gs.error("Agent failed: " + JSON.stringify(resp.error));
}
```

---

## Multi-Agent Workflow Pattern

Chain agents via tool outputs:

**Agent 1 Tool Output:**
```javascript
outputs.Status = "SUCCESS";  // Signals success
outputs.NextAgentName = "Agent2";
outputs.data = { /* payload for next agent */ };
```

**Agent 2 Instructions:**
```
Step 1: Receive data from previous agent
Step 2: Check ${Status}
Step 3: If SUCCESS, process ${data}
Step 4: If ERROR, escalate to human
```

---

## All 13 Tool Types (Zurich)

Zurich expands tool types from just "script" to 13 types. When creating an agent, choose the right tool type:

| Tool Type | Description | When to Use |
|-----------|-------------|-------------|
| **Script** | Custom editable scripts and APIs | Custom logic, GlideRecord queries, calculations |
| **Catalog item** | Service catalog items | Order fulfillment, service requests |
| **Conversational topic** | Virtual Agent conversation topics | Structured conversations, guided flows |
| **Desktop action** | Actions on workspace | Workspace-specific UI operations |
| **File upload** | PDF, DOCX, TXT file processing | Document analysis, voice agent file intake |
| **Flow action** | IntegrationHub spoke actions | Integration with external systems |
| **Knowledge graph** | Knowledge retrieval | KB article search, FAQ responses |
| **Now Assist skill** | Invoke existing Now Assist skills | Summarization, classification, generation |
| **Record operation** | CRUD on ServiceNow tables | Standard table queries and updates |
| **Search retrieval** | Text search across sources | Full-text search (use dedicated profile for voice) |
| **Subflow** | Execute Flow Designer subflows | Complex multi-step automations |
| **Web search** | Internet search | Real-time web information (NOT on Azure OpenAI) |
| **MCP server tool** | External MCP server tools | External AI tool integration |

### Script Tool — Updated Rules (Zurich)

**CRITICAL change from Vancouver:** Use `GlideRecordSecure` (not `GlideRecord`):

```javascript
(function(inputs) {
    var outputs = {};
    try {
        // ✅ GlideRecordSecure + addUserEncodedQuery = MANDATORY
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', String(inputs.incident_number || ''));
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.record = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description')
            };
            outputs.status = 'success';
        } else {
            outputs.status = 'not_found';
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = 'error';
    }
    return outputs;
})(inputs);
```

**Tool naming rules:**
- ❌ CamelCase forbidden for `internal_name`: `getIncidentDetails`
- ✅ Use snake_case: `get_incident_details`

### Tool Execution Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Supervised** | Human must approve before execution | Write operations, sensitive data access |
| **Autonomous** | Executes without approval | Read-only queries, safe operations |

### Platform Limits

| Limit | Value | Configurable Via |
|-------|-------|-----------------|
| Max tools per agent | 20 | `sn_aia.maximum_agent_tools` |
| Max consecutive same-tool | 7 | `sn_aia.continuous_tool_execution_limit` |
| Max retries on failure | 3 | `sn_aia.react_failure_retry_max_limit` |
| Tool execution record expiry | 13 months | Automatic |

---

## Version Control

Zurich supports version control for AI agents:
- Agents can be versioned independently
- Each version captures: instructions, tool assignments, strategy
- Rollback to previous versions is supported
- Version history available in AI Agent Studio

---

## Testing Workflow

### Test AI Reasoning (Recommended)

Navigation: All > AI Agent Studio > Testing > Test AI reasoning tab

1. Select the agent to test
2. Enter test input/utterance
3. Review tool selection, inputs, and outputs step by step
4. Verify reasoning matches expectations

### Automated Evaluation

Navigation: All > Now Assist Skill Kit > Agentic Evaluations

See the `servicenow-ai-evaluation` skill for detailed setup.

---

## Validation Checklist

Before declaring a workflow complete, verify:

- [ ] Tool script uses native JS only (no gs.*, no GlideDateTime)
- [ ] Tool script includes try-catch error handling
- [ ] Input schema has "mandatory": true for required fields
- [ ] GlideRecord queries use setLimit() for performance
- [ ] Agent uses ReAct strategy for tool calling
- [ ] Programmatic execution sets canInteractWithUser: false
- [ ] API calls include pre-generated sys_id for skill creation
- [ ] All 8 required tables created for skills
- [ ] Test execution completes in < 3 seconds
- [ ] Error scenarios handled gracefully
- [ ] Script tools use GlideRecordSecure (not GlideRecord)
- [ ] Script tools call addUserEncodedQuery() for ACL enforcement
- [ ] Tool internal_name uses snake_case (no CamelCase)
- [ ] Tool count per agent ≤ 20
- [ ] Execution mode set correctly (supervised for writes, autonomous for reads)

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Tool hangs indefinitely | Used gs.* or GlideDateTime | Replace with native JS |
| Agent skips tool inputs | Missing "mandatory": true | Add to input schema |
| Skill not visible in UI | Missing sys_id in POST | Pre-generate sys_id |
| "Cannot find agent" | Wrong agentId in request | Verify sys_id |
| Tool returns null | Output not in return statement | Ensure `return outputs;` |
| "Processing..." forever | Glide API hang | Check for forbidden APIs |

---

## Project Structure Template

```
servicenow-agent-project/
├── README.md
├── .env.example
├── config/
│   ├── instance.json       # Instance URL, credentials
│   └── agents.json         # Agent definitions
├── src/
│   ├── tools/              # Tool script files
│   │   ├── get-incident.js
│   │   └── update-incident.js
│   ├── agents/             # Agent configurations
│   │   └── incident-analyzer.json
│   └── api/                # API helper functions
│       └── servicenow.js
├── scripts/
│   ├── create-tool.js
│   ├── create-agent.js
│   └── create-skill.js
├── tests/
│   └── tool-tests.js
└── docs/
    └── architecture.md
```

---

## Naming Conventions

| Component | Pattern | Example |
|-----------|---------|---------|
| Tools | `{prefix}_{action}_{object}` | `scout_get_incident` |
| Agents | `{prefix}_{purpose}_agent` | `scout_incident_analyzer` |
| Skills | `{prefix}_{function}_skill` | `scout_priority_skill` |
| Variables | `camelCase` | `incidentNumber` |
| Constants | `UPPER_SNAKE` | `MAX_RESULTS` |

**Prefixes:**
- `scout_` - Your (Scout's) creations
- `greg_` - Greg's creations

---

## Performance Targets

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Simple tool | < 100ms | < 500ms |
| GlideRecord query | < 200ms | < 1s |
| Agent with 1 tool | < 500ms | < 2s |
| Agent with 3 tools | < 2s | < 5s |
| Full workflow | < 5s | < 10s |

---

## Security Best Practices

1. **Never hardcode credentials** in tool scripts
2. **Validate all inputs** before database operations
3. **Use setLimit()** to prevent unbounded queries
4. **Log security events** to sn_sec_log (not gs.log)
5. **Respect ACLs** - GlideRecord enforces automatically
6. **Sanitize user inputs** to prevent injection
7. **Use secure protocols** (HTTPS) for external APIs

---

## Resources

- **Instance:** gpinst01.service-now.com
- **Documentation:** See Obsidian vault `~/Documents/ScoutVault/Tech/ServiceNow AI Agents/`
- **Working Examples:** `~/Documents/ScoutVault/Projects/`
- **API Reference:** ServiceNow REST API Explorer

---

## Quick Start Command

```bash
# Create new ServiceNow agent project
claude -p "Create a ServiceNow AI Agent project for [USE CASE] using the servicenow-agent-builder skill"
```

---

*This skill is based on validated patterns from Feb 2026 research.*
*All code patterns tested on ServiceNow Zurich.*
