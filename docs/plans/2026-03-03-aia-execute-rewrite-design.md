# Design: servicenow_aia_execute Rewrite

**Date:** 2026-03-03
**Issue:** Now-AI-Foundry/foundry-mcp#81 (absorbs #76, #80, #84, #85)
**Status:** Validated

## Problem

`handleAiaExecute` creates a `sys_script_fix` record to indirectly trigger an agent but:
1. Never waits for the agent to complete
2. Never returns the agent's response
3. Uses a fragile workaround that doesn't correctly invoke the agent runtime
4. `waitForCompletion` parameter is parsed but never used

## Solution

Replace the `sys_script_fix` approach with a two-phase execution using the existing `executeViaScriptApi` infrastructure.

## Design

### Phase 1 — Start Conversation

Execute a background script via `executeViaScriptApi` that calls `AiAgentRuntimeUtil.startAiAgentConversation()` and captures the `conversationId` from the response via `gs.info`.

```javascript
var runtime = new sn_aia.AiAgentRuntimeUtil();
var resp = runtime.startAiAgentConversation({
  agentId: "<id>",
  objective: "<input>",
  conversationUser: "<user>",
  canInteractWithUser: false,
  executionMode: "autopilot",
  maxTurns: 10
  // optional: targetTable, targetRecordId
});
gs.info(JSON.stringify(resp));
```

`startAiAgentConversation` returns immediately with a `conversationId` (async).

### Phase 2 — Poll for Completion

If `waitForCompletion=true`, poll `sn_aia_execution_log` every 2 seconds:
- Query: `conversation_id=<conversationId>`
- Inspect returned record fields dynamically (unknown schema at design time)
- Detect terminal status: `completed`, `done`, `success`, `failed`, `error`, `cancelled`
- Stop on terminal status or timeout

### Pre-flight Check (from #76)

Before execution, resolve the agent and fetch its `active` field. If inactive:
```
Error: Agent "<name>" is inactive. Activate it in AI Agent Studio first.
```

### New Parameters

| Parameter | Type | Default | Source |
|---|---|---|---|
| `executionMode` | `autopilot \| copilot` | `autopilot` | #80 |
| `maxTurns` | number | `10` | #84 |
| `conversationUser` | string | connection username | #85 |

`conversationUser` falls back to: `args.conversationUser || session.userName || 'admin'`

### Output Format

```
AI Agent Execution — <instance>
════════════════════════════════════════════════════════════

Agent: <name> (<sys_id>)
Input: <truncated input>
Execution Mode: autopilot | Max Turns: 10

Status: completed
Conversation ID: <id>

Agent Response:
<output from execution log>

────────────────────────────────────────────────────────────
Use servicenow_aia_trace with conversation ID to see full trace.
```

**Edge cases:**
- `waitForCompletion=false`: return immediately after Phase 1 with conversationId only
- Polling timeout: return partial info with conversationId + timeout message
- Agent inactive: return error before any script execution
- Script phase fails: return script error message

## Changes Required

### `handleAiaExecute` (tools-aia.ts ~line 880)
1. Remove `sys_script_fix` logic
2. Add active-check after agent resolution
3. Get `conversationUser` from connection session
4. Build and execute script via `ensureScriptApi` + `executeViaScriptApi`
5. Extract `conversationId` from script output
6. Add polling loop against `sn_aia_execution_log`
7. Return structured output

### `SERVICENOW_AIA_EXECUTE_TOOL` schema (tools-aia.ts ~line 178)
- Add: `executionMode`, `maxTurns`, `conversationUser`

### `handleAiaCreate` (tools-aia.ts ~line 992)
- Add `executionMode` param (default `autopilot`)
- Add `maxIterations` param (default `10`)
- Replace `execution_mode: 'copilot'` → `execution_mode: executionMode`

### `SERVICENOW_AIA_CREATE_TOOL` schema (tools-aia.ts ~line 218)
- Add: `executionMode`, `maxIterations`
