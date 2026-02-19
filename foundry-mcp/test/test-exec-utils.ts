#!/usr/bin/env npx tsx

/**
 * Tests for exec-utils: safeExec and validateResourceName
 */

import { safeExec, validateResourceName } from "../src/shared/exec-utils.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { TestRunner } from "./utils/test-runner.js";

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
  t.log("  EXEC-UTILS VALIDATION TEST", "header");
  t.log("═══════════════════════════════════════════════════════════", "header");

  // ── safeExec tests ─────────────────────────────────────────
  section("safeExec: Basic execution");

  try {
    const result = await safeExec("echo", ["hello", "world"]);
    if (result.stdout.trim() === "hello world") {
      pass("safeExec runs echo with arguments");
    } else {
      fail(`Expected 'hello world', got '${result.stdout.trim()}'`);
    }
  } catch (error) {
    fail("safeExec failed on basic echo", error);
  }

  section("safeExec: Shell metacharacters are NOT interpreted");

  try {
    // If shell injection worked, this would run 'echo injected' as a separate command
    const result = await safeExec("echo", ['hello; echo injected']);
    if (result.stdout.includes("injected") && result.stdout.includes(";")) {
      // The semicolon is treated as literal text, not a command separator
      pass("Shell metacharacters treated as literal text");
    } else if (!result.stdout.includes("injected")) {
      // echo didn't produce "injected" as a separate command
      pass("Shell metacharacters treated as literal text");
    } else {
      fail("Shell metacharacters may have been interpreted");
    }
  } catch {
    // Some systems may error on this - that's also safe
    pass("Shell metacharacters not interpreted (command failed safely)");
  }

  try {
    const result = await safeExec("echo", ['$(whoami)']);
    if (result.stdout.trim() === "$(whoami)") {
      pass("Command substitution treated as literal text");
    } else {
      fail(`Possible command injection: got '${result.stdout.trim()}'`);
    }
  } catch {
    pass("Command substitution not interpreted (command failed safely)");
  }

  try {
    const result = await safeExec("echo", ['`whoami`']);
    if (result.stdout.trim() === "`whoami`") {
      pass("Backtick substitution treated as literal text");
    } else {
      fail(`Possible command injection: got '${result.stdout.trim()}'`);
    }
  } catch {
    pass("Backtick substitution not interpreted (command failed safely)");
  }

  section("safeExec: Non-zero exit code rejects");

  try {
    await safeExec("false", []);
    fail("Should have rejected for non-zero exit code");
  } catch (error) {
    if (error instanceof Error && error.message.includes("Command failed")) {
      pass("Non-zero exit code rejects with error");
    } else {
      fail("Unexpected error type", error);
    }
  }

  section("safeExec: cwd option works");

  try {
    const tmpDir = os.tmpdir();
    const result = await safeExec("pwd", [], { cwd: tmpDir });
    // Resolve both to handle symlinks (e.g., /tmp -> /private/tmp on macOS)
    const actual = await fs.realpath(result.stdout.trim());
    const expected = await fs.realpath(tmpDir);
    if (actual === expected) {
      pass("cwd option changes working directory");
    } else {
      fail(`Expected cwd ${expected}, got ${actual}`);
    }
  } catch (error) {
    fail("cwd option test failed", error);
  }

  // ── validateResourceName tests ─────────────────────────────
  section("validateResourceName: Valid names");

  const validNames = ["my-resource", "test_skill", "abc123", "A-B_C", "a"];
  for (const name of validNames) {
    const result = validateResourceName(name);
    if (result === null) {
      pass(`"${name}" is valid`);
    } else {
      fail(`"${name}" should be valid, got: ${result}`);
    }
  }

  section("validateResourceName: Invalid names");

  const invalidCases: Array<{ input: string; desc: string }> = [
    { input: "", desc: "empty string" },
    { input: "has spaces", desc: "contains spaces" },
    { input: "has/slash", desc: "contains slash" },
    { input: 'has"quote', desc: "contains double quote" },
    { input: "has;semicolon", desc: "contains semicolon" },
    { input: "has$(cmd)", desc: "contains command substitution" },
    { input: "has`tick`", desc: "contains backtick" },
    { input: "has..dots", desc: "contains dots" },
    { input: "../traversal", desc: "path traversal" },
  ];

  for (const { input, desc } of invalidCases) {
    const result = validateResourceName(input);
    if (result !== null) {
      pass(`"${input}" (${desc}) rejected: ${result}`);
    } else {
      fail(`"${input}" (${desc}) should be rejected`);
    }
  }

  section("validateResourceName: Length limit");

  const longName = "a".repeat(101);
  const longResult = validateResourceName(longName);
  if (longResult !== null) {
    pass("101-char name rejected");
  } else {
    fail("101-char name should be rejected");
  }

  const maxName = "a".repeat(100);
  const maxResult = validateResourceName(maxName);
  if (maxResult === null) {
    pass("100-char name accepted");
  } else {
    fail("100-char name should be accepted");
  }

  // ── Summary ────────────────────────────────────────────────
  t.log("═══════════════════════════════════════════════════════════", "header");
  t.log("  SUMMARY", "header");
  t.log("═══════════════════════════════════════════════════════════", "header");

  const { failed: failCount } = t.printSummary();

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test error:", error);
  process.exit(1);
});
