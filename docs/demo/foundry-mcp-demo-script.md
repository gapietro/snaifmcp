# Foundry MCP — Demo & Validation Script

**Dual purpose:** Use as a live demo walkthrough for the team AND as a validation checklist when testing the MCP server and golden repo content.

- **Demo time:** ~30 minutes
- **Audience:** AI Foundry team members setting up for the first time
- **Format:** Each step has talking points (💬), exact commands, and a validation checkbox (☑)

> **Tester note:** Work through each section top to bottom. Check the box when the step produces the expected output. Any unchecked box at the end = something to investigate.

---

## Prerequisites Checklist

Before starting, verify these are in place:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] GitHub CLI installed and authenticated (`gh auth status`)
- [ ] Claude Code installed (`claude --version`)
- [ ] ServiceNow instance credentials ready (instance URL + username + password in macOS Keychain)

---

## Part 1 — Installation & Configuration (~5 min)

### Step 1.1 — Clone and Build

💬 *"The MCP server lives in the Now-AI-Foundry GitHub org. One command to get it."*

```bash
gh repo clone Now-AI-Foundry/tool-foundry-mcp ~/projects/tool-foundry-mcp
cd ~/projects/tool-foundry-mcp
npm install
npm run build
```

**Expected:** Build completes with no errors. `dist/index.js` exists.

```bash
ls dist/index.js    # should print: dist/index.js
node -e "import('./dist/index.js')" 2>&1 | head -2   # should start MCP handshake
```

- [ ] Build succeeded, `dist/index.js` present

---

### Step 1.2 — Register with Claude Code

💬 *"Register once at user scope and it's available in every project — no per-project config needed."*

```bash
# User scope (recommended — available everywhere)
claude mcp add --scope user --transport stdio foundry -- \
  node ~/projects/tool-foundry-mcp/dist/index.js

# Verify it's registered
claude mcp list
```

**Expected output from `claude mcp list`:**
```
foundry   stdio   node ~/projects/tool-foundry-mcp/dist/index.js   ● connected
```

- [ ] `foundry` appears in `claude mcp list` as connected

> **If connecting to a team-shared project:** Add a `.mcp.json` to the project root instead:
> ```json
> {
>   "mcpServers": {
>     "foundry": {
>       "type": "stdio",
>       "command": "node",
>       "args": ["/absolute/path/to/tool-foundry-mcp/dist/index.js"]
>     }
>   }
> }
> ```

---

### Step 1.3 — Set Up ServiceNow Credentials

💬 *"Credentials are stored in the macOS Keychain — no plaintext passwords on disk. Supports multiple named profiles for dev, staging, and customer instances."*

**Step A — Store password in macOS Keychain:**

```bash
security add-internet-password -s your-instance.service-now.com -a admin -w
```

You'll be prompted to enter the password securely.

**Step B — Create the credentials profile:**

```bash
mkdir -p ~/.servicenow
cat > ~/.servicenow/credentials.json << 'EOF'
{
  "profiles": {
    "dev": {
      "instance": "your-instance.service-now.com",
      "username": "admin",
      "authType": "keychain"
    }
  }
}
EOF
```

> **Note:** With `authType: "keychain"`, the password is retrieved from macOS Keychain at connect time — never stored in the JSON file.

- [ ] Password stored in macOS Keychain
- [ ] `~/.servicenow/credentials.json` created with `authType: "keychain"`

---

### Step 1.4 — Restart Claude Code

💬 *"MCP servers are started at session launch — always restart after registering a new one."*

Exit and relaunch Claude Code. In the new session, verify the MCP server is available:

```
/mcp
```

**Expected:** `foundry` listed as connected with 38 tools.

- [ ] Claude Code restarted, `foundry` shows 38 tools in `/mcp`

---

## Part 2 — Explore the Golden Repository (~5 min)

💬 *"The golden repo is the heart of Foundry — a curated library of ServiceNow/Now Assist context, skills, and project templates that get pre-loaded into every POC."*

Open a fresh Claude Code session and try these tools:

---

### Step 2.1 — Browse Available Templates

```
foundry_templates action="list"
```

**Expected output:**
```
Available Templates
════════════════════════════════════════════════════════════

📋 foundry-poc
────────────────────────────────────────
Full POC kit — context, skills, and SPARC methodology
  • Context files: Yes
  • Skills: Yes

📋 foundry-minimal
────────────────────────────────────────
Bare-bones template with just CLAUDE.md
  • Context files: No
  • Skills: No
```

- [ ] Two templates listed: `foundry-poc` and `foundry-minimal`
- [ ] No old template names (`sparc-starter`, `standard`, `minimal`)

---

### Step 2.2 — List All Resources

```
foundry_list type="all"
```

**Expected:** Lists context files, skills, and templates with descriptions.

Key items to spot-check:
- [ ] Context: `now-assist-platform`, `genai-framework`, `agentic-patterns` present
- [ ] Skills: `now-assist-skill-builder`, `api-integration`, `agent-builder` present

---

### Step 2.3 — Search the Golden Repo

💬 *"Search cuts across names, descriptions, and file content — great for discovery."*

```
foundry_search query="GlideRecord"
```

**Expected:** Returns context files and skills that mention GlideRecord patterns.

```
foundry_search query="authentication"
```

- [ ] Both searches return results with relevant matches

---

### Step 2.4 — Deep Dive on a Resource

```
foundry_info type="context" name="now-assist-platform"
```

**Expected:** Full description, usage instructions, and what this context file teaches Claude.

```
foundry_info type="skill" name="now-assist-skill-builder"
```

- [ ] Context info returned with meaningful description
- [ ] Skill info returned with usage instructions

---

### Step 2.5 — Smart Context Suggestions

💬 *"This tool reads your task description and suggests relevant skills you might want installed — like autocomplete for your toolbox."*

```
foundry_check_context task_description="I need to create a Now Assist skill and deploy it to ServiceNow"
```

**Expected:** Suggests `now-assist-skill-builder` and related resources.

- [ ] Relevant skill suggestions returned

---

## Part 3 — Bootstrap a POC Project (~5 min)

💬 *"This is the main workflow — zero to fully configured POC in under a minute."*

---

### Step 3.1 — Create and Initialize

```bash
mkdir ~/projects/my-poc
cd ~/projects/my-poc
```

Then start Claude Code **from that directory** and prompt:

```
Initialize this Foundry POC project using the foundry-poc template.
```

> **Note:** `foundry_init` bootstraps the **current directory** — you must be inside the project folder before running it.

**Expected output:**
```
Project "my-poc" initialized at ~/projects/my-poc

Template: foundry-poc
- Context: Now Assist platform, GenAI framework, Agentic patterns
- Skills: Now Assist skill builder, API integration
...

Next steps:
1. Set up superpowers (recommended)...
2. Review CLAUDE.md and update project details
3. Start building with Claude Code!
```

- [ ] Project initialized successfully (files created in current directory, not a subdirectory)
- [ ] No errors

---

### Step 3.2 — Inspect What Was Created

```bash
find ~/projects/my-poc -not -path '*/\.*' | sort
ls ~/projects/my-poc/.claude/context/
ls ~/projects/my-poc/.claude/skills/
cat ~/projects/my-poc/CLAUDE.md | head -30
```

**Expected structure:**
```
my-poc/
├── CLAUDE.md                    ← Project instructions for Claude
├── .gitignore                   ← Comprehensive gitignore
├── 00_Inbox/                    ← POC engagement folder structure
│   ├── calls/
│   ├── emails/
│   └── notes/
├── 01_Customers/
├── 10_PromptTemplates/
├── 20_Demo_Library/
├── 99_Assets/
└── .claude/
    ├── context/                 ← Pre-loaded domain knowledge
    │   ├── now-assist-platform.md
    │   ├── genai-framework.md
    │   └── agentic-patterns.md
    └── skills/                  ← Pre-loaded Claude Code skills
        ├── now-assist-skill-builder/
        └── api-integration/
```

- [ ] `CLAUDE.md` present and contains project name
- [ ] `.claude/context/` has at least 3 context files
- [ ] `.claude/skills/` has skill directories
- [ ] POC folder structure (00_Inbox through 99_Assets) present

---

### Step 3.3 — Add an Additional Resource

💬 *"After init you can keep adding resources from the golden repo as your POC evolves."*

```
foundry_add type="context" name="security-patterns" projectPath="~/projects/my-poc"
```

**Expected:** Security patterns context file added to `.claude/context/`.

```bash
ls ~/projects/my-poc/.claude/context/
```

- [ ] `security-patterns.md` now present

---

### Step 3.4 — Check for Updates

```
foundry_sync projectPath="~/projects/my-poc" dryRun=true
```

**Expected:** Shows which resources are up to date and any that have updates available.

- [ ] Sync dry-run returns without error

---

## Part 4 — Connect to ServiceNow (~5 min)

💬 *"Now let's connect to a live instance and show the read-only introspection tools."*

---

### Step 4.1 — Connect

```
servicenow_connect profile="dev"
```

**Expected:**
```
Connected to your-instance.service-now.com
User: admin
```

- [ ] Connected successfully

---

### Step 4.2 — Verify Connection

```
servicenow_status
```

**Expected:** Shows active session, instance URL, connected user.

```
servicenow_instance
```

**Expected:** Instance version, build, application scope.

- [ ] Status shows active session
- [ ] Instance metadata returned

---

### Step 4.3 — Query a Table

💬 *"Any table, any filter, any fields — great for exploring data structure before building agents."*

```
servicenow_query table="sys_user" query="active=true" fields=["user_name","name","email"] limit=5
```

**Expected:** Returns 5 active user records with those fields.

```
servicenow_query table="sys_properties" query="nameLIKEglide.ui" fields=["name","value"] limit=5
```

- [ ] User query returns records
- [ ] System properties query returns results

---

### Step 4.4 — Run a Script

💬 *"Background scripts for anything the REST API can't do — complex lookups, cross-table aggregations, on-the-fly calculations."*

```
servicenow_script script="var count = new GlideAggregate('incident'); count.addAggregate('COUNT'); count.query(); count.next(); var total = count.getAggregate('COUNT'); var gr = new GlideAggregate('incident'); gr.addAggregate('COUNT'); gr.addQuery('state', 1); gr.query(); gr.next(); var newCount = gr.getAggregate('COUNT'); gs.info('Total incidents: ' + total); gs.info('New incidents: ' + newCount);"
```

**Expected:** Returns incident counts — something that requires server-side GlideAggregate (not available via REST API).

> **Tip:** For instance version info, use `servicenow_instance` instead — it returns the full build tag directly.

- [ ] Script executes and returns incident counts

---

### Step 4.5 — Browse AI Agents

💬 *"The AIA tools let Claude introspect the entire agentic layer of the instance."*

```
servicenow_aia_list limit=10
```

**Expected:** List of AI Agents with name, status, strategy, tool count.

```
servicenow_aia_list status="active" limit=10
```

**Expected:** Filtered list of active agents only.

- [ ] Agent list returned
- [ ] Active filter works (may use client-side fallback on some instances)

---

### Step 4.6 — Inspect an Agent

Pick a `sys_id` from the previous list and run:

```
servicenow_aia_get agent="<sys_id>" includeTools=true includeStats=true
```

**Expected:** Full agent details — instructions, strategy, tool list, execution stats.

- [ ] Agent details returned with tools and stats sections

---

### Step 4.7 — Browse Use Cases and Flows

```
servicenow_aia_usecase_list limit=5
```

```
servicenow_flow_list name="LLM" limit=5
```

**Expected:** Use case and Flow Designer records.

- [ ] Use case list returned
- [ ] Flow list returned

---

### Step 4.8 — List Skills

```
servicenow_skill_list limit=10
```

Pick a skill name from the output and run:

```
servicenow_skill_get skill="<skill-name>"
```

**Expected:** Full skill details — prompt template, inputs, outputs, model config.

- [ ] Skill list returned
- [ ] Skill detail returned

---

## Part 5 — Dry-Run Creation (~5 min)

💬 *"All creation tools support dryRun=true — shows exactly what would be built without touching the instance. Great for planning and review."*

---

### Step 5.1 — Preview an AI Agent

```
servicenow_aia_create
  agentName="Demo Support Agent"
  agentDescription="Handles common IT support requests"
  agentInstructions="You are an IT support agent. Help users resolve common issues."
  agentRole="Support"
  agentProficiency="Intermediate"
  dryRun=true
```

**Expected:** Detailed build plan showing all records that would be created.

- [ ] Dry-run plan returned (no records created)

---

### Step 5.2 — Forbidden API Detection

💬 *"Foundry scans tool scripts for ServiceNow APIs that aren't allowed in Skills Kit tools — catches issues before deployment."*

```
servicenow_aia_create
  agentName="Test Agent"
  agentDescription="Test"
  agentInstructions="Test agent"
  dryRun=true
  tools=[{
    "name": "Risky Tool",
    "description": "Uses a forbidden API",
    "inputSchema": [],
    "script": "(function(inputs) { gs.info('test'); return {}; })(inputs);"
  }]
```

**Expected:** Dry-run output includes a `⚠️ WARNING` about `gs.info` being a forbidden API.

- [ ] Forbidden API warning appears in dry-run output

---

### Step 5.3 — Preview a Skill

```
servicenow_skill_create
  skillName="Demo Summarizer Skill"
  description="Summarizes IT incident descriptions"
  promptTemplate="Summarize this incident in 2-3 sentences: {{incident_description}}"
  inputs=[{"name": "incident_description", "label": "Incident Description", "description": "The incident text to summarize"}]
  dryRun=true
```

**Expected:** 8-phase build plan — pre-flight sys_id resolution through final activation.

- [ ] All 8 phases shown in dry-run output
- [ ] Pre-flight sys_id lookups shown

---

### Step 5.4 — Disconnect

```
servicenow_disconnect
```

**Expected:** Session terminated confirmation.

- [ ] Disconnected successfully

---

## Part 6 — Contribute Back (Overview only)

💬 *"The contribution workflow is how the golden repo grows — build something useful in a POC, contribute it back so everyone benefits."*

The full workflow is:
1. **`foundry_new`** — Scaffold a new resource (context file or skill) in your project
2. **`foundry_validate`** — Run quality checks before submitting
3. **`foundry_promote`** — Create a PR to the golden repo for team review

```
foundry_new type="skill" name="my-new-skill" description="Does something useful" projectPath="~/projects/my-poc"
```

```
foundry_validate type="skill" name="my-new-skill" projectPath="~/projects/my-poc"
```

*(Demo only — skip `foundry_promote` during testing to avoid creating real PRs)*

- [ ] Scaffold creates skill directory structure
- [ ] Validate runs quality checks

---

## Validation Summary

After completing all sections, count your checkboxes:

| Section | Tests | Expected |
|---------|-------|----------|
| Part 1: Installation | 5 | 5 pass |
| Part 2: Golden Repo | 7 | 7 pass |
| Part 3: Bootstrap | 7 | 7 pass |
| Part 4: ServiceNow | 10 | 10 pass |
| Part 5: Dry-Run Creation | 6 | 6 pass |
| Part 6: Contribute | 2 | 2 pass |
| **Total** | **37** | **37 pass** |

---

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| MCP shows old template names (`sparc-starter`) | Stale MCP server process | Restart Claude Code |
| `foundry` not in `/mcp` | Not registered or wrong path | Re-run `claude mcp add` with correct path |
| `foundry_list` returns empty | Golden repo not cached yet | First run auto-clones; needs `gh auth login` |
| `servicenow_connect` fails | Wrong credentials or instance URL | Check `~/.servicenow/credentials.json` and verify Keychain entry: `security find-internet-password -s your-instance.service-now.com -a admin` |
| `aia_list` ACL error | Field-level REST ACL on `active` field | Expected; tool falls back to client-side filter automatically |
| Script runner returns empty | Wrong application scope (keynexus) | Set active application to **Global** in ServiceNow UI |
| `foundry_promote` fails | GitHub CLI not authenticated | `gh auth login` |

---

## Environment Variables (Optional Customization)

```bash
# Use a local golden repo instead of GitHub (for offline/faster testing)
export FOUNDRY_GOLDEN_REPO="Now-AI-Foundry/lib-foundry-golden"
export FOUNDRY_CACHE_DIR="~/.foundry/golden"

# Use a local clone directly (bypass cache entirely)
export FOUNDRY_CACHE_DIR="/path/to/local/foundry-golden"

# Cache TTL (default: 24 hours)
export FOUNDRY_CACHE_TTL="24"
```

---

*Last updated: 2026-03-13 | MCP Server version: 2026.03.1304 | 38 tools*
