/**
 * Redis Client Configuration and Management
 *
 * Provides a robust Redis client with connection pooling,
 * error handling, and monitoring capabilities.
 */

import { logger } from '../logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetries: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: number;
  keyPrefix?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  nx?: boolean; // Only set if key doesn't exist
  compress?: boolean; // Enable compression for large values
  serialize?: boolean; // Auto-serialize/deserialize JSON
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
  averageResponseTime: number;
}

/**
 * Redis Client Manager with fallback to in-memory cache
 */
export class RedisClient {
  private redis: any = null;
  private fallbackCache = new Map<string, { value: any; expires: number }>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    totalRequests: 0,
    hitRate: 0,
    averageResponseTime: 0,
  };
  private responseTimes: number[] = [];
  private isConnected = false;
  private isRedisAvailable = false;

  constructor(private config: RedisConfig) {
    this.initializeRedis();
    this.startStatsUpdater();
    this.startCleanupTimer();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      // In development or if Redis is not available, use memory cache
      if (process.env.NODE_ENV === 'development' || !process.env.REDIS_URL) {
        logger.info('Redis not configured, using in-memory cache fallback');
        this.isConnected = true;
        return;
      }

      // Dynamic import to avoid dependency issues during build
      const Redis = await import('ioredis').then((m) => m.default);

      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db || 0,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
        enableReadyCheck: this.config.enableReadyCheck !== false,
        lazyConnect: this.config.lazyConnect !== false,
        keepAlive: this.config.keepAlive || 30000,
        family: this.config.family || 4,
        keyPrefix: this.config.keyPrefix || 'elizaos:',
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
        this.isRedisAvailable = true;
      });

      this.redis.on('error', (error: Error) => {
        logger.error('Redis connection error', error);
        this.stats.errors++;
        this.isRedisAvailable = false;
        // Don't set isConnected to false - we'll fall back to memory cache
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isRedisAvailable = false;
      });

      this.redis.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });
    } catch (error) {
      logger.error('Failed to initialize Redis', error as Error);
      this.isConnected = true; // Allow fallback to memory cache
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(
    key: string,
    options: CacheOptions = {},
  ): Promise<T | null> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      let value: any = null;

      if (this.isRedisAvailable && this.redis) {
        try {
          value = await this.redis.get(key);
        } catch (error) {
          logger.warn(
            'Redis get failed, falling back to memory cache',
            error as Error,
          );
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      if (!this.isRedisAvailable) {
        const entry = this.fallbackCache.get(key);
        if (entry && entry.expires > Date.now()) {
          value = entry.value;
        } else if (entry) {
          this.fallbackCache.delete(key);
        }
      }

      if (value !== null) {
        this.stats.hits++;

        // Deserialize if needed
        if (options.serialize !== false) {
          try {
            value = JSON.parse(value);
          } catch {
            // Value wasn't JSON, return as-is
          }
        }

        // Decompress if needed
        if (options.compress && typeof value === 'string') {
          value = await this.decompress(value);
        }
      } else {
        this.stats.misses++;
      }

      this.recordResponseTime(Date.now() - startTime);
      return value;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error', error as Error, { key });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {},
  ): Promise<boolean> {
    const startTime = Date.now();
    this.stats.sets++;

    try {
      let serializedValue = value;

      // Serialize if needed
      if (options.serialize !== false && typeof value !== 'string') {
        serializedValue = JSON.stringify(value);
      }

      // Compress if needed
      if (options.compress && typeof serializedValue === 'string') {
        serializedValue = await this.compress(serializedValue);
      }

      const ttl = options.ttl || 3600; // Default 1 hour

      if (this.isRedisAvailable && this.redis) {
        try {
          if (options.nx) {
            await this.redis.setex(key, ttl, serializedValue, 'NX');
          } else {
            await this.redis.setex(key, ttl, serializedValue);
          }
        } catch (error) {
          logger.warn(
            'Redis set failed, falling back to memory cache',
            error as Error,
          );
          this.isRedisAvailable = false;
        }
      }

      // Always set in memory cache as fallback
      if (!this.isRedisAvailable || options.nx) {
        const expires = Date.now() + ttl * 1000;
        if (options.nx && this.fallbackCache.has(key)) {
          return false; // Key already exists
        }
        this.fallbackCache.set(key, { value: serializedValue, expires });
      }

      this.recordResponseTime(Date.now() - startTime);
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error', error as Error, { key });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    this.stats.deletes++;

    try {
      let deleted = false;

      if (this.isRedisAvailable && this.redis) {
        try {
          const result = await this.redis.del(key);
          deleted = result > 0;
        } catch (error) {
          logger.warn(
            'Redis delete failed, falling back to memory cache',
            error as Error,
          );
          this.isRedisAvailable = false;
        }
      }

      // Also delete from memory cache
      if (this.fallbackCache.has(key)) {
        this.fallbackCache.delete(key);
        deleted = true;
      }

      this.recordResponseTime(Date.now() - startTime);
      return deleted;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error', error as Error, { key });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (this.isRedisAvailable && this.redis) {
        try {
          const result = await this.redis.exists(key);
          return result > 0;
        } catch (error) {
          this.isRedisAvailable = false;
        }
      }

      // Check memory cache
      const entry = this.fallbackCache.get(key);
      return entry !== undefined && entry.expires > Date.now();
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache exists error', error as Error, { key });
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (this.isRedisAvailable && this.redis) {
        try {
          const result = await this.redis.expire(key, seconds);
          return result === 1;
        } catch (error) {
          this.isRedisAvailable = false;
        }
      }

      // Update memory cache expiration
      const entry = this.fallbackCache.get(key);
      if (entry) {
        entry.expires = Date.now() + seconds * 1000;
        return true;
      }

      return false;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache expire error', error as Error, { key });
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, by: number = 1): Promise<number> {
    try {
      if (this.isRedisAvailable && this.redis) {
        try {
          return await this.redis.incrby(key, by);
        } catch (error) {
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      const entry = this.fallbackCache.get(key);
      const currentValue =
        entry && entry.expires > Date.now()
          ? parseInt(entry.value, 10) || 0
          : 0;
      const newValue = currentValue + by;

      this.fallbackCache.set(key, {
        value: newValue.toString(),
        expires: Date.now() + 3600000, // 1 hour default
      });

      return newValue;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache increment error', error as Error, { key });
      return 0;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget(keys: string[]): Promise<(any | null)[]> {
    try {
      if (this.isRedisAvailable && this.redis) {
        try {
          const values = await this.redis.mget(...keys);
          return values.map((value: string | null) => {
            if (value === null) {
              return null;
            }
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          });
        } catch (error) {
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      return keys.map((key) => {
        const entry = this.fallbackCache.get(key);
        if (entry && entry.expires > Date.now()) {
          try {
            return JSON.parse(entry.value);
          } catch {
            return entry.value;
          }
        }
        return null;
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mget error', error as Error, { keys });
      return keys.map(() => null);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      if (this.isRedisAvailable && this.redis) {
        try {
          await this.redis.flushdb();
        } catch (error) {
          this.isRedisAvailable = false;
        }
      }

      this.fallbackCache.clear();
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error', error as Error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      totalRequests,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      averageResponseTime:
        this.responseTimes.length > 0
          ? this.responseTimes.reduce((a, b) => a + b, 0) /
            this.responseTimes.length
          : 0,
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
      totalRequests: 0,
      hitRate: 0,
      averageResponseTime: 0,
    };
    this.responseTimes = [];
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.fallbackCache.clear();
    this.isConnected = false;
  }

  /**
   * Record response time for statistics
   */
  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  /**
   * Compress data using built-in compression
   */
  private async compress(data: string): Promise<string> {
    // Simple base64 compression for now
    // In production, use proper compression like gzip
    return Buffer.from(data).toString('base64');
  }

  /**
   * Decompress data
   */
  private async decompress(data: string): Promise<string> {
    try {
      return Buffer.from(data, 'base64').toString('utf-8');
    } catch {
      return data; // Return as-is if decompression fails
    }
  }

  /**
   * Start periodic stats updates
   */
  private startStatsUpdater(): void {
    setInterval(() => {
      const stats = this.getStats();
      logger.debug('Cache statistics', stats);
    }, 60000); // Log stats every minute
  }

  /**
   * Start cleanup timer for memory cache
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.fallbackCache.entries()) {
        if (entry.expires < now) {
          this.fallbackCache.delete(key);
        }
      }
    }, 30000); // Cleanup every 30 seconds
  }
}

// Default Redis configuration
const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetries: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  keyPrefix: 'elizaos:',
};

// Export singleton instance
export const redisClient = new RedisClient(defaultConfig);
