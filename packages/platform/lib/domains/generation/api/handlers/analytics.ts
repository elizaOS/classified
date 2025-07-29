/**
 * Generation Analytics Handler
 * Handles analytics queries for generation usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { GenerationService } from '../../services/GenerationService';
import { validateAnalyticsQuery } from '../validation';
import { getDatabaseClient } from '@/lib/database';
import { getStorageManager } from '@/lib/services/storage';
import { getBillingService } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { MiddlewareContext } from '../middleware';

export async function analyticsHandler(
  req: NextRequest,
  context: MiddlewareContext,
): Promise<NextResponse> {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Validate query parameters
    const validation = validateAnalyticsQuery(queryParams);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid analytics query',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    // Transform and provide defaults for analytics params
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const params = {
      organizationId: context.organizationId,
      period: validation.data.period || ('month' as const),
      startDate: validation.data.start_date || thirtyDaysAgo,
      endDate: validation.data.end_date || now,
      type: validation.data.type,
      provider: validation.data.provider,
    };

    // Initialize services
    const storage = await getStorageManager();
    const billing = getBillingService();
    const generationService = new GenerationService(storage, billing);

    // Get analytics
    const result = await generationService.getAnalytics(params);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Log analytics access
    logger.info('Generation analytics accessed', {
      userId: context.userId,
      organizationId: context.organizationId,
      period: params.period,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      'Analytics handler error:',
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
