/**
 * API Key Management Service
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  getDatabase,
  setDatabaseContext,
  clearDatabaseContext,
  schema,
  type ApiKey,
  type NewApiKey,
  eq,
  and,
  desc,
  count,
} from '../database';

const { apiKeys } = schema;

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  permissions: string[];
  rateLimit?: number;
  expiresAt?: Date;
}

export interface ApiKeyWithPrefix {
  id: string;
  name: string;
  description?: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  expiredKeys: number;
  totalUsage: number;
}

/**
 * Generate a secure API key
 */
function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Generate a random 32-byte key
  const randomBytes = crypto.randomBytes(32);

  // Create key with prefix
  const key = `sk-proj-${randomBytes.toString('base64url')}`;

  // Extract prefix (first 8 characters for display)
  const prefix = key.substring(0, 8);

  // Hash the key for storage
  const hash = bcrypt.hashSync(key, 12);

  return { key, prefix, hash };
}

/**
 * Verify an API key against its hash
 */
function verifyApiKey(key: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(key, hash);
  } catch {
    return false;
  }
}

/**
 * API Key Management Service
 */
export class ApiKeyService {
  private async getDb() {
    return await getDatabase();
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    organizationId: string,
    userId: string,
    data: CreateApiKeyRequest,
  ): Promise<{ apiKey: ApiKeyWithPrefix; key: string }> {
    await setDatabaseContext({
      organizationId,
      userId,
      isAdmin: true, // Require admin for API key creation
    });

    try {
      // Generate secure API key
      const { key, prefix, hash } = generateApiKey();

      // Create API key record
      const [created] = await (
        await this.getDb()
      )
        .insert(apiKeys)
        .values({
          organizationId,
          userId,
          name: data.name,
          description: data.description,
          keyHash: hash,
          keyPrefix: prefix,
          permissions: data.permissions,
          rateLimit: data.rateLimit || 100,
          expiresAt: data.expiresAt,
        })
        .returning();

      const apiKeyWithPrefix: ApiKeyWithPrefix = {
        id: created.id,
        name: created.name,
        description: created.description || undefined,
        keyPrefix: created.keyPrefix,
        permissions: created.permissions as string[],
        rateLimit: created.rateLimit,
        isActive: created.isActive,
        expiresAt: created.expiresAt || undefined,
        lastUsedAt: created.lastUsedAt || undefined,
        usageCount: created.usageCount,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };

      return { apiKey: apiKeyWithPrefix, key };
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get all API keys for organization
   */
  async getApiKeys(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      includeInactive?: boolean;
    } = {},
  ): Promise<ApiKeyWithPrefix[]> {
    await setDatabaseContext({ organizationId });

    try {
      const { limit = 50, offset = 0, includeInactive = false } = options;

      const baseQuery = await (
        await this.getDb()
      )
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          description: apiKeys.description,
          keyPrefix: apiKeys.keyPrefix,
          permissions: apiKeys.permissions,
          rateLimit: apiKeys.rateLimit,
          isActive: apiKeys.isActive,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          usageCount: apiKeys.usageCount,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys);

      const results = await (
        includeInactive
          ? baseQuery
          : baseQuery.where(eq(apiKeys.isActive, true))
      )
        .orderBy(desc(apiKeys.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((result: any) => ({
        ...result,
        description: result.description || undefined,
        permissions: result.permissions as string[],
        expiresAt: result.expiresAt || undefined,
        lastUsedAt: result.lastUsedAt || undefined,
      }));
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get API key by ID
   */
  async getApiKeyById(
    organizationId: string,
    keyId: string,
  ): Promise<ApiKeyWithPrefix | null> {
    await setDatabaseContext({ organizationId });

    try {
      const [result] = await (
        await this.getDb()
      )
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          description: apiKeys.description,
          keyPrefix: apiKeys.keyPrefix,
          permissions: apiKeys.permissions,
          rateLimit: apiKeys.rateLimit,
          isActive: apiKeys.isActive,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          usageCount: apiKeys.usageCount,
          createdAt: apiKeys.createdAt,
          updatedAt: apiKeys.updatedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.id, keyId))
        .limit(1);

      if (!result) {
        return null;
      }

      return {
        ...result,
        description: result.description || undefined,
        permissions: result.permissions as string[],
        expiresAt: result.expiresAt || undefined,
        lastUsedAt: result.lastUsedAt || undefined,
      };
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Update API key
   */
  async updateApiKey(
    organizationId: string,
    keyId: string,
    updates: {
      name?: string;
      description?: string;
      permissions?: string[];
      rateLimit?: number;
      isActive?: boolean;
    },
  ): Promise<ApiKeyWithPrefix | null> {
    await setDatabaseContext({
      organizationId,
      isAdmin: true, // Require admin for updates
    });

    try {
      const [updated] = await (
        await this.getDb()
      )
        .update(apiKeys)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, keyId))
        .returning();

      if (!updated) {
        return null;
      }

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description || undefined,
        keyPrefix: updated.keyPrefix,
        permissions: updated.permissions as string[],
        rateLimit: updated.rateLimit,
        isActive: updated.isActive,
        expiresAt: updated.expiresAt || undefined,
        lastUsedAt: updated.lastUsedAt || undefined,
        usageCount: updated.usageCount,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(organizationId: string, keyId: string): Promise<boolean> {
    await setDatabaseContext({
      organizationId,
      isAdmin: true, // Require admin for deletion
    });

    try {
      // First check if the key exists
      const [existing] = await (await this.getDb())
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(eq(apiKeys.id, keyId))
        .limit(1);

      if (!existing) {
        return false;
      }

      // Delete the key
      await (await this.getDb()).delete(apiKeys).where(eq(apiKeys.id, keyId));

      return true;
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Verify API key and get details
   */
  async verifyApiKey(key: string): Promise<{
    isValid: boolean;
    apiKey?: ApiKeyWithPrefix;
    organizationId?: string;
  }> {
    try {
      // Extract prefix to optimize search
      const prefix = key.substring(0, 8);

      const [result] = await (
        await this.getDb()
      )
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.isActive, true)))
        .limit(1);

      if (!result) {
        return { isValid: false };
      }

      // Check if key is expired
      if (result.expiresAt && result.expiresAt < new Date()) {
        return { isValid: false };
      }

      // Verify hash
      const isValid = verifyApiKey(key, result.keyHash);
      if (!isValid) {
        return { isValid: false };
      }

      // Update usage statistics
      await (
        await this.getDb()
      )
        .update(apiKeys)
        .set({
          lastUsedAt: new Date(),
          usageCount: result.usageCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, result.id));

      const apiKeyWithPrefix: ApiKeyWithPrefix = {
        id: result.id,
        name: result.name,
        description: result.description || undefined,
        keyPrefix: result.keyPrefix,
        permissions: result.permissions as string[],
        rateLimit: result.rateLimit,
        isActive: result.isActive,
        expiresAt: result.expiresAt || undefined,
        lastUsedAt: new Date(),
        usageCount: result.usageCount + 1,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };

      return {
        isValid: true,
        apiKey: apiKeyWithPrefix,
        organizationId: result.organizationId,
      };
    } catch (error) {
      console.error('API key verification error:', error);
      return { isValid: false };
    }
  }

  /**
   * Get API key statistics
   */
  async getApiKeyStats(organizationId: string): Promise<ApiKeyStats> {
    await setDatabaseContext({ organizationId });

    try {
      const [statsResult] = await (
        await this.getDb()
      )
        .select({
          totalKeys: count(),
        })
        .from(apiKeys);

      const [activeResult] = await (
        await this.getDb()
      )
        .select({
          activeKeys: count(),
        })
        .from(apiKeys)
        .where(eq(apiKeys.isActive, true));

      const [expiredResult] = await (
        await this.getDb()
      )
        .select({
          expiredKeys: count(),
        })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.isActive, true),
            // TODO: Add SQL function for expired keys
          ),
        );

      // Get total usage
      const [usageResult] = await (
        await this.getDb()
      )
        .select({
          totalUsage: apiKeys.usageCount,
        })
        .from(apiKeys);

      const totalUsage = usageResult?.totalUsage || 0;

      return {
        totalKeys: statsResult?.totalKeys || 0,
        activeKeys: activeResult?.activeKeys || 0,
        expiredKeys: 0, // TODO: Calculate expired keys
        totalUsage: Array.isArray(totalUsage)
          ? totalUsage.reduce((sum, count) => sum + count, 0)
          : totalUsage,
      };
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Generate a temporary API key for GUI integration
   */
  async generateUserApiKey(
    organizationId: string,
    userId: string,
    options: {
      scope?: string[];
      expiresIn?: string; // '24h', '1h', etc.
    } = {},
  ): Promise<string> {
    const { scope = ['agents:*', 'messaging:*'], expiresIn = '24h' } = options;

    // Calculate expiration time
    let expiresAt: Date | undefined;
    if (expiresIn) {
      const hours = expiresIn.includes('h') ? parseInt(expiresIn, 10) : 24;
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    const { key } = await this.createApiKey(organizationId, userId, {
      name: `GUI-${userId}-${Date.now()}`,
      description: 'Temporary key for client GUI integration',
      permissions: scope,
      rateLimit: 1000, // Higher limit for GUI usage
      expiresAt,
    });

    return key;
  }

  /**
   * Regenerate an existing API key (creates new key with same settings)
   */
  async regenerateApiKey(
    keyId: string,
    organizationId: string,
  ): Promise<{
    apiKey: ApiKeyWithPrefix;
    key: string;
    oldKeyPrefix: string;
    keyPrefix: string;
  } | null> {
    await setDatabaseContext({
      organizationId,
      isAdmin: true, // Require admin for regeneration
    });

    try {
      // Get the existing key details
      const existingKey = await this.getApiKeyById(organizationId, keyId);
      if (!existingKey) {
        return null;
      }

      // Store old prefix for audit purposes
      const oldKeyPrefix = existingKey.keyPrefix;

      // Generate new secure API key
      const { key, prefix, hash } = generateApiKey();

      // Update the existing record with new key data
      const [updated] = await (
        await this.getDb()
      )
        .update(apiKeys)
        .set({
          keyHash: hash,
          keyPrefix: prefix,
          usageCount: 0, // Reset usage count
          lastUsedAt: null, // Reset last used
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, keyId))
        .returning();

      if (!updated) {
        return null;
      }

      const apiKeyWithPrefix: ApiKeyWithPrefix = {
        id: updated.id,
        name: updated.name,
        description: updated.description || undefined,
        keyPrefix: updated.keyPrefix,
        permissions: updated.permissions as string[],
        rateLimit: updated.rateLimit,
        isActive: updated.isActive,
        expiresAt: updated.expiresAt || undefined,
        lastUsedAt: updated.lastUsedAt || undefined,
        usageCount: updated.usageCount,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };

      return {
        apiKey: apiKeyWithPrefix,
        key,
        oldKeyPrefix,
        keyPrefix: prefix,
      };
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(
    apiKey: { permissions: string[] },
    requiredPermission: string,
  ): boolean {
    // Check for admin permission (allows everything)
    if (
      apiKey.permissions.includes('*') ||
      apiKey.permissions.includes('admin')
    ) {
      return true;
    }

    // Check for specific permission
    return apiKey.permissions.includes(requiredPermission);
  }
}

// Export singleton instance
export const apiKeyService = new ApiKeyService();
