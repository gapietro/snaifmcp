# ServiceNow AI Data Model Reference

> Master reference for all AI Agent, Now Assist, GenAI Controller, Group Action Framework, and MCP Client related tables, fields, relationships, and API endpoints. Validated against ServiceNow Zurich instances.

---

## Overview

ServiceNow's AI infrastructure spans multiple table families:

- **sn_aia_*** -- AI Agent framework (agents, tools, teams, use cases, executions, properties, analytics)
- **sys_one_extend_*** -- Capability/skill registration and definition
- **sn_nowassist_*** -- Now Assist skill configuration
- **sys_generative_ai_*** -- LLM prompt and model settings
- **sys_genai_*** / **sn_gai_*** -- GenAI Controller skill definitions, prompt templates, versioning
- **sn_gaf_*** -- Group Action Framework (clustering, mapping, reducing)
- **sn_mcp_*** -- MCP Client (server registry, sessions, execution logs)

Understanding these tables and their relationships is essential for programmatically creating, querying, and debugging AI artifacts on ServiceNow.

---

## Table of Contents

1. [Core AI Agent Tables](#core-ai-agent-tables)
2. [Execution Tables](#execution-tables)
3. [Now Assist Skill Tables](#now-assist-skill-tables)
4. [GenAI Controller Tables](#genai-controller-tables)
5. [Group Action Framework (GAF) Tables](#group-action-framework-gaf-tables)
6. [MCP Client Tables](#mcp-client-tables)
7. [Agent Properties Table](#agent-properties-table)
8. [Analytics and Reporting Tables](#analytics-and-reporting-tables)
9. [Relationship Diagram](#relationship-diagram)
10. [Domain Separation](#domain-separation)
11. [Table Name Variants by Version](#table-name-variants-by-version)
12. [Data Retention Policies](#data-retention-policies)
13. [Common API Patterns](#common-api-patterns)
14. [Useful System Properties](#useful-system-properties)

---

## Core AI Agent Tables

### 1. sn_aia_agent -- AI Agent Definitions

Stores AI Agent definitions including reasoning strategy, execution mode, and system instructions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Agent display name |
| description | String | Yes | Agent purpose description |
| instructions | String | Yes | System prompt / instructions provided to the LLM for this agent |
| active | Boolean | Yes | Whether agent is enabled |
| strategy | Reference | Yes | Reference to `sn_aia_strategy` -- the reasoning strategy this agent uses |
| execution_mode | Choice | No | `copilot` (interactive, user-supervised) or `autopilot` (fully automated) |
| type | Choice | No | `chat` (conversational), `voice` (telephony), `external` (API-driven) |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_agent`

**Notes:**
- The `strategy` field is a reference to `sn_aia_strategy`, not a plain string. When creating via API, pass the sys_id of the desired strategy record.
- `execution_mode` defaults to `copilot` if not specified. Autopilot agents execute without user confirmation prompts.
- `type` determines the interaction channel. Most custom agents use `chat`.

---

### 2. sn_aia_tool -- Tool Definitions

Stores AI Agent tool configurations including scripts, schemas, and execution behavior.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier (can be pre-generated for deterministic deployment) |
| name | String | Yes | Human-readable tool name |
| internal_name | String | Yes | Unique internal identifier (used in code references) |
| description | String | Yes | What this tool does (shown to the agent during reasoning) |
| active | Boolean | Yes | Whether tool is enabled |
| script | Script | Conditional | Tool implementation (IIFE format); required for `script` tool_type |
| input_schema | JSON String | Yes | Input parameters definition |
| output_schema | JSON String | Yes | Output structure definition |
| tool_type | Choice | Yes | Determines execution mechanism (see values below) |
| execution_mode | Choice | No | `supervised` (requires user approval) or `autonomous` (auto-executes) |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_tool`

**tool_type Values:**

| Value | Description |
|-------|-------------|
| `script` | Custom server-side JavaScript (IIFE) |
| `catalog_item` | Executes a Service Catalog item |
| `flow_action` | Triggers a Flow Designer action |
| `subflow` | Triggers a Flow Designer subflow |
| `record_operation` | CRUD operations on ServiceNow records |
| `search_retrieval` | Searches AI Search or other retrieval sources |
| `web_search` | Performs external web search |
| `knowledge_graph` | Queries ServiceNow Knowledge Graph |
| `now_assist_skill` | Invokes a Now Assist skill as a tool |
| `conversational_topic` | Routes to a Virtual Agent conversational topic |
| `desktop_action` | Triggers a UI action on the agent workspace |
| `file_upload` | Handles file upload operations |
| `mcp_server_tool` | Invokes a tool from a registered MCP server |

**Input Schema Format:**
```json
[{"name": "field_name", "type": "string", "mandatory": true, "description": "What this parameter is for"}]
```

**Supported schema types:** `string`, `number`, `boolean`, `array`, `object`

---

### 3. sn_aia_agent_tool_m2m -- Agent-to-Tool Mapping

Many-to-many relationship linking agents to their available tools.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| agent | Reference | Yes | Reference to `sn_aia_agent` |
| tool | Reference | Yes | Reference to `sn_aia_tool` |
| active | Boolean | Yes | Whether this mapping is active |
| max_auto_executions | Integer | No | Maximum number of times this tool can auto-execute without user confirmation in a single conversation turn |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_agent_tool_m2m`

**Notes:**
- `max_auto_executions` applies only when the tool's `execution_mode` is `autonomous`. A value of 0 or empty means unlimited.
- Deactivating a mapping (`active=false`) removes the tool from the agent's available tool list without deleting the tool definition itself.

---

### 4. sn_aia_usecase -- Agentic Workflows (Orchestrator)

Defines agentic workflows (use cases) with an orchestrator agent that coordinates execution.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Use case display name |
| description | String | Yes | What this workflow accomplishes |
| active | Boolean | Yes | Whether use case is enabled |
| orchestrator_agent | Reference | Yes | Reference to `sn_aia_agent` -- the agent that orchestrates this workflow |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_usecase`

**Notes:**
- The orchestrator agent manages the overall workflow and delegates to other agents or tools.
- Use cases serve as the top-level entry point for trigger configurations.
- A single agent can orchestrate multiple use cases.

---

### 5. sn_aia_strategy -- Reasoning Strategies

Defines the reasoning strategies available for AI Agents.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Strategy name |
| description | String | No | What this strategy does and when to use it |

**API Endpoint:** `GET /api/now/table/sn_aia_strategy`

**Known Strategy Records:**

| Name | Description | Best For |
|------|-------------|----------|
| ReAct | Reason-Act loop; reasons about what to do, acts, observes result, repeats | Most use cases; reliable tool calling |
| ReActivePlanner | Plans all steps upfront, then executes sequentially | Multi-step deterministic workflows |
| CoPilot | Interactive user assistance with confirmation prompts | User-facing chat agents (~86% of OOTB agents) |
| AutoPilot | Fully automated execution without user intervention | Background processing (~7% of OOTB agents) |

**Notes:**
- Strategy records are typically seeded by the platform. Avoid creating custom strategies unless you have deep understanding of the agent runtime.
- Agents reference strategies via the `strategy` field on `sn_aia_agent`.

---

### 6. sn_aia_team -- Agent Teams

Groups of agents that can collaborate on tasks.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Team name |
| description | String | No | Team purpose and scope |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_team`

---

### 7. sn_aia_team_member -- Team Membership

Maps agents to teams for collaborative workflows.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| team | Reference | Yes | Reference to `sn_aia_team` |
| agent | Reference | Yes | Reference to `sn_aia_agent` |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_team_member`

**Notes:**
- An agent can belong to multiple teams.
- Team membership determines which agents the orchestrator can delegate to in multi-agent workflows.

---

### 8. sn_aia_trigger_configuration -- Trigger Configurations

Defines how agentic workflows (use cases) are triggered.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| usecase | Reference | Yes | Reference to `sn_aia_usecase` |
| trigger_type | Choice | Yes | How the workflow is triggered (see values below) |
| table | String | Conditional | Target table name (required for `record` trigger_type) |
| conditions | String | No | Encoded query or conditions that must be met |
| active | Boolean | Yes | Whether this trigger is active |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_trigger_configuration`

**trigger_type Values:**

| Value | Description |
|-------|-------------|
| `record` | Triggered by record insert/update on the specified `table` matching `conditions` |
| `scheduled` | Triggered on a schedule (cron-like) |
| `chat` | Triggered by a user chat interaction |
| `API` | Triggered programmatically via REST API |

---

### 9. sn_aia_agent_config -- Agent Proficiency Configuration

Controls which agents are active per proficiency level or context.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| agent | Reference | Yes | Reference to `sn_aia_agent` |
| active | Boolean | Yes | Whether this agent configuration is active |

**API Endpoint:** `GET/POST /api/now/table/sn_aia_agent_config`

**Notes:**
- Used to enable/disable agents at a system level independent of the agent's own `active` flag.
- Useful for A/B testing and staged rollouts.

---

## Execution Tables

### 10. sn_aia_execution_plan -- Execution Plans

Tracks plan-level executions by conversation ID. This is the top-level execution record.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| conversation_id | String | Yes | Conversation thread ID linking related messages and executions |
| state | Choice | Auto | `running`, `completed`, `failed` |
| run_type | Choice | Yes | How the execution was initiated (see values below) |
| related_task | Reference | No | Reference to the task record that triggered or is associated with this execution |
| related_task_table | String | No | Table name of the related task (e.g., `incident`, `sc_task`) |
| context | JSON String | No | Additional execution context (serialized JSON) |

**API Endpoint:** `GET /api/now/table/sn_aia_execution_plan`

**run_type Values:**

| Value | Description |
|-------|-------------|
| `API` | Triggered via REST API |
| `Chat` | Triggered by user chat interaction |
| `Evaluation` | Triggered by an evaluation/test harness |
| `Testing` | Triggered during testing/QA |
| `Trigger` | Triggered by a `sn_aia_trigger_configuration` |

---

### 11. sn_aia_execution_task -- Execution Tasks

Individual task records within an execution plan, tracking which agent handled each step.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| execution_plan | Reference | Yes | Reference to `sn_aia_execution_plan` |
| status | Choice | Auto | Task status (e.g., `pending`, `running`, `completed`, `failed`) |
| agent | Reference | Yes | Reference to `sn_aia_agent` that executed this task |

**API Endpoint:** `GET /api/now/table/sn_aia_execution_task`

**Notes:**
- A single execution plan may contain multiple execution tasks (e.g., when an orchestrator delegates to multiple agents).
- The `agent` field identifies which specific agent handled this portion of the workflow.

---

### 12. sn_aia_tools_execution -- Tool Execution Records

Tracks individual tool calls within an execution plan, including inputs, outputs, timing, and errors.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| execution_plan | Reference | Yes | Reference to `sn_aia_execution_plan` |
| tool_name | String | Auto | Name of the tool that was called |
| input | String | Auto | Tool input (JSON) |
| output | String | Auto | Tool output (JSON) |
| status | Choice | Auto | `success`, `failure`, `timeout` |
| error_message | String | No | Error details if execution failed |
| duration | Integer | Auto | Call duration in milliseconds |
| step_number | Integer | Auto | Sequential order within the execution plan |

**API Endpoint:** `GET /api/now/table/sn_aia_tools_execution`

**DATA RETENTION:** Records in this table expire after **13 months**. Plan accordingly for any long-term analytics or auditing needs. Export data before expiration if required.

**Notes:**
- This table provides the most detailed view of what an agent actually did during execution.
- The `step_number` field enables reconstruction of the agent's reasoning chain.
- Query by `execution_plan` to get all tool calls for a given conversation.

---

### 13. sn_aia_message -- Conversation Messages

Stores individual messages in AI agent conversations, including both user and agent messages.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| conversation_id | String | Yes | Conversation thread ID (matches `sn_aia_execution_plan.conversation_id`) |
| role | Choice | Yes | Message author role: `user`, `assistant`, `system`, `tool` |
| message | String | Yes | Message content (plain text or JSON for tool messages) |
| order | Integer | Auto | Sequential message order within the conversation |

**API Endpoint:** `GET /api/now/table/sn_aia_message`

**Notes:**
- Messages are ordered by the `order` field to reconstruct conversation flow.
- `tool` role messages contain the tool name and output from tool executions.
- Useful for debugging agent behavior by reviewing the full conversation history.

---

## Now Assist Skill Tables

### 14. sys_one_extend_capability -- Capability Registration

Registers a skill as a Now Assist capability. This is the root record that other skill tables reference.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Capability identifier (pre-generate for deterministic deployment) |
| name | String | Yes | Skill display name |
| description | String | Yes | Skill description (shown in Now Assist admin) |
| type | String | Yes | Usually `"skill"` |
| active | Boolean | Yes | Whether capability is active |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_capability`

---

### 15. sn_nowassist_skill_config -- Skill Configuration

Skill metadata and configuration settings linking to a registered capability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Config identifier |
| name | String | Yes | Skill name |
| description | String | Yes | Skill description |
| active | Boolean | Yes | Whether skill is active |
| skill_type | String | Yes | Skill classification, e.g., `"agentic"`, `"generative"`, `"search"` |
| capability | Reference | Yes | Reference to `sys_one_extend_capability` |

**API Endpoint:** `GET/POST /api/now/table/sn_nowassist_skill_config`

---

### 16. sys_generative_ai_config -- LLM Prompt/Model Settings

Configures the LLM prompt template and model association for a skill or AI feature.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Config identifier |
| name | String | Yes | Configuration name |
| active | Boolean | Yes | Whether config is active |
| prompt | String | Yes | System prompt template for the LLM |
| model | Reference | No | Reference to the LLM model record (sys_id); if empty, uses system default |

**API Endpoint:** `GET/POST /api/now/table/sys_generative_ai_config`

**Notes:**
- The `prompt` field supports template variables using `${variable}` syntax.
- When `model` is not specified, the platform default LLM is used.
- Multiple configs can exist per skill for different contexts or versions.

---

### 17. sys_one_extend_capability_definition -- Capability Definitions

Defines the API interface for a capability. **CRITICAL** for skill discoverability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Pre-generate | Definition identifier |
| capability | Reference | Yes | Reference to `sys_one_extend_capability` |
| api | String | **CRITICAL** | API name -- must be set or skill is not discoverable |
| api_type | String | **CRITICAL** | API type -- must be set or skill is not discoverable |
| active | Boolean | Yes | Whether definition is active |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_capability_definition`

**CRITICAL:** Both the `api` and `api_type` fields **MUST** be set. If either is empty or missing, the skill will not appear in Now Assist panels and will not be invocable. This is the most common cause of "skill not found" issues.

---

### 18. sys_one_extend_definition_config -- Definition Configuration

Configuration for a capability definition. Controls whether this definition is the active/default one.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| definition | Reference | Yes | Reference to `sys_one_extend_capability_definition` |
| default | Boolean | **CRITICAL** | **Must be `true`** -- otherwise the skill configuration will not load |
| active | Boolean | Yes | Whether this config is active |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_definition_config`

**CRITICAL:** The `default` field **MUST** be set to `true`. If `false` or unset, the platform will not load the associated skill configuration, and the skill will appear registered but non-functional. This is the second most common cause of skill deployment failures.

---

### 19. sys_one_extend_definition_attribute -- Input/Output Attributes

Defines the input and output parameters of a skill capability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| definition | Reference | Yes | Reference to `sys_one_extend_capability_definition` |
| name | String | Yes | Attribute name (parameter name) |
| type | String | Yes | Data type: `"string"`, `"reference"`, `"boolean"`, `"integer"`, `"json"` |
| value | String | Yes | Attribute value or default value |

**API Endpoint:** `GET/POST /api/now/table/sys_one_extend_definition_attribute`

**Notes:**
- Attributes define the contract between the skill caller and the skill implementation.
- Input attributes specify what data the skill expects; output attributes specify what it returns.
- The `type` field determines validation and serialization behavior.

---

## GenAI Controller Tables

### 20. sys_genai_skill / sn_gai_skill -- Skill Definitions

Skill definitions managed by the GenAI Controller. The table name varies by ServiceNow version.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Skill name |
| description | String | No | Skill description |
| active | Boolean | Yes | Whether skill is active |
| type | String | No | Skill type classification |

**API Endpoint:** `GET /api/now/table/sys_genai_skill` or `GET /api/now/table/sn_gai_skill`

**IMPORTANT:** The table name varies between versions. Always probe both `sys_genai_skill` and `sn_gai_skill` to determine which exists on your instance. Use a try/catch pattern when querying programmatically.

---

### 21. sys_genai_prompt_template -- Prompt Templates

Prompt templates linked to GenAI skills for managing prompt versions and variants.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Template name |
| skill | Reference | Yes | Reference to `sys_genai_skill` or `sn_gai_skill` |
| prompt | String | Yes | Prompt template text (supports variables) |
| active | Boolean | Yes | Whether template is active |

**API Endpoint:** `GET /api/now/table/sys_genai_prompt_template`

---

### 22. sys_genai_skill_version -- Skill Versioning

Version history for GenAI skills, enabling rollback and audit trails.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| skill | Reference | Yes | Reference to the parent skill |
| version | String | Yes | Version identifier |
| active | Boolean | Yes | Whether this version is the active version |
| prompt | String | No | Prompt text for this version |

**API Endpoint:** `GET /api/now/table/sys_genai_skill_version`

---

## Group Action Framework (GAF) Tables

The Group Action Framework clusters related records and applies AI-driven actions to groups. Used for incident clustering, similar case detection, and bulk action recommendations.

### 23. sn_gaf_record_group -- Record Groups

Clusters of related records identified by the GAF clustering algorithm.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Auto | Group display name |
| table | String | Yes | Source table for grouped records (e.g., `incident`) |
| state | Choice | Auto | Group state (e.g., `active`, `closed`) |
| record_count | Integer | Auto | Number of records in this group |

**API Endpoint:** `GET /api/now/table/sn_gaf_record_group`

---

### 24. sn_gaf_record_group_detail -- Group Detail Records

Individual records belonging to each group.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to `sn_gaf_record_group` |
| record_id | String | Yes | sys_id of the grouped record |
| table | String | Yes | Table name of the grouped record |
| similarity_score | Decimal | Auto | How similar this record is to the group representative |

**API Endpoint:** `GET /api/now/table/sn_gaf_record_group_detail`

---

### 25. sn_gaf_action_strategy_result -- Strategy Results

Results from representative record selection within a group. Identifies the most representative record.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to `sn_gaf_record_group` |
| representative_record | String | No | sys_id of the selected representative record |
| strategy | String | Yes | Strategy used for selection |
| result | String | No | Strategy execution result details |

**API Endpoint:** `GET /api/now/table/sn_gaf_action_strategy_result`

---

### 26. sn_gaf_action_mapper_result -- Mapper Results

Maps new incoming records to existing clusters based on similarity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to the matched `sn_gaf_record_group` |
| source_record | String | Yes | sys_id of the new record being mapped |
| source_table | String | Yes | Table name of the new record |
| confidence | Decimal | Auto | Mapping confidence score (0.0 to 1.0) |

**API Endpoint:** `GET /api/now/table/sn_gaf_action_mapper_result`

---

### 27. sn_gaf_action_reducer_result -- Reducer Results

AI-generated insights and summaries for entire clusters of records.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| record_group | Reference | Yes | Reference to `sn_gaf_record_group` |
| insight | String | Auto | AI-generated insight or summary for the group |
| action_recommendation | String | No | Recommended action for the group |

**API Endpoint:** `GET /api/now/table/sn_gaf_action_reducer_result`

---

## MCP Client Tables

ServiceNow's built-in MCP (Model Context Protocol) client tables for managing external tool server integrations.

### 28. sn_mcp_execution_logs -- MCP Execution Logs

Tracks request/response logs for MCP server interactions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| method | String | Auto | MCP method called (e.g., `tools/call`, `tools/list`, `resources/list`) |
| request | String | Auto | Full request payload (JSON) |
| response | String | Auto | Full response payload (JSON) |
| session | Reference | No | Reference to `sn_mcp_client_server_session_mapping` |
| status | Choice | Auto | `success`, `failure`, `timeout` |
| duration | Integer | Auto | Request duration in milliseconds |
| tool_name | String | No | Specific tool name if this was a `tools/call` request |

**API Endpoint:** `GET /api/now/table/sn_mcp_execution_logs`

---

### 29. sn_mcp_client_server_session_mapping -- Session Mappings

Maps active sessions to MCP servers by capability, tracking connection state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| server | Reference | Yes | Reference to `sn_mcp_server` |
| session_id | String | Auto | Unique session identifier |
| capability | String | No | Capability or context for this session |
| state | Choice | Auto | Session state (e.g., `active`, `closed`, `error`) |

**API Endpoint:** `GET /api/now/table/sn_mcp_client_server_session_mapping`

---

### 30. sn_mcp_server -- MCP Server Registry

Registry of configured MCP servers that ServiceNow can connect to as a client.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Server display name |
| url | String | Yes | Server endpoint URL |
| active | Boolean | Yes | Whether this server is enabled |
| description | String | No | Server description and purpose |
| auth_type | String | No | Authentication type (e.g., `none`, `bearer`, `basic`) |

**API Endpoint:** `GET/POST /api/now/table/sn_mcp_server`

**Notes:**
- MCP servers registered here can be consumed by AI Agents via tools with `tool_type = mcp_server_tool`.
- The platform manages session lifecycle automatically; use `sn_mcp_client_server_session_mapping` to monitor active connections.

---

## Agent Properties Table

### 31. sn_aia_property -- Agent Behavior Properties

System properties that affect AI Agent behavior at the platform level.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| name | String | Yes | Property name (dot-notation key) |
| value | String | Yes | Property value |
| description | String | No | What this property controls |
| type | String | No | Value type (string, integer, boolean) |

**API Endpoint:** `GET /api/now/table/sn_aia_property`

**Notes:**
- These properties override system defaults for AI Agent behavior.
- Changes take effect immediately without server restart.
- See the [Useful System Properties](#useful-system-properties) section for common property names.

---

## Analytics and Reporting Tables

### 32. sn_aia_report_metric -- Report Metrics

Stores computed metrics for AI Agent reporting dashboards.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| metric_name | String | Yes | Name of the metric |
| metric_value | String | Yes | Computed metric value |
| agent | Reference | No | Reference to `sn_aia_agent` (if agent-specific) |
| period | String | No | Reporting period |
| computed_on | DateTime | Auto | When this metric was last computed |

**API Endpoint:** `GET /api/now/table/sn_aia_report_metric`

---

### 33. sn_aia_gen_ai_m2m -- Execution-to-GenAI Log Mapping

Many-to-many mapping between execution tasks and Gen AI log metadata for traceability.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| execution_task | Reference | Yes | Reference to `sn_aia_execution_task` |
| gen_ai_log | Reference | Yes | Reference to Gen AI log metadata record |

**API Endpoint:** `GET /api/now/table/sn_aia_gen_ai_m2m`

**Notes:**
- Provides the link between agent execution records and the underlying LLM call logs.
- Essential for debugging prompt/response issues and token usage analysis.
- Gen AI logs have their own retention policy (see [Data Retention Policies](#data-retention-policies)).

---

### 34. sys_agent_access_role_configuration -- Agent Access Roles

Configures which roles have access to specific AI Agents.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sys_id | GUID | Auto | Unique identifier |
| agent | Reference | Yes | Reference to `sn_aia_agent` |
| role | Reference | Yes | Reference to `sys_user_role` |
| access_type | Choice | No | Type of access granted (e.g., `use`, `admin`, `view`) |

**API Endpoint:** `GET /api/now/table/sys_agent_access_role_configuration`

**Notes:**
- Controls user access to agents in Now Assist panels and chat interfaces.
- Without a role configuration, agents may not be visible to non-admin users.

---

## Relationship Diagram

```
                           ┌──────────────────────┐
                           │   sn_aia_strategy     │
                           └──────────┬───────────┘
                                      │ (strategy)
                                      ▼
┌──────────────┐          ┌──────────────────────┐          ┌──────────────────┐
│ sn_aia_team  │          │    sn_aia_agent       │          │   sn_aia_tool    │
└──────┬───────┘          └──┬──────┬──────┬─────┘          └────────┬─────────┘
       │                     │      │      │                         │
       ▼                     │      │      │                         │
┌──────────────────┐         │      │      │     ┌───────────────────────────────┐
│sn_aia_team_member│◄────────┘      │      └────►│  sn_aia_agent_tool_m2m        │◄──┘
└──────────────────┘                │            └───────────────────────────────┘
                                    │
              ┌─────────────────────┼──────────────────────────┐
              │                     │                          │
              ▼                     ▼                          ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐
│ sn_aia_agent_config  │  │ sn_aia_usecase   │  │ sys_agent_access_role_config  │
└─────────────────────┘  └────────┬─────────┘  └──────────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────────┐
                    │sn_aia_trigger_configuration   │
                    └──────────────────────────────┘

                    === Execution Flow ===

┌──────────────────────────┐
│  sn_aia_execution_plan   │ (top-level, keyed by conversation_id)
└──┬──────────┬────────────┘
   │          │
   ▼          ▼
┌────────────────────┐  ┌─────────────────────────┐  ┌────────────────────┐
│sn_aia_execution_task│  │ sn_aia_tools_execution  │  │  sn_aia_message    │
└────────┬───────────┘  └─────────────────────────┘  └────────────────────┘
         │                                            (linked by conversation_id)
         ▼
┌─────────────────────┐
│ sn_aia_gen_ai_m2m   │──► Gen AI Log Metadata
└─────────────────────┘

                    === Now Assist Skill Chain ===

┌────────────────────────────┐
│ sys_one_extend_capability  │  (root)
└──┬─────────┬───────────────┘
   │         │
   ▼         ▼
┌──────────────────────────┐  ┌──────────────────────────────────────┐
│sn_nowassist_skill_config │  │sys_one_extend_capability_definition  │
└──────────────────────────┘  └──┬──────────────┬───────────────────┘
                                 │              │
┌────────────────────────┐       ▼              ▼
│sys_generative_ai_config│  ┌─────────────────────────────────┐  ┌────────────────────────────────────┐
└────────────────────────┘  │sys_one_extend_definition_config │  │sys_one_extend_definition_attribute │
                            └─────────────────────────────────┘  └────────────────────────────────────┘

                    === GenAI Controller ===

┌──────────────────────────┐
│ sys_genai_skill          │
│ (or sn_gai_skill)        │
└──┬──────────┬────────────┘
   │          │
   ▼          ▼
┌────────────────────────────┐  ┌──────────────────────────────┐
│sys_genai_prompt_template   │  │ sys_genai_skill_version      │
└────────────────────────────┘  └──────────────────────────────┘

                    === Group Action Framework ===

┌───────────────────────┐
│ sn_gaf_record_group   │
└──┬────┬────┬────┬─────┘
   │    │    │    │
   ▼    │    │    ▼
┌────────────────────────────┐  ┌───────────────────────────────────┐
│sn_gaf_record_group_detail  │  │sn_gaf_action_strategy_result     │
└────────────────────────────┘  └───────────────────────────────────┘
        │    │
        ▼    ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│sn_gaf_action_mapper_result   │  │sn_gaf_action_reducer_result  │
└──────────────────────────────┘  └──────────────────────────────┘

                    === MCP Client ===

┌──────────────────┐
│  sn_mcp_server   │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ sn_mcp_client_server_session_mapping       │
└────────────────────┬───────────────────────┘
                     │
                     ▼
┌────────────────────────────────┐
│    sn_mcp_execution_logs       │
└────────────────────────────────┘
```

---

## Domain Separation

All AI Agent tables support **Basic** domain separation.

**Support Type:** Basic

**Key behavior:**
- Every table listed in this reference includes a `sys_domain` field.
- Records are scoped to the domain of the user who created them.
- Queries automatically filter by the caller's domain unless `sysparm_domain=global` is specified.
- Global domain records (domain = `global`) are visible to all domains.
- When creating records via API, the `sys_domain` field is set automatically based on the session domain. To create records in a specific domain, set the domain context before the API call.

**Practical implications for multi-domain instances:**
- Agents created in Domain A are not visible to users in Domain B.
- Tools can be shared across domains by creating them in the global domain.
- Execution records inherit the domain of the agent that ran.
- Skill registrations (`sys_one_extend_capability`) are typically global-scoped.

---

## Table Name Variants by Version

ServiceNow has renamed several AI-related tables across releases. When writing code that must work across versions, probe for table existence before querying.

| Zurich Table Name | Previous Names (Vancouver/Washington) | Notes |
|-------------------|---------------------------------------|-------|
| `sn_aia_execution_plan` | `sn_aia_agent_execution` | Zurich renamed to plan-centric model |
| `sn_aia_execution_task` | (new in Zurich) | Did not exist in earlier versions |
| `sn_aia_tools_execution` | `sn_aia_tool_execution` | Note: plural "tools" in Zurich |
| `sn_aia_message` | (new in Zurich) | Message history was embedded in execution records previously |
| `sys_genai_skill` | `sn_gai_skill` | Both may exist; probe both |
| `sn_aia_usecase` | (new in Zurich) | Agentic workflows/orchestration is a Zurich feature |
| `sn_aia_team` | (new in Zurich) | Multi-agent teams are a Zurich feature |
| `sn_aia_trigger_configuration` | (new in Zurich) | Trigger-based workflows are a Zurich feature |
| `sn_mcp_server` | (new in Zurich) | MCP Client support is a Zurich feature |

**Recommended probe pattern:**
```javascript
// Try Zurich table name first, fall back to legacy
function getTableName(zurichName, legacyName) {
    try {
        var gr = new GlideRecord(zurichName);
        gr.setLimit(1);
        gr.query();
        return zurichName;
    } catch (e) {
        return legacyName;
    }
}

var executionTable = getTableName('sn_aia_execution_plan', 'sn_aia_agent_execution');
var toolExecTable = getTableName('sn_aia_tools_execution', 'sn_aia_tool_execution');
var skillTable = getTableName('sys_genai_skill', 'sn_gai_skill');
```

---

## Data Retention Policies

Different AI tables have different data retention windows. Plan data exports and archival strategies accordingly.

| Table | Retention Period | Notes |
|-------|-----------------|-------|
| `sn_aia_tools_execution` | **13 months** | Tool execution records auto-expire. Export before expiration for long-term analysis. |
| Gen AI Logs (LLM call logs) | **6 months** | Includes prompt/response pairs, token counts, latency. Linked via `sn_aia_gen_ai_m2m`. |
| `sn_aia_execution_plan` | No auto-expiration | Retained indefinitely, but consider archival for performance. |
| `sn_aia_execution_task` | No auto-expiration | Retained indefinitely. |
| `sn_aia_message` | No auto-expiration | Retained indefinitely, but can grow large on active instances. |
| `sn_mcp_execution_logs` | Instance-dependent | Check `sn_mcp.log.retention_days` property; default varies. |

**Recommendations:**
- Set up scheduled exports for `sn_aia_tools_execution` if you need data older than 13 months.
- Monitor table growth on `sn_aia_message` for high-volume instances.
- Use `sn_aia_gen_ai_m2m` to join execution tasks to Gen AI logs before the 6-month window closes.
- Consider creating a mid-table (e.g., custom reporting table) for long-term KPI tracking.

---

## Common API Patterns

### REST API Base URL
```
https://{instance}.service-now.com/api/now/table/{table_name}
```

### Authentication
```bash
# Basic Auth
curl -u "username:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent"

# Bearer Token (OAuth)
curl -H "Authorization: Bearer ${TOKEN}" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent"
```

### Create Record (POST)
```bash
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"name":"My Agent","active":"true","instructions":"You are a helpful agent."}' \
  "https://instance.service-now.com/api/now/table/sn_aia_agent"
```

### Query with Filters (GET)
```bash
# Get all active agents with specific fields
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent?sysparm_query=active=true&sysparm_fields=name,sys_id,execution_mode&sysparm_limit=10"
```

### Query Execution History
```bash
# Get tool executions for a specific conversation
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_tools_execution?sysparm_query=execution_plan.conversation_id=CONV_ID_HERE&sysparm_fields=tool_name,input,output,status,duration,step_number&sysparm_orderby=step_number"
```

### Query Agent Tools
```bash
# Get all tools mapped to a specific agent
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent_tool_m2m?sysparm_query=agent=AGENT_SYS_ID&active=true&sysparm_fields=tool.name,tool.internal_name,tool.tool_type"
```

### Create a Complete Skill (Multi-Step)
```bash
# Step 1: Create capability
CAPABILITY_ID=$(uuidgen)
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -d "{\"sys_id\":\"${CAPABILITY_ID}\",\"name\":\"My Skill\",\"type\":\"skill\",\"active\":\"true\"}" \
  "https://instance.service-now.com/api/now/table/sys_one_extend_capability"

# Step 2: Create capability definition (CRITICAL: set api and api_type)
DEFINITION_ID=$(uuidgen)
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -d "{\"sys_id\":\"${DEFINITION_ID}\",\"capability\":\"${CAPABILITY_ID}\",\"api\":\"my_api\",\"api_type\":\"my_type\",\"active\":\"true\"}" \
  "https://instance.service-now.com/api/now/table/sys_one_extend_capability_definition"

# Step 3: Create definition config (CRITICAL: default=true)
curl -X POST -u "admin:password" \
  -H "Content-Type: application/json" \
  -d "{\"definition\":\"${DEFINITION_ID}\",\"default\":\"true\",\"active\":\"true\"}" \
  "https://instance.service-now.com/api/now/table/sys_one_extend_definition_config"
```

### Batch Operations with sysparm_exclude_reference_link
```bash
# Faster queries by excluding reference link metadata
curl -u "admin:password" \
  "https://instance.service-now.com/api/now/table/sn_aia_agent?sysparm_exclude_reference_link=true&sysparm_limit=100"
```

---

## Useful System Properties

### AI Agent Core Properties

| Property | Default | Description |
|----------|---------|-------------|
| `sn_aia.log.level` | `info` | AI Agent logging level (`debug`, `info`, `warn`, `error`) |
| `sn_aia.max_tokens` | varies | Maximum LLM tokens per agent request |
| `sn_aia.timeout` | `120` | Agent execution timeout in seconds |
| `sn_aia.max_iterations` | `25` | Maximum reasoning loop iterations before forced stop |
| `sn_aia.tool.timeout` | `30` | Individual tool execution timeout in seconds |
| `sn_aia.tool.max_output_size` | varies | Maximum size of tool output (truncated if exceeded) |
| `sn_aia.agent.max_context_tokens` | varies | Maximum tokens in agent conversation context |
| `sn_aia.agent.default_strategy` | `ReAct` | Default reasoning strategy for new agents |
| `sn_aia.execution.retention_days` | `395` | Days to retain tool execution records (~13 months) |

### Now Assist Properties

| Property | Default | Description |
|----------|---------|-------------|
| `glide.servlet.uri` | instance URL | Instance base URL (used for callback construction) |
| `now_assist.enabled` | `true` | Master switch for Now Assist features |
| `now_assist.panel.enabled` | `true` | Enable/disable Now Assist panel in workspace |
| `now_assist.skill.debug` | `false` | Enable debug logging for skill execution |
| `sn_nowassist.skill.timeout` | `60` | Skill execution timeout in seconds |

### GenAI Controller Properties

| Property | Default | Description |
|----------|---------|-------------|
| `sys_genai.default_model` | varies | Default LLM model sys_id |
| `sys_genai.log.retention_days` | `180` | Days to retain Gen AI logs (~6 months) |
| `sys_genai.max_prompt_tokens` | varies | Maximum tokens in prompt |
| `sys_genai.max_response_tokens` | varies | Maximum tokens in LLM response |
| `sys_genai.rate_limit.per_minute` | varies | Rate limit for LLM calls per minute |

### MCP Client Properties

| Property | Default | Description |
|----------|---------|-------------|
| `sn_mcp.enabled` | `true` | Master switch for MCP client features |
| `sn_mcp.log.retention_days` | varies | Days to retain MCP execution logs |
| `sn_mcp.session.timeout` | `300` | MCP session timeout in seconds |
| `sn_mcp.max_concurrent_sessions` | varies | Maximum concurrent MCP server sessions |

### Performance and Debugging Properties

| Property | Default | Description |
|----------|---------|-------------|
| `sn_aia.debug.trace_enabled` | `false` | Enable detailed execution tracing (performance impact) |
| `sn_aia.debug.log_tool_io` | `false` | Log full tool input/output (storage impact) |
| `sn_aia.cache.strategy_ttl` | `3600` | Strategy cache TTL in seconds |
| `sn_aia.metrics.enabled` | `true` | Enable metrics collection for `sn_aia_report_metric` |

---

*This reference is validated against ServiceNow Zurich instances. Table names and field availability may vary across versions. See the [Table Name Variants by Version](#table-name-variants-by-version) section for cross-version compatibility guidance.*
