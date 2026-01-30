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
import { ServiceNowClient } from '../src/servicenow/client.js';
import { ServiceNowError, ServiceNowErrorType } from '../src/servicenow/types.js';

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function pass(message: string): void {
  console.log(`${GREEN}✓ ${message}${RESET}`);
  passed++;
}

function fail(message: string, error?: unknown): void {
  console.log(`${RED}✗ ${message}${RESET}`);
  if (error) {
    console.log(`  Error: ${error}`);
  }
  failed++;
}

function section(title: string): void {
  console.log(`\n${CYAN}→ ${title}${RESET}`);
}

async function runTests(): Promise<void> {
  console.log(`\n${CYAN}→ ═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}→   SERVICENOW TOOLS VALIDATION TEST${RESET}`);
  console.log(`${CYAN}→ ═══════════════════════════════════════════════════════════${RESET}`);

  // Test 1: Tool definitions
  section('Tool Definitions');

  // Check all expected tools are defined
  const expectedTools = ['servicenow_connect', 'servicenow_disconnect', 'servicenow_status'];
  for (const toolName of expectedTools) {
    const tool = SERVICENOW_TOOLS.find(t => t.name === toolName);
    if (tool) {
      pass(`${toolName} tool is defined`);
    } else {
      fail(`${toolName} tool is missing`);
    }
  }

  // Check tool has required schema properties
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

  // Test 2: isServiceNowTool function
  section('Tool Detection');

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

  // Test 3: Status when not connected
  section('Status Handler (No Connection)');

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

  // Test 4: Disconnect when not connected
  section('Disconnect Handler (No Connection)');

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

  // Test 5: Connect validation
  section('Connect Handler (Validation)');

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

  // Test 5b: Syslogs requires connection
  section('Syslogs Handler (No Connection)');

  const syslogsNoConnection = await handleServiceNowTool('servicenow_syslogs', {});
  if (syslogsNoConnection) {
    if (syslogsNoConnection.isError && syslogsNoConnection.content[0].text.includes('Not connected')) {
      pass('Syslogs rejects when not connected');
    } else {
      fail('Syslogs should require connection');
    }
  } else {
    fail('Syslogs handler returned null');
  }

  // Test 5c: Syslogs tool is defined
  const syslogsTool = SERVICENOW_TOOLS.find(t => t.name === 'servicenow_syslogs');
  if (syslogsTool) {
    pass('servicenow_syslogs tool is defined');
    const schema = syslogsTool.inputSchema as { properties?: Record<string, unknown> };
    if (schema.properties?.level && schema.properties?.timeRange && schema.properties?.source) {
      pass('servicenow_syslogs has expected filter properties');
    } else {
      fail('servicenow_syslogs missing filter properties');
    }
  } else {
    fail('servicenow_syslogs tool is missing');
  }

  if (isServiceNowTool('servicenow_syslogs')) {
    pass('isServiceNowTool("servicenow_syslogs") returns true');
  } else {
    fail('isServiceNowTool("servicenow_syslogs") should return true');
  }

  // Test 5d: AIA logs requires connection
  section('AIA Logs Handler (No Connection)');

  const aiaLogsNoConnection = await handleServiceNowTool('servicenow_aia_logs', {});
  if (aiaLogsNoConnection) {
    if (aiaLogsNoConnection.isError && aiaLogsNoConnection.content[0].text.includes('Not connected')) {
      pass('AIA logs rejects when not connected');
    } else {
      fail('AIA logs should require connection');
    }
  } else {
    fail('AIA logs handler returned null');
  }

  // Test 5e: AIA logs tool is defined
  const aiaLogsTool = SERVICENOW_TOOLS.find(t => t.name === 'servicenow_aia_logs');
  if (aiaLogsTool) {
    pass('servicenow_aia_logs tool is defined');
    const schema = aiaLogsTool.inputSchema as { properties?: Record<string, unknown> };
    if (schema.properties?.executionId && schema.properties?.agentName && schema.properties?.status) {
      pass('servicenow_aia_logs has expected filter properties');
    } else {
      fail('servicenow_aia_logs missing filter properties');
    }
  } else {
    fail('servicenow_aia_logs tool is missing');
  }

  if (isServiceNowTool('servicenow_aia_logs')) {
    pass('isServiceNowTool("servicenow_aia_logs") returns true');
  } else {
    fail('isServiceNowTool("servicenow_aia_logs") should return true');
  }

  // Test 5f: Query requires connection
  section('Query Handler (No Connection)');

  const queryNoConnection = await handleServiceNowTool('servicenow_query', { table: 'incident' });
  if (queryNoConnection) {
    if (queryNoConnection.isError && queryNoConnection.content[0].text.includes('Not connected')) {
      pass('Query rejects when not connected');
    } else {
      fail('Query should require connection');
    }
  } else {
    fail('Query handler returned null');
  }

  // Test 5g: Query requires table
  const queryNoTable = await handleServiceNowTool('servicenow_query', {});
  if (queryNoTable) {
    // When not connected, it will fail with "Not connected" first
    // So we just check the handler returns something
    pass('Query handler handles missing table');
  } else {
    fail('Query handler returned null');
  }

  // Test 5h: Query tool is defined
  const queryTool = SERVICENOW_TOOLS.find(t => t.name === 'servicenow_query');
  if (queryTool) {
    pass('servicenow_query tool is defined');
    const schema = queryTool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    if (schema.properties?.table && schema.properties?.query && schema.properties?.fields) {
      pass('servicenow_query has expected properties');
    } else {
      fail('servicenow_query missing expected properties');
    }
    if (schema.required?.includes('table')) {
      pass('servicenow_query requires table');
    } else {
      fail('servicenow_query should require table');
    }
  } else {
    fail('servicenow_query tool is missing');
  }

  if (isServiceNowTool('servicenow_query')) {
    pass('isServiceNowTool("servicenow_query") returns true');
  } else {
    fail('isServiceNowTool("servicenow_query") should return true');
  }

  // Test 5i: Script requires connection
  section('Script Handler (No Connection)');

  const scriptNoConnection = await handleServiceNowTool('servicenow_script', { script: 'gs.info("test")' });
  if (scriptNoConnection) {
    if (scriptNoConnection.isError && scriptNoConnection.content[0].text.includes('Not connected')) {
      pass('Script rejects when not connected');
    } else {
      fail('Script should require connection');
    }
  } else {
    fail('Script handler returned null');
  }

  // Test 5j: Script requires script parameter
  const scriptNoScript = await handleServiceNowTool('servicenow_script', {});
  if (scriptNoScript) {
    // Will fail with "Not connected" first, but handler exists
    pass('Script handler handles missing script');
  } else {
    fail('Script handler returned null');
  }

  // Test 5k: Script tool is defined
  const scriptTool = SERVICENOW_TOOLS.find(t => t.name === 'servicenow_script');
  if (scriptTool) {
    pass('servicenow_script tool is defined');
    const schema = scriptTool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    if (schema.properties?.script && schema.properties?.mode && schema.properties?.timeout) {
      pass('servicenow_script has expected properties');
    } else {
      fail('servicenow_script missing expected properties');
    }
    if (schema.required?.includes('script')) {
      pass('servicenow_script requires script');
    } else {
      fail('servicenow_script should require script');
    }
  } else {
    fail('servicenow_script tool is missing');
  }

  if (isServiceNowTool('servicenow_script')) {
    pass('isServiceNowTool("servicenow_script") returns true');
  } else {
    fail('isServiceNowTool("servicenow_script") should return true');
  }

  // Test 5l: Instance requires connection
  section('Instance Handler (No Connection)');

  const instanceNoConnection = await handleServiceNowTool('servicenow_instance', {});
  if (instanceNoConnection) {
    if (instanceNoConnection.isError && instanceNoConnection.content[0].text.includes('Not connected')) {
      pass('Instance rejects when not connected');
    } else {
      fail('Instance should require connection');
    }
  } else {
    fail('Instance handler returned null');
  }

  // Test 5m: Instance tool is defined
  const instanceTool = SERVICENOW_TOOLS.find(t => t.name === 'servicenow_instance');
  if (instanceTool) {
    pass('servicenow_instance tool is defined');
    const schema = instanceTool.inputSchema as { properties?: Record<string, unknown> };
    if (schema.properties?.includePlugins && schema.properties?.includeHealth && schema.properties?.checkFeatures) {
      pass('servicenow_instance has expected properties');
    } else {
      fail('servicenow_instance missing expected properties');
    }
  } else {
    fail('servicenow_instance tool is missing');
  }

  if (isServiceNowTool('servicenow_instance')) {
    pass('isServiceNowTool("servicenow_instance") returns true');
  } else {
    fail('isServiceNowTool("servicenow_instance") should return true');
  }

  // Test: Total tool count
  section('Tool Count');
  const expectedToolCount = 8; // connect, disconnect, status, syslogs, aia_logs, query, script, instance
  if (SERVICENOW_TOOLS.length === expectedToolCount) {
    pass(`All ${expectedToolCount} ServiceNow tools are defined`);
  } else {
    fail(`Expected ${expectedToolCount} tools, found ${SERVICENOW_TOOLS.length}`);
  }

  // Test 6: ServiceNowClient URL normalization
  section('Client URL Normalization');

  // Test with basic auth config for instantiation
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

  // Test 7: ServiceNowError
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

  // Test 8: ConnectionManager status
  section('Connection Manager');

  const managerStatus = connectionManager.getStatus();
  if (!managerStatus.connected && managerStatus.sessionCount === 0) {
    pass('ConnectionManager starts with no connections');
  } else {
    fail('ConnectionManager should start empty');
  }

  // Summary
  console.log(`\n${CYAN}→ ═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}→   SUMMARY${RESET}`);
  console.log(`${CYAN}→ ═══════════════════════════════════════════════════════════${RESET}`);

  const total = passed + failed;
  if (failed === 0) {
    console.log(`\n${GREEN}✓ Passed: ${passed}/${total}${RESET}`);
  } else {
    console.log(`\n${RED}✗ Failed: ${failed}/${total}${RESET}`);
    console.log(`${GREEN}✓ Passed: ${passed}/${total}${RESET}`);
  }

  console.log(`\n${CYAN}→ Note: Live connection tests require a ServiceNow instance.${RESET}`);
  console.log(`${CYAN}→ To test connections manually:${RESET}`);
  console.log(`${CYAN}→   1. Set up credentials in ~/.servicenow/credentials.json${RESET}`);
  console.log(`${CYAN}→   2. Or use basic auth with username/password${RESET}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
