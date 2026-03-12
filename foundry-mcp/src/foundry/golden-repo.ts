/**
 * Golden repository cache management
 */

import * as fs from "fs/promises";
import * as path from "path";
import { CONFIG } from "../shared/config.js";
import { safeExec } from "../shared/exec-utils.js";
import { directoryExists, fileExists, extractDescription } from "../shared/fs-utils.js";
import type { ResourceInfo } from "./types.js";

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  scope?: "global" | "project";
  recommended?: boolean;
  version?: string;
  triggers?: string[];
  tags?: string[];
}

/**
 * Parse YAML frontmatter from a SKILL.md file
 */
export async function parseSkillFrontmatter(skillFilePath: string): Promise<SkillFrontmatter> {
  try {
    const content = await fs.readFile(skillFilePath, "utf-8");
    if (!content.startsWith("---")) return {};

    const endIndex = content.indexOf("---", 3);
    if (endIndex === -1) return {};

    const yamlBlock = content.slice(3, endIndex).trim();
    const result: SkillFrontmatter = {};

    for (const line of yamlBlock.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();

      if (!key || rawVal === "") continue;

      // Handle multi-line arrays (YAML list items starting with -)
      // We accumulate them below in a second pass
      if (key === "name") result.name = rawVal.replace(/^["']|["']$/g, "");
      else if (key === "description") result.description = rawVal.replace(/^["'>]/, "").trim();
      else if (key === "scope") result.scope = rawVal as "global" | "project";
      else if (key === "recommended") result.recommended = rawVal === "true";
      else if (key === "version") result.version = rawVal;
    }

    // Parse array fields (triggers, tags) — items appear as "  - value" lines
    const lines = yamlBlock.split("\n");
    let inTriggers = false;
    let inTags = false;
    const triggers: string[] = [];
    const tags: string[] = [];

    for (const line of lines) {
      if (/^triggers\s*:/.test(line)) { inTriggers = true; inTags = false; continue; }
      if (/^tags\s*:/.test(line)) { inTags = true; inTriggers = false; continue; }
      if (/^\w/.test(line) && line.includes(":")) { inTriggers = false; inTags = false; continue; }
      if (line.trim().startsWith("- ")) {
        const val = line.trim().slice(2).trim();
        if (inTriggers) triggers.push(val);
        if (inTags) tags.push(val);
      }
    }

    if (triggers.length > 0) result.triggers = triggers;
    if (tags.length > 0) result.tags = tags;

    return result;
  } catch {
    return {};
  }
}

/**
 * Check if cache is stale
 */
async function isCacheStale(): Promise<boolean> {
  const markerFile = path.join(CONFIG.cacheDir, ".cache-timestamp");
  try {
    const stat = await fs.stat(markerFile);
    const ageMs = Date.now() - stat.mtime.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours > CONFIG.cacheMaxAgeHours;
  } catch {
    return true; // No marker = stale
  }
}

/**
 * Update cache timestamp
 */
async function updateCacheTimestamp(): Promise<void> {
  const markerFile = path.join(CONFIG.cacheDir, ".cache-timestamp");
  await fs.writeFile(markerFile, new Date().toISOString());
}

/**
 * Clone or update the golden repository
 * Uses GitHub CLI (gh) for authentication with private repos
 */
export async function ensureGoldenRepo(forceRefresh: boolean = false): Promise<string> {
  const exists = await directoryExists(CONFIG.cacheDir);

  if (exists) {
    // Check if we should update (force refresh or stale cache)
    if (forceRefresh || (await isCacheStale())) {
      try {
        await safeExec("git", ["pull", "--ff-only"], { cwd: CONFIG.cacheDir });
        await updateCacheTimestamp();
      } catch {
        // Pull failed, but we still have a cached version - continue
        console.error(
          "Warning: Could not update golden repo cache, using existing version"
        );
      }
    }
  } else {
    // Clone fresh using gh CLI (handles auth for private repos)
    await fs.mkdir(path.dirname(CONFIG.cacheDir), { recursive: true });
    try {
      // Use gh repo clone which handles authentication automatically
      await safeExec("gh", ["repo", "clone", CONFIG.goldenRepo, CONFIG.cacheDir]);
      await updateCacheTimestamp();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Provide helpful error message for auth issues
      if (errorMsg.includes("gh auth") || errorMsg.includes("not logged")) {
        throw new Error(
          `GitHub authentication required. Run 'gh auth login' first, then try again.`
        );
      }
      throw new Error(`Failed to clone golden repository: ${errorMsg}`);
    }
  }

  return CONFIG.cacheDir;
}

/**
 * List context files
 */
export async function listContextFiles(
  goldenPath: string,
  verbose: boolean
): Promise<ResourceInfo[]> {
  const contextDir = path.join(goldenPath, "context");
  const resources: ResourceInfo[] = [];

  try {
    const entries = await fs.readdir(contextDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const name = entry.name.replace(/\.md$/, "");
        const filePath = path.join(contextDir, entry.name);

        const resource: ResourceInfo = {
          name,
          type: "context",
          path: `context/${entry.name}`,
        };

        if (verbose) {
          resource.description = await extractDescription(filePath);
        }

        resources.push(resource);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return resources;
}

/**
 * List skills
 */
export async function listSkills(
  goldenPath: string,
  verbose: boolean
): Promise<ResourceInfo[]> {
  const skillsDir = path.join(goldenPath, "skills");
  const resources: ResourceInfo[] = [];

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(skillsDir, entry.name);
        const skillFile = path.join(skillPath, "SKILL.md");

        // Check if SKILL.md exists
        try {
          await fs.stat(skillFile);

          const resource: ResourceInfo = {
            name: entry.name,
            type: "skill",
            path: `skills/${entry.name}`,
          };

          // Check for examples
          const examplesDir = path.join(skillPath, "examples");
          try {
            await fs.stat(examplesDir);
            resource.hasExamples = true;
          } catch {
            resource.hasExamples = false;
          }

          // Parse frontmatter for scope/recommended/tags
          const frontmatter = await parseSkillFrontmatter(skillFile);
          resource.scope = frontmatter.scope || "project";
          resource.recommended = frontmatter.recommended ?? false;
          resource.tags = frontmatter.tags;

          if (verbose) {
            resource.description = frontmatter.description || await extractDescription(skillFile);
          }

          resources.push(resource);
        } catch {
          // No SKILL.md, skip
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return resources;
}

/**
 * List templates
 */
export async function listTemplates(
  goldenPath: string,
  verbose: boolean
): Promise<ResourceInfo[]> {
  const templatesDir = path.join(goldenPath, "templates");
  const resources: ResourceInfo[] = [];

  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const templatePath = path.join(templatesDir, entry.name);
        const claudeFile = path.join(templatePath, "CLAUDE.md");

        // Check if CLAUDE.md exists
        try {
          await fs.stat(claudeFile);

          const resource: ResourceInfo = {
            name: entry.name,
            type: "template",
            path: `templates/${entry.name}`,
          };

          if (verbose) {
            resource.description = await extractDescription(claudeFile);
          }

          resources.push(resource);
        } catch {
          // No CLAUDE.md, skip
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return resources;
}

/**
 * List agent examples
 */
export async function listAgentExamples(
  goldenPath: string,
  verbose: boolean
): Promise<ResourceInfo[]> {
  const agentExamplesDir = path.join(goldenPath, "agent_examples");
  const resources: ResourceInfo[] = [];

  try {
    const entries = await fs.readdir(agentExamplesDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip _template and non-directories
      if (!entry.isDirectory() || entry.name === "_template") {
        continue;
      }

      const examplePath = path.join(agentExamplesDir, entry.name);
      const agentFile = path.join(examplePath, "AGENT.md");
      const configFile = path.join(examplePath, "config.json");

      // Check if AGENT.md exists
      try {
        await fs.stat(agentFile);

        const resource: ResourceInfo = {
          name: entry.name,
          type: "agent_example",
          path: `agent_examples/${entry.name}`,
        };

        // Read config.json for metadata
        try {
          const configContent = await fs.readFile(configFile, "utf-8");
          const config = JSON.parse(configContent);
          resource.complexity = config.complexity;
          resource.agentType = config.type;
          if (config.description) {
            resource.description = config.description;
          }
        } catch {
          // No config or parse error
        }

        if (verbose && !resource.description) {
          resource.description = await extractDescription(agentFile);
        }

        resources.push(resource);
      } catch {
        // No AGENT.md, skip
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return resources;
}
