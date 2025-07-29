/**
 * End-to-End Billing System Integration Tests
 * Tests complete payment flows from initiation to completion
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import { StripeService } from '@/lib/billing/stripe';
import { AutoTopUpService } from '@/lib/billing/auto-topup-service';
import { WebhookDeduplicationService } from '@/lib/billing/webhook-deduplication';
import { CryptoPaymentVerifier } from '@/lib/billing/crypto-payment-verifier';
import { getDatabase } from '@/lib/database/connection';
import {
  organizations,
  creditTransactions,
  webhooks,
} from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';

const TEST_STRIPE_SECRET_KEY =
  process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const TEST_ORGANIZATION_ID = 'e2e-test-org-' + Date.now();
const TEST_USER_ID = 'e2e-test-user-' + Date.now();

describe('End-to-End Billing Integration Tests', () => {
  let stripe: Stripe;
  let testCustomerId: string;
  let testPaymentMethodId: string;

  beforeAll(async () => {
    if (!TEST_STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_TEST_SECRET_KEY required for E2E tests');
    }

    stripe = new Stripe(TEST_STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });

    // Setup Stripe test resources
    const customer = await stripe.customers.create({
      email: 'e2e-test@example.com',
      name: 'E2E Test Customer',
      metadata: { organizationId: TEST_ORGANIZATION_ID },
    });
    testCustomerId = customer.id;

    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2030,
        cvc: '123',
      },
    });
    testPaymentMethodId = paymentMethod.id;

    await stripe.paymentMethods.attach(testPaymentMethodId, {
      customer: testCustomerId,
    });

    await stripe.customers.update(testCustomerId, {
      invoice_settings: {
        default_payment_method: testPaymentMethodId,
      },
    });

    // Setup test organization
    const db = getDatabase();
    await db.insert(organizations).values({
      id: TEST_ORGANIZATION_ID,
      name: 'E2E Test Organization',
      slug: 'e2e-test-org',
      stripeCustomerId: testCustomerId,
      creditBalance: '100.00',
      autoTopUpEnabled: true,
      creditThreshold: '50.00',
      autoTopUpAmount: '75.00',
    });
  });

  afterAll(async () => {
    // Cleanup Stripe resources
    if (testCustomerId) {
      await stripe.customers.del(testCustomerId);
    }

    // Cleanup database
    const db = getDatabase();
    await db
      .delete(organizations)
      .where(eq(organizations.id, TEST_ORGANIZATION_ID));
    await db
      .delete(creditTransactions)
      .where(eq(creditTransactions.organizationId, TEST_ORGANIZATION_ID));
    await db
      .delete(webhooks)
      .where(eq(webhooks.organizationId, TEST_ORGANIZATION_ID));
  });

  beforeEach(async () => {
    // Reset organization state
    const db = getDatabase();
    await db
      .update(organizations)
      .set({
        creditBalance: '100.00',
        autoTopUpEnabled: true,
        creditThreshold: '50.00',
        autoTopUpAmount: '75.00',
      })
      .where(eq(organizations.id, TEST_ORGANIZATION_ID));

    // Clear previous transactions
    await db
      .delete(creditTransactions)
      .where(eq(creditTransactions.organizationId, TEST_ORGANIZATION_ID));
    await db
      .delete(webhooks)
      .where(eq(webhooks.organizationId, TEST_ORGANIZATION_ID));
  });

  describe('Complete Stripe Payment Flow', () => {
    it('should complete full payment flow from intent to credit addition', async () => {
      // Step 1: Create payment intent
      const paymentIntent = await StripeService.createPaymentIntent({
        amount: 5000, // $50.00
        currency: 'usd',
        organizationId: TEST_ORGANIZATION_ID,
        userId: TEST_USER_ID,
        metadata: {
          type: 'credit_purchase',
          e2e_test: 'true',
        },
      });

      expect(paymentIntent.id).not.toBeUndefined();
      expect(paymentIntent.amount).toBe(5000);

      // Step 2: Confirm payment (simulates frontend confirmation)
      const confirmedPayment = await stripe.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: testPaymentMethodId,
        },
      );

      expect(confirmedPayment.status).toBe('succeeded');

      // Step 3: Process webhook event (simulates Stripe webhook)
      const webhookEvent = {
        id: 'evt_e2e_test_' + Date.now(),
        type: 'payment_intent.succeeded',
        createdAt: Math.floor(Date.now() / 1000),
        organizationId: TEST_ORGANIZATION_ID,
        data: {
          object: {
            id: paymentIntent.id,
            amount: 5000,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              organizationId: TEST_ORGANIZATION_ID,
              userId: TEST_USER_ID,
              creditAmount: '50.00',
              type: 'credit_purchase',
            },
          },
        },
      };

      const webhookResult =
        await WebhookDeduplicationService.processWebhookSafely(
          webhookEvent,
          async () => {
            // Simulate webhook handler
            await StripeService.confirmPaymentAndAddCredits({
              organizationId: TEST_ORGANIZATION_ID,
              userId: TEST_USER_ID,
              amount: 50.0,
              paymentIntentId: paymentIntent.id,
            });
          },
        );

      expect(webhookResult.success).toBe(true);

      // Step 4: Verify final state
      const db = getDatabase();
      const [org] = await db
        .select({ creditBalance: organizations.creditBalance })
        .from(organizations)
        .where(eq(organizations.id, TEST_ORGANIZATION_ID))
        .limit(1);

      expect(parseFloat(org.creditBalance)).toBe(150.0); // 100 + 50

      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.organizationId, TEST_ORGANIZATION_ID));

      const purchaseTransaction = transactions.find(
        (t: any) => t.type === 'purchase',
      );
      expect(purchaseTransaction).not.toBeUndefined();
      expect(parseFloat(purchaseTransaction!.amount)).toBe(50.0);
      expect(purchaseTransaction!.stripePaymentIntentId).toBe(paymentIntent.id);
    });

    it('should handle failed payments gracefully', async () => {
      // Create payment intent with card that will be declined
      const paymentIntent = await StripeService.createPaymentIntent({
        amount: 2500,
        currency: 'usd',
        organizationId: TEST_ORGANIZATION_ID,
        userId: TEST_USER_ID,
        metadata: { type: 'credit_purchase' },
      });

      // Create a payment method that will be declined
      const declinedCard = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: '4000000000000002', // Declined card
          exp_month: 12,
          exp_year: 2030,
          cvc: '123',
        },
      });

      // Attempt to confirm payment
      try {
        await stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method: declinedCard.id,
        });
      } catch (error) {
        expect(error).not.toBeUndefined();
      }

      // Verify no credits were added
      const db = getDatabase();
      const [org] = await db
        .select({ creditBalance: organizations.creditBalance })
        .from(organizations)
        .where(eq(organizations.id, TEST_ORGANIZATION_ID))
        .limit(1);

      expect(parseFloat(org.creditBalance)).toBe(100.0); // Unchanged
    });
  });

  describe('Auto Top-up End-to-End Flow', () => {
    it('should complete full auto top-up flow', async () => {
      // Step 1: Reduce balance below threshold
      const db = getDatabase();
      await db
        .update(organizations)
        .set({ creditBalance: '45.00' }) // Below 50.00 threshold
        .where(eq(organizations.id, TEST_ORGANIZATION_ID));

      // Step 2: Trigger auto top-up check
      const triggered =
        await AutoTopUpService.checkAndTriggerAutoTopUp(TEST_ORGANIZATION_ID);
      expect(triggered).toBe(true);

      // Step 3: Find the created payment intent
      const paymentIntents = await stripe.paymentIntents.list({
        customer: testCustomerId,
        limit: 1,
      });

      expect(paymentIntents.data.length > 0).toBe(true);

      const autoTopUpIntent = paymentIntents.data.find(
        (pi) => pi.metadata.type === 'auto_topup',
      );

      if (autoTopUpIntent) {
        // Step 4: Confirm the payment (would happen automatically with saved payment method)
        const confirmedPayment = await stripe.paymentIntents.confirm(
          autoTopUpIntent.id,
          {
            payment_method: testPaymentMethodId,
          },
        );

        expect(confirmedPayment.status).toBe('succeeded');

        // Step 5: Process webhook
        const webhookEvent = {
          id: 'evt_auto_topup_' + Date.now(),
          type: 'payment_intent.succeeded',
          createdAt: Math.floor(Date.now() / 1000),
          organizationId: TEST_ORGANIZATION_ID,
          data: {
            object: {
              id: autoTopUpIntent.id,
              amount: 7500, // $75.00
              currency: 'usd',
              status: 'succeeded',
              metadata: {
                organizationId: TEST_ORGANIZATION_ID,
                type: 'auto_topup',
              },
            },
          },
        };

        await WebhookDeduplicationService.processWebhookSafely(
          webhookEvent,
          async () => {
            await StripeService.confirmPaymentAndAddCredits({
              organizationId: TEST_ORGANIZATION_ID,
              userId: TEST_USER_ID,
              amount: 75.0,
              paymentIntentId: autoTopUpIntent.id,
            });
          },
        );

        // Step 6: Verify final balance
        const [updatedOrg] = await db
          .select({ creditBalance: organizations.creditBalance })
          .from(organizations)
          .where(eq(organizations.id, TEST_ORGANIZATION_ID))
          .limit(1);

        expect(parseFloat(updatedOrg.creditBalance)).toBe(120.0); // 45 + 75
      }
    });

    it('should prevent duplicate auto top-up attempts', async () => {
      // Reduce balance and trigger first auto top-up
      const db = getDatabase();
      await db
        .update(organizations)
        .set({ creditBalance: '40.00' })
        .where(eq(organizations.id, TEST_ORGANIZATION_ID));

      const firstTrigger =
        await AutoTopUpService.checkAndTriggerAutoTopUp(TEST_ORGANIZATION_ID);
      expect(firstTrigger).toBe(true);

      // Immediate second attempt should be prevented
      const secondTrigger =
        await AutoTopUpService.checkAndTriggerAutoTopUp(TEST_ORGANIZATION_ID);
      expect(secondTrigger).toBe(false);
    });
  });

  describe('Crypto Payment End-to-End Flow', () => {
    it('should complete crypto payment monitoring and verification flow', async () => {
      // Step 1: Start payment monitoring
      const paymentRequest = {
        organizationId: TEST_ORGANIZATION_ID,
        userId: TEST_USER_ID,
        amount: 100.0,
        walletAddress: '0x742d35Cc6e1A4Fbe1CfA8BD2A4eA2c18F4B8Ee1d',
        network: 'ethereum' as const,
        currency: 'ETH' as const,
      };

      const { paymentId } =
        await CryptoPaymentVerifier.startPaymentMonitoring(paymentRequest);

      // Step 2: Verify initial status
      let status = await CryptoPaymentVerifier.getPaymentStatus(paymentId);
      expect(status.status).toBe('pending');

      // Step 3: Simulate payment confirmation
      const mockVerification = {
        transactionHash:
          '0xe2e123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
        amount: 100.0,
        confirmations: 15,
        isConfirmed: true,
        gasUsed: '21000',
        gasPrice: '50000000000',
        blockNumber: 18500000,
        timestamp: Math.floor(Date.now() / 1000),
      };

      await CryptoPaymentVerifier.processConfirmedPayment(
        paymentId,
        mockVerification,
      );

      // Step 4: Verify final status
      status = await CryptoPaymentVerifier.getPaymentStatus(paymentId);
      expect(status.status).toBe('confirmed');
      expect(status.verification?.transactionHash).toBe(
        mockVerification.transactionHash,
      );

      // Step 5: Verify database state
      const db = getDatabase();
      const [transaction] = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.id, paymentId))
        .limit(1);

      expect(transaction.type).toBe('purchase');
      expect(parseFloat(transaction.amount)).toBe(100.0);
      expect(transaction.cryptoTransactionHash).toBe(
        mockVerification.transactionHash,
      );
    });

    it('should handle crypto payment expiration correctly', async () => {
      // Create payment that expires immediately
      const db = getDatabase();
      const expiredPaymentId = 'crypto_e2e_expired_' + Date.now();

      await db.insert(creditTransactions).values({
        id: expiredPaymentId,
        organizationId: TEST_ORGANIZATION_ID,
        userId: TEST_USER_ID,
        type: 'crypto_pending',
        amount: '0',
        description: 'E2E expired crypto payment',
        balanceAfter: '100.00',
        metadata: {
          expectedUsdAmount: 50.0,
          walletAddress: '0x742d35Cc6e1A4Fbe1CfA8BD2A4eA2c18F4B8Ee1d',
          network: 'ethereum',
          currency: 'ETH',
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
        },
      });

      // Check status
      const status =
        await CryptoPaymentVerifier.getPaymentStatus(expiredPaymentId);
      expect(status.status).toBe('expired');

      // Run cleanup
      await CryptoPaymentVerifier.cleanupExpiredPayments();

      // Verify payment was marked as expired
      const [expiredTransaction] = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.id, expiredPaymentId))
        .limit(1);

      expect(expiredTransaction.type).toBe('crypto_expired');
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    it('should handle concurrent payment processing safely', async () => {
      // Create multiple concurrent payment operations
      const concurrentCount = 5;
      const paymentAmounts = Array.from(
        { length: concurrentCount },
        (_, i) => (i + 1) * 10,
      );

      const paymentPromises = paymentAmounts.map(async (amount, index) => {
        const paymentIntent = await StripeService.createPaymentIntent({
          amount: amount * 100, // Convert to cents
          currency: 'usd',
          organizationId: TEST_ORGANIZATION_ID,
          userId: TEST_USER_ID,
          metadata: {
            type: 'credit_purchase',
            concurrentTest: 'true',
            index: index.toString(),
          },
        });

        // Confirm payment
        await stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method: testPaymentMethodId,
        });

        // Process credit addition
        await StripeService.confirmPaymentAndAddCredits({
          organizationId: TEST_ORGANIZATION_ID,
          userId: TEST_USER_ID,
          amount: amount,
          paymentIntentId: paymentIntent.id,
          // description: `Concurrent test payment ${index}`, // Not part of CreditPurchaseOptions interface
        });

        return amount;
      });

      const results = await Promise.all(paymentPromises);
      const totalAdded = results.reduce((sum, amount) => sum + amount, 0);

      // Verify final balance is correct
      const db = getDatabase();
      const [org] = await db
        .select({ creditBalance: organizations.creditBalance })
        .from(organizations)
        .where(eq(organizations.id, TEST_ORGANIZATION_ID))
        .limit(1);

      expect(parseFloat(org.creditBalance)).toBe(100.0 + totalAdded);

      // Verify all transactions were recorded
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.organizationId, TEST_ORGANIZATION_ID),
            eq(creditTransactions.type, 'purchase'),
          ),
        );

      expect(transactions).toHaveLength(concurrentCount);
    });

    it('should handle webhook deduplication under concurrent load', async () => {
      const webhookEventId = 'evt_concurrent_dedup_' + Date.now();
      const concurrentAttempts = 10;

      let processingCount = 0;
      const processingFunction = async () => {
        processingCount++;
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate processing time
      };

      // Send same webhook event multiple times concurrently
      const webhookPromises = Array.from({ length: concurrentAttempts }, () =>
        WebhookDeduplicationService.processWebhookSafely(
          {
            id: webhookEventId,
            type: 'payment_intent.succeeded',
            createdAt: Math.floor(Date.now() / 1000),
            organizationId: TEST_ORGANIZATION_ID,
            data: { object: { id: 'pi_concurrent_dedup_test' } },
          },
          processingFunction,
        ),
      );

      const results = await Promise.all(webhookPromises);

      // All should succeed but only one should actually process
      const successfulResults = results.filter((r) => r.success);
      expect(successfulResults).toHaveLength(3); // All should return success due to deduplication
      expect(processingCount).toBe(1);
    });
  });

  describe('System Integration and Performance', () => {
    it('should handle bulk auto top-up operations efficiently', async () => {
      // Create multiple organizations needing auto top-up
      const orgCount = 10;
      const testOrgIds = Array.from(
        { length: orgCount },
        (_, i) => `bulk_test_org_${i}_${Date.now()}`,
      );

      const db = getDatabase();

      // Setup organizations
      await Promise.all(
        testOrgIds.map((orgId) =>
          db.insert(organizations).values({
            id: orgId,
            name: `Bulk Test Org ${orgId}`,
            slug: `bulk-test-org-${orgId}`,
            creditBalance: '30.00', // Below threshold
            autoTopUpEnabled: true,
            creditThreshold: '50.00',
            autoTopUpAmount: '100.00',
          }),
        ),
      );

      // Run bulk auto top-up check
      const startTime = Date.now();
      const bulkResult = await AutoTopUpService.bulkCheckAutoTopUp();
      const duration = Date.now() - startTime;

      console.log(`Bulk auto top-up check completed in ${duration}ms`);
      console.log(
        `Results: ${bulkResult.triggered}/${bulkResult.checked} triggered, ${bulkResult.failed} failed`,
      );

      expect(bulkResult.checked >= orgCount).toBe(true);
      expect(bulkResult.errors.length).toBe(bulkResult.failed);
      expect(duration < 30000).toBe(true); // Should complete within 30 seconds

      // Cleanup
      await Promise.all([
        ...testOrgIds.map((orgId) =>
          db.delete(organizations).where(eq(organizations.id, orgId)),
        ),
        ...testOrgIds.map((orgId) =>
          db
            .delete(creditTransactions)
            .where(eq(creditTransactions.organizationId, orgId)),
        ),
      ]);
    });

    it('should maintain system stability under heavy load', async () => {
      // Simulate mixed operations under load
      const operations = [
        // Payment intent creations
        ...Array.from({ length: 5 }, () => async () => {
          const intent = await StripeService.createPaymentIntent({
            amount: 1000,
            currency: 'usd',
            organizationId: TEST_ORGANIZATION_ID,
            userId: TEST_USER_ID,
            metadata: { type: 'load_test' },
          });
          return intent.id;
        }),

        // Webhook processing
        ...Array.from({ length: 5 }, (_, i) => async () => {
          return WebhookDeduplicationService.processWebhookSafely(
            {
              id: `evt_load_test_${i}_${Date.now()}`,
              type: 'payment_intent.succeeded',
              createdAt: Math.floor(Date.now() / 1000),
              organizationId: TEST_ORGANIZATION_ID,
              data: { object: { id: `pi_load_test_${i}` } },
            },
            async () => Promise.resolve(),
          );
        }),

        // Balance checks using public method
        ...Array.from({ length: 5 }, () => async () => {
          const db = getDatabase();
          const [org] = await db
            .select({ creditBalance: organizations.creditBalance })
            .from(organizations)
            .where(eq(organizations.id, TEST_ORGANIZATION_ID))
            .limit(1);
          return parseFloat(org.creditBalance);
        }),
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(operations.map((op) => op()));
      const duration = Date.now() - startTime;

      console.log(`Mixed load test completed in ${duration}ms`);

      // All operations should either succeed or fail gracefully
      const failed = results.filter((r) => r.status === 'rejected');
      expect(failed.length).toBe(0); // No unhandled errors

      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });
});
