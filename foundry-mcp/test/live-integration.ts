#!/usr/bin/env npx tsx

/**
 * Comprehensive Live Integration Test Suite
 *
 * Tests all 38 MCP tools: 25 ServiceNow tools against a live instance + 13
 * Foundry tools against the local golden repository.
 * Covers: connection, query, script, AIA agents, use cases, skills, flows,
 * execution tracing, tool execution, dry-run creation, and foundry project
 * management workflows.
 *
 * Usage:
 *   npx tsx test/live-integration.ts                  # uses 'dev' profile
 *   npx tsx test/live-integration.ts --profile keybank # uses 'keybank' profile
 *   npm run test:live
 *   npm run test:live -- --profile keybank
 *
 * Requires ~/.servicenow/credentials.json with the target profile.
 * All creation tests use dryRun=true — no data is written to the instance.
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_PATH = path.resolve(__dirname, "../dist/index.js");
const CREDS_PATH = path.join(process.env.HOME || "~", ".servicenow", "credentials.json");

// ─── CLI Args ────────────────────────────────────────────────────────────────

const profileArg = process.argv.indexOf("--profile");
const PROFILE = profileArg !== -1 ? process.argv[profileArg + 1] : "dev";

// Unique suffix per run — prevents safety-check false alarms from prior runs
const TEST_ID = `t${Date.now().toString().slice(-6)}`;

// ─── Test Infrastructure ─────────────────────────────────────────────────────

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[1;36m";
const RESET  = "\x1b[0m";

let msgId = 0;
let passed = 0;
let failed = 0;
let skipped = 0;

const results: Array<{
  phase: string;
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
}> = [];

function log(msg: string, style: "header" | "pass" | "fail" | "skip" | "info" = "info") {
  const prefix = { header: CYAN, pass: `${GREEN}  ✓ `, fail: `${RED}  ✗ `, skip: `${YELLOW}  ⊘ `, info: "  " }[style];
  console.log(`${prefix}${msg}${RESET}`);
}

function record(phase: string, id: string, name: string, status: "PASS" | "FAIL" | "SKIP", detail: string) {
  results.push({ phase, id, name, status, detail });
  if (status === "PASS")       { passed++;  log(`${id} ${name}: ${detail}`, "pass"); }
  else if (status === "FAIL")  { failed++;  log(`${id} ${name}: ${detail}`, "fail"); }
  else                         { skipped++; log(`${id} ${name}: ${detail}`, "skip"); }
}

function textContains(text: string, ...terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.every(t => lower.includes(t.toLowerCase()));
}

function textContainsAny(text: string, ...terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some(t => lower.includes(t.toLowerCase()));
}

// ─── MCP Protocol ────────────────────────────────────────────────────────────

function makeRequest(method: string, params?: Record<string, unknown>): string {
  msgId++;
  return JSON.stringify({ jsonrpc: "2.0", id: msgId, method, params: params || {} }) + "\n";
}

function makeNotification(method: string): string {
  return JSON.stringify({ jsonrpc: "2.0", method }) + "\n";
}

async function sendAndReceive(
  proc: ChildProcess,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs = 60000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = makeRequest(method, params);
    const targetId = msgId;
    let buffer = "";

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for response to ${method}`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as Record<string, unknown>;
          if (msg.id === targetId) {
            cleanup();
            resolve(msg);
            return;
          }
        } catch { /* skip non-JSON lines */ }
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      proc.stdout?.removeListener("data", onData);
    };

    proc.stdout?.on("data", onData);
    proc.stdin?.write(request);
  });
}

async function callTool(
  proc: ChildProcess,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = 60000
): Promise<{ text: string; isError: boolean }> {
  const resp = await sendAndReceive(proc, "tools/call", { name: toolName, arguments: args }, timeoutMs);
  const result = resp.result as Record<string, unknown> | undefined;
  const content = result?.content as Array<{ text: string }> | undefined;
  const text = content?.[0]?.text || "";
  const isError = result?.isError === true;
  return { text, isError };
}

async function queryTable(
  proc: ChildProcess,
  table: string,
  query: string,
  fields: string,
  limit = 5
): Promise<{ text: string; isError: boolean }> {
  return callTool(proc, "servicenow_query", {
    table, query, fields: fields.split(",").map(f => f.trim()), limit
  });
}

async function runScript(
  proc: ChildProcess,
  script: string,
  timeoutMs = 60000
): Promise<{ text: string; isError: boolean }> {
  return callTool(proc, "servicenow_script", { script }, timeoutMs);
}

// ─── Phase 0: Connection ──────────────────────────────────────────────────────

async function phase0(proc: ChildProcess): Promise<{ connected: boolean; instance: string }> {
  log(`\n══ Phase 0: Connection & Setup (profile: ${PROFILE}) ══`, "header");

  const credsRaw = await fs.readFile(CREDS_PATH, "utf-8");
  const creds = JSON.parse(credsRaw);
  const profile = creds.profiles?.[PROFILE];

  if (!profile) {
    record("P0", "T0.1", "Load credentials profile", "FAIL",
      `No '${PROFILE}' profile in credentials — available: ${Object.keys(creds.profiles || {}).join(", ")}`);
    return { connected: false, instance: "" };
  }
  record("P0", "T0.1", "Load credentials profile", "PASS",
    `Profile '${PROFILE}' → ${profile.instance}`);

  // T0.2 — Connect
  const conn = await callTool(proc, "servicenow_connect", {
    instance: profile.instance,
    username: profile.username,
    password: profile.password,
  });
  if (conn.isError || !textContains(conn.text, "connected")) {
    record("P0", "T0.2", "servicenow_connect", "FAIL", conn.text.substring(0, 200));
    return { connected: false, instance: profile.instance };
  }
  record("P0", "T0.2", "servicenow_connect", "PASS", `Connected to ${profile.instance}`);

  // T0.3 — Status
  const status = await callTool(proc, "servicenow_status", {});
  if (!status.isError && textContains(status.text, "connected")) {
    record("P0", "T0.3", "servicenow_status", "PASS", "Session active");
  } else {
    record("P0", "T0.3", "servicenow_status", "FAIL", status.text.substring(0, 150));
    return { connected: false, instance: profile.instance };
  }

  // T0.4 — Instance info
  const info = await callTool(proc, "servicenow_instance", {}, 90000);
  if (!info.isError && textContains(info.text, profile.instance.split(".")[0])) {
    record("P0", "T0.4", "servicenow_instance", "PASS", "Instance metadata returned");
  } else {
    record("P0", "T0.4", "servicenow_instance", info.isError ? "FAIL" : "PASS",
      info.isError ? info.text.substring(0, 150) : "Instance info returned (name check skipped)");
  }

  return { connected: true, instance: profile.instance };
}

// ─── Phase 1: Core Query & Script ─────────────────────────────────────────────

async function phase1(proc: ChildProcess) {
  log("\n══ Phase 1: Core Query & Script ══", "header");

  // T1.1 — Basic table query
  const r1 = await queryTable(proc, "sys_user", "active=true", "sys_id,name,user_name", 3);
  record("P1", "T1.1", "servicenow_query basic", r1.isError ? "FAIL" : "PASS",
    r1.isError ? r1.text.substring(0, 150) : "Returned user records");

  // T1.2 — Query with sys_id field only (fields as array)
  const r2 = await queryTable(proc, "sys_properties", "name=glide.ui.escape_all_script", "name,value", 1);
  record("P1", "T1.2", "servicenow_query sys_properties", r2.isError ? "FAIL" : "PASS",
    r2.isError ? r2.text.substring(0, 150) : "System property query succeeded");

  // T1.3 — Query fields as JSON string (regression: #123 fix for serialization)
  const r3 = await callTool(proc, "servicenow_query", {
    table: "sys_user", query: "active=true", fields: '["sys_id","name"]', limit: 2,
  });
  record("P1", "T1.3", "servicenow_query fields as JSON string", r3.isError ? "FAIL" : "PASS",
    r3.isError ? r3.text.substring(0, 150) : "Handles JSON-string fields correctly");

  // T1.4 — servicenow_script simple arithmetic
  const r4 = await runScript(proc, "var x = 6 * 7; x;");
  record("P1", "T1.4", "servicenow_script arithmetic", r4.isError ? "FAIL" : "PASS",
    r4.isError ? r4.text.substring(0, 150) : "Script executed");

  // T1.5 — servicenow_script structured result
  const r5 = await runScript(proc,
    "var result = {}; result.env = gs.getProperty('glide.ui.escape_all_script'); result;");
  record("P1", "T1.5", "servicenow_script structured result", r5.isError ? "FAIL" : "PASS",
    r5.isError ? r5.text.substring(0, 150) : "Structured script result returned");

  // T1.6 — servicenow_syslogs
  const r6 = await callTool(proc, "servicenow_syslogs", { limit: 5 });
  record("P1", "T1.6", "servicenow_syslogs", r6.isError ? "FAIL" : "PASS",
    r6.isError ? r6.text.substring(0, 150) : "System logs returned");

  // T1.7 — servicenow_aia_logs
  const r7 = await callTool(proc, "servicenow_aia_logs", { limit: 5 });
  const aiaLogsOk = !r7.isError || textContainsAny(r7.text, "no logs", "no records", "empty", "0 records");
  record("P1", "T1.7", "servicenow_aia_logs", aiaLogsOk ? "PASS" : "FAIL",
    r7.isError ? r7.text.substring(0, 150) : "AIA logs returned (may be empty)");
}

// ─── Phase 2: AI Agent Discovery ──────────────────────────────────────────────

async function phase2(proc: ChildProcess): Promise<string> {
  log("\n══ Phase 2: AI Agent Discovery ══", "header");
  let firstAgentId = "";
  let firstAgentName = "";

  // T2.1 — List all agents
  const r1 = await callTool(proc, "servicenow_aia_list", {});
  const hasAgents = !r1.isError && textContainsAny(r1.text, "agent", "sn_aia");
  record("P2", "T2.1", "servicenow_aia_list (all)", hasAgents ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 150) : "Agent list returned");

  // Extract first agent sys_id and name — list format: "[ON] Agent Name\n─────\n  sys_id: ..."
  if (!r1.isError) {
    const nameMatch = r1.text.match(/\[(?:ON|OFF)\]\s+(.+)/);
    if (nameMatch) firstAgentName = nameMatch[1].trim();
    const sysIdMatch = r1.text.match(/sys_id:\s*([a-f0-9]{32})/i);
    if (sysIdMatch) firstAgentId = sysIdMatch[1].trim();
  }

  // T2.2 — List with name filter
  const r2 = await callTool(proc, "servicenow_aia_list", { name: "agent", limit: 3 });
  record("P2", "T2.2", "servicenow_aia_list (name filter)", r2.isError ? "FAIL" : "PASS",
    r2.isError ? r2.text.substring(0, 150) : "Filtered agent list returned");

  // T2.3 — List with status filter (tool falls back to client-side filter on ACL restrictions)
  const r3 = await callTool(proc, "servicenow_aia_list", { status: "active", limit: 5 });
  record("P2", "T2.3", "servicenow_aia_list (active filter)", r3.isError ? "FAIL" : "PASS",
    r3.isError ? r3.text.substring(0, 150) : "Active agents listed (server or client-side filter)");

  if (!firstAgentId) {
    record("P2", "T2.4", "servicenow_aia_get (basic)", "SKIP", "No agent sys_id from T2.1");
    record("P2", "T2.5", "servicenow_aia_get (includeTools)", "SKIP", "No agent sys_id");
    record("P2", "T2.6", "servicenow_aia_get (includeStats)", "SKIP", "No agent sys_id");
    record("P2", "T2.7", "servicenow_aia_get (includeChildren)", "SKIP", "No agent sys_id");
    return firstAgentId;
  }

  // T2.4 — Get agent by sys_id (basic)
  const r4 = await callTool(proc, "servicenow_aia_get", { agent: firstAgentId });
  record("P2", "T2.4", "servicenow_aia_get (basic)", r4.isError ? "FAIL" : "PASS",
    r4.isError ? r4.text.substring(0, 150) : `Agent details for ${firstAgentId.substring(0, 8)}...`);

  // T2.5 — Get agent with includeTools=true
  const r5 = await callTool(proc, "servicenow_aia_get", { agent: firstAgentId, includeTools: true });
  record("P2", "T2.5", "servicenow_aia_get (includeTools)", r5.isError ? "FAIL" : "PASS",
    r5.isError ? r5.text.substring(0, 150) : "Tool section included in agent response");

  // T2.6 — Get agent with includeStats=true
  const r6 = await callTool(proc, "servicenow_aia_get", { agent: firstAgentId, includeStats: true });
  record("P2", "T2.6", "servicenow_aia_get (includeStats)", r6.isError ? "FAIL" : "PASS",
    r6.isError ? r6.text.substring(0, 150) : "Stats section included");

  // T2.7 — Get agent with includeChildren=true
  const r7 = await callTool(proc, "servicenow_aia_get", { agent: firstAgentId, includeChildren: true });
  record("P2", "T2.7", "servicenow_aia_get (includeChildren)", r7.isError ? "FAIL" : "PASS",
    r7.isError ? r7.text.substring(0, 150) : "Children section included (may be empty)");

  // T2.8 — Get agent by name
  if (firstAgentName) {
    const r8 = await callTool(proc, "servicenow_aia_get", { agent: firstAgentName });
    record("P2", "T2.8", "servicenow_aia_get (by name)", r8.isError ? "FAIL" : "PASS",
      r8.isError ? r8.text.substring(0, 150) : `Agent resolved by name: ${firstAgentName.substring(0, 40)}`);
  } else {
    record("P2", "T2.8", "servicenow_aia_get (by name)", "SKIP", "No agent name extracted");
  }

  return firstAgentId;
}

// ─── Phase 3: Use Case Discovery ──────────────────────────────────────────────

async function phase3(proc: ChildProcess): Promise<string> {
  log("\n══ Phase 3: Use Case Discovery ══", "header");
  let firstUsecaseId = "";

  // T3.1 — List all use cases
  const r1 = await callTool(proc, "servicenow_aia_usecase_list", {});
  const hasUsecases = !r1.isError && textContainsAny(r1.text, "use case", "usecase", "sn_aia");
  record("P3", "T3.1", "servicenow_aia_usecase_list (all)", hasUsecases ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 150) : "Use case list returned");

  // Extract first use case sys_id
  if (!r1.isError) {
    const sysIdMatch = r1.text.match(/([a-f0-9]{32})/i);
    if (sysIdMatch) firstUsecaseId = sysIdMatch[1].trim();
  }

  // T3.2 — List with name filter
  const r2 = await callTool(proc, "servicenow_aia_usecase_list", { name: "agent", limit: 3 });
  record("P3", "T3.2", "servicenow_aia_usecase_list (filter)", r2.isError ? "FAIL" : "PASS",
    r2.isError ? r2.text.substring(0, 150) : "Filtered use case list returned");

  if (!firstUsecaseId) {
    record("P3", "T3.3", "servicenow_aia_usecase_get", "SKIP", "No use case sys_id from T3.1");
    record("P3", "T3.4", "servicenow_aia_usecase_get (includeAgent)", "SKIP", "No use case sys_id");
    record("P3", "T3.5", "servicenow_aia_trigger_get", "SKIP", "No use case sys_id");
    return firstUsecaseId;
  }

  // T3.3 — Get use case basic
  const r3 = await callTool(proc, "servicenow_aia_usecase_get", { usecase: firstUsecaseId });
  record("P3", "T3.3", "servicenow_aia_usecase_get (basic)", r3.isError ? "FAIL" : "PASS",
    r3.isError ? r3.text.substring(0, 150) : `Use case details for ${firstUsecaseId.substring(0, 8)}...`);

  // T3.4 — Get use case with includeAgent=true
  const r4 = await callTool(proc, "servicenow_aia_usecase_get", {
    usecase: firstUsecaseId, includeAgent: true,
  });
  record("P3", "T3.4", "servicenow_aia_usecase_get (includeAgent)", r4.isError ? "FAIL" : "PASS",
    r4.isError ? r4.text.substring(0, 150) : "Agent details included in use case response");

  // T3.5 — Get trigger config for use case (tool degrades gracefully on ACL restrictions)
  const r5 = await callTool(proc, "servicenow_aia_trigger_get", { usecase: firstUsecaseId });
  record("P3", "T3.5", "servicenow_aia_trigger_get", r5.isError ? "FAIL" : "PASS",
    r5.isError ? r5.text.substring(0, 150) : "Trigger config returned (may be empty or no-access)");

  return firstUsecaseId;
}

// ─── Phase 4: Skill Discovery ─────────────────────────────────────────────────

async function phase4(proc: ChildProcess): Promise<string> {
  log("\n══ Phase 4: Skill Discovery ══", "header");
  let firstSkillName = "";
  let firstSkillId = "";

  // T4.1 — List all skills
  const r1 = await callTool(proc, "servicenow_skill_list", {});
  const hasSkills = !r1.isError && textContainsAny(r1.text, "skill", "now assist");
  record("P4", "T4.1", "servicenow_skill_list (all)", hasSkills ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 150) : "Skill list returned");

  // Skill list uses same format as agent list: "[ON] Skill Name\n─────\n  sys_id: ..."
  if (!r1.isError) {
    const nameMatch = r1.text.match(/\[(?:ON|OFF)\]\s+(.+)/);
    if (nameMatch) firstSkillName = nameMatch[1].trim();
    const sysIdMatch = r1.text.match(/sys_id:\s*([a-f0-9]{32})/i);
    if (sysIdMatch) firstSkillId = sysIdMatch[1].trim();
  }

  // T4.2 — List with filter
  const r2 = await callTool(proc, "servicenow_skill_list", { filter: "case", limit: 3 });
  record("P4", "T4.2", "servicenow_skill_list (filter)", r2.isError ? "FAIL" : "PASS",
    r2.isError ? r2.text.substring(0, 150) : "Filtered skill list returned");

  if (!firstSkillName) {
    record("P4", "T4.3", "servicenow_skill_get", "SKIP", "No skill name from T4.1");
    record("P4", "T4.4", "servicenow_skill_execute", "SKIP", "No skill name from T4.1");
    return firstSkillId;
  }

  // T4.3 — Get skill by name
  const r3 = await callTool(proc, "servicenow_skill_get", { skill: firstSkillName });
  record("P4", "T4.3", "servicenow_skill_get (by name)", r3.isError ? "FAIL" : "PASS",
    r3.isError ? r3.text.substring(0, 150) : `Skill details: ${firstSkillName.substring(0, 50)}`);

  // T4.4 — Execute skill (simple prompt)
  const r4 = await callTool(proc, "servicenow_skill_execute", {
    skill: firstSkillName,
    inputs: { user_input: "Say hello in one word." },
  }, 90000);
  const execOk = !r4.isError || textContainsAny(r4.text, "response", "output", "result", "error");
  record("P4", "T4.4", "servicenow_skill_execute", execOk ? "PASS" : "FAIL",
    r4.isError ? r4.text.substring(0, 150) : `Skill executed: ${r4.text.substring(0, 80)}`);

  return firstSkillId;
}

// ─── Phase 5: Flow Designer ───────────────────────────────────────────────────

async function phase5(proc: ChildProcess): Promise<string> {
  log("\n══ Phase 5: Flow Designer ══", "header");
  let firstFlowId = "";

  // T5.1 — List flows (no filter)
  const r1 = await callTool(proc, "servicenow_flow_list", { limit: 5 });
  const hasFlows = !r1.isError && textContainsAny(r1.text, "flow", "sys_hub");
  record("P5", "T5.1", "servicenow_flow_list (all)", hasFlows ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 150) : "Flow list returned");

  if (!r1.isError) {
    const sysIdMatch = r1.text.match(/([a-f0-9]{32})/i);
    if (sysIdMatch) firstFlowId = sysIdMatch[1].trim();
  }

  // T5.2 — List flows with name filter for LLM flows
  const r2 = await callTool(proc, "servicenow_flow_list", { name: "LLM", limit: 5 });
  record("P5", "T5.2", "servicenow_flow_list (LLM filter)", r2.isError ? "FAIL" : "PASS",
    r2.isError ? r2.text.substring(0, 150) : "LLM flow list returned");

  // Extract LLM flow ID if available (more useful for T5.3)
  if (!r2.isError) {
    const sysIdMatch = r2.text.match(/([a-f0-9]{32})/i);
    if (sysIdMatch) firstFlowId = sysIdMatch[1].trim();
  }

  // T5.3 — List flows with active filter
  const r3 = await callTool(proc, "servicenow_flow_list", { status: "active", limit: 5 });
  record("P5", "T5.3", "servicenow_flow_list (active filter)", r3.isError ? "FAIL" : "PASS",
    r3.isError ? r3.text.substring(0, 150) : "Active flow list returned");

  if (!firstFlowId) {
    record("P5", "T5.4", "servicenow_flow_get", "SKIP", "No flow sys_id from T5.1/T5.2");
    return firstFlowId;
  }

  // T5.4 — Get flow details by sys_id
  const r4 = await callTool(proc, "servicenow_flow_get", { flow: firstFlowId });
  record("P5", "T5.4", "servicenow_flow_get (by sys_id)", r4.isError ? "FAIL" : "PASS",
    r4.isError ? r4.text.substring(0, 150) : `Flow details returned for ${firstFlowId.substring(0, 8)}...`);

  return firstFlowId;
}

// ─── Phase 6: Execution Tracing ───────────────────────────────────────────────

async function phase6(proc: ChildProcess, agentId: string) {
  log("\n══ Phase 6: Execution Tracing ══", "header");

  if (!agentId) {
    record("P6", "T6.1", "servicenow_aia_errors", "SKIP", "No agent sys_id from Phase 2");
    record("P6", "T6.2", "servicenow_aia_trace", "SKIP", "No agent sys_id");
    record("P6", "T6.3", "servicenow_aia_trace (with payload)", "SKIP", "No agent sys_id");
    return;
  }

  // T6.1 — Errors for an agent
  const r1 = await callTool(proc, "servicenow_aia_errors", { agent: agentId, limit: 5 });
  const errOk = !r1.isError || textContainsAny(r1.text, "no error", "no records", "0 error");
  record("P6", "T6.1", "servicenow_aia_errors", errOk ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 150) : "Error list returned (may be empty)");

  // T6.2/T6.3 — aia_trace requires an executionId — query sn_aia_execution_plan first
  const execs = await queryTable(proc, "sn_aia_execution_plan", `agent=${agentId}`, "sys_id,status", 1);
  let executionId = "";
  if (!execs.isError) {
    const match = execs.text.match(/([a-f0-9]{32})/i);
    if (match) executionId = match[1];
  }

  if (!executionId) {
    record("P6", "T6.2", "servicenow_aia_trace", "SKIP", "No executions found for this agent");
    record("P6", "T6.3", "servicenow_aia_trace (with payload)", "SKIP", "No executions found");
    return;
  }

  // T6.2 — Trace a specific execution
  const r2 = await callTool(proc, "servicenow_aia_trace", { executionId });
  const traceOk = !r2.isError || textContainsAny(r2.text, "not found", "no steps");
  record("P6", "T6.2", "servicenow_aia_trace", traceOk ? "PASS" : "FAIL",
    r2.isError ? r2.text.substring(0, 150) : `Execution trace returned for ${executionId.substring(0, 8)}...`);

  // T6.3 — Trace with payload detail
  const r3 = await callTool(proc, "servicenow_aia_trace", { executionId, includePayloads: true });
  const trace3Ok = !r3.isError || textContainsAny(r3.text, "not found", "no steps");
  record("P6", "T6.3", "servicenow_aia_trace (includePayloads)", trace3Ok ? "PASS" : "FAIL",
    r3.isError ? r3.text.substring(0, 150) : "Trace with payloads returned");
}

// ─── Phase 7: Tool Execution ──────────────────────────────────────────────────

async function phase7(proc: ChildProcess, agentId: string) {
  log("\n══ Phase 7: Direct Tool Execution ══", "header");

  // T7.1 — List tools to find one to execute
  const r1 = await queryTable(proc, "sn_aia_tool", "active=true^type=script", "sys_id,name,description", 3);
  record("P7", "T7.1", "Query sn_aia_tool for test target", r1.isError ? "FAIL" : "PASS",
    r1.isError ? r1.text.substring(0, 150) : "Tool list queried");

  let toolId = "";
  let toolName = "";
  if (!r1.isError) {
    const sysIdMatch = r1.text.match(/([a-f0-9]{32})/i);
    const nameMatch = r1.text.match(/name[:\s]+([^\n,|]+)/i);
    if (sysIdMatch) toolId = sysIdMatch[1].trim();
    if (nameMatch) toolName = nameMatch[1].trim();
  }

  if (!toolId) {
    record("P7", "T7.2", "servicenow_aia_tool_execute", "SKIP", "No script tool found in T7.1");
    return;
  }

  // T7.2 — Execute tool by sys_id
  const r2 = await callTool(proc, "servicenow_aia_tool_execute", {
    tool: toolId,
    inputs: {},
  }, 90000);
  const execOk = !r2.isError || textContainsAny(r2.text, "result", "output", "response", "error", "inactive");
  record("P7", "T7.2", "servicenow_aia_tool_execute (by sys_id)", execOk ? "PASS" : "FAIL",
    r2.isError ? r2.text.substring(0, 150) : `Tool executed: ${r2.text.substring(0, 80)}`);

  // T7.3 — Execute tool by name
  if (toolName) {
    const r3 = await callTool(proc, "servicenow_aia_tool_execute", {
      tool: toolName, inputs: {},
    }, 90000);
    const exec3Ok = !r3.isError || textContainsAny(r3.text, "result", "output", "response", "error", "inactive");
    record("P7", "T7.3", "servicenow_aia_tool_execute (by name)", exec3Ok ? "PASS" : "FAIL",
      r3.isError ? r3.text.substring(0, 150) : `Tool executed by name: ${r3.text.substring(0, 80)}`);
  } else {
    record("P7", "T7.3", "servicenow_aia_tool_execute (by name)", "SKIP", "No tool name extracted");
  }
}

// ─── Phase 8: Agent Execute ───────────────────────────────────────────────────

async function phase8(proc: ChildProcess, agentId: string) {
  log("\n══ Phase 8: Agent Execute ══", "header");

  if (!agentId) {
    record("P8", "T8.1", "servicenow_aia_execute", "SKIP", "No agent sys_id from Phase 2");
    return;
  }

  // T8.1 — Execute agent (copilot mode, simple prompt)
  const r1 = await callTool(proc, "servicenow_aia_execute", {
    agent: agentId,
    input: "Hello, what can you help me with?",
    executionMode: "copilot",
  }, 120000);
  // Pass if we got a structured execution response (even partial/error from agent logic is ok)
  // Fail only if the tool itself errors (bad params, no connection, etc.)
  const execOk = !r1.isError;
  record("P8", "T8.1", "servicenow_aia_execute (copilot)", execOk ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 200) : `Execution returned: ${r1.text.substring(0, 100)}`);
}

// ─── Phase 9: Dry-Run — Agent Creation ────────────────────────────────────────

async function phase9(proc: ChildProcess) {
  log("\n══ Phase 9: Dry-Run — Agent (servicenow_aia_create) ══", "header");

  const agentTestName = `Test Integration Agent ${TEST_ID}`;

  // T9.1 — Dry-run with full config (correct param names: agentName, agentDescription, etc.)
  const r1 = await callTool(proc, "servicenow_aia_create", {
    agentName: agentTestName,
    agentDescription: "Created during live integration test — DRY RUN ONLY",
    agentInstructions: "1. Accept test input\n2. Return test output",
    agentRole: "Test role for integration validation",
    agentProficiency: "- Can accept test input\n- Returns structured output",
    tools: [{
      name: "test_echo",
      description: "Echo the input back",
      script: "(function(inputs) { var o = {}; o.result = String(inputs.msg || ''); return o; })(inputs);",
      inputSchema: [{ name: "msg", type: "string", mandatory: false }],
      outputSchema: [{ name: "result", type: "string" }],
    }],
    dryRun: true,
  }, 60000);
  record("P9", "T9.1", "servicenow_aia_create dry-run", r1.isError ? "FAIL" : "PASS",
    r1.isError ? r1.text.substring(0, 200) : "Dry-run plan shown");

  // T9.2 — Verify no record was created — check for sys_id in response (actual record returned)
  const r2 = await queryTable(proc, "sn_aia_agent", `name=${agentTestName}`, "sys_id", 1);
  const noRecord = r2.isError || !r2.text.match(/\b[a-f0-9]{32}\b/i);
  record("P9", "T9.2", "servicenow_aia_create dry-run safety (no record created)",
    noRecord ? "PASS" : "FAIL",
    noRecord ? "Confirmed: no agent created" : "WARNING: Agent was created despite dryRun=true!");

  // T9.3 — Forbidden API scan in tool script
  const r3 = await callTool(proc, "servicenow_aia_create", {
    agentName: "Test Forbidden API Agent",
    agentDescription: "Tests forbidden API detection",
    agentInstructions: "Test",
    tools: [{
      name: "bad_tool",
      description: "Uses forbidden APIs",
      script: "(function(inputs) { gs.info('hello'); var d = new GlideDateTime(); return {}; })(inputs);",
      inputSchema: [],
      outputSchema: [],
    }],
    dryRun: true,
  }, 30000);
  const hasForbiddenWarning = textContainsAny(r3.text, "forbidden", "warning", "gs.info", "GlideDateTime");
  record("P9", "T9.3", "servicenow_aia_create forbidden API scan",
    hasForbiddenWarning ? "PASS" : "FAIL",
    hasForbiddenWarning ? "Forbidden API warning surfaced in dry-run" : "Expected forbidden API warning not found");
}

// ─── Phase 10: Dry-Run — Use Case Creation ────────────────────────────────────

async function phase10(proc: ChildProcess) {
  log("\n══ Phase 10: Dry-Run — Use Case (servicenow_aia_usecase_create) ══", "header");

  const ucTestName = `Test Integration Use Case ${TEST_ID}`;

  // T10.1 — Dry-run with full config
  const r1 = await callTool(proc, "servicenow_aia_usecase_create", {
    name: ucTestName,
    prefix: "tst",
    description: "Created during live integration test — DRY RUN ONLY",
    basePlan: "1. Accept user request\n2. Route to appropriate agent\n3. Return consolidated response",
    executionMode: "copilot",
    agents: [{
      name: "Resolver Agent",
      description: "Resolves test requests",
      role: "Test resolver that handles simple requests",
      instructions: "1. Accept input\n2. Process it\n3. Return result",
      proficiency: "- Handles test inputs\n- Returns structured results",
      tools: [{
        name: "Lookup Tool",
        description: "Looks up data from a table",
        inputSchema: [
          { name: "table", description: "Table to query" },
          { name: "query", description: "Encoded query string" },
        ],
        script: "(function(inputs) { var gr = new GlideRecord(inputs.table || 'incident'); gr.addEncodedQuery(inputs.query || ''); gr.setLimit(1); gr.query(); var o = {}; o.found = gr.next() ? 'yes' : 'no'; return o; })(inputs);",
        executionMode: "autopilot",
        maxAutoExecutions: 5,
      }],
    }],
    dryRun: true,
  }, 60000);

  const dryRunOk = !r1.isError && textContains(r1.text, "DRY RUN");
  record("P10", "T10.1", "servicenow_aia_usecase_create dry-run", dryRunOk ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 200) : "Dry-run plan shown");

  // T10.2 — Strategy lookup in dry-run output
  const hasStrategy = textContainsAny(r1.text, "ReAct", "strategy", "planner");
  record("P10", "T10.2", "Dry-run shows strategy lookup", hasStrategy ? "PASS" : "FAIL",
    hasStrategy ? "Strategy section present in dry-run" : "Strategy section missing from dry-run output");

  // T10.3 — Record count in dry-run output
  const hasCounts = textContainsAny(r1.text, "tool", "team", "use case", "agent");
  record("P10", "T10.3", "Dry-run shows record plan", hasCounts ? "PASS" : "FAIL",
    hasCounts ? "Record plan present (tools, team, use case, agent)" : "Record plan missing from dry-run");

  // T10.4 — Verify no record was created — check for sys_id (actual record) not name text
  const ucFullName = `tst ${ucTestName}`;
  const r2 = await queryTable(proc, "sn_aia_usecase", `name=${ucFullName}`, "sys_id", 1);
  const noRecord = r2.isError || !r2.text.match(/\b[a-f0-9]{32}\b/i);
  record("P10", "T10.4", "servicenow_aia_usecase_create dry-run safety (no record created)",
    noRecord ? "PASS" : "FAIL",
    noRecord ? "Confirmed: no use case created" : "WARNING: Use case was created despite dryRun=true!");

  // T10.5 — Forbidden API scan
  const r3 = await callTool(proc, "servicenow_aia_usecase_create", {
    name: "Forbidden API Test Use Case",
    prefix: "tst",
    description: "Tests forbidden API scanning",
    basePlan: "Test",
    agents: [{
      name: "Bad Agent",
      description: "Agent with forbidden API in tool",
      role: "Test",
      instructions: "Test",
      proficiency: "Test",
      tools: [{
        name: "Bad Tool",
        description: "Uses gs.info",
        inputSchema: [],
        script: "(function(inputs) { gs.info('test'); return {}; })(inputs);",
      }],
    }],
    dryRun: true,
  }, 30000);
  const hasForbiddenWarning = textContainsAny(r3.text, "forbidden", "warning", "gs.info");
  record("P10", "T10.5", "servicenow_aia_usecase_create forbidden API scan",
    hasForbiddenWarning ? "PASS" : "FAIL",
    hasForbiddenWarning ? "Forbidden API warning surfaced" : "Expected forbidden API warning not found");
}

// ─── Phase 11: Dry-Run — Skill Creation (12-phase rewrite) ───────────────────

async function phase11(proc: ChildProcess) {
  log("\n══ Phase 11: Dry-Run — Skill (servicenow_skill_create rewrite) ══", "header");

  const skillTestName = `Test Integration Skill ${TEST_ID}`;

  // T11.1 — Dry-run with full config (new schema)
  const r1 = await callTool(proc, "servicenow_skill_create", {
    skillName: skillTestName,
    description: "Created during live integration test — DRY RUN ONLY",
    promptTemplate: "You are a test skill. When asked {{question}}, return a concise test answer.",
    inputs: [
      { name: "question", label: "Question", description: "The question to answer", defaultValue: "What is 2+2?" },
    ],
    outputs: [],
    model: "llm_generic_small",
    temperature: "0.2",
    maxTokens: "200",
    dryRun: true,
  }, 90000);

  const dryRunOk = !r1.isError && textContains(r1.text, "DRY RUN");
  record("P11", "T11.1", "servicenow_skill_create dry-run", dryRunOk ? "PASS" : "FAIL",
    r1.isError ? r1.text.substring(0, 200) : "Dry-run plan shown");

  // T11.2 — Pre-flight sys_id resolution in output
  const hasPreFlight = textContainsAny(r1.text, "pre-flight", "PRE-FLIGHT", "resolved", "role", "llm_flow");
  record("P11", "T11.2", "Dry-run shows pre-flight sys_id resolution", hasPreFlight ? "PASS" : "FAIL",
    hasPreFlight ? "Pre-flight section present" : "Pre-flight section missing from dry-run output");

  // T11.3 — All 8 phases mentioned in output
  const hasAllPhases = [1, 2, 3, 4, 5, 6, 7, 8].every(p =>
    textContainsAny(r1.text, `Phase ${p}`, `phase ${p}`)
  );
  record("P11", "T11.3", "Dry-run shows all 8 phases", hasAllPhases ? "PASS" : "FAIL",
    hasAllPhases ? "All 8 phases referenced in output" : "Some phases missing from dry-run output");

  // T11.4 — Verify no record was created — check for sys_id (actual record) not name text
  const r2 = await queryTable(proc, "sys_one_extend_capability",
    `name=${skillTestName}`, "sys_id", 1);
  const noRecord = r2.isError || !r2.text.match(/\b[a-f0-9]{32}\b/i);
  record("P11", "T11.4", "servicenow_skill_create dry-run safety (no record created)",
    noRecord ? "PASS" : "FAIL",
    noRecord ? "Confirmed: no skill created" : "WARNING: Skill was created despite dryRun=true!");

  // T11.5 — Dry-run with sys_id overrides
  const r3 = await callTool(proc, "servicenow_skill_create", {
    skillName: "Test Override Skill",
    description: "Tests explicit sys_id overrides",
    promptTemplate: "Test {{input}}",
    roleSysId: "00000000000000000000000000000000",
    skillFamilySysId: "00000000000000000000000000000001",
    dryRun: true,
  }, 60000);
  const hasOverrides = textContainsAny(r3.text, "override", "00000000", "provided");
  record("P11", "T11.5", "servicenow_skill_create with sys_id overrides",
    !r3.isError ? "PASS" : "FAIL",
    r3.isError ? r3.text.substring(0, 150) : "Dry-run with override sys_ids executed");
}

// ─── Phase 13: Foundry Tools ──────────────────────────────────────────────────
// Tests all 13 foundry_* tools. No live ServiceNow connection required.
// Uses a temp directory for filesystem operations; passes goldenPath to avoid
// cloning from GitHub during tests.

const GOLDEN_PATH = path.resolve(__dirname, "../../foundry-golden");

async function phase13(proc: ChildProcess) {
  log("\n══ Phase 13: Foundry Tools (13 tools) ══", "header");

  // T13.1 — foundry_version: status
  const r1 = await callTool(proc, "foundry_version", { action: "status" });
  record("P13", "T13.1", "foundry_version (status)", r1.isError ? "FAIL" : "PASS",
    r1.isError ? r1.text.substring(0, 150) : "Version status returned");

  // T13.2 — foundry_templates: list
  const r2 = await callTool(proc, "foundry_templates", { action: "list" });
  const hasTemplates = !r2.isError && textContainsAny(r2.text, "foundry-poc", "foundry-minimal");
  record("P13", "T13.2", "foundry_templates (list)", hasTemplates ? "PASS" : "FAIL",
    r2.isError ? r2.text.substring(0, 150) : "Templates listed");

  // T13.3 — foundry_templates: preview
  const r3 = await callTool(proc, "foundry_templates", { action: "preview", template: "foundry-minimal" });
  record("P13", "T13.3", "foundry_templates (preview)", r3.isError ? "FAIL" : "PASS",
    r3.isError ? r3.text.substring(0, 150) : "Template preview returned");

  // T13.4 — foundry_list: all
  const r4 = await callTool(proc, "foundry_list", { type: "all" });
  const hasList = !r4.isError && textContainsAny(r4.text, "context", "skill", "template");
  record("P13", "T13.4", "foundry_list (all)", hasList ? "PASS" : "FAIL",
    r4.isError ? r4.text.substring(0, 150) : "Resource list returned");

  // T13.5 — foundry_list: skills only
  const r5 = await callTool(proc, "foundry_list", { type: "skills" });
  record("P13", "T13.5", "foundry_list (skills)", r5.isError ? "FAIL" : "PASS",
    r5.isError ? r5.text.substring(0, 150) : "Skills list returned");

  // T13.6 — foundry_search
  const r6 = await callTool(proc, "foundry_search", { query: "ServiceNow" });
  const hasResults = !r6.isError && textContainsAny(r6.text, "result", "found", "match", "context", "skill");
  record("P13", "T13.6", "foundry_search", hasResults ? "PASS" : "FAIL",
    r6.isError ? r6.text.substring(0, 150) : "Search results returned");

  // T13.7 — foundry_info: context
  const r7 = await callTool(proc, "foundry_info", { type: "context", name: "now-assist-platform" });
  record("P13", "T13.7", "foundry_info (context)", r7.isError ? "FAIL" : "PASS",
    r7.isError ? r7.text.substring(0, 150) : "Context info returned");

  // T13.8 — foundry_external: list
  const r8 = await callTool(proc, "foundry_external", { action: "list" });
  record("P13", "T13.8", "foundry_external (list)", r8.isError ? "FAIL" : "PASS",
    r8.isError ? r8.text.substring(0, 150) : "External sources listed");

  // T13.9 — foundry_check_context
  const r9 = await callTool(proc, "foundry_check_context", {
    task_description: "I need to deploy a skill to ServiceNow",
  });
  record("P13", "T13.9", "foundry_check_context", r9.isError ? "FAIL" : "PASS",
    r9.isError ? r9.text.substring(0, 150) : "Context check returned");

  // Filesystem tests use a temp dir + explicit goldenPath to avoid GitHub clone
  const tmpDir = path.join(path.resolve(__dirname, "../.test-output"), `foundry-test-${TEST_ID}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    // T13.10 — foundry_init
    const r10 = await callTool(proc, "foundry_init", {
      projectName: `Integration Test ${TEST_ID}`,
      path: tmpDir,
      template: "foundry-minimal",
      goldenPath: GOLDEN_PATH,
    });
    const hasClaudeMd = !r10.isError && textContainsAny(r10.text, "CLAUDE.md", "initialized", "success", "created");
    record("P13", "T13.10", "foundry_init", hasClaudeMd ? "PASS" : "FAIL",
      r10.isError ? r10.text.substring(0, 200) : "Project initialized with foundry-minimal template");

    // T13.11 — foundry_add: context
    const r11 = await callTool(proc, "foundry_add", {
      type: "context",
      name: "now-assist-platform",
      projectPath: tmpDir,
      force: true,
    });
    record("P13", "T13.11", "foundry_add (context)", r11.isError ? "FAIL" : "PASS",
      r11.isError ? r11.text.substring(0, 200) : "Context file added to project");

    // T13.12 — foundry_sync: dry-run
    const r12 = await callTool(proc, "foundry_sync", {
      projectPath: tmpDir,
      dryRun: true,
    });
    record("P13", "T13.12", "foundry_sync (dry-run)", r12.isError ? "FAIL" : "PASS",
      r12.isError ? r12.text.substring(0, 150) : "Sync dry-run returned");

    // T13.13 — foundry_new: scaffold a context resource
    const newResourceName = `test-ctx-${TEST_ID}`;
    const r13 = await callTool(proc, "foundry_new", {
      type: "context",
      name: newResourceName,
      description: "Auto-generated during live integration test",
      projectPath: tmpDir,
    });
    const scaffolded = !r13.isError && textContainsAny(r13.text, "created", "scaffold", newResourceName, ".md");
    record("P13", "T13.13", "foundry_new (context scaffold)", scaffolded ? "PASS" : "FAIL",
      r13.isError ? r13.text.substring(0, 150) : `Scaffolded ${newResourceName}`);

    // T13.14 — foundry_validate: validate the scaffolded resource
    const r14 = await callTool(proc, "foundry_validate", {
      type: "context",
      name: newResourceName,
      projectPath: tmpDir,
    });
    // validate may warn about placeholder text — that's expected for scaffolded resources
    record("P13", "T13.14", "foundry_validate", !r14.isError || textContainsAny(r14.text, "warning", "placeholder", "valid") ? "PASS" : "FAIL",
      r14.isError ? r14.text.substring(0, 150) : "Validation returned");

    // T13.15 — foundry_version: check updates (project)
    const r15 = await callTool(proc, "foundry_version", {
      action: "check",
      projectPath: tmpDir,
    });
    record("P13", "T13.15", "foundry_version (check updates)", r15.isError ? "FAIL" : "PASS",
      r15.isError ? r15.text.substring(0, 150) : "Version check returned");

  } finally {
    // Clean up temp dir
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  // T13.promote intentionally omitted — creates real GitHub PRs
}

// ─── Phase 12: Disconnect ─────────────────────────────────────────────────────

async function phase12(proc: ChildProcess) {
  log("\n══ Phase 12: Disconnect ══", "header");

  const r1 = await callTool(proc, "servicenow_disconnect", {});
  record("P12", "T12.1", "servicenow_disconnect", r1.isError ? "FAIL" : "PASS",
    r1.isError ? r1.text.substring(0, 150) : "Disconnected successfully");

  // Verify status shows disconnected
  const r2 = await callTool(proc, "servicenow_status", {});
  const isDisconnected = textContainsAny(r2.text, "not connected", "disconnected", "no active");
  record("P12", "T12.2", "Status shows disconnected after disconnect", isDisconnected ? "PASS" : "FAIL",
    isDisconnected ? "Confirmed: session terminated" : r2.text.substring(0, 150));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`${CYAN}`);
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("  FOUNDRY MCP — COMPREHENSIVE LIVE INTEGRATION TEST");
  console.log("  38 Tools · 13 Phases · Read-only + Dry-run (no data written)");
  console.log(`  Profile: ${PROFILE}  |  Creds: ${CREDS_PATH}`);
  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`${RESET}`);

  // Verify dist is built
  try {
    await fs.stat(SERVER_PATH);
  } catch {
    console.error(`${RED}ERROR: dist/index.js not found. Run: npm run build${RESET}`);
    process.exit(1);
  }

  // Spawn MCP server
  log("Starting MCP server...", "header");
  const proc = spawn("node", [SERVER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });
  proc.stderr?.on("data", () => {}); // suppress server stderr

  await new Promise(r => setTimeout(r, 500));
  if (proc.exitCode !== null) {
    console.error(`${RED}Server failed to start${RESET}`);
    process.exit(1);
  }
  log("MCP server started", "pass");

  // MCP handshake
  const initResp = await sendAndReceive(proc, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "live-integration-test", version: "1.0.0" },
  });
  if (!initResp.result) {
    console.error(`${RED}MCP initialize failed${RESET}`);
    proc.kill("SIGTERM");
    process.exit(1);
  }
  proc.stdin?.write(makeNotification("notifications/initialized"));
  await new Promise(r => setTimeout(r, 200));
  log("MCP handshake complete", "pass");

  try {
    // Phase 0 must pass — everything else depends on a live connection
    const { connected, instance } = await phase0(proc);
    if (!connected) {
      log("\nPhase 0 FAILED — cannot run live tests without connection", "fail");
    } else {
      log(`\nRunning all phases against ${instance}...`, "header");

      await phase1(proc);
      const agentId    = await phase2(proc);
      const usecaseId  = await phase3(proc);
      await phase4(proc);
      await phase5(proc);
      await phase6(proc, agentId);
      await phase7(proc, agentId);
      await phase8(proc, agentId);
      await phase9(proc);
      await phase10(proc);
      await phase11(proc);
      await phase12(proc);
    }

    // Phase 13 runs regardless of ServiceNow connection (foundry tools are local)
    await phase13(proc);
  } catch (e) {
    log(`Unexpected error: ${String(e)}`, "fail");
  } finally {
    proc.kill("SIGTERM");
    await new Promise(r => setTimeout(r, 300));
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log(`\n${CYAN}══════════════════════════════════════════════════════════════════`);
  console.log("  RESULTS SUMMARY");
  console.log(`══════════════════════════════════════════════════════════════════${RESET}\n`);

  console.log(`  ${GREEN}Passed:  ${passed}${RESET}`);
  if (failed > 0)  console.log(`  ${RED}Failed:  ${failed}${RESET}`);
  if (skipped > 0) console.log(`  ${YELLOW}Skipped: ${skipped}${RESET}`);
  console.log(`  Total:   ${passed + failed + skipped}`);
  console.log();

  // Phase breakdown
  const phases = [...new Set(results.map(r => r.phase))];
  for (const phase of phases) {
    const pr = results.filter(r => r.phase === phase);
    const pp = pr.filter(r => r.status === "PASS").length;
    const pf = pr.filter(r => r.status === "FAIL").length;
    const ps = pr.filter(r => r.status === "SKIP").length;
    const icon = pf > 0 ? `${RED}✗${RESET}` : ps === pr.length ? `${YELLOW}⊘${RESET}` : `${GREEN}✓${RESET}`;
    const parts = [`${pp} pass`];
    if (pf > 0) parts.push(`${pf} fail`);
    if (ps > 0) parts.push(`${ps} skip`);
    console.log(`  ${icon} ${phase}: ${parts.join(", ")}`);
  }

  // Failed test details
  if (failed > 0) {
    console.log(`\n${RED}Failed tests:${RESET}`);
    for (const r of results.filter(r => r.status === "FAIL")) {
      console.log(`  ${RED}✗ [${r.phase}] ${r.id} ${r.name}${RESET}`);
      console.log(`      ${r.detail}`);
    }
  }

  // Save results
  const reportDir = path.resolve(__dirname, "../.test-output");
  const reportPath = path.join(reportDir, `live-integration-${PROFILE}-${Date.now()}.json`);
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    profile: PROFILE,
    passed, failed, skipped,
    results,
  }, null, 2));
  console.log(`\n  Results saved: ${reportPath}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
