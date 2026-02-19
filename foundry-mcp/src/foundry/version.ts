/**
 * Resource versioning and lock file management
 */

import * as fs from "fs/promises";
import * as path from "path";
import { safeExec } from "../shared/exec-utils.js";
import { directoryExists, fileExists } from "../shared/fs-utils.js";
import { ensureGoldenRepo } from "./golden-repo.js";
import type { LockEntry, LockFile } from "./types.js";

function getLockFilePath(projectPath: string): string {
  return path.join(projectPath, ".claude", "foundry.lock");
}

async function readLockFile(projectPath: string): Promise<LockFile> {
  const lockPath = getLockFilePath(projectPath);
  try {
    const content = await fs.readFile(lockPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { version: "1.0", resources: [] };
  }
}

async function writeLockFile(projectPath: string, lock: LockFile): Promise<void> {
  const lockPath = getLockFilePath(projectPath);
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2));
}

function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export async function handleVersion(
  action: string,
  resource: string | undefined,
  version: string | undefined,
  projectPath: string
): Promise<{ success: boolean; message: string }> {
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
      const resources: LockEntry[] = [];

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
      } catch {
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
            } catch {
              // No SKILL.md
            }
          }
        }
      } catch {
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
    } else {
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
    // Force refresh cache to get latest from GitHub
    let updatesAvailable = 0;
    const goldenPath = await ensureGoldenRepo(true);

    for (const resource of lock.resources) {
      let currentHash = "";

      if (resource.type === "context") {
        const filePath = path.join(goldenPath, "context", `${resource.name}.md`);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          currentHash = generateHash(content);
        } catch {
          continue;
        }
      } else if (resource.type === "skill") {
        const filePath = path.join(goldenPath, "skills", resource.name, "SKILL.md");
        try {
          const content = await fs.readFile(filePath, "utf-8");
          currentHash = generateHash(content);
        } catch {
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
    } else {
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
      } else {
        resourcePath = `skills/${resource}`;
      }
    } else {
      // Try to guess
      resourcePath = `context/${resource}.md`;
    }

    try {
      const { stdout } = await safeExec(
        "git",
        ["log", "--oneline", "-10", "--", resourcePath],
        { cwd: goldenPath }
      );

      if (stdout.trim()) {
        let output = `Version History: ${resource}\n${"═".repeat(60)}\n\n`;
        output += `Path: ${resourcePath}\n\n`;
        output += `Recent commits:\n`;
        output += stdout.split("\n").map(line => `  ${line}`).join("\n");
        return { success: true, message: output };
      } else {
        return {
          success: true,
          message: `No history found for ${resource}.\n\nThe resource may be new or not yet committed.`,
        };
      }
    } catch {
      return {
        success: false,
        message: `Could not get history for ${resource}`,
      };
    }
  }

  return { success: false, message: `Unknown action: ${action}` };
}
