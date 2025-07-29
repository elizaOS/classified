/**
 * Real API Integration Tests
 * Tests actual API endpoints with real database operations and services
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'bun:test';
import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Import real API route handlers
import { POST as createPaymentIntent } from '../../app/api/billing/payment-intent/route';
import { GET as getBillingOverview } from '../../app/api/billing/overview/route';
import {
  GET as getAgents,
  POST as createAgent,
} from '../../app/api/agents/route';

// Import real services for setup
import { agentService } from '../../lib/agents/service';
import {
  addCredits,
  getCreditBalance,
} from '../../lib/server/services/billing-service';
import {
  getDatabase,
  organizations,
  users,
  creditTransactions,
  apiKeys,
  usageRecords,
} from '../../lib/database';
import { eq } from 'drizzle-orm';

// Test configuration - use proper UUIDs
const TEST_ORG_ID = uuidv4();
const TEST_USER_ID = uuidv4();
const TEST_USER_EMAIL = 'api-integration-test@example.com';

// Mock authentication for tests
mock.module('../../lib/auth/session', () => ({
  authService: {
    getCurrentUser: mock(() =>
      Promise.resolve({
        id: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        email: TEST_USER_EMAIL,
        role: 'admin',
      }),
    ),
  },
}));

// Helper function to create mock requests
function createMockRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: any,
): NextRequest {
  const request = new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return request;
}

describe('API Integration Tests', () => {
  let database: any;

  beforeAll(async () => {
    // Set up test organization and user in database
    database = await getDatabase();

    try {
      // Create test organization
      await database.insert(organizations).values({
        id: TEST_ORG_ID,
        name: 'Test Organization',
        slug: `test-org-${Date.now()}`,
        subscriptionTier: 'pro',
        creditBalance: '100.00',
      });

      // Create test user
      await database.insert(users).values({
        id: TEST_USER_ID,
        organizationId: TEST_ORG_ID,
        email: TEST_USER_EMAIL,
        role: 'admin',
        isActive: true,
      });

      // Add initial credits
      await addCredits({
        organizationId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        amount: 100.0,
        description: 'Initial test credits',
        type: 'adjustment',
      });
    } catch (error) {
      console.warn('Test setup failed (may already exist):', error);
    }
  });

  afterAll(async () => {
    // Clean up test data in correct order to avoid foreign key violations
    const db = await getDatabase();
    try {
      // Import agents table for cleanup
      const { agents } = require('../../lib/database/schema');

      // Delete dependent records first
      await database
        .delete(usageRecords)
        .where(eq(usageRecords.organizationId, TEST_ORG_ID));
      await database
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, TEST_ORG_ID));
      await database
        .delete(apiKeys)
        .where(eq(apiKeys.organizationId, TEST_ORG_ID));

      // Delete agents that reference this user
      await database
        .delete(agents)
        .where(eq(agents.organizationId, TEST_ORG_ID));

      // Now safe to delete users and organizations
      await database.delete(users).where(eq(users.id, TEST_USER_ID));
      await database
        .delete(organizations)
        .where(eq(organizations.id, TEST_ORG_ID));
    } catch (error) {
      console.warn('Test cleanup failed:', error);
    }

    // Close database connections
    await require('../../lib/database/connection').closeDatabase();
  });

  // Dashboard API tests removed - those routes don't exist

  describe('Billing API', () => {
    test('GET /api/billing/overview should return billing information', async () => {
      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/billing/overview',
      );
      const response = await getBillingOverview(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.creditBalance).toBeGreaterThanOrEqual(0);
      expect(data.data.organizationId).toBe(TEST_ORG_ID);
    });

    test('POST /api/billing/payment-intent should create payment intent', async () => {
      // Skip this test if Stripe is not configured
      if (
        !process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_SECRET_KEY.includes('test')
      ) {
        console.warn(
          'Skipping payment intent test - Stripe not properly configured',
        );
        return;
      }

      const requestBody = {
        amount: 10.0,
        currency: 'usd',
      };

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/billing/payment-intent',
        requestBody,
      );

      const response = await createPaymentIntent(request);

      if (response.status === 503) {
        // Service not configured - acceptable for test environment
        console.warn('Payment service not configured for testing');
        return;
      }

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.clientSecret).toBeDefined();
      expect(data.data.paymentIntentId).toBeDefined();
    });
  });

  describe('Agents API', () => {
    test('GET /api/agents should return agent list', async () => {
      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/agents',
      );
      const response = await getAgents(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data.agents)).toBe(true);
      expect(data.data.stats).toBeDefined();
    });

    test('POST /api/agents should create new agent', async () => {
      const agentData = {
        name: 'Test Agent',
        description: 'A test agent for API integration testing',
        slug: `test-agent-${Date.now()}`,
        character: {
          name: 'Test Agent',
          bio: 'A test agent created through API integration tests',
          messageExamples: [],
          postExamples: [],
          topics: ['testing'],
          style: {
            all: ['Be helpful'],
            chat: ['Respond clearly'],
            post: ['Keep it brief'],
          },
        },
        plugins: [],
        runtimeConfig: {
          temperature: 0.7,
          maxTokens: 1000,
        },
        visibility: 'private',
      };

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/agents',
        agentData,
      );

      const response = await createAgent(request);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.agent).toBeDefined();
      expect(data.agent.name).toBe(agentData.name);
      expect(data.agent.slug).toBe(agentData.slug);
      expect(data.agent.deploymentStatus).toBe('draft');
    });

    test('Agent service validations should work correctly', async () => {
      // Test character validation
      const validCharacter = {
        name: 'Valid Agent',
        bio: 'A valid character for testing',
      };

      const validation = agentService.validateCharacterConfig(validCharacter);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Test invalid character
      const invalidCharacter = {
        name: '',
        bio: '',
      };

      const invalidValidation =
        agentService.validateCharacterConfig(invalidCharacter);
      expect(invalidValidation.isValid).toBe(false);
      expect(invalidValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Real Service Integration', () => {
    test('Credit balance operations should work correctly', async () => {
      const initialBalance = await getCreditBalance(TEST_ORG_ID);
      expect(initialBalance).toBeGreaterThanOrEqual(0);

      // Add credits
      await addCredits({
        organizationId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        amount: 25.0,
        description: 'Test credit addition',
        type: 'adjustment',
      });

      const newBalance = await getCreditBalance(TEST_ORG_ID);
      expect(newBalance).toBe(initialBalance + 25.0);
    });

    test('Agent service operations should work correctly', async () => {
      const stats = await agentService.getAgentStats(TEST_ORG_ID);
      expect(stats).toBeDefined();
      expect(stats.totalAgents).toBeGreaterThanOrEqual(0);
      expect(stats.activeAgents).toBeGreaterThanOrEqual(0);
      expect(stats.draftAgents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('API should handle unauthorized access', async () => {
      // Temporarily mock unauthorized user
      const { authService } = require('../../lib/auth/session');
      const originalGetCurrentUser = authService.getCurrentUser;
      authService.getCurrentUser = mock(() => Promise.resolve(null));

      const request = createMockRequest(
        'GET',
        'http://localhost:3000/api/billing/overview',
      );
      const response = await getBillingOverview(request);

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');

      // Restore original function
      authService.getCurrentUser = originalGetCurrentUser;
    });

    test('API should validate request data', async () => {
      const invalidAgentData = {
        name: '', // Invalid - empty name
        slug: 'invalid-slug-!@#', // Invalid - special characters
        character: {
          name: '',
          bio: '',
        },
        plugins: 'not-an-array', // Invalid - should be array
        visibility: 'invalid-visibility', // Invalid enum value
      };

      const request = createMockRequest(
        'POST',
        'http://localhost:3000/api/agents',
        invalidAgentData,
      );

      const response = await createAgent(request);

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});
