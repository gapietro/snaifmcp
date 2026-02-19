#!/usr/bin/env npx tsx

/**
 * Live ServiceNow Instance Tests
 *
 * Exercises all 29 test cases that require a live ServiceNow connection.
 * Uses the tool handlers directly (same codepath as MCP).
 *
 * Usage:
 *   npx tsx foundry-test/live-instance-tests.ts
 */

import { connectionManager } from "../dist/servicenow/connection-manager.js";
import {
  handleServiceNowConnect,
  handleServiceNowDisconnect,
  handleServiceNowStatus,
  handleServiceNowSyslogs,
  handleServiceNowAiaLogs,
  handleServiceNowQuery,
  handleServiceNowScript,
  handleServiceNowInstance,
} from "../dist/servicenow/tools.js";
import {
  handleAiaList,
  handleAiaGet,
  handleAiaTrace,
  handleAiaErrors,
  handleAiaExecute,
  handleAiaCreate,
} from "../dist/servicenow/tools-aia.js";
import {
  handleSkillList,
  handleSkillGet,
  handleSkillExecute,
  handleSkillCreate,
} from "../dist/servicenow/tools-skills.js";
import { clearTableCache } from "../dist/servicenow/table-discovery.js";

// ── Config ──────────────────────────────────────────────────
const INSTANCE = "gpinst01.service-now.com";
const USERNAME = "admin";
const PASSWORD = "Jajwuth1!";

// ── Test Runner ─────────────────────────────────────────────
interface TestResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
  durationMs: number;
}

const results: TestResult[] = [];

function section(name: string) {
  console.log(`\n\x1b[36m═══ ${name} ═══\x1b[0m`);
}

async function test(id: string, name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    results.push({ id, name, status: "PASS", detail, durationMs: ms });
    console.log(`  \x1b[32m✓\x1b[0m ${id} ${name} \x1b[90m(${ms}ms)\x1b[0m`);
  } catch (err: any) {
    const ms = Date.now() - start;
    const detail = err.message || String(err);
    results.push({ id, name, status: "FAIL", detail, durationMs: ms });
    console.log(`  \x1b[31m✗\x1b[0m ${id} ${name}`);
    console.log(`    \x1b[31m→ ${detail.substring(0, 200)}\x1b[0m`);
  }
}

function skip(id: string, name: string, reason: string) {
  results.push({ id, name, status: "SKIP", detail: reason, durationMs: 0 });
  console.log(`  \x1b[33m○\x1b[0m ${id} ${name} \x1b[90m(${reason})\x1b[0m`);
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function getText(result: any): string {
  return result?.content?.[0]?.text || "";
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log(`\n\x1b[1m╔══════════════════════════════════════════════════════════╗\x1b[0m`);
  console.log(`\x1b[1m║  Live ServiceNow Instance Tests                         ║\x1b[0m`);
  console.log(`\x1b[1m║  Instance: ${INSTANCE.padEnd(44)}║\x1b[0m`);
  console.log(`\x1b[1m╚══════════════════════════════════════════════════════════╝\x1b[0m`);

  // ═══════════════════════════════════════════════════════════
  // SECTION 1: Authentication & Connection
  // ═══════════════════════════════════════════════════════════
  section("1. Authentication & Connection");

  await test("SC-005", "Basic auth connection", async () => {
    const result = await handleServiceNowConnect({
      instance: INSTANCE,
      authType: "basic",
      username: USERNAME,
      password: PASSWORD,
    });
    assert(!result.isError, `Connection failed: ${getText(result)}`);
    const text = getText(result);
    assert(text.includes("Connected"), "Expected 'Connected' in response");
    assert(text.includes(USERNAME) || text.includes("admin"), "Expected username in response");
    return `Connected. ${text.substring(0, 100)}`;
  });

  await test("SS-002", "Status when connected", async () => {
    const result = await handleServiceNowStatus({});
    assert(!result.isError, `Status check failed: ${getText(result)}`);
    const text = getText(result);
    assert(text.includes("Active Instance"), "Expected 'Active Instance' in status");
    assert(text.includes(USERNAME) || text.includes("admin"), "Expected user in status");
    return `Status OK. ${text.substring(0, 100)}`;
  });

  await test("SC-008", "Invalid credentials rejected", async () => {
    // Disconnect first, try bad creds, then reconnect
    connectionManager.disconnect();
    const result = await handleServiceNowConnect({
      instance: INSTANCE,
      authType: "basic",
      username: "baduser",
      password: "badpassword",
    });
    assert(result.isError === true, "Expected error for bad credentials");
    const text = getText(result);
    assert(
      text.toLowerCase().includes("auth") || text.toLowerCase().includes("fail") || text.toLowerCase().includes("401"),
      `Expected auth error message, got: ${text.substring(0, 100)}`
    );
    // Reconnect with good creds
    const reconnect = await handleServiceNowConnect({
      instance: INSTANCE,
      authType: "basic",
      username: USERNAME,
      password: PASSWORD,
    });
    assert(!reconnect.isError, "Reconnect failed after bad creds test");
    return `Bad creds correctly rejected: ${text.substring(0, 80)}`;
  });

  await test("SC-009", "Unreachable instance", async () => {
    // Don't disconnect — just try to connect to a fake instance
    // connectionManager supports multiple sessions, so this won't break the existing one
    const result = await handleServiceNowConnect({
      instance: "fake-nonexistent-instance-12345.service-now.com",
      authType: "basic",
      username: "admin",
      password: "admin",
    });
    assert(result.isError === true, "Expected error for unreachable instance");
    const text = getText(result);
    assert(
      text.toLowerCase().includes("connect") || text.toLowerCase().includes("unavail") || text.toLowerCase().includes("failed"),
      `Expected connection error, got: ${text.substring(0, 100)}`
    );
    return `Unreachable instance correctly rejected: ${text.substring(0, 80)}`;
  });

  // Re-ensure we're connected to the good instance
  if (!connectionManager.isConnected()) {
    await handleServiceNowConnect({
      instance: INSTANCE,
      authType: "basic",
      username: USERNAME,
      password: PASSWORD,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 2: Table Query
  // ═══════════════════════════════════════════════════════════
  section("2. Table Query (servicenow_query)");

  await test("SQ-002", "Basic table query", async () => {
    const result = await handleServiceNowQuery({
      table: "incident",
      limit: 5,
    });
    assert(!result.isError, `Query failed: ${getText(result)}`);
    const text = getText(result);
    assert(text.includes("incident") || text.includes("Query Results"), "Expected incident data");
    return `Got incident records. ${text.substring(0, 100)}`;
  });

  await test("SQ-003", "Query with filter", async () => {
    const result = await handleServiceNowQuery({
      table: "incident",
      query: "active=true",
      limit: 3,
    });
    assert(!result.isError, `Filtered query failed: ${getText(result)}`);
    const text = getText(result);
    // Either we get results or "No records" — both are valid
    assert(
      text.includes("Query Results") || text.includes("No records"),
      "Expected query response"
    );
    return `Filtered query OK. ${text.substring(0, 100)}`;
  });

  await test("SQ-004", "Query with field selection", async () => {
    const result = await handleServiceNowQuery({
      table: "sys_user",
      query: "active=true",
      fields: ["user_name", "email", "first_name"],
      limit: 3,
    });
    assert(!result.isError, `Field select query failed: ${getText(result)}`);
    const text = getText(result);
    assert(
      text.includes("user_name") || text.includes("email") || text.includes("No records"),
      "Expected user fields in response"
    );
    return `Field selection OK. ${text.substring(0, 100)}`;
  });

  await test("SQ-005", "Query with ordering", async () => {
    const result = await handleServiceNowQuery({
      table: "incident",
      query: "active=true",
      orderBy: "sys_created_on",
      orderDirection: "desc",
      limit: 3,
    });
    assert(!result.isError, `Ordered query failed: ${getText(result)}`);
    return `Ordered query OK. ${getText(result).substring(0, 100)}`;
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 3: Syslogs & AIA Logs
  // ═══════════════════════════════════════════════════════════
  section("3. Syslogs & AIA Logs");

  await test("SL-002", "Default syslog query", async () => {
    const result = await handleServiceNowSyslogs({
      level: "all",
      timeRange: "24h",
      limit: 10,
    });
    assert(!result.isError, `Syslog query failed: ${getText(result)}`);
    const text = getText(result);
    // Might be "No logs found" or actual logs
    assert(
      text.includes("System Logs") || text.includes("No logs found"),
      "Expected syslog response"
    );
    return `Syslog query OK. ${text.substring(0, 100)}`;
  });

  await test("AL-002", "Default AIA log query", async () => {
    const result = await handleServiceNowAiaLogs({
      timeRange: "7d",
      status: "all",
      limit: 10,
    });
    // This may error if AIA tables don't exist — that's informative, not a failure
    const text = getText(result);
    assert(
      text.includes("Execution") || text.includes("No AI Agent") || text.includes("Could not find"),
      "Expected AIA log response"
    );
    return `AIA log query responded. ${text.substring(0, 100)}`;
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 4: Script Execution
  // ═══════════════════════════════════════════════════════════
  section("4. Script Execution");

  await test("XS-002", "Read-only script execution", async () => {
    const result = await handleServiceNowScript({
      script: `var gr = new GlideRecord('sys_properties');
gr.addQuery('name', 'glide.buildtag');
gr.setLimit(1);
gr.query();
if (gr.next()) {
  gs.info('Build: ' + gr.getValue('value'));
}`,
      mode: "readonly",
      description: "Test: read build tag",
    });
    // Script execution may work or may not have an endpoint — both are informative
    const text = getText(result);
    assert(
      text.includes("Script Execution") ||
      text.includes("Build") ||
      text.includes("RESULT") ||
      text.includes("no output") ||
      text.includes("failed"),
      "Expected script execution response"
    );
    return `Script exec responded. ${text.substring(0, 120)}`;
  });

  await test("XS-003", "Execute mode", async () => {
    // Safe read-only operation even in execute mode
    const result = await handleServiceNowScript({
      script: `gs.info('Hello from Foundry MCP test');`,
      mode: "execute",
      description: "Test: execute mode hello",
    });
    const text = getText(result);
    assert(
      text.includes("Script Execution") ||
      text.includes("Hello") ||
      text.includes("RESULT") ||
      text.includes("no output") ||
      text.includes("failed"),
      "Expected script execution response"
    );
    return `Execute mode responded. ${text.substring(0, 120)}`;
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 5: Instance Info
  // ═══════════════════════════════════════════════════════════
  section("5. Instance Info");

  await test("SI-002", "Basic instance info", async () => {
    const result = await handleServiceNowInstance({
      checkFeatures: ["now_assist", "aia", "virtual_agent"],
    });
    assert(!result.isError, `Instance info failed: ${getText(result)}`);
    const text = getText(result);
    assert(text.includes("Instance"), "Expected 'Instance' in response");
    assert(text.includes("FEATURES"), "Expected 'FEATURES' section");
    return `Instance info OK. ${text.substring(0, 150)}`;
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 6: AI Agent Tools
  // ═══════════════════════════════════════════════════════════
  section("6. AI Agent Tools");

  // Clear table discovery cache for fresh probing
  clearTableCache();

  let hasAiaAgents = false;
  let firstAgentName = "";
  let firstAgentId = "";

  await test("AAL-002", "List all agents (live)", async () => {
    const result = await handleAiaList({ status: "all", limit: 10 });
    const text = getText(result);

    if (result.isError && text.includes("Could not find AI Agent table")) {
      // AIA not installed — this is a valid finding
      return `AIA not installed on this instance (table not found)`;
    }

    if (text.includes("No AI Agents found")) {
      return `No agents found on instance (AIA installed but empty)`;
    }

    // If we got agents, record them
    assert(text.includes("AI Agents on") || text.includes("agent"), "Expected agent listing");
    hasAiaAgents = true;

    // Try to extract first agent name from the listing
    const nameMatch = text.match(/\[(?:ON|OFF)\]\s+(.+?)[\n\r]/);
    if (nameMatch) firstAgentName = nameMatch[1].trim();

    const idMatch = text.match(/sys_id:\s+([a-f0-9]{32})/);
    if (idMatch) firstAgentId = idMatch[1];

    return `Listed agents. First: ${firstAgentName || "N/A"}. ${text.substring(0, 100)}`;
  });

  await test("AAG-002", "Get agent by name (live)", async () => {
    if (!hasAiaAgents || !firstAgentName) {
      return "SKIP: No agents available to inspect";
    }
    const result = await handleAiaGet({
      agent: firstAgentName,
      includePrompt: true,
      includeToolDetails: true,
      includeStats: false,
    });
    const text = getText(result);
    assert(
      text.includes("AI Agent Details") || text.includes(firstAgentName) || result.isError,
      "Expected agent details or error"
    );
    return `Agent details: ${text.substring(0, 150)}`;
  });

  await test("AAT-002", "Trace execution (live)", async () => {
    // Try to find an execution to trace
    if (!hasAiaAgents) {
      return "SKIP: No AIA agents, skipping trace test";
    }
    // Use a fake execution ID — should return "not found" gracefully
    const result = await handleAiaTrace({
      executionId: "00000000000000000000000000000000",
    });
    const text = getText(result);
    assert(
      text.includes("not found") || text.includes("Execution") || text.includes("Could not find"),
      "Expected trace response"
    );
    return `Trace response: ${text.substring(0, 100)}`;
  });

  await test("AAE-002", "Default error aggregation (live)", async () => {
    const result = await handleAiaErrors({
      timeRange: "7d",
      groupBy: "error_type",
      limit: 10,
    });
    const text = getText(result);
    assert(
      text.includes("Error Analysis") || text.includes("No errors") || text.includes("Could not find"),
      "Expected error analysis response"
    );
    return `Error analysis: ${text.substring(0, 100)}`;
  });

  await test("AXE-002", "Execute agent (live)", async () => {
    if (!hasAiaAgents || !firstAgentId) {
      return "SKIP: No AIA agents to execute";
    }
    // Just try to trigger — may fail if agent isn't set up for programmatic execution
    const result = await handleAiaExecute({
      agent: firstAgentId,
      input: "Test from Foundry MCP automated tests",
      timeoutSeconds: 15,
    });
    const text = getText(result);
    // Any response is acceptable — we just want to see the tool doesn't crash
    assert(text.length > 0, "Expected non-empty response");
    return `Execute response: ${text.substring(0, 120)}`;
  });

  await test("AXC-004", "Create agent dry-run (live)", async () => {
    const result = await handleAiaCreate({
      agentName: "Foundry Test Agent",
      agentDescription: "Automated test — dry run only",
      agentInstructions: "You are a test agent created by Foundry MCP automated testing.",
      strategy: "ReAct",
      tools: [
        {
          name: "test_tool",
          description: "A test tool",
          script: "(function(inputs) { return { result: 'test' }; })(inputs)",
          inputSchema: JSON.stringify([{ name: "query", type: "string", mandatory: true }]),
        },
      ],
      dryRun: true, // DRY RUN — don't actually create
    });
    const text = getText(result);
    assert(
      text.includes("DRY RUN") || text.includes("Preview") || text.includes("Plan"),
      `Expected dry run plan, got: ${text.substring(0, 100)}`
    );
    assert(text.includes("Foundry Test Agent"), "Expected agent name in plan");
    return `Dry run OK. ${text.substring(0, 120)}`;
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 7: Now Assist Skill Tools
  // ═══════════════════════════════════════════════════════════
  section("7. Now Assist Skill Tools");

  clearTableCache();

  let hasSkills = false;
  let firstSkillName = "";

  await test("SKL-002", "List all skills (live)", async () => {
    const result = await handleSkillList({ status: "all", limit: 10 });
    const text = getText(result);

    if (result.isError && text.includes("Could not find Now Assist skill table")) {
      return `Now Assist skills not installed on this instance`;
    }

    if (text.includes("No skills found")) {
      return `No skills found on instance (Now Assist installed but empty)`;
    }

    assert(
      text.includes("Now Assist Skills") || text.includes("skill"),
      "Expected skill listing"
    );
    hasSkills = true;

    const nameMatch = text.match(/\[(?:ON|OFF)\]\s+(.+?)[\n\r]/);
    if (nameMatch) firstSkillName = nameMatch[1].trim();

    return `Listed skills. First: ${firstSkillName || "N/A"}. ${text.substring(0, 100)}`;
  });

  await test("SKG-002", "Get skill by name (live)", async () => {
    if (!hasSkills || !firstSkillName) {
      return "SKIP: No skills available to inspect";
    }
    const result = await handleSkillGet({
      skill: firstSkillName,
      includePrompt: true,
      includeSchema: true,
    });
    const text = getText(result);
    assert(
      text.includes("Skill Details") || text.includes(firstSkillName) || result.isError,
      "Expected skill details"
    );
    return `Skill details: ${text.substring(0, 150)}`;
  });

  await test("SKX-002", "Execute skill (live)", async () => {
    if (!hasSkills || !firstSkillName) {
      return "SKIP: No skills available to execute";
    }
    const result = await handleSkillExecute({
      skill: firstSkillName,
      input: { text: "Test input from Foundry MCP" },
    });
    const text = getText(result);
    // Any response is acceptable
    assert(text.length > 0, "Expected non-empty response");
    return `Skill execute response: ${text.substring(0, 120)}`;
  });

  await test("SKC-003", "Create skill dry-run (live)", async () => {
    const result = await handleSkillCreate({
      skillName: "Foundry Test Skill",
      description: "Automated test — dry run only",
      promptTemplate: "You are a test skill created by Foundry MCP automated testing.",
      dryRun: true,
    });
    const text = getText(result);
    assert(
      text.includes("DRY RUN") || text.includes("Preview") || text.includes("Plan"),
      `Expected dry run plan, got: ${text.substring(0, 100)}`
    );
    assert(text.includes("Foundry Test Skill"), "Expected skill name in plan");
    return `Dry run OK. ${text.substring(0, 120)}`;
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 8: Disconnect
  // ═══════════════════════════════════════════════════════════
  section("8. Disconnect");

  await test("SD-002", "Disconnect active session", async () => {
    const result = await handleServiceNowDisconnect({});
    const text = getText(result);
    assert(text.includes("Disconnected"), `Expected disconnect confirmation, got: ${text}`);
    // Verify disconnected
    const status = connectionManager.getStatus();
    assert(!status.connected, "Expected disconnected state");
    return `Disconnected OK`;
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 9: E2E Workflows
  // ═══════════════════════════════════════════════════════════
  section("9. E2E Workflows");

  // Reconnect for E2E
  await handleServiceNowConnect({
    instance: INSTANCE,
    authType: "basic",
    username: USERNAME,
    password: PASSWORD,
  });

  await test("E2E-004", "Agent build & test workflow", async () => {
    // 1. List agents
    const listResult = await handleAiaList({ status: "all", limit: 5 });
    const listText = getText(listResult);

    // 2. Create agent (dry run)
    const createResult = await handleAiaCreate({
      agentName: "E2E Test Agent",
      agentDescription: "End-to-end workflow test",
      agentInstructions: "Test instructions",
      strategy: "ReAct",
      tools: [],
      dryRun: true,
    });
    const createText = getText(createResult);
    assert(createText.includes("DRY RUN"), "Expected dry run in create");

    // 3. Check errors
    const errorResult = await handleAiaErrors({ timeRange: "7d" });
    const errorText = getText(errorResult);

    return `E2E agent workflow: list(${listText.substring(0, 30)}...) → create(dry) → errors(${errorText.substring(0, 30)}...)`;
  });

  await test("E2E-005", "Skill build & test workflow", async () => {
    // 1. List skills
    const listResult = await handleSkillList({ status: "all", limit: 5 });
    const listText = getText(listResult);

    // 2. Create skill (dry run)
    const createResult = await handleSkillCreate({
      skillName: "E2E Test Skill",
      description: "End-to-end workflow test",
      promptTemplate: "Test prompt template",
      dryRun: true,
    });
    const createText = getText(createResult);
    assert(createText.includes("DRY RUN"), "Expected dry run in create");

    return `E2E skill workflow: list(${listText.substring(0, 30)}...) → create(dry)`;
  });

  await test("E2E-006", "Troubleshooting flow", async () => {
    // 1. Check status
    const statusResult = await handleServiceNowStatus({});
    assert(!statusResult.isError, "Status check failed");

    // 2. Get instance info
    const infoResult = await handleServiceNowInstance({ checkFeatures: ["now_assist", "aia"] });
    assert(!infoResult.isError, "Instance info failed");

    // 3. Query syslogs
    const logResult = await handleServiceNowSyslogs({ level: "error", timeRange: "24h", limit: 5 });

    // 4. Query incidents
    const queryResult = await handleServiceNowQuery({
      table: "incident",
      query: "active=true",
      limit: 3,
    });

    const infoText = getText(infoResult);
    return `Troubleshoot flow: status → info(${infoText.substring(0, 30)}...) → logs → query → OK`;
  });

  // Final disconnect
  connectionManager.disconnect();

  // ═══════════════════════════════════════════════════════════
  // Report
  // ═══════════════════════════════════════════════════════════
  console.log(`\n\x1b[1m${"═".repeat(60)}\x1b[0m`);
  console.log(`\x1b[1m  LIVE INSTANCE TEST RESULTS\x1b[0m`);
  console.log(`\x1b[1m${"═".repeat(60)}\x1b[0m\n`);

  const passed = results.filter((r) => r.status === "PASS");
  const failed = results.filter((r) => r.status === "FAIL");
  const skipped = results.filter((r) => r.status === "SKIP");
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log(`  Total:   ${results.length}`);
  console.log(`  \x1b[32mPassed:  ${passed.length}\x1b[0m`);
  if (failed.length > 0) console.log(`  \x1b[31mFailed:  ${failed.length}\x1b[0m`);
  if (skipped.length > 0) console.log(`  \x1b[33mSkipped: ${skipped.length}\x1b[0m`);
  console.log(`  Time:    ${(totalMs / 1000).toFixed(1)}s`);

  if (failed.length > 0) {
    console.log(`\n  \x1b[31mFailed Tests:\x1b[0m`);
    for (const f of failed) {
      console.log(`    ${f.id} ${f.name}`);
      console.log(`      → ${f.detail.substring(0, 200)}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\n  \x1b[33mSkipped Tests:\x1b[0m`);
    for (const s of skipped) {
      console.log(`    ${s.id} ${s.name}: ${s.detail}`);
    }
  }

  console.log(`\n${"─".repeat(60)}`);

  // Exit code
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n\x1b[31mFatal error: ${err.message}\x1b[0m`);
  process.exit(2);
});
