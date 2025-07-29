/**
 * POST /api/billing/crypto-webhook
 * Handle Stripe crypto onramp webhooks and add credits when payments complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { loadConfig } from '@/lib/server/utils/config';
import { addCredits } from '@/lib/server/services/billing-service';

const config = loadConfig();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

// This should be set in your environment variables
const webhookSecret = process.env.STRIPE_CRYPTO_WEBHOOK_SECRET;

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    if (!webhookSecret) {
      console.error('Missing webhook secret configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      );
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle crypto onramp events
    switch (event.type) {
      case 'crypto.onramp_session.funds_delivered' as Stripe.Event.Type: {
        const onrampSession = event.data.object as any;

        // Extract metadata
        const organizationId = onrampSession.metadata?.organizationId;
        const userId = onrampSession.metadata?.userId;
        const creditAmount = parseFloat(
          onrampSession.metadata?.creditAmount || '0',
        );

        if (!organizationId || !creditAmount) {
          console.error('Missing required metadata in onramp session');
          return NextResponse.json(
            { error: 'Invalid session metadata' },
            { status: 400 },
          );
        }

        // Add credits to the organization
        await addCredits({
          organizationId,
          userId: userId || undefined,
          amount: creditAmount,
          description: `Crypto purchase via Stripe Onramp - $${creditAmount}`,
          type: 'purchase',
          paymentMethod: 'crypto',
          metadata: {
            stripeOnrampSessionId: onrampSession.id,
            cryptoCurrency:
              onrampSession.transaction_details?.destination_currency,
            cryptoNetwork:
              onrampSession.transaction_details?.destination_network,
            cryptoAmount:
              onrampSession.transaction_details?.destination_exchange_amount,
            walletAddress: onrampSession.transaction_details?.wallet_address,
          },
        });

        console.log(
          `Successfully added $${creditAmount} credits for organization ${organizationId} via crypto onramp`,
        );
        break;
      }

      case 'crypto.onramp_session.updated' as Stripe.Event.Type: {
        const onrampSession = event.data.object as any;
        console.log(
          `Crypto onramp session ${onrampSession.id} updated with status: ${onrampSession.status}`,
        );
        break;
      }

      case 'crypto.onramp_session.failed' as Stripe.Event.Type: {
        const onrampSession = event.data.object as any;
        console.error(`Crypto onramp session ${onrampSession.id} failed`);
        break;
      }

      default:
        console.log(`Unhandled crypto webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Crypto webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
