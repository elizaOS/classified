import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import {
  assetInstallations,
  marketplaceAssets,
  creatorProfiles,
  users,
} from '@/lib/database/marketplace-schema';
import { eq, and, desc } from 'drizzle-orm';

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '20', 10),
      100,
    );
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const assetType = url.searchParams.get('type');
    const status = url.searchParams.get('status') || 'active'; // active, all

    // Build query conditions
    const conditions = [eq(assetInstallations.userId, session.user.id)];

    if (status === 'active') {
      conditions.push(eq(assetInstallations.isActive, true));
    }

    if (
      assetType &&
      ['mcp', 'agent', 'workflow', 'plugin'].includes(assetType)
    ) {
      conditions.push(eq(marketplaceAssets.assetType, assetType as any));
    }

    const db = await getDatabase();

    // Get user's installations with asset details
    const installations = await db
      .select({
        installation: assetInstallations,
        asset: marketplaceAssets,
        creator: creatorProfiles,
        user: users,
      })
      .from(assetInstallations)
      .leftJoin(
        marketplaceAssets,
        eq(assetInstallations.assetId, marketplaceAssets.id),
      )
      .leftJoin(
        creatorProfiles,
        eq(marketplaceAssets.creatorId, creatorProfiles.userId),
      )
      .leftJoin(users, eq(marketplaceAssets.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(assetInstallations.installedAt))
      .limit(limit)
      .offset(offset);

    const formattedInstallations = installations.map(
      ({ installation, asset, creator, user }: any) => ({
        id: installation.id,
        assetId: installation.assetId,
        purchaseType: installation.purchaseType,
        purchasePrice: parseFloat(installation.purchasePrice),
        currency: installation.currency,
        subscriptionStatus: installation.subscriptionStatus,
        subscriptionEndsAt: installation.subscriptionEndsAt,
        isActive: installation.isActive,
        installedAt: installation.installedAt,
        uninstalledAt: installation.uninstalledAt,
        asset: asset
          ? {
              id: asset.id,
              name: asset.name,
              slug: asset.slug,
              description: asset.description,
              assetType: asset.assetType,
              category: asset.category,
              tags: asset.tags,
              icon: asset.icon,
              version: asset.version,
              rating: parseFloat(asset.rating || '0'),
              ratingCount: asset.ratingCount,
              creator: {
                id: asset.creatorId,
                displayName:
                  creator?.displayName || user?.name || 'Unknown Creator',
                avatarUrl: creator?.avatarUrl,
                isVerified: creator?.isVerified || false,
              },
            }
          : null,
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        installations: formattedInstallations,
        pagination: {
          limit,
          offset,
          hasMore: installations.length === limit,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get user installations:', error);
    return NextResponse.json(
      { error: 'Failed to get installations' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
