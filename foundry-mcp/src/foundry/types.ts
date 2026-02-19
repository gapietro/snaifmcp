/**
 * Foundry type definitions
 */

export interface ResourceInfo {
  name: string;
  type: "context" | "skill" | "template" | "agent_example";
  path: string;
  description?: string;
  hasExamples?: boolean;
  complexity?: string;
  agentType?: string;
}

export interface SyncStatus {
  name: string;
  type: "context" | "skill";
  status: "updated" | "new" | "unchanged" | "error";
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SearchResult {
  name: string;
  type: "context" | "skill" | "template";
  score: number;
  snippet: string;
  matchType: "name" | "content";
}

export interface ExternalSource {
  name: string;
  type: "approved" | "github";
  repo?: string;
  description?: string;
  installed?: boolean;
}

export interface LockEntry {
  name: string;
  type: "context" | "skill";
  version: string;
  hash: string;
  installedAt: string;
  source: "golden" | "external";
}

export interface LockFile {
  version: "1.0";
  resources: LockEntry[];
}

export interface TemplateInfo {
  name: string;
  description: string;
  includes: {
    context: boolean;
    skills: boolean;
    claudeMd: boolean;
  };
  features: string[];
}
