/**
 * Batch Generation Handler
 * Handles batch generation requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { GenerationService } from '../../services/GenerationService';
import { validateBatchRequest } from '../validation';
import { getStorageManager } from '@/lib/services/storage';
import { getBillingService } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { MiddlewareContext } from '../middleware';

export async function batchGenerateHandler(
  req: NextRequest,
  context: MiddlewareContext,
): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await req.json();

    // Validate request
    const validation = validateBatchRequest(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid batch request',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    const request = validation.data;

    // Add user context to each generation request
    request.generations = request.generations.map((gen) => ({
      ...gen,
      userId: context.userId,
      organizationId: context.organizationId,
    }));

    // Initialize services
    const storage = await getStorageManager();
    const billing = getBillingService();
    const generationService = new GenerationService(storage, billing);

    // Create batch generation
    const result = await generationService.createBatchGeneration(request);

    if (!result.success) {
      const statusCode = result.code === 'INSUFFICIENT_CREDITS' ? 402 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    // Log batch creation
    logger.info('Batch generation created', {
      batchId: result.data?.id,
      userId: context.userId,
      organizationId: context.organizationId,
      totalGenerations: request.generations.length,
      types: [...new Set(request.generations.map((g) => g.type))],
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error(
      'Batch generation handler error:',
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
