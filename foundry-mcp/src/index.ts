#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  // GitHub repo URL for foundry-golden
  goldenRepoUrl: "https://github.com/gapietro/foundry-golden.git",
  // Local cache directory for the golden repo
  cacheDir: path.join(
    process.env.HOME || process.env.USERPROFILE || "~",
    ".foundry",
    "golden"
  ),
  // How old (in hours) before we refresh the cache
  cacheMaxAgeHours: 24,
};

// Tool definition
const FOUNDRY_INIT_TOOL: Tool = {
  name: "foundry_init",
  description:
    "Bootstrap a new Now Assist POC project with pre-loaded context, skills, and SPARC template from the Foundry golden repository.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectName: {
        type: "string",
        description:
          "Name of the project directory to create (e.g., 'my-poc', 'customer-demo')",
      },
      path: {
        type: "string",
        description:
          "Parent directory where the project will be created. Defaults to current working directory.",
      },
      goldenPath: {
        type: "string",
        description:
          "Optional: Local path to foundry-golden repo. If provided, uses this instead of cloning from GitHub.",
      },
    },
    required: ["projectName"],
  },
};

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
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
 */
async function ensureGoldenRepo(): Promise<string> {
  const exists = await directoryExists(CONFIG.cacheDir);

  if (exists) {
    // Check if we should update
    if (await isCacheStale()) {
      try {
        await execAsync("git pull --ff-only", { cwd: CONFIG.cacheDir });
        await updateCacheTimestamp();
      } catch {
        // Pull failed, but we still have a cached version - continue
        console.error(
          "Warning: Could not update golden repo cache, using existing version"
        );
      }
    }
  } else {
    // Clone fresh
    await fs.mkdir(path.dirname(CONFIG.cacheDir), { recursive: true });
    try {
      await execAsync(`git clone ${CONFIG.goldenRepoUrl} "${CONFIG.cacheDir}"`);
      await updateCacheTimestamp();
    } catch (error) {
      throw new Error(
        `Failed to clone golden repository: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return CONFIG.cacheDir;
}

/**
 * Copy a directory recursively
 */
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
async function initializeProject(
  projectName: string,
  parentPath: string,
  goldenPath?: string
): Promise<{ success: boolean; message: string; projectPath?: string }> {
  // Validate project name
  if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
    return {
      success: false,
      message:
        "Invalid project name. Use only letters, numbers, hyphens, and underscores.",
    };
  }

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

  if (!(await directoryExists(contextDir))) {
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

    // Copy context files
    const destContextDir = path.join(claudeDir, "context");
    await copyDirectory(contextDir, destContextDir);

    // Copy skills
    if (await directoryExists(skillsDir)) {
      const destSkillsDir = path.join(claudeDir, "skills");
      await copyDirectory(skillsDir, destSkillsDir);
    }

    // Copy and process CLAUDE.md template
    const templateFile = path.join(templateDir, "CLAUDE.md");
    if (await directoryExists(templateDir)) {
      const processedTemplate = await processTemplate(templateFile, projectName);
      await fs.writeFile(
        path.join(projectPath, "CLAUDE.md"),
        processedTemplate
      );
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

    return {
      success: true,
      projectPath,
      message: `Project "${projectName}" created successfully at ${projectPath}

Included resources:
- Context: Now Assist platform, GenAI framework, Agentic patterns
- Skills: Now Assist skill builder, API integration
- Template: SPARC methodology starter

Next steps:
1. cd ${projectPath}
2. Review CLAUDE.md and update project details
3. Start building with Claude Code!

The .claude/ directory contains pre-loaded context and skills that Claude Code will use automatically.`,
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
 * Main server setup
 */
async function main() {
  const server = new Server(
    {
      name: "foundry-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [FOUNDRY_INIT_TOOL],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "foundry_init") {
      const projectName = args?.projectName as string;
      const parentPath = (args?.path as string) || process.cwd();
      const goldenPath = args?.goldenPath as string | undefined;

      if (!projectName) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: projectName is required",
            },
          ],
          isError: true,
        };
      }

      const result = await initializeProject(
        projectName,
        parentPath,
        goldenPath
      );

      return {
        content: [
          {
            type: "text" as const,
            text: result.message,
          },
        ],
        isError: !result.success,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
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
