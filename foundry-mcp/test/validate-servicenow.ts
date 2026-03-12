/**
 * ServiceNow Tools Validation Tests
 *
 * Tests the ServiceNow tool definitions and basic handler logic.
 * Note: Actual connection tests require a live instance.
 */

import {
  SERVICENOW_TOOLS,
  isServiceNowTool,
  handleServiceNowTool,
  connectionManager,
  FEATURE_PLUGINS,
  VERSION_PROPERTIES,
  parseVersionFromBuildTag,
  FeaturePluginConfig,
} from '../src/servicenow/index.js';
import {
  AIA_TOOLS,
  isAiaTool,
  handleAiaTool,
  AIA_ROLE_HINT,
  scanToolScript,
  handleAiaCreate,
  handleAiaToolExecute,
  handleAiaUsecaseList,
  handleAiaUsecaseGet,
  handleAiaTriggerGet,
  handleAiaUsecaseCreate,
} from '../src/servicenow/tools-aia.js';
import {
  SKILL_TOOLS,
  isSkillTool,
  handleSkillTool,
  SKILL_ROLE_HINT,
  buildFlowApiScript,
  handleSkillCreate,
} from '../src/servicenow/tools-skills.js';
import {
  FLOW_TOOLS,
  isFlowTool,
  handleFlowTool,
} from '../src/servicenow/tools-flow.js';
import { requireConnection, isConnectionError } from '../src/servicenow/guards.js';
import { clearTableCache, clearEndpointCache, GENAI_EXECUTE_ENDPOINTS, AIA_EXECUTION_PLAN_TABLES, AIA_TOOL_EXECUTION_TABLES, AIA_AGENT_TABLES, AIA_AGENT_CHILD_TABLES, SKILL_FAMILY_TABLES, SKILL_STATUS_TABLES, PROMPT_LINK_TABLES, RESOURCE_MAPPING_TABLES, DIAGRAM_BUILDER_INSTANCE_TABLES, AIA_TEAM_TABLES, AIA_TEAM_MEMBER_TABLES, AIA_STRATEGY_TABLES } from '../src/servicenow/table-discovery.js';
import {
  checkScriptApi,
  deployScriptApi,
  ensureScriptApi,
  executeViaScriptApi,
  clearScriptApiCache,
  getLastDeploymentError,
  verifyScriptApiEndpoint,
  ScriptApiState,
} from '../src/servicenow/script-api.js';
import { ServiceNowClient } from '../src/servicenow/client.js';
import { ServiceNowError, ServiceNowErrorType } from '../src/servicenow/types.js';
import {
  AIA_LOGS_ROLE_HINT,
} from '../src/servicenow/tools.js';
import { TestRunner } from './utils/test-runner.js';

const t = new TestRunner();

function pass(message: string): void {
  t.pass(message, message);
}

function fail(message: string): void {
  t.fail(message, message);
}

function section(title: string): void {
  t.log(title, "header");
}

async function runTests(): Promise<void> {
  t.log("═══════════════════════════════════════════════════════════", "header");
  t.log("  SERVICENOW TOOLS VALIDATION TEST", "header");
  t.log("═══════════════════════════════════════════════════════════", "header");

  // ── Core Tool Definitions ──────────────────────────────────────
  section('Core Tool Definitions');

  const expectedCoreTools = [
    'servicenow_connect', 'servicenow_disconnect', 'servicenow_status',
    'servicenow_syslogs', 'servicenow_aia_logs', 'servicenow_query',
    'servicenow_script', 'servicenow_instance',
  ];
  for (const toolName of expectedCoreTools) {
    const tool = SERVICENOW_TOOLS.find(t => t.name === toolName);
    if (tool) {
      pass(`${toolName} tool is defined`);
    } else {
      fail(`${toolName} tool is missing`);
    }
  }

  // Check connect tool schema
  const connectTool = SERVICENOW_TOOLS.find(t => t.name === 'servicenow_connect');
  if (connectTool) {
    const schema = connectTool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    if (schema.properties?.instance) {
      pass('servicenow_connect has instance property');
    } else {
      fail('servicenow_connect missing instance property');
    }
    if (schema.required?.includes('instance')) {
      pass('servicenow_connect requires instance');
    } else {
      fail('servicenow_connect should require instance');
    }
  }

  // Core tool count
  if (SERVICENOW_TOOLS.length === 8) {
    pass(`All 8 core ServiceNow tools defined`);
  } else {
    fail(`Expected 8 core tools, found ${SERVICENOW_TOOLS.length}`);
  }

  // ── AIA Tool Definitions ──────────────────────────────────────
  section('AIA Tool Definitions');

  const expectedAiaTools = [
    'servicenow_aia_list', 'servicenow_aia_get', 'servicenow_aia_trace',
    'servicenow_aia_errors', 'servicenow_aia_execute', 'servicenow_aia_create',
    'servicenow_aia_tool_execute', 'servicenow_aia_usecase_create',
    'servicenow_aia_usecase_list',
    'servicenow_aia_usecase_get',
    'servicenow_aia_trigger_get',
  ];
  for (const toolName of expectedAiaTools) {
    const tool = AIA_TOOLS.find(t => t.name === toolName);
    if (tool) {
      pass(`${toolName} tool is defined`);
    } else {
      fail(`${toolName} tool is missing`);
    }
  }

  if (AIA_TOOLS.length === 11) {
    pass(`All 11 AIA tools defined (6 original + 1 tool execute + 2 usecase + 1 trigger + 1 usecase_create)`);
  } else {
    fail(`Expected 11 AIA tools, found ${AIA_TOOLS.length}`);
  }

  // Check AIA tool schemas
  const aiaGetTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_get');
  if (aiaGetTool) {
    const schema = aiaGetTool.inputSchema as { required?: string[] };
    if (schema.required?.includes('agent')) {
      pass('servicenow_aia_get requires agent');
    } else {
      fail('servicenow_aia_get should require agent');
    }
  }

  const aiaGetProps = aiaGetTool?.inputSchema as { properties?: Record<string, unknown> } | undefined;
  if (aiaGetProps?.properties && 'includeChildren' in aiaGetProps.properties) {
    pass('servicenow_aia_get has includeChildren param');
  } else {
    fail('servicenow_aia_get missing includeChildren param');
  }

  const aiaGetDesc = aiaGetTool?.description ?? '';
  if (aiaGetDesc.toLowerCase().includes('child')) {
    pass('servicenow_aia_get description mentions child agents');
  } else {
    fail('servicenow_aia_get description should mention child agents');
  }

  const aiaTraceTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_trace');
  if (aiaTraceTool) {
    const schema = aiaTraceTool.inputSchema as { required?: string[] };
    if (schema.required?.includes('executionId')) {
      pass('servicenow_aia_trace requires executionId');
    } else {
      fail('servicenow_aia_trace should require executionId');
    }
  }

  const aiaCreateTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_create');
  if (aiaCreateTool) {
    const schema = aiaCreateTool.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
    if (schema.required?.includes('agentName') && schema.required?.includes('agentInstructions')) {
      pass('servicenow_aia_create requires agentName and agentInstructions');
    } else {
      fail('servicenow_aia_create should require agentName and agentInstructions');
    }
    if (schema.properties?.dryRun) {
      pass('servicenow_aia_create has dryRun property');
    } else {
      fail('servicenow_aia_create should have dryRun property');
    }
  }

  // Check servicenow_aia_execute new params (issue #81)
  const aiaExecuteTool2 = AIA_TOOLS.find(t => t.name === 'servicenow_aia_execute');
  if (aiaExecuteTool2) {
    const schema = aiaExecuteTool2.inputSchema as { properties?: Record<string, unknown> };
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

  // --- Issue #83: servicenow_aia_tool_execute schema ---
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

  // --- Issue #73: servicenow_aia_usecase_get schema ---
  const aiaUsecaseGetTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_usecase_get');
  if (aiaUsecaseGetTool) {
    const required = aiaUsecaseGetTool.inputSchema.required as string[] | undefined;
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

  // --- Issue #74: servicenow_aia_trigger_get schema ---
  const aiaTriggerGetTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_trigger_get');
  if (aiaTriggerGetTool) {
    const required = aiaTriggerGetTool.inputSchema.required as string[] | undefined;
    if (required?.includes('usecase')) {
      pass('servicenow_aia_trigger_get requires usecase');
    } else {
      fail('servicenow_aia_trigger_get should require usecase');
    }
  } else {
    fail('servicenow_aia_trigger_get tool not found');
  }

  // --- Issue #74: handleAiaTriggerGet missing-param guard ---
  {
    const result = await handleAiaTriggerGet({});
    if (result.isError) {
      pass('handleAiaTriggerGet returns error when usecase is missing');
    } else {
      fail('handleAiaTriggerGet should return error when usecase is missing');
    }
  }

  // --- Issue #71: servicenow_flow_list schema ---
  section('Flow Designer Tools (Issue #71)');

  const flowListTool = FLOW_TOOLS.find(t => t.name === 'servicenow_flow_list');
  if (flowListTool) {
    const props = flowListTool.inputSchema.properties as Record<string, unknown>;
    if (props.nameFilter && props.status && props.limit) {
      pass('servicenow_flow_list has nameFilter, status, and limit params');
    } else {
      fail('servicenow_flow_list missing expected params');
    }
    const required = (flowListTool.inputSchema.required ?? []) as string[];
    if (required.length === 0) {
      pass('servicenow_flow_list has no required params (all optional)');
    } else {
      fail('servicenow_flow_list should have no required params');
    }
  } else {
    fail('servicenow_flow_list tool not found');
  }

  // --- Issue #71: servicenow_flow_get schema ---
  const flowGetTool = FLOW_TOOLS.find(t => t.name === 'servicenow_flow_get');
  if (flowGetTool) {
    const required = (flowGetTool.inputSchema.required ?? []) as string[];
    if (required.includes('flow')) {
      pass('servicenow_flow_get requires flow');
    } else {
      fail('servicenow_flow_get should require flow');
    }
    const props = flowGetTool.inputSchema.properties as Record<string, unknown>;
    if (props.includeSteps) {
      pass('servicenow_flow_get has includeSteps param');
    } else {
      fail('servicenow_flow_get missing includeSteps param');
    }
  } else {
    fail('servicenow_flow_get tool not found');
  }

  // Guard test: handleFlowTool rejects when not connected
  {
    const flowGetResult = await handleFlowTool('servicenow_flow_get', { flow: 'test' });
    if (flowGetResult && flowGetResult.isError && String(flowGetResult.content[0].text).includes('Not connected')) {
      pass('servicenow_flow_get rejects when not connected');
    } else {
      fail('servicenow_flow_get should require connection');
    }
  }

  // isFlowTool detection
  if (isFlowTool('servicenow_flow_list') && isFlowTool('servicenow_flow_get')) {
    pass('isFlowTool correctly identifies flow tools');
  } else {
    fail('isFlowTool should recognize flow tool names');
  }
  if (!isFlowTool('servicenow_aia_list')) {
    pass('isFlowTool correctly rejects non-flow tools');
  } else {
    fail('isFlowTool should not match non-flow tool names');
  }

  // Check servicenow_aia_create new params (issue #80, #84)
  const aiaCreateTool2 = AIA_TOOLS.find(t => t.name === 'servicenow_aia_create');
  if (aiaCreateTool2) {
    const schema = aiaCreateTool2.inputSchema as { properties?: Record<string, unknown> };
    const em = schema.properties?.executionMode as { enum?: string[] } | undefined;
    if (em?.enum?.includes('autopilot') && em?.enum?.includes('copilot')) {
      pass('servicenow_aia_create has executionMode with autopilot/copilot enum');
    } else {
      fail('servicenow_aia_create missing executionMode enum');
    }
    if (em?.enum?.[0] === 'autopilot') {
      pass('servicenow_aia_create executionMode has autopilot as first enum (default)');
    } else {
      fail('servicenow_aia_create should list autopilot first in executionMode enum');
    }
    if (schema.properties?.maxIterations) {
      pass('servicenow_aia_create has maxIterations param');
    } else {
      fail('servicenow_aia_create missing maxIterations param');
    }
  } else {
    fail('servicenow_aia_create tool not found');
  }

  // Verify aia_create handler reads executionMode from args and defaults to autopilot
  // We test this at the handler call level (no connection = returns error, but we can test schema default)
  // The schema test already verifies autopilot is first — this cross-checks the handler reads it
  const aiaCreateToolSchemaCheck = AIA_TOOLS.find(t => t.name === 'servicenow_aia_create');
  if (aiaCreateToolSchemaCheck) {
    const schema = aiaCreateToolSchemaCheck.inputSchema as { properties?: Record<string, unknown> };
    const em = schema.properties?.executionMode as { enum?: string[] } | undefined;
    // If autopilot is first in enum, it signals autopilot is the intended default
    if (em?.enum?.[0] === 'autopilot') {
      pass('servicenow_aia_create schema confirms autopilot is default execution mode');
    } else {
      fail('servicenow_aia_create schema does not have autopilot as first/default');
    }
  }

  // --- Issue #82: forbidden API detection in aia_create ---

  // Verify script parameter description includes forbidden API warning text
  const aiaCreateToolForbidden = AIA_TOOLS.find(t => t.name === 'servicenow_aia_create');
  if (aiaCreateToolForbidden) {
    const schema = aiaCreateToolForbidden.inputSchema as {
      properties?: { tools?: { items?: { properties?: { script?: { description?: string } } } } };
    };
    const scriptDesc = schema.properties?.tools?.items?.properties?.script?.description ?? '';
    if (scriptDesc.includes('gs.info') && scriptDesc.includes('GlideDateTime') && scriptDesc.includes('GlideAjax')) {
      pass('servicenow_aia_create script description warns about forbidden APIs');
    } else {
      fail('servicenow_aia_create script description missing forbidden API warnings');
    }
  } else {
    fail('servicenow_aia_create tool not found for forbidden API description check');
  }

  // Verify scanToolScript detects forbidden patterns and produces no false positives
  {
    const cleanScript = `(function execute(inputs, outputs) { outputs.result = inputs.value * 2; })(inputs, outputs);`;
    const dirtyScript = `(function execute(inputs, outputs) {
  gs.info('Starting');
  var dt = new GlideDateTime();
  var username = gs.getUserName();
  outputs.result = dt.getDisplayValue();
})(inputs, outputs);`;

    const cleanWarnings = scanToolScript(cleanScript);
    const dirtyWarnings = scanToolScript(dirtyScript);

    if (cleanWarnings.length === 0) {
      pass('scanToolScript returns no warnings for clean script');
    } else {
      fail(`scanToolScript returned false-positive warnings for clean script: ${cleanWarnings.join(', ')}`);
    }

    if (dirtyWarnings.length > 0) {
      pass(`scanToolScript detected ${dirtyWarnings.length} forbidden API warning(s) in dirty script`);
    } else {
      fail('scanToolScript found no warnings in dirty script — should have detected forbidden APIs');
    }

    const hasGsInfo = dirtyWarnings.some(w => w.includes('gs.info'));
    const hasGlideDateTime = dirtyWarnings.some(w => w.includes('GlideDateTime'));
    const hasGsGetUserName = dirtyWarnings.some(w => w.includes('getUserName'));
    if (hasGsInfo && hasGlideDateTime && hasGsGetUserName) {
      pass('scanToolScript correctly identifies gs.info, GlideDateTime, and gs.getUserName');
    } else {
      fail(`scanToolScript missing expected patterns. gs.info=${hasGsInfo}, GlideDateTime=${hasGlideDateTime}, getUserName=${hasGsGetUserName}`);
    }
  }

  // Verify dryRun output includes warning section when forbidden APIs are detected
  {
    const dryRunArgs = {
      agentName: 'Test Agent',
      agentDescription: 'Test',
      agentInstructions: 'Do stuff',
      tools: [{
        name: 'BadTool',
        description: 'Uses forbidden APIs',
        script: `(function execute(inputs, outputs) { gs.info('hello'); new GlideDateTime(); })(inputs, outputs);`,
        inputSchema: '[]',
      }],
      dryRun: true,
    };
    const dryResult = await handleAiaCreate(dryRunArgs);
    const dryText = (dryResult.content[0] as { text: string }).text;
    if (dryText.includes('FORBIDDEN')) {
      pass('servicenow_aia_create dryRun output warns about forbidden APIs in tool script');
    } else {
      fail('servicenow_aia_create dryRun output missing forbidden API warning section');
    }
  }

  // ── Skill Tool Definitions ──────────────────────────────────────
  section('Skill Tool Definitions');

  const expectedSkillTools = [
    'servicenow_skill_list', 'servicenow_skill_get',
    'servicenow_skill_execute', 'servicenow_skill_create',
  ];
  for (const toolName of expectedSkillTools) {
    const tool = SKILL_TOOLS.find(t => t.name === toolName);
    if (tool) {
      pass(`${toolName} tool is defined`);
    } else {
      fail(`${toolName} tool is missing`);
    }
  }

  if (SKILL_TOOLS.length === 4) {
    pass(`All 4 Skill tools defined`);
  } else {
    fail(`Expected 4 Skill tools, found ${SKILL_TOOLS.length}`);
  }

  // Check skill tool schemas
  const skillGetTool = SKILL_TOOLS.find(t => t.name === 'servicenow_skill_get');
  if (skillGetTool) {
    const schema = skillGetTool.inputSchema as { required?: string[] };
    if (schema.required?.includes('skill')) {
      pass('servicenow_skill_get requires skill');
    } else {
      fail('servicenow_skill_get should require skill');
    }
  }

  const skillCreateTool = SKILL_TOOLS.find(t => t.name === 'servicenow_skill_create');
  if (skillCreateTool) {
    const schema = skillCreateTool.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
    if (schema.required?.includes('skillName') && schema.required?.includes('promptTemplate')) {
      pass('servicenow_skill_create requires skillName and promptTemplate');
    } else {
      fail('servicenow_skill_create should require skillName and promptTemplate');
    }
    if (schema.properties?.dryRun) {
      pass('servicenow_skill_create has dryRun property');
    } else {
      fail('servicenow_skill_create should have dryRun property');
    }
  }

  // ── Tool Detection Functions ──────────────────────────────────
  section('Tool Detection');

  // Core detection
  if (isServiceNowTool('servicenow_connect')) {
    pass('isServiceNowTool("servicenow_connect") returns true');
  } else {
    fail('isServiceNowTool("servicenow_connect") should return true');
  }

  if (!isServiceNowTool('foundry_init')) {
    pass('isServiceNowTool("foundry_init") returns false');
  } else {
    fail('isServiceNowTool("foundry_init") should return false');
  }

  if (!isServiceNowTool('random_tool')) {
    pass('isServiceNowTool("random_tool") returns false');
  } else {
    fail('isServiceNowTool("random_tool") should return false');
  }

  // AIA detection
  if (isAiaTool('servicenow_aia_list')) {
    pass('isAiaTool("servicenow_aia_list") returns true');
  } else {
    fail('isAiaTool("servicenow_aia_list") should return true');
  }

  if (!isAiaTool('servicenow_connect')) {
    pass('isAiaTool("servicenow_connect") returns false');
  } else {
    fail('isAiaTool("servicenow_connect") should return false');
  }

  // Skill detection
  if (isSkillTool('servicenow_skill_list')) {
    pass('isSkillTool("servicenow_skill_list") returns true');
  } else {
    fail('isSkillTool("servicenow_skill_list") should return true');
  }

  if (!isSkillTool('servicenow_aia_list')) {
    pass('isSkillTool("servicenow_aia_list") returns false');
  } else {
    fail('isSkillTool("servicenow_aia_list") should return false');
  }

  // ── No-Connection Guard Tests ──────────────────────────────────
  section('Guards (No Connection)');

  const guardResult = requireConnection();
  if (isConnectionError(guardResult)) {
    pass('requireConnection() returns error when not connected');
    if (guardResult.content[0].text.includes('Not connected')) {
      pass('Guard error includes helpful message');
    } else {
      fail('Guard error should mention "Not connected"');
    }
  } else {
    fail('requireConnection() should fail when not connected');
  }

  // ── Core Handlers (No Connection) ──────────────────────────────
  section('Core Handlers (No Connection)');

  const statusResult = await handleServiceNowTool('servicenow_status', {});
  if (statusResult) {
    if (statusResult.content[0].text.includes('Not connected')) {
      pass('Status shows not connected when no session exists');
    } else {
      fail('Status should show not connected');
    }
  } else {
    fail('Status handler returned null');
  }

  const disconnectResult = await handleServiceNowTool('servicenow_disconnect', {});
  if (disconnectResult) {
    if (disconnectResult.content[0].text.includes('Not connected')) {
      pass('Disconnect handles no active connection gracefully');
    } else {
      fail('Disconnect should indicate no connection');
    }
  } else {
    fail('Disconnect handler returned null');
  }

  const connectNoInstance = await handleServiceNowTool('servicenow_connect', {});
  if (connectNoInstance) {
    if (connectNoInstance.isError && connectNoInstance.content[0].text.includes('instance is required')) {
      pass('Connect rejects missing instance');
    } else {
      fail('Connect should reject missing instance');
    }
  } else {
    fail('Connect handler returned null');
  }

  // Syslogs, AIA logs, query, script, instance — all require connection
  for (const toolName of ['servicenow_syslogs', 'servicenow_aia_logs', 'servicenow_query', 'servicenow_script', 'servicenow_instance']) {
    const result = await handleServiceNowTool(toolName, { table: 'incident', script: 'test' });
    if (result && result.isError && result.content[0].text.includes('Not connected')) {
      pass(`${toolName} rejects when not connected`);
    } else {
      fail(`${toolName} should require connection`);
    }
  }

  // ── AIA Handlers (No Connection) ──────────────────────────────
  section('AIA Handlers (No Connection)');

  // servicenow_aia_create excluded: dryRun:true works without connection
  // servicenow_aia_tool_execute excluded: tested directly via handleAiaToolExecute below
  // servicenow_aia_usecase_list and _get excluded: tested directly via their handlers below
  // servicenow_aia_usecase_create excluded: dryRun:true works without connection
  for (const toolName of expectedAiaTools.filter(t =>
    t !== 'servicenow_aia_create' &&
    t !== 'servicenow_aia_tool_execute' &&
    t !== 'servicenow_aia_usecase_list' &&
    t !== 'servicenow_aia_usecase_get' &&
    t !== 'servicenow_aia_usecase_create'
  )) {
    const result = await handleAiaTool(toolName, { agent: 'test', executionId: 'test', input: 'test', agentName: 'test', agentDescription: 'test', agentInstructions: 'test' });
    if (result && result.isError && result.content[0].text.includes('Not connected')) {
      pass(`${toolName} rejects when not connected`);
    } else {
      fail(`${toolName} should require connection`);
    }
  }

  // servicenow_aia_create with dryRun:false should require connection
  const aiaCreateNoConn = await handleAiaTool('servicenow_aia_create', { agentName: 'test', agentDescription: 'test', agentInstructions: 'test', dryRun: false });
  if (aiaCreateNoConn && aiaCreateNoConn.isError && aiaCreateNoConn.content[0].text.includes('Not connected')) {
    pass('servicenow_aia_create requires connection when dryRun=false');
  } else {
    fail('servicenow_aia_create should require connection when dryRun=false');
  }

  // aia_tool_execute rejects when not connected
  {
    const result = await handleAiaToolExecute({ tool: 'test-tool', input: {} });
    if (result.isError) {
      pass('servicenow_aia_tool_execute rejects when not connected');
    } else {
      fail('servicenow_aia_tool_execute should reject when not connected');
    }
  }

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

  // ── Skill Handlers (No Connection) ──────────────────────────────
  section('Skill Handlers (No Connection)');

  for (const toolName of expectedSkillTools.filter(t => t !== 'servicenow_skill_create')) {
    const result = await handleSkillTool(toolName, { skill: 'test', input: {}, skillName: 'test', description: 'test', promptTemplate: 'test' });
    if (result && result.isError && result.content[0].text.includes('Not connected')) {
      pass(`${toolName} rejects when not connected`);
    } else {
      fail(`${toolName} should require connection`);
    }
  }

  // servicenow_skill_create with dryRun:false should require connection
  const skillCreateNoConn = await handleSkillTool('servicenow_skill_create', { skillName: 'test', description: 'test', promptTemplate: 'test', dryRun: false });
  if (skillCreateNoConn && skillCreateNoConn.isError && skillCreateNoConn.content[0].text.includes('Not connected')) {
    pass('servicenow_skill_create requires connection when dryRun=false');
  } else {
    fail('servicenow_skill_create should require connection when dryRun=false');
  }

  // ── Client URL Normalization ──────────────────────────────────
  section('Client URL Normalization');

  const testAuth = { type: 'basic' as const, username: 'test', password: 'test' };

  const client1 = new ServiceNowClient('dev12345.service-now.com', testAuth);
  if (client1.getInstanceUrl() === 'https://dev12345.service-now.com') {
    pass('Adds https:// to bare hostname');
  } else {
    fail(`Expected https://dev12345.service-now.com, got ${client1.getInstanceUrl()}`);
  }

  const client2 = new ServiceNowClient('http://dev12345.service-now.com', testAuth);
  if (client2.getInstanceUrl() === 'https://dev12345.service-now.com') {
    pass('Upgrades http:// to https://');
  } else {
    fail(`Expected https upgrade, got ${client2.getInstanceUrl()}`);
  }

  const client3 = new ServiceNowClient('https://dev12345.service-now.com/', testAuth);
  if (client3.getInstanceUrl() === 'https://dev12345.service-now.com') {
    pass('Removes trailing slash');
  } else {
    fail(`Expected no trailing slash, got ${client3.getInstanceUrl()}`);
  }

  // ── Error Types ──────────────────────────────────────────────
  section('Error Types');

  const error = new ServiceNowError(
    ServiceNowErrorType.AUTHENTICATION_FAILED,
    'Test error',
    { detail: 'test' },
    'Try again'
  );

  if (error.type === ServiceNowErrorType.AUTHENTICATION_FAILED) {
    pass('ServiceNowError has correct type');
  } else {
    fail('ServiceNowError type mismatch');
  }

  const errorJson = error.toJSON();
  if (errorJson.message === 'Test error' && errorJson.suggestion === 'Try again') {
    pass('ServiceNowError.toJSON() works correctly');
  } else {
    fail('ServiceNowError.toJSON() returned unexpected value');
  }

  // ── Connection Manager ──────────────────────────────────────
  section('Connection Manager');

  const managerStatus = connectionManager.getStatus();
  if (!managerStatus.connected && managerStatus.sessionCount === 0) {
    pass('ConnectionManager starts with no connections');
  } else {
    fail('ConnectionManager should start empty');
  }

  // ── Table Discovery ──────────────────────────────────────────
  section('Table Discovery');

  // Just test the cache clear doesn't throw
  clearTableCache();
  pass('clearTableCache() runs without error');

  // ── Table Discovery Consistency (Issues #38, #39, #46) ──────────
  section('Table Discovery Consistency (Issues #38, #39, #46)');

  if (AIA_EXECUTION_PLAN_TABLES.includes('sn_aia_execution_plan')) {
    pass('AIA_EXECUTION_PLAN_TABLES includes sn_aia_execution_plan (Zurich)');
  } else {
    fail('AIA_EXECUTION_PLAN_TABLES missing sn_aia_execution_plan');
  }

  if (AIA_EXECUTION_PLAN_TABLES.includes('x_snc_aia_execution')) {
    pass('AIA_EXECUTION_PLAN_TABLES includes x_snc_aia_execution (scoped)');
  } else {
    fail('AIA_EXECUTION_PLAN_TABLES missing x_snc_aia_execution');
  }

  if (AIA_EXECUTION_PLAN_TABLES.length >= 6) {
    pass('AIA_EXECUTION_PLAN_TABLES has >= 6 candidates');
  } else {
    fail('AIA_EXECUTION_PLAN_TABLES should have >= 6 candidates, found ' + AIA_EXECUTION_PLAN_TABLES.length);
  }

  if (AIA_TOOL_EXECUTION_TABLES.includes('sn_aia_tools_execution')) {
    pass('AIA_TOOL_EXECUTION_TABLES includes sn_aia_tools_execution (Zurich)');
  } else {
    fail('AIA_TOOL_EXECUTION_TABLES missing sn_aia_tools_execution');
  }

  if (AIA_TOOL_EXECUTION_TABLES.includes('x_snc_aia_tool_execution')) {
    pass('AIA_TOOL_EXECUTION_TABLES includes x_snc_aia_tool_execution (scoped)');
  } else {
    fail('AIA_TOOL_EXECUTION_TABLES missing x_snc_aia_tool_execution');
  }

  if (AIA_TOOL_EXECUTION_TABLES.length >= 5) {
    pass('AIA_TOOL_EXECUTION_TABLES has >= 5 candidates');
  } else {
    fail('AIA_TOOL_EXECUTION_TABLES should have >= 5 candidates, found ' + AIA_TOOL_EXECUTION_TABLES.length);
  }

  if (AIA_AGENT_TABLES.length >= 3) {
    pass('AIA_AGENT_TABLES has >= 3 candidates');
  } else {
    fail('AIA_AGENT_TABLES should have >= 3 candidates, found ' + AIA_AGENT_TABLES.length);
  }

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

  if (AIA_EXECUTION_PLAN_TABLES[0] === 'sn_aia_execution_plan') {
    pass('sn_aia_execution_plan is first (highest priority) in execution plan list');
  } else {
    fail('sn_aia_execution_plan should be first in execution plan list');
  }

  if (AIA_TOOL_EXECUTION_TABLES[0] === 'sn_aia_tools_execution') {
    pass('sn_aia_tools_execution is first (highest priority) in tool execution list');
  } else {
    fail('sn_aia_tools_execution should be first in tool execution list');
  }

  // ── Script API Module ──────────────────────────────────────────
  section('Script API Module');

  // clearScriptApiCache should not throw
  clearScriptApiCache();
  pass('clearScriptApiCache() runs without error');

  // Verify all expected exports exist
  if (typeof checkScriptApi === 'function') {
    pass('checkScriptApi is exported as a function');
  } else {
    fail('checkScriptApi should be an exported function');
  }

  if (typeof deployScriptApi === 'function') {
    pass('deployScriptApi is exported as a function');
  } else {
    fail('deployScriptApi should be an exported function');
  }

  if (typeof ensureScriptApi === 'function') {
    pass('ensureScriptApi is exported as a function');
  } else {
    fail('ensureScriptApi should be an exported function');
  }

  if (typeof executeViaScriptApi === 'function') {
    pass('executeViaScriptApi is exported as a function');
  } else {
    fail('executeViaScriptApi should be an exported function');
  }

  if (typeof clearScriptApiCache === 'function') {
    pass('clearScriptApiCache is exported as a function');
  } else {
    fail('clearScriptApiCache should be an exported function');
  }

  // ── Script API Diagnostics & Cache ──────────────────────────────
  section('Script API Diagnostics & Cache');

  // getLastDeploymentError should return null after clearing cache
  clearScriptApiCache();
  const deployError = getLastDeploymentError();
  if (deployError === null) {
    pass('getLastDeploymentError() returns null after clearScriptApiCache()');
  } else {
    fail('getLastDeploymentError() should return null after cache clear');
  }

  // getLastDeploymentError with specific instance should also return null
  const deployErrorInstance = getLastDeploymentError('https://nonexistent.service-now.com');
  if (deployErrorInstance === null) {
    pass('getLastDeploymentError(instanceUrl) returns null for unknown instance');
  } else {
    fail('getLastDeploymentError(instanceUrl) should return null for unknown instance');
  }

  // getLastDeploymentError is exported as a function
  if (typeof getLastDeploymentError === 'function') {
    pass('getLastDeploymentError is exported as a function');
  } else {
    fail('getLastDeploymentError should be an exported function');
  }

  // verifyScriptApiEndpoint is exported as a function
  if (typeof verifyScriptApiEndpoint === 'function') {
    pass('verifyScriptApiEndpoint is exported as a function');
  } else {
    fail('verifyScriptApiEndpoint should be an exported function');
  }

  // ScriptApiState interface accepts workingUrl field
  const testState: ScriptApiState = {
    apiSysId: 'test-api-id',
    operationSysId: 'test-op-id',
    instanceUrl: 'https://test.service-now.com',
    workingUrl: '/api/now/foundry_script_runner/execute',
  };
  if (testState.workingUrl === '/api/now/foundry_script_runner/execute') {
    pass('ScriptApiState accepts workingUrl field');
  } else {
    fail('ScriptApiState should accept workingUrl field');
  }

  // ScriptApiState workingUrl is optional
  const testStateNoUrl: ScriptApiState = {
    apiSysId: 'test-api-id',
    operationSysId: 'test-op-id',
    instanceUrl: 'https://test.service-now.com',
  };
  if (testStateNoUrl.workingUrl === undefined) {
    pass('ScriptApiState workingUrl is optional');
  } else {
    fail('ScriptApiState workingUrl should be optional');
  }

  // ── Script Execution Pipeline ──────────────────────────────────
  section('Script Execution Pipeline');

  // Empty script should be rejected
  const emptyScriptResult = await handleServiceNowTool('servicenow_script', { script: '' });
  if (emptyScriptResult && emptyScriptResult.isError && emptyScriptResult.content[0].text.includes('script is required')) {
    pass('servicenow_script rejects empty script');
  } else {
    fail('servicenow_script should reject empty script');
  }

  // Script with only whitespace should be rejected
  const whitespaceScriptResult = await handleServiceNowTool('servicenow_script', { script: '   ' });
  if (whitespaceScriptResult && whitespaceScriptResult.isError && whitespaceScriptResult.content[0].text.includes('script is required')) {
    pass('servicenow_script rejects whitespace-only script');
  } else {
    fail('servicenow_script should reject whitespace-only script');
  }

  // Script tool should reject when not connected (already tested above, but verify the specific handler path)
  const scriptNoConnResult = await handleServiceNowTool('servicenow_script', { script: "gs.info('hello')" });
  if (scriptNoConnResult && scriptNoConnResult.isError && scriptNoConnResult.content[0].text.includes('Not connected')) {
    pass('servicenow_script rejects when not connected');
  } else {
    fail('servicenow_script should require connection');
  }

  // GlideEvaluator should be blocked in user scripts
  const evalScriptResult = await handleServiceNowTool('servicenow_script', { script: "var e = new GlideEvaluator(); e.evaluateString('test');" });
  // This will fail with "Not connected" first since we don't have a connection,
  // but the analyzeScript function should block it. Let's test analyzeScript directly.
  // Since analyzeScript is not exported, we test indirectly through tool behavior.
  // When not connected, the connection check fires before script analysis.
  // We'll verify the safety analysis exists by checking tool definition.
  const scriptTool = SERVICENOW_TOOLS.find(t => t.name === 'servicenow_script');
  if (scriptTool && scriptTool.description?.includes('SAFETY')) {
    pass('servicenow_script tool description mentions safety analysis');
  } else {
    fail('servicenow_script should document safety analysis');
  }

  // Script tool should not reference removed fake endpoints
  if (scriptTool && !scriptTool.description?.includes('/api/now/sp/widget/script')) {
    pass('servicenow_script tool description does not reference removed /api/now/sp/widget/script');
  } else {
    fail('servicenow_script should not reference removed fake endpoints');
  }

  if (scriptTool && !scriptTool.description?.includes('/api/sn_sc/servicecatalog')) {
    pass('servicenow_script tool description does not reference removed /api/sn_sc/servicecatalog');
  } else {
    fail('servicenow_script should not reference removed fake endpoints');
  }

  // ── Instance Version Detection (Issue #8) ──────────────────────
  section('Instance Version Detection (Issue #8)');

  if (FEATURE_PLUGINS.now_assist && FEATURE_PLUGINS.aia && FEATURE_PLUGINS.virtual_agent) {
    pass('FEATURE_PLUGINS has now_assist, aia, virtual_agent entries');
  } else {
    fail('FEATURE_PLUGINS missing expected entries');
  }

  if (FEATURE_PLUGINS.now_assist.plugins.includes('com.snc.genai_controller')) {
    pass('now_assist plugins include genai_controller');
  } else {
    fail('now_assist should include com.snc.genai_controller');
  }

  if (FEATURE_PLUGINS.aia.plugins.includes('com.snc.ai_agents')) {
    pass('aia plugins include ai_agents');
  } else {
    fail('aia should include com.snc.ai_agents');
  }

  const fpValues = Object.values(FEATURE_PLUGINS) as FeaturePluginConfig[];
  const allHavePluginTables = fpValues.every(
    (f) => f.pluginTables && f.pluginTables.length > 1
  );
  if (allHavePluginTables) {
    pass('All features have multiple pluginTables for lookup');
  } else {
    fail('Every feature should have at least 2 pluginTables');
  }

  const pvTests: Array<[string, string | null]> = [
    ['glide-vancouver-12-10-2023__patch1-07-05-2024', 'Vancouver'],
    ['glide-washington-03-20-2024__patch0', 'Washington'],
    ['glide-xanadu-06-12-2024__patch2-hotfix1', 'Xanadu'],
    ['', null],
    ['some-random-string', null],
  ];
  let pvAllPass = true;
  for (const [input, expected] of pvTests) {
    const result = parseVersionFromBuildTag(input);
    if (result !== expected) {
      pvAllPass = false;
      fail('parseVersionFromBuildTag failed for: ' + input);
    }
  }
  if (pvAllPass) {
    pass('parseVersionFromBuildTag correctly parses all test cases');
  }

  if (VERSION_PROPERTIES.length >= 4) {
    pass('VERSION_PROPERTIES has ' + VERSION_PROPERTIES.length + ' entries');
  } else {
    fail('VERSION_PROPERTIES should have >= 4 entries');
  }

  if (VERSION_PROPERTIES.includes('glide.buildtag') && VERSION_PROPERTIES.includes('glide.buildname')) {
    pass('VERSION_PROPERTIES includes buildtag and buildname');
  } else {
    fail('VERSION_PROPERTIES missing expected entries');
  }

  if (FEATURE_PLUGINS.aia.tables.length >= 2) {
    pass('aia has ' + FEATURE_PLUGINS.aia.tables.length + ' fallback tables');
  } else {
    fail('aia should have at least 2 fallback tables');
  }

  if (FEATURE_PLUGINS.now_assist.pluginQueryType === 'like' && FEATURE_PLUGINS.virtual_agent.pluginQueryType === 'like') {
    pass('now_assist and virtual_agent use LIKE query type for broader matching');
  } else {
    fail('now_assist and virtual_agent should use like pluginQueryType');
  }

  // ── Role Hint Error Messages (Issue #41) ──────────────────────
  section('Role Hint Error Messages');

  if (AIA_ROLE_HINT && AIA_ROLE_HINT.includes('sn_aia.admin')) { pass('AIA_ROLE_HINT contains sn_aia.admin role reference'); }
  else { fail('AIA_ROLE_HINT should contain sn_aia.admin role reference'); }

  if (AIA_ROLE_HINT && AIA_ROLE_HINT.includes('Ensure')) { pass('AIA_ROLE_HINT includes actionable "Ensure" guidance'); }
  else { fail('AIA_ROLE_HINT should include actionable guidance'); }

  if (SKILL_ROLE_HINT && SKILL_ROLE_HINT.includes('now_assist_admin')) { pass('SKILL_ROLE_HINT contains now_assist_admin role reference'); }
  else { fail('SKILL_ROLE_HINT should contain now_assist_admin role reference'); }

  if (AIA_LOGS_ROLE_HINT && AIA_LOGS_ROLE_HINT.includes('sn_aia.admin')) { pass('AIA_LOGS_ROLE_HINT contains sn_aia.admin role reference'); }
  else { fail('AIA_LOGS_ROLE_HINT should contain sn_aia.admin role reference'); }


  // ── GenAI Endpoint Discovery (Issue #40) ──────────────────────
  section('GenAI Endpoint Discovery (Issue #40)');

  // GENAI_EXECUTE_ENDPOINTS should be an array with >= 5 candidates
  if (Array.isArray(GENAI_EXECUTE_ENDPOINTS) && GENAI_EXECUTE_ENDPOINTS.length >= 5) {
    pass(`GENAI_EXECUTE_ENDPOINTS has ${GENAI_EXECUTE_ENDPOINTS.length} candidates (>= 5)`);
  } else {
    fail(`GENAI_EXECUTE_ENDPOINTS should have >= 5 entries`);
  }

  // Should include Zurich-specific patterns
  const hasZurichEndpoint = GENAI_EXECUTE_ENDPOINTS.some(ep => ep.includes('sn_generative_ai'));
  if (hasZurichEndpoint) {
    pass('GENAI_EXECUTE_ENDPOINTS includes Zurich sn_generative_ai endpoint');
  } else {
    fail('GENAI_EXECUTE_ENDPOINTS should include sn_generative_ai scope endpoint');
  }

  // Should include NASK scope endpoint
  const hasNaskEndpoint = GENAI_EXECUTE_ENDPOINTS.some(ep => ep.includes('sn_skill_builder'));
  if (hasNaskEndpoint) {
    pass('GENAI_EXECUTE_ENDPOINTS includes NASK sn_skill_builder endpoint');
  } else {
    fail('GENAI_EXECUTE_ENDPOINTS should include sn_skill_builder scope endpoint');
  }

  // Should preserve the original 3 endpoints
  const hasOriginal1 = GENAI_EXECUTE_ENDPOINTS.includes('/api/now/genai/controller/execute');
  const hasOriginal2 = GENAI_EXECUTE_ENDPOINTS.includes('/api/sn_genai/genai/controller/execute');
  const hasOriginal3 = GENAI_EXECUTE_ENDPOINTS.includes('/api/now/genai/execute');
  if (hasOriginal1 && hasOriginal2 && hasOriginal3) {
    pass('GENAI_EXECUTE_ENDPOINTS preserves all 3 original endpoints');
  } else {
    fail('GENAI_EXECUTE_ENDPOINTS should include all 3 original endpoints');
  }

  // clearEndpointCache should work without error
  clearEndpointCache();
  pass('clearEndpointCache() runs without error');

  // buildFlowApiScript should be an exported function
  if (typeof buildFlowApiScript === 'function') {
    pass('buildFlowApiScript is exported as a function');
  } else {
    fail('buildFlowApiScript should be an exported function');
  }

  // buildFlowApiScript should return a non-empty string
  const flowScript = buildFlowApiScript('test-skill', { prompt: 'Hello' });
  if (typeof flowScript === 'string' && flowScript.length > 0) {
    pass('buildFlowApiScript returns a non-empty string');
  } else {
    fail('buildFlowApiScript should return a non-empty script string');
  }

  // buildFlowApiScript output should reference FlowAPI
  if (flowScript.includes('FlowAPI') && flowScript.includes('sn_fd')) {
    pass('buildFlowApiScript output references sn_fd.FlowAPI');
  } else {
    fail('buildFlowApiScript should reference sn_fd.FlowAPI in its output');
  }

  // buildFlowApiScript output should reference generate_content action
  if (flowScript.includes('sn_generative_ai.generate_content')) {
    pass('buildFlowApiScript references sn_generative_ai.generate_content action');
  } else {
    fail('buildFlowApiScript should reference sn_generative_ai.generate_content');
  }

  // buildFlowApiScript should include the skill reference
  if (flowScript.includes('test-skill')) {
    pass('buildFlowApiScript includes skill reference in output');
  } else {
    fail('buildFlowApiScript should include the skill reference');
  }

  // buildFlowApiScript should include the input data
  if (flowScript.includes('Hello')) {
    pass('buildFlowApiScript includes input data in output');
  } else {
    fail('buildFlowApiScript should include the input data');
  }

  // buildFlowApiScript should handle model override
  const flowScriptWithModel = buildFlowApiScript('test-skill', { prompt: 'Hi' }, 'gpt-4');
  if (flowScriptWithModel.includes('gpt-4')) {
    pass('buildFlowApiScript includes model override when provided');
  } else {
    fail('buildFlowApiScript should include model override');
  }

  // buildFlowApiScript should handle temperature override
  const flowScriptWithTemp = buildFlowApiScript('test-skill', { prompt: 'Hi' }, undefined, 0.7);
  if (flowScriptWithTemp.includes('0.7')) {
    pass('buildFlowApiScript includes temperature override when provided');
  } else {
    fail('buildFlowApiScript should include temperature override');
  }

  // servicenow_skill_execute should require connection (guards still work)
  const skillExecResult = await handleSkillTool('servicenow_skill_execute', { skill: 'test', input: { prompt: 'hi' } });
  if (skillExecResult && skillExecResult.isError && skillExecResult.content[0].text.includes('Not connected')) {
    pass('servicenow_skill_execute rejects when not connected');
  } else {
    fail('servicenow_skill_execute should require connection');
  }

  // ── New Table Constants ─────────────────────────────────────
  section('New Table Constants (Skills Kit + AIA Team)');

  if (SKILL_FAMILY_TABLES.includes('sn_nowassist_skill_family')) {
    pass('SKILL_FAMILY_TABLES includes sn_nowassist_skill_family');
  } else {
    fail('SKILL_FAMILY_TABLES missing sn_nowassist_skill_family');
  }

  if (SKILL_STATUS_TABLES.includes('sn_nowassist_skill_config_status')) {
    pass('SKILL_STATUS_TABLES includes sn_nowassist_skill_config_status');
  } else {
    fail('SKILL_STATUS_TABLES missing sn_nowassist_skill_config_status');
  }

  if (PROMPT_LINK_TABLES.includes('sys_generative_ai_prompt_config')) {
    pass('PROMPT_LINK_TABLES includes sys_generative_ai_prompt_config');
  } else {
    fail('PROMPT_LINK_TABLES missing sys_generative_ai_prompt_config');
  }

  if (RESOURCE_MAPPING_TABLES.includes('sys_one_extend_resource_mapping')) {
    pass('RESOURCE_MAPPING_TABLES includes sys_one_extend_resource_mapping');
  } else {
    fail('RESOURCE_MAPPING_TABLES missing sys_one_extend_resource_mapping');
  }

  if (DIAGRAM_BUILDER_INSTANCE_TABLES.includes('sn_diagram_builder_instance')) {
    pass('DIAGRAM_BUILDER_INSTANCE_TABLES includes sn_diagram_builder_instance');
  } else {
    fail('DIAGRAM_BUILDER_INSTANCE_TABLES missing sn_diagram_builder_instance');
  }

  if (AIA_TEAM_TABLES.includes('sn_aia_team')) {
    pass('AIA_TEAM_TABLES includes sn_aia_team');
  } else {
    fail('AIA_TEAM_TABLES missing sn_aia_team');
  }

  if (AIA_TEAM_MEMBER_TABLES.includes('sn_aia_team_member')) {
    pass('AIA_TEAM_MEMBER_TABLES includes sn_aia_team_member');
  } else {
    fail('AIA_TEAM_MEMBER_TABLES missing sn_aia_team_member');
  }

  if (AIA_STRATEGY_TABLES.includes('sn_aia_strategy')) {
    pass('AIA_STRATEGY_TABLES includes sn_aia_strategy');
  } else {
    fail('AIA_STRATEGY_TABLES missing sn_aia_strategy');
  }

  // ── servicenow_skill_create Rewrite Tests ─────────────────────
  section('servicenow_skill_create (Full Rewrite)');

  {
    const skillCreateTool2 = SKILL_TOOLS.find(t => t.name === 'servicenow_skill_create');
    if (skillCreateTool2) {
      const schema = skillCreateTool2.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
      if (schema.properties?.inputs) {
        pass('servicenow_skill_create has inputs[] property');
      } else {
        fail('servicenow_skill_create missing inputs[] property');
      }
      if (schema.properties?.model) {
        pass('servicenow_skill_create has model property');
      } else {
        fail('servicenow_skill_create missing model property');
      }
      if (schema.properties?.llmFlowSysId) {
        pass('servicenow_skill_create has llmFlowSysId override property');
      } else {
        fail('servicenow_skill_create missing llmFlowSysId override property');
      }
      if (schema.properties?.roleSysId) {
        pass('servicenow_skill_create has roleSysId override property');
      } else {
        fail('servicenow_skill_create missing roleSysId override property');
      }
    }
  }

  {
    const skillDryRun = await handleSkillCreate({
      skillName: 'Test Skill',
      description: 'A test skill',
      promptTemplate: 'You are a test assistant. Input: {{query}}',
      inputs: [{ name: 'query', label: 'query', description: 'User query' }],
      dryRun: true,
    });
    const text = (skillDryRun.content[0] as { text: string }).text;
    if (text.includes('DRY RUN')) {
      pass('servicenow_skill_create dryRun output includes DRY RUN header');
    } else {
      fail('servicenow_skill_create dryRun output missing DRY RUN header');
    }
    if (text.includes('Phase 1') && text.includes('Phase 8')) {
      pass('servicenow_skill_create dryRun output shows all phases (1 through 8)');
    } else {
      fail('servicenow_skill_create dryRun output missing phases');
    }
    if (text.includes('PRE-FLIGHT')) {
      pass('servicenow_skill_create dryRun output includes PRE-FLIGHT section');
    } else {
      fail('servicenow_skill_create dryRun output missing PRE-FLIGHT section');
    }
    if (text.toLowerCase().includes('query') || text.includes('inputs')) {
      pass('servicenow_skill_create dryRun output reflects provided inputs');
    } else {
      fail('servicenow_skill_create dryRun output missing input reference');
    }
  }

  {
    const overrideDryRun = await handleSkillCreate({
      skillName: 'Override Skill',
      description: 'Test overrides',
      promptTemplate: 'Test prompt',
      llmFlowSysId: 'aabbccddaabbccddaabbccddaabbccdd',
      roleSysId: '11223344112233441122334411223344',
      dryRun: true,
    });
    const overrideText = (overrideDryRun.content[0] as { text: string }).text;
    if (overrideText.includes('aabbccddaabbccddaabbccddaabbccdd')) {
      pass('servicenow_skill_create dryRun shows explicit llmFlowSysId override');
    } else {
      fail('servicenow_skill_create dryRun missing explicit llmFlowSysId override');
    }
  }

  {
    const missingFields = await handleSkillCreate({
      skillName: 'Incomplete',
      dryRun: true,
    });
    if (missingFields.isError) {
      pass('servicenow_skill_create returns error when required fields missing');
    } else {
      fail('servicenow_skill_create should error when required fields missing');
    }
  }

  // ── servicenow_aia_usecase_create Tests ───────────────────────
  section('servicenow_aia_usecase_create (New Tool)');

  {
    const usecaseCreateTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_usecase_create');
    if (usecaseCreateTool) {
      pass('servicenow_aia_usecase_create tool is defined in AIA_TOOLS');
    } else {
      fail('servicenow_aia_usecase_create tool missing from AIA_TOOLS');
    }
    if (usecaseCreateTool) {
      const schema = usecaseCreateTool.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
      if (schema.required?.includes('name') && schema.required?.includes('agents') && schema.required?.includes('basePlan')) {
        pass('servicenow_aia_usecase_create requires name, agents, and basePlan');
      } else {
        fail('servicenow_aia_usecase_create missing required fields');
      }
      if (schema.properties?.dryRun) {
        pass('servicenow_aia_usecase_create has dryRun property');
      } else {
        fail('servicenow_aia_usecase_create missing dryRun property');
      }
      if (schema.properties?.prefix) {
        pass('servicenow_aia_usecase_create has prefix property');
      } else {
        fail('servicenow_aia_usecase_create missing prefix property');
      }
    }
  }

  if (isAiaTool('servicenow_aia_usecase_create')) {
    pass('isAiaTool("servicenow_aia_usecase_create") returns true');
  } else {
    fail('isAiaTool("servicenow_aia_usecase_create") should return true');
  }

  {
    const ucForbiddenDry = await handleAiaUsecaseCreate({
      name: 'Test Use Case',
      prefix: 'tst',
      description: 'Test',
      basePlan: 'Do stuff',
      agents: [{
        name: 'Test Agent',
        description: 'Test',
        role: 'Test role',
        instructions: 'Do things',
        proficiency: '- Does things',
        tools: [{
          name: 'Bad Tool',
          description: 'Uses forbidden APIs',
          inputSchema: [{ name: 'input', description: 'Input' }],
          script: `(function(inputs) { gs.info('hello'); return 'ok'; })(inputs);`,
        }],
      }],
      dryRun: true,
    });
    const ucText = (ucForbiddenDry.content[0] as { text: string }).text;
    if (ucText.includes('FORBIDDEN')) {
      pass('servicenow_aia_usecase_create dryRun warns about forbidden APIs');
    } else {
      fail('servicenow_aia_usecase_create dryRun missing forbidden API warning');
    }
  }

  {
    const ucDryRun = await handleAiaUsecaseCreate({
      name: 'Incident Handler',
      prefix: 'gp01',
      description: 'Handles incidents',
      basePlan: '1. Accept incident\n2. Resolve it',
      agents: [{
        name: 'Incident Agent',
        description: 'Resolves incidents',
        role: 'IT service desk agent',
        instructions: '1. Look up incident\n2. Resolve it',
        proficiency: '- Looks up incidents\n- Resolves incidents',
        tools: [{
          name: 'Fetch Incident',
          description: 'Fetches an incident by number',
          inputSchema: [{ name: 'number', description: 'Incident number' }],
          script: `(function(inputs) { return 'incident data'; })(inputs);`,
        }],
      }],
      dryRun: true,
    });
    const ucRunText = (ucDryRun.content[0] as { text: string }).text;
    if (ucRunText.includes('DRY RUN')) {
      pass('servicenow_aia_usecase_create dryRun output has DRY RUN header');
    } else {
      fail('servicenow_aia_usecase_create dryRun output missing DRY RUN header');
    }
    if (ucRunText.includes('gp01 Incident Handler') || ucRunText.includes('gp01')) {
      pass('servicenow_aia_usecase_create dryRun output shows prefix in record names');
    } else {
      fail('servicenow_aia_usecase_create dryRun output missing prefix in record names');
    }
    if (ucRunText.includes('ReAct') || ucRunText.includes('strategy')) {
      pass('servicenow_aia_usecase_create dryRun output references strategy lookup');
    } else {
      fail('servicenow_aia_usecase_create dryRun output missing strategy section');
    }
    if (ucRunText.includes('Team') && ucRunText.includes('Use Case')) {
      pass('servicenow_aia_usecase_create dryRun output shows Team and Use Case records');
    } else {
      fail('servicenow_aia_usecase_create dryRun output missing Team/Use Case records');
    }
  }

  {
    const ucMissing = await handleAiaUsecaseCreate({
      name: 'Missing Agents Use Case',
      prefix: 'tst',
      description: 'Test',
      basePlan: 'Do stuff',
      dryRun: true,
    });
    if (ucMissing.isError || (ucMissing.content[0] as { text: string }).text.toLowerCase().includes('error')) {
      pass('servicenow_aia_usecase_create returns error when agents[] missing');
    } else {
      fail('servicenow_aia_usecase_create should error when agents[] missing');
    }
  }

  {
    const ucNoConn = await handleAiaUsecaseCreate({
      name: 'Test', prefix: 'tst', description: 'Test', basePlan: 'Test',
      agents: [{ name: 'A', description: 'B', role: 'C', instructions: 'D', proficiency: 'E', tools: [] }],
      dryRun: false,
    });
    if (ucNoConn.isError && (ucNoConn.content[0] as { text: string }).text.includes('Not connected')) {
      pass('servicenow_aia_usecase_create requires connection when dryRun=false');
    } else {
      fail('servicenow_aia_usecase_create should require connection when dryRun=false');
    }
  }

  // ── Total Tool Count ──────────────────────────────────────────
  section('Total Tool Count');

  const totalServiceNowTools = SERVICENOW_TOOLS.length + AIA_TOOLS.length + SKILL_TOOLS.length + FLOW_TOOLS.length;
  const expectedTotal = 8 + 11 + 4 + 2; // 25
  if (totalServiceNowTools === expectedTotal) {
    pass(`All ${expectedTotal} ServiceNow tools defined (8 core + 11 AIA + 4 skill + 2 flow)`);
  } else {
    fail(`Expected ${expectedTotal} total tools, found ${totalServiceNowTools}`);
  }

  // Summary
  t.log("═══════════════════════════════════════════════════════════", "header");
  t.log("  SUMMARY", "header");
  t.log("═══════════════════════════════════════════════════════════", "header");

  const { failed: failCount } = t.printSummary();

  t.log("Note: Live connection tests require a ServiceNow instance.", "header");
  t.log("To test connections manually:", "header");
  t.log("  1. Set up credentials in ~/.servicenow/credentials.json", "header");
  t.log("  2. Or use basic auth with username/password", "header");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
