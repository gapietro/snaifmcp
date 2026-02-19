/**
 * Resource listing, information, and search
 */

import * as fs from "fs/promises";
import * as path from "path";
import { directoryExists, fileExists, readFileContent, extractMarkdownSections, getWordCount } from "../shared/fs-utils.js";
import { ensureGoldenRepo, listContextFiles, listSkills, listTemplates, listAgentExamples } from "./golden-repo.js";
import type { ResourceInfo, SearchResult } from "./types.js";

/**
 * List all available resources
 */
export async function listResources(
  resourceType: string,
  verbose: boolean,
  goldenPath?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Force refresh to get latest resources from GitHub
    const goldenRepoPath = goldenPath || (await ensureGoldenRepo(true));
    const type = resourceType || "all";

    const contextFiles: ResourceInfo[] =
      type === "all" || type === "context"
        ? await listContextFiles(goldenRepoPath, verbose)
        : [];

    const skills: ResourceInfo[] =
      type === "all" || type === "skills"
        ? await listSkills(goldenRepoPath, verbose)
        : [];

    const templates: ResourceInfo[] =
      type === "all" || type === "templates"
        ? await listTemplates(goldenRepoPath, verbose)
        : [];

    const agentExamples: ResourceInfo[] =
      type === "all" || type === "agent_examples"
        ? await listAgentExamples(goldenRepoPath, verbose)
        : [];

    // Format output
    let output = `Foundry Resources (${type})\n${"═".repeat(60)}\n`;

    if (contextFiles.length > 0) {
      output += `\n📚 CONTEXT FILES (${contextFiles.length})\n${"─".repeat(40)}\n`;
      output += "Domain knowledge loaded automatically into Claude Code.\n\n";

      for (const ctx of contextFiles) {
        output += `  • ${ctx.name}\n`;
        if (verbose && ctx.description) {
          output += `    ${ctx.description}\n`;
        }
      }
    }

    if (skills.length > 0) {
      output += `\n🛠️  SKILLS (${skills.length})\n${"─".repeat(40)}\n`;
      output += "Reusable instructions and patterns for common tasks.\n\n";

      for (const skill of skills) {
        const examples = skill.hasExamples ? " [has examples]" : "";
        output += `  • ${skill.name}${examples}\n`;
        if (verbose && skill.description) {
          output += `    ${skill.description}\n`;
        }
      }
    }

    if (templates.length > 0) {
      output += `\n📋 TEMPLATES (${templates.length})\n${"─".repeat(40)}\n`;
      output += "Project templates for CLAUDE.md.\n\n";

      for (const template of templates) {
        output += `  • ${template.name}\n`;
        if (verbose && template.description) {
          output += `    ${template.description}\n`;
        }
      }
    }

    if (agentExamples.length > 0) {
      output += `\n🤖 AGENT EXAMPLES (${agentExamples.length})\n${"─".repeat(40)}\n`;
      output += "Reference implementations of Now Assist agents.\n\n";

      for (const example of agentExamples) {
        const complexity = example.complexity ? ` [${example.complexity}]` : "";
        const agentType = example.agentType ? ` (${example.agentType})` : "";
        output += `  • ${example.name}${agentType}${complexity}\n`;
        if (verbose && example.description) {
          output += `    ${example.description}\n`;
        }
      }
    } else if (type === "all" || type === "agent_examples") {
      output += `\n🤖 AGENT EXAMPLES (0)\n${"─".repeat(40)}\n`;
      output += "Reference implementations of Now Assist agents.\n\n";
      output += "  No agent examples available yet.\n";
      output += "  Use the _template in agent_examples/ to create new examples.\n";
    }

    // Placeholder sections for future resource types
    if (type === "all") {
      output += `\n🔧 SUBAGENTS (coming soon)\n${"─".repeat(40)}\n`;
      output += "Pre-configured sub-agents for claude-flow orchestration.\n";
      output += "  Not yet implemented.\n";

      output += `\n🪝 HOOKS (coming soon)\n${"─".repeat(40)}\n`;
      output += "Lifecycle hooks for project automation.\n";
      output += "  Not yet implemented.\n";
    }

    const totalCount = contextFiles.length + skills.length + templates.length + agentExamples.length;

    if (totalCount === 0) {
      output += `\nNo resources found for type: ${type}`;
    } else {
      output += `\n${"─".repeat(40)}`;
      output += `\nTotal: ${totalCount} resource(s)`;
      output += `\n\nUse foundry_add to add resources to an existing project.`;
      output += `\nUse foundry_init to create a new project with all resources.`;
    }

    return { success: true, message: output };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get info about a context file
 */
async function getContextInfo(
  goldenPath: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const baseName = name.replace(/\.md$/, "");
  const filePath = path.join(goldenPath, "context", `${baseName}.md`);

  const content = await readFileContent(filePath);
  if (!content) {
    return {
      success: false,
      message: `Context file "${baseName}" not found.

Use foundry_list type="context" to see available context files.`,
    };
  }

  const sections = extractMarkdownSections(content);
  const wordCount = getWordCount(content);
  const lineCount = content.split("\n").length;

  // Extract title (first # line)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : baseName;

  // Get first paragraph as description
  const intro = sections.get("intro") || "";
  const firstPara = intro.split("\n\n")[0] || "No description available.";

  let output = `Context File: ${baseName}\n${"═".repeat(60)}\n\n`;
  output += `📄 ${title}\n\n`;
  output += `${firstPara}\n\n`;
  output += `${"─".repeat(40)}\n`;
  output += `DETAILS\n`;
  output += `${"─".repeat(40)}\n`;
  output += `File: context/${baseName}.md\n`;
  output += `Size: ${lineCount} lines, ~${wordCount} words\n\n`;

  // List main sections
  const sectionNames = Array.from(sections.keys()).filter(s => s !== "intro");
  if (sectionNames.length > 0) {
    output += `${"─".repeat(40)}\n`;
    output += `SECTIONS\n`;
    output += `${"─".repeat(40)}\n`;
    for (const section of sectionNames.slice(0, 10)) {
      output += `  • ${section}\n`;
    }
    if (sectionNames.length > 10) {
      output += `  ... and ${sectionNames.length - 10} more\n`;
    }
    output += "\n";
  }

  output += `${"─".repeat(40)}\n`;
  output += `USAGE\n`;
  output += `${"─".repeat(40)}\n`;
  output += `Add to project: foundry_add type="context" name="${baseName}"\n`;
  output += `\nThis context will be automatically loaded by Claude Code.`;

  return { success: true, message: output };
}

/**
 * Get info about a skill
 */
async function getSkillInfo(
  goldenPath: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const skillDir = path.join(goldenPath, "skills", name);
  const skillFile = path.join(skillDir, "SKILL.md");

  const content = await readFileContent(skillFile);
  if (!content) {
    return {
      success: false,
      message: `Skill "${name}" not found.

Use foundry_list type="skills" to see available skills.`,
    };
  }

  const sections = extractMarkdownSections(content);
  const wordCount = getWordCount(content);

  // Extract title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : name;

  // Get description
  const intro = sections.get("intro") || "";
  const firstPara = intro.split("\n\n")[0] || "No description available.";

  // Check for examples
  const examplesDir = path.join(skillDir, "examples");
  let examples: string[] = [];
  try {
    const exampleEntries = await fs.readdir(examplesDir);
    examples = exampleEntries.filter(e => e.endsWith(".md") || e.endsWith(".ts") || e.endsWith(".js"));
  } catch {
    // No examples directory
  }

  let output = `Skill: ${name}\n${"═".repeat(60)}\n\n`;
  output += `🛠️ ${title}\n\n`;
  output += `${firstPara}\n\n`;

  output += `${"─".repeat(40)}\n`;
  output += `STRUCTURE\n`;
  output += `${"─".repeat(40)}\n`;
  output += `skills/${name}/\n`;
  output += `├── SKILL.md (~${wordCount} words)\n`;
  if (examples.length > 0) {
    output += `└── examples/\n`;
    for (const ex of examples.slice(0, 5)) {
      output += `    └── ${ex}\n`;
    }
    if (examples.length > 5) {
      output += `    ... and ${examples.length - 5} more\n`;
    }
  }
  output += "\n";

  // List sections from SKILL.md
  const sectionNames = Array.from(sections.keys()).filter(s => s !== "intro");
  if (sectionNames.length > 0) {
    output += `${"─".repeat(40)}\n`;
    output += `SKILL.md SECTIONS\n`;
    output += `${"─".repeat(40)}\n`;
    for (const section of sectionNames.slice(0, 8)) {
      output += `  • ${section}\n`;
    }
    output += "\n";
  }

  output += `${"─".repeat(40)}\n`;
  output += `USAGE\n`;
  output += `${"─".repeat(40)}\n`;
  output += `Add to project: foundry_add type="skill" name="${name}"\n`;
  output += `\nReview SKILL.md for detailed instructions after adding.`;

  return { success: true, message: output };
}

/**
 * Get info about a template
 */
async function getTemplateInfo(
  goldenPath: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const templateDir = path.join(goldenPath, "templates", name);
  const claudeFile = path.join(templateDir, "CLAUDE.md");

  const content = await readFileContent(claudeFile);
  if (!content) {
    return {
      success: false,
      message: `Template "${name}" not found.

Use foundry_list type="templates" to see available templates.`,
    };
  }

  const wordCount = getWordCount(content);
  const lineCount = content.split("\n").length;

  // Check what sections/patterns the template includes
  const hasSparc = content.toLowerCase().includes("sparc");
  const hasContext = content.toLowerCase().includes("context");
  const hasSkills = content.toLowerCase().includes("skills");

  let output = `Template: ${name}\n${"═".repeat(60)}\n\n`;
  output += `📋 Project template for CLAUDE.md\n\n`;

  output += `${"─".repeat(40)}\n`;
  output += `DETAILS\n`;
  output += `${"─".repeat(40)}\n`;
  output += `File: templates/${name}/CLAUDE.md\n`;
  output += `Size: ${lineCount} lines, ~${wordCount} words\n\n`;

  output += `${"─".repeat(40)}\n`;
  output += `INCLUDES\n`;
  output += `${"─".repeat(40)}\n`;
  if (hasSparc) output += `  ✓ SPARC methodology structure\n`;
  if (hasContext) output += `  ✓ Context file references\n`;
  if (hasSkills) output += `  ✓ Skills references\n`;
  output += "\n";

  output += `${"─".repeat(40)}\n`;
  output += `USAGE\n`;
  output += `${"─".repeat(40)}\n`;
  output += `Create new project: foundry_init projectName="my-project"\n`;
  output += `\nThe template is automatically used when creating new projects.`;

  return { success: true, message: output };
}

/**
 * Get info about an agent example
 */
async function getAgentExampleInfo(
  goldenPath: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  const exampleDir = path.join(goldenPath, "agent_examples", name);
  const agentFile = path.join(exampleDir, "AGENT.md");
  const configFile = path.join(exampleDir, "config.json");

  if (name === "_template") {
    return {
      success: false,
      message: `"_template" is a template for creating new agent examples, not an actual example.

Use foundry_list type="agent_examples" to see available examples.`,
    };
  }

  const content = await readFileContent(agentFile);
  if (!content) {
    return {
      success: false,
      message: `Agent example "${name}" not found.

Use foundry_list type="agent_examples" to see available examples.`,
    };
  }

  const sections = extractMarkdownSections(content);
  const wordCount = getWordCount(content);

  // Extract title
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : name;

  // Get description
  const intro = sections.get("intro") || "";
  const firstPara = intro.split("\n\n")[0] || "No description available.";

  // Read config.json for metadata
  let config: Record<string, unknown> = {};
  try {
    const configContent = await fs.readFile(configFile, "utf-8");
    config = JSON.parse(configContent);
  } catch {
    // No config
  }

  let output = `Agent Example: ${name}\n${"═".repeat(60)}\n\n`;
  output += `🤖 ${title}\n\n`;
  output += `${firstPara}\n\n`;

  // Show metadata from config.json
  if (Object.keys(config).length > 0) {
    output += `${"─".repeat(40)}\n`;
    output += `METADATA\n`;
    output += `${"─".repeat(40)}\n`;
    if (config.type) output += `Type: ${config.type}\n`;
    if (config.complexity) output += `Complexity: ${config.complexity}\n`;
    if (config.platform && typeof config.platform === "object") {
      const platform = config.platform as Record<string, unknown>;
      if (platform.minVersion) output += `Min Version: ${platform.minVersion}\n`;
      if (Array.isArray(platform.plugins)) {
        output += `Required Plugins:\n`;
        for (const plugin of platform.plugins) {
          output += `  • ${plugin}\n`;
        }
      }
    }
    if (Array.isArray(config.tags)) {
      output += `Tags: ${config.tags.join(", ")}\n`;
    }
    output += "\n";
  }

  // Show structure
  output += `${"─".repeat(40)}\n`;
  output += `STRUCTURE\n`;
  output += `${"─".repeat(40)}\n`;
  output += `agent_examples/${name}/\n`;
  output += `├── AGENT.md (~${wordCount} words)\n`;
  output += `├── config.json\n`;

  // List directories
  try {
    const entries = await fs.readdir(exampleDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory());
    const files = entries.filter(e => e.isFile() && e.name !== "AGENT.md" && e.name !== "config.json");

    for (const dir of dirs) {
      output += `└── ${dir.name}/\n`;
    }
    for (const file of files) {
      output += `└── ${file.name}\n`;
    }
  } catch {
    // Ignore
  }
  output += "\n";

  // List sections from AGENT.md
  const sectionNames = Array.from(sections.keys()).filter(s => s !== "intro");
  if (sectionNames.length > 0) {
    output += `${"─".repeat(40)}\n`;
    output += `AGENT.md SECTIONS\n`;
    output += `${"─".repeat(40)}\n`;
    for (const section of sectionNames.slice(0, 10)) {
      output += `  • ${section}\n`;
    }
    if (sectionNames.length > 10) {
      output += `  ... and ${sectionNames.length - 10} more\n`;
    }
    output += "\n";
  }

  output += `${"─".repeat(40)}\n`;
  output += `USAGE\n`;
  output += `${"─".repeat(40)}\n`;
  output += `Add to project: foundry_add type="agent_example" name="${name}"\n`;
  output += `\nReview AGENT.md for implementation details after adding.`;

  return { success: true, message: output };
}

/**
 * Get info about a subagent (placeholder - not yet implemented)
 */
async function getSubagentInfo(
  _goldenPath: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: `Subagent: ${name}
${"═".repeat(60)}

🔧 Subagents are not yet implemented.

Subagents will be pre-configured sub-agents for claude-flow orchestration,
allowing you to compose complex multi-agent workflows.

Coming soon:
  • Code review subagent
  • Testing subagent
  • Documentation subagent
  • Research subagent

Check back in a future version of Foundry for subagent support.`,
  };
}

/**
 * Get info about a hook (placeholder - not yet implemented)
 */
async function getHookInfo(
  _goldenPath: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  return {
    success: true,
    message: `Hook: ${name}
${"═".repeat(60)}

🪝 Hooks are not yet implemented.

Hooks will provide lifecycle automation for Foundry projects,
triggering actions at key points in the development workflow.

Coming soon:
  • post-init: Run after project initialization
  • pre-commit: Run before git commits
  • post-add: Run after adding resources
  • sync-complete: Run after syncing with golden repo

Check back in a future version of Foundry for hook support.`,
  };
}

/**
 * Get resource info
 */
export async function getResourceInfo(
  resourceType: string,
  name: string,
  goldenPath?: string
): Promise<{ success: boolean; message: string }> {
  if (!resourceType || !name) {
    return {
      success: false,
      message: "Error: type and name are required",
    };
  }

  try {
    const goldenRepoPath = goldenPath || (await ensureGoldenRepo());

    switch (resourceType) {
      case "context":
        return await getContextInfo(goldenRepoPath, name);
      case "skill":
        return await getSkillInfo(goldenRepoPath, name);
      case "template":
        return await getTemplateInfo(goldenRepoPath, name);
      case "agent_example":
        return await getAgentExampleInfo(goldenRepoPath, name);
      case "subagent":
        return await getSubagentInfo(goldenRepoPath, name);
      case "hook":
        return await getHookInfo(goldenRepoPath, name);
      default:
        return {
          success: false,
          message: `Unknown resource type: ${resourceType}

Supported types: context, skill, template, agent_example, subagent, hook`,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to get resource info: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Search in a file
 */
async function searchInFile(
  filePath: string,
  query: string,
  resourceName: string,
  resourceType: "context" | "skill" | "template"
): Promise<SearchResult | null> {
  const content = await readFileContent(filePath);
  if (!content) return null;

  const queryLower = query.toLowerCase();
  const nameLower = resourceName.toLowerCase();
  const contentLower = content.toLowerCase();

  // Check name match
  const nameMatch = nameLower.includes(queryLower);

  // Check content match
  const contentIndex = contentLower.indexOf(queryLower);
  const contentMatch = contentIndex !== -1;

  if (!nameMatch && !contentMatch) return null;

  // Calculate score (name matches rank higher)
  let score = 0;
  if (nameMatch) score += 10;
  if (contentMatch) score += 5;

  // Extract snippet
  let snippet = "";
  if (contentMatch) {
    const start = Math.max(0, contentIndex - 50);
    const end = Math.min(content.length, contentIndex + query.length + 50);
    snippet = content.slice(start, end).replace(/\n/g, " ").trim();
    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";
  } else {
    // Get first line as snippet
    snippet = content.split("\n")[0].replace(/^#\s*/, "").trim();
  }

  return {
    name: resourceName,
    type: resourceType,
    score,
    snippet,
    matchType: nameMatch ? "name" : "content",
  };
}

/**
 * Search resources
 */
export async function searchResources(
  query: string,
  resourceType: string,
  goldenPath?: string
): Promise<{ success: boolean; message: string }> {
  if (!query || query.trim().length === 0) {
    return {
      success: false,
      message: "Error: query is required",
    };
  }

  try {
    const goldenRepoPath = goldenPath || (await ensureGoldenRepo());
    const type = resourceType || "all";
    const results: SearchResult[] = [];

    // Search context files
    if (type === "all" || type === "context") {
      const contextDir = path.join(goldenRepoPath, "context");
      try {
        const entries = await fs.readdir(contextDir);
        for (const entry of entries) {
          if (!entry.endsWith(".md")) continue;
          const filePath = path.join(contextDir, entry);
          const name = entry.replace(/\.md$/, "");
          const result = await searchInFile(filePath, query, name, "context");
          if (result) results.push(result);
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Search skills
    if (type === "all" || type === "skills") {
      const skillsDir = path.join(goldenRepoPath, "skills");
      try {
        const entries = await fs.readdir(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
          const result = await searchInFile(skillFile, query, entry.name, "skill");
          if (result) results.push(result);
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Search templates
    if (type === "all" || type === "templates") {
      const templatesDir = path.join(goldenRepoPath, "templates");
      try {
        const entries = await fs.readdir(templatesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const templateFile = path.join(templatesDir, entry.name, "CLAUDE.md");
          const result = await searchInFile(templateFile, query, entry.name, "template");
          if (result) results.push(result);
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Format output
    let output = `Search Results for "${query}"\n${"═".repeat(60)}\n`;
    output += `Type: ${type}\n`;
    output += `Found: ${results.length} result(s)\n\n`;

    if (results.length === 0) {
      output += `No resources found matching "${query}".\n\n`;
      output += `Try:\n`;
      output += `  • Different keywords\n`;
      output += `  • Broader search terms\n`;
      output += `  • foundry_list to browse all resources`;
    } else {
      for (const result of results) {
        const icon = result.type === "context" ? "📄" : result.type === "skill" ? "🛠️" : "📋";
        const matchLabel = result.matchType === "name" ? "[name match]" : "[content match]";

        output += `${"─".repeat(40)}\n`;
        output += `${icon} ${result.name} (${result.type}) ${matchLabel}\n`;
        output += `${"─".repeat(40)}\n`;
        output += `${result.snippet}\n\n`;
        output += `→ foundry_info type="${result.type}" name="${result.name}"\n\n`;
      }
    }

    return { success: true, message: output };
  } catch (error) {
    return {
      success: false,
      message: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
