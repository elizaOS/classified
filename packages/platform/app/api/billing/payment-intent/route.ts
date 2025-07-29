/**
 * Payment Intent API Route
 * Handles creation of Stripe payment intents for credit purchases
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getBillingService = () =>
  import('@/lib/server/services/billing-service').then((m) => ({
    createPaymentIntent: m.createPaymentIntent,
  }));
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

// Validation schema for payment intent creation
const createPaymentIntentSchema = z.object({
  amount: z.number().min(100).max(1000000), // Amount in cents ($1 - $10,000)
  credits: z.number().min(1).max(1000000),
  currency: z.enum(['usd', 'eur', 'gbp']).default('usd'),
  metadata: z
    .object({
      package: z.string().optional(),
      promotion: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /api/billing/payment-intent - Create payment intent for credit purchase
 */
async function handlePOST(request: NextRequest) {
  try {
    // Get current user session
    const authService = await getAuthService();
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

    // Parse and validate request body
    const body = await request.json();
    const validation = createPaymentIntentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const { amount, credits, currency, metadata } = validation.data;

    // Get billing service
    const { createPaymentIntent } = await getBillingService();

    // Simple validation: ensure amount is reasonable for credits
    // You can customize this logic based on your pricing model
    const creditPrice = 1; // $1 per credit (100 cents)
    const expectedAmount = credits * creditPrice * 100; // Convert to cents
    if (amount !== expectedAmount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payment amount for requested credits',
        },
        { status: 400 },
      );
    }

    // Create payment intent
    const paymentIntent = await createPaymentIntent(
      user.organizationId,
      amount / 100, // Convert cents to dollars
      currency,
    );

    // Return client secret for Stripe Elements
    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        credits,
      },
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);

    // Handle Stripe-specific errors
    if (error instanceof Error) {
      if (error.message.includes('Stripe')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Payment service unavailable',
          },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create payment intent',
      },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication
export const { POST } = wrapHandlers({ handlePOST });
