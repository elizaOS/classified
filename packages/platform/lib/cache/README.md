# ElizaOS Platform Cache System

A comprehensive, production-ready caching system with adapter pattern support for both Redis (production) and PostgreSQL (development/local) backends.

## Features

- **Dual Adapter Support**: Automatic switching between Redis and Database adapters based on environment
- **Multi-Layer Caching**: L1 (in-memory) + L2 (Redis/Database) for optimal performance
- **Intelligent Adapter Selection**: Auto-detects best adapter based on environment and configuration
- **Advanced Features**: Tag-based invalidation, bulk operations, compression, health checks
- **Production Ready**: Comprehensive error handling, monitoring, and fallback strategies
- **TypeScript Support**: Full type safety with comprehensive interfaces

## Quick Start

### Basic Usage

```typescript
import { cacheManager } from '@/lib/cache';

// Simple get/set
await cacheManager.set('user:123', { name: 'John Doe' }, { ttl: 3600 });
const user = await cacheManager.get('user:123');

// With fallback function
const user = await cacheManager.get(
  'user:123',
  async () => {
    // This will only be called if cache miss
    return await fetchUserFromDatabase(123);
  },
  { ttl: 3600, tags: ['users'] },
);
```

### Environment Configuration

The cache system automatically selects the appropriate adapter:

- **Development**: Uses Database adapter (PostgreSQL)
- **Production**: Uses Redis adapter if `REDIS_URL` is available, otherwise Database
- **Testing**: Always uses Database adapter with isolated tables

### Environment Variables

```bash
# Redis Configuration (optional)
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD="your-password"
REDIS_DATABASE="0"

# Cache Configuration
CACHE_ADAPTER="auto"  # auto, redis, or database
CACHE_DEFAULT_TTL="3600"
CACHE_MAX_MEMORY_ENTRIES="10000"
CACHE_ENABLE_COMPRESSION="true"
CACHE_TABLE_NAME="cache_entries"
```

## Advanced Usage

### Custom Configuration

```typescript
import { CacheManagerFactory, createCacheConfig } from '@/lib/cache';

// Create with custom configuration
const cacheManager = CacheManagerFactory.createWithConfig({
  adapter: 'redis',
  defaultTTL: 7200,
  enableCompression: true,
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: 'secret',
  },
});
```

### Tag-Based Invalidation

```typescript
// Set data with tags
await cacheManager.set('user:123', userData, {
  ttl: 3600,
  tags: ['users', 'user:123'],
});

await cacheManager.set('posts:user:123', userPosts, {
  ttl: 1800,
  tags: ['posts', 'user:123'],
});

// Invalidate all cache entries tagged with 'user:123'
await cacheManager.invalidateByTag('user:123');
```

### Bulk Operations

```typescript
// Bulk get
const keys = ['user:1', 'user:2', 'user:3'];
const results = await cacheManager.mget(keys);

// Bulk set
const entries = [
  { key: 'user:1', value: { name: 'John' }, options: { ttl: 3600 } },
  { key: 'user:2', value: { name: 'Jane' }, options: { ttl: 3600 } },
];
await cacheManager.l2Adapter.mset(entries);
```

### Cache Patterns

```typescript
import { CachePatterns } from '@/lib/cache';

// Cache-aside pattern
const userCache = cacheManager.cacheAside(
  'user:123',
  () => fetchUserFromDB(123),
  { ttl: 3600, tags: ['users'] },
);

const user = await userCache.get();
await userCache.refresh(); // Force refresh
```

### Decorators

```typescript
import { CacheMethod, CacheClass } from '@/lib/cache';

@CacheClass({ namespace: 'userService', defaultTTL: 3600 })
class UserService {
  @CacheMethod({ ttl: 1800, tags: ['users'] })
  async getUser(id: string) {
    return await this.database.users.findById(id);
  }

  @CacheMethod({
    ttl: 600,
    keyGenerator: (query, limit) => `search:${JSON.stringify(query)}:${limit}`,
    tags: ['users', 'search'],
  })
  async searchUsers(query: object, limit: number) {
    return await this.database.users.search(query, limit);
  }
}
```

### Health Monitoring

```typescript
import { createCacheHealthCheck } from '@/lib/cache';

const healthCheck = createCacheHealthCheck(cacheManager);
const health = await healthCheck();

console.log(health);
// {
//   status: 'healthy',
//   adapter: 'redis',
//   stats: { hits: 150, misses: 10, hitRate: 93.75 },
//   timestamp: '2024-01-15T10:30:00.000Z'
// }
```

### Statistics and Monitoring

```typescript
// Get detailed statistics
const stats = await cacheManager.getStats();
console.log(stats);

// {
//   adapter: 'redis',
//   l1: { entries: 50, hits: 120, requests: 150, hitRate: 80 },
//   l2: { healthy: true, latency: 2.5, stats: {...} },
//   combined: { totalEntries: 1250, hitRate: 92.3, memoryUsage: 2048576 }
// }
```

## API Reference

### CacheManager

#### Core Methods

```typescript
// Get value with optional fallback
get<T>(key: string, fallback?: () => Promise<T>, options?: CacheOptions): Promise<T | null>

// Set value
set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>

// Delete value
delete(key: string): Promise<boolean>

// Check if key exists
exists(key: string): Promise<boolean>

// Set expiration
expire(key: string, seconds: number): Promise<boolean>

// Increment/decrement numeric values
increment(key: string, by?: number): Promise<number>
decrement(key: string, by?: number): Promise<number>
```

#### Bulk Operations

```typescript
// Get multiple keys
mget(keys: string[]): Promise<Map<string, any>>

// Invalidate by tags
invalidateByTag(tag: string): Promise<number>
invalidateByTags(tags: string[]): Promise<number>

// Clear all cache
clear(): Promise<void>
```

#### Utility Methods

```typescript
// Get statistics
getStats(): Promise<CacheManagerStats>

// Health check
isHealthy(): Promise<boolean>

// Get adapter type
getAdapterType(): 'redis' | 'database' | 'unknown'

// Refresh cache entry
refresh<T>(key: string, fallback: () => Promise<T>, options?: CacheOptions): Promise<T | null>
```

### Cache Options

```typescript
interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for bulk invalidation
  compress?: boolean; // Enable compression for large values
  serialize?: boolean; // Enable JSON serialization
  namespace?: string; // Cache namespace
}
```

### Configuration

```typescript
interface CacheConfig {
  defaultTTL: number; // Default TTL in seconds
  maxMemoryEntries: number; // Max L1 cache entries
  enableCompression: boolean; // Enable compression
  enableSerialization: boolean; // Enable serialization
  invalidationPatterns: string[]; // Patterns for auto-invalidation
  adapter: 'redis' | 'database' | 'auto'; // Adapter selection
  redis?: RedisConfig; // Redis configuration
  database?: DatabaseConfig; // Database configuration
}
```

## Adapter Details

### Redis Adapter

- **Production Optimized**: Uses Redis for high-performance caching
- **Cluster Support**: Supports Redis cluster mode
- **Lua Scripts**: Atomic operations for complex cache patterns
- **Connection Pooling**: Efficient connection management
- **Automatic Failover**: Built-in retry and failover mechanisms

### Database Adapter

- **Development Friendly**: Uses PostgreSQL for local development
- **SQL-Based**: Full SQL support with indexes and constraints
- **Automatic Cleanup**: Background cleanup of expired entries
- **Transaction Support**: ACID compliance for cache operations
- **Schema Flexibility**: Extensible table schema

## Best Practices

### 1. Cache Key Design

```typescript
// Good: Hierarchical, descriptive keys
'users:profile:123';
'posts:by-author:456:page:1';
'search:results:query:abc123:filters:active';

// Bad: Flat, unclear keys
'user123';
'data';
'temp';
```

### 2. TTL Strategy

```typescript
// Real-time data: 30 seconds
await cache.set('stock:AAPL:price', price, { ttl: 30 });

// Frequently updated: 5 minutes
await cache.set('user:123:notifications', notifications, { ttl: 300 });

// Semi-static data: 1 hour
await cache.set('user:123:profile', profile, { ttl: 3600 });

// Static data: 24 hours
await cache.set('app:config', config, { ttl: 86400 });
```

### 3. Tag Strategy

```typescript
// Use hierarchical tags for flexible invalidation
await cache.set('post:123', post, {
  tags: ['posts', 'user:456', 'category:tech', 'published'],
});

// Invalidate all posts by user
await cache.invalidateByTag('user:456');

// Invalidate all tech posts
await cache.invalidateByTag('category:tech');
```

### 4. Error Handling

```typescript
try {
  const data = await cache.get('key', async () => {
    // Fallback that might fail
    return await externalAPI.getData();
  });
} catch (error) {
  // Cache operations never throw, but fallbacks might
  console.error('Fallback failed:', error);
  return null;
}
```

### 5. Performance Monitoring

```typescript
// Monitor cache hit rates
const stats = await cache.getStats();
if (stats.combined.hitRate < 80) {
  console.warn('Low cache hit rate:', stats.combined.hitRate);
}

// Monitor adapter health
const isHealthy = await cache.isHealthy();
if (!isHealthy) {
  // Alert or fallback logic
  console.error('Cache adapter unhealthy');
}
```

## Migration Guide

### From Redis Client

```typescript
// Before: Direct Redis usage
const value = await redisClient.get('key');
await redisClient.setex('key', 3600, JSON.stringify(data));

// After: Cache Manager
const value = await cacheManager.get('key');
await cacheManager.set('key', data, { ttl: 3600 });
```

### From Simple Cache

```typescript
// Before: Simple cache
const cache = new Map();
cache.set('key', value);

// After: Production cache
await cacheManager.set('key', value, {
  ttl: 3600,
  tags: ['category'],
});
```

## Testing

```typescript
import { CacheManagerFactory } from '@/lib/cache';

describe('Cache Tests', () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = CacheManagerFactory.createForTesting();
  });

  afterEach(async () => {
    await cache.clear();
    await cache.close();
  });

  it('should cache data', async () => {
    await cache.set('test', { data: 'value' });
    const result = await cache.get('test');
    expect(result).toEqual({ data: 'value' });
  });
});
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**

   - Verify `REDIS_URL` is correct
   - Check Redis server is running
   - Verify network connectivity
   - System will fallback to Database adapter

2. **Database Connection Failed**

   - Verify PostgreSQL is running
   - Check database migrations are applied
   - Verify connection permissions

3. **Poor Cache Hit Rate**

   - Review TTL values (too short?)
   - Check invalidation patterns (too aggressive?)
   - Monitor cache size (eviction occurring?)

4. **Memory Usage High**
   - Reduce `maxMemoryEntries`
   - Enable compression for large values
   - Review data being cached

### Debug Mode

```typescript
// Enable debug logging
process.env.NODE_ENV = 'development';

// The cache will log detailed operations
await cache.set('debug', data); // Logs: "Cache set { key: 'debug', ttl: 3600 }"
```

## Performance Benchmarks

Typical performance characteristics:

- **L1 Cache (Memory)**: ~0.1ms average latency
- **L2 Redis**: ~1-3ms average latency
- **L2 Database**: ~5-15ms average latency
- **Hit Rate**: 85-95% in production workloads
- **Memory Overhead**: ~200 bytes per cached entry

The system automatically provides the best performance available in your environment while maintaining consistent behavior across all deployment scenarios.
