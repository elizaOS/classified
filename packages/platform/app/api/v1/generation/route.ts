/**
 * Generation API Routes
 * POST /api/v1/generation - Create new generation
 * GET /api/v1/generation - List generations
 */

import { NextRequest } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { withMiddleware } from '@/lib/domains/generation/api/middleware';
import { generateHandler } from '@/lib/domains/generation/api/handlers/generate';
import { listHandler } from '@/lib/domains/generation/api/handlers/list';

async function handlePOST(req: NextRequest) {
  return withMiddleware(req, generateHandler);
}

async function handleGET(req: NextRequest) {
  return withMiddleware(req, listHandler);
}

export const { POST, GET } = wrapHandlers({ handlePOST, handleGET });
