/**
 * Database connection and services
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from './schema.js';
import type { APIServiceConfig } from '../types/index.js';

let db: ReturnType<typeof drizzle> | null = null;
let connection: postgres.Sql | null = null;

export async function initializeDatabase(config: APIServiceConfig) {
  if (db) {
    return db;
  }

  console.log('Initializing database connection...');

  try {
    // Create PostgreSQL connection
    connection = postgres(config.database.url, {
      max: config.database.maxConnections,
      idle_timeout: 20,
      connect_timeout: 60,
    });

    // Test connection
    await connection`SELECT 1`;
    console.log('✅ Database connection established');

    // Initialize Drizzle ORM
    db = drizzle(connection, { schema });

    // Run migrations (in production, this should be done separately)
    try {
      await migrate(db, { migrationsFolder: './migrations' });
      console.log('✅ Database migrations completed');
    } catch (migrationError) {
      console.warn(
        '⚠️  Migration failed (expected in development):',
        migrationError
      );
      // Don't fail startup if migrations fail - tables might already exist
    }

    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

export async function closeDatabase() {
  if (connection) {
    await connection.end();
    connection = null;
    db = null;
    console.log('✅ Database connection closed');
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    if (!connection) {
      return false;
    }

    await connection`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
