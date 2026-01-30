/**
 * ServiceNow MCP Tools
 * Tool definitions and handlers for ServiceNow integration
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';
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
export declare function handleServiceNowInstance(args: Record<string, unknown>): Promise<ToolResult>;
export declare function handleServiceNowTool(name: string, args: Record<string, unknown>): Promise<ToolResult | null>;
export declare function isServiceNowTool(name: string): boolean;
//# sourceMappingURL=tools.d.ts.map