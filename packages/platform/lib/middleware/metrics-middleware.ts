/**
 * Metrics Collection Middleware
 * Automatically tracks API request metrics for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  recordAPIRequest,
  recordDatabaseQuery,
} from '@/lib/monitoring/metrics';
import { hasStatusCode } from '@/lib/types/common';

export function withMetrics<
  T extends (...args: any[]) => Promise<NextResponse>,
>(
  handler: T,
  options: {
    path: string;
    trackDatabase?: boolean;
  },
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    const startTime = Date.now();
    const method = request.method;

    let response: NextResponse;
    let statusCode = 500;

    try {
      response = await handler(request, ...args);
      statusCode = response.status;
      return response;
    } catch (error) {
      statusCode = hasStatusCode(error)
        ? error.status || error.statusCode || 500
        : 500;
      throw error;
    } finally {
      const duration = Date.now() - startTime;

      // Record API request metrics
      recordAPIRequest(duration, statusCode, method, options.path);

      // Record database query metrics if enabled
      if (options.trackDatabase) {
        recordDatabaseQuery(duration, 'api_request', 'mixed');
      }
    }
  }) as T;
}

/**
 * Enhanced metrics middleware for API routes with detailed tracking
 */
export function createMetricsMiddleware(routeName: string) {
  return function metricsMiddleware<
    T extends (...args: any[]) => Promise<NextResponse>,
  >(handler: T): T {
    return withMetrics(handler, {
      path: routeName,
      trackDatabase: true,
    });
  };
}

/**
 * Middleware for tracking credit transactions
 */
export function withCreditMetrics<T extends Function>(handler: T): T {
  return (async (...args: any[]) => {
    const startTime = Date.now();

    try {
      const result = await handler(...args);

      // If result has credit transaction data, record it
      if (result && typeof result === 'object' && 'amount' in result) {
        const { recordCreditTransaction } = await import(
          '@/lib/monitoring/metrics'
        );
        recordCreditTransaction(
          parseFloat(result.amount),
          result.type || 'usage',
          result.organizationId,
        );
      }

      return result;
    } finally {
      const duration = Date.now() - startTime;
      const { recordDatabaseQuery } = await import('@/lib/monitoring/metrics');
      recordDatabaseQuery(duration, 'credit_operation', 'credit_transactions');
    }
  }) as unknown as T;
}
