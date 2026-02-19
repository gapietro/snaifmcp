#!/usr/bin/env node
/**
 * Foundry MCP Server
 *
 * Provides three tool suites over MCP stdio transport:
 *   - Foundry tools  (project bootstrap, resource management, golden repo)
 *   - ServiceNow tools (instance connectivity, querying, scripting)
 *   - ServiceNow AI tools (AI Agents + Now Assist Skills)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Foundry tools
import { FOUNDRY_TOOLS, handleFoundryTool, isFoundryTool, } from "./foundry/tools.js";
// ServiceNow tools (core)
import { SERVICENOW_TOOLS, handleServiceNowTool, isServiceNowTool, } from "./servicenow/tools.js";
// ServiceNow AI Agent tools
import { AIA_TOOLS, handleAiaTool, isAiaTool, } from "./servicenow/tools-aia.js";
// ServiceNow Skill tools
import { SKILL_TOOLS, handleSkillTool, isSkillTool, } from "./servicenow/tools-skills.js";
// ── Server setup ────────────────────────────────────────────────
// Combined ServiceNow tools array for listing
const ALL_SERVICENOW_TOOLS = [...SERVICENOW_TOOLS, ...AIA_TOOLS, ...SKILL_TOOLS];
async function main() {
    const server = new Server({
        name: "foundry-mcp",
        version: "0.1.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    // List all available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [...FOUNDRY_TOOLS, ...ALL_SERVICENOW_TOOLS],
        };
    });
    // Dispatch tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const toolArgs = (args || {});
        // Core ServiceNow tools (connect, disconnect, status, syslogs, aia_logs, query, script, instance)
        if (isServiceNowTool(name)) {
            const result = await handleServiceNowTool(name, toolArgs);
            if (result)
                return result;
        }
        // AI Agent tools (aia_list, aia_get, aia_trace, aia_errors, aia_execute, aia_create)
        if (isAiaTool(name)) {
            const result = await handleAiaTool(name, toolArgs);
            if (result)
                return result;
        }
        // Skill tools (skill_list, skill_get, skill_execute, skill_create)
        if (isSkillTool(name)) {
            const result = await handleSkillTool(name, toolArgs);
            if (result)
                return result;
        }
        // Foundry tools return { success, message } — wrap into MCP format
        if (isFoundryTool(name)) {
            const result = await handleFoundryTool(name, toolArgs);
            return {
                content: [{ type: "text", text: result.message }],
                isError: !result.success,
            };
        }
        // Unknown tool
        return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
        };
    });
    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Foundry MCP server started");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map