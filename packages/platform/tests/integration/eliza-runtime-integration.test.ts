/**
 * Real ElizaOS Runtime Integration Tests
 *
 * These tests validate that the platform actually works with real ElizaOS agents
 * instead of using mocks. This ensures our database adapter and runtime integration
 * are functional.
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import { IAgentRuntime, Memory, UUID, Content } from '@elizaos/core';
import { createTestRuntime } from '@elizaos/core/test-utils';
import { ElizaRuntimeService } from '../../lib/runtime/eliza-service';
import { testCharacterConfig } from '../fixtures/test-character';
import {
  cleanupTestDatabase,
  createTestOrganization,
} from '../test-utils/database';

describe('ElizaOS Platform Runtime Integration', () => {
  let elizaService: ElizaRuntimeService;
  let testOrgId: string;
  let testUserId: string;
  let agentRuntime: IAgentRuntime;
  let agentId: UUID;

  beforeAll(async () => {
    // Create test organization and user
    const testOrg = await createTestOrganization('runtime-test-org');
    testOrgId = testOrg.organizationId;
    testUserId = testOrg.userId;

    elizaService = new ElizaRuntimeService();
  });

  afterAll(async () => {
    // Cleanup test data
    if (agentId) {
      await elizaService.stopAgent(agentId);
    }
    await cleanupTestDatabase(testOrgId);
  });

  beforeEach(() => {
    // Reset for each test
    agentId = '' as UUID;
  });

  test('should create and deploy a real ElizaOS agent', async () => {
    // Deploy a real agent with our character config
    const deployedAgentId = await elizaService.deployAgent({
      character: testCharacterConfig,
      organizationId: testOrgId,
      userId: testUserId,
    });

    expect(deployedAgentId).toBeDefined();

    const agentInfo = elizaService.getAgent(deployedAgentId);
    const runtime = agentInfo?.runtime;

    expect(runtime).toBeDefined();
    expect(agentInfo?.status).toBe('running');
    expect(agentInfo?.organizationId).toBe(testOrgId);

    agentId = deployedAgentId;
    agentRuntime = runtime!;
  });

  test('should store and retrieve memories in real database', async () => {
    // Deploy agent first
    const deployedAgentId = await elizaService.deployAgent({
      character: testCharacterConfig,
      organizationId: testOrgId,
      userId: testUserId,
    });
    agentId = deployedAgentId;
    agentRuntime = elizaService.getAgent(deployedAgentId)?.runtime!;

    // Create a test memory
    const testMemory: Memory = {
      id: crypto.randomUUID() as UUID,
      agentId: agentId as UUID,
      entityId: testUserId as UUID,
      roomId: crypto.randomUUID() as UUID,
      content: {
        text: 'This is a test conversation memory',
        thought: 'Testing memory storage functionality',
      },
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5], // Test embedding
      unique: false,
    };

    // Store memory using the agent's database adapter
    await agentRuntime.createMemory(testMemory, 'memories');

    // Retrieve memories and verify they were stored
    const retrievedMemories = await agentRuntime.getMemories({
      roomId: testMemory.roomId,
      count: 10,
      tableName: 'memories',
    });

    expect(retrievedMemories).toBeDefined();
    expect(retrievedMemories.length).toBeGreaterThan(0);

    const foundMemory = retrievedMemories.find(
      (m) => m.content.text === testMemory.content.text,
    );
    expect(foundMemory).toBeDefined();
    expect(foundMemory?.content.thought).toBe(testMemory.content.thought);
    expect(foundMemory?.agentId).toBe(agentId);
  });

  test('should process messages with real runtime and create conversation history', async () => {
    // Deploy agent first
    const deployedAgentId = await elizaService.deployAgent({
      character: testCharacterConfig,
      organizationId: testOrgId,
      userId: testUserId,
    });
    agentId = deployedAgentId;
    agentRuntime = elizaService.getAgent(deployedAgentId)?.runtime!;

    const roomId = crypto.randomUUID() as UUID;

    // Create a test message
    const testMessage: Memory = {
      id: crypto.randomUUID() as UUID,
      agentId: agentId as UUID,
      entityId: testUserId as UUID,
      roomId,
      content: {
        text: 'Hello, how are you today?',
        source: 'user',
      },
      unique: false,
    };

    // Process the message through the real runtime
    await agentRuntime.createMemory(testMessage, 'messages');

    // Compose state and process message
    const state = await agentRuntime.composeState(testMessage);
    expect(state).toBeDefined();
    expect(state.agentId).toBe(agentId);

    // Verify conversation history is created
    const conversationHistory = await agentRuntime.getMemories({
      roomId,
      count: 10,
      tableName: 'memories',
    });

    expect(conversationHistory).toBeDefined();
    expect(conversationHistory.length).toBeGreaterThan(0);

    const userMessage = conversationHistory.find(
      (m) => m.content.text === 'Hello, how are you today?',
    );
    expect(userMessage).toBeDefined();
    expect(userMessage?.roomId).toBe(roomId);
  });

  test('should search memories with semantic similarity', async () => {
    // Deploy agent first
    const deployedAgentId = await elizaService.deployAgent({
      character: testCharacterConfig,
      organizationId: testOrgId,
      userId: testUserId,
    });
    agentId = deployedAgentId;
    agentRuntime = elizaService.getAgent(deployedAgentId)?.runtime!;

    const roomId = crypto.randomUUID() as UUID;

    // Create multiple test memories with different content
    const memories = [
      {
        content: { text: 'I love programming and coding' },
        embedding: [0.8, 0.2, 0.1, 0.9, 0.3],
      },
      {
        content: { text: 'The weather is nice today' },
        embedding: [0.1, 0.9, 0.8, 0.2, 0.4],
      },
      {
        content: { text: 'Software development is interesting' },
        embedding: [0.7, 0.3, 0.2, 0.8, 0.4],
      },
    ];

    // Store all memories
    for (const memoryData of memories) {
      const testMemory: Memory = {
        id: crypto.randomUUID() as UUID,
        agentId: agentId as UUID,
        entityId: testUserId as UUID,
        roomId,
        content: memoryData.content,
        embedding: memoryData.embedding,
        unique: false,
      };
      await agentRuntime.createMemory(testMemory, 'memories');
    }

    // Search for programming-related memories
    const searchResults = await agentRuntime.searchMemories({
      embedding: [0.8, 0.2, 0.1, 0.9, 0.3], // Similar to programming memory
      roomId,
      match_threshold: 0.1,
      count: 5,
      tableName: 'memories',
    });

    expect(searchResults).toBeDefined();
    expect(searchResults.length).toBeGreaterThan(0);

    // Should find memories related to programming
    const foundProgrammingMemory = searchResults.find(
      (m) =>
        m.content.text?.includes('programming') ||
        m.content.text?.includes('development'),
    );
    expect(foundProgrammingMemory).toBeDefined();
  });

  test('should maintain data isolation between organizations', async () => {
    // Create a second test organization
    const testOrg2 = await createTestOrganization('runtime-test-org-2');

    // Deploy agents in both organizations
    const agentId1 = await elizaService.deployAgent({
      character: { ...testCharacterConfig, name: 'Agent 1' },
      organizationId: testOrgId,
      userId: testUserId,
    });

    const agentId2 = await elizaService.deployAgent({
      character: { ...testCharacterConfig, name: 'Agent 2' },
      organizationId: testOrg2.organizationId,
      userId: testOrg2.userId,
    });

    const runtime1 = elizaService.getAgent(agentId1)?.runtime!;
    const runtime2 = elizaService.getAgent(agentId2)?.runtime!;

    const roomId = crypto.randomUUID() as UUID;

    // Create memory in first organization
    const memory1: Memory = {
      id: crypto.randomUUID() as UUID,
      agentId: agentId1 as UUID,
      entityId: testUserId as UUID,
      roomId,
      content: { text: 'Org 1 secret data' },
      unique: false,
    };

    await runtime1.createMemory(memory1, 'memories');

    // Try to access from second organization (should be isolated)
    const org2Memories = await runtime2.getMemories({
      roomId,
      count: 10,
      tableName: 'memories',
    });

    // Should not find memories from other organization
    const foundSecretData = org2Memories.find(
      (m: Memory) => m.content.text === 'Org 1 secret data',
    );
    expect(foundSecretData).toBeUndefined();

    // Cleanup
    await elizaService.stopAgent(agentId1);
    await elizaService.stopAgent(agentId2);
    await cleanupTestDatabase(testOrg2.organizationId);
  });

  test('should handle agent lifecycle properly', async () => {
    // Deploy agent
    const deployedAgentId = await elizaService.deployAgent({
      character: testCharacterConfig,
      organizationId: testOrgId,
      userId: testUserId,
    });
    agentId = deployedAgentId;

    // Verify agent is running
    const agentInfo = elizaService.getAgent(deployedAgentId);
    const runtime = elizaService.getAgent(deployedAgentId)?.runtime;

    expect(agentInfo?.status).toBe('running');
    expect(runtime).toBeDefined();

    // Get agent stats
    const stats = await elizaService.getAgentStats(deployedAgentId);
    expect(stats).toBeDefined();
    expect(stats!.uptime).toBeGreaterThan(0);

    // Stop agent
    await elizaService.stopAgent(deployedAgentId);

    // Verify agent is stopped
    const stoppedInfo = elizaService.getAgent(deployedAgentId);
    expect(stoppedInfo?.status).toBe('stopped');

    agentId = '' as UUID; // Reset so cleanup doesn't try to stop again
  });
});
