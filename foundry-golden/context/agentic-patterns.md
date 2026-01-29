# Agentic Framework Patterns

> This document covers agentic patterns for building AI agents that interact with ServiceNow.

---

## What is an Agentic System?

An agentic system is an AI application that can:
- **Reason** about tasks and break them into steps
- **Act** by invoking tools and APIs
- **Observe** results and adapt behavior
- **Iterate** until the goal is achieved

In ServiceNow context, agents can automate complex workflows that require judgment, not just rule-based automation.

## Agent Architecture

### Core Loop

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Loop                            │
│                                                          │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐            │
│   │  Plan   │───▶│   Act   │───▶│ Observe │───┐        │
│   └─────────┘    └─────────┘    └─────────┘   │        │
│        ▲                                       │        │
│        └───────────────────────────────────────┘        │
│                                                          │
│   Exit when: Goal achieved OR Max iterations OR Error   │
└─────────────────────────────────────────────────────────┘
```

### Agent Components

```javascript
var Agent = {
    // Configuration
    config: {
        max_iterations: 10,
        tools: ['search_knowledge', 'update_record', 'send_notification'],
        model: 'gpt-4'
    },

    // System prompt defining agent behavior
    system_prompt: `You are a ServiceNow support agent...`,

    // Available tools
    tools: [
        {
            name: 'search_knowledge',
            description: 'Search knowledge base for articles',
            parameters: { query: 'string' }
        },
        // ... more tools
    ],

    // Main execution loop
    run: function(task) {
        var context = { task: task, history: [], iteration: 0 };

        while (context.iteration < this.config.max_iterations) {
            var action = this.plan(context);

            if (action.type === 'complete') {
                return action.result;
            }

            var observation = this.act(action);
            context.history.push({ action: action, observation: observation });
            context.iteration++;
        }

        return { status: 'max_iterations_reached', context: context };
    }
};
```

## Tool Definition Patterns

### Pattern 1: Basic Tool Definition

```javascript
var tools = [
    {
        name: "get_incident",
        description: "Retrieve incident details by number or sys_id",
        parameters: {
            type: "object",
            required: ["identifier"],
            properties: {
                identifier: {
                    type: "string",
                    description: "Incident number (INC0010001) or sys_id"
                },
                fields: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific fields to return (optional, returns all if omitted)"
                }
            }
        }
    },
    {
        name: "update_incident",
        description: "Update fields on an incident",
        parameters: {
            type: "object",
            required: ["sys_id", "updates"],
            properties: {
                sys_id: {
                    type: "string",
                    description: "Sys ID of the incident to update"
                },
                updates: {
                    type: "object",
                    description: "Field-value pairs to update"
                }
            }
        }
    }
];
```

### Pattern 2: Tool with Validation

```javascript
var SearchKnowledgeTool = {
    name: "search_knowledge",
    description: "Search knowledge base articles",

    parameters: {
        type: "object",
        required: ["query"],
        properties: {
            query: { type: "string", minLength: 3 },
            category: { type: "string", enum: ["IT", "HR", "Facilities"] },
            limit: { type: "integer", minimum: 1, maximum: 10, default: 5 }
        }
    },

    execute: function(params) {
        // Validate
        if (!this.validate(params)) {
            return { error: "Invalid parameters", details: this.validationErrors };
        }

        // Execute
        var results = this._search(params.query, params.category, params.limit);

        // Format response
        return {
            count: results.length,
            articles: results.map(function(r) {
                return {
                    number: r.number,
                    title: r.short_description,
                    snippet: r.text.substring(0, 200)
                };
            })
        };
    }
};
```

### Pattern 3: Composite Tool

```javascript
// Tool that orchestrates multiple operations
var ResolveIncidentTool = {
    name: "resolve_incident",
    description: "Resolve an incident with proper documentation",

    parameters: {
        type: "object",
        required: ["incident_sys_id", "resolution_notes", "root_cause"],
        properties: {
            incident_sys_id: { type: "string" },
            resolution_notes: { type: "string" },
            root_cause: { type: "string" },
            create_knowledge: { type: "boolean", default: false }
        }
    },

    execute: function(params) {
        var results = {};

        // 1. Update incident state
        results.incident_update = this._updateIncident(params.incident_sys_id, {
            state: 'resolved',
            resolution_notes: params.resolution_notes,
            cause: params.root_cause
        });

        // 2. Add work notes
        results.work_note = this._addWorkNote(params.incident_sys_id,
            'Resolved: ' + params.resolution_notes);

        // 3. Optionally create knowledge article
        if (params.create_knowledge) {
            results.knowledge_article = this._createKnowledgeArticle({
                source_incident: params.incident_sys_id,
                content: params.resolution_notes
            });
        }

        // 4. Notify requester
        results.notification = this._notifyRequester(params.incident_sys_id);

        return {
            status: 'success',
            actions_taken: Object.keys(results),
            details: results
        };
    }
};
```

## Multi-Step Orchestration

### Sequential Processing

```javascript
// Process a complex request step by step
var WorkflowAgent = {

    processRequest: function(request) {
        var steps = [
            { name: 'classify', fn: this.classifyRequest },
            { name: 'gather_context', fn: this.gatherContext },
            { name: 'determine_action', fn: this.determineAction },
            { name: 'execute_action', fn: this.executeAction },
            { name: 'verify_result', fn: this.verifyResult }
        ];

        var context = { request: request, results: {} };

        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            try {
                context.results[step.name] = step.fn.call(this, context);

                // Check if we should stop early
                if (context.results[step.name].stop) {
                    break;
                }
            } catch (e) {
                return this.handleStepError(step.name, e, context);
            }
        }

        return this.formatFinalResult(context);
    }
};
```

### Parallel Processing

```javascript
// Execute independent operations in parallel
var ParallelAgent = {

    gatherContext: function(incident_sys_id) {
        // These queries are independent and can run in parallel
        var queries = [
            { name: 'incident', fn: this.getIncident },
            { name: 'related_incidents', fn: this.getRelatedIncidents },
            { name: 'change_requests', fn: this.getRelatedChanges },
            { name: 'knowledge_articles', fn: this.searchKnowledge },
            { name: 'user_history', fn: this.getUserHistory }
        ];

        // In ServiceNow, use GlideAjax or parallel script execution
        var results = {};
        queries.forEach(function(q) {
            results[q.name] = q.fn.call(this, incident_sys_id);
        }, this);

        return results;
    }
};
```

### Conditional Branching

```javascript
// Choose action based on classification
var BranchingAgent = {

    processIncident: function(incident) {
        // Classify the incident
        var classification = this.classify(incident);

        // Branch based on classification
        switch (classification.type) {
            case 'password_reset':
                return this.handlePasswordReset(incident);

            case 'hardware_issue':
                return this.handleHardwareIssue(incident);

            case 'software_request':
                return this.handleSoftwareRequest(incident);

            case 'complex':
                // Escalate to human
                return this.escalateToHuman(incident, classification.reason);

            default:
                return this.handleGeneric(incident);
        }
    }
};
```

## Error Handling Strategies

### Retry with Backoff

```javascript
var RetryStrategy = {
    maxRetries: 3,
    baseDelay: 1000, // ms

    executeWithRetry: function(fn, context) {
        var attempt = 0;
        var lastError;

        while (attempt < this.maxRetries) {
            try {
                return fn.call(context);
            } catch (e) {
                lastError = e;
                attempt++;

                if (this.isRetryable(e) && attempt < this.maxRetries) {
                    var delay = this.baseDelay * Math.pow(2, attempt);
                    this.sleep(delay);
                } else {
                    break;
                }
            }
        }

        throw new Error('Max retries exceeded: ' + lastError.message);
    },

    isRetryable: function(error) {
        var retryableErrors = ['rate_limit', 'timeout', 'temporary_failure'];
        return retryableErrors.some(function(e) {
            return error.message.includes(e);
        });
    }
};
```

### Graceful Degradation

```javascript
var DegradationStrategy = {

    executeWithFallback: function(primaryFn, fallbackFn, context) {
        try {
            var result = primaryFn.call(context);

            if (this.isValidResult(result)) {
                return { source: 'primary', result: result };
            }
        } catch (e) {
            gs.warn('Primary execution failed: ' + e.message);
        }

        // Try fallback
        try {
            var fallbackResult = fallbackFn.call(context);
            return { source: 'fallback', result: fallbackResult };
        } catch (e) {
            gs.error('Fallback also failed: ' + e.message);
            return { source: 'none', error: 'All strategies failed' };
        }
    }
};
```

### Human Escalation

```javascript
var EscalationStrategy = {

    shouldEscalate: function(context) {
        return (
            context.confidence < 0.7 ||
            context.iteration > 5 ||
            context.errors.length > 2 ||
            context.classification === 'sensitive'
        );
    },

    escalate: function(context, reason) {
        // Create task for human review
        var task = new GlideRecord('task');
        task.initialize();
        task.short_description = 'Agent escalation: ' + reason;
        task.description = JSON.stringify({
            original_request: context.request,
            agent_actions: context.history,
            escalation_reason: reason
        });
        task.assignment_group = this.getEscalationGroup(context);
        task.insert();

        return {
            status: 'escalated',
            task_number: task.number.toString(),
            reason: reason
        };
    }
};
```

## Testing Agentic Systems

### Unit Testing Tools

```javascript
describe('SearchKnowledgeTool', function() {

    it('should return relevant articles', function() {
        var result = SearchKnowledgeTool.execute({
            query: 'password reset',
            limit: 5
        });

        expect(result.articles).toBeDefined();
        expect(result.articles.length).toBeLessThanOrEqual(5);
    });

    it('should handle no results gracefully', function() {
        var result = SearchKnowledgeTool.execute({
            query: 'xyznonexistent123'
        });

        expect(result.count).toBe(0);
        expect(result.articles).toEqual([]);
    });
});
```

### Integration Testing Agent Loops

```javascript
describe('IncidentAgent', function() {

    it('should resolve simple password reset', function() {
        var agent = new IncidentAgent();
        var result = agent.run({
            type: 'incident',
            description: 'Cannot login, need password reset',
            user: 'test_user'
        });

        expect(result.status).toBe('resolved');
        expect(result.actions_taken).toContain('password_reset');
    });

    it('should escalate complex issues', function() {
        var agent = new IncidentAgent();
        var result = agent.run({
            type: 'incident',
            description: 'Multiple systems down affecting entire department',
            priority: 1
        });

        expect(result.status).toBe('escalated');
        expect(result.assignment_group).toBeDefined();
    });
});
```

## Best Practices

### 1. Limit Agent Scope
- Define clear boundaries for what the agent can and cannot do
- Require human approval for destructive or irreversible actions

### 2. Maintain Audit Trail
- Log all agent decisions and actions
- Store reasoning for later review

### 3. Implement Circuit Breakers
- Set maximum iterations
- Monitor for loops and repeated failures
- Automatic escalation when stuck

### 4. Design for Observability
- Emit structured logs
- Track metrics (success rate, avg iterations, escalation rate)
- Enable tracing for debugging

### 5. Start Simple
- Begin with narrow, well-defined tasks
- Expand scope gradually as confidence grows
- Always have a human-in-the-loop option
