/**
 * Scripted REST API for Script Execution
 *
 * Auto-deploys a Scripted REST API endpoint on ServiceNow that executes
 * scripts via GlideEvaluator and captures gs.info output server-side.
 * Falls back to sys_script_fix approach if deployment fails.
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
}

export interface ScriptApiResponse {
  success: boolean;
  returnValue: string | null;
  output: string[];
  error: string | null;
  duration: number;
}

// ============================================================================
// Cache
// ============================================================================

// Keyed by instance URL. null = deployment attempted and failed (don't retry).
const scriptApiCache = new Map<string, ScriptApiState | null>();

// ============================================================================
// Server-side operation script (runs inside ServiceNow)
// ============================================================================

const OPERATION_SCRIPT = `(function process(request, response) {
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

  var script = data.script + '';
  var capturedOutput = [];
  var origInfo = gs.info;
  var origWarn = gs.warn;
  var origError = gs.error;

  gs.info = function(msg) {
    capturedOutput.push(String(msg));
    origInfo.call(gs, msg);
  };
  gs.warn = function(msg) {
    capturedOutput.push('[WARN] ' + String(msg));
    origWarn.call(gs, msg);
  };
  gs.error = function(msg) {
    capturedOutput.push('[ERROR] ' + String(msg));
    origError.call(gs, msg);
  };

  var startTime = new GlideDateTime();
  var returnValue = null;
  var errorMsg = null;
  var success = true;

  try {
    var evaluator = new GlideEvaluator();
    returnValue = evaluator.evaluateString(script);
    if (returnValue !== null && returnValue !== undefined) {
      returnValue = String(returnValue);
    } else {
      returnValue = null;
    }
  } catch(e) {
    success = false;
    errorMsg = e.message || String(e);
  } finally {
    gs.info = origInfo;
    gs.warn = origWarn;
    gs.error = origError;
  }

  var endTime = new GlideDateTime();
  var duration = GlideDateTime.subtract(startTime, endTime).getNumericValue();

  response.setStatus(200);
  response.setBody({
    success: success,
    returnValue: returnValue,
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
 * Returns the ScriptApiState if found, null otherwise.
 */
export async function checkScriptApi(client: ServiceNowClient): Promise<ScriptApiState | null> {
  try {
    const apiResponse = await client.queryTable(
      'sys_ws_definition',
      'api_id=x_fndr_script_runner',
      ['sys_id'],
      1
    );

    if (!apiResponse.result || apiResponse.result.length === 0) {
      return null;
    }

    const apiSysId = apiResponse.result[0].sys_id as string;

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
  } catch {
    return null;
  }
}

/**
 * Deploy the Scripted REST API definition and operation on the instance.
 * Throws on failure (e.g. 403 permission denied).
 */
export async function deployScriptApi(client: ServiceNowClient): Promise<ScriptApiState> {
  // Create the API definition
  const apiResponse = await client.createRecord('sys_ws_definition', {
    name: 'Foundry Script Runner',
    api_id: 'x_fndr_script_runner',
    namespace: 'x_fndr',
    short_description: 'Executes scripts via GlideEvaluator with gs.info capture. Deployed by Foundry MCP.',
    active: true,
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
 * Ensure the Scripted REST API is deployed, using cache to avoid redundant work.
 * Returns ScriptApiState if available, null if deployment failed or was denied.
 */
export async function ensureScriptApi(client: ServiceNowClient): Promise<ScriptApiState | null> {
  const instanceUrl = client.getInstanceUrl();

  // Check cache first
  if (scriptApiCache.has(instanceUrl)) {
    return scriptApiCache.get(instanceUrl) ?? null;
  }

  // Check if already deployed on the instance
  const existing = await checkScriptApi(client);
  if (existing) {
    scriptApiCache.set(instanceUrl, existing);
    return existing;
  }

  // Try to deploy
  try {
    const deployed = await deployScriptApi(client);
    scriptApiCache.set(instanceUrl, deployed);
    return deployed;
  } catch (error) {
    // If 403 (no permission) or similar, cache null so we don't re-attempt
    scriptApiCache.set(instanceUrl, null);
    return null;
  }
}

/**
 * Execute a script via the deployed Scripted REST API endpoint.
 */
export async function executeViaScriptApi(
  client: ServiceNowClient,
  script: string,
  timeout: number
): Promise<ScriptApiResponse> {
  const response = await client.requestWithRetry<{ result: ScriptApiResponse }>(
    '/api/x_fndr/x_fndr_script_runner/execute',
    {
      method: 'POST',
      body: { script, timeout },
      timeout: (timeout + 10) * 1000,
    }
  );

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
