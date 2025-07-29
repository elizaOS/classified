/**
 * Auto Top-up Service
 * Handles automatic credit top-ups when balance falls below threshold
 */

import { getDatabase } from '../database/connection';
import { organizations, creditTransactions } from '../database/schema';
import { eq, and, gte } from 'drizzle-orm';
import { StripeService } from './stripe';
import { RetryService, circuitBreakerRegistry } from '../utils/retry';
import Stripe from 'stripe';

export interface AutoTopUpTrigger {
  organizationId: string;
  currentBalance: number;
  threshold: number;
  topUpAmount: number;
}

export class AutoTopUpService {
  /**
   * Check if organization needs auto top-up and trigger if necessary
   */
  static async checkAndTriggerAutoTopUp(
    organizationId: string,
  ): Promise<boolean> {
    const db = getDatabase();
    const circuitBreaker =
      circuitBreakerRegistry.getCircuitBreaker(organizationId);

    // Check circuit breaker first
    if (!circuitBreaker.canAttemptTopUp()) {
      console.log(
        `Auto top-up circuit breaker open for organization ${organizationId}`,
      );
      return false;
    }

    try {
      // Get organization settings with row lock
      const [org] = await db
        .select({
          autoTopUpEnabled: organizations.autoTopUpEnabled,
          creditBalance: organizations.creditBalance,
          creditThreshold: organizations.creditThreshold,
          autoTopUpAmount: organizations.autoTopUpAmount,
          stripeCustomerId: organizations.stripeCustomerId,
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .for('update')
        .limit(1);

      if (!org) {
        throw new Error('Organization not found');
      }

      if (!org.autoTopUpEnabled) {
        return false; // Auto top-up disabled
      }

      const currentBalance = parseFloat(org.creditBalance);
      const threshold = parseFloat(org.creditThreshold);
      const topUpAmount = parseFloat(org.autoTopUpAmount);

      // Check if balance is below threshold
      if (currentBalance >= threshold) {
        return false; // No top-up needed
      }

      // Check if we already triggered auto top-up recently (prevent spam)
      const recentTopUp = await this.hasRecentAutoTopUp(organizationId);
      if (recentTopUp) {
        console.log(
          `Auto top-up already triggered recently for organization ${organizationId}`,
        );
        return false;
      }

      if (!org.stripeCustomerId) {
        throw new Error('No Stripe customer ID found for auto top-up');
      }

      // Trigger auto top-up with retry logic
      const result = await RetryService.executeWithRetry(
        () =>
          this.triggerAutoTopUp({
            organizationId,
            currentBalance,
            threshold,
            topUpAmount,
          }),
        {
          maxAttempts: 3,
          baseDelayMs: 2000,
          maxDelayMs: 10000,
        },
      );

      if (result.success) {
        circuitBreaker.recordSuccess();
        return true;
      } else {
        circuitBreaker.recordFailure();
        throw result.error || new Error('Auto top-up failed after retries');
      }
    } catch (error) {
      console.error('Failed to check and trigger auto top-up:', error);
      throw error;
    }
  }

  /**
   * Check if there was a recent auto top-up attempt
   */
  private static async hasRecentAutoTopUp(
    organizationId: string,
  ): Promise<boolean> {
    const db = getDatabase();

    try {
      // Check for auto top-up attempts in the last 10 minutes
      const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);

      const recentAttempts = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.organizationId, organizationId),
            eq(creditTransactions.type, 'auto_topup'),
            gte(creditTransactions.createdAt, cutoffTime),
          ),
        )
        .limit(1);

      return recentAttempts.length > 0;
    } catch (error) {
      console.error('Failed to check recent auto top-up:', error);
      return false; // Allow top-up if check fails
    }
  }

  /**
   * Actually trigger the auto top-up payment
   */
  private static async triggerAutoTopUp(
    trigger: AutoTopUpTrigger,
  ): Promise<void> {
    const db = getDatabase();

    try {
      // Get organization's default payment method
      const defaultPaymentMethod = await this.getDefaultPaymentMethod(
        trigger.organizationId,
      );

      if (!defaultPaymentMethod) {
        // Create a pending transaction to track the failed attempt
        await db.insert(creditTransactions).values({
          organizationId: trigger.organizationId,
          type: 'auto_topup_failed',
          amount: '0',
          description: 'Auto top-up failed: No default payment method',
          balanceAfter: trigger.currentBalance.toString(),
          metadata: {
            reason: 'no_payment_method',
            threshold: trigger.threshold,
            topUpAmount: trigger.topUpAmount,
            triggeredAt: new Date().toISOString(),
          },
        });

        throw new Error('No default payment method available for auto top-up');
      }

      // Create payment intent for auto top-up
      const paymentIntent = await StripeService.createPaymentIntent({
        amount: Math.round(trigger.topUpAmount * 100), // Convert to cents
        currency: 'usd',
        organizationId: trigger.organizationId,
        userId: 'system', // Auto top-up is system-initiated
        metadata: {
          type: 'auto_topup',
          triggeredBy: 'low_balance',
          threshold: trigger.threshold.toString(),
          originalBalance: trigger.currentBalance.toString(),
        },
      });

      // Confirm payment using default payment method
      const confirmedPayment = await this.confirmAutoTopUpPayment(
        paymentIntent.id,
        defaultPaymentMethod.id,
      );

      if (confirmedPayment.status === 'succeeded') {
        // Payment succeeded, credits will be added via webhook
        console.log(
          `Auto top-up payment succeeded for organization ${trigger.organizationId}: ${trigger.topUpAmount} USD`,
        );
      } else {
        // Payment failed or requires action
        await db.insert(creditTransactions).values({
          organizationId: trigger.organizationId,
          type: 'auto_topup_failed',
          amount: '0',
          description: `Auto top-up payment failed: ${confirmedPayment.status}`,
          stripePaymentIntentId: paymentIntent.id,
          balanceAfter: trigger.currentBalance.toString(),
          metadata: {
            reason: 'payment_failed',
            paymentStatus: confirmedPayment.status,
            threshold: trigger.threshold,
            topUpAmount: trigger.topUpAmount,
            triggeredAt: new Date().toISOString(),
          },
        });

        throw new Error(
          `Auto top-up payment failed: ${confirmedPayment.status}`,
        );
      }
    } catch (error) {
      console.error('Failed to trigger auto top-up:', error);
      throw error;
    }
  }

  /**
   * Get organization's default payment method
   */
  private static async getDefaultPaymentMethod(
    organizationId: string,
  ): Promise<Stripe.PaymentMethod | null> {
    const db = getDatabase();

    try {
      // Get organization's Stripe customer ID
      const [org] = await db
        .select({ stripeCustomerId: organizations.stripeCustomerId })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org?.stripeCustomerId) {
        return null;
      }

      // Get customer's default payment method
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-02-24.acacia',
      });

      const customer = await stripe.customers.retrieve(org.stripeCustomerId);

      if (customer.deleted) {
        return null;
      }

      const defaultPaymentMethodId = (customer as Stripe.Customer)
        .invoice_settings?.default_payment_method;

      if (!defaultPaymentMethodId) {
        return null;
      }

      return await stripe.paymentMethods.retrieve(
        defaultPaymentMethodId as string,
      );
    } catch (error) {
      console.error('Failed to get default payment method:', error);
      return null;
    }
  }

  /**
   * Confirm auto top-up payment with default payment method
   */
  private static async confirmAutoTopUpPayment(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentIntent> {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });

    try {
      return await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      });
    } catch (error) {
      console.error('Failed to confirm auto top-up payment:', error);
      throw error;
    }
  }

  /**
   * Bulk check auto top-up for multiple organizations (for scheduled job)
   */
  static async bulkCheckAutoTopUp(): Promise<{
    checked: number;
    triggered: number;
    failed: number;
    errors: Array<{ organizationId: string; error: string }>;
  }> {
    const db = getDatabase();
    const results = {
      checked: 0,
      triggered: 0,
      failed: 0,
      errors: [] as Array<{ organizationId: string; error: string }>,
    };

    try {
      // Get all organizations with auto top-up enabled
      const orgs = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.autoTopUpEnabled, true));

      results.checked = orgs.length;

      for (const org of orgs) {
        try {
          const triggered = await this.checkAndTriggerAutoTopUp(org.id);
          if (triggered) {
            results.triggered++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            organizationId: org.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      console.log(
        `Auto top-up bulk check completed: ${results.triggered}/${results.checked} triggered, ${results.failed} failed`,
      );
      return results;
    } catch (error) {
      console.error('Failed to perform bulk auto top-up check:', error);
      throw error;
    }
  }

  /**
   * Get auto top-up statistics for an organization
   */
  static async getAutoTopUpStats(organizationId: string): Promise<{
    isEnabled: boolean;
    threshold: number;
    topUpAmount: number;
    totalAutoTopUps: number;
    lastAutoTopUp?: Date;
    failedAttempts: number;
  }> {
    const db = getDatabase();

    try {
      // Get organization settings
      const [org] = await db
        .select({
          autoTopUpEnabled: organizations.autoTopUpEnabled,
          creditThreshold: organizations.creditThreshold,
          autoTopUpAmount: organizations.autoTopUpAmount,
        })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        throw new Error('Organization not found');
      }

      // Get auto top-up transaction stats
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.organizationId, organizationId),
            eq(creditTransactions.type, 'auto_topup'),
          ),
        );

      const failedTransactions = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.organizationId, organizationId),
            eq(creditTransactions.type, 'auto_topup_failed'),
          ),
        );

      const sortedTransactions = transactions.sort(
        (a: any, b: any) =>
          (b.createdAt ? b.createdAt.getTime() : 0) -
          (a.createdAt ? a.createdAt.getTime() : 0),
      );
      const lastSuccessful = sortedTransactions.length > 0 ? sortedTransactions[0] : null;

      return {
        isEnabled: org.autoTopUpEnabled,
        threshold: parseFloat(org.creditThreshold),
        topUpAmount: parseFloat(org.autoTopUpAmount),
        totalAutoTopUps: transactions.length,
        lastAutoTopUp: lastSuccessful?.createdAt,
        failedAttempts: failedTransactions.length,
      };
    } catch (error) {
      console.error('Failed to get auto top-up stats:', error);
      throw error;
    }
  }
}
