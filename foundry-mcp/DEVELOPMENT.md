# Foundry MCP Server: Development & Architecture

Technical documentation for contributors and maintainers.

---

## Architecture Overview

### System Context

```
┌──────────────────────────────────────────────────────────────────┐
│                         User Workflow                            │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Claude Code                              │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  User Prompt    │───▶│  Claude LLM     │                     │
│  │  "Create POC"   │    │  (decides to    │                     │
│  └─────────────────┘    │   use tool)     │                     │
│                         └────────┬────────┘                     │
│                                  │                               │
│                         ┌────────▼────────┐                     │
│                         │  MCP Client     │                     │
│                         │  (tool caller)  │                     │
│                         └────────┬────────┘                     │
└──────────────────────────────────┼───────────────────────────────┘
                                   │ JSON-RPC over stdio
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                      foundry-mcp Server                          │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │  Tool Registry  │    │  Tool Handlers  │                     │
│  │  - foundry_init │───▶│  - initProject  │                     │
│  │  - (future)     │    │  - (future)     │                     │
│  └─────────────────┘    └────────┬────────┘                     │
│                                  │                               │
│                         ┌────────▼────────┐                     │
│                         │  Golden Repo    │                     │
│                         │  Manager        │                     │
│                         └────────┬────────┘                     │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
          ┌─────────────────┐            ┌─────────────────┐
          │  GitHub         │            │  Local Cache    │
          │  foundry-golden │            │  ~/.foundry/    │
          └─────────────────┘            └─────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Claude Code | User interface, LLM interaction, MCP client |
| foundry-mcp | Tool definitions, request handling, project creation |
| Golden Repo Manager | Fetch, cache, and provide golden repo content |
| foundry-golden | Store vetted resources (context, skills, templates) |

---

## Code Structure

### Entry Point: `src/index.ts`

```typescript
// Configuration constants
const CONFIG = { ... };

// Tool definitions
const FOUNDRY_INIT_TOOL: Tool = { ... };

// Helper functions
async function directoryExists(path: string): Promise<boolean> { ... }
async function copyDirectory(src: string, dest: string): Promise<void> { ... }
async function ensureGoldenRepo(): Promise<string> { ... }
async function initializeProject(...): Promise<Result> { ... }

// Server setup
async function main() {
  const server = new Server(...);
  server.setRequestHandler(ListToolsRequestSchema, ...);
  server.setRequestHandler(CallToolRequestSchema, ...);
  await server.connect(transport);
}
```

### Key Functions

#### `ensureGoldenRepo()`

Manages golden repository caching:

```typescript
async function ensureGoldenRepo(): Promise<string> {
  // 1. Check if cache exists
  // 2. If exists and fresh, return path
  // 3. If exists but stale, try to update
  // 4. If doesn't exist, clone from GitHub
  // 5. Return cache path
}
```

**Caching strategy:**
- Cache location: `~/.foundry/golden/`
- Cache TTL: 24 hours
- Staleness marker: `.cache-timestamp` file
- Failure handling: Use stale cache if update fails

#### `initializeProject()`

Core project creation logic:

```typescript
async function initializeProject(
  projectName: string,
  parentPath: string,
  goldenPath?: string
): Promise<{ success: boolean; message: string; projectPath?: string }> {
  // 1. Validate project name
  // 2. Determine golden repo path (param or cached)
  // 3. Check project doesn't already exist
  // 4. Verify golden repo structure
  // 5. Create project directory
  // 6. Copy context, skills, template
  // 7. Create .gitignore
  // 8. Return success with next steps
}
```

---

## MCP Protocol

### Tool Registration

Tools are registered via `ListToolsRequestSchema`:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [FOUNDRY_INIT_TOOL],
  };
});
```

### Tool Execution

Tool calls handled via `CallToolRequestSchema`:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "foundry_init") {
    // Handle tool
  }

  return { content: [...], isError: boolean };
});
```

### Response Format

```typescript
// Success
{
  content: [{
    type: "text",
    text: "Success message"
  }],
  isError: false
}

// Error
{
  content: [{
    type: "text",
    text: "Error: description"
  }],
  isError: true
}
```

---

## Design Decisions

### Why MCP over CLI?

| Aspect | MCP Server | CLI Tool |
|--------|------------|----------|
| Integration | Native Claude Code support | Requires bash calls |
| Context | Can access conversation context | Isolated execution |
| Discoverability | Listed in available tools | User must know command |
| Error handling | Structured responses | Exit codes + stderr |

**Decision:** MCP provides better UX for Claude Code integration.

### Why Copy Instead of Symlink?

| Approach | Pros | Cons |
|----------|------|------|
| Copy | Independent projects, works offline | Larger disk usage, no auto-updates |
| Symlink | Smaller, always current | Requires golden repo, breaks if moved |

**Decision:** Copy for independence and portability.

### Why Cache Golden Repo?

| Approach | Pros | Cons |
|----------|------|------|
| Always clone | Always fresh | Slow, requires network |
| Cache forever | Fast, offline works | May become stale |
| Cache with TTL | Balance of both | Complexity |

**Decision:** 24-hour TTL cache with offline fallback.

---

## Extension Points

### Adding New Tools

See [HOWTO.md](HOWTO.md#adding-new-tools) for step-by-step guide.

### Adding New Resource Types

1. Update golden repo structure
2. Modify `initializeProject()` to copy new type
3. Update tests to validate new type
4. Document in README

### Customizing Cache Behavior

Modify `CONFIG` constants:

```typescript
const CONFIG = {
  goldenRepoUrl: "https://github.com/...",  // Change repo
  cacheDir: path.join(...),                  // Change location
  cacheMaxAgeHours: 24,                      // Change TTL
};
```

---

## Testing Strategy

### Unit Tests (Future)

Individual function testing:
- `directoryExists()`
- `copyDirectory()`
- `processTemplate()`
- Project name validation

### Integration Tests

Current `validate-init.ts` is an integration test:
- Simulates full `foundry_init` workflow
- Validates output structure
- Checks all acceptance criteria

### Manual Testing

Required for MCP integration:
- Tool appears in Claude Code
- Tool executes correctly
- Error messages are helpful

---

## Error Handling

### Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Validation | Invalid project name | Return descriptive error |
| File system | Permission denied | Return error, clean up |
| Network | Clone failed | Fall back to cache |
| Internal | Unexpected state | Log and return generic error |

### Cleanup on Failure

```typescript
try {
  // Create project
} catch (error) {
  // Clean up partial work
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  return { success: false, message: ... };
}
```

---

## Future Considerations

### Performance

- Consider parallel file copying for large projects
- Implement incremental cache updates (git pull vs clone)
- Add progress reporting for long operations

### Security

- Validate golden repo content integrity
- Sanitize project names more strictly
- Consider code signing for distributed package

### Scalability

- Support multiple golden repos
- Implement resource namespacing
- Add versioning for resources

---

## Contributing

### Pull Request Process

1. Fork/branch from main
2. Make changes with tests
3. Ensure `npm test` passes
4. Update documentation
5. Submit PR with description

### Code Review Checklist

- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Error cases handled
- [ ] Documentation updated
- [ ] No sensitive data exposed

### Release Process

1. Update version in `package.json`
2. Update CHANGELOG (if exists)
3. Create git tag
4. Build and test
5. Publish (when npm publishing enabled)
