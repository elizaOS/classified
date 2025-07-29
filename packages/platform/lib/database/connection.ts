/**
 * Database connection configuration with support for both PostgreSQL and SQLite (via PGlite)
 */

import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeout?: number;
}

type DatabaseInstance = any; // Union types cause compatibility issues between PGlite and Postgres
type SqlClient = ReturnType<typeof postgres> | any; // PGlite instance

let _db: DatabaseInstance | null = null;
let _sql: SqlClient | null = null;
let _dbType: 'postgres' | 'sqlite' | null = null;
let _initPromise: Promise<void> | null = null;

function getDatabaseType(connectionString: string): 'postgres' | 'sqlite' {
  if (
    connectionString.startsWith('sqlite://') ||
    connectionString.startsWith('pglite://') ||
    connectionString.includes('.db') ||
    connectionString.includes('.sqlite')
  ) {
    return 'sqlite';
  }
  return 'postgres';
}

async function createDatabaseConnection(config?: Partial<DatabaseConfig>) {
  if (_sql && _db) {
    return { db: _db, sql: _sql };
  }

  // Import env-validation to ensure DATABASE_URL is set
  const { DATABASE_URL } = await import('../config/env-validation');
  let connectionString = DATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Ensure connectionString is always a string, never a URL object
  if (typeof connectionString === 'object') {
    console.log('⚠️  DATABASE_URL is a URL object, converting to string');
    connectionString = String(connectionString);
  }

  _dbType = getDatabaseType(connectionString);

  if (_dbType === 'sqlite') {
    return await createSqliteConnection(connectionString);
  } else {
    return createPostgresConnection(connectionString, config);
  }
}

async function createSqliteConnection(connectionString: string | URL) {
  try {
    // Extract the file path from the connection string - handle both string and URL objects
    let dbPath: string;

    if (
      typeof connectionString === 'object' &&
      connectionString instanceof URL
    ) {
      // Handle URL object - extract pathname and remove protocol
      console.log('⚠️  Received URL object, converting to string path');
      dbPath =
        connectionString.pathname ||
        connectionString.href.replace(/^[^:]+:\/\//, '');
    } else {
      // Handle string
      dbPath = String(connectionString);
    }

    // Handle various URL formats
    if (dbPath.startsWith('pglite://')) {
      dbPath = dbPath.replace('pglite://', '');
    }
    if (dbPath.startsWith('sqlite://')) {
      dbPath = dbPath.replace('sqlite://', '');
    }
    if (dbPath.startsWith('file:')) {
      dbPath = dbPath.replace('file:', '');
    }

    // Ensure dbPath is a clean string
    dbPath = String(dbPath).trim();

    // Convert to absolute path if relative
    if (!dbPath.startsWith('/')) {
      const path = await import('path');
      dbPath = path.resolve(process.cwd(), dbPath);
    }

    // Ensure parent directory exists
    const fs = await import('fs');
    const path = await import('path');
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    console.log(`📁 Connecting to SQLite database (via PGlite) at: ${dbPath}`);

    // Create PGlite instance - CRITICAL: always pass a clean string
    let pglite;
    try {
      // Ensure we NEVER pass anything other than a plain string
      const cleanPath = String(dbPath);
      console.log(
        `🔧 PGlite constructor args: "${cleanPath}" (type: ${typeof cleanPath})`,
      );
      pglite = new PGlite(cleanPath);
    } catch (err) {
      console.log('Failed with direct path, trying with dataDir option...');
      // Try with dataDir option as fallback
      const cleanPath = String(dbPath);
      console.log(
        `🔧 PGlite constructor args (dataDir): "${cleanPath}" (type: ${typeof cleanPath})`,
      );
      pglite = new PGlite({ dataDir: cleanPath });
    }

    // Wait for PGlite to be ready
    if (pglite.waitReady) {
      await pglite.waitReady;
    }

    _sql = pglite as SqlClient;

    // Create Drizzle instance for PGlite (using PGlite adapter)
    _db = drizzlePglite(pglite, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    });

    console.log('✅ SQLite database connection established (using PGlite)');
    return { db: _db, sql: _sql };
  } catch (error) {
    console.error('❌ Failed to connect to SQLite database:', error);
    throw error;
  }
}

function createPostgresConnection(
  connectionString: string,
  config?: Partial<DatabaseConfig>,
) {
  // Parse connection config from environment or parameters
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password:
      process.env.DB_PASSWORD ||
      (() => {
        // CRITICAL: Never allow empty passwords in production
        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            'DB_PASSWORD is required in production - empty passwords are not allowed',
          );
        }
        console.warn(
          '⚠️  WARNING: Using empty database password in development mode',
        );
        return '';
      })(),
    database: process.env.DB_NAME || 'elizaos_platform',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30', 10),
    ...config,
  };

  try {
    // Create postgres connection with connection pooling
    _sql = postgres(connectionString, {
      max: dbConfig.maxConnections,
      idle_timeout: dbConfig.idleTimeout,
      connect_timeout: 30,
      ssl: dbConfig.ssl ? 'require' : false,
      // SECURITY: Enable prepared statements for SQL injection protection
      // Only disable in development if absolutely necessary for debugging
      prepare:
        process.env.NODE_ENV === 'development'
          ? process.env.DB_DISABLE_PREPARED_STATEMENTS === 'true'
            ? false
            : true
          : true,
      onnotice:
        process.env.NODE_ENV === 'development' ? console.log : undefined,
    }) as SqlClient;

    // Create Drizzle instance for PostgreSQL
    _db = drizzlePostgres(_sql as ReturnType<typeof postgres>, {
      schema,
      logger: process.env.NODE_ENV === 'development',
    }) as DatabaseInstance;

    console.log('✅ PostgreSQL database connection established');
    return { db: _db, sql: _sql };
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL database:', error);
    throw error;
  }
}

// Initialize the database connection
async function ensureConnection() {
  if (!_initPromise) {
    _initPromise = createDatabaseConnection().then(() => {
      // Connection created successfully, return void
    });
  }
  await _initPromise;
}

export function getDatabase() {
  if (!_db) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return _db;
}

// Export the database instance and SQL client
export const db = {
  get database() {
    return getDatabase();
  },
  get sql() {
    return getSql();
  },
};

export function getSql() {
  if (!_sql) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return _sql;
}

export async function closeDatabase() {
  if (_sql) {
    if (_dbType === 'postgres' && _sql && 'end' in _sql) {
      await (_sql as ReturnType<typeof postgres>).end();
    } else if (_dbType === 'sqlite' && _sql) {
      await (_sql as any).close();
    }
    _sql = null;
    _db = null;
    _dbType = null;
    _initPromise = null;
    console.log('🔌 Database connection closed');
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    await ensureConnection();
    const sqlClient = getSql();

    if (_dbType === 'sqlite' && sqlClient) {
      // PGlite test query (using PostgreSQL syntax)
      const db = sqlClient as any;
      await db.query('SELECT 1 as test');
    } else if (_dbType === 'postgres' && sqlClient) {
      // PostgreSQL test query
      const db = sqlClient as ReturnType<typeof postgres>;
      await db`SELECT 1 as test`;
    }

    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Health check for database
export async function getDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latency?: number;
  error?: string;
  dbType?: string;
}> {
  const startTime = Date.now();

  try {
    await ensureConnection();
    const sqlClient = getSql();

    if (_dbType === 'sqlite' && sqlClient) {
      const db = sqlClient as any;
      await db.query('SELECT 1 as health_check');
    } else if (_dbType === 'postgres' && sqlClient) {
      const db = sqlClient as ReturnType<typeof postgres>;
      await db`SELECT 1 as health_check`;
    }

    const latency = Date.now() - startTime;

    return {
      isHealthy: true,
      latency,
      dbType: _dbType || undefined,
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      dbType: _dbType || undefined,
    };
  }
}

// Get database statistics
export async function getDatabaseStats(): Promise<{
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  dbType: string;
}> {
  try {
    await ensureConnection();

    if (_dbType === 'sqlite') {
      // PGlite doesn't have the same statistics as PostgreSQL
      return {
        totalConnections: 1,
        activeConnections: 1,
        idleConnections: 0,
        totalQueries: 0,
        dbType: 'sqlite',
      };
    }

    const sqlClient = getSql();
    if (!sqlClient || _dbType !== 'postgres') {
      throw new Error('PostgreSQL statistics not available');
    }

    const db = sqlClient as ReturnType<typeof postgres>;
    const [connectionStats] = await db`
      SELECT 
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT sum(calls) FROM pg_stat_user_functions) as total_queries
    `;

    return {
      totalConnections: Number(connectionStats.total_connections) || 0,
      activeConnections: Number(connectionStats.active_connections) || 0,
      idleConnections: Number(connectionStats.idle_connections) || 0,
      totalQueries: Number(connectionStats.total_queries) || 0,
      dbType: 'postgres',
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      totalQueries: 0,
      dbType: _dbType || 'unknown',
    };
  }
}

// Initialize database (for tests and setup)
export async function initializeDatabase(): Promise<void> {
  try {
    // Ensure connection is established
    await ensureConnection();

    // Test the connection
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Failed to establish database connection');
    }

    // Only seed OAuth clients for PostgreSQL (SQLite will handle this differently)
    if (_dbType === 'postgres') {
      await seedDefaultOAuthClients();
    }

    console.log(`✅ Database initialized successfully (${_dbType})`);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Seed default OAuth clients during initialization
async function seedDefaultOAuthClients(): Promise<void> {
  try {
    const { oauthClientRepository } = await import(
      './repositories/oauth-client'
    );
    await oauthClientRepository.seedDefaultClients();
    console.log('✅ Default OAuth clients seeded');
  } catch (error) {
    console.error('❌ Failed to seed OAuth clients:', error);
    throw error;
  }
}

export { schema };
export default getDatabase;
