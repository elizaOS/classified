/**
 * Advanced Cache Manager
 *
 * Provides high-level caching abstractions with multiple cache layers,
 * automatic invalidation, and intelligent cache warming strategies.
 *
 * Uses adapter pattern to support both Redis (production) and Database (local)
 * cache backends with automatic fallback and consistent API.
 */

import { CacheAdapter, CacheOptions, CacheBulkResult } from './adapters/base';
import { RedisCacheAdapter, RedisConfig } from './adapters/redis';
import { DatabaseCacheAdapter } from './adapters/database';
import { logger } from '../logger';

export interface CacheConfig {
  defaultTTL: number;
  maxMemoryEntries: number;
  enableCompression: boolean;
  enableSerialization: boolean;
  invalidationPatterns: string[];
  warmupQueries?: CacheWarmupQuery[];
  adapter: 'redis' | 'database' | 'auto';
  redis?: RedisConfig;
  database?: {
    tableName?: string;
  };
}

export interface CacheWarmupQuery {
  key: string;
  query: () => Promise<any>;
  ttl?: number;
  schedule?: string; // Cron-like schedule
}

export interface CacheEntry<T = any> {
  value: T;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  ttl: number;
  tags: string[];
}

export interface CacheManagerStats {
  adapter: 'redis' | 'database';
  l1: {
    entries: number;
    hits: number;
    requests: number;
    hitRate: number;
  };
  l2: {
    healthy: boolean;
    latency?: number;
    stats: any;
  };
  combined: {
    totalEntries: number;
    hitRate: number;
    memoryUsage: number;
  };
}

export interface CacheLayerConfig {
  name: string;
  enabled: boolean;
  maxSize?: number;
  ttl?: number;
  priority: number;
}

/**
 * Multi-layer Cache Manager
 *
 * Provides L1 (in-memory) + L2 (Redis/Database) caching with intelligent
 * adapter selection based on environment and configuration.
 */
export class CacheManager {
  private static instance: CacheManager;
  private l1Cache = new Map<string, CacheEntry>(); // In-memory L1 cache
  private l2Adapter!: CacheAdapter; // Redis or Database adapter - initialized in initializeAdapter()
  private config: CacheConfig;
  private accessPatterns = new Map<string, number[]>();
  private tagToKeys = new Map<string, Set<string>>();
  private initPromise: Promise<void> | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private warmupTimer: NodeJS.Timeout | null = null;

  static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 3600, // 1 hour
      maxMemoryEntries: 10000,
      enableCompression: true,
      enableSerialization: true,
      invalidationPatterns: [],
      adapter: 'auto',
      ...config,
    };

    this.initPromise = this.initializeAdapter();
    this.startCleanupTimer();
    this.startWarmupScheduler();
  }

  /**
   * Initialize the appropriate cache adapter based on configuration
   */
  private async initializeAdapter(): Promise<void> {
    try {
      const adapterType = this.determineAdapter();

      if (adapterType === 'redis') {
        this.l2Adapter = new RedisCacheAdapter(
          this.config.redis || this.getDefaultRedisConfig(),
          {
            namespace: 'cache',
            defaultTTL: this.config.defaultTTL,
          },
        );
        logger.info('Cache manager initialized with Redis adapter');
      } else {
        this.l2Adapter = new DatabaseCacheAdapter({
          namespace: 'cache',
          defaultTTL: this.config.defaultTTL,
          tableName: this.config.database?.tableName,
        });
        logger.info('Cache manager initialized with Database adapter');
      }

      // Test adapter health
      const health = await this.l2Adapter.healthCheck();
      if (!health.healthy) {
        logger.warn('Cache adapter health check failed', {
          error: health.error,
        });
      }
    } catch (error) {
      logger.error('Failed to initialize cache adapter', error as Error);

      // Fallback to database adapter
      this.l2Adapter = new DatabaseCacheAdapter({
        namespace: 'cache',
        defaultTTL: this.config.defaultTTL,
      });
      logger.info('Fallback to Database adapter due to initialization error');
    }
  }

  /**
   * Determine which adapter to use based on configuration and environment
   */
  private determineAdapter(): 'redis' | 'database' {
    if (this.config.adapter === 'redis') {
      return 'redis';
    }

    if (this.config.adapter === 'database') {
      return 'database';
    }

    // Auto mode: use Redis in production, Database in development
    if (process.env.NODE_ENV === 'production' && process.env.REDIS_URL) {
      return 'redis';
    }

    return 'database';
  }

  /**
   * Get default Redis configuration from environment
   */
  private getDefaultRedisConfig(): RedisConfig {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        password: url.password,
        username: url.username,
        tls: url.protocol === 'rediss:',
        maxRetries: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };
    }

    // Default local Redis configuration
    return {
      host: 'localhost',
      port: 6379,
      maxRetries: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
  }

  /**
   * Ensure adapter is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Get value from cache with fallback strategy
   */
  async get<T = any>(
    key: string,
    fallback?: () => Promise<T>,
    options: CacheOptions & { tags?: string[]; warmup?: boolean } = {},
  ): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Try L1 cache first
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && this.isEntryValid(l1Entry)) {
        this.updateAccessPattern(key);
        l1Entry.accessedAt = Date.now();
        l1Entry.accessCount++;

        logger.debug('Cache hit (L1)', {
          key,
          accessCount: l1Entry.accessCount,
        });
        return l1Entry.value;
      }

      // Try L2 cache (Redis/Database)
      await this.ensureInitialized();
      let value = await this.l2Adapter.get<T>(key, {
        serialize: this.config.enableSerialization,
        compress: this.config.enableCompression,
        ...options,
      });

      if (value !== null) {
        // Store in L1 cache for faster access
        this.setL1Cache(key, value, options);
        this.updateAccessPattern(key);

        logger.debug('Cache hit (L2)', { key });
        return value;
      }

      // Cache miss - use fallback if provided
      if (fallback) {
        logger.debug('Cache miss, executing fallback', { key });
        value = await fallback();

        if (value !== null && value !== undefined) {
          await this.set(key, value, options);
        }

        return value;
      }

      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', error as Error, { key });

      // If cache fails and we have a fallback, use it
      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          logger.error('Fallback execution failed', fallbackError as Error, {
            key,
          });
          return null;
        }
      }

      return null;
    } finally {
      const duration = Date.now() - startTime;
      if (duration > 100) {
        logger.warn('Slow cache operation', { key, duration });
      }
    }
  }

  /**
   * Set value in cache with multi-layer storage
   */
  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions & { tags?: string[]; priority?: number } = {},
  ): Promise<boolean> {
    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const tags = options.tags || [];

      // Store in L2 cache (Redis/Database)
      await this.ensureInitialized();
      const l2Success = await this.l2Adapter.set(key, value, {
        ttl,
        serialize: this.config.enableSerialization,
        compress: this.config.enableCompression,
        tags,
        ...options,
      });

      // Store in L1 cache
      this.setL1Cache(key, value, { ...options, ttl });

      // Update tag mappings
      this.updateTagMappings(key, tags);

      logger.debug('Cache set', { key, ttl, tags, l2Success });
      return l2Success;
    } catch (error) {
      logger.error('Cache set error', error as Error, { key });
      return false;
    }
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<boolean> {
    try {
      // Remove from L1 cache
      this.l1Cache.delete(key);

      // Remove from L2 cache
      await this.ensureInitialized();
      const l2Success = await this.l2Adapter.delete(key);

      // Clean up tag mappings
      this.cleanupTagMappings(key);

      logger.debug('Cache delete', { key, l2Success });
      return l2Success;
    } catch (error) {
      logger.error('Cache delete error', error as Error, { key });
      return false;
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      await this.ensureInitialized();

      // Use adapter's built-in tag invalidation if available
      const l2Deleted = await this.l2Adapter.invalidateByTags([tag]);

      // Also invalidate from L1 cache
      const keys = this.tagToKeys.get(tag);
      let l1Deleted = 0;

      if (keys && keys.size > 0) {
        for (const key of keys) {
          if (this.l1Cache.has(key)) {
            this.l1Cache.delete(key);
            l1Deleted++;
          }
        }
        this.tagToKeys.delete(tag);
      }

      const totalDeleted = l2Deleted + l1Deleted;
      logger.info('Cache invalidation by tag', {
        tag,
        l1Deleted,
        l2Deleted,
        totalDeleted,
      });
      return totalDeleted;
    } catch (error) {
      logger.error('Cache invalidation error', error as Error, { tag });
      return 0;
    }
  }

  /**
   * Invalidate cache entries by multiple tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      await this.ensureInitialized();

      // Use adapter's built-in tag invalidation
      const l2Deleted = await this.l2Adapter.invalidateByTags(tags);

      // Also invalidate from L1 cache
      let l1Deleted = 0;
      for (const tag of tags) {
        const keys = this.tagToKeys.get(tag);
        if (keys && keys.size > 0) {
          for (const key of keys) {
            if (this.l1Cache.has(key)) {
              this.l1Cache.delete(key);
              l1Deleted++;
            }
          }
          this.tagToKeys.delete(tag);
        }
      }

      const totalDeleted = l2Deleted + l1Deleted;
      logger.info('Cache invalidation by tags', {
        tags,
        l1Deleted,
        l2Deleted,
        totalDeleted,
      });
      return totalDeleted;
    } catch (error) {
      logger.error('Cache tags invalidation error', error as Error, { tags });
      return 0;
    }
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const regex = new RegExp(pattern);
      const keysToDelete: string[] = [];

      // Find matching keys in L1 cache
      for (const key of this.l1Cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      let deletedCount = 0;
      for (const key of keysToDelete) {
        const success = await this.delete(key);
        if (success) {
          deletedCount++;
        }
      }

      logger.info('Cache invalidation by pattern', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Cache pattern invalidation error', error as Error, {
        pattern,
      });
      return 0;
    }
  }

  /**
   * Warm up cache with predefined queries
   */
  async warmup(queries: CacheWarmupQuery[] = []): Promise<void> {
    const allQueries = [...(this.config.warmupQueries || []), ...queries];

    logger.info('Starting cache warmup', { queryCount: allQueries.length });

    const promises = allQueries.map(async (query) => {
      try {
        const startTime = Date.now();
        const value = await query.query();

        if (value !== null && value !== undefined) {
          await this.set(query.key, value, { ttl: query.ttl });
          logger.debug('Cache warmup success', {
            key: query.key,
            duration: Date.now() - startTime,
          });
        }
      } catch (error) {
        logger.error('Cache warmup failed', error as Error, { key: query.key });
      }
    });

    await Promise.allSettled(promises);
    logger.info('Cache warmup completed');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheManagerStats> {
    await this.ensureInitialized();

    const l1Stats = this.getL1Stats();
    const l2Health = await this.l2Adapter.healthCheck();
    const l2Stats = this.l2Adapter.getStats();

    const adapterType =
      this.l2Adapter instanceof RedisCacheAdapter ? 'redis' : 'database';

    return {
      adapter: adapterType,
      l1: l1Stats,
      l2: {
        healthy: l2Health.healthy,
        latency: l2Health.latency,
        stats: l2Stats,
      },
      combined: {
        totalEntries: l1Stats.entries + l2Stats.totalKeys,
        hitRate: this.calculateCombinedHitRate(l1Stats, l2Stats),
        memoryUsage: this.getMemoryUsage(),
      },
    };
  }

  /**
   * Calculate combined hit rate from L1 and L2 statistics
   */
  private calculateCombinedHitRate(l1Stats: any, l2Stats: any): number {
    const totalHits = l1Stats.hits + (l2Stats.hits || 0);
    const totalRequests =
      l1Stats.requests + (l2Stats.hits + l2Stats.misses || 0);

    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }

  /**
   * Create cache wrapper for functions
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
      keyGenerator?: (...args: Parameters<T>) => string;
      ttl?: number;
      tags?: string[];
    } = {},
  ): T {
    const keyGenerator =
      options.keyGenerator ||
      ((...args) => `fn:${fn.name}:${JSON.stringify(args)}`);

    return (async (...args: Parameters<T>) => {
      const key = keyGenerator(...args);

      return await this.get(key, () => fn(...args), {
        ttl: options.ttl,
        tags: options.tags,
      });
    }) as T;
  }

  /**
   * Batch get multiple keys
   */
  async mget(keys: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    const missedKeys: string[] = [];

    // Check L1 cache first
    for (const key of keys) {
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && this.isEntryValid(l1Entry)) {
        result.set(key, l1Entry.value);
        l1Entry.accessedAt = Date.now();
        l1Entry.accessCount++;
      } else {
        missedKeys.push(key);
      }
    }

    // Get missed keys from L2 cache
    if (missedKeys.length > 0) {
      await this.ensureInitialized();
      const l2Result = await this.l2Adapter.mget(missedKeys);

      for (const [key, value] of l2Result.found.entries()) {
        result.set(key, value);
        this.setL1Cache(key, value, {});
      }
    }

    return result;
  }

  /**
   * Create cache-aside pattern wrapper
   */
  cacheAside<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions & { tags?: string[] } = {},
  ) {
    return {
      get: () => this.get(key, fetchFn, options),
      set: (value: T) => this.set(key, value, options),
      delete: () => this.delete(key),
      refresh: async () => {
        await this.delete(key);
        return await this.get(key, fetchFn, options);
      },
    };
  }

  /**
   * Store value in L1 cache
   */
  private setL1Cache<T>(
    key: string,
    value: T,
    options: { ttl?: number; tags?: string[] },
  ): void {
    // Evict oldest entries if cache is full
    if (this.l1Cache.size >= this.config.maxMemoryEntries) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
      ttl: (options.ttl || this.config.defaultTTL) * 1000,
      tags: options.tags || [],
    };

    this.l1Cache.set(key, entry);
  }

  /**
   * Check if cache entry is still valid
   */
  private isEntryValid(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt < entry.ttl;
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.l1Cache.entries()) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      this.cleanupTagMappings(oldestKey);
    }
  }

  /**
   * Update access patterns for intelligent prefetching
   */
  private updateAccessPattern(key: string): void {
    const now = Date.now();
    const pattern = this.accessPatterns.get(key) || [];

    pattern.push(now);

    // Keep only last 10 access times
    if (pattern.length > 10) {
      pattern.splice(0, pattern.length - 10);
    }

    this.accessPatterns.set(key, pattern);
  }

  /**
   * Update tag to keys mappings
   */
  private updateTagMappings(key: string, tags: string[]): void {
    for (const tag of tags) {
      const keys = this.tagToKeys.get(tag) || new Set();
      keys.add(key);
      this.tagToKeys.set(tag, keys);
    }
  }

  /**
   * Clean up tag mappings for a key
   */
  private cleanupTagMappings(key: string): void {
    for (const [tag, keys] of this.tagToKeys.entries()) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tagToKeys.delete(tag);
      }
    }
  }

  /**
   * Get L1 cache statistics
   */
  private getL1Stats() {
    let hits = 0;
    let totalAccess = 0;

    for (const entry of this.l1Cache.values()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 1) {
        hits += entry.accessCount - 1;
      }
    }

    return {
      entries: this.l1Cache.size,
      hits,
      requests: totalAccess,
      hitRate: totalAccess > 0 ? (hits / totalAccess) * 100 : 0,
    };
  }

  /**
   * Estimate memory usage
   */
  private getMemoryUsage(): number {
    // Rough estimation - in production, use more accurate measurement
    let size = 0;
    for (const [key, entry] of this.l1Cache.entries()) {
      size += key.length * 2; // Assuming UTF-16
      size += JSON.stringify(entry.value).length * 2;
      size += 200; // Overhead for entry metadata
    }
    return size;
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    // Skip timers in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.l1Cache.entries()) {
        if (!this.isEntryValid(entry)) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        this.l1Cache.delete(key);
        this.cleanupTagMappings(key);
      }

      if (expiredKeys.length > 0) {
        logger.debug('Cleaned up expired cache entries', {
          count: expiredKeys.length,
        });
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Start warmup scheduler
   */
  private startWarmupScheduler(): void {
    // Skip timers in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Simple implementation - in production, use a proper scheduler like node-cron
    this.warmupTimer = setInterval(async () => {
      const warmupQueries = this.config.warmupQueries || [];
      if (warmupQueries.length > 0) {
        await this.warmup(warmupQueries);
      }
    }, 300000); // Warmup every 5 minutes
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    this.accessPatterns.clear();
    this.tagToKeys.clear();

    await this.ensureInitialized();
    await this.l2Adapter.clear();
  }

  /**
   * Close cache manager
   */
  async close(): Promise<void> {
    // Clear timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.warmupTimer) {
      clearInterval(this.warmupTimer);
      this.warmupTimer = null;
    }

    if (this.l2Adapter) {
      await this.l2Adapter.close();
    }

    this.l1Cache.clear();
    this.accessPatterns.clear();
    this.tagToKeys.clear();
  }

  /**
   * Get adapter type for debugging
   */
  getAdapterType(): 'redis' | 'database' | 'unknown' {
    if (!this.l2Adapter) {
      return 'unknown';
    }
    return this.l2Adapter instanceof RedisCacheAdapter ? 'redis' : 'database';
  }

  /**
   * Force refresh of a cache entry
   */
  async refresh<T>(
    key: string,
    fallback: () => Promise<T>,
    options?: CacheOptions & { tags?: string[] },
  ): Promise<T | null> {
    // Remove from both cache layers
    await this.delete(key);

    // Fetch fresh data
    return await this.get(key, fallback, options);
  }

  /**
   * Check if adapter is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const health = await this.l2Adapter.healthCheck();
      return health.healthy;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
