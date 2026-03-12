/**
 * Script API Reliability Tests
 * Covers bugs: #65 (IN operator false positive), #88 (namespace validation + 400 false positive),
 *              #69 (silent error swallowing), #66/#67 (GlideEvaluator / sealed gs fix)
 */

import { ServiceNowClient } from '../src/servicenow/client.js';
import {
  checkScriptApi,
  verifyScriptApiEndpoint,
  executeViaScriptApi,
  OPERATION_SCRIPT,
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
    if (result === '/api/now/foundry_script_runner/execute') {
      t.pass('verifyEndpoint-200-returns-url', 'Returns correct URL when probe gets 200 response');
    } else {
      t.fail('verifyEndpoint-200-returns-url', `Should return first URL for 200 response, got: ${result}`);
    }
  }

  // Test: returns URL when probe gets 403 (permission denied — endpoint exists)
  {
    const client = makeMockClient({ requestThrow: '403 Forbidden' });
    const result = await verifyScriptApiEndpoint(client);
    if (result === '/api/now/foundry_script_runner/execute') {
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

// ─── OPERATION_SCRIPT Static Validation (#66, #67) ───────────────────────────

function testOperationScript(): void {
  t.log('OPERATION_SCRIPT — eval() approach (#66, #67)', 'header');

  // Test: uses eval() instead of GlideEvaluator (#66)
  // GlideEvaluator.evaluateString() is a Java method that rejects Rhino ConsString types
  if (!OPERATION_SCRIPT.includes('eval(wrappedUserScript)')) {
    t.fail('op-script-uses-eval', 'OPERATION_SCRIPT must use eval(wrappedUserScript) — GlideEvaluator rejects Rhino types (#66)');
  } else {
    t.pass('op-script-uses-eval', 'OPERATION_SCRIPT uses eval() to avoid GlideEvaluator ConsString rejection (#66)');
  }

  // Test: does NOT use GlideEvaluator (#66)
  if (OPERATION_SCRIPT.includes('GlideEvaluator')) {
    t.fail('op-script-no-glide-evaluator', 'OPERATION_SCRIPT must not use GlideEvaluator — it rejects Rhino string types (#66)');
  } else {
    t.pass('op-script-no-glide-evaluator', 'OPERATION_SCRIPT does not use GlideEvaluator (#66)');
  }

  // Test: shadows sealed gs with local var declaration (#67)
  // gs is sealed in Scripted REST API context — monkey-patching fails silently
  if (!OPERATION_SCRIPT.includes('var gs = {')) {
    t.fail('op-script-shadows-gs', "OPERATION_SCRIPT must prepend 'var gs = {...}' to shadow sealed global gs (#67)");
  } else {
    t.pass('op-script-shadows-gs', "OPERATION_SCRIPT shadows sealed global gs with local var declaration (#67)");
  }

  // Test: does NOT monkey-patch gs (old broken approach)
  if (OPERATION_SCRIPT.includes('gs.info = function')) {
    t.fail('op-script-no-monkey-patch', 'OPERATION_SCRIPT must not monkey-patch gs.info — gs is sealed (#67)');
  } else {
    t.pass('op-script-no-monkey-patch', 'OPERATION_SCRIPT does not attempt to monkey-patch sealed gs (#67)');
  }

  // Test: capturedOutput is in outer scope (accessible from eval'd string via closure)
  if (!OPERATION_SCRIPT.includes('var capturedOutput = [];')) {
    t.fail('op-script-captured-output', 'OPERATION_SCRIPT must declare capturedOutput in outer scope for eval access');
  } else {
    t.pass('op-script-captured-output', 'capturedOutput declared in outer scope — accessible from eval via closure');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  t.log('═══════════════════════════════════════════════════════════', 'header');
  t.log('  SCRIPT API RELIABILITY TESTS (#65, #88, #69, #66, #67)', 'header');
  t.log('═══════════════════════════════════════════════════════════', 'header');

  testOperationScript();
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
