import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/api/middleware';
import { db } from '@/lib/api/database';

// GET /api/v1/billing/subscription - Get subscription details
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const user = request.user!;

  const subscription = await db.subscriptions.findByUserId(user.id);

  if (!subscription) {
    // Return free tier info if no subscription
    return NextResponse.json({
      success: true,
      data: {
        subscription: {
          id: null,
          status: 'free',
          plan: 'free',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    },
  });
});
