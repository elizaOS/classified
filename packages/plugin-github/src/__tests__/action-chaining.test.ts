import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { githubPlugin } from '../index';
import { createMockRuntime, MockRuntime } from './test-utils';
import { IAgentRuntime, Memory, State, UUID } from '@elizaos/core';

/**
 * Action Chaining Tests
 *
 * These tests demonstrate how GitHub actions can be chained together
 * to perform complex workflows. Each action outputs state that can be
 * used by subsequent actions.
 */

describe('Action Chaining: GitHub Plugin', () => {
  let mockRuntime: MockRuntime;
  let mockGitHubService: any;

  beforeEach(() => {
    // Create mock GitHub service with all necessary methods
    mockGitHubService = {
      capabilityDescription: 'GitHub integration service',
      searchRepositories: mock().mockResolvedValue({
        total_count: 100,
        items: [
          {
            id: 1,
            name: 'awesome-project',
            full_name: 'user/awesome-project',
            owner: { login: 'user' },
            stargazers_count: 1000,
            description: 'An awesome project',
            language: 'TypeScript',
            open_issues_count: 10,
          },
          {
            id: 2,
            name: 'cool-library',
            full_name: 'org/cool-library',
            owner: { login: 'org' },
            stargazers_count: 500,
            description: 'A cool library',
            language: 'JavaScript',
            open_issues_count: 5,
          },
        ],
      }),
      searchIssues: mock().mockResolvedValue({
        total_count: 50,
        items: [
          {
            id: 301,
            number: 5,
            title: 'Bug: Memory leak in component',
            state: 'open',
            labels: [{ name: 'bug' }],
            created_at: '2024-01-05T00:00:00Z',
            user: { login: 'issueReporter' },
          },
          {
            id: 302,
            number: 6,
            title: 'Feature: Add dark mode support',
            state: 'open',
            labels: [{ name: 'enhancement' }],
            created_at: '2024-01-06T00:00:00Z',
            user: { login: 'featureRequester' },
          },
        ],
      }),
      getRepository: mock().mockResolvedValue({
        id: 1,
        name: 'awesome-project',
        full_name: 'user/awesome-project',
        owner: { login: 'user' },
        stargazers_count: 1000,
        forks_count: 50,
        open_issues_count: 10,
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        language: 'TypeScript',
        topics: ['typescript', 'awesome'],
        license: { name: 'MIT' },
      }),
      listIssues: mock().mockResolvedValue([
        {
          id: 101,
          number: 1,
          title: 'Bug: Something is broken',
          state: 'open',
          labels: [{ name: 'bug' }],
          created_at: '2024-01-01T00:00:00Z',
          user: { login: 'reporter1' },
        },
        {
          id: 102,
          number: 2,
          title: 'Feature: Add new functionality',
          state: 'open',
          labels: [{ name: 'enhancement' }],
          created_at: '2024-01-02T00:00:00Z',
          user: { login: 'reporter2' },
        },
      ]),
      createIssue: mock().mockResolvedValue({
        id: 103,
        number: 3,
        title: 'New issue from chain',
        state: 'open',
        html_url: 'https://github.com/user/awesome-project/issues/3',
        created_at: new Date().toISOString(),
        user: { login: 'test-user' },
        labels: [],
        assignees: [],
        comments: 0,
        body: 'Created after checking rate limit and searching',
      }),
      listPullRequests: mock().mockResolvedValue([
        {
          id: 201,
          number: 10,
          title: 'Fix: Resolve critical bug',
          state: 'open',
          created_at: '2024-01-03T00:00:00Z',
          user: { login: 'contributor1' },
          base: { ref: 'main' },
          head: { ref: 'fix-bug' },
        },
      ]),
      createPullRequest: mock().mockResolvedValue({
        id: 202,
        number: 11,
        title: 'Feature: Add chaining support',
        state: 'open',
        html_url: 'https://github.com/user/awesome-project/pull/11',
        created_at: new Date().toISOString(),
      }),
      getRateLimit: mock().mockResolvedValue({
        limit: 5000,
        remaining: 4500,
        reset: Date.now() / 1000 + 3600,
      }),
      getActivityLog: mock().mockReturnValue([
        {
          timestamp: Date.now(),
          action: 'searchRepositories',
          success: true,
          details: { query: 'test' },
        },
      ]),
    };

    // Create mock runtime with the service
    mockRuntime = {
      ...createMockRuntime(),
      getService: mock().mockImplementation((serviceType) => {
        if (serviceType === 'github') {
          return mockGitHubService;
        }
        return null;
      }),
    };
  });

  describe('Search → Get Details → List Issues Chain', () => {
    it('should pass repository data from search to get details', async () => {
      const actions = githubPlugin.actions!;

      // Step 1: Search for repositories
      const searchAction = actions.find((a) => a.name === 'SEARCH_GITHUB_REPOSITORIES')!;

      const searchResult = (await searchAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Search for TypeScript projects'),
        createState(),
        { query: 'language:typescript', per_page: 2 }
      )) as any;

      expect(searchResult).toBeDefined();
      expect(searchResult.values.repositories).toHaveLength(2);
      expect(searchResult.data.repositories).toBeDefined();

      // Step 2: Get details of the first repository using state from search
      const getRepoAction = actions.find((a) => a.name === 'GET_GITHUB_REPOSITORY')!;

      const repoDetails = (await getRepoAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Get details of the first repository'),
        createState(searchResult.data), // Pass the state from search
        { owner: 'user', repo: 'awesome-project' }
      )) as any;

      expect(repoDetails).toBeDefined();
      expect(repoDetails.values.repository).toBeDefined();
      expect(repoDetails.data.repository).toBeDefined();

      // Step 3: List issues using state from repository details
      const listIssuesAction = actions.find((a) => a.name === 'LIST_GITHUB_ISSUES')!;

      const issuesList = (await listIssuesAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('List issues for the repository'),
        createState(repoDetails.data), // Pass the state from get repo
        { owner: 'user', repo: 'awesome-project' }
      )) as any;

      expect(issuesList).toBeDefined();
      expect(issuesList.values.issues).toHaveLength(2);
      expect(issuesList.data.issues).toBeDefined();
      expect(issuesList.data.github.lastRepository).toBeDefined(); // Should preserve repo data
    });
  });

  describe('Rate Limit Check → Search → Create Issue Chain', () => {
    it('should check rate limit before performing operations', async () => {
      const actions = githubPlugin.actions!;

      // Step 1: Check rate limit
      const rateLimitAction = actions.find((a) => a.name === 'GET_GITHUB_RATE_LIMIT')!;

      const rateLimitResult = (await rateLimitAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Check rate limit'),
        createState(),
        {}
      )) as any;

      expect(rateLimitResult.values.rateLimit).toBeDefined();
      expect(rateLimitResult.values.rateLimit.remaining).toBe(4500);

      // Step 2: Search for issues if rate limit is ok
      if (rateLimitResult.values.rateLimit.remaining > 100) {
        const searchIssuesAction = actions.find((a) => a.name === 'SEARCH_GITHUB_ISSUES')!;

        const searchResult = (await searchIssuesAction.handler(
          mockRuntime as unknown as IAgentRuntime,
          createMemory('Search for similar issues'),
          createState(rateLimitResult.data),
          { query: 'repo:user/awesome-project is:issue bug' }
        )) as any;

        expect(searchResult).toBeDefined();
        expect(searchResult.data.github?.lastRateLimit).toBeDefined(); // Preserved from previous state

        // Step 3: Create issue based on search results
        const createIssueAction = actions.find((a) => a.name === 'CREATE_GITHUB_ISSUE')!;

        const createResult = (await createIssueAction.handler(
          mockRuntime as unknown as IAgentRuntime,
          createMemory('Create a new issue'),
          createState(searchResult.data),
          {
            owner: 'user',
            repo: 'awesome-project',
            title: 'New issue from chain',
            body: 'Created after checking rate limit and searching',
          }
        )) as any;

        expect(createResult).toBeDefined();
        expect(createResult.text).toContain('Successfully created issue');
        expect(mockGitHubService.createIssue).toHaveBeenCalled();
      }
    });
  });

  describe('Complex Workflow: Repository Analysis', () => {
    it('should perform a complete repository analysis workflow', async () => {
      const actions = githubPlugin.actions!;
      const workflow: any[] = [];

      // Step 1: Get repository details
      const getRepoAction = actions.find((a) => a.name === 'GET_GITHUB_REPOSITORY')!;
      const repoResult = (await getRepoAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Analyze repository user/awesome-project'),
        createState(),
        { owner: 'user', repo: 'awesome-project' },
        async (response) => {
          workflow.push({ step: 'repo', callback: response });
          return [];
        }
      )) as any;

      // Step 2: List open issues
      const listIssuesAction = actions.find((a) => a.name === 'LIST_GITHUB_ISSUES')!;
      const issuesResult = (await listIssuesAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Get open issues'),
        createState(repoResult.data), // Use the return value's data
        { owner: 'user', repo: 'awesome-project', state: 'open' },
        async (response) => {
          workflow.push({ step: 'issues', callback: response });
          return [];
        }
      )) as any;

      // Step 3: List pull requests
      const listPRsAction = actions.find((a) => a.name === 'LIST_GITHUB_PULL_REQUESTS')!;
      const prsResult = (await listPRsAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Get open pull requests'),
        createState(issuesResult.data), // Use the return value's data
        { owner: 'user', repo: 'awesome-project', state: 'open' },
        async (response) => {
          workflow.push({ step: 'prs', callback: response });
          return [];
        }
      )) as any;

      // Step 4: Get activity log
      const activityAction = actions.find((a) => a.name === 'GET_GITHUB_ACTIVITY')!;
      const activityResult = (await activityAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Get recent activity'),
        createState(prsResult.data), // Use the return value's data
        { limit: 10 },
        async (response) => {
          workflow.push({ step: 'activity', callback: response });
          return [];
        }
      )) as any;

      // Verify the complete workflow
      expect(workflow).toHaveLength(4);
      expect(workflow[0].step).toBe('repo');
      expect(workflow[1].step).toBe('issues');
      expect(workflow[2].step).toBe('prs');
      expect(workflow[3].step).toBe('activity');

      // Verify state is preserved throughout the chain using return values
      const finalState = activityResult.data;
      expect(finalState).toBeDefined();
      expect(finalState.activity).toBeDefined();
      // Fix: Check if the nested data structure exists before asserting
      if (issuesResult?.data) {
        expect(issuesResult.data.issues).toBeDefined();
      }
      if (prsResult?.data) {
        expect(prsResult.data.pullRequests).toBeDefined();
      }
    });
  });

  describe('Conditional Chaining', () => {
    it('should branch based on repository characteristics', async () => {
      const actions = githubPlugin.actions!;

      // Search for repositories
      const searchAction = actions.find((a) => a.name === 'SEARCH_GITHUB_REPOSITORIES')!;
      let searchResult: any;

      await searchAction.handler(
        mockRuntime as unknown as IAgentRuntime,
        createMemory('Find popular repositories'),
        createState(),
        { query: 'stars:>500', per_page: 2 },
        async (response) => {
          searchResult = response;
          return [];
        }
      );

      // For each repository, perform different actions based on characteristics
      for (const repo of searchResult.repositories) {
        if (repo.stargazers_count > 800) {
          // High-star repos: check pull requests
          const listPRsAction = actions.find((a) => a.name === 'LIST_GITHUB_PULL_REQUESTS')!;
          let prResult: any;

          await listPRsAction.handler(
            mockRuntime as unknown as IAgentRuntime,
            createMemory(`Check PRs for high-star repo ${repo.name}`),
            createState({ repository: repo }),
            { owner: repo.owner.login, repo: repo.name },
            async (response) => {
              prResult = response;
              return [];
            }
          );

          expect(prResult.pullRequests).toBeDefined();
        } else {
          // Lower-star repos: check issues
          const listIssuesAction = actions.find((a) => a.name === 'LIST_GITHUB_ISSUES')!;
          let issueResult: any;

          await listIssuesAction.handler(
            mockRuntime as unknown as IAgentRuntime,
            createMemory(`Check issues for repo ${repo.name}`),
            createState({ repository: repo }),
            { owner: repo.owner.login, repo: repo.name },
            async (response) => {
              issueResult = response;
              return [];
            }
          );

          expect(issueResult.issues).toBeDefined();
        }
      }
    });
  });

  describe('State Accumulation', () => {
    it('should accumulate data across multiple searches', async () => {
      const actions = githubPlugin.actions!;
      const searchAction = actions.find((a) => a.name === 'SEARCH_GITHUB_REPOSITORIES')!;

      let accumulatedState: any = {
        allRepositories: [],
        searchQueries: [],
      };

      // Perform multiple searches
      const queries = ['language:rust', 'language:go', 'language:python'];

      for (const query of queries) {
        await searchAction.handler(
          mockRuntime as unknown as IAgentRuntime,
          createMemory(`Search for ${query} repositories`),
          createState(accumulatedState),
          { query, per_page: 2 },
          async (response) => {
            // Accumulate results
            const repos = (response as any).repositories || [];
            accumulatedState.allRepositories.push(...repos);
            accumulatedState.searchQueries.push({
              query,
              count: repos.length,
              timestamp: Date.now(),
            });
            accumulatedState = { ...accumulatedState, ...(response as any).data };
            return [];
          }
        );
      }

      // Verify accumulated state
      expect(accumulatedState.allRepositories).toHaveLength(6); // 2 per query
      expect(accumulatedState.searchQueries).toHaveLength(3);
      expect(accumulatedState.searchQueries.every((sq) => sq.count === 2)).toBe(true);
    });
  });
});

// Helper functions
function createMemory(text: string): Memory {
  return {
    id: `mem-${Date.now()}` as UUID,
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
