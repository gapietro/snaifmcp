# servicenow_aia_tool_execute Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `servicenow_aia_tool_execute` MCP tool that lets users run a single AIA tool directly by name or sys_id, without needing a full agent.

**Architecture:** Add tool definition + handler to `tools-aia.ts`. Resolver looks up tool by sys_id or name in `sn_aia_tool` table via `discoverTable`/`AIA_TOOL_TABLES`. Execution uses `executeViaScriptApi` with `sn_aia.AiToolRuntimeUtil().executeTool(sysId, JSON.stringify(input))`. All new code lives in `tools-aia.ts` — no other files change.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, ServiceNow Table API + Script API

---

### Task 1: Write failing tests

**Files:**
- Modify: `test/validate-servicenow.ts`

**Step 1: Add the new tool name to the expected AIA tools list**

In the `'AIA Tool Definitions'` section (around line 112), find the expected tool names array:

```typescript
const expectedAiaTools = [
  'servicenow_aia_list', 'servicenow_aia_get', 'servicenow_aia_trace',
  'servicenow_aia_errors', 'servicenow_aia_execute', 'servicenow_aia_create',
];
```

Change it to:

```typescript
const expectedAiaTools = [
  'servicenow_aia_list', 'servicenow_aia_get', 'servicenow_aia_trace',
  'servicenow_aia_errors', 'servicenow_aia_execute', 'servicenow_aia_create',
  'servicenow_aia_tool_execute',
];
```

And update the count assertion from `6` to `7`:

```typescript
// Before:
pass(`All 6 AIA tools defined`);
// ...
fail(`Expected 6 AIA tools, found ${AIA_TOOLS.length}`);

// After:
pass(`All 7 AIA tools defined (6 original + 1 tool execute)`);
// ...
fail(`Expected 7 AIA tools, found ${AIA_TOOLS.length}`);
```

**Step 2: Add schema validation tests for the new tool**

After the existing `servicenow_aia_execute` checks block (around line 190), add:

```typescript
// --- Issue #83: servicenow_aia_tool_execute ---
const aiaToolExecuteTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_tool_execute');
if (aiaToolExecuteTool) {
  const props = aiaToolExecuteTool.inputSchema.properties as Record<string, unknown>;
  const required = aiaToolExecuteTool.inputSchema.required as string[];

  if (required?.includes('tool') && required?.includes('input')) {
    pass('servicenow_aia_tool_execute requires tool and input');
  } else {
    fail('servicenow_aia_tool_execute should require tool and input');
  }

  if (props?.timeoutSeconds) {
    pass('servicenow_aia_tool_execute has timeoutSeconds param');
  } else {
    fail('servicenow_aia_tool_execute missing timeoutSeconds param');
  }
} else {
  fail('servicenow_aia_tool_execute tool not found');
}
```

**Step 3: Add a handler rejection test**

Find the block where `servicenow_aia_execute rejects when not connected` is tested. Add an analogous test immediately after it:

```typescript
// aia_tool_execute rejects when not connected
try {
  await handleAiaToolExecute({ tool: 'test-tool', input: {} });
  fail('servicenow_aia_tool_execute should reject when not connected');
} catch (e) {
  pass('servicenow_aia_tool_execute rejects when not connected');
}
```

You'll also need to import `handleAiaToolExecute` at the top of the test file where other handlers are imported.

**Step 4: Run tests to confirm they fail**

```bash
npm run test:servicenow 2>&1 | grep -E "FAIL|PASS|✓|✗|Expected 7|tool_execute"
```

Expected: failures on the 3 new assertions.

**Step 5: Commit the failing tests**

```bash
git add test/validate-servicenow.ts
git commit -m "test: add failing tests for servicenow_aia_tool_execute (#83)"
```

---

### Task 2: Add tool definition

**Files:**
- Modify: `src/servicenow/tools-aia.ts`

**Step 1: Add `SERVICENOW_AIA_TOOL_EXECUTE_TOOL` constant**

Find `SERVICENOW_AIA_CREATE_TOOL` definition. Insert this **before** it (keeping related tools grouped):

```typescript
export const SERVICENOW_AIA_TOOL_EXECUTE_TOOL: Tool = {
  name: 'servicenow_aia_tool_execute',
  description: `Execute a single AIA tool directly by name or sys_id, without needing an agent.

Useful for testing tool scripts in isolation: "Does my tool work with this input?"

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      tool: {
        type: 'string',
        description: 'Tool name or sys_id',
      },
      input: {
        type: 'object',
        description: 'Input parameters matching the tool\'s input_definition',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Max seconds to wait (default: 30, max: 120)',
      },
    },
    required: ['tool', 'input'],
  },
};
```

**Step 2: Add to `AIA_TOOLS` array**

Find:
```typescript
export const AIA_TOOLS: Tool[] = [
  SERVICENOW_AIA_LIST_TOOL,
  SERVICENOW_AIA_GET_TOOL,
  SERVICENOW_AIA_TRACE_TOOL,
  SERVICENOW_AIA_ERRORS_TOOL,
  SERVICENOW_AIA_EXECUTE_TOOL,
  SERVICENOW_AIA_CREATE_TOOL,
];
```

Replace with:
```typescript
export const AIA_TOOLS: Tool[] = [
  SERVICENOW_AIA_LIST_TOOL,
  SERVICENOW_AIA_GET_TOOL,
  SERVICENOW_AIA_TRACE_TOOL,
  SERVICENOW_AIA_ERRORS_TOOL,
  SERVICENOW_AIA_EXECUTE_TOOL,
  SERVICENOW_AIA_CREATE_TOOL,
  SERVICENOW_AIA_TOOL_EXECUTE_TOOL,
];
```

**Step 3: Run tests — schema tests should now pass, handler test still fails**

```bash
npm run test:servicenow 2>&1 | grep -E "tool_execute|Expected 7"
```

Expected: schema/count tests pass, handler rejection test still fails (function not yet defined).

**Step 4: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "feat: add servicenow_aia_tool_execute tool definition (#83)"
```

---

### Task 3: Implement the handler

**Files:**
- Modify: `src/servicenow/tools-aia.ts`

**Step 1: Add `handleAiaToolExecute` function**

Add this function after `handleAiaCreate` and before `handleAiaTool`:

```typescript
export async function handleAiaToolExecute(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const toolRef = args.tool as string;
  const input = (args.input as Record<string, unknown>) ?? {};
  const timeoutSeconds = Math.min(Math.max((args.timeoutSeconds as number) || 30, 5), 120);

  // Resolve tool by sys_id or name
  const toolTable = await discoverTable(client, AIA_TOOL_TABLES, [
    'sys_id', 'name', 'description', 'active',
  ]);
  const isSysId = /^[a-f0-9]{32}$/i.test(toolRef);
  const toolQuery = isSysId ? `sys_id=${toolRef}` : `nameLIKE${toolRef}`;
  const toolResponse = await client.queryTable(
    toolTable.tableName,
    toolQuery,
    ['sys_id', 'name', 'description'],
    1
  );

  const records = (toolResponse.result as Record<string, unknown>[]) ?? [];
  if (records.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `Tool not found: "${toolRef}"\nQuery: ${toolQuery} on ${toolTable.tableName}`,
      }],
      isError: true,
    };
  }

  const toolRecord = records[0];
  const toolSysId = toolRecord.sys_id as string;
  const toolName = toolRecord.name as string;

  // Build execution script
  const script = `(function() {
  var util = new sn_aia.AiToolRuntimeUtil();
  var result = util.executeTool('${toolSysId}', JSON.stringify(${JSON.stringify(input)}));
  gs.info(JSON.stringify(result));
})();`;

  const apiState = await ensureScriptApi(client);
  const scriptResult = await executeViaScriptApi(client, script, timeoutSeconds, apiState.workingUrl);

  // Parse JSON output from gs.info lines
  let parsedOutput: unknown = null;
  for (const line of scriptResult.output) {
    try {
      parsedOutput = JSON.parse(line);
      break;
    } catch { /* not JSON */ }
  }

  const outputText = parsedOutput !== null
    ? JSON.stringify(parsedOutput, null, 2)
    : scriptResult.output.join('\n') || '(no output)';

  return {
    content: [{
      type: 'text',
      text: [
        `Tool: ${toolName} (${toolSysId})`,
        `Input: ${JSON.stringify(input, null, 2)}`,
        '',
        'Output:',
        outputText,
      ].join('\n'),
    }],
    isError: false,
  };
}
```

**Step 2: Wire into `handleAiaTool` dispatch**

Find:
```typescript
case 'servicenow_aia_create': return handleAiaCreate(args);
```

Add after it:
```typescript
case 'servicenow_aia_tool_execute': return handleAiaToolExecute(args);
```

**Step 3: Run all tests**

```bash
npm run test:servicenow 2>&1 | tail -10
```

Expected: `Passed: 134/134` (131 existing + 3 new).

**Step 4: Build to verify TypeScript**

```bash
npm run build 2>&1 | grep -E "error|warning" | head -20
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "feat: implement handleAiaToolExecute for direct AIA tool execution (#83)"
```

---

### Task 4: Push and create PR

**Step 1: Push branch**

```bash
git push -u origin feature/83-aia-tool-execute
```

**Step 2: Create PR**

```bash
gh pr create \
  --repo Now-AI-Foundry/foundry-mcp \
  --title "feat: add servicenow_aia_tool_execute for direct tool testing (#83)" \
  --body "$(cat <<'EOF'
## Summary
- Adds `servicenow_aia_tool_execute` tool to run a single AIA tool directly by name or sys_id
- Resolves tool via `sn_aia_tool` table using existing `AIA_TOOL_TABLES` discovery
- Executes via Script API using `sn_aia.AiToolRuntimeUtil().executeTool()`
- Returns parsed JSON output with tool name, input, and output

## Test Plan
- [ ] 134/134 unit tests pass (`npm run test:servicenow`)
- [ ] TypeScript build clean (`npm run build`)
- [ ] Live test: connect to dev instance and execute a known tool with valid input

Closes #83
EOF
)"
```
