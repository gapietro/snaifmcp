/**
 * Table Discovery Utility
 *
 * ServiceNow table names vary across versions (Vancouver, Washington, Xanadu, etc.).
 * This utility probes candidate table names to find the correct one on the connected instance.
 * Results are cached per session to avoid redundant API calls.
 */

import { ServiceNowClient } from './client.js';

/**
 * Result of a successful table discovery
 */
export interface DiscoveredTable {
  tableName: string;
  availableFields: string[];
}

// Session-level cache of discovered table names
const tableCache = new Map<string, DiscoveredTable | null>();

/**
 * Probe multiple candidate table names and return the first one that exists.
 *
 * @param client - Active ServiceNow client
 * @param candidateNames - Table names to try in priority order
 * @param probeFields - Fields to request (used to verify table structure)
 * @returns DiscoveredTable if found, null if no candidate exists
 */
export async function discoverTable(
  client: ServiceNowClient,
  candidateNames: string[],
  probeFields: string[] = ['sys_id']
): Promise<DiscoveredTable | null> {
  // Check cache first
  const cacheKey = candidateNames.join('|');
  if (tableCache.has(cacheKey)) {
    return tableCache.get(cacheKey) || null;
  }

  for (const tableName of candidateNames) {
    try {
      const response = await client.queryTable(
        tableName,
        '',
        probeFields,
        1
      );

      // If we get a response (even empty), the table exists
      if (response.result !== undefined) {
        const result: DiscoveredTable = {
          tableName,
          availableFields: probeFields,
        };
        tableCache.set(cacheKey, result);
        return result;
      }
    } catch {
      // Table doesn't exist or access denied — try next candidate
      continue;
    }
  }

  // No candidate table found
  tableCache.set(cacheKey, null);
  return null;
}

/**
 * Clear the table discovery cache (e.g., on reconnect)
 */
export function clearTableCache(): void {
  tableCache.clear();
}

// ── Well-known table candidate lists ────────────────────────────

export const AIA_AGENT_TABLES = [
  'sn_aia_agent',
  'sys_aia_agent',
  'sn_ai_agent',
];

export const AIA_TOOL_TABLES = [
  'sn_aia_tool',
  'sys_aia_tool',
  'sn_ai_tool',
];

export const AIA_USECASE_TABLES = [
  'sn_aia_usecase',
  'sys_aia_usecase',
  'sn_ai_usecase',
];

export const AIA_TRIGGER_TABLES = [
  'sn_aia_trigger_configuration',
  'sys_aia_trigger_configuration',
];

export const AIA_AGENT_TOOL_M2M_TABLES = [
  'sn_aia_agent_tool_m2m',
  'sys_aia_agent_tool_m2m',
];

export const AIA_AGENT_CHILD_TABLES = [
  'sn_aia_agent_child',
  'sys_aia_agent_child',
];

export const FLOW_TABLES = [
  'sys_hub_flow',
];

export const FLOW_ACTION_INSTANCE_TABLES = [
  'sys_hub_action_instance',
];

export const FLOW_TRIGGER_INSTANCE_TABLES = [
  'sys_hub_trigger_instance',
];

export const AIA_EXECUTION_PLAN_TABLES = [
  'sn_aia_execution_plan',       // Zurich+ (confirmed via data model)
  'sn_aia_agent_execution',
  'sys_aia_execution',
  'sn_agent_execution',
  'sn_ai_agent_execution',
  'x_snc_aia_execution',         // Scoped app variant
];

export const AIA_EXECUTION_TASK_TABLES = [
  'sn_aia_execution_task',       // Zurich+ (confirmed via data model)
];

export const AIA_TOOL_EXECUTION_TABLES = [
  'sn_aia_tools_execution',      // Zurich+ (confirmed via data model)
  'sn_aia_tool_execution',
  'sys_aia_tool_execution',
  'sn_agent_tool_execution',
  'x_snc_aia_tool_execution',    // Scoped app variant
];

export const AIA_MESSAGE_TABLES = [
  'sn_aia_message',              // Zurich+ (confirmed via data model)
];

export const GENAI_SKILL_TABLES = [
  'sys_genai_skill',
  'sn_gai_skill',
  'sn_genai_skill',
  'sn_now_assist_skill',
];

export const GENAI_PROMPT_TABLES = [
  'sys_genai_prompt_template',
  'sn_genai_prompt_template',
];

export const GENAI_SKILL_VERSION_TABLES = [
  'sys_genai_skill_version',
  'sn_genai_skill_version',
];

export const NOWASSIST_SKILL_CONFIG_TABLES = [
  'sn_nowassist_skill_config',
  'sys_nowassist_skill_config',
];

export const CAPABILITY_TABLES = [
  'sys_one_extend_capability',
];

export const CAPABILITY_DEFINITION_TABLES = [
  'sys_one_extend_capability_definition',
];

export const DEFINITION_CONFIG_TABLES = [
  'sys_one_extend_definition_config',
];

export const DEFINITION_ATTRIBUTE_TABLES = [
  'sys_one_extend_definition_attribute',
];

export const GENERATIVE_AI_CONFIG_TABLES = [
  'sys_generative_ai_config',
];

// ── Skills Kit table candidates ────────────────────────────────

export const SKILL_FAMILY_TABLES = [
  'sn_nowassist_skill_family',
];

export const SKILL_CATEGORY_TABLES = [
  'sn_nowassist_skill_category',
  'sys_one_extend_category',
];

export const SKILL_STATUS_TABLES = [
  'sn_nowassist_skill_config_status',
];

export const PROMPT_LINK_TABLES = [
  'sys_generative_ai_prompt_config',
];

export const RESOURCE_MAPPING_TABLES = [
  'sys_one_extend_resource_mapping',
];

export const DIAGRAM_BUILDER_INSTANCE_TABLES = [
  'sn_diagram_builder_instance',
];

export const DIAGRAM_BUILDER_CONFIG_TABLES = [
  'sn_diagram_builder_config',
];

export const EVAL_STRATEGY_TABLES = [
  'sys_one_extend_eval_strategy',
];

export const EVAL_ATTRIBUTE_TABLES = [
  'sys_one_extend_eval_attribute',
];

export const ACCESS_ROLE_CONFIG_TABLES = [
  'sys_agent_access_role_configuration',
];

export const TRUNCATE_STRATEGY_TABLES = [
  'sys_one_extend_truncate_strategy',
  'sn_one_extend_truncate_strategy',
];

// ── AIA additional table candidates ───────────────────────────

export const AIA_TEAM_TABLES = [
  'sn_aia_team',
  'sys_aia_team',
];

export const AIA_TEAM_MEMBER_TABLES = [
  'sn_aia_team_member',
  'sys_aia_team_member',
];

export const AIA_STRATEGY_TABLES = [
  'sn_aia_strategy',
  'sys_aia_strategy',
];

// -- GenAI Controller REST Endpoint Candidates --
// These are probed in order to find a working skill execution endpoint.
// The list covers Vancouver through Zurich+ naming conventions.
export const GENAI_EXECUTE_ENDPOINTS = [
  '/api/sn_generative_ai/now_llm/execute',          // Zurich+ (sn_generative_ai scope)
  '/api/sn_generative_ai/genai/controller/execute',  // Zurich variant
  '/api/sn_skill_builder/skill/execute',             // Now Assist Skill Kit (NASK) scope
  '/api/now/genai/controller/execute',               // Vancouver/Washington/Xanadu
  '/api/sn_genai/genai/controller/execute',          // Alternate scoped API
  '/api/now/genai/execute',                          // Legacy short path
  '/api/sn_generative_ai/execute',                   // Zurich simplified
];

// -- REST Endpoint Discovery --

// Session-level cache of discovered REST endpoints
const endpointCache = new Map<string, string | null>();

/**
 * Probe multiple candidate REST API endpoints and return the first one that responds.
 *
 * Unlike table discovery (which queries the Table API), this sends a lightweight
 * POST to each candidate and considers any non-404 response a hit (the endpoint exists
 * even if the request payload is invalid -- we just need to know the path is routable).
 *
 * @param client - Active ServiceNow client
 * @param candidateEndpoints - Endpoint paths to try in priority order
 * @param probePayload - Minimal payload to send (default: empty object)
 * @returns The first working endpoint path, or null if none respond
 */
export async function discoverEndpoint(
  client: ServiceNowClient,
  candidateEndpoints: string[],
  probePayload: Record<string, unknown> = {}
): Promise<string | null> {
  const cacheKey = candidateEndpoints.join('|');
  if (endpointCache.has(cacheKey)) {
    return endpointCache.get(cacheKey) || null;
  }

  for (const endpoint of candidateEndpoints) {
    try {
      await client.requestWithRetry<Record<string, unknown>>(
        endpoint,
        {
          method: 'POST',
          body: probePayload,
          timeout: 15000,
        }
      );
      // Got a successful response -- endpoint exists
      endpointCache.set(cacheKey, endpoint);
      return endpoint;
    } catch (error) {
      // 404 (TABLE_NOT_ACCESSIBLE) means endpoint doesn't exist -- try next
      // Other errors (400, 401, 403, 500) mean the endpoint exists but the
      // request payload was bad or auth is needed -- still counts as found
      if (error instanceof Error && 'type' in error) {
        const snError = error as { type: string };
        if (snError.type !== 'table_not_accessible') {
          endpointCache.set(cacheKey, endpoint);
          return endpoint;
        }
      }
      continue;
    }
  }

  endpointCache.set(cacheKey, null);
  return null;
}

/**
 * Clear the endpoint discovery cache (e.g., on reconnect)
 */
export function clearEndpointCache(): void {
  endpointCache.clear();
}
