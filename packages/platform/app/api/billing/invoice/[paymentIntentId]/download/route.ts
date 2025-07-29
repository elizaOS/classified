/**
 * GET /api/billing/invoice/[paymentIntentId]/download
 * Download invoice PDF from Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { loadConfig } from '@/lib/server/utils/config';
import Stripe from 'stripe';

const config = loadConfig();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentIntentId: string }> },
) {
  try {
    // Get user session
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentIntentId } = await params;

    // Get payment intent to verify it belongs to the organization
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata.organizationId !== session.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the charge from the payment intent
    if (!paymentIntent.latest_charge) {
      return NextResponse.json(
        { error: 'No charge found for this payment' },
        { status: 404 },
      );
    }

    const charge = await stripe.charges.retrieve(
      paymentIntent.latest_charge as string,
    );

    if (!charge.receipt_url) {
      return NextResponse.json(
        { error: 'No receipt available for this charge' },
        { status: 404 },
      );
    }

    // For now, redirect to Stripe's receipt URL
    // In a production environment, you might want to:
    // 1. Fetch the receipt from Stripe
    // 2. Generate your own branded invoice PDF
    // 3. Return the PDF as a blob
    return NextResponse.redirect(charge.receipt_url);
  } catch (error) {
    console.error('Failed to download invoice:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to download invoice' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
