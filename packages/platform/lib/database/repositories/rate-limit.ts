/**
 * Rate Limiting Repository for persistent rate limiting storage
 * Replaces in-memory rate limiting with database-backed implementation
 */

import { eq, and, gte, lt } from 'drizzle-orm';
import { getDatabaseClient } from '../client';
import { rateLimits, type RateLimit, type NewRateLimit } from '../schema';

export interface RateLimitCheck {
  allowed: boolean;
  retryAfter: number; // seconds
  remainingRequests: number;
  resetTime: Date;
}

export class RateLimitRepository {
  private get db() {
    return getDatabaseClient();
  }

  /**
   * Check and update rate limit for a given key
   */
  async checkRateLimit(
    limitKey: string,
    maxRequests: number,
    windowDuration: number, // seconds
  ): Promise<RateLimitCheck> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowDuration * 1000);

    // Try to get existing rate limit record
    const [existing] = await this.db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.limitKey, limitKey))
      .limit(1);

    if (!existing) {
      // Create new rate limit record
      const windowEnd = new Date(now.getTime() + windowDuration * 1000);

      await this.db.insert(rateLimits).values({
        limitKey,
        requestCount: 1,
        windowStart: now,
        windowEnd,
        maxRequests,
        windowDuration,
      });

      return {
        allowed: true,
        retryAfter: 0,
        remainingRequests: maxRequests - 1,
        resetTime: windowEnd,
      };
    }

    // Check if the window has expired
    if (now > existing.windowEnd) {
      // Reset the window
      const newWindowEnd = new Date(now.getTime() + windowDuration * 1000);

      await this.db
        .update(rateLimits)
        .set({
          requestCount: 1,
          windowStart: now,
          windowEnd: newWindowEnd,
          maxRequests,
          windowDuration,
          updatedAt: now,
        })
        .where(eq(rateLimits.limitKey, limitKey));

      return {
        allowed: true,
        retryAfter: 0,
        remainingRequests: maxRequests - 1,
        resetTime: newWindowEnd,
      };
    }

    // Window is still active, check if limit exceeded
    if (existing.requestCount >= maxRequests) {
      const retryAfter = Math.ceil(
        (existing.windowEnd.getTime() - now.getTime()) / 1000,
      );

      return {
        allowed: false,
        retryAfter,
        remainingRequests: 0,
        resetTime: existing.windowEnd,
      };
    }

    // Increment the counter
    const newCount = existing.requestCount + 1;

    await this.db
      .update(rateLimits)
      .set({
        requestCount: newCount,
        updatedAt: now,
      })
      .where(eq(rateLimits.limitKey, limitKey));

    return {
      allowed: true,
      retryAfter: 0,
      remainingRequests: maxRequests - newCount,
      resetTime: existing.windowEnd,
    };
  }

  /**
   * Clean up expired rate limit records
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();

    const result = await this.db
      .delete(rateLimits)
      .where(lt(rateLimits.windowEnd, now))
      .returning();

    return result.length;
  }

  /**
   * Get current rate limit status for a key
   */
  async getStatus(limitKey: string): Promise<RateLimitCheck | null> {
    const [existing] = await this.db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.limitKey, limitKey))
      .limit(1);

    if (!existing) {
      return null;
    }

    const now = new Date();

    if (now > existing.windowEnd) {
      // Window expired
      return null;
    }

    const remainingRequests = Math.max(
      0,
      existing.maxRequests - existing.requestCount,
    );
    const retryAfter =
      remainingRequests > 0
        ? 0
        : Math.ceil((existing.windowEnd.getTime() - now.getTime()) / 1000);

    return {
      allowed: remainingRequests > 0,
      retryAfter,
      remainingRequests,
      resetTime: existing.windowEnd,
    };
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  async reset(limitKey: string): Promise<boolean> {
    const result = await this.db
      .delete(rateLimits)
      .where(eq(rateLimits.limitKey, limitKey))
      .returning();

    return result.length > 0;
  }

  /**
   * Get rate limiting statistics
   */
  async getStats(): Promise<{
    totalLimits: number;
    activeLimits: number;
    expiredLimits: number;
  }> {
    const now = new Date();

    // Get total count
    const totalLimits = await this.db.select().from(rateLimits);

    // Get active limits (not expired)
    const activeLimits = await this.db
      .select()
      .from(rateLimits)
      .where(gte(rateLimits.windowEnd, now));

    // Get expired limits
    const expiredLimits = await this.db
      .select()
      .from(rateLimits)
      .where(lt(rateLimits.windowEnd, now));

    return {
      totalLimits: totalLimits.length,
      activeLimits: activeLimits.length,
      expiredLimits: expiredLimits.length,
    };
  }

  /**
   * Create rate limit key from IP and endpoint
   */
  static createKey(clientIP: string, endpoint: string): string {
    return `${clientIP}:${endpoint}`;
  }
}

// Export singleton instance
export const rateLimitRepository = new RateLimitRepository();
