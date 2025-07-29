/**
 * Platform-Only Runtime Tests
 * These tests validate the platform functionality without relying on core runtime infrastructure
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from 'bun:test';
import { db, getDatabase } from '@/lib/database';
import {
  users,
  organizations,
  apiKeys,
  creditTransactions,
  usageRecords,
} from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  createApiKey,
  validateApiKey,
} from '@/lib/server/services/api-key-service';
import { deductCredits } from '@/lib/server/services/billing-service';
import { trackUsage } from '@/lib/server/services/usage-tracking-service';

describe('Platform Database Integration', () => {
  let testOrgId: string;
  let testUserId: string;
  let testApiKey: string;
  let testApiKeyId: string;
  let database: any;

  beforeAll(async () => {
    database = await getDatabase();

    // Generate UUIDs for test data
    testOrgId = uuidv4();
    testUserId = uuidv4();

    // Create test organization
    await database.insert(organizations).values({
      id: testOrgId,
      name: 'Test Organization',
      slug: `test-org-platform-${Date.now()}`,
      subscriptionTier: 'free',
      creditBalance: '1000.0',
      maxAgents: 5,
      maxUsers: 10,
    });

    // Create test user
    await database.insert(users).values({
      id: testUserId,
      organizationId: testOrgId,
      email: 'test@platform.com',
      firstName: 'Platform',
      lastName: 'Test',
      role: 'admin',
      workosUserId: `platform-test-workos-${Date.now()}`,
    });
  });

  afterAll(async () => {
    try {
      // Clean up test data in correct order to handle foreign key constraints
      await database
        .delete(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));
      await database
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, testOrgId));
      await database.delete(users).where(eq(users.id, testUserId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      console.warn('Error cleaning up test data:', error);
    }
  });

  it('should create and validate API keys', async () => {
    // Create API key
    const result = await createApiKey({
      organizationId: testOrgId,
      userId: testUserId,
      name: 'Platform Test Key',
      description: 'Test API key for platform tests',
      permissions: ['inference:openai', 'inference:anthropic'],
      rateLimit: 1000,
    });

    expect(result.keyValue).toBeDefined();
    expect(result.apiKey).toBeDefined();

    testApiKey = result.keyValue;
    testApiKeyId = result.apiKey.id;

    // Validate API key
    const validationResult = await validateApiKey(testApiKey);
    expect(validationResult).toBeDefined();
    expect(validationResult?.organizationId).toBe(testOrgId);
  });

  it('should handle billing operations', async () => {
    if (!testApiKey) {
      throw new Error('Test API key not created');
    }

    // Test credit deduction
    const deductResult = await deductCredits({
      organizationId: testOrgId,
      userId: testUserId,
      amount: 10.0,
      description: 'Platform test deduction',
    });

    expect(deductResult).toBeDefined();

    // Test usage tracking
    const usageRecordId = await trackUsage({
      organizationId: testOrgId,
      apiKeyId: testApiKeyId,
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      duration: 500,
      success: true,
      metadata: { test: 'platform-test' },
    });

    expect(usageRecordId).toBeDefined();
    expect(typeof usageRecordId).toBe('string');
  });

  it('should maintain database integrity', async () => {
    // Verify organization exists
    const orgResult = await database
      .select()
      .from(organizations)
      .where(eq(organizations.id, testOrgId))
      .limit(1);

    expect(orgResult).toHaveLength(1);
    expect(orgResult[0].name).toBe('Test Organization');

    // Verify user exists
    const userResult = await database
      .select()
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);

    expect(userResult).toHaveLength(1);
    expect(userResult[0].email).toBe('test@platform.com');
  });

  it('should handle database queries efficiently', async () => {
    const startTime = Date.now();

    // Test query performance
    const result = await database
      .select({
        orgName: organizations.name,
        userEmail: users.email,
        keyCount: apiKeys.id,
      })
      .from(organizations)
      .leftJoin(users, eq(users.organizationId, organizations.id))
      .leftJoin(apiKeys, eq(apiKeys.organizationId, organizations.id))
      .where(eq(organizations.id, testOrgId));

    const queryTime = Date.now() - startTime;

    expect(queryTime).toBeLessThan(1000); // Should complete in less than 1 second
    expect(result.length).toBeGreaterThan(0);
  });
});
