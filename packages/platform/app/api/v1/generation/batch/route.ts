/**
 * Batch Generation API Routes
 * POST /api/v1/generation/batch - Create batch generation
 */

import { NextRequest } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { withMiddleware } from '@/lib/domains/generation/api/middleware';
import { batchGenerateHandler } from '@/lib/domains/generation/api/handlers/batch';

async function handlePOST(req: NextRequest) {
  return withMiddleware(req, batchGenerateHandler);
}

export const { POST } = wrapHandlers({ handlePOST });
