/**
 * SQLite Cache Implementation
 * Simple local caching using SQLite for development
 */

import { Database } from 'better-sqlite3';
import { ICacheService, CacheError, CacheConnectionError } from './interface';

interface CacheEntry {
  key: string;
  value: string;
  expires_at: number | null;
  created_at: number;
}

export class SQLiteCacheService implements ICacheService {
  private db: Database;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(databasePath: string, cleanupIntervalMs: number = 60000) {
    try {
      this.db = new (require('better-sqlite3'))(databasePath);
      this.initializeSchema();
      this.startCleanup(cleanupIntervalMs);
    } catch (error) {
      throw new CacheConnectionError(
        'Failed to initialize SQLite cache',
        error as Error,
      );
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache_entries(expires_at);
      CREATE INDEX IF NOT EXISTS idx_cache_created_at ON cache_entries(created_at);
    `);
  }

  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error);
    }, intervalMs);
  }

  private isExpired(expiresAt: number | null): boolean {
    return expiresAt !== null && expiresAt < Date.now();
  }

  async get(key: string): Promise<string | null> {
    try {
      const stmt = this.db.prepare(
        'SELECT value, expires_at FROM cache_entries WHERE key = ?',
      );
      const row = stmt.get(key) as
        | { value: string; expires_at: number | null }
        | undefined;

      if (!row) {
        return null;
      }
      if (this.isExpired(row.expires_at)) {
        await this.del(key);
        return null;
      }

      return row.value;
    } catch (error) {
      throw new CacheError(`Failed to get key ${key}`, error as Error);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cache_entries (key, value, expires_at, created_at)
        VALUES (?, ?, ?, unixepoch())
      `);
      stmt.run(key, value, expiresAt);
    } catch (error) {
      throw new CacheError(`Failed to set key ${key}`, error as Error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const stmt = this.db.prepare('DELETE FROM cache_entries WHERE key = ?');
      stmt.run(key);
    } catch (error) {
      throw new CacheError(`Failed to delete key ${key}`, error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch (error) {
      throw new CacheError(
        `Failed to check existence of key ${key}`,
        error as Error,
      );
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const current = await this.get(key);
      const newValue = current ? parseInt(current, 10) + 1 : 1;
      await this.set(key, newValue.toString(), ttlSeconds);
      return newValue;
    } catch (error) {
      throw new CacheError(`Failed to increment key ${key}`, error as Error);
    }
  }

  async decrement(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const current = await this.get(key);
      const newValue = current ? Math.max(0, parseInt(current, 10) - 1) : 0;
      await this.set(key, newValue.toString(), ttlSeconds);
      return newValue;
    } catch (error) {
      throw new CacheError(`Failed to decrement key ${key}`, error as Error);
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = [];
    for (const key of keys) {
      results.push(await this.get(key));
    }
    return results;
  }

  async mset(
    entries: Array<{ key: string; value: string; ttl?: number }>,
  ): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async hget(hash: string, field: string): Promise<string | null> {
    return this.get(`${hash}:${field}`);
  }

  async hset(
    hash: string,
    field: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.set(`${hash}:${field}`, value, ttlSeconds);
  }

  async hgetall(hash: string): Promise<Record<string, string>> {
    try {
      const pattern = `${hash}:*`;
      const keys = await this.keys(pattern);
      const result: Record<string, string> = {};

      for (const key of keys) {
        const field = key.substring(hash.length + 1);
        const value = await this.get(key);
        if (value !== null) {
          result[field] = value;
        }
      }

      return result;
    } catch (error) {
      throw new CacheError(`Failed to get hash ${hash}`, error as Error);
    }
  }

  async lpush(list: string, ...values: string[]): Promise<number> {
    try {
      // Simple list implementation using JSON array
      const current = await this.get(list);
      const array = current ? JSON.parse(current) : [];
      array.unshift(...values);
      await this.set(list, JSON.stringify(array));
      return array.length;
    } catch (error) {
      throw new CacheError(`Failed to lpush to list ${list}`, error as Error);
    }
  }

  async rpop(list: string): Promise<string | null> {
    try {
      const current = await this.get(list);
      if (!current) {
        return null;
      }

      const array = JSON.parse(current);
      if (array.length === 0) {
        return null;
      }

      const value = array.pop();
      await this.set(list, JSON.stringify(array));
      return value;
    } catch (error) {
      throw new CacheError(`Failed to rpop from list ${list}`, error as Error);
    }
  }

  async llen(list: string): Promise<number> {
    try {
      const current = await this.get(list);
      if (!current) {
        return 0;
      }
      const array = JSON.parse(current);
      return array.length;
    } catch (error) {
      throw new CacheError(
        `Failed to get length of list ${list}`,
        error as Error,
      );
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      const current = await this.get(key);
      if (current !== null) {
        await this.set(key, current, seconds);
      }
    } catch (error) {
      throw new CacheError(
        `Failed to set expiration for key ${key}`,
        error as Error,
      );
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const stmt = this.db.prepare(
        'SELECT expires_at FROM cache_entries WHERE key = ?',
      );
      const row = stmt.get(key) as { expires_at: number | null } | undefined;

      if (!row) {
        return -2;
      } // Key doesn't exist
      if (row.expires_at === null) {
        return -1;
      } // Key exists but has no TTL

      const remaining = Math.max(
        0,
        Math.floor((row.expires_at - Date.now()) / 1000),
      );
      return remaining > 0 ? remaining : -2; // Key expired
    } catch (error) {
      throw new CacheError(`Failed to get TTL for key ${key}`, error as Error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      // Simple pattern matching (only supports * wildcard)
      const sqlPattern = pattern.replace(/\*/g, '%');
      const stmt = this.db.prepare(
        'SELECT key FROM cache_entries WHERE key LIKE ?',
      );
      const rows = stmt.all(sqlPattern) as { key: string }[];

      // Filter out expired keys
      const validKeys: string[] = [];
      for (const row of rows) {
        const value = await this.get(row.key);
        if (value !== null) {
          validKeys.push(row.key);
        }
      }

      return validKeys;
    } catch (error) {
      throw new CacheError(
        `Failed to get keys with pattern ${pattern}`,
        error as Error,
      );
    }
  }

  async scan(
    cursor: string,
    pattern?: string,
    count?: number,
  ): Promise<{ cursor: string; keys: string[] }> {
    // Simple implementation - SQLite doesn't need real cursor scanning
    const keys = pattern ? await this.keys(pattern) : await this.keys('*');
    const limit = count || 10;
    const offset = parseInt(cursor, 10) || 0;

    const slice = keys.slice(offset, offset + limit);
    const nextCursor =
      offset + limit >= keys.length ? '0' : (offset + limit).toString();

    return { cursor: nextCursor, keys: slice };
  }

  async flushall(): Promise<void> {
    try {
      this.db.exec('DELETE FROM cache_entries');
    } catch (error) {
      throw new CacheError('Failed to flush all cache entries', error as Error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      const stmt = this.db.prepare(
        'DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < unixepoch()',
      );
      const result = stmt.run();

      if (process.env.NODE_ENV === 'development' && result.changes > 0) {
        console.log(
          `[SQLiteCache] Cleaned up ${result.changes} expired entries`,
        );
      }
    } catch (error) {
      throw new CacheError('Failed to cleanup expired entries', error as Error);
    }
  }

  async ping(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  async info(): Promise<{
    type: string;
    connected: boolean;
    memory?: string;
    version?: string;
  }> {
    try {
      const stmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM cache_entries',
      );
      const result = stmt.get() as { count: number };

      return {
        type: 'pglite',
        connected: true,
        memory: `${result.count} entries`,
        version: 'better-sqlite3',
      };
    } catch (error) {
      return {
        type: 'pglite',
        connected: false,
      };
    }
  }

  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.db.close();
  }
}
