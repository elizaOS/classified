import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { RevenueSharing } from '@/lib/services/revenue-sharing';
import { auth } from '@/lib/auth';

const revenueService = new RevenueSharing();

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);

    // Parse date range
    const startParam = url.searchParams.get('startDate');
    const endParam = url.searchParams.get('endDate');

    let startDate = new Date();
    let endDate = new Date();

    if (startParam) {
      startDate = new Date(startParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format' },
          { status: 400 },
        );
      }
    } else {
      // Default to current month
      startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    }

    if (endParam) {
      endDate = new Date(endParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format' },
          { status: 400 },
        );
      }
    } else {
      // Default to end of current month
      endDate = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0,
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 },
      );
    }

    // Calculate earnings for the period
    const earnings = await revenueService.calculateCreatorEarnings(
      session.user.id,
      session.organizationId,
      { startDate, endDate },
    );

    return NextResponse.json({
      success: true,
      data: earnings,
    });
  } catch (error) {
    console.error('Failed to calculate earnings:', error);
    return NextResponse.json(
      { error: 'Failed to calculate earnings' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
