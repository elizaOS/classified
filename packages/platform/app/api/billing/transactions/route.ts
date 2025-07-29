/**
 * GET /api/billing/transactions
 * Get credit transaction history for the current organization using real billing service
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { getCreditTransactions } from '@/lib/server/services/billing-service';
import { z } from 'zod';

const transactionsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
  type: z.string().optional(),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

async function handleGET(request: NextRequest) {
  try {
    // Get user session
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validatedParams = transactionsQuerySchema.parse(queryParams);

    // Get transactions using real billing service
    const transactions = await getCreditTransactions(session.organizationId, {
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      type: validatedParams.type,
      startDate: validatedParams.startDate,
      endDate: validatedParams.endDate,
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 },
      );
    }

    console.error('Failed to get transactions:', error);
    return NextResponse.json(
      { error: 'Failed to get transactions' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
