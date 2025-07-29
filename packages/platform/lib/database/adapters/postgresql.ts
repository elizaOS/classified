/**
 * PostgreSQL database adapter for cloud/production deployment
 * Uses postgres.js for connection pooling
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from '../schema';
import { BaseDatabaseAdapter, type DatabaseConfig } from './base';

export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  public readonly engine = 'postgresql' as const;
  public readonly isCloud = true;

  private sql: ReturnType<typeof postgres> | null = null;
  private db: PostgresJsDatabase<typeof schema> | null = null;

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    if (this.connected && this.sql && this.db) {
      return;
    }

    try {
      const connectionString =
        this.config.url ||
        process.env.DATABASE_URL ||
        this.buildConnectionString();

      if (!connectionString) {
        throw new Error(
          'DATABASE_URL or connection parameters are required for PostgreSQL',
        );
      }

      console.log('🔌 Connecting to PostgreSQL database...');

      // Validate required password in production
      if (
        process.env.NODE_ENV === 'production' &&
        !this.config.password &&
        !connectionString.includes('@')
      ) {
        throw new Error(
          'DB_PASSWORD is required in production - empty passwords are not allowed',
        );
      }

      // Create postgres connection with connection pooling
      this.sql = postgres(connectionString, {
        max: this.config.maxConnections || 20,
        idle_timeout: this.config.idleTimeout || 30,
        connect_timeout: 30,
        ssl: this.config.ssl ? 'require' : false,
        prepare:
          process.env.NODE_ENV === 'development'
            ? process.env.DB_DISABLE_PREPARED_STATEMENTS === 'true'
              ? false
              : true
            : true,
        onnotice:
          process.env.NODE_ENV === 'development' ? console.log : undefined,
      });

      // Create Drizzle instance
      this.db = drizzle(this.sql, {
        schema,
        logger: process.env.NODE_ENV === 'development',
      });

      // Test the connection
      await this.sql`SELECT 1`;

      this.connected = true;
      console.log('✅ PostgreSQL database connection established');
    } catch (error) {
      console.error('❌ Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
      this.sql = null;
      this.db = null;
      this.connected = false;
      console.log('🔌 PostgreSQL database connection closed');
    }
  }

  getDatabase(): PostgresJsDatabase<typeof schema> {
    if (!this.db) {
      throw new Error(
        'PostgreSQL database not connected. Call connect() first.',
      );
    }
    return this.db;
  }

  getSqlClient(): ReturnType<typeof postgres> {
    if (!this.sql) {
      throw new Error('PostgreSQL client not connected. Call connect() first.');
    }
    return this.sql;
  }

  async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      console.log('🔄 Running PostgreSQL migrations...');
      await migrate(this.db, { migrationsFolder: './drizzle/migrations' });
      console.log('✅ PostgreSQL migrations completed');
    } catch (error) {
      console.error('❌ PostgreSQL migration failed:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    console.warn(
      '⚠️  Resetting PostgreSQL database - this will drop all data!',
    );

    // Drop all tables in reverse dependency order
    const tablesToDrop = [
      'usage_records',
      'webhooks',
      'audit_logs',
      'credit_transactions',
      'uploads',
      'organization_plugins',
      'plugins',
      'agents',
      'api_keys',
      'user_sessions',
      'users',
      'organizations',
    ];

    for (const table of tablesToDrop) {
      try {
        await this.db.execute(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      } catch (error) {
        console.warn(`Could not drop table ${table}:`, error);
      }
    }

    // Run migrations to recreate tables
    await this.runMigrations();

    console.log('✅ PostgreSQL database reset completed');
  }

  async seed(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    console.log('🌱 Seeding PostgreSQL database...');

    // Add production seed data here
    // For now, just log that seeding would happen
    console.log('✅ PostgreSQL database seeding completed');
  }

  private buildConnectionString(): string {
    const {
      host = 'localhost',
      port = 5432,
      user = 'postgres',
      password = '',
      database = 'elizaos_platform',
      ssl = false,
    } = this.config;

    const sslParam = ssl ? '?sslmode=require' : '';
    return `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
  }

  async getDatabaseStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    totalQueries: number;
  }> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      const [connectionStats] = await this.db.execute(`
        SELECT 
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as total_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
          (SELECT sum(calls) FROM pg_stat_user_functions) as total_queries
      `);

      return {
        totalConnections: Number(connectionStats.total_connections) || 0,
        activeConnections: Number(connectionStats.active_connections) || 0,
        idleConnections: Number(connectionStats.idle_connections) || 0,
        totalQueries: Number(connectionStats.total_queries) || 0,
      };
    } catch (error) {
      console.error('Failed to get PostgreSQL database stats:', error);
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        totalQueries: 0,
      };
    }
  }
}
