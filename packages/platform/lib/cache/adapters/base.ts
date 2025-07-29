/**
 * Base Cache Adapter Interface
 *
 * Defines the contract that all cache adapters must implement,
 * ensuring consistent behavior across different storage backends.
 */

export interface CacheEntry {
  key: string;
  value: any;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for bulk invalidation
  compress?: boolean; // Whether to compress large values
  serialize?: boolean; // Whether to serialize/deserialize JSON
  namespace?: string; // Cache namespace for isolation
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage?: number;
}

export interface CacheBulkResult<T = any> {
  found: Map<string, T>;
  missing: string[];
}

/**
 * Abstract base class for cache adapters
 */
export abstract class CacheAdapter {
  protected namespace: string;
  protected defaultTTL: number;
  protected stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
    totalKeys: 0,
  };

  constructor(
    options: {
      namespace?: string;
      defaultTTL?: number;
    } = {},
  ) {
    this.namespace = options.namespace || 'cache';
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour default
  }

  /**
   * Get a value from cache
   */
  abstract get<T = any>(key: string, options?: CacheOptions): Promise<T | null>;

  /**
   * Set a value in cache
   */
  abstract set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<boolean>;

  /**
   * Delete a value from cache
   */
  abstract delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists in cache
   */
  abstract exists(key: string): Promise<boolean>;

  /**
   * Set expiration for a key
   */
  abstract expire(key: string, seconds: number): Promise<boolean>;

  /**
   * Increment a numeric value
   */
  abstract increment(key: string, by?: number): Promise<number>;

  /**
   * Decrement a numeric value
   */
  abstract decrement(key: string, by?: number): Promise<number>;

  /**
   * Get multiple keys at once
   */
  abstract mget<T = any>(keys: string[]): Promise<CacheBulkResult<T>>;

  /**
   * Set multiple keys at once
   */
  abstract mset(
    entries: Array<{ key: string; value: any; options?: CacheOptions }>,
  ): Promise<number>;

  /**
   * Delete multiple keys at once
   */
  abstract mdel(keys: string[]): Promise<number>;

  /**
   * Get all keys matching a pattern
   */
  abstract keys(pattern: string): Promise<string[]>;

  /**
   * Invalidate cache entries by tags
   */
  abstract invalidateByTags(tags: string[]): Promise<number>;

  /**
   * Clear all cache entries
   */
  abstract clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
      totalKeys: 0,
    };
  }

  /**
   * Health check for the cache adapter
   */
  abstract healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }>;

  /**
   * Close connections and cleanup resources
   */
  abstract close(): Promise<void>;

  /**
   * Generate namespaced key
   */
  protected buildKey(key: string, namespace?: string): string {
    const ns = namespace || this.namespace;
    return `${ns}:${key}`;
  }

  /**
   * Serialize value for storage
   */
  protected serialize(value: any, options?: CacheOptions): string {
    if (options?.serialize === false) {
      return typeof value === 'string' ? value : String(value);
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  }

  /**
   * Deserialize value from storage
   */
  protected deserialize<T = any>(value: string, options?: CacheOptions): T {
    if (options?.serialize === false) {
      return value as T;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  /**
   * Calculate TTL in seconds
   */
  protected calculateTTL(options?: CacheOptions): number {
    return options?.ttl || this.defaultTTL;
  }

  /**
   * Calculate expiration timestamp
   */
  protected calculateExpiration(options?: CacheOptions): Date {
    const ttl = this.calculateTTL(options);
    return new Date(Date.now() + ttl * 1000);
  }

  /**
   * Check if entry is expired
   */
  protected isExpired(expiresAt: Date): boolean {
    return expiresAt < new Date();
  }

  /**
   * Update statistics
   */
  protected updateStats(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'error',
  ): void {
    this.stats[
      operation === 'hit'
        ? 'hits'
        : operation === 'miss'
          ? 'misses'
          : operation === 'set'
            ? 'sets'
            : operation === 'delete'
              ? 'deletes'
              : 'errors'
    ]++;
  }

  /**
   * Compress data if needed (basic implementation)
   */
  protected async compress(data: string): Promise<string> {
    // Simple base64 encoding for basic compression
    // In production, you might want to use actual compression like gzip
    if (data.length > 1024) {
      // Only compress if > 1KB
      return `compressed:${Buffer.from(data).toString('base64')}`;
    }
    return data;
  }

  /**
   * Decompress data if needed
   */
  protected async decompress(data: string): Promise<string> {
    if (data.startsWith('compressed:')) {
      try {
        return Buffer.from(data.slice(11), 'base64').toString('utf-8');
      } catch {
        return data; // Return as-is if decompression fails
      }
    }
    return data;
  }

  /**
   * Validate cache key
   */
  protected validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Cache key must be a non-empty string');
    }
    if (key.length > 250) {
      throw new Error('Cache key too long (max 250 characters)');
    }
    if (key.includes('\n') || key.includes('\r')) {
      throw new Error('Cache key cannot contain newlines');
    }
  }

  /**
   * Validate cache value
   */
  protected validateValue(value: any): void {
    if (value === undefined) {
      throw new Error('Cache value cannot be undefined');
    }
  }
}
