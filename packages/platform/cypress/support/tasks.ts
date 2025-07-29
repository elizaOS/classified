/**
 * Cypress tasks for database operations and test setup
 */

import { db } from '../../lib/database';
import { createApiKey } from '../../lib/server/services/api-key-service';
import {
  addCredits,
  deductCredits,
} from '../../lib/server/services/billing-service';

export const tasks = {
  // Database operations
  clearDatabase: async () => {
    // Clear test data (be careful not to clear production data!)
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database clearing only allowed in test environment');
    }

    // Clear in reverse dependency order
    await db
      .delete('credit_transactions')
      .where('organization_id', 'like', 'test-%');
    await db.delete('api_keys').where('organization_id', 'like', 'test-%');
    await db.delete('user_sessions').where('organization_id', 'like', 'test-%');
    await db.delete('users').where('organization_id', 'like', 'test-%');
    await db.delete('organizations').where('slug', 'like', 'test-%');

    return null;
  },

  // Email verification
  getVerificationToken: async (email: string) => {
    // In a real app, this would query the email verification table
    // For testing, we'll generate a mock token
    const token = Buffer.from(email + ':' + Date.now()).toString('base64');
    return token;
  },

  // API key setup
  setupTestApiKey: async ({ email }: { email: string }) => {
    // Find user by email
    const user = await db.select().from('users').where('email', email).first();
    if (!user) {
      throw new Error('User not found');
    }

    // Create API key with full permissions
    const { keyValue } = await createApiKey({
      organizationId: user.organizationId,
      userId: user.id,
      name: 'Cypress Test Key',
      description: 'API key for end-to-end testing',
      permissions: [
        'inference:openai',
        'inference:anthropic',
        'inference:xai',
        'inference:groq',
        'inference:gemini',
        'storage:read',
        'storage:write',
        'storage:delete',
      ],
      rateLimit: 1000,
    });

    return keyValue;
  },

  // Credit management
  drainCredits: async (email: string) => {
    // Find user by email
    const user = await db.select().from('users').where('email', email).first();
    if (!user) {
      throw new Error('User not found');
    }

    // Get current balance
    const org = await db
      .select()
      .from('organizations')
      .where('id', user.organizationId)
      .first();

    if (!org) {
      throw new Error('Organization not found');
    }

    const currentBalance = parseFloat(org.creditBalance);

    if (currentBalance > 0) {
      // Deduct all credits
      await deductCredits({
        organizationId: user.organizationId,
        userId: user.id,
        amount: currentBalance,
        description: 'Test credit drain',
      });
    }

    return null;
  },

  addTestCredits: async (email: string, amount: number) => {
    const user = await db.select().from('users').where('email', email).first();
    if (!user) {
      throw new Error('User not found');
    }

    await addCredits({
      organizationId: user.organizationId,
      userId: user.id,
      amount,
      description: 'Test credits',
      type: 'adjustment',
    });

    return null;
  },

  // Mock Stripe webhook
  triggerStripeWebhook: async ({
    eventType,
    paymentIntentId,
    amount,
    organizationId,
  }: {
    eventType: string;
    paymentIntentId: string;
    amount: number;
    organizationId: string;
  }) => {
    // Simulate Stripe webhook payload
    const webhookPayload = {
      id: 'evt_test_' + Date.now(),
      object: 'event',
      type: eventType,
      data: {
        object: {
          id: paymentIntentId,
          amount: amount * 100, // Stripe uses cents
          metadata: {
            organizationId,
            type: 'credit_purchase',
          },
          status: eventType.includes('succeeded') ? 'succeeded' : 'failed',
        },
      },
    };

    // Process the webhook (this would normally go through the webhook endpoint)
    if (eventType === 'payment_intent.succeeded') {
      const creditAmount = amount * 0.9; // 10% platform fee

      await addCredits({
        organizationId,
        amount: creditAmount,
        description: `Credit purchase: $${amount} payment`,
        type: 'purchase',
        stripePaymentIntentId: paymentIntentId,
        paymentMethod: 'stripe',
        metadata: {
          originalAmount: amount,
          platformFee: amount * 0.1,
          stripePaymentIntent: paymentIntentId,
        },
      });
    }

    return webhookPayload;
  },

  // API testing helpers
  makeApiRequest: async ({
    endpoint,
    method = 'GET',
    apiKey,
    body,
  }: {
    endpoint: string;
    method?: string;
    apiKey: string;
    body?: any;
  }) => {
    const response = await fetch(`http://localhost:3333/api/v1${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return {
      status: response.status,
      data: await response.json(),
    };
  },

  // Database cleanup with better organization isolation
  'db:cleanup': async () => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database cleanup only allowed in test environment');
    }

    // Clear all test data
    await db.delete('audit_logs').where('organization_id', 'like', '%test%');
    await db
      .delete('credit_transactions')
      .where('organization_id', 'like', '%test%');
    await db.delete('agents').where('organization_id', 'like', '%test%');
    await db.delete('api_keys').where('organization_id', 'like', '%test%');
    await db.delete('user_sessions').where('organization_id', 'like', '%test%');
    await db.delete('users').where('organization_id', 'like', '%test%');
    await db.delete('organizations').where('id', 'like', '%test%');

    return null;
  },

  // Create test organizations for multi-tenancy testing
  'db:createTestOrganizations': async (organizationIds: string[]) => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'Test organization creation only allowed in test environment',
      );
    }

    const organizations = [];

    for (const orgId of organizationIds) {
      const org = await db
        .insert('organizations')
        .values({
          id: orgId,
          name: `Test Organization ${orgId}`,
          slug: `test-org-${orgId.toLowerCase()}`,
          subscriptionTier: 'pro',
          maxAgents: 10,
          maxApiRequests: 10000,
          creditBalance: '100.00',
        })
        .returning('*')
        .onConflict('id')
        .ignore()
        .first();

      if (org) {
        organizations.push(org);
      }
    }

    return organizations;
  },

  // Create test user with organization context
  'db:createTestUser': async ({
    email,
    organizationId,
    role = 'user',
  }: {
    email: string;
    organizationId: string;
    role?: string;
  }) => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Test user creation only allowed in test environment');
    }

    const user = await db
      .insert('users')
      .values({
        organizationId,
        email,
        firstName: 'Test',
        lastName: 'User',
        role,
        emailVerified: true,
        workosUserId: `workos_${Date.now()}`,
      })
      .returning('*')
      .onConflict('email')
      .ignore()
      .first();

    return user;
  },

  // Create test agents for organization
  'db:createTestAgents': async ({
    organizationId,
    userId,
    count = 2,
  }: {
    organizationId: string;
    userId: string;
    count?: number;
  }) => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Test agent creation only allowed in test environment');
    }

    const agents = [];

    for (let i = 1; i <= count; i++) {
      const agent = await db
        .insert('agents')
        .values({
          organizationId,
          createdByUserId: userId,
          name: `Test Agent ${i}`,
          description: `Test agent ${i} for organization ${organizationId}`,
          slug: `test-agent-${i}-${organizationId}`,
          character: {
            name: `Test Agent ${i}`,
            bio: 'A test agent for Cypress testing',
            system: 'You are a helpful test agent.',
          },
          plugins: [
            '@elizaos/plugin-memory',
            '@elizaos/plugin-sql',
            '@elizaos/plugin-web-search',
          ],
          runtimeConfig: {
            maxTokens: 4096,
            temperature: 0.7,
          },
          visibility: 'organization',
          deploymentStatus: 'draft',
        })
        .returning('*')
        .first();

      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
  },

  // Verify data isolation between organizations
  'db:verifyDataIsolation': async ({
    org1Id,
    org2Id,
  }: {
    org1Id: string;
    org2Id: string;
  }) => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'Data isolation verification only allowed in test environment',
      );
    }

    // Check that each organization only sees its own data
    const org1Agents = await db
      .select()
      .from('agents')
      .where('organization_id', org1Id);
    const org2Agents = await db
      .select()
      .from('agents')
      .where('organization_id', org2Id);

    // Verify no cross-contamination
    const crossContamination = {
      org1HasOrg2Data: org1Agents.some(
        (agent) => agent.organizationId === org2Id,
      ),
      org2HasOrg1Data: org2Agents.some(
        (agent) => agent.organizationId === org1Id,
      ),
    };

    return {
      org1AgentCount: org1Agents.length,
      org2AgentCount: org2Agents.length,
      isolated:
        !crossContamination.org1HasOrg2Data &&
        !crossContamination.org2HasOrg1Data,
      crossContamination,
    };
  },

  // Test API key generation with organization context
  'api:generateTestApiKey': async ({
    organizationId,
    userId,
  }: {
    organizationId: string;
    userId: string;
  }) => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(
        'Test API key generation only allowed in test environment',
      );
    }

    const { keyValue } = await createApiKey({
      organizationId,
      userId,
      name: 'Cypress Test API Key',
      description: 'Generated for agent editor integration tests',
      permissions: ['agents:*', 'messaging:*', 'inference:*'],
      rateLimit: 1000,
    });

    return keyValue;
  },

  // Test required plugins enforcement
  'agents:testRequiredPlugins': async ({
    organizationId,
    plugins,
  }: {
    organizationId: string;
    plugins: string[];
  }) => {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Plugin testing only allowed in test environment');
    }

    // Mock organization config with required plugins
    const requiredPlugins = ['@elizaos/plugin-memory', '@elizaos/plugin-sql'];
    const missingPlugins = requiredPlugins.filter(
      (required) => !plugins.includes(required),
    );
    const mergedPlugins = [...new Set([...requiredPlugins, ...plugins])];

    return {
      isValid: missingPlugins.length === 0,
      missingPlugins,
      mergedPlugins,
      requiredPlugins,
    };
  },

  // Environment setup
  setupTestEnvironment: async () => {
    // Ensure we're in test mode
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Test environment setup only allowed in test mode');
    }

    // Set test environment variables
    process.env.STRIPE_SECRET_KEY =
      process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_...';
    process.env.STRIPE_PUBLISHABLE_KEY =
      process.env.STRIPE_TEST_PUBLISHABLE_KEY || 'pk_test_...';
    process.env.OPENAI_API_KEY =
      process.env.OPENAI_TEST_API_KEY || process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY =
      process.env.ANTHROPIC_TEST_API_KEY || process.env.ANTHROPIC_API_KEY;

    return {
      stripeMode: 'test',
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasR2: !!(
        process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
      ),
    };
  },

  // Performance testing
  createLoadTestData: async ({
    userCount = 10,
    apiKeysPerUser = 3,
  }: {
    userCount?: number;
    apiKeysPerUser?: number;
  } = {}) => {
    const createdData = [];

    for (let i = 0; i < userCount; i++) {
      // Create organization
      const org = await db
        .insert('organizations')
        .values({
          name: `Load Test Org ${i}`,
          slug: `load-test-org-${i}-${Date.now()}`,
        })
        .returning('*')
        .first();

      // Create user
      const user = await db
        .insert('users')
        .values({
          organizationId: org.id,
          email: `loadtest${i}@example.com`,
          firstName: `Load`,
          lastName: `Test ${i}`,
        })
        .returning('*')
        .first();

      // Add credits
      await addCredits({
        organizationId: org.id,
        userId: user.id,
        amount: 100.0,
        description: 'Load test credits',
        type: 'adjustment',
      });

      // Create API keys
      const apiKeys = [];
      for (let j = 0; j < apiKeysPerUser; j++) {
        const { apiKey, keyValue } = await createApiKey({
          organizationId: org.id,
          userId: user.id,
          name: `Load Test Key ${j}`,
          permissions: ['inference:openai', 'storage:write'],
          rateLimit: 100,
        });
        apiKeys.push({ id: apiKey.id, key: keyValue });
      }

      createdData.push({
        organization: org,
        user,
        apiKeys,
      });
    }

    return createdData;
  },
};

export default tasks;
