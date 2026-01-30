# Foundry Demo Script

Complete walkthrough for demonstrating Foundry capabilities.

---

## Pre-Demo Setup

### 1. Verify GitHub CLI Authentication

```bash
gh auth status

# If not logged in:
gh auth login
```

### 2. Build the MCP Server (if needed)

```bash
cd /Users/gpietro/projects/snaifmcp/foundry-mcp
npm install
npm run build
```

### 3. Run Tests to Verify Everything Works

```bash
cd /Users/gpietro/projects/snaifmcp/foundry-mcp
npm test
# Should show: Passed: 90/90
```

### 4. Create Demo Directory

```bash
mkdir -p ~/foundry-demo
cd ~/foundry-demo
```

---

## Demo Part 1: Project Bootstrap (5 min)

### The Problem

> "Every new POC requires manually gathering ServiceNow context, team conventions, skills, and MCP configs. It's slow and inconsistent."

### The Solution

```bash
cd ~/foundry-demo
claude
```

**In Claude Code:**
```
Create a new Now Assist POC called "customer-assist"
```

**Show the result:**
```bash
tree customer-assist/
```

**Expected output:**
```
customer-assist/
├── CLAUDE.md
├── .gitignore
└── .claude/
    ├── context/
    │   ├── agentic-patterns.md
    │   ├── genai-framework.md
    │   ├── now-assist-platform.md
    │   ├── performance-tuning.md
    │   ├── security-patterns.md
    │   └── troubleshooting-guide.md
    └── skills/
        ├── agent-builder/
        ├── api-integration/
        ├── deployment-automation/
        ├── now-assist-skill-builder/
        ├── servicenow-troubleshooting/
        └── testing-patterns/
```

**Talk Track:**
> "In seconds, we have a project with:
> - 6 context files covering the entire Now Assist platform
> - 6 skills for common development tasks
> - SPARC methodology template
> - Ready to use immediately"

---

## Demo Part 2: Templates (3 min)

### List Available Templates

```
Show me the available Foundry templates
```

**Expected:** Lists sparc-starter, minimal, and standard templates.

### Create with Different Template

```
Create a project called "quick-test" using the minimal template
```

**Show the difference:**
```bash
tree quick-test/
```

**Expected:**
```
quick-test/
├── CLAUDE.md
└── .gitignore
```

**Talk Track:**
> "Different templates for different needs:
> - sparc-starter: Full setup for production POCs
> - standard: Just context, add skills as needed
> - minimal: Bare-bones for experiments"

---

## Demo Part 3: Resource Management (5 min)

### List Available Resources

```
List all available Foundry resources
```

**Expected:** Shows 6 context files, 6 skills, 3 templates.

### Search for Specific Content

```
Search Foundry for "GlideRecord"
```

**Expected:** Shows matches in context files and skills.

### Add a Skill to a Project

```
Add the testing-patterns skill to the quick-test project
```

### Get Resource Information

```
Get information about the agent-builder skill
```

---

## Demo Part 4: Pre-loaded Context (5 min)

**Open the project in Claude Code:**
```bash
cd ~/foundry-demo/customer-assist
claude
```

### Test Context Awareness

```
What do you know about the Now Assist platform architecture?
```

**Expected:** Claude summarizes from `now-assist-platform.md`.

```
How do I optimize GlideRecord queries for performance?
```

**Expected:** Claude answers using `performance-tuning.md`.

```
What are the security best practices for ServiceNow development?
```

**Expected:** Claude references `security-patterns.md`.

**Talk Track:**
> "Claude already knows our platform. No need to paste docs - it's pre-loaded."

---

## Demo Part 5: Using Skills (5 min)

### Now Assist Skill Builder

```
Help me create a Now Assist skill that summarizes incident descriptions
```

**Expected:** Claude follows the skill-builder guidance, asks clarifying questions, generates manifest.

### API Integration

```
Help me build a REST API integration to query incidents
```

**Expected:** Claude provides code following api-integration patterns.

### Testing Patterns

```
How do I write unit tests for a Script Include?
```

**Expected:** Claude shows TestRunner pattern, mocking, ATF examples.

---

## Demo Part 6: ServiceNow Tools (10 min)

### Connect to Instance

```
Connect to my-dev-instance.service-now.com
```

Or use saved credentials:
```
Connect to ServiceNow using my saved credentials
```

### Check Connection

```
Check my ServiceNow connection status
```

### Query System Logs

```
Get the last 20 syslogs from the "AI Agent" source
```

### Get AI Agent Logs

```
Get AIA logs from the last hour to see AI Agent execution traces
```

### Run a Read-Only Script

```
Run this read-only script on ServiceNow:

var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(10);
gr.query();
var count = 0;
while(gr.next()) {
    gs.info(gr.number + ': ' + gr.short_description);
    count++;
}
gs.info('Total: ' + count + ' active incidents');
```

### Query a Table

```
Query the incident table for the 5 most recent P1 incidents
```

### Get Instance Info

```
Get information about the connected ServiceNow instance
```

---

## Demo Part 7: Contribution Workflow (5 min)

### Create a New Resource

```
Create a new context file called "custom-integration-patterns"
```

### Validate the Resource

```
Validate the custom-integration-patterns context file
```

### Promote to Golden Repo

```
Promote the custom-integration-patterns context to the golden repo
```

**Talk Track:**
> "The contribution workflow ensures quality:
> 1. Create locally with scaffolding
> 2. Validate against standards
> 3. Promote with PR for team review"

---

## Demo Part 8: Version Management (3 min)

### Check Version Status

```
Check the version status of resources in this project
```

### Check for Updates

```
Check if there are any updates available for my project resources
```

---

## Complete Tool Reference

### Foundry Tools (12)

| Tool | Example Usage |
|------|---------------|
| `foundry_init` | "Create a new POC called my-project" |
| `foundry_list` | "List all available Foundry resources" |
| `foundry_add` | "Add the testing-patterns skill to this project" |
| `foundry_sync` | "Sync this project's resources with the golden repo" |
| `foundry_info` | "Get info about the agent-builder skill" |
| `foundry_search` | "Search Foundry for GlideRecord content" |
| `foundry_new` | "Create a new context file called my-patterns" |
| `foundry_validate` | "Validate the my-patterns context file" |
| `foundry_promote` | "Promote my-patterns to the golden repo" |
| `foundry_external` | "Add the @approved/servicenow-utils plugin" |
| `foundry_version` | "Check version status of project resources" |
| `foundry_templates` | "Show available project templates" |

### ServiceNow Tools (8)

| Tool | Example Usage |
|------|---------------|
| `servicenow_connect` | "Connect to my-instance.service-now.com" |
| `servicenow_disconnect` | "Disconnect from ServiceNow" |
| `servicenow_status` | "Check ServiceNow connection status" |
| `servicenow_syslogs` | "Get syslogs from the last hour" |
| `servicenow_aia_logs` | "Get AI Agent logs from today" |
| `servicenow_query` | "Query the incident table for P1s" |
| `servicenow_script` | "Run this script in read-only mode: ..." |
| `servicenow_instance` | "Get ServiceNow instance info" |

---

## Troubleshooting

### GitHub Auth Issues

```bash
gh auth status
gh auth login
gh repo view gapietro/foundry-golden
```

### MCP Server Not Found

```bash
ls -la /Users/gpietro/projects/snaifmcp/foundry-mcp/dist/index.js
cd /Users/gpietro/projects/snaifmcp/foundry-mcp && npm run build
```

### Use Local Golden Repo

```
Create a POC using goldenPath /Users/gpietro/projects/snaifmcp/foundry-golden
```

### Clear Cache

```bash
rm -rf ~/.foundry/golden
```

---

## Q&A Prep

**Q: "How do team members authenticate?"**
> "Run `gh auth login` once. The MCP server uses GitHub CLI for authentication."

**Q: "How do we add new skills or context?"**
> "Use `foundry_add` to add to existing projects, or `foundry_new` to create new resources."

**Q: "Can we use external plugins?"**
> "Yes, with `foundry_external`. We support @approved/* for vetted plugins and @github/* for direct references."

**Q: "What if I need different context for different POCs?"**
> "Use different templates (sparc-starter, standard, minimal) or add specific resources with `foundry_add`."

**Q: "How do we update the golden repo?"**
> "Use the contribution workflow: `foundry_new`, `foundry_validate`, `foundry_promote`."

**Q: "What about ServiceNow connectivity?"**
> "Use `servicenow_connect` with credentials or saved profile. Credentials can be stored in ~/.servicenow/credentials.json."

---

## Cleanup

```bash
rm -rf ~/foundry-demo/customer-assist
rm -rf ~/foundry-demo/quick-test
rm -rf ~/.foundry/golden  # Clear cache if needed
```
