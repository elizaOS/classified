/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events with deduplication and security
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { addCredits } from '@/lib/server/services/billing-service';
import { loadConfig } from '@/lib/server/utils/config';
import { WebhookDeduplicationService } from '@/lib/billing/webhook-deduplication';
import { StripeService } from '@/lib/billing/stripe';
import { initializeDatabase } from '@/lib/database/server';
import { organizations, auditLogs } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import {
  WebhookRateLimiter,
  createRateLimit,
  RateLimitPresets,
} from '@/lib/middleware/rate-limiter';
import { ApiErrorHandler, ErrorCode } from '@/lib/api/error-handler';
import Stripe from 'stripe';

const config = loadConfig();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

async function handlePOST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for webhook security
    const rateLimitCheck = await createRateLimit(RateLimitPresets.WEBHOOK)(
      request,
    );
    if (rateLimitCheck) {
      console.warn('Webhook rate limit exceeded', {
        ip: request.headers.get('x-forwarded-for'),
        timestamp: new Date().toISOString(),
      });
      return rateLimitCheck;
    }

    // Additional webhook security checks
    const webhookSecurity = WebhookRateLimiter.getInstance();
    const securityCheck = await webhookSecurity.checkWebhookSecurity(request);

    if (!securityCheck.allowed) {
      console.error('Webhook security check failed:', {
        reason: securityCheck.reason,
        ip: request.headers.get('x-forwarded-for'),
        suspicious: securityCheck.suspiciousActivity,
      });

      return ApiErrorHandler.error(
        ErrorCode.FORBIDDEN,
        securityCheck.reason || 'Webhook security check failed',
      );
    }
    // Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 },
      );
    }

    // Validate webhook signature and construct event
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      config.stripe.webhookSecret,
    );

    // Process webhook with deduplication and safety measures
    const result = await WebhookDeduplicationService.processWebhookSafely(
      {
        id: event.id,
        type: event.type,
        createdAt: event.created,
        organizationId:
          'metadata' in event.data.object && event.data.object.metadata
            ? (event.data.object.metadata as any)?.organizationId
            : undefined,
        data: event.data,
      },
      () => handleWebhookEvent(event),
    );

    if (!result.success) {
      console.error(
        `Webhook processing failed for event ${event.id}: ${result.error}`,
      );
      return NextResponse.json(
        { error: 'Webhook processing failed', details: result.error },
        { status: 400 },
      );
    }

    console.log(
      `Webhook ${event.id} processed successfully in ${Date.now() - startTime}ms`,
    );
    return NextResponse.json({ received: true, eventId: event.id });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Webhook error after ${duration}ms:`, error);

    // Return 200 for signature validation errors to prevent retries
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}

async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Failed to handle webhook event:', error);
    throw error;
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { organizationId, userId, creditAmount, type } = session.metadata!;

  if (type === 'credit_purchase') {
    const amount = parseFloat(creditAmount);

    await addCredits({
      organizationId,
      userId,
      amount,
      description: `Credit purchase via Stripe Checkout - Session ${session.id}`,
      type: 'purchase',
      stripePaymentIntentId: session.payment_intent as string,
      paymentMethod: 'stripe',
      metadata: {
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: session.customer as string,
      },
    });

    console.log(
      `Added ${amount} credits to organization ${organizationId} from checkout session ${session.id}`,
    );
  }
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const { organizationId, userId, creditAmount, type } = paymentIntent.metadata;

  if (type === 'credit_purchase' && creditAmount) {
    const amount = parseFloat(creditAmount);

    // Check if we already processed this payment (to avoid duplicates)
    try {
      await addCredits({
        organizationId,
        userId,
        amount,
        description: `Credit purchase via Stripe Payment Intent - ${paymentIntent.id}`,
        type: 'purchase',
        stripePaymentIntentId: paymentIntent.id,
        stripeChargeId: paymentIntent.latest_charge as string,
        paymentMethod: 'stripe',
        metadata: {
          stripeAmount: paymentIntent.amount,
          stripeCurrency: paymentIntent.currency,
        },
      });

      console.log(
        `Added ${amount} credits to organization ${organizationId} from payment intent ${paymentIntent.id}`,
      );
    } catch (error) {
      // May have already been processed by checkout.session.completed
      console.warn('Payment intent already processed or failed:', error);
    }
  } else if (type === 'auto_topup') {
    const amount = paymentIntent.amount / 100; // Convert from cents

    await addCredits({
      organizationId,
      amount,
      description: `Automatic credit top-up - ${paymentIntent.id}`,
      type: 'auto_topup',
      stripePaymentIntentId: paymentIntent.id,
      paymentMethod: 'stripe',
      metadata: {
        isAutoTopUp: true,
        stripeAmount: paymentIntent.amount,
        stripeCurrency: paymentIntent.currency,
      },
    });

    console.log(
      `Auto top-up: Added ${amount} credits to organization ${organizationId}`,
    );
  }
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  try {
    const customerId = invoice.customer as string;
    const subscriptionId = invoice.subscription as string;

    if (!customerId || !subscriptionId) {
      console.warn(
        'Invoice missing required customer or subscription ID:',
        invoice.id,
      );
      return;
    }

    // Get subscription to find organization
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const organizationId = subscription.metadata.organizationId;

    if (!organizationId) {
      console.warn(
        'Subscription missing organizationId metadata:',
        subscriptionId,
      );
      return;
    }

    // Calculate subscription credits based on subscription tier
    const subscriptionCredits = calculateSubscriptionCredits(subscription);

    if (subscriptionCredits > 0) {
      await addCredits({
        organizationId,
        amount: subscriptionCredits,
        description: `Monthly subscription credits - ${subscription.items.data[0]?.price.nickname || 'Subscription'}`,
        type: 'purchase',
        stripePaymentIntentId: invoice.payment_intent as string,
        paymentMethod: 'stripe',
        metadata: {
          stripeInvoiceId: invoice.id,
          stripeSubscriptionId: subscriptionId,
          subscriptionPeriodStart: subscription.current_period_start,
          subscriptionPeriodEnd: subscription.current_period_end,
        },
      });

      console.log(
        `Added ${subscriptionCredits} subscription credits to organization ${organizationId}`,
      );
    }
  } catch (error) {
    console.error('Failed to handle invoice payment succeeded:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  try {
    const organizationId = subscription.metadata.organizationId;

    if (!organizationId) {
      console.warn(
        'Subscription missing organizationId metadata:',
        subscription.id,
      );
      return;
    }

    // Update organization subscription status
    const adapter = await initializeDatabase();
    const db = adapter.getDatabase();
    await db
      .update(organizations)
      .set({
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionTier: mapStripeProductToTier(
          subscription.items.data[0]?.price.product as string,
        ),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    console.log(
      `Updated subscription for organization ${organizationId}: status=${subscription.status}`,
    );

    // Handle subscription tier changes and prorated credits
    if (subscription.status === 'active') {
      await handleSubscriptionTierChange(subscription, organizationId);
    }
  } catch (error) {
    console.error('Failed to handle subscription updated:', error);
    throw error;
  }
}

/**
 * Calculate subscription credits based on subscription tier
 */
function calculateSubscriptionCredits(
  subscription: Stripe.Subscription,
): number {
  const priceId = subscription.items.data[0]?.price.id;

  // Map Stripe price IDs to credit amounts
  const creditMap: Record<string, number> = {
    [config.stripe.priceIds.basic]: 100,
    [config.stripe.priceIds.pro]: 500,
    [config.stripe.priceIds.premium]: 1000,
    [config.stripe.priceIds.enterprise]: 2000,
  };

  return creditMap[priceId] || 0;
}

/**
 * Map Stripe product ID to subscription tier
 */
function mapStripeProductToTier(productId: string): string {
  const tierMap: Record<string, string> = {
    prod_basic: 'basic',
    prod_pro: 'pro',
    prod_premium: 'premium',
    prod_enterprise: 'enterprise',
  };

  return tierMap[productId] || 'free';
}

/**
 * Handle subscription tier changes and prorated credits
 */
async function handleSubscriptionTierChange(
  subscription: Stripe.Subscription,
  organizationId: string,
): Promise<void> {
  try {
    const newTier = mapStripeProductToTier(
      subscription.items.data[0]?.price.product as string,
    );
    const adapter = await initializeDatabase();
    const db = adapter.getDatabase();

    // Get current organization tier
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error('Organization not found');
    }

    const currentTier = org.subscriptionTier;

    // If tier changed, log the change and handle any special logic
    if (currentTier !== newTier) {
      console.log(
        `Subscription tier changed for organization ${organizationId}: ${currentTier} -> ${newTier}`,
      );

      // Add audit log for tier change
      await db.insert(auditLogs).values({
        organizationId,
        action: 'subscription_tier_changed',
        resource: 'subscription',
        resourceId: subscription.id,
        metadata: {
          previousTier: currentTier,
          newTier,
          subscriptionId: subscription.id,
          effectiveDate: new Date(),
        },
      });
    }
  } catch (error) {
    console.error('Failed to handle subscription tier change:', error);
    // Don't throw error here as it's not critical for webhook success
  }
}

export const { POST } = wrapHandlers({ handlePOST });
