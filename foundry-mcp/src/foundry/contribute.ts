/**
 * Resource creation, validation, and promotion
 */

import * as fs from "fs/promises";
import * as path from "path";
import { CONFIG } from "../shared/config.js";
import { safeExec, validateResourceName } from "../shared/exec-utils.js";
import { directoryExists, fileExists, copyDirectory } from "../shared/fs-utils.js";
import { ensureGoldenRepo } from "./golden-repo.js";
import type { ValidationResult } from "./types.js";

// ── Templates for new resources ────────────────────────────────

function getContextTemplate(name: string, description: string): string {
  const title = name
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return `# ${title}

${description || "Add a description of what this context provides."}

---

## Overview

Provide an overview of the domain knowledge covered by this context file.

## Key Concepts

### Concept 1

Explain the first key concept.

### Concept 2

Explain the second key concept.

## Common Patterns

Describe common patterns and best practices.

## Examples

\`\`\`javascript
// Add code examples here
\`\`\`

## Related Resources

- Link to related documentation
- Link to other context files

---

*Created with Foundry*
`;
}

function getSkillTemplate(name: string, description: string): string {
  const title = name
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return `# ${title}

${description || "Add a description of what this skill teaches Claude to do."}

---

## Purpose

Explain the purpose of this skill and when Claude should use it.

## Instructions

### Step 1: Understand the Task

Describe how to analyze and understand the task.

### Step 2: Gather Information

Describe what information to gather.

### Step 3: Execute

Describe how to execute the task.

## Best Practices

- Best practice 1
- Best practice 2
- Best practice 3

## Common Mistakes to Avoid

- Mistake 1
- Mistake 2

## Examples

See the \`examples/\` directory for practical examples.

---

*Created with Foundry*
`;
}

function getSkillExampleTemplate(skillName: string): string {
  return `# Example: Basic Usage

This example demonstrates basic usage of the ${skillName} skill.

## Scenario

Describe the scenario for this example.

## Input

\`\`\`
User request or input here
\`\`\`

## Expected Output

\`\`\`
Expected response or output here
\`\`\`

## Notes

- Add any relevant notes
- Explain key decisions
`;
}

// ── Create new resource ─────────────────────────────────────────

export async function createNewResource(
  resourceType: string,
  name: string,
  description: string,
  projectPath: string
): Promise<{ success: boolean; message: string }> {
  // Validate inputs
  if (!resourceType) {
    return { success: false, message: "Error: type is required (context or skill)" };
  }

  if (!name) {
    return { success: false, message: "Error: name is required" };
  }

  // Validate name format
  if (!/^[a-z0-9-]+$/.test(name)) {
    return {
      success: false,
      message: "Error: name must be lowercase with hyphens only (e.g., 'my-resource')",
    };
  }

  const claudeDir = path.join(projectPath, ".claude");

  // Check if project has .claude directory
  if (!(await directoryExists(claudeDir))) {
    return {
      success: false,
      message: `Project doesn't have a .claude/ directory at ${projectPath}

This doesn't appear to be a Foundry project. Either:
1. Use foundry_init to create a new project
2. Create the .claude/ directory manually`,
    };
  }

  try {
    if (resourceType === "context") {
      const contextDir = path.join(claudeDir, "context");
      const filePath = path.join(contextDir, `${name}.md`);

      // Check if already exists
      if (await fileExists(filePath)) {
        return {
          success: false,
          message: `Context file "${name}" already exists at ${filePath}`,
        };
      }

      // Create directory and file
      await fs.mkdir(contextDir, { recursive: true });
      await fs.writeFile(filePath, getContextTemplate(name, description));

      return {
        success: true,
        message: `Created new context file: ${name}

Location: .claude/context/${name}.md

Next steps:
1. Edit the file to add your domain knowledge
2. Run foundry_validate type="context" name="${name}" to check
3. Run foundry_promote type="context" name="${name}" to contribute`,
      };
    }

    if (resourceType === "skill") {
      const skillsDir = path.join(claudeDir, "skills");
      const skillDir = path.join(skillsDir, name);
      const skillFile = path.join(skillDir, "SKILL.md");
      const examplesDir = path.join(skillDir, "examples");
      const exampleFile = path.join(examplesDir, "basic-usage.md");

      // Check if already exists
      if (await directoryExists(skillDir)) {
        return {
          success: false,
          message: `Skill "${name}" already exists at ${skillDir}`,
        };
      }

      // Create directories and files
      await fs.mkdir(examplesDir, { recursive: true });
      await fs.writeFile(skillFile, getSkillTemplate(name, description));
      await fs.writeFile(exampleFile, getSkillExampleTemplate(name));

      return {
        success: true,
        message: `Created new skill: ${name}

Location: .claude/skills/${name}/
├── SKILL.md
└── examples/
    └── basic-usage.md

Next steps:
1. Edit SKILL.md to add instructions
2. Add more examples in examples/
3. Run foundry_validate type="skill" name="${name}" to check
4. Run foundry_promote type="skill" name="${name}" to contribute`,
      };
    }

    return {
      success: false,
      message: `Unknown resource type: ${resourceType}. Use 'context' or 'skill'.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create resource: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ── Validation ──────────────────────────────────────────────────

async function validateContextFile(
  filePath: string,
  _name: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!(await fileExists(filePath))) {
    return { valid: false, errors: [`Context file not found: ${filePath}`], warnings: [] };
  }

  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");

  // Check for title
  const hasTitle = content.match(/^#\s+.+$/m);
  if (!hasTitle) {
    errors.push("Missing title (# Title)");
  }

  // Check minimum content length
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 50) {
    errors.push(`Content too short (${wordCount} words, minimum 50)`);
  } else if (wordCount < 100) {
    warnings.push(`Content is brief (${wordCount} words, consider expanding)`);
  }

  // Check for placeholder text
  const placeholders = [
    "Add a description",
    "Add code examples here",
    "Explain the",
    "Describe",
    "TODO",
    "FIXME",
  ];
  for (const placeholder of placeholders) {
    if (content.includes(placeholder)) {
      warnings.push(`Contains placeholder text: "${placeholder}"`);
    }
  }

  // Check for sections
  const sectionCount = (content.match(/^##\s+/gm) || []).length;
  if (sectionCount < 2) {
    warnings.push("Consider adding more sections (## Section)");
  }

  // Check for empty lines at start/end
  if (lines[0].trim() === "") {
    warnings.push("File starts with empty line");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

async function validateSkill(
  skillDir: string,
  _name: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check directory exists
  if (!(await directoryExists(skillDir))) {
    return { valid: false, errors: [`Skill directory not found: ${skillDir}`], warnings: [] };
  }

  // Check SKILL.md exists
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!(await fileExists(skillFile))) {
    errors.push("Missing SKILL.md file");
  } else {
    const content = await fs.readFile(skillFile, "utf-8");

    // Check for title
    const hasTitle = content.match(/^#\s+.+$/m);
    if (!hasTitle) {
      errors.push("SKILL.md missing title (# Title)");
    }

    // Check minimum content length
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 50) {
      errors.push(`SKILL.md too short (${wordCount} words, minimum 50)`);
    } else if (wordCount < 100) {
      warnings.push(`SKILL.md is brief (${wordCount} words, consider expanding)`);
    }

    // Check for placeholder text
    const placeholders = [
      "Add a description",
      "Describe how",
      "Explain",
      "TODO",
      "FIXME",
    ];
    for (const placeholder of placeholders) {
      if (content.includes(placeholder)) {
        warnings.push(`SKILL.md contains placeholder: "${placeholder}"`);
      }
    }

    // Check for key sections
    const hasInstructions = content.toLowerCase().includes("## instructions") ||
                             content.toLowerCase().includes("## steps");
    if (!hasInstructions) {
      warnings.push("Consider adding ## Instructions section");
    }
  }

  // Check for examples directory
  const examplesDir = path.join(skillDir, "examples");
  if (!(await directoryExists(examplesDir))) {
    warnings.push("No examples/ directory");
  } else {
    // Check for at least one example
    try {
      const examples = await fs.readdir(examplesDir);
      const mdFiles = examples.filter(e => e.endsWith(".md"));
      if (mdFiles.length === 0) {
        warnings.push("No example files in examples/");
      }
    } catch {
      warnings.push("Could not read examples/ directory");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function validateResource(
  resourceType: string,
  name: string,
  projectPath: string
): Promise<{ success: boolean; message: string }> {
  if (!resourceType) {
    return { success: false, message: "Error: type is required (context or skill)" };
  }

  if (!name) {
    return { success: false, message: "Error: name is required" };
  }

  const claudeDir = path.join(projectPath, ".claude");

  // Check if project has .claude directory
  if (!(await directoryExists(claudeDir))) {
    return {
      success: false,
      message: `Project doesn't have a .claude/ directory at ${projectPath}`,
    };
  }

  let result: ValidationResult;

  if (resourceType === "context") {
    const filePath = path.join(claudeDir, "context", `${name}.md`);
    result = await validateContextFile(filePath, name);
  } else if (resourceType === "skill") {
    const skillDir = path.join(claudeDir, "skills", name);
    result = await validateSkill(skillDir, name);
  } else {
    return {
      success: false,
      message: `Unknown resource type: ${resourceType}. Use 'context' or 'skill'.`,
    };
  }

  // Format output
  let output = `Validation: ${name} (${resourceType})\n${"═".repeat(60)}\n\n`;

  if (result.valid) {
    output += `✓ VALID - Resource passes all required checks\n\n`;
  } else {
    output += `✗ INVALID - Resource has errors that must be fixed\n\n`;
  }

  if (result.errors.length > 0) {
    output += `${"─".repeat(40)}\n`;
    output += `ERRORS (${result.errors.length})\n`;
    output += `${"─".repeat(40)}\n`;
    for (const error of result.errors) {
      output += `  ✗ ${error}\n`;
    }
    output += "\n";
  }

  if (result.warnings.length > 0) {
    output += `${"─".repeat(40)}\n`;
    output += `WARNINGS (${result.warnings.length})\n`;
    output += `${"─".repeat(40)}\n`;
    for (const warning of result.warnings) {
      output += `  ⚠ ${warning}\n`;
    }
    output += "\n";
  }

  if (result.valid && result.warnings.length === 0) {
    output += `${"─".repeat(40)}\n`;
    output += `No issues found. Ready for promotion!\n`;
    output += `\n→ foundry_promote type="${resourceType}" name="${name}"`;
  } else if (result.valid) {
    output += `${"─".repeat(40)}\n`;
    output += `Resource is valid but has warnings. Consider addressing them.\n`;
    output += `\n→ foundry_promote type="${resourceType}" name="${name}"`;
  } else {
    output += `${"─".repeat(40)}\n`;
    output += `Fix the errors above before promoting.`;
  }

  return { success: result.valid, message: output };
}

// ── Promotion ───────────────────────────────────────────────────

export async function promoteResource(
  resourceType: string,
  name: string,
  message: string,
  projectPath: string
): Promise<{ success: boolean; message: string }> {
  if (!resourceType) {
    return { success: false, message: "Error: type is required (context or skill)" };
  }

  if (!name) {
    return { success: false, message: "Error: name is required" };
  }

  // Validate resource name to prevent injection
  const nameError = validateResourceName(name);
  if (nameError) {
    return { success: false, message: `Invalid resource name: ${nameError}` };
  }

  const claudeDir = path.join(projectPath, ".claude");

  // Check if project has .claude directory
  if (!(await directoryExists(claudeDir))) {
    return {
      success: false,
      message: `Project doesn't have a .claude/ directory at ${projectPath}`,
    };
  }

  // First, validate the resource
  let validationResult: ValidationResult;
  let sourcePath: string;
  let destPath: string;

  if (resourceType === "context") {
    sourcePath = path.join(claudeDir, "context", `${name}.md`);
    destPath = `context/${name}.md`;
    validationResult = await validateContextFile(sourcePath, name);
  } else if (resourceType === "skill") {
    sourcePath = path.join(claudeDir, "skills", name);
    destPath = `skills/${name}`;
    validationResult = await validateSkill(sourcePath, name);
  } else {
    return {
      success: false,
      message: `Unknown resource type: ${resourceType}. Use 'context' or 'skill'.`,
    };
  }

  if (!validationResult.valid) {
    let output = `Cannot promote - validation failed:\n\n`;
    for (const error of validationResult.errors) {
      output += `  ✗ ${error}\n`;
    }
    output += `\nRun foundry_validate first to see all issues.`;
    return { success: false, message: output };
  }

  // Check gh CLI is available
  try {
    await safeExec("gh", ["--version"]);
  } catch {
    return {
      success: false,
      message: `GitHub CLI (gh) not found or not authenticated.

Install: https://cli.github.com/
Then run: gh auth login`,
    };
  }

  // Generate branch name
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const branchName = `foundry/${resourceType}/${name}-${timestamp}`;
  const prTitle = `Add ${resourceType}: ${name}`;
  const prBody = message || `Adds new ${resourceType}: ${name}\n\nCreated with foundry_promote.`;

  try {
    // Ensure golden repo is cloned
    const goldenPath = await ensureGoldenRepo();

    // Create and checkout new branch
    await safeExec("git", ["checkout", "-b", branchName], { cwd: goldenPath });

    // Copy resource files
    if (resourceType === "context") {
      const destFilePath = path.join(goldenPath, destPath);
      await fs.mkdir(path.dirname(destFilePath), { recursive: true });
      await fs.copyFile(sourcePath, destFilePath);
    } else {
      const destDirPath = path.join(goldenPath, destPath);
      await fs.rm(destDirPath, { recursive: true, force: true });
      await copyDirectory(sourcePath, destDirPath);
    }

    // Stage changes
    await safeExec("git", ["add", destPath], { cwd: goldenPath });

    // Commit
    const commitMsg = `Add ${resourceType}: ${name}`;
    await safeExec("git", ["commit", "-m", commitMsg], { cwd: goldenPath });

    // Push branch
    await safeExec("git", ["push", "-u", "origin", branchName], { cwd: goldenPath });

    // Create PR
    const { stdout: prUrl } = await safeExec(
      "gh",
      ["pr", "create", "--title", prTitle, "--body", prBody],
      { cwd: goldenPath }
    );

    // Switch back to main branch
    await safeExec("git", ["checkout", CONFIG.goldenBranch], { cwd: goldenPath });

    return {
      success: true,
      message: `Resource promoted successfully!

${"═".repeat(60)}
Branch: ${branchName}
PR: ${prUrl.trim()}
${"═".repeat(60)}

The PR is now ready for team review.
Once approved and merged, the resource will be available to all team members.`,
    };
  } catch (error) {
    // Try to recover - switch back to main
    try {
      const goldenPath = CONFIG.cacheDir;
      await safeExec("git", ["checkout", CONFIG.goldenBranch], { cwd: goldenPath });
    } catch {
      // Ignore recovery errors
    }

    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check for common errors
    if (errorMsg.includes("already exists")) {
      return {
        success: false,
        message: `Branch "${branchName}" already exists. The resource may have been promoted before.

Check existing PRs: gh pr list --repo ${CONFIG.goldenRepo}`,
      };
    }

    if (errorMsg.includes("Authentication")) {
      return {
        success: false,
        message: `GitHub authentication failed. Run: gh auth login`,
      };
    }

    return {
      success: false,
      message: `Promotion failed: ${errorMsg}`,
    };
  }
}
