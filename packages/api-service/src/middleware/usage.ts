/**
 * Usage tracking middleware for API service
 */

import type { Context, Next } from 'hono';

export function usageMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Add request tracking to context
    c.set('requestId', requestId);
    c.set('startTime', startTime);

    // Set request ID header for debugging
    c.header('X-Request-ID', requestId);

    await next();

    // Track request completion
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Get auth data from context
    const user = c.get('user') as
      | { id: string; organizationId?: string }
      | undefined;

    // Log basic request info
    console.log({
      requestId,
      method: c.req.method,
      path: c.req.path,
      duration,
      status: c.res.status,
      userId: user?.id,
      organizationId: user?.organizationId,
    });

    // TODO: Store detailed usage metrics in database
    // This would include:
    // - Request/response sizes
    // - Model usage
    // - Costs
    // - Error rates
    // - Performance metrics
  };
}
