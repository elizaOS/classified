import { Memory, State, UUID } from '@elizaos/core';
import { GitHubService } from '../services/github';
import { mock, expect } from 'bun:test';

// Define types inline since they're not exported from types.ts
interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  private: boolean;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  topics: string[];
  has_issues: boolean;
  has_projects: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  has_downloads: boolean;
  archived: boolean;
  disabled: boolean;
  visibility: string;
  license: any;
  [key: string]: any;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  labels: any[];
  assignee: any;
  assignees: any[];
  comments: number;
  closed_at: string | null;
  html_url: string;
  [key: string]: any;
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  merged_at: string | null;
  html_url: string;
  [key: string]: any;
}

/**
 * Test Repository Manager
 * Handles creation and cleanup of test repositories
 */
export class TestRepoManager {
  private createdRepos: string[] = [];
  private service: GitHubService;
  private owner: string;

  constructor(service: GitHubService, owner: string) {
    this.service = service;
    this.owner = owner;
  }

  async createTestRepo(name: string): Promise<Repository> {
    const repoName = `test-${name}-${Date.now()}`;
    const repo = await this.service.createRepository({
      name: repoName,
      description: 'Test repository created by ElizaOS GitHub plugin tests',
      private: true,
      auto_init: true,
    });

    this.createdRepos.push(repoName);
    return repo;
  }

  async cleanupTestRepo(name: string): Promise<void> {
    try {
      // Note: Repository deletion requires additional permissions
      // For now, we'll just log the repos that need cleanup
      console.log(`Test repo ${this.owner}/${name} needs manual cleanup`);
    } catch (error) {
      console.error(`Failed to cleanup repo ${name}:`, error);
    }
  }

  async cleanupAll(): Promise<void> {
    for (const repo of this.createdRepos) {
      await this.cleanupTestRepo(repo);
    }
    this.createdRepos = [];
  }

  async seedWithTestData(repo: Repository): Promise<void> {
    const {
      owner: { login },
      name,
    } = repo;

    // Create some test files
    await this.service.createOrUpdateFile(
      login,
      name,
      'README.md',
      '# Test Repository\n\nThis is a test repository for ElizaOS GitHub plugin.',
      'Initial commit',
      'main'
    );

    await this.service.createOrUpdateFile(
      login,
      name,
      'src/index.js',
      'console.log("Hello from test repo!");',
      'Add index.js',
      'main'
    );

    // Create a test issue
    await this.service.createIssue(login, name, {
      title: 'Test Issue',
      body: 'This is a test issue for automated testing',
      labels: ['test', 'automated'],
    });
  }
}

/**
 * Test Data Factories
 */
export const createTestIssue = (overrides?: Partial<Issue>): Issue => {
  return {
    id: Math.floor(Math.random() * 1000000),
    number: Math.floor(Math.random() * 1000),
    title: 'Test Issue',
    body: 'This is a test issue',
    state: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: {
      login: 'testuser',
      id: 12345,
      avatar_url: 'https://example.com/avatar.png',
      type: 'User',
    },
    labels: [],
    assignee: null,
    assignees: [],
    comments: 0,
    closed_at: null,
    html_url: 'https://github.com/test/repo/issues/1',
    ...overrides,
  } as Issue;
};

export const createTestPR = (overrides?: Partial<PullRequest>): PullRequest => {
  return {
    id: Math.floor(Math.random() * 1000000),
    number: Math.floor(Math.random() * 1000),
    title: 'Test Pull Request',
    body: 'This is a test pull request',
    state: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: {
      login: 'testuser',
      id: 12345,
      avatar_url: 'https://example.com/avatar.png',
      type: 'User',
    },
    head: {
      ref: 'feature-branch',
      sha: 'abc123',
    },
    base: {
      ref: 'main',
      sha: 'def456',
    },
    merged: false,
    mergeable: true,
    mergeable_state: 'clean',
    merged_at: null,
    html_url: 'https://github.com/test/repo/pull/1',
    ...overrides,
  } as PullRequest;
};

export const createTestRepository = (overrides?: Partial<Repository>): Repository => {
  return {
    id: Math.floor(Math.random() * 1000000),
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    owner: {
      login: 'testuser',
      id: 12345,
      avatar_url: 'https://example.com/avatar.png',
      type: 'User',
    },
    private: false,
    description: 'A test repository',
    fork: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    pushed_at: new Date().toISOString(),
    homepage: null,
    size: 100,
    stargazers_count: 10,
    watchers_count: 10,
    language: 'JavaScript',
    forks_count: 5,
    open_issues_count: 3,
    default_branch: 'main',
    topics: ['test'],
    has_issues: true,
    has_projects: true,
    has_wiki: true,
    has_pages: false,
    has_downloads: true,
    archived: false,
    disabled: false,
    visibility: 'public',
    license: null,
    ...overrides,
  } as Repository;
};

/**
 * Memory and State Helpers
 */
export const createTestMemory = (text: string, overrides?: Partial<Memory>): Memory => {
  return {
    id: `test-${Date.now()}-${Math.random()}` as UUID,
    roomId: 'test-room' as UUID,
    entityId: 'test-entity' as UUID,
    agentId: 'test-agent' as UUID,
    content: { text, source: 'test' },
    createdAt: Date.now(),
    ...overrides,
  };
};

export const createTestState = (data: Record<string, any> = {}): State => {
  return {
    values: {},
    data,
    text: '',
  };
};

/**
 * Assertion Helpers
 */
export const assertGitHubActionSucceeded = (response: any): void => {
  expect(response).toBeDefined();
  expect(response.text).toBeDefined();
  expect(response.text).not.toContain('Failed');
  expect(response.text).not.toContain('Error');
  expect(response.actions).toBeDefined();
  expect(Array.isArray(response.actions)).toBe(true);
};

export const assertValidRepository = (repo: any): void => {
  expect(repo).toBeDefined();
  expect(repo.id).toBeGreaterThan(0);
  expect(repo.name).toBeTruthy();
  expect(repo.full_name).toMatch(/^[\w-]+\/[\w-]+$/);
  expect(repo.owner).toBeDefined();
  expect(repo.owner.login).toBeTruthy();
};

export const assertValidIssue = (issue: any): void => {
  expect(issue).toBeDefined();
  expect(issue.id).toBeGreaterThan(0);
  expect(issue.number).toBeGreaterThan(0);
  expect(issue.title).toBeTruthy();
  expect(issue.state).toMatch(/^(open|closed)$/);
  expect(issue.user).toBeDefined();
  expect(issue.user.login).toBeTruthy();
};

export const assertValidPullRequest = (pr: any): void => {
  expect(pr).toBeDefined();
  expect(pr.id).toBeGreaterThan(0);
  expect(pr.number).toBeGreaterThan(0);
  expect(pr.title).toBeTruthy();
  expect(pr.state).toMatch(/^(open|closed|merged)$/);
  expect(pr.head).toBeDefined();
  expect(pr.base).toBeDefined();
  expect(pr.user).toBeDefined();
};

/**
 * Environment Helpers
 */
export const isTestEnvironment = process.env.NODE_ENV === 'test';
export const hasTestGitHubToken = !!(process.env.GITHUB_TEST_TOKEN || process.env.GITHUB_TOKEN);

export const describeIfTest = isTestEnvironment ? describe : describe.skip;
export const describeIfToken = hasTestGitHubToken ? describe : describe.skip;

/**
 * Mock Helpers
 */
export const createMockGitHubService = (overrides?: Partial<GitHubService>): any => {
  return {
    validateAuthentication: mock().mockResolvedValue(true),
    getAuthenticatedUser: mock().mockResolvedValue({ login: 'testuser', id: 12345 }),
    getRateLimit: mock().mockResolvedValue({
      limit: 5000,
      remaining: 4999,
      reset: Date.now() / 1000 + 3600,
      used: 1,
    }),
    getRepository: mock().mockResolvedValue(createTestRepository()),
    listRepositories: mock().mockResolvedValue([createTestRepository()]),
    searchRepositories: mock().mockResolvedValue({
      total_count: 1,
      items: [createTestRepository()],
    }),
    createRepository: mock().mockResolvedValue(createTestRepository()),
    getIssue: mock().mockResolvedValue(createTestIssue()),
    listIssues: mock().mockResolvedValue([createTestIssue()]),
    searchIssues: mock().mockResolvedValue({
      total_count: 1,
      items: [createTestIssue()],
    }),
    createIssue: mock().mockResolvedValue(createTestIssue()),
    createIssueComment: mock().mockResolvedValue({ id: 1, body: 'Test comment' }),
    getPullRequest: mock().mockResolvedValue(createTestPR()),
    listPullRequests: mock().mockResolvedValue([createTestPR()]),
    searchPullRequests: mock().mockResolvedValue({
      total_count: 1,
      items: [createTestPR()],
    }),
    createPullRequest: mock().mockResolvedValue(createTestPR()),
    mergePullRequest: mock().mockResolvedValue({ merged: true, sha: 'merge-sha' }),
    getActivityLog: mock().mockReturnValue([]),
    clearActivityLog: mock(),
    ...overrides,
  };
};

/**
 * Wait Helpers
 */
export const waitForCondition = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

/**
 * Performance Helpers
 */
export const measurePerformance = async <T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);

  return { result, duration };
};
