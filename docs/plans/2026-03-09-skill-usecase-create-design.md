# Design: servicenow_skill_create Rewrite + servicenow_aia_usecase_create

**Date:** 2026-03-09
**Issue:** #77 (Now-AI-Foundry/tool-foundry-mcp)
**Branch:** `feature/77-skill-usecase-create`

## Scope

| Tool | Change | Tables |
|------|--------|--------|
| `servicenow_skill_create` | Full rewrite | 12 tables, ~24 API calls, Phase 8 GlideUpdateManager2 |
| `servicenow_aia_create` | No change | Stays as standalone Agent + Tools + M2M |
| `servicenow_aia_usecase_create` | New tool | 6 tables: Tool → Team → Use Case → Agent → Team Member → M2M |

**Reference:** `gapietro/snagentskillsbuild` Python scripts (`create_skill.py`, `create_agent.py`)

## File Changes

- `src/servicenow/tools-skills.ts` — rewrite `handleSkillCreate` + `SERVICENOW_SKILL_CREATE_TOOL` schema
- `src/servicenow/tools-aia.ts` — add `SERVICENOW_AIA_USECASE_CREATE_TOOL` + `handleAiaUsecaseCreate`
- `src/servicenow/table-discovery.ts` — add new Skills Kit + AIA table constants
- `src/index.ts` — register `servicenow_aia_usecase_create`
- `test/validate-servicenow.ts` — new dry-run test cases for both tools

---

## servicenow_skill_create Rewrite

### Input Schema

```
Required:
  skillName        — Skill display name
  description      — What this skill does
  promptTemplate   — System prompt template with {{variable}} placeholders

Optional inputs/outputs:
  inputs[]         — [{name, label, description, defaultValue}]
  outputs[]        — Additional outputs beyond standard 5
  model            — LLM model (default: "llm_generic_small")
  temperature      — default "0.2"
  maxTokens        — default "500"

Optional sys_id overrides (auto-resolved if omitted):
  roleSysId                  — itil role
  skillFamilySysId           — "Other" skill family
  llmFlowSysId               — Now LLM Generic flow
  categorySysId              — "Other" category
  truncateStrategySysId      — default truncation strategy
  diagramBuilderConfigSysId  — Skills Kit diagram builder config

  dryRun           — default true
```

### Execution Flow

```
Pre-flight: Resolve all 6 sys_ids via dynamic queries
  roleSysId              → sys_user_role WHERE name=itil
  skillFamilySysId       → sn_nowassist_skill_family WHERE name=Other
  llmFlowSysId           → sys_hub_flow WHERE name LIKE "LLM Generic" OR "Now LLM"
  categorySysId          → sn_nowassist_skill_category WHERE name=Other
  truncateStrategySysId  → first record in truncate strategy table
  diagramBuilderConfigSysId → sn_diagram_builder_config WHERE name LIKE "Skills Kit"

Phase 1: Core Capability
  Step 1: sys_one_extend_capability (name, description, type=skill, external=true, metadata)
  Step 2: sys_one_extend_capability_definition (name, api=llmFlowSysId, api_type=sys_hub_flow,
           preprocessor/postprocessor scripts, truncate_strategy, filter_properties)
  Step 2b: sys_one_extend_definition_config (auto-created or explicit)

Phase 2: Prompt Configuration
  Step 3: sys_generative_ai_config (name, prompt, model, temperature, max_tokens,
           request_tokens=32018, state=published, additional_configurations placeholder)
  Step 4: sys_generative_ai_prompt_config (ai_config→prompt, definition→def, is_default=true)

Phase 3: Input/Output Variables
  Step 5: sys_one_extend_definition_attribute × N
    - All user-defined inputs
    - Standard 5 outputs: response, provider, error, errorcode, status
    - Any custom outputs

Phase 4: Skills Kit Registration
  Step 6: sn_nowassist_skill_config (active=false, in_product_active=false — ACL-protected,
           set via UpdateManager in Phase 8)
  Step 7: sn_nowassist_skill_config_status (active=false — ACL-protected)

Phase 5: Flow & Diagram
  Step 8: sys_one_extend_resource_mapping (applicability_script, error_handler_script)
  Step 9: sn_diagram_builder_instance (diagram_json with node/edge structure)

Phase 6: Evaluation & Access
  Step 10: sys_one_extend_eval_strategy (name=Default, default=true)
  Step 11: sys_one_extend_eval_attribute (links to response attribute)
  Step 12: sys_agent_access_role_configuration (action=limit_to_roles, role_list=roleSysId)

Phase 7: Cross-Reference Patches
  Patch 1: Update sys_one_extend_resource_mapping.metadata with diagramInstanceId
  Patch 2: Update sn_diagram_builder_instance.diagram_json with correct diagramInstanceId
  Patch 3: Update sys_generative_ai_config.additional_configurations with skill_config_id

Phase 8: Gen AI Registration (GlideUpdateManager2 via Script Runner)
  → Creates sys_gen_ai_feature_mapping (bypasses ACL)
  → Creates sys_gen_ai_strategy_mapping (copies strategy from existing record)
  → Sets model + request_tokens on sys_generative_ai_config (bypasses ACL)
  → Sets internal_name on sn_nowassist_skill_config (ACL-protected, REST silently drops)
  → Sets active=true + in_product_active=true on sn_nowassist_skill_config (ACL-protected)
  → Sets active=true + in_product_active=true on sn_nowassist_skill_config_status (ACL-protected)

Verification:
  → Query sys_generative_ai_config.model to confirm Phase 8 model set
  → Query sn_nowassist_skill_config.internal_name + active to confirm activation
  → Report success or "needs_background_script" with fallback script text
```

### Dry-Run Output Format

```
Now Assist Skill Creation Plan — DRY RUN
════════════════════════════════════════════════════
Instance: <instance>

PRE-FLIGHT: Resolved sys_ids
─────────────────────────────
  role:               itil → 282bf1fa...
  skill_family:       Other → a5efaf1c...
  llm_flow:           Now LLM Generic → 936e514a...
  category:           Other → 04c489f3...
  truncate_strategy:  Default → 2b99e113...
  diagram_config:     Skills Kit → 24fef3e6...

PHASES
─────────────────────────────
  Phase 1: Core (3 records)
  Phase 2: Prompt (2 records)
  Phase 3: Attributes (N input + 5 standard output + M custom output records)
  Phase 4: Skills Kit (2 records)
  Phase 5: Flow & Diagram (2 records)
  Phase 6: Eval & Access (3 records)
  Phase 7: Patches (3 PATCH calls)
  Phase 8: Gen AI Registration (1 background script, 6 operations)

Total API calls: ~24 + verification
Set dryRun=false to create.
```

---

## servicenow_aia_usecase_create (New Tool)

### Input Schema

```
Required:
  name          — Use Case display name
  prefix        — Short prefix prepended to all record names (e.g., "gp01")
  description   — What this Use Case does
  basePlan      — Orchestrator instructions (multi-line)
  agents[]      — Array of agent definitions:
    name            — Agent display name (prefix prepended automatically)
    description
    role            — Agent's role (1 paragraph)
    instructions    — Step-by-step agent instructions
    proficiency     — Bullet points of capabilities
    tools[]:
      name              — Tool name (prefix prepended)
      description
      inputSchema[]     — [{name, description}]
      script            — Server-side JavaScript
      executionMode     — "autopilot"|"copilot" (default: "autopilot")
      maxAutoExecutions — number (default: 10)

Optional:
  executionMode  — Use Case level "copilot"|"autopilot" (default: "copilot")
  dryRun         — default true
```

### Execution Flow

```
Pre-flight:
  → Scan all tool scripts for forbidden APIs (gs.info, GlideDateTime, GlideAjax)
  → Query sn_aia_strategy WHERE name=ReAct AND type=agent → react_id
  → Query sn_aia_strategy WHERE name=ReActive Planner AND type=orchestrator → planner_id

Step 1: Create all Tools (sn_aia_tool) — all agents' tools upfront
  → name: "{prefix} {tool.name}"
  → type: script, record_type: custom
  → input_schema: JSON stringified array

Step 2: Create Team (sn_aia_team)
  → name: "{prefix} {name}"

Step 3: Create Use Case (sn_aia_usecase)
  → name: "{prefix} {name}"
  → team → team_id, strategy → planner_id
  → context_processing_script + applicability_script (standard boilerplate)

Per agent (Steps 4-6):
  Step 4: Create Agent (sn_aia_agent)
    → name: "{prefix} {agent.name}"
    → strategy → react_id
    → role, instructions, proficiency
    → context_processing_script + applicability_script (standard boilerplate)

  Step 5: Create Team Member (sn_aia_team_member) — CRITICAL LINK
    → team → team_id, agent → agent_id

  Step 6: Create Tool M2Ms (sn_aia_agent_tool_m2m) per tool
    → agent → agent_id, tool → tool_id
    → inputs: JSON of input_schema
    → execution_mode, max_auto_executions

Verification:
  → Query Use Case → Team link
  → Query Team Members → Agent links
  → Query Agent Tool M2Ms → Tool links
```

### Dry-Run Output Format

```
AI Agent Use Case Creation Plan — DRY RUN
════════════════════════════════════════════════════
Instance: <instance>

⚠️  FORBIDDEN API WARNING (if any)
─────────────────────────────

PRE-FLIGHT: Strategies
  ReAct:             <sys_id>
  ReActive Planner:  <sys_id>

RECORDS TO CREATE
─────────────────────────────
  Step 1: Tools (N records)
    - {prefix} Tool A
    - {prefix} Tool B
  Step 2: Team — {prefix} {name}
  Step 3: Use Case — {prefix} {name}
  Step 4: Agent — {prefix} Agent A
  Step 5: Team Member (Team → Agent A)
  Step 6: Tool M2Ms (2 records for Agent A)
  ...

Total API calls: ~6 + (agents × 3) + total tools
Set dryRun=false to create.
```

---

## New Table Constants (table-discovery.ts)

```typescript
SKILL_FAMILY_TABLES        = ['sn_nowassist_skill_family']
SKILL_CATEGORY_TABLES      = ['sn_nowassist_skill_category']
SKILL_STATUS_TABLES        = ['sn_nowassist_skill_config_status']
PROMPT_LINK_TABLES         = ['sys_generative_ai_prompt_config']
RESOURCE_MAPPING_TABLES    = ['sys_one_extend_resource_mapping']
DIAGRAM_BUILDER_TABLES     = ['sn_diagram_builder_instance']
DIAGRAM_CONFIG_TABLES      = ['sn_diagram_builder_config']
EVAL_STRATEGY_TABLES       = ['sys_one_extend_eval_strategy']
EVAL_ATTRIBUTE_TABLES      = ['sys_one_extend_eval_attribute']
ACCESS_ROLE_CONFIG_TABLES  = ['sys_agent_access_role_configuration']
AIA_TEAM_TABLES            = ['sn_aia_team']
AIA_TEAM_MEMBER_TABLES     = ['sn_aia_team_member']
AIA_STRATEGY_TABLES        = ['sn_aia_strategy']
```

---

## Test Cases

- `skill_create_dryrun_full` — dry-run with full config, verify 8 phases in output
- `skill_create_dryrun_overrides` — dry-run with explicit sys_id overrides, verify they appear
- `skill_create_dryrun_no_inputs` — dry-run with no inputs[], verify standard 5 outputs listed
- `usecase_create_dryrun_forbidden_api` — tool script with gs.info, verify warning surfaces
- `usecase_create_dryrun_strategy_lookup` — verify ReAct/ReActive Planner section in output
- `usecase_create_dryrun_missing_field` — agents[] missing instructions, verify clean error
