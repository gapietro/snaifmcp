/**
 * ServiceNow Integration Types
 */

// Authentication types
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

// Connection session
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

// Connection result
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

// Instance info
export interface InstanceInfo {
  version: string;
  buildTag?: string;
  buildDate?: string;
  isActive: boolean;
}

// User info
export interface UserInfo {
  sysId: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  active: boolean;
}

// Error types
export enum ServiceNowErrorType {
  // Connection errors
  CONNECTION_FAILED = 'connection_failed',
  AUTHENTICATION_FAILED = 'authentication_failed',
  TOKEN_EXPIRED = 'token_expired',
  INSTANCE_UNAVAILABLE = 'instance_unavailable',
  INVALID_INSTANCE = 'invalid_instance',

  // Permission errors
  ACL_DENIED = 'acl_denied',
  ROLE_REQUIRED = 'role_required',
  TABLE_NOT_ACCESSIBLE = 'table_not_accessible',

  // Execution errors
  SCRIPT_TIMEOUT = 'script_timeout',
  SCRIPT_ERROR = 'script_error',
  SCRIPT_BLOCKED = 'script_blocked',
  QUERY_ERROR = 'query_error',

  // Rate limiting
  RATE_LIMITED = 'rate_limited',
  QUOTA_EXCEEDED = 'quota_exceeded',

  // Safety blocks
  DANGEROUS_OPERATION = 'dangerous_operation',
  SENSITIVE_DATA = 'sensitive_data',

  // Generic
  UNKNOWN_ERROR = 'unknown_error',
}

export class ServiceNowError extends Error {
  constructor(
    public type: ServiceNowErrorType,
    message: string,
    public details?: Record<string, unknown>,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'ServiceNowError';
  }

  toJSON() {
    return {
      type: this.type,
      message: this.message,
      details: this.details,
      suggestion: this.suggestion,
    };
  }
}

// API response types
export interface TableAPIResponse<T = Record<string, unknown>> {
  result: T[];
}

export interface SingleRecordResponse<T = Record<string, unknown>> {
  result: T;
}

// Credentials file format
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
