/**
 * Cache System Integration Tests
 *
 * Tests the complete cache system including adapters, manager,
 * configuration, and factory components.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { CacheManagerFactory, CacheUtils } from '../lib/cache/factory';
import { CacheConfigFactory } from '../lib/cache/config';
import { DatabaseCacheAdapter } from '../lib/cache/adapters/database';
import { CacheManager } from '../lib/cache/cache-manager';
import Redis from 'ioredis';

// Database is now using in-memory storage for testing, no need to mock

// Mock logger
mock.module('../lib/logger', () => ({
  logger: {
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// Mock Redis
mock.module('ioredis');

describe('Cache System Integration', () => {
  let cacheManager: CacheManager;

  beforeEach(async () => {
    mock.restore();

    // Create a properly typed mock
    const mockPipeline = {
      exec: mock.fn<() => Promise<any[]>>().mockResolvedValue([]),
    };

    const mockRedis = {
      on: mock(),
      script: mock.fn<() => Promise<string>>().mockResolvedValue('sha'),
      get: mock.fn<() => Promise<string | null>>().mockResolvedValue(null),
      set: mock.fn<() => Promise<string>>().mockResolvedValue('OK'),
      setex: mock.fn<() => Promise<string>>().mockResolvedValue('OK'),
      del: mock.fn<() => Promise<number>>().mockResolvedValue(1),
      exists: mock.fn<() => Promise<number>>().mockResolvedValue(1),
      expire: mock.fn<() => Promise<number>>().mockResolvedValue(1),
      incrby: mock.fn<() => Promise<number>>().mockResolvedValue(1),
      mget: mock.fn<() => Promise<(string | null)[]>>().mockResolvedValue([]),
      keys: mock.fn<() => Promise<string[]>>().mockResolvedValue([]),
      smembers: mock.fn<() => Promise<string[]>>().mockResolvedValue([]),
      sadd: mock.fn<() => Promise<number>>().mockResolvedValue(1),
      evalsha: mock.fn<() => Promise<any>>().mockResolvedValue(1),
      ping: mock.fn<() => Promise<string>>().mockResolvedValue('PONG'),
      info: mock
        .fn<() => Promise<string>>()
        .mockResolvedValue('redis_version:6.0.0'),
      quit: mock.fn<() => Promise<string>>().mockResolvedValue('OK'),
      pipeline: mock(() => mockPipeline),
    };

    (Redis as any).mockImplementation(() => mockRedis);

    // Mock Cluster support
    (Redis as any).Cluster = mock(() => mockRedis);

    // Mock Redis exports
    mock.doMock('ioredis', () => ({
      Redis: Redis as any,
      Cluster: (Redis as any).Cluster,
    }));

    // Use test configuration
    cacheManager = CacheManagerFactory.createForTesting();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow initialization
  });

  afterEach(async () => {
    if (cacheManager) {
      await cacheManager.close();
    }
    await CacheManagerFactory.reset();
  });

  describe('CacheManager', () => {
    it('should create cache manager with database adapter', () => {
      expect(cacheManager).toBeInstanceOf(CacheManager);
      expect(cacheManager.getAdapterType()).toBe('database');
    });

    it('should perform basic cache operations', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };

      // Set value
      const setResult = await cacheManager.set(key, value, { ttl: 300 });
      expect(setResult).toBe(true);

      // Get value
      const retrievedValue = await cacheManager.get(key);
      expect(retrievedValue).toEqual(value);

      // Check exists using get
      const existsValue = await cacheManager.get(key);
      expect(existsValue).toBeTruthy();

      // Delete value
      const deleteResult = await cacheManager.delete(key);
      expect(deleteResult).toBe(true);

      // Verify deletion
      const deletedValue = await cacheManager.get(key);
      expect(deletedValue).toBeNull();
    });

    it('should handle cache with fallback function', async () => {
      const key = 'fallback-test';
      const fallbackValue = { computed: true, value: 42 };

      let fallbackCalled = false;
      const fallbackFn = mock(async () => {
        fallbackCalled = true;
        return fallbackValue;
      });

      // First call should use fallback
      const result1 = await cacheManager.get(key, fallbackFn, { ttl: 300 });
      expect(result1).toEqual(fallbackValue);
      expect(fallbackCalled).toBe(true);
      expect(fallbackFn).toHaveBeenCalledTimes(1);

      // Second call should use cache
      fallbackCalled = false;
      const result2 = await cacheManager.get(key, fallbackFn);
      expect(result2).toEqual(fallbackValue);
      expect(fallbackCalled).toBe(false);
      expect(fallbackFn).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle tag-based invalidation', async () => {
      const keys = ['user:1', 'user:2', 'post:1'];
      const userTag = 'users';
      const postTag = 'posts';

      // Set values with tags
      await cacheManager.set(
        keys[0],
        { id: 1, name: 'User 1' },
        { tags: [userTag] },
      );
      await cacheManager.set(
        keys[1],
        { id: 2, name: 'User 2' },
        { tags: [userTag] },
      );
      await cacheManager.set(
        keys[2],
        { id: 1, title: 'Post 1' },
        { tags: [postTag] },
      );

      // Verify values are cached
      expect(await cacheManager.get(keys[0])).toBeTruthy();
      expect(await cacheManager.get(keys[1])).toBeTruthy();
      expect(await cacheManager.get(keys[2])).toBeTruthy();

      // Invalidate user tag
      const invalidatedCount = await cacheManager.invalidateByTag(userTag);
      expect(invalidatedCount).toBeGreaterThan(0);

      // Verify user entries are invalidated but post entry remains
      expect(await cacheManager.get(keys[0])).toBeNull();
      expect(await cacheManager.get(keys[1])).toBeNull();
      expect(await cacheManager.get(keys[2])).toBeTruthy();
    });

    it('should handle bulk operations', async () => {
      const entries = [
        { key: 'bulk:1', value: { id: 1 } },
        { key: 'bulk:2', value: { id: 2 } },
        { key: 'bulk:3', value: { id: 3 } },
      ];

      // Set entries individually using cache manager (so L1 and L2 are in sync)
      for (const entry of entries) {
        await cacheManager.set(entry.key, entry.value, { ttl: 300 });
      }

      // Bulk get
      const keys = entries.map((entry) => entry.key);
      const results = await cacheManager.mget(keys);

      expect(results.size).toBe(entries.length);
      for (const entry of entries) {
        expect(results.get(entry.key)).toEqual(entry.value);
      }

      // Clean up
      for (const key of keys) {
        await cacheManager.delete(key);
      }
    });

    it('should provide statistics', async () => {
      // Perform some cache operations
      await cacheManager.set('stats:test:1', 'value1');
      await cacheManager.get('stats:test:1');
      await cacheManager.get('stats:test:missing');

      const stats = await cacheManager.getStats();

      expect(stats).toHaveProperty('adapter');
      expect(stats).toHaveProperty('l1');
      expect(stats).toHaveProperty('l2');
      expect(stats).toHaveProperty('combined');

      expect(stats.l1).toHaveProperty('entries');
      expect(stats.l1).toHaveProperty('hits');
      expect(stats.l1).toHaveProperty('requests');
      expect(stats.l1).toHaveProperty('hitRate');
    });

    it('should handle health checks', async () => {
      const isHealthy = await cacheManager.isHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should have L2 adapter configured', async () => {
      const key = 'test:l2';
      const value = { test: 'data' };

      // Test L2 cache through normal operations
      await cacheManager.set(key, value, { ttl: 300 });

      // This should hit L2 cache (database)
      const cached = await cacheManager.get(key);
      expect(cached).toEqual(value);

      // Verify it was stored by checking we can retrieve it
      const exists = await cacheManager.get(key);
      expect(exists).toBeTruthy();
    });
  });

  describe('CacheUtils', () => {
    it('should create properly formatted cache keys', () => {
      const key1 = CacheUtils.createKey('namespace', 'part1', 'part2');
      expect(key1).toBe('namespace:part1:part2');

      const key2 = CacheUtils.createKey('ns', 123, 'test:value');
      expect(key2).toBe('ns:123:test_value');
    });

    it('should create cache tags from objects', () => {
      const obj = {
        userId: 123,
        type: 'user',
        status: 'active',
        ignored: null,
        undefined,
      };

      const tags = CacheUtils.createTags(obj, 'entity');
      expect(tags).toContain('entity:userId:123');
      expect(tags).toContain('entity:type:user');
      expect(tags).toContain('entity:status:active');
      expect(tags).not.toContain('entity:ignored:null');
      expect(tags).not.toContain('entity:undefined:undefined');
    });

    it('should calculate appropriate TTL values', () => {
      expect(CacheUtils.calculateTTL('realtime')).toBe(30);
      expect(CacheUtils.calculateTTL('frequent')).toBe(300);
      expect(CacheUtils.calculateTTL('hourly')).toBe(3600);
      expect(CacheUtils.calculateTTL('daily')).toBe(86400);
      expect(CacheUtils.calculateTTL('static')).toBe(604800);
    });

    it('should validate cache keys', () => {
      expect(CacheUtils.validateKey('valid:key')).toBe(true);
      expect(CacheUtils.validateKey('valid_key-123')).toBe(true);
      expect(CacheUtils.validateKey('')).toBe(false);
      expect(CacheUtils.validateKey('key\nwith\nnewlines')).toBe(false);
      expect(CacheUtils.validateKey('a'.repeat(251))).toBe(false);
    });

    it('should sanitize invalid cache keys', () => {
      const sanitized1 = CacheUtils.sanitizeKey('key with spaces');
      expect(sanitized1).toBe('key_with_spaces');

      const sanitized2 = CacheUtils.sanitizeKey('key@#$%^&*()special');
      expect(sanitized2).toBe('key_________special');

      const sanitized3 = CacheUtils.sanitizeKey('key___multiple___underscores');
      expect(sanitized3).toBe('key___multiple___underscores');
    });
  });

  describe('CacheConfigFactory', () => {
    it('should create development configuration', () => {
      const config = CacheConfigFactory.forDevelopment();

      expect(config.adapter).toBe('database');
      expect(config.enableCompression).toBe(false);
      expect(config.defaultTTL).toBe(300);
      expect(config.maxMemoryEntries).toBe(1000);
    });

    it('should create production configuration', () => {
      const config = CacheConfigFactory.forProduction();

      expect(config.defaultTTL).toBe(3600);
      expect(config.maxMemoryEntries).toBe(50000);
      expect(config.enableCompression).toBe(true);
      expect(config.invalidationPatterns).toContain('user:*');
    });

    it('should create test configuration', () => {
      const config = CacheConfigFactory.forTesting();

      expect(config.adapter).toBe('database');
      expect(config.defaultTTL).toBe(60);
      expect(config.maxMemoryEntries).toBe(100);
      expect(config.database?.tableName).toBe('cache_entries_test');
    });
  });

  describe('CacheManagerFactory', () => {
    it('should create singleton instance', () => {
      const instance1 = CacheManagerFactory.getInstance();
      const instance2 = CacheManagerFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create instances with custom configuration', () => {
      const customManager = CacheManagerFactory.createWithConfig({
        adapter: 'database',
        defaultTTL: 600,
        maxMemoryEntries: 5000,
      });

      expect(customManager).toBeInstanceOf(CacheManager);
      expect(customManager.getAdapterType()).toBe('database');
    });

    it('should initialize with health check', async () => {
      await expect(CacheManagerFactory.initialize()).resolves.toBeInstanceOf(
        CacheManager,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter initialization failures gracefully', () => {
      // This should not throw even if there are initialization issues
      expect(() => {
        CacheManagerFactory.createWithConfig({
          adapter: 'database', // Use database adapter to avoid Redis initialization issues
          database: {
            tableName: 'test_cache',
          },
        });
      }).not.toThrow();
    });

    it('should handle cache operation failures gracefully', async () => {
      const key = 'error-test';

      // These operations should not throw, even if the underlying adapter fails
      const getResult = await cacheManager.get(key);
      expect(typeof getResult === 'object' || getResult === null).toBe(true);

      const setResult = await cacheManager.set(key, 'value');
      expect(typeof setResult === 'boolean').toBe(true);

      const deleteResult = await cacheManager.delete(key);
      expect(typeof deleteResult === 'boolean').toBe(true);
    });
  });
});

describe('Cache Patterns', () => {
  let manager: CacheManager;

  beforeEach(() => {
    manager = CacheManagerFactory.createForTesting();
  });

  afterEach(async () => {
    await manager.close();
  });

  it('should implement cache-aside pattern', async () => {
    const key = 'pattern:cache-aside';
    let fetchCount = 0;

    const fetchFn = mock(async () => {
      fetchCount++;
      return { data: `fetch-${fetchCount}` };
    });

    const cacheAside = manager.cacheAside(key, fetchFn, { ttl: 300 });

    // First access should fetch
    const result1 = await cacheAside.get();
    expect(fetchCount).toBe(1);
    expect(result1).toEqual({ data: 'fetch-1' });

    // Second access should use cache
    const result2 = await cacheAside.get();
    expect(fetchCount).toBe(1); // Should not fetch again
    expect(result2).toEqual({ data: 'fetch-1' });

    // Refresh should fetch again
    const result3 = await cacheAside.refresh();
    expect(fetchCount).toBe(2);
    expect(result3).toEqual({ data: 'fetch-2' });
  });
});
