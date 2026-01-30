# Foundry Manual Test Script

Complete test script to verify all Foundry and ServiceNow functionality.

**Prerequisites:**
- `gh auth login` completed
- MCP server built (`cd foundry-mcp && npm run build`)
- Claude Code configured with Foundry MCP

**Test Duration:** ~30-45 minutes

---

## Pre-Test Setup

### 1. Run Automated Tests First

```bash
cd /Users/gpietro/projects/snaifmcp/foundry-mcp
npm test
```

**Expected:** `Passed: 48/48`

### 2. Create Test Directory

```bash
mkdir -p ~/foundry-manual-test
cd ~/foundry-manual-test
```

### 3. Start Claude Code

```bash
claude
```

---

## Part 1: Foundry Core Tools

### Test 1.1: foundry_init (Basic)

**Input:**
```
Create a new Now Assist POC called "test-basic"
```

**Verify:**
```bash
tree test-basic/
```

**Expected:**
- `CLAUDE.md` exists with SPARC methodology
- `.claude/context/` has 6 markdown files
- `.claude/skills/` has 6 skill directories
- `.gitignore` exists

**Result:** [ ] Pass [ ] Fail

---

### Test 1.2: foundry_init (Minimal Template)

**Input:**
```
Create a project called "test-minimal" using the minimal template
```

**Verify:**
```bash
ls -la test-minimal/
ls test-minimal/.claude/ 2>/dev/null || echo "No .claude directory (expected)"
```

**Expected:**
- `CLAUDE.md` exists
- `.gitignore` exists
- No `.claude/context/` directory
- No `.claude/skills/` directory

**Result:** [ ] Pass [ ] Fail

---

### Test 1.3: foundry_init (Standard Template)

**Input:**
```
Create a project called "test-standard" using the standard template
```

**Verify:**
```bash
ls test-standard/.claude/context/
ls test-standard/.claude/skills/ 2>/dev/null || echo "No skills directory (expected)"
```

**Expected:**
- Has `.claude/context/` with 6 files
- No `.claude/skills/` directory

**Result:** [ ] Pass [ ] Fail

---

### Test 1.4: foundry_list

**Input:**
```
List all available Foundry resources
```

**Expected output contains:**
- 6 context files listed
- 6 skills listed
- 3 templates listed

**Result:** [ ] Pass [ ] Fail

---

### Test 1.5: foundry_templates

**Input:**
```
Show me the available Foundry templates
```

**Expected:**
- Lists sparc-starter, minimal, standard
- Shows what each includes

**Result:** [ ] Pass [ ] Fail

---

### Test 1.6: foundry_info

**Input:**
```
Get information about the agent-builder skill
```

**Expected:**
- Shows skill description
- Shows file path
- May show examples count

**Result:** [ ] Pass [ ] Fail

---

### Test 1.7: foundry_search

**Input:**
```
Search Foundry for "GlideRecord"
```

**Expected:**
- Shows matching resources
- Shows match locations (name vs content)
- Includes relevance scoring

**Result:** [ ] Pass [ ] Fail

---

### Test 1.8: foundry_add

**Input (in test-minimal directory):**
```
Add the testing-patterns skill to the test-minimal project
```

**Verify:**
```bash
ls test-minimal/.claude/skills/testing-patterns/
```

**Expected:**
- `SKILL.md` exists
- `examples/` directory exists

**Result:** [ ] Pass [ ] Fail

---

### Test 1.9: foundry_sync

**Input (in test-basic directory):**
```
Sync this project's resources with the golden repo
```

**Expected:**
- Shows comparison status
- Lists unchanged/modified/new resources

**Result:** [ ] Pass [ ] Fail

---

### Test 1.10: foundry_new (Context)

**Input:**
```
Create a new context file called "my-test-context" in the test-basic project
```

**Verify:**
```bash
ls test-basic/.claude/context/my-test-context.md
```

**Expected:**
- File created with scaffold content
- Has proper structure (# header, sections)

**Result:** [ ] Pass [ ] Fail

---

### Test 1.11: foundry_new (Skill)

**Input:**
```
Create a new skill called "my-test-skill" in the test-basic project
```

**Verify:**
```bash
ls -la test-basic/.claude/skills/my-test-skill/
```

**Expected:**
- `SKILL.md` exists
- `examples/` directory exists

**Result:** [ ] Pass [ ] Fail

---

### Test 1.12: foundry_validate

**Input:**
```
Validate the my-test-context context file in test-basic
```

**Expected:**
- Shows validation results
- May warn about short content (needs 50+ words)
- May warn about placeholder text

**Result:** [ ] Pass [ ] Fail

---

### Test 1.13: foundry_version

**Input:**
```
Check version status of resources in the test-basic project
```

**Expected:**
- Shows installed resources
- Shows version/hash information

**Result:** [ ] Pass [ ] Fail

---

### Test 1.14: foundry_external

**Input:**
```
List external plugins in the test-basic project
```

**Expected:**
- Shows approved external sources (superpowers, servicenow-utils, now-assist-testing)
- Sources loaded from external-registry.json

**Result:** [ ] Pass [ ] Fail

---

### Test 1.15: foundry_list (Agent Examples)

**Input:**
```
List available Foundry agent examples
```

**Expected:**
- Shows available agent examples (may be empty initially)
- If empty, shows helpful message about using _template

**Result:** [ ] Pass [ ] Fail

---

### Test 1.16: foundry_info (Subagent Placeholder)

**Input:**
```
Get information about the code-reviewer subagent
```

**Expected:**
- Returns "not yet implemented" message
- Lists planned subagent features (code review, testing, documentation, research)

**Result:** [ ] Pass [ ] Fail

---

### Test 1.17: foundry_info (Hook Placeholder)

**Input:**
```
Get information about the post-init hook
```

**Expected:**
- Returns "not yet implemented" message
- Lists planned hook features (post-init, pre-commit, post-add, sync-complete)

**Result:** [ ] Pass [ ] Fail

---

## Part 2: Context Awareness Tests

### Test 2.1: Now Assist Platform Context

**Input (in test-basic directory):**
```
Based on the pre-loaded context, explain the Now Assist platform architecture
```

**Expected:**
- Answer references Now Assist capabilities
- Mentions APIs, configuration, or components

**Result:** [ ] Pass [ ] Fail

---

### Test 2.2: Performance Tuning Context

**Input:**
```
How should I optimize GlideRecord queries according to the context?
```

**Expected:**
- Mentions indexed fields
- Mentions setLimit()
- Mentions N+1 pattern
- Mentions GlideAggregate

**Result:** [ ] Pass [ ] Fail

---

### Test 2.3: Security Patterns Context

**Input:**
```
What are the security best practices for ACLs?
```

**Expected:**
- References ACL configuration
- Mentions roles
- Discusses input validation

**Result:** [ ] Pass [ ] Fail

---

### Test 2.4: Troubleshooting Context

**Input:**
```
How do I debug AI Agent issues using syslogs?
```

**Expected:**
- References syslog queries
- Mentions AIA logs
- Discusses common issues

**Result:** [ ] Pass [ ] Fail

---

## Part 3: Skill Usage Tests

### Test 3.1: Now Assist Skill Builder

**Input:**
```
Using the now-assist-skill-builder skill, help me create a skill that summarizes incident descriptions
```

**Expected:**
- Follows skill instructions
- Asks clarifying questions
- Provides manifest structure
- Shows testing approach

**Result:** [ ] Pass [ ] Fail

---

### Test 3.2: API Integration

**Input:**
```
Using the api-integration skill, show me how to build a REST API to query incidents
```

**Expected:**
- Shows Scripted REST API pattern
- Includes authentication
- Shows error handling
- Follows skill structure

**Result:** [ ] Pass [ ] Fail

---

### Test 3.3: Testing Patterns

**Input:**
```
Using the testing-patterns skill, show me how to write unit tests for a Script Include
```

**Expected:**
- Shows TestRunner pattern
- Shows assertion methods
- Shows mock GlideRecord example

**Result:** [ ] Pass [ ] Fail

---

### Test 3.4: Agent Builder

**Input:**
```
Using the agent-builder skill, help me design an AI Agent for incident triage
```

**Expected:**
- Discusses agent architecture
- Shows tool design
- Includes guardrails
- Shows testing approach

**Result:** [ ] Pass [ ] Fail

---

## Part 4: ServiceNow Tools (Optional - Requires Instance)

**Note:** Skip this section if no ServiceNow instance is available.

### Test 4.1: servicenow_connect

**Input:**
```
Connect to [YOUR_INSTANCE].service-now.com with username [USERNAME]
```

**Expected:**
- Prompts for password if not provided
- Shows connection success or error

**Result:** [ ] Pass [ ] Fail [ ] Skipped

---

### Test 4.2: servicenow_status

**Input:**
```
Check my ServiceNow connection status
```

**Expected:**
- Shows connected instance
- Shows connection details

**Result:** [ ] Pass [ ] Fail [ ] Skipped

---

### Test 4.3: servicenow_syslogs

**Input:**
```
Get the last 10 syslogs
```

**Expected:**
- Returns syslog entries
- Shows timestamp, source, message

**Result:** [ ] Pass [ ] Fail [ ] Skipped

---

### Test 4.4: servicenow_query

**Input:**
```
Query the incident table for 5 active incidents
```

**Expected:**
- Returns incident records
- Shows number, description, state

**Result:** [ ] Pass [ ] Fail [ ] Skipped

---

### Test 4.5: servicenow_script (Read-Only)

**Input:**
```
Run this script in read-only mode:

var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(3);
gr.query();
while(gr.next()) {
    gs.info(gr.number);
}
```

**Expected:**
- Executes successfully
- Shows output

**Result:** [ ] Pass [ ] Fail [ ] Skipped

---

### Test 4.6: servicenow_instance

**Input:**
```
Get information about the connected ServiceNow instance
```

**Expected:**
- Shows instance details
- Shows version/build info

**Result:** [ ] Pass [ ] Fail [ ] Skipped

---

### Test 4.7: servicenow_disconnect

**Input:**
```
Disconnect from ServiceNow
```

**Expected:**
- Confirms disconnection

**Result:** [ ] Pass [ ] Fail [ ] Skipped

---

## Part 5: Error Handling Tests

### Test 5.1: Invalid Project Name

**Input:**
```
Create a project called "test project!"
```

**Expected:**
- Error about invalid characters
- Suggests valid naming

**Result:** [ ] Pass [ ] Fail

---

### Test 5.2: Duplicate Project

**Input:**
```
Create a project called "test-basic"
```

**Expected:**
- Error about existing directory

**Result:** [ ] Pass [ ] Fail

---

### Test 5.3: Invalid Template

**Input:**
```
Create a project called "test-invalid" using the nonexistent template
```

**Expected:**
- Error about invalid template
- Lists valid templates

**Result:** [ ] Pass [ ] Fail

---

### Test 5.4: Resource Not Found

**Input:**
```
Get information about the nonexistent-skill skill
```

**Expected:**
- Error that skill not found

**Result:** [ ] Pass [ ] Fail

---

## Cleanup

```bash
cd ~/foundry-manual-test
rm -rf test-basic test-minimal test-standard
cd ~
rmdir foundry-manual-test
```

---

## Test Summary

### Part 1: Foundry Core Tools
- [ ] Test 1.1: foundry_init (Basic)
- [ ] Test 1.2: foundry_init (Minimal)
- [ ] Test 1.3: foundry_init (Standard)
- [ ] Test 1.4: foundry_list
- [ ] Test 1.5: foundry_templates
- [ ] Test 1.6: foundry_info
- [ ] Test 1.7: foundry_search
- [ ] Test 1.8: foundry_add
- [ ] Test 1.9: foundry_sync
- [ ] Test 1.10: foundry_new (Context)
- [ ] Test 1.11: foundry_new (Skill)
- [ ] Test 1.12: foundry_validate
- [ ] Test 1.13: foundry_version
- [ ] Test 1.14: foundry_external
- [ ] Test 1.15: foundry_list (Agent Examples)
- [ ] Test 1.16: foundry_info (Subagent Placeholder)
- [ ] Test 1.17: foundry_info (Hook Placeholder)

### Part 2: Context Awareness
- [ ] Test 2.1: Now Assist Platform
- [ ] Test 2.2: Performance Tuning
- [ ] Test 2.3: Security Patterns
- [ ] Test 2.4: Troubleshooting

### Part 3: Skill Usage
- [ ] Test 3.1: Skill Builder
- [ ] Test 3.2: API Integration
- [ ] Test 3.3: Testing Patterns
- [ ] Test 3.4: Agent Builder

### Part 4: ServiceNow (Optional)
- [ ] Test 4.1: Connect
- [ ] Test 4.2: Status
- [ ] Test 4.3: Syslogs
- [ ] Test 4.4: Query
- [ ] Test 4.5: Script
- [ ] Test 4.6: Instance
- [ ] Test 4.7: Disconnect

### Part 5: Error Handling
- [ ] Test 5.1: Invalid Name
- [ ] Test 5.2: Duplicate Project
- [ ] Test 5.3: Invalid Template
- [ ] Test 5.4: Resource Not Found

---

**Total Tests:** 32
**ServiceNow Tests (Optional):** 7
**Core Tests:** 25

**Date Tested:** _______________
**Tester:** _______________
**Notes:**
