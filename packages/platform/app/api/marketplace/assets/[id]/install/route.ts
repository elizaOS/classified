import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceService } from '@/lib/services/marketplace';
import { MarketplaceBillingService } from '@/lib/billing/marketplace-billing-service';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { marketplaceAssets } from '@/lib/database/marketplace-schema';
import { eq } from 'drizzle-orm';

const marketplaceService = new MarketplaceService();

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const assetId = resolvedParams.id;
    const { purchaseType = 'free' } = await request.json();

    // Validate purchase type
    const validPurchaseTypes = ['free', 'one_time', 'subscription'];
    if (!validPurchaseTypes.includes(purchaseType)) {
      return NextResponse.json(
        { error: 'Invalid purchase type' },
        { status: 400 },
      );
    }

    const db = await getDatabase();

    // Get asset details for billing
    const assets = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);

    if (!assets[0]) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const asset = assets[0];

    // Calculate purchase price and check billing
    let purchasePrice = 0;
    if (purchaseType === 'one_time') {
      purchasePrice = parseFloat(asset.basePrice || '0');
    } else if (purchaseType === 'subscription') {
      purchasePrice = parseFloat(asset.subscriptionPrice || '0');
    }

    // Process billing if there's a cost
    if (purchasePrice > 0) {
      const billingResult =
        await MarketplaceBillingService.processMarketplaceBilling(
          session.organizationId,
          session.user.id,
          {
            service: 'marketplace',
            operation: 'asset_purchase',
            usageType: 'asset_purchase',
            assetId: assetId,
            creatorId: asset.creatorId,
            basePrice: purchasePrice,
            tokens: 1, // One purchase
          },
        );

      if (!billingResult.success) {
        return NextResponse.json(
          { error: billingResult.error || 'Payment failed' },
          { status: 402 }, // Payment Required
        );
      }
    }

    // Install the asset
    const result = await marketplaceService.installAsset(
      assetId,
      session.user.id,
      session.organizationId,
      purchaseType,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        installationId: result.installationId,
        containerId: result.containerId,
        purchasePrice,
        message:
          purchasePrice > 0
            ? `Asset purchased and installed for $${purchasePrice.toFixed(2)}`
            : 'Asset installed successfully',
      },
    });
  } catch (error) {
    console.error('Failed to install asset:', error);
    return NextResponse.json(
      { error: 'Failed to install asset' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
