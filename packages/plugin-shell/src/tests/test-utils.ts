import { vi } from 'vitest';
import type { IAgentRuntime, Memory, State, UUID } from '@elizaos/core';

export function createMockRuntime(overrides: Partial<IAgentRuntime> = {}): IAgentRuntime {
  return {
    agentId: '00000000-0000-0000-0000-000000000001' as UUID,
    getConversationLength: vi.fn(() => 10),
    getSetting: vi.fn(() => null),
    getService: vi.fn(() => null),
    hasService: vi.fn(() => false),
    registerService: vi.fn(),
    initialize: vi.fn(() => Promise.resolve()),
    stop: vi.fn(() => Promise.resolve()),
    evaluate: vi.fn(() => Promise.resolve(null)),
    processActions: vi.fn(() => Promise.resolve()),
    useModel: vi.fn(() => Promise.resolve('test response')) as any,
    ensureConnection: vi.fn(() => Promise.resolve()),
    composeState: vi.fn(() => Promise.resolve({ data: {}, values: {}, text: '' } as State)),
    createMemory: vi.fn(() => Promise.resolve('test-memory-id' as UUID)),
    actions: [],
    providers: [],
    evaluators: [],
    services: new Map(),
    db: null,
    plugins: [],
    routes: [],
    logger: console,
    character: {
      name: 'Test Agent',
      id: '00000000-0000-0000-0000-000000000001' as UUID,
      username: 'test-agent',
      bio: [],
      settings: {},
      system: 'test system',
      plugins: [],
    },
    ...overrides,
  } as IAgentRuntime;
}

export function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: '00000000-0000-0000-0000-000000000002' as UUID,
    entityId: '00000000-0000-0000-0000-000000000003' as UUID,
    agentId: '00000000-0000-0000-0000-000000000001' as UUID,
    roomId: '00000000-0000-0000-0000-000000000004' as UUID,
    content: {
      text: 'test memory',
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

export function createMockState(overrides: Partial<State> = {}): State {
  return {
    data: {},
    values: {},
    text: '',
    ...overrides,
  };
} 