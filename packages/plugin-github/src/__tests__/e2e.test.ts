import { describe, expect, it, mock, afterAll, beforeAll } from 'bun:test';
import { githubPlugin, GitHubService } from '../index';
import { createMockRuntime, setupLoggerSpies } from './test-utils';
import { HandlerCallback, IAgentRuntime, Memory, State, UUID, logger } from '@elizaos/core';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * End-to-End tests for the GitHub plugin
 *
 * These tests require a real GitHub Personal Access Token (PAT) to be set in the environment.
 * Set GITHUB_TOKEN or GITHUB_TOKEN in your .env file to run these tests.
 *
 * WARNING: These tests will interact with real GitHub repositories!
 * Use a test account or organization to avoid affecting production repositories.
 */

// Skip E2E tests if no GitHub token is available
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;

// Skip these tests unless a real GitHub token is provided
const hasGitHubToken = !!process.env.GITHUB_TOKEN;
const describeWithToken = hasGitHubToken ? describe : describe.skip;

describeWithToken('E2E: GitHub Plugin with Real GitHub API', () => {
  let runtime: IAgentRuntime;
  let githubService: GitHubService;
  const createdRepos: string[] = [];

  beforeAll(async () => {
    setupLoggerSpies();

    // Create a real runtime with GitHub token
    runtime = {
      ...createMockRuntime(),
      getSetting: mock().mockImplementation((key: string) => {
        if (key === 'GITHUB_TOKEN' || key === 'GITHUB_TOKEN') {
          return GITHUB_TOKEN;
        }
        return null;
      }),
    };

    // Initialize the plugin
    await githubPlugin.init!(
      {
        GITHUB_TOKEN: GITHUB_TOKEN!,
      },
      runtime
    );

    // Start the GitHub service
    githubService = new GitHubService();

    // Register the service with the runtime
    runtime.registerService(GitHubService as any);
    runtime.getService = mock().mockImplementation((serviceType: string) => {
      if (serviceType === 'github') {
        return githubService;
      }
      return null;
    });
  });

  afterAll(async () => {
    // Clean up any test repositories created
    if (githubService && createdRepos.length > 0) {
      for (const repoName of createdRepos) {
        try {
          const owner = await githubService.getAuthenticatedUser();
          logger.info(`Cleaning up test repository: ${owner.login}/${repoName}`);
          // Note: Repository deletion requires additional permissions
          // For now, log the repositories that need manual cleanup
        } catch (error) {
          logger.error(`Failed to clean up repository ${repoName}:`, error);
        }
      }
    }

    // Stop the service
    if (githubService) {
      await githubService.stop();
    }

    mock.restore();
  });

  describe('Authentication and Service Initialization', () => {
    it('should authenticate successfully with real GitHub token', async () => {
      const isAuthenticated = await githubService.validateAuthentication();
      expect(isAuthenticated).toBe(true);
    });

    it('should get authenticated user information', async () => {
      const user = await githubService.getAuthenticatedUser();
      expect(user).toBeDefined();
      expect(user.login).toBeTruthy();
      expect(user.id).toBeGreaterThan(0);
    });

    it('should check rate limit status', async () => {
      const rateLimit = await githubService.getRateLimit();
      expect(rateLimit).toBeDefined();
      expect(rateLimit.remaining).toBeGreaterThanOrEqual(0);
      expect(rateLimit.limit).toBeGreaterThan(0);
    });
  });

  describe('Repository Operations', () => {
    it('should search for popular repositories', async () => {
      const results = await githubService.searchRepositories('javascript stars:>10000', {
        per_page: 5,
      });

      expect(results.items).toBeDefined();
      expect(results.items.length).toBeGreaterThan(0);
      expect(results.items[0].stargazers_count).toBeGreaterThan(10000);
    });

    it('should get a specific repository', async () => {
      const repo = await githubService.getRepository('microsoft', 'TypeScript');

      expect(repo).toBeDefined();
      expect(repo.name).toBe('TypeScript');
      expect(repo.owner.login).toBe('microsoft');
      expect(repo.stargazers_count).toBeGreaterThan(0);
    }, 120000); // 2 minute timeout for API calls

    it('should list user repositories', async () => {
      const user = await githubService.getAuthenticatedUser();
      const repos = await githubService.listRepositories({
        owner: user.login,
        per_page: 10,
        sort: 'updated',
      });

      expect(repos).toBeDefined();
      expect(Array.isArray(repos)).toBe(true);
    });
  });

  describe('Issue Operations', () => {
    it('should search for issues in TypeScript repository', async () => {
      const results = await githubService.searchIssues(
        'repo:microsoft/TypeScript is:issue is:open',
        {
          per_page: 5,
        }
      );

      expect(results.items).toBeDefined();
      expect(results.items.length).toBeGreaterThan(0);
      expect(results.items[0].repository_url).toContain('microsoft/TypeScript');
    });

    it('should list issues from a repository', async () => {
      const issues = await githubService.listIssues('microsoft', 'vscode', {
        state: 'open',
        per_page: 5,
        labels: 'bug',
      });

      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        expect(
          issues[0].labels.some((label: any) =>
            typeof label === 'string' ? label === 'bug' : label.name === 'bug'
          )
        ).toBe(true);
      }
    }, 120000); // 2 minute timeout for API calls
  });

  describe('Pull Request Operations', () => {
    it('should search for pull requests', async () => {
      const results = await githubService.searchPullRequests('repo:facebook/react is:pr is:open', {
        per_page: 5,
      });

      expect(results.items).toBeDefined();
      expect(results.items.length).toBeGreaterThan(0);
      expect(results.items[0].pull_request).toBeDefined();
    });

    it('should list pull requests from a repository', async () => {
      const prs = await githubService.listPullRequests('facebook', 'react', {
        state: 'open',
        per_page: 5,
      });

      expect(prs).toBeDefined();
      expect(Array.isArray(prs)).toBe(true);
    });
  });

  describe('Action Chaining Scenarios', () => {
    it('should chain actions: search repo -> get details -> list issues', async () => {
      const results: any[] = [];

      // Step 1: Search for a repository
      const searchAction = githubPlugin.actions?.find(
        (a) => a.name === 'SEARCH_GITHUB_REPOSITORIES'
      );
      expect(searchAction).toBeDefined();

      const searchCallback: HandlerCallback = (response) => {
        results.push({ step: 'search', response });
        return Promise.resolve([]);
      };

      await searchAction!.handler(
        runtime,
        createTestMemory('Search for popular TypeScript repositories'),
        createTestState(),
        { query: 'language:typescript stars:>5000', sort: 'stars', per_page: 1 },
        searchCallback
      );

      expect(searchCallback).toHaveBeenCalled();
      const searchResult = results[0].response;
      expect(searchResult.repositories).toBeDefined();
      expect(searchResult.repositories.length).toBeGreaterThan(0);

      // Step 2: Get repository details using the result from step 1
      const firstRepo = searchResult.repositories[0];
      const getRepoAction = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_REPOSITORY');
      expect(getRepoAction).toBeDefined();

      const getRepoCallback: HandlerCallback = mock(async (response) => {
        results.push({ step: 'getRepo', response });
        return [];
      });

      await getRepoAction!.handler(
        runtime,
        createTestMemory(`Get details for ${firstRepo.full_name}`),
        createTestState({
          repositories: searchResult.repositories,
          lastSearchQuery: searchResult.query,
        }),
        { owner: firstRepo.owner.login, repo: firstRepo.name },
        getRepoCallback
      );

      expect(getRepoCallback).toHaveBeenCalled();
      const repoDetails = results[1].response;
      expect(repoDetails.repository).toBeDefined();

      // Step 3: List issues from the repository
      const listIssuesAction = githubPlugin.actions?.find((a) => a.name === 'LIST_GITHUB_ISSUES');
      expect(listIssuesAction).toBeDefined();

      const listIssuesCallback: HandlerCallback = mock(async (response) => {
        results.push({ step: 'listIssues', response });
        return [];
      });

      await listIssuesAction!.handler(
        runtime,
        createTestMemory(`List open issues for ${firstRepo.full_name}`),
        createTestState({
          repository: repoDetails.repository,
          repositories: searchResult.repositories,
        }),
        {
          owner: firstRepo.owner.login,
          repo: firstRepo.name,
          state: 'open',
          per_page: 5,
        },
        listIssuesCallback
      );

      expect(listIssuesCallback).toHaveBeenCalled();
      const issuesList = results[2].response;
      expect(issuesList.issues).toBeDefined();
      expect(Array.isArray(issuesList.issues)).toBe(true);

      // Verify the chain completed successfully
      expect(results).toHaveLength(3);
      expect(results[0].step).toBe('search');
      expect(results[1].step).toBe('getRepo');
      expect(results[2].step).toBe('listIssues');
    }, 120000); // 2 minute timeout for API calls

    it('should chain actions: get rate limit -> search issues -> create issue (dry run)', async () => {
      const results: any[] = [];

      // Step 1: Check rate limit
      const rateLimitAction = githubPlugin.actions?.find((a) => a.name === 'GET_GITHUB_RATE_LIMIT');
      expect(rateLimitAction).toBeDefined();

      const rateLimitCallback: HandlerCallback = mock(async (response) => {
        results.push({ step: 'rateLimit', response });
        return [];
      });

      await rateLimitAction!.handler(
        runtime,
        createTestMemory('Check GitHub API rate limit'),
        createTestState(),
        {},
        rateLimitCallback
      );

      expect(rateLimitCallback).toHaveBeenCalled();
      const rateLimitResult = results[0].response;
      expect(rateLimitResult.rateLimit).toBeDefined();
      expect(rateLimitResult.rateLimit.remaining).toBeGreaterThan(0);

      // Step 2: Search for similar issues (to avoid duplicates)
      const searchIssuesAction = githubPlugin.actions?.find(
        (a) => a.name === 'SEARCH_GITHUB_ISSUES'
      );
      expect(searchIssuesAction).toBeDefined();

      const searchIssuesCallback: HandlerCallback = mock(async (response) => {
        results.push({ step: 'searchIssues', response });
        return [];
      });

      await searchIssuesAction!.handler(
        runtime,
        createTestMemory('Search for test-related issues in octocat/Hello-World'),
        createTestState({
          rateLimit: rateLimitResult.rateLimit,
        }),
        {
          query: 'repo:octocat/Hello-World is:issue test in:title',
          per_page: 5,
        },
        searchIssuesCallback
      );

      expect(searchIssuesCallback).toHaveBeenCalled();
      const searchIssuesResult = results[1].response;
      expect(searchIssuesResult.issues).toBeDefined();

      // Step 3: Prepare to create an issue (but don't actually create it in tests)
      // This demonstrates how the state from previous actions can be used
      const createIssueData = {
        owner: 'octocat',
        repo: 'Hello-World',
        title: `[TEST] Automated test issue - ${Date.now()}`,
        body: `This is a test issue created by ElizaOS GitHub plugin E2E tests.
        
**Rate Limit Status:**
- Remaining: ${rateLimitResult.rateLimit.remaining}
- Reset: ${new Date(rateLimitResult.rateLimit.reset * 1000).toISOString()}

**Similar Issues Found:** ${searchIssuesResult.total_count}

*Note: This is a dry run - no issue will actually be created.*`,
        labels: ['test', 'automated'],
      };

      // Log what would be created
      logger.info('Would create issue with data:', createIssueData);
      results.push({ step: 'prepareIssue', data: createIssueData });

      // Verify the chain completed successfully
      expect(results).toHaveLength(3);
      expect(results[0].step).toBe('rateLimit');
      expect(results[1].step).toBe('searchIssues');
      expect(results[2].step).toBe('prepareIssue');
    });
  });

  describe('Complex Task Scenarios', () => {
    it('should handle a complex workflow: analyze repository health', async () => {
      const targetRepo = { owner: 'facebook', repo: 'react' };
      const analysis: any = {
        repository: null,
        issues: { open: 0, closed: 0 },
        pullRequests: { open: 0, merged: 0 },
        activity: [],
      };

      // Get repository details
      const repo = await githubService.getRepository(targetRepo.owner, targetRepo.repo);
      analysis.repository = {
        name: repo.name,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
        language: repo.language,
        lastUpdated: repo.updated_at,
      };

      // Get open issues count
      const openIssues = await githubService.listIssues(targetRepo.owner, targetRepo.repo, {
        state: 'open',
        per_page: 1,
      });
      analysis.issues.open = openIssues.length;

      // Get open pull requests
      const openPRs = await githubService.listPullRequests(targetRepo.owner, targetRepo.repo, {
        state: 'open',
        per_page: 5,
      });
      analysis.pullRequests.open = openPRs.length;

      // Get activity log
      analysis.activity = githubService.getActivityLog(10);

      // Verify the analysis was completed
      expect(analysis.repository).toBeDefined();
      expect(analysis.repository.stars).toBeGreaterThan(0);
      expect(analysis.activity.length).toBeGreaterThan(0);

      logger.info('Repository health analysis:', analysis);
    });

    it('should demonstrate provider integration with actions', async () => {
      // Get the repository provider
      const repoProvider = githubPlugin.providers?.find(
        (p) => p.name === 'GITHUB_REPOSITORY_CONTEXT'
      );
      expect(repoProvider).toBeDefined();

      // Generate context about popular repositories
      const context = await repoProvider!.get(
        runtime,
        createTestMemory('Tell me about popular JavaScript frameworks'),
        createTestState()
      );

      expect(context).toBeTruthy();
      expect(context.text).toContain('Repository');

      // Now use an action based on the provider context
      const searchAction = githubPlugin.actions?.find(
        (a) => a.name === 'SEARCH_GITHUB_REPOSITORIES'
      );

      const callback: HandlerCallback = mock(async () => []);
      await searchAction!.handler(
        runtime,
        createTestMemory('Find popular JavaScript frameworks on GitHub'),
        createTestState({ recentContext: context }),
        { query: 'language:javascript framework stars:>50000', per_page: 3 },
        callback
      );

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('repositories'),
          repositories: expect.any(Array),
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent repository gracefully', async () => {
      await expect(
        githubService.getRepository('this-user-definitely-does-not-exist-12345', 'fake-repo')
      ).rejects.toThrow();
    }, 120000); // 2 minute timeout for API calls

    it('should handle rate limiting information', async () => {
      const rateLimit = await githubService.getRateLimit();

      expect(rateLimit).toBeDefined();
      expect(rateLimit.remaining).toBeGreaterThanOrEqual(0);
      expect(rateLimit.limit).toBeGreaterThan(0);
      expect(rateLimit.reset).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000));

      // Check if we're close to rate limit
      if (rateLimit.remaining < 10) {
        logger.warn(`Low rate limit remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
      }
    });

    it('should track all API activities', async () => {
      const initialActivityCount = githubService.getActivityLog(100).length;

      // Perform some operations
      await githubService.searchRepositories('language:rust', { per_page: 1 });
      await githubService.getRateLimit();

      const newActivityCount = githubService.getActivityLog(100).length;
      expect(newActivityCount).toBeGreaterThan(initialActivityCount);

      // Check activity log structure
      const activities = githubService.getActivityLog(10);
      expect(activities.every((a) => a.timestamp && a.action && a.success !== undefined)).toBe(
        true
      );
    });
  });
});

// Helper functions
function createTestMemory(text: string): Memory {
  return {
    id: `test-${Date.now()}` as UUID,
    roomId: 'test-room' as UUID,
    entityId: 'test-entity' as UUID,
    agentId: 'test-agent' as UUID,
    content: { text, source: 'test' },
    createdAt: Date.now(),
  };
}

function createTestState(additionalData: Record<string, any> = {}): State {
  return {
    values: {},
    data: additionalData,
    text: '',
  };
}
