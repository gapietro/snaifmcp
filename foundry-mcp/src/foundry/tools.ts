/**
 * Foundry tool definitions and handler dispatcher
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CONFIG } from "../shared/config.js";
import { errorToResult } from "../shared/errors.js";
import { initializeProject, addResource, syncResources } from "./project.js";
import { listResources, getResourceInfo, searchResources } from "./resources.js";
import { createNewResource, validateResource, promoteResource } from "./contribute.js";
import { handleExternal } from "./external.js";
import { handleVersion } from "./version.js";
import { handleTemplates } from "./templates.js";

// ── Input validation helper ──────────────────────────────────────

function validateRequired(value: unknown, name: string): string | null {
  if (value === undefined || value === null) return `${name} is required`;
  if (typeof value !== "string") return `${name} must be a string`;
  if (value.trim() === "") return `${name} cannot be empty`;
  return null; // valid
}

// ── Tool definitions ─────────────────────────────────────────────

const FOUNDRY_INIT_TOOL: Tool = {
  name: "foundry_init",
  description:
    "Bootstrap a new Now Assist POC project with pre-loaded context, skills, and template from the Foundry golden repository.",
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
      template: {
        type: "string",
        enum: ["sparc-starter", "minimal", "standard"],
        description:
          "Project template to use (default: 'sparc-starter'). Use foundry_templates to see available templates.",
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

const FOUNDRY_LIST_TOOL: Tool = {
  name: "foundry_list",
  description: `List available Foundry resources from the golden repository.

Shows available:
- Context files: Domain knowledge (Now Assist, GenAI, Agentic patterns)
- Skills: Reusable Claude Code skills with instructions and examples
- Templates: Project templates (SPARC methodology, etc.)

Use this to discover what resources are available before using foundry_add.`,
  inputSchema: {
    type: "object" as const,
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

const FOUNDRY_ADD_TOOL: Tool = {
  name: "foundry_add",
  description: `Add a Foundry resource to an existing project.

Adds context files, skills, or agent examples from the golden repository to your project's .claude/ directory.

Examples:
- Add a context file: type="context", name="now-assist-platform"
- Add a skill: type="skill", name="api-integration"
- Add an agent example: type="agent_example", name="incident-summarizer"

Use foundry_list to see available resources first.`,
  inputSchema: {
    type: "object" as const,
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

const FOUNDRY_SYNC_TOOL: Tool = {
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
    type: "object" as const,
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

const FOUNDRY_INFO_TOOL: Tool = {
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
    type: "object" as const,
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

const FOUNDRY_SEARCH_TOOL: Tool = {
  name: "foundry_search",
  description: `Search across all Foundry resources.

Searches resource names, descriptions, and content for matching terms.
Returns ranked results with context snippets.

Examples:
- foundry_search query="API" - Find resources mentioning APIs
- foundry_search query="GlideRecord" - Find GlideRecord patterns
- foundry_search query="skill" type="context" - Search only context files`,
  inputSchema: {
    type: "object" as const,
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

const FOUNDRY_NEW_TOOL: Tool = {
  name: "foundry_new",
  description: `Scaffold a new Foundry resource in your project.

Creates a new resource with starter templates:
- context: Creates a new .md context file with standard structure
- skill: Creates a skill directory with SKILL.md and examples/

The new resource is created in your project's .claude/ directory.
After development, use foundry_validate and foundry_promote to contribute back.`,
  inputSchema: {
    type: "object" as const,
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

const FOUNDRY_VALIDATE_TOOL: Tool = {
  name: "foundry_validate",
  description: `Validate a Foundry resource before promotion.

Checks:
- Required files exist (SKILL.md for skills, .md for context)
- File structure is correct
- Minimum content requirements met
- No obvious issues (empty sections, placeholder text)

Use this before foundry_promote to ensure your resource is ready.`,
  inputSchema: {
    type: "object" as const,
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

const FOUNDRY_PROMOTE_TOOL: Tool = {
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
    type: "object" as const,
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

const FOUNDRY_EXTERNAL_TOOL: Tool = {
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
    type: "object" as const,
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

const FOUNDRY_VERSION_TOOL: Tool = {
  name: "foundry_version",
  description: `Manage resource versions and check for updates.

Features:
- Show installed resource versions
- Check for available updates
- Pin resources to specific versions
- View version history

The lock file (.claude/foundry.lock) tracks installed versions.`,
  inputSchema: {
    type: "object" as const,
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

const FOUNDRY_TEMPLATES_TOOL: Tool = {
  name: "foundry_templates",
  description: `List and preview available project templates.

Templates:
- sparc-starter: Full SPARC methodology with all context and skills (default)
- minimal: Bare-bones CLAUDE.md only, no preloaded resources
- standard: Basic setup with core context, no skills

Use with foundry_init template="name" to create projects with different templates.`,
  inputSchema: {
    type: "object" as const,
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

// ── Exports ──────────────────────────────────────────────────────

export const FOUNDRY_TOOLS: Tool[] = [
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
];

export function isFoundryTool(name: string): boolean {
  return FOUNDRY_TOOLS.some(t => t.name === name);
}

// ── Handler dispatcher ───────────────────────────────────────────

export async function handleFoundryTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  try {
    return await dispatchFoundryTool(name, args);
  } catch (error) {
    return errorToResult(error);
  }
}

async function dispatchFoundryTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  switch (name) {
    case "foundry_init": {
      const error = validateRequired(args.projectName, "projectName");
      if (error) return { success: false, message: error };
      return initializeProject(
        args.projectName as string,
        (args.path as string) || process.cwd(),
        args.goldenPath as string | undefined,
        (args.template as string) || CONFIG.defaultTemplate
      );
    }

    case "foundry_list":
      return listResources(
        (args.type as string) || "all",
        args.verbose === true
      );

    case "foundry_add": {
      const typeErr = validateRequired(args.type, "type");
      if (typeErr) return { success: false, message: typeErr };
      const nameErr = validateRequired(args.name, "name");
      if (nameErr) return { success: false, message: nameErr };
      return addResource(
        args.type as string,
        args.name as string,
        (args.projectPath as string) || process.cwd(),
        args.force === true
      );
    }

    case "foundry_sync":
      return syncResources(
        (args.projectPath as string) || process.cwd(),
        args.dryRun !== false,
        (args.type as string) || "all"
      );

    case "foundry_info": {
      const typeErr = validateRequired(args.type, "type");
      if (typeErr) return { success: false, message: typeErr };
      const nameErr = validateRequired(args.name, "name");
      if (nameErr) return { success: false, message: nameErr };
      return getResourceInfo(args.type as string, args.name as string);
    }

    case "foundry_search": {
      const error = validateRequired(args.query, "query");
      if (error) return { success: false, message: error };
      return searchResources(
        args.query as string,
        (args.type as string) || "all"
      );
    }

    case "foundry_new": {
      const typeErr = validateRequired(args.type, "type");
      if (typeErr) return { success: false, message: typeErr };
      const nameErr = validateRequired(args.name, "name");
      if (nameErr) return { success: false, message: nameErr };
      return createNewResource(
        args.type as string,
        args.name as string,
        (args.description as string) || "",
        (args.projectPath as string) || process.cwd()
      );
    }

    case "foundry_validate": {
      const typeErr = validateRequired(args.type, "type");
      if (typeErr) return { success: false, message: typeErr };
      const nameErr = validateRequired(args.name, "name");
      if (nameErr) return { success: false, message: nameErr };
      return validateResource(
        args.type as string,
        args.name as string,
        (args.projectPath as string) || process.cwd()
      );
    }

    case "foundry_promote": {
      const typeErr = validateRequired(args.type, "type");
      if (typeErr) return { success: false, message: typeErr };
      const nameErr = validateRequired(args.name, "name");
      if (nameErr) return { success: false, message: nameErr };
      return promoteResource(
        args.type as string,
        args.name as string,
        (args.message as string) || "",
        (args.projectPath as string) || process.cwd()
      );
    }

    case "foundry_external": {
      const error = validateRequired(args.action, "action");
      if (error) return { success: false, message: error };
      return handleExternal(
        args.action as string,
        args.source as string | undefined,
        (args.projectPath as string) || process.cwd()
      );
    }

    case "foundry_version": {
      const error = validateRequired(args.action, "action");
      if (error) return { success: false, message: error };
      return handleVersion(
        args.action as string,
        args.resource as string | undefined,
        args.version as string | undefined,
        (args.projectPath as string) || process.cwd()
      );
    }

    case "foundry_templates":
      return handleTemplates(
        (args.action as string) || "list",
        args.template as string | undefined,
        args.compare as string | undefined
      );

    default:
      return { success: false, message: `Unknown Foundry tool: ${name}` };
  }
}
