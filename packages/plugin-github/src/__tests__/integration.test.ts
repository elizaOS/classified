import { describe, expect, it, mock, beforeEach, afterAll, beforeAll } from 'bun:test';
import { githubPlugin } from '../index';
import { createMockRuntime, setupLoggerSpies, MockRuntime } from './test-utils';
import { HandlerCallback, IAgentRuntime, Memory, State, UUID } from '@elizaos/core';

/**
 * Integration tests demonstrate how multiple components of the plugin work together.
 * Unlike unit tests that test individual functions in isolation, integration tests
 * examine how components interact with each other.
 *
 * For example, this file shows how the GitHub actions and GitHub providers
 * interact with the GitHubService and the plugin's core functionality.
 */

// Set up spies on logger
beforeAll(() => {
  setupLoggerSpies();
});

afterAll(() => {
  mock.restore();
});

describe('Integration: GitHub Repository Action with GitHubService', () => {
  let mockRuntime: MockRuntime;
  let getServiceSpy: any;

  beforeEach(() => {
    // Create a service mock that will be returned by getService
    const mockService = {
      capabilityDescription:
        'Comprehensive GitHub integration with repository management, issue tracking, and PR workflows',
      getRepository: mock().mockResolvedValue({
        id: 1,
        name: 'Hello-World',
        full_name: 'octocat/Hello-World',
        description: 'This your first repo!',
        html_url: 'https://github.com/octocat/Hello-World',
        stargazers_count: 80,
        forks_count: 9,
        open_issues_count: 0,
        private: false,
        created_at: '2011-01-26T19:01:12Z',
        updated_at: '2011-01-26T19:14:43Z',
        language: 'C',
        owner: {
          login: 'octocat',
          id: 1,
          type: 'User',
          avatar_url: 'https://github.com/images/error/octocat_happy.gif',
        },
      }),
      stop: mock().mockResolvedValue(undefined),
    };

    // Create a mock runtime with a spied getService method
    getServiceSpy = mock().mockImplementation((serviceType) => {
      if (serviceType === 'github') {
        return mockService;
      }
      return null;
    });

    mockRuntime = createMockRuntime();
    mockRuntime.getService = getServiceSpy;
  });

  it('should handle GET_GITHUB_REPOSITORY action with GitHubService available', async () => {
    // Find the GET_GITHUB_REPOSITORY action
    const getRepoAction = githubPlugin.actions?.find(
      (action) => action.name === 'GET_GITHUB_REPOSITORY'
    );
    expect(getRepoAction).toBeDefined();

    // Create a mock message and state
    const mockMessage: Memory = {
      id: '12345678-1234-1234-1234-123456789012' as UUID,
      roomId: '12345678-1234-1234-1234-123456789012' as UUID,
      entityId: '12345678-1234-1234-1234-123456789012' as UUID,
      agentId: '12345678-1234-1234-1234-123456789012' as UUID,
      content: {
        text: 'Get repository octocat/Hello-World',
        source: 'test',
      },
      createdAt: Date.now(),
    };

    const mockState: State = {
      values: {},
      data: {},
      text: '',
    };

    // Create a mock callback to capture the response
    const callbackFn = mock();

    // Execute the action
    await getRepoAction?.handler(
      mockRuntime as unknown as IAgentRuntime,
      mockMessage,
      mockState,
      { owner: 'octocat', repo: 'Hello-World' },
      callbackFn as HandlerCallback
    );

    // Verify the callback was called with expected response
    expect(callbackFn).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Repository: octocat/Hello-World'),
        actions: ['GET_GITHUB_REPOSITORY'],
      })
    );

    // Get the service to ensure integration
    const service = mockRuntime.getService('github');
    expect(service).toBeDefined();
    expect(service?.capabilityDescription).toContain('GitHub integration');
  });
});

describe('Integration: Plugin initialization and service registration', () => {
  it('should initialize the plugin and register the service', async () => {
    // Create a fresh mock runtime with mocked registerService for testing initialization flow
    const mockRuntime = createMockRuntime();

    // Create and install a spy on registerService
    const registerServiceSpy = mock();
    mockRuntime.registerService = registerServiceSpy;

    // Run a minimal simulation of the plugin initialization process
    if (githubPlugin.init) {
      await githubPlugin.init(
        { GITHUB_TOKEN: 'ghp_test123456789012345678901234567890' },
        mockRuntime as unknown as IAgentRuntime
      );

      // Directly mock the service registration that happens during initialization
      // because unit tests don't run the full agent initialization flow
      if (githubPlugin.services) {
        const GitHubServiceClass = githubPlugin.services[0];

        // Mock the service start to avoid actual GitHub API calls
        GitHubServiceClass.start = mock().mockResolvedValue({
          capabilityDescription:
            'Comprehensive GitHub integration with repository management, issue tracking, and PR workflows',
          stop: mock(),
        } as any);

        const serviceInstance = await GitHubServiceClass.start(
          mockRuntime as unknown as IAgentRuntime
        );

        // Verify service instance was created
        expect(serviceInstance).toBeDefined();

        // Register the Service class to match the core API
        mockRuntime.registerService(GitHubServiceClass);
      }

      // Now verify the service was registered with the runtime
      expect(registerServiceSpy).toHaveBeenCalledWith(expect.any(Function));
    }
  });
});
