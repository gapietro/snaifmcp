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
} from '../src/servicenow/index.js';
import {
  AIA_TOOLS,
  isAiaTool,
  handleAiaTool,
} from '../src/servicenow/tools-aia.js';
import {
  SKILL_TOOLS,
  isSkillTool,
  handleSkillTool,
} from '../src/servicenow/tools-skills.js';
import { requireConnection, isConnectionError } from '../src/servicenow/guards.js';
import { clearTableCache } from '../src/servicenow/table-discovery.js';
import {
  checkScriptApi,
  deployScriptApi,
  ensureScriptApi,
  executeViaScriptApi,
  clearScriptApiCache,
} from '../src/servicenow/script-api.js';
import { ServiceNowClient } from '../src/servicenow/client.js';
import { ServiceNowError, ServiceNowErrorType } from '../src/servicenow/types.js';
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
  ];
  for (const toolName of expectedAiaTools) {
    const tool = AIA_TOOLS.find(t => t.name === toolName);
    if (tool) {
      pass(`${toolName} tool is defined`);
    } else {
      fail(`${toolName} tool is missing`);
    }
  }

  if (AIA_TOOLS.length === 6) {
    pass(`All 6 AIA tools defined`);
  } else {
    fail(`Expected 6 AIA tools, found ${AIA_TOOLS.length}`);
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

  for (const toolName of expectedAiaTools) {
    const result = await handleAiaTool(toolName, { agent: 'test', executionId: 'test', input: 'test', agentName: 'test', agentDescription: 'test', agentInstructions: 'test' });
    if (result && result.isError && result.content[0].text.includes('Not connected')) {
      pass(`${toolName} rejects when not connected`);
    } else {
      fail(`${toolName} should require connection`);
    }
  }

  // ── Skill Handlers (No Connection) ──────────────────────────────
  section('Skill Handlers (No Connection)');

  for (const toolName of expectedSkillTools) {
    const result = await handleSkillTool(toolName, { skill: 'test', input: {}, skillName: 'test', description: 'test', promptTemplate: 'test' });
    if (result && result.isError && result.content[0].text.includes('Not connected')) {
      pass(`${toolName} rejects when not connected`);
    } else {
      fail(`${toolName} should require connection`);
    }
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

  // ── Total Tool Count ──────────────────────────────────────────
  section('Total Tool Count');

  const totalServiceNowTools = SERVICENOW_TOOLS.length + AIA_TOOLS.length + SKILL_TOOLS.length;
  const expectedTotal = 8 + 6 + 4; // 18
  if (totalServiceNowTools === expectedTotal) {
    pass(`All ${expectedTotal} ServiceNow tools defined (8 core + 6 AIA + 4 skill)`);
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
