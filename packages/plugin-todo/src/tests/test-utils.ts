import type { IAgentRuntime, Plugin, Action, Provider, Service, UUID } from '@elizaos/core';
import { mock } from 'bun:test';

// Create a mock runtime for testing
export function createMockRuntime(overrides: Partial<IAgentRuntime> = {}): IAgentRuntime {
  const defaultRuntime: IAgentRuntime = {
    agentId: 'test-agent' as UUID,
    serverUrl: 'http://localhost:3000',
    databaseAdapter: null as any,
    db: null,
    token: 'test-token',
    apiKey: null,
    messageManager: null as any,
    stateManager: null as any,
    descriptionManager: null as any,
    character: {
      name: 'TestAgent',
      description: 'A test agent',
      instructions: 'Test instructions',
      personality: 'Test personality',
      modelProvider: 'openai',
      settings: {},
    },
    actions: [] as Action[],
    providers: [] as Provider[],
    services: new Map<string, Service>(),
    plugins: [] as Plugin[],
    cacheManager: null as any,
    
    // Methods
    getService: mock((name: string) => null),
    registerService: mock(),
    getSetting: mock((key: string) => null),
    setSetting: mock(),
    useModel: mock(() => Promise.resolve('Mock response')),
    composeState: mock(() => Promise.resolve({ values: {}, data: {} })),
    updateRecentMessages: mock(),
    createMemory: mock(() => Promise.resolve('test-memory-id' as UUID)),
    processActions: mock(),
    evaluate: mock(),
    ensureParticipantExists: mock(),
    ensureUserExists: mock(),
    ensureParticipantInRoom: mock(),
    getRoom: mock(() => Promise.resolve(null)),
    ensureConnection: mock(),
    requestXMTPConnection: mock(),
    getParticipantUserState: mock(),
    registerDatabaseAdapter: mock(),
    registerPushAdapter: mock(),
    getWalletBalance: mock(),
    emitEvent: mock(() => Promise.resolve()),
    getTransactionCount: mock(),
    registerPlugin: mock(),
    getProvider: mock(),
    
    // Additional methods can be added as needed
  } as unknown as IAgentRuntime;

  // Apply overrides
  return {
    ...defaultRuntime,
    ...overrides,
    // Ensure nested objects are properly merged
    character: {
      ...defaultRuntime.character,
      ...(overrides.character || {}),
    },
  };
} 