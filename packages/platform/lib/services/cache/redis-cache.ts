/**
 * Redis Cache Implementation
 * Production-ready caching using Redis for scalability
 */

import { Redis } from 'ioredis';
import { ICacheService, CacheError, CacheConnectionError } from './interface';

export class RedisCacheService implements ICacheService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor(
    url: string,
    options: {
      maxRetries?: number;
      retryDelayOnFailover?: number;
      enableReadyCheck?: boolean;
      maxRetriesPerRequest?: number;
    } = {},
  ) {
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: options.maxRetriesPerRequest ?? 3,
        retryDelayOnFailover: options.retryDelayOnFailover ?? 100,
        enableReadyCheck: options.enableReadyCheck ?? true,
        lazyConnect: true,
        ...options,
      });

      this.setupEventHandlers();
    } catch (error) {
      throw new CacheConnectionError(
        'Failed to initialize Redis cache',
        error as Error,
      );
    }
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('[RedisCache] Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      console.error('[RedisCache] Redis connection error:', error);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      console.log('[RedisCache] Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      console.log('[RedisCache] Reconnecting to Redis...');
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      throw new CacheError(`Failed to get key ${key}`, error as Error);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      throw new CacheError(`Failed to set key ${key}`, error as Error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      throw new CacheError(`Failed to delete key ${key}`, error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      throw new CacheError(
        `Failed to check existence of key ${key}`,
        error as Error,
      );
    }
  }

  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const multi = this.client.multi();
      multi.incr(key);
      if (ttlSeconds) {
        multi.expire(key, ttlSeconds);
      }
      const results = await multi.exec();

      if (!results || results[0][1] === null) {
        throw new Error('Failed to increment');
      }

      return results[0][1] as number;
    } catch (error) {
      throw new CacheError(`Failed to increment key ${key}`, error as Error);
    }
  }

  async decrement(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const multi = this.client.multi();
      multi.decr(key);
      if (ttlSeconds) {
        multi.expire(key, ttlSeconds);
      }
      const results = await multi.exec();

      if (!results || results[0][1] === null) {
        throw new Error('Failed to decrement');
      }

      return Math.max(0, results[0][1] as number);
    } catch (error) {
      throw new CacheError(`Failed to decrement key ${key}`, error as Error);
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    try {
      if (keys.length === 0) {
        return [];
      }
      return await this.client.mget(...keys);
    } catch (error) {
      throw new CacheError('Failed to mget keys', error as Error);
    }
  }

  async mset(
    entries: Array<{ key: string; value: string; ttl?: number }>,
  ): Promise<void> {
    try {
      if (entries.length === 0) {
        return;
      }

      const multi = this.client.multi();

      for (const entry of entries) {
        if (entry.ttl) {
          multi.setex(entry.key, entry.ttl, entry.value);
        } else {
          multi.set(entry.key, entry.value);
        }
      }

      await multi.exec();
    } catch (error) {
      throw new CacheError('Failed to mset entries', error as Error);
    }
  }

  async hget(hash: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(hash, field);
    } catch (error) {
      throw new CacheError(`Failed to hget ${hash}:${field}`, error as Error);
    }
  }

  async hset(
    hash: string,
    field: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const multi = this.client.multi();
      multi.hset(hash, field, value);
      if (ttlSeconds) {
        multi.expire(hash, ttlSeconds);
      }
      await multi.exec();
    } catch (error) {
      throw new CacheError(`Failed to hset ${hash}:${field}`, error as Error);
    }
  }

  async hgetall(hash: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(hash);
    } catch (error) {
      throw new CacheError(`Failed to hgetall ${hash}`, error as Error);
    }
  }

  async lpush(list: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lpush(list, ...values);
    } catch (error) {
      throw new CacheError(`Failed to lpush to list ${list}`, error as Error);
    }
  }

  async rpop(list: string): Promise<string | null> {
    try {
      return await this.client.rpop(list);
    } catch (error) {
      throw new CacheError(`Failed to rpop from list ${list}`, error as Error);
    }
  }

  async llen(list: string): Promise<number> {
    try {
      return await this.client.llen(list);
    } catch (error) {
      throw new CacheError(
        `Failed to get length of list ${list}`,
        error as Error,
      );
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      throw new CacheError(
        `Failed to set expiration for key ${key}`,
        error as Error,
      );
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      throw new CacheError(`Failed to get TTL for key ${key}`, error as Error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      throw new CacheError(
        `Failed to get keys with pattern ${pattern}`,
        error as Error,
      );
    }
  }

  async scan(
    cursor: string,
    pattern?: string,
    count?: number,
  ): Promise<{ cursor: string; keys: string[] }> {
    try {
      const options: any = {};
      if (pattern) {
        options.MATCH = pattern;
      }
      if (count) {
        options.COUNT = count;
      }

      const result = await this.client.scan(cursor, options);
      return {
        cursor: result[0],
        keys: result[1],
      };
    } catch (error) {
      throw new CacheError(
        `Failed to scan with cursor ${cursor}`,
        error as Error,
      );
    }
  }

  async flushall(): Promise<void> {
    try {
      await this.client.flushall();
    } catch (error) {
      throw new CacheError('Failed to flush all cache entries', error as Error);
    }
  }

  async cleanup(): Promise<void> {
    // Redis handles expiration automatically, no manual cleanup needed
    console.log(
      '[RedisCache] Cleanup not needed - Redis handles expiration automatically',
    );
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async info(): Promise<{
    type: string;
    connected: boolean;
    memory?: string;
    version?: string;
  }> {
    try {
      const info = await this.client.info();
      const lines = info.split('\r\n');

      let version = '';
      let memory = '';

      for (const line of lines) {
        if (line.startsWith('redis_version:')) {
          version = line.split(':')[1];
        }
        if (line.startsWith('used_memory_human:')) {
          memory = line.split(':')[1];
        }
      }

      return {
        type: 'redis',
        connected: this.isConnected,
        memory,
        version,
      };
    } catch (error) {
      return {
        type: 'redis',
        connected: false,
      };
    }
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      throw new CacheConnectionError(
        'Failed to connect to Redis',
        error as Error,
      );
    }
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  quit(): void {
    this.client.quit();
  }
}
