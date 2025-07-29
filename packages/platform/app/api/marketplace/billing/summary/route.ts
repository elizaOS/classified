import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceBillingService } from '@/lib/billing/marketplace-billing-service';
import { getCreditBalance } from '@/lib/server/services/billing-service';
import { auth } from '@/lib/auth';

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);

    // Parse date range
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    const startParam = url.searchParams.get('startDate');
    const endParam = url.searchParams.get('endDate');

    if (startParam) {
      startDate = new Date(startParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format' },
          { status: 400 },
        );
      }
    }

    if (endParam) {
      endDate = new Date(endParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format' },
          { status: 400 },
        );
      }
    }

    // Get marketplace usage summary
    const usageSummary =
      await MarketplaceBillingService.getMarketplaceUsageSummary(
        session.organizationId,
        startDate,
        endDate,
      );

    // Get current credit balance
    const currentBalance = await getCreditBalance(session.organizationId);

    // Calculate spending trends
    const spendingTrend = usageSummary.usageBreakdown.map((usage: any) => ({
      category: usage.usageType,
      amount: usage.totalCost,
      percentage:
        usageSummary.totalSpent > 0
          ? (usage.totalCost / usageSummary.totalSpent) * 100
          : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        currentBalance,
        period: usageSummary.period,
        summary: {
          totalSpent: usageSummary.totalSpent,
          totalCreatorRevenue: usageSummary.totalCreatorRevenue,
          totalPlatformRevenue: usageSummary.totalPlatformRevenue,
          transactionCount: usageSummary.transactionCount,
        },
        breakdown: {
          byUsageType: usageSummary.usageBreakdown,
          spendingTrend,
        },
        recentTransactions: usageSummary.recentTransactions.map((t: any) => ({
          id: t.id,
          amount: parseFloat(t.amount),
          description: t.description,
          createdAt: t.createdAt,
          metadata: t.metadata,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to get marketplace billing summary:', error);
    return NextResponse.json(
      { error: 'Failed to get billing summary' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
