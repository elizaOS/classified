import { logger } from '@elizaos/core';

interface CacheEntry<T> {
  value: T;
  expiry: number;
}

interface CacheOptions {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of entries
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private accessOrder: string[] = [];
  private options: CacheOptions;

  constructor(options: CacheOptions) {
    this.options = options;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const expiryTime = Date.now() + (ttl || this.options.ttl) * 1000;

    // Check cache size limit
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      // Remove least recently used
      const lru = this.accessOrder[0];
      if (lru) {
        this.cache.delete(lru);
        this.removeFromAccessOrder(lru);
      }
    }

    this.cache.set(key, {
      value,
      expiry: expiryTime,
    });

    this.updateAccessOrder(key);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async size(): Promise<number> {
    // Clean up expired entries first
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }

    return this.cache.size;
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  // Batch operations for efficiency
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();

    for (const key of keys) {
      results.set(key, await this.get<T>(key));
    }

    return results;
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of entries) {
      await this.set(key, value, ttl);
    }
  }

  // Cache warming
  async warm<T>(
    keys: string[],
    fetcher: (keys: string[]) => Promise<Map<string, T>>,
    ttl?: number
  ): Promise<void> {
    // Filter out keys already in cache
    const missingKeys: string[] = [];

    for (const key of keys) {
      if (!(await this.has(key))) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length === 0) {
      return;
    }

    try {
      const values = await fetcher(missingKeys);

      for (const [key, value] of values.entries()) {
        await this.set(key, value, ttl);
      }
    } catch (error) {
      logger.error('[CacheManager] Error warming cache:', error);
    }
  }

  // Stats for monitoring
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    avgTTL: number;
  } {
    const now = Date.now();
    let totalTTL = 0;
    let validEntries = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiry > now) {
        totalTTL += (entry.expiry - now) / 1000;
        validEntries++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: 0, // Would need to track hits/misses
      avgTTL: validEntries > 0 ? totalTTL / validEntries : 0,
    };
  }
}
