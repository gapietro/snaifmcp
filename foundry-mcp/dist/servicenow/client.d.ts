/**
 * ServiceNow HTTP Client
 * Handles all HTTP communication with ServiceNow instances
 */
import { AuthConfig, ServiceNowErrorType, TableAPIResponse, SingleRecordResponse, InstanceInfo, UserInfo } from './types.js';
interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
}
interface RetryConfig {
    maxRetries: number;
    retryableErrors: ServiceNowErrorType[];
    initialDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
}
export declare class ServiceNowClient {
    private instanceUrl;
    private authConfig;
    private accessToken?;
    private retryConfig;
    constructor(instanceUrl: string, authConfig: AuthConfig, retryConfig?: Partial<RetryConfig>);
    /**
     * Normalize instance URL to consistent format
     */
    private normalizeInstanceUrl;
    /**
     * Get authorization header based on auth type
     */
    private getAuthHeader;
    /**
     * Make an HTTP request to ServiceNow
     */
    private request;
    /**
     * Handle error responses from ServiceNow
     */
    private handleErrorResponse;
    /**
     * Make a request with automatic retry for transient errors
     */
    requestWithRetry<T>(endpoint: string, options?: RequestOptions): Promise<T>;
    /**
     * Test connection and get instance info
     */
    testConnection(): Promise<InstanceInfo>;
    /**
     * Get current user info
     */
    getCurrentUser(): Promise<UserInfo>;
    /**
     * Query a table
     */
    queryTable(table: string, query?: string, fields?: string[], limit?: number): Promise<TableAPIResponse>;
    /**
     * Create a record in a table
     */
    createRecord(table: string, data: Record<string, unknown>): Promise<SingleRecordResponse>;
    /**
     * Update a record in a table
     */
    updateRecord(table: string, sysId: string, data: Record<string, unknown>): Promise<SingleRecordResponse>;
    /**
     * Delete a record from a table
     */
    deleteRecord(table: string, sysId: string): Promise<void>;
    /**
     * Set access token (for OAuth)
     */
    setAccessToken(token: string): void;
    /**
     * Get instance URL
     */
    getInstanceUrl(): string;
}
export {};
//# sourceMappingURL=client.d.ts.map