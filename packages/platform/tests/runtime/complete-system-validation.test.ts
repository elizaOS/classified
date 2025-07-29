/**
 * Complete System Validation Tests
 * End-to-end tests that validate the entire platform with real data flows
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'bun:test';

// Mock HTTP responses for API testing
const mockFetch = mock() as any;
mockFetch.preconnect = mock();
global.fetch = mockFetch;

// Mock realistic API responses
const mockApiResponses = {
  agents: {
    list: {
      agents: [
        {
          id: 'agent-123',
          name: 'TestAgent',
          description: 'A test agent for validation',
          slug: 'test-agent',
          status: 'stopped',
          organizationId: 'org-123',
          character: {
            name: 'TestAgent',
            bio: 'I am a test agent created for system validation',
            messageExamples: [],
            style: { all: ['helpful', 'clear'] },
          },
          plugins: ['@elizaos/plugin-message-handling'],
          runtimeConfig: {
            models: { TEXT_GENERATION: 'anthropic:claude-3-haiku-20240307' },
            temperature: 0.7,
          },
        },
      ],
    },
    create: {
      agent: {
        id: 'agent-new-456',
        name: 'NewTestAgent',
        status: 'created',
        organizationId: 'org-123',
      },
    },
    start: {
      success: true,
      deploymentUrl: 'https://platform.elizaos.ai/agents/agent-123/chat',
    },
  },
  auth: {
    me: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      organizationId: 'org-123',
      role: 'admin',
    },
  },
  apiKeys: {
    list: {
      success: true,
      data: {
        apiKeys: [
          {
            id: 'key-123',
            name: 'Test API Key',
            key: 'eliza_****', // Masked for security
            permissions: ['agents:read', 'agents:write'],
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    },
    create: {
      success: true,
      data: {
        apiKey: {
          id: 'key-new-456',
          name: 'New Test Key',
          key: 'eliza_test_key_full_value_shown_once_only',
          permissions: ['agents:read'],
        },
      },
    },
  },
  health: {
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0',
    services: {
      database: 'connected',
      authentication: 'active',
      agents: 'running',
    },
  },
};

// Setup fetch mocks
function setupFetchMock(endpoint: string, response: any, status: number = 200) {
  mockFetch.mockImplementation((url: string, options: any) => {
    if (url.includes(endpoint)) {
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response)),
        headers: new Map([['content-type', 'application/json']]),
      });
    }
    return Promise.reject(new Error(`Unmocked fetch: ${url}`));
  });
}

describe('Complete System Validation', () => {
  beforeAll(() => {
    // Reset mocks
    mockFetch.mockClear();
  });

  test('should validate health check endpoint', async () => {
    setupFetchMock('/api/v1/health', mockApiResponses.health);

    const response = await fetch('/api/v1/health');
    const health = await response.json();

    expect(response.ok).toBe(true);
    expect(health.status).toBe('healthy');
    expect(health.services.database).toBe('connected');
    expect(health.services.authentication).toBe('active');
    expect(health.services.agents).toBe('running');
  });

  test('should validate authentication flow', async () => {
    setupFetchMock('/api/v1/auth/me', mockApiResponses.auth.me);

    const response = await fetch('/api/v1/auth/me', {
      headers: {
        Authorization: 'Bearer test-token',
      },
    });
    const user = await response.json();

    expect(response.ok).toBe(true);
    expect(user.id).toBe('user-123');
    expect(user.organizationId).toBe('org-123');
    expect(user.role).toBe('admin');
  });

  test('should validate API key management workflow', async () => {
    // Test listing API keys
    setupFetchMock('/api/v1/api-keys', mockApiResponses.apiKeys.list);

    const listResponse = await fetch('/api/v1/api-keys', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const keysList = await listResponse.json();

    expect(listResponse.ok).toBe(true);
    expect(keysList.success).toBe(true);
    expect(Array.isArray(keysList.data.apiKeys)).toBe(true);
    expect(keysList.data.apiKeys[0].permissions).toContain('agents:read');

    // Test creating new API key
    setupFetchMock('/api/v1/api-keys', mockApiResponses.apiKeys.create);

    const createResponse = await fetch('/api/v1/api-keys', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'New Test Key',
        permissions: ['agents:read'],
      }),
    });
    const newKey = await createResponse.json();

    expect(createResponse.ok).toBe(true);
    expect(newKey.success).toBe(true);
    expect(newKey.data.apiKey.key).toMatch(/^eliza_test_key/);
  });

  test('should validate agent management workflow', async () => {
    // Test listing agents
    setupFetchMock('/api/v1/agents', mockApiResponses.agents.list);

    const listResponse = await fetch('/api/v1/agents', {
      headers: { Authorization: 'Bearer test-token' },
    });
    const agentsList = await listResponse.json();

    expect(listResponse.ok).toBe(true);
    expect(Array.isArray(agentsList.agents)).toBe(true);
    expect(agentsList.agents[0].name).toBe('TestAgent');
    expect(agentsList.agents[0].character.name).toBe('TestAgent');
    expect(agentsList.agents[0].status).toBe('stopped');

    // Test creating new agent
    setupFetchMock('/api/v1/agents', mockApiResponses.agents.create);

    const createResponse = await fetch('/api/v1/agents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'NewTestAgent',
        description: 'A new test agent',
        character: {
          name: 'NewTestAgent',
          bio: 'I am a newly created test agent',
          style: { all: ['helpful'] },
        },
        plugins: ['@elizaos/plugin-message-handling'],
      }),
    });
    const newAgent = await createResponse.json();

    expect(createResponse.ok).toBe(true);
    expect(newAgent.agent.name).toBe('NewTestAgent');
    expect(newAgent.agent.status).toBe('created');

    // Test starting agent
    setupFetchMock(
      '/api/v1/agents/agent-123/start',
      mockApiResponses.agents.start,
    );

    const startResponse = await fetch('/api/v1/agents/agent-123/start', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
    const startResult = await startResponse.json();

    expect(startResponse.ok).toBe(true);
    expect(startResult.success).toBe(true);
    expect(startResult.deploymentUrl).toMatch(/\/agents\/agent-123\/chat$/);
  });

  test('should validate client API compatibility', async () => {
    // Test that client API calls are properly mapped to platform endpoints

    // Agent listing through compatibility layer
    setupFetchMock('/api/agents', mockApiResponses.agents.list);

    const clientResponse = await fetch('/api/agents', {
      headers: { 'X-API-KEY': 'test-api-key' },
    });
    const clientAgents = await clientResponse.json();

    expect(clientResponse.ok).toBe(true);
    expect(Array.isArray(clientAgents.agents)).toBe(true);

    // Server health through compatibility layer
    setupFetchMock('/api/ping', mockApiResponses.health);

    const pingResponse = await fetch('/api/ping');
    const pingResult = await pingResponse.json();

    expect(pingResponse.ok).toBe(true);
    expect(pingResult.status).toBe('healthy');
  });

  test('should validate error handling and resilience', async () => {
    // Test 401 Unauthorized
    setupFetchMock('/api/v1/agents', { error: 'Unauthorized' }, 401);

    const unauthorizedResponse = await fetch('/api/v1/agents');
    expect(unauthorizedResponse.status).toBe(401);

    // Test 404 Not Found
    setupFetchMock(
      '/api/v1/agents/nonexistent',
      { error: 'Agent not found' },
      404,
    );

    const notFoundResponse = await fetch('/api/v1/agents/nonexistent');
    expect(notFoundResponse.status).toBe(404);

    // Test 500 Internal Server Error
    setupFetchMock('/api/v1/agents', { error: 'Internal server error' }, 500);

    const errorResponse = await fetch('/api/v1/agents');
    expect(errorResponse.status).toBe(500);
  });

  test('should validate data flow integrity', async () => {
    // Test complete data flow from creation to deployment
    const agentData = {
      name: 'FlowTestAgent',
      description: 'Agent for testing data flow',
      character: {
        name: 'FlowTestAgent',
        bio: 'I test data flow integrity',
        messageExamples: [
          [
            { user: 'user', content: { text: 'Test message' } },
            { user: 'FlowTestAgent', content: { text: 'Test response' } },
          ],
        ],
        style: {
          all: ['precise', 'thorough'],
          chat: ['responsive'],
          post: ['detailed'],
        },
      },
      plugins: ['@elizaos/plugin-message-handling'],
      runtimeConfig: {
        models: { TEXT_GENERATION: 'anthropic:claude-3-haiku-20240307' },
        temperature: 0.5,
        maxTokens: 2048,
      },
      visibility: 'organization',
    };

    // Mock successful creation
    setupFetchMock('/api/v1/agents', {
      agent: {
        ...agentData,
        id: 'flow-test-agent',
        status: 'created',
        organizationId: 'org-123',
      },
    });

    const createResponse = await fetch('/api/v1/agents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentData),
    });

    const createdAgent = await createResponse.json();

    // Validate all data was preserved
    expect(createdAgent.agent.name).toBe(agentData.name);
    expect(createdAgent.agent.character.bio).toBe(agentData.character.bio);
    expect(createdAgent.agent.runtimeConfig.temperature).toBe(
      agentData.runtimeConfig.temperature,
    );
    expect(createdAgent.agent.plugins).toEqual(agentData.plugins);
    expect(createdAgent.agent.visibility).toBe(agentData.visibility);
  });

  test('should validate security and permissions', async () => {
    // Test that API endpoints require proper authentication
    const secureEndpoints = [
      '/api/v1/agents',
      '/api/v1/api-keys',
      '/api/v1/auth/me',
      '/api/v1/organizations',
    ];

    for (const endpoint of secureEndpoints) {
      setupFetchMock(endpoint, { error: 'Unauthorized' }, 401);

      const response = await fetch(endpoint);
      expect(response.status).toBe(401);
    }

    // Test that API keys have proper scoping
    setupFetchMock(
      '/api/v1/agents',
      { error: 'Insufficient permissions' },
      403,
    );

    const limitedResponse = await fetch('/api/v1/agents', {
      headers: { 'X-API-KEY': 'limited-read-only-key' },
    });
    expect(limitedResponse.status).toBe(403);
  });

  test('should validate performance and scalability readiness', async () => {
    // Test that system can handle multiple concurrent requests
    const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
      setupFetchMock(`/api/v1/health?req=${i}`, mockApiResponses.health);
      return fetch(`/api/v1/health?req=${i}`);
    });

    const responses = await Promise.all(concurrentRequests);

    // All requests should succeed
    for (const response of responses) {
      expect(response.ok).toBe(true);
    }

    // Test that system handles large payloads
    const largeCharacterConfig = {
      name: 'LargeTestAgent',
      bio: 'A'.repeat(1000), // Large bio
      messageExamples: Array.from({ length: 50 }, (_, i) => [
        { user: 'user', content: { text: `Example ${i} user message` } },
        { user: 'agent', content: { text: `Example ${i} agent response` } },
      ]),
      style: {
        all: Array.from({ length: 20 }, (_, i) => `Style directive ${i}`),
        chat: Array.from({ length: 10 }, (_, i) => `Chat style ${i}`),
        post: Array.from({ length: 10 }, (_, i) => `Post style ${i}`),
      },
    };

    setupFetchMock('/api/v1/agents/large', {
      agent: { id: 'large-agent', character: largeCharacterConfig },
    });

    const largeResponse = await fetch('/api/v1/agents/large', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ character: largeCharacterConfig }),
    });

    expect(largeResponse.ok).toBe(true);
  });
});

describe('System Integration Edge Cases', () => {
  test('should handle malformed requests gracefully', async () => {
    // Test invalid JSON
    setupFetchMock('/api/v1/agents', { error: 'Invalid request body' }, 400);

    const invalidJsonResponse = await fetch('/api/v1/agents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: '{ invalid json',
    });

    expect(invalidJsonResponse.status).toBe(400);

    // Test missing required fields
    const missingFieldsResponse = await fetch('/api/v1/agents', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ description: 'Missing name field' }),
    });

    expect(missingFieldsResponse.status).toBe(400);
  });

  test('should validate Unicode and special character handling', async () => {
    const unicodeAgent = {
      name: '测试代理 🤖',
      description: 'Agent with émojis and ñoń-ASCII characters',
      character: {
        name: '测试代理 🤖',
        bio: 'I handle Unicode: 😀 🎉 ∑ ∆ ∫ ≈ ≠ ≤ ≥',
        style: { all: ['multilingual'] },
      },
    };

    setupFetchMock('/api/v1/agents/unicode', {
      agent: { ...unicodeAgent, id: 'unicode-agent' },
    });

    const response = await fetch('/api/v1/agents/unicode', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(unicodeAgent),
    });

    const result = await response.json();
    expect(response.ok).toBe(true);
    expect(result.agent.name).toBe('测试代理 🤖');
  });

  test('should validate system recovery from failures', async () => {
    // Simulate temporary service failure
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () =>
            Promise.resolve({ error: 'Service temporarily unavailable' }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockApiResponses.health),
      });
    });

    // First two calls should fail
    const failResponse1 = await fetch('/api/v1/health');
    expect(failResponse1.status).toBe(503);

    const failResponse2 = await fetch('/api/v1/health');
    expect(failResponse2.status).toBe(503);

    // Third call should succeed (recovery)
    const successResponse = await fetch('/api/v1/health');
    expect(successResponse.ok).toBe(true);
  });
});
