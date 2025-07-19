import { logger, Service, type IAgentRuntime } from '@elizaos/core';
import { Octokit } from '@octokit/rest';

export interface GitHubConfig {
  GITHUB_TOKEN: string;
  GITHUB_USERNAME?: string;
  GITHUB_EMAIL?: string;
}

export interface GitHubActivityItem {
  id: string;
  timestamp: string;
  action: string;
  resource_type: 'repository' | 'issue' | 'pr' | 'user';
  resource_id: string;
  details: Record<string, any>;
  success: boolean;
  error?: string;
}

// Error classes
export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'GitHubAPIError';
  }
}

export class GitHubAuthenticationError extends GitHubAPIError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'GitHubAuthenticationError';
  }
}

export class GitHubRateLimitError extends GitHubAPIError {
  constructor(
    message: string,
    public resetTime: number
  ) {
    super(message, 403);
    this.name = 'GitHubRateLimitError';
  }
}

// Removed unused type imports

export class GitHubService extends Service {
  static serviceType = 'github';

  capabilityDescription = 'GitHub API integration for repository, issue, and PR management';

  private octokit: Octokit;
  private rateLimitRemaining: number = 5000;
  private rateLimitReset: number = 0;
  private activityLog: GitHubActivityItem[] = [];
  private githubConfig: GitHubConfig;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);

    // Get config from runtime settings
    const githubToken = runtime?.getSetting('GITHUB_TOKEN') as string;
    const githubUsername = runtime?.getSetting('GITHUB_USERNAME') as string;
    const githubEmail = runtime?.getSetting('GITHUB_EMAIL') as string;

    if (!githubToken) {
      throw new Error('GitHub token is required');
    }

    this.githubConfig = {
      GITHUB_TOKEN: githubToken,
      GITHUB_USERNAME: githubUsername,
      GITHUB_EMAIL: githubEmail,
    };

    this.config = {
      GITHUB_TOKEN: githubToken,
      GITHUB_USERNAME: githubUsername,
      GITHUB_EMAIL: githubEmail,
    };

    this.octokit = new Octokit({
      auth: this.githubConfig.GITHUB_TOKEN,
      userAgent: 'ElizaOS GitHub Plugin',
    });
  }

  static async start(runtime: IAgentRuntime): Promise<GitHubService> {
    const service = new GitHubService(runtime);
    logger.info('GitHub service started');
    return service;
  }

  async stop(): Promise<void> {
    this.activityLog = [];
    logger.info('GitHub service stopped');
  }

  /**
   * Validate authentication by checking user permissions
   */
  async validateAuthentication(): Promise<boolean> {
    try {
      await this.checkRateLimit();
      const { data } = await this.octokit.users.getAuthenticated();
      this.updateRateLimit((data as any)?.headers || {});

      this.logActivity(
        'validate_authentication',
        'user',
        data.login || 'unknown',
        { user_id: data.id },
        true
      );

      return true;
    } catch (error) {
      this.logActivity('validate_authentication', 'user', 'unknown', {}, false, String(error));
      return false;
    }
  }

  /**
   * Rate limiting helper to prevent hitting GitHub API limits
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now() / 1000;

    // If we're near the rate limit and reset time hasn't passed, wait
    if (this.rateLimitRemaining < 100 && now < this.rateLimitReset) {
      const waitTime = (this.rateLimitReset - now + 1) * 1000;
      logger.warn(`GitHub rate limit low (${this.rateLimitRemaining}), waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Update rate limit info from response headers
   */
  private updateRateLimit(headers: any): void {
    if (headers['x-ratelimit-remaining']) {
      this.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }
    if (headers['x-ratelimit-reset']) {
      this.rateLimitReset = parseInt(headers['x-ratelimit-reset'], 10);
    }
  }

  /**
   * Sanitize error for logging (remove sensitive data)
   */
  private sanitizeError(error: any): any {
    const sanitized = { ...error };

    // Remove sensitive headers and response data
    if (sanitized.response) {
      delete sanitized.response.headers?.authorization;
      delete sanitized.response.headers?.['x-github-token'];
      delete sanitized.response.request?.headers?.authorization;
    }

    if (sanitized.request) {
      delete sanitized.request.headers?.authorization;
      delete sanitized.request.headers?.['x-github-token'];
    }

    return sanitized;
  }

  /**
   * Validate GitHub username/repo name format
   */
  private validateGitHubName(name: string, type: 'owner' | 'repo' | 'username'): void {
    const pattern = /^[a-zA-Z0-9\-_.]+$/;
    if (!pattern.test(name)) {
      throw new Error(`Invalid GitHub ${type} name: ${name}`);
    }
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser(): Promise<any> {
    try {
      await this.checkRateLimit();
      const { data, headers } = await this.octokit.users.getAuthenticated();
      this.updateRateLimit(headers);

      this.logActivity('get_authenticated_user', 'user', data.login, { user: data }, true);
      return data;
    } catch (error) {
      this.logActivity('get_authenticated_user', 'user', 'unknown', {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<any> {
    try {
      this.validateGitHubName(username, 'owner');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.users.getByUsername({
        username,
      });
      this.updateRateLimit(headers);

      this.logActivity('get_user', 'user', username, { user: data }, true);
      return data;
    } catch (error) {
      this.logActivity('get_user', 'user', username, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.get({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_repository',
        'repository',
        `${owner}/${repo}`,
        { repository: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_repository',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * List repositories for authenticated user
   */
  async getRepositories(
    options: {
      visibility?: 'all' | 'public' | 'private';
      affiliation?: 'owner' | 'collaborator' | 'organization_member';
      type?: 'all' | 'owner' | 'public' | 'private' | 'member';
      sort?: 'created' | 'updated' | 'pushed' | 'full_name';
      direction?: 'asc' | 'desc';
      per_page?: number;
    } = {}
  ): Promise<any> {
    try {
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.listForAuthenticatedUser({
        visibility: options.visibility || 'all',
        affiliation: options.affiliation || 'owner,collaborator,organization_member',
        type: options.type || 'all',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'list_repositories',
        'repository',
        'authenticated_user',
        { count: data.length },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'list_repositories',
        'repository',
        'authenticated_user',
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get repository issues
   */
  async getRepositoryIssues(
    owner: string,
    repo: string,
    options: {
      milestone?: string | number;
      state?: 'open' | 'closed' | 'all';
      assignee?: string;
      creator?: string;
      mentioned?: string;
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      since?: string;
      per_page?: number;
    } = {}
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.issues.listForRepo({
        owner,
        repo,
        milestone: options.milestone ? String(options.milestone) : undefined,
        state: options.state || 'open',
        assignee: options.assignee,
        creator: options.creator,
        mentioned: options.mentioned,
        labels: options.labels,
        sort: options.sort || 'created',
        direction: options.direction || 'desc',
        since: options.since,
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_repository_issues',
        'repository',
        `${owner}/${repo}`,
        { count: data.length },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_repository_issues',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get specific issue
   */
  async getIssue(owner: string, repo: string, issue_number: number): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.issues.get({
        owner,
        repo,
        issue_number,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_issue',
        'issue',
        `${owner}/${repo}#${issue_number}`,
        { issue: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_issue',
        'issue',
        `${owner}/${repo}#${issue_number}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Create issue comment
   */
  async createIssueComment(
    owner: string,
    repo: string,
    issue_number: number,
    body: string
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      if (!body.trim()) {
        throw new Error('Comment body cannot be empty');
      }

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number,
        body,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'create_issue_comment',
        'issue',
        `${owner}/${repo}#${issue_number}`,
        { comment: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'create_issue_comment',
        'issue',
        `${owner}/${repo}#${issue_number}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get issue comments
   */
  async getIssueComments(
    owner: string,
    repo: string,
    issue_number: number,
    options: {
      since?: string;
      per_page?: number;
    } = {}
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.issues.listComments({
        owner,
        repo,
        issue_number,
        since: options.since,
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_issue_comments',
        'issue',
        `${owner}/${repo}#${issue_number}`,
        { count: data.length },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_issue_comments',
        'issue',
        `${owner}/${repo}#${issue_number}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get repository pull requests
   */
  async getRepositoryPullRequests(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      head?: string;
      base?: string;
      sort?: 'created' | 'updated' | 'popularity';
      direction?: 'asc' | 'desc';
      per_page?: number;
    } = {}
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.pulls.list({
        owner,
        repo,
        state: options.state || 'open',
        head: options.head,
        base: options.base,
        sort: options.sort || 'created',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_repository_pull_requests',
        'repository',
        `${owner}/${repo}`,
        { count: data.length },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_repository_pull_requests',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get specific pull request
   */
  async getPullRequest(owner: string, repo: string, pull_number: number): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_pull_request',
        'pr',
        `${owner}/${repo}#${pull_number}`,
        { pr: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_pull_request',
        'pr',
        `${owner}/${repo}#${pull_number}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Create pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    options: {
      title: string;
      head: string;
      base: string;
      body?: string;
      maintainer_can_modify?: boolean;
      draft?: boolean;
    }
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.pulls.create({
        owner,
        repo,
        title: options.title,
        head: options.head,
        base: options.base,
        body: options.body,
        maintainer_can_modify: options.maintainer_can_modify,
        draft: options.draft,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'create_pull_request',
        'pr',
        `${owner}/${repo}#${data.number}`,
        { pr: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity('create_pull_request', 'pr', `${owner}/${repo}`, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Create or update file
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch?: string,
    sha?: string
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        sha,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'create_or_update_file',
        'repository',
        `${owner}/${repo}:${path}`,
        { commit: data.commit },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'create_or_update_file',
        'repository',
        `${owner}/${repo}:${path}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get file content
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<{ content: string; sha: string }> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      this.updateRateLimit(headers);

      // Handle file content (not directory)
      if ('content' in data && typeof data.content === 'string') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        this.logActivity(
          'get_file_content',
          'repository',
          `${owner}/${repo}:${path}`,
          { fileSize: content.length },
          true
        );

        return {
          content,
          sha: data.sha,
        };
      }

      throw new Error('Path is not a file or content not available');
    } catch (error) {
      this.logActivity(
        'get_file_content',
        'repository',
        `${owner}/${repo}:${path}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch?: string
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.deleteFile({
        owner,
        repo,
        path,
        message,
        sha,
        branch,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'delete_file',
        'repository',
        `${owner}/${repo}:${path}`,
        { commit: data.commit },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'delete_file',
        'repository',
        `${owner}/${repo}:${path}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get repository tree
   */
  async getRepositoryTree(owner: string, repo: string, tree_sha?: string): Promise<any[]> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      // Get default branch if no tree_sha provided
      if (!tree_sha) {
        const repoData = await this.getRepository(owner, repo);
        tree_sha = repoData.default_branch;
      }

      const { data, headers } = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: tree_sha || 'HEAD',
        recursive: 'true',
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_repository_tree',
        'repository',
        `${owner}/${repo}`,
        { treeCount: data.tree.length },
        true
      );
      return data.tree;
    } catch (error) {
      this.logActivity(
        'get_repository_tree',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get default branch
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const repository = await this.getRepository(owner, repo);
      return repository.default_branch;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Create webhook
   */
  async createWebhook(
    owner: string,
    repo: string,
    config: {
      url: string;
      content_type?: 'json' | 'form';
      secret?: string;
      insecure_ssl?: string;
    },
    events: string[] = ['push']
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config,
        events,
      });
      this.updateRateLimit(headers);

      this.logActivity('create_webhook', 'repository', `${owner}/${repo}`, { webhook: data }, true);
      return data;
    } catch (error) {
      this.logActivity(
        'create_webhook',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * List webhooks
   */
  async listWebhooks(owner: string, repo: string): Promise<any[]> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.listWebhooks({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'list_webhooks',
        'repository',
        `${owner}/${repo}`,
        { count: data.length },
        true
      );
      return data;
    } catch (error) {
      this.logActivity('list_webhooks', 'repository', `${owner}/${repo}`, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(owner: string, repo: string, hook_id: number): Promise<void> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      await this.octokit.repos.deleteWebhook({
        owner,
        repo,
        hook_id,
      });

      this.logActivity(
        'delete_webhook',
        'repository',
        `${owner}/${repo}`,
        { webhook_id: hook_id },
        true
      );
    } catch (error) {
      this.logActivity(
        'delete_webhook',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Ping webhook
   */
  async pingWebhook(owner: string, repo: string, hook_id: number): Promise<void> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      await this.octokit.repos.pingWebhook({
        owner,
        repo,
        hook_id,
      });

      this.logActivity(
        'ping_webhook',
        'repository',
        `${owner}/${repo}`,
        { webhook_id: hook_id },
        true
      );
    } catch (error) {
      this.logActivity('ping_webhook', 'repository', `${owner}/${repo}`, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Get activity log for debugging and monitoring
   */
  getActivityLog(limit?: number): GitHubActivityItem[] {
    const log = this.activityLog.slice(); // Return a copy
    return limit ? log.slice(-limit) : log;
  }

  /**
   * Clear activity log
   */
  clearActivityLog(): void {
    this.activityLog = [];
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): {
    remaining: number;
    reset: number;
    limit: number;
    used: number;
    resource: string;
  } {
    const used = 5000 - this.rateLimitRemaining;
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset,
      limit: 5000,
      used,
      resource: 'core',
    };
  }

  /**
   * Get rate limit (alias for compatibility)
   */
  getRateLimit(): {
    remaining: number;
    reset: number;
    limit: number;
    used: number;
    resource: string;
  } {
    return this.getRateLimitStatus();
  }

  /**
   * Get current authenticated user (alias for compatibility)
   */
  async getCurrentUser(): Promise<any> {
    return this.getAuthenticatedUser();
  }

  /**
   * Get Git reference
   */
  async getRef(owner: string, repo: string, ref: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.git.getRef({
        owner,
        repo,
        ref,
      });
      this.updateRateLimit(headers);

      this.logActivity('get_ref', 'repository', `${owner}/${repo}:${ref}`, { ref: data }, true);
      return data;
    } catch (error) {
      this.logActivity(
        'get_ref',
        'repository',
        `${owner}/${repo}:${ref}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(owner: string, repo: string, branchName: string, sha: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'create_branch',
        'repository',
        `${owner}/${repo}:${branchName}`,
        { branch: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'create_branch',
        'repository',
        `${owner}/${repo}:${branchName}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * List branches
   */
  async listBranches(owner: string, repo: string): Promise<any[]> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.listBranches({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'list_branches',
        'repository',
        `${owner}/${repo}`,
        { count: data.length },
        true
      );
      return data;
    } catch (error) {
      this.logActivity('list_branches', 'repository', `${owner}/${repo}`, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Get branch details
   */
  async getBranch(owner: string, repo: string, branch: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getBranch({
        owner,
        repo,
        branch,
      });
      this.updateRateLimit(headers);

      this.logActivity('get_branch', 'repository', `${owner}/${repo}:${branch}`, { data }, true);
      return data;
    } catch (error) {
      this.logActivity(
        'get_branch',
        'repository',
        `${owner}/${repo}:${branch}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { headers } = await this.octokit.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      this.updateRateLimit(headers);

      this.logActivity('delete_branch', 'repository', `${owner}/${repo}:${branch}`, {}, true);
    } catch (error) {
      this.logActivity(
        'delete_branch',
        'repository',
        `${owner}/${repo}:${branch}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Compare two branches
   */
  async compareBranches(owner: string, repo: string, base: string, head: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,
        head,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'compare_branches',
        'repository',
        `${owner}/${repo}:${base}...${head}`,
        { comparison: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'compare_branches',
        'repository',
        `${owner}/${repo}:${base}...${head}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get branch protection settings
   */
  async getBranchProtection(owner: string, repo: string, branch: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getBranchProtection({
        owner,
        repo,
        branch,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_branch_protection',
        'repository',
        `${owner}/${repo}:${branch}`,
        { protection: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_branch_protection',
        'repository',
        `${owner}/${repo}:${branch}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * List issues
   */
  async listIssues(owner: string, repo: string, options: any = {}): Promise<any> {
    return this.getRepositoryIssues(owner, repo, options);
  }

  /**
   * Create issue
   */
  async createIssue(
    owner: string,
    repo: string,
    options: {
      title: string;
      body?: string;
      assignees?: string[];
      milestone?: number;
      labels?: string[];
    }
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.issues.create({
        owner,
        repo,
        title: options.title,
        body: options.body,
        assignees: options.assignees,
        milestone: options.milestone ? String(options.milestone) : undefined,
        labels: options.labels,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'create_issue',
        'issue',
        `${owner}/${repo}#${data.number}`,
        { issue: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity('create_issue', 'issue', `${owner}/${repo}`, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Search issues
   */
  async searchIssues(query: string, options: any = {}): Promise<any> {
    try {
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.search.issuesAndPullRequests({
        q: query,
        sort: options.sort,
        order: options.order,
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity('search_issues', 'issue', query, { count: data.items.length }, true);
      return data; // Return the full search result with items and total_count
    } catch (error) {
      this.logActivity('search_issues', 'issue', query, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Search pull requests
   */
  async searchPullRequests(query: string, options: any = {}): Promise<any> {
    // Pull requests are also issues in GitHub's API, so we use the same endpoint
    // but ensure we're searching for PRs
    const prQuery = query.includes('is:pr') ? query : `${query} is:pr`;
    return this.searchIssues(prQuery, options);
  }

  /**
   * List pull requests
   */
  async listPullRequests(owner: string, repo: string, options: any = {}): Promise<any> {
    return this.getRepositoryPullRequests(owner, repo, options);
  }

  /**
   * Merge pull request
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    pull_number: number,
    options: {
      commit_title?: string;
      commit_message?: string;
      merge_method?: 'merge' | 'squash' | 'rebase';
    } = {}
  ): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.pulls.merge({
        owner,
        repo,
        pull_number,
        commit_title: options.commit_title,
        commit_message: options.commit_message,
        merge_method: options.merge_method || 'merge',
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'merge_pull_request',
        'pr',
        `${owner}/${repo}#${pull_number}`,
        { merge: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'merge_pull_request',
        'pr',
        `${owner}/${repo}#${pull_number}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * List repositories
   */
  async listRepositories(options: any = {}): Promise<any> {
    return this.getRepositories(options);
  }

  /**
   * Create repository
   */
  async createRepository(options: {
    name: string;
    description?: string;
    private?: boolean;
    auto_init?: boolean;
    gitignore_template?: string;
    license_template?: string;
  }): Promise<any> {
    try {
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.createForAuthenticatedUser({
        name: options.name,
        description: options.description,
        private: options.private,
        auto_init: options.auto_init,
        gitignore_template: options.gitignore_template,
        license_template: options.license_template,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'create_repository',
        'repository',
        data.full_name,
        { repository: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity('create_repository', 'repository', options.name, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Search repositories
   */
  async searchRepositories(query: string, options: any = {}): Promise<any> {
    try {
      await this.checkRateLimit();

      const { data, headers } = await this.octokit.search.repos({
        q: query,
        sort: options.sort,
        order: options.order,
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'search_repositories',
        'repository',
        query,
        { count: data.items.length },
        true
      );
      return data; // Return the full search result with items and total_count
    } catch (error) {
      this.logActivity('search_repositories', 'repository', query, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Get contributors stats
   */
  async getContributorsStats(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getContributorsStats({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_contributors_stats',
        'repository',
        `${owner}/${repo}`,
        { stats: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_contributors_stats',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get commit activity stats
   */
  async getCommitActivityStats(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getCommitActivityStats({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_commit_activity_stats',
        'repository',
        `${owner}/${repo}`,
        { stats: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_commit_activity_stats',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get code frequency stats
   */
  async getCodeFrequencyStats(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getCodeFrequencyStats({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_code_frequency_stats',
        'repository',
        `${owner}/${repo}`,
        { stats: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_code_frequency_stats',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get repository languages
   */
  async getLanguages(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.listLanguages({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_languages',
        'repository',
        `${owner}/${repo}`,
        { languages: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity('get_languages', 'repository', `${owner}/${repo}`, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Get traffic views
   */
  async getTrafficViews(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getViews({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_traffic_views',
        'repository',
        `${owner}/${repo}`,
        { views: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_traffic_views',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get traffic clones
   */
  async getTrafficClones(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getClones({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_traffic_clones',
        'repository',
        `${owner}/${repo}`,
        { clones: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_traffic_clones',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get top paths
   */
  async getTopPaths(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getTopPaths({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity('get_top_paths', 'repository', `${owner}/${repo}`, { paths: data }, true);
      return data;
    } catch (error) {
      this.logActivity('get_top_paths', 'repository', `${owner}/${repo}`, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * Get top referrers
   */
  async getTopReferrers(owner: string, repo: string): Promise<any> {
    try {
      this.validateGitHubName(owner, 'owner');
      this.validateGitHubName(repo, 'repo');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.getTopReferrers({
        owner,
        repo,
      });
      this.updateRateLimit(headers);

      this.logActivity(
        'get_top_referrers',
        'repository',
        `${owner}/${repo}`,
        { referrers: data },
        true
      );
      return data;
    } catch (error) {
      this.logActivity(
        'get_top_referrers',
        'repository',
        `${owner}/${repo}`,
        {},
        false,
        String(error)
      );
      throw this.handleError(error);
    }
  }

  /**
   * Get user information
   */
  async getUser(username: string): Promise<any> {
    try {
      this.validateGitHubName(username, 'username');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.users.getByUsername({
        username,
      });
      this.updateRateLimit(headers);

      this.logActivity('get_user', 'user', username, { user: data }, true);
      return data;
    } catch (error) {
      this.logActivity('get_user', 'user', username, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * List user repositories
   */
  async listUserRepositories(username: string, options: any = {}): Promise<any> {
    try {
      this.validateGitHubName(username, 'username');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.repos.listForUser({
        username,
        type: options.type || 'owner',
        sort: options.sort || 'updated',
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity('list_user_repositories', 'user', username, { count: data.length }, true);
      return data;
    } catch (error) {
      this.logActivity('list_user_repositories', 'user', username, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  /**
   * List user events
   */
  async listUserEvents(username: string, options: any = {}): Promise<any> {
    try {
      this.validateGitHubName(username, 'username');

      await this.checkRateLimit();

      const { data, headers } = await this.octokit.activity.listEventsForAuthenticatedUser({
        username,
        per_page: options.per_page || 30,
      });
      this.updateRateLimit(headers);

      this.logActivity('list_user_events', 'user', username, { count: data.length }, true);
      return data;
    } catch (error) {
      this.logActivity('list_user_events', 'user', username, {}, false, String(error));
      throw this.handleError(error);
    }
  }

  private logActivity(
    action: string,
    resourceType: 'repository' | 'issue' | 'pr' | 'user',
    resourceId: string,
    details: Record<string, any> = {},
    success: boolean = true,
    error?: string
  ) {
    const activity: GitHubActivityItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      success,
      error,
    };

    this.activityLog.push(activity);

    // Keep only the last 1000 activities to prevent memory issues
    if (this.activityLog.length > 1000) {
      this.activityLog = this.activityLog.slice(-1000);
    }

    if (success) {
      logger.info(`GitHub activity: ${action} on ${resourceType} ${resourceId}`);
    } else {
      logger.error(`GitHub activity failed: ${action} on ${resourceType} ${resourceId} - ${error}`);
    }
  }

  private handleError(error: any): GitHubAPIError {
    // Log the sanitized error for debugging
    logger.error('[GitHubService] GitHub API error:', this.sanitizeError(error));

    if (error.status === 401) {
      return new GitHubAuthenticationError(
        'GitHub authentication failed. Please verify your token.'
      );
    }

    if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
      const resetTime = parseInt(error.response.headers['x-ratelimit-reset'] || '0', 10);
      return new GitHubRateLimitError('GitHub API rate limit exceeded', resetTime);
    }

    if (error.status === 404) {
      return new GitHubAPIError(
        'Resource not found. Please check the repository/issue/PR exists and you have access.',
        error.status,
        undefined // Don't include response to avoid potential token exposure
      );
    }

    if (error.status === 422) {
      return new GitHubAPIError(
        'Invalid request. Please check the provided parameters.',
        error.status,
        undefined
      );
    }

    return new GitHubAPIError(
      error.message || 'GitHub API error occurred',
      error.status || 500,
      undefined // Don't include response to avoid potential token exposure
    );
  }
}
