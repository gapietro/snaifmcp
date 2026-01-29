# Foundry Demo Script

## Pre-Demo Setup (Do Before the Demo)

### 1. Build the MCP Server
```bash
cd /Users/gpietro/projects/snaifmcp/foundry-mcp
npm install
npm run build
```

### 2. Push foundry-golden to GitHub (Option A - Recommended)

Create a new repo at https://github.com/gapietro/foundry-golden (or ai-foundry org if available).

```bash
cd /Users/gpietro/projects/snaifmcp/foundry-golden
git init
git add .
git commit -m "Initial commit: Foundry golden repo with Now Assist context and skills"
git remote add origin https://github.com/gapietro/foundry-golden.git
git push -u origin main
```

Then update the URL in `foundry-mcp/src/index.ts`:
```typescript
const CONFIG = {
  goldenRepoUrl: "https://github.com/gapietro/foundry-golden.git",
  // ... rest unchanged
};
```

Rebuild: `npm run build`

### 2. Alternative: Use Local Path (Option B - Quick)

Skip GitHub setup entirely - you'll use the `goldenPath` parameter during the demo.

### 3. Verify MCP Server is Configured

Check `.mcp.json` exists in your working directory:
```json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/Users/gpietro/projects/snaifmcp/foundry-mcp/dist/index.js"]
    }
  }
}
```

### 4. Create Demo Directory
```bash
mkdir -p ~/foundry-demo
cd ~/foundry-demo
```

---

## Demo Script

### Part 1: The Problem (2 min)

**Talk Track:**
> "Every time we start a new Now Assist POC, we spend hours gathering context - ServiceNow platform docs, GenAI framework patterns, team conventions. Then we set up the same project structure, same skills. It's repetitive and error-prone."
>
> "Foundry solves this by providing a single command that bootstraps a project with everything pre-loaded."

---

### Part 2: Live Demo - Project Bootstrap (5 min)

**Open Claude Code in the demo directory:**
```bash
cd ~/foundry-demo
claude
```

**In Claude Code, say:**
> "Initialize a new Foundry project called customer-assist-poc"

Claude will call:
```
foundry_init(projectName: "customer-assist-poc")
```

**If using local golden repo (Option B), say:**
> "Initialize a new Foundry project called customer-assist-poc using the golden repo at /Users/gpietro/projects/snaifmcp/foundry-golden"

**Show the result:**
```bash
# Exit Claude Code temporarily
tree customer-assist-poc/
```

Expected output:
```
customer-assist-poc/
├── CLAUDE.md
├── .gitignore
└── .claude/
    ├── context/
    │   ├── agentic-patterns.md
    │   ├── genai-framework.md
    │   └── now-assist-platform.md
    └── skills/
        ├── api-integration/
        │   ├── SKILL.md
        │   └── examples/
        └── now-assist-skill-builder/
            ├── SKILL.md
            └── examples/
```

**Talk Track:**
> "In seconds, we have a project with:
> - SPARC methodology template in CLAUDE.md
> - Pre-loaded Now Assist platform context
> - GenAI framework patterns
> - Agentic development patterns
> - Two skills: building Now Assist skills and API integrations"

---

### Part 3: Show the Context (3 min)

**Open the project in Claude Code:**
```bash
cd ~/foundry-demo/customer-assist-poc
claude
```

**Ask Claude:**
> "What context do you have about Now Assist?"

**Expected:** Claude summarizes the Now Assist platform architecture from the pre-loaded context.

**Ask Claude:**
> "What's the GenAI Controller API endpoint for invoking a skill?"

**Expected:** Claude answers with the specific API details from `genai-framework.md`.

**Talk Track:**
> "Claude already knows our platform. No need to paste docs or explain architecture - it's pre-loaded."

---

### Part 4: Demonstrate Skills (5 min)

**Ask Claude to use the skill-builder skill:**
> "Help me create a Now Assist skill that summarizes incident descriptions for the service desk"

**Expected behavior:**
Claude follows the `now-assist-skill-builder` SKILL.md guidance:
1. Asks clarifying questions about requirements
2. Generates a skill manifest (JSON)
3. Creates prompt templates
4. Provides registration instructions

**Talk Track:**
> "The skill guides Claude through our proven process. New team members get the same quality output as veterans."

---

### Part 5: SPARC Methodology (2 min)

**Open CLAUDE.md:**
```bash
cat CLAUDE.md
```

**Talk Track:**
> "Every project uses SPARC methodology:
> - **S**pecification - define the problem
> - **P**seudocode - outline the solution
> - **A**rchitecture - design the system
> - **R**efinement - iterate and improve
> - **C**ompletion - deliver and validate
>
> The template has checkboxes so Claude can track progress through each phase."

---

### Part 6: The Value Proposition (1 min)

**Summary points:**
- **Onboarding:** New team member productive in minutes, not days
- **Consistency:** Everyone uses the same patterns and context
- **Speed:** Skip the setup, start building immediately
- **Quality:** Proven skills guide best practices
- **Maintenance:** Update golden repo once, all new projects benefit

---

## Backup Demo Commands

If the MCP tool doesn't work, you can manually show the golden repo structure:

```bash
# Show what's in the golden repo
tree /Users/gpietro/projects/snaifmcp/foundry-golden/

# Show a context file
cat /Users/gpietro/projects/snaifmcp/foundry-golden/context/now-assist-platform.md | head -50

# Show a skill
cat /Users/gpietro/projects/snaifmcp/foundry-golden/skills/now-assist-skill-builder/SKILL.md | head -50
```

---

## Q&A Prep

**Q: "How do we add new skills or context?"**
> "That's Phase 2. You'll be able to run `foundry add skill @foundry/new-skill` to add resources to an existing project."

**Q: "Can we use external plugins?"**
> "Yes, our three-tier system supports:
> - `@foundry/*` - team-created, fully vetted
> - `@approved/*` - external plugins we've reviewed and pinned
> - `@github/*` - direct references for experimentation"

**Q: "What if I need different context for different POCs?"**
> "Templates. We can create templates like `sparc-full`, `sparc-minimal`, `integration-focused` that include different resource sets."

**Q: "How do we update the golden repo?"**
> "Standard git workflow. Update context or skills in foundry-golden, commit, push. New projects automatically get the latest. Existing projects can run `foundry sync` (coming in Phase 2)."

---

## Troubleshooting

### MCP Server Not Found
```bash
# Check it's built
ls -la /Users/gpietro/projects/snaifmcp/foundry-mcp/dist/index.js

# Rebuild if needed
cd /Users/gpietro/projects/snaifmcp/foundry-mcp && npm run build
```

### Golden Repo Clone Fails
Use the `goldenPath` parameter as a fallback:
> "Initialize project my-poc using golden repo at /Users/gpietro/projects/snaifmcp/foundry-golden"

### Permission Errors
```bash
# Ensure demo directory is writable
chmod 755 ~/foundry-demo
```
