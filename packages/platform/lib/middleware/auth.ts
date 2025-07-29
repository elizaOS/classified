/**
 * API Authentication Middleware
 * Validates authentication for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '../auth/session';

// Public API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/workos-callback',
  '/api/auth/refresh',
  '/api/auth/dev-login', // Only for development
  '/api/auth/identity', // Has its own auth logic in Node.js runtime
  '/api/auth/device', // Device flow authentication
  '/api/dashboard/stats', // Has its own auth logic in Node.js runtime
  '/api/dashboard/activity', // Has its own auth logic in Node.js runtime
  '/api/v1/health',
  '/api/v1/status',
  '/api/health',
  '/api/ping',
  '/api/runtime/ping',
];

// Development-only routes
const DEV_ONLY_ROUTES = ['/api/auth/dev-login'];

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Check if a route is development-only
 */
function isDevOnlyRoute(pathname: string): boolean {
  return DEV_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * API Authentication Middleware
 */
export async function apiAuthMiddleware(
  request: NextRequest,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  // Block development-only routes in production
  if (process.env.NODE_ENV === 'production' && isDevOnlyRoute(pathname)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Endpoint not available in production',
      },
      { status: 404 }, // Return 404 to avoid revealing endpoint existence
    );
  }

  // Allow public routes
  if (isPublicRoute(pathname)) {
    return null;
  }

  try {
    // Check authentication
    const user = await authService.getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 },
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Account is disabled',
        },
        { status: 403 },
      );
    }

    // Add user info to request headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-organization-id', user.organizationId);
    response.headers.set('x-user-role', user.role);

    return response;
  } catch (error) {
    console.error('API authentication error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 401 },
    );
  }
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export async function authRateLimitMiddleware(
  request: NextRequest,
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;

  // Only apply to auth endpoints
  if (!pathname.startsWith('/api/auth/')) {
    return null;
  }

  // Get client IP
  const clientIP =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Simple in-memory rate limiting (in production, use Redis)
  const rateLimit = await checkRateLimit(clientIP, pathname);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimit.retryAfter.toString(),
        },
      },
    );
  }

  return null;
}

// Simple in-memory rate limiting (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

async function checkRateLimit(
  clientIP: string,
  endpoint: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  // Disable rate limiting in development for testing
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true, retryAfter: 0 };
  }

  const key = `${clientIP}:${endpoint}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = endpoint.includes('/login') ? 5 : 10; // Stricter for login

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // Reset window
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(key, record);

  return { allowed: true, retryAfter: 0 };
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()',
  );

  // Only set HSTS in production with HTTPS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  // CSP header
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // TODO: Tighten this
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com https://api.workos.com http://localhost:3000 ws://localhost:3000",
    "frame-src 'self' http://localhost:3000", // Allow server iframe
    "frame-ancestors 'self'", // Allow self-embedding
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}
