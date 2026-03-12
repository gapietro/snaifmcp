/**
 * ServiceNow AI Agent (AIA) Tools
 *
 * Tools for listing, inspecting, tracing, executing, and creating
 * AI Agents on a connected ServiceNow instance.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { connectionManager } from './connection-manager.js';
import { ServiceNowError, ServiceNowErrorType } from './types.js';
import { requireConnection, isConnectionError } from './guards.js';
import {
  discoverTable,
  AIA_AGENT_TABLES,
  AIA_TOOL_TABLES,
  AIA_AGENT_TOOL_M2M_TABLES,
  AIA_EXECUTION_PLAN_TABLES,
  AIA_TOOL_EXECUTION_TABLES,
  AIA_USECASE_TABLES,
  AIA_TRIGGER_TABLES,
  AIA_AGENT_CHILD_TABLES,
  AIA_TEAM_TABLES,
  AIA_TEAM_MEMBER_TABLES,
  AIA_STRATEGY_TABLES,
} from './table-discovery.js';
import type { ToolResult } from './tools.js';
import { ensureScriptApi, executeViaScriptApi, getLastDeploymentError } from './script-api.js';

/** Role hint included in error messages when AIA table access fails. */
export const AIA_ROLE_HINT = 'Ensure your user has the `sn_aia.admin` role for AI Agent table access.';

/** Patterns that hang indefinitely in ServiceNow AIA tool script execution contexts. */
interface ForbiddenPattern {
  regex: RegExp;
  label: string;
  suggestion: string;
}

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    regex: /\bgs\.(info|warn|error|log|print)\s*\(/,
    label: 'gs.info/warn/error/log/print()',
    suggestion: 'use outputs.debug instead',
  },
  {
    regex: /\bgs\.(getUserName|getUserID|getSessionID|now)\s*\(/,
    label: 'gs.getUserName/getUserID/getSessionID/now()',
    suggestion: 'session APIs are not available in tool context',
  },
  {
    regex: /\bnew\s+GlideDateTime\s*\(/,
    label: 'new GlideDateTime()',
    suggestion: 'use new Date() instead',
  },
  {
    regex: /\bnew\s+GlideAjax\s*\(/,
    label: 'new GlideAjax()',
    suggestion: 'GlideAjax is a client-side class and cannot be used in server-side tool scripts',
  },
];

/**
 * Scan a tool script for forbidden APIs that hang in AIA tool execution contexts.
 * Returns an array of warning strings (empty if script is clean).
 */
export function scanToolScript(script: string): string[] {
  const warnings: string[] = [];
  const lines = script.split('\n');

  for (const { regex, label, suggestion } of FORBIDDEN_PATTERNS) {
    const foundLines: number[] = [];
    lines.forEach((line, idx) => {
      if (regex.test(line)) {
        foundLines.push(idx + 1);
      }
    });
    if (foundLines.length > 0) {
      warnings.push(`  - ${label} at line${foundLines.length > 1 ? 's' : ''} ${foundLines.join(', ')} — ${suggestion}`);
    }
  }

  return warnings;
}

// Helper to resolve ServiceNow reference fields that may be strings or objects
export function resolveRefField(field: unknown, fallback = 'N/A'): string {
  if (!field) return fallback;
  if (typeof field === 'string') return field || fallback;
  const ref = field as { display_value?: string; value?: string };
  return ref.display_value || ref.value || fallback;
}

// Helper to format time ranges as ServiceNow datetime filters
function getTimeRangeQuery(timeRange: string): string {
  const now = new Date();
  let offsetMs: number;
  switch (timeRange) {
    case '1h': offsetMs = 60 * 60 * 1000; break;
    case '4h': offsetMs = 4 * 60 * 60 * 1000; break;
    case '12h': offsetMs = 12 * 60 * 60 * 1000; break;
    case '24h': offsetMs = 24 * 60 * 60 * 1000; break;
    case '7d': offsetMs = 7 * 24 * 60 * 60 * 1000; break;
    default: offsetMs = 4 * 60 * 60 * 1000;
  }
  const startTime = new Date(now.getTime() - offsetMs);
  const formatted = startTime.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  return `sys_created_on>=${formatted}`;
}

// ════════════════════════════════════════════════════════════════
// Tool Definitions
// ════════════════════════════════════════════════════════════════

export const SERVICENOW_AIA_LIST_TOOL: Tool = {
  name: 'servicenow_aia_list',
  description: `List all AI Agents on the connected ServiceNow instance.

Shows agent name, description, status, strategy, and tool count.
Use this to discover what agents exist before inspecting specific ones.

Requires an active connection (use servicenow_connect first).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'all'],
        description: 'Filter by agent status (default: "all")',
      },
      nameFilter: {
        type: 'string',
        description: 'Filter by agent name (partial match)',
      },
      includeTools: {
        type: 'boolean',
        description: 'Include tool names for each agent (default: false)',
      },
      limit: {
        type: 'number',
        description: 'Maximum agents to return (default: 50, max: 200)',
      },
    },
  },
};

export const SERVICENOW_AIA_GET_TOOL: Tool = {
  name: 'servicenow_aia_get',
  description: `Get complete configuration of a specific AI Agent.

Returns full details: instructions/prompt, strategy, all tools with their scripts and schemas, and recent execution stats.

Use agent name or sys_id. Requires an active connection. Use includeChildren: true to see child agents this agent delegates to (multi-agent chains).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      agent: {
        type: 'string',
        description: 'Agent name or sys_id',
      },
      includePrompt: {
        type: 'boolean',
        description: 'Include full agent instructions/prompt (default: true)',
      },
      includeToolDetails: {
        type: 'boolean',
        description: 'Include tool scripts and schemas (default: true)',
      },
      includeStats: {
        type: 'boolean',
        description: 'Include recent execution statistics (default: false)',
      },
      includeChildren: {
        type: 'boolean',
        description: 'Include child agents this agent delegates to, queried from sn_aia_agent_child (default: false)',
      },
    },
    required: ['agent'],
  },
};

export const SERVICENOW_AIA_TRACE_TOOL: Tool = {
  name: 'servicenow_aia_trace',
  description: `Deep execution trace for a specific AI Agent run.

Shows step-by-step: each decision, tool call with input/output, timing, and errors.
Use this to debug why an agent failed or produced unexpected results.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      executionId: {
        type: 'string',
        description: 'Execution sys_id to trace (required)',
      },
      includeTokenUsage: {
        type: 'boolean',
        description: 'Include token usage per step (default: false)',
      },
      includeRawPayloads: {
        type: 'boolean',
        description: 'Include full input/output payloads (default: false)',
      },
    },
    required: ['executionId'],
  },
};

export const SERVICENOW_AIA_ERRORS_TOOL: Tool = {
  name: 'servicenow_aia_errors',
  description: `Aggregate error patterns across recent AI Agent executions.

Groups errors by type, agent, or tool to identify systemic issues.
Use this to answer "Why are 40% of runs failing?"

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      agent: {
        type: 'string',
        description: 'Filter to specific agent (name or sys_id)',
      },
      timeRange: {
        type: 'string',
        enum: ['1h', '4h', '12h', '24h', '7d'],
        description: 'Time range to analyze (default: "24h")',
      },
      groupBy: {
        type: 'string',
        enum: ['error_type', 'agent', 'tool'],
        description: 'How to group errors (default: "error_type")',
      },
      limit: {
        type: 'number',
        description: 'Max error groups to return (default: 20)',
      },
    },
  },
};

export const SERVICENOW_AIA_EXECUTE_TOOL: Tool = {
  name: 'servicenow_aia_execute',
  description: `Trigger an AI Agent with test input and return the result.

Invokes an agent programmatically for testing. Useful for iterating on agent prompts:
update prompt -> test -> see output -> repeat.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      agent: {
        type: 'string',
        description: 'Agent name or sys_id',
      },
      input: {
        type: 'string',
        description: 'Input/objective for the agent',
      },
      targetTable: {
        type: 'string',
        description: 'Target table context (e.g., "incident")',
      },
      targetRecord: {
        type: 'string',
        description: 'Target record sys_id for context',
      },
      waitForCompletion: {
        type: 'boolean',
        description: 'Wait for agent to complete (default: true)',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Max seconds to wait (default: 60, max: 120)',
      },
      executionMode: {
        type: 'string',
        enum: ['autopilot', 'copilot'],
        description: 'Agent execution mode (default: "autopilot")',
      },
      maxTurns: {
        type: 'number',
        description: 'Maximum conversation turns (default: 10)',
      },
      conversationUser: {
        type: 'string',
        description: 'User to run conversation as (default: connected username)',
      },
    },
    required: ['agent', 'input'],
  },
};

export const SERVICENOW_AIA_TOOL_EXECUTE_TOOL: Tool = {
  name: 'servicenow_aia_tool_execute',
  description: `Execute a single AIA tool directly by name or sys_id, without needing an agent.

Useful for testing tool scripts in isolation: "Does my tool work with this input?"

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      tool: {
        type: 'string',
        description: 'Tool name or sys_id',
      },
      input: {
        type: 'object',
        description: 'Input parameters matching the tool\'s input_definition',
      },
      timeoutSeconds: {
        type: 'number',
        description: 'Max seconds to wait (default: 30, max: 120)',
      },
    },
    required: ['tool', 'input'],
  },
};

export const SERVICENOW_AIA_USECASE_LIST_TOOL: Tool = {
  name: 'servicenow_aia_usecase_list',
  description: `List all AIA Use Cases on the connected ServiceNow instance.

Use Cases bridge Flow Designer flows to AI Agents. Each Use Case links
a trigger configuration to a specific agent.

Use this to discover what agents are wired up and whether they are active.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nameFilter: {
        type: 'string',
        description: 'Filter by name (partial match)',
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'all'],
        description: 'Filter by active status (default: all)',
      },
      limit: {
        type: 'number',
        description: 'Maximum use cases to return (default: 50, max: 200)',
      },
    },
  },
};

export const SERVICENOW_AIA_USECASE_GET_TOOL: Tool = {
  name: 'servicenow_aia_usecase_get',
  description: `Get complete details of a specific AIA Use Case.

Returns the use case name, description, active status, and linked agent.
Set includeAgent=true to also show the agent's name and active status.

Use the name or sys_id to identify the use case.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      usecase: {
        type: 'string',
        description: 'Use case name or sys_id',
      },
      includeAgent: {
        type: 'boolean',
        description: 'Resolve and show linked agent details (default: false)',
      },
    },
    required: ['usecase'],
  },
};

export const SERVICENOW_AIA_TRIGGER_GET_TOOL: Tool = {
  name: 'servicenow_aia_trigger_get',
  description: `Get the trigger configuration(s) for an AIA Use Case.

Returns the table monitored, the encoded query condition, and active status
from sn_aia_trigger_configuration. Use this to understand what fires an
Agentic Workflow and to debug why it is or isn't triggering.

Accepts a use case name or sys_id.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      usecase: {
        type: 'string',
        description: 'Use case name or sys_id',
      },
    },
    required: ['usecase'],
  },
};

export const SERVICENOW_AIA_CREATE_TOOL: Tool = {
  name: 'servicenow_aia_create',
  description: `Create an AI Agent with tools on the connected instance.

Creates the agent record, tool records, and agent-tool mappings via API.
Defaults to dry-run mode showing what would be created. Set dryRun=false to actually create.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      agentName: {
        type: 'string',
        description: 'Agent display name',
      },
      agentDescription: {
        type: 'string',
        description: 'What this agent does',
      },
      agentInstructions: {
        type: 'string',
        description: 'System prompt / instructions for the agent',
      },
      strategy: {
        type: 'string',
        enum: ['ReAct', 'ReActivePlanner'],
        description: 'Agent reasoning strategy (default: "ReAct")',
      },
      executionMode: {
        type: 'string',
        enum: ['autopilot', 'copilot'],
        description: 'Agent execution mode (default: "autopilot")',
      },
      maxIterations: {
        type: 'number',
        description: 'Maximum iterations per agent run (default: 10)',
      },
      tools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool display name' },
            description: { type: 'string', description: 'What this tool does' },
            script: {
              type: 'string',
              description: `Tool script (IIFE format). WARNING: These APIs hang indefinitely in tool scripts and must NOT be used: gs.info/warn/error/log/print() (use outputs.debug instead), gs.getUserName/getUserID/getSessionID/now() (session APIs unavailable), new GlideDateTime() (use new Date() instead), new GlideAjax() (unavailable in tool context). Use GlideRecordSecure for database queries.`,
            },
            inputSchema: { type: 'string', description: 'Input schema JSON string' },
            outputSchema: { type: 'string', description: 'Output schema JSON string' },
          },
          required: ['name', 'description', 'script', 'inputSchema'],
        },
        description: 'Array of tool definitions to create and attach',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview what would be created without modifying the instance (default: true)',
      },
    },
    required: ['agentName', 'agentDescription', 'agentInstructions'],
  },
};

export const SERVICENOW_AIA_USECASE_CREATE_TOOL: Tool = {
  name: 'servicenow_aia_usecase_create',
  description: `Create a complete AI Agent Use Case (6-table pattern) on ServiceNow.

Creates: Tools → Team → Use Case → Agents → Team Members → Tool M2Ms.
This is the full production pattern from the ServiceNow AI Agent framework.
Each agent is linked to the Team via a Team Member record, which is the
critical link that connects agents to the Use Case.

Defaults to dry-run. Set dryRun=false to actually create.

Requires an active connection (use servicenow_connect first).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Use Case display name' },
      prefix: {
        type: 'string',
        description: 'Short prefix prepended to all record names (e.g., "gp01"). Helps identify records on the instance.',
      },
      description: { type: 'string', description: 'What this Use Case does' },
      basePlan: {
        type: 'string',
        description: 'Orchestrator instructions — numbered steps describing how to route and coordinate agents',
      },
      agents: {
        type: 'array',
        description: 'Agent definitions (at least one required)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Agent display name (prefix prepended automatically)' },
            description: { type: 'string', description: 'What this agent does' },
            role: { type: 'string', description: "Agent's role — one paragraph describing its purpose and persona" },
            instructions: { type: 'string', description: 'Step-by-step instructions for the agent' },
            proficiency: { type: 'string', description: 'Bullet points of agent capabilities' },
            tools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Tool name (prefix prepended automatically)' },
                  description: { type: 'string', description: 'What this tool does' },
                  inputSchema: {
                    type: 'array',
                    description: 'Input parameter definitions',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                      },
                      required: ['name', 'description'],
                    },
                  },
                  script: { type: 'string', description: 'Server-side JavaScript. Use inputs.paramName to read inputs. Return a string.' },
                  executionMode: {
                    type: 'string',
                    enum: ['autopilot', 'copilot'],
                    description: 'Tool execution mode (default: "autopilot")',
                  },
                  maxAutoExecutions: {
                    type: 'number',
                    description: 'Max automatic executions (default: 10)',
                  },
                },
                required: ['name', 'description', 'inputSchema', 'script'],
              },
            },
          },
          required: ['name', 'description', 'role', 'instructions', 'proficiency'],
        },
      },
      executionMode: {
        type: 'string',
        enum: ['copilot', 'autopilot'],
        description: 'Use Case execution mode (default: "copilot")',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview what would be created without modifying the instance (default: true)',
      },
    },
    required: ['name', 'agents', 'basePlan'],
  },
};

// All AIA tools
export const AIA_TOOLS: Tool[] = [
  SERVICENOW_AIA_LIST_TOOL,
  SERVICENOW_AIA_GET_TOOL,
  SERVICENOW_AIA_TRACE_TOOL,
  SERVICENOW_AIA_ERRORS_TOOL,
  SERVICENOW_AIA_EXECUTE_TOOL,
  SERVICENOW_AIA_CREATE_TOOL,
  SERVICENOW_AIA_TOOL_EXECUTE_TOOL,
  SERVICENOW_AIA_USECASE_LIST_TOOL,
  SERVICENOW_AIA_USECASE_GET_TOOL,
  SERVICENOW_AIA_TRIGGER_GET_TOOL,
  SERVICENOW_AIA_USECASE_CREATE_TOOL,
];

// ════════════════════════════════════════════════════════════════
// Handler Implementations
// ════════════════════════════════════════════════════════════════

export async function handleAiaList(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const status = (args.status as string) || 'all';
  const nameFilter = args.nameFilter as string | undefined;
  const includeTools = args.includeTools === true;
  const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);

  try {
    // Discover the agent table
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, [
      'sys_id', 'name', 'description', 'active', 'strategy',
    ]);

    if (!agentTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AI Agent table. Tried: ${AIA_AGENT_TABLES.join(', ')}

This may mean AI Agent framework is not installed on this instance.
${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    // Build query
    const queryParts: string[] = [];
    const activeFilter = status === 'active' ? 'true' : status === 'inactive' ? 'false' : null;
    if (activeFilter !== null) queryParts.push(`active=${activeFilter}`);
    if (nameFilter) queryParts.push(`nameLIKE${nameFilter}`);
    queryParts.push('ORDERBYname');
    const query = queryParts.join('^');

    let response = await (async () => {
      try {
        return await client.queryTable(
          agentTable.tableName,
          query,
          ['sys_id', 'name', 'description', 'active', 'strategy'],
          limit
        );
      } catch (err) {
        // Some instances restrict filtering by the `active` field via REST ACLs even when
        // table read is allowed (field-level ACL on the active column for REST queries).
        // Fall back to fetching all records and filtering client-side.
        if (activeFilter !== null && err instanceof ServiceNowError && err.type === ServiceNowErrorType.ACL_DENIED) {
          const fallbackParts: string[] = [];
          if (nameFilter) fallbackParts.push(`nameLIKE${nameFilter}`);
          fallbackParts.push('ORDERBYname');
          return client.queryTable(
            agentTable.tableName,
            fallbackParts.join('^'),
            ['sys_id', 'name', 'description', 'active', 'strategy'],
            200  // fetch more to ensure we have enough after filtering
          );
        }
        throw err;
      }
    })();

    // Apply client-side active filter if we fell back to fetching all
    let agents = response.result || [];
    if (activeFilter !== null) {
      agents = agents.filter(a => {
        const isActive = a.active === 'true' || a.active === true;
        return activeFilter === 'true' ? isActive : !isActive;
      }).slice(0, limit);
    }

    if (agents.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No AI Agents found${nameFilter ? ` matching "${nameFilter}"` : ''}${status !== 'all' ? ` with status: ${status}` : ''}.`,
        }],
      };
    }

    // Optionally get tool counts
    let toolCountMap = new Map<string, string[]>();
    if (includeTools) {
      const m2mTable = await discoverTable(client, AIA_AGENT_TOOL_M2M_TABLES, ['sys_id', 'agent', 'tool']);
      if (m2mTable) {
        const agentIds = agents.map(a => a.sys_id as string);
        try {
          const m2mResponse = await client.queryTable(
            m2mTable.tableName,
            `agentIN${agentIds.join(',')}^active=true`,
            ['agent', 'tool'],
            500
          );
          // Resolve tool names
          const toolTable = await discoverTable(client, AIA_TOOL_TABLES, ['sys_id', 'name']);
          const toolIds = new Set<string>();
          for (const m of (m2mResponse.result || [])) {
            const toolRef = m.tool as string | { value?: string };
            const toolId = typeof toolRef === 'string' ? toolRef : toolRef?.value;
            if (toolId) toolIds.add(toolId);
          }

          const toolNameMap = new Map<string, string>();
          if (toolTable && toolIds.size > 0) {
            const toolResponse = await client.queryTable(
              toolTable.tableName,
              `sys_idIN${Array.from(toolIds).join(',')}`,
              ['sys_id', 'name'],
              500
            );
            for (const t of (toolResponse.result || [])) {
              toolNameMap.set(t.sys_id as string, t.name as string);
            }
          }

          for (const m of (m2mResponse.result || [])) {
            const agentRef = m.agent as string | { value?: string };
            const agentId = typeof agentRef === 'string' ? agentRef : agentRef?.value;
            const toolRef = m.tool as string | { value?: string };
            const toolId = typeof toolRef === 'string' ? toolRef : toolRef?.value;
            if (agentId && toolId) {
              if (!toolCountMap.has(agentId)) toolCountMap.set(agentId, []);
              toolCountMap.get(agentId)!.push(toolNameMap.get(toolId) || toolId);
            }
          }
        } catch {
          // M2M query failed — show agents without tool info
        }
      }
    }

    // Format output
    const connStatus = connectionManager.getStatus();
    let output = `AI Agents on ${connStatus.activeInstance}
Found: ${agents.length} agent(s)${agents.length === limit ? ' (limit reached)' : ''}

${'═'.repeat(60)}`;

    for (const agent of agents) {
      const activeStr = agent.active === 'true' || agent.active === true ? 'Active' : 'Inactive';
      const strategy = resolveRefField(agent.strategy);
      const agentId = agent.sys_id as string;
      const tools = toolCountMap.get(agentId);

      output += `

[${activeStr === 'Active' ? 'ON' : 'OFF'}] ${agent.name}
${'─'.repeat(60)}
  sys_id: ${agentId}
  Description: ${((agent.description as string) || '(none)').substring(0, 200)}
  Strategy: ${strategy}`;

      if (tools) {
        output += `
  Tools (${tools.length}): ${tools.join(', ')}`;
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('list AI Agents', error);
  }
}

export async function handleAiaGet(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const agentRef = args.agent as string;
  const includePrompt = args.includePrompt !== false;
  const includeToolDetails = args.includeToolDetails !== false;
  const includeStats = args.includeStats === true;
  const includeChildren = args.includeChildren === true;

  if (!agentRef) {
    return { content: [{ type: 'text', text: 'Error: agent is required (name or sys_id)' }], isError: true };
  }

  try {
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, [
      'sys_id', 'name', 'description', 'active', 'strategy', 'instructions', 'execution_mode',
    ]);

    if (!agentTable) {
      return {
        content: [{ type: 'text', text: `Could not find AI Agent table. Tried: ${AIA_AGENT_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}` }],
        isError: true,
      };
    }

    // Find agent by name or sys_id
    const isSysId = /^[a-f0-9]{32}$/i.test(agentRef);
    const agentQuery = isSysId ? `sys_id=${agentRef}` : `nameLIKE${agentRef}`;

    const agentResponse = await client.queryTable(
      agentTable.tableName,
      agentQuery,
      ['sys_id', 'name', 'description', 'active', 'strategy', 'instructions', 'execution_mode', 'sys_created_on', 'sys_updated_on'],
      1
    );

    const agents = agentResponse.result || [];
    if (agents.length === 0) {
      // Check if the name matches a Use Case — common confusion point
      let usecaseHint = '';
      if (!isSysId) {
        try {
          const usecaseTable = await discoverTable(client, AIA_USECASE_TABLES, ['sys_id', 'name']);
          if (usecaseTable) {
            const ucResponse = await client.queryTable(
              usecaseTable.tableName,
              `nameLIKE${agentRef}`,
              ['sys_id', 'name'],
              1
            );
            if ((ucResponse.result || []).length > 0) {
              usecaseHint = `\n\nDid you mean a Use Case? "${agentRef}" matches a Use Case, not an Agent.\nTry: servicenow_aia_usecase_get usecase="${agentRef}"`;
            }
          }
        } catch {
          // Ignore — hint is best-effort
        }
      }
      return { content: [{ type: 'text', text: `Agent not found: "${agentRef}"${usecaseHint}` }], isError: true };
    }

    const agent = agents[0];
    const agentId = agent.sys_id as string;

    // Build output
    const connStatus = connectionManager.getStatus();
    let output = `AI Agent Details — ${connStatus.activeInstance}
${'═'.repeat(60)}

Name: ${agent.name}
sys_id: ${agentId}
Status: ${agent.active === 'true' || agent.active === true ? 'Active' : 'Inactive'}
Strategy: ${resolveRefField(agent.strategy)}
Execution Mode: ${agent.execution_mode || 'N/A'}
Created: ${agent.sys_created_on || 'N/A'}
Updated: ${agent.sys_updated_on || 'N/A'}
Description: ${agent.description || '(none)'}`;

    if (includePrompt) {
      const instructions = (agent.instructions as string) || '(no instructions set)';
      output += `

${'─'.repeat(60)}
INSTRUCTIONS / PROMPT
${'─'.repeat(60)}
${instructions}`;
    }

    // Get tools
    if (includeToolDetails) {
      const m2mTable = await discoverTable(client, AIA_AGENT_TOOL_M2M_TABLES, ['sys_id', 'agent', 'tool']);
      const toolTable = await discoverTable(client, AIA_TOOL_TABLES, ['sys_id', 'name']);

      if (m2mTable && toolTable) {
        const m2mResponse = await client.queryTable(
          m2mTable.tableName,
          `agent=${agentId}^active=true`,
          ['tool'],
          50
        );

        const toolIds = (m2mResponse.result || []).map(m => {
          const ref = m.tool as string | { value?: string };
          return typeof ref === 'string' ? ref : ref?.value;
        }).filter(Boolean) as string[];

        if (toolIds.length > 0) {
          const toolResponse = await client.queryTable(
            toolTable.tableName,
            `sys_idIN${toolIds.join(',')}`,
            ['sys_id', 'name', 'description', 'active', 'script', 'input_schema', 'output_schema', 'internal_name'],
            50
          );

          const tools = toolResponse.result || [];
          output += `

${'─'.repeat(60)}
TOOLS (${tools.length})
${'─'.repeat(60)}`;

          for (const tool of tools) {
            output += `

  [${tool.active === 'true' || tool.active === true ? 'ON' : 'OFF'}] ${tool.name}
    sys_id: ${tool.sys_id}
    Internal Name: ${tool.internal_name || 'N/A'}
    Description: ${((tool.description as string) || '(none)').substring(0, 200)}`;

            if (tool.input_schema) {
              output += `
    Input Schema: ${String(tool.input_schema)}`;
            }

            if (tool.output_schema) {
              output += `
    Output Schema: ${String(tool.output_schema)}`;
            }

            if (tool.script) {
              const script = String(tool.script);
              output += `
    Script (${script.length} chars):
${script}`;
            }
          }
        } else {
          output += `

${'─'.repeat(60)}
TOOLS: None attached`;
        }
      }
    }

    // Get execution stats
    if (includeStats) {
      const execTable = await discoverTable(client, AIA_EXECUTION_PLAN_TABLES, ['sys_id', 'status']);
      if (execTable) {
        try {
          const recentQuery = `agent=${agentId}^${getTimeRangeQuery('7d')}`;
          const execResponse = await client.queryTable(
            execTable.tableName,
            recentQuery,
            ['sys_id', 'status'],
            500
          );

          const execs = execResponse.result || [];
          const total = execs.length;
          const successCount = execs.filter(e =>
            (e.status as string) === 'success' || (e.status as string) === 'completed'
          ).length;
          const failCount = execs.filter(e =>
            (e.status as string) === 'failure' || (e.status as string) === 'failed' || (e.status as string) === 'error'
          ).length;
          const runningCount = total - successCount - failCount;

          output += `

${'─'.repeat(60)}
EXECUTION STATS (last 7 days)
${'─'.repeat(60)}
  Total: ${total}
  Success: ${successCount} (${total > 0 ? Math.round(successCount / total * 100) : 0}%)
  Failed: ${failCount} (${total > 0 ? Math.round(failCount / total * 100) : 0}%)
  Running/Other: ${runningCount}`;
        } catch {
          output += `

Execution stats: Unable to query`;
        }
      }
    }

    // Get child agents
    if (includeChildren) {
      const childTable = await discoverTable(client, AIA_AGENT_CHILD_TABLES, [
        'sys_id', 'parent_agent', 'child_agent', 'description',
      ]);

      if (childTable) {
        try {
          const childResponse = await client.queryTable(
            childTable.tableName,
            `parent_agent=${agentId}`,
            ['child_agent', 'description'],
            50
          );

          const childLinks = childResponse.result || [];

          if (childLinks.length > 0) {
            // Resolve child agent names
            const childIds = childLinks.map(r => {
              const ref = r.child_agent as string | { value?: string };
              return typeof ref === 'string' ? ref : ref?.value;
            }).filter(Boolean) as string[];

            const agentLookup = await client.queryTable(
              agentTable.tableName,
              `sys_idIN${childIds.join(',')}`,
              ['sys_id', 'name', 'active', 'description'],
              50
            );

            const childAgents = agentLookup.result || [];
            const childById = new Map(childAgents.map(a => [a.sys_id as string, a]));

            output += `

${'─'.repeat(60)}
CHILD AGENTS (${childIds.length})
${'─'.repeat(60)}`;

            for (const link of childLinks) {
              const ref = link.child_agent as string | { value?: string };
              const childId = typeof ref === 'string' ? ref : ref?.value ?? '';
              const child = childById.get(childId);
              const delegationNote = (link.description as string) || '(no description)';

              if (child) {
                output += `

  [${child.active === 'true' || child.active === true ? 'ON' : 'OFF'}] ${child.name}
    sys_id: ${child.sys_id}
    Description: ${((child.description as string) || '(none)').substring(0, 200)}
    Delegation: ${delegationNote}`;
              } else {
                output += `

  [?] sys_id: ${childId}
    Delegation: ${delegationNote}`;
              }
            }
          } else {
            output += `

${'─'.repeat(60)}
CHILD AGENTS: None`;
          }
        } catch {
          output += `

${'─'.repeat(60)}
CHILD AGENTS: Unable to query (check sn_aia.admin role)`;
        }
      } else {
        output += `

${'─'.repeat(60)}
CHILD AGENTS: Table not found (tried: ${AIA_AGENT_CHILD_TABLES.join(', ')})`;
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('get AI Agent details', error);
  }
}

export async function handleAiaTrace(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const executionId = args.executionId as string;
  const includeRawPayloads = args.includeRawPayloads === true;

  if (!executionId) {
    return { content: [{ type: 'text', text: 'Error: executionId is required' }], isError: true };
  }

  try {
    // Get the execution record
    const execTable = await discoverTable(client, AIA_EXECUTION_PLAN_TABLES, [
      'sys_id', 'agent', 'status', 'sys_created_on', 'sys_updated_on',
      'duration', 'error_message', 'input', 'output', 'trigger_type',
    ]);

    if (!execTable) {
      return {
        content: [{ type: 'text', text: `Could not find AIA execution table. Tried: ${AIA_EXECUTION_PLAN_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}` }],
        isError: true,
      };
    }

    const execResponse = await client.queryTable(
      execTable.tableName,
      `sys_id=${executionId}`,
      ['sys_id', 'agent', 'status', 'sys_created_on', 'sys_updated_on', 'duration', 'error_message', 'input', 'output', 'trigger_type', 'trigger_context', 'conversation_id'],
      1
    );

    const execs = execResponse.result || [];
    if (execs.length === 0) {
      return { content: [{ type: 'text', text: `Execution not found: ${executionId}` }], isError: true };
    }

    const exec = execs[0];
    const agentRef = exec.agent as string | { display_value?: string; value?: string };
    const agentDisplay = typeof agentRef === 'string'
      ? agentRef
      : (agentRef?.display_value || agentRef?.value || 'Unknown');

    const connStatus = connectionManager.getStatus();
    let output = `AI Agent Execution Trace — ${connStatus.activeInstance}
${'═'.repeat(70)}

Execution ID: ${executionId}
Agent: ${agentDisplay}
Status: ${exec.status || 'unknown'}
Started: ${exec.sys_created_on || 'N/A'}
Ended: ${exec.sys_updated_on || 'N/A'}
Duration: ${exec.duration ? `${exec.duration}ms` : 'N/A'}
Trigger: ${exec.trigger_type || 'N/A'}${exec.trigger_context ? ` — ${String(exec.trigger_context).substring(0, 100)}` : ''}`;

    if (exec.error_message) {
      output += `
ERROR: ${exec.error_message}`;
    }

    if (includeRawPayloads) {
      if (exec.input) {
        output += `

${'─'.repeat(70)}
INPUT
${'─'.repeat(70)}
${String(exec.input).substring(0, 2000)}`;
      }
      if (exec.output) {
        output += `

${'─'.repeat(70)}
OUTPUT
${'─'.repeat(70)}
${String(exec.output).substring(0, 2000)}`;
      }
    }

    // Get tool execution steps
    const toolExecTable = await discoverTable(client, AIA_TOOL_EXECUTION_TABLES, [
      'sys_id', 'execution', 'tool_name', 'status',
    ]);

    if (toolExecTable) {
      try {
        const toolResponse = await client.queryTable(
          toolExecTable.tableName,
          `execution=${executionId}^ORDERBYstep_number`,
          ['sys_id', 'tool_name', 'input', 'output', 'status', 'error_message', 'duration', 'step_number'],
          100
        );

        const steps = toolResponse.result || [];
        if (steps.length > 0) {
          output += `

${'─'.repeat(70)}
TOOL CALLS (${steps.length} steps)
${'─'.repeat(70)}`;

          for (const step of steps) {
            const stepNum = step.step_number || '?';
            const toolName = step.tool_name || 'unknown';
            const stepStatus = (step.status as string) || 'unknown';
            const statusIcon = stepStatus === 'success' || stepStatus === 'completed' ? '[OK]' : '[FAIL]';
            const dur = step.duration ? `${step.duration}ms` : 'N/A';

            output += `

  Step ${stepNum}: ${statusIcon} ${toolName} (${dur})`;

            if (includeRawPayloads && step.input) {
              output += `
    Input: ${String(step.input).substring(0, 500)}`;
            }

            if (includeRawPayloads && step.output) {
              output += `
    Output: ${String(step.output).substring(0, 500)}`;
            }

            if (step.error_message) {
              output += `
    Error: ${step.error_message}`;
            }
          }
        } else {
          output += `

Tool Calls: None recorded`;
        }
      } catch {
        output += `

Tool Calls: Unable to query tool execution table`;
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('trace execution', error);
  }
}

export async function handleAiaErrors(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const agentFilter = args.agent as string | undefined;
  const timeRange = (args.timeRange as string) || '24h';
  const groupBy = (args.groupBy as string) || 'error_type';
  const limit = Math.min(Math.max((args.limit as number) || 20, 1), 100);

  try {
    const execTable = await discoverTable(client, AIA_EXECUTION_PLAN_TABLES, [
      'sys_id', 'agent', 'status', 'error_message',
    ]);

    if (!execTable) {
      return {
        content: [{ type: 'text', text: `Could not find AIA execution table. Tried: ${AIA_EXECUTION_PLAN_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}` }],
        isError: true,
      };
    }

    // Query failed executions
    const queryParts: string[] = [];
    queryParts.push(getTimeRangeQuery(timeRange));
    queryParts.push('statusINfailure,failed,error');
    if (agentFilter) {
      const isSysId = /^[a-f0-9]{32}$/i.test(agentFilter);
      queryParts.push(isSysId ? `agent=${agentFilter}` : `agent.nameLIKE${agentFilter}`);
    }
    queryParts.push('ORDERBYDESCsys_created_on');

    const response = await client.queryTable(
      execTable.tableName,
      queryParts.join('^'),
      ['sys_id', 'agent', 'status', 'error_message', 'sys_created_on'],
      500
    );

    const failures = response.result || [];

    if (failures.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No errors found in the last ${timeRange}${agentFilter ? ` for agent "${agentFilter}"` : ''}.`,
        }],
      };
    }

    // Group errors
    const groups = new Map<string, { count: number; examples: Array<{ id: string; time: string; message: string }> }>();

    for (const fail of failures) {
      const errorMsg = (fail.error_message as string) || 'Unknown error';
      const agentRef = fail.agent as string | { display_value?: string; value?: string };
      const agentDisplay = typeof agentRef === 'string'
        ? agentRef
        : (agentRef?.display_value || agentRef?.value || 'Unknown');

      let key: string;
      switch (groupBy) {
        case 'agent':
          key = agentDisplay;
          break;
        case 'tool':
          // Extract tool name from error message if possible
          const toolMatch = errorMsg.match(/tool[:\s]+["']?(\w+)/i);
          key = toolMatch ? toolMatch[1] : 'unknown_tool';
          break;
        default: // error_type
          // Categorize error messages
          if (errorMsg.toLowerCase().includes('timeout')) key = 'Timeout';
          else if (errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('acl')) key = 'Permission Denied';
          else if (errorMsg.toLowerCase().includes('not found')) key = 'Not Found';
          else if (errorMsg.toLowerCase().includes('script')) key = 'Script Error';
          else if (errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('model')) key = 'LLM/Model Error';
          else key = errorMsg.substring(0, 60);
          break;
      }

      if (!groups.has(key)) {
        groups.set(key, { count: 0, examples: [] });
      }
      const group = groups.get(key)!;
      group.count++;
      if (group.examples.length < 3) {
        group.examples.push({
          id: fail.sys_id as string,
          time: (fail.sys_created_on as string) || '',
          message: errorMsg.substring(0, 200),
        });
      }
    }

    // Sort by count descending
    const sortedGroups = Array.from(groups.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit);

    const connStatus = connectionManager.getStatus();
    let output = `AI Agent Error Analysis — ${connStatus.activeInstance}
${'═'.repeat(60)}
Time Range: ${timeRange}
Total Failures: ${failures.length}
Groups (by ${groupBy}): ${sortedGroups.length}
${agentFilter ? `Agent Filter: ${agentFilter}` : ''}

${'─'.repeat(60)}`;

    for (const [key, group] of sortedGroups) {
      const pct = Math.round(group.count / failures.length * 100);
      output += `

[${group.count}x] ${key} (${pct}%)`;
      for (const ex of group.examples) {
        output += `
  - ${ex.time}: ${ex.message}
    (execution: ${ex.id})`;
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('analyze errors', error);
  }
}

export async function handleAiaExecute(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const agentRef = args.agent as string;
  const input = args.input as string;
  const targetTable = args.targetTable as string | undefined;
  const targetRecord = args.targetRecord as string | undefined;
  const waitForCompletion = args.waitForCompletion !== false;
  const timeoutSeconds = Math.min(Math.max((args.timeoutSeconds as number) || 60, 5), 120);
  const executionMode = (args.executionMode as string) || 'autopilot';
  const maxTurns = (args.maxTurns as number) || 10;

  if (!agentRef || !input) {
    return { content: [{ type: 'text', text: 'Error: agent and input are required' }], isError: true };
  }

  try {
    // ── Step 1: Resolve agent and check active status ──────────────────────
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, ['sys_id', 'name', 'active']);
    if (!agentTable) {
      return {
        content: [{ type: 'text', text: `Could not find AI Agent table.\n\n${AIA_ROLE_HINT}` }],
        isError: true,
      };
    }

    const isSysId = /^[a-f0-9]{32}$/i.test(agentRef);
    const agentQuery = isSysId ? `sys_id=${agentRef}` : `nameLIKE${agentRef}`;
    const agentResponse = await client.queryTable(
      agentTable.tableName,
      agentQuery,
      ['sys_id', 'name', 'active'],
      1
    );
    const agents = agentResponse.result || [];
    if (agents.length === 0) {
      return { content: [{ type: 'text', text: `Agent not found: "${agentRef}"` }], isError: true };
    }
    const agent = agents[0] as Record<string, unknown>;
    // Pre-flight: check active field (issue #76)
    if (agent.active === false || agent.active === 'false') {
      return {
        content: [{ type: 'text', text: `Error: Agent "${agent.name}" is inactive. Activate it in AI Agent Studio first.` }],
        isError: true,
      };
    }
    const agentId = agent.sys_id as string;
    const agentName = agent.name as string;

    // ── Step 2: Determine conversationUser ────────────────────────────────
    const session = connectionManager.getActiveSession();
    const conversationUser = (args.conversationUser as string) || session?.userName || 'admin';

    // ── Step 3: Build and execute script via script API ───────────────────
    const reqObj: Record<string, unknown> = {
      agentId,
      objective: input,
      conversationUser,
      canInteractWithUser: false,
      executionMode,
      maxTurns,
    };
    if (targetTable) reqObj.targetTable = targetTable;
    if (targetRecord) reqObj.targetRecordId = targetRecord;

    const script = `var runtime = new sn_aia.AiAgentRuntimeUtil();
var req = ${JSON.stringify(reqObj, null, 2)};
var resp = runtime.startAiAgentConversation(req);
gs.info(JSON.stringify(resp));`;

    const apiState = await ensureScriptApi(client);
    if (!apiState) {
      const lastError = getLastDeploymentError(client.getInstanceUrl());
      return {
        content: [{ type: 'text', text: `Script API unavailable: ${lastError || 'deployment failed'}` }],
        isError: true,
      };
    }

    const scriptResult = await executeViaScriptApi(client, script, timeoutSeconds, apiState.workingUrl);

    // ── Step 4: Extract conversationId from script output ─────────────────
    let conversationId: string | undefined;
    for (const line of scriptResult.output) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          const data = parsed.data as Record<string, unknown> | undefined;
          conversationId = data?.conversationId as string | undefined;
          if (conversationId) break;
        }
      } catch {
        // not JSON, skip
      }
    }

    const connStatus = connectionManager.getStatus();
    let output = `AI Agent Execution — ${connStatus.activeInstance}\n${'═'.repeat(60)}\n\nAgent: ${agentName} (${agentId})\nInput: ${input.substring(0, 200)}${input.length > 200 ? '...' : ''}\nExecution Mode: ${executionMode} | Max Turns: ${maxTurns}`;

    if (scriptResult.error && !conversationId) {
      output += `\n\nError: ${scriptResult.error}`;
      return { content: [{ type: 'text', text: output }], isError: true };
    }

    if (!conversationId) {
      output += `\n\nWarning: Could not extract conversation ID from script output.`;
      if (scriptResult.output.length > 0) {
        output += `\nRaw output: ${scriptResult.output.slice(0, 3).join('\n')}`;
      }
      return { content: [{ type: 'text', text: output }] };
    }

    output += `\n\nConversation ID: ${conversationId}`;

    if (!waitForCompletion) {
      output += `\n\nStatus: Started (not waiting for completion)\n\nUse servicenow_aia_trace with conversation ID to see results.`;
      return { content: [{ type: 'text', text: output }] };
    }

    // ── Step 5: Poll sn_aia_execution_log for completion ──────────────────
    const pollInterval = 2000;
    const pollDeadline = Date.now() + timeoutSeconds * 1000;
    const terminalStatuses = new Set(['completed', 'done', 'success', 'failed', 'error', 'cancelled', 'complete']);

    let executionRecord: Record<string, unknown> | null = null;
    let pollStatus: string | undefined;
    let agentOutput: string | undefined;

    while (Date.now() < pollDeadline) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // Try candidate field names for conversation linkage
      for (const field of ['conversation_id', 'conversation']) {
        try {
          const logResponse = await client.queryTable(
            'sn_aia_execution_log',
            `${field}=${conversationId}`,
            undefined,
            1
          );
          const records = logResponse.result || [];
          if (records.length > 0) {
            executionRecord = records[0] as Record<string, unknown>;
            break;
          }
        } catch {
          // try next candidate
        }
      }

      if (!executionRecord) continue;

      // Dynamically detect status field
      for (const key of ['state', 'status', 'execution_state']) {
        const val = executionRecord[key];
        if (val && typeof val === 'string') {
          pollStatus = val;
          if (terminalStatuses.has(val.toLowerCase())) break;
        }
      }

      // Dynamically detect output field
      for (const key of ['output', 'result', 'response', 'agent_output', 'final_output']) {
        const val = executionRecord[key];
        if (val && typeof val === 'string') {
          agentOutput = val;
          break;
        }
      }

      if (pollStatus && terminalStatuses.has(pollStatus.toLowerCase())) break;
    }

    if (!executionRecord) {
      output += `\n\nStatus: Timed out waiting for execution log entry.\n\nUse servicenow_aia_trace with conversation ID to check progress.`;
    } else {
      output += `\n\nStatus: ${pollStatus || 'unknown'}`;
      if (agentOutput) {
        output += `\n\nAgent Response:\n${agentOutput}`;
      } else {
        // Show non-system fields from the record
        const interesting = Object.entries(executionRecord)
          .filter(([k]) => !['sys_id', 'sys_created_on', 'sys_updated_on', 'sys_created_by', 'sys_updated_by', 'sys_mod_count'].includes(k))
          .map(([k, v]) => `  ${k}: ${String(v).substring(0, 200)}`);
        if (interesting.length > 0) {
          output += `\n\nExecution Record:\n${interesting.join('\n')}`;
        }
      }
    }

    output += `\n\n${'─'.repeat(60)}\nUse servicenow_aia_trace with conversation ID to see full trace.`;
    return { content: [{ type: 'text', text: output }] };

  } catch (error) {
    return formatError('execute AI Agent', error);
  }
}

export async function handleAiaCreate(args: Record<string, unknown>): Promise<ToolResult> {
  const agentName = args.agentName as string;
  const agentDescription = args.agentDescription as string;
  const agentInstructions = args.agentInstructions as string;
  const strategy = (args.strategy as string) || 'ReAct';
  const executionMode = (args.executionMode as string) || 'autopilot';
  const maxIterations = (args.maxIterations as number) || 10;
  const tools = (args.tools as Array<Record<string, string>>) || [];
  const dryRun = args.dryRun !== false; // Default true

  if (!agentName || !agentDescription || !agentInstructions) {
    return {
      content: [{ type: 'text', text: 'Error: agentName, agentDescription, and agentInstructions are required' }],
      isError: true,
    };
  }

  // Scan tool scripts for forbidden APIs — done before connection check so dryRun works offline
  const toolWarnings: string[] = [];
  for (const tool of tools) {
    if (tool.script) {
      const warnings = scanToolScript(tool.script);
      if (warnings.length > 0) {
        toolWarnings.push(`  Tool "${tool.name}":`);
        toolWarnings.push(...warnings);
      }
    }
  }
  const forbiddenWarningSection = toolWarnings.length > 0
    ? `\n⚠️  FORBIDDEN API WARNING — Scripts will hang indefinitely\n${'─'.repeat(60)}\n${toolWarnings.join('\n')}\n\nThese APIs hang indefinitely in AIA tool execution contexts.\nFix them before running the agent with servicenow_aia_execute.\n`
    : '';

  try {
    // Generate sys_ids
    const crypto = await import('crypto');
    const agentSysId = crypto.randomBytes(16).toString('hex');
    const toolSysIds = tools.map(() => crypto.randomBytes(16).toString('hex'));

    // Build the plan
    const plan: string[] = [];
    plan.push(`Agent: ${agentName}`);
    plan.push(`  sys_id: ${agentSysId}`);
    plan.push(`  Strategy: ${strategy}`);
    plan.push(`  Instructions: ${agentInstructions.substring(0, 100)}...`);
    plan.push('');

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      plan.push(`Tool ${i + 1}: ${tool.name}`);
      plan.push(`  sys_id: ${toolSysIds[i]}`);
      plan.push(`  Description: ${tool.description?.substring(0, 100) || 'N/A'}`);
      plan.push(`  Script: ${tool.script ? `${tool.script.length} chars` : 'N/A'}`);
      plan.push('');
    }

    if (dryRun) {
      const connStatus = connectionManager.getStatus();
      return {
        content: [{
          type: 'text',
          text: `AI Agent Creation Plan — DRY RUN
${'═'.repeat(60)}
Instance: ${connStatus.activeInstance || '(not connected)'}

This is a preview. Set dryRun=false to create these records.
${forbiddenWarningSection}
${'─'.repeat(60)}
RECORDS TO CREATE
${'─'.repeat(60)}

${plan.join('\n')}

Tables that will be written:
  1. sn_aia_tool (${tools.length} record${tools.length !== 1 ? 's' : ''})
  2. sn_aia_agent (1 record)
  3. sn_aia_agent_tool_m2m (${tools.length} mapping${tools.length !== 1 ? 's' : ''})

Total API calls: ${1 + tools.length + tools.length}`,
        }],
      };
    }

    // Live creation requires connection
    const conn = requireConnection();
    if (isConnectionError(conn)) return conn;
    const { client } = conn;

    // Actually create the records
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, ['sys_id', 'name']);
    const toolTable = await discoverTable(client, AIA_TOOL_TABLES, ['sys_id', 'name']);
    const m2mTable = await discoverTable(client, AIA_AGENT_TOOL_M2M_TABLES, ['sys_id', 'agent', 'tool']);

    if (!agentTable || !toolTable || !m2mTable) {
      return {
        content: [{ type: 'text', text: `Cannot find required AI Agent tables on this instance. Is AI Agent framework installed?\n\n${AIA_ROLE_HINT}` }],
        isError: true,
      };
    }

    const createdToolIds: string[] = [];
    const results: string[] = [];

    // Create tools first
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const toolPayload = {
        sys_id: toolSysIds[i],
        name: tool.name,
        internal_name: `foundry_${tool.name.toLowerCase().replace(/\s+/g, '_')}_${toolSysIds[i].substring(0, 8)}`,
        description: tool.description,
        active: true,
        script: tool.script,
        input_schema: tool.inputSchema,
        output_schema: tool.outputSchema || '[]',
      };

      const toolResult = await client.createRecord(toolTable.tableName, toolPayload);
      const createdId = (toolResult.result as Record<string, unknown>).sys_id as string;
      createdToolIds.push(createdId);
      results.push(`[OK] Tool created: ${tool.name} (${createdId})`);
    }

    // Create agent
    const agentPayload = {
      sys_id: agentSysId,
      name: agentName,
      description: agentDescription,
      instructions: agentInstructions,
      active: true,
      strategy: strategy,
      execution_mode: executionMode,
      max_iterations: maxIterations,
    };

    const agentResult = await client.createRecord(agentTable.tableName, agentPayload);
    const createdAgentId = (agentResult.result as Record<string, unknown>).sys_id as string;
    results.push(`[OK] Agent created: ${agentName} (${createdAgentId})`);

    // Create mappings — 'name' is required by Data Policy on sn_aia_agent_tool_m2m (#70)
    for (let i = 0; i < createdToolIds.length; i++) {
      const toolName = tools[i].name;
      const mappingPayload = {
        agent: createdAgentId,
        tool: createdToolIds[i],
        name: toolName,
        active: true,
      };
      await client.createRecord(m2mTable.tableName, mappingPayload);
      results.push(`[OK] Tool mapped: ${toolName} -> ${agentName}`);
    }

    const connStatus = connectionManager.getStatus();
    return {
      content: [{
        type: 'text',
        text: `AI Agent Created — ${connStatus.activeInstance}
${'═'.repeat(60)}

${results.join('\n')}
${forbiddenWarningSection}
${'─'.repeat(60)}
SUMMARY
${'─'.repeat(60)}
Agent ID: ${createdAgentId}
Tool IDs: ${createdToolIds.join(', ')}

Next steps:
1. Test: servicenow_aia_execute with agent="${createdAgentId}"
2. Inspect: servicenow_aia_get with agent="${createdAgentId}"
3. Navigate to AI Agent Studio in ServiceNow to verify`,
      }],
    };
  } catch (error) {
    return formatError('create AI Agent', error);
  }
}

export async function handleAiaToolExecute(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const toolRef = args.tool as string;
  if (!toolRef) {
    return {
      content: [{ type: 'text', text: 'Missing required parameter: tool' }],
      isError: true,
    };
  }
  const input = (args.input as Record<string, unknown>) ?? {};
  const timeoutSeconds = Math.min(Math.max((args.timeoutSeconds as number) || 30, 5), 120);

  try {
    // Resolve tool by sys_id or name
    const toolTable = await discoverTable(client, AIA_TOOL_TABLES, [
      'sys_id', 'name', 'description', 'active',
    ]);
    if (!toolTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AIA tool table. Tried: ${AIA_TOOL_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }
    const isSysId = /^[a-f0-9]{32}$/i.test(toolRef);
    const toolQuery = isSysId ? `sys_id=${toolRef}` : `nameLIKE${toolRef}`;
    const toolResponse = await client.queryTable(
      toolTable.tableName,
      toolQuery,
      ['sys_id', 'name', 'description', 'active'],
      1
    );

    const records = (toolResponse.result as Record<string, unknown>[]) ?? [];
    if (records.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `Tool not found: "${toolRef}"\nQuery: ${toolQuery} on ${toolTable.tableName}`,
        }],
        isError: true,
      };
    }

    const toolRecord = records[0];
    const toolSysId = toolRecord.sys_id as string;
    if (!/^[a-f0-9]{32}$/i.test(toolSysId)) {
      return {
        content: [{ type: 'text', text: `Unexpected sys_id format from tool record: "${toolSysId}"` }],
        isError: true,
      };
    }
    const toolName = toolRecord.name as string;

    const isActive = toolRecord.active;
    if (isActive === false || isActive === 'false') {
      return {
        content: [{ type: 'text', text: `Tool "${toolName}" (${toolSysId}) is inactive and cannot be executed.` }],
        isError: true,
      };
    }

    // Build execution script
    const script = `(function() {
  var util = new sn_aia.AiToolRuntimeUtil();
  var result = util.executeTool('${toolSysId}', JSON.stringify(${JSON.stringify(input)}));
  gs.info(JSON.stringify(result));
})();`;

    const apiState = await ensureScriptApi(client);
    if (!apiState) {
      const lastError = getLastDeploymentError(client.getInstanceUrl());
      return {
        content: [{ type: 'text', text: `Script API unavailable: ${lastError || 'deployment failed'}` }],
        isError: true,
      };
    }
    const scriptResult = await executeViaScriptApi(client, script, timeoutSeconds, apiState.workingUrl);

    if (scriptResult.error && scriptResult.output.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `Tool: ${toolName} (${toolSysId})\nInput: ${JSON.stringify(input, null, 2)}\n\nExecution error: ${scriptResult.error}`,
        }],
        isError: true,
      };
    }

    // Parse JSON output from gs.info lines
    let parsedOutput: unknown = null;
    for (const line of scriptResult.output) {
      try {
        parsedOutput = JSON.parse(line);
        break;
      } catch { /* not JSON */ }
    }

    const outputText = parsedOutput !== null
      ? JSON.stringify(parsedOutput, null, 2)
      : scriptResult.output.join('\n') || '(no output)';

    return {
      content: [{
        type: 'text',
        text: [
          `Tool: ${toolName} (${toolSysId})`,
          `Input: ${JSON.stringify(input, null, 2)}`,
          '',
          'Output:',
          outputText,
        ].join('\n'),
      }],
      isError: false,
    };

  } catch (error) {
    return formatError('execute AIA tool', error);
  }
}

// ════════════════════════════════════════════════════════════════
// Use Case handlers
// ════════════════════════════════════════════════════════════════

export async function handleAiaUsecaseList(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const status = (args.status as string) || 'all';
  const nameFilter = args.nameFilter as string | undefined;
  const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);

  try {
    const usecaseTable = await discoverTable(client, AIA_USECASE_TABLES, [
      'sys_id', 'name', 'description', 'active', 'agent_id',
    ]);

    if (!usecaseTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AIA Use Case table. Tried: ${AIA_USECASE_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    const queryParts: string[] = [];
    if (status === 'active') queryParts.push('active=true');
    else if (status === 'inactive') queryParts.push('active=false');
    if (nameFilter) queryParts.push(`nameLIKE${nameFilter}`);
    queryParts.push('ORDERBYname');
    const query = queryParts.join('^');

    const response = await client.queryTable(
      usecaseTable.tableName,
      query,
      ['sys_id', 'name', 'description', 'active', 'agent_id'],
      limit
    );

    const usecases = (response.result as Record<string, unknown>[]) ?? [];

    if (usecases.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No Use Cases found${nameFilter ? ` matching "${nameFilter}"` : ''}${status !== 'all' ? ` with status: ${status}` : ''}.`,
        }],
      };
    }

    const connStatus = connectionManager.getStatus();
    let output = `AIA Use Cases on ${connStatus.activeInstance}
Found: ${usecases.length} use case(s)${usecases.length === limit ? ' (limit reached)' : ''}

${'═'.repeat(60)}`;

    for (const uc of usecases) {
      const activeStr = uc.active === 'true' || uc.active === true ? 'Active' : 'Inactive';
      const agentRef = resolveRefField(uc.agent_id, '');
      output += `

[${activeStr === 'Active' ? 'ON' : 'OFF'}] ${uc.name}
${'─'.repeat(60)}
  sys_id: ${uc.sys_id}
  Agent: ${agentRef || '(none)'}
  Description: ${((uc.description as string) || '(none)').substring(0, 200)}`;
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('list AIA Use Cases', error);
  }
}

export async function handleAiaUsecaseGet(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const usecaseRef = args.usecase as string;
  const includeAgent = args.includeAgent === true;

  if (!usecaseRef) {
    return {
      content: [{ type: 'text', text: 'Missing required parameter: usecase' }],
      isError: true,
    };
  }

  try {
    const usecaseTable = await discoverTable(client, AIA_USECASE_TABLES, [
      'sys_id', 'name', 'description', 'active', 'agent_id',
    ]);

    if (!usecaseTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AIA Use Case table. Tried: ${AIA_USECASE_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    const isSysId = /^[a-f0-9]{32}$/i.test(usecaseRef);
    const query = isSysId ? `sys_id=${usecaseRef}` : `nameLIKE${usecaseRef}`;

    const response = await client.queryTable(
      usecaseTable.tableName,
      query,
      ['sys_id', 'name', 'description', 'active', 'agent_id', 'sys_created_on', 'sys_updated_on'],
      1
    );

    const records = (response.result as Record<string, unknown>[]) ?? [];
    if (records.length === 0) {
      return {
        content: [{ type: 'text', text: `Use Case not found: "${usecaseRef}"` }],
        isError: true,
      };
    }

    const uc = records[0];
    const activeStr = uc.active === 'true' || uc.active === true ? 'Active' : 'Inactive';
    const agentRef = resolveRefField(uc.agent_id, '');

    const connStatus = connectionManager.getStatus();
    let output = `AIA Use Case — ${connStatus.activeInstance}
${'═'.repeat(60)}

Name: ${uc.name}
sys_id: ${uc.sys_id}
Status: ${activeStr}
Agent: ${agentRef || '(none)'}
Description: ${uc.description || '(none)'}
Created: ${uc.sys_created_on || 'N/A'}
Updated: ${uc.sys_updated_on || 'N/A'}`;

    if (includeAgent && agentRef) {
      const agentSysId = typeof uc.agent_id === 'object'
        ? ((uc.agent_id as Record<string, unknown>)?.value as string)
        : (uc.agent_id as string);

      if (agentSysId && /^[a-f0-9]{32}$/i.test(agentSysId)) {
        const agentTable = await discoverTable(client, AIA_AGENT_TABLES, ['sys_id', 'name', 'active', 'description']);
        if (agentTable) {
          const agentResponse = await client.queryTable(
            agentTable.tableName,
            `sys_id=${agentSysId}`,
            ['sys_id', 'name', 'active', 'description'],
            1
          );
          const agents = (agentResponse.result as Record<string, unknown>[]) ?? [];
          if (agents.length > 0) {
            const agent = agents[0];
            const agentActiveStr = agent.active === 'true' || agent.active === true ? 'Active' : 'Inactive';
            output += `

${'─'.repeat(60)}
Linked Agent Details:
  Name: ${agent.name}
  sys_id: ${agent.sys_id}
  Status: ${agentActiveStr}
  Description: ${(agent.description as string || '(none)').substring(0, 200)}`;
          }
        }
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('get AIA Use Case', error);
  }
}

export async function handleAiaTriggerGet(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const usecaseRef = args.usecase as string;

  if (!usecaseRef) {
    return {
      content: [{ type: 'text', text: 'Missing required parameter: usecase' }],
      isError: true,
    };
  }

  try {
    // Resolve use case sys_id
    const usecaseTable = await discoverTable(client, AIA_USECASE_TABLES, [
      'sys_id', 'name', 'active',
    ]);

    if (!usecaseTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AIA Use Case table. Tried: ${AIA_USECASE_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    const isSysId = /^[a-f0-9]{32}$/i.test(usecaseRef);
    const ucQuery = isSysId ? `sys_id=${usecaseRef}` : `nameLIKE${usecaseRef}`;
    const ucResponse = await client.queryTable(
      usecaseTable.tableName,
      ucQuery,
      ['sys_id', 'name', 'active'],
      1
    );
    const ucRecords = (ucResponse.result as Record<string, unknown>[]) ?? [];
    if (ucRecords.length === 0) {
      return {
        content: [{ type: 'text', text: `Use Case not found: "${usecaseRef}"` }],
        isError: true,
      };
    }
    const uc = ucRecords[0];
    const ucSysId = uc.sys_id as string;

    // Find trigger configuration(s)
    const triggerTable = await discoverTable(client, AIA_TRIGGER_TABLES, [
      'sys_id', 'trigger_table', 'encoded_query', 'active', 'usecase_id',
    ]);

    if (!triggerTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find AIA trigger configuration table. Tried: ${AIA_TRIGGER_TABLES.join(', ')}\n\n${AIA_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    let triggerRows: Record<string, unknown>[];
    try {
      const triggerResponse = await client.queryTable(
        triggerTable.tableName,
        `usecase_id=${ucSysId}`,
        ['sys_id', 'trigger_table', 'encoded_query', 'active', 'usecase_id'],
        50
      );
      triggerRows = (triggerResponse.result as Record<string, unknown>[]) ?? [];
    } catch (err) {
      if (err instanceof ServiceNowError && err.type === ServiceNowErrorType.ACL_DENIED) {
        triggerRows = [];  // treat as no triggers accessible
      } else {
        throw err;
      }
    }
    const triggers = triggerRows;

    const connStatus = connectionManager.getStatus();
    const ucActiveStr = uc.active === 'true' || uc.active === true ? 'Active' : 'Inactive';

    let output = `AIA Trigger Configuration — ${connStatus.activeInstance}
${'═'.repeat(60)}

Use Case: ${uc.name}
Use Case sys_id: ${ucSysId}
Use Case Status: ${ucActiveStr}`;

    if (triggers.length === 0) {
      output += `\n\nNo trigger configurations found for this Use Case.`;
    } else {
      output += `\nTrigger(s): ${triggers.length}`;
      for (const tr of triggers) {
        const tActiveStr = tr.active === 'true' || tr.active === true ? 'Active' : 'Inactive';
        output += `

${'─'.repeat(60)}
sys_id:        ${tr.sys_id}
Status:        ${tActiveStr}
Trigger Table: ${resolveRefField(tr.trigger_table, '(none)')}
Encoded Query: ${tr.encoded_query || '(none)'}`;
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('get AIA trigger configuration', error);
  }
}

// ════════════════════════════════════════════════════════════════
// Router
// ════════════════════════════════════════════════════════════════

export async function handleAiaTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult | null> {
  switch (name) {
    case 'servicenow_aia_list': return handleAiaList(args);
    case 'servicenow_aia_get': return handleAiaGet(args);
    case 'servicenow_aia_trace': return handleAiaTrace(args);
    case 'servicenow_aia_errors': return handleAiaErrors(args);
    case 'servicenow_aia_execute': return handleAiaExecute(args);
    case 'servicenow_aia_create': return handleAiaCreate(args);
    case 'servicenow_aia_tool_execute': return handleAiaToolExecute(args);
    case 'servicenow_aia_usecase_list': return handleAiaUsecaseList(args);
    case 'servicenow_aia_usecase_get': return handleAiaUsecaseGet(args);
    case 'servicenow_aia_trigger_get': return handleAiaTriggerGet(args);
    case 'servicenow_aia_usecase_create': return handleAiaUsecaseCreate(args);
    default: return null;
  }
}

export function isAiaTool(name: string): boolean {
  return AIA_TOOLS.some(tool => tool.name === name);
}

// ════════════════════════════════════════════════════════════════
// Shared error formatter
// ════════════════════════════════════════════════════════════════

function formatError(operation: string, error: unknown): ToolResult {
  if (error instanceof ServiceNowError) {
    let msg = `Failed to ${operation}: ${error.message}`;
    if (error.type === ServiceNowErrorType.TABLE_NOT_ACCESSIBLE) {
      msg += `\n\nThe table may not exist or your user may lack access. ${AIA_ROLE_HINT}`;
    }
    if (error.type === ServiceNowErrorType.ACL_DENIED) {
      msg += `\n\n${AIA_ROLE_HINT}`;
    }
    if (error.suggestion) {
      msg += `\n\nSuggestion: ${error.suggestion}`;
    }
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
  return {
    content: [{ type: 'text', text: `Failed to ${operation}: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  };
}

interface AgentToolInput {
  name: string;
  description: string;
}

interface AgentToolDef {
  name: string;
  description: string;
  inputSchema: AgentToolInput[];
  script: string;
  executionMode?: string;
  maxAutoExecutions?: number;
}

interface AgentDef {
  name: string;
  description: string;
  role: string;
  instructions: string;
  proficiency: string;
  tools?: AgentToolDef[];
}

export async function handleAiaUsecaseCreate(args: Record<string, unknown>): Promise<ToolResult> {
  const name = args.name as string;
  const prefix = (args.prefix as string) || '';
  const description = (args.description as string) || '';
  const basePlan = args.basePlan as string;
  const agentsRaw = args.agents as AgentDef[] | undefined;
  const executionMode = (args.executionMode as string) || 'copilot';
  const dryRun = args.dryRun !== false;

  if (!name || !basePlan) {
    return {
      content: [{ type: 'text', text: 'Error: name and basePlan are required' }],
      isError: true,
    };
  }

  if (!agentsRaw || !Array.isArray(agentsRaw) || agentsRaw.length === 0) {
    return {
      content: [{ type: 'text', text: 'Error: agents array is required and must have at least one agent' }],
      isError: true,
    };
  }

  const agents = agentsRaw as AgentDef[];
  const prefixedName = (n: string) => prefix ? `${prefix} ${n}` : n;

  // Pre-flight: scan all tool scripts for forbidden APIs
  const toolWarnings: string[] = [];
  for (const agent of agents) {
    for (const tool of agent.tools || []) {
      if (tool.script) {
        const warnings = scanToolScript(tool.script);
        if (warnings.length > 0) {
          toolWarnings.push(`  Tool "${prefixedName(tool.name)}":`);
          toolWarnings.push(...warnings);
        }
      }
    }
  }
  const forbiddenWarningSection = toolWarnings.length > 0
    ? `\n⚠️  FORBIDDEN API WARNING — Scripts will hang indefinitely\n${'─'.repeat(60)}\n${toolWarnings.join('\n')}\n\nFix these before executing the agent with servicenow_aia_execute.\n`
    : '';

  const allTools = agents.flatMap(a => (a.tools || []).map(t => ({ agent: a.name, tool: t })));
  const totalApiCalls = allTools.length + 2 + (agents.length * 3);

  if (dryRun) {
    const connStatus = connectionManager.getStatus();
    let output = `AI Agent Use Case Creation Plan — DRY RUN
${'═'.repeat(60)}
Instance: ${connStatus.activeInstance || '(not connected — will resolve on create)'}
${forbiddenWarningSection}
${'─'.repeat(60)}
PRE-FLIGHT: Strategy Lookup
${'─'.repeat(60)}
  ReAct (agent strategy):            query sn_aia_strategy WHERE name=ReAct AND type=agent
  ReActive Planner (orchestrator):   query sn_aia_strategy WHERE name=ReActive Planner AND type=orchestrator

${'─'.repeat(60)}
RECORDS TO CREATE
${'─'.repeat(60)}

Step 1: Tools (${allTools.length} records)`;

    for (const { agent, tool } of allTools) {
      output += `\n  - ${prefixedName(tool.name)} (for agent: ${prefixedName(agent)})`;
    }

    output += `\n\nStep 2: Team — ${prefixedName(name)}`;
    output += `\nStep 3: Use Case — ${prefixedName(name)} (executionMode: ${executionMode})`;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const agentTools = agent.tools || [];
      output += `\n\nStep 4.${i + 1}: Agent — ${prefixedName(agent.name)}`;
      output += `\nStep 5.${i + 1}: Team Member (Team → ${prefixedName(agent.name)})`;
      output += `\nStep 6.${i + 1}: Tool M2Ms (${agentTools.length} records)`;
      for (const t of agentTools) {
        output += `\n  - ${prefixedName(t.name)} → ${prefixedName(agent.name)} (${t.executionMode || 'autopilot'})`;
      }
    }

    output += `\n\n${'─'.repeat(60)}
SUMMARY
${'─'.repeat(60)}
Use Case: ${prefixedName(name)}
Agents: ${agents.length}
Total tools: ${allTools.length}
Total API calls: ~${totalApiCalls} writes + verification
Set dryRun=false to create.`;

    return { content: [{ type: 'text', text: output }] };
  }

  // ── Live creation requires connection ──────────────────────────
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;
  const connStatus = connectionManager.getStatus();

  const results: string[] = [];

  try {
    // Phase 0: Find strategies
    const strategyTable = await discoverTable(client, AIA_STRATEGY_TABLES, ['sys_id', 'name']);
    if (!strategyTable) {
      return { content: [{ type: 'text', text: `AI Agent strategy table not found. Is the AI Agent plugin activated?\n\n${AIA_ROLE_HINT}` }], isError: true };
    }
    const reactResp = await client.queryTable(strategyTable.tableName, 'name=ReAct^type=agent', ['sys_id', 'name'], 1);
    if (!reactResp.result?.[0]) {
      return { content: [{ type: 'text', text: `ReAct strategy not found. Is the AI Agent plugin activated?\n\n${AIA_ROLE_HINT}` }], isError: true };
    }
    const reactId = reactResp.result[0].sys_id as string;
    results.push(`[OK] Phase 0 — ReAct strategy: ${reactId}`);

    const plannerResp = await client.queryTable(strategyTable.tableName, 'name=ReActive Planner^type=orchestrator', ['sys_id', 'name'], 1);
    if (!plannerResp.result?.[0]) {
      return { content: [{ type: 'text', text: `ReActive Planner strategy not found. Is the AI Agent plugin activated?\n\n${AIA_ROLE_HINT}` }], isError: true };
    }
    const plannerId = plannerResp.result[0].sys_id as string;
    results.push(`[OK] Phase 0 — ReActive Planner strategy: ${plannerId}`);

    // Step 1: Create all tools upfront
    const toolMap = new Map<string, string>();
    for (const agent of agents) {
      for (const tool of agent.tools || []) {
        const toolDisplayName = prefixedName(tool.name);
        const toolResult = await client.createRecord('sn_aia_tool', {
          name: toolDisplayName,
          type: 'script',
          record_type: 'custom',
          active: 'true',
          description: tool.description,
          input_schema: JSON.stringify(tool.inputSchema),
          script: tool.script,
        });
        const toolId = ((toolResult.result as Record<string, unknown>).sys_id as string);
        toolMap.set(tool.name, toolId);
        results.push(`[OK] Step 1 — Tool: ${toolDisplayName} (${toolId})`);
      }
    }

    // Step 2: Create Team
    const teamResult = await client.createRecord('sn_aia_team', {
      name: prefixedName(name),
      description: description,
    });
    const teamId = ((teamResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Step 2 — Team: ${prefixedName(name)} (${teamId})`);

    // Step 3: Create Use Case
    const usecaseResult = await client.createRecord('sn_aia_usecase', {
      name: prefixedName(name),
      description: description,
      execution_mode: executionMode,
      record_type: 'custom',
      advanced_mode: 'false',
      team: teamId,
      strategy: plannerId,
      base_plan: basePlan,
      context_processing_script: '(function(user_utterance, usecase_id, context) {\n    return { pageContext: context?.pageContext, triggerContext: context?.triggerContext };\n})(user_utterance, usecase_id, context);',
      applicability_script: '(function(inputs) { return false; })(inputs);',
    });
    const usecaseId = ((usecaseResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Step 3 — Use Case: ${prefixedName(name)} (${usecaseId})`);

    // Steps 4-6: Agents, Team Members, Tool M2Ms
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const agentDisplayName = prefixedName(agent.name);

      const agentResult = await client.createRecord('sn_aia_agent', {
        name: agentDisplayName,
        description: agent.description,
        agent_type: 'internal',
        record_type: 'custom',
        channel: 'nap_and_va',
        advanced_mode: 'false',
        strategy: reactId,
        role: agent.role,
        instructions: agent.instructions,
        proficiency: agent.proficiency,
        context_processing_script: '(function(task, user_utterance, agent_id, context) {\n    return { pageContext: context?.pageContext, triggerContext: context?.triggerContext };\n})(task, user_utterance, agent_id, context);',
        applicability_script: '(function(inputs) { return false; })(inputs);',
        inputs: '[]',
        outputs: '""',
      });
      const agentId = ((agentResult.result as Record<string, unknown>).sys_id as string);
      results.push(`[OK] Step 4.${i + 1} — Agent: ${agentDisplayName} (${agentId})`);

      // Team Member (CRITICAL link)
      await client.createRecord('sn_aia_team_member', {
        team: teamId,
        agent: agentId,
        memory_scope: 'global',
      });
      results.push(`[OK] Step 5.${i + 1} — Team Member: Team → ${agentDisplayName}`);

      // Tool M2Ms
      for (const tool of agent.tools || []) {
        const toolId = toolMap.get(tool.name);
        if (!toolId) continue;
        const toolDisplayName = prefixedName(tool.name);
        await client.createRecord('sn_aia_agent_tool_m2m', {
          name: toolDisplayName,
          agent: agentId,
          tool: toolId,
          description: tool.description,
          inputs: JSON.stringify(tool.inputSchema),
          execution_mode: tool.executionMode || 'autopilot',
          max_auto_executions: String(tool.maxAutoExecutions ?? 10),
          display_output: 'true',
          active: 'true',
          pre_run: 'false',
        });
        results.push(`[OK] Step 6.${i + 1} — Tool M2M: ${toolDisplayName} → ${agentDisplayName}`);
      }
    }

    return {
      content: [{
        type: 'text',
        text: `AI Agent Use Case Created — ${connStatus.activeInstance}
${'═'.repeat(60)}

${results.join('\n')}
${forbiddenWarningSection}
${'─'.repeat(60)}
SUMMARY
${'─'.repeat(60)}
Use Case: ${prefixedName(name)}
Use Case ID: ${usecaseId}
Team ID: ${teamId}
Agents: ${agents.length}

Next steps:
1. Inspect: servicenow_aia_usecase_get with usecase="${usecaseId}"
2. Test: servicenow_aia_execute with agent="<agent_id>"
3. Navigate to AI Agent Studio in ServiceNow to verify`,
      }],
    };
  } catch (error) {
    if (results.length > 0) {
      const partialOutput = `Use Case creation failed after partial completion.\n\nCompleted steps:\n${results.join('\n')}\n\n`;
      const errResult = formatError('create AI Agent Use Case', error);
      return {
        content: [{ type: 'text', text: partialOutput + (errResult.content[0] as { text: string }).text }],
        isError: true,
      };
    }
    return formatError('create AI Agent Use Case', error);
  }
}
