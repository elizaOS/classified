/**
 * Client-side database interface
 * This file is safe for client-side imports
 */

export interface DatabaseStatus {
  isHealthy: boolean;
  latency?: number;
  error?: string;
  engine?: string;
}

export interface DatabaseStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
}

/**
 * Client-side API to check database health
 */
export async function getDatabaseHealthFromAPI(): Promise<DatabaseStatus> {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.database || { isHealthy: false, error: 'No database info' };
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Client-side API to get database stats
 */
export async function getDatabaseStatsFromAPI(): Promise<DatabaseStats> {
  try {
    const response = await fetch('/api/health/database');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
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
 * Database client singleton with lazy initialization
 */

import {
  getDatabase as getDbConnection,
  getSql as getSqlConnection,
  initializeDatabase,
} from './connection';
import * as schema from './schema';

// The actual return type from our connection module
type Database = ReturnType<typeof getDbConnection>;

let initPromise: Promise<void> | null = null;
let isInitialized = false;

/**
 * Ensures database is initialized before use
 */
async function ensureInitialized() {
  if (isInitialized) {
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log('🔄 Initializing database client...');
        await initializeDatabase();
        isInitialized = true;
        console.log('✅ Database client initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize database client:', error);
        initPromise = null; // Allow retry
        throw error;
      }
    })();
  }

  await initPromise;
}

/**
 * Get database client (synchronous for compatibility)
 * Note: This will throw if called before initialization completes
 */
export function getDatabaseClient(): Database {
  if (!isInitialized) {
    // Start initialization if not already started
    if (!initPromise) {
      ensureInitialized().catch((error) => {
        console.error('Database initialization failed:', error);
      });
    }
    throw new Error(
      'Database is initializing. Please wait a moment and try again.',
    );
  }

  return getDbConnection();
}

/**
 * Get database client (async, ensures initialization)
 */
export async function getDatabaseClientAsync(): Promise<Database> {
  await ensureInitialized();
  return getDbConnection();
}

/**
 * Get SQL client
 */
export function getSqlClient() {
  if (!isInitialized) {
    // Start initialization if not already started
    if (!initPromise) {
      ensureInitialized().catch((error) => {
        console.error('Database initialization failed:', error);
      });
    }
    throw new Error(
      'SQL client is initializing. Please wait a moment and try again.',
    );
  }

  return getSqlConnection();
}

/**
 * Get SQL client (async, ensures initialization)
 */
export async function getSqlClientAsync() {
  await ensureInitialized();
  return getSqlConnection();
}

// Auto-initialize is disabled to prevent early initialization issues
// Database will be initialized on first use via the lazy getters

// Legacy exports for backward compatibility
export { getDatabaseClient as getDatabase };
export const db = getDatabaseClient;
