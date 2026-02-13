# Script Safety Analysis

Documents the security boundaries for the `servicenow_script` tool's regex-based script analyzer.

## Context

The `servicenow_script` tool allows users to execute background scripts on a connected ServiceNow instance. Before execution, a regex-based analyzer scans the script for potentially dangerous patterns and either warns or blocks.

## What the Analyzer Catches

The analyzer checks for patterns that indicate dangerous operations:

| Category | Example Patterns | Action |
|----------|-----------------|--------|
| **Record deletion** | `deleteRecord()`, `deleteMultiple()` | Block |
| **Bulk operations** | `GlideRecord` with no query + `next()` | Warn |
| **System properties** | `gs.setProperty()`, `GlideProperties` | Block |
| **User/role manipulation** | `sys_user_has_role`, `addRole` | Block |
| **Update sets** | `GlideUpdateSet`, `setUpdateSet` | Warn |
| **Scheduled jobs** | `GlideSysScheduledJob` | Warn |

## What the Analyzer Does NOT Catch

This is a **guardrail, not a security boundary**. It will not catch:

- **Obfuscated code**: String concatenation, `eval()`, encoded payloads
- **Indirect deletion**: Calling a Script Include that performs deletions
- **API abuse**: REST API calls from within the script to other endpoints
- **Data exfiltration**: Reading sensitive data and logging it
- **Novel patterns**: Any dangerous operation not in the regex list
- **Scoped app context**: Scripts running in a different application scope

## Why This Is Acceptable

ServiceNow has its own security model that provides the real protection:

1. **ACLs (Access Control Lists)**: The connected user's permissions limit what tables and records they can read/write/delete. A script cannot bypass ACLs.

2. **Scope isolation**: Application scope restricts access to tables and APIs.

3. **Audit trail**: All script executions are logged by the platform in `sys_script_exec` and system logs.

4. **Instance role requirements**: The user must have `admin` or `script_exec` role to run background scripts at all.

5. **Network isolation**: PDI (Personal Developer Instance) environments are isolated from production.

## Recommendations

- **For POC/PDI work**: The current guardrail is sufficient. Team members have admin access to their own instances.
- **For production instances**: Do NOT use `servicenow_script` against production. Use proper deployment pipelines (update sets, ATF tests, CI/CD).
- **For shared dev instances**: Consider restricting the `servicenow_connect` credentials to a service account with limited roles.

## Implementation Details

The analyzer lives in `foundry-mcp/src/servicenow/tools.ts` within the `servicenow_script` handler. It runs client-side (in the MCP server) before sending the script to ServiceNow.

Modes:
- **`evaluate`**: Script runs in a sandboxed evaluator (safer, limited API access)
- **`background`**: Script runs as a full background script (full API access, requires elevated role)

The mode defaults to `evaluate` for safety. Users must explicitly request `background` mode.
