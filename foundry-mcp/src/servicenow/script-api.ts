/**
 * Scripted REST API for Script Execution
 *
 * Auto-deploys a Scripted REST API endpoint on ServiceNow that executes
 * scripts via eval() and captures gs.info output server-side.
 */

import { ServiceNowClient } from './client.js';
import { ServiceNowError, ServiceNowErrorType } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ScriptApiState {
  apiSysId: string;
  operationSysId: string;
  instanceUrl: string;
  workingUrl?: string;
}

export interface ScriptApiResponse {
  success: boolean;
  returnValue: string | null;
  output: string[];
  error: string | null;
  duration: number;
}

// ============================================================================
// Cache (TTL-based)
// ============================================================================

interface CacheEntry {
  state: ScriptApiState | null;
  timestamp: number;
  error?: string;
}

/** Retry failed deployments after 5 minutes instead of caching failure permanently. */
const CACHE_FAILURE_TTL_MS = 5 * 60 * 1000;

const scriptApiCache = new Map<string, CacheEntry>();

/**
 * Get the last deployment error for the active instance (for diagnostics).
 * Returns null if no error or cache is empty.
 */
export function getLastDeploymentError(instanceUrl?: string): string | null {
  if (instanceUrl) {
    const entry = scriptApiCache.get(instanceUrl);
    return entry?.error ?? null;
  }
  // Return the most recent error across all instances
  for (const entry of scriptApiCache.values()) {
    if (entry.error) return entry.error;
  }
  return null;
}

// ============================================================================
// Server-side operation script (runs inside ServiceNow)
// ============================================================================

/** Exported for testing only — validates script content without a live instance. */
export const OPERATION_SCRIPT = `(function process(request, response) {
  var body = request.body;
  var data = body ? body.data : null;

  if (!data) {
    try { data = JSON.parse(request.body + ''); } catch(e) { data = null; }
  }

  if (!data || !data.script) {
    response.setStatus(400);
    response.setBody({ success: false, error: 'Missing script in request body', output: [], returnValue: null, duration: 0 });
    return;
  }

  var userScript = data.script + '';

  var startTime = new GlideDateTime();
  var errorMsg = null;
  var success = true;
  var capturedOutput = [];

  var wrappedUserScript =
    'var gs = {' +
    '  info: function(msg) { capturedOutput.push(String(msg)); },' +
    '  warn: function(msg) { capturedOutput.push("[WARN] " + String(msg)); },' +
    '  error: function(msg) { capturedOutput.push("[ERROR] " + String(msg)); }' +
    '};\\n' + userScript;

  try {
    eval(wrappedUserScript);
  } catch(e) {
    success = false;
    errorMsg = e.message || String(e);
  }

  var endTime = new GlideDateTime();
  var duration = GlideDateTime.subtract(startTime, endTime).getNumericValue();

  response.setStatus(200);
  response.setBody({
    success: success,
    returnValue: null, // We're using output array instead
    output: capturedOutput,
    error: errorMsg,
    duration: duration
  });
})(request, response);`;

// ============================================================================
// Public API
// ============================================================================

/**
 * Query sys_ws_definition for an existing Foundry Script Runner API.
 * Checks both new and old api_id for backward compatibility.
 * Returns the ScriptApiState if found, null otherwise.
 */
export async function checkScriptApi(client: ServiceNowClient): Promise<ScriptApiState | null> {
  try {
    const apiResponse = await client.queryTable(
      'sys_ws_definition',
      'api_id=foundry_script_runner^ORapi_id=x_fndr_script_runner',
      ['sys_id', 'api_id', 'name', 'namespace', 'sys_scope.scope'],
      1
    );

    if (!apiResponse.result || apiResponse.result.length === 0) {
      return null;
    }

    const record = apiResponse.result[0];

    // Validate this is our Foundry Script Runner — not a coincidental api_id match (#88)
    const recordNamespace = (record.namespace ?? '') as string;
    const recordName = String(record.name ?? '');
    if (recordNamespace !== 'x_fndr' && !recordName.includes('Foundry Script Runner')) {
      return null;
    }

    // Reject records owned by a foreign app scope (#125).
    // Our endpoints are always deployed in global/now scope (sys_scope.scope = 'global' or '').
    // If another app (e.g. sn_google_bard_spk) owns an endpoint at our api_id, the handler
    // runs in that scope and fails with "Access to RESTAPIRequest from scope X not allowed".
    const recordScope = String(record['sys_scope.scope'] ?? '');
    const ownedScopes = ['global', 'now', 'x_fndr', ''];
    if (recordScope && !ownedScopes.includes(recordScope)) {
      return null; // Foreign scope — treat as not-ours, will deploy fresh
    }

    const apiSysId = record.sys_id as string;

    // Find the operation
    const opResponse = await client.queryTable(
      'sys_ws_operation',
      `web_service_definition=${apiSysId}^http_method=POST`,
      ['sys_id'],
      1
    );

    if (!opResponse.result || opResponse.result.length === 0) {
      return null;
    }

    return {
      apiSysId,
      operationSysId: opResponse.result[0].sys_id as string,
      instanceUrl: client.getInstanceUrl(),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`checkScriptApi failed: ${msg}`);
  }
}

/**
 * Delete any sys_ws_definition records named "Foundry Script Runner" that are owned by
 * a foreign app scope. These accumulate when the creating user has a non-global active
 * application context (e.g. sn_google_bard_spk), causing scope errors at execution time.
 * Non-fatal — failures are silently swallowed.
 */
async function cleanupForeignScriptApiRecords(client: ServiceNowClient): Promise<void> {
  try {
    const allowedScopes = ['global', 'now', 'x_fndr', ''];
    const response = await client.queryTable(
      'sys_ws_definition',
      'nameLIKEFoundry Script Runner',
      ['sys_id', 'sys_scope.scope'],
      20
    );
    const records = (response.result ?? []) as Record<string, unknown>[];
    for (const record of records) {
      const scope = String(record['sys_scope.scope'] ?? '');
      if (scope && !allowedScopes.includes(scope)) {
        try {
          await client.deleteRecord('sys_ws_definition', record.sys_id as string);
        } catch {
          // Non-fatal — may lack delete permission on this record
        }
      }
    }
  } catch {
    // Non-fatal — table may not be accessible
  }
}

/**
 * Deploy the Scripted REST API definition and operation on the instance.
 * Explicitly sets sys_scope to the global application to prevent the record from being
 * created in the user's active application scope (which may be a foreign app).
 * Throws on failure (e.g. 403 permission denied).
 */
export async function deployScriptApi(client: ServiceNowClient): Promise<ScriptApiState> {
  // Resolve global scope sys_id — prevents record landing in user's active app scope (#125)
  let globalScopeSysId: string | undefined;
  try {
    const scopeResp = await client.queryTable('sys_scope', 'scope=global', ['sys_id'], 1);
    const scopeRecords = (scopeResp.result ?? []) as Record<string, unknown>[];
    if (scopeRecords.length > 0) {
      globalScopeSysId = scopeRecords[0].sys_id as string;
    }
  } catch {
    // Non-fatal — proceed without pinning scope
  }

  // Create the API definition
  const apiResponse = await client.createRecord('sys_ws_definition', {
    name: 'Foundry Script Runner',
    api_id: 'foundry_script_runner',
    namespace: 'now',
    short_description: 'Executes scripts via eval() with gs.info capture. Deployed by Foundry MCP.',
    active: true,
    ...(globalScopeSysId ? { sys_scope: globalScopeSysId } : {}),
  });

  const apiSysId = (apiResponse.result as Record<string, unknown>).sys_id as string;
  if (!apiSysId) {
    throw new ServiceNowError(
      ServiceNowErrorType.SCRIPT_ERROR,
      'Failed to create Scripted REST API definition — no sys_id returned',
    );
  }

  // Create the POST /execute operation
  const opResponse = await client.createRecord('sys_ws_operation', {
    web_service_definition: apiSysId,
    http_method: 'POST',
    relative_path: '/execute',
    operation_script: OPERATION_SCRIPT,
    active: true,
    name: 'Execute Script',
    short_description: 'Execute a script and capture gs.info output',
  });

  const operationSysId = (opResponse.result as Record<string, unknown>).sys_id as string;
  if (!operationSysId) {
    // Clean up the API definition we just created
    try {
      await client.deleteRecord('sys_ws_definition', apiSysId);
    } catch {
      // Cleanup failure is not critical
    }
    throw new ServiceNowError(
      ServiceNowErrorType.SCRIPT_ERROR,
      'Failed to create Scripted REST API operation — no sys_id returned',
    );
  }

  return {
    apiSysId,
    operationSysId,
    instanceUrl: client.getInstanceUrl(),
  };
}

/**
 * Try multiple URL patterns to find a working endpoint for the Scripted REST API.
 * Returns the first URL that responds (even with an error body), or null.
 */
export async function verifyScriptApiEndpoint(client: ServiceNowClient): Promise<string | null> {
  const urlPatterns = [
    '/api/now/foundry_script_runner/execute',        // new api_id, now namespace (always routable)
    '/api/x_fndr/foundry_script_runner/execute',    // x_fndr namespace (instances with that scope)
    '/api/x_fndr/x_fndr_script_runner/execute',     // old api_id, x_fndr namespace
    '/api/now/x_fndr_script_runner/execute',         // old api_id, now namespace (backward compat)
  ];

  for (const url of urlPatterns) {
    try {
      // Send a minimal probe — the endpoint should return 400 (missing script) not 404
      const response = await client.requestWithRetry<Record<string, unknown>>(
        url,
        {
          method: 'POST',
          body: { script: 'gs.info("foundry-probe")' },
          timeout: 10000,
        }
      );
      // Any non-throw response means the endpoint exists
      if (response !== undefined) {
        return url;
      }
    } catch (error) {
      // 400 = endpoint exists but bad request (good — means it works)
      // 404 = endpoint doesn't exist (try next)
      // 403 = permission denied (endpoint exists but can't use it)
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('403') || msg.includes('Forbidden')) {
        return url; // exists, but permission issue — still the right URL
      }
      // 404 or other — try next
      continue;
    }
  }

  return null;
}

/**
 * Ensure the Scripted REST API is deployed, using TTL cache to avoid redundant work.
 * Returns ScriptApiState if available, null if deployment failed.
 */
export async function ensureScriptApi(client: ServiceNowClient): Promise<ScriptApiState | null> {
  const instanceUrl = client.getInstanceUrl();

  // Check TTL cache
  const cached = scriptApiCache.get(instanceUrl);
  if (cached) {
    if (cached.state) {
      return cached.state;
    }
    // Failure cache — check if TTL has expired
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_FAILURE_TTL_MS) {
      return null; // Still within TTL, don't retry
    }
    // TTL expired, remove and retry
    scriptApiCache.delete(instanceUrl);
  }

  // Check if already deployed on the instance
  try {
    const existing = await checkScriptApi(client);
    if (existing) {
      // Verify the endpoint is reachable and find the working URL
      const workingUrl = await verifyScriptApiEndpoint(client);
      if (workingUrl) {
        existing.workingUrl = workingUrl;
      }
      scriptApiCache.set(instanceUrl, { state: existing, timestamp: Date.now() });
      return existing;
    }
  } catch {
    // checkScriptApi failed — continue to deploy
  }

  // Try to deploy — first clean up any foreign-scoped records that would conflict
  await cleanupForeignScriptApiRecords(client);
  try {
    const deployed = await deployScriptApi(client);

    // Verify the endpoint is reachable
    const workingUrl = await verifyScriptApiEndpoint(client);
    if (workingUrl) {
      deployed.workingUrl = workingUrl;
    }

    scriptApiCache.set(instanceUrl, { state: deployed, timestamp: Date.now() });
    return deployed;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const httpStatus = extractHttpStatus(msg);
    const errorDetail = httpStatus
      ? `${httpStatus} — ${msg}`
      : msg;

    scriptApiCache.set(instanceUrl, {
      state: null,
      timestamp: Date.now(),
      error: errorDetail,
    });
    return null;
  }
}

/**
 * Execute a script via the deployed Scripted REST API endpoint.
 * Uses the cached working URL if available, falls back to default pattern.
 */
export async function executeViaScriptApi(
  client: ServiceNowClient,
  script: string,
  timeout: number,
  workingUrl?: string
): Promise<ScriptApiResponse> {
  const url = workingUrl || '/api/now/foundry_script_runner/execute';

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

    // Detect scope conflict: another app's endpoint is at our URL (#125)
    const scopeMatch = msg.match(/Access to RESTAPIRequest from scope (\S+) not allowed/);
    if (scopeMatch) {
      const conflictScope = scopeMatch[1];
      throw new Error(
        `Script API scope conflict: endpoint at this URL is owned by scope "${conflictScope}", not our Foundry Script Runner. ` +
        `This instance has a conflicting Scripted REST API from another app. ` +
        `Fix: check sys_ws_definition for api_id=foundry_script_runner and ensure it belongs to the global/now scope.`
      );
    }

    throw new Error(`Script API error: ${msg}`);
  }

  // The response may come back in different shapes depending on SN version
  const result = response.result || (response as unknown as ScriptApiResponse);

  return {
    success: result.success ?? true,
    returnValue: result.returnValue ?? null,
    output: Array.isArray(result.output) ? result.output : [],
    error: result.error ?? null,
    duration: result.duration ?? 0,
  };
}

/**
 * Clear the script API cache. Called on disconnect.
 */
export function clearScriptApiCache(): void {
  scriptApiCache.clear();
}

// ============================================================================
// Helpers
// ============================================================================

/** Extract HTTP status code from an error message string. */
function extractHttpStatus(msg: string): number | null {
  const match = msg.match(/\b([345]\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}
