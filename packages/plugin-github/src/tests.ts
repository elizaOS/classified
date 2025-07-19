import {
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  Service,
} from '@elizaos/core';
import { GitHubService } from './services/github';
import {
  getRepositoryAction,
  listRepositoriesAction,
  searchRepositoriesAction,
} from './actions/repository';
import { getGitHubActivityAction, getGitHubRateLimitAction } from './actions/activity';
import intelligentAnalysisTestSuite from './__tests__/e2e/intelligent-analysis.test';

// Helper function to create valid UUID-like IDs
const createTestId = () =>
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' as `${string}-${string}-${string}-${string}-${string}`;

// Helper function to ensure GitHub service is available
async function ensureGitHubService(runtime: IAgentRuntime): Promise<GitHubService> {
  let githubService = runtime.getService<GitHubService>('github');

  if (!githubService) {
    logger.info('GitHub service not found, attempting to start it...');

    try {
      // Try to start the service manually
      const newService = await GitHubService.start(runtime);
      logger.info('GitHub service started successfully');

      // Try to access the runtime's internal service map
      const runtimeAny = runtime as any;

      // Check various possible service map locations
      if (runtimeAny._services && runtimeAny._services instanceof Map) {
        logger.info('Found _services map, registering service...');
        runtimeAny._services.set('github', newService);
      } else if (runtimeAny.services && runtimeAny.services instanceof Map) {
        logger.info('Found services map, registering service...');
        runtimeAny.services.set('github', newService);
      } else if (runtimeAny.serviceRegistry && runtimeAny.serviceRegistry instanceof Map) {
        logger.info('Found serviceRegistry map, registering service...');
        runtimeAny.serviceRegistry.set('github', newService);
      } else {
        logger.info('No service map found, overriding getService method...');
        // Override getService for this test run
        const originalGetService = runtime.getService.bind(runtime);
        runtime.getService = function <T extends Service = Service>(
          serviceNameOrClass?:
            | string
            | { new (...args: any[]): T; serviceName?: string; serviceType?: string }
        ): T | null {
          if (typeof serviceNameOrClass === 'string') {
            if (
              serviceNameOrClass === 'github' ||
              serviceNameOrClass === GitHubService.serviceType
            ) {
              return newService as unknown as T;
            }
            return originalGetService(serviceNameOrClass) as T | null;
          } else if (
            serviceNameOrClass &&
            'serviceType' in serviceNameOrClass &&
            serviceNameOrClass.serviceType === GitHubService.serviceType
          ) {
            return newService as unknown as T;
          }
          return originalGetService(serviceNameOrClass as any) as T | null;
        } as any;
      }

      // Verify it's accessible
      githubService = runtime.getService('github') as GitHubService;
      if (!githubService) {
        throw new Error('Failed to register GitHub service in runtime');
      }

      logger.info('GitHub service successfully registered and accessible');
      return githubService;
    } catch (error) {
      logger.error('Failed to ensure GitHub service:', error);
      throw error;
    }
  }

  return githubService;
}

export const githubPluginTestSuite = {
  name: 'github_plugin_test_suite',
  description: 'E2E tests for GitHub plugin functionality',
  tests: [
    {
      name: 'github_service_initialization_test',
      fn: async (runtime: IAgentRuntime) => {
        try {
          const githubService = await ensureGitHubService(runtime);

          if (!githubService) {
            throw new Error('GitHub service is not available in runtime');
          }

          // Verify service has required methods
          if (typeof githubService.getRepository !== 'function') {
            throw new Error('GitHub service missing getRepository method');
          }

          if (typeof githubService.getRateLimit !== 'function') {
            throw new Error('GitHub service missing getRateLimit method');
          }

          logger.info('✅ GitHub service initialized successfully with all required methods');
        } catch (error) {
          logger.error('❌ GitHub service initialization test failed:', error);
          throw error;
        }
      },
    },
    {
      name: 'get_repository_action_test',
      fn: async (runtime: IAgentRuntime) => {
        try {
          // Ensure service is available
          await ensureGitHubService(runtime);

          const action = getRepositoryAction;
          const testMemory: Memory = {
            id: createTestId(),
            entityId: createTestId(),
            agentId: runtime.agentId,
            roomId: createTestId(),
            createdAt: Date.now(),
            content: {
              text: 'Get information about octocat/Hello-World repository',
              source: 'test',
            },
          };

          const testState: State = {
            values: {},
            data: {
              owner: 'octocat',
              repo: 'Hello-World',
            },
            text: '',
          };

          // Validate action first
          const isValid = await action.validate(runtime, testMemory, testState);
          if (!isValid) {
            throw new Error('Action validation failed');
          }

          // Execute the action with proper error handling
          let result: any;

          try {
            result = await action.handler(
              runtime,
              testMemory,
              testState,
              { owner: 'octocat', repo: 'Hello-World' },
              async (_response) => {
                logger.info('Action response:', _response);
                return [];
              },
              []
            );
          } catch (actionError) {
            logger.error('Error in GET_GITHUB_REPOSITORY action:', actionError);
            throw actionError;
          }

          if (!result) {
            throw new Error('No result returned from action');
          }

          if (!result.values?.repository) {
            logger.error('Result values:', result.values);
            throw new Error('Repository information not found in response');
          }

          logger.info('✅ Get repository action test passed');
        } catch (error) {
          logger.error('❌ Get repository action test failed:', error);
          throw error;
        }
      },
    },
    {
      name: 'github_rate_limit_check_test',
      fn: async (runtime: IAgentRuntime) => {
        try {
          // Ensure service is available
          await ensureGitHubService(runtime);

          const action = getGitHubRateLimitAction;
          const testMemory: Memory = {
            id: createTestId(),
            entityId: createTestId(),
            agentId: runtime.agentId,
            roomId: createTestId(),
            createdAt: Date.now(),
            content: {
              text: 'Check GitHub API rate limit',
              source: 'test',
            },
          };

          const testState: State = {
            values: {},
            data: {},
            text: '',
          };

          // Execute the action
          let result: any;

          try {
            result = await action.handler(
              runtime,
              testMemory,
              testState,
              {},
              async (_response) => {
                logger.info('Rate limit response:', _response);
                return [];
              },
              []
            );
          } catch (actionError) {
            logger.error('Error in GET_GITHUB_RATE_LIMIT action:', actionError);
            throw actionError;
          }

          if (!result) {
            throw new Error('No result returned from rate limit action');
          }

          if (!result.values?.rateLimit) {
            logger.error('Result values:', result.values);
            throw new Error('Rate limit information not found in response');
          }

          logger.info('✅ GitHub rate limit check test passed');
        } catch (error) {
          logger.error('❌ GitHub rate limit check test failed:', error);
          throw error;
        }
      },
    },
    {
      name: 'providers_integration_test',
      fn: async (runtime: IAgentRuntime) => {
        try {
          const providers = runtime.providers || [];
          const githubProviders = providers.filter(
            (p: any) => p.name && p.name.toLowerCase().includes('github')
          );

          if (githubProviders.length === 0) {
            throw new Error('No GitHub providers found in runtime');
          }

          logger.info(
            `Found ${githubProviders.length} GitHub providers: ${githubProviders.map((p: any) => p.name).join(', ')}`
          );
          logger.info('✅ Providers integration test passed');
        } catch (error) {
          logger.error('❌ Providers integration test failed:', error);
          throw error;
        }
      },
    },
    // Complex Runtime Scenarios - Action Chaining
    {
      name: 'complex_scenario_repository_analysis',
      fn: async (runtime: IAgentRuntime) => {
        try {
          logger.info('Starting complex scenario: Repository Analysis Workflow');

          // Ensure service is available
          await ensureGitHubService(runtime);

          // Step 1: Search for popular TypeScript repositories
          logger.info('Step 1: Searching for popular TypeScript repositories...');
          const searchMemory: Memory = {
            id: createTestId(),
            entityId: createTestId(),
            agentId: runtime.agentId,
            roomId: createTestId(),
            createdAt: Date.now(),
            content: {
              text: 'Search for popular TypeScript repositories with more than 1000 stars',
              source: 'test',
            },
          };

          const searchState: State = {
            values: {},
            data: {
              query: 'language:typescript stars:>1000',
              sort: 'stars',
              order: 'desc',
              per_page: 5,
            },
            text: '',
          };

          // Execute repository search
          const searchAction = searchRepositoriesAction;
          const searchResult = await searchAction.handler(
            runtime,
            searchMemory,
            searchState,
            {
              query: 'language:typescript stars:>1000',
              sort: 'stars' as const,
              limit: 5,
            },
            async (_response) => {
              logger.info('Search response received');
              return [];
            },
            []
          );

          if (
            !searchResult ||
            typeof searchResult === 'boolean' ||
            !searchResult.values?.repositories
          ) {
            throw new Error('Repository search failed');
          }

          logger.info(`Found ${searchResult.values.totalCount} repositories`);

          // Step 2: Get detailed information about the first repository
          if (searchResult.values.repositories && searchResult.values.repositories.length > 0) {
            const firstRepo = searchResult.values.repositories[0];
            logger.info(`Step 2: Getting details for repository: ${firstRepo.full_name}`);

            const detailsMemory: Memory = {
              id: createTestId(),
              entityId: createTestId(),
              agentId: runtime.agentId,
              roomId: createTestId(),
              createdAt: Date.now(),
              content: {
                text: `Get detailed information about ${firstRepo.full_name}`,
                source: 'test',
              },
            };

            const detailsState: State = {
              values: {},
              data: {
                owner: firstRepo.owner.login,
                repo: firstRepo.name,
              },
              text: '',
            };

            const detailsResult = await getRepositoryAction.handler(
              runtime,
              detailsMemory,
              detailsState,
              { owner: firstRepo.owner.login, repo: firstRepo.name },
              async (_response) => {
                logger.info('Repository details received');
                return [];
              },
              []
            );

            if (
              !detailsResult ||
              typeof detailsResult === 'boolean' ||
              !detailsResult.values?.repository
            ) {
              throw new Error('Failed to get repository details');
            }

            // Step 3: Check rate limit after operations
            logger.info('Step 3: Checking API rate limit...');
            const rateLimitResult = await getGitHubRateLimitAction.handler(
              runtime,
              {
                id: createTestId(),
                entityId: createTestId(),
                agentId: runtime.agentId,
                roomId: createTestId(),
                createdAt: Date.now(),
                content: { text: 'Check rate limit', source: 'test' },
              },
              { values: {}, data: {}, text: '' },
              {},
              async () => [],
              []
            );

            if (
              !rateLimitResult ||
              typeof rateLimitResult === 'boolean' ||
              !rateLimitResult.values?.rateLimit
            ) {
              throw new Error('Failed to check rate limit');
            }

            logger.info(
              `Rate limit: ${rateLimitResult.values.rateLimit.remaining}/${rateLimitResult.values.rateLimit.limit}`
            );
          }

          logger.info('✅ Complex scenario: Repository Analysis Workflow completed successfully');
        } catch (error) {
          logger.error('❌ Complex scenario failed:', error);
          throw error;
        }
      },
    },
    {
      name: 'complex_scenario_issue_workflow',
      fn: async (runtime: IAgentRuntime) => {
        try {
          logger.info('Starting complex scenario: Issue Management Workflow');

          // Ensure service is available
          await ensureGitHubService(runtime);

          // Step 1: Get activity to see what repositories we're working with
          logger.info('Step 1: Getting recent GitHub activity...');
          const activityResult = await getGitHubActivityAction.handler(
            runtime,
            {
              id: createTestId(),
              entityId: createTestId(),
              agentId: runtime.agentId,
              roomId: createTestId(),
              createdAt: Date.now(),
              content: { text: 'Show my GitHub activity', source: 'test' },
            },
            { values: {}, data: {}, text: '' },
            { limit: 10 },
            async () => [],
            []
          );

          if (!activityResult) {
            throw new Error('Failed to get activity');
          }

          logger.info('Activity retrieved successfully');

          // Step 2: List repositories (simulating finding a repo to work with)
          logger.info('Step 2: Listing available repositories...');
          const listReposAction = listRepositoriesAction;
          await listReposAction.handler(
            runtime,
            {
              id: createTestId(),
              entityId: createTestId(),
              agentId: runtime.agentId,
              roomId: createTestId(),
              createdAt: Date.now(),
              content: { text: 'List my repositories', source: 'test' },
            },
            { values: {}, data: {}, text: '' },
            { type: 'all', sort: 'updated', per_page: 5 },
            async () => [],
            []
          );

          // Step 3: Chain multiple operations in sequence
          logger.info('Step 3: Performing repository health check...');

          // Check rate limit multiple times to simulate real usage
          const rateLimitChecks: any[] = [];
          for (let i = 0; i < 3; i++) {
            const check = await getGitHubRateLimitAction.handler(
              runtime,
              {
                id: createTestId(),
                entityId: createTestId(),
                agentId: runtime.agentId,
                roomId: createTestId(),
                createdAt: Date.now(),
                content: { text: `Rate limit check ${i + 1}`, source: 'test' },
              },
              { values: {}, data: {}, text: '' },
              {},
              async () => [],
              []
            );
            if (check && typeof check !== "boolean") { if (check && typeof check !== "boolean" && "values" in check) {
              rateLimitChecks.push(check);
            } }

            // Small delay to simulate real-world usage
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          logger.info(`Performed ${rateLimitChecks.length} rate limit checks`);
          logger.info('✅ Complex scenario: Issue Management Workflow completed successfully');
        } catch (error) {
          logger.error('❌ Complex scenario failed:', error);
          throw error;
        }
      },
    },
    {
      name: 'complex_scenario_multi_repository_analysis',
      fn: async (runtime: IAgentRuntime) => {
        try {
          logger.info('Starting complex scenario: Multi-Repository Analysis');

          // Ensure service is available
          await ensureGitHubService(runtime);

          // Analyze multiple repositories in parallel
          const repoTargets = [
            { owner: 'facebook', repo: 'react' },
            { owner: 'vuejs', repo: 'vue' },
            { owner: 'angular', repo: 'angular' },
          ];

          logger.info('Analyzing multiple repositories in parallel...');

          const analysisPromises = repoTargets.map(async (target) => {
            const memory: Memory = {
              id: createTestId(),
              entityId: createTestId(),
              agentId: runtime.agentId,
              roomId: createTestId(),
              createdAt: Date.now(),
              content: {
                text: `Analyze ${target.owner}/${target.repo}`,
                source: 'test',
              },
            };

            const state: State = {
              values: {},
              data: target,
              text: '',
            };

            try {
              const result = await getRepositoryAction.handler(
                runtime,
                memory,
                state,
                target,
                async (_response) => {
                  logger.info(`Analysis complete for ${target.owner}/${target.repo}`);
                  return [];
                },
                []
              );

              return { target, result, success: true };
            } catch (error) {
              return { target, error, success: false };
            }
          });

          const results = await Promise.all(analysisPromises);

          const successful = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success).length;

          logger.info(`Analysis complete: ${successful} successful, ${failed} failed`);

          if (failed > 0) {
            throw new Error(`Some repository analyses failed: ${failed} out of ${results.length}`);
          }

          // Final rate limit check
          const finalRateLimit = await getGitHubRateLimitAction.handler(
            runtime,
            {
              id: createTestId(),
              entityId: createTestId(),
              agentId: runtime.agentId,
              roomId: createTestId(),
              createdAt: Date.now(),
              content: { text: 'Final rate limit check', source: 'test' },
            },
            { values: {}, data: {}, text: '' },
            {},
            async () => [],
            []
          );

          if (finalRateLimit && typeof finalRateLimit !== 'boolean') {
            logger.info(
              `Final rate limit: ${finalRateLimit.values?.rateLimit?.remaining} remaining`
            );
          }
          logger.info('✅ Complex scenario: Multi-Repository Analysis completed successfully');
        } catch (error) {
          logger.error('❌ Complex scenario failed:', error);
          throw error;
        }
      },
    },
    {
      name: 'complex_scenario_state_persistence',
      fn: async (runtime: IAgentRuntime) => {
        try {
          logger.info('Starting complex scenario: State Persistence and Context');

          // Ensure service is available
          const githubService = await ensureGitHubService(runtime);

          // Build up state through multiple operations
          const state: State = {
            values: {},
            data: {},
            text: '',
            github: {
              repositories: {},
              issues: {},
              pullRequests: {},
              activityStats: { total: 0, success: 0, failed: 0 },
            },
          };

          // Step 1: Get a repository and add to state
          logger.info('Step 1: Building repository context...');
          const repoResult = await getRepositoryAction.handler(
            runtime,
            {
              id: createTestId(),
              entityId: createTestId(),
              agentId: runtime.agentId,
              roomId: createTestId(),
              createdAt: Date.now(),
              content: { text: 'Get octocat/Hello-World', source: 'test' },
            },
            state,
            { owner: 'octocat', repo: 'Hello-World' },
            async () => [],
            []
          );

          if (repoResult && typeof repoResult !== 'boolean' && repoResult.values?.repository) {
            state.github!.lastRepository = repoResult.values.repository;
            state.github!.repositories!['octocat/Hello-World'] = repoResult.values.repository;
            state.github!.activityStats!.total++;
            state.github!.activityStats!.success++;
          }

          // Step 2: Use providers to get context from state
          logger.info('Step 2: Testing providers with built-up state...');
          const providers = runtime.providers || [];
          const repoProvider = providers.find((p: any) => p.name === 'GITHUB_REPOSITORY_CONTEXT');

          if (repoProvider) {
            const providerResult = await repoProvider.get(
              runtime,
              {
                id: createTestId(),
                entityId: createTestId(),
                agentId: runtime.agentId,
                roomId: createTestId(),
                createdAt: Date.now(),
                content: { text: 'Get context', source: 'test' },
              },
              state
            );

            if (!providerResult.text || !providerResult.text.includes('octocat/Hello-World')) {
              throw new Error('Provider did not return expected repository context');
            }

            logger.info('Provider successfully returned repository context from state');
          }

          // Step 3: Activity tracking
          logger.info('Step 3: Verifying activity tracking...');
          const activityLog = githubService.getActivityLog(10);

          if (activityLog.length === 0) {
            throw new Error('No activity logged despite operations');
          }

          logger.info(`Activity log contains ${activityLog.length} entries`);

          // Step 4: Multiple operations to test state accumulation
          logger.info('Step 4: Testing state accumulation through multiple operations...');

          // Perform several rate limit checks
          for (let i = 0; i < 3; i++) {
            await getGitHubRateLimitAction.handler(
              runtime,
              {
                id: createTestId(),
                entityId: createTestId(),
                agentId: runtime.agentId,
                roomId: createTestId(),
                createdAt: Date.now(),
                content: { text: `Rate check ${i}`, source: 'test' },
              },
              state,
              {},
              async () => [],
              []
            );

            state.github!.activityStats!.total++;
            state.github!.activityStats!.success++;
          }

          // Verify final state
          if (state.github!.activityStats!.total < 4) {
            throw new Error('State was not properly accumulated through operations');
          }

          logger.info(`Final state: ${state.github!.activityStats!.total} total operations`);
          logger.info('✅ Complex scenario: State Persistence and Context completed successfully');
        } catch (error) {
          logger.error('❌ Complex scenario failed:', error);
          throw error;
        }
      },
    },
  ],
};

// Export the test suites
export const GitHubPluginTestSuite = githubPluginTestSuite;
export const GitHubIntelligentAnalysisTestSuite = intelligentAnalysisTestSuite;

// Combined test suites for comprehensive testing
export const AllGitHubTestSuites = [githubPluginTestSuite, intelligentAnalysisTestSuite];

// Default export for compatibility
export default githubPluginTestSuite;
