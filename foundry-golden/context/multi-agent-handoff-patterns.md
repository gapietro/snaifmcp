# Multi-Agent Handoff Patterns — ServiceNow Zurich

> Context sharing mechanisms, failure propagation, result aggregation, handoff conditions, memory across agents, recursive execution controls, and follow-up behavior configuration for multi-agent workflows.

---

## Overview

In ServiceNow Zurich, complex use cases are solved by **orchestrator agents** that dispatch to **child agents**. Each child agent is a specialist — focused on one domain or task. The orchestrator coordinates their work.

This document covers the mechanics of how agents hand off work to each other, share context, handle failures, and aggregate results.

---

## Architecture Recap

```
Agentic Workflow (sn_aia_usecase)
    └── Orchestrator Agent
            ├── Child Agent A (specialist)
            │       ├── Tool A1
            │       └── Tool A2
            ├── Child Agent B (specialist)
            │       └── Tool B1
            └── Child Agent C (specialist)
                    └── Tool C1
```

The orchestrator is itself an AI agent with a strategy (typically ReAct). It "calls" child agents the same way it calls tools — the platform handles routing.

---

## Context Sharing Mechanisms

### How Context Flows Between Agents

When an orchestrator dispatches to a child agent, context is shared via the **context sharing strategy**:

| Strategy | Property | Behavior |
|----------|----------|----------|
| **Summarize** (default) | `sn_aia.context_sharing_strategy = summarise` | Previous context is summarized and passed to the next agent |
| **Full context** | Custom configuration | Full conversation history is passed (higher token usage) |
| **No sharing** | Disabled | Each agent starts with a clean slate |

### Controlling Context Sharing

```
System property: sn_aia.allow_context_sharing
Default: true

When true: Orchestrator's context (including child agent results) is
summarized and available to subsequent child agents in the same workflow.
```

### What Gets Shared

| Shared | Not Shared |
|--------|------------|
| Orchestrator's objective | Child agent's internal reasoning steps |
| Tool inputs and outputs | Child agent's intermediate tool calls |
| Child agent's final response | Debug/trace information |
| Summary of prior child executions | Full conversation transcript |

### Design Implications

1. **Child agents should return self-contained results** — don't assume the next agent can see your intermediate steps.
2. **The orchestrator's instructions should specify what to pass** — "Include the incident number and triage results when dispatching to the resolution agent."
3. **Keep child agent outputs concise** — they become context for the orchestrator, which adds to token usage.

---

## Handoff Conditions

### When to Dispatch to a Child Agent

The orchestrator decides when to dispatch based on its instructions. Common patterns:

#### Pattern 1: Task-Based Dispatch

```
Orchestrator instructions:
"Analyze the request and determine which specialist to use:
- If the task involves CREATING or MODIFYING tool scripts → dispatch to Tool Builder
- If the task involves WRITING agent instructions → dispatch to Agent Configurator
- If the task involves TESTING or DEBUGGING → dispatch to QA Debugger
- If the task involves multiple of the above → dispatch sequentially, starting with Tool Builder"
```

#### Pattern 2: Stage-Based Dispatch

```
Orchestrator instructions:
"Follow this pipeline for every POC request:
1. First, dispatch to Solution Designer to create the architecture spec
2. Using the spec, dispatch to Tool Builder for each tool in the spec
3. Dispatch to Agent Configurator with the tools and spec
4. Finally, dispatch to QA Debugger to test everything
Report results after each stage."
```

#### Pattern 3: Conditional Dispatch

```
Orchestrator instructions:
"After initial analysis:
- If this is a simple single-agent use case → handle directly without child agents
- If this requires 2+ agents → dispatch to Solution Designer first
- If this is a debugging request → dispatch to QA Debugger directly"
```

### Handoff Data Format

When dispatching to a child agent, the orchestrator should provide:

```
Dispatch to [Child Agent]:
{
  "task": "Brief description of what to do",
  "context": {
    "source": "What the user originally asked",
    "prior_results": "What other agents have already done",
    "constraints": "Any specific requirements or limitations"
  },
  "expected_output": "What the orchestrator needs back"
}
```

---

## Failure Propagation

### How Failures Flow

```
Child Agent fails
    ↓
Child returns error to Orchestrator
    ↓
Orchestrator decides:
    ├── Retry the same child agent
    ├── Try a different child agent
    ├── Handle the failure itself
    └── Escalate to human
```

### Orchestrator Failure Handling Instructions

```
Orchestrator instructions:
"## Handling Child Agent Failures

If a child agent returns an error:
1. Read the error message carefully
2. Categorize the failure:
   - TRANSIENT (timeout, rate limit) → Retry once
   - DATA ISSUE (missing record, ACL) → Report to user, suggest fix
   - LOGIC ERROR (wrong output, invalid script) → Adjust instructions and retry
   - UNKNOWN → Escalate to human

3. Never retry more than once for the same error
4. If two different child agents fail on the same task, escalate to human"
```

### Child Agent Error Reporting

Child agents should return structured error information:

```
Child agent instructions:
"If you encounter an error you cannot resolve:
Return this format:
{
  'status': 'failed',
  'error_type': 'script_error|acl_error|data_error|timeout|unknown',
  'error_message': 'Clear description of what went wrong',
  'partial_results': 'Any work completed before the failure',
  'suggested_fix': 'What might resolve this issue'
}"
```

---

## Result Aggregation

### How the Orchestrator Collects Results

The orchestrator receives results from each child agent and must aggregate them into a coherent response.

#### Pattern: Sequential Aggregation

```
Orchestrator instructions:
"After each child agent completes, record:
- Agent name
- Task assigned
- Result (success/failure)
- Key outputs (sys_ids, numbers, etc.)

After ALL child agents have completed, compile a summary:
=== Solution Build Report ===
Components created:
- Tools: [list with sys_ids]
- Agents: [list with sys_ids]
- Skills: [list with sys_ids]
Test results: [pass/fail summary]
Issues found: [list]
=== End Report ==="
```

#### Pattern: Dependency-Aware Aggregation

When later agents need outputs from earlier agents:

```
Orchestrator instructions:
"1. Dispatch Tool Builder → receives: tool_sys_ids
2. Dispatch Agent Configurator with tool_sys_ids → receives: agent_sys_id
3. Dispatch QA Debugger with agent_sys_id → receives: test_results

Pass the output of each step as input to the next step.
If step N fails, do NOT proceed to step N+1."
```

---

## Memory Across Agents

### Short-Term Memory (Within a Conversation)

- Controlled by `sn_aia.context_sharing_strategy`
- Default is `summarise` — previous context is condensed
- Available within the same agentic workflow execution

### Long-Term Memory (Across Conversations)

When enabled, agents can remember user preferences across separate conversations:

| Property | Default | Description |
|----------|---------|-------------|
| `sn_aia.ltm.enable_long_term_memory` | false | Enable long-term memory |
| `sn_aia.ltm.category.auto_create` | true | Auto-create memory categories |
| `sn_aia.ltm.enable_auto_memorize` | false | Automatically store interactions |

### Memory Design Considerations

1. **Short-term memory is automatic** — just ensure context sharing is enabled
2. **Long-term memory requires explicit enablement** — and should be used carefully for privacy
3. **Child agents don't have independent memory** — they inherit context from the orchestrator
4. **Memory across workflow runs is NOT automatic** — each trigger creates a fresh execution

---

## Recursive Execution Controls

### Platform Protections

ServiceNow prevents infinite loops in multi-agent workflows:

| Operation | Limit | Time Window |
|-----------|-------|-------------|
| **Create triggers** | 50 matching executions | 15 minutes |
| **Update triggers** | 5 matching executions | 15 minutes |

If an agent's action triggers another agent, which triggers another agent, etc., the platform will abort new executions after hitting these limits.

### Design Safeguards

#### Pattern: Depth Tracking

```
Orchestrator instructions:
"Track the depth of dispatch:
- Level 0: Orchestrator (you)
- Level 1: First child agent
- Level 2: Child of child (if applicable)

NEVER dispatch beyond Level 2. If a child agent needs help from another specialist,
return to the orchestrator and let it dispatch the second specialist."
```

#### Pattern: Loop Detection

```
Orchestrator instructions:
"Keep a list of tasks you've dispatched. If you find yourself dispatching
the same task to the same agent a second time, STOP and report:
'Detected potential loop: [task] was sent to [agent] twice. Human review needed.'"
```

#### Pattern: Execution Budget

```
Orchestrator instructions:
"You have a budget of 10 total child agent dispatches per request.
After 10 dispatches, compile whatever results you have and report to the user.
Do not continue dispatching."
```

---

## Follow-Up Behavior Configuration

### After Execution Completes

| Property | Default | Description |
|----------|---------|-------------|
| `sn_aia.follow_up_message` | "How else can I help you?" | Message shown after completion |
| `follow_up_behaviour` | Per workflow | Controls what happens after completion |
| `sn_aia.follow_up_qna_failure_limit` | 1 | Exit after N consecutive follow-up failures |

### Follow-Up Patterns

#### Pattern: Continue in Context

```
Workflow config:
  follow_up_behaviour: "continue"

After the agent completes:
  - Shows follow-up message
  - User can ask related questions
  - Context from the completed task is available
```

#### Pattern: End After Completion

```
Workflow config:
  follow_up_behaviour: "end"

After the agent completes:
  - Conversation ends
  - No follow-up questions accepted
  - Suitable for triggered/automated workflows
```

#### Pattern: Handoff After Completion

```
Workflow config:
  follow_up_behaviour: "handoff"

After the agent completes:
  - Transfers to a different agent or live support
  - Used when the completing agent is a specialist and the user may have broader needs
```

---

## Multi-Agent Design Checklist

### Before Building

- [ ] Each child agent has a clearly defined, non-overlapping responsibility
- [ ] Orchestrator instructions specify dispatch conditions for each child
- [ ] Data dependencies between agents are mapped (who needs what from whom)
- [ ] Failure handling is defined for each possible child agent failure
- [ ] Recursive execution limits are considered
- [ ] Follow-up behavior is configured

### During Testing

- [ ] Test each child agent independently before testing the full workflow
- [ ] Test orchestrator dispatch logic with mock child responses
- [ ] Test failure scenarios (child fails, child times out, child returns wrong format)
- [ ] Verify context sharing works (child receives needed context from orchestrator)
- [ ] Verify result aggregation is correct
- [ ] Test recursive execution protection (no infinite loops)

### Common Mistakes

| Mistake | Consequence | Fix |
|---------|------------|-----|
| Child agents with overlapping scope | Orchestrator dispatches to wrong child | Make scopes mutually exclusive |
| No failure handling in orchestrator | Workflow hangs on child failure | Add explicit error handling instructions |
| Passing too much context to children | Token budget exceeded, slow execution | Summarize context before dispatch |
| Not testing children independently | Can't isolate failures | Test each agent in isolation first |
| No execution budget | Runaway dispatches | Set max dispatch limit in instructions |

---

## Related Resources

- [Agentic Patterns](./agentic-patterns.md) — Orchestration architecture and strategies
- [Agent Instruction Templates](./agent-instruction-templates.md) — Templates for orchestrator instructions
- [ServiceNow AI Data Model](./servicenow-ai-data-model.md) — Workflow and execution tables
- [ServiceNow AI System Properties](./servicenow-ai-system-properties.md) — Memory and follow-up properties

---

*Patterns validated against ServiceNow Zurich agentic workflow architecture. Context sharing and recursive protection match Zurich platform behavior.*
