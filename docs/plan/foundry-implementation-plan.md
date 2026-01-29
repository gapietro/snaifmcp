# Foundry Implementation Plan

## Project Overview

Build "Foundry" - a Golden Repository framework and MCP server that enables the AI Foundry team to curate, distribute, and contribute Claude Code resources (skills, agents, context, prompts, MCP servers, commands).

**Repository Structure:**
- `foundry-golden` - The golden repository containing all approved resources
- `foundry-mcp` - The MCP server package that interfaces with Claude Code

---

## Phase 1: Foundation (Sprint 1-2)

### 1.1 Golden Repository Setup

**Create `foundry-golden` repository with this structure:**

```
foundry-golden/
├── .foundry/
│   ├── registry.json              # Master index of all internal resources
│   ├── external-registry.json     # Approved external plugins
│   └── schemas/
│       ├── manifest.schema.json   # JSON schema for manifest validation
│       ├── skill.schema.json
│       ├── agent.schema.json
│       ├── context.schema.json
│       ├── prompt.schema.json
│       ├── mcp.schema.json
│       └── command.schema.json
│
├── skills/
│   └── .gitkeep
│
├── agents/
│   └── .gitkeep
│
├── context/
│   └── .gitkeep
│
├── prompts/
│   ├── templates/
│   └── fragments/
│
├── mcp/
│   └── .gitkeep
│
├── commands/
│   └── .gitkeep
│
├── bootstrap/
│   └── templates/
│       ├── minimal/
│       │   └── template.json
│       ├── standard/
│       │   └── template.json
│       └── sparc-full/
│           └── template.json
│
└── README.md
```

**Files to create:**

#### `.foundry/registry.json`
```json
{
  "version": "1.0.0",
  "updated": "2025-01-28T00:00:00Z",
  "resources": {
    "skills": [],
    "agents": [],
    "context": [],
    "prompts": [],
    "mcp": [],
    "commands": []
  }
}
```

#### `.foundry/external-registry.json`
```json
{
  "version": "1.0.0",
  "updated": "2025-01-28T00:00:00Z",
  "approved": []
}
```

#### `.foundry/schemas/manifest.schema.json`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "type", "version", "description", "author", "entrypoint"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "type": {
      "type": "string",
      "enum": ["skill", "agent", "context", "prompt", "mcp", "command"]
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "description": {
      "type": "string",
      "maxLength": 200
    },
    "author": {
      "type": "string"
    },
    "created": {
      "type": "string",
      "format": "date"
    },
    "updated": {
      "type": "string",
      "format": "date"
    },
    "dependencies": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "name": { "type": "string" },
          "version": { "type": "string" }
        }
      }
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" }
    },
    "entrypoint": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": ["draft", "stable", "deprecated"],
      "default": "stable"
    }
  }
}
```

#### `bootstrap/templates/minimal/template.json`
```json
{
  "name": "minimal",
  "description": "Minimal Foundry project with no pre-loaded resources",
  "resources": {
    "internal": [],
    "external": []
  },
  "claudeMd": {
    "base": true,
    "stacks": [],
    "methodologies": [],
    "fragments": []
  }
}
```

#### `bootstrap/claude-md/` Structure
```
bootstrap/claude-md/
├── base.md                    # Universal best practices template
├── stacks/
│   ├── servicenow.md          # ServiceNow-specific patterns
│   ├── react.md               # React/frontend patterns
│   ├── python.md              # Python patterns
│   └── node.md                # Node.js patterns
├── methodologies/
│   ├── sparc.md               # SPARC methodology
│   └── agile.md               # Agile/Scrum patterns
└── fragments/
    ├── testing.md             # Testing best practices
    ├── git.md                 # Git workflow
    └── security.md            # Security considerations
```

The CLAUDE.md is composed during `foundry init` by combining:
1. Base template (universal best practices)
2. Stack templates (based on --stack flags or template config)
3. Methodology templates (based on --methodology flags)
4. Fragments (modular additions)
5. Foundry header (auto-generated resource listing)

#### `bootstrap/templates/standard/template.json`
```json
{
  "name": "standard",
  "description": "Standard Foundry project with common resources",
  "resources": {
    "internal": [
      { "type": "context", "name": "team-conventions", "version": "latest" }
    ],
    "external": [
      { "type": "skill-collection", "name": "superpowers", "version": "latest" }
    ]
  },
  "claudeMd": {
    "base": true,
    "stacks": [],
    "methodologies": [],
    "fragments": ["git", "testing"]
  }
}
```

#### `bootstrap/templates/sparc-full/template.json`
```json
{
  "name": "sparc-full",
  "description": "Full SPARC methodology project with ServiceNow resources",
  "resources": {
    "internal": [
      { "type": "context", "name": "team-conventions", "version": "latest" },
      { "type": "context", "name": "sparc-methodology", "version": "latest" },
      { "type": "context", "name": "servicenow-base", "version": "latest" },
      { "type": "agent", "name": "sparc-planner", "version": "latest" }
    ],
    "external": [
      { "type": "skill-collection", "name": "superpowers", "version": "latest" }
    ]
  },
  "claudeMd": {
    "base": true,
    "stacks": ["servicenow"],
    "methodologies": ["sparc"],
    "fragments": ["git", "testing", "documentation"]
  }
}
```

---

### 1.2 MCP Server Core

**Create `foundry-mcp` package:**

```
foundry-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── config.ts                   # Configuration management
│   ├── tools/
│   │   ├── index.ts                # Tool registration
│   │   ├── init.ts                 # foundry_init tool
│   │   ├── add.ts                  # foundry_add tool
│   │   ├── remove.ts               # foundry_remove tool
│   │   ├── sync.ts                 # foundry_sync tool
│   │   └── list.ts                 # foundry_list tool
│   ├── resources/
│   │   └── handlers.ts             # MCP resource handlers
│   ├── golden/
│   │   ├── client.ts               # GitHub API client
│   │   ├── cache.ts                # Local cache management
│   │   └── registry.ts             # Registry parsing
│   ├── project/
│   │   ├── manager.ts              # Project file operations
│   │   ├── linker.ts               # Resource linking logic
│   │   └── manifest.ts             # project.json handling
│   └── utils/
│       ├── semver.ts               # Version resolution
│       ├── git.ts                  # Git operations
│       └── fs.ts                   # File system helpers
├── bin/
│   └── foundry-mcp                 # CLI entry (for npx)
└── README.md
```

#### `package.json`
```json
{
  "name": "@servicenow-aif/foundry-mcp",
  "version": "0.1.0",
  "description": "MCP server for AI Foundry Golden Repository",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "foundry-mcp": "./bin/foundry-mcp"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@octokit/rest": "^20.0.0",
    "simple-git": "^3.22.0",
    "semver": "^7.5.0",
    "ajv": "^8.12.0",
    "fs-extra": "^11.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/semver": "^7.5.0",
    "@types/fs-extra": "^11.0.0",
    "typescript": "^5.3.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

#### `src/index.ts`
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/handlers.js";
import { loadConfig } from "./config.js";

async function main() {
  const config = await loadConfig();
  
  const server = new Server(
    {
      name: "foundry-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register all tools
  registerTools(server, config);
  
  // Register resource handlers
  registerResources(server, config);

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("Foundry MCP server started");
}

main().catch(console.error);
```

#### `src/config.ts`
```typescript
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface FoundryConfig {
  goldenRepo: string;
  branch: string;
  cacheDir: string;
  githubToken?: string;
}

export async function loadConfig(): Promise<FoundryConfig> {
  const configPath = join(homedir(), ".foundry", "config.json");
  
  const defaults: FoundryConfig = {
    goldenRepo: process.env.FOUNDRY_GOLDEN_REPO || "servicenow-aif/foundry-golden",
    branch: process.env.FOUNDRY_BRANCH || "main",
    cacheDir: join(homedir(), ".foundry", "cache"),
    githubToken: process.env.GITHUB_TOKEN,
  };

  if (existsSync(configPath)) {
    const userConfig = JSON.parse(readFileSync(configPath, "utf-8"));
    return { ...defaults, ...userConfig };
  }

  return defaults;
}
```

#### `src/tools/init.ts`
```typescript
import { ToolHandler } from "@modelcontextprotocol/sdk/types.js";
import { FoundryConfig } from "../config.js";
import { GoldenClient } from "../golden/client.js";
import { ProjectManager } from "../project/manager.js";

export interface InitParams {
  projectName: string;
  template?: "minimal" | "standard" | "sparc-full";
  resources?: Array<{ type: string; name: string; version?: string }>;
  path?: string;
}

export function createInitTool(config: FoundryConfig): ToolHandler {
  return async (params: InitParams) => {
    const {
      projectName,
      template = "minimal",
      resources = [],
      path = process.cwd(),
    } = params;

    const goldenClient = new GoldenClient(config);
    const projectManager = new ProjectManager(config);

    // 1. Fetch template from golden repo
    const templateConfig = await goldenClient.getTemplate(template);

    // 2. Create project directory structure
    const projectPath = await projectManager.createProject(projectName, path);

    // 3. Initialize .foundry directory
    await projectManager.initFoundryDir(projectPath);

    // 4. Merge template resources with explicit resources
    const allResources = [
      ...templateConfig.resources.internal,
      ...templateConfig.resources.external,
      ...resources,
    ];

    // 5. Link all resources
    const linkedResources = [];
    for (const resource of allResources) {
      const result = await projectManager.linkResource(
        projectPath,
        resource.type,
        resource.name,
        resource.version || "latest"
      );
      linkedResources.push(result);
    }

    // 6. Generate project.json
    await projectManager.createProjectManifest(projectPath, {
      name: projectName,
      template,
      resources: linkedResources,
    });

    // 7. Generate CLAUDE.md with Foundry header
    await projectManager.generateClaudeMd(projectPath, projectName, linkedResources);

    // 8. Update .claude/settings.json
    await projectManager.updateClaudeSettings(projectPath, linkedResources);

    return {
      success: true,
      projectPath,
      template,
      resources: linkedResources,
      message: `Created Foundry project "${projectName}" with ${linkedResources.length} resources`,
    };
  };
}
```

#### `src/tools/add.ts`
```typescript
import { ToolHandler } from "@modelcontextprotocol/sdk/types.js";
import { FoundryConfig } from "../config.js";
import { GoldenClient } from "../golden/client.js";
import { ProjectManager } from "../project/manager.js";
import { resolveNamespace, ResourceRef } from "../utils/namespace.js";

export interface AddParams {
  type: "skill" | "context" | "agent" | "prompt" | "mcp" | "command";
  name: string; // e.g., "@foundry/research" or "@approved/superpowers"
  version?: string;
}

export function createAddTool(config: FoundryConfig): ToolHandler {
  return async (params: AddParams) => {
    const { type, name, version = "latest" } = params;

    const goldenClient = new GoldenClient(config);
    const projectManager = new ProjectManager(config);

    // 1. Find project root (look for .foundry directory)
    const projectPath = await projectManager.findProjectRoot(process.cwd());
    if (!projectPath) {
      return {
        success: false,
        error: "Not in a Foundry project. Run foundry_init first.",
      };
    }

    // 2. Parse namespace
    const resourceRef = resolveNamespace(name);

    // 3. Fetch resource based on origin
    let resource;
    if (resourceRef.origin === "foundry") {
      resource = await goldenClient.getInternalResource(type, resourceRef.name);
    } else if (resourceRef.origin === "approved") {
      resource = await goldenClient.getApprovedExternal(resourceRef.name);
    } else {
      return {
        success: false,
        error: `Direct external references not yet supported. Use @approved/ namespace.`,
      };
    }

    if (!resource) {
      return {
        success: false,
        error: `Resource not found: ${name}`,
      };
    }

    // 4. Resolve version
    const resolvedVersion = await goldenClient.resolveVersion(
      resource,
      version
    );

    // 5. Check dependencies
    const deps = await goldenClient.resolveDependencies(resource, resolvedVersion);

    // 6. Link resource and dependencies
    const linked = [];
    for (const dep of [resource, ...deps]) {
      const result = await projectManager.linkResource(
        projectPath,
        dep.type,
        dep.fullName,
        dep.version
      );
      linked.push(result);
    }

    // 7. Update project.json
    await projectManager.addToManifest(projectPath, linked);

    // 8. Update CLAUDE.md header
    await projectManager.updateClaudeMdHeader(projectPath);

    // 9. Update .claude/settings.json if needed
    await projectManager.updateClaudeSettings(projectPath, linked);

    return {
      success: true,
      added: linked,
      message: `Added ${name}@${resolvedVersion}${deps.length > 0 ? ` with ${deps.length} dependencies` : ""}`,
    };
  };
}
```

#### `src/tools/sync.ts`
```typescript
import { ToolHandler } from "@modelcontextprotocol/sdk/types.js";
import { FoundryConfig } from "../config.js";
import { GoldenClient } from "../golden/client.js";
import { ProjectManager } from "../project/manager.js";

export interface SyncParams {
  dryRun?: boolean;
}

export function createSyncTool(config: FoundryConfig): ToolHandler {
  return async (params: SyncParams) => {
    const { dryRun = false } = params;

    const goldenClient = new GoldenClient(config);
    const projectManager = new ProjectManager(config);

    // 1. Find project root
    const projectPath = await projectManager.findProjectRoot(process.cwd());
    if (!projectPath) {
      return {
        success: false,
        error: "Not in a Foundry project.",
      };
    }

    // 2. Read current project.json
    const manifest = await projectManager.readManifest(projectPath);

    // 3. Refresh golden repo cache
    await goldenClient.refreshCache();

    // 4. Check each resource for updates
    const updates = [];
    const current = [];

    for (const resource of manifest.resources) {
      const latestVersion = await goldenClient.getLatestVersion(
        resource.type,
        resource.name,
        resource.versionSpec
      );

      if (latestVersion !== resource.lockedVersion) {
        updates.push({
          ...resource,
          currentVersion: resource.lockedVersion,
          newVersion: latestVersion,
        });
      } else {
        current.push(resource);
      }
    }

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        updates,
        current,
        message: updates.length > 0
          ? `${updates.length} resources would be updated`
          : "All resources are up to date",
      };
    }

    // 5. Apply updates
    for (const update of updates) {
      await projectManager.linkResource(
        projectPath,
        update.type,
        update.name,
        update.newVersion
      );
    }

    // 6. Update lock file
    await projectManager.updateLockFile(projectPath);

    // 7. Regenerate CLAUDE.md header
    await projectManager.updateClaudeMdHeader(projectPath);

    return {
      success: true,
      updated: updates,
      current,
      message: updates.length > 0
        ? `Updated ${updates.length} resources`
        : "All resources are up to date",
    };
  };
}
```

#### `src/tools/list.ts`
```typescript
import { ToolHandler } from "@modelcontextprotocol/sdk/types.js";
import { FoundryConfig } from "../config.js";
import { GoldenClient } from "../golden/client.js";
import { ProjectManager } from "../project/manager.js";

export interface ListParams {
  type?: "skill" | "context" | "agent" | "prompt" | "mcp" | "command";
  includeOutdated?: boolean;
}

export function createListTool(config: FoundryConfig): ToolHandler {
  return async (params: ListParams) => {
    const { type, includeOutdated = false } = params;

    const goldenClient = new GoldenClient(config);
    const projectManager = new ProjectManager(config);

    // 1. Find project root
    const projectPath = await projectManager.findProjectRoot(process.cwd());
    if (!projectPath) {
      return {
        success: false,
        error: "Not in a Foundry project.",
      };
    }

    // 2. Read project manifest
    const manifest = await projectManager.readManifest(projectPath);

    // 3. Filter by type if specified
    let resources = manifest.resources;
    if (type) {
      resources = resources.filter((r) => r.type === type);
    }

    // 4. Check for outdated if requested
    if (includeOutdated) {
      await goldenClient.refreshCache();
      
      for (const resource of resources) {
        const latest = await goldenClient.getLatestVersion(
          resource.type,
          resource.name,
          resource.versionSpec
        );
        resource.latestVersion = latest;
        resource.outdated = latest !== resource.lockedVersion;
      }
    }

    // 5. Group by type for display
    const grouped = resources.reduce((acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    }, {} as Record<string, typeof resources>);

    return {
      success: true,
      resources: grouped,
      total: resources.length,
      outdated: includeOutdated
        ? resources.filter((r) => r.outdated).length
        : undefined,
    };
  };
}
```

#### `src/tools/index.ts`
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { FoundryConfig } from "../config.js";
import { createInitTool } from "./init.js";
import { createAddTool } from "./add.js";
import { createRemoveTool } from "./remove.js";
import { createSyncTool } from "./sync.js";
import { createListTool } from "./list.js";

export function registerTools(server: Server, config: FoundryConfig) {
  // foundry_init
  server.setRequestHandler("tools/call", async (request) => {
    if (request.params.name === "foundry_init") {
      const handler = createInitTool(config);
      return { content: [{ type: "text", text: JSON.stringify(await handler(request.params.arguments)) }] };
    }
    // ... handle other tools
  });

  // Register tool definitions
  server.setRequestHandler("tools/list", async () => {
    return {
      tools: [
        {
          name: "foundry_init",
          description: "Initialize a new Foundry project with optional template and resources",
          inputSchema: {
            type: "object",
            properties: {
              projectName: {
                type: "string",
                description: "Name of the project to create",
              },
              template: {
                type: "string",
                enum: ["minimal", "standard", "sparc-full"],
                description: "Project template to use",
              },
              resources: {
                type: "array",
                description: "Additional resources to include",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    name: { type: "string" },
                    version: { type: "string" },
                  },
                },
              },
            },
            required: ["projectName"],
          },
        },
        {
          name: "foundry_add",
          description: "Add a resource from the golden repo to the current project",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["skill", "context", "agent", "prompt", "mcp", "command"],
                description: "Type of resource to add",
              },
              name: {
                type: "string",
                description: "Resource name (e.g., @foundry/research or @approved/superpowers)",
              },
              version: {
                type: "string",
                description: "Version specifier (default: latest)",
              },
            },
            required: ["type", "name"],
          },
        },
        {
          name: "foundry_remove",
          description: "Remove a resource from the current project",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["skill", "context", "agent", "prompt", "mcp", "command"],
              },
              name: { type: "string" },
            },
            required: ["type", "name"],
          },
        },
        {
          name: "foundry_sync",
          description: "Sync project resources with the golden repo",
          inputSchema: {
            type: "object",
            properties: {
              dryRun: {
                type: "boolean",
                description: "Show what would be updated without applying changes",
              },
            },
          },
        },
        {
          name: "foundry_list",
          description: "List resources in the current project",
          inputSchema: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["skill", "context", "agent", "prompt", "mcp", "command"],
                description: "Filter by resource type",
              },
              includeOutdated: {
                type: "boolean",
                description: "Check and show outdated resources",
              },
            },
          },
        },
      ],
    };
  });
}
```

#### `src/golden/client.ts`
```typescript
import { Octokit } from "@octokit/rest";
import { FoundryConfig } from "../config.js";
import { CacheManager } from "./cache.js";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

export class GoldenClient {
  private octokit: Octokit;
  private cache: CacheManager;
  private config: FoundryConfig;

  constructor(config: FoundryConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.githubToken,
    });
    this.cache = new CacheManager(config.cacheDir);
  }

  async refreshCache(): Promise<void> {
    const [owner, repo] = this.config.goldenRepo.split("/");
    
    // Fetch latest commit
    const { data: ref } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${this.config.branch}`,
    });

    const latestSha = ref.object.sha;
    const cachedSha = await this.cache.getLatestSha();

    if (latestSha !== cachedSha) {
      // Download and extract repo
      const { data: archive } = await this.octokit.repos.downloadTarballArchive({
        owner,
        repo,
        ref: this.config.branch,
      });

      await this.cache.extractArchive(archive as ArrayBuffer, latestSha);
    }
  }

  async getRegistry(): Promise<any> {
    await this.cache.ensureExists();
    const registryPath = join(this.cache.getRepoPath(), ".foundry", "registry.json");
    return JSON.parse(readFileSync(registryPath, "utf-8"));
  }

  async getExternalRegistry(): Promise<any> {
    await this.cache.ensureExists();
    const registryPath = join(this.cache.getRepoPath(), ".foundry", "external-registry.json");
    return JSON.parse(readFileSync(registryPath, "utf-8"));
  }

  async getTemplate(name: string): Promise<any> {
    await this.cache.ensureExists();
    const templatePath = join(
      this.cache.getRepoPath(),
      "bootstrap",
      "templates",
      name,
      "template.json"
    );
    
    if (!existsSync(templatePath)) {
      throw new Error(`Template not found: ${name}`);
    }
    
    return JSON.parse(readFileSync(templatePath, "utf-8"));
  }

  async getInternalResource(type: string, name: string): Promise<any> {
    await this.cache.ensureExists();
    const resourcePath = join(
      this.cache.getRepoPath(),
      `${type}s`, // skills, agents, contexts, etc.
      name
    );

    if (!existsSync(resourcePath)) {
      return null;
    }

    const manifestPath = join(resourcePath, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

    return {
      ...manifest,
      path: resourcePath,
      origin: "foundry",
      fullName: `@foundry/${name}`,
    };
  }

  async getApprovedExternal(name: string): Promise<any> {
    const externalRegistry = await this.getExternalRegistry();
    const entry = externalRegistry.approved.find((e: any) => e.name === name);
    
    if (!entry) {
      return null;
    }

    return {
      ...entry,
      origin: "approved",
      fullName: `@approved/${name}`,
    };
  }

  async resolveVersion(resource: any, versionSpec: string): Promise<string> {
    if (versionSpec === "latest") {
      return resource.version;
    }
    // TODO: Implement semver resolution
    return versionSpec;
  }

  async resolveDependencies(resource: any, version: string): Promise<any[]> {
    const deps: any[] = [];
    
    if (resource.dependencies) {
      for (const dep of resource.dependencies) {
        const resolved = await this.getInternalResource(dep.type, dep.name);
        if (resolved) {
          deps.push(resolved);
          // Recursively resolve nested deps
          const nestedDeps = await this.resolveDependencies(resolved, dep.version);
          deps.push(...nestedDeps);
        }
      }
    }
    
    return deps;
  }

  async getLatestVersion(type: string, name: string, versionSpec: string): Promise<string> {
    const resource = await this.getInternalResource(type, name.replace("@foundry/", ""));
    return resource?.version || versionSpec;
  }
}
```

#### `src/project/manager.ts`
```typescript
import { FoundryConfig } from "../config.js";
import { join, dirname } from "path";
import { 
  existsSync, 
  mkdirSync, 
  writeFileSync, 
  readFileSync,
  cpSync 
} from "fs";

export class ProjectManager {
  private config: FoundryConfig;

  constructor(config: FoundryConfig) {
    this.config = config;
  }

  async findProjectRoot(startPath: string): Promise<string | null> {
    let current = startPath;
    
    while (current !== dirname(current)) {
      if (existsSync(join(current, ".foundry", "project.json"))) {
        return current;
      }
      current = dirname(current);
    }
    
    return null;
  }

  async createProject(name: string, basePath: string): Promise<string> {
    const projectPath = join(basePath, name);
    
    if (existsSync(projectPath)) {
      throw new Error(`Directory already exists: ${projectPath}`);
    }
    
    mkdirSync(projectPath, { recursive: true });
    return projectPath;
  }

  async initFoundryDir(projectPath: string): Promise<void> {
    const foundryDir = join(projectPath, ".foundry");
    const linkedDir = join(foundryDir, "linked");
    
    mkdirSync(foundryDir, { recursive: true });
    mkdirSync(linkedDir, { recursive: true });
    
    // Create subdirs for each resource type
    for (const type of ["skills", "agents", "context", "prompts", "mcp", "commands"]) {
      mkdirSync(join(linkedDir, type, "@foundry"), { recursive: true });
      mkdirSync(join(linkedDir, type, "@approved"), { recursive: true });
    }
  }

  async linkResource(
    projectPath: string,
    type: string,
    fullName: string,
    version: string
  ): Promise<any> {
    const [namespace, name] = this.parseFullName(fullName);
    const destDir = join(
      projectPath,
      ".foundry",
      "linked",
      `${type}s`,
      namespace,
      name
    );

    // Get source path from cache
    const sourcePath = join(
      this.config.cacheDir,
      "repo",
      `${type}s`,
      name
    );

    if (!existsSync(sourcePath)) {
      throw new Error(`Resource not found in cache: ${fullName}`);
    }

    // Copy resource to project
    mkdirSync(dirname(destDir), { recursive: true });
    cpSync(sourcePath, destDir, { recursive: true });

    // Write source metadata
    writeFileSync(
      join(destDir, ".foundry-source"),
      JSON.stringify({
        origin: namespace,
        name,
        version,
        linkedAt: new Date().toISOString(),
      })
    );

    return {
      type,
      namespace,
      name,
      fullName,
      version,
      path: destDir,
    };
  }

  async createProjectManifest(
    projectPath: string,
    config: {
      name: string;
      template: string;
      resources: any[];
    }
  ): Promise<void> {
    const manifest = {
      name: config.name,
      template: config.template,
      created: new Date().toISOString(),
      golden: {
        repo: this.config.goldenRepo,
        branch: this.config.branch,
      },
      resources: config.resources.map((r) => ({
        type: r.type,
        name: r.fullName,
        versionSpec: r.version,
        lockedVersion: r.version,
      })),
    };

    writeFileSync(
      join(projectPath, ".foundry", "project.json"),
      JSON.stringify(manifest, null, 2)
    );
  }

  async generateClaudeMd(
    projectPath: string,
    projectName: string,
    resources: any[]
  ): Promise<void> {
    const header = this.generateFoundryHeader(resources);
    const content = `# ${projectName}

${header}

## Project Context

Describe your project here.
`;

    writeFileSync(join(projectPath, "CLAUDE.md"), content);
  }

  generateFoundryHeader(resources: any[]): string {
    const grouped = resources.reduce((acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    }, {} as Record<string, any[]>);

    let header = `<!-- FOUNDRY:BEGIN - Do not edit this section manually -->
## Project Resources (Foundry Managed)

This project uses the following shared resources from the AI Foundry Golden Repo:

`;

    for (const [type, items] of Object.entries(grouped)) {
      header += `### ${type.charAt(0).toUpperCase() + type.slice(1)}s\n`;
      for (const item of items as any[]) {
        header += `- **${item.name}** (v${item.version})\n`;
      }
      header += "\n";
    }

    header += `Run \`foundry sync\` to update. Run \`foundry list --outdated\` to check for updates.
<!-- FOUNDRY:END -->`;

    return header;
  }

  async updateClaudeMdHeader(projectPath: string): Promise<void> {
    const claudeMdPath = join(projectPath, "CLAUDE.md");
    const manifest = await this.readManifest(projectPath);
    
    let content = readFileSync(claudeMdPath, "utf-8");
    const header = this.generateFoundryHeader(manifest.resources);
    
    // Replace existing header
    content = content.replace(
      /<!-- FOUNDRY:BEGIN -->[\s\S]*<!-- FOUNDRY:END -->/,
      header
    );
    
    writeFileSync(claudeMdPath, content);
  }

  async updateClaudeSettings(projectPath: string, resources: any[]): Promise<void> {
    const settingsDir = join(projectPath, ".claude");
    const settingsPath = join(settingsDir, "settings.json");
    
    mkdirSync(settingsDir, { recursive: true });
    
    let settings: any = {};
    if (existsSync(settingsPath)) {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    }
    
    // Add skill paths
    const skillResources = resources.filter((r) => r.type === "skill");
    settings.skills = settings.skills || [];
    
    for (const skill of skillResources) {
      const relativePath = `.foundry/linked/skills/${skill.namespace}/${skill.name}`;
      if (!settings.skills.includes(relativePath)) {
        settings.skills.push(relativePath);
      }
    }
    
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }

  async readManifest(projectPath: string): Promise<any> {
    const manifestPath = join(projectPath, ".foundry", "project.json");
    return JSON.parse(readFileSync(manifestPath, "utf-8"));
  }

  async addToManifest(projectPath: string, resources: any[]): Promise<void> {
    const manifest = await this.readManifest(projectPath);
    
    for (const resource of resources) {
      const existing = manifest.resources.find(
        (r: any) => r.name === resource.fullName && r.type === resource.type
      );
      
      if (!existing) {
        manifest.resources.push({
          type: resource.type,
          name: resource.fullName,
          versionSpec: resource.version,
          lockedVersion: resource.version,
        });
      }
    }
    
    writeFileSync(
      join(projectPath, ".foundry", "project.json"),
      JSON.stringify(manifest, null, 2)
    );
  }

  private parseFullName(fullName: string): [string, string] {
    const match = fullName.match(/^@(foundry|approved|local)\/(.+)$/);
    if (match) {
      return [`@${match[1]}`, match[2]];
    }
    return ["@local", fullName];
  }
}
```

---

## Phase 2: Discovery (Sprint 3-4)

### 2.1 Search & Catalog Tools

Add to `src/tools/`:

#### `src/tools/search.ts`
```typescript
export interface SearchParams {
  query: string;
  type?: ResourceType;
  origin?: "internal" | "approved" | "all";
  tags?: string[];
}

export function createSearchTool(config: FoundryConfig): ToolHandler {
  return async (params: SearchParams) => {
    const { query, type, origin = "all", tags } = params;
    
    const goldenClient = new GoldenClient(config);
    const results: any[] = [];
    
    // Search internal resources
    if (origin === "all" || origin === "internal") {
      const registry = await goldenClient.getRegistry();
      // Implement fuzzy search on name, description, tags
      const internalResults = searchRegistry(registry, query, type, tags);
      results.push(...internalResults.map(r => ({ ...r, origin: "internal" })));
    }
    
    // Search approved external
    if (origin === "all" || origin === "approved") {
      const externalRegistry = await goldenClient.getExternalRegistry();
      const externalResults = searchExternal(externalRegistry, query, type, tags);
      results.push(...externalResults.map(r => ({ ...r, origin: "approved" })));
    }
    
    return {
      success: true,
      results,
      total: results.length,
    };
  };
}
```

#### `src/tools/catalog.ts`
```typescript
export interface CatalogParams {
  type?: ResourceType;
  origin?: "internal" | "approved" | "all";
}

export function createCatalogTool(config: FoundryConfig): ToolHandler {
  return async (params: CatalogParams) => {
    const { type, origin = "all" } = params;
    
    const goldenClient = new GoldenClient(config);
    const catalog: any[] = [];
    
    if (origin === "all" || origin === "internal") {
      const registry = await goldenClient.getRegistry();
      for (const [resourceType, resources] of Object.entries(registry.resources)) {
        if (!type || type === resourceType) {
          catalog.push(...(resources as any[]).map(r => ({
            ...r,
            type: resourceType,
            namespace: "@foundry",
            origin: "internal",
          })));
        }
      }
    }
    
    if (origin === "all" || origin === "approved") {
      const externalRegistry = await goldenClient.getExternalRegistry();
      for (const entry of externalRegistry.approved) {
        if (!type || type === entry.resourceType) {
          catalog.push({
            name: entry.name,
            description: entry.description,
            type: entry.resourceType,
            namespace: "@approved",
            origin: "approved",
            source: entry.source,
          });
        }
      }
    }
    
    return {
      success: true,
      catalog,
      total: catalog.length,
    };
  };
}
```

#### `src/tools/info.ts`
```typescript
export interface InfoParams {
  name: string; // Full name with namespace
  includeVersions?: boolean;
}

export function createInfoTool(config: FoundryConfig): ToolHandler {
  return async (params: InfoParams) => {
    const { name, includeVersions = false } = params;
    
    const goldenClient = new GoldenClient(config);
    const resourceRef = resolveNamespace(name);
    
    let resource;
    if (resourceRef.origin === "foundry") {
      resource = await goldenClient.getInternalResource(
        resourceRef.type, 
        resourceRef.name
      );
    } else if (resourceRef.origin === "approved") {
      resource = await goldenClient.getApprovedExternal(resourceRef.name);
    }
    
    if (!resource) {
      return {
        success: false,
        error: `Resource not found: ${name}`,
      };
    }
    
    // Get version history if requested
    let versions;
    if (includeVersions) {
      versions = await goldenClient.getVersionHistory(resource);
    }
    
    return {
      success: true,
      resource: {
        ...resource,
        versions,
      },
    };
  };
}
```

### 2.2 External Registry Support

Update `GoldenClient` to handle approved externals:

```typescript
async fetchApprovedExternal(entry: any): Promise<string> {
  const { source } = entry;
  
  if (source.type === "github") {
    const [owner, repo] = source.repo.split("/");
    
    // Download specific ref
    const { data: archive } = await this.octokit.repos.downloadTarballArchive({
      owner,
      repo,
      ref: source.ref,
    });
    
    const extractPath = join(
      this.config.cacheDir,
      "external",
      entry.name,
      source.ref
    );
    
    await this.extractArchive(archive, extractPath);
    
    return extractPath;
  }
  
  if (source.type === "npm") {
    // Use npm to download package
    execSync(`npm pack ${source.package}@${source.version}`, {
      cwd: join(this.config.cacheDir, "external", entry.name),
    });
    
    // Extract tarball
    // ...
  }
  
  throw new Error(`Unknown source type: ${source.type}`);
}
```

---

## Phase 3: Contribution (Sprint 5-6)

### 3.1 Contribution Tools

#### `src/tools/new.ts`
```typescript
export interface NewParams {
  type: ResourceType;
  name: string;
  description?: string;
}

export function createNewTool(config: FoundryConfig): ToolHandler {
  return async (params: NewParams) => {
    const { type, name, description = "" } = params;
    
    const projectManager = new ProjectManager(config);
    const projectPath = await projectManager.findProjectRoot(process.cwd());
    
    if (!projectPath) {
      return {
        success: false,
        error: "Not in a Foundry project.",
      };
    }
    
    // Create local resource structure
    const resourcePath = join(projectPath, `${type}s`, name);
    
    if (existsSync(resourcePath)) {
      return {
        success: false,
        error: `Resource already exists: ${name}`,
      };
    }
    
    mkdirSync(resourcePath, { recursive: true });
    
    // Generate manifest
    const manifest = {
      name,
      type,
      version: "0.1.0",
      description,
      author: process.env.USER || "unknown",
      created: new Date().toISOString().split("T")[0],
      updated: new Date().toISOString().split("T")[0],
      dependencies: [],
      tags: [],
      entrypoint: getEntrypoint(type),
      status: "draft",
    };
    
    writeFileSync(
      join(resourcePath, "manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
    
    // Generate entrypoint file
    const entrypointContent = getEntrypointTemplate(type, name, description);
    writeFileSync(
      join(resourcePath, getEntrypoint(type)),
      entrypointContent
    );
    
    return {
      success: true,
      path: resourcePath,
      message: `Created ${type} scaffold at ${resourcePath}`,
      nextSteps: [
        `Edit ${getEntrypoint(type)} to define your ${type}`,
        "Update manifest.json with tags and dependencies",
        "Run foundry_validate to check before promoting",
      ],
    };
  };
}

function getEntrypoint(type: string): string {
  const entrypoints: Record<string, string> = {
    skill: "SKILL.md",
    agent: "AGENT.md",
    context: "CONTEXT.md",
    prompt: "PROMPT.md",
  };
  return entrypoints[type] || "README.md";
}

function getEntrypointTemplate(type: string, name: string, description: string): string {
  return `# ${name}

## Purpose
${description || "Describe the purpose of this " + type + "."}

## When to Use
- Describe when this ${type} should be used

## Instructions
<!-- Add ${type}-specific instructions here -->

## Examples
<!-- Add usage examples here -->
`;
}
```

#### `src/tools/validate.ts`
```typescript
export interface ValidateParams {
  type: ResourceType;
  name: string;
}

export function createValidateTool(config: FoundryConfig): ToolHandler {
  return async (params: ValidateParams) => {
    const { type, name } = params;
    
    const projectManager = new ProjectManager(config);
    const projectPath = await projectManager.findProjectRoot(process.cwd());
    
    const resourcePath = join(projectPath!, `${type}s`, name);
    
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check manifest exists
    const manifestPath = join(resourcePath, "manifest.json");
    if (!existsSync(manifestPath)) {
      issues.push("manifest.json is missing");
    } else {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      
      // Validate against schema
      const schemaErrors = validateManifestSchema(manifest);
      issues.push(...schemaErrors);
      
      // Check required fields
      if (!manifest.version || !manifest.version.match(/^\d+\.\d+\.\d+$/)) {
        issues.push("version must be valid semver (e.g., 1.0.0)");
      }
      
      if (!manifest.description || manifest.description.length < 10) {
        warnings.push("description should be at least 10 characters");
      }
      
      // Check dependencies exist
      if (manifest.dependencies) {
        for (const dep of manifest.dependencies) {
          const depExists = await checkDependencyExists(config, dep);
          if (!depExists) {
            issues.push(`dependency not found: ${dep.name}`);
          }
        }
      }
    }
    
    // Check entrypoint exists
    const entrypoint = getEntrypoint(type);
    if (!existsSync(join(resourcePath, entrypoint))) {
      issues.push(`${entrypoint} is missing`);
    } else {
      const content = readFileSync(join(resourcePath, entrypoint), "utf-8");
      
      if (content.length < 100) {
        warnings.push(`${entrypoint} seems too short`);
      }
      
      // Check for placeholder text
      if (content.includes("<!-- Add") || content.includes("Describe")) {
        warnings.push(`${entrypoint} may contain placeholder text`);
      }
    }
    
    const passed = issues.length === 0;
    
    return {
      success: true,
      passed,
      issues,
      warnings,
      message: passed
        ? `Validation passed${warnings.length > 0 ? ` with ${warnings.length} warnings` : ""}`
        : `Validation failed with ${issues.length} issues`,
    };
  };
}
```

#### `src/tools/promote.ts`
```typescript
export interface PromoteParams {
  type: ResourceType;
  name: string;
  message: string;
}

export function createPromoteTool(config: FoundryConfig): ToolHandler {
  return async (params: PromoteParams) => {
    const { type, name, message } = params;
    
    const projectManager = new ProjectManager(config);
    const goldenClient = new GoldenClient(config);
    
    const projectPath = await projectManager.findProjectRoot(process.cwd());
    const resourcePath = join(projectPath!, `${type}s`, name);
    
    // 1. Validate first
    const validation = await createValidateTool(config)({ type, name });
    if (!validation.passed) {
      return {
        success: false,
        error: "Validation failed. Fix issues before promoting.",
        issues: validation.issues,
      };
    }
    
    // 2. Create branch name
    const branchName = `foundry/add-${type}-${name}`;
    
    // 3. Fork/clone golden repo (or use existing clone)
    const goldenPath = await goldenClient.ensureLocalClone();
    
    // 4. Create branch
    const git = simpleGit(goldenPath);
    await git.checkout(["-b", branchName, `origin/${config.branch}`]);
    
    // 5. Copy resource to golden repo
    const destPath = join(goldenPath, `${type}s`, name);
    cpSync(resourcePath, destPath, { recursive: true });
    
    // 6. Update registry.json
    await goldenClient.addToRegistry(type, name, resourcePath);
    
    // 7. Commit changes
    await git.add(".");
    await git.commit(`feat(${type}): add ${name}\n\n${message}`);
    
    // 8. Push branch
    await git.push("origin", branchName);
    
    // 9. Create PR
    const [owner, repo] = config.goldenRepo.split("/");
    const { data: pr } = await goldenClient.octokit.pulls.create({
      owner,
      repo,
      title: `feat(${type}): add ${name}`,
      body: `## New ${type}: ${name}\n\n${message}\n\n### Checklist\n- [ ] Manifest valid\n- [ ] Documentation complete\n- [ ] Examples provided`,
      head: branchName,
      base: config.branch,
    });
    
    return {
      success: true,
      prNumber: pr.number,
      prUrl: pr.html_url,
      message: `Created PR #${pr.number} to add ${name} to golden repo`,
    };
  };
}
```

---

## Phase 4: Polish & Rollout (Sprint 7+)

### 4.1 Utility Tools

- `foundry_doctor` - Check setup, connectivity, permissions
- `foundry_upgrade` - Upgrade Foundry MCP server itself

### 4.2 Documentation

- README for golden repo
- README for MCP server
- Contribution guide
- User guide with examples

### 4.3 Initial Content Migration

Migrate existing team resources to golden repo:
- SPARC methodology context
- ServiceNow base context  
- Team conventions
- Common skills
- claude-flow agent configs

### 4.4 Team Rollout

1. Pilot with 2-3 team members
2. Gather feedback, iterate
3. Full team rollout
4. Regular sync meetings to review contributions

---

## Testing Strategy

### Unit Tests
- Manifest validation
- Version resolution (semver)
- Namespace parsing
- Registry operations

### Integration Tests
- Init → Add → Sync flow
- Promote → PR creation
- External plugin fetching

### E2E Tests
- Full bootstrap scenario
- Resource discovery and installation
- Contribution workflow

---

## Configuration Reference

### User Config (`~/.foundry/config.json`)
```json
{
  "goldenRepo": "servicenow-aif/foundry-golden",
  "branch": "main",
  "cacheDir": "~/.foundry/cache",
  "defaultTemplate": "standard"
}
```

### Environment Variables
- `FOUNDRY_GOLDEN_REPO` - Override golden repo
- `FOUNDRY_BRANCH` - Override branch
- `GITHUB_TOKEN` - GitHub API authentication

### MCP Configuration (`.claude/mcp.json`)
```json
{
  "mcpServers": {
    "foundry": {
      "command": "npx",
      "args": ["@servicenow-aif/foundry-mcp"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Success Metrics

- **Onboarding time**: Measure time from join to first commit
- **Resource reuse**: Track how many projects use shared resources
- **Contribution rate**: Number of resources added to golden repo
- **Sync frequency**: How often teams update resources

---

## Open Items / Future Enhancements

1. **Web UI**: Browse golden repo via GitHub Pages
2. **Notifications**: Alert team when new resources added
3. **Analytics**: Track resource usage across projects
4. **Auto-update**: Background sync for resources
5. **Conflict resolution**: Handle merge conflicts in CLAUDE.md
6. **Resource deprecation**: Workflow for retiring old resources
