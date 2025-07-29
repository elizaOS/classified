/**
 * POST /api/billing/confirm-payment
 * Confirm payment and add credits to organization balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import {
  addCredits,
  getCreditBalance,
} from '@/lib/server/services/billing-service';
import { loadConfig } from '@/lib/server/utils/config';
import Stripe from 'stripe';
import { z } from 'zod';

const config = loadConfig();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

const confirmPaymentSchema = z.object({
  paymentIntentId: z.string(),
  amount: z.number().min(5).max(10000),
});

async function handlePOST(request: NextRequest) {
  try {
    // Get current user session
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await request.json();
    const validatedData = confirmPaymentSchema.parse(body);

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(
      validatedData.paymentIntentId,
    );

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment has not succeeded',
        },
        { status: 400 },
      );
    }

    // Verify the payment intent belongs to this organization
    if (paymentIntent.metadata.organizationId !== user.organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment intent metadata mismatch',
        },
        { status: 400 },
      );
    }

    // Add credits to organization
    await addCredits({
      organizationId: user.organizationId,
      userId: user.id,
      amount: validatedData.amount,
      description: `Credit purchase via Stripe - $${validatedData.amount}`,
      type: 'purchase',
      stripePaymentIntentId: validatedData.paymentIntentId,
      stripeChargeId: paymentIntent.latest_charge as string,
      paymentMethod: 'stripe',
      metadata: {
        stripePaymentIntentId: validatedData.paymentIntentId,
        stripeAmount: paymentIntent.amount,
        stripeCurrency: paymentIntent.currency,
      },
    });

    // Get updated balance
    const newBalance = await getCreditBalance(user.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        creditBalance: newBalance,
        message: `Successfully added $${validatedData.amount} in credits`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    console.error('Failed to confirm payment:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to confirm payment',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
