/**
 * API Database Module
 * Central access point for database functionality in API routes
 * Re-exports database utilities and repositories
 */

// Re-export core database utilities
export {
  getDatabase,
  getSql,
  closeDatabase,
  testConnection,
  getDatabaseHealth,
  getDatabaseStats,
  initializeDatabase,
  db,
  initializeDbProxy,
  getDatabaseClient,
} from '@/lib/database';

// Re-export database context utilities
export {
  setDatabaseContext,
  clearDatabaseContext,
  getDatabaseContext,
  withDatabaseContext,
  setContextFromUser,
  setSystemContext,
  withDatabaseContextMiddleware,
  validateDatabaseContext,
  isCurrentUserAdmin,
  getCurrentOrganizationId,
  getCurrentUserId,
  type DatabaseContext,
} from '@/lib/database/context';

// Re-export repositories
export { OrganizationRepository } from '@/lib/database/repositories/organization';
export {
  UserRepository,
  UserSessionRepository,
  userRepository,
  userSessionRepository,
} from '@/lib/database/repositories/user';
export { oauthClientRepository } from '@/lib/database/repositories/oauth-client';
export {
  rateLimitRepository,
  RateLimitRepository,
} from '@/lib/database/repositories/rate-limit';
export { deviceCodeRepository } from '@/lib/database/repositories/device-code';

// Create a convenient db object with commonly used repositories
const repositories = {
  apiKeys: {
    async findByUserId(userId: string) {
      const database = await getDatabase();
      const { apiKeys } = await import('@/lib/database/schema');
      const { eq } = await import('drizzle-orm');

      return await database
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
    },

    async create(data: {
      userId: string;
      name: string;
      key: string;
      expiresAt?: Date;
    }) {
      const database = await getDatabase();
      const { apiKeys } = await import('@/lib/database/schema');

      const [apiKey] = await database
        .insert(apiKeys)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return apiKey;
    },

    async delete(id: string) {
      const database = await getDatabase();
      const { apiKeys } = await import('@/lib/database/schema');
      const { eq } = await import('drizzle-orm');

      const [deleted] = await database
        .delete(apiKeys)
        .where(eq(apiKeys.id, id))
        .returning();

      return deleted;
    },

    async findById(id: string) {
      const database = await getDatabase();
      const { apiKeys } = await import('@/lib/database/schema');
      const { eq } = await import('drizzle-orm');

      const [apiKey] = await database
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, id))
        .limit(1);

      return apiKey || null;
    },

    async updateLastUsed(id: string) {
      const database = await getDatabase();
      const { apiKeys } = await import('@/lib/database/schema');
      const { eq } = await import('drizzle-orm');

      await database
        .update(apiKeys)
        .set({
          lastUsed: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(apiKeys.id, id));
    },
  },
};

// Export the enhanced db object
export const db = {
  ...repositories,
};
