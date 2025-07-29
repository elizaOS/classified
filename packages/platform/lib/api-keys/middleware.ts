/**
 * API Key Authentication Middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from './service';
import { setDatabaseContext, clearDatabaseContext } from '../database';

export interface ApiKeyAuthContext {
  apiKey: {
    id: string;
    name: string;
    permissions: string[];
    rateLimit: number;
    organizationId: string;
    userId?: string;
  };
  organization: {
    id: string;
    name: string;
  };
}

/**
 * Middleware to authenticate API key requests
 */
export function apiKeyAuthMiddleware(requiredPermission?: string) {
  return async function (
    request: NextRequest,
    handler: (
      request: NextRequest,
      context: ApiKeyAuthContext,
    ) => Promise<NextResponse>,
  ): Promise<NextResponse> {
    try {
      // Extract API key from Authorization header
      const authHeader = request.headers.get('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'missing_api_key',
              message:
                'API key is required. Please provide your API key in the Authorization header as "Bearer YOUR_API_KEY".',
            },
          },
          { status: 401 },
        );
      }

      const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify API key
      const verification = await apiKeyService.verifyApiKey(apiKey);

      if (
        !verification.isValid ||
        !verification.apiKey ||
        !verification.organizationId
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'invalid_api_key',
              message: 'Invalid or expired API key.',
            },
          },
          { status: 401 },
        );
      }

      // Check required permission
      if (
        requiredPermission &&
        !apiKeyService.hasPermission(verification.apiKey, requiredPermission)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'insufficient_permissions',
              message: `This API key does not have the required permission: ${requiredPermission}`,
              details: {
                required: requiredPermission,
                available: verification.apiKey.permissions,
              },
            },
          },
          { status: 403 },
        );
      }

      // Set database context for the request
      await setDatabaseContext({
        organizationId: verification.organizationId,
        userId: verification.apiKey.id, // Use API key ID as user context
        isAdmin:
          verification.apiKey.permissions.includes('admin') ||
          verification.apiKey.permissions.includes('*'),
      });

      // Create context object
      const context: ApiKeyAuthContext = {
        apiKey: {
          id: verification.apiKey.id,
          name: verification.apiKey.name,
          permissions: verification.apiKey.permissions,
          rateLimit: verification.apiKey.rateLimit,
          organizationId: verification.organizationId,
        },
        organization: {
          id: verification.organizationId,
          name: 'Organization', // TODO: Fetch organization details
        },
      };

      try {
        // Call the handler with the context
        const response = await handler(request, context);
        return response;
      } finally {
        // Clean up database context
        await clearDatabaseContext();
      }
    } catch (error) {
      console.error('API key auth middleware error:', error);

      // Clean up context on error
      try {
        await clearDatabaseContext();
      } catch {}

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'internal_error',
            message: 'An internal error occurred during authentication.',
          },
        },
        { status: 500 },
      );
    }
  };
}

/**
 * Rate limiting middleware for API keys
 */
export function apiKeyRateLimitMiddleware() {
  // Simple in-memory rate limiter (use Redis in production)
  const rateLimitStore = new Map<
    string,
    { count: number; resetTime: number }
  >();

  return async function (
    request: NextRequest,
    context: ApiKeyAuthContext,
    handler: (
      request: NextRequest,
      context: ApiKeyAuthContext,
    ) => Promise<NextResponse>,
  ): Promise<NextResponse> {
    const { apiKey } = context;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const limit = apiKey.rateLimit;

    // Get current rate limit data
    const key = `api_key:${apiKey.id}`;
    let rateLimitData = rateLimitStore.get(key);

    // Reset if window has passed
    if (!rateLimitData || now > rateLimitData.resetTime) {
      rateLimitData = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    // Check if limit exceeded
    if (rateLimitData.count >= limit) {
      const resetIn = Math.ceil((rateLimitData.resetTime - now) / 1000);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'rate_limit_exceeded',
            message: `Rate limit exceeded. Maximum ${limit} requests per minute allowed.`,
            details: {
              limit,
              resetIn,
            },
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitData.resetTime.toString(),
          },
        },
      );
    }

    // Increment counter
    rateLimitData.count++;
    rateLimitStore.set(key, rateLimitData);

    // Add rate limit headers to response
    const response = await handler(request, context);

    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set(
      'X-RateLimit-Remaining',
      (limit - rateLimitData.count).toString(),
    );
    response.headers.set(
      'X-RateLimit-Reset',
      rateLimitData.resetTime.toString(),
    );

    return response;
  };
}

/**
 * Combined API key authentication and rate limiting middleware
 */
export function createApiKeyMiddleware(requiredPermission?: string) {
  const authMiddleware = apiKeyAuthMiddleware(requiredPermission);
  const rateLimitMiddleware = apiKeyRateLimitMiddleware();

  return async function (
    request: NextRequest,
    handler: (
      request: NextRequest,
      context: ApiKeyAuthContext,
    ) => Promise<NextResponse>,
  ): Promise<NextResponse> {
    return authMiddleware(request, async (req, context) => {
      return rateLimitMiddleware(req, context, handler);
    });
  };
}

/**
 * Utility to check API key permissions
 */
export function requirePermission(permission: string) {
  return function (context: ApiKeyAuthContext): boolean {
    return apiKeyService.hasPermission(context.apiKey, permission);
  };
}

/**
 * Utility to check if API key has admin access
 */
export function requireAdmin(context: ApiKeyAuthContext): boolean {
  return (
    context.apiKey.permissions.includes('admin') ||
    context.apiKey.permissions.includes('*')
  );
}
