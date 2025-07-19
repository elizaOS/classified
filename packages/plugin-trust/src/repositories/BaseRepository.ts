import type { IAgentRuntime, UUID } from '@elizaos/core';
import { logger } from '@elizaos/core';

/**
 * Base repository class that provides database-agnostic access patterns
 * All trust plugin repositories should extend this class
 */
export abstract class BaseRepository {
  protected runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;

    if (!runtime) {
      throw new Error('Runtime not provided to repository');
    }
  }

  /**
   * Execute a raw SQL query with database-agnostic handling
   * @param sql The SQL query to execute
   * @param params Query parameters
   * @returns Query results
   */
  protected async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const connection = await this.runtime.getConnection();

      // Handle different database types
      if ('execute' in connection) {
        // PostgreSQL/PGLite - uses execute() method
        const result = await connection.execute(sql, params);
        return result.rows as T[];
      } else if ('all' in connection) {
        // SQLite - uses all() method
        return (await connection.all(sql, params)) as T[];
      } else if ('query' in connection) {
        // Alternative PostgreSQL interface
        const result = await connection.query(sql, params);
        return result.rows as T[];
      } else {
        throw new Error('Unsupported database adapter');
      }
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Execute a single row query
   * @param sql The SQL query to execute
   * @param params Query parameters
   * @returns Single row or null
   */
  protected async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results[0] || null;
  }

  /**
   * Execute an INSERT/UPDATE/DELETE command
   * @param sql The SQL command to execute
   * @param params Command parameters
   * @returns Number of affected rows
   */
  protected async execute(sql: string, params?: any[]): Promise<number> {
    try {
      const connection = await this.runtime.getConnection();

      if ('execute' in connection) {
        // PostgreSQL/PGLite
        const result = await connection.execute(sql, params);
        return result.rowCount || 0;
      } else if ('run' in connection) {
        // SQLite - uses run() method
        const result = await connection.run(sql, params);
        return result.changes || 0;
      } else if ('query' in connection) {
        // Alternative PostgreSQL interface
        const result = await connection.query(sql, params);
        return result.rowCount || 0;
      } else {
        throw new Error('Unsupported database adapter');
      }
    } catch (error) {
      logger.error('Database execute error:', error);
      throw error;
    }
  }

  /**
   * Get the properly formatted table name based on database type
   * PostgreSQL uses schemas, SQLite uses prefixes
   * @param baseTable Base table name without prefix/schema
   * @returns Formatted table name
   */
  protected getTableName(baseTable: string): string {
    // Check the database instance type
    const connection = this.runtime.db;
    const connectionType = connection?.constructor?.name?.toLowerCase() || '';
    const isPostgres =
      connectionType.includes('pg') ||
      connectionType.includes('postgres') ||
      connectionType.includes('pglite');

    if (isPostgres) {
      // PostgreSQL uses schemas for plugin tables
      const schema = this.runtime.getSetting('PLUGIN_TRUST_SCHEMA') || 'plugin_trust';
      return `${schema}.${baseTable}`;
    } else {
      // SQLite and others use table prefixes
      return `trust_${baseTable}`;
    }
  }

  /**
   * Check if we're using PostgreSQL
   * @returns True if PostgreSQL adapter
   */
  protected isPostgreSQL(): boolean {
    const connection = this.runtime.db;
    const connectionType = connection?.constructor?.name?.toLowerCase() || '';
    return (
      connectionType.includes('pg') ||
      connectionType.includes('postgres') ||
      connectionType.includes('pglite')
    );
  }

  /**
   * Format a value for SQL based on type
   * @param value The value to format
   * @returns Formatted SQL value
   */
  protected formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    } else if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    } else if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    } else if (typeof value === 'object') {
      // JSON data
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    }
    return 'NULL';
  }

  /**
   * Generate UUID based on database type
   * @returns Generated UUID
   */
  protected async generateId(): Promise<UUID> {
    if (this.isPostgreSQL()) {
      // Use PostgreSQL's gen_random_uuid()
      const result = await this.queryOne<{ id: UUID }>('SELECT gen_random_uuid() as id');
      return result!.id;
    } else {
      // Use JavaScript UUID generation for SQLite
      const { v4: uuidv4 } = await import('uuid');
      return uuidv4() as UUID;
    }
  }

  /**
   * Get current timestamp in database-appropriate format
   * @returns Timestamp string
   */
  protected getCurrentTimestamp(): string {
    if (this.isPostgreSQL()) {
      return 'NOW()';
    } else {
      // SQLite
      return "datetime('now')";
    }
  }

  /**
   * Build a WHERE clause from conditions
   * @param conditions Key-value pairs of conditions
   * @returns WHERE clause string
   */
  protected buildWhereClause(conditions: Record<string, any>): string {
    const clauses = Object.entries(conditions)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => {
        if (value === null) {
          return `${key} IS NULL`;
        }
        return `${key} = ?`;
      });

    return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  }

  /**
   * Extract parameter values from conditions
   * @param conditions Key-value pairs of conditions
   * @returns Array of parameter values
   */
  protected extractParams(conditions: Record<string, any>): any[] {
    return Object.entries(conditions)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([_, value]) => value);
  }
}
