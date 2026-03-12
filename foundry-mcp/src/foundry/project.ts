/**
 * Project initialization, resource adding, and syncing
 */

import * as fs from "fs/promises";
import * as path from "path";
import { directoryExists, fileExists, copyDirectory } from "../shared/fs-utils.js";
import { ensureGoldenRepo, parseSkillFrontmatter } from "./golden-repo.js";
import { getTemplateSettings, getValidTemplateNames } from "./templates.js";
import { markInstalled } from "./skills-state.js";
import { CONFIG } from "../shared/config.js";
import type { SyncStatus } from "./types.js";

/**
 * Process the CLAUDE.md template, replacing placeholders
 */
async function processTemplate(
  templatePath: string,
  projectName: string
): Promise<string> {
  const content = await fs.readFile(templatePath, "utf-8");
  return content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
}

/**
 * Initialize a new Foundry project
 */
export async function initializeProject(
  targetPath: string,
  projectName?: string,
  goldenPath?: string,
  template: string = "sparc-starter"
): Promise<{ success: boolean; message: string; projectPath?: string }> {
  // Derive display name from directory if not provided
  const effectiveName = projectName || path.basename(targetPath);

  // Determine paths
  const projectPath = targetPath;
  const goldenRepoPath = goldenPath || (await ensureGoldenRepo());

  // Validate template using data-driven config
  const validTemplates = await getValidTemplateNames(goldenRepoPath);
  if (!validTemplates.includes(template)) {
    return {
      success: false,
      message: `Unknown template: ${template}\n\nAvailable templates: ${validTemplates.join(", ")}\nUse foundry_templates to see details.`,
    };
  }

  const templateSettings = await getTemplateSettings(goldenRepoPath, template) || { context: true, skills: true };

  // Verify golden repo has expected structure
  const contextDir = path.join(goldenRepoPath, "context");
  const skillsDir = path.join(goldenRepoPath, "skills");
  const templateDir = path.join(goldenRepoPath, "templates", template);

  if (templateSettings.context && !(await directoryExists(contextDir))) {
    return {
      success: false,
      message: `Golden repo missing context directory: ${contextDir}`,
    };
  }

  // Initialize project structure
  try {
    // Create .claude directory (also creates projectPath if it doesn't exist)
    const claudeDir = path.join(projectPath, ".claude");
    await fs.mkdir(claudeDir, { recursive: true });

    // Copy context files (if template includes them)
    if (templateSettings.context) {
      const destContextDir = path.join(claudeDir, "context");
      await copyDirectory(contextDir, destContextDir);
    }

    // Copy skills (if template includes them)
    if (templateSettings.skills && await directoryExists(skillsDir)) {
      const destSkillsDir = path.join(claudeDir, "skills");
      await copyDirectory(skillsDir, destSkillsDir);
    }

    // Copy and process CLAUDE.md template
    const templateFile = path.join(templateDir, "CLAUDE.md");
    if (await directoryExists(templateDir)) {
      const processedTemplate = await processTemplate(templateFile, effectiveName);
      await fs.writeFile(
        path.join(projectPath, "CLAUDE.md"),
        processedTemplate
      );
    } else if (template === "foundry-minimal") {
      // Create minimal CLAUDE.md
      const minimalContent = `# ${effectiveName}

## Project Overview

Add your project description here.

## Guidelines

- Add your project-specific guidelines
- Add coding conventions
- Add any other relevant information

## Resources

Use \`foundry_add\` to add context files and skills as needed.
`;
      await fs.writeFile(path.join(projectPath, "CLAUDE.md"), minimalContent);
    }

    // Create .gitignore
    const gitignore = `# macOS
.DS_Store
.AppleDouble
.LSOverride
Icon
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent

# Python
__pycache__/
*.py[cod]
*.pyo
.venv/
venv/
env/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log
.npm
.yarn-integrity

# Build output
dist/
build/
out/
*.js.map

# Environment files
.env
.env.*
.env.local
.env.*.local
.env.development
.env.production
.env.test
*.key
*.pem

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~
*.sublime-project
*.sublime-workspace

# TypeScript
*.tsbuildinfo

# OS
Thumbs.db
ehthumbs.db
Desktop.ini

# Temporary
/tmp/
*.tmp

# Logs
logs/
*.log

# Meeting / Communication artifacts (local working files, not for repo)
**/calls/
**/emails/
**/notes/

# Office / Generated files (auto-converted, not source)
# Original source files (pptx, docx, xlsx) are committed intentionally.
# PDFs converted from those sources are ephemeral — do not commit.
/tmp/*.pdf
`;
    await fs.writeFile(path.join(projectPath, ".gitignore"), gitignore);

    // Create standardized POC engagement folder structure
    const pocDirs = [
      "00_Inbox/calls/internal",
      "00_Inbox/calls/external",
      "00_Inbox/emails",
      "00_Inbox/notes",
      "01_Customers",
      "10_PromptTemplates",
      "20_Demo_Library",
      "99_Assets/Project_Overview",
      "99_Assets/Communications",
      "99_Assets/POC_Documents",
    ];
    for (const dir of pocDirs) {
      const dirPath = path.join(projectPath, dir);
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(path.join(dirPath, ".gitkeep"), "");
    }
    // Customer placeholder README
    await fs.writeFile(
      path.join(projectPath, "01_Customers", "README.md"),
      `# Customers\n\nCreate a subdirectory for each customer engagement, e.g.:\n\n\`\`\`\n01_Customers/\n└── Acme_Corp/\n    ├── requirements.md\n    └── notes.md\n\`\`\`\n`
    );

    // Bootstrap external plugins (superpowers is default for all templates)
    const externalConfig = {
      sources: ["@approved/superpowers"],
    };
    await fs.writeFile(
      path.join(claudeDir, "foundry-external.json"),
      JSON.stringify(externalConfig, null, 2)
    );

    // Build resource list for message
    const resourceList: string[] = [];
    if (templateSettings.context) {
      resourceList.push("- Context: Now Assist platform, GenAI framework, Agentic patterns");
    }
    if (templateSettings.skills) {
      resourceList.push("- Skills: Now Assist skill builder, API integration");
    }
    resourceList.push(`- Template: ${template}`);
    resourceList.push("- External: superpowers (agentic workflow framework)");
    resourceList.push("- Folders: 00_Inbox, 01_Customers, 10_PromptTemplates, 20_Demo_Library, 99_Assets");

    // Check for uninstalled recommended global skills to suggest
    let globalSkillSuggestions = "";
    try {
      const { listSkills } = await import("./golden-repo.js");
      const { isInstalled } = await import("./skills-state.js");
      const allSkills = await listSkills(goldenRepoPath, false);
      const recommendedGlobal = allSkills.filter(s => s.scope === "global" && s.recommended);
      const uninstalled = [];
      for (const s of recommendedGlobal) {
        if (!(await isInstalled(s.name))) {
          uninstalled.push(s);
        }
      }
      if (uninstalled.length > 0) {
        globalSkillSuggestions = `\nRecommended global skills not yet installed on your machine:\n`;
        for (const s of uninstalled) {
          globalSkillSuggestions += `  ★ ${s.name}${s.description ? ` — ${s.description}` : ""}\n`;
          globalSkillSuggestions += `    foundry_add type="skill" name="${s.name}" global=true\n`;
        }
        globalSkillSuggestions += `Note: Global skills are not copied into projects — they install to ~/.claude/skills/\n`;
      }
    } catch {
      // Non-critical — skip suggestions if golden repo unavailable
    }

    return {
      success: true,
      projectPath,
      message: `Project "${effectiveName}" initialized at ${projectPath}

Template: ${template}
${resourceList.join("\n")}

Next steps:
1. Set up superpowers (recommended):
   gh repo clone obra/superpowers .superpowers
   # Then follow superpowers setup instructions
2. Review CLAUDE.md and update project details
3. Start building with Claude Code!
${!templateSettings.context || !templateSettings.skills ? `
Use foundry_add to add additional resources:
  foundry_add type="context" name="now-assist-platform"
  foundry_add type="skill" name="api-integration"` : ""}${globalSkillSuggestions}
The .claude/ directory contains pre-loaded resources that Claude Code will use automatically.
Superpowers is pre-registered in .claude/foundry-external.json for design-first agentic workflows.`,
    };
  } catch (error) {
    // Clean up on failure
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: false,
      message: `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Add a context file to a project
 */
async function addContextFile(
  goldenPath: string,
  projectPath: string,
  name: string,
  force: boolean
): Promise<{ success: boolean; message: string }> {
  // Normalize name (remove .md extension if provided)
  const baseName = name.replace(/\.md$/, "");
  const fileName = `${baseName}.md`;

  // Source path
  const sourcePath = path.join(goldenPath, "context", fileName);

  // Check if source exists
  if (!(await fileExists(sourcePath))) {
    // Try to find similar names
    const contextDir = path.join(goldenPath, "context");
    let available: string[] = [];
    try {
      const entries = await fs.readdir(contextDir);
      available = entries.filter(e => e.endsWith(".md")).map(e => e.replace(/\.md$/, ""));
    } catch {
      // Ignore
    }

    return {
      success: false,
      message: `Context file "${baseName}" not found.

Available context files:
${available.map(a => `  • ${a}`).join("\n")}

Use foundry_list type="context" to see all available context files.`,
    };
  }

  // Destination path
  const claudeDir = path.join(projectPath, ".claude");
  const destDir = path.join(claudeDir, "context");
  const destPath = path.join(destDir, fileName);

  // Check if .claude directory exists
  if (!(await directoryExists(claudeDir))) {
    return {
      success: false,
      message: `Project doesn't have a .claude/ directory at ${projectPath}

This doesn't appear to be a Foundry project. Either:
1. Use foundry_init to create a new project
2. Create the .claude/ directory manually`,
    };
  }

  // Check if already exists
  if ((await fileExists(destPath)) && !force) {
    return {
      success: false,
      message: `Context file "${baseName}" already exists in this project.

Use force=true to overwrite, or remove the existing file first.
Location: ${destPath}`,
    };
  }

  // Create context directory if needed
  await fs.mkdir(destDir, { recursive: true });

  // Copy file
  await fs.copyFile(sourcePath, destPath);

  return {
    success: true,
    message: `Added context file "${baseName}" to project.

Location: .claude/context/${fileName}

This context is now available to Claude Code automatically.`,
  };
}

/**
 * Add a skill — either project-local or global (~/.claude/skills/)
 */
async function addSkill(
  goldenPath: string,
  projectPath: string,
  name: string,
  force: boolean,
  globalInstall?: boolean
): Promise<{ success: boolean; message: string }> {
  // Source path
  const sourcePath = path.join(goldenPath, "skills", name);
  const skillFile = path.join(sourcePath, "SKILL.md");

  // Check if source exists
  if (!(await directoryExists(sourcePath)) || !(await fileExists(skillFile))) {
    // Try to find similar names
    const skillsDir = path.join(goldenPath, "skills");
    let available: string[] = [];
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const hasSkillMd = await fileExists(path.join(skillsDir, entry.name, "SKILL.md"));
          if (hasSkillMd) {
            available.push(entry.name);
          }
        }
      }
    } catch {
      // Ignore
    }

    return {
      success: false,
      message: `Skill "${name}" not found.

Available skills:
${available.map(a => `  • ${a}`).join("\n")}

Use foundry_list type="skills" to see all available skills.`,
    };
  }

  // Check frontmatter scope
  const frontmatter = await parseSkillFrontmatter(skillFile);
  const skillScope = frontmatter.scope || "project";

  // Determine if this should be a global install
  let isGlobal = globalInstall === true || skillScope === "global";

  // Warn if user didn't specify global on a global-scoped skill
  if (skillScope === "global" && globalInstall === false) {
    return {
      success: false,
      message: `Skill "${name}" is scoped for global install (scope: global).

This skill is designed for your developer machine, not a specific project.
Run: foundry_add type="skill" name="${name}" global=true

Or use force project-local install with global=false (not recommended for this skill).`,
    };
  }

  if (isGlobal) {
    // Global install: ~/.claude/skills/[name]/
    const destDir = path.join(CONFIG.skillsInstallDir, name);

    if ((await directoryExists(destDir)) && !force) {
      return {
        success: false,
        message: `Skill "${name}" is already installed globally at ${destDir}.

Use force=true to overwrite, or run foundry_sync global=true to update it.`,
      };
    }

    if (force && (await directoryExists(destDir))) {
      await fs.rm(destDir, { recursive: true, force: true });
    }

    await fs.mkdir(CONFIG.skillsInstallDir, { recursive: true });
    await copyDirectory(sourcePath, destDir);

    // Record in state
    await markInstalled(name, frontmatter.version || "1.0.0", "global");

    return {
      success: true,
      message: `Installed skill "${name}" globally.

Location: ${destDir}
Version: ${frontmatter.version || "1.0.0"}

The skill is now available to Claude Code across all projects.
You may need to restart Claude Code for it to be recognized.`,
    };
  }

  // Project-local install
  const claudeDir = path.join(projectPath, ".claude");
  const destDir = path.join(claudeDir, "skills", name);

  // Check if .claude directory exists
  if (!(await directoryExists(claudeDir))) {
    return {
      success: false,
      message: `Project doesn't have a .claude/ directory at ${projectPath}

This doesn't appear to be a Foundry project. Either:
1. Use foundry_init to create a new project
2. Create the .claude/ directory manually`,
    };
  }

  // Check if already exists
  if ((await directoryExists(destDir)) && !force) {
    return {
      success: false,
      message: `Skill "${name}" already exists in this project.

Use force=true to overwrite, or remove the existing directory first.
Location: ${destDir}`,
    };
  }

  // Remove existing if force
  if (force && (await directoryExists(destDir))) {
    await fs.rm(destDir, { recursive: true, force: true });
  }

  // Copy skill directory
  await copyDirectory(sourcePath, destDir);

  // Check if skill has examples
  const hasExamples = await directoryExists(path.join(destDir, "examples"));

  return {
    success: true,
    message: `Added skill "${name}" to project.

Location: .claude/skills/${name}/
${hasExamples ? "Includes: examples/" : ""}

This skill is now available to Claude Code automatically.
Review SKILL.md for usage instructions.`,
  };
}

/**
 * Add an agent example to a project
 */
async function addAgentExample(
  goldenPath: string,
  projectPath: string,
  name: string,
  force: boolean
): Promise<{ success: boolean; message: string }> {
  // Source path
  const sourcePath = path.join(goldenPath, "agent_examples", name);
  const agentFile = path.join(sourcePath, "AGENT.md");

  // Check if source exists (and is not _template)
  if (name === "_template") {
    return {
      success: false,
      message: `Cannot add "_template" - it's a template for creating new agent examples.

Use the template as reference for creating your own agent examples.`,
    };
  }

  if (!(await directoryExists(sourcePath)) || !(await fileExists(agentFile))) {
    // Try to find available examples
    const examplesDir = path.join(goldenPath, "agent_examples");
    let available: string[] = [];
    try {
      const entries = await fs.readdir(examplesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== "_template") {
          const hasAgentMd = await fileExists(path.join(examplesDir, entry.name, "AGENT.md"));
          if (hasAgentMd) {
            available.push(entry.name);
          }
        }
      }
    } catch {
      // Ignore
    }

    if (available.length === 0) {
      return {
        success: false,
        message: `Agent example "${name}" not found.

No agent examples are available yet.
Use the _template in agent_examples/ as a reference for creating new examples.`,
      };
    }

    return {
      success: false,
      message: `Agent example "${name}" not found.

Available agent examples:
${available.map(a => `  • ${a}`).join("\n")}

Use foundry_list type="agent_examples" to see all available examples.`,
    };
  }

  // Destination path
  const claudeDir = path.join(projectPath, ".claude");
  const destDir = path.join(claudeDir, "agent_examples", name);

  // Check if .claude directory exists
  if (!(await directoryExists(claudeDir))) {
    return {
      success: false,
      message: `Project doesn't have a .claude/ directory at ${projectPath}

This doesn't appear to be a Foundry project. Either:
1. Use foundry_init to create a new project
2. Create the .claude/ directory manually`,
    };
  }

  // Check if already exists
  if ((await directoryExists(destDir)) && !force) {
    return {
      success: false,
      message: `Agent example "${name}" already exists in this project.

Use force=true to overwrite, or remove the existing directory first.
Location: ${destDir}`,
    };
  }

  // Remove existing if force
  if (force && (await directoryExists(destDir))) {
    await fs.rm(destDir, { recursive: true, force: true });
  }

  // Copy agent example directory
  await copyDirectory(sourcePath, destDir);

  // List what was copied
  const contents: string[] = [];
  try {
    const entries = await fs.readdir(destDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        contents.push(`${entry.name}/`);
      } else {
        contents.push(entry.name);
      }
    }
  } catch {
    // Ignore
  }

  return {
    success: true,
    message: `Added agent example "${name}" to project.

Location: .claude/agent_examples/${name}/
Contents:
${contents.map(c => `  • ${c}`).join("\n")}

Review AGENT.md for implementation details and usage instructions.`,
  };
}

/**
 * Add a resource to a project
 */
export async function addResource(
  resourceType: string,
  name: string,
  projectPath: string,
  force: boolean,
  goldenPath?: string,
  globalInstall?: boolean
): Promise<{ success: boolean; message: string }> {
  if (!resourceType) {
    return {
      success: false,
      message: "Error: type is required (context or skill)",
    };
  }

  if (!name) {
    return {
      success: false,
      message: "Error: name is required",
    };
  }

  try {
    const goldenRepoPath = goldenPath || (await ensureGoldenRepo());

    switch (resourceType) {
      case "context":
        return await addContextFile(goldenRepoPath, projectPath, name, force);

      case "skill":
        return await addSkill(goldenRepoPath, projectPath, name, force, globalInstall);

      case "agent_example":
        return await addAgentExample(goldenRepoPath, projectPath, name, force);

      default:
        return {
          success: false,
          message: `Unknown resource type: ${resourceType}

Supported types:
  • context - Add a context file (.md)
  • skill - Add a skill directory
  • agent_example - Add an agent example directory`,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to add resource: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get file hash for comparison (simple content-based)
 */
async function getFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    // Simple hash: length + first 100 chars + last 100 chars
    const preview = content.length > 200
      ? content.slice(0, 100) + content.slice(-100)
      : content;
    return `${content.length}:${preview}`;
  } catch {
    return "";
  }
}

/**
 * Compare two files
 */
async function filesMatch(file1: string, file2: string): Promise<boolean> {
  const hash1 = await getFileHash(file1);
  const hash2 = await getFileHash(file2);
  return hash1 === hash2 && hash1 !== "";
}

/**
 * Sync context files
 */
async function syncContextFiles(
  goldenPath: string,
  projectPath: string,
  dryRun: boolean
): Promise<SyncStatus[]> {
  const results: SyncStatus[] = [];
  const goldenContextDir = path.join(goldenPath, "context");
  const projectContextDir = path.join(projectPath, ".claude", "context");

  // Check if project context dir exists
  const projectHasContext = await directoryExists(projectContextDir);

  try {
    const entries = await fs.readdir(goldenContextDir);

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;

      const name = entry.replace(/\.md$/, "");
      const goldenFile = path.join(goldenContextDir, entry);
      const projectFile = path.join(projectContextDir, entry);

      // Check if file exists in project
      if (!projectHasContext || !(await fileExists(projectFile))) {
        results.push({
          name,
          type: "context",
          status: "new",
          message: "Not in project",
        });
        continue;
      }

      // Compare files
      const match = await filesMatch(goldenFile, projectFile);

      if (match) {
        results.push({
          name,
          type: "context",
          status: "unchanged",
        });
      } else {
        // Files differ - update if not dry run
        if (!dryRun) {
          try {
            await fs.copyFile(goldenFile, projectFile);
            results.push({
              name,
              type: "context",
              status: "updated",
              message: "Updated to latest",
            });
          } catch (error) {
            results.push({
              name,
              type: "context",
              status: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          results.push({
            name,
            type: "context",
            status: "updated",
            message: "Would update (dry run)",
          });
        }
      }
    }
  } catch {
    // Context directory doesn't exist in golden repo
  }

  return results;
}

/**
 * Sync skills
 */
async function syncSkills(
  goldenPath: string,
  projectPath: string,
  dryRun: boolean
): Promise<SyncStatus[]> {
  const results: SyncStatus[] = [];
  const goldenSkillsDir = path.join(goldenPath, "skills");
  const projectSkillsDir = path.join(projectPath, ".claude", "skills");

  // Check if project skills dir exists
  const projectHasSkills = await directoryExists(projectSkillsDir);

  try {
    const entries = await fs.readdir(goldenSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const name = entry.name;
      const goldenSkillDir = path.join(goldenSkillsDir, name);
      const goldenSkillMd = path.join(goldenSkillDir, "SKILL.md");
      const projectSkillDir = path.join(projectSkillsDir, name);
      const projectSkillMd = path.join(projectSkillDir, "SKILL.md");

      // Check if skill has SKILL.md in golden
      if (!(await fileExists(goldenSkillMd))) continue;

      // Check if skill exists in project
      if (!projectHasSkills || !(await directoryExists(projectSkillDir))) {
        results.push({
          name,
          type: "skill",
          status: "new",
          message: "Not in project",
        });
        continue;
      }

      // Compare SKILL.md files
      const match = await filesMatch(goldenSkillMd, projectSkillMd);

      if (match) {
        results.push({
          name,
          type: "skill",
          status: "unchanged",
        });
      } else {
        // Files differ - update if not dry run
        if (!dryRun) {
          try {
            // Remove old skill directory and copy fresh
            await fs.rm(projectSkillDir, { recursive: true, force: true });
            await copyDirectory(goldenSkillDir, projectSkillDir);
            results.push({
              name,
              type: "skill",
              status: "updated",
              message: "Updated to latest",
            });
          } catch (error) {
            results.push({
              name,
              type: "skill",
              status: "error",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          results.push({
            name,
            type: "skill",
            status: "updated",
            message: "Would update (dry run)",
          });
        }
      }
    }
  } catch {
    // Skills directory doesn't exist in golden repo
  }

  return results;
}

/**
 * Sync globally installed skills by git pulling each one
 */
export async function syncGlobalSkills(
  dryRun: boolean
): Promise<{ success: boolean; message: string }> {
  const { getInstalledSkills } = await import("./skills-state.js");
  const { safeExec } = await import("../shared/exec-utils.js");
  const installed = await getInstalledSkills();
  const globalSkills = installed.filter(s => s.scope === "global");

  if (globalSkills.length === 0) {
    return {
      success: true,
      message: `No globally installed skills found.

Install skills with: foundry_add type="skill" name="<skill-name>" global=true`,
    };
  }

  const results: Array<{ name: string; status: string; message?: string }> = [];

  for (const skill of globalSkills) {
    const skillDir = path.join(CONFIG.skillsInstallDir, skill.name);
    const skillExists = await directoryExists(skillDir);

    if (!skillExists) {
      results.push({ name: skill.name, status: "missing", message: "Directory not found" });
      continue;
    }

    if (dryRun) {
      results.push({ name: skill.name, status: "would-update" });
      continue;
    }

    try {
      await safeExec("git", ["pull", "--ff-only"], { cwd: skillDir });
      results.push({ name: skill.name, status: "updated" });
    } catch (err) {
      results.push({
        name: skill.name,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const modeLabel = dryRun ? " (DRY RUN)" : "";
  let output = `Global Skill Sync${modeLabel}\n${"═".repeat(60)}\n\n`;

  for (const r of results) {
    const icon = r.status === "updated" ? "✓" : r.status === "error" ? "✗" : r.status === "missing" ? "!" : "~";
    output += `${icon} ${r.name}`;
    if (r.message) output += ` — ${r.message}`;
    output += "\n";
  }

  const updated = results.filter(r => r.status === "updated").length;
  const errors = results.filter(r => r.status === "error").length;
  output += `\n${updated}/${globalSkills.length} updated`;
  if (errors > 0) output += `, ${errors} errors`;

  if (dryRun) output += "\n\nRun with dryRun=false to apply updates.";

  return { success: errors === 0, message: output };
}

/**
 * Sync all resources
 */
export async function syncResources(
  projectPath: string,
  dryRun: boolean,
  resourceType: string,
  goldenPath?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Force refresh cache when syncing to get latest from GitHub
    const goldenRepoPath = goldenPath || (await ensureGoldenRepo(true));
    const claudeDir = path.join(projectPath, ".claude");

    // Check if project has .claude directory
    if (!(await directoryExists(claudeDir))) {
      return {
        success: false,
        message: `Project doesn't have a .claude/ directory at ${projectPath}

This doesn't appear to be a Foundry project. Use foundry_init to create one.`,
      };
    }

    const type = resourceType || "all";
    const allResults: SyncStatus[] = [];

    // Sync context files
    if (type === "all" || type === "context") {
      const contextResults = await syncContextFiles(goldenRepoPath, projectPath, dryRun);
      allResults.push(...contextResults);
    }

    // Sync skills
    if (type === "all" || type === "skills") {
      const skillResults = await syncSkills(goldenRepoPath, projectPath, dryRun);
      allResults.push(...skillResults);
    }

    // Group results by status
    const updated = allResults.filter(r => r.status === "updated");
    const newRes = allResults.filter(r => r.status === "new");
    const unchanged = allResults.filter(r => r.status === "unchanged");
    const errors = allResults.filter(r => r.status === "error");

    // Format output
    const modeLabel = dryRun ? " (DRY RUN)" : "";
    let output = `Foundry Sync${modeLabel}\n${"═".repeat(60)}\n`;
    output += `Project: ${projectPath}\n`;
    output += `Type: ${type}\n\n`;

    if (updated.length > 0) {
      output += `${"─".repeat(40)}\n`;
      output += `📥 UPDATED (${updated.length})\n`;
      output += `${"─".repeat(40)}\n`;
      for (const r of updated) {
        output += `  ${r.type === "context" ? "📄" : "🛠️"} ${r.name}`;
        if (r.message) output += ` - ${r.message}`;
        output += "\n";
      }
      output += "\n";
    }

    if (newRes.length > 0) {
      output += `${"─".repeat(40)}\n`;
      output += `✨ NEW AVAILABLE (${newRes.length})\n`;
      output += `${"─".repeat(40)}\n`;
      for (const r of newRes) {
        output += `  ${r.type === "context" ? "📄" : "🛠️"} ${r.name}`;
        output += ` - use foundry_add to install\n`;
      }
      output += "\n";
    }

    if (unchanged.length > 0) {
      output += `${"─".repeat(40)}\n`;
      output += `✓ UP TO DATE (${unchanged.length})\n`;
      output += `${"─".repeat(40)}\n`;
      for (const r of unchanged) {
        output += `  ${r.type === "context" ? "📄" : "🛠️"} ${r.name}\n`;
      }
      output += "\n";
    }

    if (errors.length > 0) {
      output += `${"─".repeat(40)}\n`;
      output += `❌ ERRORS (${errors.length})\n`;
      output += `${"─".repeat(40)}\n`;
      for (const r of errors) {
        output += `  ${r.name}: ${r.message}\n`;
      }
      output += "\n";
    }

    // Summary
    output += `${"─".repeat(40)}\n`;
    output += `Summary: ${updated.length} updated, ${newRes.length} new available, ${unchanged.length} unchanged`;
    if (errors.length > 0) output += `, ${errors.length} errors`;
    output += "\n";

    if (dryRun && updated.length > 0) {
      output += `\nRun with dryRun=false to apply updates.`;
    }

    return { success: errors.length === 0, message: output };
  } catch (error) {
    return {
      success: false,
      message: `Failed to sync resources: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
