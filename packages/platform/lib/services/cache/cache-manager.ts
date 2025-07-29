/**
 * Cache Service Manager
 * Automatically chooses between Redis (production) and SQLite (development)
 */

import path from 'path';
import { ICacheService, CacheConfig, CacheConnectionError } from './interface';
import { PGLiteCacheService } from './pglite-cache';
import { RedisCacheService } from './redis-cache';

class CacheManager {
  private static instance: ICacheService | null = null;
  private static config: CacheConfig | null = null;

  static async getInstance(config?: CacheConfig): Promise<ICacheService> {
    if (this.instance && this.config) {
      return this.instance;
    }

    // Auto-detect configuration if not provided
    const finalConfig = config || this.autoDetectConfig();
    this.config = finalConfig;

    try {
      if (finalConfig.type === 'redis') {
        const redisService = new RedisCacheService(
          finalConfig.redis!.url,
          finalConfig.redis,
        );

        // Test connection
        await redisService.connect();
        const isConnected = await redisService.ping();

        if (!isConnected) {
          throw new Error('Redis ping failed');
        }

        this.instance = redisService;
        console.log('[CacheManager] Using Redis cache service');
      } else {
        const dbPath =
          finalConfig.pglite?.database ||
          path.join(process.cwd(), 'data', 'cache.db');

        // Ensure cache directory exists
        const { mkdirSync } = require('fs');
        const { dirname } = require('path');
        mkdirSync(dirname(dbPath), { recursive: true });

        this.instance = new PGLiteCacheService(
          dbPath,
          finalConfig.pglite?.cleanupIntervalMs,
        );

        // Test connection
        const isConnected = await this.instance.ping();
        if (!isConnected) {
          throw new Error('SQLite cache initialization failed');
        }

        console.log('[CacheManager] Using SQLite cache service');
      }

      return this.instance;
    } catch (error) {
      console.error(
        '[CacheManager] Failed to initialize cache service:',
        error,
      );

      // Fallback to SQLite if Redis fails
      if (finalConfig.type === 'redis') {
        console.log('[CacheManager] Falling back to SQLite cache');
        return this.initializeFallbackCache();
      }

      throw new CacheConnectionError(
        'Failed to initialize cache service',
        error as Error,
      );
    }
  }

  private static autoDetectConfig(): CacheConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const redisUrl =
      process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;

    if (isProduction && redisUrl) {
      return {
        type: 'redis',
        redis: {
          url: redisUrl,
          maxRetries: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
        },
      };
    }

    return {
      type: 'pglite',
      pglite: {
        database: path.join(process.cwd(), 'data', 'cache.db'),
        cleanupIntervalMs: 60000, // 1 minute
      },
    };
  }

  private static async initializeFallbackCache(): Promise<ICacheService> {
    const fallbackConfig: CacheConfig = {
      type: 'pglite',
      pglite: {
        database: path.join(process.cwd(), 'data', 'cache-fallback.db'),
        cleanupIntervalMs: 60000,
      },
    };

    const dbPath = fallbackConfig.pglite!.database;

    // Ensure cache directory exists
    const { mkdirSync } = require('fs');
    const { dirname } = require('path');
    mkdirSync(dirname(dbPath), { recursive: true });

    this.instance = new PGLiteCacheService(
      dbPath,
      fallbackConfig.pglite!.cleanupIntervalMs,
    );
    this.config = fallbackConfig;

    return this.instance;
  }

  static async reset(): Promise<void> {
    if (this.instance) {
      try {
        if ('close' in this.instance) {
          (this.instance as PGLiteCacheService).close();
        }
        if ('disconnect' in this.instance) {
          await (this.instance as RedisCacheService).disconnect();
        }
      } catch (error) {
        console.error('[CacheManager] Error closing cache service:', error);
      }
    }

    this.instance = null;
    this.config = null;
  }

  static getConfig(): CacheConfig | null {
    return this.config;
  }

  static isRedis(): boolean {
    return this.config?.type === 'redis';
  }

  static isSQLite(): boolean {
    return this.config?.type === 'pglite';
  }
}

// Convenience functions for direct access
export async function getCache(config?: CacheConfig): Promise<ICacheService> {
  return CacheManager.getInstance(config);
}

export async function resetCache(): Promise<void> {
  return CacheManager.reset();
}

export function getCacheConfig(): CacheConfig | null {
  return CacheManager.getConfig();
}

export function isRedisCache(): boolean {
  return CacheManager.isRedis();
}

export function isSQLiteCache(): boolean {
  return CacheManager.isSQLite();
}

// Export the manager for advanced usage
export { CacheManager };

// Default export for simple usage
export default CacheManager;
