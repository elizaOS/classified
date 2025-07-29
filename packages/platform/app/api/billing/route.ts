/**
 * Billing API Routes - Credit management and billing operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/lib/auth/session';
import {
  getCreditBalance,
  getCreditTransactions,
  getUsageStatistics,
  createPaymentIntent,
  createStripeCustomer,
} from '@/lib/server/services/billing-service';
import { wrapHandlers } from '@/lib/api/route-wrapper';

/**
 * GET /api/billing - Get billing information for current organization
 */
async function handleGET(request: NextRequest) {
  try {
    // Get current user session
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeTransactions =
      searchParams.get('include_transactions') === 'true';
    const includeStats = searchParams.get('include_stats') === 'true';
    const period =
      (searchParams.get('period') as 'day' | 'week' | 'month' | 'year') ||
      'month';

    // Get credit balance
    const creditBalance = await getCreditBalance(user.organizationId);

    const result: any = {
      creditBalance,
      organizationId: user.organizationId,
    };

    // Include recent transactions if requested
    if (includeTransactions) {
      const transactions = await getCreditTransactions(user.organizationId, {
        limit: 10,
        offset: 0,
      });
      result.recentTransactions = transactions;
    }

    // Include usage statistics if requested
    if (includeStats) {
      const stats = await getUsageStatistics(user.organizationId, period);
      result.statistics = stats;
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching billing information:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch billing information',
      },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication required
export const { GET } = wrapHandlers({ handleGET });
