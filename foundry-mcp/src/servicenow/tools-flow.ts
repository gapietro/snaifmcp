/**
 * ServiceNow Flow Designer Tools
 *
 * Tools for listing and inspecting Flow Designer flows on a connected
 * ServiceNow instance, including action steps and linked AIA Use Cases.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { connectionManager } from './connection-manager.js';
import { ServiceNowError, ServiceNowErrorType } from './types.js';
import { requireConnection, isConnectionError } from './guards.js';
import {
  discoverTable,
  FLOW_TABLES,
  FLOW_ACTION_INSTANCE_TABLES,
  AIA_USECASE_TABLES,
  AIA_TRIGGER_TABLES,
} from './table-discovery.js';
import type { ToolResult } from './tools.js';

// ════════════════════════════════════════════════════════════════
// Helpers (mirrored from tools-aia.ts)
// ════════════════════════════════════════════════════════════════

/** Role hint included in error messages when Flow Designer table access fails. */
const FLOW_ROLE_HINT = 'Ensure your user has the `flow_designer` role for Flow Designer table access.';

// Helper to resolve ServiceNow reference fields that may be strings or objects
function resolveRefField(field: unknown, fallback = 'N/A'): string {
  if (!field) return fallback;
  if (typeof field === 'string') return field || fallback;
  const ref = field as { display_value?: string; value?: string };
  return ref.display_value || ref.value || fallback;
}

function formatError(operation: string, error: unknown): ToolResult {
  if (error instanceof ServiceNowError) {
    let msg = `Failed to ${operation}: ${error.message}`;
    if (error.type === ServiceNowErrorType.TABLE_NOT_ACCESSIBLE) {
      msg += `\n\nThe table may not exist or your user may lack access. ${FLOW_ROLE_HINT}`;
    }
    if (error.type === ServiceNowErrorType.ACL_DENIED) {
      msg += `\n\n${FLOW_ROLE_HINT}`;
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

// ════════════════════════════════════════════════════════════════
// Tool Definitions
// ════════════════════════════════════════════════════════════════

export const SERVICENOW_FLOW_LIST_TOOL: Tool = {
  name: 'servicenow_flow_list',
  description: `List Flow Designer flows on the connected ServiceNow instance.

Filter by name and/or trigger table to find flows relevant to your Agentic Workflow.
Use this to discover what flows exist before inspecting specific ones with servicenow_flow_get.

Requires an active connection (use servicenow_connect first).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nameFilter: {
        type: 'string',
        description: 'Filter by flow name (partial match)',
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'all'],
        description: 'Filter by active status (default: "all")',
      },
      limit: {
        type: 'integer',
        description: 'Maximum flows to return (default: 50, max: 200)',
      },
    },
  },
};

export const SERVICENOW_FLOW_GET_TOOL: Tool = {
  name: 'servicenow_flow_get',
  description: `Get complete details of a Flow Designer flow.

Returns flow metadata (active status, description) and, optionally, the action steps
in the flow. For "AIA Trigger Use Case" steps, attempts to extract and resolve the
linked Use Case from the inputs field.

Use the flow name or sys_id to identify the flow.

Requires an active connection (use servicenow_connect first).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      flow: {
        type: 'string',
        description: 'Flow name or sys_id',
      },
      includeSteps: {
        type: 'boolean',
        description: 'Include action steps from sys_hub_action_instance (default: true)',
      },
    },
    required: ['flow'],
  },
};

export const FLOW_TOOLS: Tool[] = [
  SERVICENOW_FLOW_LIST_TOOL,
  SERVICENOW_FLOW_GET_TOOL,
];

// ════════════════════════════════════════════════════════════════
// Handlers
// ════════════════════════════════════════════════════════════════

export async function handleFlowList(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  try {
    const nameFilter = args.nameFilter as string | undefined;
    const status = (args.status as string | undefined) ?? 'all';
    const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);

    const flowTable = await discoverTable(client, FLOW_TABLES, ['sys_id', 'name', 'active', 'description']);
    if (!flowTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find Flow Designer table sys_hub_flow. Check that Flow Designer is installed on this instance.`,
        }],
        isError: true,
      };
    }

    const queryParts: string[] = [];
    if (status === 'active') queryParts.push('active=true');
    if (status === 'inactive') queryParts.push('active=false');
    if (nameFilter) queryParts.push(`nameLIKE${nameFilter}`);
    queryParts.push('ORDERBYname');
    const query = queryParts.join('^');

    const response = await client.queryTable(
      flowTable.tableName,
      query,
      ['sys_id', 'name', 'active', 'description'],
      limit
    );

    const flows = (response.result as Record<string, unknown>[]) ?? [];

    if (flows.length === 0) {
      return {
        content: [{ type: 'text', text: `No flows found${nameFilter ? ` matching "${nameFilter}"` : ''}.` }],
      };
    }

    const connStatus = connectionManager.getStatus();
    let output = `Flows on ${connStatus.activeInstance}\n`;
    output += `Found: ${flows.length}${flows.length === limit ? ' (limit reached)' : ''}\n`;
    for (let i = 0; i < flows.length; i++) {
      const f = flows[i];
      const activeStr = f.active === 'true' || f.active === true ? 'Active' : 'Inactive';
      const desc = resolveRefField(f.description, '');
      output += `\n${i + 1}. ${resolveRefField(f.name)}`;
      output += `\n   Sys ID: ${resolveRefField(f.sys_id)}`;
      output += `\n   Active: ${activeStr}`;
      if (desc) output += `\n   Description: ${desc}`;
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('list flows', error);
  }
}

export async function handleFlowGet(args: Record<string, unknown>): Promise<ToolResult> {
  const flowRef = args.flow as string;
  if (!flowRef) {
    return {
      content: [{ type: 'text', text: 'Missing required parameter: flow' }],
      isError: true,
    };
  }

  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  try {
    const includeSteps = args.includeSteps !== false;

    // Discover flow table
    const flowTable = await discoverTable(
      client,
      FLOW_TABLES,
      ['sys_id', 'name', 'active', 'description', 'sys_created_on', 'sys_updated_on']
    );
    if (!flowTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find Flow Designer table sys_hub_flow. Check that Flow Designer is installed on this instance.`,
        }],
        isError: true,
      };
    }

    // Resolve flow
    const isSysId = /^[a-f0-9]{32}$/i.test(flowRef);
    const query = isSysId ? `sys_id=${flowRef}` : `nameLIKE${flowRef}`;
    const response = await client.queryTable(
      flowTable.tableName,
      query,
      ['sys_id', 'name', 'active', 'description', 'sys_created_on', 'sys_updated_on'],
      1
    );
    const flows = (response.result as Record<string, unknown>[]) ?? [];
    if (flows.length === 0) {
      return {
        content: [{ type: 'text', text: `Flow not found: '${flowRef}'` }],
        isError: true,
      };
    }
    const flow = flows[0];
    const flowSysId = resolveRefField(flow.sys_id);
    const activeStr = flow.active === 'true' || flow.active === true ? 'Active' : 'Inactive';

    let output = `Flow: ${resolveRefField(flow.name)}`;
    output += `\nSys ID: ${flowSysId}`;
    output += `\nActive: ${activeStr}`;
    const desc = resolveRefField(flow.description, '');
    if (desc) output += `\nDescription: ${desc}`;
    if (flow.sys_created_on) output += `\nCreated: ${resolveRefField(flow.sys_created_on)}`;
    if (flow.sys_updated_on) output += `\nUpdated: ${resolveRefField(flow.sys_updated_on)}`;

    if (!includeSteps) {
      return { content: [{ type: 'text', text: output }] };
    }

    // Fetch action steps
    try {
      const actionTable = await discoverTable(
        client,
        FLOW_ACTION_INSTANCE_TABLES,
        ['sys_id', 'name', 'order', 'action_type', 'inputs']
      );

      if (!actionTable) {
        output += `\n\nSteps: (could not discover sys_hub_action_instance table — check flow_designer role)`;
        return { content: [{ type: 'text', text: output }] };
      }

      // Pre-fetch trigger configurations for this flow (used as fallback for AIA Trigger Use Case steps
      // when the inputs blob is null — see issue #120).
      // sn_aia_trigger_configuration.trigger_flow references sys_hub_flow.sys_id and carries
      // the linked use case, target table, and condition.
      let triggerConfigs: Record<string, unknown>[] = [];
      try {
        const triggerTable = await discoverTable(client, AIA_TRIGGER_TABLES,
          ['sys_id', 'name', 'usecase', 'target_table', 'condition', 'active']);
        if (triggerTable) {
          const tcResp = await client.queryTable(
            triggerTable.tableName,
            `trigger_flow=${flowSysId}`,
            ['sys_id', 'name', 'usecase', 'target_table', 'condition', 'active'],
            10
          );
          triggerConfigs = (tcResp.result as Record<string, unknown>[]) ?? [];
        }
      } catch {
        // Non-fatal — fallback simply won't be available
      }

      const stepsResponse = await client.queryTable(
        actionTable.tableName,
        `flow=${flowSysId}`,
        ['sys_id', 'name', 'order', 'action_type', 'inputs'],
        100,
        true  // sysparm_display_value=all so action_type returns display name
      );
      const steps = (stepsResponse.result as Record<string, unknown>[]) ?? [];

      if (steps.length === 0) {
        output += `\n\nSteps: 0`;
      } else {
        output += `\n\nSteps: ${steps.length}`;

        // Sort by order if available
        steps.sort((a, b) => {
          const ao = Number(a.order ?? 0);
          const bo = Number(b.order ?? 0);
          return ao - bo;
        });

        for (const step of steps) {
          const order = resolveRefField(step.order, '?');
          const name = resolveRefField(step.name, '(unnamed)');
          const actionType = resolveRefField(step.action_type, '(unknown type)');
          output += `\n  ${order}. [${actionType}] ${name}`;

          // Parse inputs blob
          let ucFoundViaInputs = false;
          const rawInputs = step.inputs;
          if (rawInputs && String(rawInputs).trim() !== '') {
            const inputsStr = String(rawInputs);
            try {
              const parsed = JSON.parse(inputsStr) as Record<string, unknown>;
              // Key candidates for the linked use case sys_id in the inputs blob.
              // The exact field name depends on the ServiceNow version and action type implementation.
              // 'use_case' is the most commonly observed key for the AIA Trigger Use Case action type.
              const ucSysId = String(parsed.use_case ?? parsed.usecase_id ?? parsed.usecaseId ?? '');
              if (ucSysId && ucSysId !== 'undefined') {
                ucFoundViaInputs = true;
                // Try to resolve use case name
                try {
                  const ucTable = await discoverTable(client, AIA_USECASE_TABLES, ['sys_id', 'name']);
                  if (ucTable) {
                    const ucResp = await client.queryTable(
                      ucTable.tableName,
                      `sys_id=${ucSysId}`,
                      ['sys_id', 'name'],
                      1
                    );
                    const ucs = (ucResp.result as Record<string, unknown>[]) ?? [];
                    if (ucs.length > 0) {
                      output += `\n       Linked Use Case: ${resolveRefField(ucs[0].name)} (sys_id: ${ucSysId})`;
                    } else {
                      output += `\n       Linked Use Case sys_id: ${ucSysId} (could not resolve name)`;
                    }
                  } else {
                    output += `\n       Linked Use Case sys_id: ${ucSysId}`;
                  }
                } catch {
                  output += `\n       Linked Use Case sys_id: ${ucSysId}`;
                }
              } else {
                // Show JSON summary (first 200 chars)
                const summary = JSON.stringify(parsed);
                output += `\n       Inputs: ${summary.length > 200 ? summary.substring(0, 200) + '...' : summary}`;
              }
            } catch {
              // Not JSON — show raw truncated
              const truncated = inputsStr.length > 200 ? inputsStr.substring(0, 200) + '...' : inputsStr;
              output += `\n       Inputs: ${truncated} (raw, unparseable)`;
            }
          }

          // Fallback: if this is an AIA Trigger Use Case step and inputs didn't yield a use case,
          // resolve via sn_aia_trigger_configuration.trigger_flow (issue #120).
          if (!ucFoundViaInputs && actionType === 'AIA Trigger Use Case' && triggerConfigs.length > 0) {
            for (const tc of triggerConfigs) {
              const ucSysId = resolveRefField(tc.usecase, '');
              if (!ucSysId) continue;
              // Resolve use case name
              try {
                const ucTable = await discoverTable(client, AIA_USECASE_TABLES, ['sys_id', 'name']);
                if (ucTable) {
                  const ucResp = await client.queryTable(ucTable.tableName, `sys_id=${ucSysId}`, ['sys_id', 'name'], 1);
                  const ucs = (ucResp.result as Record<string, unknown>[]) ?? [];
                  const ucName = ucs.length > 0 ? resolveRefField(ucs[0].name) : ucSysId;
                  output += `\n       Linked Use Case: ${ucName}`;
                } else {
                  output += `\n       Linked Use Case sys_id: ${ucSysId}`;
                }
              } catch {
                output += `\n       Linked Use Case sys_id: ${ucSysId}`;
              }
              const targetTable = resolveRefField(tc.target_table, '');
              const condition = resolveRefField(tc.condition, '');
              if (targetTable) output += `\n       Trigger Table: ${targetTable}`;
              if (condition) output += `\n       Condition: ${condition}`;
            }
          }
        }
      }
    } catch {
      output += `\n\nCould not fetch action steps (check flow_designer role)`;
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('get flow', error);
  }
}

// ════════════════════════════════════════════════════════════════
// Dispatch + predicate
// ════════════════════════════════════════════════════════════════

export async function handleFlowTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult | null> {
  switch (name) {
    case 'servicenow_flow_list': return handleFlowList(args);
    case 'servicenow_flow_get': return handleFlowGet(args);
    default: return null;
  }
}

export function isFlowTool(name: string): boolean {
  return FLOW_TOOLS.some(tool => tool.name === name);
}
