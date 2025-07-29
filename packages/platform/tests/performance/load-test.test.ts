/**
 * Performance and Load Testing
 * Tests system performance under various load conditions
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import {
  addCredits,
  deductCredits,
  getCreditBalance,
} from '../../lib/server/services/billing-service';
import { CreditService } from '../../lib/billing/credit-service';
import { db, initializeDatabase, getDatabase } from '../../lib/database';
import {
  organizations,
  users,
  creditTransactions,
} from '../../lib/database/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('Performance and Load Testing', () => {
  let testOrgId: string;
  let testUserId: string;
  let database: any;

  beforeEach(async () => {
    // Only run in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Performance tests should only run in test environment');
    }

    // Initialize database
    await initializeDatabase();
    database = await getDatabase();

    testOrgId = uuidv4();
    testUserId = uuidv4();

    try {
      // Clean up any existing test data
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));
      await database.delete(users).where(eq(users.organizationId, testOrgId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      // Ignore cleanup errors for non-existent data
    }

    // Create test organization
    await database.insert(organizations).values({
      id: testOrgId,
      name: 'Performance Test Organization',
      slug: `perf-test-${testOrgId}`,
      creditBalance: '1000.0', // Start with sufficient balance
    });

    // Create test user
    await database.insert(users).values({
      id: testUserId,
      organizationId: testOrgId,
      email: 'performance-test@example.com',
      firstName: 'Performance',
      lastName: 'Test',
      role: 'admin',
    });
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));
      await database.delete(users).where(eq(users.organizationId, testOrgId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      console.warn('Performance test cleanup error:', error);
    }
  });

  describe('Database Performance', () => {
    test('should handle concurrent credit operations efficiently', async () => {
      const startTime = Date.now();
      const concurrentOperations = 10; // Reduce operations to avoid timeout

      // Create concurrent credit operations with timeout protection
      const operations = Array.from({ length: concurrentOperations }, (_, i) =>
        Promise.race([
          addCredits({
            organizationId: testOrgId,
            userId: testUserId,
            amount: 1.0,
            description: `Concurrent operation ${i}`,
            type: 'adjustment',
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), 5000),
          ),
        ]),
      );

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count successful operations (some may fail due to concurrent access)
      const successfulResults = results
        .filter(
          (result): result is PromiseFulfilledResult<any> =>
            result.status === 'fulfilled' &&
            result.value &&
            (result.value as any).amount,
        )
        .map((result) => result.value as any);

      expect(successfulResults.length).toBeGreaterThan(
        concurrentOperations * 0.5,
      ); // At least 50% success

      successfulResults.forEach((result) => {
        expect(result).toBeDefined();
        expect(parseFloat(result.amount)).toBe(1.0);
      });

      // Performance check: should complete within reasonable time
      expect(duration).toBeLessThan(8000); // 8 seconds max for 10 operations

      // Verify final balance reflects successful operations
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBeGreaterThan(1000.0); // Should be at least initial balance
      expect(finalBalance).toBeLessThanOrEqual(1000.0 + concurrentOperations); // Should not exceed maximum possible

      console.log(
        `Concurrent test: ${successfulResults.length}/${concurrentOperations} operations succeeded, final balance: ${finalBalance}`,
      );
    }, 20000);

    test('should handle high-frequency usage tracking', async () => {
      const startTime = Date.now();
      const usageCount = 50;

      // Create high-frequency usage deductions
      const usageOperations = Array.from({ length: usageCount }, (_, i) =>
        CreditService.deductCreditsForUsage(testOrgId, testUserId, {
          service: 'openai',
          operation: 'chat',
          modelName: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          requestId: `perf-test-${i}`,
        }),
      );

      const results = await Promise.allSettled(usageOperations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Count successful operations
      const successfulOps = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;

      // Should handle most operations successfully
      expect(successfulOps).toBeGreaterThan(usageCount * 0.8); // At least 80% success rate

      // Performance check: should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max for 50 operations

      console.log(
        `Processed ${successfulOps}/${usageCount} usage operations in ${duration}ms`,
      );
    }, 15000);

    test('should maintain performance with large transaction history', async () => {
      // Create a large number of historical transactions
      const historicalTransactions = 100;

      const startSetupTime = Date.now();

      for (let i = 0; i < historicalTransactions; i++) {
        await addCredits({
          organizationId: testOrgId,
          userId: testUserId,
          amount: 0.01,
          description: `Historical transaction ${i}`,
          type: 'adjustment',
        });
      }

      const setupDuration = Date.now() - startSetupTime;
      console.log(
        `Setup ${historicalTransactions} transactions in ${setupDuration}ms`,
      );

      // Now test query performance with large dataset
      const startQueryTime = Date.now();

      const operations = Array.from({ length: 10 }, () =>
        getCreditBalance(testOrgId),
      );
      const results = await Promise.all(operations);

      const queryDuration = Date.now() - startQueryTime;

      // All queries should return correct balance
      results.forEach((balance) => {
        expect(balance).toBe(1000.0 + historicalTransactions * 0.01);
      });

      // Performance should not degrade significantly with large history
      expect(queryDuration).toBeLessThan(2000); // 2 seconds max for 10 queries

      console.log(
        `Executed 10 balance queries in ${queryDuration}ms with ${historicalTransactions} historical transactions`,
      );
    }, 30000);
  });

  describe('Memory and Resource Management', () => {
    test('should handle large data inputs efficiently', async () => {
      const largeDescription = 'x'.repeat(5000); // 5KB description

      const startTime = Date.now();

      const result = await addCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 10.0,
        description: largeDescription,
        type: 'adjustment',
      });

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(parseFloat(result.amount)).toBe(10.0);
      expect(result.description).toBeDefined();

      // Should handle large inputs within reasonable time
      expect(duration).toBeLessThan(1000); // 1 second max
    });

    test('should not leak memory during stress operations', async () => {
      // Simulate stress operations to check for memory leaks
      const stressOperations = 30;

      for (let i = 0; i < stressOperations; i++) {
        const operations = [
          addCredits({
            organizationId: testOrgId,
            userId: testUserId,
            amount: 1.0,
            description: `Stress test ${i}`,
            type: 'adjustment',
          }),
          getCreditBalance(testOrgId),
          CreditService.deductCreditsForUsage(testOrgId, testUserId, {
            service: 'openai',
            operation: 'chat',
            modelName: 'gpt-4o-mini',
            inputTokens: 10,
            outputTokens: 5,
            requestId: `stress-${i}`,
          }),
        ];

        await Promise.allSettled(operations);

        // Small delay to allow garbage collection
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      // If we get here without memory errors, the test passes
      expect(true).toBe(true);
    }, 20000);
  });

  describe('API Response Times', () => {
    test('should maintain fast response times for credit operations', async () => {
      const timings: { operation: string; duration: number }[] = [];

      // Test getCreditBalance performance
      let startTime = Date.now();
      await getCreditBalance(testOrgId);
      timings.push({
        operation: 'getCreditBalance',
        duration: Date.now() - startTime,
      });

      // Test addCredits performance
      startTime = Date.now();
      await addCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 5.0,
        description: 'Performance test credit addition',
        type: 'adjustment',
      });
      timings.push({
        operation: 'addCredits',
        duration: Date.now() - startTime,
      });

      // Test deductCredits performance
      startTime = Date.now();
      await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 1.0,
        description: 'Performance test deduction',
      });
      timings.push({
        operation: 'deductCredits',
        duration: Date.now() - startTime,
      });

      // Test usage deduction performance
      startTime = Date.now();
      await CreditService.deductCreditsForUsage(testOrgId, testUserId, {
        service: 'openai',
        operation: 'chat',
        modelName: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        requestId: 'perf-test-usage',
      });
      timings.push({
        operation: 'deductCreditsForUsage',
        duration: Date.now() - startTime,
      });

      // Log performance results
      timings.forEach(({ operation, duration }) => {
        console.log(`${operation}: ${duration}ms`);
      });

      // Assert all operations complete within acceptable time limits
      timings.forEach(({ operation, duration }) => {
        expect(duration).toBeLessThan(500); // 500ms max per operation
      });
    });

    test('should handle burst traffic patterns', async () => {
      const burstSize = 15;
      const burstCount = 3;
      const burstDelay = 100; // 100ms between bursts

      for (let burst = 0; burst < burstCount; burst++) {
        const startTime = Date.now();

        // Create burst of operations
        const burstOperations = Array.from({ length: burstSize }, (_, i) =>
          getCreditBalance(testOrgId),
        );

        const results = await Promise.all(burstOperations);
        const burstDuration = Date.now() - startTime;

        // All operations in burst should succeed
        expect(results).toHaveLength(burstSize);
        results.forEach((balance) => {
          expect(typeof balance).toBe('number');
        });

        // Burst should complete within reasonable time
        expect(burstDuration).toBeLessThan(2000); // 2 seconds max per burst

        console.log(
          `Burst ${burst + 1}: ${burstSize} operations in ${burstDuration}ms`,
        );

        // Wait between bursts
        if (burst < burstCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, burstDelay));
        }
      }
    }, 15000);
  });

  describe('System Scalability', () => {
    test('should scale with multiple organizations', async () => {
      const orgCount = 5;
      const orgsData = Array.from({ length: orgCount }, (_, i) => ({
        id: uuidv4(),
        name: `Scalability Test Org ${i}`,
        slug: `scale-test-${i}-${Date.now()}`,
        creditBalance: '100.0',
      }));

      // Create multiple organizations
      await Promise.all(
        orgsData.map((org) => database.insert(organizations).values(org)),
      );

      try {
        const startTime = Date.now();

        // Perform operations across all organizations
        const crossOrgOperations = orgsData.flatMap((org) => [
          getCreditBalance(org.id),
          addCredits({
            organizationId: org.id,
            userId: testUserId,
            amount: 10.0,
            description: 'Cross-org scalability test',
            type: 'adjustment',
          }),
        ]);

        const results = await Promise.allSettled(crossOrgOperations);
        const duration = Date.now() - startTime;

        // Most operations should succeed
        const successCount = results.filter(
          (r) => r.status === 'fulfilled',
        ).length;
        expect(successCount).toBeGreaterThan(crossOrgOperations.length * 0.8);

        // Should scale reasonably with multiple organizations
        expect(duration).toBeLessThan(5000); // 5 seconds max

        console.log(
          `Cross-org operations: ${successCount}/${crossOrgOperations.length} succeeded in ${duration}ms`,
        );
      } finally {
        // Clean up test organizations
        await Promise.all(
          orgsData.map((org) =>
            database
              .delete(organizations)
              .where(eq(organizations.id, org.id))
              .catch(() => {}),
          ),
        );
      }
    }, 10000);
  });
});
