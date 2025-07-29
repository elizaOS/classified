import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceService } from '@/lib/services/marketplace';
import { auth } from '@/lib/auth';
import { CreateAssetRequest } from '@/lib/services/marketplace';

const marketplaceService = new MarketplaceService();

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);

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

    const searchParams = {
      assetType: url.searchParams.get('assetType') as any,
      category: url.searchParams.get('category') || undefined,
      tags: url.searchParams.get('tags')?.split(',') || undefined,
      searchQuery: url.searchParams.get('q') || undefined,
      sortBy: (url.searchParams.get('sortBy') as any) || 'created',
      sortOrder: (url.searchParams.get('sortOrder') as any) || 'desc',
      limit: parseInt(url.searchParams.get('limit') || '20', 10),
      offset: parseInt(url.searchParams.get('offset') || '0', 10),
      rating: url.searchParams.get('rating')
        ? parseFloat(url.searchParams.get('rating')!)
        : undefined,
      priceRange,
    };

    const assets = await marketplaceService.searchAssets(
      searchParams,
      session.user.id,
    );

    return NextResponse.json({
      success: true,
      data: assets,
    });
  } catch (error) {
    console.error('Failed to fetch marketplace assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assetData: CreateAssetRequest = await request.json();

    // Validate required fields
    if (!assetData.name || !assetData.description || !assetData.assetType) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, assetType' },
        { status: 400 },
      );
    }

    // Validate asset type
    const validAssetTypes = ['mcp', 'agent', 'workflow', 'plugin'];
    if (!validAssetTypes.includes(assetData.assetType)) {
      return NextResponse.json(
        { error: 'Invalid asset type' },
        { status: 400 },
      );
    }

    // Validate pricing model
    const validPricingModels = [
      'free',
      'one_time',
      'usage_based',
      'subscription',
    ];
    if (!validPricingModels.includes(assetData.pricingModel)) {
      return NextResponse.json(
        { error: 'Invalid pricing model' },
        { status: 400 },
      );
    }

    const assetId = await marketplaceService.createAsset(
      session.user.id,
      session.organizationId,
      assetData,
    );

    return NextResponse.json({
      success: true,
      data: { assetId },
    });
  } catch (error) {
    console.error('Failed to create marketplace asset:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create asset',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
