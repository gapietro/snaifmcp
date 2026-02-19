# Test Plan: Zurich Golden Repo Content Validation

> Validates all 18 golden repo files created from the ServiceNow Zurich "Enable AI" documentation against a live instance using the Foundry MCP tools.

**Instance:** gpinst01.service-now.com
**Date:** 2026-02-13
**MCP Tools Available:** 30 (12 foundry + 8 core SN + 6 AIA + 4 skill)

---

## Test Summary

| Phase | Tests | Validates | Risk Level |
|-------|-------|-----------|------------|
| 0. Connection & Setup | 3 | MCP server + instance | None |
| 1. Data Model — Core Tables | 12 | servicenow-ai-data-model.md | None (read-only) |
| 2. Data Model — Execution Tables | 5 | servicenow-ai-data-model.md | None (read-only) |
| 3. Data Model — Skill/GenAI Tables | 8 | servicenow-ai-data-model.md | None (read-only) |
| 4. Data Model — GAF/MCP/Other Tables | 6 | servicenow-ai-data-model.md | None (read-only) |
| 5. Tool Script Rules | 5 | tool-script-rules.md | Low (read scripts) |
| 6. Agent Discovery | 6 | servicenow-agent-builder skill | None (read-only) |
| 7. Skill Discovery | 5 | now-assist-skill-builder skill | None (read-only) |
| 8. Agentic Workflows | 5 | agentic-workflow-builder skill | None (read-only) |
| 9. Execution Tracing | 4 | agentic-patterns.md | None (read-only) |
| 10. System Properties | 6 | servicenow-ai-system-properties.md | None (read-only) |
| 11. Security & Governance | 5 | security-patterns.md, guardian-governance.md | None (read-only) |
| 12. GenAI Framework | 5 | genai-framework.md | None (read-only) |
| 13. MCP Integration | 4 | servicenow-mcp-integration.md | None (read-only) |
| 14. Voice Agent Config | 3 | voice-agent-builder skill | None (read-only) |
| 15. Agent Execution | 3 | servicenow-agent-builder skill | Medium (triggers agent) |
| 16. Skill Execution | 3 | now-assist-skill-builder skill | Medium (triggers skill) |
| 17. Agent Creation (Dry Run) | 2 | servicenow-agent-builder skill | None (dry-run) |
| 18. Skill Creation (Dry Run) | 2 | now-assist-skill-builder skill | None (dry-run) |
| **Total** | **92** | **18 files** | |

---

## Phase 0: Connection & Setup

### T0.1 — Connect to instance
- **Tool:** `servicenow_connect`
- **Input:** `{ "instance": "gpinst01.service-now.com", "username": "<admin>", "password": "<password>" }`
- **Pass:** Returns success with session info
- **Validates:** MCP server operational

### T0.2 — Verify connection status
- **Tool:** `servicenow_status`
- **Input:** (none)
- **Pass:** Shows connected to gpinst01, authenticated user and roles
- **Validates:** Session active

### T0.3 — Get instance info and confirm Zurich
- **Tool:** `servicenow_instance`
- **Input:** (none)
- **Pass:** Returns instance version containing "Zurich" or build tag confirming Zurich release
- **Validates:** Instance is Zurich (prerequisite for all subsequent tests)

---

## Phase 1: Data Model — Core AI Agent Tables

**Validates:** `context/servicenow-ai-data-model.md` — Tables 1-9

### T1.1 — Verify sn_aia_agent table exists with documented fields
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_agent", "query": "active=true", "fields": "sys_id,name,description,instructions,strategy,active,type,execution_mode", "limit": 1 }`
- **Pass:** Returns record(s) with all requested fields populated. Confirms `strategy` is a reference field, `type` and `execution_mode` fields exist
- **Validates:** sn_aia_agent table schema (data model Table 1)

### T1.2 — Verify sn_aia_tool table with 13 tool_type values
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_tool", "query": "active=true", "fields": "sys_id,name,description,tool_type,internal_name,script,input_schema,output_schema,execution_mode", "limit": 5 }`
- **Pass:** Returns tools with `tool_type` field present. Confirm at least "script" type exists
- **Validates:** sn_aia_tool table schema (data model Table 2)

### T1.3 — Verify tool_type choices include documented types
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var choices = [];
var gr = new GlideRecord('sys_choice');
gr.addQuery('name', 'sn_aia_tool');
gr.addQuery('element', 'tool_type');
gr.query();
while (gr.next()) {
    choices.push(gr.getValue('value'));
}
gs.info(JSON.stringify(choices));
```
- **Pass:** Returns array containing: `script`, `catalog_item`, `conversational_topic`, `desktop_action`, `file_upload`, `flow_action`, `knowledge_graph`, `now_assist_skill`, `record_operation`, `search_retrieval`, `subflow`, `web_search`, `mcp_server_tool`
- **Validates:** 13 tool types documented in tool-script-rules.md

### T1.4 — Verify sn_aia_agent_tool_m2m with max_auto_executions
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_agent_tool_m2m", "query": "active=true", "fields": "sys_id,agent,tool,max_auto_executions,order", "limit": 3 }`
- **Pass:** Returns records with `max_auto_executions` field present
- **Validates:** Agent-tool mapping table (data model Table 3)

### T1.5 — Verify sn_aia_usecase table exists (Agentic Workflows)
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_usecase", "query": "active=true", "fields": "sys_id,name,description,orchestrator,active", "limit": 3 }`
- **Pass:** Returns records with `orchestrator` reference field
- **Validates:** Agentic workflow table (data model Table 4)

### T1.6 — Verify sn_aia_strategy table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_strategy", "query": "", "fields": "sys_id,name,description", "limit": 10 }`
- **Pass:** Returns strategies including "ReAct" and "ReActive Planner"
- **Validates:** Strategy table (data model Table 5)

### T1.7 — Verify sn_aia_team and sn_aia_team_member tables
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_team", "query": "", "fields": "sys_id,name", "limit": 3 }`
- **Pass:** Table exists and is queryable (may return 0 records if no teams configured)
- **Validates:** Team tables (data model Tables 6-7)

### T1.8 — Verify sn_aia_trigger_configuration table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_trigger_configuration", "query": "", "fields": "sys_id,name,type,usecase,active", "limit": 3 }`
- **Pass:** Table exists. If records present, confirm `type` field matches documented values (record, scheduled, chat, api)
- **Validates:** Trigger configuration table (data model Table 8)

### T1.9 — Verify sn_aia_agent_config table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_agent_config", "query": "", "fields": "sys_id,agent,active", "limit": 3 }`
- **Pass:** Table exists and is queryable
- **Validates:** Agent config table (data model Table 9)

### T1.10 — Verify sn_aia_team_member table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_team_member", "query": "", "fields": "sys_id,team,agent", "limit": 3 }`
- **Pass:** Table exists and is queryable
- **Validates:** Team member table (data model Table 7)

### T1.11 — Cross-reference: agent strategy is a reference
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var ed = GlideRecord('sys_dictionary');
ed.addQuery('name', 'sn_aia_agent');
ed.addQuery('element', 'strategy');
ed.query();
if (ed.next()) {
    gs.info('Type: ' + ed.getValue('internal_type') + ', Reference: ' + ed.getValue('reference'));
}
```
- **Pass:** `internal_type` is "reference" and `reference` is "sn_aia_strategy"
- **Validates:** Data model relationship diagram

### T1.12 — Verify sys_domain field exists on AI tables
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var tables = ['sn_aia_agent', 'sn_aia_tool', 'sn_aia_usecase'];
var results = [];
tables.forEach(function(t) {
    var ed = new GlideRecord('sys_dictionary');
    ed.addQuery('name', t);
    ed.addQuery('element', 'sys_domain');
    ed.query();
    results.push({ table: t, hasDomain: ed.hasNext() });
});
gs.info(JSON.stringify(results));
```
- **Pass:** All tables have `sys_domain` field
- **Validates:** Domain Separation section of data model

---

## Phase 2: Data Model — Execution Tables

**Validates:** `context/servicenow-ai-data-model.md` — Tables 10-13

### T2.1 — Verify sn_aia_execution_plan table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_execution_plan", "query": "", "fields": "sys_id,state,conversation_id,run_type,usecase,related_task_record,related_task_table", "limit": 3 }`
- **Pass:** Returns records. Confirm `run_type` field exists with values from: API, Chat, Evaluation, Testing, Trigger
- **Validates:** Execution plan table (data model Table 10)

### T2.2 — Verify sn_aia_execution_task table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_execution_task", "query": "", "fields": "sys_id,execution_plan,agent,state,task_type", "limit": 3 }`
- **Pass:** Returns records linked to execution plans
- **Validates:** Execution task table (data model Table 11)

### T2.3 — Verify sn_aia_tools_execution table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_tools_execution", "query": "", "fields": "sys_id,execution_plan,tool,input,output,execution_time", "limit": 3 }`
- **Pass:** Returns records with tool execution data
- **Validates:** Tools execution table (data model Table 12)

### T2.4 — Verify sn_aia_message table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_message", "query": "", "fields": "sys_id,execution_plan,role,content,order", "limit": 5 }`
- **Pass:** Returns messages with `role` field (agent/user)
- **Validates:** Message table (data model Table 13)

### T2.5 — Verify execution table relationships
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('sn_aia_execution_plan');
gr.orderByDesc('sys_created_on');
gr.setLimit(1);
gr.query();
if (gr.next()) {
    var planId = gr.getValue('sys_id');
    var tasks = new GlideAggregate('sn_aia_execution_task');
    tasks.addQuery('execution_plan', planId);
    tasks.addAggregate('COUNT');
    tasks.query();
    var taskCount = tasks.next() ? tasks.getAggregate('COUNT') : 0;
    var tools = new GlideAggregate('sn_aia_tools_execution');
    tools.addQuery('execution_plan', planId);
    tools.addAggregate('COUNT');
    tools.query();
    var toolCount = tools.next() ? tools.getAggregate('COUNT') : 0;
    gs.info(JSON.stringify({ plan: planId, tasks: taskCount, toolExecutions: toolCount }));
}
```
- **Pass:** Returns counts showing execution tasks and tool executions linked to the plan
- **Validates:** Execution table relationship model

---

## Phase 3: Data Model — Skill & GenAI Tables

**Validates:** `context/servicenow-ai-data-model.md` — Tables 14-22

### T3.1 — Verify sys_one_extend_capability table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_capability", "query": "type=skill", "fields": "sys_id,name,description,type,active", "limit": 5 }`
- **Pass:** Returns capability records
- **Validates:** Now Assist capability table (data model Table 14)

### T3.2 — Verify sn_nowassist_skill_config table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_nowassist_skill_config", "query": "", "fields": "sys_id,name,description,active,skill_type,capability", "limit": 5 }`
- **Pass:** Returns skill config records with `capability` reference
- **Validates:** Skill config table (data model Table 15)

### T3.3 — Verify sys_generative_ai_config table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_generative_ai_config", "query": "", "fields": "sys_id,name,active,prompt", "limit": 3 }`
- **Pass:** Returns GenAI config records with prompt field
- **Validates:** GenAI config table (data model Table 16)

### T3.4 — Verify sys_one_extend_capability_definition table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_capability_definition", "query": "", "fields": "sys_id,capability,api,api_type,active", "limit": 3 }`
- **Pass:** Returns definitions with `api` and `api_type` fields (CRITICAL per docs)
- **Validates:** Capability definition table (data model Table 17)

### T3.5 — Verify sys_one_extend_definition_config table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_definition_config", "query": "", "fields": "sys_id,definition,default,active", "limit": 3 }`
- **Pass:** Returns config records with `default` field (CRITICAL: must be true)
- **Validates:** Definition config table (data model Table 18)

### T3.6 — Verify sys_one_extend_definition_attribute table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_definition_attribute", "query": "", "fields": "sys_id,definition,name,type,value", "limit": 5 }`
- **Pass:** Returns attribute records defining input/output parameters
- **Validates:** Definition attribute table (data model Table 19)

### T3.7 — Probe GenAI skill tables (version variant)
- **Tool:** `servicenow_query`
- **Input:** Try `{ "table": "sys_genai_skill", "query": "", "fields": "sys_id,name", "limit": 1 }` — if fails, try `sn_gai_skill`
- **Pass:** One of the two table names returns results
- **Validates:** Table name variant detection (data model section "Table Name Variants by Version")

### T3.8 — Verify sys_generative_ai_log table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_generative_ai_log", "query": "", "fields": "sys_id,prompt,response,sys_created_on", "limit": 3 }`
- **Pass:** Returns recent GenAI log entries
- **Validates:** GenAI log table + retention policy reference

---

## Phase 4: Data Model — GAF, MCP & Other Tables

**Validates:** `context/servicenow-ai-data-model.md` — Tables 23-34

### T4.1 — Verify Group Action Framework tables
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var tables = ['sn_gaf_record_group', 'sn_gaf_record_group_detail', 'sn_gaf_action_strategy_result', 'sn_gaf_action_mapper_result', 'sn_gaf_action_reducer_result'];
var results = [];
tables.forEach(function(t) {
    var gr = new GlideRecord(t);
    gr.setLimit(0);
    results.push({ table: t, exists: gr.isValid() });
});
gs.info(JSON.stringify(results));
```
- **Pass:** All 5 GAF tables are valid
- **Validates:** GAF tables (data model Tables 23-27)

### T4.2 — Verify MCP Client tables
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var tables = ['sn_mcp_execution_logs', 'sn_mcp_client_server_session_mapping', 'sn_mcp_server'];
var results = [];
tables.forEach(function(t) {
    var gr = new GlideRecord(t);
    gr.setLimit(0);
    results.push({ table: t, exists: gr.isValid() });
});
gs.info(JSON.stringify(results));
```
- **Pass:** All 3 MCP tables are valid (may require `sn_mcp_client` plugin)
- **Validates:** MCP tables (data model Tables 28-30)

### T4.3 — Verify sn_aia_property table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_property", "query": "", "fields": "sys_id,name,value,description", "limit": 10 }`
- **Pass:** Returns agent properties matching documented names
- **Validates:** Agent properties table (data model Table 31)

### T4.4 — Verify sn_aia_report_metric table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_report_metric", "query": "", "fields": "sys_id,name", "limit": 3 }`
- **Pass:** Table exists and is queryable
- **Validates:** Report metric table (data model Table 32)

### T4.5 — Verify sn_aia_gen_ai_m2m table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_gen_ai_m2m", "query": "", "fields": "sys_id", "limit": 1 }`
- **Pass:** Table exists
- **Validates:** Gen AI metadata M2M table (data model Table 33)

### T4.6 — Verify sys_agent_access_role_configuration table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_agent_access_role_configuration", "query": "", "fields": "sys_id,agent,role", "limit": 3 }`
- **Pass:** Table exists and contains role configuration records
- **Validates:** Agent access role configuration (data model Table 34)

---

## Phase 5: Tool Script Rules

**Validates:** `context/tool-script-rules.md`

### T5.1 — Confirm GlideRecordSecure is available in scripts
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecordSecure('incident');
gr.addQuery('active', true);
gr.setLimit(1);
gr.query();
if (gr.next()) {
    gs.info('GlideRecordSecure works: ' + gr.getValue('number'));
} else {
    gs.info('GlideRecordSecure works but no results');
}
```
- **Pass:** Returns incident number without error
- **Validates:** Rule 2 — GlideRecordSecure is available and functional

### T5.2 — Verify addUserEncodedQuery exists on GlideRecordSecure
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecordSecure('incident');
try {
    gr.addUserEncodedQuery();
    gs.info('addUserEncodedQuery: available');
} catch(e) {
    gs.info('addUserEncodedQuery: NOT available - ' + String(e));
}
```
- **Pass:** Outputs "available" (method exists on GlideRecordSecure)
- **Validates:** Rule 2 — addUserEncodedQuery method exists

### T5.3 — Verify tool internal_name naming convention
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_tool", "query": "active=true", "fields": "internal_name,name", "limit": 20 }`
- **Pass:** All `internal_name` values use snake_case (no CamelCase)
- **Validates:** Tool naming rules — CamelCase forbidden for internal_name

### T5.4 — Verify execution_mode field on tools
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_tool", "query": "active=true", "fields": "name,execution_mode", "limit": 10 }`
- **Pass:** `execution_mode` field exists with values matching "supervised" or "autonomous"
- **Validates:** Execution modes documentation

### T5.5 — Count tools per agent (verify platform limit)
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var agg = new GlideAggregate('sn_aia_agent_tool_m2m');
agg.addQuery('agent.active', true);
agg.groupBy('agent');
agg.addAggregate('COUNT');
agg.query();
var results = [];
while (agg.next()) {
    var count = parseInt(agg.getAggregate('COUNT'));
    if (count > 15) {
        results.push({ agent: agg.getDisplayValue('agent'), tools: count });
    }
}
gs.info('Agents near limit (>15 tools): ' + JSON.stringify(results));
gs.info('Max allowed per docs: 20');
```
- **Pass:** No agent exceeds 20 tools (the documented max)
- **Validates:** Platform limits — max 20 tools per agent

---

## Phase 6: Agent Discovery

**Validates:** `skills/servicenow-agent-builder/SKILL.md`, `context/agentic-patterns.md`

### T6.1 — List all active agents
- **Tool:** `servicenow_aia_list`
- **Input:** `{ "status": "active" }`
- **Pass:** Returns list of agents with name, description, status, tool count
- **Validates:** Agent list tool + agent-builder skill discovery pattern

### T6.2 — Get full config of a specific agent
- **Tool:** `servicenow_aia_get`
- **Input:** `{ "agent": "<first agent name from T6.1>", "includeToolDetails": true, "includePrompt": true }`
- **Pass:** Returns complete agent config: instructions, strategy, tools with scripts and schemas
- **Validates:** Agent detail retrieval + data model relationships

### T6.3 — Verify agent strategy matches documented types
- **Tool:** `servicenow_aia_list`
- **Input:** `{ "status": "all", "includeTools": true }`
- **Pass:** Each agent's strategy is one of: ReAct, ReActive Planner, CoPilot, AutoPilot
- **Validates:** Strategy selection table in agent-builder skill

### T6.4 — Verify agent has documented fields in detail view
- **Tool:** `servicenow_aia_get`
- **Input:** `{ "agent": "<agent from T6.1>", "includeStats": true }`
- **Pass:** Response includes: instructions, strategy, execution stats
- **Validates:** Agent data model completeness

### T6.5 — Verify tool details include script and schemas
- **Tool:** `servicenow_aia_get`
- **Input:** `{ "agent": "<agent with script tools from T6.1>", "includeToolDetails": true }`
- **Pass:** Tool details include `script`, `input_schema`, `output_schema`, `tool_type`
- **Validates:** Tool schema structure documented in agent-builder skill

### T6.6 — List agents with tool count filtering
- **Tool:** `servicenow_aia_list`
- **Input:** `{ "status": "active", "includeTools": true, "limit": 5 }`
- **Pass:** Each agent shows accurate tool count
- **Validates:** Agent-tool relationship from data model

---

## Phase 7: Skill Discovery

**Validates:** `skills/now-assist-skill-builder/SKILL.md`, `context/now-assist-platform.md`

### T7.1 — List all active skills
- **Tool:** `servicenow_skill_list`
- **Input:** `{ "status": "active" }`
- **Pass:** Returns list of skills with name, description, category, status
- **Validates:** Skill list tool + skill catalog from now-assist-platform.md

### T7.2 — Get full config of a specific skill
- **Tool:** `servicenow_skill_get`
- **Input:** `{ "skill": "<first skill from T7.1>", "includePrompt": true, "includeSchema": true }`
- **Pass:** Returns skill config with prompt template, input/output schemas
- **Validates:** Skill detail retrieval + Skill Kit architecture

### T7.3 — Verify skill has prompt template
- **Tool:** `servicenow_skill_get`
- **Input:** `{ "skill": "<skill from T7.1>", "includePrompt": true }`
- **Pass:** Response includes prompt template text
- **Validates:** GenAI config table relationship (sys_generative_ai_config)

### T7.4 — Verify skill schemas present
- **Tool:** `servicenow_skill_get`
- **Input:** `{ "skill": "<skill from T7.1>", "includeSchema": true }`
- **Pass:** Input and output schemas are returned as structured data
- **Validates:** 8-table skill creation pattern (definition attributes)

### T7.5 — Check for ITSM skills from catalog
- **Tool:** `servicenow_skill_list`
- **Input:** `{ "status": "active", "nameFilter": "incident" }`
- **Pass:** Returns ITSM-related skills (incident summarization, triage, etc.)
- **Validates:** Now Assist Skill Catalog documented in now-assist-platform.md

---

## Phase 8: Agentic Workflows

**Validates:** `skills/agentic-workflow-builder/SKILL.md`, `context/agentic-patterns.md`

### T8.1 — List agentic workflows
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_usecase", "query": "active=true", "fields": "sys_id,name,description,orchestrator", "limit": 10 }`
- **Pass:** Returns workflow records with orchestrator reference
- **Validates:** Agentic workflow table structure

### T8.2 — Verify orchestrator → child agent hierarchy
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('sn_aia_usecase');
gr.addQuery('active', true);
gr.setLimit(1);
gr.query();
if (gr.next()) {
    var orchId = gr.getValue('orchestrator');
    var teamGr = new GlideRecord('sn_aia_team');
    teamGr.addQuery('agent', orchId);
    teamGr.query();
    if (teamGr.next()) {
        var members = new GlideRecord('sn_aia_team_member');
        members.addQuery('team', teamGr.getValue('sys_id'));
        members.query();
        var children = [];
        while (members.next()) {
            children.push(members.getDisplayValue('agent'));
        }
        gs.info(JSON.stringify({ workflow: gr.getValue('name'), orchestrator: orchId, children: children }));
    } else {
        gs.info('No team found for orchestrator');
    }
}
```
- **Pass:** Returns orchestrator with child agents listed
- **Validates:** Multi-agent architecture from agentic-workflow-builder skill

### T8.3 — Verify trigger configurations
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_trigger_configuration", "query": "active=true", "fields": "sys_id,name,type,usecase", "limit": 5 }`
- **Pass:** Returns triggers with `type` matching documented values (record, scheduled, chat, api)
- **Validates:** Trigger types table from agentic-patterns.md

### T8.4 — Verify execution plan run_type values
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var agg = new GlideAggregate('sn_aia_execution_plan');
agg.groupBy('run_type');
agg.addAggregate('COUNT');
agg.query();
var types = [];
while (agg.next()) {
    types.push({ type: agg.getValue('run_type'), count: agg.getAggregate('COUNT') });
}
gs.info(JSON.stringify(types));
```
- **Pass:** Returns run types from documented set: API, Chat, Evaluation, Testing, Trigger
- **Validates:** Execution plan run_type documentation

### T8.5 — Verify recursive check properties exist
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_property", "query": "nameLIKErecursive_check", "fields": "name,value,description", "limit": 10 }`
- **Pass:** Returns recursive check properties matching documented names and defaults
- **Validates:** Recursive Execution Protection from agentic-patterns.md

---

## Phase 9: Execution Tracing

**Validates:** `context/agentic-patterns.md`, execution trace patterns

### T9.1 — Get recent execution IDs
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_execution_plan", "query": "stateINcomplete,error^ORDERBYDESCsys_created_on", "fields": "sys_id,state,run_type,sys_created_on", "limit": 5 }`
- **Pass:** Returns recent executions with state and run_type
- **Validates:** Execution plan query pattern

### T9.2 — Trace a specific execution
- **Tool:** `servicenow_aia_trace`
- **Input:** `{ "executionId": "<sys_id from T9.1>" }`
- **Pass:** Returns step-by-step trace: decisions, tool calls with input/output, timing
- **Validates:** Execution trace tool + execution table relationships

### T9.3 — Check for execution errors
- **Tool:** `servicenow_aia_errors`
- **Input:** `{ "timeRange": "24h", "limit": 10 }`
- **Pass:** Returns error summary (may be empty if no errors). Grouped by type
- **Validates:** Error aggregation tool + error pattern documentation

### T9.4 — Trace with token usage
- **Tool:** `servicenow_aia_trace`
- **Input:** `{ "executionId": "<sys_id from T9.1>", "includeTokenUsage": true }`
- **Pass:** Returns trace with token counts per step
- **Validates:** Token usage tracking documented in data model

---

## Phase 10: System Properties

**Validates:** `context/servicenow-ai-system-properties.md`

### T10.1 — Verify core AI Agent system properties
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var props = [
    'sn_aia.maximum_agent_tools',
    'sn_aia.continuous_tool_execution_limit',
    'sn_aia.react_failure_retry_max_limit',
    'sn_aia.agent_llm_provider',
    'sn_aia.enable_follow_up'
];
var results = [];
props.forEach(function(p) {
    results.push({ name: p, value: gs.getProperty(p, '(not set)') });
});
gs.info(JSON.stringify(results));
```
- **Pass:** Returns values matching documented defaults (20, 7, 3, azure_openai, true)
- **Validates:** Core AI Agent properties section

### T10.2 — Verify long-term memory properties
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var props = [
    'sn_aia.ltm.enable_long_term_memory',
    'sn_aia.ltm.category.auto_create',
    'sn_aia.ltm.use_memory_for_ai_agent'
];
var results = [];
props.forEach(function(p) {
    results.push({ name: p, value: gs.getProperty(p, '(not set)') });
});
gs.info(JSON.stringify(results));
```
- **Pass:** Properties exist with documented default values
- **Validates:** Long-term memory properties section

### T10.3 — Verify MCP-related properties
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var props = [
    'sn_aia.enable_mcp_tool',
    'mcp_guardian_check'
];
var results = [];
props.forEach(function(p) {
    results.push({ name: p, value: gs.getProperty(p, '(not set)') });
});
gs.info(JSON.stringify(results));
```
- **Pass:** Properties exist (defaults: false, false)
- **Validates:** MCP Client properties section

### T10.4 — Verify agent properties table (sn_aia_property)
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_property", "query": "", "fields": "name,value,description", "limit": 20 }`
- **Pass:** Returns properties matching documented names: `alert.assist_spike_hours_to_check`, `alert.llm_latency_threshold`, `follow_up_behaviour`, etc.
- **Validates:** Agent Properties table section

### T10.5 — Verify context sharing properties
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var props = [
    'sn_aia.allow_context_sharing',
    'sn_aia.context_sharing_strategy'
];
var results = [];
props.forEach(function(p) {
    results.push({ name: p, value: gs.getProperty(p, '(not set)') });
});
gs.info(JSON.stringify(results));
```
- **Pass:** Values match documented defaults (true, summarise)
- **Validates:** Short-term memory / context sharing documentation

### T10.6 — Verify voice agent properties
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var results = [];
results.push({ name: 'sn_aia.enable_voice_agent_setup', value: gs.getProperty('sn_aia.enable_voice_agent_setup', '(not set)') });
results.push({ name: 'glide.voice.authenticate.mfa_mandatory', value: gs.getProperty('glide.voice.authenticate.mfa_mandatory', '(not set)') });
gs.info(JSON.stringify(results));
```
- **Pass:** Properties exist (may or may not be set depending on voice agent installation)
- **Validates:** Voice agent properties section

---

## Phase 11: Security & Governance

**Validates:** `context/security-patterns.md`, `context/now-assist-guardian-governance.md`

### T11.1 — Verify AI-specific roles exist
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var roles = ['sn_aia.admin', 'sn_aia.viewer', 'sn_mcp_client.admin', 'sn_mcp_client.viewer', 'agent_role_config_admin'];
var results = [];
roles.forEach(function(r) {
    var gr = new GlideRecord('sys_user_role');
    gr.addQuery('name', r);
    gr.query();
    results.push({ role: r, exists: gr.hasNext() });
});
gs.info(JSON.stringify(results));
```
- **Pass:** All 5 documented roles exist in sys_user_role
- **Validates:** AI-Specific Roles table in security-patterns.md

### T11.2 — Verify agent access role configuration
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_agent_access_role_configuration", "query": "", "fields": "sys_id,agent,role", "limit": 5 }`
- **Pass:** Table queryable, returns role masking records if configured
- **Validates:** Role masking documentation

### T11.3 — Check Guardian configuration
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('sys_properties');
gr.addQuery('name', 'LIKE', 'guardian');
gr.query();
var results = [];
while (gr.next()) {
    results.push({ name: gr.getValue('name'), value: gr.getValue('value') });
}
gs.info(JSON.stringify(results));
```
- **Pass:** Returns Guardian-related properties
- **Validates:** Now Assist Guardian configuration from guardian-governance.md

### T11.4 — Verify GenAI log table for retention
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('sys_generative_ai_log');
gr.orderBy('sys_created_on');
gr.setLimit(1);
gr.query();
if (gr.next()) {
    gs.info('Oldest log: ' + gr.getValue('sys_created_on'));
}
gr.initialize();
gr.orderByDesc('sys_created_on');
gr.setLimit(1);
gr.query();
if (gr.next()) {
    gs.info('Newest log: ' + gr.getValue('sys_created_on'));
}
```
- **Pass:** Returns date range of GenAI logs (should be within 6-month retention window)
- **Validates:** Data retention policy — 6-month GenAI log retention

### T11.5 — Verify tools_execution retention (13 months)
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('sn_aia_tools_execution');
gr.orderBy('sys_created_on');
gr.setLimit(1);
gr.query();
if (gr.next()) {
    gs.info('Oldest tool execution: ' + gr.getValue('sys_created_on'));
}
```
- **Pass:** Oldest record is within 13 months of current date
- **Validates:** Data retention policy — 13-month tool execution expiry

---

## Phase 12: GenAI Framework

**Validates:** `context/genai-framework.md`

### T12.1 — Verify OneExtend capabilities exist
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_capability", "query": "active=true", "fields": "sys_id,name,type,description", "limit": 10 }`
- **Pass:** Returns capabilities including documented defaults (Summarize, Generate Content, Sentiment Analysis, Generic Prompt)
- **Validates:** Four default capabilities from GenAI Controller

### T12.2 — Verify configured LLM providers
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('sys_generative_ai_model_config');
gr.query();
var providers = [];
while (gr.next()) {
    providers.push({ name: gr.getValue('name'), provider: gr.getDisplayValue('provider') });
}
gs.info(JSON.stringify(providers));
```
- **Pass:** Returns configured providers (should include at least one from: OpenAI, Azure OpenAI, Google, Amazon Bedrock)
- **Validates:** Supported AI Providers / BYOLLM documentation

### T12.3 — Verify GenAI filter configuration
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_gen_ai_filter", "query": "active=true", "fields": "sys_id,name,order", "limit": 10 }`
- **Pass:** Returns filters including documented defaults (Greetings, Gratitude, Complaint, Closure)
- **Validates:** Small talk filters section

### T12.4 — Verify rate limit rules table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_rate_limit_rules", "query": "", "fields": "sys_id,name,resource,rule_type,request_limit_per_hour,active", "limit": 5 }`
- **Pass:** Table exists and is queryable
- **Validates:** Rate limiting documentation

### T12.5 — Check web search capability
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_capability", "query": "nameLIKEsearch", "fields": "sys_id,name,description,active", "limit": 5 }`
- **Pass:** Returns "AI Search answers" or similar web search capability
- **Validates:** Web search capability documentation

---

## Phase 13: MCP Integration

**Validates:** `context/servicenow-mcp-integration.md`

### T13.1 — Check MCP server table
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_mcp_server", "query": "", "fields": "sys_id,name,url,active", "limit": 5 }`
- **Pass:** Table queryable (may have 0 records if no MCP servers configured)
- **Validates:** MCP Server Console table

### T13.2 — Verify MCP tool definition table
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('sn_mcp_tool_definition');
gr.setLimit(0);
gs.info('sn_mcp_tool_definition valid: ' + gr.isValid());
```
- **Pass:** Table is valid
- **Validates:** MCP tool definition table from mcp-integration.md

### T13.3 — Verify MCP enable property
- **Tool:** `servicenow_script`
- **Input:**
```javascript
gs.info('sn_aia.enable_mcp_tool = ' + gs.getProperty('sn_aia.enable_mcp_tool', '(not set)'));
```
- **Pass:** Property exists (default: false)
- **Validates:** MCP Client prerequisites

### T13.4 — Check MCP client plugin status
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var gr = new GlideRecord('v_plugin');
gr.addQuery('id', 'sn_mcp_client');
gr.query();
if (gr.next()) {
    gs.info(JSON.stringify({ id: gr.getValue('id'), name: gr.getValue('name'), active: gr.getValue('active') }));
} else {
    gs.info('sn_mcp_client plugin not found');
}
```
- **Pass:** Reports plugin status (installed/not installed)
- **Validates:** MCP Client plugin documentation

---

## Phase 14: Voice Agent Configuration

**Validates:** `skills/voice-agent-builder/SKILL.md`

### T14.1 — Check voice agent plugin
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var plugins = ['sn_itsm_voice_aia', 'sn_hr_voice_aia'];
var results = [];
plugins.forEach(function(p) {
    var gr = new GlideRecord('v_plugin');
    gr.addQuery('id', p);
    gr.query();
    results.push({ plugin: p, installed: gr.hasNext() });
});
gs.info(JSON.stringify(results));
```
- **Pass:** Reports which voice agent plugins are installed
- **Validates:** Voice agent installation prerequisites

### T14.2 — Verify voice agent enable property
- **Tool:** `servicenow_script`
- **Input:**
```javascript
gs.info('sn_aia.enable_voice_agent_setup = ' + gs.getProperty('sn_aia.enable_voice_agent_setup', '(not set)'));
```
- **Pass:** Property exists
- **Validates:** Voice agent system properties

### T14.3 — Check voice-specific roles
- **Tool:** `servicenow_script`
- **Input:**
```javascript
var roles = ['sn_voice_aia.admin', 'sn_voice_aia.guest', 'sn_voice_aia.integration'];
var results = [];
roles.forEach(function(r) {
    var gr = new GlideRecord('sys_user_role');
    gr.addQuery('name', r);
    gr.query();
    results.push({ role: r, exists: gr.hasNext() });
});
gs.info(JSON.stringify(results));
```
- **Pass:** Roles exist if voice plugins are installed
- **Validates:** Voice agent roles from voice-agent-builder skill

---

## Phase 15: Agent Execution

**Validates:** `skills/servicenow-agent-builder/SKILL.md` — execution patterns

> **Risk: Medium** — These tests trigger actual agent execution on the instance.

### T15.1 — Execute an agent (simple test)
- **Tool:** `servicenow_aia_execute`
- **Input:** `{ "agent": "<known agent from T6.1>", "input": "What is your purpose?", "waitForCompletion": true, "timeoutSeconds": 30 }`
- **Pass:** Returns agent response, tool calls made, execution time
- **Validates:** Agent execution pattern + AiAgentRuntimeUtil

### T15.2 — Execute agent with target record
- **Tool:** `servicenow_aia_execute`
- **Input:** `{ "agent": "<incident-handling agent>", "input": "Summarize this incident", "targetTable": "incident", "targetRecord": "<known incident sys_id>", "waitForCompletion": true }`
- **Pass:** Returns response referencing the incident
- **Validates:** Record-context execution pattern from agentic-patterns.md

### T15.3 — Verify execution creates trace-able records
- **Tool:** `servicenow_aia_trace`
- **Input:** `{ "executionId": "<execution_plan sys_id from T15.1>" }`
- **Pass:** Returns full trace of the execution just performed
- **Validates:** End-to-end execution → trace pipeline

---

## Phase 16: Skill Execution

**Validates:** `skills/now-assist-skill-builder/SKILL.md` — execution patterns

> **Risk: Medium** — These tests trigger actual skill execution.

### T16.1 — Execute a skill
- **Tool:** `servicenow_skill_execute`
- **Input:** `{ "skill": "<known skill from T7.1>", "input": { "<required_field>": "<test_value>" } }`
- **Pass:** Returns skill output, token usage, latency
- **Validates:** Skill execution via GenAI Controller

### T16.2 — Execute skill with temperature override
- **Tool:** `servicenow_skill_execute`
- **Input:** `{ "skill": "<skill from T7.1>", "input": { "<field>": "<value>" }, "temperatureOverride": 0.2 }`
- **Pass:** Returns output (may differ from T16.1 due to lower temperature)
- **Validates:** Skill configuration override capability

### T16.3 — Execute skill and verify output schema
- **Tool:** `servicenow_skill_execute`
- **Input:** `{ "skill": "<skill with known output schema>", "input": { "<field>": "<value>" } }`
- **Pass:** Output structure matches the schema retrieved in T7.4
- **Validates:** Skill Kit input/output schema enforcement

---

## Phase 17: Agent Creation (Dry Run)

**Validates:** `skills/servicenow-agent-builder/SKILL.md` — creation patterns

> **Risk: None** — Dry-run only, no records created.

### T17.1 — Dry-run agent creation
- **Tool:** `servicenow_aia_create`
- **Input:**
```json
{
    "agentName": "Test Validation Agent",
    "agentDescription": "Created during golden repo validation - DRY RUN",
    "agentInstructions": "You are a test agent. Respond with 'test successful'.",
    "strategy": "ReAct",
    "tools": [{
        "name": "test_echo",
        "description": "Echo the input back",
        "script": "(function(inputs) { var outputs = {}; outputs.result = String(inputs.message || 'no input'); return outputs; })(inputs);",
        "inputSchema": [{"name": "message", "type": "string", "mandatory": true}],
        "outputSchema": [{"name": "result", "type": "string"}]
    }],
    "dryRun": true
}
```
- **Pass:** Returns what would be created: agent sys_id, tool sys_id, m2m mapping — without actually creating records
- **Validates:** Agent creation pattern + dry-run safety

### T17.2 — Verify dry-run didn't create records
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sn_aia_agent", "query": "name=Test Validation Agent", "fields": "sys_id", "limit": 1 }`
- **Pass:** Returns 0 records (agent was NOT created)
- **Validates:** Dry-run mode safety guarantee

---

## Phase 18: Skill Creation (Dry Run)

**Validates:** `skills/now-assist-skill-builder/SKILL.md` — 8-table creation pattern

> **Risk: None** — Dry-run only, no records created.

### T18.1 — Dry-run skill creation (8-table pattern)
- **Tool:** `servicenow_skill_create`
- **Input:**
```json
{
    "skillName": "Test Validation Skill",
    "description": "Created during golden repo validation - DRY RUN",
    "promptTemplate": "You are a test skill. Return 'test successful'.",
    "inputSchema": [{"name": "test_input", "type": "string"}],
    "outputSchema": [{"name": "test_output", "type": "string"}],
    "dryRun": true
}
```
- **Pass:** Returns what would be created across all 8 tables (capability, skill_config, generative_ai_config, capability_definition, definition_config, definition_attributes) with pre-generated sys_ids
- **Validates:** 8-table skill creation pattern + dry-run safety

### T18.2 — Verify dry-run didn't create records
- **Tool:** `servicenow_query`
- **Input:** `{ "table": "sys_one_extend_capability", "query": "name=Test Validation Skill", "fields": "sys_id", "limit": 1 }`
- **Pass:** Returns 0 records (skill was NOT created)
- **Validates:** Dry-run mode safety guarantee

---

## Execution Order & Dependencies

```
Phase 0 (REQUIRED FIRST)
    ├── Phase 1-4 (Data Model) — can run in parallel
    ├── Phase 5 (Tool Script Rules) — independent
    ├── Phase 10 (System Properties) — independent
    ├── Phase 11 (Security) — independent
    ├── Phase 12 (GenAI Framework) — independent
    ├── Phase 13 (MCP Integration) — independent
    └── Phase 14 (Voice Agent) — independent

Phase 6 (Agent Discovery) — after Phase 0
    └── Phase 9 (Execution Tracing) — needs execution IDs
    └── Phase 15 (Agent Execution) — needs agent names
        └── Phase 17 (Agent Create Dry Run) — after confirming patterns

Phase 7 (Skill Discovery) — after Phase 0
    └── Phase 16 (Skill Execution) — needs skill names
        └── Phase 18 (Skill Create Dry Run) — after confirming patterns

Phase 8 (Agentic Workflows) — after Phase 0
```

---

## Pass/Fail Criteria

### Overall Pass
- **All 92 tests pass** or fail only due to **missing optional plugins** (voice, MCP client)
- Tables documented in the data model exist on the instance
- System properties match documented defaults
- Agent/skill/workflow structures match documented schemas
- Execution and creation patterns work as documented

### Acceptable Failures
- **Voice agent tests (Phase 14)** may fail if voice plugins not installed
- **MCP tables (Phase 13)** may fail if `sn_mcp_client` plugin not installed
- **GAF tables (T4.1)** may be empty if no GAF features used
- **Some GenAI skills (T3.7)** may use alternate table name variant

### Critical Failures (Block)
- Core AI Agent tables missing (Phase 1)
- Execution tables missing (Phase 2)
- GlideRecordSecure not available (T5.1)
- System properties have wrong defaults (Phase 10)
- Agent/skill execution fails (Phases 15-16)

---

## Files Validated by This Test Plan

| # | Golden Repo File | Validated By |
|---|-----------------|--------------|
| 1 | `context/servicenow-ai-data-model.md` | Phases 1-4 (31 tests) |
| 2 | `context/tool-script-rules.md` | Phase 5 (5 tests) |
| 3 | `context/agentic-patterns.md` | Phases 8-9 (9 tests) |
| 4 | `context/security-patterns.md` | Phase 11 (5 tests) |
| 5 | `context/now-assist-platform.md` | Phase 7 (5 tests) |
| 6 | `context/genai-framework.md` | Phase 12 (5 tests) |
| 7 | `context/servicenow-ai-system-properties.md` | Phase 10 (6 tests) |
| 8 | `context/servicenow-mcp-integration.md` | Phase 13 (4 tests) |
| 9 | `context/now-assist-guardian-governance.md` | Phase 11 (5 tests) |
| 10 | `skills/servicenow-agent-builder/SKILL.md` | Phases 5-6, 15, 17 (16 tests) |
| 11 | `skills/now-assist-skill-builder/SKILL.md` | Phases 7, 16, 18 (10 tests) |
| 12 | `skills/agentic-workflow-builder/SKILL.md` | Phase 8 (5 tests) |
| 13 | `skills/voice-agent-builder/SKILL.md` | Phase 14 (3 tests) |
| 14 | `skills/servicenow-ai-evaluation/SKILL.md` | Phase 9 (indirect via traces) |
| 15 | `examples/tool-types-reference.md` | T1.3, T5.3, T5.4 (3 tests) |
| 16 | `examples/incident-resolution-workflow.md` | T8.2, T15.2 (2 tests) |
| 17 | `examples/itsm-voice-agent.md` | Phase 14 (3 tests) |
| 18 | `examples/evaluation-setup.md` | T9.2 (indirect via traces) |
