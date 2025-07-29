/**
 * Database module exports
 * Central access point for all database functionality
 */

// Core database connection and utilities
import { getDatabaseAdapter } from './adapters/factory';

// Create singleton adapter instance
let _adapter: ReturnType<typeof getDatabaseAdapter> | null = null;

function getAdapter() {
  if (!_adapter) {
    _adapter = getDatabaseAdapter();
  }
  return _adapter;
}

// Check if we're in Next.js build time
function isBuildTime(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    (process.env.NODE_ENV === 'production' && process.argv.includes('build'))
  );
}

// Export adapter methods as database utilities
export async function getDatabase() {
  const adapter = getAdapter();

  // Ensure adapter is connected before returning database
  if (!adapter.isConnected()) {
    await adapter.connect();
  }

  return adapter.getDatabase();
}

export function getSql() {
  return getAdapter().getSqlClient();
}

export async function closeDatabase() {
  if (_adapter) {
    await _adapter.disconnect();
    _adapter = null;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const result = await getAdapter().healthCheck();
    return result.isHealthy;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export async function getDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    return await getAdapter().healthCheck();
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getDatabaseStats(): Promise<{
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
}> {
  // Stats not implemented in base adapter yet
  // Return default values for now
  return {
    totalConnections: 1,
    activeConnections: 1,
    idleConnections: 0,
    totalQueries: 0,
  };
}

export async function initializeDatabase(): Promise<void> {
  try {
    await getAdapter().connect();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Re-export all schema objects from PGlite (embedded PostgreSQL)
export * from './schema-pglite';

// Database client type for better type safety
type DatabaseClient = ReturnType<typeof getDatabase>;

// Lazy-initialized database instance for backwards compatibility
let _db: DatabaseClient | null = null;

// Type-safe database proxy with proper generic constraints
export const db = new Proxy({} as DatabaseClient, {
  get<K extends keyof DatabaseClient>(
    target: DatabaseClient,
    prop: K,
  ): DatabaseClient[K] {
    if (!_db) {
      throw new Error(
        'Database not initialized. Call await getDatabase() first.',
      );
    }
    return _db[prop];
  },
});

// Function to initialize the database proxy with proper typing
export function initializeDbProxy(database: DatabaseClient): void {
  _db = database;
}

// Database context management for RLS
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
} from './context';

// Repository classes
export { OrganizationRepository } from './repositories/organization';
export { UserRepository, UserSessionRepository } from './repositories/user';

// Legacy schema object export (for compatibility)
export { schema } from './schema-pglite';

// Re-export common drizzle-orm utilities that consumers might need
export {
  eq,
  and,
  or,
  not,
  desc,
  asc,
  count,
  sum,
  avg,
  min,
  max,
  like,
  ilike,
} from 'drizzle-orm';

// Database client factory function (alias for getDatabase)
export async function getDatabaseClient() {
  return _db || (await getDatabase());
}
