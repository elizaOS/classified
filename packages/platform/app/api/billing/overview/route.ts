/**
 * GET /api/billing/overview
 * Get billing overview for the current organization using real billing service
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import {
  getCreditBalance,
  getUsageStatistics,
} from '@/lib/server/services/billing-service';
import { getDatabase, organizations } from '@/lib/database';
import { eq } from 'drizzle-orm';

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

    // Get organization details
    const db = await getDatabase();
    const [organization] = await db
      .select({
        subscriptionTier: organizations.subscriptionTier,
        creditThreshold: organizations.creditThreshold,
        autoTopUpEnabled: organizations.autoTopUpEnabled,
        autoTopUpAmount: organizations.autoTopUpAmount,
      })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    if (!organization) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 },
      );
    }

    // Get current credit balance
    const creditBalance = await getCreditBalance(user.organizationId);

    // Get usage statistics for the current month
    const stats = await getUsageStatistics(user.organizationId, 'month');

    // Calculate next billing date (if subscription exists)
    const nextBillingDate = null; // TODO: Implement for subscriptions

    const overview = {
      organizationId: user.organizationId,
      creditBalance,
      monthlyUsage: stats.totalUsage,
      monthlyPurchases: stats.totalCreditsAdded,
      usageBreakdown: {
        // TODO: Get breakdown by service from usage records
        openai: stats.totalUsage * 0.6,
        anthropic: stats.totalUsage * 0.3,
        storage: stats.totalUsage * 0.1,
      },
      subscriptionTier: organization.subscriptionTier || 'pay-as-you-go',
      nextBillingDate,
      autoTopUpEnabled: organization.autoTopUpEnabled,
      creditThreshold: parseFloat(organization.creditThreshold),
      autoTopUpAmount: parseFloat(organization.autoTopUpAmount),
    };

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('Failed to get billing overview:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get billing overview',
      },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
