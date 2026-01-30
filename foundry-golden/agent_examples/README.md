# Agent Examples

Full working ServiceNow agent implementations for reference and learning.

## Purpose

This directory contains complete, vetted examples of ServiceNow agents built with the Now Assist and Agentic frameworks. These are real implementations that demonstrate best practices, architectural decisions, and lessons learned.

**Use these examples to:**
- Learn patterns for building ServiceNow agents
- Copy and adapt code for new POCs
- Understand architectural decisions and trade-offs
- Avoid common pitfalls documented in each example

## Structure

Each agent example follows a standard structure:

```
agent_examples/
├── README.md                 # This file
├── _template/                # Starter template for new examples
│   ├── AGENT.md              # Documentation template
│   ├── config.json           # Metadata template
│   └── src/                  # ServiceNow artifacts
│       ├── skill/            # Now Assist skill definitions
│       ├── flow/             # Flow Designer exports
│       └── scripts/          # Script Includes, Business Rules
└── <agent-name>/             # Actual agent examples
    ├── AGENT.md              # What it does, architecture, lessons
    ├── config.json           # Metadata (type, complexity, platform)
    └── src/                  # Implementation artifacts
```

## Agent Example Structure

### AGENT.md

Documents the agent with sections for:
- **Overview**: What the agent does and its use case
- **Architecture**: How components interact
- **Setup**: Prerequisites and configuration
- **Usage**: How to test and use
- **Lessons Learned**: What worked, what didn't, gotchas

### config.json

Metadata for discovery and filtering:
```json
{
  "name": "agent-name",
  "description": "Brief description",
  "type": "now-assist-skill | ai-agent | hybrid",
  "complexity": "simple | moderate | complex",
  "platform": {
    "minVersion": "Vancouver",
    "plugins": ["com.glide.genai", "sn_agent_workspace"]
  },
  "tags": ["incident", "summarization", "triage"]
}
```

### src/ Directory

Contains actual ServiceNow artifacts:
- `skill/`: Now Assist skill manifest and prompts
- `flow/`: Flow Designer JSON exports
- `scripts/`: Script Includes, Business Rules, etc.

## Adding a New Example

1. Copy the `_template/` directory:
   ```bash
   cp -r _template/ my-agent-name/
   ```

2. Fill in `AGENT.md` with documentation

3. Update `config.json` with accurate metadata

4. Add implementation artifacts to `src/`

5. Validate and promote:
   ```
   Validate the my-agent-name agent example
   Promote my-agent-name to the golden repo
   ```

## Quality Standards

Agent examples should:
- Be complete and working (tested on a real instance)
- Include all necessary artifacts to deploy
- Document prerequisites and setup steps
- Capture lessons learned and gotchas
- Follow ServiceNow best practices
- Include test cases or validation steps

## Current Examples

*No examples added yet. First examples coming soon:*
- `incident-summarizer` - Summarizes incident history using GenAI
- `knowledge-recommender` - Suggests KB articles during incident creation

## See Also

- [agent-builder skill](../skills/agent-builder/) - How to build agents step-by-step
- [agentic-patterns context](../context/agentic-patterns.md) - Framework overview
- [genai-framework context](../context/genai-framework.md) - GenAI Controller details
