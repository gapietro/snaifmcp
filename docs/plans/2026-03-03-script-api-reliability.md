# Script API Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three compounding bugs in `script-api.ts` that cause `servicenow_script` and `servicenow_aia_execute` to silently fail on all fresh ServiceNow instances.

**Architecture:** All three bugs live in `src/servicenow/script-api.ts`. Fixes are independent and targeted: (1) fix the `IN` query operator + add namespace validation, (2) stop treating HTTP 400 as "endpoint exists", (3) surface ServiceNow API-level failures instead of swallowing them. Tests use a mock `ServiceNowClient` object — no live instance required.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, ServiceNow REST API patterns. Test runner at `test/utils/test-runner.ts`. Build with `npm run build` in `foundry-mcp/`. Tests with `npx tsx test/<file>.ts`.

**Closes:** #65 (IN operator false positive), #88 (wrong namespace match + 400 false positive), #69 (silent error swallowing)

**Working directory:** `foundry-mcp/.worktrees/fix/script-api-reliability/`

**Baseline:** 126/126 tests passing with `npm run test:servicenow`

---

## Bug Reference

### Bug #65 — `checkScriptApi` uses `IN` on a string field
`api_idINfoundry_script_runner,x_fndr_script_runner` — ServiceNow's `IN` operator only works on reference fields. On string fields it returns **all records unfiltered**. On a fresh instance this means the first Scripted REST API definition in the database is treated as the Foundry Script Runner. Deployment is skipped, the wrong URL is probed, and `executeViaScriptApi` silently returns `(no output)`.

**Fix:** Use `^OR` operator: `api_id=foundry_script_runner^ORapi_id=x_fndr_script_runner`

### Bug #88 — Wrong-namespace record passes namespace check
Even with the fixed query, an instance could have a Scripted REST API with `api_id=foundry_script_runner` that belongs to a different scope (e.g. `namespace=x_snsn_something`). The current code doesn't validate that the matched record is actually ours. Additionally, `verifyScriptApiEndpoint` treats any HTTP 400 response as "endpoint exists", so a wrong API at the same URL path gets cached as the working endpoint.

**Fix:** After getting the match, validate `namespace === 'x_fndr'` OR `name` includes `'Foundry Script Runner'`. Also: use a real probe script (not empty body) so our endpoint returns 200 and wrong endpoints return 400.

### Bug #69 — `executeViaScriptApi` swallows ServiceNow failure responses
When the Scripted REST API script has a runtime error, ServiceNow returns `{ "status": "failure", "error": { "message": "...", "detail": "..." } }`. The current code parses this as `{ success: true, output: [], returnValue: null }` because the `?? true` default kicks in. The user sees `(no output)` — invisible runtime errors.

**Fix:** Before parsing the result, check for `status === 'failure'` and throw with the error message.

---

### Task 1: Create test file with failing tests for all three bugs

**Files:**
- Create: `test/validate-script-api.ts`

**Context:** Tests mock the `ServiceNowClient` as a plain object cast to the right type. Three test groups, one per bug. Each group has one "should fail with current code" test and one regression test (should pass both before and after).

**Step 1: Create `test/validate-script-api.ts`**

```typescript
/**
 * Script API Reliability Tests
 * Covers bugs: #65 (IN operator false positive), #88 (namespace validation + 400 false positive),
 *              #69 (silent error swallowing)
 */

import { ServiceNowClient } from '../src/servicenow/client.js';
import {
  checkScriptApi,
  verifyScriptApiEndpoint,
  executeViaScriptApi,
} from '../src/servicenow/script-api.js';
import { TestRunner } from './utils/test-runner.js';

const t = new TestRunner();

// ─── Mock Client Factory ──────────────────────────────────────────────────────

/**
 * Build a minimal mock ServiceNowClient.
 * queryResponses: array of result arrays, consumed in order (one per queryTable call).
 * requestResult: returned by requestWithRetry if no throw.
 * requestThrow: error message to throw from requestWithRetry.
 */
function makeMockClient(opts: {
  queryResponses?: Record<string, unknown>[][];
  requestResult?: Record<string, unknown>;
  requestThrow?: string;
  instanceUrl?: string;
} = {}): ServiceNowClient {
  let queryCallCount = 0;
  return {
    getInstanceUrl: () => opts.instanceUrl ?? 'https://test.service-now.com',
    queryTable: async () => {
      const responses = opts.queryResponses ?? [[]];
      const result = responses[Math.min(queryCallCount, responses.length - 1)] ?? [];
      queryCallCount++;
      return { result };
    },
    requestWithRetry: async () => {
      if (opts.requestThrow) throw new Error(opts.requestThrow);
      return opts.requestResult ?? {};
    },
  } as unknown as ServiceNowClient;
}

// ─── checkScriptApi Tests (#65 + #88) ─────────────────────────────────────────

async function testCheckScriptApi(): Promise<void> {
  t.log('checkScriptApi — namespace validation (#65 + #88)', 'header');

  // Test: returns null when query result is empty
  {
    const client = makeMockClient({ queryResponses: [[]] });
    const result = await checkScriptApi(client);
    if (result === null) {
      t.pass('checkScriptApi-empty', 'Returns null when sys_ws_definition query returns no records');
    } else {
      t.fail('checkScriptApi-empty', `Should return null for empty query result, got: ${JSON.stringify(result)}`);
    }
  }

  // Test: returns null when matched record has wrong namespace AND wrong name (#88)
  // Simulates: a Scripted REST API with api_id=foundry_script_runner but wrong scope
  // First queryTable: finds wrong-namespace record; second: finds an operation (makes false positive plausible)
  {
    const client = makeMockClient({
      queryResponses: [
        [{ sys_id: 'bad-api-sys-id', api_id: 'foundry_script_runner', name: 'Innovation API', namespace: 'x_snsn' }],
        [{ sys_id: 'op-sys-id' }],
      ],
    });
    const result = await checkScriptApi(client);
    if (result === null) {
      t.pass('checkScriptApi-wrong-namespace', 'Returns null when matched record has wrong namespace (x_snsn ≠ x_fndr)');
    } else {
      t.fail('checkScriptApi-wrong-namespace', `Should reject record with wrong namespace, returned: ${JSON.stringify(result)}`);
    }
  }

  // Test: returns state when record has correct namespace (regression test — must always pass)
  {
    const client = makeMockClient({
      queryResponses: [
        [{ sys_id: 'real-api-sys-id', api_id: 'foundry_script_runner', name: 'Foundry Script Runner', namespace: 'x_fndr' }],
        [{ sys_id: 'real-op-sys-id' }],
      ],
      instanceUrl: 'https://myinstance.service-now.com',
    });
    const result = await checkScriptApi(client);
    if (
      result !== null &&
      result.apiSysId === 'real-api-sys-id' &&
      result.operationSysId === 'real-op-sys-id' &&
      result.instanceUrl === 'https://myinstance.service-now.com'
    ) {
      t.pass('checkScriptApi-correct-namespace', 'Returns ScriptApiState for correct namespace record');
    } else {
      t.fail('checkScriptApi-correct-namespace', `Should return state for x_fndr namespace, got: ${JSON.stringify(result)}`);
    }
  }

  // Test: returns state when namespace is wrong but name contains "Foundry Script Runner" (legacy compatibility)
  {
    const client = makeMockClient({
      queryResponses: [
        [{ sys_id: 'legacy-api-id', api_id: 'x_fndr_script_runner', name: 'Foundry Script Runner', namespace: '' }],
        [{ sys_id: 'legacy-op-id' }],
      ],
    });
    const result = await checkScriptApi(client);
    if (result !== null && result.apiSysId === 'legacy-api-id') {
      t.pass('checkScriptApi-legacy-name', 'Accepts record matching by name when namespace is empty (legacy)');
    } else {
      t.fail('checkScriptApi-legacy-name', `Should accept legacy record by name, got: ${JSON.stringify(result)}`);
    }
  }
}

// ─── verifyScriptApiEndpoint Tests (#88) ─────────────────────────────────────

async function testVerifyScriptApiEndpoint(): Promise<void> {
  t.log('verifyScriptApiEndpoint — 400 false positive (#88)', 'header');

  // Test: returns null when ALL url probes return HTTP 400 (#88)
  // Old behavior: 400 is treated as "endpoint exists" → returns first URL
  // New behavior: 400 means wrong endpoint → continue → return null
  {
    const client = makeMockClient({ requestThrow: '400 Bad Request' });
    const result = await verifyScriptApiEndpoint(client);
    if (result === null) {
      t.pass('verifyEndpoint-400-returns-null', 'Returns null when all probes get 400 (wrong endpoint, not ours)');
    } else {
      t.fail('verifyEndpoint-400-returns-null', `Should return null for 400, returned URL: ${result}`);
    }
  }

  // Test: returns URL when probe gets 200 (regression — must always pass)
  {
    const client = makeMockClient({ requestResult: { success: true, output: ['foundry-probe'] } });
    const result = await verifyScriptApiEndpoint(client);
    if (result === '/api/x_fndr/foundry_script_runner/execute') {
      t.pass('verifyEndpoint-200-returns-url', 'Returns correct URL when probe gets 200 response');
    } else {
      t.fail('verifyEndpoint-200-returns-url', `Should return first URL for 200 response, got: ${result}`);
    }
  }

  // Test: returns URL when probe gets 403 (permission denied — endpoint exists)
  {
    const client = makeMockClient({ requestThrow: '403 Forbidden' });
    const result = await verifyScriptApiEndpoint(client);
    if (result === '/api/x_fndr/foundry_script_runner/execute') {
      t.pass('verifyEndpoint-403-returns-url', 'Returns URL when probe gets 403 (endpoint exists, permission issue)');
    } else {
      t.fail('verifyEndpoint-403-returns-url', `Should return URL for 403 response, got: ${result}`);
    }
  }
}

// ─── executeViaScriptApi Tests (#69) ─────────────────────────────────────────

async function testExecuteViaScriptApi(): Promise<void> {
  t.log('executeViaScriptApi — error surfacing (#69)', 'header');

  // Test: throws when ServiceNow returns status: 'failure' (#69)
  // Old behavior: { success: true, output: [], ... } — silent failure
  // New behavior: throws Error("Script API error: <message>")
  {
    const client = makeMockClient({
      requestResult: {
        status: 'failure',
        error: {
          message: '"java" is not defined.',
          detail: 'ReferenceError at line 19',
        },
      },
    });
    let threw = false;
    let thrownMsg = '';
    try {
      await executeViaScriptApi(client, 'gs.info("test")', 30);
    } catch (e) {
      threw = true;
      thrownMsg = e instanceof Error ? e.message : String(e);
    }
    if (threw && thrownMsg.includes('"java" is not defined.')) {
      t.pass('executeViaScriptApi-throws-on-failure', 'Throws on status: "failure" with error message');
    } else if (threw) {
      t.fail('executeViaScriptApi-throws-on-failure', `Threw but wrong message: ${thrownMsg}`);
    } else {
      t.fail('executeViaScriptApi-throws-on-failure', 'Should throw on status: "failure" but returned silently');
    }
  }

  // Test: returns output on success (regression — must always pass)
  {
    const client = makeMockClient({
      requestResult: {
        result: {
          success: true,
          returnValue: null,
          output: ['hello world'],
          error: null,
          duration: 500,
        },
      },
    });
    let result;
    try {
      result = await executeViaScriptApi(client, 'gs.info("hello world")', 30);
    } catch (e) {
      t.fail('executeViaScriptApi-success', `Should not throw on success, got: ${e}`);
      return;
    }
    if (result.success && result.output[0] === 'hello world' && result.duration === 500) {
      t.pass('executeViaScriptApi-success', 'Returns output on successful script execution');
    } else {
      t.fail('executeViaScriptApi-success', `Unexpected result: ${JSON.stringify(result)}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  t.log('═══════════════════════════════════════════════════════════', 'header');
  t.log('  SCRIPT API RELIABILITY TESTS (#65, #88, #69)', 'header');
  t.log('═══════════════════════════════════════════════════════════', 'header');

  await testCheckScriptApi();
  await testVerifyScriptApiEndpoint();
  await testExecuteViaScriptApi();

  t.log('═══════════════════════════════════════════════════════════', 'header');
  t.log('  SUMMARY', 'header');
  t.log('═══════════════════════════════════════════════════════════', 'header');

  const { failed } = t.printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
```

**Step 2: Run the test to confirm failures**

Run from worktree: `npx tsx test/validate-script-api.ts`

Expected FAILS (3 — the regressions should all pass):
- `checkScriptApi-wrong-namespace` — current code returns state instead of null
- `verifyEndpoint-400-returns-null` — current code returns URL on 400
- `executeViaScriptApi-throws-on-failure` — current code returns silently

Expected PASSES (4 — regression tests, verifying existing correct behavior):
- `checkScriptApi-empty`
- `checkScriptApi-correct-namespace`
- `checkScriptApi-legacy-name`
- `executeViaScriptApi-success`

The `verifyEndpoint-200-returns-url` and `verifyEndpoint-403-returns-url` should also already pass.

**Step 3: Commit the test file**

```bash
git add test/validate-script-api.ts
git commit -m "test: add failing tests for script-api reliability bugs (#65, #88, #69)"
```

---

### Task 2: Fix `checkScriptApi` — query operator and namespace validation

**Files:**
- Modify: `src/servicenow/script-api.ts:148-184`

**Context:** Two changes at lines 150-161: fix query string + fetch namespace/name fields. Then add validation block before extracting `apiSysId`.

**Step 1: Verify the failing test from Task 1**

Run: `npx tsx test/validate-script-api.ts`

Confirm: `checkScriptApi-wrong-namespace` is FAILING.

**Step 2: Implement the fix in `src/servicenow/script-api.ts`**

Replace lines 150–161 (from `const apiResponse = await client.queryTable(` through `const apiSysId = apiResponse.result[0].sys_id as string;`):

**BEFORE:**
```typescript
    const apiResponse = await client.queryTable(
      'sys_ws_definition',
      'api_idINfoundry_script_runner,x_fndr_script_runner',
      ['sys_id', 'api_id'],
      1
    );

    if (!apiResponse.result || apiResponse.result.length === 0) {
      return null;
    }

    const apiSysId = apiResponse.result[0].sys_id as string;
```

**AFTER:**
```typescript
    const apiResponse = await client.queryTable(
      'sys_ws_definition',
      'api_id=foundry_script_runner^ORapi_id=x_fndr_script_runner',
      ['sys_id', 'api_id', 'name', 'namespace'],
      1
    );

    if (!apiResponse.result || apiResponse.result.length === 0) {
      return null;
    }

    const record = apiResponse.result[0];

    // Validate this is our Foundry Script Runner — not a coincidental api_id match (#88)
    const recordNamespace = record.namespace as string;
    const recordName = String(record.name ?? '');
    if (recordNamespace !== 'x_fndr' && !recordName.includes('Foundry Script Runner')) {
      return null;
    }

    const apiSysId = record.sys_id as string;
```

**Step 3: Run tests to confirm fix**

Run: `npx tsx test/validate-script-api.ts`

Expected: `checkScriptApi-wrong-namespace`, `checkScriptApi-correct-namespace`, `checkScriptApi-legacy-name`, `checkScriptApi-empty` all PASS.

**Step 4: Commit**

```bash
git add src/servicenow/script-api.ts
git commit -m "fix: checkScriptApi — use ^OR query operator and validate namespace (#65 #88)"
```

---

### Task 3: Fix `verifyScriptApiEndpoint` — stop treating 400 as "endpoint exists"

**Files:**
- Modify: `src/servicenow/script-api.ts:244-283`

**Context:** Two changes: (1) use a real probe script (not empty) so our endpoint returns 200 instead of 400; (2) remove the 400 catch branch so only 403 (permission error) is treated as "endpoint exists" besides 2xx.

**Step 1: Verify the failing test from Task 1**

Run: `npx tsx test/validate-script-api.ts`

Confirm: `verifyEndpoint-400-returns-null` is FAILING (current returns URL on 400).

**Step 2: Implement the fix in `src/servicenow/script-api.ts`**

Locate the `verifyScriptApiEndpoint` function (lines 244–283). Make two changes:

**Change A — probe script (line ~259):**

BEFORE:
```typescript
        body: { script: '' },
```
AFTER:
```typescript
        body: { script: 'gs.info("foundry-probe")' },
```

**Change B — remove 400 from catch block (lines ~271-273):**

BEFORE (in the `catch` block):
```typescript
      if (msg.includes('400') || msg.includes('Bad Request')) {
        return url;
      }
      if (msg.includes('403') || msg.includes('Forbidden')) {
```

AFTER:
```typescript
      if (msg.includes('403') || msg.includes('Forbidden')) {
```

(Delete the 400 check entirely.)

**Step 3: Run tests to confirm fix**

Run: `npx tsx test/validate-script-api.ts`

Expected: `verifyEndpoint-400-returns-null`, `verifyEndpoint-200-returns-url`, `verifyEndpoint-403-returns-url` all PASS.

**Step 4: Commit**

```bash
git add src/servicenow/script-api.ts
git commit -m "fix: verifyScriptApiEndpoint — real probe script, don't treat 400 as endpoint-exists (#88)"
```

---

### Task 4: Fix `executeViaScriptApi` — surface ServiceNow failure responses

**Files:**
- Modify: `src/servicenow/script-api.ts:355-382`

**Context:** When ServiceNow's Scripted REST API execution fails (script error, timeout, etc.), it returns `{ "status": "failure", "error": { "message": "...", "detail": "..." } }`. Currently this is parsed as success with empty output. The fix adds an early check before parsing the result.

**Step 1: Verify the failing test from Task 1**

Run: `npx tsx test/validate-script-api.ts`

Confirm: `executeViaScriptApi-throws-on-failure` is FAILING.

**Step 2: Implement the fix in `src/servicenow/script-api.ts`**

Locate `executeViaScriptApi` function (lines 355–382). After the `requestWithRetry` call and before the result parsing, add the failure check.

BEFORE (around line 363):
```typescript
  const response = await client.requestWithRetry<{ result: ScriptApiResponse }>(
    url,
    {
      method: 'POST',
      body: { script, timeout },
      timeout: (timeout + 10) * 1000,
    }
  );

  // The response may come back in different shapes depending on SN version
  const result = response.result || (response as unknown as ScriptApiResponse);
```

AFTER:
```typescript
  const response = await client.requestWithRetry<{ result: ScriptApiResponse }>(
    url,
    {
      method: 'POST',
      body: { script, timeout },
      timeout: (timeout + 10) * 1000,
    }
  );

  // Surface ServiceNow API-level errors (e.g. { status: 'failure', error: { message: '...' } })
  const respObj = response as Record<string, unknown>;
  if (respObj.status === 'failure') {
    const errObj = respObj.error as Record<string, unknown> | undefined;
    const msg = String(errObj?.message || errObj?.detail || 'Scripted REST API returned failure');
    throw new Error(`Script API error: ${msg}`);
  }

  // The response may come back in different shapes depending on SN version
  const result = response.result || (response as unknown as ScriptApiResponse);
```

**Step 3: Run tests to confirm fix**

Run: `npx tsx test/validate-script-api.ts`

Expected: ALL 9 tests PASS.

Also run the full suite to check for regressions:

Run: `npm run test:servicenow`

Expected: 126/126 PASS.

**Step 4: Commit**

```bash
git add src/servicenow/script-api.ts
git commit -m "fix: executeViaScriptApi — throw on status: 'failure' instead of silently returning empty output (#69)"
```

---

### Task 5: Register test script, build, and create PR

**Files:**
- Modify: `foundry-mcp/package.json` (scripts section)

**Step 1: Add `test:script-api` to `package.json`**

In `foundry-mcp/package.json`, add to the `scripts` object:

BEFORE:
```json
    "test:redact": "tsx test/validate-redact.ts",
    "test:all": "npm run test && npm run test:servicenow && npm run test:redact && npm run test:exec && npm run test:mcp",
```

AFTER:
```json
    "test:redact": "tsx test/validate-redact.ts",
    "test:script-api": "tsx test/validate-script-api.ts",
    "test:all": "npm run test && npm run test:servicenow && npm run test:redact && npm run test:exec && npm run test:mcp && npm run test:script-api",
```

**Step 2: Build**

Run: `npm run build`

Expected: exits 0, no TypeScript errors.

**Step 3: Run the new script via package.json**

Run: `npm run test:script-api`

Expected: 9/9 PASS, exits 0.

**Step 4: Run full test suite**

Run: `npm run test:servicenow`

Expected: 126/126 PASS.

**Step 5: Commit**

```bash
git add package.json
git commit -m "chore: register test:script-api in package.json and add to test:all"
```

**Step 6: Push branch**

```bash
git push -u origin fix/script-api-reliability
```

**Step 7: Create PR**

```bash
gh pr create \
  --repo Now-AI-Foundry/tool-foundry-mcp \
  --title "fix: script-api reliability — query operator, namespace validation, error surfacing" \
  --body "$(cat <<'EOF'
## Summary

Fixes three compounding bugs in `src/servicenow/script-api.ts` that cause `servicenow_script` and `servicenow_aia_execute` to silently return `(no output)` on all fresh ServiceNow instances:

- **#65** — `checkScriptApi` used `IN` operator on a string field (`api_id`), which ServiceNow treats as unfiltered — returning all Scripted REST API records. The first record on the instance was incorrectly treated as the Foundry Script Runner.
- **#88** — Even with the fixed query, `checkScriptApi` had no validation that the matched record belongs to our scope (`namespace=x_fndr`). `verifyScriptApiEndpoint` also treated any HTTP 400 as "endpoint exists", causing wrong API URLs to be cached.
- **#69** — `executeViaScriptApi` parsed ServiceNow API-level failure responses (`{ "status": "failure", "error": {...} }`) as successful empty output, making script runtime errors invisible.

## Changes

- `src/servicenow/script-api.ts`
  - `checkScriptApi`: fix query (`IN` → `^OR`), fetch `name`/`namespace` fields, validate record is ours
  - `verifyScriptApiEndpoint`: use real probe script (not empty), remove 400 from "endpoint exists" check
  - `executeViaScriptApi`: throw on `status === 'failure'` with error message
- `test/validate-script-api.ts`: new test file with 9 tests (TDD — written first, then fixed)
- `package.json`: add `test:script-api` script, add to `test:all`

## Test Plan

- [x] `npm run test:script-api` — 9/9 pass
- [x] `npm run test:servicenow` — 126/126 pass (no regressions)
- [x] `npm run build` — exits 0

Closes #65
Closes #88
Closes #69

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 8: Post-merge cleanup**

After PR is merged:

```bash
# Bump version (current: 2026.03.0301 → 2026.03.0302 since it's same day, 2nd merge)
# Update package.json "version" field

git checkout main
git pull origin main
git worktree remove .worktrees/fix/script-api-reliability --force
git branch -d fix/script-api-reliability
```

Then update version in `package.json` and commit on a new branch + PR (or check if there's a same-day version bump convention).
