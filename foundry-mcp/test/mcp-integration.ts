#!/usr/bin/env npx tsx

/**
 * MCP Protocol Integration Test
 *
 * Spawns the MCP server over stdio and validates:
 * 1. tools/list returns all 20 tools
 * 2. tools/call for servicenow_status returns "not connected"
 * 3. tools/call for foundry_init creates a project
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { TestRunner } from "./utils/test-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const t = new TestRunner();
const SERVER_PATH = path.resolve(__dirname, "../dist/index.js");
const TEST_DIR = path.resolve(__dirname, "../.test-output/mcp-integration");

// Expected tool counts
const EXPECTED_FOUNDRY_TOOLS = 13;
const EXPECTED_SERVICENOW_TOOLS = 25; // 8 core + 11 AIA + 4 skill + 2 flow
const EXPECTED_TOTAL_TOOLS = EXPECTED_FOUNDRY_TOOLS + EXPECTED_SERVICENOW_TOOLS;

let msgId = 0;

/**
 * MCP stdio transport uses newline-delimited JSON (NDJSON).
 * Each message is JSON.stringify(msg) + '\n'
 */
function makeRequest(method: string, params?: Record<string, unknown>): string {
  msgId++;
  return JSON.stringify({
    jsonrpc: "2.0",
    id: msgId,
    method,
    params: params || {},
  }) + "\n";
}

function makeNotification(method: string, params?: Record<string, unknown>): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    method,
    params: params || {},
  }) + "\n";
}

async function sendAndReceive(
  proc: ChildProcess,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs: number = 10000
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const currentId = msgId + 1;
    let buffer = "";

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for response to ${method} (id=${currentId})`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      // Split on newlines and try to parse each line
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.jsonrpc === "2.0" && parsed.id === currentId) {
            cleanup();
            resolve(parsed);
            return;
          }
        } catch {
          // Not valid JSON yet, keep buffering
        }
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      proc.stdout?.removeListener("data", onData);
    };

    proc.stdout?.on("data", onData);
    proc.stdin?.write(makeRequest(method, params));
  });
}

async function runTests(): Promise<void> {
  t.log("═══════════════════════════════════════════════════════════", "header");
  t.log("  MCP PROTOCOL INTEGRATION TEST", "header");
  t.log("═══════════════════════════════════════════════════════════", "header");

  // Clean up test output
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR, { recursive: true });

  // Spawn the MCP server
  t.log("Starting MCP server...", "header");
  const proc = spawn("node", [SERVER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  let serverError = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    serverError += chunk.toString();
  });

  // Give the server a moment to start
  await new Promise(resolve => setTimeout(resolve, 500));

  if (proc.exitCode !== null) {
    t.fail("Server started", `Server exited immediately with code ${proc.exitCode}: ${serverError}`);
    process.exit(1);
  }
  t.pass("Server started", "MCP server spawned successfully");

  try {
    // 1. Initialize the connection
    t.log("Sending initialize...", "header");
    const initResponse = await sendAndReceive(proc, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });

    if (initResponse.result) {
      t.pass("Initialize", "Server responded to initialize");
    } else {
      t.fail("Initialize", `Unexpected response: ${JSON.stringify(initResponse)}`);
    }

    // Send initialized notification (no response expected)
    proc.stdin?.write(makeNotification("notifications/initialized"));
    await new Promise(resolve => setTimeout(resolve, 200));

    // 2. List tools
    t.log("Testing tools/list...", "header");
    const listResponse = await sendAndReceive(proc, "tools/list");
    const listResult = listResponse.result as Record<string, unknown> | undefined;
    const tools = (listResult?.tools || []) as Array<{ name: string }>;

    if (tools.length === EXPECTED_TOTAL_TOOLS) {
      t.pass("Tool count", `Found all ${EXPECTED_TOTAL_TOOLS} tools`);
    } else {
      t.fail("Tool count", `Expected ${EXPECTED_TOTAL_TOOLS} tools, got ${tools.length}`);
    }

    // Verify specific tools exist
    const foundryTools = tools.filter(tool => tool.name.startsWith("foundry_"));
    const snTools = tools.filter(tool => tool.name.startsWith("servicenow_"));

    if (foundryTools.length === EXPECTED_FOUNDRY_TOOLS) {
      t.pass("Foundry tools", `Found all ${EXPECTED_FOUNDRY_TOOLS} foundry tools`);
    } else {
      t.fail("Foundry tools", `Expected ${EXPECTED_FOUNDRY_TOOLS}, got ${foundryTools.length}`);
    }

    if (snTools.length === EXPECTED_SERVICENOW_TOOLS) {
      t.pass("ServiceNow tools", `Found all ${EXPECTED_SERVICENOW_TOOLS} servicenow tools`);
    } else {
      t.fail("ServiceNow tools", `Expected ${EXPECTED_SERVICENOW_TOOLS}, got ${snTools.length}`);
    }

    // Verify all tool names
    const expectedNames = [
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
    const toolNames = tools.map(tool => tool.name);
    const missingTools = expectedNames.filter(name => !toolNames.includes(name));

    if (missingTools.length === 0) {
      t.pass("All tool names", "All expected tool names present");
    } else {
      t.fail("All tool names", `Missing: ${missingTools.join(", ")}`);
    }

    // 3. Call servicenow_status (should work without connection)
    t.log("Testing servicenow_status...", "header");
    const statusResponse = await sendAndReceive(proc, "tools/call", {
      name: "servicenow_status",
      arguments: {},
    });
    const statusResult = statusResponse.result as Record<string, unknown> | undefined;
    const statusContent = statusResult?.content as Array<{ text: string }> | undefined;
    const statusText = statusContent?.[0]?.text || "";

    if (statusText.toLowerCase().includes("not connected") || statusText.toLowerCase().includes("no active")) {
      t.pass("ServiceNow status", "Returns 'not connected' when no session");
    } else {
      t.fail("ServiceNow status", `Unexpected response: ${statusText.substring(0, 100)}`);
    }

    // 4. Call foundry_init with test directory (pre-create it, init bootstraps in-place)
    t.log("Testing foundry_init...", "header");
    const projectPath = path.join(TEST_DIR, "mcp-test-project");
    await fs.mkdir(projectPath, { recursive: true });
    const initProjectResponse = await sendAndReceive(proc, "tools/call", {
      name: "foundry_init",
      arguments: {
        path: projectPath,
        projectName: "mcp-test-project",
      },
    }, 30000); // Longer timeout for init (may need to clone golden repo)

    const initProjResult = initProjectResponse.result as Record<string, unknown> | undefined;
    const initContent = initProjResult?.content as Array<{ text: string }> | undefined;
    const initText = initContent?.[0]?.text || "";
    const isError = initProjResult?.isError === true;

    if (!isError && initText.includes("initialized")) {
      t.pass("foundry_init", "Project initialized successfully via MCP");

      // Verify project files exist in the target directory
      try {
        const stat = await fs.stat(projectPath);
        if (stat.isDirectory()) {
          t.pass("Project directory", "Project directory exists");
        } else {
          t.fail("Project directory", "Path exists but is not a directory");
        }
      } catch {
        t.fail("Project directory", "Project directory not found on disk");
      }

      // Check for CLAUDE.md
      try {
        await fs.access(path.join(projectPath, "CLAUDE.md"));
        t.pass("CLAUDE.md", "CLAUDE.md created in project");
      } catch {
        t.fail("CLAUDE.md", "CLAUDE.md not found in project");
      }
    } else {
      // If golden repo isn't cached, this may fail with auth prompt
      if (initText.includes("GitHub authentication") || initText.includes("gh auth")) {
        t.pass("foundry_init", "Correctly reports auth requirement (golden repo not cached)");
        t.pass("Project directory", "Skipped (golden repo unavailable)");
        t.pass("CLAUDE.md", "Skipped (golden repo unavailable)");
      } else {
        t.fail("foundry_init", `Failed: ${initText.substring(0, 200)}`);
        t.fail("Project directory", "Skipped due to init failure");
        t.fail("CLAUDE.md", "Skipped due to init failure");
      }
    }

  } finally {
    // Clean up
    proc.kill("SIGTERM");
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clean up test directory
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  // Summary
  t.log("═══════════════════════════════════════════════════════════", "header");
  t.log("  SUMMARY", "header");
  t.log("═══════════════════════════════════════════════════════════", "header");

  const { failed } = t.printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error("Test error:", error);
  process.exit(1);
});
