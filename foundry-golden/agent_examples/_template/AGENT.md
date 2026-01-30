# Agent Name

> Brief one-line description of what this agent does.

## Overview

Describe the agent's purpose, target use case, and business value.

**Use Case:** What problem does this solve?

**Target Users:** Who will use this agent?

**Trigger:** How is the agent invoked? (Virtual Agent, workspace, API, etc.)

## Architecture

### Components

| Component | Type | Purpose |
|-----------|------|---------|
| Example Skill | Now Assist Skill | Generates summary |
| Example Flow | Flow Designer | Orchestrates steps |
| Example Script | Script Include | Business logic |

### Flow Diagram

```
[Trigger] → [Input Processing] → [GenAI/Tool Call] → [Output] → [Action]
```

### Data Flow

1. User triggers agent via [mechanism]
2. Agent retrieves [data] from [table]
3. GenAI processes with [skill/prompt]
4. Result is [stored/displayed/actioned]

## Prerequisites

### Platform Requirements

- ServiceNow version: Vancouver or later
- Required plugins:
  - `com.glide.genai` (GenAI Controller)
  - [Other plugins]

### Configuration

- [ ] GenAI enabled and configured
- [ ] Required roles assigned: [roles]
- [ ] [Other prerequisites]

## Setup

### Step 1: Import Artifacts

```bash
# Import the skill manifest
# Navigate to Now Assist > Skills > Import
```

### Step 2: Configure

1. Set system property `x_snc_example.enabled` to `true`
2. Configure [other settings]

### Step 3: Test

1. Navigate to [location]
2. Trigger the agent by [action]
3. Verify [expected result]

## Usage

### Basic Usage

Describe how to use the agent in normal operation.

### Example Interactions

**Input:**
```
[Example user input or trigger]
```

**Output:**
```
[Example agent response or action]
```

## Implementation Details

### Skill Prompt

Key elements of the prompt design:
- [Element 1]: Why it's important
- [Element 2]: How it helps

### Tool Definitions

If using Agentic framework:
```json
{
  "name": "tool_name",
  "description": "What it does",
  "parameters": {}
}
```

### Error Handling

How the agent handles:
- Invalid input: [behavior]
- Missing data: [behavior]
- API failures: [behavior]

## Lessons Learned

### What Worked Well

1. **[Pattern/Decision]**: Why it was effective
2. **[Pattern/Decision]**: Benefits observed

### Challenges and Solutions

| Challenge | Solution |
|-----------|----------|
| [Problem 1] | [How we solved it] |
| [Problem 2] | [How we solved it] |

### Gotchas

- **[Gotcha 1]**: Explanation and workaround
- **[Gotcha 2]**: Explanation and workaround

### Performance Considerations

- Average response time: [X seconds]
- Token usage: [typical range]
- Optimization tips: [suggestions]

## Testing

### Manual Testing

1. Test case: [description]
   - Steps: [how to test]
   - Expected: [result]

### Automated Testing (ATF)

Location of ATF tests: `[path or sys_id]`

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial release |

## Contributors

- [Name] - Initial implementation
- [Name] - [Contribution]

## See Also

- [Related agent example]
- [Relevant skill]
- [External documentation]
