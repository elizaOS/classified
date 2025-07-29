/**
 * PGlite database adapter for local development
 * Uses @electric-sql/pglite for embedded PostgreSQL support
 */

import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../schema';
import { BaseDatabaseAdapter, type DatabaseConfig } from './base';

export class PGliteAdapter extends BaseDatabaseAdapter {
  public readonly engine = 'pglite' as const;
  public readonly isCloud = false;

  private client: PGlite | null = null;
  private db: PgliteDatabase<typeof schema> | null = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    if (this.connected && this.client && this.db) {
      return;
    }

    try {
      // Determine PGlite database path
      let dbPath =
        this.config.path ||
        this.config.url ||
        process.env.PGLITE_DB_PATH ||
        process.env.SQLITE_DB_PATH || // Backward compatibility
        './data/local.db';

      // Convert to proper path for PGlite - handle URL objects too
      if (typeof dbPath === 'object' && dbPath && 'href' in dbPath) {
        console.log(
          '⚠️  PGliteAdapter received URL object, converting to string',
        );
        const urlObj = dbPath as any;
        dbPath = urlObj.pathname || urlObj.href.replace(/^[^:]+:\/\//, '');
      }

      if (typeof dbPath === 'string') {
        dbPath = dbPath.replace('file:', '').replace('.db', '');
      }

      // Ensure it's definitely a string
      const cleanPath = String(dbPath);

      console.log(
        `🔌 Connecting to PGlite database: ${cleanPath} (type: ${typeof cleanPath})`,
      );

      // Create PGlite client - CRITICAL: always pass clean string
      this.client = new PGlite({
        dataDir: cleanPath,
      });

      // Create Drizzle instance
      this.db = drizzle(this.client, {
        schema,
        logger: process.env.NODE_ENV === 'development',
      });

      // Test the connection
      await this.client.query('SELECT 1');

      this.connected = true;
      console.log('✅ PGlite database connection established');
    } catch (error) {
      console.error('❌ Failed to connect to PGlite database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      console.log('🔌 PGlite database connection closed');
    }
  }

  getDatabase(): PgliteDatabase<typeof schema> {
    if (!this.db) {
      throw new Error('PGlite database not connected. Call connect() first.');
    }
    return this.db;
  }

  getClient(): PGlite {
    if (!this.client) {
      throw new Error('PGlite client not connected. Call connect() first.');
    }
    return this.client;
  }

  getSqlClient(): PGlite {
    return this.getClient();
  }

  async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      console.log('🔄 Running PGlite migrations...');
      await migrate(this.db, {
        migrationsFolder: './drizzle/migrations-pglite',
      });
      console.log('✅ PGlite migrations completed');
    } catch (error) {
      console.error('❌ PGlite migration failed:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    console.log('🔄 Resetting PGlite database...');

    // Drop all tables in the public schema
    try {
      const result = await this.client!.query(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);

      for (const row of result.rows) {
        await this.client!.query(
          `DROP TABLE IF EXISTS "${(row as any).tablename}" CASCADE`,
        );
      }

      console.log('✅ All tables dropped');
    } catch (error) {
      console.warn('Warning during table cleanup:', error);
    }

    // Run migrations to recreate tables
    await this.runMigrations();

    console.log('✅ PGlite database reset completed');
  }

  async seed(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    console.log('🌱 Seeding PGlite database...');

    // Add development seed data here
    // For now, just log that seeding would happen
    console.log('✅ PGlite database seeding completed');
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<{
    isHealthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.isHealthy();
      const latency = Date.now() - startTime;
      return { isHealthy, latency };
    } catch (error) {
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getStats(): Promise<{
    totalConnections?: number;
    activeConnections?: number;
    idleConnections?: number;
    totalQueries?: number;
  }> {
    // PGlite is embedded, so connection stats are simpler
    return {
      totalConnections: this.connected ? 1 : 0,
      activeConnections: this.connected ? 1 : 0,
      idleConnections: 0,
      totalQueries: 0, // PGlite doesn't expose query stats
    };
  }
}
