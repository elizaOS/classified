/**
 * Core Billing System Tests
 * Simplified tests for core billing functionality without external dependencies
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import { db, getDatabase } from '@/lib/database';
import {
  organizations,
  users,
  creditTransactions,
} from '@/lib/database/schema';
import {
  getCreditBalance,
  addCredits,
  deductCredits,
} from '@/lib/server/services/billing-service';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('Core Billing System Tests', () => {
  let testOrgId: string;
  let testUserId: string;
  let database: any;

  beforeAll(async () => {
    // Ensure test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('These tests should only run in test environment');
    }
    console.log('Core billing tests started');
  });

  beforeEach(async () => {
    database = await getDatabase();

    // Generate UUIDs for test data
    testOrgId = uuidv4();
    testUserId = uuidv4();

    // Create test organization
    const [org] = await database
      .insert(organizations)
      .values({
        id: testOrgId,
        name: 'Test Billing Organization',
        slug: 'test-billing-org',
        creditBalance: '100.0',
        creditThreshold: '10.0',
        autoTopUpEnabled: false,
        autoTopUpAmount: '25.0',
      })
      .returning();

    // Create test user
    const [user] = await database
      .insert(users)
      .values({
        id: testUserId,
        organizationId: testOrgId,
        email: 'billing-test@example.com',
        firstName: 'Billing',
        lastName: 'Tester',
        role: 'admin',
      })
      .returning();
  });

  afterEach(async () => {
    // Clean up test data if IDs are defined
    if (testOrgId) {
      try {
        await database
          .delete(creditTransactions)
          .where(eq(creditTransactions.organizationId, testOrgId));
        await database.delete(users).where(eq(users.organizationId, testOrgId));
        await database
          .delete(organizations)
          .where(eq(organizations.id, testOrgId));
      } catch (error) {
        // Ignore cleanup errors - test data may not exist
      }
    }
  });

  afterAll(async () => {
    // Close database connections to prevent hanging tests
    try {
      await database.$client?.end?.();
    } catch (error) {
      // Ignore connection close errors
    }
  });

  describe('Basic Credit Operations', () => {
    test('should get credit balance', async () => {
      const balance = await getCreditBalance(testOrgId);
      expect(balance).toBe(100.0);
    });

    test('should add credits successfully', async () => {
      const result = await addCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 50.0,
        description: 'Test credit addition',
        type: 'purchase',
      });

      expect(result).toBeDefined();

      const newBalance = await getCreditBalance(testOrgId);
      expect(newBalance).toBe(150.0);
    });

    test('should deduct credits successfully', async () => {
      const result = await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 25.0,
        description: 'Test credit deduction',
      });

      expect(result).toBeDefined();

      const newBalance = await getCreditBalance(testOrgId);
      expect(newBalance).toBe(75.0);
    });

    test('should prevent deducting more credits than available', async () => {
      try {
        await deductCredits({
          organizationId: testOrgId,
          userId: testUserId,
          amount: 150.0,
          description: 'Test overdraft',
        });

        // Should not reach this point
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();

        // Balance should remain unchanged
        const balance = await getCreditBalance(testOrgId);
        expect(balance).toBe(100.0);
      }
    });
  });

  describe('Transaction History', () => {
    test('should track credit additions', async () => {
      await addCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 30.0,
        description: 'Test addition',
        type: 'purchase',
      });

      const transactions = await database
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));

      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe('purchase');
      expect(parseFloat(transactions[0].amount)).toBe(30);
      expect(transactions[0].description).toBe('Test addition');
    });

    test('should track credit deductions', async () => {
      await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 15.0,
        description: 'Test deduction',
      });

      const transactions = await database
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));

      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe('usage');
      expect(parseFloat(transactions[0].amount)).toBe(-15);
      expect(transactions[0].description).toBe('Test deduction');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid organization ID', async () => {
      const invalidOrgId = uuidv4();

      try {
        await getCreditBalance(invalidOrgId);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle concurrent operations', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          deductCredits({
            organizationId: testOrgId,
            userId: testUserId,
            amount: 10.0,
            description: `Concurrent test ${i}`,
          }),
        );
      }

      const results = await Promise.allSettled(promises);

      // At least some should succeed
      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Final balance should be correct
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBeLessThan(100.0);
      expect(finalBalance).toBeGreaterThanOrEqual(50.0); // Maximum 5 * 10 = 50 deducted
    });
  });
});
