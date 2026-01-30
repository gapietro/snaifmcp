/**
 * ServiceNow Integration Types
 */
export type AuthType = 'basic' | 'oauth' | 'token';
export interface BasicAuthConfig {
    type: 'basic';
    username: string;
    password: string;
}
export interface OAuthConfig {
    type: 'oauth';
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
}
export interface TokenAuthConfig {
    type: 'token';
    token: string;
}
export type AuthConfig = BasicAuthConfig | OAuthConfig | TokenAuthConfig;
export interface ConnectionSession {
    instanceUrl: string;
    authType: AuthType;
    authConfig: AuthConfig;
    accessToken?: string;
    tokenExpiry?: Date;
    userId?: string;
    userName?: string;
    userRoles?: string[];
    instanceVersion?: string;
    createdAt: Date;
    lastUsed: Date;
}
export interface ConnectionResult {
    success: boolean;
    message: string;
    session?: {
        instanceUrl: string;
        instanceVersion: string;
        user: string;
        roles: string[];
    };
    error?: {
        type: ServiceNowErrorType;
        details?: string;
    };
}
export interface InstanceInfo {
    version: string;
    buildTag?: string;
    buildDate?: string;
    isActive: boolean;
}
export interface UserInfo {
    sysId: string;
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    roles: string[];
    active: boolean;
}
export declare enum ServiceNowErrorType {
    CONNECTION_FAILED = "connection_failed",
    AUTHENTICATION_FAILED = "authentication_failed",
    TOKEN_EXPIRED = "token_expired",
    INSTANCE_UNAVAILABLE = "instance_unavailable",
    INVALID_INSTANCE = "invalid_instance",
    ACL_DENIED = "acl_denied",
    ROLE_REQUIRED = "role_required",
    TABLE_NOT_ACCESSIBLE = "table_not_accessible",
    SCRIPT_TIMEOUT = "script_timeout",
    SCRIPT_ERROR = "script_error",
    SCRIPT_BLOCKED = "script_blocked",
    QUERY_ERROR = "query_error",
    RATE_LIMITED = "rate_limited",
    QUOTA_EXCEEDED = "quota_exceeded",
    DANGEROUS_OPERATION = "dangerous_operation",
    SENSITIVE_DATA = "sensitive_data",
    UNKNOWN_ERROR = "unknown_error"
}
export declare class ServiceNowError extends Error {
    type: ServiceNowErrorType;
    details?: Record<string, unknown> | undefined;
    suggestion?: string | undefined;
    constructor(type: ServiceNowErrorType, message: string, details?: Record<string, unknown> | undefined, suggestion?: string | undefined);
    toJSON(): {
        type: ServiceNowErrorType;
        message: string;
        details: Record<string, unknown> | undefined;
        suggestion: string | undefined;
    };
}
export interface TableAPIResponse<T = Record<string, unknown>> {
    result: T[];
}
export interface SingleRecordResponse<T = Record<string, unknown>> {
    result: T;
}
export interface CredentialsFile {
    profiles: Record<string, CredentialProfile>;
    default?: string;
}
export interface CredentialProfile {
    instance: string;
    type: AuthType;
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
}
//# sourceMappingURL=types.d.ts.map