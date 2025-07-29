import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createApiKey } from '@/lib/server/services/api-key-service';
import { addCredits } from '@/lib/server/services/billing-service';
import { db, getDatabase, initializeDbProxy } from '@/lib/database';
import { organizations, users, apiKeys } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Integration tests for all API providers
 * Tests real API calls to OpenAI, Anthropic, R2, etc.
 * Requires valid API keys in environment variables
 */

const TEST_ORG_ID = uuidv4();
const TEST_USER_ID = uuidv4();

let testApiKey: string;
let apiKeyId: string;
let database: any;

// Helper function to check if API server is available
async function checkApiServerAvailable(): Promise<boolean> {
  if (!process.env.API_SERVER_RUNNING) {
    return false;
  }

  try {
    const response = await fetch('http://localhost:3333/api/health', {
      method: 'HEAD',
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe('API Providers Integration Tests', () => {
  beforeAll(async () => {
    // Initialize database
    database = await getDatabase();
    initializeDbProxy(database);

    // Skip these tests if the API server isn't running
    if (!process.env.API_SERVER_RUNNING) {
      console.warn(
        'Skipping API provider tests: API server not running (set API_SERVER_RUNNING=true to enable)',
      );
    }
    // Create test organization and user
    const [organization] = await database
      .insert(organizations)
      .values({
        id: TEST_ORG_ID,
        name: 'Test Organization',
        slug: `test-org-${Date.now()}`,
        creditBalance: '100.0',
        creditThreshold: '10.0',
        autoTopUpEnabled: false,
        autoTopUpAmount: '25.0',
      })
      .returning();

    const [user] = await database
      .insert(users)
      .values({
        id: TEST_USER_ID,
        organizationId: organization.id,
        email: `test-${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
      })
      .returning();

    // Add test credits
    await addCredits({
      organizationId: organization.id,
      userId: user?.id || TEST_USER_ID,
      amount: 50.0, // $50 in test credits
      description: 'Test credits for integration tests',
      type: 'adjustment',
    });

    // Create test API key with all permissions
    const { apiKey, keyValue } = await createApiKey({
      organizationId: organization.id,
      userId: user?.id || TEST_USER_ID,
      name: 'Integration Test Key',
      description: 'API key for integration testing',
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

    testApiKey = keyValue;
    apiKeyId = apiKey.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (apiKeyId) {
      // Use direct database deletion instead of service method
      await database.delete(apiKeys).where(eq(apiKeys.id, apiKeyId));
    }
    // Note: In production, you'd also clean up organization and user
  });

  describe('OpenAI Integration', () => {
    test('should complete text with GPT-4o-mini', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.warn('Skipping OpenAI test - OPENAI_API_KEY not set');
        return;
      }

      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping OpenAI API test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/inference/openai',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: 'What is 2+2? Reply with just the number.',
              },
            ],
            max_tokens: 10,
            temperature: 0,
          }),
        },
      );

      if (response.status !== 200) {
        const errorData = await response.json();
        console.error('API request failed:', {
          status: response.status,
          error: errorData,
          apiKey: testApiKey
            ? `${testApiKey.substring(0, 10)}...`
            : 'undefined',
        });
      }

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.choices).toBeDefined();
      expect(data.choices[0].message.content).toContain('4');
      expect(data.usage.cost).toBeGreaterThan(0);
      expect(data.usage.billing).toBeDefined();
      expect(data.usage.billing.platformFee).toBeGreaterThan(0);
    }, 30000);

    test('should handle invalid model gracefully', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping invalid model test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/inference/openai',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'invalid-model',
            messages: [{ role: 'user', content: 'test' }],
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Unsupported model');
      expect(data.supportedModels).toBeDefined();
    });

    test('should reject requests without API key', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/inference/openai',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
          }),
        },
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Anthropic Integration', () => {
    test('should complete text with Claude-3-5-haiku', async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('Skipping Anthropic test - ANTHROPIC_API_KEY not set');
        return;
      }

      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/inference/anthropic',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            messages: [
              {
                role: 'user',
                content:
                  'What is the capital of France? Reply with just the city name.',
              },
            ],
            max_tokens: 10,
            temperature: 0,
          }),
        },
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.content).toBeDefined();
      expect(data.content[0].text).toContain('Paris');
      expect(data.usage.cost).toBeGreaterThan(0);
      expect(data.usage.billing).toBeDefined();
    }, 30000);

    test('should require max_tokens parameter', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/inference/anthropic',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            messages: [{ role: 'user', content: 'test' }],
            // max_tokens missing
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });
  });

  describe('Storage Integration', () => {
    test('should upload file to R2 storage', async () => {
      if (!process.env.R2_ACCESS_KEY_ID) {
        console.warn('Skipping R2 test - R2 credentials not set');
        return;
      }

      const testFile = new Blob(['Hello, world!'], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', testFile, 'test.txt');
      formData.append('path', 'test-uploads');
      formData.append('public', 'false');

      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/storage/upload',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
          body: formData,
        },
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.filename).toBeDefined();
      expect(data.data.originalFilename).toBe('test.txt');
      expect(data.data.path).toContain('test-uploads');
      expect(data.data.signedUrl).toBeDefined();
      expect(data.data.billing.uploadCharge).toBeGreaterThan(0);

      // Verify file can be accessed via signed URL
      const fileResponse = await fetch(data.data.signedUrl);
      expect(fileResponse.status).toBe(200);
      const fileContent = await fileResponse.text();
      expect(fileContent).toBe('Hello, world!');
    }, 30000);

    test('should reject files that are too large', async () => {
      // Create a file larger than 100MB (mocked)
      const formData = new FormData();
      const largeFile = new Blob(['x'.repeat(1000)], { type: 'text/plain' });

      // Mock the file size property
      Object.defineProperty(largeFile, 'size', {
        value: 101 * 1024 * 1024, // 101MB
        writable: false,
      });

      formData.append('file', largeFile, 'large.txt');

      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/storage/upload',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
          body: formData,
        },
      );

      expect(response.status).toBe(413);
      const data = await response.json();
      expect(data.error).toBe('File too large');
    });

    test('should require file parameter', async () => {
      const formData = new FormData();
      // No file attached

      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/storage/upload',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
          body: formData,
        },
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('No file provided');
    });
  });

  describe('Billing Integration', () => {
    test('should get credit balance and transactions', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/billing/credits',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${testApiKey}`, // This should be user session token, not API key
          },
        },
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.balance).toBeGreaterThan(0);
      expect(data.data.transactions).toBeDefined();
      expect(Array.isArray(data.data.transactions)).toBe(true);
      expect(data.data.statistics).toBeDefined();
      expect(data.data.statistics.totalCreditsAdded).toBeGreaterThan(0);
    });

    test('should create payment intent', async () => {
      if (!process.env.STRIPE_SECRET_KEY) {
        console.warn('Skipping Stripe test - STRIPE_SECRET_KEY not set');
        return;
      }

      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/billing/payment-intent',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`, // This should be user session token
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: 10, // $10
            currency: 'usd',
          }),
        },
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.clientSecret).toBeDefined();
      expect(data.data.paymentIntentId).toBeDefined();
      expect(data.data.amount).toBe(10);
      expect(data.data.currency).toBe('usd');
    }, 10000);

    test('should validate minimum payment amount', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/billing/payment-intent',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: 2, // Below $5 minimum
          }),
        },
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });
  });

  describe('API Key Management', () => {
    test('should list API keys', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch('http://localhost:3333/api/v1/api-keys', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${testApiKey}`, // This should be user session token
        },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);

      // Should find our test API key
      const testKey = data.data.find(
        (key: any) => key.name === 'Integration Test Key',
      );
      expect(testKey).toBeDefined();
      expect(testKey.keyPrefix).toBeDefined();
      expect(testKey.keyPrefix).not.toContain(testApiKey); // Should be masked
    });

    test('should create new API key', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch('http://localhost:3333/api/v1/api-keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${testApiKey}`, // This should be user session token
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test API Key 2',
          description: 'Another test key',
          permissions: ['inference:openai'],
          rateLimit: 50,
        }),
      });

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.data.id).toBeDefined();
      expect(data.data.name).toBe('Test API Key 2');
      expect(data.data.key).toBeDefined(); // Full key returned only on creation
      expect(data.data.key.startsWith('eliza_')).toBe(true);
      expect(data.data.permissions).toEqual(['inference:openai']);

      // Clean up - delete the created key
      await fetch(`http://localhost:3333/api/v1/api-keys/${data.data.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${testApiKey}`,
        },
      });
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // This test would need a specialized API key with very low rate limits
      // For now, we'll skip it in integration tests
      console.warn('Rate limiting test requires specialized setup - skipping');
    });
  });

  describe('Error Handling', () => {
    test('should handle insufficient credits gracefully', async () => {
      // This would require draining the test account's credits
      // For now, we'll test with a mock scenario
      console.warn(
        'Insufficient credits test requires account setup - skipping',
      );
    });

    test('should handle invalid API key', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/inference/openai',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer invalid_key_123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
          }),
        },
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid or expired API key');
    });

    test('should handle malformed requests', async () => {
      if (!(await checkApiServerAvailable())) {
        console.warn('Skipping HTTP test - API server not available');
        return;
      }
      const response = await fetch(
        'http://localhost:3333/api/v1/inference/openai',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${testApiKey}`,
            'Content-Type': 'application/json',
          },
          body: 'invalid json',
        },
      );

      expect(response.status).toBe(400);
    });
  });
});

// Helper function to create test data
async function createTestData() {
  // This would be implemented based on your database setup
  // Returns organization ID, user ID, etc.
}
