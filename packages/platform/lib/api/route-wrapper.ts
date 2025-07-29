/**
 * Route Security Wrapper
 *
 * Provides a clean, consistent way to apply security headers and other
 * middleware to API routes without the "handle" pattern.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecurityHeaders } from '@/lib/security/headers';
import { apiLogger } from '@/lib/logger';
import { AuthenticationError } from '@/lib/errors';

export interface RouteConfig {
  /** Apply security headers (default: true) */
  security?: boolean;
  /** Require authentication (default: false) */
  requireAuth?: boolean;
  /** Require admin role (default: false) */
  requireAdmin?: boolean;
  /** Enable request logging (default: true) */
  logging?: boolean;
  /** Custom middleware to apply */
  middleware?: Array<
    (req: NextRequest, res: NextResponse) => Promise<NextResponse>
  >;
}

type RouteHandler = (
  request: NextRequest,
  ...args: any[]
) => Promise<NextResponse>;

/**
 * Default configuration for all routes
 */
const DEFAULT_CONFIG: RouteConfig = {
  security: true,
  requireAuth: false,
  requireAdmin: false,
  logging: true,
  middleware: [],
};

/**
 * Configuration overrides for specific route patterns
 */
const ROUTE_OVERRIDES: Record<string, Partial<RouteConfig>> = {
  // Public routes that don't need auth
  '/api/health': { requireAuth: false },
  '/api/ping': { requireAuth: false },
  '/api/auth/login': { requireAuth: false },
  '/api/auth/signup': { requireAuth: false },
  '/api/auth/callback': { requireAuth: false },
  '/api/auth/social': { requireAuth: false },
  '/api/auth/device': { requireAuth: false },
  '/api/anonymous': { requireAuth: false },

  // Admin-only routes
  '/api/security': { requireAdmin: true },
  '/api/performance': { requireAdmin: true },
  '/api/metrics': { requireAdmin: true },

  // Routes that need auth
  '/api/agents': { requireAuth: true },
  '/api/billing': { requireAuth: true },
  '/api/characters': { requireAuth: true },
  '/api/api-keys': { requireAuth: true },
  '/api/organizations': { requireAuth: true },

  // Webhook endpoints (no auth but needs security headers)
  '/api/billing/webhook': { requireAuth: false, security: true },
  '/api/billing/crypto-webhook': { requireAuth: false, security: true },
};

/**
 * Get configuration for a specific route
 */
function getRouteConfig(path: string): RouteConfig {
  // Check for exact match first
  if (ROUTE_OVERRIDES[path]) {
    return { ...DEFAULT_CONFIG, ...ROUTE_OVERRIDES[path] };
  }

  // Check for pattern matches
  for (const [pattern, config] of Object.entries(ROUTE_OVERRIDES)) {
    if (path.startsWith(pattern)) {
      return { ...DEFAULT_CONFIG, ...config };
    }
  }

  return DEFAULT_CONFIG;
}

/**
 * Wrap a route handler with security and middleware
 */
export function secure(
  handler: RouteHandler,
  customConfig?: Partial<RouteConfig>,
): RouteHandler {
  return async (request: NextRequest, ...args: any[]) => {
    const startTime = Date.now();
    const path = new URL(request.url).pathname;

    // Merge configurations
    const baseConfig = getRouteConfig(path);
    const config = { ...baseConfig, ...customConfig };

    try {
      // Check authentication if required
      if (config.requireAuth || config.requireAdmin) {
        const { authService } = await import('@/lib/auth/session');
        const user = await authService.getCurrentUser();

        if (!user) {
          throw new AuthenticationError('Authentication required');
        }

        if (config.requireAdmin && !['admin', 'owner'].includes(user.role)) {
          return NextResponse.json(
            { error: 'Admin access required' },
            { status: 403 },
          );
        }
      }

      // Execute the handler
      let response = await handler(request, ...args);

      // Apply security headers if enabled
      if (config.security && response instanceof NextResponse) {
        const securityHeaders = new SecurityHeaders();
        response = securityHeaders.apply(request, response);
      }

      // Apply custom middleware
      if (config.middleware && config.middleware.length > 0) {
        for (const middleware of config.middleware) {
          response = await middleware(request, response);
        }
      }

      // Log request if enabled
      if (config.logging) {
        const duration = Date.now() - startTime;
        apiLogger.logRequest(request.method, path, response.status, duration);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      if (config.logging) {
        apiLogger.logRequest(
          request.method,
          path,
          error instanceof AuthenticationError ? 401 : 500,
          duration,
          { error: error instanceof Error ? error.message : 'Unknown error' },
        );
      }

      // Handle authentication errors
      if (error instanceof AuthenticationError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      // Handle other errors
      console.error(`Error in ${path}:`, error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}

/**
 * Create route exports with security
 * Usage: export const { GET, POST } = createRoute({ get: handler, post: handler })
 */
export function createRoute(
  handlers: {
    get?: RouteHandler;
    post?: RouteHandler;
    put?: RouteHandler;
    patch?: RouteHandler;
    delete?: RouteHandler;
    head?: RouteHandler;
    options?: RouteHandler;
  },
  config?: Partial<RouteConfig>,
) {
  const exports: Record<string, RouteHandler> = {};

  if (handlers.get) {
    exports.GET = secure(handlers.get, config);
  }
  if (handlers.post) {
    exports.POST = secure(handlers.post, config);
  }
  if (handlers.put) {
    exports.PUT = secure(handlers.put, config);
  }
  if (handlers.patch) {
    exports.PATCH = secure(handlers.patch, config);
  }
  if (handlers.delete) {
    exports.DELETE = secure(handlers.delete, config);
  }
  if (handlers.head) {
    exports.HEAD = secure(handlers.head, config);
  }
  if (handlers.options) {
    exports.OPTIONS = secure(handlers.options, config);
  }

  return exports;
}

/**
 * Legacy support: wrap existing handle functions
 */
export function wrapHandlers(
  handlers: {
    handleGET?: RouteHandler;
    handlePOST?: RouteHandler;
    handlePUT?: RouteHandler;
    handlePATCH?: RouteHandler;
    handleDELETE?: RouteHandler;
    handleHEAD?: RouteHandler;
    handleOPTIONS?: RouteHandler;
  },
  config?: Partial<RouteConfig>,
) {
  const exports: Record<string, RouteHandler> = {};

  if (handlers.handleGET) {
    exports.GET = secure(handlers.handleGET, config);
  }
  if (handlers.handlePOST) {
    exports.POST = secure(handlers.handlePOST, config);
  }
  if (handlers.handlePUT) {
    exports.PUT = secure(handlers.handlePUT, config);
  }
  if (handlers.handlePATCH) {
    exports.PATCH = secure(handlers.handlePATCH, config);
  }
  if (handlers.handleDELETE) {
    exports.DELETE = secure(handlers.handleDELETE, config);
  }
  if (handlers.handleHEAD) {
    exports.HEAD = secure(handlers.handleHEAD, config);
  }
  if (handlers.handleOPTIONS) {
    exports.OPTIONS = secure(handlers.handleOPTIONS, config);
  }

  return exports;
}
