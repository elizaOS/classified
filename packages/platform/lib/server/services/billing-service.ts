import { eq, and, desc, sum, gte, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import { getDatabase } from '@/lib/database';
import {
  organizations,
  creditTransactions,
  users,
  type Organization,
  type CreditTransaction,
  type NewCreditTransaction,
} from '@/lib/database/schema';
import { loadConfig } from '../utils/config';

const config = loadConfig();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2025-02-24.acacia',
});

interface AddCreditsData {
  organizationId: string;
  userId?: string;
  amount: number;
  description: string;
  type: 'purchase' | 'adjustment' | 'auto_topup' | 'refund';
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

interface DeductCreditsData {
  organizationId: string;
  userId?: string;
  amount: number;
  description: string;
  agentId?: string;
  usageRecordId?: string;
  metadata?: Record<string, any>;
}

export async function getCreditBalance(
  organizationId: string,
): Promise<number> {
  try {
    // Validate UUID format
    if (
      !organizationId ||
      !organizationId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      return 0;
    }

    const db = await getDatabase();
    const [organization] = await db
      .select({ creditBalance: organizations.creditBalance })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    return organization ? parseFloat(organization.creditBalance) : 0;
  } catch (error) {
    console.error('Error getting credit balance:', error);
    return 0;
  }
}

export async function addCredits(
  data: AddCreditsData,
): Promise<CreditTransaction> {
  // Validate amount is positive
  if (data.amount <= 0) {
    throw new Error('Credit amount must be greater than 0');
  }

  const db = await getDatabase();
  return await db.transaction(async (tx: any) => {
    // Get current balance
    const [organization] = await tx
      .select({ creditBalance: organizations.creditBalance })
      .from(organizations)
      .where(eq(organizations.id, data.organizationId))
      .limit(1);

    if (!organization) {
      throw new Error('Organization not found');
    }

    const currentBalance = parseFloat(organization.creditBalance);
    const newBalance = currentBalance + data.amount;

    // Update organization balance
    await tx
      .update(organizations)
      .set({
        creditBalance: newBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, data.organizationId));

    // Create transaction record
    const transaction: NewCreditTransaction = {
      organizationId: data.organizationId,
      userId: data.userId || null,
      type: data.type,
      amount: data.amount.toString(),
      description: data.description,
      stripePaymentIntentId: data.stripePaymentIntentId || null,
      stripeChargeId: data.stripeChargeId || null,
      paymentMethod: data.paymentMethod || null,
      balanceAfter: newBalance.toString(),
      metadata: data.metadata || {},
    };

    const [creditTransaction] = await tx
      .insert(creditTransactions)
      .values(transaction)
      .returning();

    return creditTransaction;
  });
}

export async function deductCredits(
  data: DeductCreditsData,
): Promise<CreditTransaction | null> {
  try {
    // Validate organization UUID format
    if (
      !data.organizationId ||
      !data.organizationId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      throw new Error('Invalid organization ID format');
    }

    const db = await getDatabase();
    return await db.transaction(async (tx: any) => {
      // First get the current balance to check before the atomic update
      const [org] = await tx
        .select({
          creditBalance: organizations.creditBalance,
          autoTopUpEnabled: organizations.autoTopUpEnabled,
          autoTopUpAmount: organizations.autoTopUpAmount,
          creditThreshold: organizations.creditThreshold,
          stripeCustomerId: organizations.stripeCustomerId,
        })
        .from(organizations)
        .where(eq(organizations.id, data.organizationId))
        .limit(1);

      if (!org) {
        throw new Error('Organization not found');
      }

      const currentBalance = parseFloat(org.creditBalance);

      // Check if sufficient balance before attempting atomic update
      if (currentBalance < data.amount) {
        throw new Error('Insufficient credit balance');
      }

      // Atomic update with balance check - only update if balance is still sufficient
      const [updatedOrg] = await tx
        .update(organizations)
        .set({
          creditBalance: sql`GREATEST(0, CAST(${organizations.creditBalance} AS DECIMAL) - ${data.amount})`,
          updatedAt: new Date(),
        })
        .where(
          sql`${organizations.id} = ${data.organizationId} AND CAST(${organizations.creditBalance} AS DECIMAL) >= ${data.amount}`,
        )
        .returning({
          newBalance: organizations.creditBalance,
        });

      if (!updatedOrg) {
        // Update failed - insufficient balance (concurrent deduction happened)
        throw new Error('Insufficient credit balance');
      }

      const newBalance = parseFloat(updatedOrg.newBalance);

      // Create transaction record
      const transaction: NewCreditTransaction = {
        organizationId: data.organizationId,
        userId: data.userId || null,
        type: 'usage',
        amount: (-data.amount).toString(), // Negative for deduction
        description: data.description,
        agentId: data.agentId || null,
        usageRecordId: data.usageRecordId || null,
        balanceAfter: newBalance.toString(),
        metadata: data.metadata || {},
      };

      const [creditTransaction] = await tx
        .insert(creditTransactions)
        .values(transaction)
        .returning();

      // Check if auto top-up should be triggered
      const threshold = parseFloat(org.creditThreshold);
      if (
        org.autoTopUpEnabled &&
        newBalance <= threshold &&
        org.stripeCustomerId
      ) {
        // Trigger auto top-up (async, don't wait for it)
        triggerAutoTopUp(
          data.organizationId,
          org.stripeCustomerId,
          parseFloat(org.autoTopUpAmount),
        ).catch((error) => console.error('Auto top-up failed:', error));
      }

      return creditTransaction;
    });
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw error;
  }
}

async function triggerAutoTopUp(
  organizationId: string,
  stripeCustomerId: string,
  amount: number,
): Promise<void> {
  try {
    // Create a payment intent for auto top-up
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        organizationId,
        type: 'auto_topup',
      },
    });

    // In a real implementation, you might want to:
    // 1. Store the payment intent for tracking
    // 2. Send notification to the organization about the auto top-up
    // 3. Use the customer's default payment method if available

    console.log('Auto top-up payment intent created:', paymentIntent.id);
  } catch (error) {
    console.error('Failed to create auto top-up payment intent:', error);
    throw error;
  }
}

export async function createStripeCustomer(
  organizationId: string,
  email: string,
  name: string,
): Promise<string> {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      organizationId,
    },
  });

  // Update organization with Stripe customer ID
  const db = await getDatabase();
  await db
    .update(organizations)
    .set({
      stripeCustomerId: customer.id,
      billingEmail: email,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  return customer.id;
}

export async function ensureStripeCustomer(
  organizationId: string,
): Promise<string> {
  const db = await getDatabase();
  const [organization] = await db
    .select({
      stripeCustomerId: organizations.stripeCustomerId,
      billingEmail: organizations.billingEmail,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new Error('Organization not found');
  }

  if (organization.stripeCustomerId) {
    return organization.stripeCustomerId;
  }

  // Create Stripe customer
  const customer = await stripe.customers.create({
    metadata: { organizationId },
    email: organization.billingEmail || undefined,
  });

  // Update organization with customer ID
  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.id, organizationId));

  return customer.id;
}

export async function createPaymentIntent(
  organizationId: string,
  amount: number,
  currency: string = 'usd',
): Promise<Stripe.PaymentIntent> {
  // Ensure customer exists
  const stripeCustomerId = await ensureStripeCustomer(organizationId);

  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    customer: stripeCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      organizationId,
      type: 'credit_purchase',
    },
  });
}

export async function getCreditTransactions(
  organizationId: string,
  options: {
    limit?: number;
    offset?: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {},
): Promise<CreditTransaction[]> {
  const { limit = 50, offset = 0 } = options;

  const conditions = [eq(creditTransactions.organizationId, organizationId)];

  if (options.type) {
    conditions.push(eq(creditTransactions.type, options.type));
  }

  const db = await getDatabase();
  return await db
    .select()
    .from(creditTransactions)
    .where(and(...conditions))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getUsageStatistics(
  organizationId: string,
  period: 'day' | 'week' | 'month' | 'year' = 'month',
): Promise<{
  totalUsage: number;
  totalCreditsAdded: number;
  totalCreditsDeducted: number;
  transactionCount: number;
}> {
  // Calculate date range based on period
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  const db = await getDatabase();
  const transactions = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.organizationId, organizationId),
        gte(creditTransactions.createdAt, startDate),
      ),
    );

  const stats = transactions.reduce(
    (
      acc: {
        totalUsage: number;
        totalCreditsAdded: number;
        totalCreditsDeducted: number;
        transactionCount: number;
      },
      transaction: CreditTransaction,
    ) => {
      const amount = parseFloat(transaction.amount);

      if (amount > 0) {
        acc.totalCreditsAdded += amount;
      } else {
        acc.totalCreditsDeducted += Math.abs(amount);
      }

      acc.transactionCount++;
      return acc;
    },
    {
      totalUsage: 0,
      totalCreditsAdded: 0,
      totalCreditsDeducted: 0,
      transactionCount: 0,
    },
  );

  stats.totalUsage = stats.totalCreditsDeducted;

  return stats;
}

// Utility function to add initial free credits
export async function addInitialCredits(
  organizationId: string,
  userId: string,
): Promise<void> {
  const INITIAL_CREDIT_AMOUNT = 5.0; // $5 in credits

  await addCredits({
    organizationId,
    userId,
    amount: INITIAL_CREDIT_AMOUNT,
    description: 'Welcome bonus - $5 free credits',
    type: 'adjustment',
    paymentMethod: 'system',
    metadata: {
      isWelcomeBonus: true,
    },
  });
}
