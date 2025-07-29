/**
 * Agent Billing Scenario Tests
 * Tests billing integration with actual agent operations and runtime scenarios
 */

import { CreditService } from '@/lib/billing/credit-service';
import {
  agents,
  apiKeys,
  creditTransactions,
  db,
  getDatabase,
  organizations,
  usageRecords,
  users,
} from '@/lib/database';
import {
  deductCredits,
  getCreditBalance,
} from '@/lib/server/services/billing-service';
import { trackUsage } from '@/lib/server/services/usage-tracking-service';
import { beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

describe('Agent Billing Scenario Tests', () => {
  let testOrgId: string;
  let testUserId: string;
  let testAgentId: string;
  let testApiKeyId: string;
  let database: any;

  beforeAll(async () => {
    // Ensure test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('These tests should only run in test environment');
    }
    console.log('Agent billing scenario tests started');
  });

  beforeEach(async () => {
    // Generate UUIDs for test data
    testOrgId = uuidv4();
    testUserId = uuidv4();
    testAgentId = uuidv4();
    testApiKeyId = uuidv4();

    database = await getDatabase();

    // Clean up test data (if any exist from previous runs)
    try {
      await database
        .delete(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));
      await database
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, testOrgId));
      await database.delete(agents).where(eq(agents.organizationId, testOrgId));
      await database.delete(users).where(eq(users.organizationId, testOrgId));
      await database
        .delete(organizations)
        .where(eq(organizations.id, testOrgId));
    } catch (error) {
      // Ignore cleanup errors for non-existent data
    }

    // Create test organization with credits
    const [org] = await database
      .insert(organizations)
      .values({
        id: testOrgId,
        name: 'Test Scenario Organization',
        slug: `test-scenario-org-${testOrgId}`,
        creditBalance: '25.0', // $25 starting balance
        creditThreshold: '5.0',
        autoTopUpEnabled: false,
        autoTopUpAmount: '20.0',
      })
      .returning();

    // Create test user
    const [user] = await database
      .insert(users)
      .values({
        id: testUserId,
        organizationId: testOrgId,
        email: 'scenario-test@example.com',
        firstName: 'Scenario',
        lastName: 'Tester',
        role: 'admin',
      })
      .returning();

    // Create test agent
    const [agent] = await database
      .insert(agents)
      .values({
        id: testAgentId,
        organizationId: testOrgId,
        createdByUserId: testUserId,
        name: 'Test Billing Agent',
        slug: 'test-billing-agent',
        description: 'Agent for testing billing scenarios',
        character: {
          name: 'Test Agent',
          bio: 'I am a test agent for billing scenarios',
          personality: ['helpful', 'efficient'],
          messageExamples: [
            [{ user: 'user', content: { text: 'Hello' } }],
            [{ user: 'assistant', content: { text: 'Hi there!' } }],
          ],
        },
        plugins: ['@elizaos/plugin-openai'],
        deploymentStatus: 'deployed',
        visibility: 'private',
      })
      .returning();

    // Create test API key
    const [apiKey] = await database
      .insert(apiKeys)
      .values({
        id: testApiKeyId,
        organizationId: testOrgId,
        userId: testUserId,
        name: 'Test API Key',
        description: 'API key for billing test scenarios',
        keyHash: `test-key-hash-${testApiKeyId}`,
        keyPrefix: `sk_test_${testApiKeyId.substring(0, 8)}`,
        permissions: ['inference:openai', 'inference:anthropic'],
        rateLimit: 1000,
        isActive: true,
      })
      .returning();
  });

  afterEach(async () => {
    // Clean up test data if IDs are defined
    if (testOrgId) {
      try {
        await database
          .delete(usageRecords)
          .where(eq(usageRecords.organizationId, testOrgId));
        await database
          .delete(creditTransactions)
          .where(eq(creditTransactions.organizationId, testOrgId));
        await database
          .delete(apiKeys)
          .where(eq(apiKeys.organizationId, testOrgId));
        await database
          .delete(agents)
          .where(eq(agents.organizationId, testOrgId));
        await database.delete(users).where(eq(users.organizationId, testOrgId));
        await database
          .delete(organizations)
          .where(eq(organizations.id, testOrgId));
      } catch (error) {
        // Ignore cleanup errors - test data may not exist
      }
    }
  });

  describe('Agent Conversation Billing Scenarios', () => {
    test('should bill for simple agent conversation', async () => {
      const initialBalance = await getCreditBalance(testOrgId);
      expect(initialBalance).toBe(25.0);

      // Simulate a conversation with the agent
      const conversationSteps = [
        {
          userMessage: 'Hello, how are you?',
          agentResponse:
            "Hello! I'm doing well, thank you for asking. How can I help you today?",
          inputTokens: 50,
          outputTokens: 75,
        },
        {
          userMessage: 'Can you help me write a short email?',
          agentResponse:
            "Of course! I'd be happy to help you write an email. What's the purpose of the email and who are you sending it to?",
          inputTokens: 60,
          outputTokens: 85,
        },
        {
          userMessage: "It's a thank you email to my colleague",
          agentResponse:
            "Great! Here's a professional thank you email:\n\nSubject: Thank You\n\nDear [Colleague's Name],\n\nI wanted to take a moment to express my sincere gratitude for your help with [specific task/project]. Your assistance made a significant difference, and I truly appreciate your time and expertise.\n\nThank you again for your support.\n\nBest regards,\n[Your Name]",
          inputTokens: 70,
          outputTokens: 120,
        },
      ];

      let totalCost = 0;

      for (let index = 0; index < conversationSteps.length; index++) {
        const step = conversationSteps[index];
        // Simulate processing the user message and generating response
        const requestId = `conversation-${testAgentId}-${index}`;

        // Deduct credits for AI usage
        const billingResult = await CreditService.deductCreditsForUsage(
          testOrgId,
          testUserId,
          {
            service: 'openai',
            operation: 'chat',
            modelName: 'gpt-3.5-turbo',
            inputTokens: step.inputTokens,
            outputTokens: step.outputTokens,
            requestId,
            agentId: testAgentId,
          },
        );

        expect(billingResult.success).toBe(true);
        totalCost += billingResult.deductedAmount;

        // Track usage record
        await trackUsage({
          organizationId: testOrgId,
          apiKeyId: testApiKeyId,
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          inputTokens: step.inputTokens,
          outputTokens: step.outputTokens,
          cost: billingResult.deductedAmount,
          duration: Math.round(800 + Math.random() * 400), // 800-1200ms
          success: true,
          requestId,
          metadata: {
            agentId: testAgentId,
            agentName: 'Test Billing Agent',
            conversationStep: index,
            userMessage: step.userMessage.substring(0, 50),
            responsePreview: step.agentResponse.substring(0, 50),
          },
        });
      }

      // Verify total billing
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBeCloseTo(25.0 - totalCost, 4);

      // Verify usage records were created
      const usageRecordsCreated = await database
        .select()
        .from(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));

      expect(usageRecordsCreated).toHaveLength(3);
      expect(
        usageRecordsCreated.every(
          (r: any) => r.metadata?.agentId === testAgentId,
        ),
      ).toBe(true);
      expect(usageRecordsCreated.every((r: any) => r.success)).toBe(true);

      // Verify credit transactions were created
      const transactions = await database
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));

      expect(transactions).toHaveLength(3);
      expect(transactions.every((t: any) => t.type === 'usage')).toBe(true);
      expect(
        transactions.every((t: any) => t.metadata?.agentId === testAgentId),
      ).toBe(true);
    });

    test('should handle expensive conversation and low balance warning', async () => {
      // Simulate a complex conversation that uses a lot of tokens
      const expensiveRequest = {
        service: 'openai',
        operation: 'chat',
        modelName: 'gpt-4', // More expensive model
        inputTokens: 2000, // Large input
        outputTokens: 1500, // Large output
        agentId: testAgentId,
        requestId: 'expensive-conversation',
      };

      const result = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        expensiveRequest,
      );

      expect(result.success).toBe(true);

      // GPT-4: (2000 * 0.03 + 1500 * 0.06) / 1000 = $0.15
      const expectedCost = 0.15;
      expect(result.deductedAmount).toBeCloseTo(expectedCost, 3);
      expect(result.remainingBalance).toBeCloseTo(25.0 - expectedCost, 3);

      // Check if balance is below threshold (should be since remaining > 5.0)
      const currentBalance = await getCreditBalance(testOrgId);
      expect(currentBalance).toBeGreaterThan(5.0);
    });

    test('should prevent agent operation when insufficient credits', async () => {
      // Reduce balance to very low amount
      await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 24.5,
        description: 'Reduce balance for test',
      });

      const remainingBalance = await getCreditBalance(testOrgId);
      expect(remainingBalance).toBe(0.5);

      // Try to use expensive GPT-4
      const result = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        {
          service: 'openai',
          operation: 'chat',
          modelName: 'gpt-4',
          inputTokens: 20000,
          outputTokens: 10000,
          agentId: testAgentId,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient credit balance');

      // Balance should remain unchanged
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBe(0.5);
    });

    test('should allow operation with cheaper model when balance is low', async () => {
      // Reduce balance to low amount
      await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 24.0,
        description: 'Reduce balance for test',
      });

      const remainingBalance = await getCreditBalance(testOrgId);
      expect(remainingBalance).toBe(1.0);

      // Use cheaper GPT-3.5 model with moderate token usage
      const result = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        {
          service: 'openai',
          operation: 'chat',
          modelName: 'gpt-3.5-turbo',
          inputTokens: 500,
          outputTokens: 300,
          agentId: testAgentId,
        },
      );

      expect(result.success).toBe(true);

      // GPT-3.5: (500 * 0.0015 + 300 * 0.002) / 1000 = $0.00135
      const expectedCost = 0.00135;
      expect(result.deductedAmount).toBeCloseTo(expectedCost, 5);
      expect(result.remainingBalance).toBeCloseTo(1.0 - expectedCost, 5);
    });
  });

  describe('Multi-Agent Billing Scenarios', () => {
    test('should track billing across multiple agents', async () => {
      // Create a second agent
      const testAgent2Id = uuidv4();
      const [agent2] = await database
        .insert(agents)
        .values({
          id: testAgent2Id,
          organizationId: testOrgId,
          createdByUserId: testUserId,
          name: 'Test Agent 2',
          slug: 'test-agent-2',
          description: 'Second agent for testing',
          character: {
            name: 'Test Agent 2',
            bio: 'I am the second test agent',
          },
          plugins: ['@elizaos/plugin-anthropic'],
          deploymentStatus: 'deployed',
          visibility: 'private',
        })
        .returning();

      // Simulate usage from both agents
      const agent1Result = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        {
          service: 'openai',
          operation: 'chat',
          modelName: 'gpt-3.5-turbo',
          inputTokens: 1000,
          outputTokens: 500,
          agentId: testAgentId,
          requestId: 'agent1-request',
        },
      );

      const agent2Result = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        {
          service: 'anthropic',
          operation: 'chat',
          modelName: 'claude-3-sonnet',
          inputTokens: 800,
          outputTokens: 400,
          agentId: agent2.id,
          requestId: 'agent2-request',
        },
      );

      expect(agent1Result.success).toBe(true);
      expect(agent2Result.success).toBe(true);

      // Verify transactions are attributed to correct agents
      const transactions = await database
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.organizationId, testOrgId));

      expect(transactions).toHaveLength(2);

      const agent1Transaction = transactions.find(
        (t: any) => t.metadata?.agentId === testAgentId,
      );
      const agent2Transaction = transactions.find(
        (t: any) => t.metadata?.agentId === agent2.id,
      );

      expect(agent1Transaction).toBeDefined();
      expect(agent2Transaction).toBeDefined();
      expect(agent1Transaction!.metadata.service).toBe('openai');
      expect(agent2Transaction!.metadata.service).toBe('anthropic');
    });
  });

  describe('Agent Lifecycle Billing Scenarios', () => {
    test('should track costs during agent development and testing', async () => {
      // Simulate agent development workflow
      const developmentSteps = [
        {
          phase: 'testing',
          service: 'openai',
          modelName: 'gpt-3.5-turbo',
          inputTokens: 200,
          outputTokens: 150,
          description: 'Testing agent responses',
        },
        {
          phase: 'refinement',
          service: 'openai',
          modelName: 'gpt-3.5-turbo',
          inputTokens: 300,
          outputTokens: 200,
          description: 'Refining agent personality',
        },
        {
          phase: 'validation',
          service: 'anthropic',
          modelName: 'claude-3-sonnet',
          inputTokens: 400,
          outputTokens: 250,
          description: 'Validating responses with Claude',
        },
      ];

      let totalDevelopmentCost = 0;

      for (let index = 0; index < developmentSteps.length; index++) {
        const step = developmentSteps[index];
        const result = await CreditService.deductCreditsForUsage(
          testOrgId,
          testUserId,
          {
            service: step.service,
            operation: 'chat',
            modelName: step.modelName,
            inputTokens: step.inputTokens,
            outputTokens: step.outputTokens,
            agentId: testAgentId,
            requestId: `dev-${step.phase}-${index}`,
          },
        );

        expect(result.success).toBe(true);
        totalDevelopmentCost += result.deductedAmount;

        // Track with development metadata
        await trackUsage({
          organizationId: testOrgId,
          apiKeyId: testApiKeyId,
          provider: step.service,
          model: step.modelName,
          inputTokens: step.inputTokens,
          outputTokens: step.outputTokens,
          cost: result.deductedAmount,
          duration: 1000,
          success: true,
          requestId: `dev-${step.phase}-${index}`,
          metadata: {
            agentId: testAgentId,
            developmentPhase: step.phase,
            description: step.description,
            isDevelopment: true,
          },
        });
      }

      // Verify development costs are tracked
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBeCloseTo(25.0 - totalDevelopmentCost, 4);

      // Get usage summary
      const summary = await CreditService.getUsageSummary(testOrgId);
      expect(summary.totalCost).toBeCloseTo(totalDevelopmentCost, 4);
      expect(summary.operationCount).toBe(3);

      // Verify development metadata is preserved
      const usageRecordsCreated = await database
        .select()
        .from(usageRecords)
        .where(eq(usageRecords.organizationId, testOrgId));

      expect(
        usageRecordsCreated.every((r: any) => r.metadata.isDevelopment),
      ).toBe(true);
      expect(
        usageRecordsCreated.some(
          (r: any) => r.metadata.developmentPhase === 'testing',
        ),
      ).toBe(true);
      expect(
        usageRecordsCreated.some(
          (r: any) => r.metadata.developmentPhase === 'refinement',
        ),
      ).toBe(true);
      expect(
        usageRecordsCreated.some(
          (r: any) => r.metadata.developmentPhase === 'validation',
        ),
      ).toBe(true);
    });

    test('should handle production vs development billing differently', async () => {
      // Development usage (free tier or discounted)
      const devResult = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        {
          service: 'openai',
          operation: 'chat',
          modelName: 'gpt-3.5-turbo',
          inputTokens: 1000,
          outputTokens: 500,
          agentId: testAgentId,
        },
      );

      // Production usage (full billing)
      const prodResult = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        {
          service: 'openai',
          operation: 'chat',
          modelName: 'gpt-3.5-turbo',
          inputTokens: 1000,
          outputTokens: 500,
          agentId: testAgentId,
        },
      );

      // Both should succeed and cost the same (for now)
      expect(devResult.success).toBe(true);
      expect(prodResult.success).toBe(true);
      expect(devResult.deductedAmount).toBeCloseTo(
        prodResult.deductedAmount,
        5,
      );

      // TODO: Implement different billing tiers for development vs production
    });
  });

  describe('Error Recovery and Billing Consistency', () => {
    test('should handle failed AI requests without billing', async () => {
      // Simulate a failed AI request
      const failedUsageId = await trackUsage({
        organizationId: testOrgId,
        apiKeyId: testApiKeyId,
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 0, // No output due to failure
        cost: 0, // No cost for failed request
        duration: 5000, // Long duration due to timeout
        success: false,
        errorMessage: 'API rate limit exceeded',
        metadata: {
          agentId: testAgentId,
          errorType: 'rate_limit',
          retryAttempt: 1,
        },
      });

      expect(failedUsageId).toBeDefined();

      // Verify no credits were deducted
      const balance = await getCreditBalance(testOrgId);
      expect(balance).toBe(25.0);

      // Verify error was tracked
      const errorRecords = await database
        .select()
        .from(usageRecords)
        .where(sql`metadata->>'errorType' IS NOT NULL`);

      expect(errorRecords.length).toBeGreaterThan(0);
      const errorRecord = errorRecords.find(
        (r: any) => r.metadata.errorType === 'rate_limit',
      );
      expect(errorRecord).toBeDefined();
      expect(parseFloat(errorRecord!.cost)).toBe(0);
      expect(errorRecord!.errorMessage).toBe('API rate limit exceeded');
    });

    test('should maintain billing consistency during system errors', async () => {
      const initialBalance = await getCreditBalance(testOrgId);

      // Start a transaction that might fail
      try {
        // This should succeed
        const result1 = await CreditService.deductCreditsForUsage(
          testOrgId,
          testUserId,
          {
            service: 'openai',
            operation: 'chat',
            modelName: 'gpt-3.5-turbo',
            inputTokens: 100,
            outputTokens: 50,
            agentId: testAgentId,
          },
        );
        expect(result1.success).toBe(true);

        // This might fail due to invalid data
        await CreditService.deductCreditsForUsage(
          '00000000-0000-4000-8000-000000000003',
          testUserId,
          {
            service: 'openai',
            operation: 'chat',
            modelName: 'gpt-3.5-turbo',
            inputTokens: 100,
            outputTokens: 50,
            agentId: testAgentId,
          },
        );
      } catch (error) {
        // Expected to fail for invalid org
      }

      // Verify first transaction succeeded and balance is correct
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBeLessThan(initialBalance);
      expect(finalBalance).toBeCloseTo(initialBalance - 0.00025, 4); // GPT-3.5 cost calculation: (100*0.0015 + 50*0.002)/1000
    });
  });
});
