# ServiceNow Troubleshooting MCP Tools - Design Document

**Status:** Draft
**Author:** AI Foundry Team
**Created:** 2026-01-29
**Last Updated:** 2026-01-29

---

## Executive Summary

This document specifies a set of MCP tools that give Claude Code direct access to ServiceNow instances for troubleshooting, debugging, and testing. These tools enable real-time log analysis, AI Agent execution tracing, and controlled script execution - turning Claude into a powerful ServiceNow debugging assistant.

---

## Problem Statement

When troubleshooting Now Assist or Agentic implementations, developers currently must:

1. **Manually navigate** System Logs, AIA execution records, and debug tables
2. **Copy/paste** log entries and error messages to Claude for analysis
3. **Switch contexts** between Claude Code and ServiceNow constantly
4. **Manually execute** background scripts to test hypotheses
5. **Lose time** on repetitive log-gathering tasks

**Impact:** Hours spent on tasks that could be seconds with direct integration.

---

## Proposed Solution

Add ServiceNow integration tools to the Foundry MCP server that allow Claude to:

| Capability | Tool | Description |
|------------|------|-------------|
| **Connect** | `servicenow_connect` | Authenticate to a ServiceNow instance |
| **System Logs** | `servicenow_syslogs` | Query and filter syslog entries |
| **AIA Logs** | `servicenow_aia_logs` | Get AI Agent execution traces |
| **Background Scripts** | `servicenow_script` | Execute scripts with safety rails |
| **GlideRecord Queries** | `servicenow_query` | Run read-only table queries |
| **Instance Info** | `servicenow_instance` | Get instance metadata and health |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│                           │                                      │
│                     MCP Client                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Foundry MCP Server                            │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │  Foundry Tools   │  │     ServiceNow Tools                 │ │
│  │  - foundry_init  │  │  - servicenow_connect                │ │
│  │  - foundry_list  │  │  - servicenow_syslogs                │ │
│  │  - foundry_add   │  │  - servicenow_aia_logs               │ │
│  │  - foundry_sync  │  │  - servicenow_script                 │ │
│  └──────────────────┘  │  - servicenow_query                  │ │
│                        │  - servicenow_instance               │ │
│                        └──────────────────────────────────────┘ │
│                                     │                            │
│                        ┌────────────┴────────────┐              │
│                        │   Connection Manager    │              │
│                        │   - Auth handling       │              │
│                        │   - Session cache       │              │
│                        │   - Rate limiting       │              │
│                        └────────────┬────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ServiceNow Instance                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  REST API   │  │ Table API   │  │ Scripted REST API       │  │
│  │  /api/now/* │  │ /api/now/   │  │ /api/x_snc_foundry/*    │  │
│  │             │  │ table/*     │  │ (custom endpoints)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Target Tables                             ││
│  │  - syslog                    (System Logs)                   ││
│  │  - syslog_app_scope          (Scoped App Logs)               ││
│  │  - sys_aia_execution         (AIA Execution Records)         ││
│  │  - sys_aia_tool_execution    (Tool Execution Details)        ││
│  │  - sn_agent_*                (Agent Framework Tables)        ││
│  │  - sys_script_execution      (Background Script Results)     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **MCP Tools** | Define tool schemas, handle requests, format responses |
| **Connection Manager** | Auth, session caching, token refresh, rate limiting |
| **ServiceNow Client** | HTTP requests, error handling, response parsing |
| **Safety Layer** | Script validation, read-only enforcement, audit logging |

---

## Authentication

### Supported Methods

#### 1. OAuth 2.0 (Recommended for Production)

```typescript
interface OAuthConfig {
  type: 'oauth';
  instance: string;           // e.g., 'dev12345.service-now.com'
  clientId: string;
  clientSecret: string;
  refreshToken?: string;      // For token refresh
}
```

**Flow:**
1. User provides OAuth app credentials
2. Tool exchanges for access token
3. Refresh token stored securely for session
4. Auto-refresh on expiration

**Setup Requirements:**
- OAuth Application registered in ServiceNow
- Redirect URI configured (for initial auth)
- Required scopes: `useraccount`, `api`

#### 2. Basic Auth (Dev/PDI Instances)

```typescript
interface BasicAuthConfig {
  type: 'basic';
  instance: string;
  username: string;
  password: string;
}
```

**Use Cases:**
- Personal Developer Instances (PDIs)
- Quick testing and prototyping
- Instances without OAuth configured

**Security Notes:**
- Credentials transmitted in headers (use HTTPS only)
- Should not be used for production instances
- Consider using service account, not personal credentials

#### 3. API Token (Service Accounts)

```typescript
interface TokenConfig {
  type: 'token';
  instance: string;
  token: string;              // API key or integration token
}
```

**Use Cases:**
- CI/CD pipelines
- Automated testing
- Service-to-service integration

### Credential Storage

#### Option A: Environment Variables

```bash
# .env file (gitignored)
SERVICENOW_INSTANCE=dev12345.service-now.com
SERVICENOW_AUTH_TYPE=basic
SERVICENOW_USERNAME=admin
SERVICENOW_PASSWORD=********
```

#### Option B: Credentials File

```json
// ~/.servicenow/credentials.json (chmod 600)
{
  "profiles": {
    "dev": {
      "instance": "dev12345.service-now.com",
      "type": "basic",
      "username": "admin",
      "password": "encrypted:AES256:..."
    },
    "prod": {
      "instance": "prod.service-now.com",
      "type": "oauth",
      "clientId": "...",
      "clientSecret": "encrypted:AES256:...",
      "refreshToken": "encrypted:AES256:..."
    }
  },
  "default": "dev"
}
```

#### Option C: Interactive Prompt

```
Claude: I need to connect to your ServiceNow instance.
        Please provide the instance URL and credentials.

User: dev12345.service-now.com, username: admin, password: ****

Claude: Connected successfully to dev12345. Session will remain
        active for this conversation.
```

### Session Management

```typescript
interface ConnectionSession {
  instanceUrl: string;
  authType: 'oauth' | 'basic' | 'token';
  accessToken?: string;
  tokenExpiry?: Date;
  refreshToken?: string;
  userId?: string;
  userRoles?: string[];
  createdAt: Date;
  lastUsed: Date;
}
```

**Session Behavior:**
- Sessions persist for conversation duration
- Auto-reconnect on token expiry (OAuth)
- Clear sessions on explicit disconnect
- No credential persistence between conversations (security)

---

## Tool Specifications

### 1. `servicenow_connect`

Establish connection to a ServiceNow instance.

```typescript
const SERVICENOW_CONNECT_TOOL: Tool = {
  name: "servicenow_connect",
  description: "Connect to a ServiceNow instance for troubleshooting. Supports OAuth, basic auth, or API token authentication.",
  inputSchema: {
    type: "object",
    properties: {
      instance: {
        type: "string",
        description: "ServiceNow instance URL (e.g., 'dev12345.service-now.com')"
      },
      authType: {
        type: "string",
        enum: ["oauth", "basic", "token", "profile"],
        description: "Authentication method to use"
      },
      profile: {
        type: "string",
        description: "Named profile from credentials file (if authType is 'profile')"
      },
      username: {
        type: "string",
        description: "Username for basic auth"
      },
      password: {
        type: "string",
        description: "Password for basic auth"
      },
      token: {
        type: "string",
        description: "API token for token auth"
      },
      clientId: {
        type: "string",
        description: "OAuth client ID"
      },
      clientSecret: {
        type: "string",
        description: "OAuth client secret"
      }
    },
    required: ["instance"]
  }
};
```

**Response:**
```json
{
  "status": "connected",
  "instance": "dev12345.service-now.com",
  "instanceVersion": "Vancouver",
  "user": "admin",
  "roles": ["admin", "x_snc_now_assist.admin"],
  "sessionId": "abc123"
}
```

### 2. `servicenow_syslogs`

Query system logs with filtering.

```typescript
const SERVICENOW_SYSLOGS_TOOL: Tool = {
  name: "servicenow_syslogs",
  description: "Query ServiceNow system logs. Filter by level, source, message content, and time range.",
  inputSchema: {
    type: "object",
    properties: {
      level: {
        type: "string",
        enum: ["error", "warning", "info", "debug", "all"],
        description: "Log level to filter (default: 'error')"
      },
      source: {
        type: "string",
        description: "Log source filter (e.g., 'GenAI Controller', 'Now Assist')"
      },
      message: {
        type: "string",
        description: "Text search in log message"
      },
      timeRange: {
        type: "string",
        enum: ["1h", "4h", "12h", "24h", "7d"],
        description: "Time range to search (default: '1h')"
      },
      limit: {
        type: "number",
        description: "Maximum number of logs to return (default: 50, max: 500)"
      },
      scope: {
        type: "string",
        description: "Application scope filter (e.g., 'x_snc_now_assist')"
      }
    }
  }
};
```

**Response:**
```json
{
  "count": 12,
  "timeRange": "1h",
  "logs": [
    {
      "sysId": "abc123",
      "level": "error",
      "source": "GenAI Controller",
      "message": "Failed to invoke skill: timeout after 30000ms",
      "timestamp": "2026-01-29T10:15:32Z",
      "user": "system",
      "scope": "x_snc_now_assist",
      "stackTrace": "Error: ETIMEDOUT\n    at ..."
    }
  ]
}
```

### 3. `servicenow_aia_logs`

Query AI Agent (AIA) execution logs.

```typescript
const SERVICENOW_AIA_LOGS_TOOL: Tool = {
  name: "servicenow_aia_logs",
  description: "Get AI Agent execution traces. Shows agent steps, tool calls, decisions, and outcomes.",
  inputSchema: {
    type: "object",
    properties: {
      executionId: {
        type: "string",
        description: "Specific execution ID to retrieve"
      },
      agentName: {
        type: "string",
        description: "Filter by agent name"
      },
      status: {
        type: "string",
        enum: ["success", "failure", "running", "all"],
        description: "Filter by execution status"
      },
      timeRange: {
        type: "string",
        enum: ["1h", "4h", "12h", "24h", "7d"],
        description: "Time range to search"
      },
      limit: {
        type: "number",
        description: "Maximum number of executions to return (default: 20)"
      },
      includeToolCalls: {
        type: "boolean",
        description: "Include detailed tool execution logs (default: true)"
      }
    }
  }
};
```

**Response:**
```json
{
  "count": 3,
  "executions": [
    {
      "executionId": "exec123",
      "agentName": "IT Support Agent",
      "status": "failure",
      "startTime": "2026-01-29T10:12:00Z",
      "endTime": "2026-01-29T10:12:45Z",
      "duration": 45000,
      "triggerType": "user_message",
      "triggerContext": {
        "channel": "Virtual Agent",
        "user": "abel.tuter"
      },
      "steps": [
        {
          "stepNumber": 1,
          "type": "tool_call",
          "toolName": "searchKnowledge",
          "input": {"query": "password reset"},
          "output": {"articles": []},
          "duration": 1200,
          "status": "success"
        },
        {
          "stepNumber": 2,
          "type": "tool_call",
          "toolName": "createIncident",
          "input": {"short_description": "..."},
          "error": "ACL denied: caller lacks itil role",
          "duration": 350,
          "status": "failure"
        }
      ],
      "errorSummary": "Tool 'createIncident' failed: ACL denied"
    }
  ]
}
```

### 4. `servicenow_script`

Execute background scripts with safety controls.

```typescript
const SERVICENOW_SCRIPT_TOOL: Tool = {
  name: "servicenow_script",
  description: "Execute a background script on ServiceNow for testing and debugging. Includes safety rails and audit logging.",
  inputSchema: {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "GlideScript to execute"
      },
      mode: {
        type: "string",
        enum: ["readonly", "dryrun", "execute"],
        description: "Execution mode: readonly (no mutations), dryrun (log but don't commit), execute (full execution)"
      },
      timeout: {
        type: "number",
        description: "Script timeout in seconds (default: 30, max: 300)"
      },
      scope: {
        type: "string",
        description: "Application scope to run in (default: global)"
      },
      description: {
        type: "string",
        description: "Description of what this script does (for audit log)"
      }
    },
    required: ["script"]
  }
};
```

**Response:**
```json
{
  "status": "success",
  "mode": "readonly",
  "executionId": "script123",
  "duration": 1250,
  "output": "Found 15 incidents in 'New' state\nOldest: INC0012345 (created 2026-01-15)",
  "logs": [
    {"level": "info", "message": "Query returned 15 records"},
    {"level": "debug", "message": "Execution time: 1.2s"}
  ],
  "mutationsBlocked": 0,
  "auditRecord": "sys_script_execution:audit789"
}
```

### 5. `servicenow_query`

Execute GlideRecord queries (read-only).

```typescript
const SERVICENOW_QUERY_TOOL: Tool = {
  name: "servicenow_query",
  description: "Query ServiceNow tables using GlideRecord-style syntax. Read-only by default.",
  inputSchema: {
    type: "object",
    properties: {
      table: {
        type: "string",
        description: "Table name to query (e.g., 'incident', 'sys_user')"
      },
      query: {
        type: "string",
        description: "Encoded query string (e.g., 'active=true^priority=1')"
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "Fields to return (default: all)"
      },
      limit: {
        type: "number",
        description: "Maximum records to return (default: 100, max: 1000)"
      },
      orderBy: {
        type: "string",
        description: "Field to order by"
      },
      orderDirection: {
        type: "string",
        enum: ["asc", "desc"],
        description: "Order direction"
      }
    },
    required: ["table"]
  }
};
```

**Response:**
```json
{
  "table": "incident",
  "query": "active=true^priority=1",
  "count": 5,
  "records": [
    {
      "sys_id": "abc123",
      "number": "INC0012345",
      "short_description": "Email server down",
      "priority": "1",
      "state": "2",
      "assigned_to": {"display_value": "Beth Anglin", "value": "user123"},
      "sys_created_on": "2026-01-29T08:00:00Z"
    }
  ]
}
```

### 6. `servicenow_instance`

Get instance information and health status.

```typescript
const SERVICENOW_INSTANCE_TOOL: Tool = {
  name: "servicenow_instance",
  description: "Get ServiceNow instance information, version, installed plugins, and health status.",
  inputSchema: {
    type: "object",
    properties: {
      includePlugins: {
        type: "boolean",
        description: "Include list of installed plugins"
      },
      includeHealth: {
        type: "boolean",
        description: "Include instance health metrics"
      },
      checkFeatures: {
        type: "array",
        items: { type: "string" },
        description: "Specific features to check (e.g., ['now_assist', 'virtual_agent', 'aia'])"
      }
    }
  }
};
```

**Response:**
```json
{
  "instance": "dev12345.service-now.com",
  "version": "Vancouver Patch 3",
  "buildTag": "glide-vancouver-12-15-2025",
  "company": "ACME Corp",
  "features": {
    "now_assist": {
      "enabled": true,
      "version": "2.1.0",
      "skills": ["summarize", "generate", "search"]
    },
    "virtual_agent": {
      "enabled": true,
      "topics": 45
    },
    "aia": {
      "enabled": true,
      "agents": 3,
      "activeExecutions": 2
    }
  },
  "health": {
    "status": "healthy",
    "semaphores": {"available": 45, "max": 50},
    "scheduledJobs": {"running": 12, "queued": 3},
    "lastBackup": "2026-01-29T02:00:00Z"
  }
}
```

---

## Safety Rails

### Script Execution Safety

#### 1. Mode Enforcement

| Mode | Behavior |
|------|----------|
| `readonly` | Block all DML operations (insert, update, delete) at API level |
| `dryrun` | Execute in transaction, log changes, rollback |
| `execute` | Full execution with audit trail |

#### 2. Blocked Operations

Scripts are analyzed and blocked if they contain:

```javascript
const BLOCKED_PATTERNS = [
  // Dangerous system operations
  /GlideSystem\.dropTable/i,
  /GlideTableCreator/i,
  /sys_db_object\.deleteRecord/i,

  // Credential access
  /sys_user\.password/i,
  /discovery_credentials/i,
  /oauth_credential/i,

  // System configuration changes
  /sys_properties\.setValue/i,
  /glide\.security/i,

  // Mass operations without limits
  /deleteMultiple\(\)/i,
  /updateMultiple\(\)/i,

  // External calls without approval
  /RESTMessageV2/i,
  /SOAPMessageV2/i,
  /GlideHTTPRequest/i
];
```

#### 3. Execution Limits

```typescript
const SCRIPT_LIMITS = {
  maxExecutionTime: 300,      // 5 minutes max
  maxRecordsAffected: 1000,   // Warn if affecting more
  maxOutputSize: 1024 * 100,  // 100KB output limit
  rateLimitPerMinute: 10,     // Max 10 script executions per minute
};
```

#### 4. Audit Trail

Every script execution creates an audit record:

```typescript
interface ScriptAuditRecord {
  executionId: string;
  timestamp: Date;
  user: string;
  script: string;
  mode: 'readonly' | 'dryrun' | 'execute';
  description: string;
  duration: number;
  recordsAffected: number;
  status: 'success' | 'failure' | 'blocked';
  blockedReason?: string;
  output?: string;
  claudeSessionId?: string;
}
```

### Query Safety

```typescript
const QUERY_LIMITS = {
  maxRecords: 1000,           // Hard limit on returned records
  maxFieldsPerRecord: 50,     // Limit field count
  blockedTables: [            // Tables that require explicit permission
    'sys_user_has_role',
    'sys_user_group',
    'oauth_credential',
    'discovery_credentials',
    'sys_certificate'
  ],
  sensitiveFields: [          // Fields redacted from output
    'password',
    'password_hash',
    'secret',
    'api_key',
    'private_key'
  ]
};
```

---

## Error Handling

### Error Categories

```typescript
enum ServiceNowErrorType {
  // Connection errors
  CONNECTION_FAILED = 'connection_failed',
  AUTHENTICATION_FAILED = 'authentication_failed',
  TOKEN_EXPIRED = 'token_expired',
  INSTANCE_UNAVAILABLE = 'instance_unavailable',

  // Permission errors
  ACL_DENIED = 'acl_denied',
  ROLE_REQUIRED = 'role_required',
  TABLE_NOT_ACCESSIBLE = 'table_not_accessible',

  // Execution errors
  SCRIPT_TIMEOUT = 'script_timeout',
  SCRIPT_ERROR = 'script_error',
  SCRIPT_BLOCKED = 'script_blocked',
  QUERY_ERROR = 'query_error',

  // Rate limiting
  RATE_LIMITED = 'rate_limited',
  QUOTA_EXCEEDED = 'quota_exceeded',

  // Safety blocks
  DANGEROUS_OPERATION = 'dangerous_operation',
  SENSITIVE_DATA = 'sensitive_data'
}
```

### Error Response Format

```json
{
  "error": {
    "type": "acl_denied",
    "message": "Access denied to table 'sys_user_has_role'",
    "details": {
      "table": "sys_user_has_role",
      "operation": "read",
      "requiredRole": "admin",
      "userRoles": ["itil", "x_snc_now_assist.user"]
    },
    "suggestion": "Request 'admin' role or use a different table",
    "documentationUrl": "https://docs.servicenow.com/acl"
  }
}
```

### Retry Logic

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  retryableErrors: [
    'instance_unavailable',
    'token_expired',
    'rate_limited'
  ],
  backoff: {
    initial: 1000,      // 1 second
    multiplier: 2,
    maxDelay: 30000     // 30 seconds
  }
};
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

| Task | Description | Effort |
|------|-------------|--------|
| Connection Manager | Auth handling, session cache, token refresh | 3 days |
| ServiceNow HTTP Client | Request/response, error handling, retries | 2 days |
| `servicenow_connect` tool | Basic auth and OAuth support | 2 days |
| Credentials file support | ~/.servicenow/credentials.json | 1 day |
| Unit tests | Connection and auth tests | 2 days |

### Phase 2: Read Operations (Week 3-4)

| Task | Description | Effort |
|------|-------------|--------|
| `servicenow_syslogs` tool | Syslog querying with filters | 2 days |
| `servicenow_aia_logs` tool | AIA execution trace retrieval | 3 days |
| `servicenow_query` tool | Generic table queries | 2 days |
| `servicenow_instance` tool | Instance info and health | 1 day |
| Integration tests | End-to-end with test instance | 2 days |

### Phase 3: Script Execution (Week 5-6)

| Task | Description | Effort |
|------|-------------|--------|
| Script safety analyzer | Pattern detection, blocked operations | 3 days |
| `servicenow_script` tool | Background script execution | 3 days |
| Audit logging | Execution audit trail | 2 days |
| Dry-run mode | Transaction rollback support | 2 days |
| Security review | Safety rails validation | 1 day |

### Phase 4: Polish & Documentation (Week 7)

| Task | Description | Effort |
|------|-------------|--------|
| Error message improvements | Helpful, actionable errors | 2 days |
| Documentation | User guide, examples, troubleshooting | 2 days |
| Demo script | Live demonstration walkthrough | 1 day |

---

## API Endpoints Used

### Standard ServiceNow APIs

| Endpoint | Purpose |
|----------|---------|
| `POST /oauth_token.do` | OAuth token exchange |
| `GET /api/now/table/{table}` | Table API queries |
| `GET /api/now/stats/{table}` | Aggregate queries |
| `POST /api/now/v1/batch` | Batch requests |

### Tables Accessed

| Table | Purpose |
|-------|---------|
| `syslog` | System log entries |
| `syslog_app_scope` | Scoped application logs |
| `sys_aia_execution` | AI Agent execution records |
| `sys_aia_tool_execution` | Tool execution details |
| `sn_agent_context` | Agent context data |
| `sys_properties` | System properties (read-only) |
| `v_plugin` | Installed plugins |

### Custom Scripted REST API (Optional)

For enhanced functionality, deploy a scoped app with:

```
POST /api/x_snc_foundry/script/execute
  - Execute background scripts with enhanced controls
  - Built-in safety rails on server side
  - Detailed execution metrics
```

---

## Security Considerations

### Credential Protection

1. **Never log credentials** - Redact from all logs and outputs
2. **Encrypt at rest** - Use OS keychain or AES encryption
3. **Minimize scope** - Request only required OAuth scopes
4. **Session timeout** - Clear sessions after inactivity
5. **No persistence** - Don't store credentials between conversations

### Instance Protection

1. **Rate limiting** - Prevent API abuse
2. **Read-only default** - Mutations require explicit mode
3. **Blocked operations** - Prevent dangerous system changes
4. **Audit trail** - Log all script executions
5. **Sensitive data redaction** - Hide passwords, keys, secrets

### Claude Safety

1. **Confirmation for mutations** - Always ask before executing `mode: execute`
2. **Explain before executing** - Show script and explain what it does
3. **Warn on risky operations** - Highlight potential impacts
4. **Provide undo guidance** - When mutations occur, explain reversal

---

## Example Conversations

### Debugging a Failed Agent

```
User: The IT Support agent is failing. Can you check what's wrong?

Claude: I'll connect to your instance and check the AIA execution logs.
        [Uses servicenow_connect]

        Connected to dev12345. Let me pull recent failed executions.
        [Uses servicenow_aia_logs with status: "failure"]

        Found 3 failed executions in the last hour. The most recent one
        (exec123) failed at step 2 when calling 'createIncident':

        Error: "ACL denied: caller lacks itil role"

        The agent is running as 'system' but trying to create incidents.
        The 'itil' role is required for incident creation.

        Would you like me to:
        1. Check the agent's user configuration
        2. Look at the ACL rules for incident creation
        3. Pull the full execution trace for more context
```

### Running a Diagnostic Script

```
User: Check how many incidents are stuck in "Pending" state

Claude: I'll run a query to check pending incidents.
        [Uses servicenow_query with table: "incident", query: "state=pending"]

        Found 47 incidents in "Pending" state. Here's a breakdown:
        - 23 waiting for customer response (substate: awaiting_info)
        - 15 pending approval (substate: awaiting_approval)
        - 9 with no substate (may need attention)

        Want me to run a script to analyze why those 9 are stuck?

User: Yes, check those 9

Claude: I'll run a diagnostic script in read-only mode:

        ```javascript
        var gr = new GlideRecord('incident');
        gr.addQuery('state', 'pending');
        gr.addNullQuery('substate');
        gr.query();
        while (gr.next()) {
          gs.info(gr.number + ': ' + gr.short_description +
                  ' | Assigned: ' + gr.assigned_to.getDisplayValue() +
                  ' | Last update: ' + gr.sys_updated_on);
        }
        ```

        This will list the 9 stuck incidents with their assignments
        and last update times. Proceed?

User: Go ahead

Claude: [Uses servicenow_script with mode: "readonly"]

        Results:
        - INC0012345: No assigned_to, last update 15 days ago
        - INC0012389: Assigned to inactive user, last update 8 days ago
        ...

        Root cause: These incidents have assignment issues.
        5 have no assignee, 4 are assigned to inactive users.
```

---

## Acceptance Criteria

### Must Have (P0)

- [ ] Connect to ServiceNow instance with basic auth
- [ ] Connect with OAuth 2.0 (token refresh)
- [ ] Query syslogs with level/source/time filters
- [ ] Query AIA execution logs with status filter
- [ ] Execute read-only background scripts
- [ ] Safety rails block dangerous operations
- [ ] Audit trail for all script executions
- [ ] Clear error messages with suggestions

### Should Have (P1)

- [ ] Credentials file support (~/.servicenow/credentials.json)
- [ ] Named connection profiles
- [ ] `servicenow_query` for arbitrary tables
- [ ] `servicenow_instance` for health checks
- [ ] Dry-run mode for scripts
- [ ] Rate limiting protection

### Nice to Have (P2)

- [ ] Custom Scripted REST API for enhanced safety
- [ ] Script execution history viewer
- [ ] Connection status in Claude prompt
- [ ] Auto-reconnect on token expiry
- [ ] Batch query support

---

## Open Questions

1. **Credential storage:** OS keychain vs encrypted file vs env vars?
2. **Scoped app requirement:** Do we need a ServiceNow scoped app for enhanced safety?
3. **Role requirements:** What's the minimum role set for troubleshooting?
4. **Instance allowlist:** Should we restrict to known team instances?
5. **Telemetry:** Should we track usage metrics (opt-in)?

---

## Appendix: ServiceNow API Reference

### Syslog Table Schema

| Field | Type | Description |
|-------|------|-------------|
| sys_id | GUID | Unique identifier |
| level | Integer | 0=Debug, 1=Info, 2=Warning, 3=Error |
| source | String | Log source identifier |
| message | String | Log message content |
| sys_created_on | DateTime | Timestamp |
| sys_created_by | String | User who created |

### AIA Execution Table Schema

| Field | Type | Description |
|-------|------|-------------|
| sys_id | GUID | Unique identifier |
| agent | Reference | Agent definition |
| status | String | running, success, failure |
| start_time | DateTime | Execution start |
| end_time | DateTime | Execution end |
| trigger_type | String | user_message, event, schedule |
| error_message | String | Error details if failed |

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-29 | 0.1 | Initial draft | AI Foundry Team |
