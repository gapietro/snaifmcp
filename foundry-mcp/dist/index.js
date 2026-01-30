#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
// ServiceNow integration
import { SERVICENOW_TOOLS, handleServiceNowTool, isServiceNowTool, } from "./servicenow/index.js";
const execAsync = promisify(exec);
// Configuration
const CONFIG = {
    // GitHub repo for foundry-golden (owner/repo format for gh CLI)
    goldenRepo: "Now-AI-Foundry/foundry-golden",
    // Local cache directory for the golden repo
    cacheDir: path.join(process.env.HOME || process.env.USERPROFILE || "~", ".foundry", "golden"),
    // How old (in hours) before we refresh the cache
    cacheMaxAgeHours: 24,
};
// Tool definitions
const FOUNDRY_INIT_TOOL = {
    name: "foundry_init",
    description: "Bootstrap a new Now Assist POC project with pre-loaded context, skills, and template from the Foundry golden repository.",
    inputSchema: {
        type: "object",
        properties: {
            projectName: {
                type: "string",
                description: "Name of the project directory to create (e.g., 'my-poc', 'customer-demo')",
            },
            path: {
                type: "string",
                description: "Parent directory where the project will be created. Defaults to current working directory.",
            },
            template: {
                type: "string",
                enum: ["sparc-starter", "minimal", "standard"],
                description: "Project template to use (default: 'sparc-starter'). Use foundry_templates to see available templates.",
            },
            goldenPath: {
                type: "string",
                description: "Optional: Local path to foundry-golden repo. If provided, uses this instead of cloning from GitHub.",
            },
        },
        required: ["projectName"],
    },
};
const FOUNDRY_LIST_TOOL = {
    name: "foundry_list",
    description: `List available Foundry resources from the golden repository.

Shows available:
- Context files: Domain knowledge (Now Assist, GenAI, Agentic patterns)
- Skills: Reusable Claude Code skills with instructions and examples
- Templates: Project templates (SPARC methodology, etc.)

Use this to discover what resources are available before using foundry_add.`,
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["context", "skills", "templates", "agent_examples", "all"],
                description: "Type of resources to list (default: 'all')",
            },
            verbose: {
                type: "boolean",
                description: "Include descriptions from resource files (default: false)",
            },
        },
    },
};
const FOUNDRY_ADD_TOOL = {
    name: "foundry_add",
    description: `Add a Foundry resource to an existing project.

Adds context files, skills, or agent examples from the golden repository to your project's .claude/ directory.

Examples:
- Add a context file: type="context", name="now-assist-platform"
- Add a skill: type="skill", name="api-integration"
- Add an agent example: type="agent_example", name="incident-summarizer"

Use foundry_list to see available resources first.`,
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["context", "skill", "agent_example"],
                description: "Type of resource to add",
            },
            name: {
                type: "string",
                description: "Name of the resource to add (e.g., 'now-assist-platform', 'api-integration')",
            },
            projectPath: {
                type: "string",
                description: "Path to the project (defaults to current working directory)",
            },
            force: {
                type: "boolean",
                description: "Overwrite if resource already exists (default: false)",
            },
        },
        required: ["type", "name"],
    },
};
const FOUNDRY_SYNC_TOOL = {
    name: "foundry_sync",
    description: `Sync project resources with the latest from the golden repository.

Compares your project's .claude/ resources with the golden repo and updates outdated files.

Options:
- dryRun: Preview changes without applying them (default: true for safety)
- type: Sync only specific resource type (context, skills, or all)

Shows:
- Updated: Files that have changed in golden repo
- New: Resources available but not in project
- Unchanged: Files already up to date`,
    inputSchema: {
        type: "object",
        properties: {
            projectPath: {
                type: "string",
                description: "Path to the project (defaults to current working directory)",
            },
            dryRun: {
                type: "boolean",
                description: "Preview changes without applying them (default: true)",
            },
            type: {
                type: "string",
                enum: ["context", "skills", "all"],
                description: "Type of resources to sync (default: 'all')",
            },
        },
    },
};
const FOUNDRY_INFO_TOOL = {
    name: "foundry_info",
    description: `Get detailed information about a specific Foundry resource.

Shows:
- Full description and purpose
- Usage instructions
- File structure (for skills)
- Examples (if available)
- Related resources

Use foundry_list first to see available resources.`,
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["context", "skill", "template", "agent_example", "subagent", "hook"],
                description: "Type of resource",
            },
            name: {
                type: "string",
                description: "Name of the resource",
            },
        },
        required: ["type", "name"],
    },
};
const FOUNDRY_SEARCH_TOOL = {
    name: "foundry_search",
    description: `Search across all Foundry resources.

Searches resource names, descriptions, and content for matching terms.
Returns ranked results with context snippets.

Examples:
- foundry_search query="API" - Find resources mentioning APIs
- foundry_search query="GlideRecord" - Find GlideRecord patterns
- foundry_search query="skill" type="context" - Search only context files`,
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search term or phrase",
            },
            type: {
                type: "string",
                enum: ["context", "skills", "templates", "agent_examples", "all"],
                description: "Filter by resource type (default: 'all')",
            },
        },
        required: ["query"],
    },
};
const FOUNDRY_NEW_TOOL = {
    name: "foundry_new",
    description: `Scaffold a new Foundry resource in your project.

Creates a new resource with starter templates:
- context: Creates a new .md context file with standard structure
- skill: Creates a skill directory with SKILL.md and examples/

The new resource is created in your project's .claude/ directory.
After development, use foundry_validate and foundry_promote to contribute back.`,
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["context", "skill"],
                description: "Type of resource to create",
            },
            name: {
                type: "string",
                description: "Name for the new resource (e.g., 'my-context', 'my-skill')",
            },
            description: {
                type: "string",
                description: "Brief description of what this resource does",
            },
            projectPath: {
                type: "string",
                description: "Path to the project (defaults to current working directory)",
            },
        },
        required: ["type", "name"],
    },
};
const FOUNDRY_VALIDATE_TOOL = {
    name: "foundry_validate",
    description: `Validate a Foundry resource before promotion.

Checks:
- Required files exist (SKILL.md for skills, .md for context)
- File structure is correct
- Minimum content requirements met
- No obvious issues (empty sections, placeholder text)

Use this before foundry_promote to ensure your resource is ready.`,
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["context", "skill"],
                description: "Type of resource to validate",
            },
            name: {
                type: "string",
                description: "Name of the resource to validate",
            },
            projectPath: {
                type: "string",
                description: "Path to the project (defaults to current working directory)",
            },
        },
        required: ["type", "name"],
    },
};
const FOUNDRY_PROMOTE_TOOL = {
    name: "foundry_promote",
    description: `Promote a validated resource by creating a PR to the golden repository.

This tool:
1. Validates the resource first
2. Creates a branch in the golden repo
3. Copies the resource files
4. Creates a pull request for review

Requires GitHub CLI (gh) to be authenticated.
The PR will need team review before merging.`,
    inputSchema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["context", "skill"],
                description: "Type of resource to promote",
            },
            name: {
                type: "string",
                description: "Name of the resource to promote",
            },
            message: {
                type: "string",
                description: "Description of the resource for the PR",
            },
            projectPath: {
                type: "string",
                description: "Path to the project (defaults to current working directory)",
            },
        },
        required: ["type", "name"],
    },
};
const FOUNDRY_EXTERNAL_TOOL = {
    name: "foundry_external",
    description: `Manage external plugins from approved sources or GitHub.

Supports three tiers:
- @foundry/* - Team resources from golden repo (default)
- @approved/* - Team-vetted external plugins
- @github/owner/repo - Direct GitHub repository references

Examples:
- foundry_external action="list" - Show all external sources
- foundry_external action="add" source="@approved/servicenow-utils"
- foundry_external action="add" source="@github/example/cool-skill"
- foundry_external action="remove" source="@github/example/cool-skill"`,
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["list", "add", "remove", "info"],
                description: "Action to perform",
            },
            source: {
                type: "string",
                description: "External source (e.g., '@approved/name', '@github/owner/repo')",
            },
            projectPath: {
                type: "string",
                description: "Path to the project (defaults to current working directory)",
            },
        },
        required: ["action"],
    },
};
const FOUNDRY_VERSION_TOOL = {
    name: "foundry_version",
    description: `Manage resource versions and check for updates.

Features:
- Show installed resource versions
- Check for available updates
- Pin resources to specific versions
- View version history

The lock file (.claude/foundry.lock) tracks installed versions.`,
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["status", "check", "pin", "history"],
                description: "Action: status (show installed), check (find updates), pin (lock version), history (show changes)",
            },
            resource: {
                type: "string",
                description: "Resource name (for pin/history actions)",
            },
            version: {
                type: "string",
                description: "Version to pin (for pin action)",
            },
            projectPath: {
                type: "string",
                description: "Path to the project (defaults to current working directory)",
            },
        },
        required: ["action"],
    },
};
const FOUNDRY_TEMPLATES_TOOL = {
    name: "foundry_templates",
    description: `List and preview available project templates.

Templates:
- sparc-starter: Full SPARC methodology with all context and skills (default)
- minimal: Bare-bones CLAUDE.md only, no preloaded resources
- standard: Basic setup with core context, no skills

Use with foundry_init template="name" to create projects with different templates.`,
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["list", "preview", "compare"],
                description: "Action: list (show all), preview (show template contents), compare (diff two templates)",
            },
            template: {
                type: "string",
                description: "Template name (for preview action)",
            },
            compare: {
                type: "string",
                description: "Second template name (for compare action)",
            },
        },
    },
};
/**
 * Check if a directory exists
 */
async function directoryExists(dirPath) {
    try {
        const stat = await fs.stat(dirPath);
        return stat.isDirectory();
    }
    catch {
        return false;
    }
}
/**
 * Check if cache is stale
 */
async function isCacheStale() {
    const markerFile = path.join(CONFIG.cacheDir, ".cache-timestamp");
    try {
        const stat = await fs.stat(markerFile);
        const ageMs = Date.now() - stat.mtime.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        return ageHours > CONFIG.cacheMaxAgeHours;
    }
    catch {
        return true; // No marker = stale
    }
}
/**
 * Update cache timestamp
 */
async function updateCacheTimestamp() {
    const markerFile = path.join(CONFIG.cacheDir, ".cache-timestamp");
    await fs.writeFile(markerFile, new Date().toISOString());
}
/**
 * Clone or update the golden repository
 * Uses GitHub CLI (gh) for authentication with private repos
 */
async function ensureGoldenRepo() {
    const exists = await directoryExists(CONFIG.cacheDir);
    if (exists) {
        // Check if we should update
        if (await isCacheStale()) {
            try {
                await execAsync("git pull --ff-only", { cwd: CONFIG.cacheDir });
                await updateCacheTimestamp();
            }
            catch {
                // Pull failed, but we still have a cached version - continue
                console.error("Warning: Could not update golden repo cache, using existing version");
            }
        }
    }
    else {
        // Clone fresh using gh CLI (handles auth for private repos)
        await fs.mkdir(path.dirname(CONFIG.cacheDir), { recursive: true });
        try {
            // Use gh repo clone which handles authentication automatically
            await execAsync(`gh repo clone ${CONFIG.goldenRepo} "${CONFIG.cacheDir}"`);
            await updateCacheTimestamp();
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            // Provide helpful error message for auth issues
            if (errorMsg.includes("gh auth") || errorMsg.includes("not logged")) {
                throw new Error(`GitHub authentication required. Run 'gh auth login' first, then try again.`);
            }
            throw new Error(`Failed to clone golden repository: ${errorMsg}`);
        }
    }
    return CONFIG.cacheDir;
}
/**
 * Copy a directory recursively
 */
async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        }
        else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}
/**
 * Process the CLAUDE.md template, replacing placeholders
 */
async function processTemplate(templatePath, projectName) {
    const content = await fs.readFile(templatePath, "utf-8");
    return content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
}
/**
 * Initialize a new Foundry project
 */
async function initializeProject(projectName, parentPath, goldenPath, template = "sparc-starter") {
    // Validate project name
    if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
        return {
            success: false,
            message: "Invalid project name. Use only letters, numbers, hyphens, and underscores.",
        };
    }
    // Validate template
    const validTemplates = ["sparc-starter", "minimal", "standard"];
    if (!validTemplates.includes(template)) {
        return {
            success: false,
            message: `Unknown template: ${template}\n\nAvailable templates: ${validTemplates.join(", ")}\nUse foundry_templates to see details.`,
        };
    }
    // Determine template settings
    const templateSettings = {
        "sparc-starter": { context: true, skills: true },
        "minimal": { context: false, skills: false },
        "standard": { context: true, skills: false },
    }[template] || { context: true, skills: true };
    // Determine paths
    const projectPath = path.join(parentPath, projectName);
    const goldenRepoPath = goldenPath || (await ensureGoldenRepo());
    // Check if project already exists
    if (await directoryExists(projectPath)) {
        return {
            success: false,
            message: `Project directory already exists: ${projectPath}`,
        };
    }
    // Verify golden repo has expected structure
    const contextDir = path.join(goldenRepoPath, "context");
    const skillsDir = path.join(goldenRepoPath, "skills");
    const templateDir = path.join(goldenRepoPath, "templates", "sparc-starter");
    if (templateSettings.context && !(await directoryExists(contextDir))) {
        return {
            success: false,
            message: `Golden repo missing context directory: ${contextDir}`,
        };
    }
    // Create project structure
    try {
        // Create main project directory
        await fs.mkdir(projectPath, { recursive: true });
        // Create .claude directory
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
            const processedTemplate = await processTemplate(templateFile, projectName);
            await fs.writeFile(path.join(projectPath, "CLAUDE.md"), processedTemplate);
        }
        else if (template === "minimal") {
            // Create minimal CLAUDE.md
            const minimalContent = `# ${projectName}

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
        // Create a simple .gitignore
        const gitignore = `# Dependencies
node_modules/

# Build outputs
dist/
build/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
`;
        await fs.writeFile(path.join(projectPath, ".gitignore"), gitignore);
        // Bootstrap external plugins (superpowers is default for all templates)
        const externalConfig = {
            sources: ["@approved/superpowers"],
        };
        await fs.writeFile(path.join(claudeDir, "foundry-external.json"), JSON.stringify(externalConfig, null, 2));
        // Build resource list for message
        const resourceList = [];
        if (templateSettings.context) {
            resourceList.push("- Context: Now Assist platform, GenAI framework, Agentic patterns");
        }
        if (templateSettings.skills) {
            resourceList.push("- Skills: Now Assist skill builder, API integration");
        }
        resourceList.push(`- Template: ${template}`);
        resourceList.push("- External: superpowers (agentic workflow framework)");
        return {
            success: true,
            projectPath,
            message: `Project "${projectName}" created successfully at ${projectPath}

Template: ${template}
${resourceList.join("\n")}

Next steps:
1. cd ${projectPath}
2. Set up superpowers (recommended):
   gh repo clone obra/superpowers .superpowers
   # Then follow superpowers setup instructions
3. Review CLAUDE.md and update project details
4. Start building with Claude Code!
${!templateSettings.context || !templateSettings.skills ? `
Use foundry_add to add additional resources:
  foundry_add type="context" name="now-assist-platform"
  foundry_add type="skill" name="api-integration"` : ""}
The .claude/ directory contains pre-loaded resources that Claude Code will use automatically.
Superpowers is pre-registered in .claude/foundry-external.json for design-first agentic workflows.`,
        };
    }
    catch (error) {
        // Clean up on failure
        try {
            await fs.rm(projectPath, { recursive: true, force: true });
        }
        catch {
            // Ignore cleanup errors
        }
        return {
            success: false,
            message: `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
/**
 * Extract description from a markdown file (first paragraph after title)
 */
async function extractDescription(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        // Skip title line(s) and find first paragraph
        let inParagraph = false;
        let paragraph = [];
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip empty lines at start
            if (!inParagraph && trimmed === "")
                continue;
            // Skip title lines
            if (trimmed.startsWith("#")) {
                inParagraph = false;
                paragraph = [];
                continue;
            }
            // Skip horizontal rules
            if (trimmed.match(/^[-=]{3,}$/))
                continue;
            // Start collecting paragraph
            if (trimmed !== "") {
                inParagraph = true;
                paragraph.push(trimmed);
            }
            else if (inParagraph && paragraph.length > 0) {
                // End of paragraph
                break;
            }
        }
        if (paragraph.length > 0) {
            const desc = paragraph.join(" ");
            // Truncate if too long
            return desc.length > 200 ? desc.substring(0, 200) + "..." : desc;
        }
    }
    catch {
        // File read error
    }
    return undefined;
}
/**
 * List context files
 */
async function listContextFiles(goldenPath, verbose) {
    const contextDir = path.join(goldenPath, "context");
    const resources = [];
    try {
        const entries = await fs.readdir(contextDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".md")) {
                const name = entry.name.replace(/\.md$/, "");
                const filePath = path.join(contextDir, entry.name);
                const resource = {
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
    }
    catch {
        // Directory doesn't exist
    }
    return resources;
}
/**
 * List skills
 */
async function listSkills(goldenPath, verbose) {
    const skillsDir = path.join(goldenPath, "skills");
    const resources = [];
    try {
        const entries = await fs.readdir(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillPath = path.join(skillsDir, entry.name);
                const skillFile = path.join(skillPath, "SKILL.md");
                // Check if SKILL.md exists
                try {
                    await fs.stat(skillFile);
                    const resource = {
                        name: entry.name,
                        type: "skill",
                        path: `skills/${entry.name}`,
                    };
                    // Check for examples
                    const examplesDir = path.join(skillPath, "examples");
                    try {
                        await fs.stat(examplesDir);
                        resource.hasExamples = true;
                    }
                    catch {
                        resource.hasExamples = false;
                    }
                    if (verbose) {
                        resource.description = await extractDescription(skillFile);
                    }
                    resources.push(resource);
                }
                catch {
                    // No SKILL.md, skip
                }
            }
        }
    }
    catch {
        // Directory doesn't exist
    }
    return resources;
}
/**
 * List templates
 */
async function listTemplates(goldenPath, verbose) {
    const templatesDir = path.join(goldenPath, "templates");
    const resources = [];
    try {
        const entries = await fs.readdir(templatesDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const templatePath = path.join(templatesDir, entry.name);
                const claudeFile = path.join(templatePath, "CLAUDE.md");
                // Check if CLAUDE.md exists
                try {
                    await fs.stat(claudeFile);
                    const resource = {
                        name: entry.name,
                        type: "template",
                        path: `templates/${entry.name}`,
                    };
                    if (verbose) {
                        resource.description = await extractDescription(claudeFile);
                    }
                    resources.push(resource);
                }
                catch {
                    // No CLAUDE.md, skip
                }
            }
        }
    }
    catch {
        // Directory doesn't exist
    }
    return resources;
}
/**
 * List agent examples
 */
async function listAgentExamples(goldenPath, verbose) {
    const agentExamplesDir = path.join(goldenPath, "agent_examples");
    const resources = [];
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
                const resource = {
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
                }
                catch {
                    // No config or parse error
                }
                if (verbose && !resource.description) {
                    resource.description = await extractDescription(agentFile);
                }
                resources.push(resource);
            }
            catch {
                // No AGENT.md, skip
            }
        }
    }
    catch {
        // Directory doesn't exist
    }
    return resources;
}
/**
 * List all available resources
 */
async function listResources(resourceType, verbose, goldenPath) {
    try {
        const goldenRepoPath = goldenPath || (await ensureGoldenRepo());
        const type = resourceType || "all";
        const contextFiles = type === "all" || type === "context"
            ? await listContextFiles(goldenRepoPath, verbose)
            : [];
        const skills = type === "all" || type === "skills"
            ? await listSkills(goldenRepoPath, verbose)
            : [];
        const templates = type === "all" || type === "templates"
            ? await listTemplates(goldenRepoPath, verbose)
            : [];
        const agentExamples = type === "all" || type === "agent_examples"
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
        }
        else if (type === "all" || type === "agent_examples") {
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
        }
        else {
            output += `\n${"─".repeat(40)}`;
            output += `\nTotal: ${totalCount} resource(s)`;
            output += `\n\nUse foundry_add to add resources to an existing project.`;
            output += `\nUse foundry_init to create a new project with all resources.`;
        }
        return { success: true, message: output };
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to list resources: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
// ============================================================================
// Resource Adding
// ============================================================================
/**
 * Check if a file exists
 */
async function fileExists(filePath) {
    try {
        const stat = await fs.stat(filePath);
        return stat.isFile();
    }
    catch {
        return false;
    }
}
/**
 * Add a context file to a project
 */
async function addContextFile(goldenPath, projectPath, name, force) {
    // Normalize name (remove .md extension if provided)
    const baseName = name.replace(/\.md$/, "");
    const fileName = `${baseName}.md`;
    // Source path
    const sourcePath = path.join(goldenPath, "context", fileName);
    // Check if source exists
    if (!(await fileExists(sourcePath))) {
        // Try to find similar names
        const contextDir = path.join(goldenPath, "context");
        let available = [];
        try {
            const entries = await fs.readdir(contextDir);
            available = entries.filter(e => e.endsWith(".md")).map(e => e.replace(/\.md$/, ""));
        }
        catch {
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
 * Add a skill to a project
 */
async function addSkill(goldenPath, projectPath, name, force) {
    // Source path
    const sourcePath = path.join(goldenPath, "skills", name);
    const skillFile = path.join(sourcePath, "SKILL.md");
    // Check if source exists
    if (!(await directoryExists(sourcePath)) || !(await fileExists(skillFile))) {
        // Try to find similar names
        const skillsDir = path.join(goldenPath, "skills");
        let available = [];
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
        }
        catch {
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
    // Destination path
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
async function addAgentExample(goldenPath, projectPath, name, force) {
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
        let available = [];
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
        }
        catch {
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
    const contents = [];
    try {
        const entries = await fs.readdir(destDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                contents.push(`${entry.name}/`);
            }
            else {
                contents.push(entry.name);
            }
        }
    }
    catch {
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
async function addResource(resourceType, name, projectPath, force, goldenPath) {
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
                return await addSkill(goldenRepoPath, projectPath, name, force);
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
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to add resource: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
/**
 * Get file hash for comparison (simple content-based)
 */
async function getFileHash(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        // Simple hash: length + first 100 chars + last 100 chars
        const preview = content.length > 200
            ? content.slice(0, 100) + content.slice(-100)
            : content;
        return `${content.length}:${preview}`;
    }
    catch {
        return "";
    }
}
/**
 * Compare two files
 */
async function filesMatch(file1, file2) {
    const hash1 = await getFileHash(file1);
    const hash2 = await getFileHash(file2);
    return hash1 === hash2 && hash1 !== "";
}
/**
 * Sync context files
 */
async function syncContextFiles(goldenPath, projectPath, dryRun) {
    const results = [];
    const goldenContextDir = path.join(goldenPath, "context");
    const projectContextDir = path.join(projectPath, ".claude", "context");
    // Check if project context dir exists
    const projectHasContext = await directoryExists(projectContextDir);
    try {
        const entries = await fs.readdir(goldenContextDir);
        for (const entry of entries) {
            if (!entry.endsWith(".md"))
                continue;
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
            }
            else {
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
                    }
                    catch (error) {
                        results.push({
                            name,
                            type: "context",
                            status: "error",
                            message: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
                else {
                    results.push({
                        name,
                        type: "context",
                        status: "updated",
                        message: "Would update (dry run)",
                    });
                }
            }
        }
    }
    catch {
        // Context directory doesn't exist in golden repo
    }
    return results;
}
/**
 * Sync skills
 */
async function syncSkills(goldenPath, projectPath, dryRun) {
    const results = [];
    const goldenSkillsDir = path.join(goldenPath, "skills");
    const projectSkillsDir = path.join(projectPath, ".claude", "skills");
    // Check if project skills dir exists
    const projectHasSkills = await directoryExists(projectSkillsDir);
    try {
        const entries = await fs.readdir(goldenSkillsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const name = entry.name;
            const goldenSkillDir = path.join(goldenSkillsDir, name);
            const goldenSkillMd = path.join(goldenSkillDir, "SKILL.md");
            const projectSkillDir = path.join(projectSkillsDir, name);
            const projectSkillMd = path.join(projectSkillDir, "SKILL.md");
            // Check if skill has SKILL.md in golden
            if (!(await fileExists(goldenSkillMd)))
                continue;
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
            }
            else {
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
                    }
                    catch (error) {
                        results.push({
                            name,
                            type: "skill",
                            status: "error",
                            message: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
                else {
                    results.push({
                        name,
                        type: "skill",
                        status: "updated",
                        message: "Would update (dry run)",
                    });
                }
            }
        }
    }
    catch {
        // Skills directory doesn't exist in golden repo
    }
    return results;
}
/**
 * Sync all resources
 */
async function syncResources(projectPath, dryRun, resourceType, goldenPath) {
    try {
        const goldenRepoPath = goldenPath || (await ensureGoldenRepo());
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
        const allResults = [];
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
                if (r.message)
                    output += ` - ${r.message}`;
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
        if (errors.length > 0)
            output += `, ${errors.length} errors`;
        output += "\n";
        if (dryRun && updated.length > 0) {
            output += `\nRun with dryRun=false to apply updates.`;
        }
        return { success: errors.length === 0, message: output };
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to sync resources: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
// ============================================================================
// Resource Information
// ============================================================================
/**
 * Read file content safely
 */
async function readFileContent(filePath) {
    try {
        return await fs.readFile(filePath, "utf-8");
    }
    catch {
        return null;
    }
}
/**
 * Extract sections from markdown content
 */
function extractMarkdownSections(content) {
    const sections = new Map();
    const lines = content.split("\n");
    let currentSection = "intro";
    let currentContent = [];
    for (const line of lines) {
        const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
        if (headerMatch) {
            // Save previous section
            if (currentContent.length > 0) {
                sections.set(currentSection, currentContent.join("\n").trim());
            }
            currentSection = headerMatch[1].toLowerCase().trim();
            currentContent = [];
        }
        else {
            currentContent.push(line);
        }
    }
    // Save last section
    if (currentContent.length > 0) {
        sections.set(currentSection, currentContent.join("\n").trim());
    }
    return sections;
}
/**
 * Get word count
 */
function getWordCount(content) {
    return content.split(/\s+/).filter(w => w.length > 0).length;
}
/**
 * Get info about a context file
 */
async function getContextInfo(goldenPath, name) {
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
async function getSkillInfo(goldenPath, name) {
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
    let examples = [];
    try {
        const exampleEntries = await fs.readdir(examplesDir);
        examples = exampleEntries.filter(e => e.endsWith(".md") || e.endsWith(".ts") || e.endsWith(".js"));
    }
    catch {
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
async function getTemplateInfo(goldenPath, name) {
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
    if (hasSparc)
        output += `  ✓ SPARC methodology structure\n`;
    if (hasContext)
        output += `  ✓ Context file references\n`;
    if (hasSkills)
        output += `  ✓ Skills references\n`;
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
async function getAgentExampleInfo(goldenPath, name) {
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
    let config = {};
    try {
        const configContent = await fs.readFile(configFile, "utf-8");
        config = JSON.parse(configContent);
    }
    catch {
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
        if (config.type)
            output += `Type: ${config.type}\n`;
        if (config.complexity)
            output += `Complexity: ${config.complexity}\n`;
        if (config.platform && typeof config.platform === "object") {
            const platform = config.platform;
            if (platform.minVersion)
                output += `Min Version: ${platform.minVersion}\n`;
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
    }
    catch {
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
async function getSubagentInfo(_goldenPath, name) {
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
async function getHookInfo(_goldenPath, name) {
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
async function getResourceInfo(resourceType, name, goldenPath) {
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
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to get resource info: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
/**
 * Search in a file
 */
async function searchInFile(filePath, query, resourceName, resourceType) {
    const content = await readFileContent(filePath);
    if (!content)
        return null;
    const queryLower = query.toLowerCase();
    const nameLower = resourceName.toLowerCase();
    const contentLower = content.toLowerCase();
    // Check name match
    const nameMatch = nameLower.includes(queryLower);
    // Check content match
    const contentIndex = contentLower.indexOf(queryLower);
    const contentMatch = contentIndex !== -1;
    if (!nameMatch && !contentMatch)
        return null;
    // Calculate score (name matches rank higher)
    let score = 0;
    if (nameMatch)
        score += 10;
    if (contentMatch)
        score += 5;
    // Extract snippet
    let snippet = "";
    if (contentMatch) {
        const start = Math.max(0, contentIndex - 50);
        const end = Math.min(content.length, contentIndex + query.length + 50);
        snippet = content.slice(start, end).replace(/\n/g, " ").trim();
        if (start > 0)
            snippet = "..." + snippet;
        if (end < content.length)
            snippet = snippet + "...";
    }
    else {
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
async function searchResources(query, resourceType, goldenPath) {
    if (!query || query.trim().length === 0) {
        return {
            success: false,
            message: "Error: query is required",
        };
    }
    try {
        const goldenRepoPath = goldenPath || (await ensureGoldenRepo());
        const type = resourceType || "all";
        const results = [];
        // Search context files
        if (type === "all" || type === "context") {
            const contextDir = path.join(goldenRepoPath, "context");
            try {
                const entries = await fs.readdir(contextDir);
                for (const entry of entries) {
                    if (!entry.endsWith(".md"))
                        continue;
                    const filePath = path.join(contextDir, entry);
                    const name = entry.replace(/\.md$/, "");
                    const result = await searchInFile(filePath, query, name, "context");
                    if (result)
                        results.push(result);
                }
            }
            catch {
                // Directory doesn't exist
            }
        }
        // Search skills
        if (type === "all" || type === "skills") {
            const skillsDir = path.join(goldenRepoPath, "skills");
            try {
                const entries = await fs.readdir(skillsDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
                    const result = await searchInFile(skillFile, query, entry.name, "skill");
                    if (result)
                        results.push(result);
                }
            }
            catch {
                // Directory doesn't exist
            }
        }
        // Search templates
        if (type === "all" || type === "templates") {
            const templatesDir = path.join(goldenRepoPath, "templates");
            try {
                const entries = await fs.readdir(templatesDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const templateFile = path.join(templatesDir, entry.name, "CLAUDE.md");
                    const result = await searchInFile(templateFile, query, entry.name, "template");
                    if (result)
                        results.push(result);
                }
            }
            catch {
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
        }
        else {
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
    }
    catch (error) {
        return {
            success: false,
            message: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
// ============================================================================
// Resource Creation (foundry_new)
// ============================================================================
/**
 * Context file template
 */
function getContextTemplate(name, description) {
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
/**
 * Skill SKILL.md template
 */
function getSkillTemplate(name, description) {
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
/**
 * Skill example template
 */
function getSkillExampleTemplate(skillName) {
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
/**
 * Create a new resource
 */
async function createNewResource(resourceType, name, description, projectPath) {
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
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to create resource: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
/**
 * Validate a context file
 */
async function validateContextFile(filePath, name) {
    const errors = [];
    const warnings = [];
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
    }
    else if (wordCount < 100) {
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
/**
 * Validate a skill
 */
async function validateSkill(skillDir, name) {
    const errors = [];
    const warnings = [];
    // Check directory exists
    if (!(await directoryExists(skillDir))) {
        return { valid: false, errors: [`Skill directory not found: ${skillDir}`], warnings: [] };
    }
    // Check SKILL.md exists
    const skillFile = path.join(skillDir, "SKILL.md");
    if (!(await fileExists(skillFile))) {
        errors.push("Missing SKILL.md file");
    }
    else {
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
        }
        else if (wordCount < 100) {
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
    }
    else {
        // Check for at least one example
        try {
            const examples = await fs.readdir(examplesDir);
            const mdFiles = examples.filter(e => e.endsWith(".md"));
            if (mdFiles.length === 0) {
                warnings.push("No example files in examples/");
            }
        }
        catch {
            warnings.push("Could not read examples/ directory");
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Validate a resource
 */
async function validateResource(resourceType, name, projectPath) {
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
    let result;
    if (resourceType === "context") {
        const filePath = path.join(claudeDir, "context", `${name}.md`);
        result = await validateContextFile(filePath, name);
    }
    else if (resourceType === "skill") {
        const skillDir = path.join(claudeDir, "skills", name);
        result = await validateSkill(skillDir, name);
    }
    else {
        return {
            success: false,
            message: `Unknown resource type: ${resourceType}. Use 'context' or 'skill'.`,
        };
    }
    // Format output
    let output = `Validation: ${name} (${resourceType})\n${"═".repeat(60)}\n\n`;
    if (result.valid) {
        output += `✓ VALID - Resource passes all required checks\n\n`;
    }
    else {
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
    }
    else if (result.valid) {
        output += `${"─".repeat(40)}\n`;
        output += `Resource is valid but has warnings. Consider addressing them.\n`;
        output += `\n→ foundry_promote type="${resourceType}" name="${name}"`;
    }
    else {
        output += `${"─".repeat(40)}\n`;
        output += `Fix the errors above before promoting.`;
    }
    return { success: result.valid, message: output };
}
// ============================================================================
// Resource Promotion (foundry_promote)
// ============================================================================
/**
 * Promote a resource to the golden repository
 */
async function promoteResource(resourceType, name, message, projectPath) {
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
    // First, validate the resource
    let validationResult;
    let sourcePath;
    let destPath;
    if (resourceType === "context") {
        sourcePath = path.join(claudeDir, "context", `${name}.md`);
        destPath = `context/${name}.md`;
        validationResult = await validateContextFile(sourcePath, name);
    }
    else if (resourceType === "skill") {
        sourcePath = path.join(claudeDir, "skills", name);
        destPath = `skills/${name}`;
        validationResult = await validateSkill(sourcePath, name);
    }
    else {
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
        await execAsync("gh --version");
    }
    catch {
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
        await execAsync(`git checkout -b "${branchName}"`, { cwd: goldenPath });
        // Copy resource files
        if (resourceType === "context") {
            const destFilePath = path.join(goldenPath, destPath);
            await fs.mkdir(path.dirname(destFilePath), { recursive: true });
            await fs.copyFile(sourcePath, destFilePath);
        }
        else {
            const destDirPath = path.join(goldenPath, destPath);
            await fs.rm(destDirPath, { recursive: true, force: true });
            await copyDirectory(sourcePath, destDirPath);
        }
        // Stage changes
        await execAsync(`git add "${destPath}"`, { cwd: goldenPath });
        // Commit
        const commitMsg = `Add ${resourceType}: ${name}`;
        await execAsync(`git commit -m "${commitMsg}"`, { cwd: goldenPath });
        // Push branch
        await execAsync(`git push -u origin "${branchName}"`, { cwd: goldenPath });
        // Create PR
        const prCommand = `gh pr create --title "${prTitle}" --body "${prBody.replace(/"/g, '\\"')}"`;
        const { stdout: prUrl } = await execAsync(prCommand, { cwd: goldenPath });
        // Switch back to main branch
        await execAsync("git checkout main", { cwd: goldenPath });
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
    }
    catch (error) {
        // Try to recover - switch back to main
        try {
            const goldenPath = CONFIG.cacheDir;
            await execAsync("git checkout main", { cwd: goldenPath });
        }
        catch {
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
// Approved external sources (team-vetted) - fallback if registry file not found
const APPROVED_SOURCES = [
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
/**
 * Load external registry from golden repo
 */
async function loadExternalRegistry(goldenPath) {
    const registryPath = path.join(goldenPath, "external-registry.json");
    try {
        const content = await fs.readFile(registryPath, "utf-8");
        const registry = JSON.parse(content);
        return (registry.approved || []).map((item) => ({
            name: item.name,
            type: "approved",
            repo: item.repo,
            description: item.description,
        }));
    }
    catch {
        // Fallback to hardcoded list
        return APPROVED_SOURCES;
    }
}
/**
 * Parse external source string
 */
function parseExternalSource(source) {
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
/**
 * Get external sources config file path
 */
function getExternalConfigPath(projectPath) {
    return path.join(projectPath, ".claude", "foundry-external.json");
}
/**
 * Read external sources config
 */
async function readExternalConfig(projectPath) {
    const configPath = getExternalConfigPath(projectPath);
    try {
        const content = await fs.readFile(configPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return { sources: [] };
    }
}
/**
 * Write external sources config
 */
async function writeExternalConfig(projectPath, config) {
    const configPath = getExternalConfigPath(projectPath);
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
/**
 * Handle external plugin management
 */
async function handleExternal(action, source, projectPath, goldenPath) {
    const claudeDir = path.join(projectPath, ".claude");
    // Load registry from golden repo (with fallback to hardcoded)
    let approvedSources;
    try {
        const goldenRepoPath = goldenPath || (await ensureGoldenRepo());
        approvedSources = await loadExternalRegistry(goldenRepoPath);
    }
    catch {
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
        }
        else if (parsed.type === "github" && parsed.repo) {
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
/**
 * Get lock file path
 */
function getLockFilePath(projectPath) {
    return path.join(projectPath, ".claude", "foundry.lock");
}
/**
 * Read lock file
 */
async function readLockFile(projectPath) {
    const lockPath = getLockFilePath(projectPath);
    try {
        const content = await fs.readFile(lockPath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return { version: "1.0", resources: [] };
    }
}
/**
 * Write lock file
 */
async function writeLockFile(projectPath, lock) {
    const lockPath = getLockFilePath(projectPath);
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
}
/**
 * Generate simple hash for content
 */
function generateHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
}
/**
 * Handle version management
 */
async function handleVersion(action, resource, version, projectPath) {
    const claudeDir = path.join(projectPath, ".claude");
    if (!(await directoryExists(claudeDir))) {
        return {
            success: false,
            message: `Project doesn't have a .claude/ directory at ${projectPath}`,
        };
    }
    if (action === "status") {
        const lock = await readLockFile(projectPath);
        let output = `Resource Versions\n${"═".repeat(60)}\n`;
        output += `Lock file: .claude/foundry.lock\n\n`;
        if (lock.resources.length === 0) {
            // Scan installed resources and create entries
            const contextDir = path.join(claudeDir, "context");
            const skillsDir = path.join(claudeDir, "skills");
            const resources = [];
            // Scan context files
            try {
                const contextFiles = await fs.readdir(contextDir);
                for (const file of contextFiles) {
                    if (file.endsWith(".md")) {
                        const content = await fs.readFile(path.join(contextDir, file), "utf-8");
                        resources.push({
                            name: file.replace(/\.md$/, ""),
                            type: "context",
                            version: "1.0.0",
                            hash: generateHash(content),
                            installedAt: new Date().toISOString(),
                            source: "golden",
                        });
                    }
                }
            }
            catch {
                // No context directory
            }
            // Scan skills
            try {
                const skillDirs = await fs.readdir(skillsDir, { withFileTypes: true });
                for (const dir of skillDirs) {
                    if (dir.isDirectory()) {
                        const skillFile = path.join(skillsDir, dir.name, "SKILL.md");
                        try {
                            const content = await fs.readFile(skillFile, "utf-8");
                            resources.push({
                                name: dir.name,
                                type: "skill",
                                version: "1.0.0",
                                hash: generateHash(content),
                                installedAt: new Date().toISOString(),
                                source: "golden",
                            });
                        }
                        catch {
                            // No SKILL.md
                        }
                    }
                }
            }
            catch {
                // No skills directory
            }
            // Save lock file
            if (resources.length > 0) {
                await writeLockFile(projectPath, { version: "1.0", resources });
                output += `📝 Created lock file with ${resources.length} resource(s)\n\n`;
            }
            lock.resources = resources;
        }
        if (lock.resources.length === 0) {
            output += `No resources tracked.\n`;
            output += `\nAdd resources with foundry_add to start tracking versions.`;
        }
        else {
            output += `${"─".repeat(40)}\n`;
            output += `TRACKED RESOURCES (${lock.resources.length})\n`;
            output += `${"─".repeat(40)}\n\n`;
            // Group by type
            const contexts = lock.resources.filter(r => r.type === "context");
            const skills = lock.resources.filter(r => r.type === "skill");
            if (contexts.length > 0) {
                output += `📄 Context Files:\n`;
                for (const r of contexts) {
                    output += `  • ${r.name} v${r.version} (${r.hash.slice(0, 8)})\n`;
                }
                output += "\n";
            }
            if (skills.length > 0) {
                output += `🛠️  Skills:\n`;
                for (const r of skills) {
                    output += `  • ${r.name} v${r.version} (${r.hash.slice(0, 8)})\n`;
                }
            }
        }
        return { success: true, message: output };
    }
    if (action === "check") {
        const lock = await readLockFile(projectPath);
        let output = `Update Check\n${"═".repeat(60)}\n\n`;
        if (lock.resources.length === 0) {
            output += `No resources tracked. Run foundry_version action="status" first.`;
            return { success: true, message: output };
        }
        // Check for updates by comparing hashes with golden repo
        let updatesAvailable = 0;
        const goldenPath = await ensureGoldenRepo();
        for (const resource of lock.resources) {
            let currentHash = "";
            if (resource.type === "context") {
                const filePath = path.join(goldenPath, "context", `${resource.name}.md`);
                try {
                    const content = await fs.readFile(filePath, "utf-8");
                    currentHash = generateHash(content);
                }
                catch {
                    continue;
                }
            }
            else if (resource.type === "skill") {
                const filePath = path.join(goldenPath, "skills", resource.name, "SKILL.md");
                try {
                    const content = await fs.readFile(filePath, "utf-8");
                    currentHash = generateHash(content);
                }
                catch {
                    continue;
                }
            }
            if (currentHash && currentHash !== resource.hash) {
                updatesAvailable++;
                output += `📦 ${resource.name} (${resource.type})\n`;
                output += `   Installed: ${resource.hash.slice(0, 8)} → Available: ${currentHash.slice(0, 8)}\n\n`;
            }
        }
        if (updatesAvailable === 0) {
            output += `✓ All resources are up to date!\n`;
        }
        else {
            output += `${"─".repeat(40)}\n`;
            output += `${updatesAvailable} update(s) available.\n`;
            output += `Run foundry_sync dryRun=false to update.`;
        }
        return { success: true, message: output };
    }
    if (action === "pin") {
        if (!resource) {
            return { success: false, message: "Error: resource is required for pin action" };
        }
        const lock = await readLockFile(projectPath);
        const entry = lock.resources.find(r => r.name === resource);
        if (!entry) {
            return {
                success: false,
                message: `Resource not tracked: ${resource}\n\nRun foundry_version action="status" to see tracked resources.`,
            };
        }
        const pinnedVersion = version || entry.version;
        entry.version = pinnedVersion;
        await writeLockFile(projectPath, lock);
        return {
            success: true,
            message: `Pinned ${resource} to version ${pinnedVersion}

This version will be preserved during sync operations.`,
        };
    }
    if (action === "history") {
        // Show git log for a resource in golden repo
        if (!resource) {
            return { success: false, message: "Error: resource is required for history action" };
        }
        const goldenPath = await ensureGoldenRepo();
        let resourcePath = "";
        // Determine resource path
        const lock = await readLockFile(projectPath);
        const entry = lock.resources.find(r => r.name === resource);
        if (entry) {
            if (entry.type === "context") {
                resourcePath = `context/${resource}.md`;
            }
            else {
                resourcePath = `skills/${resource}`;
            }
        }
        else {
            // Try to guess
            resourcePath = `context/${resource}.md`;
        }
        try {
            const { stdout } = await execAsync(`git log --oneline -10 -- "${resourcePath}"`, { cwd: goldenPath });
            if (stdout.trim()) {
                let output = `Version History: ${resource}\n${"═".repeat(60)}\n\n`;
                output += `Path: ${resourcePath}\n\n`;
                output += `Recent commits:\n`;
                output += stdout.split("\n").map(line => `  ${line}`).join("\n");
                return { success: true, message: output };
            }
            else {
                return {
                    success: true,
                    message: `No history found for ${resource}.\n\nThe resource may be new or not yet committed.`,
                };
            }
        }
        catch {
            return {
                success: false,
                message: `Could not get history for ${resource}`,
            };
        }
    }
    return { success: false, message: `Unknown action: ${action}` };
}
// Built-in templates
const TEMPLATES = [
    {
        name: "sparc-starter",
        description: "Full SPARC methodology template with all resources",
        includes: { context: true, skills: true, claudeMd: true },
        features: [
            "SPARC methodology structure",
            "All context files (Now Assist, GenAI, Agentic)",
            "All skills with examples",
            "Comprehensive CLAUDE.md",
        ],
    },
    {
        name: "minimal",
        description: "Bare-bones template with just CLAUDE.md",
        includes: { context: false, skills: false, claudeMd: true },
        features: [
            "Minimal CLAUDE.md",
            "No pre-loaded resources",
            "Fastest to set up",
            "Add resources as needed",
        ],
    },
    {
        name: "standard",
        description: "Standard template with core context, no skills",
        includes: { context: true, skills: false, claudeMd: true },
        features: [
            "Core context files only",
            "No skills pre-loaded",
            "Balanced starting point",
            "Add skills as needed",
        ],
    },
];
/**
 * Handle templates management
 */
async function handleTemplates(action, template, compare) {
    const goldenPath = await ensureGoldenRepo();
    if (action === "list" || !action) {
        let output = `Available Templates\n${"═".repeat(60)}\n\n`;
        for (const tmpl of TEMPLATES) {
            output += `📋 ${tmpl.name}\n`;
            output += `${"─".repeat(40)}\n`;
            output += `${tmpl.description}\n\n`;
            output += `Includes:\n`;
            output += `  • Context files: ${tmpl.includes.context ? "Yes" : "No"}\n`;
            output += `  • Skills: ${tmpl.includes.skills ? "Yes" : "No"}\n`;
            output += `  • CLAUDE.md: ${tmpl.includes.claudeMd ? "Yes" : "No"}\n\n`;
            output += `Features:\n`;
            for (const feature of tmpl.features) {
                output += `  ✓ ${feature}\n`;
            }
            output += "\n";
        }
        output += `${"─".repeat(40)}\n`;
        output += `Use: foundry_init projectName="name" template="template-name"`;
        return { success: true, message: output };
    }
    if (action === "preview") {
        if (!template) {
            return { success: false, message: "Error: template is required for preview action" };
        }
        const tmpl = TEMPLATES.find(t => t.name === template);
        if (!tmpl) {
            return {
                success: false,
                message: `Unknown template: ${template}\n\nAvailable: ${TEMPLATES.map(t => t.name).join(", ")}`,
            };
        }
        let output = `Template Preview: ${tmpl.name}\n${"═".repeat(60)}\n\n`;
        output += `${tmpl.description}\n\n`;
        // Show what would be created
        output += `Project Structure:\n`;
        output += `${"─".repeat(40)}\n`;
        output += `project-name/\n`;
        output += `├── CLAUDE.md\n`;
        output += `├── .gitignore\n`;
        output += `└── .claude/\n`;
        if (tmpl.includes.context) {
            output += `    ├── context/\n`;
            // List actual context files
            const contextDir = path.join(goldenPath, "context");
            try {
                const files = await fs.readdir(contextDir);
                const mdFiles = files.filter(f => f.endsWith(".md"));
                for (let i = 0; i < mdFiles.length; i++) {
                    const prefix = i === mdFiles.length - 1 && !tmpl.includes.skills ? "└──" : "├──";
                    output += `    │   ${prefix} ${mdFiles[i]}\n`;
                }
            }
            catch {
                output += `    │   └── (context files)\n`;
            }
        }
        if (tmpl.includes.skills) {
            output += `    └── skills/\n`;
            // List actual skills
            const skillsDir = path.join(goldenPath, "skills");
            try {
                const dirs = await fs.readdir(skillsDir, { withFileTypes: true });
                const skillDirs = dirs.filter(d => d.isDirectory());
                for (let i = 0; i < skillDirs.length; i++) {
                    const prefix = i === skillDirs.length - 1 ? "└──" : "├──";
                    output += `        ${prefix} ${skillDirs[i].name}/\n`;
                }
            }
            catch {
                output += `        └── (skill directories)\n`;
            }
        }
        return { success: true, message: output };
    }
    if (action === "compare") {
        if (!template || !compare) {
            return {
                success: false,
                message: "Error: template and compare are required for compare action",
            };
        }
        const tmpl1 = TEMPLATES.find(t => t.name === template);
        const tmpl2 = TEMPLATES.find(t => t.name === compare);
        if (!tmpl1) {
            return { success: false, message: `Unknown template: ${template}` };
        }
        if (!tmpl2) {
            return { success: false, message: `Unknown template: ${compare}` };
        }
        let output = `Template Comparison\n${"═".repeat(60)}\n\n`;
        output += `${tmpl1.name} vs ${tmpl2.name}\n\n`;
        output += `${"─".repeat(40)}\n`;
        output += `| Feature          | ${tmpl1.name.padEnd(15)} | ${tmpl2.name.padEnd(15)} |\n`;
        output += `${"─".repeat(40)}\n`;
        output += `| Context files    | ${(tmpl1.includes.context ? "Yes" : "No").padEnd(15)} | ${(tmpl2.includes.context ? "Yes" : "No").padEnd(15)} |\n`;
        output += `| Skills           | ${(tmpl1.includes.skills ? "Yes" : "No").padEnd(15)} | ${(tmpl2.includes.skills ? "Yes" : "No").padEnd(15)} |\n`;
        output += `| CLAUDE.md        | ${(tmpl1.includes.claudeMd ? "Yes" : "No").padEnd(15)} | ${(tmpl2.includes.claudeMd ? "Yes" : "No").padEnd(15)} |\n`;
        output += `${"─".repeat(40)}\n`;
        // Recommend based on use case
        output += `\nRecommendation:\n`;
        if (tmpl1.includes.skills && !tmpl2.includes.skills) {
            output += `  • Use ${tmpl1.name} for comprehensive setup\n`;
            output += `  • Use ${tmpl2.name} for faster, lighter projects\n`;
        }
        else if (!tmpl1.includes.skills && tmpl2.includes.skills) {
            output += `  • Use ${tmpl2.name} for comprehensive setup\n`;
            output += `  • Use ${tmpl1.name} for faster, lighter projects\n`;
        }
        else {
            output += `  • Both templates have similar scope\n`;
        }
        return { success: true, message: output };
    }
    return { success: false, message: `Unknown action: ${action}` };
}
/**
 * Main server setup
 */
async function main() {
    const server = new Server({
        name: "foundry-mcp",
        version: "0.1.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    // Handle tool listing
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                FOUNDRY_INIT_TOOL,
                FOUNDRY_LIST_TOOL,
                FOUNDRY_ADD_TOOL,
                FOUNDRY_SYNC_TOOL,
                FOUNDRY_INFO_TOOL,
                FOUNDRY_SEARCH_TOOL,
                FOUNDRY_NEW_TOOL,
                FOUNDRY_VALIDATE_TOOL,
                FOUNDRY_PROMOTE_TOOL,
                FOUNDRY_EXTERNAL_TOOL,
                FOUNDRY_VERSION_TOOL,
                FOUNDRY_TEMPLATES_TOOL,
                ...SERVICENOW_TOOLS,
            ],
        };
    });
    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        // Check if this is a ServiceNow tool
        if (isServiceNowTool(name)) {
            const result = await handleServiceNowTool(name, (args || {}));
            if (result) {
                return result;
            }
        }
        if (name === "foundry_init") {
            const projectName = args?.projectName;
            const parentPath = args?.path || process.cwd();
            const template = args?.template || "sparc-starter";
            const goldenPath = args?.goldenPath;
            if (!projectName) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: projectName is required",
                        },
                    ],
                    isError: true,
                };
            }
            const result = await initializeProject(projectName, parentPath, goldenPath, template);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_list") {
            const resourceType = args?.type || "all";
            const verbose = args?.verbose === true;
            const result = await listResources(resourceType, verbose);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_add") {
            const resourceType = args?.type;
            const resourceName = args?.name;
            const projectPath = args?.projectPath || process.cwd();
            const force = args?.force === true;
            const result = await addResource(resourceType, resourceName, projectPath, force);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_sync") {
            const projectPath = args?.projectPath || process.cwd();
            const dryRun = args?.dryRun !== false; // Default to true for safety
            const resourceType = args?.type || "all";
            const result = await syncResources(projectPath, dryRun, resourceType);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_info") {
            const resourceType = args?.type;
            const resourceName = args?.name;
            const result = await getResourceInfo(resourceType, resourceName);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_search") {
            const query = args?.query;
            const resourceType = args?.type || "all";
            const result = await searchResources(query, resourceType);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_new") {
            const resourceType = args?.type;
            const resourceName = args?.name;
            const description = args?.description || "";
            const projectPath = args?.projectPath || process.cwd();
            const result = await createNewResource(resourceType, resourceName, description, projectPath);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_validate") {
            const resourceType = args?.type;
            const resourceName = args?.name;
            const projectPath = args?.projectPath || process.cwd();
            const result = await validateResource(resourceType, resourceName, projectPath);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_promote") {
            const resourceType = args?.type;
            const resourceName = args?.name;
            const message = args?.message || "";
            const projectPath = args?.projectPath || process.cwd();
            const result = await promoteResource(resourceType, resourceName, message, projectPath);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_external") {
            const action = args?.action;
            const source = args?.source;
            const projectPath = args?.projectPath || process.cwd();
            const result = await handleExternal(action, source, projectPath);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_version") {
            const action = args?.action;
            const resource = args?.resource;
            const version = args?.version;
            const projectPath = args?.projectPath || process.cwd();
            const result = await handleVersion(action, resource, version, projectPath);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        if (name === "foundry_templates") {
            const action = args?.action || "list";
            const template = args?.template;
            const compare = args?.compare;
            const result = await handleTemplates(action, template, compare);
            return {
                content: [
                    {
                        type: "text",
                        text: result.message,
                    },
                ],
                isError: !result.success,
            };
        }
        return {
            content: [
                {
                    type: "text",
                    text: `Unknown tool: ${name}`,
                },
            ],
            isError: true,
        };
    });
    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Foundry MCP server started");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map