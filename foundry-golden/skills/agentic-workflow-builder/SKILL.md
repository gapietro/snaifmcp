---
name: agentic-workflow-builder
scope: project
recommended: false
version: 1.0.0
---
# Skill: Agentic Workflow Builder

> Step-by-step guide for creating ServiceNow Agentic Workflows with orchestrator and child agents.

---

## Purpose

This skill guides you through creating complete Agentic Workflows in ServiceNow Zurich — multi-agent orchestrations where an orchestrator agent coordinates child agents and tools to accomplish complex tasks.

## When to Use

Use this skill when you need to:
- Create a multi-agent workflow (orchestrator + child agents)
- Configure triggers (record, scheduled, chat, API)
- Set up agent hierarchies with tool assignments
- Test and evaluate agentic workflows

## Prerequisites

1. ServiceNow Zurich instance with AI Agent Studio enabled
2. `sn_aia.admin` role
3. Now Assist AI Agents plugin (`sn_aia`) installed
4. Generative AI Controller plugin (`com.sn.generative.ai`) installed

---

## Instructions

### Step 1: Design the Workflow Architecture

Before building, define:

1. **What is the end goal?** (e.g., "Resolve P3 incidents automatically")
2. **What child agents are needed?** (e.g., Triage Agent, Resolution Agent, Escalation Agent)
3. **What tools does each agent need?** (max 20 per agent)
4. **What triggers should start the workflow?** (record change, schedule, chat, API)
5. **Should the workflow be supervised or autonomous?**

**Architecture template:**
```
Agentic Workflow: {workflow_name}
    └── Orchestrator: {orchestrator_name}
            ├── Child Agent: {agent_1_name}
            │       ├── Tool: {tool_1a}
            │       └── Tool: {tool_1b}
            ├── Child Agent: {agent_2_name}
            │       └── Tool: {tool_2a}
            └── Direct Tool: {tool_direct}
```

### Step 2: Create Child Agents First

Navigation: All > AI Agent Studio > Create and manage > AI agents > Add

For each child agent:

1. **Name**: Descriptive name based on outcome (e.g., "Incident Triage Agent")
2. **Description**: Summary of what the agent does autonomously
3. **AI Agent Role**: Capabilities and responsibilities text
4. **Instructions**: Step-by-step instructions sent to LLM. Write as numbered steps:
   ```
   Step 1: Retrieve the incident details using the get_incident tool
   Step 2: Analyze the short description and category
   Step 3: If priority is P1 or P2, immediately escalate using escalate_incident tool
   Step 4: For P3+, attempt resolution using the search_knowledge tool
   Step 5: Update the incident with your findings
   ```
5. **Strategy**: ReAct (recommended for most cases)
6. **Add Tools**: Attach relevant tools (script, record operation, search, etc.)
7. **Security**: Set appropriate access level (Dynamic user recommended)

### Step 3: Create the Orchestrator Agent

The orchestrator coordinates child agents. Its instructions should:
- Describe the overall workflow goal
- List which child agent handles which sub-task
- Define handoff conditions between agents
- Specify when to escalate to a human

**Example orchestrator instructions:**
```
You are an incident resolution orchestrator. Your job is to coordinate
the resolution of incidents through the following agents:

1. Use the Triage Agent to classify and prioritize the incident
2. Based on triage results:
   - If category is "network": route to Network Resolution Agent
   - If category is "software": route to Software Resolution Agent
   - If unknown: route to General Resolution Agent
3. If the resolution agent cannot resolve within 3 attempts, escalate
4. After resolution, use the Documentation Agent to update work notes
```

### Step 4: Create the Agentic Workflow

Navigation: All > AI Agent Studio > Create and manage > Agentic workflows > Add

1. **Name**: Workflow name (e.g., "Automated Incident Resolution")
2. **Description**: Business outcome summary
3. **Orchestrator Agent**: Select the orchestrator created in Step 3
4. **Associate Child Agents**: Link child agents to the workflow

### Step 5: Configure Triggers

Navigation: Agentic workflow detail > Triggers tab

#### Record Trigger
- **Table**: Target table (e.g., `incident`)
- **Conditions**: Filter conditions (e.g., `priority=3^state=1^assignment_group=...`)
- **When**: Insert, Update, or Both

#### Scheduled Trigger
- **Schedule**: Cron expression or interval
- **Max records**: Records per run (default: 10, property: `sn_aia.max_scheduled_trigger_query`)
- **Filter**: Conditions to select records

#### Chat Trigger
- No table config needed — triggered by user conversation in Virtual Agent
- Requires `sn_nowassist_va.router_redirect_va_agentic` property set to `ROUTER_DECISION`

#### API Trigger
```javascript
var runtime = new sn_aia.AiAgentRuntimeUtil();
var req = {
    targetRecordId: recordSysId,
    targetTable: 'incident',
    usecaseId: workflowSysId,  // The agentic workflow sys_id
    objective: 'Resolve this incident',
    conversationUser: gs.getUserName(),
    canInteractWithUser: false
};
var resp = runtime.startAiAgentConversation(req);
```

### Step 6: Test the Workflow

1. **Manual test**: All > AI Agent Studio > Testing > Test AI reasoning
   - Select the agentic workflow
   - Provide test input
   - Step through each agent's reasoning

2. **Automated evaluation**: All > Now Assist Skill Kit > Agentic Evaluations
   - Create evaluation run against the workflow
   - Use existing or new execution logs as dataset
   - Review task completeness and tool performance metrics

### Step 7: Activate and Monitor

1. Activate the agentic workflow
2. Ensure triggers are enabled
3. Monitor via: All > AI Agent Studio > Analytics
4. Check execution plans: `sn_aia_execution_plan` table

---

## Key Tables

| Table | Purpose |
|-------|---------|
| `sn_aia_usecase` | Agentic workflow definitions |
| `sn_aia_agent` | Agent definitions (orchestrator + child) |
| `sn_aia_tool` | Tool definitions |
| `sn_aia_agent_tool_m2m` | Agent-to-tool mappings |
| `sn_aia_trigger_configuration` | Trigger configs |
| `sn_aia_execution_plan` | Execution records |
| `sn_aia_execution_task` | Tasks per execution |
| `sn_aia_tools_execution` | Tool calls per execution |

## Safety Features

- **Recursive check**: Max 50 create operations and 5 update operations within 15-minute windows before aborting
- **Follow-up**: Configurable post-execution behavior (`follow_up_behaviour` property)
- **Memory**: Short-term context sharing within conversation, optional long-term memory across conversations

## Gotchas

- The orchestrator MUST be a separate agent from child agents
- Child agents inherit the security model of the orchestrator
- Max 20 tools per individual agent (not per workflow)
- Scheduled triggers process max 10 records per run by default
- Tool execution records expire after 13 months
- GenAI logs retained for 6 months

---

*Validated against ServiceNow Zurich documentation.*
