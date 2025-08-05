/**
 * Database Service
 * Handles database operations, table management, and statistics
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';

export class DatabaseService extends BaseTauriService {
  // Database table operations
  public async fetchDatabaseTables(): Promise<string[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_database_tables');
      if (Array.isArray(response)) {
        return response as string[];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch database tables:', error);
      return [];
    }
  }

  public async fetchDatabaseTableData(
    tableName: string,
    limit?: number,
    offset?: number
  ): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_database_table_data', {
        tableName,
        limit: limit || 100,
        offset: offset || 0,
      });

      if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
      }

      return [];
    } catch (error) {
      console.error(`Failed to fetch data from table ${tableName}:`, error);
      return [];
    }
  }

  public async fetchDatabaseStats(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_database_stats');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
      return {};
    }
  }

  // Query execution (if needed)
  public async executeQuery(
    query: string,
    params?: Record<string, unknown>
  ): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('execute_database_query', {
        query,
        params: params || {},
      });

      if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
      }

      return [];
    } catch (error) {
      console.error('Failed to execute database query:', error);
      return [];
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
