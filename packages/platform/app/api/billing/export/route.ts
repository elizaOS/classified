/**
 * POST /api/billing/export
 * Export transaction history in various formats
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { getCreditTransactions } from '@/lib/server/services/billing-service';
import { z } from 'zod';

const exportSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  filter: z.enum(['all', 'purchase', 'usage']).default('all'),
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  limit: z.number().max(1000).default(1000),
});

async function handlePOST(request: NextRequest) {
  try {
    // Get user session
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const validatedData = exportSchema.parse(body);

    // Get transactions
    const transactions = await getCreditTransactions(session.organizationId, {
      limit: validatedData.limit,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
    });

    // Filter transactions
    let filteredTransactions = transactions;
    if (validatedData.filter !== 'all') {
      filteredTransactions = transactions.filter(
        (t) => t.type === validatedData.filter,
      );
    }

    // Export based on format
    if (validatedData.format === 'csv') {
      const csv = generateCSV(filteredTransactions);

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else {
      return NextResponse.json({
        transactions: filteredTransactions,
        exportedAt: new Date().toISOString(),
        totalCount: filteredTransactions.length,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 },
      );
    }

    console.error('Failed to export transactions:', error);
    return NextResponse.json(
      { error: 'Failed to export transactions' },
      { status: 500 },
    );
  }
}

function generateCSV(transactions: any[]): string {
  const headers = [
    'Date',
    'Type',
    'Amount',
    'Description',
    'Status',
    'Payment Provider',
    'Payment Reference',
  ];

  const rows = transactions.map((transaction) => [
    new Date(transaction.createdAt).toISOString(),
    transaction.type,
    transaction.amount.toString(),
    transaction.description,
    transaction.status,
    transaction.paymentProvider || '',
    transaction.paymentReference || '',
  ]);

  // Escape CSV values
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  return csvContent;
}

export const { POST } = wrapHandlers({ handlePOST });
