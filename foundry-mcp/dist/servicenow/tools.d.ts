/**
 * ServiceNow MCP Tools
 * Tool definitions and handlers for ServiceNow integration
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';
/** Role hint included in AIA logs error messages when table access fails. */
export declare const AIA_LOGS_ROLE_HINT = "Ensure your user has the `sn_aia.admin` role for AI Agent table access.";
export declare const SERVICENOW_CONNECT_TOOL: Tool;
export declare const SERVICENOW_DISCONNECT_TOOL: Tool;
export declare const SERVICENOW_STATUS_TOOL: Tool;
export declare const SERVICENOW_SYSLOGS_TOOL: Tool;
export declare const SERVICENOW_AIA_LOGS_TOOL: Tool;
export declare const SERVICENOW_QUERY_TOOL: Tool;
export declare const SERVICENOW_SCRIPT_TOOL: Tool;
export declare const SERVICENOW_INSTANCE_TOOL: Tool;
export declare const SERVICENOW_TOOLS: Tool[];
export interface ToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
    [key: string]: unknown;
}
export declare function handleServiceNowConnect(args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowDisconnect(args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowStatus(_args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowSyslogs(args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowAiaLogs(args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowQuery(args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowScript(args: Record<string, unknown>): Promise<ToolResult>;
/** System properties to query for version detection (ordered by reliability). */
export declare const VERSION_PROPERTIES: string[];
/** Extract a ServiceNow release name (e.g. "Vancouver") from a build tag string. */
export declare function parseVersionFromBuildTag(buildTag: string): string | null;
/** Configuration for a feature's plugin detection. */
export interface FeaturePluginConfig {
    plugins: string[];
    pluginTables: string[];
    pluginQueryType: 'exact' | 'like';
    tables: string[];
    description: string;
}
export declare const FEATURE_PLUGINS: Record<string, FeaturePluginConfig>;
export declare function handleServiceNowInstance(args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowTool(name: string, args: Record<string, unknown>): Promise<ToolResult | null>;
export declare function isServiceNowTool(name: string): boolean;
//# sourceMappingURL=tools.d.ts.map