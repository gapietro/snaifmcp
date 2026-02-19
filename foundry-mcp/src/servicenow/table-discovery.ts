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

export const AIA_AGENT_TOOL_M2M_TABLES = [
  'sn_aia_agent_tool_m2m',
  'sys_aia_agent_tool_m2m',
];

export const AIA_EXECUTION_PLAN_TABLES = [
  'sn_aia_execution_plan',       // Zurich+ (confirmed via data model)
  'sn_aia_agent_execution',
  'sys_aia_execution',
  'sn_agent_execution',
  'sn_ai_agent_execution',
];

export const AIA_EXECUTION_TASK_TABLES = [
  'sn_aia_execution_task',       // Zurich+ (confirmed via data model)
];

export const AIA_TOOL_EXECUTION_TABLES = [
  'sn_aia_tools_execution',      // Zurich+ (confirmed via data model)
  'sn_aia_tool_execution',
  'sys_aia_tool_execution',
  'sn_agent_tool_execution',
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
