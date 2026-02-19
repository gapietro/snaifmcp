/**
 * ServiceNow Now Assist Skill Tools
 *
 * Tools for listing, inspecting, executing, and creating
 * Now Assist skills via the GenAI Controller on a connected instance.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { connectionManager } from './connection-manager.js';
import { ServiceNowError, ServiceNowErrorType } from './types.js';
import { requireConnection, isConnectionError } from './guards.js';
import {
  discoverTable,
  GENAI_SKILL_TABLES,
  GENAI_PROMPT_TABLES,
  GENAI_SKILL_VERSION_TABLES,
  CAPABILITY_TABLES,
  NOWASSIST_SKILL_CONFIG_TABLES,
  GENERATIVE_AI_CONFIG_TABLES,
  CAPABILITY_DEFINITION_TABLES,
  DEFINITION_CONFIG_TABLES,
  DEFINITION_ATTRIBUTE_TABLES,
} from './table-discovery.js';
import type { ToolResult } from './tools.js';

// ════════════════════════════════════════════════════════════════
// Tool Definitions
// ════════════════════════════════════════════════════════════════

export const SERVICENOW_SKILL_LIST_TOOL: Tool = {
  name: 'servicenow_skill_list',
  description: `List all Now Assist skills on the connected ServiceNow instance.

Shows skill name, description, category, and status.
Use this to discover what skills are deployed before building new ones.

Requires an active connection (use servicenow_connect first).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'all'],
        description: 'Filter by skill status (default: "all")',
      },
      category: {
        type: 'string',
        description: 'Filter by category (e.g., "summarization", "generation")',
      },
      nameFilter: {
        type: 'string',
        description: 'Filter by skill name (partial match)',
      },
      limit: {
        type: 'number',
        description: 'Maximum skills to return (default: 50, max: 200)',
      },
    },
  },
};

export const SERVICENOW_SKILL_GET_TOOL: Tool = {
  name: 'servicenow_skill_get',
  description: `Get complete details of a Now Assist skill.

Returns full skill config: prompt template, input/output schemas, model settings, version history.
Use this to inspect a skill's prompt so you can iterate on it.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      skill: {
        type: 'string',
        description: 'Skill name, skill_id, or sys_id',
      },
      includePrompt: {
        type: 'boolean',
        description: 'Include full prompt template (default: true)',
      },
      includeSchema: {
        type: 'boolean',
        description: 'Include input/output schemas (default: true)',
      },
      includeVersions: {
        type: 'boolean',
        description: 'Include version history (default: false)',
      },
    },
    required: ['skill'],
  },
};

export const SERVICENOW_SKILL_EXECUTE_TOOL: Tool = {
  name: 'servicenow_skill_execute',
  description: `Invoke a Now Assist skill via the GenAI Controller for testing.

Sends input to a skill and returns the output. Useful for iterating on skill prompts.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      skill: {
        type: 'string',
        description: 'Skill name, skill_id, or sys_id',
      },
      input: {
        type: 'object',
        description: 'Input data for the skill (JSON object matching the skill\'s input schema)',
      },
      modelOverride: {
        type: 'string',
        description: 'Override the default model (optional)',
      },
      temperatureOverride: {
        type: 'number',
        description: 'Override the default temperature (0.0-1.0, optional)',
      },
    },
    required: ['skill', 'input'],
  },
};

export const SERVICENOW_SKILL_CREATE_TOOL: Tool = {
  name: 'servicenow_skill_create',
  description: `Create a Now Assist Skill via the 8-table API pattern.

Creates all required records across 8 tables to register a complete skill.
Defaults to dry-run mode. Set dryRun=false to actually create.

Requires an active connection.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      skillName: {
        type: 'string',
        description: 'Skill display name',
      },
      description: {
        type: 'string',
        description: 'What this skill does',
      },
      promptTemplate: {
        type: 'string',
        description: 'System prompt template for the LLM',
      },
      inputSchema: {
        type: 'object',
        description: 'Input parameters schema',
      },
      outputSchema: {
        type: 'object',
        description: 'Output parameters schema',
      },
      modelConfig: {
        type: 'object',
        description: 'Optional model configuration (model, temperature, max_tokens)',
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview what would be created without modifying the instance (default: true)',
      },
    },
    required: ['skillName', 'description', 'promptTemplate'],
  },
};

// All Skill tools
export const SKILL_TOOLS: Tool[] = [
  SERVICENOW_SKILL_LIST_TOOL,
  SERVICENOW_SKILL_GET_TOOL,
  SERVICENOW_SKILL_EXECUTE_TOOL,
  SERVICENOW_SKILL_CREATE_TOOL,
];

// ════════════════════════════════════════════════════════════════
// Handler Implementations
// ════════════════════════════════════════════════════════════════

export async function handleSkillList(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const status = (args.status as string) || 'all';
  const category = args.category as string | undefined;
  const nameFilter = args.nameFilter as string | undefined;
  const limit = Math.min(Math.max((args.limit as number) || 50, 1), 200);

  try {
    // Try GenAI skill tables first, then fall back to NowAssist config tables
    let skillTable = await discoverTable(client, GENAI_SKILL_TABLES, [
      'sys_id', 'name', 'description', 'active',
    ]);

    if (!skillTable) {
      skillTable = await discoverTable(client, NOWASSIST_SKILL_CONFIG_TABLES, [
        'sys_id', 'name', 'description', 'active',
      ]);
    }

    if (!skillTable) {
      return {
        content: [{
          type: 'text',
          text: `Could not find Now Assist skill table. Tried: ${[...GENAI_SKILL_TABLES, ...NOWASSIST_SKILL_CONFIG_TABLES].join(', ')}

This may mean Now Assist is not installed on this instance.`,
        }],
        isError: true,
      };
    }

    // Build query
    const queryParts: string[] = [];
    if (status === 'active') queryParts.push('active=true');
    else if (status === 'inactive') queryParts.push('active=false');
    if (nameFilter) queryParts.push(`nameLIKE${nameFilter}`);
    if (category) queryParts.push(`categoryLIKE${category}`);
    queryParts.push('ORDERBYname');

    const response = await client.queryTable(
      skillTable.tableName,
      queryParts.join('^'),
      ['sys_id', 'name', 'description', 'active', 'category', 'skill_type', 'sys_updated_on'],
      limit
    );

    const skills = response.result || [];

    if (skills.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No skills found${nameFilter ? ` matching "${nameFilter}"` : ''}${status !== 'all' ? ` with status: ${status}` : ''}.`,
        }],
      };
    }

    const connStatus = connectionManager.getStatus();
    let output = `Now Assist Skills on ${connStatus.activeInstance}
Table: ${skillTable.tableName}
Found: ${skills.length} skill(s)${skills.length === limit ? ' (limit reached)' : ''}

${'═'.repeat(60)}`;

    for (const skill of skills) {
      const activeStr = skill.active === 'true' || skill.active === true ? 'Active' : 'Inactive';
      output += `

[${activeStr === 'Active' ? 'ON' : 'OFF'}] ${skill.name}
${'─'.repeat(60)}
  sys_id: ${skill.sys_id}
  Description: ${((skill.description as string) || '(none)').substring(0, 200)}
  Category: ${skill.category || 'N/A'}
  Type: ${skill.skill_type || 'N/A'}
  Updated: ${skill.sys_updated_on || 'N/A'}`;
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('list skills', error);
  }
}

export async function handleSkillGet(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const skillRef = args.skill as string;
  const includePrompt = args.includePrompt !== false;
  const includeSchema = args.includeSchema !== false;
  const includeVersions = args.includeVersions === true;

  if (!skillRef) {
    return { content: [{ type: 'text', text: 'Error: skill is required (name, skill_id, or sys_id)' }], isError: true };
  }

  try {
    // Find the skill
    let skillTable = await discoverTable(client, GENAI_SKILL_TABLES, ['sys_id', 'name']);
    if (!skillTable) {
      skillTable = await discoverTable(client, NOWASSIST_SKILL_CONFIG_TABLES, ['sys_id', 'name']);
    }

    if (!skillTable) {
      return {
        content: [{ type: 'text', text: `Could not find Now Assist skill table.` }],
        isError: true,
      };
    }

    const isSysId = /^[a-f0-9]{32}$/i.test(skillRef);
    const skillQuery = isSysId ? `sys_id=${skillRef}` : `nameLIKE${skillRef}`;

    const response = await client.queryTable(
      skillTable.tableName,
      skillQuery,
      ['sys_id', 'name', 'description', 'active', 'category', 'skill_type', 'skill_id',
       'sys_created_on', 'sys_updated_on', 'capability', 'input_schema', 'output_schema'],
      1
    );

    const skills = response.result || [];
    if (skills.length === 0) {
      return { content: [{ type: 'text', text: `Skill not found: "${skillRef}"` }], isError: true };
    }

    const skill = skills[0];
    const connStatus = connectionManager.getStatus();

    let output = `Now Assist Skill Details — ${connStatus.activeInstance}
${'═'.repeat(60)}

Name: ${skill.name}
sys_id: ${skill.sys_id}
Skill ID: ${skill.skill_id || 'N/A'}
Status: ${skill.active === 'true' || skill.active === true ? 'Active' : 'Inactive'}
Category: ${skill.category || 'N/A'}
Type: ${skill.skill_type || 'N/A'}
Created: ${skill.sys_created_on || 'N/A'}
Updated: ${skill.sys_updated_on || 'N/A'}
Description: ${skill.description || '(none)'}`;

    // Try to get prompt template
    if (includePrompt) {
      const promptTable = await discoverTable(client, GENAI_PROMPT_TABLES, ['sys_id', 'prompt']);
      if (promptTable) {
        // Try to find prompts related to this skill
        const skillId = skill.sys_id as string;
        try {
          const promptResponse = await client.queryTable(
            promptTable.tableName,
            `skill=${skillId}`,
            ['sys_id', 'name', 'prompt', 'model', 'temperature', 'max_tokens'],
            5
          );

          const prompts = promptResponse.result || [];
          if (prompts.length > 0) {
            output += `

${'─'.repeat(60)}
PROMPT TEMPLATE
${'─'.repeat(60)}`;
            for (const p of prompts) {
              output += `

  Name: ${p.name || 'Default'}
  Model: ${p.model || 'default'}
  Temperature: ${p.temperature || 'default'}
  Max Tokens: ${p.max_tokens || 'default'}
  Prompt:
${String(p.prompt || '(empty)').substring(0, 2000)}`;
            }
          }
        } catch {
          // Prompt query may fail if schema is different
        }
      }

      // Also check sys_generative_ai_config for LLM settings
      const genaiTable = await discoverTable(client, GENERATIVE_AI_CONFIG_TABLES, ['sys_id', 'name', 'prompt']);
      if (genaiTable) {
        try {
          const genaiResponse = await client.queryTable(
            genaiTable.tableName,
            `nameLIKE${skill.name}`,
            ['sys_id', 'name', 'prompt', 'model', 'active'],
            5
          );
          const configs = genaiResponse.result || [];
          if (configs.length > 0) {
            output += `

${'─'.repeat(60)}
GENERATIVE AI CONFIG
${'─'.repeat(60)}`;
            for (const c of configs) {
              output += `
  Config: ${c.name} (${c.active === 'true' || c.active === true ? 'Active' : 'Inactive'})
  Prompt: ${String(c.prompt || '(empty)').substring(0, 1000)}`;
            }
          }
        } catch {
          // Config query may fail
        }
      }
    }

    // Input/output schemas
    if (includeSchema) {
      if (skill.input_schema) {
        output += `

${'─'.repeat(60)}
INPUT SCHEMA
${'─'.repeat(60)}
${String(skill.input_schema).substring(0, 2000)}`;
      }

      if (skill.output_schema) {
        output += `

${'─'.repeat(60)}
OUTPUT SCHEMA
${'─'.repeat(60)}
${String(skill.output_schema).substring(0, 2000)}`;
      }
    }

    // Version history
    if (includeVersions) {
      const versionTable = await discoverTable(client, GENAI_SKILL_VERSION_TABLES, ['sys_id', 'version']);
      if (versionTable) {
        try {
          const versionResponse = await client.queryTable(
            versionTable.tableName,
            `skill=${skill.sys_id}^ORDERBYDESCsys_created_on`,
            ['sys_id', 'version', 'sys_created_on', 'active'],
            10
          );
          const versions = versionResponse.result || [];
          if (versions.length > 0) {
            output += `

${'─'.repeat(60)}
VERSION HISTORY (${versions.length})
${'─'.repeat(60)}`;
            for (const v of versions) {
              output += `
  v${v.version || '?'} — ${v.sys_created_on || 'N/A'} ${v.active === 'true' ? '(active)' : ''}`;
            }
          }
        } catch {
          // Version query may fail
        }
      }
    }

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('get skill details', error);
  }
}

export async function handleSkillExecute(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const skillRef = args.skill as string;
  const input = args.input as Record<string, unknown>;
  const modelOverride = args.modelOverride as string | undefined;
  const temperatureOverride = args.temperatureOverride as number | undefined;

  if (!skillRef || !input) {
    return { content: [{ type: 'text', text: 'Error: skill and input are required' }], isError: true };
  }

  try {
    // Try the GenAI Controller execute endpoint
    const payload: Record<string, unknown> = {
      skill_id: skillRef,
      input: input,
    };

    if (modelOverride) payload.model = modelOverride;
    if (temperatureOverride !== undefined) payload.temperature = temperatureOverride;

    const startTime = Date.now();

    // Try multiple execution endpoints
    const endpoints = [
      '/api/now/genai/controller/execute',
      '/api/sn_genai/genai/controller/execute',
      '/api/now/genai/execute',
    ];

    let result: Record<string, unknown> | null = null;
    let usedEndpoint = '';

    for (const endpoint of endpoints) {
      try {
        const response = await client.requestWithRetry<Record<string, unknown>>(
          endpoint,
          {
            method: 'POST',
            body: payload,
            timeout: 60000,
          }
        );
        result = response;
        usedEndpoint = endpoint;
        break;
      } catch {
        continue;
      }
    }

    const elapsed = Date.now() - startTime;

    if (!result) {
      return {
        content: [{
          type: 'text',
          text: `Could not find a GenAI Controller endpoint. Tried: ${endpoints.join(', ')}

This may mean:
- Now Assist GenAI Controller is not installed
- Your user lacks execute permissions
- The skill API uses a different endpoint on this version`,
        }],
        isError: true,
      };
    }

    const connStatus = connectionManager.getStatus();
    let output = `Skill Execution Result — ${connStatus.activeInstance}
${'═'.repeat(60)}

Skill: ${skillRef}
Endpoint: ${usedEndpoint}
Latency: ${elapsed}ms

${'─'.repeat(60)}
RESULT
${'─'.repeat(60)}
${JSON.stringify(result.result || result, null, 2).substring(0, 3000)}`;

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    return formatError('execute skill', error);
  }
}

export async function handleSkillCreate(args: Record<string, unknown>): Promise<ToolResult> {
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;

  const skillName = args.skillName as string;
  const description = args.description as string;
  const promptTemplate = args.promptTemplate as string;
  const inputSchema = args.inputSchema as Record<string, unknown> | undefined;
  const outputSchema = args.outputSchema as Record<string, unknown> | undefined;
  const modelConfig = args.modelConfig as Record<string, unknown> | undefined;
  const dryRun = args.dryRun !== false;

  if (!skillName || !description || !promptTemplate) {
    return {
      content: [{ type: 'text', text: 'Error: skillName, description, and promptTemplate are required' }],
      isError: true,
    };
  }

  try {
    const crypto = await import('crypto');

    // Pre-generate sys_ids for all 8 tables
    const ids = {
      capability: crypto.randomBytes(16).toString('hex'),
      skillConfig: crypto.randomBytes(16).toString('hex'),
      genaiConfig: crypto.randomBytes(16).toString('hex'),
      definition: crypto.randomBytes(16).toString('hex'),
      definitionConfig: crypto.randomBytes(16).toString('hex'),
    };

    // Build the plan
    const records = [
      { table: 'sys_one_extend_capability', id: ids.capability, desc: 'Capability registration' },
      { table: 'sn_nowassist_skill_config', id: ids.skillConfig, desc: 'Skill configuration' },
      { table: 'sys_generative_ai_config', id: ids.genaiConfig, desc: 'LLM prompt/model settings' },
      { table: 'sys_one_extend_capability_definition', id: ids.definition, desc: 'Capability definition (API interface)' },
      { table: 'sys_one_extend_definition_config', id: ids.definitionConfig, desc: 'Definition config (default=true)' },
    ];

    // Add attribute records for inputs/outputs
    const attributes: Array<{ name: string; type: string; value: string }> = [];
    if (inputSchema) {
      const props = (inputSchema as Record<string, unknown>).properties as Record<string, unknown> | undefined;
      if (props) {
        for (const [name, spec] of Object.entries(props)) {
          attributes.push({ name, type: 'input', value: JSON.stringify(spec) });
        }
      }
    }
    if (outputSchema) {
      const props = (outputSchema as Record<string, unknown>).properties as Record<string, unknown> | undefined;
      if (props) {
        for (const [name, spec] of Object.entries(props)) {
          attributes.push({ name, type: 'output', value: JSON.stringify(spec) });
        }
      }
    }

    if (dryRun) {
      const connStatus = connectionManager.getStatus();
      let output = `Now Assist Skill Creation Plan — DRY RUN
${'═'.repeat(60)}
Instance: ${connStatus.activeInstance}

This is a preview. Set dryRun=false to create these records.

Skill: ${skillName}
Description: ${description.substring(0, 200)}
Prompt: ${promptTemplate.substring(0, 200)}...

${'─'.repeat(60)}
RECORDS TO CREATE (8-table pattern)
${'─'.repeat(60)}`;

      for (let i = 0; i < records.length; i++) {
        output += `
  ${i + 1}. ${records[i].table}
     sys_id: ${records[i].id}
     Purpose: ${records[i].desc}`;
      }

      if (attributes.length > 0) {
        output += `
  ${records.length + 1}. sys_one_extend_definition_attribute (${attributes.length} records)`;
        for (const attr of attributes) {
          output += `
     - ${attr.name} (${attr.type})`;
        }
      }

      output += `

Total API calls: ${records.length + attributes.length}`;

      return { content: [{ type: 'text', text: output }] };
    }

    // Actually create records in the 8-table order
    const results: string[] = [];

    // 1. sys_one_extend_capability
    const capTable = await discoverTable(client, CAPABILITY_TABLES, ['sys_id', 'name']);
    if (capTable) {
      await client.createRecord(capTable.tableName, {
        sys_id: ids.capability,
        name: skillName,
        description: description,
        type: 'skill',
        active: true,
      });
      results.push(`[OK] Capability: ${ids.capability}`);
    } else {
      results.push(`[SKIP] sys_one_extend_capability — table not found`);
    }

    // 2. sn_nowassist_skill_config
    const skillConfigTable = await discoverTable(client, NOWASSIST_SKILL_CONFIG_TABLES, ['sys_id', 'name']);
    if (skillConfigTable) {
      await client.createRecord(skillConfigTable.tableName, {
        sys_id: ids.skillConfig,
        name: skillName,
        description: description,
        active: true,
        skill_type: 'agentic',
        capability: ids.capability,
      });
      results.push(`[OK] Skill Config: ${ids.skillConfig}`);
    } else {
      results.push(`[SKIP] sn_nowassist_skill_config — table not found`);
    }

    // 3. sys_generative_ai_config
    const genaiTable = await discoverTable(client, GENERATIVE_AI_CONFIG_TABLES, ['sys_id', 'name']);
    if (genaiTable) {
      const genaiPayload: Record<string, unknown> = {
        sys_id: ids.genaiConfig,
        name: `${skillName} Config`,
        active: true,
        prompt: promptTemplate,
      };
      if (modelConfig) {
        if (modelConfig.model) genaiPayload.model = modelConfig.model;
      }
      await client.createRecord(genaiTable.tableName, genaiPayload);
      results.push(`[OK] GenAI Config: ${ids.genaiConfig}`);
    } else {
      results.push(`[SKIP] sys_generative_ai_config — table not found`);
    }

    // 4. sys_one_extend_capability_definition
    const defTable = await discoverTable(client, CAPABILITY_DEFINITION_TABLES, ['sys_id', 'capability']);
    if (defTable) {
      await client.createRecord(defTable.tableName, {
        sys_id: ids.definition,
        capability: ids.capability,
        api: skillName.toLowerCase().replace(/\s+/g, '_'),
        api_type: 'skill',
        active: true,
      });
      results.push(`[OK] Capability Definition: ${ids.definition}`);
    } else {
      results.push(`[SKIP] sys_one_extend_capability_definition — table not found`);
    }

    // 5. sys_one_extend_definition_config
    const defConfigTable = await discoverTable(client, DEFINITION_CONFIG_TABLES, ['sys_id', 'definition']);
    if (defConfigTable) {
      await client.createRecord(defConfigTable.tableName, {
        sys_id: ids.definitionConfig,
        definition: ids.definition,
        default: true,
        active: true,
      });
      results.push(`[OK] Definition Config: ${ids.definitionConfig}`);
    } else {
      results.push(`[SKIP] sys_one_extend_definition_config — table not found`);
    }

    // 6. sys_one_extend_definition_attribute (input/output params)
    const attrTable = await discoverTable(client, DEFINITION_ATTRIBUTE_TABLES, ['sys_id', 'definition']);
    if (attrTable && attributes.length > 0) {
      for (const attr of attributes) {
        await client.createRecord(attrTable.tableName, {
          definition: ids.definition,
          name: attr.name,
          type: attr.type === 'input' ? 'string' : 'string',
          value: attr.value,
        });
      }
      results.push(`[OK] Attributes: ${attributes.length} records`);
    }

    const connStatus = connectionManager.getStatus();
    return {
      content: [{
        type: 'text',
        text: `Now Assist Skill Created — ${connStatus.activeInstance}
${'═'.repeat(60)}

${results.join('\n')}

${'─'.repeat(60)}
SUMMARY
${'─'.repeat(60)}
Skill: ${skillName}
Capability ID: ${ids.capability}
Skill Config ID: ${ids.skillConfig}
GenAI Config ID: ${ids.genaiConfig}

Next steps:
1. Inspect: servicenow_skill_get with skill="${ids.skillConfig}"
2. Test: servicenow_skill_execute with skill="${skillName}"
3. Navigate to Now Assist Admin → Skills in ServiceNow to verify`,
      }],
    };
  } catch (error) {
    return formatError('create skill', error);
  }
}

// ════════════════════════════════════════════════════════════════
// Router
// ════════════════════════════════════════════════════════════════

export async function handleSkillTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult | null> {
  switch (name) {
    case 'servicenow_skill_list': return handleSkillList(args);
    case 'servicenow_skill_get': return handleSkillGet(args);
    case 'servicenow_skill_execute': return handleSkillExecute(args);
    case 'servicenow_skill_create': return handleSkillCreate(args);
    default: return null;
  }
}

export function isSkillTool(name: string): boolean {
  return SKILL_TOOLS.some(tool => tool.name === name);
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
