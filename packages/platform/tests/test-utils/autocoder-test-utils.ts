/**
 * Autocoder Test Utilities
 *
 * Shared utilities and helpers for testing autocoder functionality
 * across different test suites in the platform.
 */

import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import { expect } from 'bun:test';

export interface TestProject {
  id: string;
  name: string;
  type: 'defi' | 'trading' | 'dao' | 'nft' | 'general';
  description: string;
  status:
    | 'planning'
    | 'analyzed'
    | 'implementing'
    | 'testing'
    | 'completed'
    | 'failed';
  userId: string;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export interface WebSocketTestClient {
  ws: WebSocket;
  userId: string;
  clientId?: string;
  subscribedProjects: Set<string>;
  receivedMessages: any[];
}

/**
 * Creates a test project with default values
 */
export function createTestProject(
  overrides: Partial<TestProject> = {},
): TestProject {
  return {
    id: randomUUID(),
    name: 'Test DeFi Protocol',
    type: 'defi',
    description: 'Test project for autocoder functionality',
    status: 'planning',
    userId: randomUUID(),
    ...overrides,
  };
}

/**
 * Creates a test user with default values
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: randomUUID(),
    email: 'test@example.com',
    name: 'Test User',
    ...overrides,
  };
}

/**
 * Creates a mock HTTP request for testing API endpoints
 */
export function createMockRequest(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  headers: Record<string, string> = {},
): Request {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  return new Request(url, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Creates a WebSocket test client with helper methods
 */
export function createWebSocketTestClient(
  wsUrl: string,
  userId: string = randomUUID(),
): Promise<WebSocketTestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsUrl}?userId=${userId}`);

    const client: WebSocketTestClient = {
      ws,
      userId,
      subscribedProjects: new Set(),
      receivedMessages: [],
    };

    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        client.receivedMessages.push(message);

        if (message.type === 'CONNECTION_ESTABLISHED') {
          client.clientId = message.data.clientId;
          resolve(client);
        }
      } catch (error) {
        reject(error);
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Helper to wait for a specific WebSocket message type
 */
export function waitForWebSocketMessage(
  client: WebSocketTestClient,
  messageType: string,
  timeout: number = 5000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    // Check if message already received
    const existingMessage = client.receivedMessages.find(
      (msg) => msg.type === messageType,
    );
    if (existingMessage) {
      resolve(existingMessage);
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${messageType}`));
    }, timeout);

    const messageHandler = (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === messageType) {
          clearTimeout(timeoutId);
          client.ws.off('message', messageHandler);
          resolve(message);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        client.ws.off('message', messageHandler);
        reject(error);
      }
    };

    client.ws.on('message', messageHandler);
  });
}

/**
 * Helper to subscribe a client to a project and wait for confirmation
 */
export async function subscribeToProject(
  client: WebSocketTestClient,
  projectId: string,
): Promise<void> {
  client.ws.send(
    JSON.stringify({
      type: 'SUBSCRIBE_PROJECT',
      projectId,
    }),
  );

  await waitForWebSocketMessage(client, 'SUBSCRIBED');
  client.subscribedProjects.add(projectId);
}

/**
 * Helper to send an agent message and wait for processing
 */
export async function sendAgentMessage(
  client: WebSocketTestClient,
  projectId: string,
  message: string,
): Promise<any> {
  client.ws.send(
    JSON.stringify({
      type: 'AGENT_MESSAGE',
      projectId,
      message,
    }),
  );

  // Wait for user message echo
  await waitForWebSocketMessage(client, 'USER_MESSAGE');

  // Optionally wait for agent response
  try {
    return await waitForWebSocketMessage(client, 'AGENT_MESSAGE', 3000);
  } catch (error) {
    // Agent response might not come immediately
    return null;
  }
}

/**
 * Test data generators for different project types
 */
export const testProjectTemplates = {
  defi: {
    prompt:
      'Create a DeFi yield farming protocol with automatic rebalancing and risk management',
    expectedType: 'defi',
    expectedComplexity: 'moderate',
    expectedFeatures: [
      'yield farming',
      'automatic rebalancing',
      'risk management',
    ],
  },

  trading: {
    prompt:
      'Build a trading bot that monitors cryptocurrency prices and executes automated trades',
    expectedType: 'trading',
    expectedComplexity: 'moderate',
    expectedFeatures: ['price monitoring', 'automated trading'],
  },

  powellHedging: {
    prompt:
      'Build a Powell interest rate hedging strategy using Polymarket predictions and Bitcoin shorting',
    expectedType: 'trading',
    expectedComplexity: 'advanced',
    expectedFeatures: [
      'Polymarket prediction market integration',
      'Bitcoin shorting mechanism',
    ],
    expectedName: 'Powell Hedging Strategy',
  },

  dao: {
    prompt:
      'Create a DAO governance system with voting mechanisms and treasury management',
    expectedType: 'dao',
    expectedComplexity: 'advanced',
    expectedFeatures: ['voting mechanisms', 'treasury management'],
  },

  nft: {
    prompt:
      'Develop an NFT marketplace with royalty distribution and collection management',
    expectedType: 'nft',
    expectedComplexity: 'moderate',
    expectedFeatures: ['marketplace functionality', 'royalty distribution'],
  },
};

/**
 * Mock database responses for testing
 */
export const mockDatabaseResponses = {
  createProject: (
    projectId: string,
    userId: string,
    name: string,
    type: string,
    description: string,
  ) => [
    {
      id: projectId,
      user_id: userId,
      name,
      type,
      description,
      status: 'planning',
      specification: JSON.stringify({
        features: ['test feature'],
        requirements: ['test requirement'],
        timeline: '3-5 days',
      }),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ],

  getProject: (projectId: string, userId: string) => [
    {
      id: projectId,
      user_id: userId,
      name: 'Test Project',
      type: 'defi',
      description: 'Test project description',
      status: 'planning',
      specification: JSON.stringify({
        features: ['yield farming', 'risk management'],
        requirements: ['smart contracts', 'testing'],
      }),
      created_at: new Date(),
      updated_at: new Date(),
    },
  ],

  getMessages: (projectId: string) => [
    {
      id: randomUUID(),
      project_id: projectId,
      user_id: 'test-user-id',
      type: 'user',
      message: 'Create a DeFi protocol',
      timestamp: new Date(),
      metadata: JSON.stringify({ source: 'api' }),
    },
    {
      id: randomUUID(),
      project_id: projectId,
      user_id: 'test-user-id',
      type: 'agent',
      message: "I'll help you create a DeFi protocol...",
      timestamp: new Date(),
      metadata: JSON.stringify({ agentId: 'test-agent-id' }),
    },
  ],
};

/**
 * Test assertion helpers
 */
export class AutocoderTestAssertions {
  static expectValidProjectResponse(response: any): void {
    expect(response.success).toBe(true);
    expect(response.projectId).toBeDefined();
    expect(response.project).toBeDefined();
    expect(response.project.id).toBeDefined();
    expect(response.project.name).toBeDefined();
    expect(response.project.type).toBeDefined();
    expect(response.analysis).toBeDefined();
  }

  static expectValidWebSocketMessage(message: any, expectedType: string): void {
    expect(message).toBeDefined();
    expect(message.type).toBe(expectedType);
    expect(message.timestamp || message.data?.timestamp).toBeDefined();
  }

  static expectValidAgentResponse(response: any): void {
    expect(response.analysis).toBeDefined();
    expect(response.nextSteps).toBeDefined();
    expect(Array.isArray(response.nextSteps)).toBe(true);
    expect(response.estimatedTime).toBeDefined();
    expect(response.complexity).toBeDefined();
  }

  static expectProjectTypeAnalysis(
    analysis: any,
    expectedType: string,
    expectedComplexity: string,
  ): void {
    expect(analysis.type).toBe(expectedType);
    expect(analysis.complexity).toBe(expectedComplexity);
    expect(analysis.specification).toBeDefined();
    expect(analysis.specification.features).toBeDefined();
    expect(Array.isArray(analysis.specification.features)).toBe(true);
  }
}

/**
 * Clean up helper for tests
 */
export async function cleanupWebSocketClients(
  clients: WebSocketTestClient[],
): Promise<void> {
  const closePromises = clients.map((client) => {
    return new Promise<void>((resolve) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.on('close', () => resolve());
        client.ws.close();
      } else {
        resolve();
      }
    });
  });

  await Promise.all(closePromises);
}

/**
 * Performance measurement helpers
 */
export class PerformanceMetrics {
  private startTime: number = 0;
  private measurements: Map<string, number> = new Map();

  start(): void {
    this.startTime = Date.now();
  }

  mark(label: string): void {
    const elapsed = Date.now() - this.startTime;
    this.measurements.set(label, elapsed);
  }

  get(label: string): number | undefined {
    return this.measurements.get(label);
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.measurements);
  }

  reset(): void {
    this.startTime = 0;
    this.measurements.clear();
  }
}

export default {
  createTestProject,
  createTestUser,
  createMockRequest,
  createWebSocketTestClient,
  waitForWebSocketMessage,
  subscribeToProject,
  sendAgentMessage,
  testProjectTemplates,
  mockDatabaseResponses,
  AutocoderTestAssertions,
  cleanupWebSocketClients,
  PerformanceMetrics,
};
