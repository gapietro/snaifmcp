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
  discoverEndpoint,
  GENAI_SKILL_TABLES,
  GENAI_PROMPT_TABLES,
  GENAI_SKILL_VERSION_TABLES,
  CAPABILITY_TABLES,
  NOWASSIST_SKILL_CONFIG_TABLES,
  GENERATIVE_AI_CONFIG_TABLES,
  CAPABILITY_DEFINITION_TABLES,
  DEFINITION_CONFIG_TABLES,
  DEFINITION_ATTRIBUTE_TABLES,
  GENAI_EXECUTE_ENDPOINTS,
  SKILL_FAMILY_TABLES,
  SKILL_CATEGORY_TABLES,
  SKILL_STATUS_TABLES,
  PROMPT_LINK_TABLES,
  RESOURCE_MAPPING_TABLES,
  DIAGRAM_BUILDER_INSTANCE_TABLES,
  DIAGRAM_BUILDER_CONFIG_TABLES,
  EVAL_STRATEGY_TABLES,
  EVAL_ATTRIBUTE_TABLES,
  ACCESS_ROLE_CONFIG_TABLES,
  TRUNCATE_STRATEGY_TABLES,
} from './table-discovery.js';
import { ensureScriptApi, executeViaScriptApi } from './script-api.js';
import type { ToolResult } from './tools.js';
import crypto from 'crypto';

/** Role hint included in error messages when Now Assist skill table access fails. */
export const SKILL_ROLE_HINT = 'Ensure your user has the `now_assist_admin` role for Now Assist skill table access.';

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
  description: `Create a Now Assist Skills Kit skill via the full 12-phase API pattern (~24 API calls).

Creates all required records: Capability, Definition, Prompt, Attributes, Skill Config,
Resource Mapping, Diagram, Eval Strategy, Access Role, and Gen AI Registration
(feature_mapping + strategy_mapping via GlideUpdateManager2 to bypass ACLs).

Instance-specific sys_ids (role, skill_family, llm_flow, etc.) are auto-resolved by
querying the instance. Override any of them explicitly if auto-resolution picks the wrong record.

Defaults to dry-run mode. Set dryRun=false to actually create.

Requires an active connection (use servicenow_connect first).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      skillName: { type: 'string', description: 'Skill display name' },
      description: { type: 'string', description: 'What this skill does' },
      promptTemplate: {
        type: 'string',
        description: 'System prompt template. Use {{variableName}} for input placeholders.',
      },
      inputs: {
        type: 'array',
        description: 'Input attribute definitions',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Variable name (used in prompt as {{name}})' },
            label: { type: 'string', description: 'Display label (defaults to name)' },
            description: { type: 'string', description: 'Description of this input' },
            defaultValue: { type: 'string', description: 'Default value (optional)' },
          },
          required: ['name', 'description'],
        },
      },
      outputs: {
        type: 'array',
        description: 'Additional output attributes beyond the standard 5 (response, provider, error, errorcode, status)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['name', 'description'],
        },
      },
      model: {
        type: 'string',
        description: 'LLM model identifier (default: "llm_generic_small")',
      },
      temperature: {
        type: 'string',
        description: 'LLM temperature (default: "0.2")',
      },
      maxTokens: {
        type: 'string',
        description: 'Max response tokens (default: "500")',
      },
      roleSysId: {
        type: 'string',
        description: 'sys_id of the role for access control (auto-resolved: itil role)',
      },
      skillFamilySysId: {
        type: 'string',
        description: 'sys_id of the skill family (auto-resolved: "Other" family)',
      },
      llmFlowSysId: {
        type: 'string',
        description: 'sys_id of the LLM provider flow (auto-resolved: Now LLM Generic flow)',
      },
      categorySysId: {
        type: 'string',
        description: 'sys_id of the skill category (auto-resolved: "Other" category)',
      },
      truncateStrategySysId: {
        type: 'string',
        description: 'sys_id of the truncation strategy (auto-resolved: first available)',
      },
      diagramBuilderConfigSysId: {
        type: 'string',
        description: 'sys_id of the Skills Kit diagram builder config (auto-resolved)',
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

This may mean Now Assist is not installed on this instance.
${SKILL_ROLE_HINT}`,
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
        content: [{ type: 'text', text: `Could not find Now Assist skill table.\n\n${SKILL_ROLE_HINT}` }],
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

/**
 * Build a GlideScript that executes a Now Assist skill via FlowAPI.
 * This is the Zurich+ compatible fallback when REST endpoints are not available.
 * Uses sn_fd.FlowAPI.getRunner().action('sn_generative_ai.generate_content').
 */
export function buildFlowApiScript(
  skillRef: string,
  input: Record<string, unknown>,
  modelOverride?: string,
  temperatureOverride?: number
): string {
  const inputJson = JSON.stringify(input);
  const safeSkillRef = skillRef.replace(/'/g, "\\'");

  const inputParts: string[] = [
    `  skill_id: '${safeSkillRef}'`,
    `  input: ${inputJson}`,
  ];
  if (modelOverride) {
    inputParts.push(`  model: '${modelOverride.replace(/'/g, "\\'")}'`);
  }
  if (temperatureOverride !== undefined) {
    inputParts.push(`  temperature: ${temperatureOverride}`);
  }

  return `
// FlowAPI-based skill execution (Zurich+ compatible)
var inputs = {
${inputParts.join(',\n')}
};
try {
  var runner = sn_fd.FlowAPI.getRunner().action('sn_generative_ai.generate_content');
  var result = runner.inForeground().withInputs(inputs).run();
  var outputs = result.getOutputs();
  gs.info(JSON.stringify({
    success: true, method: 'FlowAPI',
    action: 'sn_generative_ai.generate_content',
    response: outputs.response || outputs,
    skill: '${safeSkillRef}'
  }));
} catch(e1) {
  try {
    var runner2 = sn_fd.FlowAPI.getRunner().action('sn_generative_ai.generic_prompt');
    var result2 = runner2.inForeground().withInputs(inputs).run();
    var outputs2 = result2.getOutputs();
    gs.info(JSON.stringify({
      success: true, method: 'FlowAPI',
      action: 'sn_generative_ai.generic_prompt',
      response: outputs2.response || outputs2,
      skill: '${safeSkillRef}'
    }));
  } catch(e2) {
    gs.info(JSON.stringify({
      success: false, method: 'FlowAPI',
      error: e1.message || String(e1),
      fallback_error: e2.message || String(e2),
      skill: '${safeSkillRef}'
    }));
  }
}`.trim();
}

/**
 * Build the GlideUpdateManager2 provisioning script for Phase 8 of skill creation.
 * Bypasses ACLs to create feature_mapping, strategy_mapping, set model/tokens,
 * set internal_name, and activate skill_config + skill_config_status.
 */
export function buildSkillProvisionScript(params: {
  capId: string;
  promptId: string;
  skId: string;
  skillName: string;
  model: string;
  internalName: string;
  fmSysId: string;
  smSysId: string;
}): string {
  const { capId, promptId, skId, skillName, model, internalName, fmSysId, smSysId } = params;
  const requestTokens = '32018';
  const safeName = skillName.replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeModel = model.replace(/'/g, "\\'");
  const safeInternalName = internalName.replace(/'/g, "\\'");

  return `var capId = '${capId}';
var promptId = '${promptId}';
var skId = '${skId}';
var skillName = '${safeName}';
var model = '${safeModel}';
var requestTokens = '${requestTokens}';
var fmSysId = '${fmSysId}';
var smSysId = '${smSysId}';
var internalName = '${safeInternalName}';

// 1. Create feature_mapping via UpdateManager (bypasses ACLs)
var fmCheck = new GlideRecord('sys_gen_ai_feature_mapping');
fmCheck.addQuery('document', capId);
fmCheck.query();
var fmId;
if (fmCheck.hasNext()) {
    fmCheck.next();
    fmId = fmCheck.getUniqueValue() + '';
    gs.info('FM_EXISTS=' + fmId);
} else {
    var fmParts = [];
    fmParts.push('<record_update table="sys_gen_ai_feature_mapping">');
    fmParts.push('<sys_gen_ai_feature_mapping action="INSERT_OR_UPDATE">');
    fmParts.push('<active>true</active>');
    fmParts.push('<customer_updatable>true</customer_updatable>');
    fmParts.push('<document display_value="' + skillName + '">' + capId + '</document>');
    fmParts.push('<document_table>sys_one_extend_capability</document_table>');
    fmParts.push('<feature_name>' + skillName + '</feature_name>');
    fmParts.push('<licensable>true</licensable>');
    fmParts.push('<skip_on_group_call>false</skip_on_group_call>');
    fmParts.push('<default_tier>false</default_tier>');
    fmParts.push('<sys_id>' + fmSysId + '</sys_id>');
    fmParts.push('</sys_gen_ai_feature_mapping>');
    fmParts.push('</record_update>');
    var um1 = new GlideUpdateManager2();
    um1.loadXML(fmParts.join(''));
    var fmV = new GlideRecord('sys_gen_ai_feature_mapping');
    fmV.addQuery('document', capId);
    fmV.query();
    if (fmV.next()) {
        fmId = fmV.getUniqueValue() + '';
        gs.info('FM_CREATED=' + fmId);
    } else {
        gs.info('FM_FAILED');
    }
}

// 2. Create strategy_mapping via UpdateManager
if (fmId) {
    var smCheck = new GlideRecord('sys_gen_ai_strategy_mapping');
    smCheck.addQuery('feature', fmId);
    smCheck.query();
    if (smCheck.hasNext()) {
        gs.info('SM_EXISTS');
    } else {
        var src = new GlideRecord('sys_gen_ai_strategy_mapping');
        src.orderBy('sys_created_on');
        src.setLimit(1);
        src.query();
        if (src.next()) {
            var strategyVal = src.getValue('strategy');
            var orderVal = src.getValue('order') || '100';
            var smParts = [];
            smParts.push('<record_update table="sys_gen_ai_strategy_mapping">');
            smParts.push('<sys_gen_ai_strategy_mapping action="INSERT_OR_UPDATE">');
            smParts.push('<feature>' + fmId + '</feature>');
            smParts.push('<strategy>' + strategyVal + '</strategy>');
            smParts.push('<active>true</active>');
            smParts.push('<order>' + orderVal + '</order>');
            smParts.push('<sys_id>' + smSysId + '</sys_id>');
            smParts.push('</sys_gen_ai_strategy_mapping>');
            smParts.push('</record_update>');
            var um2 = new GlideUpdateManager2();
            um2.loadXML(smParts.join(''));
            var smV = new GlideRecord('sys_gen_ai_strategy_mapping');
            smV.addQuery('feature', fmId);
            smV.query();
            if (smV.next()) {
                gs.info('SM_CREATED=' + smV.getUniqueValue());
            } else {
                gs.info('SM_FAILED');
            }
        }
    }
} else {
    gs.info('SM_SKIPPED_NO_FM');
}

// 3. Set model and request_tokens via UpdateManager
var modelParts = [];
modelParts.push('<record_update table="sys_generative_ai_config">');
modelParts.push('<sys_generative_ai_config action="INSERT_OR_UPDATE">');
modelParts.push('<model>' + model + '</model>');
modelParts.push('<request_tokens>' + requestTokens + '</request_tokens>');
modelParts.push('<sys_id>' + promptId + '</sys_id>');
modelParts.push('</sys_generative_ai_config>');
modelParts.push('</record_update>');
var um3 = new GlideUpdateManager2();
um3.loadXML(modelParts.join(''));
var pv = new GlideRecord('sys_generative_ai_config');
pv.get(promptId);
gs.info('MODEL=' + pv.getValue('model'));
gs.info('TOKENS=' + pv.getValue('request_tokens'));

// 4. Set internal_name + active + in_product_active on skill_config
var skParts = [];
skParts.push('<record_update table="sn_nowassist_skill_config">');
skParts.push('<sn_nowassist_skill_config action="INSERT_OR_UPDATE">');
skParts.push('<internal_name>' + internalName + '</internal_name>');
skParts.push('<active>true</active>');
skParts.push('<in_product_active>true</in_product_active>');
skParts.push('<sys_id>' + skId + '</sys_id>');
skParts.push('</sn_nowassist_skill_config>');
skParts.push('</record_update>');
var um4 = new GlideUpdateManager2();
um4.loadXML(skParts.join(''));
var skV = new GlideRecord('sn_nowassist_skill_config');
skV.get(skId);
gs.info('INTERNAL_NAME=' + skV.getValue('internal_name'));
gs.info('SK_ACTIVE=' + skV.getValue('active'));
gs.info('SK_IN_PRODUCT_ACTIVE=' + skV.getValue('in_product_active'));

// 5. Activate skill_config_status
var statusGr = new GlideRecord('sn_nowassist_skill_config_status');
statusGr.addQuery('skill_config', skId);
statusGr.query();
if (statusGr.next()) {
    var stParts = [];
    stParts.push('<record_update table="sn_nowassist_skill_config_status">');
    stParts.push('<sn_nowassist_skill_config_status action="INSERT_OR_UPDATE">');
    stParts.push('<active>true</active>');
    stParts.push('<in_product_active>true</in_product_active>');
    stParts.push('<sys_id>' + statusGr.getUniqueValue() + '</sys_id>');
    stParts.push('</sn_nowassist_skill_config_status>');
    stParts.push('</record_update>');
    var um5 = new GlideUpdateManager2();
    um5.loadXML(stParts.join(''));
    gs.info('STATUS_ACTIVATED');
} else {
    gs.info('STATUS_NOT_FOUND');
}`;
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
    // Build the payload for REST endpoint attempts
    const payload: Record<string, unknown> = {
      skill_id: skillRef,
      input: input,
    };

    if (modelOverride) payload.model = modelOverride;
    if (temperatureOverride !== undefined) payload.temperature = temperatureOverride;

    const startTime = Date.now();

    // -- Strategy 1: REST Endpoint Discovery --
    // Probes 7 candidate endpoints covering Vancouver through Zurich+.
    const discoveredEndpoint = await discoverEndpoint(client, GENAI_EXECUTE_ENDPOINTS, payload);

    if (discoveredEndpoint) {
      // Endpoint found -- execute with full timeout
      const response = await client.requestWithRetry<Record<string, unknown>>(
        discoveredEndpoint,
        {
          method: 'POST',
          body: payload,
          timeout: 60000,
        }
      );

      const elapsed = Date.now() - startTime;
      const connStatus = connectionManager.getStatus();
      const output = `Skill Execution Result — ${connStatus.activeInstance}
${'═'.repeat(60)}

Skill: ${skillRef}
Method: REST
Endpoint: ${discoveredEndpoint}
Latency: ${elapsed}ms

${'─'.repeat(60)}
RESULT
${'─'.repeat(60)}
${JSON.stringify(response.result || response, null, 2).substring(0, 3000)}`;

      return { content: [{ type: 'text', text: output }] };
    }

    // -- Strategy 2: FlowAPI via Background Script --
    // On Zurich+ the GenAI Controller may not expose a REST endpoint.
    // Fall back to executing via sn_fd.FlowAPI through the Script Runner.
    const scriptApi = await ensureScriptApi(client);

    if (scriptApi) {
      const flowScript = buildFlowApiScript(skillRef, input, modelOverride, temperatureOverride);
      const scriptResult = await executeViaScriptApi(client, flowScript, 90);

      const elapsed = Date.now() - startTime;
      const connStatus = connectionManager.getStatus();

      if (scriptResult.success && scriptResult.output.length > 0) {
        // Try to parse the JSON output from gs.info
        let parsedOutput: unknown;
        try {
          parsedOutput = JSON.parse(scriptResult.output[scriptResult.output.length - 1]);
        } catch {
          parsedOutput = scriptResult.output.join('\n');
        }

        const output = `Skill Execution Result — ${connStatus.activeInstance}
${'═'.repeat(60)}

Skill: ${skillRef}
Method: FlowAPI (Background Script)
Latency: ${elapsed}ms

${'─'.repeat(60)}
RESULT
${'─'.repeat(60)}
${JSON.stringify(parsedOutput, null, 2).substring(0, 3000)}`;

        return { content: [{ type: 'text', text: output }] };
      }

      // FlowAPI script ran but failed
      return {
        content: [{
          type: 'text',
          text: `Skill execution via FlowAPI failed.

Script error: ${scriptResult.error || '(no error message)'}
Script output: ${scriptResult.output.join('\n') || '(no output)'}

The FlowAPI fallback was attempted because no REST endpoint responded.
REST endpoints tried: ${GENAI_EXECUTE_ENDPOINTS.join(', ')}

${SKILL_ROLE_HINT}`,
        }],
        isError: true,
      };
    }

    // -- Both strategies failed --
    const elapsed = Date.now() - startTime;
    return {
      content: [{
        type: 'text',
        text: `Could not execute skill. Both strategies failed (${elapsed}ms total).

Strategy 1 — REST Endpoint Discovery:
  Tried ${GENAI_EXECUTE_ENDPOINTS.length} endpoints: ${GENAI_EXECUTE_ENDPOINTS.join(', ')}
  All returned 404 (not found).

Strategy 2 — FlowAPI via Background Script:
  Could not deploy or access the Foundry Script Runner API.

Troubleshooting:
- Verify Now Assist / GenAI Controller is installed and activated
- Ensure your user has the now_assist_admin role
- Check sys_properties for 'sn_generative_ai' or 'com.snc.genai_controller'
- On Zurich+, the GenAI Controller may require the sn_generative_ai plugin

${SKILL_ROLE_HINT}`,
      }],
      isError: true,
    };
  } catch (error) {
    return formatError('execute skill', error);
  }
}

export async function handleSkillCreate(args: Record<string, unknown>): Promise<ToolResult> {
  const skillName = args.skillName as string;
  const description = args.description as string;
  const promptTemplate = args.promptTemplate as string;
  const inputs = (args.inputs as Array<Record<string, string>>) || [];
  const outputs = (args.outputs as Array<Record<string, string>>) || [];
  const model = (args.model as string) || 'llm_generic_small';
  const temperature = (args.temperature as string) || '0.2';
  const maxTokens = (args.maxTokens as string) || '500';
  const dryRun = args.dryRun !== false;

  const overrides = {
    roleSysId: args.roleSysId as string | undefined,
    skillFamilySysId: args.skillFamilySysId as string | undefined,
    llmFlowSysId: args.llmFlowSysId as string | undefined,
    categorySysId: args.categorySysId as string | undefined,
    truncateStrategySysId: args.truncateStrategySysId as string | undefined,
    diagramBuilderConfigSysId: args.diagramBuilderConfigSysId as string | undefined,
  };

  if (!skillName || !description || !promptTemplate) {
    return {
      content: [{ type: 'text', text: 'Error: skillName, description, and promptTemplate are required' }],
      isError: true,
    };
  }

  const standardOutputs = [
    { name: 'response', label: 'response', description: 'Response Text' },
    { name: 'provider', label: 'provider', description: 'Provider name' },
    { name: 'error', label: 'error', description: 'Error Message' },
    { name: 'errorcode', label: 'errorCode', description: 'Error Code' },
    { name: 'status', label: 'status', description: 'Status' },
  ];

  const preflightLines: string[] = [];
  preflightLines.push('PRE-FLIGHT: sys_id Resolution');
  preflightLines.push('─'.repeat(60));
  const resolvedNote = (key: string, value: string | undefined, desc: string) => {
    if (value) {
      preflightLines.push(`  ${key}: (override) ${value}`);
    } else {
      preflightLines.push(`  ${key}: (auto-resolve on create) — ${desc}`);
    }
  };
  resolvedNote('role', overrides.roleSysId, 'query sys_user_role WHERE name=itil');
  resolvedNote('skill_family', overrides.skillFamilySysId, 'query sn_nowassist_skill_family WHERE name=Other');
  resolvedNote('llm_flow', overrides.llmFlowSysId, 'query sys_hub_flow WHERE name LIKE LLM Generic');
  resolvedNote('category', overrides.categorySysId, 'query skill category WHERE name=Other');
  resolvedNote('truncate_strategy', overrides.truncateStrategySysId, 'first record in truncate strategy table');
  resolvedNote('diagram_config', overrides.diagramBuilderConfigSysId, 'query sn_diagram_builder_config WHERE name LIKE Skills Kit');

  const totalInputAttrs = inputs.length;
  const totalOutputAttrs = standardOutputs.length + outputs.length;
  const totalAttrs = totalInputAttrs + totalOutputAttrs;

  if (dryRun) {
    const connStatus = connectionManager.getStatus();
    const output = `Now Assist Skill Creation Plan — DRY RUN
${'═'.repeat(60)}
Instance: ${connStatus.activeInstance || '(not connected — will resolve on create)'}

${preflightLines.join('\n')}

${'─'.repeat(60)}
PHASES
${'─'.repeat(60)}
  Phase 1: Core Capability
    Step 1: sys_one_extend_capability (name="${skillName}", type=skill, external=true)
    Step 2: sys_one_extend_capability_definition (api=llmFlowSysId, preprocessor/postprocessor)
    Step 2b: sys_one_extend_definition_config (auto-created or explicit)

  Phase 2: Prompt Configuration
    Step 3: sys_generative_ai_config (prompt, model="${model}", temp="${temperature}", max_tokens="${maxTokens}")
    Step 4: sys_generative_ai_prompt_config (prompt→definition link, is_default=true)

  Phase 3: Input/Output Variables (${totalAttrs} total)
    Inputs (${totalInputAttrs}): ${inputs.map(i => i.name).join(', ') || '(none)'}
    Standard outputs (${standardOutputs.length}): response, provider, error, errorcode, status
    Custom outputs (${outputs.length}): ${outputs.map(o => o.name).join(', ') || '(none)'}

  Phase 4: Skills Kit Registration
    Step 6: sn_nowassist_skill_config (active=false until Phase 8)
    Step 7: sn_nowassist_skill_config_status (active=false until Phase 8)

  Phase 5: Flow & Diagram
    Step 8: sys_one_extend_resource_mapping (applicability_script, error_handler_script)
    Step 9: sn_diagram_builder_instance (diagram_json with start→skill→end nodes)

  Phase 6: Evaluation & Access
    Step 10: sys_one_extend_eval_strategy (name=Default, default=true)
    Step 11: sys_one_extend_eval_attribute (links to response attribute)
    Step 12: sys_agent_access_role_configuration (limit_to_roles=roleSysId)

  Phase 7: Cross-Reference Patches
    Patch 1: sys_one_extend_resource_mapping.metadata ← diagramInstanceId
    Patch 2: sn_diagram_builder_instance.diagram_json ← correct diagramInstanceId
    Patch 3: sys_generative_ai_config.additional_configurations ← skill_config_id

  Phase 8: Gen AI Registration (GlideUpdateManager2 via Script Runner)
    → sys_gen_ai_feature_mapping (bypasses ACL)
    → sys_gen_ai_strategy_mapping (copies first existing strategy)
    → sys_generative_ai_config model/request_tokens (bypasses ACL)
    → sn_nowassist_skill_config internal_name + activation (ACL-protected)
    → sn_nowassist_skill_config_status activation (ACL-protected)

${'─'.repeat(60)}
SUMMARY
${'─'.repeat(60)}
Skill: ${skillName}
Total API calls: ~${12 + totalAttrs + 3} writes + 3 patches + 1 script + verification
Set dryRun=false to create.`;

    return { content: [{ type: 'text', text: output }] };
  }

  // ── Live creation ──────────────────────────────────────────────
  const conn = requireConnection();
  if (isConnectionError(conn)) return conn;
  const { client } = conn;
  const connStatus = connectionManager.getStatus();

  const results: string[] = [];

  try {
    // ── Pre-flight: resolve sys_ids ────────────────────────────
    const resolvedIds: Record<string, string> = {};

    if (overrides.roleSysId) {
      resolvedIds.role = overrides.roleSysId;
    } else {
      const roleResp = await client.queryTable('sys_user_role', 'name=itil', ['sys_id', 'name'], 1);
      resolvedIds.role = roleResp.result?.[0]?.sys_id as string || '';
      if (!resolvedIds.role) results.push('[WARN] Could not resolve itil role sys_id');
    }

    if (overrides.skillFamilySysId) {
      resolvedIds.skillFamily = overrides.skillFamilySysId;
    } else {
      const familyTable = await discoverTable(client, SKILL_FAMILY_TABLES, ['sys_id', 'name']);
      if (familyTable) {
        const familyResp = await client.queryTable(familyTable.tableName, 'nameLIKEOther', ['sys_id', 'name'], 1);
        resolvedIds.skillFamily = familyResp.result?.[0]?.sys_id as string || '';
      }
      if (!resolvedIds.skillFamily) results.push('[WARN] Could not resolve skill family sys_id');
    }

    if (overrides.llmFlowSysId) {
      resolvedIds.llmFlow = overrides.llmFlowSysId;
    } else {
      const flowResp = await client.queryTable('sys_hub_flow', 'nameLIKELLM Generic^ORnameLIKENow LLM', ['sys_id', 'name'], 1);
      resolvedIds.llmFlow = flowResp.result?.[0]?.sys_id as string || '';
      if (!resolvedIds.llmFlow) {
        const flowResp2 = await client.queryTable('sys_hub_flow', 'nameLIKELLM^active=true', ['sys_id', 'name'], 1);
        resolvedIds.llmFlow = flowResp2.result?.[0]?.sys_id as string || '';
      }
      if (!resolvedIds.llmFlow) {
        return { content: [{ type: 'text', text: 'Could not resolve LLM provider flow. Provide llmFlowSysId explicitly. Run: servicenow_query table=sys_hub_flow query=nameLIKELLM' }], isError: true };
      }
    }

    if (overrides.categorySysId) {
      resolvedIds.category = overrides.categorySysId;
    } else {
      const catTable = await discoverTable(client, SKILL_CATEGORY_TABLES, ['sys_id', 'name']);
      if (catTable) {
        const catResp = await client.queryTable(catTable.tableName, 'nameLIKEOther', ['sys_id', 'name'], 1);
        resolvedIds.category = catResp.result?.[0]?.sys_id as string || '';
      }
      if (!resolvedIds.category) results.push('[WARN] Could not resolve category sys_id, proceeding without it');
    }

    if (overrides.truncateStrategySysId) {
      resolvedIds.truncateStrategy = overrides.truncateStrategySysId;
    } else {
      const truncTable = await discoverTable(client, TRUNCATE_STRATEGY_TABLES, ['sys_id', 'name']);
      if (truncTable) {
        const truncResp = await client.queryTable(truncTable.tableName, '', ['sys_id', 'name'], 1);
        resolvedIds.truncateStrategy = truncResp.result?.[0]?.sys_id as string || '';
      }
      if (!resolvedIds.truncateStrategy) results.push('[WARN] Could not resolve truncate strategy sys_id');
    }

    if (overrides.diagramBuilderConfigSysId) {
      resolvedIds.diagramConfig = overrides.diagramBuilderConfigSysId;
    } else {
      const diagConfigTable = await discoverTable(client, DIAGRAM_BUILDER_CONFIG_TABLES, ['sys_id', 'name']);
      if (diagConfigTable) {
        const diagConfigResp = await client.queryTable(diagConfigTable.tableName, 'nameLIKESkills Kit^ORnameLIKEskill', ['sys_id', 'name'], 1);
        resolvedIds.diagramConfig = diagConfigResp.result?.[0]?.sys_id as string || '';
        if (!resolvedIds.diagramConfig) {
          const diagConfigResp2 = await client.queryTable(diagConfigTable.tableName, '', ['sys_id', 'name'], 1);
          resolvedIds.diagramConfig = diagConfigResp2.result?.[0]?.sys_id as string || '';
        }
      }
      if (!resolvedIds.diagramConfig) results.push('[WARN] Could not resolve diagram builder config sys_id');
    }

    // ── Phase 1: Core Capability ───────────────────────────────
    const capResult = await client.createRecord('sys_one_extend_capability', {
      name: skillName,
      description: description,
      type: 'skill',
      external: 'true',
      active: 'true',
      metadata: '{"isGuidedStep":false}',
    });
    const capId = ((capResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Phase 1 Step 1 — Capability: ${capId}`);

    const defResult = await client.createRecord('sys_one_extend_capability_definition', {
      name: `${skillName} (Now LLM Service - Now LLM Generic)`,
      api: resolvedIds.llmFlow,
      api_type: 'sys_hub_flow',
      capability: capId,
      ...(resolvedIds.category ? { category: resolvedIds.category } : {}),
      filter_properties: '{"provider":"Now LLM GenericNow LLM Generic"}',
      advanced: 'false',
      order: '0',
      ...(resolvedIds.truncateStrategy ? { truncate_strategy: resolvedIds.truncateStrategy } : {}),
      preprocessor: '(function(inputs) {\n    inputs = JSON.parse(inputs);\n    return inputs;\n})(inputs);',
      postprocessor: '(function(outputs) {\n    outputs = JSON.parse(outputs);\n    return outputs;\n})(outputs);',
    });
    const defId = ((defResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Phase 1 Step 2 — Definition: ${defId}`);

    let defConfigId: string;
    const existingDefConfig = await client.queryTable('sys_one_extend_definition_config', `capability=${capId}`, ['sys_id'], 1);
    if (existingDefConfig.result?.[0]) {
      defConfigId = existingDefConfig.result[0].sys_id as string;
      results.push(`[OK] Phase 1 Step 2b — Definition Config (auto-created): ${defConfigId}`);
    } else {
      const defConfigResult = await client.createRecord('sys_one_extend_definition_config', {
        capability: capId,
        definition: defId,
        active: 'true',
      });
      defConfigId = ((defConfigResult.result as Record<string, unknown>).sys_id as string);
      results.push(`[OK] Phase 1 Step 2b — Definition Config (created): ${defConfigId}`);
    }

    // ── Phase 2: Prompt Configuration ──────────────────────────
    const promptResult = await client.createRecord('sys_generative_ai_config', {
      name: skillName,
      definition: defId,
      definition_table: 'sys_one_extend_capability_definition',
      prompt: promptTemplate,
      prompt_template_role: 'user',
      model: model,
      max_tokens: maxTokens,
      request_tokens: '32018',
      temperature: temperature,
      thinking_tokens: '0',
      min_word_count: '-1',
      state: 'published',
      active: 'true',
      show_in_prompt_library: 'true',
      ai_suggested: 'false',
      version: '1',
      additional_configurations: '{"skill_config_id":"PLACEHOLDER"}',
    });
    const promptId = ((promptResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Phase 2 Step 3 — Prompt: ${promptId}`);

    const promptLinkResult = await client.createRecord('sys_generative_ai_prompt_config', {
      ai_config: promptId,
      definition: defId,
      filter_type: 'default',
      is_default: 'true',
      order: '0',
    });
    const promptLinkId = ((promptLinkResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Phase 2 Step 4 — Prompt Link: ${promptLinkId}`);

    // ── Phase 3: Input/Output Attributes ──────────────────────
    let responseAttrId = '';
    let attrCount = 0;

    for (const inp of inputs) {
      await client.createRecord('sys_one_extend_definition_attribute', {
        name: inp.name, label: inp.label || inp.name,
        description: inp.description, type: 'input',
        capability: capId, data_type: 'string',
        default_value: inp.defaultValue || '',
        active: 'true', advanced: 'false', hidden: 'false',
        mandatory: 'false', order: '100', schema: '{}',
        apply_filter: 'false', contains_large_input: 'false',
        translate: 'false', truncate: 'false', user_query: 'false',
      });
      attrCount++;
    }

    for (const out of [...standardOutputs, ...outputs]) {
      const attrResult = await client.createRecord('sys_one_extend_definition_attribute', {
        name: out.name, label: out.label || out.name,
        description: out.description, type: 'output',
        capability: capId, data_type: 'string',
        default_value: '', active: 'true', advanced: 'false',
        hidden: 'false', mandatory: 'false', order: '100',
        schema: '{}', apply_filter: 'false', contains_large_input: 'false',
        translate: 'false', truncate: 'false', user_query: 'false',
      });
      if (out.name === 'response') {
        responseAttrId = ((attrResult.result as Record<string, unknown>).sys_id as string);
      }
      attrCount++;
    }
    results.push(`[OK] Phase 3 — Attributes: ${attrCount} records (${inputs.length} input + ${standardOutputs.length + outputs.length} output)`);

    // ── Phase 4: Skills Kit Registration ──────────────────────
    const snakeName = skillName.toLowerCase().replace(/\s+/g, '_');

    const skResult = await client.createRecord('sn_nowassist_skill_config', {
      name: skillName, description: description,
      skill_id: capId, skill_table: 'sys_one_extend_capability',
      ...(resolvedIds.skillFamily ? { skill_family: resolvedIds.skillFamily } : {}),
      state: '1', active: 'false', is_template: 'false',
      edited_in_nask: 'false', in_product_active: 'false', order: '100',
    });
    const skId = ((skResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Phase 4 Step 6 — Skill Config: ${skId}`);

    await client.createRecord('sn_nowassist_skill_config_status', {
      skill_config: skId, active: 'false',
      in_product_active: 'false', in_mobile_active: 'false',
    });
    results.push(`[OK] Phase 4 Step 7 — Skill Status`);

    // ── Phase 5: Flow & Diagram ────────────────────────────────
    const rmResult = await client.createRecord('sys_one_extend_resource_mapping', {
      resource_name: skillName,
      parent_capability: capId,
      resource_capability: capId,
      active: 'true',
      applicability_script: '(function(currentInputs, context) {\n    return true;\n})(currentInputs, context);',
      error_handler_script: '(function handleError() {\n    return;\n})();',
      metadata: '',
    });
    const rmId = ((rmResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Phase 5 Step 8 — Resource Mapping: ${rmId}`);

    const nodeIds = Array.from({ length: 4 }, () => crypto.randomBytes(16).toString('hex'));
    const diagramJson = JSON.stringify({
      start: 'start', variables: [], node_arguments: [], edge_arguments: [],
      nodes: [
        { name: skillName, node_id: nodeIds[0], key: rmId,
          resourceMappingId: rmId, resourceMapping: {
            condition: '', resourceName: skillName,
            parentCapability: capId, resourceCapability: capId,
            applicabilityType: '', applicabilityTable: '',
            applicabilityConditionExpression: '', applicabilityFailedPolicy: '',
            errorPolicy: null, errorHandlerScript: null,
            dependsOnList: [], scope: null, mappingId: rmId,
            metadata: { diagramInstanceId: 'PLACEHOLDER' },
            active: true,
            conditionScript: '(function(currentInputs, context) { return true; })(currentInputs, context);',
            outgoingResourceEdges: [], incomingResourceEdges: [],
            resourceType: 'SKILL',
          }},
        { key: 'start', name: 'Start', node_id: nodeIds[1] },
        { key: 'end', name: 'End', node_id: nodeIds[2] },
      ],
      edges: [
        { edge_id: nodeIds[3], from: rmId, to: 'end', add_button_visible: false },
        { edge_id: nodeIds[3], from: 'start', to: rmId },
      ],
    });

    const diagPayload: Record<string, unknown> = {
      name: skillName,
      diagram_json: diagramJson,
      state: 'draft',
      read_only: 'false',
    };
    if (resolvedIds.diagramConfig) diagPayload.builder_configuration = resolvedIds.diagramConfig;

    const diagResult = await client.createRecord('sn_diagram_builder_instance', diagPayload);
    const diagId = ((diagResult.result as Record<string, unknown>).sys_id as string);
    results.push(`[OK] Phase 5 Step 9 — Diagram: ${diagId}`);

    // ── Phase 6: Evaluation & Access ──────────────────────────
    await client.createRecord('sys_one_extend_eval_strategy', {
      name: 'Default', capability: capId,
      default: 'true', skill_config_id: skId,
    });
    results.push(`[OK] Phase 6 Step 10 — Eval Strategy`);

    if (responseAttrId) {
      await client.createRecord('sys_one_extend_eval_attribute', {
        name: 'response', label: 'Golden Response',
        capability: capId, capability_attribute: responseAttrId,
        data_type: 'string', advanced: 'false',
        template_script: '(function getValue(response) {\n   // response would give the response from capability \n})(response);',
      });
      results.push(`[OK] Phase 6 Step 11 — Eval Attribute`);
    }

    if (resolvedIds.role) {
      await client.createRecord('sys_agent_access_role_configuration', {
        name: skillName, agent: skId,
        agent_table: 'sn_nowassist_skill_config',
        action: 'limit_to_roles',
        role_list: resolvedIds.role,
        allow_all_session_roles: 'false',
      });
      results.push(`[OK] Phase 6 Step 12 — Access Role Config`);
    }

    // ── Phase 7: Cross-Reference Patches ──────────────────────
    await client.updateRecord('sys_one_extend_resource_mapping', rmId, {
      metadata: JSON.stringify({ diagramInstanceId: diagId }),
    });
    results.push(`[OK] Phase 7 Patch 1 — Resource Mapping metadata updated`);

    const diagJsonParsed = JSON.parse(diagramJson);
    diagJsonParsed.nodes[0].resourceMapping.metadata.diagramInstanceId = diagId;
    await client.updateRecord('sn_diagram_builder_instance', diagId, {
      diagram_json: JSON.stringify(diagJsonParsed),
    });
    results.push(`[OK] Phase 7 Patch 2 — Diagram JSON updated`);

    await client.updateRecord('sys_generative_ai_config', promptId, {
      additional_configurations: JSON.stringify({ skill_config_id: skId }),
    });
    results.push(`[OK] Phase 7 Patch 3 — Prompt additional_configurations updated`);

    // ── Phase 8: Gen AI Registration ──────────────────────────
    const internalName = `${snakeName}.${skId}`;
    const fmSysId = crypto.randomBytes(16).toString('hex');
    const smSysId = crypto.randomBytes(16).toString('hex');

    const provisionScript = buildSkillProvisionScript({
      capId, promptId, skId, skillName, model, internalName, fmSysId, smSysId,
    });

    let phase8Success = false;
    const scriptApi = await ensureScriptApi(client);
    if (scriptApi) {
      const scriptResult = await executeViaScriptApi(client, provisionScript, 90);
      if (scriptResult.success) {
        const outputLines = scriptResult.output || [];
        const getFmId = outputLines.find(l => l.includes('FM_CREATED=') || l.includes('FM_EXISTS='));
        const modelLine = outputLines.find(l => l.includes('MODEL='));
        const activeLine = outputLines.find(l => l.includes('SK_ACTIVE='));

        if (getFmId && modelLine?.includes(model) && activeLine?.includes('1')) {
          phase8Success = true;
          results.push(`[OK] Phase 8 — Gen AI Registration complete`);
          results.push(`       feature_mapping: ${getFmId.split('=')[1]}`);
          results.push(`       model verified: ${model}`);
          results.push(`       skill activated: true`);
        } else {
          results.push(`[WARN] Phase 8 — Script ran but verification uncertain`);
          results.push(`       Output: ${outputLines.join(' | ').substring(0, 300)}`);
        }
      } else {
        results.push(`[WARN] Phase 8 — Script Runner error: ${scriptResult.error || 'unknown'}`);
      }
    } else {
      results.push(`[WARN] Phase 8 — Script Runner not available`);
    }

    const output = `Now Assist Skill Created — ${connStatus.activeInstance}
${'═'.repeat(60)}

${results.join('\n')}

${'─'.repeat(60)}
SUMMARY
${'─'.repeat(60)}
Skill: ${skillName}
Capability ID: ${capId}
Skill Config ID: ${skId}
Prompt ID: ${promptId}
Phase 8 (Gen AI Registration): ${phase8Success ? '✓ Complete' : '⚠ Incomplete — skill created but may not appear in Now Assist UI until Gen AI records are set manually'}

Next steps:
1. Inspect: servicenow_skill_get with skill="${skId}"
2. Test: servicenow_skill_execute with skill="${skillName}"
3. Navigate to Now Assist Admin → Skills in ServiceNow to verify`;

    return { content: [{ type: 'text', text: output }] };
  } catch (error) {
    if (results.length > 0) {
      const partialOutput = `Skill creation failed after partial completion.\n\nCompleted steps:\n${results.join('\n')}\n\n`;
      const errResult = formatError('create skill', error);
      return {
        content: [{ type: 'text', text: partialOutput + (errResult.content[0] as { text: string }).text }],
        isError: true,
      };
    }
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
      msg += `\n\nThe table may not exist or your user may lack access. ${SKILL_ROLE_HINT}`;
    }
    if (error.type === ServiceNowErrorType.ACL_DENIED) {
      msg += `\n\n${SKILL_ROLE_HINT}`;
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
