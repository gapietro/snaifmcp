# Example: Incident Triage Agent

This example shows how to build an AI Agent that automatically triages new incidents.

---

## Use Case

**Problem:** New incidents come in with incomplete categorization, causing delays in routing to the right teams.

**Solution:** An AI Agent that:
1. Analyzes incident description
2. Suggests category and subcategory
3. Recommends priority based on impact keywords
4. Routes to appropriate assignment group

---

## Agent Design

### Tools Required

| Tool | Purpose |
|------|---------|
| `analyze_incident` | Extract entities and keywords |
| `get_categories` | List valid categories |
| `suggest_assignment` | Find matching assignment group |
| `update_incident` | Apply triage results |

### Workflow

```
New Incident Created
        │
        ▼
┌─────────────────┐
│ analyze_incident │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ get_categories  │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│ suggest_assignment│
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│ update_incident │ (with confirmation)
└────────┬────────┘
         │
         ▼
    Triage Complete
```

---

## Tool Implementations

### analyze_incident

```javascript
{
    name: 'analyze_incident',
    description: 'Analyze incident text to extract key information',
    parameters: {
        incident_id: { type: 'string', required: true }
    },
    execute: function(params) {
        var gr = new GlideRecord('incident');
        if (!gr.get(params.incident_id)) {
            return { error: 'Incident not found' };
        }

        var text = gr.getValue('short_description') + ' ' + gr.getValue('description');

        // Extract keywords (simplified example)
        var analysis = {
            incident_number: gr.getValue('number'),
            text_length: text.length,
            keywords: extractKeywords(text),
            urgency_indicators: findUrgencyIndicators(text),
            service_mentions: findServiceMentions(text)
        };

        return analysis;
    }
}

function extractKeywords(text) {
    var keywords = [];
    var patterns = ['error', 'cannot', 'broken', 'slow', 'urgent', 'down'];
    patterns.forEach(function(p) {
        if (text.toLowerCase().indexOf(p) > -1) {
            keywords.push(p);
        }
    });
    return keywords;
}

function findUrgencyIndicators(text) {
    var urgent = ['urgent', 'critical', 'emergency', 'asap', 'immediately'];
    var found = [];
    urgent.forEach(function(u) {
        if (text.toLowerCase().indexOf(u) > -1) {
            found.push(u);
        }
    });
    return found;
}

function findServiceMentions(text) {
    // Look for known service names
    var services = ['email', 'vpn', 'network', 'laptop', 'printer', 'phone'];
    var found = [];
    services.forEach(function(s) {
        if (text.toLowerCase().indexOf(s) > -1) {
            found.push(s);
        }
    });
    return found;
}
```

### suggest_assignment

```javascript
{
    name: 'suggest_assignment',
    description: 'Suggest assignment group based on analysis',
    parameters: {
        keywords: { type: 'array', required: true },
        service_mentions: { type: 'array' }
    },
    execute: function(params) {
        // Mapping rules (simplified)
        var rules = [
            { keywords: ['email'], group: 'Email Support' },
            { keywords: ['network', 'vpn'], group: 'Network Team' },
            { keywords: ['laptop', 'hardware'], group: 'Desktop Support' },
            { keywords: ['phone'], group: 'Telecom Team' }
        ];

        var suggestions = [];

        rules.forEach(function(rule) {
            rule.keywords.forEach(function(kw) {
                if (params.keywords.indexOf(kw) > -1 ||
                    (params.service_mentions && params.service_mentions.indexOf(kw) > -1)) {
                    suggestions.push({
                        group: rule.group,
                        matched_keyword: kw,
                        confidence: 'high'
                    });
                }
            });
        });

        if (suggestions.length === 0) {
            suggestions.push({
                group: 'Service Desk',
                matched_keyword: 'default',
                confidence: 'low'
            });
        }

        return suggestions;
    }
}
```

---

## Agent Configuration

```javascript
{
    name: 'Incident Triage Agent',
    description: 'Automatically categorize and route new incidents',

    instructions: `You are an Incident Triage Agent. Your job is to:
    1. Analyze new incidents when triggered
    2. Identify the type of issue from the description
    3. Suggest appropriate category and assignment group
    4. Apply the triage with user confirmation

    Rules:
    - Always explain your reasoning
    - If confidence is low, flag for human review
    - Never delete or close incidents
    - Log all triage decisions`,

    tools: [
        'analyze_incident',
        'get_categories',
        'suggest_assignment',
        'update_incident'
    ],

    guardrails: {
        require_confirmation: ['update_incident'],
        blocked_fields: ['state', 'active'],
        max_tool_calls: 5
    },

    triggers: [
        { event: 'incident.created', condition: 'category.nil()' }
    ]
}
```

---

## Testing Scenarios

### Test 1: Email Issue

**Input:**
```
Short description: Cannot send emails
Description: Since this morning I cannot send any emails. Getting error message when clicking send.
```

**Expected:**
- Keywords: ['error', 'cannot']
- Service: ['email']
- Suggested group: Email Support
- Confidence: High

### Test 2: Vague Request

**Input:**
```
Short description: Computer problem
Description: Something is wrong with my computer.
```

**Expected:**
- Keywords: []
- Service: []
- Suggested group: Service Desk (default)
- Confidence: Low
- Flag: Human review recommended

### Test 3: Urgent Request

**Input:**
```
Short description: URGENT - Network down
Description: Critical - entire floor has no network connectivity. Need immediate help!
```

**Expected:**
- Keywords: ['down']
- Service: ['network']
- Urgency indicators: ['urgent', 'critical', 'immediate']
- Suggested group: Network Team
- Priority suggestion: P1

---

## Deployment Notes

1. **Start with logging only** - Don't auto-apply initially
2. **Monitor accuracy** - Track triage correctness
3. **Iterate on rules** - Refine keyword matching
4. **Add human override** - Allow manual correction
5. **Expand gradually** - Add more service mappings over time

---

*Part of the agent-builder skill*
