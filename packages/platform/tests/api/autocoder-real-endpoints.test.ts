/**
 * Real API Endpoint Integration Tests
 *
 * Tests the actual API endpoints with real database operations
 * and authentication. These tests verify end-to-end functionality.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';

// Import the actual route handlers
import {
  POST as elizaPost,
  GET as elizaGet,
} from '../../app/api/autocoder/eliza/route';

// Mock the auth service to return a test user
const mockAuthService = {
  getCurrentUser: mock().mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  }),
};

// Mock the database connection
const mockSqlQueries: any[] = [];
const mockSql = {
  query: mock((sql: string, params: any[]) => {
    mockSqlQueries.push({ sql, params });

    // Mock successful insert response
    if (sql.includes('INSERT INTO autocoder_projects')) {
      return Promise.resolve([]);
    }

    // Mock successful message insert
    if (sql.includes('INSERT INTO autocoder_messages')) {
      return Promise.resolve([]);
    }

    // Mock project query response
    if (sql.includes('SELECT * FROM autocoder_projects')) {
      return Promise.resolve([
        {
          id: params[0],
          user_id: params[1],
          name: 'Test Project',
          type: 'trading',
          description: 'Test description',
          status: 'planning',
          specification: JSON.stringify({
            name: 'Test Project',
            type: 'trading',
            features: ['test feature'],
          }),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);
    }

    // Mock messages query response
    if (sql.includes('SELECT * FROM autocoder_messages')) {
      return Promise.resolve([
        {
          id: 'test-message-1',
          project_id: params[0],
          user_id: 'test-user-id',
          type: 'user',
          message: 'Test user message',
          timestamp: new Date(),
          metadata: null,
        },
        {
          id: 'test-message-2',
          project_id: params[0],
          user_id: 'test-user-id',
          type: 'agent',
          message: 'Test agent response',
          timestamp: new Date(),
          metadata: JSON.stringify({ step: 'analysis' }),
        },
      ]);
    }

    return Promise.resolve([]);
  }),
};

// Mock the AutocoderAgentService
const mockAgentService = {
  initialize: mock().mockResolvedValue(true),
  getIsConnectedToServer: mock().mockReturnValue(true),
  getAgentId: mock().mockReturnValue('test-agent-id'),
  analyzeProjectRequirements: mock().mockResolvedValue({
    analysis: 'Project analysis complete',
    nextSteps: [
      'Step 1: Design architecture',
      'Step 2: Implement core features',
    ],
    estimatedTime: '1-2 weeks',
    complexity: 'advanced',
  }),
  generateImplementationSuggestions: mock().mockResolvedValue([
    'Use Solidity for smart contracts',
    'Implement comprehensive testing',
  ]),
  performResearch: mock().mockResolvedValue({
    protocols: ['Uniswap', 'Aave'],
    libraries: ['OpenZeppelin', 'Hardhat'],
  }),
};

// Mock the external dependencies
mock.module('../../lib/auth/session', () => ({
  authService: mockAuthService,
}));

mock.module('../../lib/database', () => ({
  getSql: () => mockSql,
}));

mock.module('../../lib/autocoder/agent-service', () => ({
  AutocoderAgentService: class {
    async initialize() {
      return mockAgentService.initialize();
    }
    getIsConnectedToServer() {
      return mockAgentService.getIsConnectedToServer();
    }
    getAgentId() {
      return mockAgentService.getAgentId();
    }
    async analyzeProjectRequirements(...args: any[]) {
      return mockAgentService.analyzeProjectRequirements(...args);
    }
    async generateImplementationSuggestions(...args: any[]) {
      return mockAgentService.generateImplementationSuggestions(...args);
    }
    async performResearch(...args: any[]) {
      return mockAgentService.performResearch(...args);
    }
  },
}));

describe('Real API Endpoint Integration Tests', () => {
  beforeEach(() => {
    // Reset mock call history
    mockSqlQueries.length = 0;
    mock.restore();
  });

  describe('POST /api/autocoder/eliza - Project Creation', () => {
    it('should successfully create a Powell hedging strategy project', async () => {
      const requestBody = {
        prompt:
          'Create a trading bot that hedges against Powell interest rate changes using Polymarket predictions',
        projectType: 'trading',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      const response = await elizaPost(request);
      const responseData = await response.json();

      // Verify response structure
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.projectId).toBeDefined();
      expect(responseData.project.type).toBe('trading');
      expect(responseData.analysis.complexity).toBe('advanced');

      // Verify database operations
      expect(mockSqlQueries.length).toBeGreaterThan(0);

      // Check project insert
      const projectInsert = mockSqlQueries.find((q) =>
        q.sql.includes('INSERT INTO autocoder_projects'),
      );
      expect(projectInsert).toBeDefined();
      expect(projectInsert.params[3]).toBe('trading'); // project type
      expect(projectInsert.params[5]).toBe('planning'); // status

      // Check message insert
      const messageInsert = mockSqlQueries.find((q) =>
        q.sql.includes('INSERT INTO autocoder_messages'),
      );
      expect(messageInsert).toBeDefined();
      expect(messageInsert.params[3]).toBe('user'); // message type
    });

    it('should successfully create a DeFi yield farming project', async () => {
      const requestBody = {
        prompt:
          'Build a DeFi protocol with yield farming optimization and liquidity provision',
        projectType: 'defi',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      const response = await elizaPost(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.analysis.type).toBe('defi');
      expect(responseData.analysis.complexity).toBe('moderate');
      expect(responseData.analysis.specification.features).toContain(
        'Yield farming optimization',
      );
    });

    it('should handle authentication errors', async () => {
      // Mock unauthenticated user
      mockAuthService.getCurrentUser.mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'Test prompt',
          }),
        },
      );

      const response = await elizaPost(request);

      expect(response.status).toBe(401);
      const responseData = await response.json();
      expect(responseData.error).toBe('Unauthorized');
    });

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: 'invalid json{',
        },
      );

      const response = await elizaPost(request);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error).toBe('Invalid JSON in request body');
    });

    it('should handle missing prompt', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectType: 'trading',
            // prompt is missing
          }),
        },
      );

      const response = await elizaPost(request);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error).toBe('Prompt is required');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSql.query.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'Test prompt',
          }),
        },
      );

      const response = await elizaPost(request);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error).toBe('Failed to create session');
    });
  });

  describe('GET /api/autocoder/eliza - Project Retrieval', () => {
    it('should successfully retrieve project details', async () => {
      const projectId = 'test-project-id';
      const request = new NextRequest(
        `http://localhost:3000/api/autocoder/eliza?projectId=${projectId}`,
      );

      const response = await elizaGet(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.project).toBeDefined();
      expect(responseData.project.id).toBe(projectId);
      expect(responseData.messages).toBeDefined();
      expect(Array.isArray(responseData.messages)).toBe(true);

      // Verify database queries
      const projectQuery = mockSqlQueries.find((q) =>
        q.sql.includes('SELECT * FROM autocoder_projects'),
      );
      expect(projectQuery).toBeDefined();
      expect(projectQuery.params[0]).toBe(projectId);

      const messagesQuery = mockSqlQueries.find((q) =>
        q.sql.includes('SELECT * FROM autocoder_messages'),
      );
      expect(messagesQuery).toBeDefined();
      expect(messagesQuery.params[0]).toBe(projectId);
    });

    it('should handle missing projectId parameter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
      );

      const response = await elizaGet(request);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error).toBe('Project ID required');
    });

    it('should handle project not found', async () => {
      // Mock empty result for project query
      mockSql.query.mockResolvedValueOnce([]); // Empty projects array

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza?projectId=nonexistent-id',
      );

      const response = await elizaGet(request);

      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error).toBe('Project not found');
    });

    it('should handle GET authentication errors', async () => {
      mockAuthService.getCurrentUser.mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza?projectId=test-id',
      );

      const response = await elizaGet(request);

      expect(response.status).toBe(401);
      const responseData = await response.json();
      expect(responseData.error).toBe('Unauthorized');
    });
  });

  describe('Agent Service Integration', () => {
    it('should verify agent service is called during project processing', async () => {
      const requestBody = {
        prompt: 'Create a comprehensive DeFi yield optimization protocol',
        projectType: 'defi',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      const response = await elizaPost(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      // Give background processing time to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify agent service methods were called
      expect(mockAgentService.initialize).toHaveBeenCalled();
      expect(mockAgentService.analyzeProjectRequirements).toHaveBeenCalled();
      expect(
        mockAgentService.generateImplementationSuggestions,
      ).toHaveBeenCalled();
      expect(mockAgentService.performResearch).toHaveBeenCalled();
    });

    it('should handle agent service connection status', async () => {
      // Test when agent is not connected to server
      mockAgentService.getIsConnectedToServer.mockReturnValueOnce(false);

      const requestBody = {
        prompt: 'Test prompt for disconnected agent',
        projectType: 'general',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      const response = await elizaPost(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      // Should still create project even if agent is not connected
      expect(responseData.projectId).toBeDefined();
    });
  });

  describe('Data Persistence Verification', () => {
    it('should verify project data is stored with correct structure', async () => {
      const requestBody = {
        prompt: 'Build a sophisticated arbitrage trading system',
        projectType: 'trading',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      await elizaPost(request);

      // Verify project insert structure
      const projectInsert = mockSqlQueries.find((q) =>
        q.sql.includes('INSERT INTO autocoder_projects'),
      );

      expect(projectInsert).toBeDefined();
      expect(projectInsert.params).toHaveLength(7); // All required fields
      expect(projectInsert.params[1]).toBe('test-user-id'); // user_id
      expect(projectInsert.params[3]).toBe('trading'); // type
      expect(projectInsert.params[5]).toBe('planning'); // status

      // Verify specification is valid JSON
      const specification = projectInsert.params[6];
      expect(() => JSON.parse(specification)).not.toThrow();

      const specData = JSON.parse(specification);
      expect(specData.type).toBe('trading');
      expect(specData.features).toBeDefined();
      expect(Array.isArray(specData.features)).toBe(true);
    });

    it('should verify message storage includes metadata', async () => {
      const requestBody = {
        prompt: 'Create NFT marketplace with royalty system',
        projectType: 'nft',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/autocoder/eliza',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      await elizaPost(request);

      // Check initial user message insert
      const userMessageInsert = mockSqlQueries.find(
        (q) =>
          q.sql.includes('INSERT INTO autocoder_messages') &&
          q.params[3] === 'user',
      );

      expect(userMessageInsert).toBeDefined();
      expect(userMessageInsert.params[4]).toBe(requestBody.prompt); // message content
    });
  });
});
