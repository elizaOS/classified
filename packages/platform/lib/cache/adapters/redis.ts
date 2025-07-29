/**
 * Redis Cache Adapter
 *
 * Implements caching using Redis for production environments.
 * Provides high-performance caching with advanced Redis features
 * like pub/sub, lua scripts, and clustering support.
 */

import { logger } from '../../logger';
import { CacheAdapter, CacheOptions, CacheBulkResult } from './base';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  username?: string;
  tls?: boolean;
  maxRetries?: number;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  keepAlive?: number;
  family?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  keyPrefix?: string;
  clusterMode?: boolean;
  clusterNodes?: Array<{ host: string; port: number }>;
}

export class RedisCacheAdapter extends CacheAdapter {
  private redis: any = null;
  private subscriber: any = null;
  private config: RedisConfig;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private scriptShas = new Map<string, string>();

  constructor(
    config: RedisConfig,
    options: {
      namespace?: string;
      defaultTTL?: number;
    } = {},
  ) {
    super(options);
    this.config = {
      // Default values
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4,
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Override with provided config
      ...config,
    };

    this.initializeConnection();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeConnection(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.connect();
    return this.connectionPromise;
  }

  private async connect(): Promise<void> {
    try {
      // Dynamic import to avoid dependency issues during build
      const Redis = await import('ioredis').then((m) => m.default);

      if (this.config.clusterMode && this.config.clusterNodes) {
        // Redis Cluster mode
        this.redis = new Redis.Cluster(this.config.clusterNodes, {
          redisOptions: {
            password: this.config.password,
            username: this.config.username,
            db: this.config.db || 0,
            maxRetriesPerRequest: this.config.maxRetriesPerRequest,
            enableReadyCheck: this.config.enableReadyCheck,
            lazyConnect: this.config.lazyConnect,
            keepAlive: this.config.keepAlive,
            family: this.config.family,
            connectTimeout: this.config.connectTimeout,
            commandTimeout: this.config.commandTimeout,
            keyPrefix: this.config.keyPrefix || `${this.namespace}:`,
          },
        });
      } else {
        // Single Redis instance
        const redisOptions: any = {
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          username: this.config.username,
          db: this.config.db || 0,
          keyPrefix: this.config.keyPrefix || `${this.namespace}:`,
        };

        // Add optional properties if they exist
        if (this.config.tls !== undefined) {
          redisOptions.tls = this.config.tls === true ? {} : undefined;
        }
        if (this.config.maxRetriesPerRequest !== undefined) {
          redisOptions.maxRetriesPerRequest = this.config.maxRetriesPerRequest;
        }
        if (this.config.enableReadyCheck !== undefined) {
          redisOptions.enableReadyCheck = this.config.enableReadyCheck;
        }
        if (this.config.lazyConnect !== undefined) {
          redisOptions.lazyConnect = this.config.lazyConnect;
        }
        if (this.config.keepAlive !== undefined) {
          redisOptions.keepAlive = this.config.keepAlive;
        }
        if (this.config.family !== undefined) {
          redisOptions.family = this.config.family;
        }
        if (this.config.connectTimeout !== undefined) {
          redisOptions.connectTimeout = this.config.connectTimeout;
        }
        if (this.config.commandTimeout !== undefined) {
          redisOptions.commandTimeout = this.config.commandTimeout;
        }

        this.redis = new Redis(redisOptions);
      }

      // Set up event handlers
      this.setupEventHandlers();

      // Load Lua scripts
      await this.loadLuaScripts();

      logger.info('Redis cache adapter connected', {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
        cluster: this.config.clusterMode,
      });
    } catch (error) {
      logger.error('Failed to connect to Redis', error as Error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.debug('Redis connected');
      this.isConnected = true;
    });

    this.redis.on('ready', () => {
      logger.debug('Redis ready');
      this.isConnected = true;
    });

    this.redis.on('error', (error: Error) => {
      logger.error('Redis error', error);
      this.updateStats('error');
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', (delay: number) => {
      logger.info('Redis reconnecting', { delay });
    });

    this.redis.on('end', () => {
      logger.warn('Redis connection ended');
      this.isConnected = false;
    });
  }

  private async loadLuaScripts(): Promise<void> {
    // Script for atomic increment with expiry
    const incrementScript = `
      local current = redis.call('GET', KEYS[1])
      if current == false then
        redis.call('SET', KEYS[1], ARGV[1])
        redis.call('EXPIRE', KEYS[1], ARGV[2])
        return tonumber(ARGV[1])
      else
        local new_val = tonumber(current) + tonumber(ARGV[1])
        redis.call('SET', KEYS[1], new_val)
        return new_val
      end
    `;

    // Script for multi-tag invalidation
    const invalidateTagsScript = `
      local deleted = 0
      for i = 1, #ARGV do
        local keys = redis.call('SMEMBERS', 'tags:' .. ARGV[i])
        if #keys > 0 then
          deleted = deleted + redis.call('DEL', unpack(keys))
          redis.call('DEL', 'tags:' .. ARGV[i])
        end
      end
      return deleted
    `;

    try {
      this.scriptShas.set(
        'increment',
        await this.redis.script('LOAD', incrementScript),
      );
      this.scriptShas.set(
        'invalidateTags',
        await this.redis.script('LOAD', invalidateTagsScript),
      );

      logger.debug('Lua scripts loaded', { count: this.scriptShas.size });
    } catch (error) {
      logger.error('Failed to load Lua scripts', error as Error);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.initializeConnection();
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    this.validateKey(key);
    await this.ensureConnected();

    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const value = await this.redis.get(fullKey);

      if (value === null) {
        this.updateStats('miss');
        return null;
      }

      this.updateStats('hit');

      // Decompress if needed
      let decompressedValue = value;
      if (options?.compress) {
        decompressedValue = await this.decompress(value);
      }

      return this.deserialize<T>(decompressedValue, options);
    } catch (error) {
      this.updateStats('error');
      logger.error('Redis cache get error', error as Error, { key });
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T = any>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<boolean> {
    this.validateKey(key);
    this.validateValue(value);
    await this.ensureConnected();

    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const ttl = this.calculateTTL(options);

      let serializedValue = this.serialize(value, options);

      // Compress if requested
      if (options?.compress) {
        serializedValue = await this.compress(serializedValue);
      }

      // Set with expiry
      await this.redis.setex(fullKey, ttl, serializedValue);

      // Handle tags if provided
      if (options?.tags && options.tags.length > 0) {
        await this.setTags(fullKey, options.tags);
      }

      this.updateStats('set');
      this.stats.totalKeys++;
      return true;
    } catch (error) {
      this.updateStats('error');
      logger.error('Redis cache set error', error as Error, { key });
      return false;
    }
  }

  private async setTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const tag of tags) {
      const tagKey = `tags:${tag}`;
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, 86400); // Tags expire in 24 hours
    }

    await pipeline.exec();
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    this.validateKey(key);
    await this.ensureConnected();

    try {
      const fullKey = this.buildKey(key);
      const result = await this.redis.del(fullKey);

      const deleted = result > 0;
      if (deleted) {
        this.updateStats('delete');
        this.stats.totalKeys = Math.max(0, this.stats.totalKeys - 1);
      }

      return deleted;
    } catch (error) {
      this.updateStats('error');
      logger.error('Redis cache delete error', error as Error, { key });
      return false;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    this.validateKey(key);
    await this.ensureConnected();

    try {
      const fullKey = this.buildKey(key);
      const result = await this.redis.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis cache exists error', error as Error, { key });
      return false;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    this.validateKey(key);
    await this.ensureConnected();

    try {
      const fullKey = this.buildKey(key);
      const result = await this.redis.expire(fullKey, seconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis cache expire error', error as Error, { key });
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, by: number = 1): Promise<number> {
    this.validateKey(key);
    await this.ensureConnected();

    try {
      const fullKey = this.buildKey(key);
      const sha = this.scriptShas.get('increment');

      if (sha) {
        // Use Lua script for atomic increment with TTL
        const result = await this.redis.evalsha(
          sha,
          1,
          fullKey,
          by,
          this.defaultTTL,
        );
        return parseInt(result, 10);
      } else {
        // Fallback to regular increment
        const result = await this.redis.incrby(fullKey, by);
        await this.redis.expire(fullKey, this.defaultTTL);
        return result;
      }
    } catch (error) {
      logger.error('Redis cache increment error', error as Error, { key });
      return 0;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decrement(key: string, by: number = 1): Promise<number> {
    return this.increment(key, -by);
  }

  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[]): Promise<CacheBulkResult<T>> {
    if (keys.length === 0) {
      return { found: new Map(), missing: [] };
    }

    await this.ensureConnected();

    try {
      const fullKeys = keys.map((key) => {
        this.validateKey(key);
        return this.buildKey(key);
      });

      const values = await this.redis.mget(...fullKeys);
      const found = new Map<string, T>();
      const missing: string[] = [];

      for (let i = 0; i < keys.length; i++) {
        const value = values[i];
        if (value !== null) {
          found.set(keys[i], this.deserialize<T>(value));
          this.updateStats('hit');
        } else {
          missing.push(keys[i]);
          this.updateStats('miss');
        }
      }

      return { found, missing };
    } catch (error) {
      logger.error('Redis cache mget error', error as Error, { keys });
      return { found: new Map(), missing: keys };
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(
    entries: Array<{ key: string; value: any; options?: CacheOptions }>,
  ): Promise<number> {
    if (entries.length === 0) {
      return 0;
    }

    await this.ensureConnected();

    try {
      const pipeline = this.redis.pipeline();
      let successCount = 0;

      for (const entry of entries) {
        try {
          this.validateKey(entry.key);
          this.validateValue(entry.value);

          const fullKey = this.buildKey(entry.key, entry.options?.namespace);
          const serializedValue = this.serialize(entry.value, entry.options);
          const ttl = this.calculateTTL(entry.options);

          pipeline.setex(fullKey, ttl, serializedValue);

          // Handle tags if provided
          if (entry.options?.tags && entry.options.tags.length > 0) {
            for (const tag of entry.options.tags) {
              const tagKey = `tags:${tag}`;
              pipeline.sadd(tagKey, fullKey);
              pipeline.expire(tagKey, 86400);
            }
          }

          successCount++;
        } catch (error) {
          logger.error('Redis mset entry error', error as Error, {
            key: entry.key,
          });
        }
      }

      await pipeline.exec();
      this.stats.sets += successCount;
      this.stats.totalKeys += successCount;

      return successCount;
    } catch (error) {
      this.updateStats('error');
      logger.error('Redis cache mset error', error as Error);
      return 0;
    }
  }

  /**
   * Delete multiple keys at once
   */
  async mdel(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    await this.ensureConnected();

    try {
      const fullKeys = keys.map((key) => {
        this.validateKey(key);
        return this.buildKey(key);
      });

      const result = await this.redis.del(...fullKeys);

      this.stats.deletes += result;
      this.stats.totalKeys = Math.max(0, this.stats.totalKeys - result);

      return result;
    } catch (error) {
      this.updateStats('error');
      logger.error('Redis cache mdel error', error as Error, { keys });
      return 0;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    await this.ensureConnected();

    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await this.redis.keys(fullPattern);

      // Remove namespace prefix from returned keys
      const prefix = this.config.keyPrefix || `${this.namespace}:`;
      return keys.map((key: string) =>
        key.startsWith(prefix) ? key.slice(prefix.length) : key,
      );
    } catch (error) {
      logger.error('Redis cache keys error', error as Error, { pattern });
      return [];
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (tags.length === 0) {
      return 0;
    }

    await this.ensureConnected();

    try {
      const sha = this.scriptShas.get('invalidateTags');

      if (sha) {
        // Use Lua script for atomic operation
        const result = await this.redis.evalsha(sha, 0, ...tags);
        const deletedCount = parseInt(result, 10);

        this.stats.deletes += deletedCount;
        this.stats.totalKeys = Math.max(0, this.stats.totalKeys - deletedCount);

        logger.debug('Cache invalidated by tags', { tags, deletedCount });
        return deletedCount;
      } else {
        // Fallback implementation
        let totalDeleted = 0;

        for (const tag of tags) {
          const tagKey = `tags:${tag}`;
          const keys = await this.redis.smembers(tagKey);

          if (keys.length > 0) {
            const deleted = await this.redis.del(...keys);
            await this.redis.del(tagKey);
            totalDeleted += deleted;
          }
        }

        this.stats.deletes += totalDeleted;
        this.stats.totalKeys = Math.max(0, this.stats.totalKeys - totalDeleted);

        return totalDeleted;
      }
    } catch (error) {
      logger.error('Redis cache invalidate by tags error', error as Error, {
        tags,
      });
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.ensureConnected();

    try {
      const pattern = this.buildKey('*');
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.stats.totalKeys = 0;
      logger.debug('Redis cache cleared', {
        namespace: this.namespace,
        deletedKeys: keys.length,
      });
    } catch (error) {
      logger.error('Redis cache clear error', error as Error);
      throw error;
    }
  }

  /**
   * Health check for Redis
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.ensureConnected();
      await this.redis.ping();
      const latency = Date.now() - startTime;

      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    try {
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }

      if (this.redis) {
        await this.redis.quit();
        this.redis = null;
      }

      this.isConnected = false;
      this.connectionPromise = null;

      logger.debug('Redis cache adapter closed');
    } catch (error) {
      logger.error('Error closing Redis connections', error as Error);
    }
  }

  /**
   * Get Redis info and statistics
   */
  async getRedisInfo(): Promise<{
    version: string;
    usedMemory: number;
    connectedClients: number;
    totalCommandsProcessed: number;
    keyspaceHits: number;
    keyspaceMisses: number;
  }> {
    await this.ensureConnected();

    try {
      const info = await this.redis.info();
      const lines = info.split('\r\n');
      const stats: any = {};

      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      }

      return {
        version: stats.redis_version || 'unknown',
        usedMemory: parseInt(stats.used_memory || '0', 10),
        connectedClients: parseInt(stats.connected_clients || '0', 10),
        totalCommandsProcessed: parseInt(
          stats.total_commands_processed || '0',
          10,
        ),
        keyspaceHits: parseInt(stats.keyspace_hits || '0', 10),
        keyspaceMisses: parseInt(stats.keyspace_misses || '0', 10),
      };
    } catch (error) {
      logger.error('Failed to get Redis info', error as Error);
      return {
        version: 'unknown',
        usedMemory: 0,
        connectedClients: 0,
        totalCommandsProcessed: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
      };
    }
  }
}
