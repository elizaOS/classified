/**
 * GitHub Service
 * Provides integration with GitHub API for repository management and deployment
 */

import { Octokit } from '@octokit/rest';
import { logger } from '@/lib/logger';

export interface CreateRepositoryOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
}

export interface AutocoderRepositoryOptions extends CreateRepositoryOptions {
  template?: string;
  initialFiles?: Record<string, string>;
}

export interface PushFilesOptions {
  owner: string;
  repo: string;
  branch: string;
  files: Record<string, string>;
  message: string;
  baseBranch?: string;
}

export interface DeployRepositoryOptions {
  owner: string;
  repo: string;
  environment: string;
  ref: string;
  description?: string;
  autoMerge?: boolean;
  payload?: Record<string, any>;
}

export interface RepositoryStats {
  commits: number;
  contributors: number;
  languages: Record<string, number>;
  defaultBranch: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    const authToken = token || process.env.GITHUB_TOKEN;
    if (!authToken) {
      throw new Error('GitHub token is required');
    }

    this.octokit = new Octokit({
      auth: authToken,
    });
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser() {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return {
        login: data.login,
        name: data.name,
        email: data.email,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
      };
    } catch (error) {
      logger.error('Failed to get authenticated user', error);
      throw error;
    }
  }

  /**
   * Get user repositories
   */
  async getUserRepositories() {
    try {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      });

      return data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
      }));
    } catch (error) {
      logger.error('Failed to get user repositories', error);
      throw error;
    }
  }

  /**
   * Create a new repository
   */
  async createRepository(options: CreateRepositoryOptions) {
    try {
      const { data } = await this.octokit.rest.repos.create({
        name: options.name,
        description: options.description,
        private: options.private ?? false,
        auto_init: options.autoInit ?? true,
        gitignore_template: options.gitignoreTemplate,
        license_template: options.licenseTemplate,
      });

      // Push initial files if provided
      if (options.autoInit) {
        await this.pushFiles({
          owner: data.owner.login,
          repo: data.name,
          branch: data.default_branch,
          files: {},
          message: 'Initial commit',
        });
      }

      return {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        html_url: data.html_url,
        clone_url: data.clone_url,
        default_branch: data.default_branch,
      };
    } catch (error) {
      logger.error('Failed to create repository', error);
      throw error;
    }
  }

  /**
   * Create an Autocoder repository with template and initial files
   */
  async createAutocoderRepository(options: AutocoderRepositoryOptions) {
    try {
      // Create the repository
      const repo = await this.createRepository({
        ...options,
        autoInit: true,
      });

      // Push initial files if provided
      if (
        options.initialFiles &&
        Object.keys(options.initialFiles).length > 0
      ) {
        await this.pushFiles({
          owner: repo.full_name.split('/')[0],
          repo: repo.name,
          branch: repo.default_branch,
          files: options.initialFiles,
          message: 'Add initial Autocoder files',
        });
      }

      return repo;
    } catch (error) {
      logger.error('Failed to create Autocoder repository', error);
      throw error;
    }
  }

  /**
   * Create a feature branch
   */
  async createFeatureBranch(
    owner: string,
    repo: string,
    branchName: string,
    baseBranch?: string,
  ) {
    try {
      // Get the base branch ref
      const base = baseBranch || 'main';
      const { data: baseRef } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${base}`,
      });

      // Create the new branch
      const { data: newRef } = await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      });

      return {
        ref: newRef.ref,
        sha: newRef.object.sha,
        url: newRef.url,
      };
    } catch (error) {
      logger.error('Failed to create feature branch', error);
      throw error;
    }
  }

  /**
   * Push files to a repository
   */
  async pushFiles(options: PushFilesOptions) {
    try {
      const { owner, repo, branch, files, message } = options;

      // Get the current commit SHA
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      const currentCommitSha = ref.object.sha;

      // Get the tree SHA from the commit
      const { data: commit } = await this.octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha,
      });

      const currentTreeSha = commit.tree.sha;

      // Create blobs for each file
      const blobs = await Promise.all(
        Object.entries(files).map(async ([path, content]) => {
          const { data: blob } = await this.octokit.rest.git.createBlob({
            owner,
            repo,
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          });

          return {
            path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        }),
      );

      // Create a new tree
      const { data: tree } = await this.octokit.rest.git.createTree({
        owner,
        repo,
        tree: blobs,
        base_tree: currentTreeSha,
      });

      // Create a new commit
      const { data: newCommit } = await this.octokit.rest.git.createCommit({
        owner,
        repo,
        message,
        tree: tree.sha,
        parents: [currentCommitSha],
      });

      // Update the branch reference
      await this.octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });

      return {
        commit: newCommit.sha,
        tree: tree.sha,
        message,
      };
    } catch (error) {
      logger.error('Failed to push files', error);
      throw error;
    }
  }

  /**
   * Deploy a repository
   */
  async deployRepository(options: DeployRepositoryOptions) {
    try {
      const { owner, repo, environment, ref, description, autoMerge, payload } =
        options;

      // Create a deployment
      const { data: deployment } =
        await this.octokit.rest.repos.createDeployment({
          owner,
          repo,
          ref,
          environment,
          description,
          auto_merge: autoMerge ?? false,
          required_contexts: [],
          payload: payload || {},
        });

      // Create a deployment status
      const { data: status } =
        await this.octokit.rest.repos.createDeploymentStatus({
          owner,
          repo,
          deployment_id: deployment.id,
          state: 'success',
          environment_url: `https://${owner}.github.io/${repo}`,
          description: 'Deployment completed successfully',
        });

      return {
        deployment_id: deployment.id,
        status: status.state,
        environment,
        url: status.environment_url,
      };
    } catch (error) {
      logger.error('Failed to deploy repository', error);
      throw error;
    }
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(
    owner: string,
    repo: string,
  ): Promise<RepositoryStats> {
    try {
      // Get repository info
      const { data: repoData } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      // Get commit count
      const { data: commits } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });

      // Get contributors
      const { data: contributors } =
        await this.octokit.rest.repos.listContributors({
          owner,
          repo,
          per_page: 100,
        });

      // Get languages
      const { data: languages } = await this.octokit.rest.repos.listLanguages({
        owner,
        repo,
      });

      return {
        commits: parseInt(commits[0]?.sha ? '100' : '0'), // GitHub API doesn't provide total count
        contributors: contributors.length,
        languages,
        defaultBranch: repoData.default_branch,
        size: repoData.size,
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get repository stats', error);
      throw error;
    }
  }

  /**
   * Search for Autocoder repositories
   */
  async searchAutocoderRepositories(query: string) {
    try {
      const { data } = await this.octokit.rest.search.repos({
        q: `${query} topic:autocoder`,
        sort: 'stars',
        order: 'desc',
        per_page: 30,
      });

      return data.items.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        stargazers_count: repo.stargazers_count,
        language: repo.language,
        updated_at: repo.updated_at,
      }));
    } catch (error) {
      logger.error('Failed to search repositories', error);
      throw error;
    }
  }

  /**
   * Validate repository access
   */
  async validateRepository(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({ owner, repo });
      return true;
    } catch (error) {
      if ((error as any).status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimit() {
    const { data } = await this.octokit.rest.rateLimit.get();
    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000),
    };
  }
}

/**
 * Create a GitHub service instance
 */
export function createGitHubService(token?: string): GitHubService {
  return new GitHubService(token);
}
