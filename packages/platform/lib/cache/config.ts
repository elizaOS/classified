/**
 * Cache Configuration Module
 *
 * Provides configuration utilities for cache adapters and manages
 * environment-specific cache settings and adapter selection.
 */

import { CacheConfig } from './cache-manager';
import { RedisConfig } from './adapters/redis';

/**
 * Cache environment configuration
 */
export interface CacheEnvironmentConfig {
  // Adapter selection
  adapter: 'redis' | 'database' | 'auto';

  // Redis configuration
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    username?: string;
    database?: number;
    tls?: boolean;
    cluster?: {
      enabled: boolean;
      nodes?: Array<{ host: string; port: number }>;
    };
  };

  // Database configuration
  database?: {
    tableName?: string;
    cleanupInterval?: number;
  };

  // Performance settings
  performance?: {
    defaultTTL?: number;
    maxMemoryEntries?: number;
    enableCompression?: boolean;
    enableSerialization?: boolean;
  };

  // Development settings
  development?: {
    enableDebugLogging?: boolean;
    warmupQueries?: boolean;
  };
}

/**
 * Default cache configuration factory
 */
export class CacheConfigFactory {
  /**
   * Create cache configuration from environment variables
   */
  static fromEnvironment(): CacheConfig {
    const config: CacheConfig = {
      defaultTTL: this.getEnvNumber('CACHE_DEFAULT_TTL', 3600),
      maxMemoryEntries: this.getEnvNumber('CACHE_MAX_MEMORY_ENTRIES', 10000),
      enableCompression: this.getEnvBoolean('CACHE_ENABLE_COMPRESSION', true),
      enableSerialization: this.getEnvBoolean(
        'CACHE_ENABLE_SERIALIZATION',
        true,
      ),
      invalidationPatterns: this.getEnvArray('CACHE_INVALIDATION_PATTERNS', []),
      adapter: this.determineAdapter(),
    };

    // Add Redis configuration if needed
    if (this.shouldUseRedis()) {
      config.redis = this.getRedisConfig();
    }

    // Add Database configuration
    config.database = {
      tableName: process.env.CACHE_TABLE_NAME || 'cache_entries',
    };

    return config;
  }

  /**
   * Create development-optimized cache configuration
   */
  static forDevelopment(): CacheConfig {
    return {
      defaultTTL: 300, // 5 minutes for faster development cycles
      maxMemoryEntries: 1000, // Lower memory usage
      enableCompression: false, // Faster operations
      enableSerialization: true,
      invalidationPatterns: [],
      adapter: 'database', // Always use database in development
      database: {
        tableName: 'cache_entries_dev',
      },
    };
  }

  /**
   * Create production-optimized cache configuration
   */
  static forProduction(): CacheConfig {
    return {
      defaultTTL: 3600, // 1 hour
      maxMemoryEntries: 50000, // Higher capacity
      enableCompression: true, // Save memory
      enableSerialization: true,
      invalidationPatterns: ['user:*', 'session:*'], // Common patterns
      adapter: process.env.REDIS_URL ? 'redis' : 'database',
      redis: process.env.REDIS_URL ? this.getRedisConfig() : undefined,
      database: {
        tableName: 'cache_entries',
      },
    };
  }

  /**
   * Create test configuration
   */
  static forTesting(): CacheConfig {
    return {
      defaultTTL: 60, // 1 minute for fast test cycles
      maxMemoryEntries: 100,
      enableCompression: false,
      enableSerialization: true,
      invalidationPatterns: [],
      adapter: 'database',
      database: {
        tableName: 'cache_entries_test',
      },
    };
  }

  /**
   * Determine which adapter to use based on environment
   */
  private static determineAdapter(): 'redis' | 'database' | 'auto' {
    const configuredAdapter = process.env.CACHE_ADAPTER;

    if (configuredAdapter === 'redis' || configuredAdapter === 'database') {
      return configuredAdapter;
    }

    // Auto-detection based on environment
    if (process.env.NODE_ENV === 'test') {
      return 'database';
    }

    if (process.env.NODE_ENV === 'development') {
      return process.env.REDIS_URL ? 'redis' : 'database';
    }

    if (process.env.NODE_ENV === 'production') {
      return process.env.REDIS_URL ? 'redis' : 'database';
    }

    return 'auto';
  }

  /**
   * Check if Redis should be used based on environment
   */
  private static shouldUseRedis(): boolean {
    const adapter = this.determineAdapter();

    if (adapter === 'redis') {
      return true;
    }

    if (adapter === 'database') {
      return false;
    }

    // Auto mode
    return !!(process.env.REDIS_URL && process.env.NODE_ENV === 'production');
  }

  /**
   * Get Redis configuration from environment
   */
  private static getRedisConfig(): RedisConfig {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      return this.parseRedisUrl(redisUrl);
    }

    // Manual configuration
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: this.getEnvNumber('REDIS_PORT', 6379),
      password: process.env.REDIS_PASSWORD,
      username: process.env.REDIS_USERNAME,
      db: this.getEnvNumber('REDIS_DATABASE', 0),
      tls: this.getEnvBoolean('REDIS_TLS', false),
      maxRetries: this.getEnvNumber('REDIS_MAX_RETRIES', 3),
      retryDelayOnFailover: this.getEnvNumber('REDIS_RETRY_DELAY', 100),
      enableReadyCheck: this.getEnvBoolean('REDIS_ENABLE_READY_CHECK', true),
      maxRetriesPerRequest: this.getEnvNumber(
        'REDIS_MAX_RETRIES_PER_REQUEST',
        3,
      ),
      lazyConnect: this.getEnvBoolean('REDIS_LAZY_CONNECT', true),
      keepAlive: this.getEnvNumber('REDIS_KEEP_ALIVE', 30000),
      family: this.getEnvNumber('REDIS_FAMILY', 4),
      connectTimeout: this.getEnvNumber('REDIS_CONNECT_TIMEOUT', 10000),
      commandTimeout: this.getEnvNumber('REDIS_COMMAND_TIMEOUT', 5000),
      keyPrefix: process.env.REDIS_KEY_PREFIX,
      clusterMode: this.getEnvBoolean('REDIS_CLUSTER_MODE', false),
      clusterNodes: this.parseClusterNodes(),
    };
  }

  /**
   * Parse Redis URL into configuration object
   */
  private static parseRedisUrl(url: string): RedisConfig {
    try {
      const parsed = new URL(url);

      return {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 6379,
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        db: parsed.pathname ? parseInt(parsed.pathname.slice(1, 10)) || 0 : 0,
        tls: parsed.protocol === 'rediss:',
        maxRetries: 3,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };
    } catch (error) {
      throw new Error(`Invalid Redis URL: ${url}`);
    }
  }

  /**
   * Parse cluster nodes from environment
   */
  private static parseClusterNodes():
    | Array<{ host: string; port: number }>
    | undefined {
    const nodesStr = process.env.REDIS_CLUSTER_NODES;

    if (!nodesStr) {
      return undefined;
    }

    try {
      return nodesStr.split(',').map((node) => {
        const [host, port] = node.trim().split(':');
        return {
          host: host.trim(),
          port: parseInt(port?.trim() || '6379', 10),
        };
      });
    } catch (error) {
      throw new Error(`Invalid Redis cluster nodes format: ${nodesStr}`);
    }
  }

  /**
   * Get environment variable as number
   */
  private static getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }

    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get environment variable as boolean
   */
  private static getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }

    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }

  /**
   * Get environment variable as array
   */
  private static getEnvArray(key: string, defaultValue: string[]): string[] {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

/**
 * Cache configuration validators
 */
export class CacheConfigValidator {
  /**
   * Validate cache configuration
   */
  static validate(config: CacheConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate TTL
    if (config.defaultTTL <= 0) {
      errors.push('defaultTTL must be greater than 0');
    }

    // Validate memory entries
    if (config.maxMemoryEntries <= 0) {
      errors.push('maxMemoryEntries must be greater than 0');
    }

    // Validate adapter configuration
    if (config.adapter === 'redis' && !config.redis) {
      errors.push('Redis configuration required when adapter is set to redis');
    }

    // Validate Redis configuration if present
    if (config.redis) {
      const redisErrors = this.validateRedisConfig(config.redis);
      errors.push(...redisErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate Redis configuration
   */
  private static validateRedisConfig(config: RedisConfig): string[] {
    const errors: string[] = [];

    if (!config.host) {
      errors.push('Redis host is required');
    }

    if (config.port <= 0 || config.port > 65535) {
      errors.push('Redis port must be between 1 and 65535');
    }

    if (config.connectTimeout && config.connectTimeout <= 0) {
      errors.push('Redis connect timeout must be greater than 0');
    }

    if (config.commandTimeout && config.commandTimeout <= 0) {
      errors.push('Redis command timeout must be greater than 0');
    }

    if (
      config.clusterMode &&
      (!config.clusterNodes || config.clusterNodes.length === 0)
    ) {
      errors.push('Cluster nodes required when cluster mode is enabled');
    }

    return errors;
  }
}

/**
 * Get the appropriate cache configuration based on environment
 */
export function getCacheConfig(): CacheConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return CacheConfigFactory.forProduction();
    case 'test':
      return CacheConfigFactory.forTesting();
    case 'development':
    default:
      return CacheConfigFactory.forDevelopment();
  }
}

/**
 * Create cache configuration with overrides
 */
export function createCacheConfig(
  overrides: Partial<CacheConfig> = {},
): CacheConfig {
  const baseConfig = getCacheConfig();
  const config = { ...baseConfig, ...overrides };

  const validation = CacheConfigValidator.validate(config);
  if (!validation.valid) {
    throw new Error(
      `Invalid cache configuration: ${validation.errors.join(', ')}`,
    );
  }

  return config;
}
