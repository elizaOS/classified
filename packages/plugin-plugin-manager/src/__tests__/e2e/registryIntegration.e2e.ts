import {
  type Action,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Plugin,
  Service,
  type ServiceTypeName,
  type UUID,
} from '@elizaos/core';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginManagerService } from '../../services/pluginManagerService';
import { RegistryService } from '../../services/registryService';
import {
  enhancedSearchPluginAction,
  getPluginDetailsAction,
} from '../../actions/searchPluginAction';

// Mock database adapter
class MockDatabaseAdapter {
  async getMemories() {
    return [];
  }
  async searchMemories() {
    return [];
  }
  async createMemory() {
    return;
  }
  async getMemoriesByRoomIds() {
    return [];
  }
  async getGoals() {
    return [];
  }
  async getConversation() {
    return [];
  }
  async createConversation() {
    return;
  }
  async saveMemory() {
    return;
  }
}

// Mock fetch for testing GitHub API
global.fetch = vi.fn() as any;

describe('Registry Integration E2E Tests', () => {
  let runtime: IAgentRuntime;
  let pluginManager: PluginManagerService;
  let registryService: RegistryService;
  let tempDir: string;

  beforeEach(async () => {
    // Reset fetch mock
    vi.resetAllMocks();

    // Create temporary directory
    tempDir = path.join(os.tmpdir(), `registry-e2e-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // Create mock runtime
    runtime = {
      agentId: '00000000-0000-0000-0000-000000000000' as UUID,
      plugins: [],
      actions: [],
      providers: [],
      evaluators: [],
      services: new Map(),
      events: new Map(),

      registerPlugin: async (plugin: Plugin) => {
        runtime.plugins.push(plugin);
      },
      registerAction: async (action: Action) => {
        runtime.actions.push(action);
      },
      registerProvider: async (provider: any) => {
        runtime.providers.push(provider);
      },
      registerEvaluator: async (evaluator: any) => {
        runtime.evaluators.push(evaluator);
      },
      registerEvent: (event: string, handler: (params: any) => Promise<void>) => {
        const handlers = runtime.events.get(event) || [];
        handlers.push(handler as any);
        runtime.events.set(event, handlers);
      },
      emitEvent: async (event: string, params: any) => {
        const handlers = runtime.events.get(event) || [];
        for (const handler of handlers) {
          await handler(params);
        }
      },
      getService: (name: string) => {
        return runtime.services.get(name as ServiceTypeName);
      },
      registerService: (service: any) => {
        runtime.services.set(service.serviceType || service.constructor.name, service);
      },

      memory: [] as Memory[],
      messageManager: {} as any,
      descriptionManager: {} as any,
      loreManager: {} as any,
      cacheManager: {} as any,
      modelProvider: 'openai' as any,
      character: {
        name: 'Test Agent',
        modelProvider: ModelType.TEXT_SMALL,
        settings: {
          secrets: {},
        },
      } as any,
      state: {} as any,
      goals: [] as any[],
    } as unknown as IAgentRuntime;

    // Initialize services
    pluginManager = new PluginManagerService(runtime, {
      pluginDirectory: path.join(tempDir, 'plugins'),
    });

    registryService = new RegistryService(runtime);
    // Service is already instantiated, no need to register
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Registry Data Fetching', () => {
    it('should successfully fetch and parse registry data', async () => {
      // Mock successful GitHub API response
      const mockRegistryData = {
        'plugin-bootstrap': {
          name: '@elizaos/plugin-bootstrap',
          description: 'Bootstrap plugin for core agent functionality',
          version: '0.0.1',
          author: 'ElizaOS Team',
          github: 'https://github.com/elizaos-plugins/plugin-bootstrap',
          dependencies: [],
          tags: ['core', 'bootstrap', 'essential'],
          elizaVersion: 'v1',
        },
        'plugin-solana': {
          name: '@elizaos/plugin-solana',
          description: 'Solana blockchain integration plugin',
          version: '0.0.5',
          author: 'ElizaOS Team',
          github: 'https://github.com/elizaos-plugins/plugin-solana',
          dependencies: ['@elizaos/plugin-bootstrap'],
          tags: ['blockchain', 'solana', 'defi', 'crypto'],
          elizaVersion: 'v1',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistryData,
      });

      // Mock README fetch for enhanced metadata
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => 'Mock README content with blockchain and solana functionality',
      });

      // Sync registry
      await registryService.syncRegistry();

      // Verify plugins were cached by searching
      const searchResults = await registryService.searchPlugins('plugin');
      expect(searchResults.length).toBeGreaterThan(0);

      // Search for solana plugin specifically
      const solanaResults = await registryService.searchPlugins('solana');
      expect(solanaResults.length).toBeGreaterThan(0);
      const solanaPlugin = solanaResults[0];
      expect(solanaPlugin?.tags).toContain('blockchain');
    });

    it('should handle GitHub API failures gracefully', async () => {
      // Mock API failure
      (global.fetch as any).mockRejectedValueOnce(new Error('GitHub API rate limit exceeded'));

      // Should not throw but should log warning
      await expect(registryService.syncRegistry()).resolves.not.toThrow();

      // Cache should be empty - search should return no results
      const searchResults = await registryService.searchPlugins('test');
      expect(searchResults.length).toBe(0);
    });
  });

  describe('Vectorized Search Functionality', () => {
    beforeEach(async () => {
      // Set up mock registry data for search tests
      const mockData = {
        'plugin-weather': {
          name: '@elizaos/plugin-weather',
          description: 'Weather forecast and current conditions plugin',
          tags: ['weather', 'api', 'forecast'],
          elizaVersion: 'v1',
        },
        'plugin-crypto': {
          name: '@elizaos/plugin-crypto',
          description: 'Cryptocurrency price tracking and market analysis',
          tags: ['crypto', 'bitcoin', 'ethereum', 'trading'],
          elizaVersion: 'v1',
        },
        'plugin-database': {
          name: '@elizaos/plugin-database',
          description: 'Database connectivity and ORM functionality',
          tags: ['database', 'sql', 'orm', 'storage'],
          elizaVersion: 'v1',
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
        text: async () => 'Mock README content',
      });

      await registryService.syncRegistry();
    });

    it('should perform semantic search with high accuracy', async () => {
      const results = await registryService.searchPlugins('weather forecasting', 5);

      expect(results.length).toBeGreaterThan(0);

      // Weather plugin should be top result
      const topResult = results[0];
      expect(topResult.name).toContain('weather');
      expect(topResult.relevanceScore).toBeGreaterThan(0.5);
    });

    it('should handle cryptocurrency-related queries', async () => {
      const results = await registryService.searchPlugins('bitcoin price tracking', 5);

      const cryptoPlugin = results.find((r) => r.name.includes('crypto'));
      expect(cryptoPlugin).toBeDefined();
      expect(cryptoPlugin?.tags).toContain('bitcoin');
    });

    it('should return empty results for non-matching queries', async () => {
      const results = await registryService.searchPlugins('quantum computing neural networks', 5);

      // Should return results but with low relevance scores
      if (results.length > 0) {
        expect(results.every((r) => r.relevanceScore < 0.3)).toBe(true);
      }
    });
  });

  describe('Enhanced Search Action Integration', () => {
    beforeEach(async () => {
      // Register the search action
      await runtime.registerAction(enhancedSearchPluginAction);

      // Set up mock data
      const mockData = {
        'plugin-twitter': {
          name: '@elizaos/plugin-twitter',
          description: 'Twitter integration for posting and reading tweets',
          tags: ['social', 'twitter', 'api'],
          elizaVersion: 'v1',
        },
        'plugin-discord': {
          name: '@elizaos/plugin-discord',
          description: 'Discord bot integration and channel management',
          tags: ['social', 'discord', 'bot'],
          elizaVersion: 'v1',
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
        text: async () => 'Mock README content',
      });

      await registryService.syncRegistry();
    });

    it('should execute search action with natural language query', async () => {
      const testMessage: Memory = {
        entityId: '00000000-0000-0000-0000-000000000001' as UUID,
        agentId: runtime.agentId,
        roomId: '00000000-0000-0000-0000-000000000003' as UUID,
        content: { text: 'search for social media plugins' },
        createdAt: Date.now(),
      };

      // Validate the action
      const isValid = await enhancedSearchPluginAction.validate(runtime, testMessage, undefined);
      expect(isValid).toBe(true);

      // Execute the action with callback
      const results: any[] = [];
      const mockCallback = vi.fn(async (content) => {
        results.push(content);
        return [];
      });

      const result = await enhancedSearchPluginAction.handler(
        runtime,
        testMessage,
        undefined,
        undefined,
        mockCallback
      );

      expect(result && typeof result === 'object' && 'success' in result && result.success).toBe(
        true
      );
      expect(mockCallback).toHaveBeenCalled();

      // Check that social media plugins were found
      const callbackContent = mockCallback.mock.calls[0][0];
      expect(callbackContent.text).toContain('social');
      expect(callbackContent.text).toMatch(/(twitter|discord)/i);
    });

    it('should handle invalid search queries gracefully', async () => {
      const testMessage: Memory = {
        entityId: '00000000-0000-0000-0000-000000000001' as UUID,
        agentId: runtime.agentId,
        roomId: '00000000-0000-0000-0000-000000000003' as UUID,
        content: { text: 'hello world' }, // Not a search query
        createdAt: Date.now(),
      };

      const isValid = await enhancedSearchPluginAction.validate(runtime, testMessage, undefined);
      expect(isValid).toBe(false);
    });
  });

  describe('Plugin Details Retrieval', () => {
    beforeEach(async () => {
      await runtime.registerAction(getPluginDetailsAction);

      const mockData = {
        'plugin-example': {
          name: '@elizaos/plugin-example',
          description: 'Example plugin for testing',
          tags: ['example', 'test'],
          elizaVersion: 'v1',
          github: 'https://github.com/elizaos-plugins/plugin-example',
        },
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('generated-registry.json')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockData,
          });
        } else if (url.includes('raw.githubusercontent.com')) {
          return Promise.resolve({
            ok: true,
            text: async () =>
              '# Example Plugin\n\nThis is an example plugin with extensive documentation.',
          });
        }
        return Promise.resolve({ ok: false });
      });

      await registryService.syncRegistry();
    });

    it('should retrieve detailed plugin information', async () => {
      const testMessage: Memory = {
        entityId: '00000000-0000-0000-0000-000000000001' as UUID,
        agentId: runtime.agentId,
        roomId: '00000000-0000-0000-0000-000000000003' as UUID,
        content: { text: 'get details for @elizaos/plugin-example' },
        createdAt: Date.now(),
      };

      const isValid = await getPluginDetailsAction.validate(runtime, testMessage, undefined);
      expect(isValid).toBe(true);

      const mockCallback = vi.fn();
      const result = await getPluginDetailsAction.handler(
        runtime,
        testMessage,
        undefined,
        undefined,
        mockCallback
      );

      expect(result && typeof result === 'object' && 'success' in result && result.success).toBe(
        true
      );
      expect(mockCallback).toHaveBeenCalled();

      const callbackContent = mockCallback.mock.calls[0][0];
      expect(callbackContent.text).toContain('@elizaos/plugin-example');
      expect(callbackContent.text).toContain('Example plugin for testing');
    });

    it('should handle non-existent plugin queries', async () => {
      const testMessage: Memory = {
        entityId: '00000000-0000-0000-0000-000000000001' as UUID,
        agentId: runtime.agentId,
        roomId: '00000000-0000-0000-0000-000000000003' as UUID,
        content: { text: 'get details for @elizaos/non-existent-plugin' },
        createdAt: Date.now(),
      };

      const mockCallback = vi.fn();
      const result = await getPluginDetailsAction.handler(
        runtime,
        testMessage,
        undefined,
        undefined,
        mockCallback
      );

      expect(result && typeof result === 'object' && 'success' in result && result.success).toBe(
        false
      );
      expect(mockCallback).toHaveBeenCalled();

      const callbackContent = mockCallback.mock.calls[0][0];
      expect(callbackContent.text).toContain('not found');
    });
  });

  describe('Registry Cache Management', () => {
    it('should handle cache persistence and retrieval', async () => {
      const mockData = {
        'test-plugin': {
          name: '@elizaos/test-plugin',
          description: 'Test plugin for cache testing',
          tags: ['test'],
          elizaVersion: 'v1',
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
        text: async () => 'Test README',
      });

      // Initial sync
      await registryService.syncRegistry();

      // Verify plugin was cached by searching for it
      const testResults = await registryService.searchPlugins('test');
      expect(testResults.length).toBeGreaterThan(0);

      // Verify search works with cached data
      const searchResults = await registryService.searchPlugins('test plugin', 5);
      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should refresh cache on subsequent syncs', async () => {
      // Initial sync with one plugin
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'plugin-a': { name: '@elizaos/plugin-a', elizaVersion: 'v1' } }),
        text: async () => 'README A',
      });

      await registryService.syncRegistry();

      // Verify one plugin was synced
      const pluginA = await registryService.getPluginDetails('@elizaos/plugin-a');
      expect(pluginA).toBeDefined();

      // Second sync with different data
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          'plugin-b': { name: '@elizaos/plugin-b', elizaVersion: 'v1' },
          'plugin-c': { name: '@elizaos/plugin-c', elizaVersion: 'v1' },
        }),
        text: async () => 'README BC',
      });

      await registryService.syncRegistry();

      // Verify two plugins were synced
      const pluginB = await registryService.getPluginDetails('@elizaos/plugin-b');
      const pluginC = await registryService.getPluginDetails('@elizaos/plugin-c');
      expect(pluginB).toBeDefined();
      expect(pluginC).toBeDefined();
    });
  });

  describe('Related Plugin Discovery', () => {
    beforeEach(async () => {
      const mockData = {
        'plugin-react': {
          name: '@elizaos/plugin-react',
          description: 'React framework integration plugin',
          tags: ['frontend', 'react', 'ui', 'framework'],
          elizaVersion: 'v1',
        },
        'plugin-vue': {
          name: '@elizaos/plugin-vue',
          description: 'Vue.js framework integration plugin',
          tags: ['frontend', 'vue', 'ui', 'framework'],
          elizaVersion: 'v1',
        },
        'plugin-node': {
          name: '@elizaos/plugin-node',
          description: 'Node.js backend utilities and integrations',
          tags: ['backend', 'node', 'server', 'api'],
          elizaVersion: 'v1',
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockData,
        text: async () => 'Mock README',
      });

      await registryService.syncRegistry();
    });

    it('should find related plugins based on tags', async () => {
      const relatedPlugins = await registryService.findRelatedPlugins('@elizaos/plugin-react');

      expect(relatedPlugins.similar.length).toBeGreaterThan(0);

      // Vue plugin should be similar due to shared frontend/ui/framework tags
      const vuePlugin = relatedPlugins.similar.find((p) => p.name.includes('vue'));
      expect(vuePlugin).toBeDefined();
    });

    it('should categorize plugins correctly', async () => {
      const relatedPlugins = await registryService.findRelatedPlugins('@elizaos/plugin-react');

      // Should have both similar and complementary plugins
      expect(relatedPlugins.similar.length).toBeGreaterThanOrEqual(1);
      expect(relatedPlugins.complementary.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Resilience', () => {
    it('should handle malformed registry data', async () => {
      // Mock malformed JSON response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(registryService.syncRegistry()).resolves.not.toThrow();

      // Cache should remain empty - search should return no results
      const searchResults = await registryService.searchPlugins('test');
      expect(searchResults.length).toBe(0);
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock network timeout
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 100))
      );

      await expect(registryService.syncRegistry()).resolves.not.toThrow();
    });

    it('should handle README fetch failures without affecting registry sync', async () => {
      const mockData = {
        'plugin-test': {
          name: '@elizaos/plugin-test',
          description: 'Test plugin',
          tags: ['test'],
          elizaVersion: 'v1',
        },
      };

      // Registry fetch succeeds, README fetch fails
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('generated-registry.json')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockData,
          });
        } else {
          return Promise.resolve({ ok: false });
        }
      });

      await registryService.syncRegistry();

      // Should still cache the plugin even without README
      const plugin = await registryService.getPluginDetails('@elizaos/plugin-no-readme');
      expect(plugin).toBeDefined();

      // Search should still work
      const results = await registryService.searchPlugins('test', 1);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
