/**
 * Connection Guard Helpers
 * Shared utilities for checking ServiceNow connection state
 */

import { connectionManager } from './connection-manager.js';
import { ServiceNowClient } from './client.js';
import type { ToolResult } from './tools.js';

/**
 * Result of a successful connection check
 */
export interface ConnectionContext {
  client: ServiceNowClient;
  instanceUrl: string;
}

/**
 * Check that a ServiceNow connection is active and return the client.
 * Returns either a ConnectionContext on success or a ToolResult error.
 */
export function requireConnection(): ConnectionContext | ToolResult {
  if (!connectionManager.isConnected()) {
    return {
      content: [{
        type: 'text',
        text: `Not connected to ServiceNow. Use servicenow_connect first.

Example:
  servicenow_connect with instance="dev12345.service-now.com", username="admin", password="..."`,
      }],
      isError: true,
    };
  }

  const client = connectionManager.getActiveClient();
  if (!client) {
    return {
      content: [{ type: 'text', text: 'Connection error: No active client' }],
      isError: true,
    };
  }

  const session = connectionManager.getActiveSession();
  connectionManager.touchSession();

  return {
    client,
    instanceUrl: session?.instanceUrl || '',
  };
}

/**
 * Type guard to check if requireConnection returned an error
 */
export function isConnectionError(result: ConnectionContext | ToolResult): result is ToolResult {
  return 'content' in result && Array.isArray((result as ToolResult).content);
}
