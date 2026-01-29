# Foundry How-To Guide

A practical guide for day-to-day use of Foundry to bootstrap and develop Now Assist POC projects.

---

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Creating a New Project](#creating-a-new-project)
3. [Working with Pre-loaded Context](#working-with-pre-loaded-context)
4. [Using Skills](#using-skills)
5. [Testing Foundry](#testing-foundry)
6. [Troubleshooting](#troubleshooting)
7. [Contributing Content](#contributing-content)

---

## Initial Setup

### Prerequisites

- Node.js 18+ installed
- Claude Code CLI installed and authenticated
- Access to this repository

### One-Time Configuration

#### Step 1: Build the MCP Server

```bash
cd /path/to/snaifmcp/foundry-mcp
npm install
npm run build
```

#### Step 2: Configure Claude Code

Add Foundry to your MCP configuration. Choose one:

**Global Configuration** (recommended for team members):
```bash
# Edit ~/.claude/config.json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/absolute/path/to/snaifmcp/foundry-mcp/dist/index.js"]
    }
  }
}
```

**Project Configuration** (for testing):
Create `.mcp.json` in your working directory:
```json
{
  "mcpServers": {
    "foundry": {
      "command": "node",
      "args": ["/absolute/path/to/snaifmcp/foundry-mcp/dist/index.js"]
    }
  }
}
```

#### Step 3: Verify Installation

Start Claude Code and check that the `foundry_init` tool is available:
```
What tools do you have available?
```

You should see `foundry_init` in the list.

---

## Creating a New Project

### Basic Usage

In Claude Code, simply describe what you want:

```
Create a new Now Assist POC called "acme-customer-demo"
```

Claude will:
1. Call `foundry_init` with your project name
2. Create the project directory
3. Copy context files, skills, and template
4. Report success with next steps

### Specifying a Location

```
Create a new Now Assist POC called "acme-demo" in /Users/me/projects/pocs
```

### Using Local Golden Repo (Development)

For testing changes to the golden repo:

```
Create a new POC called "test-project" using the golden repo at /path/to/snaifmcp/foundry-golden
```

### What Gets Created

```
your-project/
├── CLAUDE.md                    # Your project instructions (edit this!)
├── .gitignore                   # Standard ignores
└── .claude/
    ├── context/
    │   ├── now-assist-platform.md    # Now Assist architecture & APIs
    │   ├── genai-framework.md        # GenAI Controller patterns
    │   └── agentic-patterns.md       # Agentic framework guidance
    └── skills/
        ├── now-assist-skill-builder/
        │   ├── SKILL.md              # Skill creation instructions
        │   └── examples/             # Example implementations
        └── api-integration/
            ├── SKILL.md              # API integration patterns
            └── examples/             # Example code
```

---

## Working with Pre-loaded Context

### How Context Works

Files in `.claude/context/` are automatically available to Claude Code. You don't need to explicitly reference them - Claude will use this knowledge when relevant.

### Context Files Explained

#### `now-assist-platform.md`
- Now Assist architecture overview
- Available capabilities (summarization, generation, Q&A)
- API endpoints and authentication
- Configuration options

**Use when:** Building any Now Assist feature, understanding platform capabilities

#### `genai-framework.md`
- GenAI Controller concepts
- Skill invocation patterns
- Prompt engineering guidelines
- Response handling

**Use when:** Creating GenAI skills, working with prompts, handling AI responses

#### `agentic-patterns.md`
- Tool definition patterns
- Multi-step orchestration
- Error handling strategies
- Testing approaches

**Use when:** Building agentic workflows, defining tools, orchestrating complex tasks

### Referencing Context Explicitly

If Claude isn't using context you expect, you can prompt it:

```
Based on the Now Assist platform context in .claude/context/, how should I implement...
```

---

## Using Skills

### What Are Skills?

Skills are instructions that teach Claude how to perform specific tasks. They include:
- Step-by-step guidance
- Best practices
- Example code

### Available Skills

#### Now Assist Skill Builder
Location: `.claude/skills/now-assist-skill-builder/`

Teaches Claude how to create Now Assist skills including:
- Skill manifest structure
- Implementation patterns
- Testing and deployment

**Invoke with:**
```
Help me create a new Now Assist skill for summarizing incidents
```

#### API Integration
Location: `.claude/skills/api-integration/`

Teaches Claude ServiceNow API patterns including:
- REST API authentication
- CRUD operations
- Error handling
- Pagination

**Invoke with:**
```
Help me integrate with the ServiceNow Incident API
```

### Skill File Structure

```
skill-name/
├── SKILL.md           # Main instructions (required)
└── examples/          # Example implementations (optional)
    ├── example1.js
    └── example2.js
```

---

## Testing Foundry

### Running Acceptance Tests

The test suite validates all MVP acceptance criteria:

```bash
cd foundry-mcp
npm test
```

**Expected output:**
```
═══════════════════════════════════════════════════════════
  FOUNDRY MVP ACCEPTANCE TEST
═══════════════════════════════════════════════════════════

Pre-flight checks:
✓ Golden repo exists: Found at /path/to/foundry-golden
✓ AC5: MCP server built: dist/index.js exists

Running foundry_init simulation...
✓ Project created successfully

Acceptance Criteria Tests:
✓ AC1: Project directory created
✓ AC2: Context files present: All 3 context files found
✓ AC3: Skills present: Found 2 skills
✓ AC4: CLAUDE.md has SPARC structure
✓ AC6: No additional setup required

SUMMARY
Passed: 8/8
```

### Keeping Test Output

To inspect the generated project:

```bash
npm run test:keep
```

Test output is saved to `foundry-mcp/.test-output/`

### Manual Testing

1. Create a test project:
```
In Claude Code: Create a test POC called "manual-test" using goldenPath /path/to/foundry-golden
```

2. Verify the structure:
```bash
ls -la manual-test/
ls -la manual-test/.claude/context/
ls -la manual-test/.claude/skills/
cat manual-test/CLAUDE.md
```

3. Clean up:
```bash
rm -rf manual-test/
```

---

## Troubleshooting

### "foundry_init tool not found"

**Cause:** MCP server not configured or not built

**Fix:**
1. Verify the server is built:
   ```bash
   ls foundry-mcp/dist/index.js
   ```
2. Check your MCP configuration path is absolute
3. Restart Claude Code

### "Failed to clone golden repository"

**Cause:** GitHub repo not accessible or doesn't exist yet

**Fix:** Use the `goldenPath` parameter to point to local golden repo:
```
Create a POC using goldenPath /path/to/snaifmcp/foundry-golden
```

### "Project directory already exists"

**Cause:** You're trying to create a project with an existing name

**Fix:** Choose a different name or delete the existing directory

### "Invalid project name"

**Cause:** Project name contains invalid characters

**Fix:** Use only letters, numbers, hyphens, and underscores

### Context Not Being Used

**Cause:** Claude may not automatically reference context files

**Fix:** Explicitly mention the context:
```
Using the Now Assist platform context, help me...
```

### MCP Server Errors

Check the server logs:
```bash
# Run server directly to see errors
node foundry-mcp/dist/index.js
```

---

## Contributing Content

### Adding New Context

1. Create a markdown file in `foundry-golden/context/`:
   ```bash
   touch foundry-golden/context/new-topic.md
   ```

2. Write comprehensive documentation including:
   - Overview/introduction
   - Key concepts
   - Code examples
   - Best practices

3. Test by creating a new project and verifying the context is included

### Adding New Skills

1. Create a skill directory:
   ```bash
   mkdir -p foundry-golden/skills/my-skill/examples
   ```

2. Create `SKILL.md` with:
   - Clear instructions for Claude
   - Step-by-step guidance
   - Do's and don'ts
   - Example usage

3. Add example code in `examples/`

4. Test the skill in a new project

### Updating Templates

1. Edit `foundry-golden/templates/sparc-starter/CLAUDE.md`

2. Use `{{PROJECT_NAME}}` as a placeholder - it will be replaced during init

3. Test by creating a new project

---

## Quick Reference

### Commands

| Action | How |
|--------|-----|
| Create project | "Create a Now Assist POC called NAME" |
| Create in specific location | "Create POC NAME in /path/to/dir" |
| Use local golden repo | "Create POC using goldenPath /path/to/golden" |
| Run tests | `cd foundry-mcp && npm test` |
| Build server | `cd foundry-mcp && npm run build` |

### File Locations

| What | Where |
|------|-------|
| MCP server source | `foundry-mcp/src/index.ts` |
| Built server | `foundry-mcp/dist/index.js` |
| Context files | `foundry-golden/context/` |
| Skills | `foundry-golden/skills/` |
| Template | `foundry-golden/templates/sparc-starter/` |
| Tests | `foundry-mcp/test/` |

### Project Structure After Init

```
my-project/
├── CLAUDE.md           # Edit this for your project
├── .gitignore
└── .claude/
    ├── context/        # Reference material (read-only)
    └── skills/         # Skill instructions (read-only)
```
