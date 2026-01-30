# Foundry MCP Server: Development Guide

Guide for developing, testing, and extending the Foundry MCP server.

---

## Quick Start

```bash
cd foundry-mcp
npm install
npm run build
npm test        # Run 90 tests
```

---

## Development Setup

### Prerequisites

- Node.js 18+
- TypeScript knowledge
- Claude Code (for integration testing)
- GitHub CLI (`gh auth login`) - for golden repo access

### Initial Setup

```bash
npm install
npm run build
npm test
```

### IDE Configuration

**VS Code recommended extensions:**
- TypeScript and JavaScript Language Features (built-in)
- ESLint (optional)

---

## Project Structure

```
foundry-mcp/
├── src/
│   ├── index.ts              # Main server (12 Foundry tools)
│   └── servicenow/           # ServiceNow tools (8)
│       ├── index.ts          # Exports
│       ├── tools.ts          # Tool definitions
│       ├── client.ts         # HTTP client
│       ├── connection-manager.ts
│       └── types.ts
├── dist/                     # Built JavaScript
├── test/
│   └── validate-init.ts      # 90 test cases
├── package.json
└── tsconfig.json
```

---

## Build Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Build TypeScript |
| `npm run dev` | Watch mode |
| `npm test` | Run all tests |
| `npm run test:keep` | Keep test output |

---

## Testing

### Automated Tests (90 tests)

```bash
npm test
```

Categories:
- Pre-flight (2): Golden repo, MCP build
- Init (5): Project creation, structure
- List (3): Context, skills, templates
- Add (3): Resources, duplicate detection
- Sync (3): Unchanged/modified/new detection
- Info (3): Resource readability
- Search (4): Name, content, scoring
- New (3): Resource creation
- Validate (4): Content validation
- Promote (4): PR workflow
- External (4): Plugin management
- Version (3): Lock files, hashing
- Templates (5): Settings, validation
- Bonus (2): Examples, gitignore

### Keep Test Output

```bash
npm run test:keep
ls .test-output/foundry-test-project/
```

### Manual Testing

1. Create test project:
```
Create a test POC using goldenPath /path/to/foundry-golden
```

2. Test specific tool
3. Verify output
4. Clean up

---

## Adding New Tools

### Step 1: Define Tool

```typescript
const MY_NEW_TOOL: Tool = {
  name: "foundry_mytool",
  description: "What this tool does",
  inputSchema: {
    type: "object" as const,
    properties: {
      requiredParam: {
        type: "string",
        description: "Description",
      },
    },
    required: ["requiredParam"],
  },
};
```

### Step 2: Register Tool

Add to tools list in `ListToolsRequestSchema` handler:

```typescript
tools: [
  FOUNDRY_INIT_TOOL,
  // ... other tools
  MY_NEW_TOOL,
],
```

### Step 3: Implement Handler

Add case in `CallToolRequestSchema` handler:

```typescript
if (name === "foundry_mytool") {
  const param = args?.requiredParam as string;

  // Implementation

  return {
    content: [{
      type: "text" as const,
      text: result.message,
    }],
    isError: !result.success,
  };
}
```

### Step 4: Add Tests

Add test function in `validate-init.ts`:

```typescript
async function testFoundryMyTool(): Promise<void> {
  // Test implementation
}
```

Call in `main()`:

```typescript
log("Foundry MyTool Tests:", "header");
await testFoundryMyTool();
```

---

## ServiceNow Tools

### Architecture

```
tools.ts           → Tool definitions
client.ts          → HTTP requests
connection-manager.ts → Session cache
types.ts           → TypeScript types
```

### Adding ServiceNow Tool

1. Add to `SERVICENOW_TOOLS` in `tools.ts`
2. Add handler in `handleServiceNowTool`
3. Use `client.ts` for HTTP requests
4. Handle errors appropriately

---

## Code Style

### TypeScript Conventions

- Explicit types for function parameters
- `const` assertions for object literals
- Async/await over raw promises
- Handle all error cases

### Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  return {
    success: false,
    message: `Failed: ${error instanceof Error ? error.message : String(error)}`,
  };
}
```

### MCP Response Format

```typescript
// Success
return {
  content: [{
    type: "text" as const,
    text: "Success message",
  }],
  isError: false,
};

// Error
return {
  content: [{
    type: "text" as const,
    text: "Error: Description",
  }],
  isError: true,
};
```

---

## Debugging

### Enable Logging

Add to stderr (MCP uses stdout for protocol):

```typescript
console.error("Debug:", data);
```

### Common Issues

**Tool not appearing:**
1. Check build succeeded
2. Check MCP config path is absolute
3. Restart Claude Code

**Golden repo clone fails:**
1. Check `gh auth status`
2. Check network
3. Use `goldenPath` parameter

**Script blocked:**
Check safety analyzer patterns in `index.ts`.

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/index.ts` | Main server, Foundry tools |
| `src/servicenow/*.ts` | ServiceNow tools |
| `dist/index.js` | Built server (run this) |
| `test/validate-init.ts` | 90 test cases |
