#!/usr/bin/env bun

/**
 * Standalone E2E Test Runner for Knowledge Plugin
 *
 * This script runs E2E tests directly without going through the ElizaOS CLI test runner,
 * which has compatibility issues with the logger and database initialization.
 */

import type { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import { KnowledgeService } from '../src/service';

// Import E2E test modules
import knowledgeE2ETest from '../src/__tests__/e2e/knowledge-e2e.test';
import startupLoadingTest from '../src/__tests__/e2e/startup-loading.test';
import attachmentHandlingTest from '../src/__tests__/e2e/attachment-handling.test';
import advancedFeaturesE2ETest from '../src/__tests__/e2e/advanced-features-e2e.test';

// Mock runtime for E2E tests with full functionality
const createMockRuntime = (): IAgentRuntime => {
  const memories: Map<string, Memory[]> = new Map();
  const components: Map<string, any[]> = new Map();
  let memoryIdCounter = 1;

  const mockRuntime: any = {
    agentId: 'test-agent-id' as UUID,
    character: {
      name: 'TestAgent',
      bio: ['Test bio'],
      knowledge: [],
    },
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    services: new Map(),

    // Core methods
    getService: (name: string) => mockRuntime.services.get(name),
    getSetting: (key: string) => {
      const settings: Record<string, string> = {
        EMBEDDING_PROVIDER: 'openai',
        OPENAI_API_KEY: 'test-key',
        TEXT_EMBEDDING_MODEL: 'text-embedding-3-small',
      };
      return settings[key] || process.env[key];
    },
    setSetting: (key: string, value: string) => {
      process.env[key] = value;
    },

    // Memory operations
    getMemories: async (params: any) => {
      const { tableName = 'memories', entityId, roomId } = params;
      const tableMemories = memories.get(tableName) || [];

      return tableMemories.filter((m) => {
        if (entityId && m.entityId !== entityId) {
          return false;
        }
        if (roomId && m.roomId !== roomId) {
          return false;
        }
        return true;
      });
    },

    createMemory: async (memory: Memory, tableName: string = 'memories') => {
      const newMemory = {
        ...memory,
        id: memory.id || (`memory-${memoryIdCounter++}` as UUID),
        createdAt: memory.createdAt || Date.now(),
      };

      if (!memories.has(tableName)) {
        memories.set(tableName, []);
      }
      memories.get(tableName)!.push(newMemory);
      return true;
    },

    updateMemory: async (memory: Memory) => {
      for (const [tableName, tableMemories] of memories) {
        const index = tableMemories.findIndex((m) => m.id === memory.id);
        if (index !== -1) {
          tableMemories[index] = memory;
          return true;
        }
      }
      return false;
    },

    deleteMemory: async (memoryId: UUID) => {
      // First check if this is a document
      const documentsTable = memories.get('documents') || [];
      const documentIndex = documentsTable.findIndex((m) => m.id === memoryId);

      if (documentIndex !== -1) {
        // This is a document, cascade delete its fragments
        const knowledgeTable = memories.get('knowledge') || [];
        const fragmentsToDelete = knowledgeTable.filter(
          (f) => (f.metadata as any)?.documentId === memoryId
        );

        // Delete fragments
        for (const fragment of fragmentsToDelete) {
          const fragIndex = knowledgeTable.indexOf(fragment);
          if (fragIndex !== -1) {
            knowledgeTable.splice(fragIndex, 1);
          }
        }

        // Delete the document
        documentsTable.splice(documentIndex, 1);
        return true;
      }

      // Not a document, try regular deletion
      for (const [tableName, tableMemories] of memories) {
        const index = tableMemories.findIndex((m) => m.id === memoryId);
        if (index !== -1) {
          tableMemories.splice(index, 1);
          return true;
        }
      }
      return false;
    },

    getMemoryById: async (id: UUID) => {
      for (const [_, tableMemories] of memories) {
        const memory = tableMemories.find((m) => m.id === id);
        if (memory) {
          return memory;
        }
      }
      return null;
    },

    // Search memories by embedding similarity
    searchMemories: async (params: any) => {
      const { tableName = 'memories', embedding, count = 10, match_threshold = 0.5 } = params;
      const tableMemories = memories.get(tableName) || [];

      // For knowledge table, always return some results if there are any fragments
      if (tableName === 'knowledge' && tableMemories.length > 0) {
        // Return all fragments with high similarity scores
        const results = tableMemories
          .map((memory) => ({
            ...memory,
            similarity: 0.8 + Math.random() * 0.2, // High similarity scores (0.8-1.0)
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, count);

        return results;
      }

      // For other tables, use the original logic
      const results = tableMemories
        .map((memory) => ({
          ...memory,
          similarity: Math.random(), // Mock similarity score
        }))
        .filter((m) => m.similarity >= match_threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, count);

      return results;
    },

    // Message operations
    processMessage: async (message: Memory) => {
      // Simple mock implementation
      await mockRuntime.createMemory(message);
    },

    messageManager: {
      getMessages: async (params: any) => {
        return mockRuntime.getMemories({ ...params, tableName: 'messages' });
      },
      createMemory: async (memory: Memory) => {
        return mockRuntime.createMemory(memory, 'messages');
      },
    },

    // Component operations
    createComponent: async (component: any) => {
      const entityId = component.entityId;
      if (!components.has(entityId)) {
        components.set(entityId, []);
      }
      components.get(entityId)!.push(component);
      return true;
    },

    getComponents: async (entityId: string) => {
      return components.get(entityId) || [];
    },

    // Model operations
    useModel: async (modelType: string, params: any) => {
      // Mock embeddings
      if (modelType === 'TEXT_EMBEDDING') {
        return {
          embedding: new Array(1536).fill(0).map(() => Math.random()),
        };
      }
      return { text: 'mock response' };
    },

    // State operations
    composeState: async () => ({ values: {}, data: {}, text: '' }),

    // Logging
    logger: {
      info: (...args: any[]) => console.log('[INFO]', ...args),
      warn: (...args: any[]) => console.warn('[WARN]', ...args),
      error: (...args: any[]) => console.error('[ERROR]', ...args),
      debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
    },

    // Register provider
    registerProvider: (provider: any) => {
      mockRuntime.providers.push(provider);
    },
  };

  return mockRuntime as IAgentRuntime;
};

// Test runner
async function runE2ETests() {
  console.log('🚀 Running Knowledge Plugin E2E Tests\n');

  const runtime = createMockRuntime();

  // Initialize Knowledge service
  try {
    const knowledgeService = await KnowledgeService.start(runtime);
    runtime.services.set(KnowledgeService.serviceType as any, knowledgeService);
    runtime.services.set('knowledge' as any, knowledgeService);
    console.log('✅ Knowledge service initialized\n');
  } catch (error: any) {
    console.error('❌ Failed to initialize Knowledge service:', error.message);
    process.exit(1);
  }

  const tests = [
    { name: 'Knowledge E2E Test', test: knowledgeE2ETest },
    { name: 'Startup Loading Test', test: startupLoadingTest },
    { name: 'Attachment Handling Test', test: attachmentHandlingTest },
    { name: 'Advanced Features E2E Test', test: advancedFeaturesE2ETest },
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, test } of tests) {
    try {
      console.log(`Running: ${name}`);
      await test.fn(runtime);
      console.log(`✅ ${name} passed\n`);
      passed++;
    } catch (error: any) {
      console.error(`❌ ${name} failed:`, error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      console.log('');
      failed++;
    }
  }

  // Stop the Knowledge service
  const knowledgeService = runtime.getService(KnowledgeService.serviceType);
  if (knowledgeService) {
    await knowledgeService.stop();
  }

  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Total: ${tests.length}`);

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runE2ETests().catch((error) => {
  console.error('Fatal error running E2E tests:', error);
  process.exit(1);
});
