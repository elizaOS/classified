/**
 * Cache Service Interface
 * Abstracts caching operations for both Redis (production) and SQLite (development)
 */

export interface ICacheService {
  // Basic operations
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  // Rate limiting operations
  increment(key: string, ttlSeconds?: number): Promise<number>;
  decrement(key: string, ttlSeconds?: number): Promise<number>;

  // Batch operations
  mget(keys: string[]): Promise<(string | null)[]>;
  mset(
    entries: Array<{ key: string; value: string; ttl?: number }>,
  ): Promise<void>;

  // Hash operations (for complex data structures)
  hget(hash: string, field: string): Promise<string | null>;
  hset(
    hash: string,
    field: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void>;
  hgetall(hash: string): Promise<Record<string, string>>;

  // List operations (for queues)
  lpush(list: string, ...values: string[]): Promise<number>;
  rpop(list: string): Promise<string | null>;
  llen(list: string): Promise<number>;

  // Expiration
  expire(key: string, seconds: number): Promise<void>;
  ttl(key: string): Promise<number>;

  // Pattern operations
  keys(pattern: string): Promise<string[]>;
  scan(
    cursor: string,
    pattern?: string,
    count?: number,
  ): Promise<{ cursor: string; keys: string[] }>;

  // Cleanup and maintenance
  flushall(): Promise<void>;
  cleanup(): Promise<void>;

  // Health check
  ping(): Promise<boolean>;
  info(): Promise<{
    type: string;
    connected: boolean;
    memory?: string;
    version?: string;
  }>;
}

export interface CacheConfig {
  type: 'redis' | 'pglite';
  redis?: {
    url: string;
    maxRetries?: number;
    retryDelayOnFailover?: number;
    enableReadyCheck?: boolean;
    maxRetriesPerRequest?: number;
  };
  pglite?: {
    database: string;
    cleanupIntervalMs?: number;
  };
}

export class CacheError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export class CacheConnectionError extends CacheError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'CacheConnectionError';
  }
}
