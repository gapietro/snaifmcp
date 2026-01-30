/**
 * ServiceNow Connection Manager
 * Handles session management, credential storage, and connection lifecycle
 */
import { AuthConfig, AuthType, ConnectionSession, ConnectionResult, CredentialsFile, CredentialProfile } from './types.js';
import { ServiceNowClient } from './client.js';
export declare class ConnectionManager {
    private sessions;
    private clients;
    private activeSessionKey;
    private credentialsPath;
    constructor(credentialsPath?: string);
    /**
     * Generate a session key from instance URL
     */
    private getSessionKey;
    /**
     * Load credentials from file
     */
    loadCredentialsFile(): Promise<CredentialsFile | null>;
    /**
     * Get a profile from credentials file
     */
    getProfile(profileName?: string): Promise<CredentialProfile | null>;
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
    }): AuthConfig;
    /**
     * Connect to a ServiceNow instance
     */
    connect(params: {
        instance: string;
        authType?: AuthType;
        profile?: string;
        username?: string;
        password?: string;
        token?: string;
        clientId?: string;
        clientSecret?: string;
    }): Promise<ConnectionResult>;
    /**
     * Disconnect from a ServiceNow instance
     */
    disconnect(instanceUrl?: string): boolean;
    /**
     * Get the active client
     */
    getActiveClient(): ServiceNowClient | null;
    /**
     * Get a client for a specific instance
     */
    getClient(instanceUrl: string): ServiceNowClient | null;
    /**
     * Get the active session
     */
    getActiveSession(): ConnectionSession | null;
    /**
     * Check if connected to any instance
     */
    isConnected(): boolean;
    /**
     * Get all active sessions
     */
    getAllSessions(): ConnectionSession[];
    /**
     * Update last used timestamp for active session
     */
    touchSession(): void;
    /**
     * Get connection status summary
     */
    getStatus(): {
        connected: boolean;
        activeInstance?: string;
        user?: string;
        version?: string;
        sessionCount: number;
    };
}
export declare const connectionManager: ConnectionManager;
//# sourceMappingURL=connection-manager.d.ts.map