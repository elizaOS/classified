import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { GitHubService } from '../github-service';

// Mock the Octokit library
mock.module('@octokit/rest', () => ({
  Octokit: mock().mockImplementation(() => ({
    rest: {
      repos: {
        create: mock(),
        get: mock(),
        listForUser: mock(),
        listForAuthenticatedUser: mock(),
        listCommits: mock(),
        listContributors: mock(),
        listLanguages: mock(),
        createDeployment: mock(),
        createDeploymentStatus: mock(),
      },
      git: {
        getRef: mock(),
        createRef: mock(),
        updateRef: mock(),
        getCommit: mock(),
        createTree: mock(),
        createCommit: mock(),
        createBlob: mock(),
      },
      users: {
        getAuthenticated: mock(),
      },
      pulls: {
        create: mock(),
      },
      search: {
        repos: mock(),
      },
    },
  })),
}));

describe('GitHubService', () => {
  let githubService: GitHubService;
  let mockOctokit: any;

  beforeEach(() => {
    mock.restore();
    githubService = new GitHubService('test-token');
    // Set up the mock octokit structure
    mockOctokit = {
      rest: {
        repos: {
          create: mock(),
          get: mock(),
          listForUser: mock(),
          listForAuthenticatedUser: mock(),
          listCommits: mock(),
          listContributors: mock(),
          listLanguages: mock(),
          createDeployment: mock(),
          createDeploymentStatus: mock(),
        },
        git: {
          getRef: mock(),
          createRef: mock(),
          updateRef: mock(),
          getCommit: mock(),
          createTree: mock(),
          createCommit: mock(),
          createBlob: mock(),
        },
        users: {
          getAuthenticated: mock(),
        },
        pulls: {
          create: mock(),
        },
        search: {
          repos: mock(),
        },
      },
    };
    (githubService as any).octokit = mockOctokit;
  });

  describe('initialization', () => {
    it('should initialize with token', () => {
      expect(githubService).toBeInstanceOf(GitHubService);
    });

    it('should initialize with environment token fallback', () => {
      process.env.GITHUB_TOKEN = 'env-token';
      const service = new GitHubService();
      expect(service).toBeInstanceOf(GitHubService);
    });
  });

  describe('createRepository', () => {
    it('should create repository with files successfully', async () => {
      const mockRepoData = {
        id: 123,
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        owner: { login: 'user' },
      };

      mockOctokit.rest.repos.create.mockResolvedValue({ data: mockRepoData });

      // Mock pushFiles method to avoid complex git operations in tests
      const pushFilesSpy = mock
        .spyOn(githubService, 'pushFiles')
        .mockResolvedValue({ commitSha: 'abc123' });

      const result = await githubService.createRepository({
        name: 'test-repo',
        description: 'Test repository',
        private: false,
        files: { 'test.txt': 'Hello World' },
        packageJson: { name: 'test', version: '1.0.0' },
      });

      expect(mockOctokit.rest.repos.create).toHaveBeenCalledWith({
        name: 'test-repo',
        description: 'Test repository',
        private: false,
        auto_init: false,
        has_issues: true,
        has_projects: true,
        has_wiki: true,
      });

      expect(pushFilesSpy).toHaveBeenCalled();
      expect(result).toEqual({
        id: 123,
        name: 'test-repo',
        full_name: 'user/test-repo',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        default_branch: 'main',
      });
    });

    it('should handle repository creation failure', async () => {
      mockOctokit.rest.repos.create.mockRejectedValue(new Error('API Error'));

      await expect(
        githubService.createRepository({
          name: 'test-repo',
          description: 'Test repository',
          private: false,
          files: {},
          packageJson: {},
        }),
      ).rejects.toThrow('GitHub repository creation failed');
    });
  });

  describe('createAutocoderRepository', () => {
    it('should create autocoder repository with category-specific files', async () => {
      const mockRepoData = {
        id: 123,
        name: 'defi-project-abc12345',
        full_name: 'user/defi-project-abc12345',
        html_url: 'https://github.com/user/defi-project-abc12345',
        clone_url: 'https://github.com/user/defi-project-abc12345.git',
        owner: { login: 'user' },
      };

      mockOctokit.rest.repos.create.mockResolvedValue({ data: mockRepoData });
      const pushFilesSpy = mock
        .spyOn(githubService, 'pushFiles')
        .mockResolvedValue({ commitSha: 'abc123' });

      const result = await githubService.createAutocoderRepository({
        projectId: 'abc12345-def67890',
        name: 'DeFi Project',
        description: 'A DeFi yield farming platform',
        category: 'defi',
        specification: { description: 'Yield farming protocol' },
        userId: 'user123',
      });

      expect(result.name).toBe('defi-project-abc12345');
      expect(result.project_id).toBe('abc12345-def67890');
      expect(pushFilesSpy).toHaveBeenCalled();
    });

    it('should throw error when repository generation is disabled', async () => {
      await expect(
        githubService.createAutocoderRepository({
          projectId: 'test-id',
          name: 'Test Project',
          description: 'Test description',
          category: 'general',
          specification: {},
          userId: 'user123',
          generateRepository: false,
        }),
      ).rejects.toThrow(
        'Repository generation is required for autocoder projects',
      );
    });
  });

  describe('createFeatureBranch', () => {
    it('should create feature branch successfully', async () => {
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'base-sha' } },
      });

      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: { ref: 'refs/heads/feature-branch' },
      });

      const result = await githubService.createFeatureBranch(
        'user',
        'repo',
        'feature-branch',
      );

      expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        ref: 'heads/main',
      });

      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        ref: 'refs/heads/feature-branch',
        sha: 'base-sha',
      });

      expect(result).toBe('refs/heads/feature-branch');
    });

    it('should handle branch creation failure', async () => {
      mockOctokit.rest.git.getRef.mockRejectedValue(
        new Error('Branch not found'),
      );

      await expect(
        githubService.createFeatureBranch('user', 'repo', 'feature-branch'),
      ).rejects.toThrow('Failed to create feature branch');
    });
  });

  describe('deployRepository', () => {
    it('should deploy repository successfully', async () => {
      const mockDeployment = {
        data: {
          id: 123,
          created_at: '2023-01-01T00:00:00Z',
        },
      };

      mockOctokit.rest.repos.createDeployment.mockResolvedValue(mockDeployment);
      mockOctokit.rest.repos.createDeploymentStatus.mockResolvedValue({});

      const result = await githubService.deployRepository({
        owner: 'user',
        repo: 'repo',
        branch: 'main',
        environment: 'production',
      });

      expect(mockOctokit.rest.repos.createDeployment).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        ref: 'main',
        environment: 'production',
        description: 'Autocoder deployment to production',
        auto_merge: false,
        required_contexts: [],
        payload: {},
      });

      expect(result).toEqual({
        id: 123,
        url: 'https://user.github.io/repo',
        state: 'success',
        environment: 'production',
        created_at: '2023-01-01T00:00:00Z',
      });
    });
  });

  describe('getRepositoryStats', () => {
    it('should return repository statistics', async () => {
      const mockRepoInfo = {
        data: {
          id: 123,
          name: 'test-repo',
          full_name: 'user/test-repo',
          description: 'Test repository',
          private: false,
          stargazers_count: 10,
          forks_count: 5,
          watchers_count: 8,
          size: 1024,
          default_branch: 'main',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-02T00:00:00Z',
        },
      };

      const mockCommits = { data: [{ sha: 'commit1' }] };
      const mockContributors = {
        data: [{ login: 'user1' }, { login: 'user2' }],
      };
      const mockLanguages = { data: { TypeScript: 1000, JavaScript: 500 } };

      mockOctokit.rest.repos.get.mockResolvedValue(mockRepoInfo);
      mockOctokit.rest.repos.listCommits.mockResolvedValue(mockCommits);
      mockOctokit.rest.repos.listContributors.mockResolvedValue(
        mockContributors,
      );
      mockOctokit.rest.repos.listLanguages.mockResolvedValue(mockLanguages);

      const result = await githubService.getRepositoryStats(
        'user',
        'test-repo',
      );

      expect(result.repository.name).toBe('test-repo');
      expect(result.commits).toBe(1);
      expect(result.contributors).toBe(2);
      expect(result.languages).toEqual({ TypeScript: 1000, JavaScript: 500 });
    });
  });

  describe('searchAutocoderRepositories', () => {
    it('should search repositories with autocoder topic', async () => {
      const mockSearchResults = {
        data: {
          total_count: 2,
          incomplete_results: false,
          items: [
            {
              id: 1,
              name: 'repo1',
              full_name: 'user/repo1',
              description: 'First repo',
              private: false,
              html_url: 'https://github.com/user/repo1',
              clone_url: 'https://github.com/user/repo1.git',
              stargazers_count: 5,
              forks_count: 2,
              language: 'TypeScript',
              topics: ['elizaos-autocoder', 'defi'],
              updated_at: '2023-01-01T00:00:00Z',
            },
            {
              id: 2,
              name: 'repo2',
              full_name: 'user/repo2',
              description: 'Second repo',
              private: false,
              html_url: 'https://github.com/user/repo2',
              clone_url: 'https://github.com/user/repo2.git',
              stargazers_count: 3,
              forks_count: 1,
              language: 'Solidity',
              topics: ['elizaos-autocoder', 'nft'],
              updated_at: '2023-01-02T00:00:00Z',
            },
          ],
        },
      };

      mockOctokit.rest.search.repos.mockResolvedValue(mockSearchResults);

      const result = await githubService.searchAutocoderRepositories('defi');

      expect(mockOctokit.rest.search.repos).toHaveBeenCalledWith({
        q: 'defi topic:elizaos-autocoder',
        sort: 'updated',
        order: 'desc',
        page: 1,
        per_page: 30,
      });

      expect(result.total_count).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('repo1');
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return authenticated user information', async () => {
      const mockUser = {
        data: {
          id: 123,
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: 'https://github.com/images/avatar.jpg',
        },
      };

      mockOctokit.rest.users.getAuthenticated.mockResolvedValue(mockUser);

      const result = await githubService.getAuthenticatedUser();

      expect(result).toEqual({
        id: 123,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://github.com/images/avatar.jpg',
      });
    });

    it('should handle missing user name', async () => {
      const mockUser = {
        data: {
          id: 123,
          login: 'testuser',
          name: null,
          email: null,
          avatar_url: 'https://github.com/images/avatar.jpg',
        },
      };

      mockOctokit.rest.users.getAuthenticated.mockResolvedValue(mockUser);

      const result = await githubService.getAuthenticatedUser();

      expect(result.name).toBe('testuser'); // Falls back to login
      expect(result.email).toBe('');
    });
  });

  describe('validateRepository', () => {
    it('should return true for existing repository', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({ data: {} });

      const result = await githubService.validateRepository('user', 'repo');

      expect(result).toBe(true);
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
      });
    });

    it('should return false for non-existing repository', async () => {
      mockOctokit.rest.repos.get.mockRejectedValue(new Error('Not found'));

      const result = await githubService.validateRepository('user', 'repo');

      expect(result).toBe(false);
    });
  });

  describe('pushFiles with pull request', () => {
    it('should create pull request when requested', async () => {
      // Mock the git operations
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'base-sha' } },
      });

      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: 'blob-sha' },
      });

      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'new-tree-sha' },
      });

      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'new-commit-sha' },
      });

      mockOctokit.rest.git.updateRef.mockResolvedValue({});

      mockOctokit.rest.pulls.create.mockResolvedValue({
        data: { number: 123 },
      });

      const result = await githubService.pushFiles({
        owner: 'user',
        repo: 'repo',
        files: { 'test.txt': 'Hello World' },
        commitMessage: 'Add test file',
        branch: 'feature-branch',
        createPR: true,
        prTitle: 'Add test file',
        prDescription: 'This adds a test file',
      });

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        title: 'Add test file',
        head: 'feature-branch',
        base: 'main',
        body: 'This adds a test file',
      });

      expect(result.commitSha).toBe('new-commit-sha');
      expect(result.prNumber).toBe(123);
    });
  });

  describe('utility methods', () => {
    it('should sanitize repository names correctly', () => {
      const service = githubService as any;

      expect(service.sanitizeRepositoryName('My Amazing Project!')).toBe(
        'my-amazing-project',
      );
      expect(service.sanitizeRepositoryName('test@#$%^repo')).toBe('test-repo');
      expect(service.sanitizeRepositoryName('---test---')).toBe('test');
    });

    it('should sanitize package names correctly', () => {
      const service = githubService as any;

      expect(service.sanitizePackageName('@my/package-name')).toBe(
        'my-package-name',
      );
      expect(service.sanitizePackageName('UPPERCASE_NAME')).toBe(
        'uppercase-name',
      );
    });

    it('should generate DeFi contract code', () => {
      const service = githubService as any;
      const contract = service.generateDeFiContract({
        description: 'Test protocol',
      });

      expect(contract).toContain('pragma solidity ^0.8.19');
      expect(contract).toContain('Test protocol');
      expect(contract).toContain('DeFiProtocol');
    });

    it('should generate trading bot code', () => {
      const service = githubService as any;
      const bot = service.generateTradingBot({ symbols: ['BTC/USDT'] });

      expect(bot).toContain('class TradingBot');
      expect(bot).toContain('import ccxt');
      expect(bot).toContain('executeStrategy');
    });

    it('should generate package.json with category-specific dependencies', () => {
      const service = githubService as any;
      const packageJson = service.generatePackageJson(
        'test-project',
        'Test description',
        'defi',
      );

      expect(packageJson.name).toBe('test-project');
      expect(packageJson.description).toBe('Test description');
      expect(packageJson.keywords).toContain('defi');
      expect(packageJson.dependencies['@openzeppelin/contracts']).toBeDefined();
      expect(packageJson.scripts.deploy).toBe('hardhat run scripts/deploy.js');
    });
  });
});
