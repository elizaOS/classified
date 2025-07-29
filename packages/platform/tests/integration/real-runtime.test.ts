/**
 * Real Runtime Integration Tests
 * Tests using actual ElizaOS agent runtime, not mocks
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import {
  Character,
  IAgentRuntime,
  AgentRuntime,
  validateCharacter,
} from '@elizaos/core';
import { StandaloneElizaServer } from '../../scripts/standalone-server.js';
import fetch from 'node-fetch';

// Test character for runtime testing
const TEST_CHARACTER: Character = {
  name: 'TestBot',
  bio: 'A test bot for integration testing',
  system: "You are a test bot. Always respond with 'Hello from test bot!'",
  messageExamples: [],
  plugins: [],
  settings: {
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
  },
};

describe('Real Runtime Integration', () => {
  let agentServer: any;
  let runtime: IAgentRuntime;
  let standaloneServer: StandaloneElizaServer;
  const TEST_PORT = 3002;

  beforeAll(async () => {
    // Set test environment variables
    (process.env as any).NODE_ENV = 'test';
    process.env.POSTGRES_URL =
      process.env.POSTGRES_URL || 'postgresql://localhost:5432/eliza_test';

    console.log('Setting up real AgentServer for testing...');

    // Create and initialize AgentServer
    agentServer = new (AgentRuntime as any)();
    await agentServer.initialize({
      postgresUrl: process.env.POSTGRES_URL,
      dataDir: './.test-elizadb',
    });

    console.log('AgentServer initialized successfully');
  }, 30000);

  afterAll(async () => {
    if (agentServer) {
      await agentServer.stop();
    }
    if (standaloneServer) {
      await standaloneServer.stop();
    }
  });

  describe('AgentServer Core Functionality', () => {
    test('should create and initialize AgentServer', () => {
      expect(agentServer).toBeDefined();
      expect(agentServer.isInitialized).toBe(true);
    });

    test('should validate test character', () => {
      expect(() => validateCharacter(TEST_CHARACTER)).not.toThrow();
    });

    test('should create agent runtime with character', async () => {
      runtime = await (AgentRuntime as any).create({
        character: TEST_CHARACTER,
        databaseAdapter: agentServer.db,
      });

      expect(runtime).toBeDefined();
      expect(runtime.character.name).toBe('TestBot');
      expect(runtime.agentId).toBeDefined();
    });

    test('should register agent with server', async () => {
      await agentServer.registerAgent(runtime);

      // Verify agent is registered
      const agents = Object.keys(agentServer.agents);
      expect(agents).toContain(runtime.agentId);
    });

    test('should create server and channel for agent', async () => {
      const server = await agentServer.createServer({
        name: 'Test Server',
        sourceType: 'test',
        metadata: { test: true },
      });

      expect(server).toBeDefined();
      expect(server.name).toBe('Test Server');

      const channel = await agentServer.createChannel({
        serverId: server.id,
        name: 'Test Channel',
        type: 'GROUP' as any,
      });

      expect(channel).toBeDefined();
      expect(channel.name).toBe('Test Channel');
    });
  });

  describe('Standalone Server Integration', () => {
    beforeEach(() => {
      // Ensure no server is running on test port
      standaloneServer = null as any;
    });

    test('should create StandaloneElizaServer with character', async () => {
      standaloneServer = new StandaloneElizaServer({
        port: TEST_PORT,
        characterJson: TEST_CHARACTER,
      });

      expect(standaloneServer).toBeDefined();
    });

    test('should validate client assets exist', async () => {
      standaloneServer = new StandaloneElizaServer({ port: TEST_PORT });

      // This should not throw if assets are properly copied
      await expect(
        standaloneServer.validateClientAssets(),
      ).resolves.not.toThrow();
    });

    test('should start server and serve API endpoints', async () => {
      standaloneServer = new StandaloneElizaServer({
        port: TEST_PORT,
        characterJson: TEST_CHARACTER,
      });

      // Start server in background
      const startPromise = standaloneServer.start();

      // Wait for server to be ready
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Test API endpoints
      const healthResponse = await fetch(
        `http://localhost:${TEST_PORT}/api/runtime/health`,
      );
      expect(healthResponse.ok).toBe(true);

      const healthData = (await healthResponse.json()) as any;
      expect(healthData.status).toBe('OK');

      const pingResponse = await fetch(
        `http://localhost:${TEST_PORT}/api/runtime/ping`,
      );
      expect(pingResponse.ok).toBe(true);

      const pingData = (await pingResponse.json()) as any;
      expect(pingData.pong).toBe(true);

      // Stop server
      await standaloneServer.stop();
    }, 15000);

    test('should serve client static files', async () => {
      standaloneServer = new StandaloneElizaServer({ port: TEST_PORT });

      // Start server
      await standaloneServer.start();

      // Wait for server to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Test client serving
      const clientResponse = await fetch(
        `http://localhost:${TEST_PORT}/client`,
      );
      expect(clientResponse.ok).toBe(true);

      const clientHtml = await clientResponse.text();
      expect(clientHtml).toContain('<title>ElizaOS Client</title>');
      expect(clientHtml).toContain('<div id="root">');

      // Test asset serving
      const cssResponse = await fetch(
        `http://localhost:${TEST_PORT}/client/assets/index.css`,
      );
      expect(cssResponse.ok).toBe(true);

      // Stop server
      await standaloneServer.stop();
    }, 10000);

    test('should handle SPA routing', async () => {
      standaloneServer = new StandaloneElizaServer({ port: TEST_PORT });

      await standaloneServer.start();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Test SPA route fallback
      const spaResponse = await fetch(
        `http://localhost:${TEST_PORT}/client/some-spa-route`,
      );
      expect(spaResponse.ok).toBe(true);

      const spaHtml = await spaResponse.text();
      expect(spaHtml).toContain('<div id="root">');

      await standaloneServer.stop();
    }, 10000);
  });

  describe('Character Loading and Agent Creation', () => {
    test('should load character from JSON', async () => {
      const loadedCharacter = await agentServer.jsonToCharacter(TEST_CHARACTER);

      expect(loadedCharacter).toBeDefined();
      expect(loadedCharacter.name).toBe('TestBot');
      expect(loadedCharacter.bio).toBe('A test bot for integration testing');
    });

    test('should create agent via API', async () => {
      standaloneServer = new StandaloneElizaServer({ port: TEST_PORT });

      await standaloneServer.start();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create agent via API
      const createResponse = await fetch(
        `http://localhost:${TEST_PORT}/api/agents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            characterJson: TEST_CHARACTER,
          }),
        },
      );

      expect(createResponse.ok).toBe(true);

      const createData = (await createResponse.json()) as any;
      expect(createData.success).toBe(true);
      expect(createData.data.character.name).toBe('TestBot');
      expect(createData.data.id).toBeDefined();

      const agentId = createData.data.id;

      // Start the agent
      const startResponse = await fetch(
        `http://localhost:${TEST_PORT}/api/agents/${agentId}/start`,
        {
          method: 'POST',
        },
      );

      expect(startResponse.ok).toBe(true);

      // List agents to verify it's running
      const listResponse = await fetch(
        `http://localhost:${TEST_PORT}/api/agents`,
      );
      expect(listResponse.ok).toBe(true);

      const listData = (await listResponse.json()) as any;
      expect(listData.success).toBe(true);
      expect(listData.data.agents).toHaveLength(1);
      expect(listData.data.agents[0].character.name).toBe('TestBot');

      await standaloneServer.stop();
    }, 15000);
  });
});
