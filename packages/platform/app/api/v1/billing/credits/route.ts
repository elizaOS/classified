import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';
import {
  getCreditBalance,
  getCreditTransactions,
  getUsageStatistics,
} from '@/lib/server/services/billing-service';
import { authenticateUser } from '@/lib/server/auth/session';

const getCreditsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
  type: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
});

async function handleGET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (!authResult.user || !authResult.organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, organization } = authResult;

    const { searchParams } = new URL(request.url);
    const query = getCreditsQuerySchema.parse(Object.fromEntries(searchParams));

    // Get current balance
    const balance = await getCreditBalance(organization.id);

    // Get recent transactions
    const transactions = await getCreditTransactions(organization.id, {
      limit: query.limit,
      offset: query.offset,
      type: query.type,
    });

    // Get usage statistics
    const stats = await getUsageStatistics(organization.id, query.period);

    return NextResponse.json({
      data: {
        balance,
        transactions: transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: parseFloat(tx.amount),
          description: tx.description,
          balanceAfter: parseFloat(tx.balanceAfter),
          paymentMethod: tx.paymentMethod,
          agentId: tx.agentId,
          createdAt: tx.createdAt,
        })),
        statistics: stats,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error('Failed to fetch credit information:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
