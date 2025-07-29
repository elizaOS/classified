import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceService } from '@/lib/services/marketplace';
import { auth } from '@/lib/auth';

const marketplaceService = new MarketplaceService();

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assetId = resolvedParams.id;

    // Toggle favorite status
    const isFavorited = await marketplaceService.toggleFavorite(
      assetId,
      session.user.id,
      session.organizationId,
    );

    return NextResponse.json({
      success: true,
      data: {
        isFavorited,
        message: isFavorited ? 'Added to favorites' : 'Removed from favorites',
      },
    });
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
