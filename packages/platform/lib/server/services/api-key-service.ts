import { eq, and, desc } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { getDatabase } from '@/lib/database';
import { apiKeys, type ApiKey, type NewApiKey } from '@/lib/database/schema';

const API_KEY_PREFIX = 'eliza_';

interface CreateApiKeyData {
  organizationId: string;
  userId: string;
  name: string;
  description?: string;
  permissions?: string[];
  rateLimit?: number;
  expiresAt?: string;
}

interface UpdateApiKeyData {
  name?: string;
  description?: string;
  permissions?: string[];
  rateLimit?: number;
  isActive?: boolean;
  expiresAt?: string;
}

export function generateApiKey(): {
  keyValue: string;
  keyHash: string;
  keyPrefix: string;
} {
  // Generate a cryptographically secure random key
  const randomPart = randomBytes(32).toString('hex');
  const keyValue = `${API_KEY_PREFIX}${randomPart}`;

  // Hash the key for storage (using SHA-256)
  const keyHash = createHash('sha256').update(keyValue).digest('hex') as string;

  // Store first 12 characters for display purposes
  const keyPrefix = `${keyValue.substring(0, 12)}...`;

  return { keyValue, keyHash, keyPrefix };
}

export function hashApiKey(keyValue: string): string {
  return createHash('sha256').update(keyValue).digest('hex') as string;
}

export async function createApiKey(
  data: CreateApiKeyData,
): Promise<{ apiKey: ApiKey; keyValue: string }> {
  const { keyValue, keyHash, keyPrefix } = generateApiKey();

  const newApiKey: NewApiKey = {
    organizationId: data.organizationId,
    userId: data.userId,
    name: data.name,
    description: data.description,
    keyHash,
    keyPrefix,
    permissions: data.permissions || [],
    rateLimit: data.rateLimit || 100,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
  };

  const db = await getDatabase();
  const [apiKey] = await db.insert(apiKeys).values(newApiKey).returning();

  return { apiKey, keyValue };
}

export async function regenerateApiKey(
  apiKeyId: string,
  organizationId: string,
): Promise<{ apiKey: ApiKey; keyValue: string }> {
  const { keyValue, keyHash, keyPrefix } = generateApiKey();

  const db = await getDatabase();
  const [apiKey] = await db
    .update(apiKeys)
    .set({
      keyHash,
      keyPrefix,
      usageCount: 0,
      lastUsedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(apiKeys.id, apiKeyId), eq(apiKeys.organizationId, organizationId)),
    )
    .returning();

  if (!apiKey) {
    throw new Error('API key not found');
  }

  return { apiKey, keyValue };
}

export async function validateApiKey(keyValue: string): Promise<ApiKey | null> {
  const keyHash = hashApiKey(keyValue);

  const db = await getDatabase();
  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKey) {
    return null;
  }

  // Check if key is active and not expired
  if (!apiKey.isActive) {
    return null;
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp and usage count
  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: apiKey.usageCount + 1,
    })
    .where(eq(apiKeys.id, apiKey.id));

  return {
    ...apiKey,
    lastUsedAt: new Date(),
    usageCount: apiKey.usageCount + 1,
  };
}

export async function getUserApiKeys(
  organizationId: string,
  userId?: string,
): Promise<ApiKey[]> {
  const conditions = [eq(apiKeys.organizationId, organizationId)];

  if (userId) {
    conditions.push(eq(apiKeys.userId, userId));
  }

  const db = await getDatabase();
  return await db
    .select()
    .from(apiKeys)
    .where(and(...conditions))
    .orderBy(desc(apiKeys.createdAt));
}

export async function getApiKeyById(
  apiKeyId: string,
  organizationId: string,
): Promise<ApiKey | null> {
  const db = await getDatabase();
  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(
      and(eq(apiKeys.id, apiKeyId), eq(apiKeys.organizationId, organizationId)),
    )
    .limit(1);

  return apiKey || null;
}

export async function updateApiKey(
  apiKeyId: string,
  organizationId: string,
  data: UpdateApiKeyData,
): Promise<ApiKey> {
  const db = await getDatabase();
  const [apiKey] = await db
    .update(apiKeys)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(eq(apiKeys.id, apiKeyId), eq(apiKeys.organizationId, organizationId)),
    )
    .returning();

  if (!apiKey) {
    throw new Error('API key not found');
  }

  return apiKey;
}

export async function deleteApiKey(
  apiKeyId: string,
  organizationId: string,
): Promise<void> {
  const db = await getDatabase();
  const result = await db
    .delete(apiKeys)
    .where(
      and(eq(apiKeys.id, apiKeyId), eq(apiKeys.organizationId, organizationId)),
    );

  // Note: Drizzle doesn't return affected rows count consistently
  // In production, you might want to check if the key existed first
}

export async function isValidPermission(permission: string): Promise<boolean> {
  // Define valid permissions for the platform
  const validPermissions = [
    'agents:read',
    'agents:write',
    'agents:delete',
    'storage:read',
    'storage:write',
    'storage:delete',
    'inference:openai',
    'inference:anthropic',
    'inference:xai',
    'inference:groq',
    'inference:gemini',
    'billing:read',
    'analytics:read',
    'users:read',
    'users:write',
    'admin:all',
  ];

  return validPermissions.includes(permission);
}

export async function checkApiKeyPermission(
  apiKey: ApiKey,
  requiredPermission: string,
): Promise<boolean> {
  // Admin permission grants access to everything
  if (apiKey.permissions.includes('admin:all')) {
    return true;
  }

  return apiKey.permissions.includes(requiredPermission);
}
