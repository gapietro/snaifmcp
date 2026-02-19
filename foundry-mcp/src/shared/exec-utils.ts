/**
 * Safe execution utilities
 * Wraps child_process.spawn with shell: false to prevent command injection
 */

import { spawn } from "child_process";
import { CONFIG } from "./config.js";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a command safely using spawn (no shell interpretation).
 * Arguments are passed as an array, preventing injection.
 */
export function safeExec(
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: options?.timeout ?? CONFIG.requestTimeoutMs,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (error: Error) => {
      reject(new Error(`Failed to execute ${command}: ${error.message}`));
    });

    child.on("close", (code: number | null) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(
          new Error(
            `Command failed: ${command} ${args.join(" ")}\nExit code: ${exitCode}\nstderr: ${stderr.trim()}`
          )
        );
      } else {
        resolve({ stdout, stderr, exitCode });
      }
    });
  });
}

/**
 * Validate a resource name to prevent injection in file paths and git operations.
 * Allows: letters, numbers, hyphens, underscores. Max 100 chars.
 */
export function validateResourceName(name: string): string | null {
  if (!name || typeof name !== "string") {
    return "Resource name is required";
  }
  if (name.length > 100) {
    return "Resource name must be 100 characters or fewer";
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return "Resource name must contain only letters, numbers, hyphens, and underscores";
  }
  return null; // valid
}
