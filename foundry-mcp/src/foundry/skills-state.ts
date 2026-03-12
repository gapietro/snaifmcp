/**
 * Persistent state tracking for installed global Claude Code skills
 * Persists to ~/.foundry/skills-installed.json
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { fileExists } from "../shared/fs-utils.js";

const STATE_FILE = path.join(os.homedir(), ".foundry", "skills-installed.json");

export interface InstalledSkill {
  name: string;
  version: string;
  installed_at: string;
  scope: "global" | "project";
}

interface InstalledState {
  version: "1.0";
  skills: Record<string, InstalledSkill>;
}

export async function loadInstalledState(): Promise<InstalledState> {
  if (!(await fileExists(STATE_FILE))) {
    return { version: "1.0", skills: {} };
  }
  try {
    const content = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(content) as InstalledState;
  } catch {
    return { version: "1.0", skills: {} };
  }
}

export async function saveInstalledState(state: InstalledState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export async function markInstalled(
  name: string,
  version = "1.0.0",
  scope: "global" | "project" = "global"
): Promise<void> {
  const state = await loadInstalledState();
  state.skills[name] = {
    name,
    version,
    installed_at: new Date().toISOString(),
    scope,
  };
  await saveInstalledState(state);
}

export async function markRemoved(name: string): Promise<void> {
  const state = await loadInstalledState();
  delete state.skills[name];
  await saveInstalledState(state);
}

export async function isInstalled(name: string): Promise<boolean> {
  const state = await loadInstalledState();
  return name in state.skills;
}

export async function getInstalledSkills(): Promise<InstalledSkill[]> {
  const state = await loadInstalledState();
  return Object.values(state.skills);
}
