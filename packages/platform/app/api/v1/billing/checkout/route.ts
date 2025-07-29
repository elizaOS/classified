import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/api/middleware';
import { z } from 'zod';

const checkoutSchema = z.object({
  plan: z.enum(['basic', 'pro', 'premium']),
});

// POST /api/v1/billing/checkout - Create checkout session
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const user = request.user!;

  try {
    const body = await request.json();

    // Validate input
    const validation = checkoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { plan } = validation.data;

    // In a real implementation, this would create a Stripe checkout session
    // For now, we'll return a mock checkout URL
    const checkoutUrl = `https://checkout.stripe.com/pay/cs_test_${plan}_${user.id}`;

    return NextResponse.json({
      success: true,
      data: {
        url: checkoutUrl,
      },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
});
