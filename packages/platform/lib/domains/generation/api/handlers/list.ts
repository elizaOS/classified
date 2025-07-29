/**
 * List Generations Handler
 * Handles listing generations with pagination and filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { GenerationService } from '../../services/GenerationService';
import { validateListQuery } from '../validation';
import { getStorageManager } from '@/lib/services/storage';
import { getBillingService } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { MiddlewareContext } from '../middleware';

export async function listHandler(
  req: NextRequest,
  context: MiddlewareContext,
): Promise<NextResponse> {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Validate query parameters
    const validation = validateListQuery(queryParams);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    const params = {
      organizationId: context.organizationId,
      userId: context.userRole === 'admin' ? undefined : context.userId, // Admins can see all
      projectId: validation.data?.project_id,
      type: validation.data?.type,
      status: validation.data?.status,
      limit: validation.data?.limit,
      offset: validation.data?.page
        ? (validation.data.page - 1) * (validation.data?.limit || 10)
        : 0,
      sortBy: validation.data?.sort_by,
      sortOrder: validation.data?.sort_order,
    };

    // Initialize services
    const storage = await getStorageManager();
    const billing = getBillingService();
    const generationService = new GenerationService(storage, billing);

    // List generations
    const result = await generationService.listGenerations(params);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Log access
    logger.info('Generations listed', {
      userId: context.userId,
      organizationId: context.organizationId,
      count: result.data?.length || 0,
      filters: params,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      'List generations handler error:',
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
