import {
  type IAgentRuntime,
  type UUID,
  stringToUuid,
  type Memory,
  ChannelType,
} from '@elizaos/core';

/**
 * Creates a test world for E2E tests to avoid foreign key violations
 */
export async function createTestWorld(runtime: IAgentRuntime): Promise<UUID> {
  const worldId = stringToUuid(`test-world-${Date.now()}`);

  try {
    // Check if world already exists
    const existingWorld = await runtime.getWorld(worldId);
    if (existingWorld) {
      return worldId;
    }
  } catch (error) {
    // World doesn't exist, create it
  }

  // Create the world
  await runtime.createWorld({
    id: worldId,
    name: `Test World ${Date.now()}`,
    agentId: runtime.agentId,
    serverId: 'test-server',
    metadata: {
      type: 'test',
      createdAt: new Date().toISOString(),
    },
  });

  return worldId;
}

/**
 * Creates a test room with proper world association
 */
export async function createTestRoom(runtime: IAgentRuntime, worldId: UUID): Promise<UUID> {
  const roomId = stringToUuid(`test-room-${Date.now()}`);

  await runtime.createRoom({
    id: roomId,
    name: `Test Room ${Date.now()}`,
    agentId: runtime.agentId,
    worldId,
    source: 'test',
    type: ChannelType.GROUP,
    metadata: {
      test: true,
    },
  });

  return roomId;
}

/**
 * Creates a test message with all required fields
 */
export function createTestMessage(params: {
  entityId: UUID;
  agentId: UUID;
  roomId: UUID;
  worldId: UUID;
  text: string;
}): Memory {
  return {
    id: stringToUuid(`msg-${Date.now()}-${Math.random()}`),
    entityId: params.entityId,
    agentId: params.agentId,
    roomId: params.roomId,
    worldId: params.worldId,
    content: {
      text: params.text,
      source: 'test',
    },
    createdAt: Date.now(),
  };
}

/**
 * Waits for async operations to complete with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Creates mock LLM responses for testing
 */
export function mockLLMResponse(type: 'entity' | 'relationship' | 'trust') {
  switch (type) {
    case 'entity':
      return {
        entities: [
          {
            type: 'person',
            names: ['Test Entity'],
            summary: 'A test entity for E2E testing',
            tags: ['test', 'e2e'],
            metadata: {
              source: 'test',
              confidence: 0.9,
            },
          },
        ],
      };

    case 'relationship':
      return {
        relationships: [
          {
            type: 'colleague',
            confidence: 0.8,
            sentiment: 0.6,
            evidence: 'They work together on test projects',
          },
        ],
      };

    case 'trust':
      return {
        trustDelta: 0.1,
        reason: 'Positive test interaction',
        indicators: ['reliable', 'helpful'],
        riskLevel: 'low',
      };
  }
}
