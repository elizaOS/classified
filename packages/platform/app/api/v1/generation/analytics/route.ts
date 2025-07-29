/**
 * Generation Analytics API Routes
 * GET /api/v1/generation/analytics - Get generation analytics
 */

import { NextRequest } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { withMiddleware } from '@/lib/domains/generation/api/middleware';
import { analyticsHandler } from '@/lib/domains/generation/api/handlers/analytics';

async function handleGET(req: NextRequest) {
  return withMiddleware(req, analyticsHandler);
}

export const { GET } = wrapHandlers({ handleGET });
