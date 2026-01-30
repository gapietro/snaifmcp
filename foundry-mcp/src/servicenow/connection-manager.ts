/**
 * ServiceNow Connection Manager
 * Handles session management, credential storage, and connection lifecycle
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AuthConfig,
  AuthType,
  ConnectionSession,
  ConnectionResult,
  CredentialsFile,
  CredentialProfile,
  ServiceNowError,
  ServiceNowErrorType,
} from './types.js';
import { ServiceNowClient } from './client.js';

// Default credentials file location
const DEFAULT_CREDENTIALS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.servicenow',
  'credentials.json'
);

export class ConnectionManager {
  private sessions: Map<string, ConnectionSession> = new Map();
  private clients: Map<string, ServiceNowClient> = new Map();
  private activeSessionKey: string | null = null;
  private credentialsPath: string;

  constructor(credentialsPath?: string) {
    this.credentialsPath = credentialsPath || DEFAULT_CREDENTIALS_PATH;
  }

  /**
   * Generate a session key from instance URL
   */
  private getSessionKey(instanceUrl: string): string {
    return instanceUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  /**
   * Load credentials from file
   */
  async loadCredentialsFile(): Promise<CredentialsFile | null> {
    try {
      const content = await fs.readFile(this.credentialsPath, 'utf-8');
      return JSON.parse(content) as CredentialsFile;
    } catch (error) {
      // File doesn't exist or is invalid
      return null;
    }
  }

  /**
   * Get a profile from credentials file
   */
  async getProfile(profileName?: string): Promise<CredentialProfile | null> {
    const credentials = await this.loadCredentialsFile();
    if (!credentials) return null;

    const name = profileName || credentials.default;
    if (!name) return null;

    return credentials.profiles[name] || null;
  }

  /**
   * Build auth config from various input sources
   */
  buildAuthConfig(params: {
    authType?: AuthType;
    profile?: string;
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
    profileData?: CredentialProfile;
  }): AuthConfig {
    // If profile data provided, use it
    if (params.profileData) {
      const profile = params.profileData;
      switch (profile.type) {
        case 'basic':
          if (!profile.username || !profile.password) {
            throw new ServiceNowError(
              ServiceNowErrorType.AUTHENTICATION_FAILED,
              'Profile missing username or password',
              { profile: params.profile }
            );
          }
          return {
            type: 'basic',
            username: profile.username,
            password: profile.password,
          };
        case 'token':
          if (!profile.token) {
            throw new ServiceNowError(
              ServiceNowErrorType.AUTHENTICATION_FAILED,
              'Profile missing token',
              { profile: params.profile }
            );
          }
          return { type: 'token', token: profile.token };
        case 'oauth':
          if (!profile.clientId || !profile.clientSecret) {
            throw new ServiceNowError(
              ServiceNowErrorType.AUTHENTICATION_FAILED,
              'Profile missing OAuth credentials',
              { profile: params.profile }
            );
          }
          return {
            type: 'oauth',
            clientId: profile.clientId,
            clientSecret: profile.clientSecret,
            refreshToken: profile.refreshToken,
          };
      }
    }

    // Build from explicit parameters
    const authType = params.authType || 'basic';

    switch (authType) {
      case 'basic':
        if (!params.username || !params.password) {
          throw new ServiceNowError(
            ServiceNowErrorType.AUTHENTICATION_FAILED,
            'Basic auth requires username and password',
            undefined,
            'Provide username and password parameters'
          );
        }
        return {
          type: 'basic',
          username: params.username,
          password: params.password,
        };

      case 'token':
        if (!params.token) {
          throw new ServiceNowError(
            ServiceNowErrorType.AUTHENTICATION_FAILED,
            'Token auth requires a token',
            undefined,
            'Provide the token parameter'
          );
        }
        return { type: 'token', token: params.token };

      case 'oauth':
        if (!params.clientId || !params.clientSecret) {
          throw new ServiceNowError(
            ServiceNowErrorType.AUTHENTICATION_FAILED,
            'OAuth requires clientId and clientSecret',
            undefined,
            'Provide OAuth application credentials'
          );
        }
        return {
          type: 'oauth',
          clientId: params.clientId,
          clientSecret: params.clientSecret,
        };

      default:
        throw new ServiceNowError(
          ServiceNowErrorType.AUTHENTICATION_FAILED,
          `Unknown auth type: ${authType}`,
          undefined,
          'Use basic, token, or oauth'
        );
    }
  }

  /**
   * Connect to a ServiceNow instance
   */
  async connect(params: {
    instance: string;
    authType?: AuthType;
    profile?: string;
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  }): Promise<ConnectionResult> {
    const { instance } = params;

    if (!instance) {
      return {
        success: false,
        message: 'Instance URL is required',
        error: {
          type: ServiceNowErrorType.INVALID_INSTANCE,
          details: 'Provide the instance URL (e.g., "dev12345.service-now.com")',
        },
      };
    }

    try {
      // If profile specified, load it
      let profileData: CredentialProfile | undefined;
      let instanceUrl = instance;

      if (params.profile) {
        profileData = await this.getProfile(params.profile) || undefined;
        if (!profileData) {
          return {
            success: false,
            message: `Profile "${params.profile}" not found`,
            error: {
              type: ServiceNowErrorType.AUTHENTICATION_FAILED,
              details: `Create the profile in ${this.credentialsPath}`,
            },
          };
        }
        // Profile can override instance
        instanceUrl = profileData.instance || instance;
      }

      // Build auth config
      const authConfig = this.buildAuthConfig({
        ...params,
        profileData,
      });

      // Create client
      const client = new ServiceNowClient(instanceUrl, authConfig);

      // Test connection
      const instanceInfo = await client.testConnection();

      // Get current user info
      const userInfo = await client.getCurrentUser();

      // Create session
      const sessionKey = this.getSessionKey(instanceUrl);
      const session: ConnectionSession = {
        instanceUrl: client.getInstanceUrl(),
        authType: authConfig.type,
        authConfig,
        userId: userInfo.sysId,
        userName: userInfo.userName,
        userRoles: userInfo.roles,
        instanceVersion: instanceInfo.version,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      // Store session and client
      this.sessions.set(sessionKey, session);
      this.clients.set(sessionKey, client);
      this.activeSessionKey = sessionKey;

      return {
        success: true,
        message: `Connected to ${instanceUrl}`,
        session: {
          instanceUrl: session.instanceUrl,
          instanceVersion: instanceInfo.version,
          user: userInfo.userName,
          roles: userInfo.roles,
        },
      };
    } catch (error) {
      if (error instanceof ServiceNowError) {
        return {
          success: false,
          message: error.message,
          error: {
            type: error.type,
            details: error.suggestion,
          },
        };
      }

      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        error: {
          type: ServiceNowErrorType.CONNECTION_FAILED,
        },
      };
    }
  }

  /**
   * Disconnect from a ServiceNow instance
   */
  disconnect(instanceUrl?: string): boolean {
    const sessionKey = instanceUrl
      ? this.getSessionKey(instanceUrl)
      : this.activeSessionKey;

    if (!sessionKey) {
      return false;
    }

    this.sessions.delete(sessionKey);
    this.clients.delete(sessionKey);

    if (this.activeSessionKey === sessionKey) {
      // Set active to first remaining session, or null
      const remainingKeys = Array.from(this.sessions.keys());
      this.activeSessionKey = remainingKeys.length > 0 ? remainingKeys[0] : null;
    }

    return true;
  }

  /**
   * Get the active client
   */
  getActiveClient(): ServiceNowClient | null {
    if (!this.activeSessionKey) {
      return null;
    }
    return this.clients.get(this.activeSessionKey) || null;
  }

  /**
   * Get a client for a specific instance
   */
  getClient(instanceUrl: string): ServiceNowClient | null {
    const sessionKey = this.getSessionKey(instanceUrl);
    return this.clients.get(sessionKey) || null;
  }

  /**
   * Get the active session
   */
  getActiveSession(): ConnectionSession | null {
    if (!this.activeSessionKey) {
      return null;
    }
    return this.sessions.get(this.activeSessionKey) || null;
  }

  /**
   * Check if connected to any instance
   */
  isConnected(): boolean {
    return this.activeSessionKey !== null && this.clients.has(this.activeSessionKey);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): ConnectionSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Update last used timestamp for active session
   */
  touchSession(): void {
    if (this.activeSessionKey) {
      const session = this.sessions.get(this.activeSessionKey);
      if (session) {
        session.lastUsed = new Date();
      }
    }
  }

  /**
   * Get connection status summary
   */
  getStatus(): {
    connected: boolean;
    activeInstance?: string;
    user?: string;
    version?: string;
    sessionCount: number;
  } {
    const session = this.getActiveSession();
    return {
      connected: this.isConnected(),
      activeInstance: session?.instanceUrl,
      user: session?.userName,
      version: session?.instanceVersion,
      sessionCount: this.sessions.size,
    };
  }
}

// Singleton instance for global session management
export const connectionManager = new ConnectionManager();
