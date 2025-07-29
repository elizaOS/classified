/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and ensures webhook security
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiErrorHandler, ErrorCode } from '../api/error-handler';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (request: NextRequest) => string;
  onLimitReached?: (request: NextRequest) => void;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequestTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  private getKey(
    request: NextRequest,
    keyGenerator?: (req: NextRequest) => string,
  ): string {
    if (keyGenerator) {
      return keyGenerator(request);
    }

    // Default key generation: IP + User-Agent + Path
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const path = new URL(request.url).pathname;

    return `${ip}:${userAgent}:${path}`;
  }

  async checkLimit(
    request: NextRequest,
    config: RateLimitConfig,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    totalHits: number;
  }> {
    const key = this.getKey(request, config.keyGenerator);
    const now = Date.now();
    const resetTime = now + config.windowMs;

    let entry = this.store.get(key);

    // Initialize or reset window
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime,
        firstRequestTime: now,
      };
      this.store.set(key, entry);
    }

    entry.count++;

    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);

    if (!allowed && config.onLimitReached) {
      config.onLimitReached(request);
    }

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
      totalHits: entry.count,
    };
  }

  getStats(): {
    totalKeys: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const now = Date.now();
    let oldest = now;
    let newest = 0;

    for (const entry of this.store.values()) {
      oldest = Math.min(oldest, entry.firstRequestTime);
      newest = Math.max(newest, entry.firstRequestTime);
    }

    return {
      totalKeys: this.store.size,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter();

/**
 * Create rate limiting middleware
 */
export function createRateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      const result = await globalRateLimiter.checkLimit(request, config);

      // Add rate limit headers
      const headers = new Headers();
      headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set(
        'X-RateLimit-Reset',
        Math.ceil(result.resetTime / 1000).toString(),
      );

      if (!result.allowed) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many requests. Please try again later.',
              details: {
                limit: config.maxRequests,
                windowMs: config.windowMs,
                resetTime: result.resetTime,
              },
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...Object.fromEntries(headers.entries()),
              'Retry-After': Math.ceil(
                (result.resetTime - Date.now()) / 1000,
              ).toString(),
            },
          },
        );
      }

      // Request allowed - headers will be added to the final response
      return null;
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Don't block requests if rate limiter fails
      return null;
    }
  };
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  // Webhook endpoints - strict limits
  WEBHOOK: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute per source
    keyGenerator: (request: NextRequest) => {
      // Use stripe signature or IP for webhook rate limiting
      const signature = request.headers.get('stripe-signature');
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      return signature ? `webhook:${signature.split(',')[0]}` : `webhook:${ip}`;
    },
  },

  // API endpoints - moderate limits
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // 1000 requests per 15 minutes
  },

  // Authentication endpoints - strict limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 auth attempts per 15 minutes
    keyGenerator: (request: NextRequest) => {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      return `auth:${ip}`;
    },
  },

  // Payment endpoints - strict limits
  PAYMENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 payment attempts per minute
    keyGenerator: (request: NextRequest) => {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      return `payment:${ip}:${userAgent}`;
    },
  },

  // General API - lenient limits
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 500, // 500 requests per 15 minutes
  },
} as const;

/**
 * Webhook-specific rate limiter with additional security
 */
export class WebhookRateLimiter {
  private static instance: WebhookRateLimiter;
  private suspiciousActivity = new Map<string, number>();

  static getInstance(): WebhookRateLimiter {
    if (!this.instance) {
      this.instance = new WebhookRateLimiter();
    }
    return this.instance;
  }

  async checkWebhookSecurity(request: NextRequest): Promise<{
    allowed: boolean;
    reason?: string;
    suspiciousActivity?: boolean;
  }> {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const signature = request.headers.get('stripe-signature');
    const contentLength = parseInt(
      request.headers.get('content-length') || '0',
      10,
    );

    // Check for missing signature
    if (!signature) {
      this.recordSuspiciousActivity(ip, 'missing_signature');
      return {
        allowed: false,
        reason: 'Missing webhook signature',
        suspiciousActivity: true,
      };
    }

    // Check for suspicious payload size
    if (contentLength > 1024 * 1024) {
      // 1MB limit
      this.recordSuspiciousActivity(ip, 'large_payload');
      return {
        allowed: false,
        reason: 'Payload too large',
        suspiciousActivity: true,
      };
    }

    // Check for repeat suspicious activity
    const suspiciousCount = this.suspiciousActivity.get(ip) || 0;
    if (suspiciousCount > 10) {
      return {
        allowed: false,
        reason: 'IP blocked due to suspicious activity',
        suspiciousActivity: true,
      };
    }

    return { allowed: true };
  }

  private recordSuspiciousActivity(ip: string, reason: string): void {
    const count = this.suspiciousActivity.get(ip) || 0;
    this.suspiciousActivity.set(ip, count + 1);

    console.warn(
      `Suspicious webhook activity from ${ip}: ${reason} (count: ${count + 1})`,
    );

    // Clean up old entries periodically
    if (this.suspiciousActivity.size > 1000) {
      this.cleanupSuspiciousActivity();
    }
  }

  private cleanupSuspiciousActivity(): void {
    // Remove entries older than 1 hour
    // In a real implementation, you'd want to store timestamps
    if (this.suspiciousActivity.size > 500) {
      this.suspiciousActivity.clear();
    }
  }

  getSuspiciousActivityStats(): Record<string, number> {
    return Object.fromEntries(this.suspiciousActivity.entries());
  }
}

/**
 * Utility function to apply rate limiting to API routes
 */
export function withRateLimit(config: RateLimitConfig) {
  return function <T extends any[], R>(
    handler: (...args: T) => Promise<NextResponse<R>>,
  ) {
    return async (...args: T): Promise<NextResponse<R>> => {
      const request = args[0] as NextRequest;

      const rateLimitResponse = await createRateLimit(config)(request);
      if (rateLimitResponse) {
        return rateLimitResponse as NextResponse<R>;
      }

      return handler(...args);
    };
  };
}

export { globalRateLimiter };
