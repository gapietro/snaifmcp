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
import { CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
// Foundry tools
import { FOUNDRY_TOOLS, handleFoundryTool, isFoundryTool, } from "./foundry/tools.js";
// ServiceNow tools (core)
import { SERVICENOW_TOOLS, handleServiceNowTool, isServiceNowTool, } from "./servicenow/tools.js";
// ServiceNow AI Agent tools
import { AIA_TOOLS, handleAiaTool, isAiaTool, } from "./servicenow/tools-aia.js";
// ServiceNow Skill tools
import { SKILL_TOOLS, handleSkillTool, isSkillTool, } from "./servicenow/tools-skills.js";
// ServiceNow Flow Designer tools
import { FLOW_TOOLS, handleFlowTool, isFlowTool, } from "./servicenow/tools-flow.js";
// Skills state
import { getInstalledSkills } from "./foundry/skills-state.js";
import { CONFIG } from "./shared/config.js";
// ── Server setup ────────────────────────────────────────────────
// Combined ServiceNow tools array for listing
const ALL_SERVICENOW_TOOLS = [...SERVICENOW_TOOLS, ...AIA_TOOLS, ...SKILL_TOOLS, ...FLOW_TOOLS];
/**
 * Warn at startup if recommended global skills are not installed
 */
async function warnMissingRecommendedSkills() {
    if (!CONFIG.notifyOnRelevantNotInstalled)
        return;
    try {
        const { ensureGoldenRepo, listSkills } = await import("./foundry/golden-repo.js");
        const goldenPath = CONFIG.cacheDir;
        // Only run if cache already exists (non-blocking)
        try {
            await fs.stat(goldenPath);
        }
        catch {
            return; // No cache yet, skip warning
        }
        const skills = await listSkills(goldenPath, false);
        const recommended = skills.filter(s => s.scope === "global" && s.recommended);
        for (const skill of recommended) {
            const { isInstalled } = await import("./foundry/skills-state.js");
            const installed = await isInstalled(skill.name);
            if (!installed) {
                console.error(`[foundry] Recommended global skill not installed: ${skill.name}\n` +
                    `  Install: foundry_add type="skill" name="${skill.name}" global=true`);
            }
        }
    }
    catch {
        // Non-critical — silently ignore errors in startup warning
    }
}
/**
 * Read SKILL.md content for a globally installed skill
 */
async function readInstalledSkillContent(name) {
    const skillFile = path.join(CONFIG.skillsInstallDir, name, "SKILL.md");
    try {
        return await fs.readFile(skillFile, "utf-8");
    }
    catch {
        return null;
    }
}
async function main() {
    const server = new Server({
        name: "foundry-mcp",
        version: "0.1.0",
    }, {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
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
        // Flow Designer tools (flow_list, flow_get)
        if (isFlowTool(name)) {
            const result = await handleFlowTool(name, toolArgs);
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
    // MCP resource handlers — expose globally installed skills as readable resources
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        const installed = await getInstalledSkills();
        const globalSkills = installed.filter(s => s.scope === "global");
        return {
            resources: globalSkills.map(s => ({
                uri: `skill://${s.name}`,
                name: s.name,
                description: `Global Claude Code skill: ${s.name}`,
                mimeType: "text/markdown",
            })),
        };
    });
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const skillName = request.params.uri.replace("skill://", "").split("/")[0];
        const content = await readInstalledSkillContent(skillName);
        if (!content)
            throw new Error(`Skill "${skillName}" not found or not installed globally`);
        return {
            contents: [
                {
                    uri: request.params.uri,
                    mimeType: "text/markdown",
                    text: content,
                },
            ],
        };
    });
    // MCP prompt handlers — expose globally installed skills as slash commands
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
        const installed = await getInstalledSkills();
        const globalSkills = installed.filter(s => s.scope === "global");
        return {
            prompts: globalSkills.map(s => ({
                name: s.name,
                description: `Global Claude Code skill: ${s.name}`,
            })),
        };
    });
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const skillName = request.params.name;
        const content = await readInstalledSkillContent(skillName);
        if (!content)
            throw new Error(`Skill "${skillName}" not found or not installed globally`);
        return {
            messages: [
                {
                    role: "user",
                    content: { type: "text", text: content },
                },
            ],
        };
    });
    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Foundry MCP server started");
    await warnMissingRecommendedSkills();
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map