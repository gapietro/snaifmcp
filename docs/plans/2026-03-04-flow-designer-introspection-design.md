# Flow Designer Introspection Tools — Design

**Issue:** [#71](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/71) (absorbs #72)
**Date:** 2026-03-04
**Status:** Approved, ready for implementation

---

## Problem

The MCP has zero visibility into the Flow Designer layer. Agentic Workflows in ServiceNow are triggered by `sys_hub_flow` records that use an "AIA Trigger Use Case" action. When debugging a failing Agentic Workflow, the MCP cannot tell the user:

- What table/condition triggers it
- Whether the flow is active
- What action steps exist
- Whether the "AIA Trigger Use Case" step is correctly linked to a Use Case

The existing `servicenow_aia_trigger_get` tool covers the AIA trigger configuration layer (`sn_aia_trigger_configuration`) but not the Flow Designer layer above it.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tool count | Two tools (list + get) | Matches existing list/get patterns (aia_list/get, usecase_list/get) |
| `inputs` blob | JSON parse, fallback to raw string | Handles both parseable and opaque cases without requiring Script Runner |
| File placement | New `tools-flow.ts` | `tools-aia.ts` is already ~2000 lines; Flow Designer is a distinct layer |

---

## New File: `src/servicenow/tools-flow.ts`

Two tools exported from this file:

- `FLOW_TOOLS: Tool[]` — tool definitions
- `handleFlowTool(name, args)` — dispatch handler

---

## Tool Schemas

### `servicenow_flow_list`

List Flow Designer flows. Filter by name and/or trigger table.

```
Parameters (all optional):
  nameFilter   string   Partial name match (case-insensitive)
  tableFilter  string   Filter by trigger table (e.g. "incident")
  status       enum     active | inactive | all  (default: all)
  limit        integer  Max results (default: 50, max: 200)
```

**Output format:**
```
Flows: 3

1. Incident - Categorize ITSM incidents
   Sys ID: 52e76b8b2b043210f243fed2ce91bff6
   Active: true
   Description: ...

2. ...
```

---

### `servicenow_flow_get`

Get full details of a single flow including trigger condition and action steps.

```
Parameters:
  flow          string   (required) Flow name or sys_id
  includeSteps  boolean  Include sys_hub_action_instance rows (default: true)
```

**Output format:**
```
Flow: Incident - Categorize ITSM incidents
Sys ID: 52e76b8b2b043210f243fed2ce91bff6
Active: true
Description: ...

Trigger: record_trigger
  Table: incident
  Condition: active=true^priority=1

Steps: 3
  1. [Log] Start logging
  2. [AIA Trigger Use Case] Trigger categorization
       Linked Use Case: Incident categorization (sys_id: abc123...)
       Raw Inputs: {"use_case":"abc123..."} (truncated if >200 chars)
  3. [End] End
```

---

## New Table Candidates (`table-discovery.ts`)

```ts
export const FLOW_TABLES = ['sys_hub_flow'];
export const FLOW_ACTION_INSTANCE_TABLES = ['sys_hub_action_instance'];
export const FLOW_TRIGGER_INSTANCE_TABLES = ['sys_hub_trigger_instance'];
```

---

## `inputs` Blob Handling

`sys_hub_action_instance.inputs` is a serialized blob. Strategy:

1. Attempt `JSON.parse(inputs)`
2. If successful and action type is "AIA Trigger Use Case", extract `use_case` field and resolve it against `sn_aia_usecase` by sys_id
3. If JSON parse fails, show raw blob truncated to 200 chars with label `(raw, unparseable)`
4. If inputs field is empty or null, show `(no inputs)`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `sys_hub_flow` table not found | `"Could not find Flow Designer table sys_hub_flow. Check that Flow Designer is installed."` |
| Flow not found by name/sys_id | `"Flow not found: '<name>'"` |
| `sys_hub_action_instance` query fails | Return flow metadata with warning: `"Could not fetch action steps (check flow_designer role)"` |
| `inputs` parse failure | Show truncated raw blob with `(raw, unparseable)` label |

---

## Registration (`src/index.ts`)

```ts
import { FLOW_TOOLS, handleFlowTool } from './servicenow/tools-flow.js';

// Add FLOW_TOOLS to tool list
// Add to dispatch: case starting with 'servicenow_flow_' → handleFlowTool
```

---

## Testing (`test/validate-servicenow.ts`)

New schema assertions:
- `servicenow_flow_list` is registered, all params optional, has nameFilter/tableFilter/status/limit
- `servicenow_flow_get` is registered, requires `flow`, has `includeSteps` param
- Both tools return "Not connected" error when no connection active (guard check)

Update total tool count: `8 + 12 + 4 = 24` (was 22)

---

## Implementation Checklist

1. Add `FLOW_TABLES`, `FLOW_ACTION_INSTANCE_TABLES`, `FLOW_TRIGGER_INSTANCE_TABLES` to `table-discovery.ts`
2. Create `src/servicenow/tools-flow.ts` with `FLOW_TOOLS` and `handleFlowTool`
   - `servicenow_flow_list` handler
   - `servicenow_flow_get` handler (with `includeSteps` + blob parsing)
3. Register in `src/index.ts`
4. Add tests + update tool count in `test/validate-servicenow.ts`
5. Build and run tests
