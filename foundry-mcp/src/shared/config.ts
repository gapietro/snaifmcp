/**
 * Centralized configuration with environment variable support
 */

import * as path from "path";

const homeDir = process.env.HOME || process.env.USERPROFILE || "~";

export const CONFIG = {
  // Golden repo
  goldenRepo: process.env.FOUNDRY_GOLDEN_REPO || "Now-AI-Foundry/foundry-golden",
  cacheDir: process.env.FOUNDRY_CACHE_DIR || path.join(homeDir, ".foundry", "golden"),
  cacheMaxAgeHours: parseInt(process.env.FOUNDRY_CACHE_TTL || "24", 10),
  goldenBranch: process.env.FOUNDRY_BRANCH || "main",
  defaultTemplate: process.env.FOUNDRY_DEFAULT_TEMPLATE || "sparc-starter",

  // Timeouts
  requestTimeoutMs: parseInt(process.env.FOUNDRY_REQUEST_TIMEOUT || "30000", 10),

  // ServiceNow
  servicenowCredentialsPath:
    process.env.SERVICENOW_CREDENTIALS_PATH ||
    path.join(homeDir, ".servicenow", "credentials.json"),
};
