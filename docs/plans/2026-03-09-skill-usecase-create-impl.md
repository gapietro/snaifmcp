# Skill Create Rewrite + AIA Use Case Create Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `servicenow_skill_create` to the full 12-phase Python pattern (~24 API calls with GlideUpdateManager2) and add `servicenow_aia_usecase_create` (6-table: Tool → Team → Use Case → Agent → Team Member → M2M).

**Architecture:** Both tools share the existing `ServiceNowClient`, `ensureScriptApi`/`executeViaScriptApi` for Phase 8, and the `discoverTable` pattern. Skill create adds a pre-flight resolver that queries 6 instance-specific sys_ids before any writes. Use case create mirrors the Python `create_agent.py` pattern exactly.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, existing `ServiceNowClient` in `src/servicenow/client.ts`

**Worktree:** `/Users/greg.pietro/projects/snaifmcp/foundry-mcp/.worktrees/feature-77-skill-usecase-create`
**Branch:** `feature/77-skill-usecase-create`
**Test command:** `npm run test:servicenow` (from worktree root — must stay at 0 failures throughout)
**Build command:** `npm run build`

**Design doc:** `docs/plans/2026-03-09-skill-usecase-create-design.md`
**Reference Python:** `/tmp/snagentskillsbuild/create_skill.py`, `/tmp/snagentskillsbuild/create_agent.py`

**Tool count after:** 25 total (8 core + 11 AIA + 4 skill + 2 flow)

---

## Task 1: Add Table Constants to table-discovery.ts

**Files:**
- Modify: `src/servicenow/table-discovery.ts` (append after line ~190, before the endpoint constants)

**Step 1: Add the new constants**

In `src/servicenow/table-discovery.ts`, add after the existing `GENERATIVE_AI_CONFIG_TABLES` constant (around line 189):

```typescript
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
```

**Step 2: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no errors.

**Step 3: Run tests to verify still passing**

```bash
npm run test:servicenow 2>&1 | tail -5
```
Expected: `✓ Passed: 158/158`

**Step 4: Commit**

```bash
git add src/servicenow/table-discovery.ts
git commit -m "feat: add Skills Kit and AIA team/strategy table constants"
```

---

## Task 2: Write Failing Tests

**Files:**
- Modify: `test/validate-servicenow.ts`

Add these test sections to `validate-servicenow.ts`. Find the `→ Total Tool Count` section near the end and insert all new test sections **before** it.

**Step 1: Update imports at top of test file**

Find the existing import block and add:

```typescript
import {
  handleAiaUsecaseCreate,        // new export to be added
} from '../src/servicenow/tools-aia.js';
import {
  SKILL_FAMILY_TABLES,
  SKILL_STATUS_TABLES,
  PROMPT_LINK_TABLES,
  RESOURCE_MAPPING_TABLES,
  DIAGRAM_BUILDER_INSTANCE_TABLES,
  AIA_TEAM_TABLES,
  AIA_TEAM_MEMBER_TABLES,
  AIA_STRATEGY_TABLES,
} from '../src/servicenow/table-discovery.js';
```

Add `handleSkillCreate` to the existing tools-skills import:
```typescript
import {
  SKILL_TOOLS, isSkillTool, handleSkillTool, SKILL_ROLE_HINT, buildFlowApiScript,
  handleSkillCreate,    // add this
} from '../src/servicenow/tools-skills.js';
```

**Step 2: Add new test sections before the "Total Tool Count" section**

```typescript
// ── New Table Constants ─────────────────────────────────────
section('New Table Constants (Skills Kit + AIA Team)');

if (SKILL_FAMILY_TABLES.includes('sn_nowassist_skill_family')) {
  pass('SKILL_FAMILY_TABLES includes sn_nowassist_skill_family');
} else {
  fail('SKILL_FAMILY_TABLES missing sn_nowassist_skill_family');
}

if (SKILL_STATUS_TABLES.includes('sn_nowassist_skill_config_status')) {
  pass('SKILL_STATUS_TABLES includes sn_nowassist_skill_config_status');
} else {
  fail('SKILL_STATUS_TABLES missing sn_nowassist_skill_config_status');
}

if (PROMPT_LINK_TABLES.includes('sys_generative_ai_prompt_config')) {
  pass('PROMPT_LINK_TABLES includes sys_generative_ai_prompt_config');
} else {
  fail('PROMPT_LINK_TABLES missing sys_generative_ai_prompt_config');
}

if (RESOURCE_MAPPING_TABLES.includes('sys_one_extend_resource_mapping')) {
  pass('RESOURCE_MAPPING_TABLES includes sys_one_extend_resource_mapping');
} else {
  fail('RESOURCE_MAPPING_TABLES missing sys_one_extend_resource_mapping');
}

if (DIAGRAM_BUILDER_INSTANCE_TABLES.includes('sn_diagram_builder_instance')) {
  pass('DIAGRAM_BUILDER_INSTANCE_TABLES includes sn_diagram_builder_instance');
} else {
  fail('DIAGRAM_BUILDER_INSTANCE_TABLES missing sn_diagram_builder_instance');
}

if (AIA_TEAM_TABLES.includes('sn_aia_team')) {
  pass('AIA_TEAM_TABLES includes sn_aia_team');
} else {
  fail('AIA_TEAM_TABLES missing sn_aia_team');
}

if (AIA_TEAM_MEMBER_TABLES.includes('sn_aia_team_member')) {
  pass('AIA_TEAM_MEMBER_TABLES includes sn_aia_team_member');
} else {
  fail('AIA_TEAM_MEMBER_TABLES missing sn_aia_team_member');
}

if (AIA_STRATEGY_TABLES.includes('sn_aia_strategy')) {
  pass('AIA_STRATEGY_TABLES includes sn_aia_strategy');
} else {
  fail('AIA_STRATEGY_TABLES missing sn_aia_strategy');
}

// ── servicenow_skill_create Rewrite Tests ─────────────────────
section('servicenow_skill_create (Full Rewrite)');

// Schema: inputs[], outputs[], model, temperature, maxTokens, override sys_ids
{
  const skillCreateTool2 = SKILL_TOOLS.find(t => t.name === 'servicenow_skill_create');
  if (skillCreateTool2) {
    const schema = skillCreateTool2.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    if (schema.properties?.inputs) {
      pass('servicenow_skill_create has inputs[] property');
    } else {
      fail('servicenow_skill_create missing inputs[] property');
    }
    if (schema.properties?.model) {
      pass('servicenow_skill_create has model property');
    } else {
      fail('servicenow_skill_create missing model property');
    }
    if (schema.properties?.llmFlowSysId) {
      pass('servicenow_skill_create has llmFlowSysId override property');
    } else {
      fail('servicenow_skill_create missing llmFlowSysId override property');
    }
    if (schema.properties?.roleSysId) {
      pass('servicenow_skill_create has roleSysId override property');
    } else {
      fail('servicenow_skill_create missing roleSysId override property');
    }
  }
}

// Dry-run output: shows 8 phases
{
  const skillDryRun = await handleSkillCreate({
    skillName: 'Test Skill',
    description: 'A test skill',
    promptTemplate: 'You are a test assistant. Input: {{query}}',
    inputs: [{ name: 'query', label: 'query', description: 'User query' }],
    dryRun: true,
  });
  const text = (skillDryRun.content[0] as { text: string }).text;
  if (text.includes('DRY RUN')) {
    pass('servicenow_skill_create dryRun output includes DRY RUN header');
  } else {
    fail('servicenow_skill_create dryRun output missing DRY RUN header');
  }
  if (text.includes('Phase 1') && text.includes('Phase 8')) {
    pass('servicenow_skill_create dryRun output shows all phases (1 through 8)');
  } else {
    fail('servicenow_skill_create dryRun output missing phases');
  }
  if (text.includes('PRE-FLIGHT')) {
    pass('servicenow_skill_create dryRun output includes PRE-FLIGHT section');
  } else {
    fail('servicenow_skill_create dryRun output missing PRE-FLIGHT section');
  }
  if (text.toLowerCase().includes('query') || text.includes('inputs')) {
    pass('servicenow_skill_create dryRun output reflects provided inputs');
  } else {
    fail('servicenow_skill_create dryRun output missing input reference');
  }
}

// Dry-run with explicit sys_id overrides
{
  const overrideDryRun = await handleSkillCreate({
    skillName: 'Override Skill',
    description: 'Test overrides',
    promptTemplate: 'Test prompt',
    llmFlowSysId: 'aabbccddaabbccddaabbccddaabbccdd',
    roleSysId: '11223344112233441122334411223344',
    dryRun: true,
  });
  const overrideText = (overrideDryRun.content[0] as { text: string }).text;
  if (overrideText.includes('aabbccddaabbccddaabbccddaabbccdd')) {
    pass('servicenow_skill_create dryRun shows explicit llmFlowSysId override');
  } else {
    fail('servicenow_skill_create dryRun missing explicit llmFlowSysId override');
  }
}

// Missing required fields returns error
{
  const missingFields = await handleSkillCreate({
    skillName: 'Incomplete',
    // missing description and promptTemplate
    dryRun: true,
  });
  if (missingFields.isError) {
    pass('servicenow_skill_create returns error when required fields missing');
  } else {
    fail('servicenow_skill_create should error when required fields missing');
  }
}

// ── servicenow_aia_usecase_create Tests ───────────────────────
section('servicenow_aia_usecase_create (New Tool)');

// Tool exists in AIA_TOOLS
{
  const usecaseCreateTool = AIA_TOOLS.find(t => t.name === 'servicenow_aia_usecase_create');
  if (usecaseCreateTool) {
    pass('servicenow_aia_usecase_create tool is defined in AIA_TOOLS');
  } else {
    fail('servicenow_aia_usecase_create tool missing from AIA_TOOLS');
  }
  if (usecaseCreateTool) {
    const schema = usecaseCreateTool.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
    if (schema.required?.includes('name') && schema.required?.includes('agents') && schema.required?.includes('basePlan')) {
      pass('servicenow_aia_usecase_create requires name, agents, and basePlan');
    } else {
      fail('servicenow_aia_usecase_create missing required fields');
    }
    if (schema.properties?.dryRun) {
      pass('servicenow_aia_usecase_create has dryRun property');
    } else {
      fail('servicenow_aia_usecase_create missing dryRun property');
    }
    if (schema.properties?.prefix) {
      pass('servicenow_aia_usecase_create has prefix property');
    } else {
      fail('servicenow_aia_usecase_create missing prefix property');
    }
  }
}

// isAiaTool recognizes it
if (isAiaTool('servicenow_aia_usecase_create')) {
  pass('isAiaTool("servicenow_aia_usecase_create") returns true');
} else {
  fail('isAiaTool("servicenow_aia_usecase_create") should return true');
}

// Dry-run: forbidden API warning surfaces
{
  const ucForbiddenDry = await handleAiaUsecaseCreate({
    name: 'Test Use Case',
    prefix: 'tst',
    description: 'Test',
    basePlan: 'Do stuff',
    agents: [{
      name: 'Test Agent',
      description: 'Test',
      role: 'Test role',
      instructions: 'Do things',
      proficiency: '- Does things',
      tools: [{
        name: 'Bad Tool',
        description: 'Uses forbidden APIs',
        inputSchema: [{ name: 'input', description: 'Input' }],
        script: `(function(inputs) { gs.info('hello'); return 'ok'; })(inputs);`,
      }],
    }],
    dryRun: true,
  });
  const ucText = (ucForbiddenDry.content[0] as { text: string }).text;
  if (ucText.includes('FORBIDDEN')) {
    pass('servicenow_aia_usecase_create dryRun warns about forbidden APIs');
  } else {
    fail('servicenow_aia_usecase_create dryRun missing forbidden API warning');
  }
}

// Dry-run: shows strategy lookup section + record tree
{
  const ucDryRun = await handleAiaUsecaseCreate({
    name: 'Incident Handler',
    prefix: 'gp01',
    description: 'Handles incidents',
    basePlan: '1. Accept incident\n2. Resolve it',
    agents: [{
      name: 'Incident Agent',
      description: 'Resolves incidents',
      role: 'IT service desk agent',
      instructions: '1. Look up incident\n2. Resolve it',
      proficiency: '- Looks up incidents\n- Resolves incidents',
      tools: [{
        name: 'Fetch Incident',
        description: 'Fetches an incident by number',
        inputSchema: [{ name: 'number', description: 'Incident number' }],
        script: `(function(inputs) { return 'incident data'; })(inputs);`,
      }],
    }],
    dryRun: true,
  });
  const ucRunText = (ucDryRun.content[0] as { text: string }).text;
  if (ucRunText.includes('DRY RUN')) {
    pass('servicenow_aia_usecase_create dryRun output has DRY RUN header');
  } else {
    fail('servicenow_aia_usecase_create dryRun output missing DRY RUN header');
  }
  if (ucRunText.includes('gp01 Incident Handler') || ucRunText.includes('gp01')) {
    pass('servicenow_aia_usecase_create dryRun output shows prefix in record names');
  } else {
    fail('servicenow_aia_usecase_create dryRun output missing prefix in record names');
  }
  if (ucRunText.includes('ReAct') || ucRunText.includes('strategy')) {
    pass('servicenow_aia_usecase_create dryRun output references strategy lookup');
  } else {
    fail('servicenow_aia_usecase_create dryRun output missing strategy section');
  }
  if (ucRunText.includes('Team') && ucRunText.includes('Use Case')) {
    pass('servicenow_aia_usecase_create dryRun output shows Team and Use Case records');
  } else {
    fail('servicenow_aia_usecase_create dryRun output missing Team/Use Case records');
  }
}

// Dry-run: missing required field gives clean error
{
  const ucMissing = await handleAiaUsecaseCreate({
    name: 'Missing Agents Use Case',
    prefix: 'tst',
    description: 'Test',
    basePlan: 'Do stuff',
    // agents missing
    dryRun: true,
  });
  if (ucMissing.isError || (ucMissing.content[0] as { text: string }).text.toLowerCase().includes('error')) {
    pass('servicenow_aia_usecase_create returns error when agents[] missing');
  } else {
    fail('servicenow_aia_usecase_create should error when agents[] missing');
  }
}

// dryRun=false requires connection
{
  const ucNoConn = await handleAiaUsecaseCreate({
    name: 'Test', prefix: 'tst', description: 'Test', basePlan: 'Test',
    agents: [{ name: 'A', description: 'B', role: 'C', instructions: 'D', proficiency: 'E', tools: [] }],
    dryRun: false,
  });
  if (ucNoConn.isError && (ucNoConn.content[0] as { text: string }).text.includes('Not connected')) {
    pass('servicenow_aia_usecase_create requires connection when dryRun=false');
  } else {
    fail('servicenow_aia_usecase_create should require connection when dryRun=false');
  }
}
```

**Step 3: Run tests — they should FAIL (imports don't exist yet)**

```bash
npm run test:servicenow 2>&1 | tail -15
```
Expected: compile errors (handleAiaUsecaseCreate not exported, handleSkillCreate not exported)

**Step 4: Commit the failing tests**

```bash
git add test/validate-servicenow.ts
git commit -m "test: add failing tests for skill_create rewrite and aia_usecase_create"
```

---

## Task 3: Rewrite servicenow_skill_create

**Files:**
- Modify: `src/servicenow/tools-skills.ts`

**Step 1: Update imports at the top of tools-skills.ts**

Replace the existing table-discovery import to add new constants:

```typescript
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
  // New for skill create rewrite
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
```

**Step 2: Update SERVICENOW_SKILL_CREATE_TOOL schema**

Replace the existing `SERVICENOW_SKILL_CREATE_TOOL` definition with:

```typescript
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
      // Optional sys_id overrides
      roleSysId: {
        type: 'string',
        description: 'sys_id of the role to use for access control (auto-resolved: itil role)',
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
```

**Step 3: Add the `buildSkillProvisionScript` helper function**

Add this new function after `buildFlowApiScript` (around line 516) and before `handleSkillExecute`:

```typescript
/**
 * Build the GlideUpdateManager2 provisioning script for Phase 8 of skill creation.
 * This script bypasses ACLs to:
 *   1. Create sys_gen_ai_feature_mapping
 *   2. Create sys_gen_ai_strategy_mapping (copies first existing strategy)
 *   3. Set model + request_tokens on sys_generative_ai_config
 *   4. Set internal_name + active + in_product_active on sn_nowassist_skill_config
 *   5. Activate sn_nowassist_skill_config_status
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
  // Escape for JS string literal inside the script
  const safeName = skillName.replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `var capId = '${capId}';
var promptId = '${promptId}';
var skId = '${skId}';
var skillName = '${safeName}';
var model = '${model}';
var requestTokens = '${requestTokens}';
var fmSysId = '${fmSysId}';
var smSysId = '${smSysId}';
var internalName = '${internalName}';

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

// 2. Create strategy_mapping via UpdateManager (copies first existing strategy)
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
```

**Step 4: Export `handleSkillCreate` and rewrite it**

The current `handleSkillCreate` function (starting at line ~660) needs to be completely replaced. Delete everything from `export async function handleSkillCreate` through its closing `}` and replace with:

```typescript
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

  // Optional overrides
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

  // Standard 5 outputs always included
  const standardOutputs = [
    { name: 'response', label: 'response', description: 'Response Text' },
    { name: 'provider', label: 'provider', description: 'Provider name' },
    { name: 'error', label: 'error', description: 'Error Message' },
    { name: 'errorcode', label: 'errorCode', description: 'Error Code' },
    { name: 'status', label: 'status', description: 'Status' },
  ];

  // Build pre-flight section for dry-run output (resolve or show override)
  const preflightLines: string[] = [];
  preflightLines.push('PRE-FLIGHT: sys_id Resolution');
  preflightLines.push('─'.repeat(60));
  const resolvedNote = (key: string, value: string | undefined, description: string) => {
    if (value) {
      preflightLines.push(`  ${key}: (override) ${value}`);
    } else {
      preflightLines.push(`  ${key}: (auto-resolve on create) — ${description}`);
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

  const crypto = await import('crypto');
  const results: string[] = [];

  try {
    // ── Pre-flight: resolve sys_ids ────────────────────────────
    const resolvedIds: Record<string, string> = {};

    // Role sys_id
    if (overrides.roleSysId) {
      resolvedIds.role = overrides.roleSysId;
    } else {
      const roleResp = await client.queryTable('sys_user_role', 'name=itil', ['sys_id', 'name'], 1);
      resolvedIds.role = roleResp.result?.[0]?.sys_id as string || '';
      if (!resolvedIds.role) results.push('[WARN] Could not resolve itil role sys_id');
    }

    // Skill family sys_id
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

    // LLM flow sys_id
    if (overrides.llmFlowSysId) {
      resolvedIds.llmFlow = overrides.llmFlowSysId;
    } else {
      const flowResp = await client.queryTable('sys_hub_flow', 'nameLIKELLM Generic^ORnameLIKENow LLM', ['sys_id', 'name'], 1);
      resolvedIds.llmFlow = flowResp.result?.[0]?.sys_id as string || '';
      if (!resolvedIds.llmFlow) {
        // Second attempt: broader search
        const flowResp2 = await client.queryTable('sys_hub_flow', 'nameLIKELLM^active=true', ['sys_id', 'name'], 1);
        resolvedIds.llmFlow = flowResp2.result?.[0]?.sys_id as string || '';
      }
      if (!resolvedIds.llmFlow) {
        return { content: [{ type: 'text', text: 'Could not resolve LLM provider flow. Provide llmFlowSysId explicitly. Run: servicenow_query table=sys_hub_flow query=nameLIKELLM' }], isError: true };
      }
    }

    // Category sys_id
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

    // Truncate strategy sys_id
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

    // Diagram builder config sys_id
    if (overrides.diagramBuilderConfigSysId) {
      resolvedIds.diagramConfig = overrides.diagramBuilderConfigSysId;
    } else {
      const diagConfigTable = await discoverTable(client, DIAGRAM_BUILDER_CONFIG_TABLES, ['sys_id', 'name']);
      if (diagConfigTable) {
        const diagConfigResp = await client.queryTable(diagConfigTable.tableName, 'nameLIKESkills Kit^ORnameLIKEskill', ['sys_id', 'name'], 1);
        resolvedIds.diagramConfig = diagConfigResp.result?.[0]?.sys_id as string || '';
        if (!resolvedIds.diagramConfig) {
          // Fallback: get first config
          const diagConfigResp2 = await client.queryTable(diagConfigTable.tableName, '', ['sys_id', 'name'], 1);
          resolvedIds.diagramConfig = diagConfigResp2.result?.[0]?.sys_id as string || '';
        }
      }
      if (!resolvedIds.diagramConfig) results.push('[WARN] Could not resolve diagram builder config sys_id');
    }

    // ── Phase 1: Core Capability ───────────────────────────────
    // Step 1: Capability
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

    // Step 2: Definition
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

    // Step 2b: Definition Config (auto-created or explicit)
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
    // Step 3: Generative AI Config (prompt)
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

    // Step 4: Prompt-Definition Link
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
    return formatError('create skill', error);
  }
}
```

**Step 5: Build**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```
Expected: no errors.

**Step 6: Run tests**

```bash
npm run test:servicenow 2>&1 | tail -15
```
Expected: skill_create tests now passing, usecase_create tests still failing (handleAiaUsecaseCreate not yet exported).

**Step 7: Commit**

```bash
git add src/servicenow/tools-skills.ts
git commit -m "feat: rewrite servicenow_skill_create with full 12-phase Python pattern"
```

---

## Task 4: Add servicenow_aia_usecase_create

**Files:**
- Modify: `src/servicenow/tools-aia.ts`

**Step 1: Update imports in tools-aia.ts**

Add to the existing table-discovery import:
```typescript
import {
  // ... existing imports ...
  AIA_TEAM_TABLES,
  AIA_TEAM_MEMBER_TABLES,
  AIA_STRATEGY_TABLES,
} from './table-discovery.js';
```

**Step 2: Add SERVICENOW_AIA_USECASE_CREATE_TOOL definition**

Add after the existing `SERVICENOW_AIA_CREATE_TOOL` definition (search for `AIA_TOOLS: Tool[]` and insert before it):

```typescript
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
```

**Step 3: Add `servicenow_aia_usecase_create` to AIA_TOOLS array**

Find the `AIA_TOOLS: Tool[]` array and add the new tool:
```typescript
export const AIA_TOOLS: Tool[] = [
  // ... existing tools ...
  SERVICENOW_AIA_USECASE_CREATE_TOOL,  // add this
];
```

**Step 4: Add `handleAiaUsecaseCreate` function**

Add before the `handleAiaTool` router function (find `export async function handleAiaTool`):

```typescript
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

  // Count all tools
  const allTools = agents.flatMap(a => (a.tools || []).map(t => ({ agent: a.name, tool: t })));
  const totalApiCalls = allTools.length + 2 + (agents.length * 3); // tools + team + usecase + (agent + member + m2ms) per agent

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
    const reactResp = await client.queryTable('sn_aia_strategy', 'name=ReAct^type=agent', ['sys_id', 'name'], 1);
    if (!reactResp.result?.[0]) {
      return { content: [{ type: 'text', text: 'ReAct strategy not found. Is the AI Agent plugin activated?\n\n' + AIA_ROLE_HINT }], isError: true };
    }
    const reactId = reactResp.result[0].sys_id as string;
    results.push(`[OK] Phase 0 — ReAct strategy: ${reactId}`);

    const plannerResp = await client.queryTable('sn_aia_strategy', 'name=ReActive Planner^type=orchestrator', ['sys_id', 'name'], 1);
    if (!plannerResp.result?.[0]) {
      return { content: [{ type: 'text', text: 'ReActive Planner strategy not found. Is the AI Agent plugin activated?\n\n' + AIA_ROLE_HINT }], isError: true };
    }
    const plannerId = plannerResp.result[0].sys_id as string;
    results.push(`[OK] Phase 0 — ReActive Planner strategy: ${plannerId}`);

    // Step 1: Create all tools upfront
    const toolMap = new Map<string, string>(); // tool display name → sys_id
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
    return formatError('create AI Agent Use Case', error);
  }
}
```

**Step 5: Add to router**

In the `handleAiaTool` switch statement, add:
```typescript
case 'servicenow_aia_usecase_create': return handleAiaUsecaseCreate(args);
```

**Step 6: Build**

```bash
npm run build 2>&1 | grep -E "error TS|Error" | head -20
```
Expected: no errors.

**Step 7: Run tests**

```bash
npm run test:servicenow 2>&1 | tail -15
```
Expected: all new tests passing.

**Step 8: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "feat: add servicenow_aia_usecase_create (6-table Team/UseCase/Agent pattern)"
```

---

## Task 5: Update Tool Count Tests

**Files:**
- Modify: `test/validate-servicenow.ts`

**Step 1: Update AIA tool count from 10 to 11**

Find the test:
```typescript
if (AIA_TOOLS.length === 10) {
  pass(`All 10 AIA tools defined (6 original + 1 tool execute + 2 usecase + 1 trigger)`);
```

Replace with:
```typescript
if (AIA_TOOLS.length === 11) {
  pass(`All 11 AIA tools defined (6 original + 1 tool execute + 2 usecase + 1 trigger + 1 usecase_create)`);
```

**Step 2: Update expectedAiaTools array**

Find:
```typescript
const expectedAiaTools = [
  'servicenow_aia_list', 'servicenow_aia_get', 'servicenow_aia_trace',
  ...
  'servicenow_aia_trigger_get',
];
```

Add `'servicenow_aia_usecase_create'` to the array.

**Step 3: Update "no connection" guard filter**

Find the filter that excludes certain tools from the no-connection test:
```typescript
t !== 'servicenow_aia_usecase_list' &&
t !== 'servicenow_aia_usecase_get'
```

Add `t !== 'servicenow_aia_usecase_create'` to the filter (since dryRun:true works without connection).

**Step 4: Update total tool count**

Find:
```typescript
if (/* total */ === 24) {
  pass(`All 24 ServiceNow tools defined (8 core + 10 AIA + 4 skill + 2 flow)`);
```

Update to 25:
```typescript
if (/* total */ === 25) {
  pass(`All 25 ServiceNow tools defined (8 core + 11 AIA + 4 skill + 2 flow)`);
```

**Step 5: Run tests**

```bash
npm run test:servicenow 2>&1 | tail -10
```
Expected: `✓ Passed: N/N` (all passing, count will be higher than 158 due to new tests)

**Step 6: Commit**

```bash
git add test/validate-servicenow.ts
git commit -m "test: update tool count tests for 11 AIA tools and 25 total"
```

---

## Task 6: Final Build + Verification

**Step 1: Full build**

```bash
npm run build 2>&1 | tail -5
```
Expected: clean build, no errors.

**Step 2: Full test run**

```bash
npm run test:servicenow 2>&1 | grep -E "Passed|Failed|✗"
```
Expected: all passed, 0 failures.

**Step 3: Verify dist/index.js reflects new tools**

```bash
grep -c "servicenow_aia_usecase_create\|servicenow_skill_create" dist/index.js
```
Expected: at least 2 matches.

**Step 4: Final commit**

```bash
git add dist/
git commit -m "build: compile skill_create rewrite and aia_usecase_create"
```

---

## Done!

After all tasks complete, use `superpowers:finishing-a-development-branch` to create the PR.

**Summary of changes:**
- `src/servicenow/table-discovery.ts` — 13 new table constants
- `src/servicenow/tools-skills.ts` — full rewrite of `handleSkillCreate` + new `buildSkillProvisionScript`
- `src/servicenow/tools-aia.ts` — new `SERVICENOW_AIA_USECASE_CREATE_TOOL` + `handleAiaUsecaseCreate`
- `test/validate-servicenow.ts` — new test sections, updated counts
- `dist/` — compiled output
