/**
 * Cache System Usage Examples
 *
 * Demonstrates how to use the adaptive cache system with Redis and Database
 * backends, including automatic adapter selection and configuration.
 */

import {
  cacheManager,
  CacheManagerFactory,
  CachePatterns,
  CacheUtils,
  CacheMethod,
  createCacheHealthCheck,
} from './index';

// Example 1: Basic usage with automatic adapter selection
export async function basicCacheExample() {
  // The cache manager automatically chooses Redis (production) or Database (local)
  // based on environment variables like REDIS_URL and NODE_ENV

  // Set a value
  await cacheManager.set(
    'user:123',
    { name: 'John Doe', email: 'john@example.com' },
    {
      ttl: 3600, // 1 hour
      tags: ['users', 'user:123'],
    },
  );

  // Get a value with fallback
  const user = await cacheManager.get('user:123', async () => {
    // This fallback function runs if cache miss
    console.log('Cache miss - fetching from database');
    return { name: 'John Doe', email: 'john@example.com' };
  });

  console.log('User:', user);

  // Check what adapter is being used
  console.log('Cache adapter:', cacheManager.getAdapterType());
}

// Example 2: Environment-specific configuration
export async function environmentSpecificExample() {
  // For development - always use database
  const devCache = CacheManagerFactory.createForDevelopment();

  // For production - use Redis if available, fallback to database
  const prodCache = CacheManagerFactory.createForProduction();

  // For testing - use database with short TTL
  const testCache = CacheManagerFactory.createForTesting();

  await devCache.set('dev:key', 'development value');
  await prodCache.set('prod:key', 'production value');
  await testCache.set('test:key', 'test value');

  console.log('Dev adapter:', devCache.getAdapterType());
  console.log('Prod adapter:', prodCache.getAdapterType());
  console.log('Test adapter:', testCache.getAdapterType());
}

// Example 3: Using cache patterns
export async function cachePatternExamples() {
  // Cache-aside pattern
  const userCache = CachePatterns.cacheAside(
    cacheManager,
    'user:456',
    async () => {
      // Simulated database fetch
      return { id: 456, name: 'Jane Smith', role: 'admin' };
    },
    { ttl: 1800, tags: ['users'] },
  );

  const user = await userCache.get();
  console.log('User from cache-aside:', user);

  // Write-through pattern
  const newUser = { id: 789, name: 'Bob Wilson', role: 'user' };
  await CachePatterns.writeThrough(
    cacheManager,
    'user:789',
    newUser,
    async (data) => {
      // Simulated database write
      console.log('Writing to database:', data);
    },
    { tags: ['users'] },
  );

  // Circuit breaker pattern
  const circuitBreaker = CachePatterns.circuitBreaker(
    cacheManager,
    'api:external',
    async () => {
      // Simulated external API call that might fail
      if (Math.random() > 0.7) {
        throw new Error('External API failure');
      }
      return { data: 'external API response' };
    },
    { maxFailures: 3, resetTimeout: 60000 },
  );

  try {
    const result = await circuitBreaker();
    console.log('Circuit breaker result:', result);
  } catch (error) {
    console.log(
      'Circuit breaker failed:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Example 4: Cache decorators
export class UserService {
  // @CacheMethod({
  //   ttl: 3600,
  //   tags: ['users'],
  //   keyGenerator: (userId: string) => `user:${userId}`,
  // })
  async getUser(userId: string) {
    // Simulated database query
    console.log(`Fetching user ${userId} from database`);
    return {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
    };
  }

  // @CacheMethod({
  //   ttl: 600,
  //   tags: ['users', 'search'],
  //   keyGenerator: (query: string, limit: number) => `users:search:${query}:${limit}`,
  // })
  async searchUsers(query: string, limit: number = 10) {
    // Simulated search
    console.log(`Searching users with query: ${query}`);
    return Array.from({ length: limit }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      relevance: Math.random(),
    }));
  }
}

// Example 5: Bulk operations
export async function bulkOperationsExample() {
  // Set multiple keys at once
  const entries = [
    { key: 'product:1', value: { name: 'Laptop', price: 999 } },
    { key: 'product:2', value: { name: 'Mouse', price: 25 } },
    { key: 'product:3', value: { name: 'Keyboard', price: 75 } },
  ];

  // Get multiple keys at once
  const keys = ['product:1', 'product:2', 'product:3'];
  const products = await cacheManager.mget(keys);

  console.log('Bulk retrieved products:', products);

  // Invalidate by tags
  await cacheManager.invalidateByTag('products');
  console.log('Invalidated all products');
}

// Example 6: Cache statistics and monitoring
export async function monitoringExample() {
  // Get cache statistics
  const stats = await cacheManager.getStats();
  console.log('Cache statistics:', {
    adapter: stats.adapter,
    l1HitRate: stats.l1.hitRate,
    l2Healthy: stats.l2.healthy,
    totalEntries: stats.combined.totalEntries,
    memoryUsage: stats.combined.memoryUsage,
  });

  // Health check
  const healthCheck = createCacheHealthCheck(cacheManager);
  const health = await healthCheck();
  console.log('Cache health:', health);

  // Check if cache is healthy
  const isHealthy = await cacheManager.isHealthy();
  console.log('Cache is healthy:', isHealthy);
}

// Example 7: Custom cache keys and utilities
export async function utilityExample() {
  // Create consistent cache keys
  const userKey = CacheUtils.createKey('users', 'profile', 123);
  const sessionKey = CacheUtils.createKey('sessions', 'active', 'user123');

  console.log('Generated keys:', { userKey, sessionKey });

  // Create tags from object properties
  const user = { id: 123, organizationId: 456, role: 'admin' };
  const tags = CacheUtils.createTags(user, 'user');
  console.log('Generated tags:', tags);

  // Calculate TTL based on data type
  const realtimeTTL = CacheUtils.calculateTTL('realtime'); // 30 seconds
  const dailyTTL = CacheUtils.calculateTTL('daily'); // 24 hours
  const staticTTL = CacheUtils.calculateTTL('static'); // 1 week

  console.log('TTL values:', { realtimeTTL, dailyTTL, staticTTL });

  // Validate and sanitize cache keys
  const validKey = CacheUtils.validateKey('user:123:profile');
  const sanitizedKey = CacheUtils.sanitizeKey('user with spaces & symbols!');

  console.log('Key validation:', { validKey, sanitizedKey });
}

// Example 8: Configuration examples
export async function configurationExample() {
  console.log('Environment variables for cache configuration:');
  console.log({
    CACHE_ADAPTER: process.env.CACHE_ADAPTER || 'auto',
    REDIS_URL: process.env.REDIS_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'development',
    CACHE_DEFAULT_TTL: process.env.CACHE_DEFAULT_TTL || '3600',
    CACHE_MAX_MEMORY_ENTRIES: process.env.CACHE_MAX_MEMORY_ENTRIES || '10000',
  });

  // The cache system automatically adapts based on these environment variables:
  // - NODE_ENV=production + REDIS_URL -> Uses Redis
  // - NODE_ENV=development -> Uses Database
  // - NODE_ENV=test -> Uses Database with test table
  // - CACHE_ADAPTER=redis -> Forces Redis
  // - CACHE_ADAPTER=database -> Forces Database
}

// Example 9: Error handling and resilience
export async function errorHandlingExample() {
  try {
    // This will work even if cache fails
    const data = await cacheManager.get('key:that:might:fail', async () => {
      return { message: 'Fallback data when cache fails' };
    });

    console.log('Data retrieved despite potential cache issues:', data);
  } catch (error) {
    console.error('Cache operation failed:', error);
  }

  // Cache will automatically fallback to database if Redis is unavailable
  // and will gracefully handle connection issues
}

// Example 10: Complete real-world example
export class ProductService {
  // @CacheMethod({
  //   ttl: 3600,
  //   tags: ['products'],
  //   keyGenerator: (id: string) => `product:${id}`,
  // })
  async getProduct(id: string) {
    // Simulated database call
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      id,
      name: `Product ${id}`,
      price: Math.floor(Math.random() * 1000),
      category: 'electronics',
    };
  }

  async updateProduct(id: string, updates: any) {
    // Update in database (simulated)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Invalidate cache for this product
    await cacheManager.invalidateByTag('products');

    // Or refresh specific key
    return await cacheManager.refresh(`product:${id}`, () =>
      this.getProduct(id),
    );
  }

  // @CacheMethod({
  //   ttl: 300,
  //   tags: ['products', 'featured'],
  //   keyGenerator: () => 'products:featured',
  // })
  async getFeaturedProducts() {
    // Simulated expensive query
    await new Promise((resolve) => setTimeout(resolve, 200));
    return [
      { id: '1', name: 'Featured Product 1', featured: true },
      { id: '2', name: 'Featured Product 2', featured: true },
    ];
  }
}

// Run all examples
export async function runAllExamples() {
  console.log('=== Cache System Examples ===\n');

  try {
    console.log('1. Basic Cache Example:');
    await basicCacheExample();
    console.log('');

    console.log('2. Environment-Specific Example:');
    await environmentSpecificExample();
    console.log('');

    console.log('3. Cache Pattern Examples:');
    await cachePatternExamples();
    console.log('');

    console.log('4. Cache Decorators:');
    const userService = new UserService();
    await userService.getUser('123');
    await userService.getUser('123'); // Should hit cache
    await userService.searchUsers('john', 5);
    console.log('');

    console.log('5. Bulk Operations:');
    await bulkOperationsExample();
    console.log('');

    console.log('6. Monitoring:');
    await monitoringExample();
    console.log('');

    console.log('7. Utilities:');
    await utilityExample();
    console.log('');

    console.log('8. Configuration:');
    await configurationExample();
    console.log('');

    console.log('9. Error Handling:');
    await errorHandlingExample();
    console.log('');

    console.log('10. Real-world Service:');
    const productService = new ProductService();
    await productService.getProduct('laptop-1');
    await productService.getFeaturedProducts();
    await productService.updateProduct('laptop-1', { price: 899 });
    console.log('');

    console.log('=== All Examples Completed ===');
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export for testing - ProductService already exported above
