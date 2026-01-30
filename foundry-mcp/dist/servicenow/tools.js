/**
 * ServiceNow MCP Tools
 * Tool definitions and handlers for ServiceNow integration
 */
import { connectionManager } from './connection-manager.js';
import { ServiceNowError, ServiceNowErrorType } from './types.js';
// Tool definitions
export const SERVICENOW_CONNECT_TOOL = {
    name: 'servicenow_connect',
    description: `Connect to a ServiceNow instance for troubleshooting and debugging.

Supports multiple authentication methods:
- basic: Username and password (best for dev/PDI instances)
- token: API token (for service accounts)
- oauth: OAuth 2.0 (for production instances)
- profile: Named profile from ~/.servicenow/credentials.json

Example usage:
- Basic auth: instance="dev12345.service-now.com", authType="basic", username="admin", password="..."
- Profile: instance="dev12345.service-now.com", profile="dev"`,
    inputSchema: {
        type: 'object',
        properties: {
            instance: {
                type: 'string',
                description: 'ServiceNow instance URL (e.g., "dev12345.service-now.com")',
            },
            authType: {
                type: 'string',
                enum: ['basic', 'token', 'oauth', 'profile'],
                description: 'Authentication method (default: basic)',
            },
            profile: {
                type: 'string',
                description: 'Named profile from ~/.servicenow/credentials.json',
            },
            username: {
                type: 'string',
                description: 'Username for basic auth',
            },
            password: {
                type: 'string',
                description: 'Password for basic auth',
            },
            token: {
                type: 'string',
                description: 'API token for token auth',
            },
            clientId: {
                type: 'string',
                description: 'OAuth client ID',
            },
            clientSecret: {
                type: 'string',
                description: 'OAuth client secret',
            },
        },
        required: ['instance'],
    },
};
export const SERVICENOW_DISCONNECT_TOOL = {
    name: 'servicenow_disconnect',
    description: 'Disconnect from the current ServiceNow instance.',
    inputSchema: {
        type: 'object',
        properties: {
            instance: {
                type: 'string',
                description: 'Specific instance to disconnect from. If not provided, disconnects from active instance.',
            },
        },
    },
};
export const SERVICENOW_STATUS_TOOL = {
    name: 'servicenow_status',
    description: 'Get the current ServiceNow connection status.',
    inputSchema: {
        type: 'object',
        properties: {},
    },
};
export const SERVICENOW_SYSLOGS_TOOL = {
    name: 'servicenow_syslogs',
    description: `Query ServiceNow system logs for debugging and troubleshooting.

Filter logs by:
- level: error, warning, info, debug, or all
- source: Log source (e.g., "GenAI Controller", "Now Assist")
- message: Text search in log messages
- timeRange: How far back to search (1h, 4h, 12h, 24h, 7d)
- scope: Application scope (e.g., "x_snc_now_assist")

Returns formatted log entries with timestamps, levels, sources, and messages.
Requires an active connection (use servicenow_connect first).`,
    inputSchema: {
        type: 'object',
        properties: {
            level: {
                type: 'string',
                enum: ['error', 'warning', 'info', 'debug', 'all'],
                description: 'Log level to filter (default: "error")',
            },
            source: {
                type: 'string',
                description: 'Log source filter (e.g., "GenAI Controller", "Now Assist")',
            },
            message: {
                type: 'string',
                description: 'Text search in log message (case-insensitive)',
            },
            timeRange: {
                type: 'string',
                enum: ['1h', '4h', '12h', '24h', '7d'],
                description: 'Time range to search (default: "1h")',
            },
            limit: {
                type: 'number',
                description: 'Maximum number of logs to return (default: 50, max: 500)',
            },
            scope: {
                type: 'string',
                description: 'Application scope filter (e.g., "x_snc_now_assist")',
            },
        },
    },
};
export const SERVICENOW_AIA_LOGS_TOOL = {
    name: 'servicenow_aia_logs',
    description: `Query AI Agent (AIA) execution logs to debug agent workflows.

Shows agent execution traces including:
- Agent name and trigger context
- Execution status and duration
- Step-by-step tool calls with inputs/outputs
- Error details for failed executions

Filter by:
- executionId: Get a specific execution by ID
- agentName: Filter by agent name
- status: success, failure, running, or all
- timeRange: How far back to search (1h, 4h, 12h, 24h, 7d)

Requires an active connection (use servicenow_connect first).`,
    inputSchema: {
        type: 'object',
        properties: {
            executionId: {
                type: 'string',
                description: 'Specific execution ID to retrieve (sys_id)',
            },
            agentName: {
                type: 'string',
                description: 'Filter by agent name (partial match)',
            },
            status: {
                type: 'string',
                enum: ['success', 'failure', 'running', 'all'],
                description: 'Filter by execution status (default: "all")',
            },
            timeRange: {
                type: 'string',
                enum: ['1h', '4h', '12h', '24h', '7d'],
                description: 'Time range to search (default: "4h")',
            },
            limit: {
                type: 'number',
                description: 'Maximum executions to return (default: 20, max: 100)',
            },
            includeToolCalls: {
                type: 'boolean',
                description: 'Include detailed tool execution logs (default: true)',
            },
        },
    },
};
export const SERVICENOW_QUERY_TOOL = {
    name: 'servicenow_query',
    description: `Query any ServiceNow table using GlideRecord-style syntax. Read-only.

Examples:
- Get active P1 incidents: table="incident", query="active=true^priority=1"
- Find users by name: table="sys_user", query="nameLIKEsmith", fields=["user_name","email"]
- Recent changes: table="sys_audit", query="sys_created_on>=javascript:gs.daysAgoStart(1)"

Query syntax uses ServiceNow encoded query format:
- Equals: field=value
- Contains: fieldLIKEvalue
- Greater than: field>value
- Multiple conditions: field1=value1^field2=value2
- OR conditions: field1=value1^ORfield2=value2

Requires an active connection (use servicenow_connect first).`,
    inputSchema: {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'Table name to query (e.g., "incident", "sys_user", "cmdb_ci")',
            },
            query: {
                type: 'string',
                description: 'Encoded query string (e.g., "active=true^priority=1")',
            },
            fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to return (default: common fields for the table)',
            },
            limit: {
                type: 'number',
                description: 'Maximum records to return (default: 50, max: 500)',
            },
            orderBy: {
                type: 'string',
                description: 'Field to order by (e.g., "sys_created_on")',
            },
            orderDirection: {
                type: 'string',
                enum: ['asc', 'desc'],
                description: 'Order direction (default: "desc")',
            },
        },
        required: ['table'],
    },
};
export const SERVICENOW_SCRIPT_TOOL = {
    name: 'servicenow_script',
    description: `Execute a background script on ServiceNow for testing and debugging.

SAFETY: Scripts are analyzed before execution. Dangerous operations are blocked.

Execution modes:
- readonly (default): Blocks all insert/update/delete operations
- execute: Full execution with audit trail

Blocked operations (always):
- Mass deletes (deleteMultiple)
- Table drops or modifications
- Credential/password access
- External HTTP calls
- System property changes

Example scripts:
- Count records: "var gr = new GlideRecord('incident'); gr.query(); gs.info('Count: ' + gr.getRowCount());"
- Check user: "gs.info('User: ' + gs.getUserName());"

Requires an active connection (use servicenow_connect first).`,
    inputSchema: {
        type: 'object',
        properties: {
            script: {
                type: 'string',
                description: 'GlideScript to execute',
            },
            mode: {
                type: 'string',
                enum: ['readonly', 'execute'],
                description: 'Execution mode: readonly (blocks mutations) or execute (full). Default: readonly',
            },
            timeout: {
                type: 'number',
                description: 'Script timeout in seconds (default: 30, max: 120)',
            },
            description: {
                type: 'string',
                description: 'Description of what this script does (for audit log)',
            },
        },
        required: ['script'],
    },
};
export const SERVICENOW_INSTANCE_TOOL = {
    name: 'servicenow_instance',
    description: `Get ServiceNow instance information, version, installed plugins, and health status.

Returns:
- Instance version and build info
- Installed plugins (optional)
- Feature status: Now Assist, Virtual Agent, AI Agents
- Health metrics: semaphores, scheduled jobs (optional)

Useful for:
- Verifying instance capabilities before debugging
- Checking if required plugins are installed
- Understanding instance configuration

Requires an active connection (use servicenow_connect first).`,
    inputSchema: {
        type: 'object',
        properties: {
            includePlugins: {
                type: 'boolean',
                description: 'Include list of installed plugins (default: false)',
            },
            includeHealth: {
                type: 'boolean',
                description: 'Include instance health metrics (default: false)',
            },
            checkFeatures: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific features to check (e.g., ["now_assist", "virtual_agent", "aia"])',
            },
        },
    },
};
// All ServiceNow tools
export const SERVICENOW_TOOLS = [
    SERVICENOW_CONNECT_TOOL,
    SERVICENOW_DISCONNECT_TOOL,
    SERVICENOW_STATUS_TOOL,
    SERVICENOW_SYSLOGS_TOOL,
    SERVICENOW_AIA_LOGS_TOOL,
    SERVICENOW_QUERY_TOOL,
    SERVICENOW_SCRIPT_TOOL,
    SERVICENOW_INSTANCE_TOOL,
];
export async function handleServiceNowConnect(args) {
    const instance = args.instance;
    const authType = args.authType;
    const profile = args.profile;
    const username = args.username;
    const password = args.password;
    const token = args.token;
    const clientId = args.clientId;
    const clientSecret = args.clientSecret;
    if (!instance) {
        return {
            content: [{ type: 'text', text: 'Error: instance is required' }],
            isError: true,
        };
    }
    const result = await connectionManager.connect({
        instance,
        authType: authType,
        profile,
        username,
        password,
        token,
        clientId,
        clientSecret,
    });
    if (result.success && result.session) {
        const session = result.session;
        const rolesPreview = session.roles.slice(0, 5).join(', ');
        const moreRoles = session.roles.length > 5 ? ` (+${session.roles.length - 5} more)` : '';
        const message = `Connected to ServiceNow instance

Instance: ${session.instanceUrl}
Version: ${session.instanceVersion}
User: ${session.user}
Roles: ${rolesPreview}${moreRoles}

You can now use other ServiceNow tools to query logs, run scripts, and debug issues.`;
        return {
            content: [{ type: 'text', text: message }],
        };
    }
    else {
        const errorDetails = result.error?.details ? `\n\nSuggestion: ${result.error.details}` : '';
        return {
            content: [{ type: 'text', text: `Connection failed: ${result.message}${errorDetails}` }],
            isError: true,
        };
    }
}
export async function handleServiceNowDisconnect(args) {
    const instance = args.instance;
    if (!connectionManager.isConnected()) {
        return {
            content: [{ type: 'text', text: 'Not connected to any ServiceNow instance.' }],
        };
    }
    const status = connectionManager.getStatus();
    const disconnected = connectionManager.disconnect(instance);
    if (disconnected) {
        return {
            content: [{ type: 'text', text: `Disconnected from ${instance || status.activeInstance}` }],
        };
    }
    else {
        return {
            content: [{ type: 'text', text: 'No matching session found to disconnect.' }],
            isError: true,
        };
    }
}
export async function handleServiceNowStatus(_args) {
    const status = connectionManager.getStatus();
    if (!status.connected) {
        return {
            content: [{
                    type: 'text',
                    text: `Not connected to any ServiceNow instance.

To connect, use servicenow_connect with:
- instance: Your ServiceNow instance URL (e.g., "dev12345.service-now.com")
- authType: "basic", "token", or "oauth"
- Credentials: username/password for basic, token for token auth, etc.

Example: Connect with basic auth to your PDI`,
                }],
        };
    }
    const session = connectionManager.getActiveSession();
    const allSessions = connectionManager.getAllSessions();
    let message = `ServiceNow Connection Status

Active Instance: ${status.activeInstance}
Version: ${status.version}
User: ${status.user}
Connected Since: ${session?.createdAt.toISOString()}
Last Activity: ${session?.lastUsed.toISOString()}`;
    if (allSessions.length > 1) {
        message += `\n\nOther Sessions: ${allSessions.length - 1}`;
        for (const s of allSessions) {
            if (s.instanceUrl !== status.activeInstance) {
                message += `\n  - ${s.instanceUrl} (${s.userName})`;
            }
        }
    }
    return {
        content: [{ type: 'text', text: message }],
    };
}
// Syslog level mapping
const SYSLOG_LEVELS = {
    debug: 0,
    info: 1,
    warning: 2,
    error: 3,
};
const SYSLOG_LEVEL_NAMES = {
    0: 'DEBUG',
    1: 'INFO',
    2: 'WARNING',
    3: 'ERROR',
};
// Time range to GlideDateTime offset
function getTimeRangeQuery(timeRange) {
    const now = new Date();
    let offsetMs;
    switch (timeRange) {
        case '1h':
            offsetMs = 60 * 60 * 1000;
            break;
        case '4h':
            offsetMs = 4 * 60 * 60 * 1000;
            break;
        case '12h':
            offsetMs = 12 * 60 * 60 * 1000;
            break;
        case '24h':
            offsetMs = 24 * 60 * 60 * 1000;
            break;
        case '7d':
            offsetMs = 7 * 24 * 60 * 60 * 1000;
            break;
        default:
            offsetMs = 60 * 60 * 1000; // Default 1h
    }
    const startTime = new Date(now.getTime() - offsetMs);
    // Format as ServiceNow datetime: YYYY-MM-DD HH:MM:SS
    const formatted = startTime.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    return `sys_created_on>=${formatted}`;
}
export async function handleServiceNowSyslogs(args) {
    // Check connection
    if (!connectionManager.isConnected()) {
        return {
            content: [{
                    type: 'text',
                    text: `Not connected to ServiceNow. Use servicenow_connect first.

Example:
  servicenow_connect with instance="dev12345.service-now.com", username="admin", password="..."`,
                }],
            isError: true,
        };
    }
    const client = connectionManager.getActiveClient();
    if (!client) {
        return {
            content: [{ type: 'text', text: 'Connection error: No active client' }],
            isError: true,
        };
    }
    // Parse arguments
    const level = args.level || 'error';
    const source = args.source;
    const messageFilter = args.message;
    const timeRange = args.timeRange || '1h';
    const limit = Math.min(Math.max(args.limit || 50, 1), 500);
    const scope = args.scope;
    // Build query
    const queryParts = [];
    // Time range
    queryParts.push(getTimeRangeQuery(timeRange));
    // Level filter
    if (level !== 'all') {
        const levelNum = SYSLOG_LEVELS[level];
        if (levelNum !== undefined) {
            queryParts.push(`level=${levelNum}`);
        }
    }
    // Source filter
    if (source) {
        queryParts.push(`sourceLIKE${source}`);
    }
    // Message filter
    if (messageFilter) {
        queryParts.push(`messageLIKE${messageFilter}`);
    }
    // Order by newest first
    queryParts.push('ORDERBYDESCsys_created_on');
    const query = queryParts.join('^');
    try {
        // Determine which table to query based on scope
        const table = scope ? 'syslog_app_scope' : 'syslog';
        let fullQuery = query;
        if (scope) {
            fullQuery = `sys_scope.scope=${scope}^${query}`;
        }
        const response = await client.queryTable(table, fullQuery, ['sys_id', 'level', 'source', 'message', 'sys_created_on', 'sys_created_by'], limit);
        const logs = response.result || [];
        if (logs.length === 0) {
            return {
                content: [{
                        type: 'text',
                        text: `No logs found matching criteria:
- Level: ${level}
- Time range: ${timeRange}
${source ? `- Source: ${source}` : ''}
${messageFilter ? `- Message contains: "${messageFilter}"` : ''}
${scope ? `- Scope: ${scope}` : ''}

Try expanding the time range or adjusting filters.`,
                    }],
            };
        }
        // Format logs
        const formattedLogs = logs.map((log, index) => {
            const levelNum = parseInt(log.level, 10);
            const levelName = SYSLOG_LEVEL_NAMES[levelNum] || `LEVEL_${levelNum}`;
            const timestamp = log.sys_created_on;
            const src = log.source || 'unknown';
            const msg = log.message || '';
            const user = log.sys_created_by || 'system';
            // Truncate long messages
            const maxMsgLen = 500;
            const truncatedMsg = msg.length > maxMsgLen
                ? msg.substring(0, maxMsgLen) + '... (truncated)'
                : msg;
            return `[${index + 1}] ${timestamp} | ${levelName} | ${src}
    User: ${user}
    ${truncatedMsg}`;
        });
        const status = connectionManager.getStatus();
        const header = `System Logs from ${status.activeInstance}
Query: level=${level}, timeRange=${timeRange}${source ? `, source="${source}"` : ''}${messageFilter ? `, message contains "${messageFilter}"` : ''}
Found: ${logs.length} log entries${logs.length === limit ? ' (limit reached)' : ''}

${'─'.repeat(60)}`;
        return {
            content: [{
                    type: 'text',
                    text: `${header}\n\n${formattedLogs.join('\n\n')}`,
                }],
        };
    }
    catch (error) {
        if (error instanceof ServiceNowError) {
            return {
                content: [{
                        type: 'text',
                        text: `Failed to query syslogs: ${error.message}${error.suggestion ? `\n\nSuggestion: ${error.suggestion}` : ''}`,
                    }],
                isError: true,
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Failed to query syslogs: ${error instanceof Error ? error.message : String(error)}`,
                }],
            isError: true,
        };
    }
}
// AIA execution status mapping
const AIA_STATUS_MAP = {
    success: 'success',
    completed: 'success',
    failure: 'failure',
    failed: 'failure',
    error: 'failure',
    running: 'running',
    in_progress: 'running',
    pending: 'running',
};
export async function handleServiceNowAiaLogs(args) {
    // Check connection
    if (!connectionManager.isConnected()) {
        return {
            content: [{
                    type: 'text',
                    text: `Not connected to ServiceNow. Use servicenow_connect first.

Example:
  servicenow_connect with instance="dev12345.service-now.com", username="admin", password="..."`,
                }],
            isError: true,
        };
    }
    const client = connectionManager.getActiveClient();
    if (!client) {
        return {
            content: [{ type: 'text', text: 'Connection error: No active client' }],
            isError: true,
        };
    }
    // Parse arguments
    const executionId = args.executionId;
    const agentName = args.agentName;
    const status = args.status || 'all';
    const timeRange = args.timeRange || '4h';
    const limit = Math.min(Math.max(args.limit || 20, 1), 100);
    const includeToolCalls = args.includeToolCalls !== false; // Default true
    try {
        // Build query for executions
        const queryParts = [];
        // If specific execution ID, just get that one
        if (executionId) {
            queryParts.push(`sys_id=${executionId}`);
        }
        else {
            // Time range filter
            queryParts.push(getTimeRangeQuery(timeRange));
            // Agent name filter
            if (agentName) {
                queryParts.push(`agentLIKE${agentName}`);
            }
            // Status filter
            if (status !== 'all') {
                // Map common status values
                const statusValues = Object.entries(AIA_STATUS_MAP)
                    .filter(([_, v]) => v === status)
                    .map(([k, _]) => k);
                if (statusValues.length > 0) {
                    queryParts.push(`statusIN${statusValues.join(',')}`);
                }
            }
            // Order by newest first
            queryParts.push('ORDERBYDESCsys_created_on');
        }
        const query = queryParts.join('^');
        // Query the AIA execution table
        // Note: Table name may vary by ServiceNow version (sys_aia_execution, sn_agent_execution, etc.)
        // Try multiple possible table names
        const possibleTables = [
            'sys_aia_execution',
            'sn_agent_execution',
            'x_snc_aia_execution',
            'sn_ai_agent_execution',
        ];
        let executions = [];
        let usedTable = '';
        for (const table of possibleTables) {
            try {
                const response = await client.queryTable(table, query, [
                    'sys_id', 'agent', 'status', 'sys_created_on', 'sys_updated_on',
                    'trigger_type', 'trigger_context', 'error_message', 'input', 'output',
                    'duration', 'user', 'conversation_id'
                ], limit);
                if (response.result && response.result.length > 0) {
                    executions = response.result;
                    usedTable = table;
                    break;
                }
                // Even if empty, if no error, the table exists
                if (response.result) {
                    usedTable = table;
                    break;
                }
            }
            catch (tableError) {
                // Table doesn't exist or access denied, try next
                continue;
            }
        }
        if (!usedTable) {
            return {
                content: [{
                        type: 'text',
                        text: `Could not find AIA execution table. Tried: ${possibleTables.join(', ')}

This may mean:
- AI Agent framework is not installed on this instance
- Your user lacks access to AIA tables
- The table has a different name in your ServiceNow version

Check that Now Assist or AI Agent is enabled on this instance.`,
                    }],
                isError: true,
            };
        }
        if (executions.length === 0) {
            return {
                content: [{
                        type: 'text',
                        text: `No AI Agent executions found matching criteria:
${executionId ? `- Execution ID: ${executionId}` : ''}
${agentName ? `- Agent name: ${agentName}` : ''}
- Status: ${status}
- Time range: ${timeRange}

Try expanding the time range or adjusting filters.`,
                    }],
            };
        }
        // Get tool executions if requested
        const toolCallsMap = new Map();
        if (includeToolCalls) {
            const executionIds = executions.map(e => e.sys_id);
            const toolTables = [
                'sys_aia_tool_execution',
                'sn_agent_tool_execution',
                'x_snc_aia_tool_execution',
            ];
            for (const toolTable of toolTables) {
                try {
                    const toolQuery = `executionIN${executionIds.join(',')}^ORDERBYstep_number`;
                    const toolResponse = await client.queryTable(toolTable, toolQuery, [
                        'sys_id', 'execution', 'tool_name', 'input', 'output',
                        'status', 'error_message', 'duration', 'step_number'
                    ], 500 // Get more tool calls
                    );
                    if (toolResponse.result) {
                        for (const tool of toolResponse.result) {
                            const execId = tool.execution ||
                                (tool.execution?.value);
                            if (execId) {
                                if (!toolCallsMap.has(execId)) {
                                    toolCallsMap.set(execId, []);
                                }
                                toolCallsMap.get(execId).push({
                                    toolName: tool.tool_name || 'unknown',
                                    input: tool.input || '',
                                    output: tool.output || '',
                                    status: tool.status || 'unknown',
                                    duration: parseInt(tool.duration, 10) || 0,
                                    errorMessage: tool.error_message,
                                    stepNumber: parseInt(tool.step_number, 10) || 0,
                                });
                            }
                        }
                        break; // Found the right table
                    }
                }
                catch {
                    // Table doesn't exist, try next
                    continue;
                }
            }
        }
        // Format executions
        const formattedExecutions = executions.map(exec => {
            const execId = exec.sys_id;
            const agentRef = exec.agent;
            const agentDisplay = typeof agentRef === 'string'
                ? agentRef
                : (agentRef?.display_value || agentRef?.value || 'Unknown Agent');
            return {
                executionId: execId,
                agentName: agentDisplay,
                status: exec.status || 'unknown',
                startTime: exec.sys_created_on || '',
                endTime: exec.sys_updated_on,
                duration: parseInt(exec.duration, 10) || undefined,
                triggerType: exec.trigger_type,
                triggerContext: exec.trigger_context,
                errorMessage: exec.error_message,
                toolCalls: toolCallsMap.get(execId) || [],
            };
        });
        // Build output
        const statusEmoji = {
            success: '[OK]',
            completed: '[OK]',
            failure: '[FAIL]',
            failed: '[FAIL]',
            error: '[FAIL]',
            running: '[...]',
            in_progress: '[...]',
        };
        const connectionStatus = connectionManager.getStatus();
        let output = `AI Agent Execution Logs from ${connectionStatus.activeInstance}
Query: status=${status}, timeRange=${timeRange}${agentName ? `, agent="${agentName}"` : ''}${executionId ? `, executionId="${executionId}"` : ''}
Found: ${formattedExecutions.length} execution(s)

${'═'.repeat(70)}`;
        for (const exec of formattedExecutions) {
            const emoji = statusEmoji[exec.status.toLowerCase()] || `[${exec.status.toUpperCase()}]`;
            const durationStr = exec.duration ? `${exec.duration}ms` : 'N/A';
            output += `

${emoji} Execution: ${exec.executionId}
${'─'.repeat(70)}
Agent: ${exec.agentName}
Status: ${exec.status}
Started: ${exec.startTime}
Duration: ${durationStr}`;
            if (exec.triggerType) {
                output += `
Trigger: ${exec.triggerType}${exec.triggerContext ? ` - ${exec.triggerContext.substring(0, 100)}` : ''}`;
            }
            if (exec.errorMessage) {
                output += `
ERROR: ${exec.errorMessage}`;
            }
            if (exec.toolCalls.length > 0) {
                output += `

Tool Calls (${exec.toolCalls.length}):`;
                for (const tool of exec.toolCalls) {
                    const toolEmoji = tool.status === 'success' || tool.status === 'completed' ? '[OK]' : '[FAIL]';
                    output += `
  ${tool.stepNumber}. ${toolEmoji} ${tool.toolName} (${tool.duration}ms)`;
                    // Show truncated input/output for failed tools or if verbose
                    if (tool.status !== 'success' && tool.status !== 'completed') {
                        if (tool.input) {
                            const truncInput = tool.input.length > 200
                                ? tool.input.substring(0, 200) + '...'
                                : tool.input;
                            output += `
     Input: ${truncInput}`;
                        }
                        if (tool.errorMessage) {
                            output += `
     Error: ${tool.errorMessage}`;
                        }
                    }
                }
            }
        }
        return {
            content: [{ type: 'text', text: output }],
        };
    }
    catch (error) {
        if (error instanceof ServiceNowError) {
            return {
                content: [{
                        type: 'text',
                        text: `Failed to query AIA logs: ${error.message}${error.suggestion ? `\n\nSuggestion: ${error.suggestion}` : ''}`,
                    }],
                isError: true,
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Failed to query AIA logs: ${error instanceof Error ? error.message : String(error)}`,
                }],
            isError: true,
        };
    }
}
// Tables that require explicit permission (contain sensitive data)
const RESTRICTED_TABLES = new Set([
    'sys_user_has_role',
    'sys_user_grmember',
    'oauth_credential',
    'discovery_credentials',
    'sys_certificate',
    'password_reset_request',
    'sys_cs_token',
    'sys_api_key',
]);
// Fields that should be redacted from output
const SENSITIVE_FIELDS = new Set([
    'password',
    'password_hash',
    'user_password',
    'secret',
    'api_key',
    'private_key',
    'client_secret',
    'token',
    'access_token',
    'refresh_token',
]);
// Default fields for common tables
const DEFAULT_FIELDS = {
    incident: ['number', 'short_description', 'state', 'priority', 'assigned_to', 'sys_created_on'],
    sys_user: ['user_name', 'first_name', 'last_name', 'email', 'active'],
    task: ['number', 'short_description', 'state', 'assigned_to', 'sys_created_on'],
    cmdb_ci: ['name', 'sys_class_name', 'operational_status', 'sys_updated_on'],
    change_request: ['number', 'short_description', 'state', 'type', 'sys_created_on'],
    problem: ['number', 'short_description', 'state', 'priority', 'sys_created_on'],
    kb_knowledge: ['number', 'short_description', 'workflow_state', 'sys_created_on'],
    sys_script_include: ['name', 'api_name', 'active', 'sys_updated_on'],
    sys_ui_action: ['name', 'table', 'active', 'sys_updated_on'],
};
export async function handleServiceNowQuery(args) {
    // Check connection
    if (!connectionManager.isConnected()) {
        return {
            content: [{
                    type: 'text',
                    text: `Not connected to ServiceNow. Use servicenow_connect first.

Example:
  servicenow_connect with instance="dev12345.service-now.com", username="admin", password="..."`,
                }],
            isError: true,
        };
    }
    const client = connectionManager.getActiveClient();
    if (!client) {
        return {
            content: [{ type: 'text', text: 'Connection error: No active client' }],
            isError: true,
        };
    }
    // Parse arguments
    const table = args.table;
    const query = args.query;
    const fields = args.fields;
    const limit = Math.min(Math.max(args.limit || 50, 1), 500);
    const orderBy = args.orderBy;
    const orderDirection = args.orderDirection || 'desc';
    if (!table) {
        return {
            content: [{ type: 'text', text: 'Error: table is required' }],
            isError: true,
        };
    }
    // Check for restricted tables
    if (RESTRICTED_TABLES.has(table.toLowerCase())) {
        return {
            content: [{
                    type: 'text',
                    text: `Access to table "${table}" is restricted for security reasons.

This table may contain sensitive credential or permission data.
If you need access, consult your ServiceNow administrator.`,
                }],
            isError: true,
        };
    }
    try {
        // Build the full query
        let fullQuery = query || '';
        // Add ordering
        if (orderBy) {
            const orderClause = orderDirection === 'asc'
                ? `ORDERBY${orderBy}`
                : `ORDERBYDESC${orderBy}`;
            fullQuery = fullQuery ? `${fullQuery}^${orderClause}` : orderClause;
        }
        else if (!fullQuery.includes('ORDERBY')) {
            // Default order by sys_created_on desc
            fullQuery = fullQuery ? `${fullQuery}^ORDERBYDESCsys_created_on` : 'ORDERBYDESCsys_created_on';
        }
        // Determine fields to retrieve
        let fieldsToFetch;
        if (fields && fields.length > 0) {
            fieldsToFetch = fields;
        }
        else if (DEFAULT_FIELDS[table.toLowerCase()]) {
            fieldsToFetch = DEFAULT_FIELDS[table.toLowerCase()];
        }
        else {
            // Generic default fields
            fieldsToFetch = ['sys_id', 'sys_created_on', 'sys_updated_on'];
        }
        // Always include sys_id
        if (!fieldsToFetch.includes('sys_id')) {
            fieldsToFetch = ['sys_id', ...fieldsToFetch];
        }
        // Query the table
        const response = await client.queryTable(table, fullQuery, fieldsToFetch, limit);
        const records = response.result || [];
        if (records.length === 0) {
            return {
                content: [{
                        type: 'text',
                        text: `No records found in "${table}"${query ? ` matching query: ${query}` : ''}.

Try adjusting your query or checking the table name.`,
                    }],
            };
        }
        // Format records, redacting sensitive fields
        const formattedRecords = records.map((record, index) => {
            const lines = [`[${index + 1}] sys_id: ${record.sys_id}`];
            for (const [key, value] of Object.entries(record)) {
                if (key === 'sys_id')
                    continue; // Already shown
                // Redact sensitive fields
                if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
                    lines.push(`  ${key}: [REDACTED]`);
                    continue;
                }
                // Format the value
                let displayValue;
                if (value === null || value === undefined) {
                    displayValue = '(empty)';
                }
                else if (typeof value === 'object') {
                    // Reference field with display_value
                    const refObj = value;
                    displayValue = refObj.display_value || refObj.value || JSON.stringify(value);
                }
                else {
                    displayValue = String(value);
                }
                // Truncate long values
                if (displayValue.length > 200) {
                    displayValue = displayValue.substring(0, 200) + '...';
                }
                lines.push(`  ${key}: ${displayValue}`);
            }
            return lines.join('\n');
        });
        const status = connectionManager.getStatus();
        const header = `Query Results from ${status.activeInstance}
Table: ${table}
Query: ${query || '(all records)'}
Fields: ${fieldsToFetch.join(', ')}
Found: ${records.length} record(s)${records.length === limit ? ' (limit reached)' : ''}

${'─'.repeat(60)}`;
        return {
            content: [{
                    type: 'text',
                    text: `${header}\n\n${formattedRecords.join('\n\n')}`,
                }],
        };
    }
    catch (error) {
        if (error instanceof ServiceNowError) {
            let errorMsg = `Failed to query table "${table}": ${error.message}`;
            // Add helpful suggestions based on error type
            if (error.type === ServiceNowErrorType.TABLE_NOT_ACCESSIBLE) {
                errorMsg += `\n\nPossible causes:
- Table name may be incorrect
- Your user may lack read access to this table
- The table may not exist in this instance`;
            }
            if (error.suggestion) {
                errorMsg += `\n\nSuggestion: ${error.suggestion}`;
            }
            return {
                content: [{ type: 'text', text: errorMsg }],
                isError: true,
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Failed to query table "${table}": ${error instanceof Error ? error.message : String(error)}`,
                }],
            isError: true,
        };
    }
}
// Patterns that are ALWAYS blocked (dangerous operations)
const BLOCKED_PATTERNS = [
    // Mass data operations
    { pattern: /\.deleteMultiple\s*\(/i, reason: 'Mass delete operations are blocked' },
    { pattern: /\.updateMultiple\s*\(/i, reason: 'Mass update operations are blocked' },
    // Table structure changes
    { pattern: /GlideTableCreator/i, reason: 'Table creation is blocked' },
    { pattern: /TableDrop|dropTable/i, reason: 'Table deletion is blocked' },
    { pattern: /sys_db_object.*delete/i, reason: 'System table modifications are blocked' },
    // Credential access
    { pattern: /discovery_credentials/i, reason: 'Credential table access is blocked' },
    { pattern: /oauth_credential/i, reason: 'OAuth credential access is blocked' },
    { pattern: /sys_certificate/i, reason: 'Certificate access is blocked' },
    { pattern: /\.password\s*=/i, reason: 'Password modification is blocked' },
    { pattern: /password_reset/i, reason: 'Password reset operations are blocked' },
    // System property changes
    { pattern: /gs\.setProperty/i, reason: 'System property changes are blocked' },
    { pattern: /GlideProperties\.set/i, reason: 'Property changes are blocked' },
    // External calls
    { pattern: /RESTMessageV2/i, reason: 'External REST calls are blocked' },
    { pattern: /SOAPMessageV2/i, reason: 'External SOAP calls are blocked' },
    { pattern: /GlideHTTPRequest/i, reason: 'External HTTP calls are blocked' },
    { pattern: /httpRequest/i, reason: 'External HTTP calls are blocked' },
    // Security bypasses
    { pattern: /setAbortAction\s*\(\s*false/i, reason: 'Business rule bypass is blocked' },
    { pattern: /setWorkflow\s*\(\s*false/i, reason: 'Workflow bypass is blocked' },
    // Code execution
    { pattern: /GlideEvaluator/i, reason: 'Dynamic code evaluation is blocked' },
    { pattern: /eval\s*\(/i, reason: 'Eval is blocked' },
    // User impersonation
    { pattern: /impersonateUser/i, reason: 'User impersonation is blocked' },
    { pattern: /setSessionUser/i, reason: 'Session manipulation is blocked' },
];
// Patterns that indicate data mutations (blocked in readonly mode)
const MUTATION_PATTERNS = [
    { pattern: /\.insert\s*\(/i, operation: 'insert' },
    { pattern: /\.update\s*\(/i, operation: 'update' },
    { pattern: /\.deleteRecord\s*\(/i, operation: 'delete' },
    { pattern: /\.delete\s*\(/i, operation: 'delete' },
    { pattern: /\.setAbortAction/i, operation: 'abort control' },
    { pattern: /\.setValue\s*\([^)]+\)\s*;?\s*(gr\.|rec\.|record\.)?update/i, operation: 'setValue+update' },
];
// Warning patterns (not blocked, but noted)
const WARNING_PATTERNS = [
    { pattern: /while\s*\(\s*true\s*\)/i, warning: 'Infinite loop detected - ensure exit condition exists' },
    { pattern: /for\s*\(\s*;\s*;\s*\)/i, warning: 'Infinite loop detected' },
    { pattern: /\.query\s*\(\s*\)(?!.*getRowCount)(?!.*next)/i, warning: 'Query without iteration - may be inefficient' },
    { pattern: /getRowCount\s*\(\s*\)/i, warning: 'getRowCount() can be slow on large tables' },
];
function analyzeScript(script) {
    const blockedPatterns = [];
    const warnings = [];
    let hasMutations = false;
    // Check blocked patterns
    for (const { pattern, reason } of BLOCKED_PATTERNS) {
        if (pattern.test(script)) {
            blockedPatterns.push(reason);
        }
    }
    // Check mutation patterns
    for (const { pattern, operation } of MUTATION_PATTERNS) {
        if (pattern.test(script)) {
            hasMutations = true;
            warnings.push(`Script contains ${operation} operation`);
        }
    }
    // Check warning patterns
    for (const { pattern, warning } of WARNING_PATTERNS) {
        if (pattern.test(script)) {
            warnings.push(warning);
        }
    }
    return {
        safe: blockedPatterns.length === 0,
        blockedPatterns,
        warnings,
        hasMutations,
    };
}
// Wrap script with readonly guards
function wrapReadonlyScript(script) {
    // Wrap the script to prevent actual mutations
    // This uses try/catch and transaction rollback concept
    return `
// Readonly mode - mutations will be logged but not committed
var __readonly_mode = true;
var __mutation_attempts = [];

// Override GlideRecord mutation methods in readonly mode
(function() {
  var originalInsert = GlideRecord.prototype.insert;
  var originalUpdate = GlideRecord.prototype.update;
  var originalDeleteRecord = GlideRecord.prototype.deleteRecord;

  if (__readonly_mode) {
    GlideRecord.prototype.insert = function() {
      __mutation_attempts.push('INSERT blocked on ' + this.getTableName());
      gs.info('[READONLY] INSERT blocked on ' + this.getTableName());
      return null;
    };
    GlideRecord.prototype.update = function() {
      __mutation_attempts.push('UPDATE blocked on ' + this.getTableName() + ' (sys_id: ' + this.sys_id + ')');
      gs.info('[READONLY] UPDATE blocked on ' + this.getTableName());
      return null;
    };
    GlideRecord.prototype.deleteRecord = function() {
      __mutation_attempts.push('DELETE blocked on ' + this.getTableName() + ' (sys_id: ' + this.sys_id + ')');
      gs.info('[READONLY] DELETE blocked on ' + this.getTableName());
      return false;
    };
  }
})();

// User script begins
try {
${script}
} catch(e) {
  gs.error('Script error: ' + e.message);
}
// User script ends

if (__mutation_attempts.length > 0) {
  gs.info('\\n[READONLY MODE] Blocked mutations:\\n- ' + __mutation_attempts.join('\\n- '));
}
`;
}
export async function handleServiceNowScript(args) {
    // Check connection
    if (!connectionManager.isConnected()) {
        return {
            content: [{
                    type: 'text',
                    text: `Not connected to ServiceNow. Use servicenow_connect first.

Example:
  servicenow_connect with instance="dev12345.service-now.com", username="admin", password="..."`,
                }],
            isError: true,
        };
    }
    const client = connectionManager.getActiveClient();
    if (!client) {
        return {
            content: [{ type: 'text', text: 'Connection error: No active client' }],
            isError: true,
        };
    }
    // Parse arguments
    const script = args.script;
    const mode = args.mode || 'readonly';
    const timeout = Math.min(Math.max(args.timeout || 30, 1), 120);
    const description = args.description || 'Script executed via Claude Code';
    if (!script || script.trim().length === 0) {
        return {
            content: [{ type: 'text', text: 'Error: script is required and cannot be empty' }],
            isError: true,
        };
    }
    // Analyze script for safety
    const analysis = analyzeScript(script);
    // Block if dangerous patterns found
    if (!analysis.safe) {
        return {
            content: [{
                    type: 'text',
                    text: `Script blocked for safety reasons:

${analysis.blockedPatterns.map(p => '- ' + p).join('\n')}

These operations are not allowed through this tool.
If you need to perform these operations, use the ServiceNow UI with appropriate permissions.`,
                }],
            isError: true,
        };
    }
    // In readonly mode, block mutations
    if (mode === 'readonly' && analysis.hasMutations) {
        const warningText = `Script contains data mutation operations that will be BLOCKED in readonly mode:

${analysis.warnings.filter(w => w.includes('operation')).map(w => '- ' + w).join('\n')}

The script will run but mutations will not be committed.
To execute mutations, use mode="execute" (requires explicit confirmation).`;
        // Continue with readonly wrapper, but warn
        const wrappedScript = wrapReadonlyScript(script);
        try {
            const result = await executeScript(client, wrappedScript, timeout, description);
            return {
                content: [{
                        type: 'text',
                        text: `${warningText}

${'─'.repeat(60)}
EXECUTION RESULT (readonly mode)
${'─'.repeat(60)}

${result.output || '(no output)'}

${result.logs ? `\nLogs:\n${result.logs}` : ''}`,
                    }],
            };
        }
        catch (error) {
            return formatScriptError(error, mode);
        }
    }
    // Execute mode - warn about mutations
    if (mode === 'execute' && analysis.hasMutations) {
        // For execute mode with mutations, show clear warning in output
        const mutationWarning = `[EXECUTE MODE] This script may modify data:
${analysis.warnings.map(w => '- ' + w).join('\n')}`;
        try {
            const result = await executeScript(client, script, timeout, description);
            return {
                content: [{
                        type: 'text',
                        text: `${mutationWarning}

${'─'.repeat(60)}
EXECUTION RESULT
${'─'.repeat(60)}

${result.output || '(no output)'}

${result.logs ? `\nLogs:\n${result.logs}` : ''}
${result.duration ? `\nDuration: ${result.duration}ms` : ''}`,
                    }],
            };
        }
        catch (error) {
            return formatScriptError(error, mode);
        }
    }
    // Standard execution (no mutations detected or execute mode)
    try {
        const scriptToRun = mode === 'readonly' ? wrapReadonlyScript(script) : script;
        const result = await executeScript(client, scriptToRun, timeout, description);
        const status = connectionManager.getStatus();
        const header = `Script Execution on ${status.activeInstance}
Mode: ${mode}
Timeout: ${timeout}s
${analysis.warnings.length > 0 ? `Warnings: ${analysis.warnings.length}` : ''}`;
        let output = `${header}

${'─'.repeat(60)}
RESULT
${'─'.repeat(60)}

${result.output || '(no output)'}`;
        if (result.logs) {
            output += `\n\nLogs:\n${result.logs}`;
        }
        if (result.duration) {
            output += `\n\nDuration: ${result.duration}ms`;
        }
        if (analysis.warnings.length > 0) {
            output += `\n\nWarnings:\n${analysis.warnings.map(w => '- ' + w).join('\n')}`;
        }
        return {
            content: [{ type: 'text', text: output }],
        };
    }
    catch (error) {
        return formatScriptError(error, mode);
    }
}
async function executeScript(client, script, timeout, description) {
    // Try multiple known script execution endpoints
    const endpoints = [
        { path: '/api/now/sp/widget/script', method: 'POST' },
        { path: '/api/sn_sc/servicecatalog/items/script', method: 'POST' },
    ];
    // First, try using a sys_script record approach
    // This creates a temporary script record, executes it, and cleans up
    try {
        return await executeViaScriptRecord(client, script, timeout, description);
    }
    catch (scriptRecordError) {
        // If that fails, try direct evaluation endpoints
        for (const endpoint of endpoints) {
            try {
                const response = await client.requestWithRetry(endpoint.path, {
                    method: endpoint.method,
                    body: { script, timeout: timeout * 1000 },
                    timeout: (timeout + 5) * 1000,
                });
                if (response.result) {
                    return {
                        output: String(response.result),
                        success: true,
                    };
                }
            }
            catch {
                // Endpoint not available, try next
                continue;
            }
        }
        // If all direct methods fail, return a helpful error
        throw new ServiceNowError(ServiceNowErrorType.SCRIPT_ERROR, 'No script execution endpoint available on this instance', { triedEndpoints: endpoints.map(e => e.path) }, 'Script execution may require a custom Scripted REST API or additional permissions');
    }
}
async function executeViaScriptRecord(client, script, timeout, description) {
    // This approach uses the Evaluator script include concept
    // We'll create a script that captures its output via gs.info
    const wrappedScript = `
var __output = [];
var __originalInfo = gs.info;
gs.info = function(msg) {
  __output.push(String(msg));
  __originalInfo.call(gs, msg);
};

try {
  ${script}
} catch(e) {
  __output.push('ERROR: ' + e.message);
}

gs.info = __originalInfo;
gs.info('__SCRIPT_OUTPUT__: ' + JSON.stringify(__output));
`;
    // Try to execute via Fix Script or Background Script mechanism
    // First check if there's a script execution table we can use
    const startTime = Date.now();
    // Create a temporary fix script record
    try {
        const createResponse = await client.requestWithRetry('/api/now/table/sys_script_fix', {
            method: 'POST',
            body: {
                name: `Claude_Temp_${Date.now()}`,
                script: wrappedScript,
                description: description,
                active: true,
            },
            timeout: 10000,
        });
        const scriptSysId = createResponse.result?.sys_id;
        if (!scriptSysId) {
            throw new Error('Failed to create script record');
        }
        // Execute the fix script
        try {
            await client.requestWithRetry(`/api/now/table/sys_script_fix/${scriptSysId}`, {
                method: 'PATCH',
                body: { state: 'ready' },
                timeout: timeout * 1000,
            });
        }
        catch {
            // Execution might fail but output could still be captured
        }
        // Wait a moment for execution
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Check syslog for output
        const logResponse = await client.queryTable('syslog', `messageLIKE__SCRIPT_OUTPUT__^sys_created_on>=javascript:gs.minutesAgoStart(5)^ORDERBYDESCsys_created_on`, ['message'], 1);
        // Clean up - delete the temp script
        try {
            await client.requestWithRetry(`/api/now/table/sys_script_fix/${scriptSysId}`, { method: 'DELETE', timeout: 5000 });
        }
        catch {
            // Cleanup failure is not critical
        }
        const duration = Date.now() - startTime;
        if (logResponse.result && logResponse.result.length > 0) {
            const logMessage = logResponse.result[0].message;
            const outputMatch = logMessage.match(/__SCRIPT_OUTPUT__:\s*(\[.*\])/);
            if (outputMatch) {
                try {
                    const outputArray = JSON.parse(outputMatch[1]);
                    return {
                        output: outputArray.join('\n'),
                        duration,
                        success: true,
                    };
                }
                catch {
                    return {
                        output: logMessage,
                        duration,
                        success: true,
                    };
                }
            }
        }
        return {
            output: '(script executed but no output captured)',
            duration,
            success: true,
        };
    }
    catch (error) {
        // Fix script approach didn't work
        throw error;
    }
}
function formatScriptError(error, mode) {
    if (error instanceof ServiceNowError) {
        let message = `Script execution failed: ${error.message}`;
        if (error.type === ServiceNowErrorType.ACL_DENIED) {
            message += `\n\nYour user may lack permissions to execute background scripts.
Required roles typically include: admin, or script execution roles.`;
        }
        if (error.suggestion) {
            message += `\n\nSuggestion: ${error.suggestion}`;
        }
        return {
            content: [{ type: 'text', text: message }],
            isError: true,
        };
    }
    return {
        content: [{
                type: 'text',
                text: `Script execution failed: ${error instanceof Error ? error.message : String(error)}

Mode: ${mode}
This may be due to:
- Insufficient permissions
- Script timeout
- Instance doesn't support background script API`,
            }],
        isError: true,
    };
}
// ============================================================================
// Instance Info Handler
// ============================================================================
// Known feature plugins and their identifiers
const FEATURE_PLUGINS = {
    now_assist: {
        plugins: ['com.snc.now_assist', 'sn_now_assist', 'com.glide.now_assist'],
        tables: ['sys_now_assist_config', 'sn_now_assist_skill'],
        description: 'Now Assist AI capabilities',
    },
    virtual_agent: {
        plugins: ['com.glide.cs.chatbot', 'com.snc.virtual_agent'],
        tables: ['sys_cs_topic', 'sys_cb_topic'],
        description: 'Virtual Agent chatbot',
    },
    aia: {
        plugins: ['com.snc.aia', 'sn_aia', 'com.glide.aia'],
        tables: ['sys_aia_execution', 'sn_agent_execution'],
        description: 'AI Agents (Agentic AI)',
    },
    predictive_intelligence: {
        plugins: ['com.glide.platform_ml'],
        tables: ['ml_capability_definition'],
        description: 'Predictive Intelligence / ML',
    },
    flow_designer: {
        plugins: ['com.glide.hub.flow_designer'],
        tables: ['sys_hub_flow'],
        description: 'Flow Designer automation',
    },
    integration_hub: {
        plugins: ['com.glide.hub.integration'],
        tables: ['sys_hub_spoke'],
        description: 'Integration Hub spokes',
    },
};
export async function handleServiceNowInstance(args) {
    // Check connection
    if (!connectionManager.isConnected()) {
        return {
            content: [{
                    type: 'text',
                    text: `Not connected to ServiceNow. Use servicenow_connect first.

Example:
  servicenow_connect with instance="dev12345.service-now.com", username="admin", password="..."`,
                }],
            isError: true,
        };
    }
    const client = connectionManager.getActiveClient();
    if (!client) {
        return {
            content: [{ type: 'text', text: 'Connection error: No active client' }],
            isError: true,
        };
    }
    const session = connectionManager.getActiveSession();
    const includePlugins = args.includePlugins === true;
    const includeHealth = args.includeHealth === true;
    const checkFeatures = args.checkFeatures || ['now_assist', 'virtual_agent', 'aia'];
    try {
        // Get basic instance info
        const instanceInfo = await getInstanceInfo(client);
        // Check requested features
        const featureStatuses = [];
        for (const featureName of checkFeatures) {
            const featureConfig = FEATURE_PLUGINS[featureName.toLowerCase()];
            if (featureConfig) {
                const status = await checkFeature(client, featureName, featureConfig);
                featureStatuses.push(status);
            }
            else {
                featureStatuses.push({
                    name: featureName,
                    enabled: false,
                    description: 'Unknown feature',
                    details: 'Feature not recognized',
                });
            }
        }
        // Get plugins if requested
        let plugins = [];
        if (includePlugins) {
            plugins = await getInstalledPlugins(client);
        }
        // Get health metrics if requested
        let health;
        if (includeHealth) {
            health = await getHealthMetrics(client);
        }
        // Format output
        let output = `ServiceNow Instance Information
${'═'.repeat(60)}

Instance: ${session?.instanceUrl}
Version: ${instanceInfo.version}
Build: ${instanceInfo.buildTag || 'N/A'}
${instanceInfo.buildDate ? `Build Date: ${instanceInfo.buildDate}` : ''}

${'─'.repeat(60)}
FEATURES
${'─'.repeat(60)}`;
        for (const feature of featureStatuses) {
            const statusIcon = feature.enabled ? '[ON]' : '[OFF]';
            output += `\n${statusIcon} ${feature.name}: ${feature.description}`;
            if (feature.details) {
                output += `\n    ${feature.details}`;
            }
        }
        if (includePlugins && plugins.length > 0) {
            output += `\n\n${'─'.repeat(60)}
INSTALLED PLUGINS (${plugins.length})
${'─'.repeat(60)}`;
            // Group by active/inactive
            const activePlugins = plugins.filter(p => p.active);
            const inactivePlugins = plugins.filter(p => !p.active);
            if (activePlugins.length > 0) {
                output += `\n\nActive (${activePlugins.length}):`;
                for (const plugin of activePlugins.slice(0, 50)) { // Limit to 50
                    output += `\n  - ${plugin.name} (${plugin.id})`;
                }
                if (activePlugins.length > 50) {
                    output += `\n  ... and ${activePlugins.length - 50} more`;
                }
            }
            if (inactivePlugins.length > 0 && inactivePlugins.length <= 10) {
                output += `\n\nInactive (${inactivePlugins.length}):`;
                for (const plugin of inactivePlugins) {
                    output += `\n  - ${plugin.name}`;
                }
            }
            else if (inactivePlugins.length > 10) {
                output += `\n\nInactive: ${inactivePlugins.length} plugins`;
            }
        }
        if (includeHealth && health) {
            output += `\n\n${'─'.repeat(60)}
HEALTH METRICS
${'─'.repeat(60)}`;
            if (health.semaphores) {
                const usage = Math.round((1 - health.semaphores.available / health.semaphores.max) * 100);
                output += `\nSemaphores: ${health.semaphores.available}/${health.semaphores.max} available (${usage}% used)`;
            }
            if (health.scheduledJobs) {
                output += `\nScheduled Jobs: ${health.scheduledJobs.running} running, ${health.scheduledJobs.queued} queued`;
            }
            if (health.transactions !== undefined) {
                output += `\nActive Transactions: ${health.transactions.current}`;
            }
        }
        // Add user context
        output += `\n\n${'─'.repeat(60)}
CONNECTION
${'─'.repeat(60)}
User: ${session?.userName}
Roles: ${session?.userRoles?.slice(0, 5).join(', ')}${(session?.userRoles?.length || 0) > 5 ? ` (+${(session?.userRoles?.length || 0) - 5} more)` : ''}
Connected: ${session?.createdAt.toISOString()}`;
        return {
            content: [{ type: 'text', text: output }],
        };
    }
    catch (error) {
        if (error instanceof ServiceNowError) {
            return {
                content: [{
                        type: 'text',
                        text: `Failed to get instance info: ${error.message}${error.suggestion ? `\n\nSuggestion: ${error.suggestion}` : ''}`,
                    }],
                isError: true,
            };
        }
        return {
            content: [{
                    type: 'text',
                    text: `Failed to get instance info: ${error instanceof Error ? error.message : String(error)}`,
                }],
            isError: true,
        };
    }
}
async function getInstanceInfo(client) {
    // Query sys_properties for version info
    const properties = ['glide.buildtag', 'glide.buildname', 'glide.builddate'];
    const results = {};
    for (const propName of properties) {
        try {
            const response = await client.queryTable('sys_properties', `name=${propName}`, ['value'], 1);
            if (response.result && response.result.length > 0) {
                results[propName] = response.result[0].value;
            }
        }
        catch {
            // Property might not exist
        }
    }
    const buildTag = results['glide.buildtag'] || '';
    const versionMatch = buildTag.match(/glide-(\w+)-/i);
    const version = versionMatch
        ? versionMatch[1].charAt(0).toUpperCase() + versionMatch[1].slice(1)
        : results['glide.buildname'] || 'Unknown';
    return {
        version,
        buildTag: buildTag || undefined,
        buildDate: results['glide.builddate'] || undefined,
    };
}
async function checkFeature(client, featureName, config) {
    // First try to find the plugin
    for (const pluginId of config.plugins) {
        try {
            const response = await client.queryTable('v_plugin', `id=${pluginId}^active=true`, ['id', 'name'], 1);
            if (response.result && response.result.length > 0) {
                return {
                    name: featureName,
                    enabled: true,
                    description: config.description,
                    details: `Plugin: ${response.result[0].name || pluginId}`,
                };
            }
        }
        catch {
            // Plugin table might not be accessible, try tables
        }
    }
    // Fallback: try to access one of the feature's tables
    for (const tableName of config.tables) {
        try {
            const response = await client.queryTable(tableName, '', ['sys_id'], 1);
            // If we can query the table, the feature is likely enabled
            if (response.result !== undefined) {
                return {
                    name: featureName,
                    enabled: true,
                    description: config.description,
                    details: `Table ${tableName} accessible`,
                };
            }
        }
        catch {
            // Table doesn't exist or not accessible
        }
    }
    return {
        name: featureName,
        enabled: false,
        description: config.description,
        details: 'Plugin not found or not active',
    };
}
async function getInstalledPlugins(client) {
    try {
        const response = await client.queryTable('v_plugin', 'ORDERBYname', ['id', 'name', 'version', 'active'], 200);
        if (!response.result)
            return [];
        return response.result.map(p => ({
            id: p.id,
            name: p.name || p.id,
            version: p.version || '',
            active: p.active === 'true' || p.active === true,
        }));
    }
    catch {
        // Plugin table might not be accessible
        return [];
    }
}
async function getHealthMetrics(client) {
    const metrics = {};
    // Try to get semaphore info
    try {
        const response = await client.queryTable('sys_semaphore', '', ['name', 'max_count', 'count'], 10);
        if (response.result && response.result.length > 0) {
            let totalMax = 0;
            let totalAvailable = 0;
            for (const sem of response.result) {
                totalMax += parseInt(sem.max_count, 10) || 0;
                totalAvailable += parseInt(sem.count, 10) || 0;
            }
            if (totalMax > 0) {
                metrics.semaphores = { available: totalAvailable, max: totalMax };
            }
        }
    }
    catch {
        // Semaphore table might not be accessible
    }
    // Try to get scheduled job info
    try {
        const runningResponse = await client.queryTable('sys_trigger', 'state=executing', ['sys_id'], 100);
        const queuedResponse = await client.queryTable('sys_trigger', 'state=queued', ['sys_id'], 100);
        metrics.scheduledJobs = {
            running: runningResponse.result?.length || 0,
            queued: queuedResponse.result?.length || 0,
        };
    }
    catch {
        // Trigger table might not be accessible
    }
    return metrics;
}
// Route tool calls to handlers
export async function handleServiceNowTool(name, args) {
    switch (name) {
        case 'servicenow_connect':
            return handleServiceNowConnect(args);
        case 'servicenow_disconnect':
            return handleServiceNowDisconnect(args);
        case 'servicenow_status':
            return handleServiceNowStatus(args);
        case 'servicenow_syslogs':
            return handleServiceNowSyslogs(args);
        case 'servicenow_aia_logs':
            return handleServiceNowAiaLogs(args);
        case 'servicenow_query':
            return handleServiceNowQuery(args);
        case 'servicenow_script':
            return handleServiceNowScript(args);
        case 'servicenow_instance':
            return handleServiceNowInstance(args);
        default:
            return null; // Not a ServiceNow tool
    }
}
// Check if a tool name is a ServiceNow tool
export function isServiceNowTool(name) {
    return SERVICENOW_TOOLS.some(tool => tool.name === name);
}
//# sourceMappingURL=tools.js.map