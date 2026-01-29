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

## Instructions

When the user asks to create a Now Assist skill, follow these steps:

### Step 1: Gather Requirements

Ask the user:
1. What should the skill do? (summarize, generate, classify, extract, etc.)
2. What data will it operate on? (incidents, cases, knowledge articles, etc.)
3. Who will use it? (agents, end users, automated workflows)
4. What output format is needed? (text, JSON, structured data)

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
