# AIA Children (Issue #78) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend `servicenow_aia_get` with an optional `includeChildren` parameter that queries `sn_aia_agent_child` and appends child agent details to the output, making multi-agent chains visible via MCP.

**Architecture:** Add `AIA_AGENT_CHILD_TABLES` candidate list to `table-discovery.ts`. Add `includeChildren` boolean param to the `servicenow_aia_get` tool schema. In `handleAiaGet`, when `includeChildren=true`, query the child table for `parent_agent=<agentId>`, resolve child agent names from `sn_aia_agent`, and append formatted output. Update tests to expect 10 AIA tools (count unchanged) and validate the new schema param.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, ServiceNow Table API via existing `client.queryTable()`.

**Worktree:** `/Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/feature-78-aia-children`

---

### Task 1: Add `AIA_AGENT_CHILD_TABLES` to table-discovery.ts

**Files:**
- Modify: `src/servicenow/table-discovery.ts` (after `AIA_AGENT_TOOL_M2M_TABLES`)

**Step 1: Write the failing test**

In `test/validate-servicenow.ts`, find the section that checks `AIA_TOOL_TABLES`, `AIA_USECASE_TABLES`, etc. Add this check right after the existing table constant checks:

```typescript
// --- Issue #78: AIA_AGENT_CHILD_TABLES ---
import { AIA_AGENT_CHILD_TABLES } from '../src/servicenow/table-discovery.js';

// In the table-discovery section:
if (AIA_AGENT_CHILD_TABLES.includes('sn_aia_agent_child')) {
  pass('AIA_AGENT_CHILD_TABLES includes sn_aia_agent_child');
} else {
  fail('AIA_AGENT_CHILD_TABLES missing sn_aia_agent_child');
}
if (AIA_AGENT_CHILD_TABLES.length >= 2) {
  pass(`AIA_AGENT_CHILD_TABLES has ${AIA_AGENT_CHILD_TABLES.length} candidates`);
} else {
  fail('AIA_AGENT_CHILD_TABLES should have at least 2 candidates');
}
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/feature-78-aia-children
npm run test:servicenow 2>&1 | grep -E "AGENT_CHILD|fail|error" -i
```

Expected: compile error — `AIA_AGENT_CHILD_TABLES` not exported.

**Step 3: Add the export to `table-discovery.ts`**

After `AIA_AGENT_TOOL_M2M_TABLES` (around line 102), insert:

```typescript
export const AIA_AGENT_CHILD_TABLES = [
  'sn_aia_agent_child',
  'sys_aia_agent_child',
];
```

**Step 4: Run test to verify it passes**

```bash
npm run test:servicenow 2>&1 | grep -E "AGENT_CHILD"
```

Expected: two green ✓ lines.

**Step 5: Commit**

```bash
git add src/servicenow/table-discovery.ts test/validate-servicenow.ts
git commit -m "feat: add AIA_AGENT_CHILD_TABLES to table-discovery (#78)"
```

---

### Task 2: Add `includeChildren` param to `SERVICENOW_AIA_GET_TOOL` schema

**Files:**
- Modify: `src/servicenow/tools-aia.ts` — `SERVICENOW_AIA_GET_TOOL.inputSchema`

**Step 1: Write the failing test**

In `test/validate-servicenow.ts`, in the section that checks `servicenow_aia_get` schema (around where `aiaGetTool` is checked), add:

```typescript
// After existing aiaGetTool checks:
const props = aiaGetTool.inputSchema as { properties?: Record<string, unknown> };
if (props.properties && 'includeChildren' in props.properties) {
  pass('servicenow_aia_get has includeChildren param');
} else {
  fail('servicenow_aia_get missing includeChildren param');
}
```

**Step 2: Run test to verify it fails**

```bash
npm run test:servicenow 2>&1 | grep -E "includeChildren"
```

Expected: `✗ servicenow_aia_get missing includeChildren param`

**Step 3: Add the param to the tool definition**

In `SERVICENOW_AIA_GET_TOOL.inputSchema.properties` (around line 150–200), add alongside `includeStats`:

```typescript
includeChildren: {
  type: 'boolean',
  description: 'Include child agents this agent delegates to, queried from sn_aia_agent_child (default: false)',
},
```

**Step 4: Run test to verify it passes**

```bash
npm run test:servicenow 2>&1 | grep -E "includeChildren"
```

Expected: `✓ servicenow_aia_get has includeChildren param`

**Step 5: Commit**

```bash
git add src/servicenow/tools-aia.ts test/validate-servicenow.ts
git commit -m "feat: add includeChildren param to servicenow_aia_get schema (#78)"
```

---

### Task 3: Implement `includeChildren` in `handleAiaGet`

**Files:**
- Modify: `src/servicenow/tools-aia.ts` — `handleAiaGet` function (around line 614)

**Step 1: Write the failing test**

In `test/validate-servicenow.ts`, add a handler-level test. Find where `handleAiaGet` is imported and add a test that calls it with `includeChildren: true` against a mock (or simply test the tool schema wiring). Since we don't have live instances in unit tests, validate the tool MCP description mentions children:

```typescript
// --- Issue #78: handleAiaGet includeChildren wiring ---
const aiaGetDesc = aiaGetTool?.description ?? '';
if (aiaGetDesc.toLowerCase().includes('child')) {
  pass('servicenow_aia_get description mentions child agents');
} else {
  fail('servicenow_aia_get description should mention child agents');
}
```

**Step 2: Run to verify it fails**

```bash
npm run test:servicenow 2>&1 | grep -E "child agent"
```

Expected: `✗ servicenow_aia_get description should mention child agents`

**Step 3: Update tool description to mention child agents**

In `SERVICENOW_AIA_GET_TOOL.description`, add at the end:

```
Use includeChildren: true to see child agents this agent delegates to (multi-agent chains).
```

**Step 4: Implement the children query in `handleAiaGet`**

After the `includeStats` block (around line 788, before `return { content: [...]}`), add:

```typescript
// Get child agents
if (args.includeChildren === true) {
  const childTable = await discoverTable(client, AIA_AGENT_CHILD_TABLES, [
    'sys_id', 'parent_agent', 'child_agent', 'description',
  ]);

  if (childTable) {
    const childResponse = await client.queryTable(
      childTable.tableName,
      `parent_agent=${agentId}`,
      ['child_agent', 'description'],
      50
    );

    const childLinks = childResponse.result || [];

    if (childLinks.length > 0) {
      // Resolve child agent names
      const childIds = childLinks.map(r => {
        const ref = r.child_agent as string | { value?: string };
        return typeof ref === 'string' ? ref : ref?.value;
      }).filter(Boolean) as string[];

      const agentLookup = await client.queryTable(
        agentTable.tableName,
        `sys_idIN${childIds.join(',')}`,
        ['sys_id', 'name', 'active', 'description'],
        50
      );

      const childAgents = agentLookup.result || [];
      const childById = new Map(childAgents.map(a => [a.sys_id as string, a]));

      output += `

${'─'.repeat(60)}
CHILD AGENTS (${childIds.length})
${'─'.repeat(60)}`;

      for (const link of childLinks) {
        const ref = link.child_agent as string | { value?: string };
        const childId = typeof ref === 'string' ? ref : ref?.value ?? '';
        const child = childById.get(childId);
        const delegationNote = (link.description as string) || '(no description)';

        if (child) {
          output += `

  [${child.active === 'true' || child.active === true ? 'ON' : 'OFF'}] ${child.name}
    sys_id: ${child.sys_id}
    Description: ${((child.description as string) || '(none)').substring(0, 200)}
    Delegation: ${delegationNote}`;
        } else {
          output += `

  [?] sys_id: ${childId}
    Delegation: ${delegationNote}`;
        }
      }
    } else {
      output += `

${'─'.repeat(60)}
CHILD AGENTS: None`;
    }
  } else {
    output += `

${'─'.repeat(60)}
CHILD AGENTS: Table not found (tried: ${AIA_AGENT_CHILD_TABLES.join(', ')})`;
  }
}
```

Also add `AIA_AGENT_CHILD_TABLES` to the import at the top of the file:

```typescript
import {
  discoverTable,
  AIA_AGENT_TABLES,
  AIA_TOOL_TABLES,
  AIA_AGENT_TOOL_M2M_TABLES,
  AIA_EXECUTION_PLAN_TABLES,
  AIA_TOOL_EXECUTION_TABLES,
  AIA_USECASE_TABLES,
  AIA_TRIGGER_TABLES,
  AIA_AGENT_CHILD_TABLES,   // ← add this
} from './table-discovery.js';
```

**Step 5: Run all tests**

```bash
npm run test:servicenow 2>&1 | tail -15
```

Expected: all 149 tests passing (2 new: `includeChildren param` + `description mentions child`).

**Step 6: Build to verify TypeScript compiles clean**

```bash
npm run build 2>&1
```

Expected: no errors.

**Step 7: Commit**

```bash
git add src/servicenow/tools-aia.ts test/validate-servicenow.ts
git commit -m "feat: implement includeChildren in servicenow_aia_get (#78)"
```

---

### Task 4: Update the MCP description and `AIA_TOOLS` description check

**Files:**
- Modify: `test/validate-servicenow.ts` — total AIA tool count check

**Step 1: Check the count assertion**

The test currently asserts:
```typescript
if (AIA_TOOLS.length === 10) {
  pass(`All 10 AIA tools defined ...`);
```

No new tools are added (only extending existing schema), so the count stays at 10. Verify this is still passing:

```bash
npm run test:servicenow 2>&1 | grep "AIA tools defined"
```

Expected: `✓ All 10 AIA tools defined`

**Step 2: No change needed — count is unchanged**

If count is correct, skip this task. If for any reason it drifted, fix the assertion to match.

---

### Task 5: Final verification

**Step 1: Run full test suite**

```bash
npm run test:servicenow 2>&1 | grep -E "Passed|Failed|✗"
```

Expected: all tests passing, 0 failures.

**Step 2: Build**

```bash
npm run build 2>&1
```

Expected: clean.

**Step 3: Create GitHub issue comment / PR**

```bash
gh issue view 78 --repo Now-AI-Foundry/tool-foundry-mcp
# Confirm issue #78 is what we're closing

gh pr create \
  --repo Now-AI-Foundry/tool-foundry-mcp \
  --title "feat: extend servicenow_aia_get with includeChildren for multi-agent chain inspection (#78)" \
  --body "$(cat <<'EOF'
## Summary
- Adds `AIA_AGENT_CHILD_TABLES` (`sn_aia_agent_child`, `sys_aia_agent_child`) to `table-discovery.ts`
- Adds optional `includeChildren: boolean` parameter to `servicenow_aia_get`
- When `includeChildren=true`, queries `sn_aia_agent_child` for child agent relationships and resolves child agent names/status inline

## Usage
\`\`\`
servicenow_aia_get(agent="My Orchestrator Agent", includeChildren=true)
\`\`\`

## Test Plan
- [x] `AIA_AGENT_CHILD_TABLES` includes `sn_aia_agent_child`
- [x] `servicenow_aia_get` schema has `includeChildren` property
- [x] Tool description mentions child agents
- [x] All 149 tests passing
- [x] TypeScript build clean

Closes #78

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

| Task | What | Tests Added |
|------|------|-------------|
| 1 | `AIA_AGENT_CHILD_TABLES` export | 2 (table name, count) |
| 2 | `includeChildren` param in schema | 1 (property exists) |
| 3 | Handler implementation + description | 1 (description check) |
| 4 | Verify tool count unchanged | 0 |
| 5 | Final verification + PR | — |

Total new tests: **4** (147 → 151)
