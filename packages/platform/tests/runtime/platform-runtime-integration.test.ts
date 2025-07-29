/**
 * Platform Runtime Integration Tests
 * Tests platform functionality that would integrate with ElizaOS runtime
 * without depending on problematic core imports
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import { db, getDatabase, initializeDbProxy } from '@/lib/database';
import {
  organizations,
  users,
  apiKeys,
  usageRecords,
  creditTransactions,
} from '@/lib/database/schema';
import {
  createApiKey,
  validateApiKey,
  checkApiKeyPermission,
} from '@/lib/server/services/api-key-service';
import {
  addCredits,
  deductCredits,
  getCreditBalance,
} from '@/lib/server/services/billing-service';
import { trackUsage } from '@/lib/server/services/usage-tracking-service';
import { authenticateUser } from '@/lib/server/auth/session';
import { createTokenPair } from '@/lib/server/utils/jwt';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('Platform Runtime Integration', () => {
  let testOrgId: string;
  let testUserId: string;
  let testApiKey: string;
  let testApiKeyId: string;
  let database: any;

  beforeAll(async () => {
    // Ensure test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('These tests should only run in test environment');
    }

    // Initialize database
    const database = await getDatabase();
    initializeDbProxy(database);

    console.log('Platform runtime integration tests started');
  });

  beforeEach(async () => {
    database = await getDatabase();

    // Generate UUIDs for test data
    testOrgId = uuidv4();
    testUserId = uuidv4();

    // Clean up test data (if any exist from previous runs)
    try {
      await database
        .delete(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));
      await database
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, testOrgId));
      await database.delete(users).where(eq(users.organizationId, testOrgId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      // Ignore cleanup errors for non-existent data
    }

    // Create test organization
    const [org] = await database
      .insert(organizations)
      .values({
        id: testOrgId,
        name: 'Test Organization',
        slug: `test-org-${testOrgId}`,
        creditBalance: '100.0',
      })
      .returning();

    // Create test user
    const [user] = await database
      .insert(users)
      .values({
        id: testUserId,
        organizationId: testOrgId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
      })
      .returning();

    // Create test API key
    const { apiKey, keyValue } = await createApiKey({
      organizationId: testOrgId,
      userId: testUserId,
      name: 'Test API Key',
      description: 'API key for runtime integration testing',
      permissions: [
        'inference:openai',
        'inference:anthropic',
        'storage:read',
        'storage:write',
      ],
      rateLimit: 1000,
    });

    testApiKey = keyValue;
    testApiKeyId = apiKey.id;
  });

  afterEach(async () => {
    // Clean up test data in correct order to avoid foreign key violations
    try {
      // Delete dependent records first
      await database
        .delete(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));
      await database
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, testOrgId));
      await database.delete(users).where(eq(users.organizationId, testOrgId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      console.warn('Error cleaning up test data:', error);
    }
  });

  describe('Complete API Request Workflow', () => {
    test('should handle end-to-end API request simulation', async () => {
      // 1. Validate API key (as middleware would do)
      const apiKeyRecord = await validateApiKey(testApiKey);
      expect(apiKeyRecord).toBeDefined();
      expect(apiKeyRecord!.isActive).toBe(true);
      expect(apiKeyRecord!.organizationId).toBe(testOrgId);

      // 2. Check permissions
      const hasPermission = await checkApiKeyPermission(
        apiKeyRecord!,
        'inference:openai',
      );
      expect(hasPermission).toBe(true);

      // 3. Simulate inference request with usage tracking
      const startTime = Date.now();

      // Simulate LLM call response
      const mockLLMResponse = {
        id: 'test-request-1',
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 50,
          completion_tokens: 25,
          total_tokens: 75,
        },
        choices: [
          {
            message: { content: 'Test response from simulated LLM call' },
          },
        ],
      };

      const duration = Date.now() - startTime;
      const cost = 0.002; // $0.002 for this request

      // 4. Deduct credits from organization
      const transaction = await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: cost,
        description: `OpenAI ${mockLLMResponse.model} - ${mockLLMResponse.usage.total_tokens} tokens`,
        metadata: {
          provider: 'openai',
          model: mockLLMResponse.model,
          inputTokens: mockLLMResponse.usage.prompt_tokens,
          outputTokens: mockLLMResponse.usage.completion_tokens,
          requestId: mockLLMResponse.id,
        },
      });

      expect(transaction).toBeDefined();
      expect(parseFloat(transaction!.amount)).toBe(-cost);

      // 5. Track usage statistics
      const usageId = await trackUsage({
        organizationId: testOrgId,
        apiKeyId: testApiKeyId,
        provider: 'openai',
        model: mockLLMResponse.model,
        inputTokens: mockLLMResponse.usage.prompt_tokens,
        outputTokens: mockLLMResponse.usage.completion_tokens,
        cost,
        duration,
        success: true,
        requestId: mockLLMResponse.id,
        usageRecordId: transaction!.id,
        metadata: {
          endToEndTest: true,
        },
      });

      expect(usageId).toBeDefined();

      // 6. Verify billing was processed correctly
      const newBalance = await getCreditBalance(testOrgId);
      expect(newBalance).toBe(100.0 - cost); // $100 - $0.002

      // 7. Verify usage record was created
      const [usageRecord] = await database
        .select()
        .from(usageRecords)
        .where(eq(usageRecords.id, usageId))
        .limit(1);

      expect(usageRecord).toBeDefined();
      expect(usageRecord.organizationId).toBe(testOrgId);
      expect(usageRecord.apiKeyId).toBe(testApiKeyId);
      expect(usageRecord.provider).toBe('openai');
      expect(usageRecord.model).toBe(mockLLMResponse.model);
      expect(usageRecord.inputTokens).toBe(mockLLMResponse.usage.prompt_tokens);
      expect(usageRecord.outputTokens).toBe(
        mockLLMResponse.usage.completion_tokens,
      );
      expect(usageRecord.success).toBe(true);
      expect(usageRecord.requestId).toBe(mockLLMResponse.id);
    });

    test('should handle authentication flow', async () => {
      // Create JWT token for user
      const { accessToken: token } = await createTokenPair({
        userId: testUserId,
        email: 'test@example.com',
        organizationId: testOrgId,
        role: 'admin',
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Simulate request with Authorization header
      const mockRequest = {
        headers: {
          get: (name: string) => {
            if (name === 'authorization') {
              return `Bearer ${token}`;
            }
            return null;
          },
        },
      } as any;

      // Test authentication
      const authResult = await authenticateUser(mockRequest);
      expect(authResult.user).toBeDefined();
      expect(authResult.organization).toBeDefined();
      expect(authResult.user!.id).toBe(testUserId);
      expect(authResult.organization!.id).toBe(testOrgId);
    });

    test('should handle error scenarios', async () => {
      // Test failed request tracking
      await trackUsage({
        organizationId: testOrgId,
        apiKeyId: testApiKeyId,
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        duration: 100,
        success: false,
        errorMessage: 'API rate limit exceeded',
        metadata: {
          errorType: 'rate_limit',
          errorTest: true,
        },
      });

      // Verify error was tracked without affecting billing
      const balance = await getCreditBalance(testOrgId);
      expect(balance).toBe(100.0); // Balance unchanged

      const errorRecords = await database
        .select()
        .from(usageRecords)
        .where(eq(usageRecords.success, false));

      expect(errorRecords.length).toBeGreaterThan(0);
      const errorRecord = errorRecords.find(
        (r: any) => (r.metadata as any).errorTest,
      );
      expect(errorRecord).toBeDefined();
      expect(errorRecord!.errorMessage).toBe('API rate limit exceeded');
    });

    test('should handle concurrent API requests', async () => {
      // Simulate concurrent API requests
      const requestCount = 5;
      const promises = [];

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          (async () => {
            // Validate API key
            const apiKeyRecord = await validateApiKey(testApiKey);
            if (!apiKeyRecord) {
              throw new Error('Invalid API key');
            }

            // Check permissions
            const hasPermission = await checkApiKeyPermission(
              apiKeyRecord,
              'inference:openai',
            );
            if (!hasPermission) {
              throw new Error('Insufficient permissions');
            }

            // Track usage
            return await trackUsage({
              organizationId: testOrgId,
              apiKeyId: testApiKeyId,
              provider: 'openai',
              model: 'gpt-4o-mini',
              inputTokens: 10 + i,
              outputTokens: 5 + i,
              cost: 0.001 * (i + 1),
              duration: 100 + i * 10,
              success: true,
              requestId: `concurrent-test-${i}`,
              metadata: {
                concurrentTest: true,
                requestIndex: i,
              },
            });
          })(),
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(requestCount);
      expect(results.every((id) => typeof id === 'string')).toBe(true);

      // Verify all records were created
      const records = await database
        .select()
        .from(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));

      const concurrentRecords = records.filter(
        (r: any) => (r.metadata as any).concurrentTest,
      );
      expect(concurrentRecords).toHaveLength(requestCount);
    });

    test('should integrate with billing system', async () => {
      // Test credit operations
      const initialBalance = await getCreditBalance(testOrgId);
      expect(initialBalance).toBe(100.0);

      // Add credits
      const addTransaction = await addCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 50.0,
        description: 'Test credit addition',
        type: 'purchase',
      });

      expect(addTransaction).toBeDefined();
      expect(parseFloat(addTransaction.amount)).toBe(50.0);
      expect(parseFloat(addTransaction.balanceAfter)).toBe(150.0);

      // Verify balance
      const newBalance = await getCreditBalance(testOrgId);
      expect(newBalance).toBe(150.0);

      // Deduct credits
      const deductTransaction = await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 25.0,
        description: 'Test credit deduction',
        metadata: {
          testDeduction: true,
        },
      });

      expect(deductTransaction).toBeDefined();
      expect(parseFloat(deductTransaction!.amount)).toBe(-25.0);
      expect(parseFloat(deductTransaction!.balanceAfter)).toBe(125.0);

      // Verify final balance
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBe(125.0);
    });
  });

  describe('Data Integrity and Performance', () => {
    test('should maintain data consistency across operations', async () => {
      // Perform multiple operations
      const operations = [];

      // Track usage
      operations.push(
        trackUsage({
          organizationId: testOrgId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-4o-mini',
          inputTokens: 100,
          outputTokens: 50,
          cost: 0.01,
          duration: 1000,
          success: true,
          metadata: { test: 'consistency' },
        }),
      );

      // Deduct credits
      operations.push(
        deductCredits({
          organizationId: testOrgId,
          userId: testUserId,
          amount: 0.01,
          description: 'Consistency test charge',
        }),
      );

      await Promise.all(operations);

      // Verify data consistency
      const balance = await getCreditBalance(testOrgId);
      expect(balance).toBe(99.99); // 100 - 0.01

      const usageRecordsList = await database
        .select()
        .from(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));

      expect(usageRecordsList.length).toBeGreaterThan(0);
      expect((usageRecordsList[0].metadata as any).test).toBe('consistency');
    });

    test('should handle high-frequency operations', async () => {
      const operationCount = 20;
      const startTime = Date.now();

      // Perform many small operations
      const promises = Array.from({ length: operationCount }, (_, i) =>
        trackUsage({
          organizationId: testOrgId,
          apiKeyId: testApiKeyId,
          provider: 'test',
          model: 'test-model',
          inputTokens: 1,
          outputTokens: 1,
          cost: 0.0001,
          duration: 10,
          success: true,
          requestId: `perf-test-${i}`,
          metadata: { performanceTest: true, index: i },
        }),
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(operationCount);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

      // Verify all records were created correctly
      const records = await database
        .select()
        .from(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));

      const perfRecords = records.filter(
        (r: any) => (r.metadata as any).performanceTest,
      );
      expect(perfRecords).toHaveLength(operationCount);
    });
  });
});
