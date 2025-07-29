/**
 * Base database adapter interface
 * Provides a common interface for different database engines
 */

import type { DrizzleConfig } from 'drizzle-orm';

export interface DatabaseAdapter {
  readonly engine: 'pglite' | 'postgresql';
  readonly isCloud: boolean;

  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Health check
  healthCheck(): Promise<{
    isHealthy: boolean;
    latency?: number;
    error?: string;
  }>;

  // Get Drizzle instance
  getDatabase(): any;
  getSqlClient(): any;

  // Migration support
  runMigrations(): Promise<void>;

  // Development utilities
  reset(): Promise<void>;
  seed(): Promise<void>;
}

export interface DatabaseConfig {
  // Common config
  database: string;
  maxConnections?: number;
  idleTimeout?: number;

  // PostgreSQL specific
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  ssl?: boolean;

  // SQLite specific
  path?: string;
  memory?: boolean;

  // Cloud/environment
  url?: string;
}

export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  public abstract readonly engine: 'pglite' | 'postgresql';
  public abstract readonly isCloud: boolean;

  protected config: DatabaseConfig;
  protected connected = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getDatabase(): any;
  abstract getSqlClient(): any;
  abstract runMigrations(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  async healthCheck(): Promise<{
    isHealthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Use SQL client directly for health check since DB interfaces differ
      const client = this.getSqlClient();

      if (this.engine === 'pglite') {
        // LibSQL client uses execute method
        await client.execute('SELECT 1');
      } else {
        // PostgreSQL client uses template literal
        await client`SELECT 1`;
      }

      const latency = Date.now() - startTime;

      return {
        isHealthy: true,
        latency,
      };
    } catch (error) {
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async reset(): Promise<void> {
    console.warn('⚠️  Database reset not implemented for this adapter');
  }

  async seed(): Promise<void> {
    console.warn('⚠️  Database seed not implemented for this adapter');
  }
}
