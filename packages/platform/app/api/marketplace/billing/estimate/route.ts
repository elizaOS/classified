import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceBillingService } from '@/lib/billing/marketplace-billing-service';
import { getCreditBalance } from '@/lib/server/services/billing-service';
import { auth } from '@/lib/auth';

async function handlePOST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const estimationRequest = await request.json();

    // Validate required fields
    if (
      !estimationRequest.usageType ||
      !estimationRequest.service ||
      !estimationRequest.operation
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: usageType, service, operation' },
        { status: 400 },
      );
    }

    // Validate usage type
    const validUsageTypes = [
      'asset_purchase',
      'container_hosting',
      'asset_usage',
      'subscription',
    ];
    if (!validUsageTypes.includes(estimationRequest.usageType)) {
      return NextResponse.json(
        { error: 'Invalid usage type' },
        { status: 400 },
      );
    }

    // Build context for estimation
    const context = {
      service: estimationRequest.service,
      operation: estimationRequest.operation,
      usageType: estimationRequest.usageType,
      assetId: estimationRequest.assetId,
      creatorId: estimationRequest.creatorId,
      basePrice: estimationRequest.basePrice || 0,
      tokens: estimationRequest.quantity || 1,

      // Container-specific fields
      memory: estimationRequest.memory,
      cpu: estimationRequest.cpu,
      storage: estimationRequest.storage,
    };

    // Estimate costs
    const totalCost =
      MarketplaceBillingService.estimateMarketplaceCost(context);
    const costBreakdown =
      MarketplaceBillingService.calculateMarketplaceCost(context);

    // Check if user can afford it
    const currentBalance = await getCreditBalance(session.organizationId);
    const canAfford = currentBalance >= totalCost;

    // Calculate duration estimates for container hosting
    let durationEstimates;
    if (estimationRequest.usageType === 'container_hosting') {
      const hourlyRate = costBreakdown.totalCost;
      durationEstimates = {
        hourly: hourlyRate,
        daily: hourlyRate * 24,
        weekly: hourlyRate * 24 * 7,
        monthly: hourlyRate * 24 * 30,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCost: costBreakdown.totalCost,
        creatorRevenue: costBreakdown.creatorRevenue,
        platformRevenue: costBreakdown.platformRevenue,
        currentBalance,
        canAfford,
        durationEstimates,
        breakdown: {
          baseAmount: estimationRequest.basePrice || 0,
          quantity: estimationRequest.quantity || 1,
          unitCost: totalCost / (estimationRequest.quantity || 1),
          creatorShare: '50%',
          platformShare: '50%',
        },
        note:
          estimationRequest.usageType === 'container_hosting'
            ? 'Container hosting is billed hourly based on actual usage'
            : 'This is a one-time cost estimate',
      },
    });
  } catch (error) {
    console.error('Failed to estimate marketplace cost:', error);
    return NextResponse.json(
      { error: 'Failed to estimate cost' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
