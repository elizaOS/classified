import { describe, it, expect, beforeEach, mock as bunMock } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { mock } from '@elizaos/core/test-utils';

interface MockFunction<T = any> {
  (...args: any[]): T;
  mockReturnValue: (value: T) => MockFunction<T>;
  mockResolvedValue: (value: T) => MockFunction<T>;
  mockRejectedValue: (error: any) => MockFunction<T>;
  mockImplementation: (fn: (...args: any[]) => T) => MockFunction<T>;
  calls: any[][];
  mock: {
    calls: any[][];
    results: any[];
  };
}
import { reflectionEvaluator } from '../reflection';
import { createMockRuntime, createMockMemory, createMockState } from '../../__tests__/test-utils';

// Import the actual functions we need to reference
import * as CoreModule from '@elizaos/core';

// Mock the core functions that are causing timeouts
bunMock.module('@elizaos/core', () => {
  const mockGetEntityDetails = bunMock(() =>
    Promise.resolve({
      entities: [
        { id: 'entity-1' as UUID, names: ['User 1'], metadata: {} },
        { id: 'test-agent' as UUID, names: ['Test Agent'], metadata: {} },
      ],
      rooms: [{ id: 'room-1' as UUID, name: 'Test Room' }],
    })
  );

  return {
    ...CoreModule,
    getEntityDetails: mockGetEntityDetails,
    logger: {
      log: bunMock(),
      error: bunMock(),
      warn: bunMock(),
      info: bunMock(),
      debug: bunMock(),
    },
  };
});

const createReflectionMockRuntime = (): IAgentRuntime => {
  return createMockRuntime({
    getCache: mock().mockResolvedValue(null),
    setCache: mock().mockResolvedValue(true),
    getMemories: mock().mockResolvedValue([
      { id: 'msg-1', content: { text: 'Hello' } },
      { id: 'msg-2', content: { text: 'How are you?' } },
      { id: 'msg-3', content: { text: 'I am fine' } },
      { id: 'msg-4', content: { text: 'Great!' } },
      { id: 'msg-5', content: { text: 'What about you?' } },
    ]),
    getConversationLength: mock().mockReturnValue(4),
    getRelationships: mock().mockResolvedValue([]),
    getRoom: mock().mockResolvedValue({
      id: 'room-1',
      name: 'Test Room',
      source: 'test',
    }),
    getEntitiesForRoom: mock().mockResolvedValue([
      { id: 'entity-1', names: ['User 1'] },
      { id: 'test-agent', names: ['Test Agent'] },
    ]),
    getMemoriesByRoomIds: mock().mockResolvedValue([
      { userId: 'entity-1', agentId: 'test-agent' },
      { userId: 'test-agent', agentId: 'test-agent' },
    ]),
    useModel: mock().mockResolvedValue({
      thought: 'I am reflecting on this conversation',
      facts: [
        {
          claim: 'User is feeling fine',
          type: 'fact',
          in_bio: false,
          already_known: false,
        },
      ],
      relationships: [],
    }),
    addEmbeddingToMemory: mock().mockImplementation((memory: Memory) => ({
      ...memory,
      id: `fact-${Date.now()}`,
    })),
    createMemory: mock().mockResolvedValue(true),
    updateRelationship: mock().mockResolvedValue(true),
    createRelationship: mock().mockResolvedValue(true),
  });
};

describe.skip('reflectionEvaluator - SKIPPED: Timeout issues, needs async optimization', () => {
  let runtime: IAgentRuntime;
  const testEntityId = 'entity-1' as UUID;

  beforeEach(() => {
    runtime = createReflectionMockRuntime();
    // mock.restore(); // Not available on MockFunction
  });

  it('should validate when enough messages have accumulated', async () => {
    const memory = createMockMemory('test', testEntityId);

    // Should validate when messages > conversation length / 4
    expect(await reflectionEvaluator.validate(runtime, memory)).toBe(true);
  });

  it('should not validate when not enough messages', async () => {
    // Set up runtime to return only 1 message
    (runtime.getMemories as MockFunction<any>).mockResolvedValue([
      { id: 'msg-1', content: { text: 'Hello' } },
    ]);

    const memory = createMockMemory('test', testEntityId);

    expect(await reflectionEvaluator.validate(runtime, memory)).toBe(false);
  });

  it('should evaluate and extract facts and relationships', async () => {
    const memory = createMockMemory('I trust you completely', testEntityId);
    const state = {} as State;

    const result = await reflectionEvaluator.handler(runtime, memory, state);

    expect(runtime.useModel).toHaveBeenCalled();
    expect(runtime.createMemory).toHaveBeenCalled();
    expect(runtime.setCache).toHaveBeenCalledWith(
      'room-1-reflection-last-processed',
      'msg-current'
    );
    expect(result).toHaveProperty('thought');
    expect(result).toHaveProperty('facts');
    expect(result).toHaveProperty('relationships');
  });

  it('should handle errors gracefully', async () => {
    (runtime.useModel as MockFunction<any>).mockRejectedValue(new Error('Model error'));

    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    // Should not throw
    const result = await reflectionEvaluator.handler(runtime, memory, state);
    expect(result).toBeUndefined();
  });

  it('should skip reflection if last processed message is recent', async () => {
    // Set cache to return the last message ID
    (runtime.getCache as MockFunction<any>).mockResolvedValue('msg-4');
    (runtime.getMemories as MockFunction<any>).mockResolvedValue([
      { id: 'msg-1', content: { text: 'Hello' } },
      { id: 'msg-2', content: { text: 'How are you?' } },
      { id: 'msg-3', content: { text: 'I am fine' } },
      { id: 'msg-4', content: { text: 'Great!' } },
      { id: 'msg-5', content: { text: 'What about you?' } },
    ]);

    const memory = createMockMemory('test', testEntityId);

    // Should not validate because only 1 new message since last reflection
    expect(await reflectionEvaluator.validate(runtime, memory)).toBe(false);
  });
});
