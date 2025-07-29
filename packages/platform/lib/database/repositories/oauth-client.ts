/**
 * OAuth Client Repository for configurable client management
 * Replaces hardcoded client ID validation with database-backed client configuration
 */

import { eq, and, sql, isNull } from 'drizzle-orm';
import { getDatabaseClient } from '../client';
import { oauthClients, type OAuthClient, type NewOAuthClient } from '../schema';
import { nanoid } from 'nanoid';

export interface ClientValidationResult {
  isValid: boolean;
  client?: OAuthClient;
  error?: string;
}

export class OAuthClientRepository {
  private get db() {
    return getDatabaseClient();
  }

  /**
   * Create a new OAuth client
   */
  async create(
    data: Omit<NewOAuthClient, 'clientId' | 'clientSecret'>,
  ): Promise<OAuthClient> {
    const clientId = this.generateClientId();
    const clientSecret =
      data.clientType === 'confidential' ? this.generateClientSecret() : null;

    const [client] = await this.db
      .insert(oauthClients)
      .values({
        ...data,
        clientId,
        clientSecret,
      })
      .returning();

    return client;
  }

  /**
   * Get client by client ID
   */
  async getByClientId(clientId: string): Promise<OAuthClient | null> {
    const [client] = await this.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1);

    return client || null;
  }

  /**
   * Validate client ID and check if active
   */
  async validateClient(
    clientId: string,
    grantType?: string,
  ): Promise<ClientValidationResult> {
    const client = await this.getByClientId(clientId);

    if (!client) {
      return {
        isValid: false,
        error: 'invalid_client',
      };
    }

    if (!client.isActive) {
      return {
        isValid: false,
        error: 'client_disabled',
      };
    }

    // Check if grant type is supported
    if (grantType && !client.grantTypes.includes(grantType)) {
      return {
        isValid: false,
        error: 'unsupported_grant_type',
      };
    }

    // Update last used timestamp and usage count
    await this.updateUsage(clientId);

    return {
      isValid: true,
      client,
    };
  }

  /**
   * Validate client secret for confidential clients
   */
  async validateClientSecret(
    clientId: string,
    clientSecret: string,
  ): Promise<boolean> {
    const client = await this.getByClientId(clientId);

    if (!client || client.clientType !== 'confidential') {
      return false;
    }

    return client.clientSecret === clientSecret;
  }

  /**
   * Check if client supports a specific scope
   */
  async validateScope(
    clientId: string,
    requestedScopes: string[],
  ): Promise<ClientValidationResult> {
    const client = await this.getByClientId(clientId);

    if (!client) {
      return {
        isValid: false,
        error: 'invalid_client',
      };
    }

    // Check if all requested scopes are allowed
    const invalidScopes = requestedScopes.filter(
      (scope) => !client.scopes.includes(scope),
    );

    if (invalidScopes.length > 0) {
      return {
        isValid: false,
        error: 'invalid_scope',
      };
    }

    return {
      isValid: true,
      client,
    };
  }

  /**
   * Update client configuration
   */
  async update(
    clientId: string,
    updates: Partial<Omit<OAuthClient, 'id' | 'clientId' | 'createdAt'>>,
  ): Promise<OAuthClient | null> {
    const [updated] = await this.db
      .update(oauthClients)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(oauthClients.clientId, clientId))
      .returning();

    return updated || null;
  }

  /**
   * Disable/enable client
   */
  async setActive(clientId: string, isActive: boolean): Promise<boolean> {
    const result = await this.db
      .update(oauthClients)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(oauthClients.clientId, clientId))
      .returning();

    return result.length > 0;
  }

  /**
   * Delete client
   */
  async delete(clientId: string): Promise<boolean> {
    const result = await this.db
      .delete(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .returning();

    return result.length > 0;
  }

  /**
   * Get all clients for an organization
   */
  async getByOrganization(organizationId: string): Promise<OAuthClient[]> {
    return await this.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.organizationId, organizationId));
  }

  /**
   * Get global clients (not tied to organization)
   */
  async getGlobalClients(): Promise<OAuthClient[]> {
    return await this.db
      .select()
      .from(oauthClients)
      .where(isNull(oauthClients.organizationId));
  }

  /**
   * Update client usage statistics
   */
  private async updateUsage(clientId: string): Promise<void> {
    await this.db
      .update(oauthClients)
      .set({
        lastUsedAt: new Date(),
        usageCount: sql`usage_count + 1`,
        updatedAt: new Date(),
      })
      .where(eq(oauthClients.clientId, clientId));
  }

  /**
   * Generate a new client ID
   */
  private generateClientId(): string {
    return `elizaos_${nanoid(24)}`;
  }

  /**
   * Generate a secure client secret
   */
  private generateClientSecret(): string {
    // Use crypto API available in both Node.js and browser
    if (
      typeof globalThis.crypto !== 'undefined' &&
      globalThis.crypto.getRandomValues
    ) {
      const array = new Uint8Array(32);
      globalThis.crypto.getRandomValues(array);
      return Array.from(array, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    } else {
      // Fallback to nanoid for environments without crypto API
      return nanoid(64);
    }
  }

  /**
   * Seed default clients for system use
   */
  async seedDefaultClients(): Promise<void> {
    // Check if CLI client already exists
    const existingCli = await this.getByClientId('elizaos-cli');

    if (!existingCli) {
      await this.db.insert(oauthClients).values({
        clientId: 'elizaos-cli',
        clientName: 'ElizaOS CLI',
        clientDescription: 'Official ElizaOS Command Line Interface',
        clientType: 'public',
        grantTypes: ['device_code'],
        scopes: ['read', 'write', 'agents:manage'],
        isTrusted: true,
        organizationId: null, // Global client
        metadata: {
          version: '1.0.0',
          official: true,
        },
      });
    }

    // Check if web client already exists
    const existingWeb = await this.getByClientId('elizaos-web');

    if (!existingWeb) {
      await this.db.insert(oauthClients).values({
        clientId: 'elizaos-web',
        clientName: 'ElizaOS Web Platform',
        clientDescription: 'Official ElizaOS Web Platform',
        clientType: 'public',
        grantTypes: ['authorization_code', 'device_code'],
        scopes: ['read', 'write', 'agents:manage', 'billing:manage'],
        redirectUris: [
          'http://localhost:3333/auth/callback',
          'https://platform.elizaos.ai/auth/callback',
        ],
        allowedOrigins: [
          'http://localhost:3333',
          'https://platform.elizaos.ai',
        ],
        isTrusted: true,
        organizationId: null, // Global client
        metadata: {
          version: '1.0.0',
          official: true,
        },
      });
    }
  }
}

// Export singleton instance
export const oauthClientRepository = new OAuthClientRepository();
