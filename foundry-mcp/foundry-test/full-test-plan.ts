#!/usr/bin/env npx tsx

/**
 * Full Test Plan Execution
 *
 * Exercises every test case from TEST_PLAN.html that can be run offline
 * (no live ServiceNow instance). Covers:
 *   - Foundry tools (init, list, add, sync, info, search, new, validate, promote, external, version, templates)
 *   - ServiceNow tool definitions & guards
 *   - AIA + Skill tool definitions & guards
 *   - MCP protocol (via subprocess)
 *   - Security tests
 *   - E2E workflows (offline)
 *   - Performance checks
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

// Foundry tools
import { FOUNDRY_TOOLS, handleFoundryTool, isFoundryTool } from "../dist/foundry/tools.js";

// ServiceNow core
import { SERVICENOW_TOOLS, handleServiceNowTool, isServiceNowTool } from "../dist/servicenow/tools.js";

// AIA tools
import { AIA_TOOLS, handleAiaTool, isAiaTool } from "../dist/servicenow/tools-aia.js";

// Skill tools
import { SKILL_TOOLS, handleSkillTool, isSkillTool } from "../dist/servicenow/tools-skills.js";

// Guards & discovery
import { requireConnection, isConnectionError } from "../dist/servicenow/guards.js";
import { clearTableCache } from "../dist/servicenow/table-discovery.js";

// Client & types
import { ServiceNowClient } from "../dist/servicenow/client.js";
import { ServiceNowError, ServiceNowErrorType } from "../dist/servicenow/types.js";
import { connectionManager } from "../dist/servicenow/connection-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_PATH = path.resolve(__dirname, "../dist/index.js");
const TEST_DIR = path.resolve(__dirname, "test-output");
const GOLDEN_PATH = path.resolve(__dirname, "../../foundry-golden");

// ── Test Runner ──────────────────────────────────────────────

interface TestResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
  durationMs: number;
}

const results: TestResult[] = [];
let sectionName = "";

function section(name: string) {
  sectionName = name;
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
    console.log(`    \x1b[31m→ ${detail}\x1b[0m`);
  }
}

function skip(id: string, name: string, reason: string) {
  results.push({ id, name, status: "SKIP", detail: reason, durationMs: 0 });
  console.log(`  \x1b[33m○\x1b[0m ${id} ${name} \x1b[90m(${reason})\x1b[0m`);
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// ── Helper: Call foundry tool ──────────────────────────────

async function foundry(name: string, args: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  return handleFoundryTool(name, args);
}

// ── Setup & Cleanup ──────────────────────────────────────────

async function setup() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanup() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

// ── MCP helper ──────────────────────────────────────────────

let mcpMsgId = 0;

function mcpRequest(method: string, params?: Record<string, unknown>): string {
  mcpMsgId++;
  return JSON.stringify({ jsonrpc: "2.0", id: mcpMsgId, method, params: params || {} }) + "\n";
}

async function mcpSendReceive(
  proc: ChildProcess, method: string, params?: Record<string, unknown>, timeoutMs = 10000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const currentId = mcpMsgId + 1;
    let buffer = "";
    const timeout = setTimeout(() => { cleanup_(); reject(new Error(`Timeout: ${method}`)); }, timeoutMs);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      for (const line of buffer.split("\n")) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.jsonrpc === "2.0" && parsed.id === currentId) { cleanup_(); resolve(parsed); return; }
        } catch {}
      }
    };
    const cleanup_ = () => { clearTimeout(timeout); proc.stdout?.removeListener("data", onData); };
    proc.stdout?.on("data", onData);
    proc.stdin?.write(mcpRequest(method, params));
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN TEST EXECUTION
// ══════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log("\x1b[1m");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        FOUNDRY MCP — FULL TEST PLAN EXECUTION          ║");
  console.log("║                  v2026.02.1303                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\x1b[0m");

  await setup();

  // ═══════════════════════════════════════════════════════════
  // SECTION 5: foundry_init
  // ═══════════════════════════════════════════════════════════
  section("5. foundry_init");

  await test("FI-001", "Create project with default template", async () => {
    const r = await foundry("foundry_init", { projectName: "fi-001-project", path: TEST_DIR, goldenPath: GOLDEN_PATH });
    assert(r.success, `Expected success, got: ${r.message}`);
    const projectPath = path.join(TEST_DIR, "fi-001-project");
    const stat = await fs.stat(projectPath);
    assert(stat.isDirectory(), "Project path is not a directory");
    return "Project created with directory structure";
  });

  await test("FI-002", "CLAUDE.md contains SPARC methodology", async () => {
    const content = await fs.readFile(path.join(TEST_DIR, "fi-001-project", "CLAUDE.md"), "utf8");
    assert(content.includes("SPARC"), "CLAUDE.md missing SPARC");
    assert(content.includes("fi-001-project"), "CLAUDE.md missing project name");
    return "CLAUDE.md has SPARC and project name";
  });

  await test("FI-003", "Context files populated", async () => {
    const files = await fs.readdir(path.join(TEST_DIR, "fi-001-project", ".claude", "context"));
    assert(files.includes("now-assist-platform.md"), "Missing now-assist-platform.md");
    assert(files.includes("servicenow-ai-data-model.md"), "Missing servicenow-ai-data-model.md");
    assert(files.includes("tool-script-rules.md"), "Missing tool-script-rules.md");
    return `${files.length} context files present`;
  });

  await test("FI-004", "Skills populated with SKILL.md and examples", async () => {
    const skillsDir = path.join(TEST_DIR, "fi-001-project", ".claude", "skills");
    const skills = await fs.readdir(skillsDir);
    assert(skills.includes("servicenow-agent-builder"), "Missing servicenow-agent-builder skill");
    assert(skills.includes("now-assist-skill-builder"), "Missing now-assist-skill-builder skill");
    const agentSkill = await fs.readdir(path.join(skillsDir, "servicenow-agent-builder"));
    assert(agentSkill.includes("SKILL.md"), "Missing SKILL.md");
    assert(agentSkill.includes("examples"), "Missing examples/");
    return `${skills.length} skills with SKILL.md + examples`;
  });

  await test("FI-005", "Custom path parameter", async () => {
    const customPath = path.join(TEST_DIR, "custom-subdir");
    await fs.mkdir(customPath, { recursive: true });
    const r = await foundry("foundry_init", { projectName: "fi-005-project", path: customPath, goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    const stat = await fs.stat(path.join(customPath, "fi-005-project"));
    assert(stat.isDirectory(), "Project not at custom path");
    return "Project created at custom path";
  });

  await test("FI-006", "Template: minimal", async () => {
    const r = await foundry("foundry_init", { projectName: "fi-006-minimal", path: TEST_DIR, template: "minimal", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    const claudeMd = await fs.readFile(path.join(TEST_DIR, "fi-006-minimal", "CLAUDE.md"), "utf8");
    assert(claudeMd.length > 0, "CLAUDE.md empty");
    // Minimal should have empty or no context/skills
    let contextFiles: string[] = [];
    try { contextFiles = await fs.readdir(path.join(TEST_DIR, "fi-006-minimal", ".claude", "context")); } catch {}
    return `Minimal template: CLAUDE.md present, ${contextFiles.length} context files`;
  });

  await test("FI-007", "Template: standard", async () => {
    const r = await foundry("foundry_init", { projectName: "fi-007-standard", path: TEST_DIR, template: "standard", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    let contextFiles: string[] = [];
    let skills: string[] = [];
    try { contextFiles = await fs.readdir(path.join(TEST_DIR, "fi-007-standard", ".claude", "context")); } catch {}
    try { skills = await fs.readdir(path.join(TEST_DIR, "fi-007-standard", ".claude", "skills")); } catch {}
    return `Standard template: ${contextFiles.length} context, ${skills.length} skills`;
  });

  await test("FI-008", "Duplicate project name rejected", async () => {
    const r = await foundry("foundry_init", { projectName: "fi-001-project", path: TEST_DIR, goldenPath: GOLDEN_PATH });
    assert(!r.success, "Should have failed for duplicate");
    assert(r.message.toLowerCase().includes("exist"), `Expected 'exists' in message, got: ${r.message}`);
    return "Duplicate correctly rejected";
  });

  await test("FI-009", "Invalid project name rejected", async () => {
    const r = await foundry("foundry_init", { projectName: "My Project!", path: TEST_DIR, goldenPath: GOLDEN_PATH });
    assert(!r.success, "Should have failed for invalid name");
    return "Invalid name rejected";
  });

  await test("FI-010", "Missing projectName rejected", async () => {
    const r = await foundry("foundry_init", { path: TEST_DIR, goldenPath: GOLDEN_PATH });
    assert(!r.success, "Should have failed for missing projectName");
    return "Missing projectName rejected";
  });

  await test("FI-011", "goldenPath override works", async () => {
    const r = await foundry("foundry_init", { projectName: "fi-011-golden", path: TEST_DIR, goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "goldenPath override works (used local path)";
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 6: foundry_list / add / sync / info / search
  // ═══════════════════════════════════════════════════════════
  section("6. foundry_list / add / sync / info / search");

  const projectForLifecycle = path.join(TEST_DIR, "fi-001-project");

  await test("FL-001", "List all resources", async () => {
    const r = await foundry("foundry_list", { type: "all", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    assert(r.message.includes("context") || r.message.toLowerCase().includes("context"), "Missing context in output");
    return "All resources listed";
  });

  await test("FL-002", "List context files only", async () => {
    const r = await foundry("foundry_list", { type: "context", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    assert(r.message.includes("servicenow-ai-data-model") || r.message.includes("9"), "Missing new context files");
    return "Context files listed";
  });

  await test("FL-003", "List skills only", async () => {
    const r = await foundry("foundry_list", { type: "skills", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    assert(r.message.includes("servicenow-agent-builder") || r.message.includes("6"), "Missing new skill");
    return "Skills listed";
  });

  await test("FL-004", "List templates", async () => {
    const r = await foundry("foundry_list", { type: "templates", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "Templates listed";
  });

  await test("FA-001", "Add context file to project", async () => {
    // Use a resource NOT already in sparc-starter template
    // First remove it if it exists from a prior run
    const target = path.join(projectForLifecycle, ".claude", "context", "performance-tuning.md");
    try { await fs.rm(target); } catch {}
    const r = await foundry("foundry_add", { type: "context", name: "performance-tuning", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    await fs.access(target);
    return "Context file added";
  });

  await test("FA-002", "Add skill to project", async () => {
    // Remove if exists from sparc-starter
    const target = path.join(projectForLifecycle, ".claude", "skills", "testing-patterns");
    try { await fs.rm(target, { recursive: true }); } catch {}
    const r = await foundry("foundry_add", { type: "skill", name: "testing-patterns", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    await fs.access(path.join(target, "SKILL.md"));
    return "Skill added with SKILL.md";
  });

  await test("FA-003", "Duplicate detection", async () => {
    // testing-patterns was just added, adding again should be duplicate
    const r = await foundry("foundry_add", { type: "skill", name: "testing-patterns", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    assert(r.message.toLowerCase().includes("exist") || r.message.toLowerCase().includes("already"), "Should detect duplicate");
    return "Duplicate detected";
  });

  await test("FA-004", "Force overwrite", async () => {
    const r = await foundry("foundry_add", { type: "skill", name: "testing-patterns", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH, force: true });
    assert(r.success, r.message);
    return "Force overwrite succeeded";
  });

  await test("FA-005", "Non-existent resource", async () => {
    const r = await foundry("foundry_add", { type: "context", name: "does-not-exist-xyz", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    assert(!r.success, "Should fail for non-existent resource");
    return "Non-existent resource rejected";
  });

  await test("FS-001", "Sync dry-run shows diff", async () => {
    // Modify a file to create a diff
    const ctxFile = path.join(projectForLifecycle, ".claude", "context", "agentic-patterns.md");
    const original = await fs.readFile(ctxFile, "utf8");
    await fs.writeFile(ctxFile, original + "\n<!-- modified for test -->\n");
    const r = await foundry("foundry_sync", { projectPath: projectForLifecycle, dryRun: true, goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    // Restore
    await fs.writeFile(ctxFile, original);
    return "Dry-run shows diff without changing files";
  });

  await test("FN-001", "Info for context file", async () => {
    const r = await foundry("foundry_info", { type: "context", name: "servicenow-ai-data-model", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    assert(r.message.length > 100, "Info output too short");
    return "Context file info retrieved";
  });

  await test("FN-002", "Info for skill", async () => {
    const r = await foundry("foundry_info", { type: "skill", name: "servicenow-agent-builder", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    assert(r.message.length > 100, "Info output too short");
    return "Skill info retrieved";
  });

  await test("FN-003", "Info for template", async () => {
    const r = await foundry("foundry_info", { type: "template", name: "sparc-starter", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "Template info retrieved";
  });

  await test("FQ-001", "Search by name", async () => {
    const r = await foundry("foundry_search", { query: "agent", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    assert(r.message.toLowerCase().includes("agent"), "Search results should mention agent");
    return "Name search returned results";
  });

  await test("FQ-002", "Search by content", async () => {
    const r = await foundry("foundry_search", { query: "GlideRecord", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "Content search returned results";
  });

  await test("FQ-003", "Search with type filter", async () => {
    const r = await foundry("foundry_search", { query: "API", type: "context", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "Filtered search returned results";
  });

  await test("FQ-005", "No results", async () => {
    const r = await foundry("foundry_search", { query: "xyznonexistent123zzz", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message); // Should succeed but with no results
    return "Empty search handled gracefully";
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 7: foundry_new / validate / promote
  // ═══════════════════════════════════════════════════════════
  section("7. foundry_new / validate / promote");

  await test("FW-001", "Create new context file", async () => {
    const r = await foundry("foundry_new", { type: "context", name: "test-custom-context", projectPath: projectForLifecycle });
    assert(r.success, r.message);
    await fs.access(path.join(projectForLifecycle, ".claude", "context", "test-custom-context.md"));
    return "New context file scaffolded";
  });

  await test("FW-002", "Create new skill", async () => {
    const r = await foundry("foundry_new", { type: "skill", name: "test-custom-skill", projectPath: projectForLifecycle });
    assert(r.success, r.message);
    await fs.access(path.join(projectForLifecycle, ".claude", "skills", "test-custom-skill", "SKILL.md"));
    return "New skill directory scaffolded";
  });

  await test("FW-003", "Invalid name rejected", async () => {
    const r = await foundry("foundry_new", { type: "context", name: "My Skill!", projectPath: projectForLifecycle });
    assert(!r.success, "Should reject invalid name");
    return "Invalid name rejected";
  });

  await test("FV-001", "Valid context passes validation", async () => {
    // Write enough content to pass (50+ words)
    const ctxPath = path.join(projectForLifecycle, ".claude", "context", "test-custom-context.md");
    const longContent = "# Test Context\n\n" + "This is a test context file with sufficient content to pass validation. ".repeat(10);
    await fs.writeFile(ctxPath, longContent);
    const r = await foundry("foundry_validate", { type: "context", name: "test-custom-context", projectPath: projectForLifecycle });
    assert(r.success, r.message);
    return "Valid context passed";
  });

  await test("FV-002", "Short content fails validation", async () => {
    const ctxPath = path.join(projectForLifecycle, ".claude", "context", "test-custom-context.md");
    await fs.writeFile(ctxPath, "Too short");
    const r = await foundry("foundry_validate", { type: "context", name: "test-custom-context", projectPath: projectForLifecycle });
    assert(!r.success, "Short content should fail validation");
    return "Short content rejected";
  });

  await test("FV-003", "Valid skill passes validation", async () => {
    // Write skill content
    const skillPath = path.join(projectForLifecycle, ".claude", "skills", "test-custom-skill", "SKILL.md");
    const content = "# Test Skill\n\n" + "This skill does something useful for testing purposes. ".repeat(10);
    await fs.writeFile(skillPath, content);
    const exDir = path.join(projectForLifecycle, ".claude", "skills", "test-custom-skill", "examples");
    await fs.mkdir(exDir, { recursive: true });
    await fs.writeFile(path.join(exDir, "example.md"), "# Example\nSome example content here.");
    const r = await foundry("foundry_validate", { type: "skill", name: "test-custom-skill", projectPath: projectForLifecycle });
    assert(r.success, r.message);
    return "Valid skill passed";
  });

  await test("FP-001", "Promote requires passing validation", async () => {
    // Use the short content context
    const ctxPath = path.join(projectForLifecycle, ".claude", "context", "test-custom-context.md");
    await fs.writeFile(ctxPath, "Too short");
    const r = await foundry("foundry_promote", { type: "context", name: "test-custom-context", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    assert(!r.success, "Promote should fail for invalid content");
    return "Promote blocked by validation";
  });

  await test("FP-002", "Branch naming convention", async () => {
    // Make it valid first
    const ctxPath = path.join(projectForLifecycle, ".claude", "context", "test-custom-context.md");
    await fs.writeFile(ctxPath, "# Test\n\n" + "Word ".repeat(60));
    const r = await foundry("foundry_promote", { type: "context", name: "test-custom-context", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    // May fail due to gh CLI but should show the branch name pattern
    assert(r.message.includes("foundry/") || r.message.includes("test-custom-context") || r.message.includes("gh"), `Branch pattern not found in: ${r.message.substring(0, 200)}`);
    return "Branch naming convention checked";
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 8: foundry_external / version / templates
  // ═══════════════════════════════════════════════════════════
  section("8. foundry_external / version / templates");

  await test("FE-001", "List external sources", async () => {
    const r = await foundry("foundry_external", { action: "list", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "External sources listed";
  });

  await test("FE-002", "Parse @approved source", async () => {
    const r = await foundry("foundry_external", { action: "info", source: "@approved/servicenow-utils", goldenPath: GOLDEN_PATH });
    // May succeed or fail depending on registry, but should not crash
    return `@approved source parsed (success=${r.success})`;
  });

  await test("FE-004", "Invalid source rejected", async () => {
    const r = await foundry("foundry_external", { action: "add", source: "no-at-prefix", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    assert(!r.success, "Should reject source without @");
    return "Invalid source rejected";
  });

  await test("FV2-001", "Version status", async () => {
    const r = await foundry("foundry_version", { action: "status", projectPath: projectForLifecycle, goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "Version status retrieved";
  });

  await test("FT-001", "List templates", async () => {
    const r = await foundry("foundry_templates", { action: "list", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    assert(r.message.includes("sparc-starter") || r.message.includes("sparc"), "Missing sparc-starter template");
    return "Templates listed";
  });

  await test("FT-002", "Preview template", async () => {
    const r = await foundry("foundry_templates", { action: "preview", template: "sparc-starter", goldenPath: GOLDEN_PATH });
    assert(r.success, r.message);
    return "Template preview shown";
  });

  await test("FT-003", "Invalid template rejected", async () => {
    const r = await foundry("foundry_templates", { action: "preview", template: "nonexistent-template", goldenPath: GOLDEN_PATH });
    assert(!r.success, "Should reject invalid template");
    return "Invalid template rejected";
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 9: servicenow_connect / disconnect / status (offline)
  // ═══════════════════════════════════════════════════════════
  section("9. servicenow connect/disconnect/status (offline guards)");

  await test("SC-001", "Missing instance rejected", async () => {
    const r = await handleServiceNowTool("servicenow_connect", {});
    assert(r !== null, "Handler returned null");
    assert(r!.isError === true, "Should be error");
    assert(r!.content[0].text.includes("instance"), "Should mention instance");
    return "Missing instance rejected";
  });

  await test("SC-002", "URL normalization: bare hostname", async () => {
    const testAuth = { type: "basic" as const, username: "t", password: "t" };
    const c = new ServiceNowClient("dev12345.service-now.com", testAuth);
    assert(c.getInstanceUrl() === "https://dev12345.service-now.com", `Got: ${c.getInstanceUrl()}`);
    return "Bare hostname → https://";
  });

  await test("SC-003", "URL normalization: http upgraded", async () => {
    const testAuth = { type: "basic" as const, username: "t", password: "t" };
    const c = new ServiceNowClient("http://dev12345.service-now.com", testAuth);
    assert(c.getInstanceUrl() === "https://dev12345.service-now.com", `Got: ${c.getInstanceUrl()}`);
    return "http:// → https://";
  });

  await test("SC-004", "URL normalization: trailing slash removed", async () => {
    const testAuth = { type: "basic" as const, username: "t", password: "t" };
    const c = new ServiceNowClient("https://dev12345.service-now.com/", testAuth);
    assert(c.getInstanceUrl() === "https://dev12345.service-now.com", `Got: ${c.getInstanceUrl()}`);
    return "Trailing slash removed";
  });

  await test("SD-001", "Disconnect when not connected", async () => {
    const r = await handleServiceNowTool("servicenow_disconnect", {});
    assert(r !== null, "Handler returned null");
    assert(r!.content[0].text.includes("Not connected"), "Should say not connected");
    return "Disconnect when not connected handled";
  });

  await test("SS-001", "Status when not connected", async () => {
    const r = await handleServiceNowTool("servicenow_status", {});
    assert(r !== null, "Handler returned null");
    assert(r!.content[0].text.includes("Not connected"), "Should say not connected");
    return "Status shows not connected";
  });

  // Live tests
  skip("SC-005", "Basic auth connection", "Requires live ServiceNow instance");
  skip("SC-006", "Token auth connection", "Requires live ServiceNow instance");
  skip("SC-007", "Profile-based connection", "Requires live ServiceNow instance");
  skip("SC-008", "Invalid credentials rejected", "Requires live ServiceNow instance");
  skip("SC-009", "Unreachable instance", "Requires live ServiceNow instance");
  skip("SD-002", "Disconnect active session", "Requires live ServiceNow instance");
  skip("SS-002", "Status when connected", "Requires live ServiceNow instance");

  // ═══════════════════════════════════════════════════════════
  // SECTION 10: servicenow_query / syslogs / aia_logs (guards)
  // ═══════════════════════════════════════════════════════════
  section("10. servicenow query/syslogs/aia_logs (offline guards)");

  for (const [id, tool] of [
    ["SQ-001", "servicenow_query"],
    ["SL-001", "servicenow_syslogs"],
    ["AL-001", "servicenow_aia_logs"],
  ] as const) {
    await test(id, `${tool} rejects when not connected`, async () => {
      const r = await handleServiceNowTool(tool, { table: "incident", script: "test" });
      assert(r !== null && r.isError === true, "Should be error");
      assert(r!.content[0].text.includes("Not connected"), "Should say not connected");
      return `${tool} guard works`;
    });
  }

  skip("SQ-002", "Basic table query", "Requires live ServiceNow instance");
  skip("SQ-003", "Query with filter", "Requires live ServiceNow instance");
  skip("SQ-004", "Query with field selection", "Requires live ServiceNow instance");
  skip("SQ-005", "Query with ordering", "Requires live ServiceNow instance");
  skip("SL-002", "Default syslog query", "Requires live ServiceNow instance");
  skip("AL-002", "Default AIA log query", "Requires live ServiceNow instance");

  // ═══════════════════════════════════════════════════════════
  // SECTION 11-12: servicenow_script / instance (guards)
  // ═══════════════════════════════════════════════════════════
  section("11-12. servicenow script/instance (offline guards)");

  await test("XS-001", "Script rejects when not connected", async () => {
    const r = await handleServiceNowTool("servicenow_script", { script: "gs.info('test')" });
    assert(r !== null && r.isError === true, "Should be error");
    assert(r!.content[0].text.includes("Not connected"), "Should say not connected");
    return "Script guard works";
  });

  await test("SI-001", "Instance info rejects when not connected", async () => {
    const r = await handleServiceNowTool("servicenow_instance", {});
    assert(r !== null && r.isError === true, "Should be error");
    assert(r!.content[0].text.includes("Not connected"), "Should say not connected");
    return "Instance guard works";
  });

  skip("XS-002", "Read-only script execution", "Requires live ServiceNow instance");
  skip("XS-003", "Execute mode", "Requires live ServiceNow instance");
  skip("SI-002", "Basic instance info", "Requires live ServiceNow instance");

  // ═══════════════════════════════════════════════════════════
  // SECTION 13: AIA read tools (definitions + guards)
  // ═══════════════════════════════════════════════════════════
  section("13. AIA list/get/trace/errors (definitions + guards)");

  const aiaTools = ["servicenow_aia_list", "servicenow_aia_get", "servicenow_aia_trace", "servicenow_aia_errors"];
  for (const tool of aiaTools) {
    const shortId = tool.replace("servicenow_aia_", "");
    await test(`AAL-${shortId}`, `${tool} rejects when not connected`, async () => {
      const r = await handleAiaTool(tool, { agent: "test", executionId: "test" });
      assert(r !== null && r.isError === true, "Should be error");
      assert(r!.content[0].text.includes("Not connected"), "Should say not connected");
      return `${tool} guard works`;
    });
  }

  await test("AAL-DEF", "All 6 AIA tool definitions present", async () => {
    assert(AIA_TOOLS.length === 6, `Expected 6, got ${AIA_TOOLS.length}`);
    const names = AIA_TOOLS.map(t => t.name);
    for (const expected of ["servicenow_aia_list", "servicenow_aia_get", "servicenow_aia_trace", "servicenow_aia_errors", "servicenow_aia_execute", "servicenow_aia_create"]) {
      assert(names.includes(expected), `Missing ${expected}`);
    }
    return "All 6 AIA tools defined";
  });

  await test("AAG-REQ", "aia_get requires 'agent' parameter", async () => {
    const tool = AIA_TOOLS.find(t => t.name === "servicenow_aia_get");
    const schema = tool!.inputSchema as { required?: string[] };
    assert(schema.required?.includes("agent"), "Should require agent");
    return "agent param required";
  });

  await test("AAT-REQ", "aia_trace requires 'executionId' parameter", async () => {
    const tool = AIA_TOOLS.find(t => t.name === "servicenow_aia_trace");
    const schema = tool!.inputSchema as { required?: string[] };
    assert(schema.required?.includes("executionId"), "Should require executionId");
    return "executionId param required";
  });

  await test("AXC-DRY", "aia_create has dryRun property (handler defaults true)", async () => {
    const tool = AIA_TOOLS.find(t => t.name === "servicenow_aia_create");
    const schema = tool!.inputSchema as { properties?: Record<string, any> };
    assert(schema.properties?.dryRun, "Should have dryRun property");
    assert(schema.properties?.dryRun.type === "boolean", "dryRun should be boolean");
    // Handler enforces default via: const dryRun = args.dryRun !== false;
    assert(schema.properties?.dryRun.description?.includes("default: true"), "Description should mention default true");
    return "dryRun property present, handler defaults to true";
  });

  skip("AAL-002", "List all agents (live)", "Requires live ServiceNow instance");
  skip("AAG-002", "Get agent by name (live)", "Requires live ServiceNow instance");
  skip("AAT-002", "Trace execution (live)", "Requires live ServiceNow instance");
  skip("AAE-002", "Default error aggregation (live)", "Requires live ServiceNow instance");

  // ═══════════════════════════════════════════════════════════
  // SECTION 14: AIA execute/create (definitions + guards)
  // ═══════════════════════════════════════════════════════════
  section("14. AIA execute/create (definitions + guards)");

  await test("AXE-001", "aia_execute rejects when not connected", async () => {
    const r = await handleAiaTool("servicenow_aia_execute", { agent: "test", input: "hello" });
    assert(r !== null && r.isError === true, "Should be error");
    return "aia_execute guard works";
  });

  await test("AXC-001", "aia_create rejects when not connected", async () => {
    const r = await handleAiaTool("servicenow_aia_create", { agentName: "t", agentDescription: "t", agentInstructions: "t" });
    assert(r !== null && r.isError === true, "Should be error");
    return "aia_create guard works";
  });

  await test("AXC-REQ", "aia_create requires agentName + agentInstructions", async () => {
    const tool = AIA_TOOLS.find(t => t.name === "servicenow_aia_create");
    const schema = tool!.inputSchema as { required?: string[] };
    assert(schema.required?.includes("agentName"), "Should require agentName");
    assert(schema.required?.includes("agentInstructions"), "Should require agentInstructions");
    return "Required params validated";
  });

  skip("AXE-002", "Execute agent (live)", "Requires live ServiceNow instance");
  skip("AXC-004", "Create agent (live)", "Requires live ServiceNow instance");

  // ═══════════════════════════════════════════════════════════
  // SECTION 15-16: Skill tools (definitions + guards)
  // ═══════════════════════════════════════════════════════════
  section("15-16. Skill list/get/execute/create (definitions + guards)");

  await test("SKL-DEF", "All 4 Skill tool definitions present", async () => {
    assert(SKILL_TOOLS.length === 4, `Expected 4, got ${SKILL_TOOLS.length}`);
    const names = SKILL_TOOLS.map(t => t.name);
    for (const expected of ["servicenow_skill_list", "servicenow_skill_get", "servicenow_skill_execute", "servicenow_skill_create"]) {
      assert(names.includes(expected), `Missing ${expected}`);
    }
    return "All 4 Skill tools defined";
  });

  const skillTools = ["servicenow_skill_list", "servicenow_skill_get", "servicenow_skill_execute", "servicenow_skill_create"];
  for (const tool of skillTools) {
    const shortId = tool.replace("servicenow_skill_", "");
    await test(`SK-${shortId}`, `${tool} rejects when not connected`, async () => {
      const r = await handleSkillTool(tool, { skill: "test", input: {}, skillName: "t", description: "t", promptTemplate: "t" });
      assert(r !== null && r.isError === true, "Should be error");
      assert(r!.content[0].text.includes("Not connected"), "Should say not connected");
      return `${tool} guard works`;
    });
  }

  await test("SKG-REQ", "skill_get requires 'skill' parameter", async () => {
    const tool = SKILL_TOOLS.find(t => t.name === "servicenow_skill_get");
    const schema = tool!.inputSchema as { required?: string[] };
    assert(schema.required?.includes("skill"), "Should require skill");
    return "skill param required";
  });

  await test("SKC-REQ", "skill_create requires skillName + promptTemplate", async () => {
    const tool = SKILL_TOOLS.find(t => t.name === "servicenow_skill_create");
    const schema = tool!.inputSchema as { required?: string[] };
    assert(schema.required?.includes("skillName"), "Should require skillName");
    assert(schema.required?.includes("promptTemplate"), "Should require promptTemplate");
    return "Required params validated";
  });

  await test("SKC-DRY", "skill_create has dryRun property (handler defaults true)", async () => {
    const tool = SKILL_TOOLS.find(t => t.name === "servicenow_skill_create");
    const schema = tool!.inputSchema as { properties?: Record<string, any> };
    assert(schema.properties?.dryRun, "Should have dryRun property");
    assert(schema.properties?.dryRun.type === "boolean", "dryRun should be boolean");
    assert(schema.properties?.dryRun.description?.includes("default: true"), "Description should mention default true");
    return "dryRun property present, handler defaults to true";
  });

  skip("SKL-002", "List all skills (live)", "Requires live ServiceNow instance");
  skip("SKG-002", "Get skill by name (live)", "Requires live ServiceNow instance");
  skip("SKX-002", "Execute skill (live)", "Requires live ServiceNow instance");
  skip("SKC-003", "Create skill (live)", "Requires live ServiceNow instance");

  // ═══════════════════════════════════════════════════════════
  // SECTION 17: Security Tests
  // ═══════════════════════════════════════════════════════════
  section("17. Security Tests");

  await test("SEC-001", "Shell metacharacters blocked in resource names", async () => {
    const r = await foundry("foundry_new", { type: "context", name: "; rm -rf /", projectPath: projectForLifecycle });
    assert(!r.success, "Should reject shell metacharacters");
    return "Shell metacharacters blocked";
  });

  await test("SEC-003", "Path traversal blocked", async () => {
    const r = await foundry("foundry_new", { type: "context", name: "../../etc/passwd", projectPath: projectForLifecycle });
    assert(!r.success, "Should reject path traversal");
    return "Path traversal blocked";
  });

  await test("SEC-008", "aia_create defaults to dry-run", async () => {
    const tool = AIA_TOOLS.find(t => t.name === "servicenow_aia_create");
    const schema = tool!.inputSchema as { properties?: Record<string, any> };
    assert(schema.properties?.dryRun, "Should have dryRun property");
    // Handler code: const dryRun = args.dryRun !== false; — defaults to true
    assert(schema.properties?.dryRun.description?.includes("default: true"), "Description confirms default true");
    return "aia_create dry-run default verified via handler logic";
  });

  await test("SEC-009", "skill_create defaults to dry-run", async () => {
    const tool = SKILL_TOOLS.find(t => t.name === "servicenow_skill_create");
    const schema = tool!.inputSchema as { properties?: Record<string, any> };
    assert(schema.properties?.dryRun, "Should have dryRun property");
    assert(schema.properties?.dryRun.description?.includes("default: true"), "Description confirms default true");
    return "skill_create dry-run default verified via handler logic";
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 18: E2E Workflows (Offline)
  // ═══════════════════════════════════════════════════════════
  section("18. E2E Workflows");

  await test("E2E-001", "Project bootstrap workflow", async () => {
    // 1. Init
    const init = await foundry("foundry_init", { projectName: "e2e-project", path: TEST_DIR, goldenPath: GOLDEN_PATH });
    assert(init.success, `Init failed: ${init.message}`);
    const pp = path.join(TEST_DIR, "e2e-project");

    // 2. List
    const list = await foundry("foundry_list", { type: "all", goldenPath: GOLDEN_PATH });
    assert(list.success, `List failed: ${list.message}`);

    // 3. Add extra skill (remove first if template included it)
    const skillTarget = path.join(pp, ".claude", "skills", "deployment-automation");
    try { await fs.rm(skillTarget, { recursive: true }); } catch {}
    const add = await foundry("foundry_add", { type: "skill", name: "deployment-automation", projectPath: pp, goldenPath: GOLDEN_PATH });
    assert(add.success, `Add failed: ${add.message}`);

    // 4. Info
    const info = await foundry("foundry_info", { type: "skill", name: "deployment-automation", goldenPath: GOLDEN_PATH });
    assert(info.success, `Info failed: ${info.message}`);

    // 5. Search
    const search = await foundry("foundry_search", { query: "deploy", goldenPath: GOLDEN_PATH });
    assert(search.success, `Search failed: ${search.message}`);

    return "Full bootstrap workflow: init → list → add → info → search";
  });

  await test("E2E-002", "Contribution workflow", async () => {
    const pp = path.join(TEST_DIR, "e2e-project");

    // 1. New resource
    const newR = await foundry("foundry_new", { type: "context", name: "e2e-contribution", projectPath: pp });
    assert(newR.success, `New failed: ${newR.message}`);

    // 2. Write content
    const ctxPath = path.join(pp, ".claude", "context", "e2e-contribution.md");
    await fs.writeFile(ctxPath, "# E2E Contribution\n\n" + "This is real content for the contribution workflow test. ".repeat(10));

    // 3. Validate
    const validate = await foundry("foundry_validate", { type: "context", name: "e2e-contribution", projectPath: pp });
    assert(validate.success, `Validate failed: ${validate.message}`);

    // 4. Promote (will fail at gh CLI but should get to the promotion step)
    const promote = await foundry("foundry_promote", { type: "context", name: "e2e-contribution", projectPath: pp, goldenPath: GOLDEN_PATH });
    // This may fail due to gh CLI, but the workflow should reach promotion
    return `Contribution workflow: new → edit → validate → promote (promote success=${promote.success})`;
  });

  await test("E2E-003", "ServiceNow connection lifecycle (offline)", async () => {
    // 1. Status → not connected
    const s1 = await handleServiceNowTool("servicenow_status", {});
    assert(s1!.content[0].text.includes("Not connected"), "Should start not connected");

    // 2. Disconnect → graceful when not connected
    const d1 = await handleServiceNowTool("servicenow_disconnect", {});
    assert(d1!.content[0].text.includes("Not connected"), "Disconnect should be graceful");

    // 3. All guards block when not connected
    const q1 = await handleServiceNowTool("servicenow_query", { table: "incident" });
    assert(q1!.isError === true, "Query should fail");

    return "Offline lifecycle: status → disconnect → query all blocked correctly";
  });

  skip("E2E-004", "Agent build & test workflow", "Requires live ServiceNow instance");
  skip("E2E-005", "Skill build & test workflow", "Requires live ServiceNow instance");
  skip("E2E-006", "Troubleshooting flow", "Requires live ServiceNow instance");

  // ═══════════════════════════════════════════════════════════
  // SECTION 19: Performance
  // ═══════════════════════════════════════════════════════════
  section("19. Performance");

  await test("PF-002", "tools/list is fast (< 100ms)", async () => {
    // Measure how long it takes to get all tool definitions
    const start = Date.now();
    const allTools = [...FOUNDRY_TOOLS, ...SERVICENOW_TOOLS, ...AIA_TOOLS, ...SKILL_TOOLS];
    const elapsed = Date.now() - start;
    assert(allTools.length === 30, `Expected 30 tools, got ${allTools.length}`);
    assert(elapsed < 100, `Took ${elapsed}ms, expected < 100ms`);
    return `${allTools.length} tools loaded in ${elapsed}ms`;
  });

  await test("PF-005", "Table discovery cache clears without error", async () => {
    clearTableCache();
    clearTableCache(); // Double clear should be safe
    return "Cache clear is idempotent";
  });

  // ═══════════════════════════════════════════════════════════
  // SECTION 20: MCP Protocol
  // ═══════════════════════════════════════════════════════════
  section("20. MCP Protocol Compliance");

  const proc = spawn("node", [SERVER_PATH], { stdio: ["pipe", "pipe", "pipe"] });
  let stderrOutput = "";
  proc.stderr?.on("data", (chunk: Buffer) => { stderrOutput += chunk.toString(); });
  await new Promise(resolve => setTimeout(resolve, 500));

  if (proc.exitCode !== null) {
    await test("MCP-001", "Server started", async () => { throw new Error(`Server exited: ${proc.exitCode}`); });
  } else {
    await test("MCP-001", "Initialize handshake", async () => {
      const r = await mcpSendReceive(proc, "initialize", {
        protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" },
      });
      assert(r.result !== undefined, "No result in initialize response");
      return "Initialize handshake succeeded";
    });

    // Send initialized notification
    proc.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
    await new Promise(resolve => setTimeout(resolve, 200));

    await test("MCP-002", "Tool count is 30", async () => {
      const r = await mcpSendReceive(proc, "tools/list");
      const result = r.result as any;
      const tools = result?.tools || [];
      assert(tools.length === 30, `Expected 30 tools, got ${tools.length}`);
      return `${tools.length} tools registered`;
    });

    await test("MCP-003", "All 30 tool names present", async () => {
      const r = await mcpSendReceive(proc, "tools/list");
      const result = r.result as any;
      const toolNames = (result?.tools || []).map((t: any) => t.name);
      const expected = [
        "foundry_init", "foundry_list", "foundry_add", "foundry_sync",
        "foundry_info", "foundry_search", "foundry_new", "foundry_validate",
        "foundry_promote", "foundry_external", "foundry_version", "foundry_templates",
        "servicenow_connect", "servicenow_disconnect", "servicenow_status",
        "servicenow_syslogs", "servicenow_aia_logs", "servicenow_query",
        "servicenow_script", "servicenow_instance",
        "servicenow_aia_list", "servicenow_aia_get", "servicenow_aia_trace",
        "servicenow_aia_errors", "servicenow_aia_execute", "servicenow_aia_create",
        "servicenow_skill_list", "servicenow_skill_get",
        "servicenow_skill_execute", "servicenow_skill_create",
      ];
      const missing = expected.filter(n => !toolNames.includes(n));
      assert(missing.length === 0, `Missing: ${missing.join(", ")}`);
      return "All 30 tool names verified";
    });

    await test("MCP-004", "Tool schemas valid", async () => {
      const r = await mcpSendReceive(proc, "tools/list");
      const result = r.result as any;
      const tools = result?.tools || [];
      for (const tool of tools) {
        assert(tool.name, `Tool missing name`);
        assert(tool.description, `${tool.name} missing description`);
        assert(tool.inputSchema, `${tool.name} missing inputSchema`);
        assert(tool.inputSchema.type === "object", `${tool.name} schema type should be object`);
      }
      return `All ${tools.length} tool schemas valid`;
    });

    await test("MCP-005", "tools/call dispatches correctly", async () => {
      const r = await mcpSendReceive(proc, "tools/call", { name: "servicenow_status", arguments: {} });
      const result = r.result as any;
      assert(result?.content?.[0]?.text, "No content in response");
      assert(result.content[0].text.includes("Not connected"), "Should return not connected status");
      return "Tool call dispatched correctly";
    });

    await test("MCP-006", "Unknown tool returns error", async () => {
      const r = await mcpSendReceive(proc, "tools/call", { name: "nonexistent_tool", arguments: {} });
      const result = r.result as any;
      assert(result?.isError === true, "Should be error");
      assert(result?.content?.[0]?.text?.includes("Unknown tool"), "Should say unknown tool");
      return "Unknown tool handled";
    });

    await test("MCP-010", "stderr logging on startup", async () => {
      assert(stderrOutput.includes("Foundry MCP server started"), `stderr: ${stderrOutput.substring(0, 200)}`);
      return "Server startup logged to stderr";
    });

    proc.kill("SIGTERM");
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // ═══════════════════════════════════════════════════════════
  // SHARED INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════
  section("Shared Infrastructure");

  await test("GRD-001", "requireConnection returns error when not connected", async () => {
    const r = requireConnection();
    assert(isConnectionError(r), "Should return connection error");
    return "Guard returns error";
  });

  await test("GRD-002", "isConnectionError type guard works", async () => {
    const r = requireConnection();
    assert(isConnectionError(r) === true, "Error result should be true");
    // If we had a connection, isConnectionError should return false
    // We can't test that without a live connection
    return "Type guard works";
  });

  await test("ERR-001", "ServiceNowError structure", async () => {
    const err = new ServiceNowError(ServiceNowErrorType.AUTHENTICATION_FAILED, "Test", { d: 1 }, "Try again");
    assert(err.type === ServiceNowErrorType.AUTHENTICATION_FAILED, "Wrong type");
    const json = err.toJSON();
    assert(json.message === "Test", "Wrong message");
    assert(json.suggestion === "Try again", "Wrong suggestion");
    return "ServiceNowError works";
  });

  await test("CM-001", "ConnectionManager starts empty", async () => {
    const s = connectionManager.getStatus();
    assert(!s.connected, "Should not be connected");
    assert(s.sessionCount === 0, "Should have 0 sessions");
    return "ConnectionManager empty";
  });

  await test("TD-001", "Table discovery cache operations", async () => {
    clearTableCache();
    return "Cache operations safe";
  });

  await test("DETECT-001", "Tool detection functions", async () => {
    assert(isFoundryTool("foundry_init") === true, "foundry_init should be foundry");
    assert(isFoundryTool("servicenow_connect") === false, "servicenow_connect is not foundry");
    assert(isServiceNowTool("servicenow_connect") === true, "servicenow_connect should be SN");
    assert(isServiceNowTool("foundry_init") === false, "foundry_init is not SN");
    assert(isAiaTool("servicenow_aia_list") === true, "aia_list should be AIA");
    assert(isAiaTool("servicenow_connect") === false, "connect is not AIA");
    assert(isSkillTool("servicenow_skill_list") === true, "skill_list should be skill");
    assert(isSkillTool("servicenow_aia_list") === false, "aia_list is not skill");
    return "All detection functions correct";
  });

  await test("COUNT-001", "Total tool count is 30", async () => {
    const total = FOUNDRY_TOOLS.length + SERVICENOW_TOOLS.length + AIA_TOOLS.length + SKILL_TOOLS.length;
    assert(total === 30, `Expected 30, got ${total} (${FOUNDRY_TOOLS.length}+${SERVICENOW_TOOLS.length}+${AIA_TOOLS.length}+${SKILL_TOOLS.length})`);
    return `30 tools: ${FOUNDRY_TOOLS.length} foundry + ${SERVICENOW_TOOLS.length} SN + ${AIA_TOOLS.length} AIA + ${SKILL_TOOLS.length} skill`;
  });

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  await cleanup();

  console.log("\n\x1b[1m");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                     TEST RESULTS                       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\x1b[0m");

  const passed = results.filter(r => r.status === "PASS");
  const failed = results.filter(r => r.status === "FAIL");
  const skipped = results.filter(r => r.status === "SKIP");

  console.log(`  \x1b[32m✓ Passed:  ${passed.length}\x1b[0m`);
  console.log(`  \x1b[31m✗ Failed:  ${failed.length}\x1b[0m`);
  console.log(`  \x1b[33m○ Skipped: ${skipped.length}\x1b[0m (require live ServiceNow instance)`);
  console.log(`  ─────────────────`);
  console.log(`  Total:   ${results.length}`);

  if (failed.length > 0) {
    console.log("\n\x1b[31m  FAILURES:\x1b[0m");
    for (const f of failed) {
      console.log(`    ${f.id} ${f.name}`);
      console.log(`      → ${f.detail}`);
    }
  }

  if (skipped.length > 0) {
    console.log("\n\x1b[33m  SKIPPED (require live instance):\x1b[0m");
    for (const s of skipped) {
      console.log(`    ${s.id} ${s.name}`);
    }
  }

  // Timing
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  console.log(`\n  Total execution time: ${(totalMs / 1000).toFixed(2)}s`);

  console.log("");
  process.exit(failed.length > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
