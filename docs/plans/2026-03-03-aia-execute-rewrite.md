# AIA Execute Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `servicenow_aia_execute` to actually invoke the agent runtime, wait for completion via polling, and return the agent's response. Also fixes the `execution_mode` default in `servicenow_aia_create`.

**Architecture:** Two-phase execution — Phase 1 runs a background script via `executeViaScriptApi` to call `AiAgentRuntimeUtil.startAiAgentConversation()` and extract the `conversationId`. Phase 2 polls `sn_aia_execution_log` every 2 seconds until a terminal status is detected or timeout is reached. Pre-flight checks the agent's `active` field before execution.

**Tech Stack:** TypeScript, ServiceNow Table API, `executeViaScriptApi` (tools.ts), `connectionManager` (connection-manager.ts)

**Worktree:** `/Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/fix/aia-execute-rewrite`

**Test command:** `npm run test:servicenow` from the worktree directory

**Build command:** `npm run build` from the worktree directory

---

### Task 1: Update `SERVICENOW_AIA_EXECUTE_TOOL` schema

**Files:**
- Modify: `src/servicenow/tools-aia.ts:178-216` (tool schema)
- Test: `test/validate-servicenow.ts` (add schema tests before `runTests()` call)

**Step 1: Add schema tests to validate-servicenow.ts**

In `test/validate-servicenow.ts`, find the existing `aiaCreateTool` schema tests (around line 152). After them, add:

```typescript
// Check servicenow_aia_execute new params (issue #81)
const aiaExecuteTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_execute');
if (aiaExecuteTool) {
  const schema = aiaExecuteTool.inputSchema as { properties?: Record<string, unknown> };
  const em = schema.properties?.executionMode as { enum?: string[] } | undefined;
  if (em?.enum?.includes('autopilot') && em?.enum?.includes('copilot')) {
    pass('servicenow_aia_execute has executionMode with autopilot/copilot enum');
  } else {
    fail('servicenow_aia_execute missing executionMode enum');
  }
  if (schema.properties?.maxTurns) {
    pass('servicenow_aia_execute has maxTurns param');
  } else {
    fail('servicenow_aia_execute missing maxTurns param');
  }
  if (schema.properties?.conversationUser) {
    pass('servicenow_aia_execute has conversationUser param');
  } else {
    fail('servicenow_aia_execute missing conversationUser param');
  }
} else {
  fail('servicenow_aia_execute tool not found');
}
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/fix/aia-execute-rewrite
npm run test:servicenow 2>&1 | grep -E "✗|✓|FAIL|PASS" | grep "executionMode\|maxTurns\|conversationUser"
```

Expected: 3 failures (`✗`)

**Step 3: Add params to `SERVICENOW_AIA_EXECUTE_TOOL` schema**

In `src/servicenow/tools-aia.ts`, find `SERVICENOW_AIA_EXECUTE_TOOL` (around line 178). In the `inputSchema.properties`, add after `timeoutSeconds`:

```typescript
      executionMode: {
        type: 'string',
        enum: ['autopilot', 'copilot'],
        description: 'Agent execution mode (default: "autopilot")',
      },
      maxTurns: {
        type: 'number',
        description: 'Maximum conversation turns (default: 10)',
      },
      conversationUser: {
        type: 'string',
        description: 'User to run conversation as (default: connected username)',
      },
```

**Step 4: Run tests to confirm they pass**

```bash
npm run test:servicenow 2>&1 | grep -E "executionMode|maxTurns|conversationUser"
```

Expected: 3 passes (`✓`)

**Step 5: Commit**

```bash
git add test/validate-servicenow.ts src/servicenow/tools-aia.ts
git commit -m "feat: add executionMode, maxTurns, conversationUser params to servicenow_aia_execute schema

Closes part of #81 (absorbs #80, #84, #85)"
```

---

### Task 2: Update `SERVICENOW_AIA_CREATE_TOOL` schema

**Files:**
- Modify: `src/servicenow/tools-aia.ts:218-~310` (create tool schema)
- Test: `test/validate-servicenow.ts`

**Step 1: Add schema tests**

In `test/validate-servicenow.ts`, after the tests added in Task 1, add:

```typescript
// Check servicenow_aia_create new params (issue #80, #84)
if (aiaCreateTool) {
  const schema = aiaCreateTool.inputSchema as { properties?: Record<string, unknown> };
  const em = schema.properties?.executionMode as { enum?: string[] } | undefined;
  if (em?.enum?.includes('autopilot') && em?.enum?.includes('copilot')) {
    pass('servicenow_aia_create has executionMode with autopilot/copilot enum');
  } else {
    fail('servicenow_aia_create missing executionMode enum');
  }
  if (schema.properties?.maxIterations) {
    pass('servicenow_aia_create has maxIterations param');
  } else {
    fail('servicenow_aia_create missing maxIterations param');
  }
}
```

**Step 2: Run tests to confirm they fail**

```bash
npm run test:servicenow 2>&1 | grep -E "executionMode|maxIterations" | grep "aia_create"
```

Expected: failures

**Step 3: Add params to `SERVICENOW_AIA_CREATE_TOOL` schema**

In `src/servicenow/tools-aia.ts`, find `SERVICENOW_AIA_CREATE_TOOL` (around line 218). In the `inputSchema.properties`, add after `strategy`:

```typescript
      executionMode: {
        type: 'string',
        enum: ['autopilot', 'copilot'],
        description: 'Agent execution mode (default: "autopilot")',
      },
      maxIterations: {
        type: 'number',
        description: 'Maximum iterations per run (default: 10)',
      },
```

**Step 4: Run tests to confirm they pass**

```bash
npm run test:servicenow 2>&1 | grep -E "executionMode|maxIterations"
```

**Step 5: Commit**

```bash
git add test/validate-servicenow.ts src/servicenow/tools-aia.ts
git commit -m "feat: add executionMode, maxIterations params to servicenow_aia_create schema

Closes part of #81 (absorbs #80)"
```

---

### Task 3: Add script-api imports to tools-aia.ts

**Files:**
- Modify: `src/servicenow/tools-aia.ts:1-20` (imports section)

**Step 1: Add the import**

In `src/servicenow/tools-aia.ts`, after the existing imports (around line 19), add:

```typescript
import { ensureScriptApi, executeViaScriptApi, getLastDeploymentError } from './script-api.js';
```

**Step 2: Build to confirm no TS errors**

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no errors

**Step 3: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "chore: add script-api imports to tools-aia.ts for aia_execute rewrite"
```

---

### Task 4: Rewrite `handleAiaExecute`

**Files:**
- Modify: `src/servicenow/tools-aia.ts:880-990`

**Step 1: Replace the entire `handleAiaExecute` function**

Locate the function at line 880. Replace everything from `export async function handleAiaExecute` through the closing `}` (around line 990) with:

```typescript
export async function handleAiaExecute(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const agentRef = args.agent as string;
  const input = args.input as string;
  const targetTable = args.targetTable as string | undefined;
  const targetRecord = args.targetRecord as string | undefined;
  const waitForCompletion = args.waitForCompletion !== false;
  const timeoutSeconds = Math.min(Math.max((args.timeoutSeconds as number) || 60, 5), 120);
  const executionMode = (args.executionMode as string) || 'autopilot';
  const maxTurns = (args.maxTurns as number) || 10;

  if (!agentRef || !input) {
    return { content: [{ type: 'text', text: 'Error: agent and input are required' }], isError: true };
  }

  try {
    // ── Step 1: Resolve agent and check active status ──────────────────────
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, ['sys_id', 'name', 'active']);
    if (!agentTable) {
      return {
        content: [{ type: 'text', text: `Could not find AI Agent table.\n\n${AIA_ROLE_HINT}` }],
        isError: true,
      };
    }

    const isSysId = /^[a-f0-9]{32}$/i.test(agentRef);
    const agentQuery = isSysId ? `sys_id=${agentRef}` : `nameLIKE${agentRef}`;
    const agentResponse = await client.queryTable(
      agentTable.tableName,
      agentQuery,
      ['sys_id', 'name', 'active'],
      1
    );
    const agents = agentResponse.result || [];
    if (agents.length === 0) {
      return { content: [{ type: 'text', text: `Agent not found: "${agentRef}"` }], isError: true };
    }
    const agent = agents[0] as Record<string, unknown>;
    // Pre-flight: check active field (issue #76)
    if (agent.active === false || agent.active === 'false') {
      return {
        content: [{ type: 'text', text: `Error: Agent "${agent.name}" is inactive. Activate it in AI Agent Studio first.` }],
        isError: true,
      };
    }
    const agentId = agent.sys_id as string;
    const agentName = agent.name as string;

    // ── Step 2: Determine conversationUser ────────────────────────────────
    const session = connectionManager.getActiveSession();
    const conversationUser = (args.conversationUser as string) || session?.userName || 'admin';

    // ── Step 3: Build and execute script via script API ───────────────────
    const reqObj: Record<string, unknown> = {
      agentId,
      objective: input,
      conversationUser,
      canInteractWithUser: false,
      executionMode,
      maxTurns,
    };
    if (targetTable) reqObj.targetTable = targetTable;
    if (targetRecord) reqObj.targetRecordId = targetRecord;

    const script = `var runtime = new sn_aia.AiAgentRuntimeUtil();
var req = ${JSON.stringify(reqObj, null, 2)};
var resp = runtime.startAiAgentConversation(req);
gs.info(JSON.stringify(resp));`;

    const apiState = await ensureScriptApi(client);
    if (!apiState) {
      const lastError = getLastDeploymentError(client.getInstanceUrl());
      return {
        content: [{ type: 'text', text: `Script API unavailable: ${lastError || 'deployment failed'}` }],
        isError: true,
      };
    }

    const scriptResult = await executeViaScriptApi(client, script, timeoutSeconds, apiState.workingUrl);

    // ── Step 4: Extract conversationId from script output ─────────────────
    let conversationId: string | undefined;
    for (const line of scriptResult.output) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          const data = parsed.data as Record<string, unknown> | undefined;
          conversationId = data?.conversationId as string | undefined;
          if (conversationId) break;
        }
      } catch {
        // not JSON, skip
      }
    }

    const connStatus = connectionManager.getStatus();
    let output = `AI Agent Execution — ${connStatus.activeInstance}\n${'═'.repeat(60)}\n\nAgent: ${agentName} (${agentId})\nInput: ${input.substring(0, 200)}${input.length > 200 ? '...' : ''}\nExecution Mode: ${executionMode} | Max Turns: ${maxTurns}`;

    if (scriptResult.error && !conversationId) {
      output += `\n\nError: ${scriptResult.error}`;
      return { content: [{ type: 'text', text: output }], isError: true };
    }

    if (!conversationId) {
      output += `\n\nWarning: Could not extract conversation ID from script output.`;
      if (scriptResult.output.length > 0) {
        output += `\nRaw output: ${scriptResult.output.slice(0, 3).join('\n')}`;
      }
      return { content: [{ type: 'text', text: output }] };
    }

    output += `\n\nConversation ID: ${conversationId}`;

    if (!waitForCompletion) {
      output += `\n\nStatus: Started (not waiting for completion)\n\nUse servicenow_aia_trace with conversation ID to see results.`;
      return { content: [{ type: 'text', text: output }] };
    }

    // ── Step 5: Poll sn_aia_execution_log for completion ──────────────────
    const pollInterval = 2000;
    const pollDeadline = Date.now() + timeoutSeconds * 1000;
    const terminalStatuses = new Set(['completed', 'done', 'success', 'failed', 'error', 'cancelled', 'complete']);

    let executionRecord: Record<string, unknown> | null = null;
    let pollStatus: string | undefined;
    let agentOutput: string | undefined;

    while (Date.now() < pollDeadline) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // Try candidate field names for conversation linkage
      for (const field of ['conversation_id', 'conversation']) {
        try {
          const logResponse = await client.queryTable(
            'sn_aia_execution_log',
            `${field}=${conversationId}`,
            undefined,
            1
          );
          const records = logResponse.result || [];
          if (records.length > 0) {
            executionRecord = records[0] as Record<string, unknown>;
            break;
          }
        } catch {
          // try next candidate
        }
      }

      if (!executionRecord) continue;

      // Dynamically detect status field
      for (const key of ['state', 'status', 'execution_state']) {
        const val = executionRecord[key];
        if (val && typeof val === 'string') {
          pollStatus = val;
          if (terminalStatuses.has(val.toLowerCase())) break;
        }
      }

      // Dynamically detect output field
      for (const key of ['output', 'result', 'response', 'agent_output', 'final_output']) {
        const val = executionRecord[key];
        if (val && typeof val === 'string') {
          agentOutput = val;
          break;
        }
      }

      if (pollStatus && terminalStatuses.has(pollStatus.toLowerCase())) break;
    }

    if (!executionRecord) {
      output += `\n\nStatus: Timed out waiting for execution log entry.\n\nUse servicenow_aia_trace with conversation ID to check progress.`;
    } else {
      output += `\n\nStatus: ${pollStatus || 'unknown'}`;
      if (agentOutput) {
        output += `\n\nAgent Response:\n${agentOutput}`;
      } else {
        // Show non-system fields from the record
        const interesting = Object.entries(executionRecord)
          .filter(([k]) => !['sys_id', 'sys_created_on', 'sys_updated_on', 'sys_created_by', 'sys_updated_by', 'sys_mod_count'].includes(k))
          .map(([k, v]) => `  ${k}: ${String(v).substring(0, 200)}`);
        if (interesting.length > 0) {
          output += `\n\nExecution Record:\n${interesting.join('\n')}`;
        }
      }
    }

    output += `\n\n${'─'.repeat(60)}\nUse servicenow_aia_trace with conversation ID to see full trace.`;
    return { content: [{ type: 'text', text: output }] };

  } catch (error) {
    return formatError('execute AI Agent', error);
  }
}
```

**Step 2: Build to confirm no TypeScript errors**

```bash
npm run build 2>&1 | grep -i "error" | head -20
```

Expected: clean build (zero errors)

**Step 3: Run servicenow tests**

```bash
npm run test:servicenow 2>&1 | tail -20
```

Expected: all existing tests still pass

**Step 4: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "fix: rewrite servicenow_aia_execute with proper AiAgentRuntimeUtil invocation and polling

- Replace sys_script_fix workaround with executeViaScriptApi
- Phase 1: call startAiAgentConversation, extract conversationId
- Phase 2: poll sn_aia_execution_log for completion
- Add pre-flight active check (issue #76)
- Honor waitForCompletion parameter
- Derive conversationUser from connection session (issue #85)
- Add executionMode and maxTurns parameters (issues #80, #84)

Closes #81, #76, #84, #85"
```

---

### Task 5: Fix `handleAiaCreate` — executionMode and maxIterations

**Files:**
- Modify: `src/servicenow/tools-aia.ts:992-~1145` (handleAiaCreate)

**Step 1: Write failing test**

In `test/validate-servicenow.ts`, after the schema tests from Task 2, add:

```typescript
// Check servicenow_aia_create doesn't hardcode 'copilot' (issue #80)
// This is a schema-level test — the handler default is verified in integration
if (aiaCreateTool) {
  const schema = aiaCreateTool.inputSchema as { properties?: Record<string, unknown> };
  const em = schema.properties?.executionMode as { enum?: string[] } | undefined;
  const defaultAutopilot = em?.enum?.[0] === 'autopilot';
  if (defaultAutopilot) {
    pass('servicenow_aia_create executionMode has autopilot as first enum (default)');
  } else {
    fail('servicenow_aia_create should list autopilot first in executionMode enum');
  }
}
```

**Step 2: Run to confirm existing test state**

```bash
npm run test:servicenow 2>&1 | grep "autopilot as first"
```

**Step 3: Fix `handleAiaCreate`**

In `src/servicenow/tools-aia.ts`, in the `handleAiaCreate` function:

1. After the `strategy` parsing line (around line 1000), add:
```typescript
const executionMode = (args.executionMode as string) || 'autopilot';
const maxIterations = (args.maxIterations as number) || 10;
```

2. At line 1104, replace:
```typescript
      execution_mode: 'copilot',
```
with:
```typescript
      execution_mode: executionMode,
      max_iterations: maxIterations,
```

**Step 4: Build and run tests**

```bash
npm run build 2>&1 | grep -i "error" | head -10
npm run test:servicenow 2>&1 | tail -10
```

Expected: clean build, all tests pass

**Step 5: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "fix: replace hardcoded execution_mode 'copilot' with configurable executionMode param

Default is now 'autopilot'. Adds maxIterations param.
Closes part of #81 (absorbs #80)"
```

---

### Task 6: Build dist and final validation

**Step 1: Full rebuild**

```bash
npm run build 2>&1
```

Expected: `tsc` exits 0, no errors

**Step 2: Run all tests**

```bash
npm run test:servicenow 2>&1 | tail -30
```

Expected: all tests pass

**Step 3: Spot-check dist output**

```bash
grep -n "sys_script_fix" /Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/fix/aia-execute-rewrite/dist/servicenow/tools-aia.js
```

Expected: no output (the old approach is fully removed)

```bash
grep -n "startAiAgentConversation\|execution_log\|conversationId" /Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/fix/aia-execute-rewrite/dist/servicenow/tools-aia.js | head -10
```

Expected: all three terms present in dist

**Step 4: Final commit if needed**

If any dist files changed (they should have), commit them:

```bash
git add dist/
git commit -m "build: rebuild dist for aia_execute rewrite"
```

---

### Task 7: Create PR

**Step 1: Push branch**

```bash
git push -u origin fix/aia-execute-rewrite
```

**Step 2: Create PR**

```bash
gh pr create \
  --repo Now-AI-Foundry/foundry-mcp \
  --title "Fix: Rewrite servicenow_aia_execute with proper agent invocation and polling" \
  --body "$(cat <<'EOF'
## Summary

Closes #81 (absorbs #76, #80, #84, #85)

- Replace `sys_script_fix` workaround with `executeViaScriptApi` + `AiAgentRuntimeUtil.startAiAgentConversation()`
- Phase 1: execute script, extract `conversationId`
- Phase 2: poll `sn_aia_execution_log` every 2s until terminal status or timeout
- Pre-flight active check: return clear error if agent is inactive (#76)
- `conversationUser` derived from connection session, not hardcoded to 'admin' (#85)
- Add `executionMode` param (default: `autopilot`, was hardcoded `copilot`) (#80)
- Add `maxTurns` param to execute, `maxIterations` to create (#84)
- Honor `waitForCompletion` parameter (was previously ignored)

## Test plan

- [ ] `npm run test:servicenow` passes
- [ ] `npm run build` exits clean
- [ ] Verify `sys_script_fix` is removed from dist
- [ ] Live test: execute an active agent, verify response returned
- [ ] Live test: execute an inactive agent, verify error message
- [ ] Live test: `waitForCompletion: false`, verify immediate return with conversationId

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for Implementation

- The worktree path is: `/Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/fix/aia-execute-rewrite`
- The branch name is: `fix/aia-execute-rewrite`
- All `npm run` commands must be run from inside the worktree directory
- The `npm run test:servicenow` test doesn't require a live ServiceNow connection (schema tests only)
- The `dist/` directory is committed in this repo — rebuild and commit dist after implementation
