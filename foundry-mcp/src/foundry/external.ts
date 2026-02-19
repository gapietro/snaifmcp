/**
 * External plugin management
 */

import * as fs from "fs/promises";
import * as path from "path";
import { directoryExists } from "../shared/fs-utils.js";
import { ensureGoldenRepo } from "./golden-repo.js";
import type { ExternalSource } from "./types.js";

// Approved external sources (team-vetted) - fallback if registry file not found
const APPROVED_SOURCES: ExternalSource[] = [
  {
    name: "superpowers",
    type: "approved",
    repo: "obra/superpowers",
    description: "Agentic skills framework with design-first workflow, TDD, and subagent-driven development",
  },
  {
    name: "servicenow-utils",
    type: "approved",
    repo: "gapietro/servicenow-utils",
    description: "Common ServiceNow utility scripts and patterns",
  },
  {
    name: "now-assist-testing",
    type: "approved",
    repo: "gapietro/now-assist-testing",
    description: "Testing patterns for Now Assist skills",
  },
];

async function loadExternalRegistry(goldenPath: string): Promise<ExternalSource[]> {
  const registryPath = path.join(goldenPath, "external-registry.json");
  try {
    const content = await fs.readFile(registryPath, "utf-8");
    const registry = JSON.parse(content);
    return (registry.approved || []).map((item: { name: string; repo: string; description?: string; category?: string }) => ({
      name: item.name,
      type: "approved" as const,
      repo: item.repo,
      description: item.description,
    }));
  } catch {
    // Fallback to hardcoded list
    return APPROVED_SOURCES;
  }
}

function parseExternalSource(source: string): { type: string; name: string; repo?: string } | null {
  // @approved/name
  const approvedMatch = source.match(/^@approved\/([a-z0-9-]+)$/i);
  if (approvedMatch) {
    return { type: "approved", name: approvedMatch[1] };
  }

  // @github/owner/repo
  const githubMatch = source.match(/^@github\/([a-z0-9-]+)\/([a-z0-9-]+)$/i);
  if (githubMatch) {
    return { type: "github", name: githubMatch[2], repo: `${githubMatch[1]}/${githubMatch[2]}` };
  }

  return null;
}

function getExternalConfigPath(projectPath: string): string {
  return path.join(projectPath, ".claude", "foundry-external.json");
}

async function readExternalConfig(projectPath: string): Promise<{ sources: string[] }> {
  const configPath = getExternalConfigPath(projectPath);
  try {
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { sources: [] };
  }
}

async function writeExternalConfig(projectPath: string, config: { sources: string[] }): Promise<void> {
  const configPath = getExternalConfigPath(projectPath);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function handleExternal(
  action: string,
  source: string | undefined,
  projectPath: string,
  goldenPath?: string
): Promise<{ success: boolean; message: string }> {
  const claudeDir = path.join(projectPath, ".claude");

  // Load registry from golden repo (with fallback to hardcoded)
  let approvedSources: ExternalSource[];
  try {
    const goldenRepoPath = goldenPath || (await ensureGoldenRepo());
    approvedSources = await loadExternalRegistry(goldenRepoPath);
  } catch {
    approvedSources = APPROVED_SOURCES;
  }

  if (action === "list") {
    let output = `External Sources\n${"═".repeat(60)}\n\n`;

    // List approved sources
    output += `📦 APPROVED SOURCES (@approved/*)\n${"─".repeat(40)}\n`;
    output += `Team-vetted plugins that are safe to use.\n\n`;

    for (const src of approvedSources) {
      output += `  • @approved/${src.name}\n`;
      if (src.description) {
        output += `    ${src.description}\n`;
      }
    }

    // List installed external sources
    const config = await readExternalConfig(projectPath);
    if (config.sources.length > 0) {
      output += `\n📥 INSTALLED EXTERNAL\n${"─".repeat(40)}\n`;
      for (const src of config.sources) {
        output += `  • ${src}\n`;
      }
    }

    output += `\n${"─".repeat(40)}\n`;
    output += `Add external: foundry_external action="add" source="@approved/name"\n`;
    output += `GitHub direct: foundry_external action="add" source="@github/owner/repo"`;

    return { success: true, message: output };
  }

  if (action === "add") {
    if (!source) {
      return { success: false, message: "Error: source is required for add action" };
    }

    const parsed = parseExternalSource(source);
    if (!parsed) {
      return {
        success: false,
        message: `Invalid source format: ${source}

Valid formats:
  • @approved/name - Team-approved plugins
  • @github/owner/repo - Direct GitHub reference`,
      };
    }

    // Check if approved source exists
    if (parsed.type === "approved") {
      const approved = approvedSources.find(s => s.name === parsed.name);
      if (!approved) {
        return {
          success: false,
          message: `Unknown approved source: ${parsed.name}

Available approved sources:
${approvedSources.map(s => `  • @approved/${s.name}`).join("\n")}`,
        };
      }
    }

    // Check if .claude directory exists
    if (!(await directoryExists(claudeDir))) {
      return {
        success: false,
        message: `Project doesn't have a .claude/ directory at ${projectPath}`,
      };
    }

    // Add to config
    const config = await readExternalConfig(projectPath);
    if (config.sources.includes(source)) {
      return {
        success: false,
        message: `Source already added: ${source}`,
      };
    }

    config.sources.push(source);
    await writeExternalConfig(projectPath, config);

    // Try to clone/fetch the external resource
    let fetchMessage = "";
    if (parsed.type === "approved") {
      const approved = approvedSources.find(s => s.name === parsed.name);
      if (approved?.repo) {
        fetchMessage = `\nNote: Run 'gh repo clone ${approved.repo}' to fetch the content.`;
      }
    } else if (parsed.type === "github" && parsed.repo) {
      fetchMessage = `\nNote: Run 'gh repo clone ${parsed.repo}' to fetch the content.`;
    }

    return {
      success: true,
      message: `Added external source: ${source}

Registered in: .claude/foundry-external.json${fetchMessage}`,
    };
  }

  if (action === "remove") {
    if (!source) {
      return { success: false, message: "Error: source is required for remove action" };
    }

    const config = await readExternalConfig(projectPath);
    const index = config.sources.indexOf(source);

    if (index === -1) {
      return {
        success: false,
        message: `Source not found in project: ${source}`,
      };
    }

    config.sources.splice(index, 1);
    await writeExternalConfig(projectPath, config);

    return {
      success: true,
      message: `Removed external source: ${source}`,
    };
  }

  if (action === "info") {
    if (!source) {
      return { success: false, message: "Error: source is required for info action" };
    }

    const parsed = parseExternalSource(source);
    if (!parsed) {
      return { success: false, message: `Invalid source format: ${source}` };
    }

    if (parsed.type === "approved") {
      const approved = approvedSources.find(s => s.name === parsed.name);
      if (approved) {
        let output = `External Source: @approved/${approved.name}\n${"═".repeat(60)}\n\n`;
        output += `Type: Approved (team-vetted)\n`;
        if (approved.description) {
          output += `Description: ${approved.description}\n`;
        }
        if (approved.repo) {
          output += `Repository: ${approved.repo}\n`;
        }
        return { success: true, message: output };
      }
    }

    return {
      success: true,
      message: `External Source: ${source}\n${"═".repeat(60)}\n\nType: ${parsed.type}\nName: ${parsed.name}${parsed.repo ? `\nRepository: ${parsed.repo}` : ""}`,
    };
  }

  return { success: false, message: `Unknown action: ${action}` };
}
