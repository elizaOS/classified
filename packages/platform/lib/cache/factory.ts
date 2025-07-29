/**
 * Cache Factory Module
 *
 * Provides factory functions for creating cache manager instances
 * with appropriate adapters based on environment and configuration.
 */

import { CacheManager } from './cache-manager';
import { getCacheConfig, createCacheConfig } from './config';
import { logger } from '../logger';

/**
 * Cache manager factory
 */
export class CacheManagerFactory {
  private static instance: CacheManager | null = null;
  private static initialized = false;

  /**
   * Get or create the singleton cache manager instance
   */
  static getInstance(): CacheManager {
    if (!this.instance) {
      this.instance = this.createInstance();
    }
    return this.instance;
  }

  /**
   * Create a new cache manager instance with default configuration
   */
  static createInstance(): CacheManager {
    try {
      const config = getCacheConfig();
      logger.info('Creating cache manager', {
        adapter: config.adapter,
        defaultTTL: config.defaultTTL,
        maxMemoryEntries: config.maxMemoryEntries,
      });

      return new CacheManager(config);
    } catch (error) {
      logger.error('Failed to create cache manager', error as Error);

      // Fallback to basic database configuration
      const fallbackConfig = createCacheConfig({
        adapter: 'database',
        defaultTTL: 3600,
        maxMemoryEntries: 1000,
        enableCompression: false,
        enableSerialization: true,
        invalidationPatterns: [],
      });

      logger.warn('Using fallback cache configuration', fallbackConfig);
      return new CacheManager(fallbackConfig);
    }
  }

  /**
   * Create a cache manager with custom configuration
   */
  static createWithConfig(
    config: Parameters<typeof createCacheConfig>[0],
  ): CacheManager {
    const cacheConfig = createCacheConfig(config);
    return new CacheManager(cacheConfig);
  }

  /**
   * Create a development-optimized cache manager
   */
  static createForDevelopment(): CacheManager {
    return this.createWithConfig({
      adapter: 'database',
      defaultTTL: 300, // 5 minutes
      maxMemoryEntries: 1000,
      enableCompression: false,
      enableSerialization: true,
      invalidationPatterns: [],
    });
  }

  /**
   * Create a production-optimized cache manager
   */
  static createForProduction(): CacheManager {
    return this.createWithConfig({
      adapter: process.env.REDIS_URL ? 'redis' : 'database',
      defaultTTL: 3600, // 1 hour
      maxMemoryEntries: 50000,
      enableCompression: true,
      enableSerialization: true,
      invalidationPatterns: ['user:*', 'session:*'],
    });
  }

  /**
   * Create a test-optimized cache manager
   */
  static createForTesting(): CacheManager {
    return this.createWithConfig({
      adapter: 'database',
      defaultTTL: 60, // 1 minute
      maxMemoryEntries: 100,
      enableCompression: false,
      enableSerialization: true,
      invalidationPatterns: [],
      database: {
        tableName: 'cache_entries_test',
      },
    });
  }

  /**
   * Initialize the singleton instance with health check
   */
  static async initialize(): Promise<CacheManager> {
    if (this.initialized) {
      return this.getInstance();
    }

    const manager = this.getInstance();

    try {
      // Perform health check
      const isHealthy = await manager.isHealthy();

      if (!isHealthy) {
        logger.warn(
          'Cache manager health check failed, but continuing with initialization',
        );
      } else {
        logger.info('Cache manager initialized successfully', {
          adapter: manager.getAdapterType(),
        });
      }

      this.initialized = true;
      return manager;
    } catch (error) {
      logger.error('Cache manager initialization failed', error as Error);
      throw error;
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
    this.initialized = false;
  }

  /**
   * Get cache manager statistics
   */
  static async getStats() {
    if (!this.instance) {
      return null;
    }

    return await this.instance.getStats();
  }
}

/**
 * Cache decorator factory
 */
export class CacheDecoratorFactory {
  private static manager: CacheManager | null = null;

  /**
   * Get cache manager for decorators
   */
  private static getManager(): CacheManager {
    if (!this.manager) {
      this.manager = CacheManagerFactory.getInstance();
    }
    return this.manager;
  }

  /**
   * Create a method cache decorator
   */
  static method(
    options: {
      ttl?: number;
      keyGenerator?: (...args: any[]) => string;
      tags?: string[];
      namespace?: string;
    } = {},
  ) {
    return function <T extends (...args: any[]) => Promise<any>>(
      target: any,
      propertyName: string,
      descriptor: TypedPropertyDescriptor<T>,
    ) {
      const originalMethod = descriptor.value!;
      const manager = CacheDecoratorFactory.getManager();

      descriptor.value = manager.wrap(originalMethod, {
        keyGenerator:
          options.keyGenerator ||
          ((...args) =>
            `${options.namespace || 'method'}:${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`),
        ttl: options.ttl,
        tags: options.tags,
      }) as T;

      return descriptor;
    };
  }

  /**
   * Create a class-level cache decorator
   */
  static class(
    options: {
      namespace?: string;
      defaultTTL?: number;
      tags?: string[];
    } = {},
  ) {
    return function <T extends { new (...args: any[]): {} }>(constructor: T) {
      const manager = CacheDecoratorFactory.getManager();
      const namespace = options.namespace || constructor.name.toLowerCase();

      return class extends constructor {
        cache = manager.cacheAside.bind(manager);
        cacheNamespace = namespace;
        cacheDefaultTTL = options.defaultTTL || 3600;
        cacheTags = options.tags || [];
      };
    };
  }

  /**
   * Create a property cache decorator
   */
  static property(
    options: {
      ttl?: number;
      tags?: string[];
      lazy?: boolean;
    } = {},
  ) {
    return function (target: any, propertyName: string) {
      const manager = CacheDecoratorFactory.getManager();
      const key = `prop:${target.constructor.name}:${propertyName}`;

      if (options.lazy) {
        // Lazy loading - cache on first access
        Object.defineProperty(target, propertyName, {
          async get() {
            return await manager.get(key);
          },
          async set(value: any) {
            await manager.set(key, value, {
              ttl: options.ttl,
              tags: options.tags,
            });
          },
          enumerable: true,
          configurable: true,
        });
      }
    };
  }
}

/**
 * Utility functions for cache management
 */
export class CacheUtils {
  /**
   * Create a cache key with consistent formatting
   */
  static createKey(namespace: string, ...parts: (string | number)[]): string {
    const cleanParts = parts
      .map((part) => String(part))
      .map((part) => part.replace(/[:\s]/g, '_'))
      .filter(Boolean);

    return `${namespace}:${cleanParts.join(':')}`;
  }

  /**
   * Create cache tags from object properties
   */
  static createTags(obj: Record<string, any>, prefix = ''): string[] {
    const tags: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        const tag = prefix ? `${prefix}:${key}:${value}` : `${key}:${value}`;
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Calculate TTL based on data freshness requirements
   */
  static calculateTTL(
    dataType: 'realtime' | 'frequent' | 'hourly' | 'daily' | 'static',
  ): number {
    switch (dataType) {
      case 'realtime':
        return 30; // 30 seconds
      case 'frequent':
        return 300; // 5 minutes
      case 'hourly':
        return 3600; // 1 hour
      case 'daily':
        return 86400; // 24 hours
      case 'static':
        return 604800; // 1 week
      default:
        return 3600; // Default to 1 hour
    }
  }

  /**
   * Validate cache key format
   */
  static validateKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    if (key.length > 250) {
      return false;
    }

    if (key.includes('\n') || key.includes('\r')) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize cache key
   */
  static sanitizeKey(key: string): string {
    return key.replace(/[^\w\-:.]/g, '_').slice(0, 250);
  }
}

// Export singleton instance for convenience
export const cacheManager = CacheManagerFactory.getInstance();

// Export decorators for convenience
export const CacheMethod = CacheDecoratorFactory.method;
export const CacheClass = CacheDecoratorFactory.class;
export const CacheProperty = CacheDecoratorFactory.property;
