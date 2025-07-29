import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import Stripe from 'stripe';
import { addCredits } from '@/lib/server/services/billing-service';
import { loadConfig } from '@/lib/server/utils/config';

const config = loadConfig();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

const endpointSecret = config.stripe.webhookSecret;

async function handlePOST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !endpointSecret) {
    return NextResponse.json(
      { error: 'Missing signature or endpoint secret' },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription, event.type);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const organizationId = paymentIntent.metadata.organizationId;
  const type = paymentIntent.metadata.type as 'credit_purchase' | 'auto_topup';

  if (!organizationId) {
    console.error('Payment intent missing organizationId:', paymentIntent.id);
    return;
  }

  // Convert cents to dollars
  const amount = paymentIntent.amount / 100;

  // Add 10% margin to the credit amount (platform fee)
  const creditAmount = amount * 0.9; // Give 90% of payment as credits

  const description =
    type === 'auto_topup'
      ? `Auto top-up: $${amount} payment`
      : `Credit purchase: $${amount} payment`;

  await addCredits({
    organizationId,
    amount: creditAmount,
    description,
    type: type === 'auto_topup' ? 'auto_topup' : 'purchase',
    stripePaymentIntentId: paymentIntent.id,
    stripeChargeId: paymentIntent.latest_charge as string,
    paymentMethod: 'stripe',
    metadata: {
      originalAmount: amount,
      platformFee: amount * 0.1,
      stripePaymentIntent: paymentIntent.id,
    },
  });

  console.log(
    `Credits added for organization ${organizationId}: $${creditAmount}`,
  );
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const organizationId = paymentIntent.metadata.organizationId;

  console.error(`Payment failed for organization ${organizationId}:`, {
    paymentIntentId: paymentIntent.id,
    lastPaymentError: paymentIntent.last_payment_error,
  });

  // TODO: Implement notification system to alert organization of failed payment
  // TODO: If this was an auto top-up, might want to disable auto top-up or reduce threshold
}

async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  eventType: string,
) {
  // TODO: Implement subscription handling for recurring billing plans
  // This would update the organization's subscription status and limits

  console.log(`Subscription ${eventType}:`, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  });
}

export const { POST } = wrapHandlers({ handlePOST });
