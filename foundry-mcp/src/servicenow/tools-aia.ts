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
} from './table-discovery.js';
import type { ToolResult } from './tools.js';

// Helper to resolve ServiceNow reference fields that may be strings or objects
function resolveRefField(field: unknown, fallback = 'N/A'): string {
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

Use agent name or sys_id. Requires an active connection.`,
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
    },
    required: ['agent', 'input'],
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
      tools: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tool display name' },
            description: { type: 'string', description: 'What this tool does' },
            script: { type: 'string', description: 'Tool script (IIFE format)' },
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

// All AIA tools
export const AIA_TOOLS: Tool[] = [
  SERVICENOW_AIA_LIST_TOOL,
  SERVICENOW_AIA_GET_TOOL,
  SERVICENOW_AIA_TRACE_TOOL,
  SERVICENOW_AIA_ERRORS_TOOL,
  SERVICENOW_AIA_EXECUTE_TOOL,
  SERVICENOW_AIA_CREATE_TOOL,
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

This may mean AI Agent framework is not installed on this instance.`,
        }],
        isError: true,
      };
    }

    // Build query
    const queryParts: string[] = [];
    if (status === 'active') queryParts.push('active=true');
    else if (status === 'inactive') queryParts.push('active=false');
    if (nameFilter) queryParts.push(`nameLIKE${nameFilter}`);
    queryParts.push('ORDERBYname');
    const query = queryParts.join('^');

    const response = await client.queryTable(
      agentTable.tableName,
      query,
      ['sys_id', 'name', 'description', 'active', 'strategy'],
      limit
    );

    const agents = response.result || [];

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

  if (!agentRef) {
    return { content: [{ type: 'text', text: 'Error: agent is required (name or sys_id)' }], isError: true };
  }

  try {
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, [
      'sys_id', 'name', 'description', 'active', 'strategy', 'instructions', 'execution_mode',
    ]);

    if (!agentTable) {
      return {
        content: [{ type: 'text', text: `Could not find AI Agent table. Tried: ${AIA_AGENT_TABLES.join(', ')}` }],
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
      return { content: [{ type: 'text', text: `Agent not found: "${agentRef}"` }], isError: true };
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
              const schema = String(tool.input_schema);
              output += `
    Input Schema: ${schema.length > 300 ? schema.substring(0, 300) + '...' : schema}`;
            }

            if (tool.output_schema) {
              const schema = String(tool.output_schema);
              output += `
    Output Schema: ${schema.length > 300 ? schema.substring(0, 300) + '...' : schema}`;
            }

            if (tool.script) {
              const script = String(tool.script);
              output += `
    Script (${script.length} chars): ${script.length > 500 ? script.substring(0, 500) + '\n    ... (truncated)' : script}`;
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
        content: [{ type: 'text', text: `Could not find AIA execution table. Tried: ${AIA_EXECUTION_PLAN_TABLES.join(', ')}` }],
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
        content: [{ type: 'text', text: `Could not find AIA execution table. Tried: ${AIA_EXECUTION_PLAN_TABLES.join(', ')}` }],
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

  if (!agentRef || !input) {
    return { content: [{ type: 'text', text: 'Error: agent and input are required' }], isError: true };
  }

  try {
    // Resolve agent sys_id
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, ['sys_id', 'name']);
    if (!agentTable) {
      return {
        content: [{ type: 'text', text: `Could not find AI Agent table.` }],
        isError: true,
      };
    }

    const isSysId = /^[a-f0-9]{32}$/i.test(agentRef);
    let agentId = agentRef;
    let agentName = agentRef;

    if (!isSysId) {
      const agentResponse = await client.queryTable(
        agentTable.tableName,
        `nameLIKE${agentRef}^active=true`,
        ['sys_id', 'name'],
        1
      );
      const agents = agentResponse.result || [];
      if (agents.length === 0) {
        return { content: [{ type: 'text', text: `Active agent not found: "${agentRef}"` }], isError: true };
      }
      agentId = agents[0].sys_id as string;
      agentName = agents[0].name as string;
    }

    // Build the execution script using AiAgentRuntimeUtil
    const scriptParts = [
      `var runtime = new sn_aia.AiAgentRuntimeUtil();`,
      `var req = {`,
      `  agentId: "${agentId}",`,
      `  objective: ${JSON.stringify(input)},`,
      `  conversationUser: "admin",`,
      `  canInteractWithUser: false`,
    ];

    if (targetTable) scriptParts.push(`  ,targetTable: "${targetTable}"`);
    if (targetRecord) scriptParts.push(`  ,targetRecordId: "${targetRecord}"`);

    scriptParts.push(`};`);
    scriptParts.push(`var resp = runtime.startAiAgentConversation(req);`);
    scriptParts.push(`gs.info(JSON.stringify(resp));`);

    const script = scriptParts.join('\n');

    // Execute via the script endpoint
    const executeResult = await client.requestWithRetry<Record<string, unknown>>(
      '/api/now/table/sys_script_fix',
      {
        method: 'POST',
        body: {
          name: `AIA_Execute_${Date.now()}`,
          script: script,
          description: `Execute agent: ${agentName}`,
          active: true,
        },
        timeout: timeoutSeconds * 1000,
      }
    );

    const connStatus = connectionManager.getStatus();
    let output = `AI Agent Execution — ${connStatus.activeInstance}
${'═'.repeat(60)}

Agent: ${agentName} (${agentId})
Input: ${input.substring(0, 200)}${input.length > 200 ? '...' : ''}
${targetTable ? `Target: ${targetTable}${targetRecord ? `/${targetRecord}` : ''}` : ''}

Status: Execution request submitted.
Note: Agent executes asynchronously on the instance.
Use servicenow_aia_trace with the execution ID to see results.`;

    if (executeResult.result) {
      const scriptSysId = (executeResult.result as Record<string, unknown>).sys_id;
      output += `
Script Record: ${scriptSysId}`;

      // Clean up the temp script
      if (scriptSysId) {
        try {
          await client.deleteRecord('sys_script_fix', scriptSysId as string);
        } catch {
          // Cleanup failure is not critical
        }
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('execute AI Agent', error);
  }
}

export async function handleAiaCreate(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const agentName = args.agentName as string;
  const agentDescription = args.agentDescription as string;
  const agentInstructions = args.agentInstructions as string;
  const strategy = (args.strategy as string) || 'ReAct';
  const tools = (args.tools as Array<Record<string, string>>) || [];
  const dryRun = args.dryRun !== false; // Default true

  if (!agentName || !agentDescription || !agentInstructions) {
    return {
      content: [{ type: 'text', text: 'Error: agentName, agentDescription, and agentInstructions are required' }],
      isError: true,
    };
  }

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
Instance: ${connStatus.activeInstance}

This is a preview. Set dryRun=false to create these records.

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

    // Actually create the records
    const agentTable = await discoverTable(client, AIA_AGENT_TABLES, ['sys_id', 'name']);
    const toolTable = await discoverTable(client, AIA_TOOL_TABLES, ['sys_id', 'name']);
    const m2mTable = await discoverTable(client, AIA_AGENT_TOOL_M2M_TABLES, ['sys_id', 'agent', 'tool']);

    if (!agentTable || !toolTable || !m2mTable) {
      return {
        content: [{ type: 'text', text: 'Cannot find required AI Agent tables on this instance. Is AI Agent framework installed?' }],
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
      execution_mode: 'copilot',
    };

    const agentResult = await client.createRecord(agentTable.tableName, agentPayload);
    const createdAgentId = (agentResult.result as Record<string, unknown>).sys_id as string;
    results.push(`[OK] Agent created: ${agentName} (${createdAgentId})`);

    // Create mappings
    for (let i = 0; i < createdToolIds.length; i++) {
      const mappingPayload = {
        agent: createdAgentId,
        tool: createdToolIds[i],
        active: true,
      };
      await client.createRecord(m2mTable.tableName, mappingPayload);
      results.push(`[OK] Tool mapped: ${tools[i].name} -> ${agentName}`);
    }

    const connStatus = connectionManager.getStatus();
    return {
      content: [{
        type: 'text',
        text: `AI Agent Created — ${connStatus.activeInstance}
${'═'.repeat(60)}

${results.join('\n')}

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
      msg += `\n\nThe table may not exist or your user may lack access.`;
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
