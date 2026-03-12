/**
 * Credential Redaction Utilities
 *
 * Prevents accidental exposure of passwords, tokens, and other secrets
 * in tool output, error messages, and log files.
 *
 * Addresses: GitHub issue #45 — Credentials exposed in session output
 */

/** Placeholder used when redacting sensitive values */
export const REDACTED = '[REDACTED]';

/** Fields that should be redacted when sanitizing argument objects */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'clientSecret',
  'client_secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secret',
  'apiKey',
  'api_key',
]);

/**
 * Redact sensitive patterns from a string.
 *
 * Handles:
 * - curl -u 'user:password' patterns
 * - Authorization: Basic <base64> headers
 * - Authorization: Bearer <token> headers
 * - password=value query parameters
 * - token=value query parameters
 * - secret=value query parameters
 */
export function redactString(input: string): string {
  if (!input) return input;

  let result = input;

  // Redact curl -u 'user:password' or -u "user:password" or -u user:password
  result = result.replace(
    /(-u\s+)(['"]?)(\S+?):(\S+?)\2(\s|$)/g,
    `$1$2$3:${REDACTED}$2$5`
  );

  // Redact Authorization: Basic <base64>
  result = result.replace(
    /(Authorization:\s*Basic\s+)[A-Za-z0-9+/=]+/gi,
    `$1${REDACTED}`
  );

  // Redact Authorization: Bearer <token>
  result = result.replace(
    /(Authorization:\s*Bearer\s+)\S+/gi,
    `$1${REDACTED}`
  );

  // Redact password=, token=, secret=, api_key= in query strings or form data
  result = result.replace(
    /((?:password|token|secret|client_secret|api_key|apikey)=)[^&\s"']+/gi,
    `$1${REDACTED}`
  );

  // Redact Base64-encoded credentials that look like user:pass
  // Pattern: standalone base64 strings that decode to user:pass format
  // (Only match if preceded by "encoded as" or similar context)
  result = result.replace(
    /((?:encoded|base64|credentials?)\s+(?:as\s+)?)[A-Za-z0-9+/]{8,}={0,2}/gi,
    `$1${REDACTED}`
  );

  return result;
}

/**
 * Redact sensitive fields from a tool arguments object.
 *
 * Returns a shallow copy with credential fields replaced by REDACTED.
 * Non-sensitive fields are preserved as-is.
 */
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = value;
    }
  }

  return result;
}
