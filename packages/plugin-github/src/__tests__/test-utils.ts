import { IAgentRuntime, Memory, UUID } from '@elizaos/core';

export interface MockRuntime extends IAgentRuntime {
  // Mock properties and methods
}

export function setupLoggerSpies() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    log: () => {},
    success: () => {}
  };
}

export function createMockRuntime(): MockRuntime {
  const services = new Map();
  const mockRuntime = {
    agentId: '12345678-1234-1234-1234-123456789012' as UUID,
    serverUrl: 'https://localhost:3000',
    token: 'mock-token',
    character: {
      name: 'TestAgent',
      bio: 'Test agent for GitHub plugin',
      lore: [],
      messageExamples: [],
      postExamples: [],
      topics: [],
      knowledge: [],
      clients: [],
      plugins: [],
      settings: {},
      style: {
        all: [],
        chat: [],
        post: []
      }
    },
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    
    // Mock methods
    initialize: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    createMemory: (_memory: Memory) => Promise.resolve(),
    getMemory: (_id: UUID) => Promise.resolve(null),
    getMemories: () => Promise.resolve([]),
    updateMemory: (_memory: Memory) => Promise.resolve(),
    deleteMemory: (_id: UUID) => Promise.resolve(),
    getService: (name: string) => services.get(name) || null,
    registerService: (service: any) => {
      const serviceName = service.constructor?.serviceType || 'github';
      services.set(serviceName, service);
      return Promise.resolve();
    },
    getSetting: (key: string) => process.env[key] || '',
    getConversationLength: () => 10,
    processActions: () => Promise.resolve([]),
    evaluate: () => Promise.resolve([]),
    ensureConnection: () => Promise.resolve(),
    ensureParticipantExists: () => Promise.resolve(),
    ensureUserExists: () => Promise.resolve(),
    registerMemoryManager: () => {},
    getMemoryManager: () => null,
    getProvider: () => null,
    getAction: () => null,
    getEvaluator: () => null,
    registerAction: () => {},
    registerEvaluator: () => {},
    registerProvider: () => {},
    logger: {
      log: () => {},
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      success: () => {}
    },
    cacheManager: {
      get: () => Promise.resolve(undefined),
      set: () => Promise.resolve(),
      delete: () => Promise.resolve()
    },
    fetch: global.fetch,
    useModel: () => Promise.resolve('{"isGitHubRelated": false, "confidence": 0.5, "reasoning": "test response", "context": "general", "requiresAction": false}')
  } as unknown as MockRuntime;
  
  return mockRuntime;
}