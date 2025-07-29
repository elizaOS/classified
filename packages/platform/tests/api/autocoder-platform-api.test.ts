/**
 * Platform Back API Autocoder Scenario Tests
 *
 * This test suite validates the autocoder functionality through the platform's
 * HTTP API, testing the complete workflow from project creation to error handling.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  mock,
} from 'bun:test';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

// Mock crypto.randomUUID for testing environments that might not have it
const mockRandomUUID = mock(() => 'test-uuid-12345');

// Import the API route handlers
import {
  POST as elizaPost,
  GET as elizaGet,
} from '../../app/api/autocoder/eliza/route';

// Mock the database adapter factory
jest.mock('../../lib/database/adapters/factory', () => {
  const mockDatabaseClient = {
    query: jest.fn().mockResolvedValue([
      {
        id: 'test-project-id',
        user_id: 'test-user-id',
        name: 'Test Project',
        type: 'defi',
        description: 'Test project description',
        status: 'planning',
        specification: JSON.stringify({
          features: ['test feature'],
          requirements: ['test requirement'],
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),
  };

  const mockDatabaseAdapter = {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockReturnValue(true),
    getDatabase: jest.fn().mockReturnValue(mockDatabaseClient),
    getSqlClient: jest.fn().mockReturnValue(mockDatabaseClient),
    healthCheck: jest.fn().mockResolvedValue({ isHealthy: true }),
    runMigrations: jest.fn().mockResolvedValue(true),
    engine: 'pglite',
    isCloud: false,
  };

  return {
    getDatabaseAdapter: jest.fn().mockReturnValue(mockDatabaseAdapter),
    createDatabaseAdapter: jest.fn().mockReturnValue(mockDatabaseAdapter),
    resetDatabaseAdapter: jest.fn(),
  };
});

// Mock the database module
jest.mock('../../lib/database', () => {
  const mockDatabaseClient = {
    query: jest.fn().mockResolvedValue([
      {
        id: 'test-project-id',
        user_id: 'test-user-id',
        name: 'Test Project',
        type: 'defi',
        description: 'Test project description',
        status: 'planning',
        specification: JSON.stringify({
          features: ['test feature'],
          requirements: ['test requirement'],
        }),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),
  };

  return {
    getDatabase: jest.fn().mockResolvedValue(mockDatabaseClient),
    getSql: jest.fn().mockReturnValue(mockDatabaseClient),
    closeDatabase: jest.fn().mockResolvedValue(true),
    testConnection: jest.fn().mockResolvedValue(true),
    getDatabaseHealth: jest.fn().mockResolvedValue({ isHealthy: true }),
    initializeDatabase: jest.fn().mockResolvedValue(true),
    db: mockDatabaseClient,
    schema: {},
  };
});

jest.mock('../../lib/auth/session', () => ({
  authService: {
    getCurrentUser: jest.fn().mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    }),
  },
}));

// Mock the route wrapper to simply pass through handlers
jest.mock('../../lib/api/route-wrapper', () => ({
  wrapHandlers: jest.fn((handlers) => {
    // Return the handlers directly without any wrapping for testing
    return {
      GET: handlers.handleGET,
      POST: handlers.handlePOST,
    };
  }),
}));

// Mock the AutocoderAgentService
jest.mock('../../lib/autocoder/agent-service', () => ({
  AutocoderAgentService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    getAgentId: jest.fn().mockReturnValue('test-agent-id'),
    getIsConnectedToServer: jest.fn().mockReturnValue(false),
    analyzeProjectRequirements: jest.fn().mockResolvedValue({
      analysis: 'This is a test analysis of the DeFi project requirements.',
      nextSteps: [
        'Research existing DeFi protocols',
        'Design smart contract architecture',
        'Implement core yield farming logic',
        'Add security features and testing',
      ],
      estimatedTime: '3-5 days',
      complexity: 'moderate',
    }),
    generateImplementationSuggestions: jest
      .fn()
      .mockResolvedValue([
        'Use OpenZeppelin contracts for security',
        'Implement Chainlink oracles for price feeds',
        'Add comprehensive unit tests',
        'Consider gas optimization strategies',
      ]),
    performResearch: jest.fn().mockResolvedValue({
      protocols: ['Aave', 'Compound', 'Uniswap'],
      bestPractices: ['Security audits', 'Gas optimization', 'Testing'],
      risks: ['Smart contract vulnerabilities', 'Market volatility'],
      recommendations: [
        'Use established protocols',
        'Implement proper testing',
      ],
    }),
  })),
}));

describe('Platform Back API Autocoder Scenario Tests', () => {
  let testUserId: string;
  let testProjectId: string;

  beforeAll(async () => {
    // Set up required environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET =
      'test-jwt-secret-that-is-at-least-32-characters-long-for-testing-purposes';
    process.env.WORKOS_API_KEY = 'test-workos-api-key';
    process.env.WORKOS_CLIENT_ID = 'test-workos-client-id';
    process.env.DATABASE_URL = 'pglite://./test-data/test.db';

    // Use fake timers to control setTimeout calls
    jest.useFakeTimers();

    testUserId = randomUUID();
    testProjectId = randomUUID();
  });

  afterAll(async () => {
    // Restore real timers
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(async () => {
    // Clear any pending timers to prevent async warnings
    jest.clearAllTimers();
    jest.runOnlyPendingTimers();
  });

  describe('HTTP API Endpoints', () => {
    describe('POST /api/autocoder/eliza - Create Eliza Session', () => {
      it('should create a new autocoder project session successfully', async () => {
        console.log('🧪 Testing Eliza session creation via HTTP API...');

        const requestBody = {
          prompt:
            'Create a DeFi yield farming protocol with automatic rebalancing',
          projectType: 'defi',
        };

        // Create NextRequest for testing
        const request = new Request(
          'http://localhost:3333/api/autocoder/eliza',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
        );
        const nextRequest = new NextRequest(request);

        const response = await elizaPost(nextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.projectId).toBeDefined();
        expect(responseData.project).toBeDefined();
        expect(responseData.project.name).toContain('DeFi');
        expect(responseData.project.type).toBe('defi');
        expect(responseData.analysis).toBeDefined();

        console.log('✅ HTTP Eliza session creation successful');
        console.log(`Project ID: ${responseData.projectId}`);
        console.log(`Project Name: ${responseData.project.name}`);
      });

      it('should handle Powell hedging strategy requests', async () => {
        console.log('🧪 Testing Powell hedging strategy via HTTP API...');

        const requestBody = {
          prompt:
            'Build a Powell interest rate hedging strategy using Polymarket predictions and Bitcoin shorting',
          projectType: 'trading',
        };

        const request = new Request(
          'http://localhost:3333/api/autocoder/eliza',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
        );
        const nextRequest = new NextRequest(request);

        const response = await elizaPost(nextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.project.name).toBe('Powell Hedging Strategy');
        expect(responseData.project.type).toBe('trading');
        expect(responseData.analysis.complexity).toBe('advanced');
        expect(responseData.analysis.deploymentTarget).toBe('multi-chain');

        console.log('✅ Powell hedging strategy creation successful');
        console.log(
          `Analysis: ${JSON.stringify(responseData.analysis, null, 2)}`,
        );
      });

      it('should validate required prompt field', async () => {
        console.log('🧪 Testing validation for missing prompt...');

        const requestBody = {}; // Missing prompt

        const request = new Request(
          'http://localhost:3333/api/autocoder/eliza',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          },
        );
        const nextRequest = new NextRequest(request);

        const response = await elizaPost(nextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(400);
        expect(responseData.error).toBe('Prompt is required');

        console.log('✅ Validation works correctly for missing prompt');
      });

      it('should handle different project types correctly', async () => {
        console.log('🧪 Testing different project type detection...');

        const testCases = [
          {
            prompt: 'Build a DAO governance system with voting mechanisms',
            expectedType: 'dao',
            expectedComplexity: 'advanced',
          },
          {
            prompt: 'Create an NFT marketplace with royalty distribution',
            expectedType: 'nft',
            expectedComplexity: 'moderate',
          },
          {
            prompt:
              'Develop a trading bot for monitoring cryptocurrency prices',
            expectedType: 'trading',
            expectedComplexity: 'moderate',
          },
        ];

        for (const testCase of testCases) {
          console.log(`  Testing: ${testCase.prompt}`);

          const request = new Request(
            'http://localhost:3333/api/autocoder/eliza',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ prompt: testCase.prompt }),
            },
          );
          const nextRequest = new NextRequest(request);

          const response = await elizaPost(nextRequest);
          const responseData = await response.json();

          expect(response.status).toBe(200);
          expect(responseData.project.type).toBe(testCase.expectedType);
          expect(responseData.analysis.complexity).toBe(
            testCase.expectedComplexity,
          );

          console.log(
            `  ✅ Type: ${responseData.project.type}, Complexity: ${responseData.analysis.complexity}`,
          );
        }
      });
    });

    describe('GET /api/autocoder/eliza - Retrieve Session Data', () => {
      it('should retrieve project and messages for valid project ID', async () => {
        console.log('🧪 Testing session data retrieval via HTTP API...');

        const url = new URL('http://localhost:3333/api/autocoder/eliza');
        url.searchParams.set('projectId', testProjectId);

        const request = new Request(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const nextRequest = new NextRequest(request);

        const response = await elizaGet(nextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.project).toBeDefined();
        expect(responseData.messages).toBeDefined();
        expect(Array.isArray(responseData.messages)).toBe(true);

        console.log('✅ Session data retrieval successful');
        console.log(`Messages count: ${responseData.messages.length}`);
      });

      it('should return 400 for missing project ID', async () => {
        console.log('🧪 Testing validation for missing project ID...');

        const request = new Request(
          'http://localhost:3333/api/autocoder/eliza',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        const nextRequest = new NextRequest(request);

        const response = await elizaGet(nextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(400);
        expect(responseData.error).toBe('Project ID required');

        console.log('✅ Project ID validation works correctly');
      });
    });
  });

  describe('API Response Validation', () => {
    it('should return properly structured project responses', async () => {
      console.log('🧪 Testing API response structure...');

      const requestBody = {
        prompt: 'Create a simple DeFi staking protocol',
        projectType: 'defi',
      };

      const request = new Request('http://localhost:3333/api/autocoder/eliza', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const nextRequest = new NextRequest(request);

      const response = await elizaPost(nextRequest);
      const responseData = await response.json();

      // Validate response structure
      expect(responseData).toHaveProperty('success');
      expect(responseData).toHaveProperty('projectId');
      expect(responseData).toHaveProperty('project');
      expect(responseData).toHaveProperty('analysis');

      // Validate project structure
      expect(responseData.project).toHaveProperty('id');
      expect(responseData.project).toHaveProperty('name');
      expect(responseData.project).toHaveProperty('type');
      expect(responseData.project).toHaveProperty('description');

      // Validate analysis structure
      expect(responseData.analysis).toHaveProperty('complexity');
      expect(responseData.analysis).toHaveProperty('specification');
      expect(responseData.analysis).toHaveProperty('deploymentTarget');

      console.log('✅ API response structure validation successful');
    });

    it('should handle edge cases in project analysis', async () => {
      console.log('🧪 Testing edge cases in project analysis...');

      const edgeCases = [
        {
          prompt: 'a',
          description: 'Single character prompt',
        },
        {
          prompt:
            'Create a very long and complex multi-chain cross-protocol interoperability solution for decentralized finance that bridges multiple Layer 1 and Layer 2 networks while maintaining security and gas optimization',
          description: 'Very long prompt',
        },
        {
          prompt: 'Build something with 🚀 emojis and special chars: @#$%^&*()',
          description: 'Special characters and emojis',
        },
      ];

      for (const testCase of edgeCases) {
        console.log(`  Testing: ${testCase.description}`);

        const request = new Request(
          'http://localhost:3333/api/autocoder/eliza',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: testCase.prompt }),
          },
        );
        const nextRequest = new NextRequest(request);

        const response = await elizaPost(nextRequest);
        const responseData = await response.json();

        expect(response.status).toBe(200);
        expect(responseData.success).toBe(true);
        expect(responseData.project.name).toBeDefined();
        expect(responseData.project.type).toBeDefined();

        console.log(`  ✅ ${testCase.description} handled successfully`);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      console.log('🧪 Testing malformed JSON handling...');

      const request = new Request('http://localhost:3333/api/autocoder/eliza', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json {',
      });
      const nextRequest = new NextRequest(request);

      const response = await elizaPost(nextRequest);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid JSON in request body');

      console.log('✅ Malformed JSON handled correctly');
    });

    it('should handle missing content-type', async () => {
      console.log('🧪 Testing missing content-type handling...');

      const request = new Request('http://localhost:3333/api/autocoder/eliza', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test' }),
      });
      const nextRequest = new NextRequest(request);

      const response = await elizaPost(nextRequest);

      // Should still work or provide appropriate error
      expect([200, 400, 415]).toContain(response.status);

      console.log('✅ Missing content-type handled correctly');
    });
  });
});
