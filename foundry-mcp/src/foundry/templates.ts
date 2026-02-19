/**
 * Template management — loads template metadata from golden repo with
 * hardcoded fallback when template.json files don't exist yet.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { ensureGoldenRepo } from "./golden-repo.js";
import type { TemplateInfo } from "./types.js";

// Hardcoded fallback templates (used when template.json doesn't exist in golden repo)
const FALLBACK_TEMPLATES: TemplateInfo[] = [
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
 * Load template metadata from golden repo template.json files.
 * Falls back to hardcoded templates when files don't exist.
 */
export async function loadTemplates(goldenPath: string): Promise<TemplateInfo[]> {
  const templatesDir = path.join(goldenPath, "templates");
  try {
    const entries = await fs.readdir(templatesDir, { withFileTypes: true });
    const templateDirs = entries.filter(e => e.isDirectory());

    const loaded: TemplateInfo[] = [];
    for (const dir of templateDirs) {
      const jsonPath = path.join(templatesDir, dir.name, "template.json");
      try {
        const content = await fs.readFile(jsonPath, "utf-8");
        const data = JSON.parse(content);
        loaded.push({
          name: data.name || dir.name,
          description: data.description || "",
          includes: {
            context: data.includes?.context ?? false,
            skills: data.includes?.skills ?? false,
            claudeMd: true,
          },
          features: data.features || [],
        });
      } catch {
        // No template.json — check if this template exists in fallback
        const fallback = FALLBACK_TEMPLATES.find(t => t.name === dir.name);
        if (fallback) {
          loaded.push(fallback);
        }
      }
    }

    // Return loaded templates if we found any, otherwise fallback
    return loaded.length > 0 ? loaded : FALLBACK_TEMPLATES;
  } catch {
    return FALLBACK_TEMPLATES;
  }
}

/**
 * Get template settings (what to include) for a given template name.
 * Used by project.ts during init.
 */
export async function getTemplateSettings(
  goldenPath: string,
  templateName: string
): Promise<{ context: boolean; skills: boolean } | null> {
  const templates = await loadTemplates(goldenPath);
  const tmpl = templates.find(t => t.name === templateName);
  if (!tmpl) return null;
  return { context: tmpl.includes.context, skills: tmpl.includes.skills };
}

/**
 * Get list of valid template names.
 */
export async function getValidTemplateNames(goldenPath: string): Promise<string[]> {
  const templates = await loadTemplates(goldenPath);
  return templates.map(t => t.name);
}

export async function handleTemplates(
  action: string,
  template: string | undefined,
  compare: string | undefined
): Promise<{ success: boolean; message: string }> {
  const goldenPath = await ensureGoldenRepo();
  const TEMPLATES = await loadTemplates(goldenPath);

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
      const contextDir = path.join(goldenPath, "context");
      try {
        const files = await fs.readdir(contextDir);
        const mdFiles = files.filter(f => f.endsWith(".md"));
        for (let i = 0; i < mdFiles.length; i++) {
          const prefix = i === mdFiles.length - 1 && !tmpl.includes.skills ? "└──" : "├──";
          output += `    │   ${prefix} ${mdFiles[i]}\n`;
        }
      } catch {
        output += `    │   └── (context files)\n`;
      }
    }

    if (tmpl.includes.skills) {
      output += `    └── skills/\n`;
      const skillsDir = path.join(goldenPath, "skills");
      try {
        const dirs = await fs.readdir(skillsDir, { withFileTypes: true });
        const skillDirs = dirs.filter(d => d.isDirectory());
        for (let i = 0; i < skillDirs.length; i++) {
          const prefix = i === skillDirs.length - 1 ? "└──" : "├──";
          output += `        ${prefix} ${skillDirs[i].name}/\n`;
        }
      } catch {
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

    output += `\nRecommendation:\n`;
    if (tmpl1.includes.skills && !tmpl2.includes.skills) {
      output += `  • Use ${tmpl1.name} for comprehensive setup\n`;
      output += `  • Use ${tmpl2.name} for faster, lighter projects\n`;
    } else if (!tmpl1.includes.skills && tmpl2.includes.skills) {
      output += `  • Use ${tmpl2.name} for comprehensive setup\n`;
      output += `  • Use ${tmpl1.name} for faster, lighter projects\n`;
    } else {
      output += `  • Both templates have similar scope\n`;
    }

    return { success: true, message: output };
  }

  return { success: false, message: `Unknown action: ${action}` };
}
