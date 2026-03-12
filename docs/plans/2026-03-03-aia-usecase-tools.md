# servicenow_aia_usecase_list + _get Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `servicenow_aia_usecase_list` and `servicenow_aia_usecase_get` tools so the Use Case layer of the Agentic Workflow stack (Flow Designer → Use Case → Agent) is visible via MCP.

**Architecture:** Two new tool definitions + two handlers in `tools-aia.ts`. New `AIA_USECASE_TABLES` constant in `table-discovery.ts`. Both handlers follow the exact pattern of `handleAiaList` / `handleAiaGet` — `discoverTable` + `client.queryTable` + formatted output. No new files.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, ServiceNow Table API

---

### Task 1: Write failing tests

**Files:**
- Modify: `test/validate-servicenow.ts`

**Step 1: Add both tool names to the expected AIA tools list**

Find `expectedAiaTools` array. Add both new tools:
```typescript
const expectedAiaTools = [
  'servicenow_aia_list', 'servicenow_aia_get', 'servicenow_aia_trace',
  'servicenow_aia_errors', 'servicenow_aia_execute', 'servicenow_aia_create',
  'servicenow_aia_tool_execute',
  'servicenow_aia_usecase_list',
  'servicenow_aia_usecase_get',
];
```

Update count assertions from `7` → `9` and pass message to `All 9 AIA tools defined (7 original + 2 usecase)`.

Also update the `Total Tool Count` assertion from `19` → `21`.

**Step 2: Add schema validation tests for `servicenow_aia_usecase_list`**

After the existing `servicenow_aia_tool_execute` schema block, add:

```typescript
// --- Issue #73: servicenow_aia_usecase_list schema ---
const aiaUsecaseListTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_usecase_list');
if (aiaUsecaseListTool) {
  const props = aiaUsecaseListTool.inputSchema.properties as Record<string, unknown>;
  if (props?.nameFilter && props?.status && props?.limit) {
    pass('servicenow_aia_usecase_list has nameFilter, status, and limit params');
  } else {
    fail('servicenow_aia_usecase_list missing expected params');
  }
  const required = aiaUsecaseListTool.inputSchema.required as string[] | undefined;
  if (!required || required.length === 0) {
    pass('servicenow_aia_usecase_list has no required params (all optional)');
  } else {
    fail('servicenow_aia_usecase_list should have no required params');
  }
} else {
  fail('servicenow_aia_usecase_list tool not found');
}
```

**Step 3: Add schema validation tests for `servicenow_aia_usecase_get`**

```typescript
// --- Issue #73: servicenow_aia_usecase_get schema ---
const aiaUsecaseGetTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_usecase_get');
if (aiaUsecaseGetTool) {
  const required = aiaUsecaseGetTool.inputSchema.required as string[];
  const props = aiaUsecaseGetTool.inputSchema.properties as Record<string, unknown>;
  if (required?.includes('usecase')) {
    pass('servicenow_aia_usecase_get requires usecase');
  } else {
    fail('servicenow_aia_usecase_get should require usecase');
  }
  if (props?.includeAgent) {
    pass('servicenow_aia_usecase_get has includeAgent param');
  } else {
    fail('servicenow_aia_usecase_get missing includeAgent param');
  }
} else {
  fail('servicenow_aia_usecase_get tool not found');
}
```

**Step 4: Add handler rejection tests**

Find the `handleAiaToolExecute` rejection test block. Add after it:

```typescript
// aia_usecase_list rejects when not connected
{
  const result = await handleAiaUsecaseList({});
  if (result.isError) {
    pass('servicenow_aia_usecase_list rejects when not connected');
  } else {
    fail('servicenow_aia_usecase_list should reject when not connected');
  }
}

// aia_usecase_get rejects when not connected
{
  const result = await handleAiaUsecaseGet({ usecase: 'test' });
  if (result.isError) {
    pass('servicenow_aia_usecase_get rejects when not connected');
  } else {
    fail('servicenow_aia_usecase_get should reject when not connected');
  }
}
```

**Step 5: Add to imports**

Add `handleAiaUsecaseList, handleAiaUsecaseGet` to the import from `tools-aia.js`.

**Step 6: Exclude both from the `handleAiaTool` loop**

The loop at the top of the "AIA Handlers (No Connection)" section filters out certain tools. Add both usecase tools to the exclusion filter:
```typescript
for (const toolName of expectedAiaTools.filter(t =>
  t !== 'servicenow_aia_create' &&
  t !== 'servicenow_aia_tool_execute' &&
  t !== 'servicenow_aia_usecase_list' &&
  t !== 'servicenow_aia_usecase_get'
)) {
```

**Step 7: Run tests to confirm failure**

```bash
npm run test:servicenow 2>&1 | grep -E "✗|FAIL|usecase|Expected 9|handleAiaUsecase|export"
```

Expected: import/export error since handlers don't exist yet.

**Step 8: Commit**

```bash
git add test/validate-servicenow.ts
git commit -m "test: add failing tests for servicenow_aia_usecase_list and _get (#73)"
```

---

### Task 2: Add USECASE_TABLES constant

**Files:**
- Modify: `src/servicenow/table-discovery.ts`

**Step 1: Read table-discovery.ts**

Find where `AIA_TOOL_TABLES` is defined. Add `AIA_USECASE_TABLES` immediately after it:

```typescript
export const AIA_USECASE_TABLES = [
  'sn_aia_usecase',
  'sys_aia_usecase',
  'sn_ai_usecase',
];
```

**Step 2: Run build to confirm clean**

```bash
npm run build 2>&1 | grep "error TS" | head -5
```

**Step 3: Commit**

```bash
git add src/servicenow/table-discovery.ts
git commit -m "feat: add AIA_USECASE_TABLES constant to table-discovery (#73)"
```

---

### Task 3: Add tool definitions

**Files:**
- Modify: `src/servicenow/tools-aia.ts`

**Step 1: Import `AIA_USECASE_TABLES`**

Find the import from `./table-discovery.js` at the top of the file. Add `AIA_USECASE_TABLES` to it.

**Step 2: Add `SERVICENOW_AIA_USECASE_LIST_TOOL`**

Insert before `SERVICENOW_AIA_CREATE_TOOL` (to keep usecase tools grouped together before create):

```typescript
export const SERVICENOW_AIA_USECASE_LIST_TOOL: Tool = {
  name: 'servicenow_aia_usecase_list',
  description: `List all AIA Use Cases on the connected ServiceNow instance.

Use Cases bridge Flow Designer flows to AI Agents. Each Use Case links
a trigger configuration to a specific agent.

Use this to discover what agents are wired up and whether they are active.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nameFilter: {
        type: 'string',
        description: 'Filter by name (partial match)',
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'all'],
        description: 'Filter by active status (default: all)',
      },
      limit: {
        type: 'number',
        description: 'Maximum use cases to return (default: 50, max: 200)',
      },
    },
  },
};
```

**Step 3: Add `SERVICENOW_AIA_USECASE_GET_TOOL`**

Insert immediately after `SERVICENOW_AIA_USECASE_LIST_TOOL`:

```typescript
export const SERVICENOW_AIA_USECASE_GET_TOOL: Tool = {
  name: 'servicenow_aia_usecase_get',
  description: `Get complete details of a specific AIA Use Case.

Returns the use case name, description, active status, and linked agent.
Set includeAgent=true to also show the agent's name and active status.

Use the name or sys_id to identify the use case.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      usecase: {
        type: 'string',
        description: 'Use case name or sys_id',
      },
      includeAgent: {
        type: 'boolean',
        description: 'Resolve and show linked agent details (default: false)',
      },
    },
    required: ['usecase'],
  },
};
```

**Step 4: Add both to `AIA_TOOLS` array**

```typescript
export const AIA_TOOLS: Tool[] = [
  SERVICENOW_AIA_LIST_TOOL,
  SERVICENOW_AIA_GET_TOOL,
  SERVICENOW_AIA_TRACE_TOOL,
  SERVICENOW_AIA_ERRORS_TOOL,
  SERVICENOW_AIA_EXECUTE_TOOL,
  SERVICENOW_AIA_CREATE_TOOL,
  SERVICENOW_AIA_TOOL_EXECUTE_TOOL,
  SERVICENOW_AIA_USECASE_LIST_TOOL,
  SERVICENOW_AIA_USECASE_GET_TOOL,
];
```

**Step 5: Build to confirm clean**

```bash
npm run build 2>&1 | grep "error TS" | head -5
```

**Step 6: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "feat: add servicenow_aia_usecase_list and _get tool definitions (#73)"
```

---

### Task 4: Implement handlers

**Files:**
- Modify: `src/servicenow/tools-aia.ts`

Add both handlers after `handleAiaToolExecute` and before `handleAiaTool`.

**Step 1: Add `handleAiaUsecaseList`**

```typescript
export async function handleAiaUsecaseList(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const status = (args.status as string) || 'all';
  const nameFilter = args.nameFilter as string | undefined;
  const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);

  try {
    const usecaseTable = await discoverTable(client, AIA_USECASE_TABLES, [
      'sys_id', 'name', 'description', 'active', 'agent_id',
    ]);

    if (!usecaseTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AIA Use Case table. Tried: ${AIA_USECASE_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    const queryParts: string[] = [];
    if (status === 'active') queryParts.push('active=true');
    else if (status === 'inactive') queryParts.push('active=false');
    if (nameFilter) queryParts.push(`nameLIKE${nameFilter}`);
    queryParts.push('ORDERBYname');
    const query = queryParts.join('^');

    const response = await client.queryTable(
      usecaseTable.tableName,
      query,
      ['sys_id', 'name', 'description', 'active', 'agent_id'],
      limit
    );

    const usecases = (response.result as Record<string, unknown>[]) ?? [];

    if (usecases.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No Use Cases found${nameFilter ? ` matching "${nameFilter}"` : ''}${status !== 'all' ? ` with status: ${status}` : ''}.`,
        }],
      };
    }

    const connStatus = connectionManager.getStatus();
    let output = `AIA Use Cases on ${connStatus.activeInstance}
Found: ${usecases.length} use case(s)${usecases.length === limit ? ' (limit reached)' : ''}

${'═'.repeat(60)}`;

    for (const uc of usecases) {
      const activeStr = uc.active === 'true' || uc.active === true ? 'Active' : 'Inactive';
      const agentRef = resolveRefField(uc.agent_id);
      output += `

[${activeStr === 'Active' ? 'ON' : 'OFF'}] ${uc.name}
${'─'.repeat(60)}
  sys_id: ${uc.sys_id}
  Agent: ${agentRef || '(none)'}
  Description: ${((uc.description as string) || '(none)').substring(0, 200)}`;
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('list AIA Use Cases', error);
  }
}
```

**Step 2: Add `handleAiaUsecaseGet`**

```typescript
export async function handleAiaUsecaseGet(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const usecaseRef = args.usecase as string;
  const includeAgent = args.includeAgent === true;

  if (!usecaseRef) {
    return {
      content: [{ type: 'text', text: 'Missing required parameter: usecase' }],
      isError: true,
    };
  }

  try {
    const usecaseTable = await discoverTable(client, AIA_USECASE_TABLES, [
      'sys_id', 'name', 'description', 'active', 'agent_id',
    ]);

    if (!usecaseTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AIA Use Case table. Tried: ${AIA_USECASE_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    const isSysId = /^[a-f0-9]{32}$/i.test(usecaseRef);
    const query = isSysId ? `sys_id=${usecaseRef}` : `nameLIKE${usecaseRef}`;

    const response = await client.queryTable(
      usecaseTable.tableName,
      query,
      ['sys_id', 'name', 'description', 'active', 'agent_id', 'sys_created_on', 'sys_updated_on'],
      1
    );

    const records = (response.result as Record<string, unknown>[]) ?? [];
    if (records.length === 0) {
      return {
        content: [{ type: 'text', text: `Use Case not found: "${usecaseRef}"` }],
        isError: true,
      };
    }

    const uc = records[0];
    const activeStr = uc.active === 'true' || uc.active === true ? 'Active' : 'Inactive';
    const agentRef = resolveRefField(uc.agent_id);

    const connStatus = connectionManager.getStatus();
    let output = `AIA Use Case — ${connStatus.activeInstance}
${'═'.repeat(60)}

Name: ${uc.name}
sys_id: ${uc.sys_id}
Status: ${activeStr}
Agent: ${agentRef || '(none)'}
Description: ${uc.description || '(none)'}
Created: ${uc.sys_created_on || 'N/A'}
Updated: ${uc.sys_updated_on || 'N/A'}`;

    if (includeAgent && agentRef) {
      // Resolve the agent sys_id from the reference field
      const agentSysId = typeof uc.agent_id === 'object'
        ? ((uc.agent_id as Record<string, unknown>)?.value as string)
        : (uc.agent_id as string);

      if (agentSysId && /^[a-f0-9]{32}$/i.test(agentSysId)) {
        const agentTable = await discoverTable(client, AIA_AGENT_TABLES, ['sys_id', 'name', 'active', 'description']);
        if (agentTable) {
          const agentResponse = await client.queryTable(
            agentTable.tableName,
            `sys_id=${agentSysId}`,
            ['sys_id', 'name', 'active', 'description'],
            1
          );
          const agents = (agentResponse.result as Record<string, unknown>[]) ?? [];
          if (agents.length > 0) {
            const agent = agents[0];
            const agentActiveStr = agent.active === 'true' || agent.active === true ? 'Active' : 'Inactive';
            output += `

${'─'.repeat(60)}
Linked Agent Details:
  Name: ${agent.name}
  sys_id: ${agent.sys_id}
  Status: ${agentActiveStr}
  Description: ${(agent.description as string || '(none)').substring(0, 200)}`;
          }
        }
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('get AIA Use Case', error);
  }
}
```

**Step 3: Wire into `handleAiaTool` dispatch**

Add after `case 'servicenow_aia_tool_execute': return handleAiaToolExecute(args);`:

```typescript
case 'servicenow_aia_usecase_list': return handleAiaUsecaseList(args);
case 'servicenow_aia_usecase_get': return handleAiaUsecaseGet(args);
```

**Step 4: Run all tests**

```bash
npm run test:servicenow 2>&1 | tail -8
```

Expected: `Passed: 142/142` (135 + 7 new).

**Step 5: Build**

```bash
npm run build 2>&1 | grep "error TS" | head -5
```

Expected: no errors.

**Step 6: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "feat: implement handleAiaUsecaseList and handleAiaUsecaseGet (#73)"
```

---

### Task 5: Push and create PR

**Step 1: Push branch**

```bash
git push -u origin feature/73-aia-usecase
```

**Step 2: Create PR**

```bash
gh pr create \
  --repo Now-AI-Foundry/foundry-mcp \
  --title "feat: add servicenow_aia_usecase_list and _get tools (#73)" \
  --body "$(cat <<'EOF'
## Summary
- Adds `servicenow_aia_usecase_list` to list all AIA Use Cases with name, status, and linked agent
- Adds `servicenow_aia_usecase_get` to inspect a specific Use Case; set `includeAgent=true` to also show the linked agent's details
- New `AIA_USECASE_TABLES` constant in `table-discovery.ts` for resilient table discovery
- Follows identical patterns to `handleAiaList` / `handleAiaGet`

## Test Plan
- [x] 142/142 unit tests pass (`npm run test:servicenow`)
- [x] TypeScript build clean (`npm run build`)
- [ ] Live test: connect to dev instance and list/get a use case

Closes #73
EOF
)"
```
