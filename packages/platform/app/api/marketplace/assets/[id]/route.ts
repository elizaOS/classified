import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceService } from '@/lib/services/marketplace';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { marketplaceAssets } from '@/lib/database/marketplace-schema';
import { eq, and } from 'drizzle-orm';

const marketplaceService = new MarketplaceService();

async function handleGET(
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

    const db = await getDatabase();

    // Get asset details
    const assets = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);

    if (!assets[0]) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const asset = assets[0];

    // Check visibility permissions
    if (asset.visibility === 'private' && asset.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Get additional asset details through marketplace service search
    const searchResults = await marketplaceService.searchAssets(
      { searchQuery: asset.slug, limit: 1 },
      session.user.id,
    );

    const detailedAsset = searchResults[0];
    if (!detailedAsset) {
      return NextResponse.json(
        { error: 'Asset details not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: detailedAsset,
    });
  } catch (error) {
    console.error('Failed to get asset details:', error);
    return NextResponse.json(
      { error: 'Failed to get asset details' },
      { status: 500 },
    );
  }
}

export async function PUT(
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
    const updates = await request.json();

    const db = await getDatabase();

    // Verify ownership
    const assets = await db
      .select()
      .from(marketplaceAssets)
      .where(
        and(
          eq(marketplaceAssets.id, assetId),
          eq(marketplaceAssets.creatorId, session.user.id),
        ),
      )
      .limit(1);

    if (!assets[0]) {
      return NextResponse.json(
        { error: 'Asset not found or access denied' },
        { status: 404 },
      );
    }

    // Validate updates
    const allowedFields = [
      'name',
      'description',
      'longDescription',
      'category',
      'tags',
      'configuration',
      'pricingModel',
      'basePrice',
      'usagePrice',
      'subscriptionPrice',
      'icon',
      'images',
      'readme',
      'repositoryUrl',
      'status',
      'visibility',
    ];

    const validUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 },
      );
    }

    // Add update timestamp
    validUpdates.updatedAt = new Date();

    // Update asset
    await db
      .update(marketplaceAssets)
      .set(validUpdates)
      .where(eq(marketplaceAssets.id, assetId));

    return NextResponse.json({
      success: true,
      message: 'Asset updated successfully',
    });
  } catch (error) {
    console.error('Failed to update asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const db = await getDatabase();

    // Verify ownership
    const assets = await db
      .select()
      .from(marketplaceAssets)
      .where(
        and(
          eq(marketplaceAssets.id, assetId),
          eq(marketplaceAssets.creatorId, session.user.id),
        ),
      )
      .limit(1);

    if (!assets[0]) {
      return NextResponse.json(
        { error: 'Asset not found or access denied' },
        { status: 404 },
      );
    }

    // Instead of hard delete, mark as archived
    await db
      .update(marketplaceAssets)
      .set({
        status: 'archived',
        visibility: 'private',
        updatedAt: new Date(),
      })
      .where(eq(marketplaceAssets.id, assetId));

    return NextResponse.json({
      success: true,
      message: 'Asset archived successfully',
    });
  } catch (error) {
    console.error('Failed to delete asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
