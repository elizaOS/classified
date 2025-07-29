/**
 * Server-only database connection
 * This file should never be imported on the client side
 */

// Server-only module (TODO: add server-only import when package is available)
import {
  getDatabaseAdapter,
  resetDatabaseAdapter,
  type DatabaseAdapter,
} from './adapters/factory';
import { initializeDbProxy } from './index';
import * as pgSchema from './schema';
import * as pgliteSchema from './schema-pglite';

// Global adapter instance
let adapter: DatabaseAdapter | null = null;

/**
 * Initialize database connection with auto-detection
 */
export async function initializeDatabase(config?: {
  engine?: 'pglite' | 'postgresql' | 'auto';
  forceEngine?: boolean;
  [key: string]: any;
}): Promise<DatabaseAdapter> {
  if (adapter && adapter.isConnected()) {
    return adapter;
  }

  try {
    adapter = getDatabaseAdapter(config);
    await adapter.connect();

    // Initialize the database proxy for backwards compatibility
    initializeDbProxy(adapter.getDatabase());

    console.log(
      `✅ Database initialized with ${adapter.engine.toUpperCase()} adapter`,
    );
    return adapter;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get database instance (backwards compatibility)
 */
export function getDatabase() {
  if (!adapter) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return adapter.getDatabase();
}

/**
 * Get SQL client instance (backwards compatibility)
 */
export function getSql() {
  if (!adapter) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return adapter.getSqlClient();
}

/**
 * Get current database adapter
 */
export function getDatabaseAdapterInstance(): DatabaseAdapter {
  if (!adapter) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return adapter;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (adapter) {
    await adapter.disconnect();
    resetDatabaseAdapter();
    adapter = null;
    console.log('🔌 Database connection closed');
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    if (!adapter) {
      adapter = getDatabaseAdapter();
      await adapter.connect();
    }

    const health = await adapter.healthCheck();
    return health.isHealthy;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Get database health status
 */
export async function getDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latency?: number;
  error?: string;
  engine?: string;
}> {
  try {
    if (!adapter) {
      adapter = getDatabaseAdapter();
      await adapter.connect();
    }

    const health = await adapter.healthCheck();
    return {
      ...health,
      engine: adapter.engine,
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get database statistics (PostgreSQL only)
 */
export async function getDatabaseStats(): Promise<{
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
}> {
  try {
    if (!adapter) {
      adapter = getDatabaseAdapter();
      await adapter.connect();
    }

    // Check if adapter has PostgreSQL-specific stats method
    if (adapter.engine === 'postgresql' && 'getDatabaseStats' in adapter) {
      return await (adapter as any).getDatabaseStats();
    }

    // Return empty stats for PGlite
    return {
      totalConnections: 1,
      activeConnections: adapter.isConnected() ? 1 : 0,
      idleConnections: 0,
      totalQueries: 0,
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalQueries: 0,
    };
  }
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  if (!adapter) {
    adapter = getDatabaseAdapter();
    await adapter.connect();
  }

  await adapter.runMigrations();
}

/**
 * Reset database (development only)
 */
export async function resetDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database reset is not allowed in production');
  }

  if (!adapter) {
    adapter = getDatabaseAdapter();
    await adapter.connect();
  }

  await adapter.reset();
}

/**
 * Seed database with development data
 */
export async function seedDatabase(): Promise<void> {
  if (!adapter) {
    adapter = getDatabaseAdapter();
    await adapter.connect();
  }

  await adapter.seed();
}

/**
 * Get appropriate schema based on current database engine
 */
export function getSchema() {
  if (!adapter) {
    // Default to PostgreSQL schema if not initialized
    return pgSchema;
  }

  return adapter.engine === 'pglite' ? pgliteSchema : pgSchema;
}

// Backwards compatibility: get schema based on environment
export const schema = new Proxy({} as Record<string, unknown>, {
  get(target, prop) {
    const currentSchema = getSchema();
    return (currentSchema as Record<string, any>)[prop as string];
  },
});

export default getDatabase;
