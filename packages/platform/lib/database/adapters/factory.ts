/**
 * Database adapter factory
 * Creates appropriate database adapter based on environment and configuration
 */

import { PGliteAdapter } from './pglite';
import { PostgreSQLAdapter } from './postgresql';
import type { DatabaseAdapter, DatabaseConfig } from './base';

export type DatabaseEngine = 'pglite' | 'postgresql' | 'auto';

export interface AdapterFactoryConfig extends DatabaseConfig {
  engine?: DatabaseEngine;
  forceEngine?: boolean;
}

/**
 * Determine which database engine to use based on environment and configuration
 */
export function detectDatabaseEngine(
  config: Partial<AdapterFactoryConfig>,
): 'pglite' | 'postgresql' {
  // If engine is explicitly specified and forced, use it
  if (config.engine && config.forceEngine && config.engine !== 'auto') {
    console.log(`🔍 Engine forced to: ${config.engine}`);
    return config.engine;
  }

  // Check for explicit engine preference (not forced)
  if (config.engine && config.engine !== 'auto' && !config.forceEngine) {
    console.log(`🔍 Engine specified: ${config.engine}`);
    return config.engine;
  }

  // Check for PGlite environment variables first (higher priority for local dev)
  if (process.env.PGLITE_DB_PATH || process.env.PGLITE_URL || config.path) {
    console.log('🔍 PGlite environment variables detected');
    return 'pglite';
  }

  // Check for DATABASE_URL environment variable (usually indicates cloud/production)
  const databaseUrl = config.url || process.env.DATABASE_URL;
  if (databaseUrl) {
    if (
      databaseUrl.startsWith('postgresql://') ||
      databaseUrl.startsWith('postgres://')
    ) {
      console.log('🔍 PostgreSQL DATABASE_URL detected');
      return 'postgresql';
    }
    if (databaseUrl.startsWith('file:') || databaseUrl.startsWith('pglite:')) {
      console.log('🔍 PGlite DATABASE_URL detected');
      return 'pglite';
    }
  }

  // Check environment
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development' || nodeEnv === 'test';

  // Production defaults to PostgreSQL
  if (isProduction) {
    console.log('🔍 Production environment detected, using PostgreSQL');
    return 'postgresql';
  }

  // Development defaults to PGlite
  if (isDevelopment) {
    console.log('🔍 Development environment detected, using PGlite');
    return 'pglite';
  }

  // Check for specific PostgreSQL environment variables
  if (
    process.env.DB_HOST ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_HOST
  ) {
    console.log('🔍 PostgreSQL environment variables detected');
    return 'postgresql';
  }

  // Check for PGlite environment variables
  if (process.env.PGLITE_DB_PATH || process.env.PGLITE_URL) {
    console.log('🔍 PGlite environment variables detected');
    return 'pglite';
  }

  // Ultimate fallback: PGlite for safety (doesn't require external services)
  console.log(
    '🔍 No specific database configuration detected, defaulting to PGlite',
  );
  return 'pglite';
}

/**
 * Create database adapter based on configuration
 */
export function createDatabaseAdapter(
  config: Partial<AdapterFactoryConfig> = {},
): DatabaseAdapter {
  const engine = detectDatabaseEngine(config);

  console.log(`🔧 Creating ${engine.toUpperCase()} database adapter`);

  switch (engine) {
    case 'pglite':
      return new PGliteAdapter({
        database: config.database || 'local', // Required field for interface
        ...config,
        path: config.path || process.env.PGLITE_DB_PATH || './data/local',
      });

    case 'postgresql':
      return new PostgreSQLAdapter({
        database: config.database || process.env.DB_NAME || 'elizaos_platform',
        ...config,
        host: config.host || process.env.DB_HOST || 'localhost',
        port: config.port || parseInt(process.env.DB_PORT || '5432', 10),
        user: config.user || process.env.DB_USER || 'postgres',
        password: config.password || process.env.DB_PASSWORD || '',
        ssl: config.ssl ?? process.env.DB_SSL === 'true',
        url: config.url || process.env.DATABASE_URL,
      });

    default:
      throw new Error(`Unsupported database engine: ${engine}`);
  }
}

/**
 * Singleton database adapter instance
 */
let adapterInstance: DatabaseAdapter | null = null;

/**
 * Get singleton database adapter instance
 */
export function getDatabaseAdapter(
  config?: Partial<AdapterFactoryConfig>,
): DatabaseAdapter {
  // During Next.js build or static generation, return a stub adapter
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.BUILD_MODE === 'export' ||
    process.env.NEXT_EXPORT === 'true'
  ) {
    return {
      engine: 'pglite',
      isCloud: false,
      connect: async () => {},
      disconnect: async () => {},
      isConnected: () => false,
      getDatabase: () => {
        throw new Error('Database not available during build');
      },
      getClient: () => {
        throw new Error('Database not available during build');
      },
      getSqlClient: () => {
        throw new Error('Database not available during build');
      },
      runMigrations: async () => {},
      reset: async () => {},
      seed: async () => {},
      isHealthy: async () => false,
      healthCheck: async () => ({ isHealthy: false, error: 'Build time' }),
      getStats: async () => ({
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        totalQueries: 0,
      }),
    } as DatabaseAdapter;
  }

  if (!adapterInstance) {
    adapterInstance = createDatabaseAdapter(config);
  }
  return adapterInstance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetDatabaseAdapter(): void {
  if (adapterInstance) {
    adapterInstance.disconnect().catch(console.error);
    adapterInstance = null;
  }
}

export { PGliteAdapter, PostgreSQLAdapter };
export type { DatabaseAdapter, DatabaseConfig };
