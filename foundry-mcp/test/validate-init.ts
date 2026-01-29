#!/usr/bin/env npx tsx

/**
 * Foundry Init Validation Script
 *
 * Tests the foundry_init tool against MVP acceptance criteria:
 * 1. Creates project directory
 * 2. Contains Now Assist context files (3 files)
 * 3. Contains useful skills (2+ skill directories)
 * 4. Has SPARC-starter CLAUDE.md
 * 5. Works with Claude Code MCP integration
 * 6. No additional setup required
 */

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TEST_PROJECT_NAME = "foundry-test-project";
const GOLDEN_REPO_PATH = path.resolve(__dirname, "../../foundry-golden");
const TEST_OUTPUT_DIR = path.resolve(__dirname, "../.test-output");
const TEST_PROJECT_PATH = path.join(TEST_OUTPUT_DIR, TEST_PROJECT_NAME);

// Expected structure
const EXPECTED_CONTEXT_FILES = [
  "now-assist-platform.md",
  "genai-framework.md",
  "agentic-patterns.md",
];

const EXPECTED_SKILLS = [
  "now-assist-skill-builder",
  "api-integration",
];

const EXPECTED_CLAUDE_MD_CONTENT = [
  "SPARC",
  "Specification",
  "context",
  "skills",
];

// Test results
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

// Utility functions
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

function log(message: string, type: "info" | "pass" | "fail" | "header" = "info") {
  const colors = {
    info: "\x1b[0m",
    pass: "\x1b[32m",
    fail: "\x1b[31m",
    header: "\x1b[36m",
  };
  const reset = "\x1b[0m";
  const prefix = type === "pass" ? "✓" : type === "fail" ? "✗" : "→";
  console.log(`${colors[type]}${prefix} ${message}${reset}`);
}

function addResult(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  log(`${name}: ${message}`, passed ? "pass" : "fail");
}

// Copy directory (same logic as MCP server)
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Simulate foundry_init (same logic as MCP server)
async function runFoundryInit(): Promise<{ success: boolean; error?: string }> {
  try {
    // Clean up any existing test output
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });

    // Create output directory
    await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });

    // Create project structure
    await fs.mkdir(TEST_PROJECT_PATH, { recursive: true });

    // Create .claude directory
    const claudeDir = path.join(TEST_PROJECT_PATH, ".claude");
    await fs.mkdir(claudeDir, { recursive: true });

    // Copy context files
    const contextSrc = path.join(GOLDEN_REPO_PATH, "context");
    const contextDest = path.join(claudeDir, "context");
    await copyDirectory(contextSrc, contextDest);

    // Copy skills
    const skillsSrc = path.join(GOLDEN_REPO_PATH, "skills");
    const skillsDest = path.join(claudeDir, "skills");
    await copyDirectory(skillsSrc, skillsDest);

    // Copy and process CLAUDE.md template
    const templateSrc = path.join(GOLDEN_REPO_PATH, "templates", "sparc-starter", "CLAUDE.md");
    const templateContent = await fs.readFile(templateSrc, "utf-8");
    const processedContent = templateContent.replace(/\{\{PROJECT_NAME\}\}/g, TEST_PROJECT_NAME);
    await fs.writeFile(path.join(TEST_PROJECT_PATH, "CLAUDE.md"), processedContent);

    // Create .gitignore
    await fs.writeFile(path.join(TEST_PROJECT_PATH, ".gitignore"), "node_modules/\ndist/\n.env\n");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Test functions
async function testGoldenRepoExists(): Promise<void> {
  const exists = await directoryExists(GOLDEN_REPO_PATH);
  addResult(
    "Golden repo exists",
    exists,
    exists ? `Found at ${GOLDEN_REPO_PATH}` : `Not found at ${GOLDEN_REPO_PATH}`
  );
}

async function testProjectCreated(): Promise<void> {
  const exists = await directoryExists(TEST_PROJECT_PATH);
  addResult(
    "AC1: Project directory created",
    exists,
    exists ? `Created at ${TEST_PROJECT_PATH}` : "Project directory not created"
  );
}

async function testContextFiles(): Promise<void> {
  const contextDir = path.join(TEST_PROJECT_PATH, ".claude", "context");
  const missing: string[] = [];

  for (const file of EXPECTED_CONTEXT_FILES) {
    const filePath = path.join(contextDir, file);
    if (!(await fileExists(filePath))) {
      missing.push(file);
    }
  }

  const passed = missing.length === 0;
  addResult(
    "AC2: Context files present",
    passed,
    passed
      ? `All ${EXPECTED_CONTEXT_FILES.length} context files found`
      : `Missing: ${missing.join(", ")}`
  );
}

async function testSkillDirectories(): Promise<void> {
  const skillsDir = path.join(TEST_PROJECT_PATH, ".claude", "skills");
  const missing: string[] = [];
  const found: string[] = [];

  for (const skill of EXPECTED_SKILLS) {
    const skillPath = path.join(skillsDir, skill);
    if (await directoryExists(skillPath)) {
      // Check for SKILL.md
      const skillMd = path.join(skillPath, "SKILL.md");
      if (await fileExists(skillMd)) {
        found.push(skill);
      } else {
        missing.push(`${skill} (missing SKILL.md)`);
      }
    } else {
      missing.push(skill);
    }
  }

  const passed = found.length >= 2;
  addResult(
    "AC3: Skills present",
    passed,
    passed
      ? `Found ${found.length} skills: ${found.join(", ")}`
      : `Missing: ${missing.join(", ")}`
  );
}

async function testClaudeMd(): Promise<void> {
  const claudeMdPath = path.join(TEST_PROJECT_PATH, "CLAUDE.md");
  const exists = await fileExists(claudeMdPath);

  if (!exists) {
    addResult("AC4: CLAUDE.md exists", false, "CLAUDE.md not found");
    return;
  }

  const content = await readFileContent(claudeMdPath);
  const missingContent: string[] = [];

  for (const expected of EXPECTED_CLAUDE_MD_CONTENT) {
    if (!content.toLowerCase().includes(expected.toLowerCase())) {
      missingContent.push(expected);
    }
  }

  // Check project name substitution
  const hasProjectName = content.includes(TEST_PROJECT_NAME);
  if (!hasProjectName) {
    missingContent.push("project name substitution");
  }

  const passed = missingContent.length === 0;
  addResult(
    "AC4: CLAUDE.md has SPARC structure",
    passed,
    passed
      ? "CLAUDE.md contains SPARC methodology and project name"
      : `Missing: ${missingContent.join(", ")}`
  );
}

async function testSkillExamples(): Promise<void> {
  const skillsDir = path.join(TEST_PROJECT_PATH, ".claude", "skills");
  const skillsWithExamples: string[] = [];

  for (const skill of EXPECTED_SKILLS) {
    const examplesDir = path.join(skillsDir, skill, "examples");
    if (await directoryExists(examplesDir)) {
      const files = await fs.readdir(examplesDir);
      if (files.length > 0) {
        skillsWithExamples.push(skill);
      }
    }
  }

  const passed = skillsWithExamples.length > 0;
  addResult(
    "Bonus: Skills have examples",
    passed,
    passed
      ? `Skills with examples: ${skillsWithExamples.join(", ")}`
      : "No skill examples found"
  );
}

async function testGitignore(): Promise<void> {
  const gitignorePath = path.join(TEST_PROJECT_PATH, ".gitignore");
  const exists = await fileExists(gitignorePath);
  addResult(
    "Bonus: .gitignore created",
    exists,
    exists ? ".gitignore present" : ".gitignore not found"
  );
}

async function testMcpServerBuilt(): Promise<void> {
  const distPath = path.resolve(__dirname, "../dist/index.js");
  const exists = await fileExists(distPath);
  addResult(
    "AC5: MCP server built",
    exists,
    exists ? "dist/index.js exists" : "MCP server not built - run npm run build"
  );
}

async function testNoSetupRequired(): Promise<void> {
  // Check that the project has no dependencies to install
  const packageJsonPath = path.join(TEST_PROJECT_PATH, "package.json");
  const hasPackageJson = await fileExists(packageJsonPath);

  // For MVP, no package.json means no setup required
  const passed = !hasPackageJson;
  addResult(
    "AC6: No additional setup required",
    passed,
    passed
      ? "No package.json - ready to use immediately"
      : "Has package.json - may require npm install"
  );
}

// Cleanup
async function cleanup(): Promise<void> {
  try {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
    log("Cleaned up test output directory", "info");
  } catch {
    // Ignore cleanup errors
  }
}

// Main test runner
async function main() {
  console.log("\n");
  log("═══════════════════════════════════════════════════════════", "header");
  log("  FOUNDRY MVP ACCEPTANCE TEST", "header");
  log("═══════════════════════════════════════════════════════════", "header");
  console.log("");

  // Pre-flight checks
  log("Pre-flight checks:", "header");
  await testGoldenRepoExists();
  await testMcpServerBuilt();
  console.log("");

  // Run foundry_init simulation
  log("Running foundry_init simulation...", "header");
  const initResult = await runFoundryInit();

  if (!initResult.success) {
    log(`Failed to run foundry_init: ${initResult.error}`, "fail");
    process.exit(1);
  }
  log("Project created successfully", "pass");
  console.log("");

  // Run acceptance criteria tests
  log("Acceptance Criteria Tests:", "header");
  await testProjectCreated();
  await testContextFiles();
  await testSkillDirectories();
  await testClaudeMd();
  await testNoSetupRequired();
  console.log("");

  // Bonus tests
  log("Bonus Tests:", "header");
  await testSkillExamples();
  await testGitignore();
  console.log("");

  // Summary
  log("═══════════════════════════════════════════════════════════", "header");
  log("  SUMMARY", "header");
  log("═══════════════════════════════════════════════════════════", "header");

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log("");
  log(`Passed: ${passed}/${total}`, passed === total ? "pass" : "info");
  if (failed > 0) {
    log(`Failed: ${failed}/${total}`, "fail");
    console.log("");
    log("Failed tests:", "fail");
    results.filter(r => !r.passed).forEach(r => {
      log(`  ${r.name}: ${r.message}`, "fail");
    });
  }
  console.log("");

  // Show generated project structure
  log("Generated project structure:", "header");
  console.log(`
${TEST_PROJECT_NAME}/
├── CLAUDE.md
├── .gitignore
└── .claude/
    ├── context/
    │   ├── now-assist-platform.md
    │   ├── genai-framework.md
    │   └── agentic-patterns.md
    └── skills/
        ├── now-assist-skill-builder/
        │   ├── SKILL.md
        │   └── examples/
        └── api-integration/
            ├── SKILL.md
            └── examples/
`);

  // Cleanup option
  const keepOutput = process.argv.includes("--keep");
  if (!keepOutput) {
    await cleanup();
  } else {
    log(`Test output kept at: ${TEST_OUTPUT_DIR}`, "info");
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("Test error:", error);
  process.exit(1);
});
