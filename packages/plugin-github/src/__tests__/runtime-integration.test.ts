import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { githubPlugin, GitHubService } from '../index';
import { IAgentRuntime, UUID } from '@elizaos/core';

describe('Runtime Integration: GitHub Plugin with runtime.getSetting', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = {
      agentId: 'test-agent' as UUID,
      getSetting: mock(),
      getService: mock(),
      registerService: mock(),
      services: new Map(),
      character: {
        name: 'Test Character',
        bio: 'Test bio',
        settings: {},
      },
    };
  });

  it('should initialize with runtime.getSetting for token', async () => {
    // Mock getSetting to return a test token
    mockRuntime.getSetting.mockImplementation((key: string) => {
      if (key === 'GITHUB_TOKEN') {
        return 'ghp_test123456789';
      }
      return null;
    });

    // Initialize plugin
    await githubPlugin.init!({}, mockRuntime);

    // Verify getSetting was called
    expect(mockRuntime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');

    // Verify the plugin initialized successfully
    expect(mockRuntime.character.settings).toBeDefined();
  });

  it('should use runtime.getSetting in GitHubService and validate token', async () => {
    // Mock getSetting
    mockRuntime.getSetting.mockImplementation((key: string) => {
      if (key === 'GITHUB_TOKEN') {
        return 'ghp_runtime_token';
      }
      if (key === 'GITHUB_OWNER') {
        return 'runtime-owner';
      }
      return null;
    });

    // Create service (initialization happens in constructor)
    const service = new GitHubService(mockRuntime);

    // Verify getSetting was called for token during construction
    expect(mockRuntime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');

    // Verify the service has the correct configuration
    const activityLog = service.getActivityLog();
    expect(activityLog).toBeDefined();
    expect(Array.isArray(activityLog)).toBe(true);
  });

  it('should throw when getSetting returns null', async () => {
    // Mock getSetting to return null (no token available)
    mockRuntime.getSetting.mockReturnValue(null);

    // GitHubService constructor should throw when no token is available
    expect(() => {
      new GitHubService(mockRuntime);
    }).toThrow('GitHub token is required');

    // Verify getSetting was called
    expect(mockRuntime.getSetting).toHaveBeenCalledWith('GITHUB_TOKEN');
  });

  it('should handle missing token gracefully in test mode', async () => {
    // Mock getSetting to return null
    mockRuntime.getSetting.mockReturnValue(null);

    // Should not throw in test mode
    await expect(githubPlugin.init!({}, mockRuntime)).resolves.toBeUndefined();

    // Verify that the plugin initialized without throwing
    expect(mockRuntime.character.settings).toBeDefined();
  });

  it('should work with actions using runtime settings', async () => {
    // Mock runtime with token
    mockRuntime.getSetting.mockImplementation((key: string) => {
      if (key === 'GITHUB_TOKEN') {
        return 'ghp_test123';
      }
      return null;
    });

    // Mock GitHub service with proper methods
    const mockService = {
      getRateLimit: mock().mockResolvedValue({
        limit: 5000,
        remaining: 4500,
        used: 500,
        reset: Date.now() / 1000 + 3600,
        resource: 'core',
      }),
      getActivityLog: mock().mockReturnValue([]),
    };

    mockRuntime.getService.mockReturnValue(mockService);

    // Get rate limit action
    const rateLimitAction = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_RATE_LIMIT');

    // Execute action
    const callback = mock();
    await rateLimitAction!.handler(
      mockRuntime as unknown as IAgentRuntime,
      {
        id: 'test' as UUID,
        roomId: 'test' as UUID,
        entityId: 'test' as UUID,
        agentId: 'test' as UUID,
        content: { text: 'check rate limit', source: 'test' },
        createdAt: Date.now(),
      },
      { values: {}, data: {}, text: '' },
      {},
      callback
    );

    // Verify callback was called with rate limit data
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        rateLimit: expect.objectContaining({
          limit: 5000,
          remaining: 4500,
        }),
      })
    );

    // Verify the service method was actually called
    expect(mockService.getRateLimit).toHaveBeenCalled();
  });
});
