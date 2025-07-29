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

    // Get payout history for the creator
    const payouts = await revenueService.getPayoutHistory(
      session.user.id,
      session.organizationId,
    );

    return NextResponse.json({
      success: true,
      data: payouts,
    });
  } catch (error) {
    console.error('Failed to get payout history:', error);
    return NextResponse.json(
      { error: 'Failed to get payout history' },
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

    const payoutRequest = await request.json();

    // Validate required fields
    if (
      !payoutRequest.period ||
      !payoutRequest.amount ||
      !payoutRequest.payoutMethod
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: period, amount, payoutMethod' },
        { status: 400 },
      );
    }

    // Validate payout method
    const validMethods = ['stripe', 'crypto', 'bank'];
    if (!validMethods.includes(payoutRequest.payoutMethod)) {
      return NextResponse.json(
        { error: 'Invalid payout method' },
        { status: 400 },
      );
    }

    // Validate period dates
    const startDate = new Date(payoutRequest.period.startDate);
    const endDate = new Date(payoutRequest.period.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid period dates' },
        { status: 400 },
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 },
      );
    }

    // Validate amount
    const amount = parseFloat(payoutRequest.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Process payout
    const payout = await revenueService.processPayout({
      creatorId: session.user.id,
      organizationId: session.organizationId,
      period: {
        startDate,
        endDate,
      },
      amount,
      payoutMethod: payoutRequest.payoutMethod,
      payoutAddress: payoutRequest.payoutAddress || '',
    });

    return NextResponse.json({
      success: true,
      data: payout,
    });
  } catch (error) {
    console.error('Failed to process payout:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to process payout',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
