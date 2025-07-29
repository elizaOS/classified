import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';
import {
  createPaymentIntent,
  createStripeCustomer,
} from '@/lib/server/services/billing-service';
import { authenticateUser } from '@/lib/server/auth/session';
import { auditLog } from '@/lib/server/services/audit-service';

const createPaymentIntentSchema = z.object({
  amount: z.number().min(5).max(10000), // $5 to $10,000
  currency: z.string().optional().default('usd'),
});

async function handlePOST(request: NextRequest) {
  try {
    const { user, organization } = await authenticateUser(request);
    if (!user || !organization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency } = createPaymentIntentSchema.parse(body);

    // Ensure organization has a Stripe customer
    let stripeCustomerId = organization.stripeCustomerId;
    if (!stripeCustomerId) {
      stripeCustomerId = await createStripeCustomer(
        organization.id,
        user.email, // Use user email since organization doesn't have billingEmail property
        organization.name,
      );
    }

    // Create payment intent
    const paymentIntent = await createPaymentIntent(
      organization.id,
      amount,
      currency,
    );

    await auditLog({
      organizationId: organization.id,
      userId: user.id,
      action: 'create',
      resource: 'payment_intent',
      resourceId: paymentIntent.id,
      metadata: {
        amount,
        currency,
        stripeCustomerId,
      },
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Convert back to dollars
        currency: paymentIntent.currency,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error('Failed to create payment intent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
