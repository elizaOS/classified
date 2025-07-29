/**
 * POST /api/billing/crypto-onramp
 * Create a Stripe crypto onramp session for credit purchase
 * https://docs.stripe.com/crypto/onramp/esmodule
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { createStripeCustomer } from '@/lib/server/services/billing-service';
import { getDatabase } from '@/lib/database';
import { organizations } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import Stripe from 'stripe';
import { loadConfig } from '@/lib/server/utils/config';

const config = loadConfig();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

const cryptoOnrampSchema = z.object({
  amount: z.number().min(5).max(10000), // $5 to $10,000
  currency: z.string().optional().default('usd'),
  cryptoCurrency: z.string().optional().default('ethereum'), // eth, btc, etc.
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

async function handlePOST(request: NextRequest) {
  try {
    // Get user session
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const validatedData = cryptoOnrampSchema.parse(body);

    const db = await getDatabase();

    // Get organization details
    const [organization] = await db
      .select({
        stripeCustomerId: organizations.stripeCustomerId,
        name: organizations.name,
        billingEmail: organizations.billingEmail,
      })
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1);

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // Ensure Stripe customer exists
    let customerId = organization.stripeCustomerId;
    if (!customerId) {
      customerId = await createStripeCustomer(
        session.organizationId,
        organization.billingEmail || session?.email || '',
        organization.name,
      );
    }

    // Create crypto onramp session
    const onrampSession = await (stripe as any).crypto.onrampSessions.create({
      transaction_details: {
        destination_currency: validatedData.cryptoCurrency,
        destination_exchange_amount: validatedData.amount.toString(),
        destination_network: 'ethereum', // Can be made configurable
        wallet_address:
          process.env.ELIZA_CRYPTO_WALLET_ADDRESS ||
          '0x742DE48ac8D2C57A1cfE3cE8e65C0F92fAe93cA5', // Platform wallet address
      },
      customer_ip_address:
        request.headers.get('x-forwarded-for') || '127.0.0.1',
      customer_information: {
        customer_id: customerId,
        email: organization.billingEmail || session?.email || '',
      },
      metadata: {
        organizationId: session.organizationId,
        userId: session.userId,
        creditAmount: validatedData.amount.toString(),
        type: 'crypto_credit_purchase',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        url: onrampSession.url,
        sessionId: onrampSession.id,
        clientSecret: onrampSession.client_secret,
        amount: validatedData.amount,
        cryptoCurrency: validatedData.cryptoCurrency,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 },
      );
    }

    console.error('Failed to create crypto onramp session:', error);
    return NextResponse.json(
      { error: 'Failed to create crypto onramp session' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
