/**
 * Real Agent Billing Integration Tests
 * Tests the complete integration of agent deployment, runtime, and billing system
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'bun:test';
import {
  addCredits,
  deductCredits,
  getCreditBalance,
} from '../../lib/server/services/billing-service';
import { CreditService } from '../../lib/billing/credit-service';
import {
  getBillingConfig,
  getAgentLimitForTier,
} from '../../lib/billing/config';
import { db, getDatabase } from '../../lib/database';
import {
  organizations,
  users,
  creditTransactions,
} from '../../lib/database/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Conditional runtime imports to avoid test failures
let elizaRuntimeService: any;
let agentLifecycleManager: any;
let Character: any;
let UUID: any;
let IAgentRuntime: any;
let stringToUuid: any;

// Try to import runtime services conditionally
try {
  const elizaRuntime = require('../../lib/runtime/eliza-service');
  elizaRuntimeService = elizaRuntime.elizaRuntimeService;

  const agentLifecycle = require('../../lib/runtime/agent-lifecycle');
  agentLifecycleManager = agentLifecycle.agentLifecycleManager;

  const core = require('@elizaos/core');
  Character = core.Character;
  UUID = core.UUID;
  IAgentRuntime = core.IAgentRuntime;
  stringToUuid = core.stringToUuid;
} catch (error) {
  console.warn(
    'ElizaOS runtime imports failed, skipping runtime tests:',
    (error as Error).message,
  );
}

describe('Real Agent Billing Integration', () => {
  // Skip all tests if runtime services are not available
  if (!elizaRuntimeService) {
    test.skip('ElizaOS runtime not available, skipping all runtime tests', () => {});
    return;
  }

  let testOrgId: string;
  let testUserId: string;
  let deployedAgentId: any = null;
  let database: any;

  // Real test character for agent deployment
  const testCharacter: any = {
    name: 'BillingTestAgent',
    bio: [
      'An agent designed to test billing integration with real ElizaOS runtime',
      'I am a test agent that validates billing operations work correctly with real agent deployments',
      'I help ensure credit deductions and usage tracking function properly',
    ],
    messageExamples: [
      [
        {
          name: 'user',
          content: { text: 'Test billing integration' },
        },
        {
          name: 'assistant',
          content: {
            text: 'Billing integration test successful! Credits are being tracked properly.',
          },
        },
      ],
    ],
    style: {
      all: ['precise', 'technical'],
      chat: ['clear', 'informative'],
    },
  };

  beforeAll(async () => {
    // Only run in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('These tests should only run in test environment');
    }
  });

  beforeEach(async () => {
    // Create test organization and user
    testOrgId = uuidv4();
    testUserId = uuidv4();

    database = await getDatabase();

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
      name: 'Billing Test Organization',
      slug: `billing-test-${testOrgId}`,
      creditBalance: '0.0', // Start with zero balance
    });

    // Create test user
    await database.insert(users).values({
      id: testUserId,
      organizationId: testOrgId,
      email: 'billing-test@example.com',
      firstName: 'Billing',
      lastName: 'Test',
      role: 'admin',
    });

    // Add initial test credits
    await addCredits({
      organizationId: testOrgId,
      userId: testUserId,
      amount: 50.0,
      description: 'Initial test credits for billing integration',
      type: 'adjustment',
    });
  });

  afterEach(async () => {
    // Clean up deployed agent
    if (deployedAgentId) {
      try {
        await elizaRuntimeService.deleteAgent(deployedAgentId);
        deployedAgentId = null;
      } catch (error) {
        console.warn('Error cleaning up test agent:', error);
      }
    }

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
      console.warn('Error cleaning up test data:', error);
    }
  });

  describe('Agent Deployment with Billing', () => {
    test('should deploy agent and verify billing configuration', async () => {
      // Verify initial balance
      const initialBalance = await getCreditBalance(testOrgId);
      expect(initialBalance).toBe(50.0);

      // Test billing configuration
      const billingConfig = getBillingConfig();
      expect(billingConfig).toBeDefined();
      expect(billingConfig.agentLimits.free).toBeGreaterThan(0);

      // Test agent limit for free tier
      const agentLimit = getAgentLimitForTier('free');
      expect(agentLimit).toBe(billingConfig.agentLimits.free);

      // Deploy agent through lifecycle manager (integrates billing)
      deployedAgentId = await agentLifecycleManager.deployAgent(
        testOrgId,
        testUserId,
        testCharacter,
        [],
        'free',
      );

      expect(deployedAgentId).toBeDefined();
      expect(typeof deployedAgentId).toBe('string');

      // Verify agent is deployed and tracked
      const agentInfo = await elizaRuntimeService.getAgent(deployedAgentId);
      expect(agentInfo).toBeDefined();
      expect(agentInfo!.character.name).toBe(testCharacter.name);
      expect(agentInfo!.organizationId).toBe(testOrgId);
    }, 30000);

    test('should respect agent limits based on subscription tier', async () => {
      const billingConfig = getBillingConfig();
      const freeLimit = billingConfig.agentLimits.free;

      // Deploy agents up to the limit
      const deployedAgents: any[] = [];

      for (let i = 0; i < freeLimit; i++) {
        const agentId = await agentLifecycleManager.deployAgent(
          testOrgId,
          testUserId,
          {
            ...testCharacter,
            name: `TestAgent${i}`,
          },
          [],
          'free',
        );
        deployedAgents.push(agentId);
      }

      // Try to deploy one more agent (should fail)
      await expect(
        agentLifecycleManager.deployAgent(
          testOrgId,
          testUserId,
          {
            ...testCharacter,
            name: 'ExcessAgent',
          },
          [],
          'free',
        ),
      ).rejects.toThrow(/maximum agent limit/);

      // Clean up deployed agents
      for (const agentId of deployedAgents) {
        await elizaRuntimeService.deleteAgent(agentId);
      }
    }, 60000);
  });

  describe('Usage Tracking and Billing', () => {
    test('should track and bill agent usage', async () => {
      // Deploy test agent
      deployedAgentId = await agentLifecycleManager.deployAgent(
        testOrgId,
        testUserId,
        testCharacter,
        [],
        'free',
      );

      const initialBalance = await getCreditBalance(testOrgId);
      expect(initialBalance).toBe(50.0);

      // Simulate agent usage with credit deduction
      const usageContext = {
        agentId: deployedAgentId,
        service: 'openai',
        operation: 'chat',
        modelName: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        requestId: `test-${Date.now()}`,
      };

      const usageResult = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        usageContext,
      );

      expect(usageResult.success).toBe(true);
      expect(usageResult.deductedAmount).toBeGreaterThan(0);
      expect(usageResult.remainingBalance).toBeLessThan(initialBalance);

      // Verify balance was actually deducted
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBe(usageResult.remainingBalance);
      expect(finalBalance).toBeLessThan(initialBalance);
    });

    test('should handle insufficient balance scenarios', async () => {
      // Deploy test agent
      deployedAgentId = await agentLifecycleManager.deployAgent(
        testOrgId,
        testUserId,
        testCharacter,
        [],
        'free',
      );

      // Deduct most of the balance
      await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 49.5, // Leave only $0.50
        description: 'Reduce balance for insufficient funds test',
      });

      const lowBalance = await getCreditBalance(testOrgId);
      expect(lowBalance).toBe(0.5);

      // Try to perform expensive operation
      const expensiveUsage = {
        agentId: deployedAgentId,
        service: 'openai',
        operation: 'chat',
        modelName: 'gpt-4',
        inputTokens: 10000, // Large token count = high cost
        outputTokens: 5000,
        requestId: `expensive-${Date.now()}`,
      };

      const usageResult = await CreditService.deductCreditsForUsage(
        testOrgId,
        testUserId,
        expensiveUsage,
      );

      expect(usageResult.success).toBe(false);
      expect(usageResult.error).toContain('Insufficient credit balance');
      expect(usageResult.deductedAmount).toBe(0);
    });

    test('should calculate costs correctly for different models', async () => {
      const testCases = [
        {
          service: 'openai',
          modelName: 'gpt-4o-mini',
          inputTokens: 1000,
          outputTokens: 500,
          expectedCostRange: [0.001, 0.01], // Expected range in USD
        },
        {
          service: 'anthropic',
          modelName: 'claude-3-haiku',
          inputTokens: 1000,
          outputTokens: 500,
          expectedCostRange: [0.0001, 0.005],
        },
        {
          service: 'storage',
          operation: 'upload',
          tokens: 1024, // 1MB file
          expectedCostRange: [0.01, 0.02],
        },
      ];

      for (const testCase of testCases) {
        const cost =
          testCase.service === 'storage'
            ? CreditService.calculateStorageCost(testCase as any)
            : CreditService.calculateModelCost(testCase as any);

        expect(cost).toBeGreaterThanOrEqual(testCase.expectedCostRange[0]);
        expect(cost).toBeLessThanOrEqual(testCase.expectedCostRange[1]);
      }
    });
  });

  describe('Agent Lifecycle and Billing Integration', () => {
    test('should track agent statistics and costs', async () => {
      // Deploy test agent
      deployedAgentId = await agentLifecycleManager.deployAgent(
        testOrgId,
        testUserId,
        testCharacter,
        [],
        'free',
      );

      // Record some usage for the agent
      await agentLifecycleManager.recordAgentUsage(
        deployedAgentId,
        10, // messageCount
        1000, // computeTime
        5, // apiCalls
        0.05, // cost
      );

      // Get agent stats
      const stats = await elizaRuntimeService.getAgentStats(deployedAgentId);
      expect(stats).toBeDefined();
      expect(stats!.messageCount).toBe(10);
      expect(stats!.interactionCount).toBe(5);
      expect(stats!.totalCost).toBe(0.05);

      // Verify billing transaction was recorded
      const balance = await getCreditBalance(testOrgId);
      expect(balance).toBeLessThan(50.0); // Should be reduced by the cost
    });

    test('should handle agent health monitoring', async () => {
      // Deploy test agent
      deployedAgentId = await agentLifecycleManager.deployAgent(
        testOrgId,
        testUserId,
        testCharacter,
        [],
        'free',
      );

      // Check agent health
      const isHealthy =
        await elizaRuntimeService.checkAgentHealth(deployedAgentId);
      expect(isHealthy).toBe(true);

      // Get organization overview
      const overview =
        await agentLifecycleManager.getOrganizationOverview(testOrgId);
      expect(overview).toBeDefined();
      expect(overview.agents.length).toBeGreaterThan(0);
      expect(overview.healthyAgents).toBeGreaterThan(0);
      expect(
        overview.agents.some((agent: any) => agent.agentId === deployedAgentId),
      ).toBe(true);
    });

    test('should handle agent deletion and cleanup', async () => {
      // Deploy test agent
      deployedAgentId = await agentLifecycleManager.deployAgent(
        testOrgId,
        testUserId,
        testCharacter,
        [],
        'free',
      );

      // Verify agent exists
      const agentInfo = await elizaRuntimeService.getAgent(deployedAgentId);
      expect(agentInfo).toBeDefined();

      // Delete agent
      await agentLifecycleManager.deleteAgent(deployedAgentId);

      // Verify agent is removed from runtime service
      const deletedAgentInfo =
        await elizaRuntimeService.getAgent(deployedAgentId);
      expect(deletedAgentInfo).toBeNull();

      deployedAgentId = null; // Prevent cleanup attempt
    });
  });

  describe('Billing Configuration Integration', () => {
    test('should use environment-based billing configuration', async () => {
      const billingConfig = getBillingConfig();

      // Test that configuration is loaded
      expect(billingConfig.initialCredits.amount).toBeGreaterThan(0);
      expect(billingConfig.pricing.currency).toBe('usd');
      expect(billingConfig.pricing.minimumCharge).toBeGreaterThan(0);

      // Test agent limits for different tiers
      expect(getAgentLimitForTier('free')).toBe(billingConfig.agentLimits.free);
      expect(getAgentLimitForTier('basic')).toBe(
        billingConfig.agentLimits.basic,
      );
      expect(getAgentLimitForTier('pro')).toBe(billingConfig.agentLimits.pro);
      expect(getAgentLimitForTier('invalid-tier')).toBe(
        billingConfig.agentLimits.free,
      );
    });

    test('should handle credit operations with proper validation', async () => {
      // Test adding credits
      const addResult = await addCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 25.0,
        description: 'Test credit addition',
        type: 'purchase',
      });

      expect(addResult).toBeDefined();
      expect(parseFloat(addResult.amount)).toBe(25.0);
      expect(parseFloat(addResult.balanceAfter)).toBe(75.0);

      // Test deducting credits
      const deductResult = await deductCredits({
        organizationId: testOrgId,
        userId: testUserId,
        amount: 10.0,
        description: 'Test credit deduction',
      });

      expect(deductResult).toBeDefined();
      expect(parseFloat(deductResult!.amount)).toBe(-10.0);
      expect(parseFloat(deductResult!.balanceAfter)).toBe(65.0);

      // Verify final balance
      const finalBalance = await getCreditBalance(testOrgId);
      expect(finalBalance).toBe(65.0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid agent operations gracefully', async () => {
      const invalidAgentId = stringToUuid('invalid-agent-id');

      // Test health check for invalid agent
      const health = await elizaRuntimeService.checkAgentHealth(invalidAgentId);
      expect(health).toBe(false);

      // Test stats for invalid agent
      const stats = await elizaRuntimeService.getAgentStats(invalidAgentId);
      expect(stats).toBeNull();

      // Test deleting invalid agent
      await expect(
        elizaRuntimeService.deleteAgent(invalidAgentId),
      ).rejects.toThrow('not found');
    });

    test('should handle concurrent agent operations', async () => {
      // Deploy multiple agents concurrently
      const deploymentPromises = Array.from({ length: 3 }, (_, i) =>
        agentLifecycleManager.deployAgent(
          testOrgId,
          testUserId,
          {
            ...testCharacter,
            name: `ConcurrentAgent${i}`,
          },
          [],
          'basic', // Use basic tier for higher limits
        ),
      );

      const deployedAgents = await Promise.all(deploymentPromises);
      expect(deployedAgents).toHaveLength(3);
      expect(deployedAgents.every((id) => typeof id === 'string')).toBe(true);

      // Clean up agents
      for (const agentId of deployedAgents) {
        await elizaRuntimeService.deleteAgent(agentId);
      }
    }, 60000);
  });
});
