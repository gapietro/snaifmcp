# Foundry MCP Server: How-To Guide

Detailed guide for developing, testing, and extending the Foundry MCP server.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Building and Running](#building-and-running)
3. [Testing](#testing)
4. [Adding New Tools](#adding-new-tools)
5. [Debugging](#debugging)
6. [Deployment](#deployment)

---

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- TypeScript knowledge
- Claude Code installed (for integration testing)
- **GitHub CLI authenticated** (`gh auth login`) - required for private golden repo access

### Initial Setup

```bash
# Clone the repository (if not already)
cd /path/to/snaifmcp/foundry-mcp

# Install dependencies
npm install

# Verify TypeScript compiles
npm run build

# Verify tests pass
npm test
```

### IDE Configuration

**VS Code recommended extensions:**
- TypeScript and JavaScript Language Features (built-in)
- ESLint (if configured)
- Prettier (optional)

**tsconfig.json settings:**
- Target: ES2022
- Module: NodeNext
- Strict mode enabled

---

## Building and Running

### Build Commands

```bash
# One-time build
npm run build

# Watch mode (rebuilds on changes)
npm run dev

# Clean build
rm -rf dist && npm run build
```

### Output

Build produces:
- `dist/index.js` - Main server entry point
- `dist/index.d.ts` - TypeScript declarations
- `dist/index.js.map` - Source maps for debugging

### Running Directly

For testing without Claude Code:

```bash
# Run the server (will wait for MCP connections on stdin/stdout)
node dist/index.js

# The server logs "Foundry MCP server started" to stderr on success
```

---

## Testing

### Acceptance Tests

The test suite validates all MVP acceptance criteria:

```bash
# Run tests (cleans up after)
npm test

# Run tests and keep output for inspection
npm run test:keep

# Output location (when using --keep)
ls .test-output/foundry-test-project/
```

### What Tests Validate

| Test | Acceptance Criteria |
|------|---------------------|
| Golden repo exists | Pre-flight check |
| MCP server built | AC5: Works with Claude Code |
| Project directory created | AC1: Creates directory |
| Context files present | AC2: 3 context files |
| Skills present | AC3: 2+ skill directories |
| CLAUDE.md has SPARC structure | AC4: Template works |
| No additional setup required | AC6: Ready to use |

### Manual Testing

1. **Start Claude Code** with Foundry configured

2. **Test basic init:**
   ```
   Create a test project called "manual-test"
   ```

3. **Test with custom path:**
   ```
   Create a project called "path-test" in /tmp
   ```

4. **Test with local golden repo:**
   ```
   Create "local-test" using goldenPath /path/to/foundry-golden
   ```

5. **Verify output:**
   ```bash
   ls -la manual-test/
   cat manual-test/CLAUDE.md
   ls -la manual-test/.claude/context/
   ls -la manual-test/.claude/skills/
   ```

6. **Clean up:**
   ```bash
   rm -rf manual-test path-test local-test
   ```

### Testing Error Cases

| Test Case | Expected Behavior |
|-----------|-------------------|
| Invalid project name (`my project!`) | Returns error about invalid characters |
| Existing directory | Returns error about existing directory |
| Missing golden repo | Returns error about clone failure |
| Network offline | Uses cached golden repo or returns error |

---

## Adding New Tools

### Step 1: Define the Tool

Add tool definition in `src/index.ts`:

```typescript
const MY_NEW_TOOL: Tool = {
  name: "foundry_mytool",
  description: "What this tool does",
  inputSchema: {
    type: "object" as const,
    properties: {
      requiredParam: {
        type: "string",
        description: "Description of parameter",
      },
      optionalParam: {
        type: "boolean",
        description: "Optional parameter",
      },
    },
    required: ["requiredParam"],
  },
};
```

### Step 2: Register the Tool

Add to the tools list in `ListToolsRequestSchema` handler:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [FOUNDRY_INIT_TOOL, MY_NEW_TOOL],  // Add here
  };
});
```

### Step 3: Implement Handler

Add case in `CallToolRequestSchema` handler:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "foundry_init") {
    // existing code...
  }

  if (name === "foundry_mytool") {
    const requiredParam = args?.requiredParam as string;
    const optionalParam = args?.optionalParam as boolean ?? false;

    // Implement your logic
    const result = await myToolImplementation(requiredParam, optionalParam);

    return {
      content: [{
        type: "text" as const,
        text: result.message,
      }],
      isError: !result.success,
    };
  }

  return {
    content: [{
      type: "text" as const,
      text: `Unknown tool: ${name}`,
    }],
    isError: true,
  };
});
```

### Step 4: Add Tests

Create or update test file to cover new tool:

```typescript
// test/validate-mytool.ts
async function testMyTool(): Promise<void> {
  // Test implementation
}
```

### Step 5: Update Documentation

- Add tool to README.md tool reference
- Update HOWTO.md if needed
- Add to parent docs/HOWTO.md

---

## Debugging

### Enable Verbose Logging

Add debug output to stderr (MCP uses stdout for protocol):

```typescript
console.error("Debug: Processing request", request.params);
```

### Common Issues

#### "Tool not appearing in Claude Code"

1. Verify build succeeded: `ls dist/index.js`
2. Check MCP config path is absolute
3. Restart Claude Code completely
4. Check stderr for startup errors

#### "Golden repo clone fails"

1. **Check GitHub CLI auth**: Run `gh auth status` - you must be logged in
2. **Re-authenticate if needed**: Run `gh auth login`
3. **Verify repo access**: Run `gh repo view gapietro/foundry-golden`
4. Check network connectivity
5. Try with `goldenPath` parameter to use local copy
6. Check `~/.foundry/golden/` permissions

#### "Project creation fails silently"

1. Check target directory permissions
2. Verify project name is valid
3. Look for existing directory with same name
4. Check disk space

### Inspecting MCP Communication

The MCP protocol uses JSON-RPC over stdin/stdout. To see raw messages:

```bash
# Run server and manually send requests
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
```

---

## Deployment

### Local Installation

For team members using from source:

```bash
# Clone repo
git clone <repo-url>
cd snaifmcp/foundry-mcp

# Build
npm install
npm run build

# Configure Claude Code with absolute path
```

### npm Publishing (Future)

When ready for broader distribution:

1. Update `package.json` version
2. Ensure `files` array is correct
3. Test package locally: `npm pack`
4. Publish: `npm publish`

### Distribution Checklist

- [ ] All tests pass
- [ ] README is current
- [ ] Version bumped appropriately
- [ ] CHANGELOG updated (if exists)
- [ ] No sensitive data in package

---

## Code Style

### TypeScript Conventions

- Use explicit types for function parameters
- Use `const` assertions for object literals
- Handle all error cases explicitly
- Use async/await over raw promises

### Error Handling

```typescript
// Good: Explicit error handling
try {
  await riskyOperation();
} catch (error) {
  return {
    success: false,
    message: `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
  };
}

// Good: Cleanup on failure
try {
  await createDirectory(path);
  await copyFiles(src, path);
} catch (error) {
  // Clean up partial work
  await fs.rm(path, { recursive: true, force: true }).catch(() => {});
  throw error;
}
```

### MCP Response Format

```typescript
// Success response
return {
  content: [{
    type: "text" as const,
    text: "Success message with helpful next steps",
  }],
  isError: false,
};

// Error response
return {
  content: [{
    type: "text" as const,
    text: "Error: Clear description of what went wrong",
  }],
  isError: true,
};
```

---

## Quick Reference

### Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main server implementation |
| `dist/index.js` | Built server (run this) |
| `test/validate-init.ts` | Acceptance tests |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |

### Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Build TypeScript |
| `npm run dev` | Build in watch mode |
| `npm test` | Run acceptance tests |
| `npm run test:keep` | Tests with output preserved |

### MCP Tool Response

```typescript
{
  content: [{ type: "text", text: "message" }],
  isError: boolean
}
```
