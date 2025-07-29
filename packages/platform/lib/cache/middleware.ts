/**
 * Cache Middleware for Next.js API Routes
 *
 * Provides middleware functions for automatic request/response caching
 * with intelligent cache key generation and invalidation strategies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from './index';
import { logger } from '../logger';

export interface CacheMiddlewareOptions {
  ttl?: number;
  tags?: string[];
  vary?: string[]; // Headers to include in cache key
  condition?: (request: NextRequest) => boolean;
  keyGenerator?: (request: NextRequest) => string;
  skipMethods?: string[];
  skipAuth?: boolean;
}

/**
 * Cache middleware factory for Next.js API routes
 */
export function withCache(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    tags = [],
    vary = ['authorization', 'user-agent'],
    condition = () => true,
    keyGenerator = generateDefaultKey,
    skipMethods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    skipAuth = false,
  } = options;

  return function cacheMiddleware<T extends any[], R>(
    handler: (...args: T) => Promise<NextResponse> | NextResponse,
  ) {
    return async function cachedHandler(...args: T): Promise<NextResponse> {
      const request = args[0] as NextRequest;

      // Skip caching for certain methods
      if (skipMethods.includes(request.method)) {
        return await handler(...args);
      }

      // Skip if condition is false
      if (!condition(request)) {
        return await handler(...args);
      }

      const cacheKey = keyGenerator(request);

      try {
        // Try to get cached response
        const cached = await cacheManager.get<CachedResponse>(cacheKey);

        if (cached) {
          logger.debug('Cache hit for API request', {
            method: request.method,
            url: request.url,
            key: cacheKey,
          });

          return new NextResponse(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: {
              ...cached.headers,
              'X-Cache': 'HIT',
              'X-Cache-Key': cacheKey,
            },
          });
        }

        // Execute handler
        const response = await handler(...args);

        // Cache successful responses
        if (response.status >= 200 && response.status < 300) {
          const responseBody = await response.text();
          const responseHeaders: Record<string, string> = {};

          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });

          const cachedResponse: CachedResponse = {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            timestamp: Date.now(),
          };

          await cacheManager.set(cacheKey, cachedResponse, {
            ttl,
            tags: [
              ...tags,
              `method:${request.method}`,
              `status:${response.status}`,
            ],
          });

          logger.debug('Cached API response', {
            method: request.method,
            url: request.url,
            key: cacheKey,
            status: response.status,
            ttl,
          });

          // Return response with cache headers
          return new NextResponse(responseBody, {
            status: response.status,
            statusText: response.statusText,
            headers: {
              ...responseHeaders,
              'X-Cache': 'MISS',
              'X-Cache-Key': cacheKey,
            },
          });
        }

        return response;
      } catch (error) {
        logger.error('Cache middleware error', error as Error, {
          method: request.method,
          url: request.url,
          key: cacheKey,
        });

        // Always execute handler if cache fails
        return await handler(...args);
      }
    };
  };
}

/**
 * Cached response interface
 */
interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

/**
 * Generate default cache key from request
 */
function generateDefaultKey(request: NextRequest): string {
  const url = new URL(request.url);
  const method = request.method;

  // Include relevant headers in cache key
  const varyHeaders: string[] = [];
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // Use hash of auth header to avoid exposing tokens in cache keys
    const authHash = hashString(authHeader);
    varyHeaders.push(`auth:${authHash}`);
  }

  const userAgent = request.headers.get('user-agent');
  if (userAgent) {
    const agentHash = hashString(userAgent);
    varyHeaders.push(`ua:${agentHash.slice(0, 8)}`); // Short hash for user agent
  }

  // Build cache key
  const keyParts = [
    'api',
    method.toLowerCase(),
    url.pathname.replace(/[^a-zA-Z0-9]/g, '_'),
    url.search ? hashString(url.search) : '',
    ...varyHeaders,
  ].filter(Boolean);

  return keyParts.join(':');
}

/**
 * Simple string hash function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Cache invalidation middleware
 */
export function withCacheInvalidation(tags: string[]) {
  return function invalidationMiddleware<T extends any[], R>(
    handler: (...args: T) => Promise<NextResponse> | NextResponse,
  ) {
    return async function invalidatingHandler(
      ...args: T
    ): Promise<NextResponse> {
      const request = args[0] as NextRequest;

      try {
        const response = await handler(...args);

        // Invalidate cache tags on successful mutations
        if (response.status >= 200 && response.status < 300) {
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            await cacheManager.invalidateByTags(tags);

            logger.debug('Cache invalidated after mutation', {
              method: request.method,
              url: request.url,
              tags,
            });
          }
        }

        return response;
      } catch (error) {
        logger.error('Cache invalidation middleware error', error as Error, {
          method: request.method,
          url: request.url,
          tags,
        });

        throw error;
      }
    };
  };
}

/**
 * Database-specific cache middleware
 */
export function withDatabaseCache(
  options: {
    table: string;
    ttl?: number;
    invalidateOnMutation?: boolean;
  } = { table: 'unknown' },
) {
  const { table, ttl = 600, invalidateOnMutation = true } = options;

  return withCache({
    ttl,
    tags: [`table:${table}`],
    condition: (request) => {
      // Only cache GET requests by default
      return request.method === 'GET';
    },
    keyGenerator: (request) => {
      const url = new URL(request.url);
      return `db:${table}:${url.pathname}:${url.search}`;
    },
  });
}

/**
 * User-specific cache middleware
 */
export function withUserCache(
  options: {
    ttl?: number;
    includeOrganization?: boolean;
  } = {},
) {
  const { ttl = 300, includeOrganization = true } = options;

  return withCache({
    ttl,
    tags: ['users'],
    keyGenerator: (request) => {
      const url = new URL(request.url);
      const authHeader = request.headers.get('authorization');
      const userHash = authHeader ? hashString(authHeader) : 'anonymous';

      const keyParts = [
        'user',
        userHash,
        url.pathname.replace(/[^a-zA-Z0-9]/g, '_'),
        url.search ? hashString(url.search) : '',
      ];

      return keyParts.filter(Boolean).join(':');
    },
  });
}

/**
 * Analytics cache middleware for expensive queries
 */
export function withAnalyticsCache(
  options: {
    ttl?: number;
    granularity?: 'hour' | 'day' | 'week' | 'month';
  } = {},
) {
  const { ttl = 1800, granularity = 'hour' } = options; // 30 minutes default

  return withCache({
    ttl,
    tags: ['analytics', `granularity:${granularity}`],
    keyGenerator: (request) => {
      const url = new URL(request.url);

      // Round timestamp based on granularity for better cache hit rates
      const now = new Date();
      let timeKey: string;

      switch (granularity) {
        case 'hour':
          timeKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
          break;
        case 'day':
          timeKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
          break;
        case 'week':
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          timeKey = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
          break;
        case 'month':
          timeKey = `${now.getFullYear()}-${now.getMonth()}`;
          break;
        default:
          timeKey = now.toISOString();
      }

      return `analytics:${timeKey}:${url.pathname}:${url.search}`;
    },
  });
}

/**
 * Cache warming utility
 */
export async function warmupApiCache(
  routes: Array<{
    path: string;
    method?: string;
    headers?: Record<string, string>;
  }>,
) {
  const results = await Promise.allSettled(
    routes.map(async ({ path, method = 'GET', headers = {} }) => {
      try {
        const url = new URL(
          path,
          process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333',
        );

        const response = await fetch(url.toString(), {
          method,
          headers: {
            'User-Agent': 'cache-warmup',
            ...headers,
          },
        });

        if (response.ok) {
          logger.debug('Cache warmed for route', {
            path,
            method,
            status: response.status,
          });
          return { success: true, path, method };
        } else {
          logger.warn('Cache warmup failed for route', {
            path,
            method,
            status: response.status,
          });
          return { success: false, path, method, status: response.status };
        }
      } catch (error) {
        logger.error('Cache warmup error', error as Error, { path, method });
        return {
          success: false,
          path,
          method,
          error: (error as Error).message,
        };
      }
    }),
  );

  const successful = results.filter(
    (result) => result.status === 'fulfilled' && result.value.success,
  ).length;

  logger.info('Cache warmup completed', {
    total: routes.length,
    successful,
    failed: routes.length - successful,
  });

  return {
    total: routes.length,
    successful,
    failed: routes.length - successful,
  };
}
