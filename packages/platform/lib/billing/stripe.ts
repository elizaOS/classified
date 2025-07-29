/**
 * Stripe billing service
 * Handles payment processing, subscriptions, and credit management
 */

import Stripe from 'stripe';
import { getDatabase } from '../database/connection';
import { creditTransactions, organizations } from '../database/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

// Initialize Stripe only if the secret key is available
let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });
} else {
  console.warn(
    'Stripe configuration is missing. Billing features will be disabled.',
  );
}

export interface CreatePaymentIntentOptions {
  amount: number; // in cents
  currency?: string;
  organizationId: string;
  userId: string;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutSessionOptions {
  priceId: string;
  organizationId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CreditPurchaseOptions {
  organizationId: string;
  userId: string;
  amount: number; // Credit amount in dollars
  paymentIntentId: string;
}

export class StripeService {
  /**
   * Create a payment intent for credit purchase
   */
  static async createPaymentIntent(
    options: CreatePaymentIntentOptions,
  ): Promise<Stripe.PaymentIntent> {
    if (!stripe) {
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
      );
    }

    const {
      amount,
      currency = 'usd',
      organizationId,
      userId,
      metadata = {},
    } = options;

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          organizationId,
          userId,
          type: 'credit_purchase',
          ...metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Create a checkout session for subscription
   */
  static async createCheckoutSession(
    options: CreateCheckoutSessionOptions,
  ): Promise<Stripe.Checkout.Session> {
    if (!stripe) {
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
      );
    }

    const {
      priceId,
      organizationId,
      userId,
      successUrl,
      cancelUrl,
      metadata = {},
    } = options;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          organizationId,
          userId,
          ...metadata,
        },
        customer_creation: 'always',
      });

      return session;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Confirm payment intent and add credits with atomic balance calculation
   */
  static async confirmPaymentAndAddCredits(
    options: CreditPurchaseOptions,
  ): Promise<void> {
    const { organizationId, userId, amount, paymentIntentId } = options;
    const db = getDatabase();

    try {
      // Use database transaction for atomic operation
      await db.transaction(async (tx: any) => {
        // Verify payment intent
        if (!stripe) {
          throw new Error(
            'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
          );
        }
        const paymentIntent =
          await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
          throw new Error('Payment has not succeeded');
        }

        if (
          paymentIntent.metadata.organizationId !== organizationId ||
          paymentIntent.metadata.userId !== userId
        ) {
          throw new Error('Payment intent metadata mismatch');
        }

        // Check for duplicate transaction
        const existingTransaction = await tx
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId))
          .limit(1);

        if (existingTransaction.length > 0) {
          throw new Error('Transaction already processed');
        }

        // Get current balance with row lock
        const currentBalance = await this.getCurrentBalanceWithLock(
          tx,
          organizationId,
        );
        const newBalance = currentBalance + amount;

        // Add credit transaction with calculated balance
        await tx.insert(creditTransactions).values({
          organizationId,
          userId,
          type: 'purchase',
          amount: amount.toString(),
          description: `Credit purchase via Stripe - $${amount}`,
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: paymentIntent.latest_charge as string,
          paymentMethod: 'stripe',
          balanceAfter: newBalance.toString(),
          metadata: {
            stripePaymentIntentId: paymentIntentId,
            stripeAmount: paymentIntent.amount,
            stripeCurrency: paymentIntent.currency,
            previousBalance: currentBalance.toString(),
          },
        });

        // Update organization balance
        await tx
          .update(organizations)
          .set({
            creditBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, organizationId));

        console.log(
          `Successfully added ${amount} credits to organization ${organizationId}. New balance: ${newBalance}`,
        );
      });
    } catch (error) {
      console.error('Failed to confirm payment and add credits:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to process credit purchase');
    }
  }

  /**
   * Get current balance with row-level lock for atomic operations
   */
  private static async getCurrentBalanceWithLock(
    tx: any,
    organizationId: string,
  ): Promise<number> {
    const result = await tx
      .select({ creditBalance: organizations.creditBalance })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .for('update') // Row-level lock
      .limit(1);

    if (result.length === 0) {
      throw new Error('Organization not found');
    }

    return parseFloat(result[0].creditBalance);
  }

  /**
   * Deduct credits for usage with atomic balance calculation
   */
  static async deductCredits(
    organizationId: string,
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const db = getDatabase();

    try {
      await db.transaction(async (tx: any) => {
        // Get current balance with row lock
        const currentBalance = await this.getCurrentBalanceWithLock(
          tx,
          organizationId,
        );

        if (currentBalance < amount) {
          throw new Error(
            `Insufficient credit balance. Current: ${currentBalance}, Required: ${amount}`,
          );
        }

        const newBalance = currentBalance - amount;

        // Add deduction transaction
        await tx.insert(creditTransactions).values({
          organizationId,
          userId,
          type: 'usage',
          amount: (-amount).toString(), // Negative for deduction
          description,
          balanceAfter: newBalance.toString(),
          metadata: {
            ...metadata,
            previousBalance: currentBalance.toString(),
            deductedAmount: amount.toString(),
          },
        });

        // Update organization balance
        await tx
          .update(organizations)
          .set({
            creditBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, organizationId));

        console.log(
          `Successfully deducted ${amount} credits from organization ${organizationId}. New balance: ${newBalance}`,
        );
      });
    } catch (error) {
      console.error('Failed to deduct credits:', error);
      throw error instanceof Error
        ? error
        : new Error('Failed to deduct credits');
    }
  }

  /**
   * Get current credit balance for organization from organization table (source of truth)
   */
  static async getCreditBalance(organizationId: string): Promise<number> {
    const db = getDatabase();

    try {
      const result = await db
        .select({ creditBalance: organizations.creditBalance })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (result.length === 0) {
        throw new Error('Organization not found');
      }

      const balance = parseFloat(result[0].creditBalance);
      return Math.max(0, balance); // Ensure non-negative balance
    } catch (error) {
      console.error('Failed to get credit balance:', error);
      throw new Error('Failed to get credit balance');
    }
  }

  /**
   * Verify credit balance consistency between transactions and organization table
   */
  static async verifyCreditBalanceConsistency(organizationId: string): Promise<{
    organizationBalance: number;
    transactionBalance: number;
    isConsistent: boolean;
    difference: number;
  }> {
    const db = getDatabase();

    try {
      // Get balance from organization table
      const organizationBalance = await this.getCreditBalance(organizationId);

      // Calculate balance from transactions
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.organizationId, organizationId));

      const transactionBalance = transactions.reduce(
        (total: number, transaction: any) => {
          return total + parseFloat(transaction.amount);
        },
        0,
      );

      const difference = Math.abs(organizationBalance - transactionBalance);
      const isConsistent = difference < 0.01; // Allow for floating point precision

      return {
        organizationBalance,
        transactionBalance,
        isConsistent,
        difference,
      };
    } catch (error) {
      console.error('Failed to verify credit balance consistency:', error);
      throw new Error('Failed to verify credit balance consistency');
    }
  }

  /**
   * Get credit transaction history
   */
  static async getCreditTransactions(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const db = getDatabase();
    const { limit = 50, offset = 0, startDate, endDate } = options;

    try {
      // Build where conditions array
      const conditions: any[] = [
        eq(creditTransactions.organizationId, organizationId),
      ];

      if (startDate) {
        conditions.push(gte(creditTransactions.createdAt, startDate));
      }

      if (endDate) {
        conditions.push(lte(creditTransactions.createdAt, endDate));
      }

      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(and(...conditions))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(limit)
        .offset(offset);
      return transactions;
    } catch (error) {
      console.error('Failed to get credit transactions:', error);
      throw new Error('Failed to get credit transactions');
    }
  }

  /**
   * Get billing overview for organization
   */
  static async getBillingOverview(organizationId: string) {
    const db = getDatabase();

    try {
      const creditBalance = await this.getCreditBalance(organizationId);

      // Get this month's usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyTransactions = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.organizationId, organizationId),
            gte(creditTransactions.createdAt, startOfMonth),
          ),
        );

      const monthlyUsage = monthlyTransactions
        .filter((t: any) => t.type === 'usage')
        .reduce(
          (total: number, t: any) => total + Math.abs(parseFloat(t.amount)),
          0,
        );

      const monthlyPurchases = monthlyTransactions
        .filter((t: any) => t.type === 'purchase')
        .reduce((total: number, t: any) => total + parseFloat(t.amount), 0);

      // Get usage breakdown by service (from metadata)
      const usageBreakdown = monthlyTransactions
        .filter((t: any) => t.type === 'usage')
        .reduce((breakdown: Record<string, number>, transaction: any) => {
          const service = transaction.metadata?.service || 'unknown';
          breakdown[service] =
            (breakdown[service] || 0) +
            Math.abs(parseFloat(transaction.amount));
          return breakdown;
        }, {});

      return {
        creditBalance,
        monthlyUsage,
        monthlyPurchases,
        usageBreakdown,
        subscriptionTier: 'pay-as-you-go', // TODO: Implement subscription tiers
        nextBillingDate: null, // TODO: Implement for subscriptions
      };
    } catch (error) {
      console.error('Failed to get billing overview:', error);
      throw new Error('Failed to get billing overview');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice,
          );
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Failed to handle webhook:', error);
      throw error;
    }
  }

  private static async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    const { organizationId, userId, type } = paymentIntent.metadata;

    if (type === 'credit_purchase') {
      const amount = paymentIntent.amount / 100; // Convert from cents

      await this.confirmPaymentAndAddCredits({
        organizationId,
        userId,
        amount,
        paymentIntentId: paymentIntent.id,
      });
    }
  }

  private static async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    // Handle subscription checkout completion
    const { organizationId, userId } = session.metadata!;

    // TODO: Update organization subscription status
    console.log('Checkout session completed for organization:', organizationId);
  }

  private static async handleInvoicePaymentSucceeded(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    // Handle subscription payment
    console.log('Invoice payment succeeded:', invoice.id);
  }

  private static async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    // Handle subscription changes
    console.log('Subscription updated:', subscription.id);
  }

  /**
   * Get Stripe customer for organization
   */
  static async getOrCreateCustomer(
    organizationId: string,
    email: string,
  ): Promise<Stripe.Customer> {
    if (!stripe) {
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
      );
    }

    try {
      // Try to find existing customer
      const customers = await stripe.customers.list({
        email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        return customers.data[0];
      }

      // Create new customer
      const customer = await stripe.customers.create({
        email,
        metadata: {
          organizationId,
        },
      });

      return customer;
    } catch (error) {
      console.error('Failed to get or create customer:', error);
      throw new Error('Failed to get or create customer');
    }
  }

  /**
   * Validate webhook signature
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
  ): Stripe.Event {
    if (!stripe) {
      throw new Error(
        'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.',
      );
    }
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error(
        'Stripe webhook secret is not configured. Please set STRIPE_WEBHOOK_SECRET environment variable.',
      );
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('Failed to validate webhook signature:', error);
      throw new Error('Invalid webhook signature');
    }
  }
}

export { stripe };
