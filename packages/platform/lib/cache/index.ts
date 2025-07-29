/**
 * Cache System Index
 *
 * Unified export for the complete cache system including adapters,
 * managers, configuration, and utilities.
 */

// Core cache system
export { CacheManager } from './cache-manager';
export type {
  CacheConfig,
  CacheWarmupQuery,
  CacheEntry,
  CacheManagerStats,
} from './cache-manager';

// Import for local use
import { CacheManager } from './cache-manager';
import type { CacheOptions } from './adapters/base';
import { cacheManager } from './factory';

// Cache adapters
export { CacheAdapter } from './adapters/base';
export type {
  CacheOptions,
  CacheStats,
  CacheBulkResult,
  CacheEntry as BaseCacheEntry,
} from './adapters/base';

export { RedisCacheAdapter } from './adapters/redis';
export type { RedisConfig } from './adapters/redis';

export { DatabaseCacheAdapter } from './adapters/database';

// Configuration system
export {
  CacheConfigFactory,
  CacheConfigValidator,
  getCacheConfig,
  createCacheConfig,
} from './config';
export type { CacheEnvironmentConfig } from './config';

// Factory and utilities
export {
  CacheManagerFactory,
  CacheDecoratorFactory,
  CacheUtils,
  cacheManager,
  CacheMethod,
  CacheClass,
  CacheProperty,
} from './factory';

// Cache patterns and strategies
export interface CachePattern {
  name: string;
  description: string;
  implementation: (manager: CacheManager) => any;
}

/**
 * Common cache patterns
 */
export const CachePatterns = {
  /**
   * Cache-aside pattern
   */
  cacheAside: <T>(
    manager: CacheManager,
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions & { tags?: string[] },
  ) => manager.cacheAside(key, fetchFn, options),

  /**
   * Write-through pattern
   */
  writeThrough: async <T>(
    manager: CacheManager,
    key: string,
    value: T,
    updateFn: (value: T) => Promise<void>,
    options?: CacheOptions & { tags?: string[] },
  ) => {
    // Update data source first
    await updateFn(value);

    // Then update cache
    await manager.set(key, value, options);

    return value;
  },

  /**
   * Write-behind pattern (async update)
   */
  writeBehind: async <T>(
    manager: CacheManager,
    key: string,
    value: T,
    updateFn: (value: T) => Promise<void>,
    options?: CacheOptions & { tags?: string[] },
  ) => {
    // Update cache immediately
    await manager.set(key, value, options);

    // Schedule async data source update
    setTimeout(async () => {
      try {
        await updateFn(value);
      } catch (error) {
        console.error('Write-behind update failed:', error);
        // Could implement retry logic here
      }
    }, 0);

    return value;
  },

  /**
   * Read-through pattern
   */
  readThrough: <T>(
    manager: CacheManager,
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions & { tags?: string[] },
  ) => manager.get(key, fetchFn, options),

  /**
   * Circuit breaker pattern for cache
   */
  circuitBreaker: <T>(
    manager: CacheManager,
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions & {
      tags?: string[];
      maxFailures?: number;
      resetTimeout?: number;
    },
  ) => {
    let failures = 0;
    let lastFailure = 0;
    const maxFailures = options?.maxFailures || 5;
    const resetTimeout = options?.resetTimeout || 60000; // 1 minute

    return async (): Promise<T | null> => {
      // Check if circuit is open
      const now = Date.now();
      if (failures >= maxFailures && now - lastFailure < resetTimeout) {
        console.warn(`Circuit breaker open for key: ${key}`);
        return null;
      }

      try {
        const result = await manager.get(key, fetchFn, options);

        // Reset failures on success
        if (result !== null) {
          failures = 0;
        }

        return result;
      } catch (error) {
        failures++;
        lastFailure = now;
        throw error;
      }
    };
  },
};

/**
 * Cache middleware for Express-like frameworks
 */
export const createCacheMiddleware = (manager: CacheManager) => {
  return (
    options: {
      keyGenerator?: (req: any) => string;
      ttl?: number;
      tags?: string[];
      condition?: (req: any) => boolean;
    } = {},
  ) => {
    return async (req: any, res: any, next: any) => {
      // Skip caching if condition is false
      if (options.condition && !options.condition(req)) {
        return next();
      }

      const key = options.keyGenerator
        ? options.keyGenerator(req)
        : `route:${req.method}:${req.url}`;

      try {
        // Try to get cached response
        const cached = await manager.get(key);

        if (cached) {
          return res.json(cached);
        }

        // Intercept response to cache it
        const originalJson = res.json;
        res.json = function (data: any) {
          // Cache the response
          manager
            .set(key, data, {
              ttl: options.ttl,
              tags: options.tags,
            })
            .catch((error) => {
              console.error('Failed to cache response:', error);
            });

          return originalJson.call(this, data);
        };

        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  };
};

/**
 * Cache health check utility
 */
export const createCacheHealthCheck = (manager: CacheManager) => {
  return async () => {
    try {
      const stats = await manager.getStats();
      const isHealthy = await manager.isHealthy();

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        adapter: manager.getAdapterType(),
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  };
};

/**
 * Default cache manager instance (singleton)
 */
export default cacheManager;
