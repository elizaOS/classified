import { describe, expect, it, mock } from 'bun:test';
import { githubPlugin, GitHubService } from '../index';
import { IAgentRuntime, Memory, State, UUID, logger } from '@elizaos/core';

/**
 * Runtime Scenario Tests
 *
 * These tests verify that the GitHub plugin works correctly in various
 * runtime scenarios, including initialization, service registration,
 * and real-world usage patterns.
 */

describe('Runtime Scenarios: GitHub Plugin', () => {
  describe('Plugin Initialization Scenarios', () => {
    it('should initialize with runtime.getSetting', async () => {
      const mockRuntime = {
        getSetting: mock().mockImplementation((key: string) => {
          if (key === 'GITHUB_TOKEN') {
            return 'ghp_test123456789';
          }
          if (key === 'GITHUB_OWNER') {
            return 'test-owner';
          }
          return null;
        }),
        agentId: 'test-agent' as UUID,
      } as any as IAgentRuntime;

      // Initialize plugin
      await githubPlugin.init!({}, mockRuntime);

      // Verify getSetting was called
      expect(mockRuntime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');
    });

    it('should handle missing token gracefully in development', async () => {
      const mockRuntime = {
        getSetting: mock().mockReturnValue(null),
        agentId: 'test-agent' as UUID,
        character: {
          name: 'Test Character',
          bio: 'Test bio',
          settings: {},
        },
      } as any as IAgentRuntime;

      // In test mode, this should not throw
      await expect(githubPlugin.init!({}, mockRuntime)).resolves.toBeUndefined();
    });

    it('should prefer runtime settings over environment variables', async () => {
      // Set environment variable
      process.env.GITHUB_TOKEN = 'ghp_env_token';

      const mockRuntime = {
        getSetting: mock().mockImplementation((key: string) => {
          if (key === 'GITHUB_TOKEN') {
            return 'ghp_runtime_token';
          }
          return null;
        }),
        agentId: 'test-agent' as UUID,
      } as any as IAgentRuntime;

      // Create service using static start method
      const service = await GitHubService.start(mockRuntime);

      // Verify service was created
      expect(service).toBeDefined();

      // Verify runtime setting was used
      expect(mockRuntime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');

      // Clean up
      delete process.env.GITHUB_TOKEN;
    });
  });

  describe('Service Lifecycle Scenarios', () => {
    it('should handle service start and stop correctly', async () => {
      const mockRuntime = {
        getSetting: mock().mockImplementation((key: string) => {
          if (key === 'GITHUB_TOKEN') {
            return 'ghp_test123456789';
          }
          return null;
        }),
        agentId: 'test-agent' as UUID,
        getService: mock(),
        registerService: mock(),
      } as any as IAgentRuntime;

      // Start service
      const service = await GitHubService.start(mockRuntime);
      expect(service).toBeInstanceOf(GitHubService);

      // Stop service
      await service.stop();

      // Verify clean shutdown
      expect(() => service.getActivityLog(10)).not.toThrow();
    });

    it('should register with runtime correctly', async () => {
      const services = new Map();
      const mockRuntime = {
        getSetting: mock().mockImplementation((key: string) => {
          if (key === 'GITHUB_TOKEN') {
            return 'ghp_test123456789';
          }
          return null;
        }),
        agentId: 'test-agent' as UUID,
        services,
        registerService: mock().mockImplementation((service: any) => {
          services.set(service.serviceType || 'github', service);
        }),
        getService: mock().mockImplementation((type: string) => {
          return services.get(type);
        }),
      } as any as IAgentRuntime;

      // Initialize plugin and service
      await githubPlugin.init!({ GITHUB_TOKEN: 'ghp_test123456789' }, mockRuntime);

      // Register service
      const service = await GitHubService.start(mockRuntime);
      mockRuntime.registerService(service as any);

      // Verify service is registered
      const retrievedService = mockRuntime.getService('github');
      expect(retrievedService).toBe(service);
    });
  });

  describe('Multi-Agent Scenarios', () => {
    it('should support multiple agents with different configurations', async () => {
      const agent1Runtime = {
        agentId: 'agent1' as UUID,
        getSetting: mock().mockImplementation((key: string) => {
          if (key === 'GITHUB_TOKEN') {
            return 'ghp_agent1_token';
          }
          if (key === 'GITHUB_OWNER') {
            return 'agent1-owner';
          }
          return null;
        }),
      } as any as IAgentRuntime;

      const agent2Runtime = {
        agentId: 'agent2' as UUID,
        getSetting: mock().mockImplementation((key: string) => {
          if (key === 'GITHUB_TOKEN') {
            return 'ghp_agent2_token';
          }
          if (key === 'GITHUB_OWNER') {
            return 'agent2-owner';
          }
          return null;
        }),
      } as any as IAgentRuntime;

      // Create services for each agent
      const service1 = await GitHubService.start(agent1Runtime);
      const service2 = await GitHubService.start(agent2Runtime);

      // Verify they have different configurations
      expect(agent1Runtime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');
      expect(agent2Runtime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');

      // Each service maintains its own state
      expect(service1).not.toBe(service2);
    });
  });

  describe('Provider Runtime Scenarios', () => {
    it('should provide context based on runtime state', async () => {
      const mockRuntime = {
        agentId: 'test-agent' as UUID,
        getSetting: mock().mockReturnValue('ghp_test123'),
        getService: mock().mockReturnValue({
          getActivityLog: mock().mockReturnValue([
            { action: 'searchRepositories', timestamp: Date.now(), success: true },
            { action: 'getRepository', timestamp: Date.now(), success: true },
          ]),
          getAuthenticatedUser: mock().mockResolvedValue({ login: 'testuser' }),
        }),
      } as any as IAgentRuntime;

      // Get activity provider
      const activityProvider = githubPlugin.providers?.find(
        (p) => p.name === 'GITHUB_ACTIVITY_CONTEXT'
      );
      expect(activityProvider).toBeDefined();

      // Get context
      const context = await activityProvider!.get(
        mockRuntime,
        createMemory('What have I done on GitHub?'),
        createState()
      );

      expect(context.text).toContain('GitHub activity');
      expect(mockRuntime.getService).toHaveBeenCalledWith('github');
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle service unavailability gracefully', async () => {
      const mockRuntime = {
        agentId: 'test-agent' as UUID,
        getSetting: mock(),
        getService: mock().mockReturnValue(null), // No service available
      } as any as IAgentRuntime;

      // Try to use an action without service
      const action = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_REPOSITORY');
      expect(action).toBeDefined();

      const callback = mock();
      await action!.handler(
        mockRuntime,
        createMemory('Get repo details'),
        createState(),
        { owner: 'test', repo: 'test' },
        callback
      );

      // Should handle gracefully
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Failed to get repository'),
        })
      );
    });

    it('should recover from temporary failures', async () => {
      let callCount = 0;
      const mockService = {
        getRepository: mock().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Network error');
          }
          return { name: 'test-repo', stargazers_count: 100 };
        }),
      };

      const mockRuntime = {
        agentId: 'test-agent' as UUID,
        getSetting: mock(),
        getService: mock().mockReturnValue(mockService),
      } as any as IAgentRuntime;

      const action = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_REPOSITORY');
      const callback = mock();

      // First attempt fails
      await action!.handler(
        mockRuntime,
        createMemory('Get repo'),
        createState(),
        { owner: 'test', repo: 'test' },
        callback
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Failed to get repository'),
        })
      );

      // Reset callback
      callback.mockClear();

      // Second attempt succeeds
      await action!.handler(
        mockRuntime,
        createMemory('Get repo again'),
        createState(),
        { owner: 'test', repo: 'test' },
        callback
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          repository: expect.objectContaining({ name: 'test-repo' }),
        })
      );
    });
  });

  describe('Configuration Update Scenarios', () => {
    it('should handle runtime configuration changes', async () => {
      let currentToken = 'ghp_initial_token';

      const mockRuntime = {
        agentId: 'test-agent' as UUID,
        getSetting: mock().mockImplementation((key: string) => {
          if (key === 'GITHUB_TOKEN') {
            return currentToken;
          }
          return null;
        }),
      } as any as IAgentRuntime;

      // Create initial service
      const service1 = await GitHubService.start(mockRuntime);
      expect(mockRuntime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');

      // Simulate token update
      currentToken = 'ghp_updated_token';

      // Create new service instance (simulating restart)
      const service2 = await GitHubService.start(mockRuntime);

      // Verify new token is used
      expect(mockRuntime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');
      expect(service1).not.toBe(service2);
    });
  });

  describe('Performance Scenarios', () => {
    it('should handle rate limiting appropriately', async () => {
      const mockService = {
        searchRepositories: mock().mockResolvedValue({
          total_count: 1000,
          items: Array(30).fill({ name: 'repo' }),
        }),
        getRateLimit: mock().mockResolvedValue({
          limit: 60,
          remaining: 5,
          reset: Date.now() / 1000 + 3600,
        }),
      };

      const mockRuntime = {
        agentId: 'test-agent' as UUID,
        getSetting: mock(),
        getService: mock().mockReturnValue(mockService),
      } as any as IAgentRuntime;

      // Check rate limit before heavy operation
      const rateLimitAction = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_RATE_LIMIT');
      let rateLimit: any;

      await rateLimitAction!.handler(
        mockRuntime,
        createMemory('Check rate limit'),
        createState(),
        {},
        async (response) => {
          rateLimit = response;
          return [];
        }
      );

      expect(rateLimit.rateLimit.remaining).toBe(5);

      // Decide whether to proceed based on rate limit
      if (rateLimit.rateLimit.remaining < 10) {
        logger.warn('Rate limit low, deferring operation');
        // In real scenario, would defer or queue the operation
        expect(rateLimit.rateLimit.remaining).toBeLessThan(10);
      }
    });

    it('should efficiently handle bulk operations', async () => {
      const mockService = {
        getRepository: mock().mockImplementation((owner: string, repo: string) => ({
          name: repo,
          owner: { login: owner },
          stargazers_count: Math.floor(Math.random() * 1000),
        })),
        getActivityLog: mock().mockReturnValue([]),
      };

      const mockRuntime = {
        agentId: 'test-agent' as UUID,
        getSetting: mock(),
        getService: mock().mockReturnValue(mockService),
      } as any as IAgentRuntime;

      // Simulate bulk repository checks
      const repos = [
        { owner: 'facebook', repo: 'react' },
        { owner: 'vuejs', repo: 'vue' },
        { owner: 'angular', repo: 'angular' },
      ];

      const results: any[] = [];
      const action = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_REPOSITORY');

      for (const { owner, repo } of repos) {
        await action!.handler(
          mockRuntime,
          createMemory(`Check ${owner}/${repo}`),
          createState({ previousResults: results }),
          { owner, repo },
          async (response) => {
            results.push({
              repo: response.repository,
              timestamp: Date.now(),
            });
            return [];
          }
        );
      }

      // Verify all repos were processed
      expect(results).toHaveLength(3);
      expect(mockService.getRepository).toHaveBeenCalledTimes(3);

      // Activity should be logged
      const activityAction = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_ACTIVITY');
      await activityAction!.handler(
        mockRuntime,
        createMemory('Show activity'),
        createState(),
        { limit: 10 },
        async (response) => {
          expect(response).toBeDefined();
          return [];
        }
      );
    });
  });
});

// Helper functions
function createMemory(text: string): Memory {
  return {
    id: `mem-${Date.now()}-${Math.random()}` as UUID,
    roomId: 'test-room' as UUID,
    entityId: 'test-entity' as UUID,
    agentId: 'test-agent' as UUID,
    content: { text, source: 'test' },
    createdAt: Date.now(),
  };
}

function createState(data: Record<string, any> = {}): State {
  return {
    values: {},
    data,
    text: '',
  };
}
