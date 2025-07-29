/**
 * Advanced Rate Limiting System
 *
 * Implements sophisticated rate limiting with multiple algorithms,
 * user-based limits, IP-based limits, and integration with audit logging.
 */

import { NextRequest } from 'next/server';
import { getSql } from '../database';
import { logger } from '../logger';
import { auditLogger, AuditEventType, AuditSeverity } from './audit-logger';

export enum RateLimitAlgorithm {
  FIXED_WINDOW = 'fixed_window',
  SLIDING_WINDOW = 'sliding_window',
  TOKEN_BUCKET = 'token_bucket',
  LEAKY_BUCKET = 'leaky_bucket',
}

export interface RateLimitConfig {
  algorithm: RateLimitAlgorithm;
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (key: string, request: NextRequest) => void;

  // Token bucket specific
  tokensPerInterval?: number;
  interval?: number;

  // Sliding window specific
  precision?: number; // Number of sub-windows

  // Global settings
  enabled?: boolean;
  whitelistedIPs?: string[];
  blacklistedIPs?: string[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  totalHits: number;
  retryAfter?: number;
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitData | null>;
  set(key: string, data: RateLimitData, ttl: number): Promise<void>;
  increment(key: string, windowStart: number, ttl: number): Promise<number>;
  delete(key: string): Promise<void>;
}

export interface RateLimitData {
  count: number;
  windowStart: number;
  tokens?: number; // For token bucket
  lastRefill?: number; // For token bucket
}

/**
 * In-Memory Rate Limit Store (for development/testing)
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { data: RateLimitData; expires: number }>();

  async get(key: string): Promise<RateLimitData | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  async set(key: string, data: RateLimitData, ttl: number): Promise<void> {
    this.store.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  async increment(
    key: string,
    windowStart: number,
    ttl: number,
  ): Promise<number> {
    const existing = await this.get(key);
    const newCount =
      existing && existing.windowStart === windowStart ? existing.count + 1 : 1;

    await this.set(key, { count: newCount, windowStart }, ttl);
    return newCount;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expires < now) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis Rate Limit Store (for production)
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: any; // Redis client

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<RateLimitData | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis rate limit get error', error as Error);
      return null;
    }
  }

  async set(key: string, data: RateLimitData, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, Math.ceil(ttl / 1000), JSON.stringify(data));
    } catch (error) {
      logger.error('Redis rate limit set error', error as Error);
    }
  }

  async increment(
    key: string,
    windowStart: number,
    ttl: number,
  ): Promise<number> {
    try {
      const pipeline = this.redis.pipeline();
      const tempKey = `${key}:${windowStart}`;

      pipeline.incr(tempKey);
      pipeline.expire(tempKey, Math.ceil(ttl / 1000));

      const results = await pipeline.exec();
      return results[0][1];
    } catch (error) {
      logger.error('Redis rate limit increment error', error as Error);
      return 1;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis rate limit delete error', error as Error);
    }
  }
}

/**
 * Advanced Rate Limiter
 */
export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig, store?: RateLimitStore) {
    const defaults: Required<RateLimitConfig> = {
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      keyGenerator: this.defaultKeyGenerator.bind(this),
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      onLimitReached: this.defaultOnLimitReached.bind(this),
      tokensPerInterval: 10,
      interval: 1000,
      precision: 10,
      enabled: true,
      whitelistedIPs: [],
      blacklistedIPs: [],
    };

    this.config = { ...defaults, ...config } as Required<RateLimitConfig>;

    this.store = store || new MemoryRateLimitStore();
  }

  /**
   * Check if request is within rate limits
   */
  async checkLimit(request: NextRequest): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: new Date(Date.now() + this.config.windowMs),
        totalHits: 0,
      };
    }

    const key = this.config.keyGenerator(request);
    const ip = this.getClientIP(request);

    // Check IP whitelist/blacklist
    if (this.config.whitelistedIPs.includes(ip)) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: new Date(Date.now() + this.config.windowMs),
        totalHits: 0,
      };
    }

    if (this.config.blacklistedIPs.includes(ip)) {
      await this.logRateLimitViolation(key, request, 'Blacklisted IP');
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + this.config.windowMs),
        totalHits: 0,
        retryAfter: Math.ceil(this.config.windowMs / 1000),
      };
    }

    // Apply rate limiting algorithm
    let result: RateLimitResult;

    switch (this.config.algorithm) {
      case RateLimitAlgorithm.FIXED_WINDOW:
        result = await this.fixedWindowCheck(key);
        break;
      case RateLimitAlgorithm.SLIDING_WINDOW:
        result = await this.slidingWindowCheck(key);
        break;
      case RateLimitAlgorithm.TOKEN_BUCKET:
        result = await this.tokenBucketCheck(key);
        break;
      case RateLimitAlgorithm.LEAKY_BUCKET:
        result = await this.leakyBucketCheck(key);
        break;
      default:
        result = await this.slidingWindowCheck(key);
    }

    // Log rate limit violations
    if (!result.allowed) {
      await this.logRateLimitViolation(key, request, 'Rate limit exceeded');
      this.config.onLimitReached(key, request);
    }

    return result;
  }

  /**
   * Fixed Window Rate Limiting
   */
  private async fixedWindowCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart =
      Math.floor(now / this.config.windowMs) * this.config.windowMs;

    const count = await this.store.increment(
      key,
      windowStart,
      this.config.windowMs,
    );
    const resetTime = new Date(windowStart + this.config.windowMs);

    return {
      allowed: count <= this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - count),
      resetTime,
      totalHits: count,
      retryAfter:
        count > this.config.maxRequests
          ? Math.ceil((resetTime.getTime() - now) / 1000)
          : undefined,
    };
  }

  /**
   * Sliding Window Rate Limiting
   */
  private async slidingWindowCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSize = this.config.windowMs;
    const precision = this.config.precision;
    const subWindowSize = Math.floor(windowSize / precision);

    // Calculate which sub-windows to check
    const currentSubWindow = Math.floor(now / subWindowSize);
    const windowStart = currentSubWindow - precision + 1;

    let totalCount = 0;
    const promises: Promise<number>[] = [];

    // Count requests in each sub-window
    for (let i = 0; i < precision; i++) {
      const subWindowKey = `${key}:${windowStart + i}`;
      promises.push(
        this.getSubWindowCount(subWindowKey, windowStart + i, subWindowSize),
      );
    }

    const counts = await Promise.all(promises);
    totalCount = counts.reduce((sum, count) => sum + count, 0);

    // Increment current sub-window
    const currentKey = `${key}:${currentSubWindow}`;
    await this.store.increment(currentKey, currentSubWindow, windowSize);
    totalCount += 1;

    const resetTime = new Date((currentSubWindow + 1) * subWindowSize);

    return {
      allowed: totalCount <= this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - totalCount),
      resetTime,
      totalHits: totalCount,
      retryAfter:
        totalCount > this.config.maxRequests
          ? Math.ceil(subWindowSize / 1000)
          : undefined,
    };
  }

  /**
   * Token Bucket Rate Limiting
   */
  private async tokenBucketCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const data = await this.store.get(key);

    let tokens = this.config.maxRequests;
    let lastRefill = now;

    if (data && data.tokens !== undefined && data.lastRefill) {
      tokens = data.tokens;
      lastRefill = data.lastRefill;

      // Refill tokens based on elapsed time
      const elapsed = now - lastRefill;
      const tokensToAdd =
        Math.floor(elapsed / this.config.interval) *
        this.config.tokensPerInterval;
      tokens = Math.min(this.config.maxRequests, tokens + tokensToAdd);
      lastRefill = now;
    }

    const allowed = tokens > 0;
    if (allowed) {
      tokens -= 1;
    }

    await this.store.set(
      key,
      {
        count: 0, // Not used for token bucket
        windowStart: now,
        tokens,
        lastRefill,
      },
      this.config.windowMs,
    );

    return {
      allowed,
      remaining: tokens,
      resetTime: new Date(now + this.config.windowMs),
      totalHits: this.config.maxRequests - tokens,
      retryAfter: allowed ? undefined : Math.ceil(this.config.interval / 1000),
    };
  }

  /**
   * Leaky Bucket Rate Limiting
   */
  private async leakyBucketCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const data = await this.store.get(key);

    let count = 0;
    let lastUpdate = now;

    if (data) {
      count = data.count;
      lastUpdate = data.windowStart;

      // Leak tokens based on elapsed time
      const elapsed = now - lastUpdate;
      const leakRate = this.config.tokensPerInterval / this.config.interval;
      const tokensToLeak = Math.floor(elapsed * leakRate);
      count = Math.max(0, count - tokensToLeak);
    }

    const allowed = count < this.config.maxRequests;
    if (allowed) {
      count += 1;
    }

    await this.store.set(
      key,
      {
        count,
        windowStart: now,
      },
      this.config.windowMs,
    );

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - count),
      resetTime: new Date(now + this.config.windowMs),
      totalHits: count,
      retryAfter: allowed
        ? undefined
        : Math.ceil(
            (count - this.config.maxRequests) /
              ((this.config.tokensPerInterval / this.config.interval) * 1000),
          ),
    };
  }

  /**
   * Get sub-window count for sliding window
   */
  private async getSubWindowCount(
    key: string,
    windowStart: number,
    ttl: number,
  ): Promise<number> {
    const data = await this.store.get(key);
    if (!data || data.windowStart !== windowStart) {
      return 0;
    }
    return data.count;
  }

  /**
   * Default key generator (IP-based)
   */
  private defaultKeyGenerator(request: NextRequest): string {
    const ip = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const path = new URL(request.url).pathname;
    return `rate_limit:${ip}:${path}:${this.hashString(userAgent)}`;
  }

  /**
   * Get client IP address
   */
  private getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');

    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    return realIP || 'unknown';
  }

  /**
   * Hash string for consistent key generation
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Default rate limit reached handler
   */
  private defaultOnLimitReached(key: string, request: NextRequest): void {
    logger.warn('Rate limit exceeded', {
      key,
      ip: this.getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      path: new URL(request.url).pathname,
    });
  }

  /**
   * Log rate limit violation to audit system
   */
  private async logRateLimitViolation(
    key: string,
    request: NextRequest,
    reason: string,
  ): Promise<void> {
    const ip = this.getClientIP(request);
    const path = new URL(request.url).pathname;

    await auditLogger.logRateLimitExceeded(
      undefined, // No user ID for rate limit violations
      path,
      this.config.maxRequests,
      {
        attempts: 1, // Could be enhanced to track actual attempt count
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
        source: 'rate-limiter',
        timestamp: new Date(),
        reason,
        algorithm: this.config.algorithm,
        windowMs: this.config.windowMs,
      },
    );
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key: string): Promise<void> {
    await this.store.delete(key);
  }

  /**
   * Get current rate limit status
   */
  async getStatus(key: string): Promise<RateLimitData | null> {
    return await this.store.get(key);
  }
}

/**
 * Rate Limit Configurations for different endpoints
 */
export const rateLimitConfigs = {
  // Strict limits for authentication endpoints
  auth: {
    algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts per 15 minutes
    precision: 5,
  },

  // API endpoints
  api: {
    algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    tokensPerInterval: 10,
    interval: 6000, // Refill 10 tokens every 6 seconds
  },

  // File uploads
  upload: {
    algorithm: RateLimitAlgorithm.LEAKY_BUCKET,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
    tokensPerInterval: 1,
    interval: 6000, // 1 upload every 6 seconds
  },

  // Dashboard/UI
  dashboard: {
    algorithm: RateLimitAlgorithm.FIXED_WINDOW,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },

  // Webhooks
  webhook: {
    algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // High limit for webhooks
    precision: 10,
  },
} as const;

/**
 * Create rate limiter middleware
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig,
  store?: RateLimitStore,
) {
  const limiter = new RateLimiter(config, store);

  return async function rateLimitMiddleware(request: NextRequest) {
    const result = await limiter.checkLimit(request);

    if (!result.allowed) {
      const response = new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toISOString(),
            'Retry-After': (result.retryAfter || 60).toString(),
          },
        },
      );

      return response;
    }

    // Add rate limit headers to successful responses
    const response = new Response(null, {
      headers: {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toISOString(),
      },
    });

    return response;
  };
}

// Export default instances
export const authRateLimiter = new RateLimiter(rateLimitConfigs.auth);
export const apiRateLimiter = new RateLimiter(rateLimitConfigs.api);
export const uploadRateLimiter = new RateLimiter(rateLimitConfigs.upload);
export const dashboardRateLimiter = new RateLimiter(rateLimitConfigs.dashboard);
export const webhookRateLimiter = new RateLimiter(rateLimitConfigs.webhook);
