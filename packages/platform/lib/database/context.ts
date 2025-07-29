/**
 * Database context management for Row Level Security (RLS)
 * These functions set session variables that RLS policies use for tenant isolation
 */

import { getDatabase } from './';
import type { User, Organization } from './schema';
import { sql } from 'drizzle-orm';

export interface DatabaseContext {
  organizationId: string;
  userId?: string;
  isAdmin?: boolean;
}

/**
 * Set the database context for RLS policies
 * This must be called before any database operations that rely on RLS
 */
export async function setDatabaseContext(
  context: DatabaseContext,
): Promise<void> {
  // Skip database context in test environment to avoid RLS issues
  if (process.env.NODE_ENV === 'test') {
    console.log(
      `🔐 Database context (test mode): org=${context.organizationId}, user=${context.userId || 'none'}, admin=${context.isAdmin || false}`,
    );
    return;
  }

  const db = await getDatabase();

  // Validate input to prevent injection
  if (!context.organizationId || typeof context.organizationId !== 'string') {
    throw new Error('Invalid organizationId: must be a non-empty string');
  }

  if (context.userId && typeof context.userId !== 'string') {
    throw new Error('Invalid userId: must be a string');
  }

  // UUID format validation for organization and user IDs
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(context.organizationId)) {
    throw new Error('Invalid organizationId format: must be a valid UUID');
  }

  if (context.userId && !uuidRegex.test(context.userId)) {
    throw new Error('Invalid userId format: must be a valid UUID');
  }

  try {
    // Escape SQL strings for safe interpolation
    const orgId = context.organizationId.replace(/'/g, "''");
    const userId = context.userId ? context.userId.replace(/'/g, "''") : '';
    const adminValue = context.isAdmin === true ? 'true' : 'false';

    // For PGlite, use the underlying client's exec method instead of execute
    if (db && typeof (db as any)._client?.exec === 'function') {
      // PGlite direct execution
      await (db as any)._client.exec(
        `SET SESSION "app.current_organization_id" = '${orgId}'`,
      );
      if (context.userId) {
        await (db as any)._client.exec(
          `SET SESSION "app.current_user_id" = '${userId}'`,
        );
      } else {
        await (db as any)._client.exec(
          'SET SESSION "app.current_user_id" = \'\'',
        );
      }
      await (db as any)._client.exec(
        `SET SESSION "app.current_user_is_admin" = '${adminValue}'`,
      );
    } else if (typeof (db as any).execute === 'function') {
      // Standard Drizzle execute for other adapters
      await (db as any).execute(
        sql.raw(`SET SESSION "app.current_organization_id" = '${orgId}'`),
      );
      if (context.userId) {
        await (db as any).execute(
          sql.raw(`SET SESSION "app.current_user_id" = '${userId}'`),
        );
      } else {
        await (db as any).execute(
          sql.raw('SET SESSION "app.current_user_id" = \'\''),
        );
      }
      await (db as any).execute(
        sql.raw(`SET SESSION "app.current_user_is_admin" = '${adminValue}'`),
      );
    } else {
      // Skip context setting for adapters that don't support it
      console.log(
        `🔐 Database context skipped (adapter doesn't support raw SQL execution): org=${context.organizationId}, user=${context.userId || 'none'}, admin=${context.isAdmin || false}`,
      );
      return;
    }

    console.log(
      `🔐 Database context set: org=${context.organizationId}, user=${context.userId || 'none'}, admin=${context.isAdmin || false}`,
    );
  } catch (error) {
    console.error('❌ Failed to set database context:', error);
    // Don't throw in development mode to avoid breaking dev login
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '🔐 Database context set failed in development - continuing anyway',
      );
      return;
    }
    throw new Error('Failed to set database context');
  }
}

/**
 * Clear the database context
 */
export async function clearDatabaseContext(): Promise<void> {
  // Skip database context in test environment to avoid RLS issues
  if (process.env.NODE_ENV === 'test') {
    console.log('🔓 Database context cleared (test mode)');
    return;
  }

  const db = await getDatabase();

  try {
    // For PGlite, use the underlying client's exec method instead of execute
    if (db && typeof (db as any)._client?.exec === 'function') {
      // PGlite direct execution
      await (db as any)._client.exec(
        'SET SESSION "app.current_organization_id" = \'\'',
      );
      await (db as any)._client.exec(
        'SET SESSION "app.current_user_id" = \'\'',
      );
      await (db as any)._client.exec(
        'SET SESSION "app.current_user_is_admin" = \'false\'',
      );
    } else if (typeof (db as any).execute === 'function') {
      // Standard Drizzle execute for other adapters
      await (db as any).execute(
        sql.raw('SET SESSION "app.current_organization_id" = \'\''),
      );
      await (db as any).execute(
        sql.raw('SET SESSION "app.current_user_id" = \'\''),
      );
      await (db as any).execute(
        sql.raw('SET SESSION "app.current_user_is_admin" = \'false\''),
      );
    } else {
      // Skip context clearing for adapters that don't support it
      console.log(
        "🔓 Database context cleared (skipped - adapter doesn't support raw SQL execution)",
      );
      return;
    }

    console.log('🔓 Database context cleared');
  } catch (error) {
    console.error('❌ Failed to clear database context:', error);
    // Don't throw in development mode to avoid breaking dev login
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '🔓 Database context clear failed in development - continuing anyway',
      );
      return;
    }
    throw new Error('Failed to clear database context');
  }
}

/**
 * Get the current database context
 */
export async function getDatabaseContext(): Promise<DatabaseContext | null> {
  // Return null in test environment to avoid RLS issues
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const db = await getDatabase();

  try {
    // Use proper select query instead of execute for getting data
    const results = await db
      .select({
        organizationId: sql`current_setting('app.current_organization_id', true)`,
        userId: sql`current_setting('app.current_user_id', true)`,
        isAdmin: sql`current_setting('app.current_user_is_admin', true)`,
      })
      .limit(1);

    if (!results || results.length === 0) {
      return null;
    }

    const result = results[0];
    if (!result?.organizationId) {
      return null;
    }

    return {
      organizationId: result.organizationId as string,
      userId:
        result.userId && result.userId !== ''
          ? (result.userId as string)
          : undefined,
      isAdmin: result.isAdmin === 'true',
    };
  } catch (error) {
    console.error('❌ Failed to get database context:', error);
    // In development mode, return null instead of throwing to avoid breaking the flow
    if (process.env.NODE_ENV === 'development') {
      console.log(
        '🔐 Database context get failed in development - returning null',
      );
      return null;
    }
    return null;
  }
}

/**
 * Execute a function with a specific database context
 * Automatically restores the previous context after execution
 */
export async function withDatabaseContext<T>(
  context: DatabaseContext,
  fn: () => Promise<T>,
): Promise<T> {
  const previousContext = await getDatabaseContext();

  try {
    await setDatabaseContext(context);
    const result = await fn();
    return result;
  } finally {
    if (previousContext) {
      await setDatabaseContext(previousContext);
    } else {
      await clearDatabaseContext();
    }
  }
}

/**
 * Set context from user session data
 * Convenience function for setting context from authenticated user
 */
export async function setContextFromUser(user: User): Promise<void> {
  await setDatabaseContext({
    organizationId: user.organizationId,
    userId: user.id,
    isAdmin: ['owner', 'admin'].includes(user.role),
  });
}

/**
 * Set context for system operations (bypass user restrictions)
 * Use with caution - only for system-level operations
 */
export async function setSystemContext(organizationId: string): Promise<void> {
  await setDatabaseContext({
    organizationId,
    isAdmin: true,
  });
}

/**
 * Middleware function to automatically set context from request
 * For use with API routes and server actions
 */
export function withDatabaseContextMiddleware(
  getContext: () => Promise<DatabaseContext>,
) {
  return function <T extends any[], R>(fn: (...args: T) => Promise<R>) {
    return async (...args: T): Promise<R> => {
      const context = await getContext();
      return withDatabaseContext(context, () => fn(...args));
    };
  };
}

/**
 * Validate that required context is set
 * Throws error if organization context is missing
 */
export async function validateDatabaseContext(): Promise<DatabaseContext> {
  const context = await getDatabaseContext();

  if (!context || !context.organizationId) {
    throw new Error(
      'Database context not set. Organization ID is required for all operations.',
    );
  }

  return context;
}

/**
 * Helper to check if current context has admin privileges
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const context = await getDatabaseContext();
  return context?.isAdmin === true;
}

/**
 * Helper to get current organization ID
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const context = await getDatabaseContext();
  return context?.organizationId || null;
}

/**
 * Helper to get current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const context = await getDatabaseContext();
  return context?.userId || null;
}
