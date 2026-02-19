# Skill: Now Assist Skill Builder

> Helps you create new Now Assist skills for the ServiceNow platform.

---

## Purpose

This skill guides you through creating custom Now Assist skills, from initial design through implementation and testing.

## When to Use

Use this skill when you need to:
- Create a new Now Assist skill from scratch
- Design skill input/output schemas
- Write effective prompts for skills
- Register and test skills in ServiceNow

## Prerequisites

**IMPORTANT:** Before implementing any skill, consider using the `brainstorming` workflow (if available) to explore requirements and design options. Building a skill is creative work that benefits from upfront clarification.

## Instructions

When the user asks to create a Now Assist skill, follow these steps:

### Step 1: Gather Requirements (REQUIRED - DO NOT SKIP)

**STOP.** Before writing ANY code or generating ANY manifest, you MUST ask these questions and wait for the user's answers:

1. What should the skill do? (summarize, generate, classify, extract, etc.)
2. What data will it operate on? (incidents, cases, knowledge articles, etc.)
3. Who will use it? (agents, end users, automated workflows)
4. What output format is needed? (text, JSON, structured data)

Do NOT infer answers from a brief request like "create a skill that summarizes incidents." ASK the user to confirm or clarify each point.

### Step 2: Design the Skill

Create a skill manifest with:
- Unique skill ID (snake_case, descriptive)
- Clear name and description
- Input schema with required and optional fields
- Output schema with expected structure
- Configuration defaults (model, temperature, max_tokens)

Template:
```json
{
  "skill_id": "{skill_id}",
  "name": "{Skill Name}",
  "description": "{What this skill does}",
  "version": "1.0.0",
  "category": "{summarization|generation|classification|extraction}",
  "input_schema": {
    "type": "object",
    "required": ["{required_field}"],
    "properties": {
      "{required_field}": {
        "type": "string",
        "description": "{What this field contains}"
      }
    }
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "{output_field}": {
        "type": "string",
        "description": "{What this output contains}"
      }
    }
  },
  "configuration": {
    "model_preference": "gpt-4",
    "temperature": 0.3,
    "max_tokens": 1000
  }
}
```

### Step 3: Design the Prompt

Create a prompt template following these guidelines:

1. **System Message**: Define the AI's role and constraints
   ```
   You are a ServiceNow {role}. Your task is to {primary_task}.

   Guidelines:
   - {guideline_1}
   - {guideline_2}
   - Always {important_behavior}
   - Never {prohibited_behavior}
   ```

2. **User Message**: Structure the input data
   ```
   {Task description}

   Input Data:
   {{field_1}}
   {{field_2}}

   Requirements:
   - {requirement_1}
   - {requirement_2}

   Output Format:
   {expected_format_description}
   ```

3. **Few-shot Examples** (if needed):
   ```
   Example:
   Input: {example_input}
   Output: {example_output}
   ```

### Step 4: Implement the Skill

Generate the ServiceNow script include:

```javascript
var {SkillName} = Class.create();
{SkillName}.prototype = {

    initialize: function() {
        this.controller = new sn_genai.GenAIController();
    },

    execute: function(input) {
        // Validate input
        if (!this._validateInput(input)) {
            return { error: 'Invalid input', details: this.validationErrors };
        }

        // Gather context
        var context = this._gatherContext(input);

        // Build prompt
        var prompt = this._buildPrompt(context);

        // Execute GenAI call
        var response = this.controller.executePrompt(prompt);

        // Process and return output
        return this._processOutput(response);
    },

    _validateInput: function(input) {
        this.validationErrors = [];
        // Add validation logic
        return this.validationErrors.length === 0;
    },

    _gatherContext: function(input) {
        // Gather additional data needed for the prompt
        return {
            // context fields
        };
    },

    _buildPrompt: function(context) {
        return {
            system: this.SYSTEM_PROMPT,
            user: this._formatUserPrompt(context)
        };
    },

    _processOutput: function(response) {
        // Parse and structure the response
        return {
            // output fields
        };
    },

    SYSTEM_PROMPT: '', // Set from design

    type: '{SkillName}'
};
```

### Step 5: Register the Skill

Provide instructions for registering in ServiceNow:

1. Create the Script Include with the generated code
2. Navigate to Now Assist Admin → Skills
3. Create new skill record with:
   - Skill ID: `{skill_id}`
   - Name: `{Skill Name}`
   - Script Include: `{SkillName}`
   - Input Schema: (paste JSON)
   - Output Schema: (paste JSON)
4. Set permissions and enable for appropriate applications

### Step 6: Test the Skill

Provide test script:

```javascript
// Test in Scripts - Background
var skill = new {SkillName}();
var testInput = {
    // test data
};

var result = skill.execute(testInput);
gs.info('Skill result: ' + JSON.stringify(result, null, 2));
```

And manual test checklist:
- [ ] Skill appears in Skills Registry
- [ ] Input validation works correctly
- [ ] Successful execution with valid input
- [ ] Appropriate error handling for edge cases
- [ ] Output matches expected schema
- [ ] Performance is acceptable

## API-Based Skill Creation (8-Table Pattern)

When you need to create a Now Assist skill **programmatically via the REST API** (rather than through the UI), you must create records across 8 tables in a specific order. This is the pattern used by the `servicenow_skill_create` MCP tool.

### Why 8 Tables?

Now Assist skills aren't a single record — they're a constellation of linked records that register the skill as a capability, configure the LLM prompt, and define input/output schemas. Skip any table and the skill won't appear in the GenAI Controller.

### Pre-Generated sys_id Pattern

Generate all sys_ids upfront so you can reference them across tables before records exist:

```javascript
const crypto = require('crypto');
const capabilitySysId = crypto.randomBytes(16).toString('hex');
const skillConfigSysId = crypto.randomBytes(16).toString('hex');
const genAiConfigSysId = crypto.randomBytes(16).toString('hex');
const definitionSysId = crypto.randomBytes(16).toString('hex');
```

### Creation Order

Create records in this exact order (each depends on the previous):

#### Table 1: `sys_one_extend_capability` — Register the capability

```javascript
// POST /api/now/table/sys_one_extend_capability
{
    sys_id: capabilitySysId,
    name: "Skill Display Name",
    description: "What this skill does",
    type: "skill",
    active: true
}
```

#### Table 2: `sn_nowassist_skill_config` — Configure the skill

```javascript
// POST /api/now/table/sn_nowassist_skill_config
{
    sys_id: skillConfigSysId,
    name: "Skill Name",
    description: "Skill description",
    active: true,
    skill_type: "agentic",
    capability: capabilitySysId  // Links to Table 1
}
```

#### Table 3: `sys_generative_ai_config` — Set up the LLM prompt

```javascript
// POST /api/now/table/sys_generative_ai_config
{
    sys_id: genAiConfigSysId,
    name: "Config Name",
    active: true,
    prompt: "The system prompt template for the LLM",
    model: "model_sys_id"  // Reference to configured LLM model
}
```

#### Table 4: `sys_one_extend_capability_definition` — Define the API surface

```javascript
// POST /api/now/table/sys_one_extend_capability_definition
{
    sys_id: definitionSysId,
    capability: capabilitySysId,  // Links to Table 1
    api: "api_name",
    api_type: "api_type",
    active: true
}
```

#### Table 5: `sys_one_extend_definition_config` — Default configuration

```javascript
// POST /api/now/table/sys_one_extend_definition_config
{
    definition: definitionSysId,  // Links to Table 4
    default: true,
    active: true
}
```

#### Tables 6-8: `sys_one_extend_definition_attribute` — Input/output attributes

Create one record per input or output parameter:

```javascript
// POST /api/now/table/sys_one_extend_definition_attribute
// Repeat for each input and output attribute
{
    definition: definitionSysId,  // Links to Table 4
    name: "attribute_name",
    type: "string",              // string, reference, boolean, etc.
    value: "attribute_value"
}
```

### Validation Checklist

After creating all records:
- [ ] Capability appears in `sys_one_extend_capability`
- [ ] Skill config links to capability correctly
- [ ] GenAI config has a valid prompt template
- [ ] Definition links back to capability
- [ ] Definition config marks definition as default
- [ ] All input/output attributes reference the correct definition
- [ ] Skill appears in Now Assist Admin → Skills
- [ ] Skill can be invoked via GenAI Controller

### Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Skill not visible in UI | Missing capability or skill_config record | Verify Tables 1-2 exist and are linked |
| "No prompt configured" | Missing sys_generative_ai_config | Create Table 3 record with prompt |
| "Invalid definition" | Missing definition or config | Verify Tables 4-5 are linked |
| Input not passed to skill | Missing definition_attribute records | Create Table 6-8 records for each input |

## Skill Kit Architecture (Zurich)

The Now Assist Skill Kit is a no-code/low-code tool for building custom skills in ServiceNow Zurich.

### Navigation

All > Now Assist Skill Kit

### Skill Kit Components

| Component | Description |
|-----------|-------------|
| **Provider** | LLM provider configuration |
| **Prompt** | System and user prompt templates |
| **Tools** | Tool definitions the skill can use |
| **Retriever** | Knowledge retrieval configuration |
| **Input/Output Schema** | Structured data definitions |

### Skill Kit Build Process

1. **Create skill** — Name, description, category
2. **Configure provider** — Select LLM provider and model
3. **Design prompt** — System instructions + user template with `{{placeholders}}`
4. **Add tools** (optional) — Attach tools the skill can invoke
5. **Configure retriever** (optional) — Set up knowledge source, chunking strategy
6. **Define schemas** — Input/output field definitions
7. **Test** — Use built-in test panel with sample inputs
8. **Deploy** — Activate for selected applications

### Retriever Configuration

For RAG-based skills:
- **Data source**: Knowledge base, table, or custom source
- **Chunking strategy**: Configure chunk size and overlap
- **Embedding model**: Select embedding provider
- **Top-K results**: Number of chunks to retrieve

### Deployment Touchpoints

Where skills can be invoked:
- Now Assist Panel (sidebar)
- Virtual Agent conversations
- Flow Designer actions
- Scripted invocations via `sn_one_extend.OneExtendUtil.execute()`
- Context menu items
- Agentic workflows (as Now Assist skill tool type)

### Evaluation

After deployment, evaluate skills using:

Navigation: All > Now Assist Skill Kit > Agentic Evaluations

**Evaluation Metrics:**

| Metric | Scale | Description |
|--------|-------|-------------|
| Overall Task Completeness | 0-100% | % of tasks fully completed |
| Task Completeness (per record) | 1-3 | 3=Successful, 2=Partial, 1=Unsuccessful |
| Tool Performance | 0-1 | 1=Right tool chosen, 0=Wrong tool |
| Tool Calling | 0-1 | Input key completeness AND value correctness AND format correctness |

**Threshold Interpretation:**

| Range | Label | Recommendation |
|-------|-------|---------------|
| 90-100% | Excellent | Proceed with confidence |
| 70-89% | Good | Deploy with caution |
| 50-69% | Moderate | Investigate root causes |
| 0-49% | Poor | **Do not deploy** |

### Programmatic Skill Invocation

```javascript
// Via OneExtendUtil (server-side)
var request = {
    capabilityId: 'your_capability_sys_id',
    input: {
        field1: 'value1',
        field2: 'value2'
    }
};
var result = sn_one_extend.OneExtendUtil.execute(request);
```

---

## Examples

See the `examples/` directory for:
- `case-summarizer-skill.js` - A complete case summarization skill
- `incident-classifier-skill.js` - An incident classification skill

## Tips

- Start with a narrow scope and expand
- Use low temperature (0.2-0.4) for consistent outputs
- Include examples in prompts for complex tasks
- Always validate inputs before processing
- Log skill executions for debugging
- Consider rate limits and timeouts
- When creating skills via API, always use the 8-table pattern above
- Default to dry-run mode when using the `servicenow_skill_create` MCP tool
