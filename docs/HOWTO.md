# Foundry How-To Guide

Comprehensive guide for using Foundry to bootstrap, develop, and debug Now Assist POC projects.

---

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Creating Projects](#creating-projects)
3. [Managing Resources](#managing-resources)
4. [Using Pre-loaded Context](#using-pre-loaded-context)
5. [Using Skills](#using-skills)
6. [ServiceNow Integration](#servicenow-integration)
7. [Contributing Content](#contributing-content)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Initial Setup

### Prerequisites

- Node.js 18+
- Claude Code CLI installed and authenticated
- **GitHub CLI authenticated** - Run `gh auth login` (required for private golden repo)

### One-Time Setup

#### 1. Build the MCP Server

```bash
cd /path/to/snaifmcp/foundry-mcp
npm install
npm run build
```

#### 2. Configure Claude Code

**Global Configuration** (recommended):
```bash
# Edit ~/.claude/config.json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/absolute/path/to/foundry-mcp/dist/index.js"]
    }
  }
}
```

**Project Configuration**:
Create `.mcp.json` in your working directory:
```json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/absolute/path/to/foundry-mcp/dist/index.js"]
    }
  }
}
```

#### 3. Verify Installation

Start Claude Code and check that tools are available:
```
What Foundry and ServiceNow tools do you have available?
```

Expected: 12 Foundry tools + 8 ServiceNow tools.

---

## Creating Projects

### Basic Project

```
Create a new Now Assist POC called "customer-demo"
```

Creates:
```
customer-demo/
├── CLAUDE.md                    # SPARC methodology
├── .gitignore
└── .claude/
    ├── context/                 # 6 context files
    └── skills/                  # 6 skills
```

### With Custom Path

```
Create a POC called "acme-poc" in /Users/me/projects
```

### With Different Template

```
Create a project called "quick-test" using the minimal template
```

Template options:
- `sparc-starter` (default): Full setup with all context and skills
- `standard`: Context files only, no pre-loaded skills
- `minimal`: Just CLAUDE.md, no pre-loaded resources

### List Available Templates

```
Show me the available Foundry templates
```

### Preview a Template

```
Show me what the standard template includes
```

---

## Managing Resources

### List All Resources

```
List all available Foundry resources
```

Shows: 6 context files, 6 skills, 3 templates.

### Add Resources to Project

```
Add the testing-patterns skill to this project
```

```
Add the performance-tuning context to this project
```

### Get Resource Information

```
Get information about the agent-builder skill
```

### Search Resources

```
Search Foundry for "GlideRecord"
```

```
Search Foundry for content about "security"
```

### Sync with Golden Repo

```
Sync this project's resources with the golden repo
```

Shows:
- Unchanged resources
- Modified resources
- New resources available

### Check Version Status

```
Check version status of resources in this project
```

### Check for Updates

```
Check if updates are available for my project resources
```

---

## Using Pre-loaded Context

### Context Files Available

| File | Description |
|------|-------------|
| `now-assist-platform.md` | Platform architecture, APIs, configuration |
| `genai-framework.md` | GenAI Controller, skill invocation |
| `agentic-patterns.md` | Tool definitions, orchestration |
| `troubleshooting-guide.md` | Debug patterns, syslogs, common issues |
| `security-patterns.md` | ACLs, roles, secure coding |
| `performance-tuning.md` | Query optimization, caching |

### Example Queries

```
What's the Now Assist platform architecture?
```

```
How do I optimize GlideRecord queries?
```

```
What are the security best practices for ACLs?
```

```
How do I debug AIA log issues?
```

---

## Using Skills

### Skills Available

| Skill | Use Case |
|-------|----------|
| `now-assist-skill-builder` | Creating Now Assist skills |
| `api-integration` | Building REST API integrations |
| `servicenow-troubleshooting` | Debugging with tools |
| `agent-builder` | Creating AI Agents |
| `testing-patterns` | Unit tests, ATF, mocking |
| `deployment-automation` | CI/CD, update sets |

### Example Usage

#### Now Assist Skill Builder

```
Help me create a Now Assist skill that summarizes incident descriptions
```

#### API Integration

```
Help me build a REST API integration to query ServiceNow incidents
```

#### Testing Patterns

```
How do I write unit tests for a Script Include?
Show me how to mock GlideRecord
```

#### Agent Builder

```
Help me design an AI Agent for incident triage
```

#### Deployment Automation

```
Show me how to set up a CI/CD pipeline for ServiceNow
```

---

## ServiceNow Integration

### Connecting

#### Basic Connection

```
Connect to my-instance.service-now.com with username admin
```

#### Using Saved Credentials

Create `~/.servicenow/credentials.json`:
```json
{
  "default": {
    "instance": "https://my-instance.service-now.com",
    "username": "admin",
    "password": "your-password"
  }
}
```

Then:
```
Connect to ServiceNow using my saved credentials
```

#### Check Connection

```
Check my ServiceNow connection status
```

#### Disconnect

```
Disconnect from ServiceNow
```

### Querying

#### System Logs

```
Get the last 20 syslogs
Get syslogs from the "AI Agent" source in the last hour
Get error-level syslogs from today
```

#### AIA Logs (AI Agent)

```
Get AIA logs from the last hour
Get AI Agent execution traces from today
```

#### Table Queries

```
Query the incident table for active P1 incidents
Query sys_user for users with admin role
```

#### Instance Info

```
Get information about the connected ServiceNow instance
```

### Script Execution

#### Read-Only Mode

```
Run this script in read-only mode:

var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(10);
gr.query();
while(gr.next()) {
    gs.info(gr.number + ': ' + gr.short_description);
}
```

#### Execute Mode (Requires Confirmation)

```
Run this script on ServiceNow:

var gr = new GlideRecord('incident');
gr.get('sys_id_here');
gr.priority = '2';
gr.update();
```

#### Script Safety

Blocked patterns:
- GlideRecord deletion without limits
- System configuration changes
- User/role modifications
- Dangerous GlideSystem calls

---

## Contributing Content

### Create New Context

```
Create a new context file called "custom-patterns"
```

Creates scaffold with proper structure.

### Create New Skill

```
Create a new skill called "my-workflow"
```

Creates:
```
.claude/skills/my-workflow/
├── SKILL.md
└── examples/
```

### Validate Content

```
Validate the custom-patterns context file
```

Checks:
- Minimum word count (50 words)
- Has title (# header)
- No placeholder text (TODO, FIXME)
- Proper structure

### Promote to Golden Repo

```
Promote custom-patterns to the golden repo with message "Add caching patterns"
```

Creates:
- Branch: `foundry/context/custom-patterns-YYYYMMDD`
- PR with proper format
- Requires team review

---

## Testing

### Run All Tests

```bash
cd foundry-mcp
npm test
```

Expected output:
```
═══════════════════════════════════════════════════════════
  FOUNDRY MVP ACCEPTANCE TEST
═══════════════════════════════════════════════════════════

Passed: 90/90
```

### Test with Output Preserved

```bash
npm run test:keep
ls .test-output/foundry-test-project/
```

### Manual Testing

1. Create test project:
```
Create a test POC called "manual-test" using goldenPath /path/to/foundry-golden
```

2. Verify structure:
```bash
tree manual-test/
cat manual-test/CLAUDE.md
ls manual-test/.claude/context/
ls manual-test/.claude/skills/
```

3. Clean up:
```bash
rm -rf manual-test/
```

---

## Troubleshooting

### "foundry_init tool not found"

1. Check build:
```bash
ls foundry-mcp/dist/index.js
```

2. Check MCP config path is absolute

3. Restart Claude Code

### "GitHub authentication required"

```bash
gh auth status
gh auth login
gh repo view gapietro/foundry-golden
```

### "Failed to clone golden repository"

1. Check GitHub CLI auth
2. Check network connectivity
3. Use local golden repo:
```
Create a POC using goldenPath /path/to/foundry-golden
```

### "ServiceNow authentication failed"

1. Check instance URL format: `https://instance.service-now.com`
2. Verify credentials
3. Check user has required roles

### "Script blocked"

Remove dangerous operations:
- `deleteRecord()` without limits
- System table modifications
- User/role changes

### Context Not Being Used

Explicitly reference context:
```
Using the Now Assist platform context, explain...
```

### Clear Caches

```bash
# Clear golden repo cache
rm -rf ~/.foundry/golden

# Clear ServiceNow session
# (disconnect and reconnect)
```

---

## Quick Reference

### Commands Summary

| Action | Example |
|--------|---------|
| Create project | "Create a POC called my-project" |
| Different template | "Create project using minimal template" |
| List resources | "List all Foundry resources" |
| Add resource | "Add testing-patterns skill" |
| Search | "Search Foundry for GlideRecord" |
| Connect ServiceNow | "Connect to instance.service-now.com" |
| Query logs | "Get syslogs from last hour" |
| Run script | "Run this read-only script: ..." |
| Create content | "Create a new context file called X" |
| Validate | "Validate the X context file" |
| Promote | "Promote X to golden repo" |

### File Locations

| What | Where |
|------|-------|
| MCP server | `foundry-mcp/dist/index.js` |
| Tests | `foundry-mcp/test/validate-init.ts` |
| Context files | `foundry-golden/context/` |
| Skills | `foundry-golden/skills/` |
| Templates | `foundry-golden/templates/` |
| Golden repo cache | `~/.foundry/golden/` |
| ServiceNow credentials | `~/.servicenow/credentials.json` |

### Project Structure After Init

```
my-project/
├── CLAUDE.md           # Edit for your project
├── .gitignore
└── .claude/
    ├── context/        # Reference material
    │   ├── now-assist-platform.md
    │   ├── genai-framework.md
    │   ├── agentic-patterns.md
    │   ├── troubleshooting-guide.md
    │   ├── security-patterns.md
    │   └── performance-tuning.md
    └── skills/         # Task guidance
        ├── now-assist-skill-builder/
        ├── api-integration/
        ├── servicenow-troubleshooting/
        ├── agent-builder/
        ├── testing-patterns/
        └── deployment-automation/
```
