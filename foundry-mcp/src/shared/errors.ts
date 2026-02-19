/**
 * Error types for Foundry operations
 */

export enum FoundryErrorType {
  GOLDEN_REPO_ERROR = "golden_repo_error",
  PROJECT_EXISTS = "project_exists",
  INVALID_INPUT = "invalid_input",
  RESOURCE_NOT_FOUND = "resource_not_found",
  VALIDATION_FAILED = "validation_failed",
  GH_CLI_MISSING = "gh_cli_missing",
  GIT_ERROR = "git_error",
  FILE_SYSTEM_ERROR = "file_system_error",
  UNKNOWN_ERROR = "unknown_error",
}

export class FoundryError extends Error {
  constructor(
    public type: FoundryErrorType,
    message: string,
    public details?: Record<string, unknown>,
    public suggestion?: string
  ) {
    super(message);
    this.name = "FoundryError";
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      suggestion: this.suggestion,
    };
  }
}

/**
 * Convert any error into a tool result { success: false, message }.
 * Used at the handler boundary in tools.ts.
 */
export function errorToResult(error: unknown): { success: false; message: string } {
  if (error instanceof FoundryError) {
    let msg = `Error: ${error.message}`;
    if (error.suggestion) {
      msg += `\n\nSuggestion: ${error.suggestion}`;
    }
    return { success: false, message: msg };
  }
  if (error instanceof Error) {
    return { success: false, message: `Error: ${error.message}` };
  }
  return { success: false, message: `Error: ${String(error)}` };
}
