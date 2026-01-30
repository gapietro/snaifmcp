/**
 * ServiceNow HTTP Client
 * Handles all HTTP communication with ServiceNow instances
 */
import { ServiceNowError, ServiceNowErrorType, } from './types.js';
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    retryableErrors: [
        ServiceNowErrorType.INSTANCE_UNAVAILABLE,
        ServiceNowErrorType.TOKEN_EXPIRED,
        ServiceNowErrorType.RATE_LIMITED,
    ],
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2,
};
export class ServiceNowClient {
    instanceUrl;
    authConfig;
    accessToken;
    retryConfig;
    constructor(instanceUrl, authConfig, retryConfig = {}) {
        // Normalize instance URL
        this.instanceUrl = this.normalizeInstanceUrl(instanceUrl);
        this.authConfig = authConfig;
        this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
        // If OAuth with existing access token, use it
        if (authConfig.type === 'oauth' && authConfig.accessToken) {
            this.accessToken = authConfig.accessToken;
        }
    }
    /**
     * Normalize instance URL to consistent format
     */
    normalizeInstanceUrl(url) {
        let normalized = url.trim().toLowerCase();
        // Remove trailing slashes
        normalized = normalized.replace(/\/+$/, '');
        // Add https if no protocol
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = `https://${normalized}`;
        }
        // Upgrade http to https
        if (normalized.startsWith('http://')) {
            normalized = normalized.replace('http://', 'https://');
        }
        return normalized;
    }
    /**
     * Get authorization header based on auth type
     */
    getAuthHeader() {
        switch (this.authConfig.type) {
            case 'basic': {
                const credentials = Buffer.from(`${this.authConfig.username}:${this.authConfig.password}`).toString('base64');
                return `Basic ${credentials}`;
            }
            case 'oauth': {
                if (!this.accessToken) {
                    throw new ServiceNowError(ServiceNowErrorType.AUTHENTICATION_FAILED, 'No access token available. Call authenticate() first.', undefined, 'Use OAuth token exchange to get an access token');
                }
                return `Bearer ${this.accessToken}`;
            }
            case 'token': {
                return `Bearer ${this.authConfig.token}`;
            }
        }
    }
    /**
     * Make an HTTP request to ServiceNow
     */
    async request(endpoint, options = {}) {
        const url = `${this.instanceUrl}${endpoint}`;
        const method = options.method || 'GET';
        const timeout = options.timeout || 30000;
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.getAuthHeader(),
            ...options.headers,
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method,
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            // Handle non-OK responses
            if (!response.ok) {
                await this.handleErrorResponse(response);
            }
            // Parse JSON response
            const data = await response.json();
            return data;
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof ServiceNowError) {
                throw error;
            }
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new ServiceNowError(ServiceNowErrorType.INSTANCE_UNAVAILABLE, `Request timed out after ${timeout}ms`, { endpoint, timeout }, 'Check instance availability or increase timeout');
                }
                // Network errors
                if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
                    throw new ServiceNowError(ServiceNowErrorType.INSTANCE_UNAVAILABLE, `Cannot connect to ${this.instanceUrl}`, { originalError: error.message }, 'Verify the instance URL is correct and the instance is accessible');
                }
            }
            throw new ServiceNowError(ServiceNowErrorType.UNKNOWN_ERROR, `Request failed: ${error instanceof Error ? error.message : String(error)}`, { endpoint });
        }
    }
    /**
     * Handle error responses from ServiceNow
     */
    async handleErrorResponse(response) {
        let errorBody = {};
        try {
            const parsed = await response.json();
            if (parsed && typeof parsed === 'object') {
                errorBody = parsed;
            }
        }
        catch {
            // Body not JSON, use status text
        }
        const status = response.status;
        const message = errorBody.error?.message
            || response.statusText
            || 'Unknown error';
        switch (status) {
            case 401:
                throw new ServiceNowError(ServiceNowErrorType.AUTHENTICATION_FAILED, 'Authentication failed. Check your credentials.', { status, body: errorBody }, 'Verify username/password or refresh your OAuth token');
            case 403:
                throw new ServiceNowError(ServiceNowErrorType.ACL_DENIED, `Access denied: ${message}`, { status, body: errorBody }, 'Check that your user has the required roles and ACL permissions');
            case 404:
                throw new ServiceNowError(ServiceNowErrorType.TABLE_NOT_ACCESSIBLE, `Resource not found: ${message}`, { status, body: errorBody }, 'Verify the table name or endpoint exists');
            case 429:
                throw new ServiceNowError(ServiceNowErrorType.RATE_LIMITED, 'Rate limit exceeded. Too many requests.', { status, body: errorBody }, 'Wait a moment before retrying');
            case 500:
            case 502:
            case 503:
            case 504:
                throw new ServiceNowError(ServiceNowErrorType.INSTANCE_UNAVAILABLE, `ServiceNow instance error: ${message}`, { status, body: errorBody }, 'The instance may be under maintenance. Try again later.');
            default:
                throw new ServiceNowError(ServiceNowErrorType.UNKNOWN_ERROR, `Request failed with status ${status}: ${message}`, { status, body: errorBody });
        }
    }
    /**
     * Make a request with automatic retry for transient errors
     */
    async requestWithRetry(endpoint, options = {}) {
        let lastError;
        let delay = this.retryConfig.initialDelayMs;
        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await this.request(endpoint, options);
            }
            catch (error) {
                if (error instanceof ServiceNowError) {
                    lastError = error;
                    // Check if error is retryable
                    if (this.retryConfig.retryableErrors.includes(error.type) &&
                        attempt < this.retryConfig.maxRetries) {
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay = Math.min(delay * this.retryConfig.multiplier, this.retryConfig.maxDelayMs);
                        continue;
                    }
                }
                throw error;
            }
        }
        throw lastError || new ServiceNowError(ServiceNowErrorType.UNKNOWN_ERROR, 'Max retries exceeded');
    }
    /**
     * Test connection and get instance info
     */
    async testConnection() {
        // Query sys_properties for instance version
        const response = await this.requestWithRetry('/api/now/table/sys_properties?sysparm_query=name=glide.buildtag&sysparm_fields=value&sysparm_limit=1');
        const buildTag = response.result[0]?.value || 'unknown';
        // Extract version from build tag (e.g., "glide-vancouver-12-15-2025")
        const versionMatch = buildTag.match(/glide-(\w+)-/i);
        const version = versionMatch ? versionMatch[1] : buildTag;
        return {
            version: version.charAt(0).toUpperCase() + version.slice(1),
            buildTag,
            isActive: true,
        };
    }
    /**
     * Get current user info
     */
    async getCurrentUser() {
        // Get current user's sys_id from session
        const sessionResponse = await this.requestWithRetry('/api/now/ui/user/current_user');
        const userSysId = sessionResponse.result?.user_sys_id;
        if (!userSysId) {
            throw new ServiceNowError(ServiceNowErrorType.AUTHENTICATION_FAILED, 'Could not determine current user', { response: sessionResponse });
        }
        // Get full user record
        const userResponse = await this.requestWithRetry(`/api/now/table/sys_user/${userSysId}?sysparm_fields=sys_id,user_name,first_name,last_name,email,active`);
        const user = userResponse.result;
        // Get user roles
        const rolesResponse = await this.requestWithRetry(`/api/now/table/sys_user_has_role?sysparm_query=user=${userSysId}&sysparm_fields=role.name`);
        const roles = rolesResponse.result.map(r => {
            const roleName = r['role.name'] || r.role;
            return typeof roleName === 'object' ? roleName.value : roleName;
        }).filter(Boolean);
        return {
            sysId: user.sys_id,
            userName: user.user_name,
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            email: user.email || '',
            roles,
            active: user.active === 'true' || user.active === true,
        };
    }
    /**
     * Query a table
     */
    async queryTable(table, query, fields, limit = 100) {
        const params = new URLSearchParams();
        if (query)
            params.set('sysparm_query', query);
        if (fields?.length)
            params.set('sysparm_fields', fields.join(','));
        params.set('sysparm_limit', String(limit));
        const endpoint = `/api/now/table/${table}?${params.toString()}`;
        return this.requestWithRetry(endpoint);
    }
    /**
     * Set access token (for OAuth)
     */
    setAccessToken(token) {
        this.accessToken = token;
    }
    /**
     * Get instance URL
     */
    getInstanceUrl() {
        return this.instanceUrl;
    }
}
//# sourceMappingURL=client.js.map