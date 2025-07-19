import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { GitHubService } from '../services/github';

// Mock Octokit
mock.module('@octokit/rest', () => ({
  Octokit: class MockOctokit {
    repos: any;
    git: any;
    pulls: any;

    constructor() {
      this.repos = {
        getContent: mock(),
        createOrUpdateFileContents: mock(),
        deleteFile: mock(),
        listBranches: mock(),
        getBranch: mock(),
        get: mock(),
      };
      this.git = {
        createRef: mock(),
        deleteRef: mock(),
        getRef: mock(),
        compareCommits: mock(),
      };
      this.pulls = {
        create: mock(),
        list: mock(),
        get: mock(),
        merge: mock(),
      };
    }
  },
}));

describe('PR and Branch Management Tests', () => {
  let mockRuntime: any;
  let githubService: GitHubService;
  let mockOctokit: any;

  beforeEach(() => {
    mock.restore();

    // Create mock Octokit instance
    mockOctokit = {
      repos: {
        createOrUpdateFileContents: mock().mockResolvedValue({
          data: {
            commit: { sha: 'new-commit-sha' },
            content: { sha: 'new-file-sha' },
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        getContent: mock().mockResolvedValue({
          data: {
            type: 'file',
            content: Buffer.from('# Test Content').toString('base64'),
            sha: 'file-sha',
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        deleteFile: mock().mockResolvedValue({
          data: { commit: { sha: 'delete-commit-sha' } },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        compareCommits: mock().mockResolvedValue({
          data: {
            status: 'ahead',
            ahead_by: 2,
            behind_by: 0,
            files: [
              { filename: 'file1.js', additions: 10, deletions: 5 },
              { filename: 'file2.js', additions: 20, deletions: 0 },
            ],
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        getBranch: mock().mockResolvedValue({
          data: {
            name: 'test-branch',
            commit: { sha: 'branch-sha' },
            protected: false,
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        listBranches: mock().mockResolvedValue({
          data: [
            { name: 'main', protected: true },
            { name: 'develop', protected: false },
            { name: 'feature/test', protected: false },
          ],
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        get: mock().mockResolvedValue({
          data: { default_branch: 'main' },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
      },
      pulls: {
        create: mock().mockResolvedValue({
          data: {
            number: 123,
            title: 'Test PR',
            html_url: 'https://github.com/owner/repo/pull/123',
            state: 'open',
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        list: mock().mockResolvedValue({
          data: [
            {
              number: 123,
              title: 'Test PR',
              state: 'open',
              user: { login: 'testuser' },
            },
          ],
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        get: mock().mockResolvedValue({
          data: {
            number: 123,
            title: 'Test PR',
            state: 'open',
            mergeable: true,
            merged: false,
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        merge: mock().mockResolvedValue({
          data: {
            sha: 'merge-sha',
            merged: true,
            message: 'Pull Request successfully merged',
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
      },
      git: {
        createRef: mock().mockResolvedValue({
          data: {
            ref: 'refs/heads/new-branch',
            object: { sha: 'new-branch-sha' },
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        getRef: mock().mockResolvedValue({
          data: {
            ref: 'refs/heads/main',
            object: { sha: 'main-sha' },
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
        deleteRef: mock().mockResolvedValue({
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
      },
      rateLimit: {
        get: mock().mockResolvedValue({
          data: {
            rate: {
              limit: 5000,
              remaining: 4999,
              reset: Date.now() / 1000 + 3600,
              used: 1,
            },
          },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        }),
      },
    };

    // Note: Octokit is mocked using mock.module above

    // Create mock runtime
    mockRuntime = {
      agentId: 'test-agent',
      getSetting: mock((key: string) => {
        const settings: Record<string, string> = {
          GITHUB_TOKEN: 'ghp_test123',
          GITHUB_OWNER: 'testowner',
        };
        return settings[key];
      }),
      logger: {
        info: mock(),
        warn: mock(),
        error: mock(),
        debug: mock(),
      },
    };

    // Create GitHubService instance
    // Temporarily mock the runtime to return a valid token for service creation
    const tempRuntime = {
      ...mockRuntime,
      getSetting: mock((key: string) => {
        if (key === 'GITHUB_TOKEN') {
          return 'test-token';
        }
        return null;
      }),
    };

    githubService = new GitHubService(tempRuntime);

    // After creation, replace the octokit instance with our mock
    (githubService as any).octokit = mockOctokit;
  });

  describe('File Operations', () => {
    it('should get file content', async () => {
      const result = await githubService.getFileContent('owner', 'repo', 'README.md');

      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'README.md',
        ref: undefined,
      });

      expect(result).toEqual({
        content: '# Test Content',
        sha: 'file-sha',
      });
    });

    it('should handle directory paths', async () => {
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: [{ type: 'file', name: 'file1.js' }], // Array indicates directory
        headers: {
          'x-ratelimit-remaining': '4999',
          'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
        },
      });

      await expect(githubService.getFileContent('owner', 'repo', 'src')).rejects.toThrow(
        'Path is not a file or content not available'
      );
    });

    it('should create or update files', async () => {
      const content = '# Updated Content';
      const result = await githubService.createOrUpdateFile(
        'owner',
        'repo',
        'README.md',
        content,
        'Update README',
        'main',
        'old-sha'
      );

      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'README.md',
        message: 'Update README',
        content: Buffer.from(content).toString('base64'),
        branch: 'main',
        sha: 'old-sha',
      });

      expect(result.commit.sha).toBe('new-commit-sha');
    });

    it('should create new files without SHA', async () => {
      const content = '# New File';
      await githubService.createOrUpdateFile(
        'owner',
        'repo',
        'NEW.md',
        content,
        'Create new file',
        'main'
        // No SHA for new files
      );

      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.not.objectContaining({ sha: expect.any(String) })
      );
    });

    it('should delete files', async () => {
      await githubService.deleteFile(
        'owner',
        'repo',
        'old-file.txt',
        'Remove old file',
        'file-sha',
        'main'
      );

      expect(mockOctokit.repos.deleteFile).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'old-file.txt',
        message: 'Remove old file',
        sha: 'file-sha',
        branch: 'main',
      });
    });
  });

  describe('Branch Operations', () => {
    it('should create branches', async () => {
      const result = await githubService.createBranch('owner', 'repo', 'feature/new', 'base-sha');

      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'refs/heads/feature/new',
        sha: 'base-sha',
      });

      expect(result.ref).toBe('refs/heads/new-branch');
    });

    it('should list branches', async () => {
      const branches = await githubService.listBranches('owner', 'repo');

      expect(mockOctokit.repos.listBranches).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
      });

      expect(branches).toHaveLength(3);
      expect(branches[0].name).toBe('main');
    });

    it('should get branch details', async () => {
      const branch = await githubService.getBranch('owner', 'repo', 'develop');

      expect(mockOctokit.repos.getBranch).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        branch: 'develop',
      });

      expect(branch.name).toBe('test-branch');
      expect(branch.protected).toBe(false);
    });

    it('should delete branches', async () => {
      await githubService.deleteBranch('owner', 'repo', 'old-feature');

      expect(mockOctokit.git.deleteRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/old-feature',
      });
    });

    it('should get default branch', async () => {
      const defaultBranch = await githubService.getDefaultBranch('owner', 'repo');

      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
      });

      expect(defaultBranch).toBe('main');
    });

    it('should compare branches', async () => {
      const comparison = await githubService.compareBranches('owner', 'repo', 'main', 'feature');

      expect(mockOctokit.repos.compareCommits).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base: 'main',
        head: 'feature',
      });

      expect(comparison.ahead_by).toBe(2);
      expect(comparison.files).toHaveLength(2);
    });
  });

  describe('Pull Request Operations', () => {
    it('should create pull requests', async () => {
      const pr = await githubService.createPullRequest('owner', 'repo', {
        title: 'New Feature',
        body: 'This PR adds a new feature',
        head: 'feature/new',
        base: 'main',
      });

      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'New Feature',
        body: 'This PR adds a new feature',
        head: 'feature/new',
        base: 'main',
      });

      expect(pr.number).toBe(123);
      expect(pr.html_url).toContain('github.com');
    });

    it('should list pull requests', async () => {
      const prs = await githubService.listPullRequests('owner', 'repo');

      expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 30,
      });

      expect(prs).toHaveLength(1);
      expect(prs[0].number).toBe(123);
    });

    it('should get pull request details', async () => {
      const pr = await githubService.getPullRequest('owner', 'repo', 123);

      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
      });

      expect(pr.number).toBe(123);
      expect(pr.mergeable).toBe(true);
    });

    it('should merge pull requests', async () => {
      const result = await githubService.mergePullRequest('owner', 'repo', 123, {
        merge_method: 'squash',
      });

      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        merge_method: 'squash',
      });

      expect(result.merged).toBe(true);
      expect(result.sha).toBe('merge-sha');
    });

    it('should handle merge with default method', async () => {
      await githubService.mergePullRequest('owner', 'repo', 456);

      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 456,
        commit_title: undefined,
        commit_message: undefined,
        merge_method: 'merge',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors', async () => {
      mockOctokit.repos.getContent.mockRejectedValueOnce({
        status: 403,
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Date.now() / 1000 + 3600),
          },
        },
      });

      await expect(githubService.getFileContent('owner', 'repo', 'file.txt')).rejects.toThrow();
    });

    it('should handle not found errors', async () => {
      mockOctokit.repos.getContent.mockRejectedValueOnce({
        status: 404,
        message: 'Not Found',
      });

      await expect(githubService.getFileContent('owner', 'repo', 'missing.txt')).rejects.toThrow();
    });

    it('should validate repository names', async () => {
      await expect(
        githubService.createBranch('invalid/owner', 'repo', 'branch', 'sha')
      ).rejects.toThrow();
      await expect(
        githubService.createBranch('owner', 'invalid/repo', 'branch', 'sha')
      ).rejects.toThrow();
    });
  });

  describe('Activity Logging', () => {
    it('should log successful operations', async () => {
      await githubService.createBranch('owner', 'repo', 'new-branch', 'sha');

      const activityLog = githubService.getActivityLog();
      expect(activityLog).toHaveLength(1);
      expect(activityLog[0].action).toBe('create_branch');
      expect(activityLog[0].success).toBe(true);
      expect(activityLog[0].resource_id).toBe('owner/repo:new-branch');
    });

    it('should log failed operations', async () => {
      mockOctokit.git.createRef.mockRejectedValueOnce(new Error('Branch already exists'));

      try {
        await githubService.createBranch('owner', 'repo', 'existing-branch', 'sha');
      } catch (error) {
        // Expected error
      }

      const activityLog = githubService.getActivityLog();
      expect(activityLog).toHaveLength(1);
      expect(activityLog[0].success).toBe(false);
      expect(activityLog[0].error).toContain('Branch already exists');
    });
  });
});
