import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import { MemoryType } from '@elizaos/core';
import { KnowledgeService } from '../../service';

interface MockSearchResult extends Memory {
  similarity: number;
}

describe('Search Relevance Ranking', () => {
  let mockRuntime: IAgentRuntime;
  let service: KnowledgeService;
  const memories = new Map<UUID, Memory>();
  let nextMemoryId = 2000;

  // Helper to generate consistent UUIDs for testing
  const generateTestUUID = (): UUID =>
    `search-${(nextMemoryId++).toString().padStart(8, '0')}-0000-0000-0000-000000000000` as UUID;

  beforeEach(() => {
    // Clear state
    memories.clear();
    nextMemoryId = 2000;

    mockRuntime = {
      agentId: generateTestUUID(),

      // Memory management methods
      async getMemoryById(id: UUID) {
        return memories.get(id) || null;
      },

      async getMemories(params: any) {
        const results = Array.from(memories.values()).filter((m) => {
          if (params.roomId && m.roomId !== params.roomId) {
            return false;
          }
          if (params.entityId && m.entityId !== params.entityId) {
            return false;
          }
          if (params.agentId && m.agentId !== params.agentId) {
            return false;
          }

          // Table-specific filtering
          if (params.tableName === 'knowledge' && m.metadata?.type !== MemoryType.FRAGMENT) {
            return false;
          }
          if (params.tableName === 'documents' && m.metadata?.type !== MemoryType.DOCUMENT) {
            return false;
          }

          return true;
        });

        return params.count ? results.slice(0, params.count) : results;
      },

      async searchMemories(params: any): Promise<MockSearchResult[]> {
        // Mock search with similarity scoring based on text content matching
        const query = (params.query || params.text)?.toLowerCase() || '';
        const fragments = Array.from(memories.values()).filter(
          (m) => m.metadata?.type === MemoryType.FRAGMENT
        );

        const results: MockSearchResult[] = fragments.map((fragment) => {
          const content = fragment.content.text?.toLowerCase() || '';

          // Simple scoring algorithm for testing
          let similarity = 0;

          // Word matches - basic scoring
          const queryWords = query.split(/\s+/).filter((w: string) => w.length > 0);
          const contentWords = content.split(/\s+/).filter((w: string) => w.length > 0);
          const matchingWords = queryWords.filter((word: string) =>
            contentWords.some((contentWord: string) => contentWord.includes(word))
          );

          if (queryWords.length > 0) {
            similarity += (matchingWords.length / queryWords.length) * 0.6;
          }

          // Exact phrase matches get bonus
          if (content.includes(query)) {
            similarity += 0.4;
          }

          // Topic relevance boost
          if ((fragment.metadata as any)?.topic) {
            const topic = (fragment.metadata as any).topic.toLowerCase();
            if (queryWords.some((word: string) => topic.includes(word) || word.includes(topic))) {
              similarity += 0.3;
            }
          }

          // Boost for title/header content
          if (content.includes('#') || content.includes('title')) {
            similarity += 0.25;
          }

          // Length penalty for very short fragments (apply after other boosts)
          if (content.length < 50) {
            similarity *= 0.6;
          }

          // Add small variation based on content length to ensure different scores
          similarity += Math.min(content.length / 10000, 0.01);

          return {
            ...fragment,
            similarity: Math.min(similarity, 1.0), // Cap at 1.0
          };
        });

        // Sort by similarity score (descending)
        results.sort((a, b) => b.similarity - a.similarity);

        // Filter out very low scores and apply limit
        const filteredResults = results.filter((r) => r.similarity > 0.1);
        return params.count ? filteredResults.slice(0, params.count) : filteredResults;
      },

      async createMemory(memory: Memory, tableName?: string) {
        const id = memory.id || generateTestUUID();
        const memoryWithId = { ...memory, id, createdAt: Date.now() };
        memories.set(id, memoryWithId);
        return id;
      },

      // Model methods
      async useModel(modelType: any, params: any) {
        // Mock embedding generation based on text content
        const text = params.text || '';
        // Create deterministic "embeddings" based on text content for consistent testing
        const embedding = new Array(1536).fill(0).map((_, i) => {
          return (text.charCodeAt(i % text.length) || 0) / 128.0 - 1.0;
        });
        return embedding as any;
      },

      // Service methods
      getService: mock((name: string) => {
        if (name === 'knowledge') {
          return service;
        }
        return null;
      }),

      getSetting: mock((key: string) => {
        const settings: Record<string, string> = {
          KNOWLEDGE_USE_NEW_TABLES: 'false',
          KNOWLEDGE_CHUNKING_MAX_SIZE: '1000',
        };
        return settings[key] || null;
      }),

      // Other required methods
      logger: {
        info: mock(),
        warn: mock(),
        error: mock(),
        debug: mock(),
      },
    } as any;

    service = new KnowledgeService(mockRuntime);
  });

  describe('Relevance Scoring', () => {
    it('should rank exact matches higher than partial matches', async () => {
      // Create test documents with varying relevance
      const fragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'ElizaOS plugin development requires understanding the plugin architecture. Plugins extend agent capabilities through actions, providers, and services.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'plugin-development',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Agents in ElizaOS have various capabilities and can be configured with different plugins. Each agent instance loads its configured plugins at startup.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'agents',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Database configuration and setup instructions for connecting to PostgreSQL. Includes schema management and migration details.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'database',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Plugin architecture overview: plugins provide modular functionality through well-defined interfaces. Each plugin can include actions, providers, evaluators, and services.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'plugin-architecture',
          },
        },
      ];

      // Add all fragments to memory
      for (const fragment of fragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Test search for "plugin development"
      const searchResults = await mockRuntime.searchMemories({
        embedding: [0.1, 0.2, 0.3], // Mock embedding
        query: 'plugin development',
        count: 10,
        tableName: 'knowledge',
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults.length).toBeLessThanOrEqual(4);

      // Verify ordering: exact match should be first
      expect(searchResults[0].content.text).toContain('plugin development');

      if (searchResults.length > 1) {
        expect(searchResults[0].similarity || 0).toBeGreaterThan(searchResults[1].similarity || 0);

        // Second result should be plugin architecture (related topic)
        const pluginArchResult = searchResults.find((r) =>
          r.content.text?.toLowerCase().includes('plugin architecture')
        );
        expect(pluginArchResult).toBeDefined();
      }

      // Verify similarity scores are in descending order
      for (let i = 1; i < searchResults.length; i++) {
        expect(searchResults[i - 1].similarity || 0).toBeGreaterThanOrEqual(
          searchResults[i].similarity || 0
        );
      }
    });

    it('should prioritize topical relevance over generic mentions', async () => {
      // Create fragments with different levels of topical relevance
      const fragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Database configuration involves setting up PostgreSQL with proper credentials and connection parameters. Configure environment variables for database URL.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'database-configuration',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Agent configuration includes database settings among other parameters. The database is used for storing agent memories and state.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'agent-configuration',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Testing framework supports both unit tests and E2E tests. Some tests require database setup for proper execution.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'testing',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '# Database Setup Guide\n\nStep-by-step instructions for setting up your database environment with PostgreSQL, PGLite, or other supported databases.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'database-setup',
          },
        },
      ];

      // Add all fragments to memory
      for (const fragment of fragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Search for database setup
      const searchResults = await mockRuntime.searchMemories({
        embedding: [0.1, 0.2, 0.3], // Mock embedding
        query: 'database setup',
        count: 10,
        tableName: 'knowledge',
      });

      expect(searchResults.length).toBeGreaterThan(0);

      // Find the database setup guide (with header) in results
      const setupGuideResult = searchResults.find((r) =>
        r.content.text?.includes('Database Setup Guide')
      );
      expect(setupGuideResult).toBeDefined();
      expect(setupGuideResult!.similarity || 0).toBeGreaterThan(0.7);

      // Database configuration should also be in results (topically relevant)
      const configResult = searchResults.find((r) =>
        r.content.text?.includes('Database configuration')
      );
      expect(configResult).toBeDefined();
      expect(configResult!.similarity || 0).toBeGreaterThan(0.5);

      // Testing fragment should rank lower (generic mention)
      const testingFragment = searchResults.find((r) =>
        r.content.text?.includes('Testing framework')
      );
      expect(testingFragment).toBeDefined();

      // The setup guide should rank higher than or equal to the testing fragment
      expect(setupGuideResult!.similarity || 0).toBeGreaterThanOrEqual(
        testingFragment!.similarity || 0
      );
    });

    it('should handle multi-word queries with proper ranking', async () => {
      // Create fragments for testing complex queries
      const fragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Agent memory management system handles storing and retrieving conversation history, entity relationships, and knowledge fragments.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'memory-management',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Memory storage in ElizaOS uses various types: documents, fragments, messages, and descriptions. Each type serves different purposes.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'memory-types',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Agents have sophisticated memory capabilities including short-term context and long-term knowledge retention. Memory is persistent across sessions.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'agent-memory',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'System architecture includes multiple components: runtime, plugins, memory management, and client interfaces.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'architecture',
          },
        },
      ];

      // Add all fragments to memory
      for (const fragment of fragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Search for "agent memory management"
      const searchResults = await mockRuntime.searchMemories({
        embedding: [0.1, 0.2, 0.3], // Mock embedding
        query: 'agent memory management',
        count: 10,
        tableName: 'knowledge',
      });

      expect(searchResults.length).toBeGreaterThan(0);

      // Verify that the fragment mentioning "Agent memory management" ranks highest
      expect(searchResults[0].content.text).toContain('Agent memory management');
      expect(searchResults[0].similarity || 0).toBeGreaterThan(0.8);

      // Verify that fragments with partial matches rank lower but in reasonable order
      const partialMatches = searchResults.filter(
        (r) => !r.content.text?.includes('Agent memory management')
      );

      for (const match of partialMatches) {
        expect(match.similarity || 0).toBeLessThan(searchResults[0].similarity || 0);
        // Should still have some relevance
        expect(match.similarity || 0).toBeGreaterThan(0.2);
      }
    });

    it('should handle queries with no matches gracefully', async () => {
      // Create fragments that don't match the search query
      const fragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'ElizaOS provides comprehensive agent development capabilities with modern TypeScript architecture.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'development',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Plugin system enables modular functionality with hot-swappable components and dependency management.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'plugins',
          },
        },
      ];

      // Add fragments to memory
      for (const fragment of fragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Search for something completely unrelated
      const searchResults = await mockRuntime.searchMemories({
        embedding: [0.1, 0.2, 0.3], // Mock embedding
        query: 'quantum computing blockchain cryptocurrency',
        count: 10,
        tableName: 'knowledge',
      });

      // Should return empty results or very low scored results
      expect(searchResults.length).toBeLessThanOrEqual(2);

      if (searchResults.length > 0) {
        // Any results should have very low similarity scores
        expect(searchResults[0].similarity || 0).toBeLessThan(0.3);
      }
    });

    it('should rank header and title content higher', async () => {
      // Create fragments with different content types
      const fragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '# API Documentation\n\nComprehensive guide to the ElizaOS API endpoints and usage examples.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'api',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'The API provides various endpoints for interacting with agents and managing their state.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 1,
            topic: 'api',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'For API troubleshooting, check the logs and verify your authentication credentials.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 2,
            topic: 'api',
          },
        },
      ];

      // Add fragments to memory
      for (const fragment of fragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Search for "API"
      const searchResults = await mockRuntime.searchMemories({
        embedding: [0.1, 0.2, 0.3], // Mock embedding
        query: 'API',
        count: 10,
        tableName: 'knowledge',
      });

      expect(searchResults.length).toBe(3);

      // Find the header fragment
      const headerFragment = searchResults.find((r) =>
        r.content.text?.includes('# API Documentation')
      );
      expect(headerFragment).toBeDefined();

      // Find the other fragments
      const otherFragments = searchResults.filter(
        (r) => !r.content.text?.includes('# API Documentation')
      );

      // Verify the header fragment has high similarity due to title boost
      expect(headerFragment!.similarity || 0).toBeGreaterThan(0.7);

      // Header should generally rank well (may not always be first due to other factors)
      const headerIndex = searchResults.findIndex((r) => r.id === headerFragment!.id);
      expect(headerIndex).toBeLessThan(2); // Should be in top 2
    });

    it('should apply length penalty to very short fragments', async () => {
      // Create fragments of different lengths
      const fragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Test setup guide provides comprehensive instructions for configuring your testing environment with all necessary dependencies and tools.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
            topic: 'testing',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Test setup.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 1,
            topic: 'testing',
          },
        },
      ];

      // Add fragments to memory
      for (const fragment of fragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Search for "test setup"
      const searchResults = await mockRuntime.searchMemories({
        embedding: [0.1, 0.2, 0.3], // Mock embedding
        query: 'test setup',
        count: 10,
        tableName: 'knowledge',
      });

      expect(searchResults.length).toBe(2);

      // Find the comprehensive and short fragments
      const comprehensiveFragment = searchResults.find((r) =>
        r.content.text?.includes('comprehensive instructions')
      );
      const shortFragment = searchResults.find((r) => r.content.text === 'Test setup.');

      expect(comprehensiveFragment).toBeDefined();
      expect(shortFragment).toBeDefined();

      // The short fragment should have reduced similarity due to length penalty
      expect(shortFragment!.similarity || 0).toBeLessThan(0.9); // Should be penalized

      // Both should have reasonable scores since they match the query
      expect(comprehensiveFragment!.similarity || 0).toBeGreaterThan(0.3);
      expect(shortFragment!.similarity || 0).toBeGreaterThan(0.3);
    });
  });

  describe('Search Result Consistency', () => {
    it('should return consistent results for identical queries', async () => {
      // Create test fragments
      const fragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'ElizaOS runtime provides core functionality for agent execution and management.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 0,
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'Runtime configuration includes model settings, memory limits, and plugin specifications.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: generateTestUUID(),
            position: 1,
          },
        },
      ];

      // Add fragments to memory
      for (const fragment of fragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Perform the same search multiple times
      const query = 'runtime configuration';
      const searchParams = {
        embedding: [0.1, 0.2, 0.3], // Mock embedding
        query,
        count: 10,
        tableName: 'knowledge',
      };
      const results1 = await mockRuntime.searchMemories(searchParams);
      const results2 = await mockRuntime.searchMemories(searchParams);
      const results3 = await mockRuntime.searchMemories(searchParams);

      // Results should be identical
      expect(results1).toHaveLength(results2.length);
      expect(results2).toHaveLength(results3.length);

      for (let i = 0; i < results1.length; i++) {
        expect(results1[i].id).toBe(results2[i].id!);
        expect(results2[i].id).toBe(results3[i].id!);
        expect(results1[i].similarity || 0).toBe(results2[i].similarity || 0);
        expect(results2[i].similarity || 0).toBe(results3[i].similarity || 0);
      }
    });

    it('should handle case insensitive searches correctly', async () => {
      // Create test fragments
      const fragment = {
        id: generateTestUUID(),
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: 'ElizaOS Plugin Development Guidelines for creating custom extensions.',
        },
        metadata: {
          type: MemoryType.FRAGMENT,
          documentId: generateTestUUID(),
          position: 0,
        },
      };

      await mockRuntime.createMemory(fragment, 'knowledge');

      // Test different case variations
      const queries = [
        'plugin development',
        'Plugin Development',
        'PLUGIN DEVELOPMENT',
        'Plugin development',
        'pLuGiN dEvElOpMeNt',
      ];

      const allResults = await Promise.all(
        queries.map((query) =>
          mockRuntime.searchMemories({
            embedding: [0.1, 0.2, 0.3], // Mock embedding
            query,
            count: 10,
            tableName: 'knowledge',
          })
        )
      );

      // All should return the same fragment with similar scores
      for (const results of allResults) {
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe(fragment.id);
        expect(results[0].similarity).toBeGreaterThan(0.5);
      }

      // Similarity scores should be very close (within 0.1)
      const scores = allResults.map((results) => results[0].similarity || 0);
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      expect(maxScore - minScore).toBeLessThan(0.1);
    });
  });
});
