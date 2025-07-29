/**
 * Individual Generation API Routes
 * GET /api/v1/generation/[id] - Get generation by ID
 * DELETE /api/v1/generation/[id] - Cancel generation
 */

import { NextRequest } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { withMiddleware } from '@/lib/domains/generation/api/middleware';
import {
  getGenerationHandler,
  cancelGenerationHandler,
} from '@/lib/domains/generation/api/handlers/generate';

async function handleGET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMiddleware(req, async (request, context) => {
    const resolvedParams = await params;
    return getGenerationHandler(request, { params: resolvedParams });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMiddleware(req, async (request, context) => {
    const resolvedParams = await params;
    return cancelGenerationHandler(request, { params: resolvedParams });
  });
}

export const { GET } = wrapHandlers({ handleGET });
