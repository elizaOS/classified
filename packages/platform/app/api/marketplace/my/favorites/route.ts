import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import {
  userFavorites,
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

    // Build query conditions
    const conditions = [
      eq(userFavorites.userId, session.user.id),
      eq(marketplaceAssets.status, 'published'),
      eq(marketplaceAssets.visibility, 'public'),
    ];

    if (
      assetType &&
      ['mcp', 'agent', 'workflow', 'plugin'].includes(assetType)
    ) {
      conditions.push(eq(marketplaceAssets.assetType, assetType as any));
    }

    const db = await getDatabase();

    // Get user's favorites with asset details
    const favorites = await db
      .select({
        favorite: userFavorites,
        asset: marketplaceAssets,
        creator: creatorProfiles,
        user: users,
      })
      .from(userFavorites)
      .leftJoin(
        marketplaceAssets,
        eq(userFavorites.assetId, marketplaceAssets.id),
      )
      .leftJoin(
        creatorProfiles,
        eq(marketplaceAssets.creatorId, creatorProfiles.userId),
      )
      .leftJoin(users, eq(marketplaceAssets.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(userFavorites.createdAt))
      .limit(limit)
      .offset(offset);

    const formattedFavorites = favorites
      .filter(({ asset }: any) => asset !== null) // Filter out deleted assets
      .map(({ favorite, asset, creator, user }: any) => ({
        id: favorite.id,
        favoritedAt: favorite.createdAt,
        asset: {
          id: asset!.id,
          name: asset!.name,
          slug: asset!.slug,
          description: asset!.description,
          assetType: asset!.assetType,
          category: asset!.category,
          tags: asset!.tags,
          icon: asset!.icon,
          images: asset!.images,
          version: asset!.version,
          rating: parseFloat(asset!.rating || '0'),
          ratingCount: asset!.ratingCount,
          installCount: asset!.installCount,
          pricingModel: asset!.pricingModel,
          basePrice: parseFloat(asset!.basePrice || '0'),
          usagePrice: parseFloat(asset!.usagePrice || '0'),
          subscriptionPrice: parseFloat(asset!.subscriptionPrice || '0'),
          currency: asset!.currency,
          createdAt: asset!.createdAt,
          updatedAt: asset!.updatedAt,
          creator: {
            id: asset!.creatorId,
            displayName:
              creator?.displayName || user?.name || 'Unknown Creator',
            avatarUrl: creator?.avatarUrl,
            isVerified: creator?.isVerified || false,
          },
        },
      }));

    return NextResponse.json({
      success: true,
      data: {
        favorites: formattedFavorites,
        pagination: {
          limit,
          offset,
          hasMore: favorites.length === limit,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get user favorites:', error);
    return NextResponse.json(
      { error: 'Failed to get favorites' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
