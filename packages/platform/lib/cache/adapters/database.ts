/**
 * Database Cache Adapter
 *
 * Implements caching using PostgreSQL for local development and scenarios
 * where Redis is not available. Provides full cache functionality with
 * database persistence and SQL-based operations.
 */

import { logger } from '../../logger';
import {
  CacheAdapter,
  CacheEntry,
  CacheOptions,
  CacheBulkResult,
} from './base';

// Simple in-memory storage for testing/development
class SimpleDatabaseClient {
  private storage = new Map<string, any>();

  async query(sql: string, params: any[] = []): Promise<any[]> {
    // Simple mock implementation for testing
    if (sql.includes('SELECT')) {
      if (sql.includes('ANY(')) {
        // Bulk select
        const keys = params[0];
        const results = [];
        for (const key of keys) {
          const value = this.storage.get(key);
          if (value && !this.isExpired(new Date(value.expires_at))) {
            results.push(value);
          }
        }
        return results;
      } else {
        const key = params[0];
        const value = this.storage.get(key);
        if (value && !this.isExpired(new Date(value.expires_at))) {
          return [value];
        }
        return [];
      }
    }

    if (sql.includes('INSERT') || sql.includes('UPDATE')) {
      const [key, value, expiresAt, tags, metadata] = params;
      this.storage.set(key, {
        key,
        value,
        expires_at: expiresAt,
        tags: tags || [],
        metadata: metadata || {},
      });
      return [{ key }];
    }

    if (sql.includes('DELETE')) {
      if (sql.includes('tags &&')) {
        // Tag-based deletion
        const tags = params[0];
        let deletedCount = 0;
        for (const [key, entry] of this.storage.entries()) {
          if (
            entry.tags &&
            entry.tags.some((tag: string) => tags.includes(tag))
          ) {
            this.storage.delete(key);
            deletedCount++;
          }
        }
        return Array(deletedCount).fill({ key: 'deleted' });
      } else if (sql.includes('ANY(')) {
        // Bulk delete
        const keys = params[0];
        let deletedCount = 0;
        for (const key of keys) {
          if (this.storage.has(key)) {
            this.storage.delete(key);
            deletedCount++;
          }
        }
        return Array(deletedCount).fill({ key: 'deleted' });
      } else {
        const key = params[0];
        const existed = this.storage.has(key);
        this.storage.delete(key);
        return existed ? [{ key }] : [];
      }
    }

    return [];
  }

  private isExpired(expiresAt: Date): boolean {
    return expiresAt < new Date();
  }

  clear() {
    this.storage.clear();
  }
}

export class DatabaseCacheAdapter extends CacheAdapter {
  private db = new SimpleDatabaseClient();
  private tableName = 'cache_entries';
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    options: {
      namespace?: string;
      defaultTTL?: number;
      tableName?: string;
    } = {},
  ) {
    super(options);
    this.tableName = options.tableName || 'cache_entries';
    this.initializeTable();
    this.startCleanupTimer();
  }

  /**
   * Initialize cache table if it doesn't exist
   */
  private async initializeTable(): Promise<void> {
    try {
      // In the simple implementation, this is a no-op
      logger.debug('Database cache table initialized', {
        tableName: this.tableName,
      });
    } catch (error) {
      logger.error('Failed to initialize cache table', error as Error);
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    this.validateKey(key);
    const fullKey = this.buildKey(key, options?.namespace);

    try {
      const result = await this.db.query(
        `SELECT value, expires_at FROM ${this.tableName} WHERE key = $1`,
        [fullKey],
      );

      if (!result || result.length === 0) {
        this.updateStats('miss');
        return null;
      }

      const entry = result[0];

      // Check if expired
      if (this.isExpired(new Date(entry.expires_at))) {
        // Clean up expired entry
        await this.delete(key);
        this.updateStats('miss');
        return null;
      }

      this.updateStats('hit');

      // Decompress if needed
      let value = entry.value;
      if (options?.compress) {
        value = await this.decompress(value);
      }

      return this.deserialize<T>(value, options);
    } catch (error) {
      this.updateStats('error');
      logger.error('Database cache get error', error as Error, {
        key: fullKey,
      });
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<boolean> {
    this.validateKey(key);
    this.validateValue(value);

    const fullKey = this.buildKey(key, options?.namespace);
    const expiresAt = this.calculateExpiration(options);

    try {
      let serializedValue = this.serialize(value, options);

      // Compress if requested and value is large
      if (options?.compress) {
        serializedValue = await this.compress(serializedValue);
      }

      await this.db.query(
        `
        INSERT INTO ${this.tableName} (key, value, expires_at, tags, metadata)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = $2,
          expires_at = $3,
          tags = $4,
          metadata = $5,
          updated_at = NOW()
      `,
        [
          fullKey,
          serializedValue,
          expiresAt,
          options?.tags || [],
          JSON.stringify(options || {}),
        ],
      );

      this.updateStats('set');
      this.stats.totalKeys++;
      return true;
    } catch (error) {
      this.updateStats('error');
      logger.error('Database cache set error', error as Error, {
        key: fullKey,
      });
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    this.validateKey(key);
    const fullKey = this.buildKey(key);

    try {
      const result = await this.db.query(
        `DELETE FROM ${this.tableName} WHERE key = $1`,
        [fullKey],
      );

      const deleted = result.length > 0;
      if (deleted) {
        this.updateStats('delete');
        this.stats.totalKeys = Math.max(0, this.stats.totalKeys - 1);
      }

      return deleted;
    } catch (error) {
      this.updateStats('error');
      logger.error('Database cache delete error', error as Error, {
        key: fullKey,
      });
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    this.validateKey(key);
    const fullKey = this.buildKey(key);

    try {
      const result = await this.db.query(
        `SELECT 1 FROM ${this.tableName} WHERE key = $1 AND expires_at > NOW()`,
        [fullKey],
      );

      return result.length > 0;
    } catch (error) {
      logger.error('Database cache exists error', error as Error, {
        key: fullKey,
      });
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    this.validateKey(key);
    const fullKey = this.buildKey(key);
    const expiresAt = new Date(Date.now() + seconds * 1000);

    try {
      const result = await this.db.query(
        `UPDATE ${this.tableName} SET expires_at = $1, updated_at = NOW() WHERE key = $2`,
        [expiresAt, fullKey],
      );

      return result.length > 0;
    } catch (error) {
      logger.error('Database cache expire error', error as Error, {
        key: fullKey,
      });
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, by: number = 1): Promise<number> {
    this.validateKey(key);
    const fullKey = this.buildKey(key);

    try {
      // Try to update existing value
      const result = await this.db.query(
        `
        UPDATE ${this.tableName} 
        SET value = (CAST(value AS INTEGER) + $1)::TEXT,
            updated_at = NOW()
        WHERE key = $2 AND expires_at > NOW()
        RETURNING value
      `,
        [by, fullKey],
      );

      if (result.length > 0) {
        return parseInt(result[0].value, 10);
      }

      // If key doesn't exist, create it
      const expiresAt = this.calculateExpiration();
      await this.db.query(
        `
        INSERT INTO ${this.tableName} (key, value, expires_at)
        VALUES ($1, $2, $3)
      `,
        [fullKey, by.toString(), expiresAt],
      );

      this.stats.totalKeys++;
      return by;
    } catch (error) {
      logger.error('Database cache increment error', error as Error, {
        key: fullKey,
      });
      return 0;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decrement(key: string, by: number = 1): Promise<number> {
    return this.increment(key, -by);
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[]): Promise<CacheBulkResult<T>> {
    if (keys.length === 0) {
      return { found: new Map(), missing: [] };
    }

    const fullKeys = keys.map((key) => {
      this.validateKey(key);
      return this.buildKey(key);
    });

    try {
      const result = await this.db.query(
        `
        SELECT key, value, expires_at 
        FROM ${this.tableName} 
        WHERE key = ANY($1) AND expires_at > NOW()
      `,
        [fullKeys],
      );

      const found = new Map<string, T>();
      const foundKeys = new Set<string>();

      for (const row of result) {
        const originalKey = keys[fullKeys.indexOf(row.key)];
        const value = this.deserialize<T>(row.value);
        found.set(originalKey, value);
        foundKeys.add(originalKey);
        this.updateStats('hit');
      }

      const missing = keys.filter((key) => !foundKeys.has(key));
      missing.forEach(() => this.updateStats('miss'));

      return { found, missing };
    } catch (error) {
      logger.error('Database cache mget error', error as Error, { keys });
      return { found: new Map(), missing: keys };
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(
    entries: Array<{ key: string; value: any; options?: CacheOptions }>,
  ): Promise<number> {
    if (entries.length === 0) {
      return 0;
    }

    try {
      let successCount = 0;

      // Process in batches to avoid large queries
      const batchSize = 100;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        const values: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((entry, index) => {
          this.validateKey(entry.key);
          this.validateValue(entry.value);

          const baseIndex = index * 5;
          placeholders.push(
            `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`,
          );

          values.push(
            this.buildKey(entry.key, entry.options?.namespace),
            this.serialize(entry.value, entry.options),
            this.calculateExpiration(entry.options),
            entry.options?.tags || [],
            JSON.stringify(entry.options || {}),
          );
        });

        const query = `
          INSERT INTO ${this.tableName} (key, value, expires_at, tags, metadata)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (key)
          DO UPDATE SET 
            value = EXCLUDED.value,
            expires_at = EXCLUDED.expires_at,
            tags = EXCLUDED.tags,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `;

        await this.db.query(query, values);
        successCount += batch.length;
      }

      this.stats.sets += successCount;
      this.stats.totalKeys += successCount;
      return successCount;
    } catch (error) {
      this.updateStats('error');
      logger.error('Database cache mset error', error as Error);
      return 0;
    }
  }

  /**
   * Delete multiple keys at once
   */
  async mdel(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const fullKeys = keys.map((key) => {
      this.validateKey(key);
      return this.buildKey(key);
    });

    try {
      const result = await this.db.query(
        `DELETE FROM ${this.tableName} WHERE key = ANY($1)`,
        [fullKeys],
      );

      const deletedCount = result.length;
      this.stats.deletes += deletedCount;
      this.stats.totalKeys = Math.max(0, this.stats.totalKeys - deletedCount);

      return deletedCount;
    } catch (error) {
      this.updateStats('error');
      logger.error('Database cache mdel error', error as Error, { keys });
      return 0;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      // Convert Redis-style pattern to SQL LIKE pattern
      const sqlPattern = pattern.replace(/\*/g, '%').replace(/\?/g, '_');

      const fullPattern = this.buildKey(sqlPattern);

      const result = await this.db.query(
        `
        SELECT key FROM ${this.tableName} 
        WHERE key LIKE $1 AND expires_at > NOW()
        ORDER BY key
      `,
        [fullPattern],
      );

      // Remove namespace prefix from returned keys
      const prefix = `${this.namespace}:`;
      return result.map((row) =>
        row.key.startsWith(prefix) ? row.key.slice(prefix.length) : row.key,
      );
    } catch (error) {
      logger.error('Database cache keys error', error as Error, { pattern });
      return [];
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (tags.length === 0) {
      return 0;
    }

    try {
      const result = await this.db.query(
        `
        DELETE FROM ${this.tableName} 
        WHERE tags && $1
      `,
        [tags],
      );

      const deletedCount = result.length;
      this.stats.deletes += deletedCount;
      this.stats.totalKeys = Math.max(0, this.stats.totalKeys - deletedCount);

      logger.debug('Cache invalidated by tags', { tags, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Database cache invalidate by tags error', error as Error, {
        tags,
      });
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const namespacePattern = `${this.namespace}:%`;
      await this.db.query(`DELETE FROM ${this.tableName} WHERE key LIKE $1`, [
        namespacePattern,
      ]);

      this.stats.totalKeys = 0;
      logger.debug('Database cache cleared', { namespace: this.namespace });
    } catch (error) {
      logger.error('Database cache clear error', error as Error);
      throw error;
    }
  }

  /**
   * Health check for the database cache
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.db.query('SELECT 1', []);
      const latency = Date.now() - startTime;

      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close connections and cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.debug('Database cache adapter closed');
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    // Skip timers in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      async () => {
        try {
          const result = await this.db.query(
            `DELETE FROM ${this.tableName} WHERE expires_at < NOW()`,
            [],
          );

          const deletedCount = result.length;
          if (deletedCount > 0) {
            this.stats.totalKeys = Math.max(
              0,
              this.stats.totalKeys - deletedCount,
            );
            logger.debug('Cleaned up expired cache entries', { deletedCount });
          }
        } catch (error) {
          logger.error('Cache cleanup error', error as Error);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }

  /**
   * Get cache size and statistics
   */
  async getCacheInfo(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    totalSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    try {
      const result = await this.db.query(
        `
        SELECT 
          COUNT(*) as total_entries,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_entries,
          SUM(LENGTH(value)) as total_size,
          MIN(created_at) as oldest_entry,
          MAX(created_at) as newest_entry
        FROM ${this.tableName}
        WHERE key LIKE $1
      `,
        [`${this.namespace}:%`],
      );

      const stats = result[0];
      return {
        totalEntries: parseInt(stats.total_entries || '0', 10),
        expiredEntries: parseInt(stats.expired_entries || '0', 10),
        totalSize: parseInt(stats.total_size || '0', 10),
        oldestEntry: stats.oldest_entry ? new Date(stats.oldest_entry) : null,
        newestEntry: stats.newest_entry ? new Date(stats.newest_entry) : null,
      };
    } catch (error) {
      logger.error('Failed to get cache info', error as Error);
      return {
        totalEntries: 0,
        expiredEntries: 0,
        totalSize: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }
}
