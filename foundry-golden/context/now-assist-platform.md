# Now Assist Platform Context

> This document provides essential context about the Now Assist platform for POC development.

---

## Overview

Now Assist is ServiceNow's generative AI capability that brings large language models (LLMs) into the ServiceNow platform. It provides AI-powered assistance across various workflows including IT Service Management, Customer Service, HR, and custom applications.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Now Assist Layer                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Now Assist  │  │   Skills    │  │  GenAI Controller   │ │
│  │   Panel     │  │  Registry   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                 ServiceNow Platform                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Tables    │  │  Workflows  │  │    Integrations     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Services

| Service | Purpose |
|---------|---------|
| **GenAI Controller** | Routes requests to appropriate LLM, manages prompts |
| **Skills Registry** | Stores and manages Now Assist skills |
| **Now Assist Panel** | UI component for user interaction |
| **Prompt Templates** | Reusable prompt structures |

## Capabilities

### Out-of-Box Features

1. **Case/Incident Summarization**
   - Summarizes ticket history and comments
   - Identifies key information and action items

2. **Knowledge Article Generation**
   - Creates articles from resolved incidents
   - Formats content for knowledge base

3. **Chat Assistance**
   - Virtual agent conversations
   - Context-aware responses

4. **Code Generation**
   - Script generation for ServiceNow
   - Business rule and flow assistance

### Custom Skills

Now Assist can be extended with custom skills for domain-specific use cases. See `genai-framework.md` for skill development patterns.

## API Reference

### GenAI Controller API

**Endpoint:** `/api/now/genai/controller/execute`

**Method:** POST

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "skill_id": "summarize_case",
  "input": {
    "case_sys_id": "abc123",
    "include_comments": true
  },
  "options": {
    "temperature": 0.3,
    "max_tokens": 500
  }
}
```

**Response:**
```json
{
  "result": {
    "status": "success",
    "output": "...",
    "metadata": {
      "tokens_used": 245,
      "model": "gpt-4"
    }
  }
}
```

### Skill Invocation Patterns

**Direct Invocation (Server-side):**
```javascript
var controller = new sn_genai.GenAIController();
var result = controller.executeSkill('skill_id', {
    input_field: 'value'
});
```

**Flow Designer:**
```
GenAI Controller → Execute Skill
  - Skill ID: summarize_case
  - Input: Case record
  - Output: Summary text
```

## Configuration

### Instance Setup

1. **Plugin Activation**
   - `com.snc.now_assist` - Core Now Assist
   - `com.snc.genai_controller` - GenAI Controller

2. **LLM Configuration**
   - Navigate to: Now Assist Admin → LLM Configuration
   - Configure API keys for chosen provider
   - Set rate limits and fallback options

3. **Skills Configuration**
   - Navigate to: Now Assist Admin → Skills
   - Enable/disable skills per application
   - Configure skill-specific settings

### Security Considerations

- **Data Classification:** Ensure sensitive data handling compliance
- **PII Filtering:** Configure PII detection and masking
- **Audit Logging:** All GenAI requests are logged
- **Rate Limiting:** Protect against excessive API usage

## Common Patterns

### Pattern: Contextual Summarization

```javascript
// Gather context from multiple sources
var context = {
    incident: getIncidentData(sys_id),
    comments: getComments(sys_id),
    related_items: getRelatedItems(sys_id)
};

// Execute summarization skill
var summary = controller.executeSkill('contextual_summarize', {
    context: JSON.stringify(context),
    focus_areas: ['resolution', 'timeline', 'stakeholders']
});
```

### Pattern: Guided Generation

```javascript
// Provide structured guidance for generation
var result = controller.executeSkill('generate_response', {
    input: userQuery,
    guidelines: {
        tone: 'professional',
        max_length: 200,
        include_next_steps: true,
        reference_kb: true
    }
});
```

## Troubleshooting

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Skill not found | Skill not registered or disabled | Check Skills Registry |
| Rate limit exceeded | Too many requests | Implement backoff, check quotas |
| Empty response | Input validation failed | Check required fields |
| Timeout | LLM response slow | Increase timeout, simplify prompt |

### Debugging

Enable debug logging:
```javascript
gs.setProperty('com.snc.genai.debug', 'true');
```

Check logs:
- System Logs → GenAI Controller
- Now Assist Admin → Request History

## Resources

- [ServiceNow GenAI Documentation](https://docs.servicenow.com)
- [Now Assist Admin Guide](https://docs.servicenow.com)
- [API Reference](https://developer.servicenow.com)
