/**
 * Generate Content Handler
 * Handles single generation requests
 */

import { getBillingService } from '@/lib/billing';
import { GenerationRequest } from '@/lib/domains/generation/types';
import { logger } from '@/lib/logger';
import { getStorageManager } from '@/lib/services/storage';
import { NextRequest, NextResponse } from 'next/server';
import { GenerationService } from '../../services/GenerationService';
import { generationRequestSchema } from '../validation';

export async function generateHandler(req: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await req.json();

    // Validate request
    const validation = generationRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const request = validation.data as GenerationRequest;

    // Get user context from auth middleware
    const userId = req.headers.get('x-user-id');
    const organizationId = req.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Add user context and required fields to request
    request.userId = userId;
    request.organizationId = organizationId;

    // Add default values for required fields if missing
    if (!request.priority) {
      request.priority = 'normal';
    }

    // Initialize services
    const storage = await getStorageManager();
    const billing = getBillingService();
    const generationService = new GenerationService(storage, billing);

    // Create generation
    const result = await generationService.createGeneration(request);

    if (!result.success) {
      const statusCode = result.code === 'INSUFFICIENT_CREDITS' ? 402 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    // Log generation creation
    logger.info('Generation created', {
      generationId: result.data?.id,
      userId,
      organizationId,
      type: request.type,
      provider: request.provider,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error(
      'Generation handler error:',
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

/**
 * GET handler for generation status
 */
export async function getGenerationHandler(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const generationId = params.id;

    if (!generationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Generation ID required',
          code: 'MISSING_ID',
        },
        { status: 400 },
      );
    }

    // Get user context
    const userId = req.headers.get('x-user-id');
    const organizationId = req.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Initialize services
    const storage = await getStorageManager();
    const billing = getBillingService();
    const generationService = new GenerationService(storage, billing);

    // Get generation
    const result = await generationService.getGeneration(generationId);

    if (!result.success) {
      const statusCode = result.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    // Verify ownership
    if (result.data?.organizationId !== organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        },
        { status: 403 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      'Get generation handler error:',
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

/**
 * DELETE handler for generation cancellation
 */
export async function cancelGenerationHandler(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const generationId = params.id;

    if (!generationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Generation ID required',
          code: 'MISSING_ID',
        },
        { status: 400 },
      );
    }

    // Get user context
    const userId = req.headers.get('x-user-id');
    const organizationId = req.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 },
      );
    }

    // Initialize services
    const storage = await getStorageManager();
    const billing = getBillingService();
    const generationService = new GenerationService(storage, billing);

    // Get generation first to verify ownership
    const getResult = await generationService.getGeneration(generationId);
    if (!getResult.success) {
      const statusCode = getResult.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json(getResult, { status: statusCode });
    }

    // Verify ownership
    if (getResult.data?.organizationId !== organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
        },
        { status: 403 },
      );
    }

    // Cancel generation
    const result = await generationService.cancelGeneration(generationId);

    if (!result.success) {
      const statusCode = result.code === 'INVALID_STATUS' ? 409 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    // Log cancellation
    logger.info('Generation cancelled', {
      generationId,
      userId,
      organizationId,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      'Cancel generation handler error:',
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
