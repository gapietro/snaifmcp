# ServiceNow Troubleshooting Guide

This guide covers common debugging patterns, diagnostic tools, and troubleshooting workflows for ServiceNow and Now Assist development.

---

## System Logs (syslog)

System logs are the primary debugging tool for server-side issues.

### Accessing Syslogs

```javascript
// Log levels in order of severity
gs.debug('Debug message');      // Level: Debug (most verbose)
gs.info('Info message');        // Level: Info
gs.warn('Warning message');     // Level: Warning
gs.error('Error message');      // Level: Error (most severe)
```

### Syslog Table Structure

| Field | Description |
|-------|-------------|
| `sys_created_on` | Timestamp of log entry |
| `level` | Log level (0=Debug, 1=Info, 2=Warning, 3=Error) |
| `message` | Log message content |
| `source` | Script or source that generated the log |
| `sys_id` | Unique identifier |

### Filtering Syslogs

```javascript
// Query recent errors
var gr = new GlideRecord('syslog');
gr.addQuery('level', '>=', 2); // Warning and above
gr.addQuery('sys_created_on', '>=', gs.daysAgo(1));
gr.orderByDesc('sys_created_on');
gr.setLimit(100);
gr.query();
```

### Best Practices

1. **Use meaningful prefixes** - Tag logs with component names
   ```javascript
   gs.info('[MySkill] Processing request: ' + requestId);
   ```

2. **Log entry and exit points** - Track execution flow
   ```javascript
   gs.debug('[MySkill] START: processInput');
   // ... logic ...
   gs.debug('[MySkill] END: processInput, result=' + result);
   ```

3. **Avoid logging sensitive data** - Never log passwords, tokens, or PII

4. **Use appropriate levels** - Reserve error for actual failures

---

## AI Agent (AIA) Execution Logs

For debugging Now Assist and AI Agent issues.

### Key Tables

| Table | Purpose |
|-------|---------|
| `sys_aia_execution` | Agent execution records |
| `sys_aia_execution_step` | Individual step details |
| `sys_aia_skill_execution` | Skill invocation logs |
| `sn_gai_skill_log` | GenAI skill execution logs |

### Querying AIA Logs

```javascript
// Get recent AI Agent executions
var gr = new GlideRecord('sys_aia_execution');
gr.addQuery('sys_created_on', '>=', gs.hoursAgo(1));
gr.orderByDesc('sys_created_on');
gr.query();

while (gr.next()) {
    gs.info('Execution: ' + gr.sys_id);
    gs.info('Status: ' + gr.state);
    gs.info('Agent: ' + gr.agent.getDisplayValue());
}
```

### Execution States

| State | Meaning |
|-------|---------|
| `pending` | Queued for processing |
| `running` | Currently executing |
| `completed` | Finished successfully |
| `failed` | Execution failed |
| `cancelled` | Manually cancelled |

### Debugging Failed Executions

1. Check `error_message` field for failure reason
2. Review execution steps for partial completion
3. Check skill logs for input/output issues
4. Verify tool configurations and permissions

---

## Background Script Debugging

### Safe Debugging Pattern

```javascript
// Always wrap in try-catch for background scripts
try {
    var result = myFunction();
    gs.info('Result: ' + JSON.stringify(result));
} catch (e) {
    gs.error('Error: ' + e.message);
    gs.error('Stack: ' + e.stack);
}
```

### Read-Only Testing

```javascript
// Test queries without modifying data
var gr = new GlideRecord('incident');
gr.addQuery('priority', 1);
gr.setLimit(5);
gr.query();

gs.info('Found ' + gr.getRowCount() + ' P1 incidents');
while (gr.next()) {
    gs.info('  - ' + gr.number + ': ' + gr.short_description);
}
// No insert/update/delete = safe to run
```

### Avoiding Dangerous Operations

Never run these without explicit approval:
- `gr.deleteMultiple()` - Bulk delete
- `gr.updateMultiple()` - Bulk update
- `GlideRecord.deleteRecord()` - Single delete
- Direct table truncation
- Workflow/flow modifications

---

## Common Issues and Solutions

### 1. Script Include Not Found

**Symptom:** `TypeError: Cannot call method of null`

**Causes:**
- Script Include not active
- Incorrect API name
- Scope issues (cross-scope access)

**Solution:**
```javascript
// Check if Script Include exists
var si = new GlideRecord('sys_script_include');
si.addQuery('api_name', 'MyScriptInclude');
si.query();
if (si.next()) {
    gs.info('Found: ' + si.api_name + ', Active: ' + si.active);
} else {
    gs.error('Script Include not found');
}
```

### 2. ACL Blocking Access

**Symptom:** Empty results or "no access" errors

**Debug:**
```javascript
// Check user roles
var roles = gs.getUser().getRoles();
gs.info('User roles: ' + roles);

// Test with elevated privileges (debug only!)
var gr = new GlideRecord('table_name');
gr.addQuery('field', 'value');
gs.info('Before: ' + gr.canRead());
```

### 3. Slow Script Performance

**Symptom:** Timeouts or slow execution

**Common causes:**
- Missing indexes on query fields
- N+1 query patterns
- Large result sets without limits

**Solution:**
```javascript
// Bad: N+1 queries
incidents.forEach(function(inc) {
    var user = getUserDetails(inc.assigned_to); // Query per record!
});

// Good: Batch query
var userIds = incidents.map(function(inc) { return inc.assigned_to; });
var users = getUserDetailsBatch(userIds); // Single query
```

### 4. Now Assist Skill Not Responding

**Checklist:**
1. Is the skill active?
2. Are required properties configured?
3. Check GenAI Controller logs
4. Verify NLU model is trained (if applicable)
5. Check skill execution logs

```javascript
// Check skill configuration
var skill = new GlideRecord('sn_gai_skill');
skill.addQuery('name', 'MySkill');
skill.query();
if (skill.next()) {
    gs.info('Active: ' + skill.active);
    gs.info('Category: ' + skill.category);
}
```

---

## Debugging Workflows

### 1. Identify the Issue

- Reproduce the problem consistently
- Note exact error messages
- Identify affected scope/application

### 2. Gather Information

- Check system logs (filter by time and source)
- Review execution logs for async operations
- Check user permissions and roles

### 3. Isolate the Problem

- Test in background script with minimal code
- Remove complexity until issue disappears
- Add back components to find the cause

### 4. Fix and Verify

- Implement fix in development instance
- Test thoroughly before promoting
- Document the issue and solution

---

## Useful Diagnostic Scripts

### Check Table Record Counts

```javascript
var tables = ['incident', 'sc_request', 'syslog'];
tables.forEach(function(table) {
    var gr = new GlideRecord(table);
    gr.query();
    gs.info(table + ': ' + gr.getRowCount() + ' records');
});
```

### Find Recent Script Errors

```javascript
var gr = new GlideRecord('syslog');
gr.addQuery('level', 3); // Errors only
gr.addQuery('sys_created_on', '>=', gs.hoursAgo(1));
gr.orderByDesc('sys_created_on');
gr.setLimit(20);
gr.query();

while (gr.next()) {
    gs.info('[' + gr.sys_created_on + '] ' + gr.message.substring(0, 200));
}
```

### Check Active Sessions

```javascript
var gr = new GlideRecord('v_user_session');
gr.query();
gs.info('Active sessions: ' + gr.getRowCount());
```

---

## Related Resources

- [Now Assist Platform](./now-assist-platform.md) - Platform architecture
- [GenAI Framework](./genai-framework.md) - Skill development
- [Agentic Patterns](./agentic-patterns.md) - Agent debugging

---

*Part of the Foundry golden repository*
