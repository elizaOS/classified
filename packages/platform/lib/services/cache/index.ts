/**
 * Cache Services
 * Unified caching abstraction layer
 */

// Core interfaces and types
export type {
  ICacheService,
  CacheConfig,
  CacheConnectionError,
  CacheError,
} from './interface';

// Cache implementations
export {
  PGLiteCacheService,
  PGLiteCacheService as SQLiteCacheService,
} from './pglite-cache';
export { RedisCacheService } from './redis-cache';

// Legacy export for backward compatibility

// Cache manager and convenience functions
export {
  CacheManager,
  getCache,
  getCacheConfig,
  isRedisCache,
  isSQLiteCache,
  resetCache,
} from './cache-manager';

// Default export
export { default } from './cache-manager';
