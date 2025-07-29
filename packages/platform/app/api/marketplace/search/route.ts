import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceService } from '@/lib/services/marketplace';
import { auth } from '@/lib/auth';

const marketplaceService = new MarketplaceService();

async function handleGET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Authentication is optional for search - anonymous users can browse public assets
    const session = await auth();
    const userId = session?.user?.id;

    // Handle price range
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    let priceRange: { min: number; max: number } | undefined = undefined;
    if (minPrice || maxPrice) {
      priceRange = {
        min: minPrice ? parseFloat(minPrice) : 0,
        max: maxPrice ? parseFloat(maxPrice) : Number.MAX_VALUE,
      };
    }

    // Parse search parameters
    const searchParams: any = {
      assetType: url.searchParams.get('type') as any,
      category: url.searchParams.get('category') || undefined,
      tags:
        url.searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      searchQuery: url.searchParams.get('q') || undefined,
      sortBy: (url.searchParams.get('sortBy') as any) || 'created',
      sortOrder: (url.searchParams.get('sortOrder') as any) || 'desc',
      limit: Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100), // Max 100 results
      offset: parseInt(url.searchParams.get('offset') || '0', 10),
      rating: url.searchParams.get('minRating')
        ? parseFloat(url.searchParams.get('minRating')!)
        : undefined,
      priceRange,
    };

    // Validate parameters
    if (
      searchParams.assetType &&
      !['mcp', 'agent', 'workflow', 'plugin'].includes(searchParams.assetType)
    ) {
      return NextResponse.json(
        { error: 'Invalid asset type' },
        { status: 400 },
      );
    }

    if (
      searchParams.sortBy &&
      !['name', 'rating', 'installs', 'created', 'updated', 'price'].includes(
        searchParams.sortBy,
      )
    ) {
      return NextResponse.json(
        { error: 'Invalid sortBy parameter' },
        { status: 400 },
      );
    }

    if (
      searchParams.sortOrder &&
      !['asc', 'desc'].includes(searchParams.sortOrder)
    ) {
      return NextResponse.json(
        { error: 'Invalid sortOrder parameter' },
        { status: 400 },
      );
    }

    if (
      searchParams.rating &&
      (searchParams.rating < 0 || searchParams.rating > 5)
    ) {
      return NextResponse.json(
        { error: 'Rating must be between 0 and 5' },
        { status: 400 },
      );
    }

    if (searchParams.limit < 1 || searchParams.limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 },
      );
    }

    if (searchParams.offset < 0) {
      return NextResponse.json(
        { error: 'Offset must be non-negative' },
        { status: 400 },
      );
    }

    // Perform search
    const assets = await marketplaceService.searchAssets(searchParams, userId);

    // Get total count for pagination (simplified - would optimize in production)
    const totalCount =
      assets.length < searchParams.limit
        ? searchParams.offset + assets.length
        : searchParams.offset + assets.length + 1; // Estimate

    return NextResponse.json({
      success: true,
      data: {
        assets,
        pagination: {
          limit: searchParams.limit,
          offset: searchParams.offset,
          total: totalCount,
          hasMore: assets.length === searchParams.limit,
        },
        filters: {
          assetType: searchParams.assetType,
          category: searchParams.category,
          tags: searchParams.tags,
          searchQuery: searchParams.searchQuery,
          sortBy: searchParams.sortBy,
          sortOrder: searchParams.sortOrder,
          rating: searchParams.rating,
          priceRange: searchParams.priceRange,
        },
      },
    });
  } catch (error) {
    console.error('Failed to search marketplace:', error);
    return NextResponse.json(
      { error: 'Failed to search marketplace' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
