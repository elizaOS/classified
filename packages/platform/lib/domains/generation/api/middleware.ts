/**
 * Generation API Middleware
 * Authentication, validation, rate limiting, and billing middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken } from '@/lib/auth';
import { validateRateLimit, validateContentType } from './validation';
import { getBillingService } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { isAuthPayload } from '@/lib/types/common';

export interface MiddlewareContext {
  userId: string;
  organizationId: string;
  userRole: string;
  isAuthenticated: boolean;
  rateLimitRemaining: number;
  billingStatus: {
    hasActiveSubscription: boolean;
    creditsRemaining: number;
    canGenerate: boolean;
  };
}

/**
 * Authentication middleware
 */
export async function authMiddleware(req: NextRequest): Promise<{
  authorized: boolean;
  context?: MiddlewareContext;
  response?: NextResponse;
}> {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.get('Authorization');
    const token =
      authHeader?.replace('Bearer ', '') ||
      req.cookies.get('auth-token')?.value;

    if (!token) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Authentication token required',
            code: 'MISSING_TOKEN',
          },
          { status: 401 },
        ),
      };
    }

    // Verify JWT token
    const payload = await verifyJwtToken(token);

    if (!payload || !payload.userId || !payload.organizationId) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Invalid authentication token',
            code: 'INVALID_TOKEN',
          },
          { status: 401 },
        ),
      };
    }

    // Check if user/organization is active
    if (
      payload.status === 'inactive' ||
      payload.organizationStatus === 'suspended'
    ) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Account suspended',
            code: 'ACCOUNT_SUSPENDED',
          },
          { status: 403 },
        ),
      };
    }

    const context: MiddlewareContext = {
      userId: payload.userId,
      organizationId: payload.organizationId,
      userRole: payload.role || 'user',
      isAuthenticated: true,
      rateLimitRemaining: 0, // Will be set by rate limit middleware
      billingStatus: {
        hasActiveSubscription: false,
        creditsRemaining: 0,
        canGenerate: false,
      }, // Will be set by billing middleware
    };

    return {
      authorized: true,
      context,
    };
  } catch (error) {
    logger.error(
      'Auth middleware error:',
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_ERROR',
        },
        { status: 401 },
      ),
    };
  }
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  req: NextRequest,
  context: MiddlewareContext,
): Promise<{ allowed: boolean; response?: NextResponse; remaining: number }> {
  try {
    // Get rate limit data from cache/database
    const rateLimitKey = `rate_limit:${context.organizationId}:${context.userId}`;
    const currentCount = await getCurrentRequestCount(rateLimitKey);

    // Check rate limits based on user role/plan
    const limits = getRateLimits(context.userRole);
    const rateCheck = validateRateLimit(
      context.userId,
      currentCount,
      limits.windowMs,
    );

    if (!rateCheck.allowed) {
      const resetTime = rateCheck.resetTime || Date.now() + limits.windowMs;

      return {
        allowed: false,
        remaining: 0,
        response: NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            resetTime,
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limits.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
            },
          },
        ),
      };
    }

    // Increment request count
    await incrementRequestCount(rateLimitKey, limits.windowMs);

    const remaining = limits.maxRequests - currentCount - 1;

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    logger.error(
      'Rate limit middleware error:',
      error instanceof Error ? error : new Error(String(error)),
    );

    // Allow request on middleware error, but log it
    return {
      allowed: true,
      remaining: 100, // Default fallback
    };
  }
}

/**
 * Billing middleware
 */
export async function billingMiddleware(
  req: NextRequest,
  context: MiddlewareContext,
): Promise<{ allowed: boolean; response?: NextResponse; billingStatus: any }> {
  try {
    const billingService = getBillingService();

    // Check billing status
    const billingStatus = await billingService.getOrganizationBilling(
      context.organizationId,
    );

    if (
      !billingStatus.hasActiveSubscription &&
      billingStatus.creditsRemaining <= 0
    ) {
      return {
        allowed: false,
        billingStatus,
        response: NextResponse.json(
          {
            success: false,
            error: 'Insufficient credits or no active subscription',
            code: 'INSUFFICIENT_CREDITS',
            billing: {
              creditsRemaining: billingStatus.creditsRemaining,
              hasActiveSubscription: billingStatus.hasActiveSubscription,
            },
          },
          { status: 402 },
        ),
      };
    }

    // Check if organization is within spending limits
    const spendingLimits = await billingService.getSpendingLimits(
      context.organizationId,
    );
    const currentSpending = await billingService.getCurrentMonthSpending(
      context.organizationId,
    );

    if (
      spendingLimits.monthlyLimit &&
      currentSpending >= spendingLimits.monthlyLimit
    ) {
      return {
        allowed: false,
        billingStatus,
        response: NextResponse.json(
          {
            success: false,
            error: 'Monthly spending limit exceeded',
            code: 'SPENDING_LIMIT_EXCEEDED',
            billing: {
              currentSpending,
              monthlyLimit: spendingLimits.monthlyLimit,
            },
          },
          { status: 402 },
        ),
      };
    }

    return {
      allowed: true,
      billingStatus: {
        ...billingStatus,
        canGenerate: true,
      },
    };
  } catch (error) {
    logger.error(
      'Billing middleware error:',
      error instanceof Error ? error : new Error(String(error)),
    );

    // Allow request on middleware error for non-critical paths
    return {
      allowed: true,
      billingStatus: {
        hasActiveSubscription: true,
        creditsRemaining: 1000,
        canGenerate: true,
      },
    };
  }
}

/**
 * Content validation middleware
 */
export async function validationMiddleware(
  req: NextRequest,
): Promise<{ valid: boolean; response?: NextResponse }> {
  try {
    // Validate content type
    const contentType = req.headers.get('content-type');

    if (!validateContentType(contentType)) {
      return {
        valid: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Invalid content type',
            code: 'INVALID_CONTENT_TYPE',
          },
          { status: 400 },
        ),
      };
    }

    // Validate content length
    const contentLength = req.headers.get('content-length');
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      return {
        valid: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Request too large',
            code: 'REQUEST_TOO_LARGE',
          },
          { status: 413 },
        ),
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error(
      'Validation middleware error:',
      error instanceof Error ? error : new Error(String(error)),
    );

    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 },
      ),
    };
  }
}

/**
 * CORS middleware
 */
export function corsMiddleware(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
  ];

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin || '')
          ? origin!
          : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  return null;
}

/**
 * Combined middleware wrapper
 */
export async function withMiddleware(
  req: NextRequest,
  handler: (
    req: NextRequest,
    context: MiddlewareContext,
  ) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    // CORS
    const corsResponse = corsMiddleware(req);
    if (corsResponse) {
      return corsResponse;
    }

    // Content validation
    const validation = await validationMiddleware(req);
    if (!validation.valid && validation.response) {
      return validation.response;
    }

    // Authentication
    const auth = await authMiddleware(req);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const context = auth.context!;

    // Rate limiting
    const rateLimit = await rateLimitMiddleware(req, context);
    if (!rateLimit.allowed && rateLimit.response) {
      return rateLimit.response;
    }
    context.rateLimitRemaining = rateLimit.remaining;

    // Billing
    const billing = await billingMiddleware(req, context);
    if (!billing.allowed && billing.response) {
      return billing.response;
    }
    context.billingStatus = billing.billingStatus;

    // Add context to request headers for handler access
    req.headers.set('x-user-id', context.userId);
    req.headers.set('x-organization-id', context.organizationId);
    req.headers.set('x-user-role', context.userRole);

    // Execute handler
    const response = await handler(req, context);

    // Add rate limit headers to response
    response.headers.set(
      'X-RateLimit-Remaining',
      context.rateLimitRemaining.toString(),
    );

    return response;
  } catch (error) {
    logger.error(
      'Middleware error:',
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}

// Helper functions
async function getCurrentRequestCount(key: string): Promise<number> {
  // Implementation would use Redis or database
  // For now, return mock value
  return 0;
}

async function incrementRequestCount(
  key: string,
  windowMs: number,
): Promise<void> {
  // Implementation would use Redis or database
  // For now, do nothing
}

function getRateLimits(role: string): {
  maxRequests: number;
  windowMs: number;
} {
  const limits = {
    admin: { maxRequests: 1000, windowMs: 60 * 60 * 1000 }, // 1000/hour
    pro: { maxRequests: 500, windowMs: 60 * 60 * 1000 }, // 500/hour
    user: { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100/hour
    free: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20/hour
  };

  return limits[role as keyof typeof limits] || limits.user;
}
