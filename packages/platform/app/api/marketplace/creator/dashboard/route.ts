import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceService } from '@/lib/services/marketplace';
import { auth } from '@/lib/auth';

const marketplaceService = new MarketplaceService();

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get creator dashboard data
    const dashboard = await marketplaceService.getCreatorDashboard(
      session.user.id,
      session.organizationId,
    );

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Failed to get creator dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to get creator dashboard' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
