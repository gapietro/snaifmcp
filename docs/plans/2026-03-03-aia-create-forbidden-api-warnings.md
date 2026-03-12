# AIA Create Forbidden API Warnings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add forbidden API detection to `servicenow_aia_create` so users get a warning when their tool scripts contain APIs that hang indefinitely (gs.*, GlideDateTime, GlideAjax).

**Architecture:** Two-pronged approach — (A) enrich the `script` parameter description in the tool schema so Claude/users see warnings before submission, and (B) scan submitted scripts at handler time and include warnings in both dry-run and live creation output.

**Tech Stack:** TypeScript, tools-aia.ts, validate-servicenow.ts test harness

---

## Repo context

- All work in: `foundry-mcp/` directory (`cd foundry-mcp` first)
- Key file: `src/servicenow/tools-aia.ts`
- Test file: `test/validate-servicenow.ts`
- Build: `npm run build`
- Test: `npm run test:servicenow`
- Branch: create `fix/82-aia-create-forbidden-api-warnings` from `main` inside `foundry-mcp/`

---

## Task 1: Create feature branch

```bash
cd /Users/greg.pietro/projects/snaifmcp/foundry-mcp
git checkout main && git pull
git checkout -b fix/82-aia-create-forbidden-api-warnings
```

Expected: new branch checked out, clean working tree.

---

## Task 2: Write failing tests (TDD)

**File:** `test/validate-servicenow.ts`

Find the section after the existing `servicenow_aia_create` schema tests (around line 228) and add:

```typescript
  // --- Issue #82: forbidden API detection in aia_create ---

  // Test B: script description contains forbidden API names
  const aiaCreateToolForbidden = AIA_TOOLS.find(t => t.name === 'servicenow_aia_create');
  if (aiaCreateToolForbidden) {
    const schema = aiaCreateToolForbidden.inputSchema as {
      properties?: { tools?: { items?: { properties?: { script?: { description?: string } } } } };
    };
    const scriptDesc = schema.properties?.tools?.items?.properties?.script?.description ?? '';
    if (scriptDesc.includes('gs.info') && scriptDesc.includes('GlideDateTime') && scriptDesc.includes('GlideAjax')) {
      pass('servicenow_aia_create script description warns about forbidden APIs');
    } else {
      fail('servicenow_aia_create script description missing forbidden API warnings');
    }
  } else {
    fail('servicenow_aia_create tool not found for forbidden API description check');
  }

  // Test A: scanToolScript correctly identifies forbidden patterns
  // Import is at top of file — add: import { scanToolScript } from '../src/servicenow/tools-aia.js';
  {
    const cleanScript = `(function execute(inputs, outputs) { outputs.result = inputs.value * 2; })(inputs, outputs);`;
    const dirtyScript = `(function execute(inputs, outputs) {
  gs.info('Starting');
  var dt = new GlideDateTime();
  var username = gs.getUserName();
  outputs.result = dt.getDisplayValue();
})(inputs, outputs);`;

    const cleanWarnings = scanToolScript(cleanScript);
    const dirtyWarnings = scanToolScript(dirtyScript);

    if (cleanWarnings.length === 0) {
      pass('scanToolScript returns no warnings for clean script');
    } else {
      fail(`scanToolScript returned false-positive warnings for clean script: ${cleanWarnings.join(', ')}`);
    }

    if (dirtyWarnings.length >= 3) {
      pass(`scanToolScript detects forbidden APIs (${dirtyWarnings.length} warnings found)`);
    } else {
      fail(`scanToolScript should detect at least 3 forbidden patterns, got: ${JSON.stringify(dirtyWarnings)}`);
    }

    const hasGsInfo = dirtyWarnings.some(w => w.includes('gs.info'));
    const hasGlideDateTime = dirtyWarnings.some(w => w.includes('GlideDateTime'));
    const hasGsGetUserName = dirtyWarnings.some(w => w.includes('getUserName'));
    if (hasGsInfo && hasGlideDateTime && hasGsGetUserName) {
      pass('scanToolScript correctly identifies gs.info, GlideDateTime, and gs.getUserName');
    } else {
      fail(`scanToolScript missing expected patterns. gs.info=${hasGsInfo}, GlideDateTime=${hasGlideDateTime}, getUserName=${hasGsGetUserName}`);
    }
  }

  // Test A+B combined: dryRun output includes warning section when forbidden APIs detected
  {
    const dryRunArgs = {
      agentName: 'Test Agent',
      agentDescription: 'Test',
      agentInstructions: 'Do stuff',
      tools: [{
        name: 'BadTool',
        description: 'Uses forbidden APIs',
        script: `(function execute(inputs, outputs) { gs.info('hello'); new GlideDateTime(); })(inputs, outputs);`,
        inputSchema: '[]',
      }],
      dryRun: true,
    };
    const dryResult = await handleAiaCreate(dryRunArgs);
    const dryText = (dryResult.content[0] as { text: string }).text;
    if (dryText.includes('FORBIDDEN') || dryText.includes('⚠️') || dryText.includes('hanging')) {
      pass('servicenow_aia_create dryRun output warns about forbidden APIs in tool script');
    } else {
      fail('servicenow_aia_create dryRun output missing forbidden API warning section');
    }
  }
```

**Also add to imports at the top of `validate-servicenow.ts`:**
```typescript
import { scanToolScript } from '../src/servicenow/tools-aia.js';
import { handleAiaCreate } from '../src/servicenow/tools-aia.js';
```

**Step: Run tests to verify they fail**

```bash
npm run test:servicenow 2>&1 | grep -E "PASS|FAIL|Error" | tail -30
```

Expected: Several FAIL lines for the new tests (functions not exported yet, description not updated yet).

---

## Task 3: Add `FORBIDDEN_PATTERNS` and `scanToolScript` to `tools-aia.ts`

**File:** `src/servicenow/tools-aia.ts`

Add after line 24 (after the `AIA_ROLE_HINT` constant):

```typescript
/** Patterns that hang indefinitely in ServiceNow AIA tool script execution contexts. */
interface ForbiddenPattern {
  regex: RegExp;
  label: string;
  suggestion: string;
}

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    regex: /\bgs\.(info|warn|error|log|print)\s*\(/g,
    label: 'gs.info/warn/error/log/print()',
    suggestion: 'use outputs.debug instead',
  },
  {
    regex: /\bgs\.(getUserName|getUserID|getSessionID|now)\s*\(/g,
    label: 'gs.getUserName/getUserID/getSessionID/now()',
    suggestion: 'session APIs are not available in tool context',
  },
  {
    regex: /\bnew\s+GlideDateTime\s*\(/g,
    label: 'new GlideDateTime()',
    suggestion: 'use new Date() instead',
  },
  {
    regex: /\bnew\s+GlideAjax\s*\(/g,
    label: 'new GlideAjax()',
    suggestion: 'client-side AJAX not available in tool context',
  },
];

/**
 * Scan a tool script for forbidden APIs that hang in AIA tool execution contexts.
 * Returns an array of warning strings (empty if clean).
 */
export function scanToolScript(script: string): string[] {
  const warnings: string[] = [];
  const lines = script.split('\n');

  for (const { regex, label, suggestion } of FORBIDDEN_PATTERNS) {
    const foundLines: number[] = [];
    lines.forEach((line, idx) => {
      regex.lastIndex = 0; // reset for global regex
      if (regex.test(line)) {
        foundLines.push(idx + 1);
      }
    });
    if (foundLines.length > 0) {
      warnings.push(`  - ${label} at line${foundLines.length > 1 ? 's' : ''} ${foundLines.join(', ')} — ${suggestion}`);
    }
  }

  return warnings;
}
```

**Step: Run tests — scanner tests should now pass, handler/description tests still fail**

```bash
npm run test:servicenow 2>&1 | grep -E "PASS|FAIL" | grep -i "forbidden\|scan"
```

Expected: `PASS scanToolScript returns no warnings`, `PASS scanToolScript detects forbidden APIs`, `PASS scanToolScript correctly identifies...`

**Step: Commit scanner**

```bash
git add src/servicenow/tools-aia.ts test/validate-servicenow.ts
git commit -m "feat: add scanToolScript for forbidden API detection (#82)"
```

---

## Task 4: Enrich script parameter description (Option B)

**File:** `src/servicenow/tools-aia.ts:276`

Replace:
```typescript
script: { type: 'string', description: 'Tool script (IIFE format)' },
```

With:
```typescript
script: {
  type: 'string',
  description: `Tool script (IIFE format). WARNING: These APIs hang indefinitely in tool scripts and must NOT be used: gs.info/warn/error/log/print() (use outputs.debug instead), gs.getUserName/getUserID/getSessionID/now() (session APIs unavailable), new GlideDateTime() (use new Date() instead), new GlideAjax() (unavailable in tool context). Use GlideRecordSecure for database queries.`,
},
```

**Step: Run tests — description test should now pass**

```bash
npm run test:servicenow 2>&1 | grep -E "PASS|FAIL" | grep -i "description\|forbidden"
```

Expected: `PASS servicenow_aia_create script description warns about forbidden APIs`

**Step: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "feat: enrich script param description with forbidden API list (#82)"
```

---

## Task 5: Integrate scanner into `handleAiaCreate` (Option A)

**File:** `src/servicenow/tools-aia.ts`

In `handleAiaCreate`, after line 1113 (`const tools = ...`), add forbidden API scanning:

```typescript
  // Scan tool scripts for forbidden APIs that hang in tool execution contexts
  const toolWarnings: string[] = [];
  for (const tool of tools) {
    if (tool.script) {
      const warnings = scanToolScript(tool.script);
      if (warnings.length > 0) {
        toolWarnings.push(`  Tool "${tool.name}":`);
        toolWarnings.push(...warnings);
      }
    }
  }

  const forbiddenWarningSection = toolWarnings.length > 0
    ? `\n⚠️  FORBIDDEN API WARNING — Scripts may hang indefinitely\n${'─'.repeat(60)}\n${toolWarnings.join('\n')}\n\nThese APIs hang indefinitely in AIA tool execution contexts.\nFix them before running the agent with servicenow_aia_execute.\n`
    : '';
```

Then in the dryRun return (around line 1151), incorporate `forbiddenWarningSection` into the response text. Change the text property to:

```typescript
text: `AI Agent Creation Plan — DRY RUN
${'═'.repeat(60)}
Instance: ${connStatus.activeInstance}

This is a preview. Set dryRun=false to create these records.
${forbiddenWarningSection}
${'─'.repeat(60)}
RECORDS TO CREATE
${'─'.repeat(60)}

${plan.join('\n')}

Tables that will be written:
  1. sn_aia_tool (${tools.length} record${tools.length !== 1 ? 's' : ''})
  2. sn_aia_agent (1 record)
  3. sn_aia_agent_tool_m2m (${tools.length} mapping${tools.length !== 1 ? 's' : ''})

Total API calls: ${1 + tools.length + tools.length}`,
```

Also add `forbiddenWarningSection` to the live creation success output (find the final return after all records are created, append it to the success message).

**Step: Run all tests**

```bash
npm run test:servicenow 2>&1 | grep -E "PASS|FAIL"
```

Expected: All new forbidden API tests pass. No regressions.

**Step: Build to verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: Clean build, no errors.

**Step: Commit**

```bash
git add src/servicenow/tools-aia.ts
git commit -m "feat: integrate forbidden API scanner into handleAiaCreate (#82)"
```

---

## Task 6: Export `handleAiaCreate` for test access

The `handleAiaCreate` test in Task 2 needs the function exported. Check if it's already exported in `tools-aia.ts`. If not, export it:

```typescript
export async function handleAiaCreate(args: Record<string, unknown>): Promise<ToolResult> {
```

(It's likely already a named function — just add `export`.)

---

## Task 7: Final verification

```bash
npm run test:servicenow 2>&1 | tail -20
npm run build 2>&1 | tail -5
```

Expected: All tests pass, clean build.

Check total test count didn't regress:
```bash
npm run test:servicenow 2>&1 | grep -E "^\d+ tests"
```

---

## Task 8: Push and create PR

```bash
git push -u origin fix/82-aia-create-forbidden-api-warnings
gh pr create \
  --repo Now-AI-Foundry/tool-foundry-mcp \
  --title "feat: warn about forbidden APIs in servicenow_aia_create (#82)" \
  --body "$(cat <<'EOF'
## Summary
- Adds `scanToolScript()` function that detects APIs known to hang indefinitely in AIA tool execution contexts
- Enriches the `script` parameter description in `servicenow_aia_create` schema with explicit forbidden API list (Option B)
- Integrates scanner into `handleAiaCreate` to warn in both dry-run and live creation output (Option A)

## Forbidden APIs detected
- `gs.info/warn/error/log/print()` — use `outputs.debug` instead
- `gs.getUserName/getUserID/getSessionID/now()` — session APIs unavailable
- `new GlideDateTime()` — use `new Date()` instead
- `new GlideAjax()` — unavailable in tool context

## Test plan
- [ ] `scanToolScript` returns no warnings for clean scripts
- [ ] `scanToolScript` detects all forbidden patterns with line numbers
- [ ] Schema description includes forbidden API names
- [ ] dryRun output includes `⚠️ FORBIDDEN API WARNING` section when patterns detected
- [ ] `npm run test:servicenow` passes with no regressions
- [ ] `npm run build` compiles cleanly

Closes #82

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
