import {
  type Action,
  type ActionExample,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';
import { GitHubService } from '../services/github';
import { CreateRepositoryOptions } from '../types';

// Get Repository Action
export const getRepositoryAction: Action = {
  name: 'GET_GITHUB_REPOSITORY',
  similes: ['CHECK_REPO', 'FETCH_REPOSITORY', 'REPO_INFO', 'INSPECT_REPO'],
  description:
    'Retrieves information about a GitHub repository including stats, language, and metadata. Can be chained with LIST_GITHUB_ISSUES or LIST_GITHUB_PULL_REQUESTS to explore repository content',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: { owner?: string; repo?: string } = {},
    callback?: HandlerCallback
  ) => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract owner and repo from message text or options
      const text = message.content.text || '';
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);

      const owner = options.owner || ownerRepoMatch?.[1] || runtime.getSetting('GITHUB_OWNER');
      const repo = options.repo || ownerRepoMatch?.[2];

      if (!owner || !repo) {
        throw new Error(
          'Repository owner and name are required. Please specify as "owner/repo" or provide them in options'
        );
      }

      logger.info(`Getting repository information for ${owner}/${repo}`);
      const repository = await githubService.getRepository(owner, repo);

      const responseContent: Content = {
        text: `Repository: ${repository.full_name}
Description: ${repository.description || 'No description'}
Language: ${repository.language || 'Unknown'}
Stars: ${repository.stargazers_count}
Forks: ${repository.forks_count}
Open Issues: ${repository.open_issues_count}
Private: ${repository.private ? 'Yes' : 'No'}
Created: ${new Date(repository.created_at).toLocaleDateString()}
Last Updated: ${new Date(repository.updated_at).toLocaleDateString()}
URL: ${repository.html_url}`,
        actions: ['GET_GITHUB_REPOSITORY'],
        source: message.content.source,
        // Include data for callbacks
        repository,
        owner,
        repo,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return ActionResult for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          success: true,
          repository,
          owner,
          repo,
          repositoryUrl: repository.html_url,
          stars: repository.stargazers_count,
          language: repository.language,
        },
        data: {
          actionName: 'GET_GITHUB_REPOSITORY',
          repository,
          github: {
            ...state?.github,
            lastRepository: repository,
            repositories: {
              ...state?.github?.repositories,
              [repository.full_name]: repository,
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in GET_GITHUB_REPOSITORY action:', error);
      const errorContent: Content = {
        text: `Failed to get repository information: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_REPOSITORY'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: true,
        text: errorContent.text,
        values: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        data: {
          actionName: 'GET_GITHUB_REPOSITORY',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Get information about elizaOS/eliza repository',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Repository: elizaOS/eliza\nDescription: Eliza is a simple, fast, and lightweight AI agent framework\nLanguage: TypeScript\nStars: 1234\nForks: 567\nOpen Issues: 42\nPrivate: No\nCreated: 1/15/2024\nLast Updated: 3/20/2024\nURL: https://github.com/elizaOS/eliza',
          actions: ['GET_GITHUB_REPOSITORY'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Check the nodejs/node repository and then list its open issues',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll get information about the nodejs/node repository and then list its open issues.",
          actions: ['GET_GITHUB_REPOSITORY', 'LIST_GITHUB_ISSUES'],
        },
      },
    ],
  ] as ActionExample[][],
};

// List Repositories Action
export const listRepositoriesAction: Action = {
  name: 'LIST_GITHUB_REPOSITORIES',
  similes: ['LIST_REPOS', 'MY_REPOSITORIES', 'SHOW_REPOS'],
  description:
    'Lists GitHub repositories for the authenticated user with stats and metadata. Can be chained with GET_GITHUB_REPOSITORY to inspect specific repositories or CREATE_GITHUB_REPOSITORY to add new ones',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: {
      type?: 'all' | 'owner' | 'public' | 'private' | 'member';
      sort?: 'created' | 'updated' | 'pushed' | 'full_name';
      limit?: number;
    } = {},
    callback?: HandlerCallback
  ) => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      const repositories = await githubService.listRepositories({
        type: options.type || 'owner',
        sort: options.sort || 'updated',
        per_page: options.limit || 10,
      });

      const repoList = repositories
        .map(
          (repo: any) =>
            `• ${repo.full_name} (${repo.language || 'Unknown'}) - ⭐ ${repo.stargazers_count}`
        )
        .join('\n');

      const responseContent: Content = {
        text: `Your repositories (${repositories.length} shown):\n${repoList}`,
        actions: ['LIST_GITHUB_REPOSITORIES'],
        source: message.content.source,
        // Include data for callbacks
        repositories,
        repositoryCount: repositories.length,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return ActionResult for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          success: true,
          repositories,
          repositoryCount: repositories.length,
          repositoryNames: repositories.map((repo: any) => repo.full_name),
        },
        data: {
          actionName: 'LIST_GITHUB_REPOSITORIES',
          repositories,
          github: {
            ...state?.github,
            lastRepositories: repositories,
            repositories: {
              ...state?.github?.repositories,
              ...repositories.reduce(
                (acc: any, repo: any) => {
                  acc[repo.full_name] = repo;
                  return acc;
                },
                {} as Record<string, any>
              ),
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in LIST_GITHUB_REPOSITORIES action:', error);
      const errorContent: Content = {
        text: `Failed to list repositories: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['LIST_GITHUB_REPOSITORIES'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: true,
        text: errorContent.text,
        values: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        data: {
          actionName: 'LIST_GITHUB_REPOSITORIES',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Show me my repositories',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Your repositories (3 shown):\n• user/awesome-project (JavaScript) - ⭐ 25\n• user/my-plugin (TypeScript) - ⭐ 8\n• user/test-repo (Python) - ⭐ 2',
          actions: ['LIST_GITHUB_REPOSITORIES'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'List my most recent repositories and check which ones have open pull requests',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll list your most recent repositories and then check for open pull requests in each.",
          actions: ['LIST_GITHUB_REPOSITORIES', 'LIST_GITHUB_PULL_REQUESTS'],
        },
      },
    ],
  ] as ActionExample[][],
};

// Create Repository Action
export const createRepositoryAction: Action = {
  name: 'CREATE_GITHUB_REPOSITORY',
  similes: ['NEW_REPO', 'MAKE_REPOSITORY', 'CREATE_REPO'],
  description:
    'Creates a new GitHub repository with optional description and privacy settings. Can be chained with CREATE_GITHUB_ISSUE to add initial issues or LIST_GITHUB_REPOSITORIES to view all repositories', // Disabled by default - repository creation is an infrastructure change

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: any = {},
    callback?: HandlerCallback
  ) => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract repository name from message text or options
      const text = message.content.text || '';
      const nameMatch = text.match(
        /(?:create|make|new)\s+(?:repo(?:sitory)?\s+)?(?:called\s+)?["\']?([a-zA-Z0-9_-]+)["\']?/i
      );

      const name = options.name || nameMatch?.[1];

      if (!name) {
        throw new Error(
          'Repository name is required. Please specify the name of the repository to create'
        );
      }

      // Extract description if present
      const descMatch = text.match(/(?:description|desc|about):\s*["\']?([^"'\n]+)["\']?/i);
      const description = options.description || descMatch?.[1];

      // Check for private/public keywords
      const isPrivate =
        options.private !== undefined
          ? options.private
          : text.includes('private')
            ? true
            : text.includes('public')
              ? false
              : false;

      const repositoryOptions: CreateRepositoryOptions = {
        name,
        description,
        private: isPrivate,
        auto_init: options.auto_init !== undefined ? options.auto_init : true,
        gitignore_template: options.gitignore_template,
        license_template: options.license_template,
        ...options,
      };

      logger.info(`Creating repository: ${name}`);
      const repository = await githubService.createRepository(repositoryOptions);

      const responseContent: Content = {
        text: `Successfully created repository: ${repository.full_name}
Description: ${repository.description || 'No description'}
Private: ${repository.private ? 'Yes' : 'No'}
URL: ${repository.html_url}
Clone URL: ${repository.clone_url}`,
        actions: ['CREATE_GITHUB_REPOSITORY'],
        source: message.content.source,
        // Include data for callbacks
        repository,
        repositoryUrl: repository.html_url,
        cloneUrl: repository.clone_url,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return ActionResult for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          success: true,
          repository,
          repositoryUrl: repository.html_url,
          cloneUrl: repository.clone_url,
          repositoryName: repository.full_name,
        },
        data: {
          actionName: 'CREATE_GITHUB_REPOSITORY',
          repository,
          github: {
            ...state?.github,
            lastRepository: repository,
            lastCreatedRepository: repository,
            repositories: {
              ...state?.github?.repositories,
              [repository.full_name]: repository,
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in CREATE_GITHUB_REPOSITORY action:', error);
      const errorContent: Content = {
        text: `Failed to create repository: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['CREATE_GITHUB_REPOSITORY'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: true,
        text: errorContent.text,
        values: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        data: {
          actionName: 'CREATE_GITHUB_REPOSITORY',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Create a new repository called my-awesome-project with description: "A really cool project" and make it public',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Successfully created repository: user/my-awesome-project\nDescription: A really cool project\nPrivate: No\nURL: https://github.com/user/my-awesome-project\nClone URL: https://github.com/user/my-awesome-project.git',
          actions: ['CREATE_GITHUB_REPOSITORY'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Create a private repository called "secret-project" and then create an initial issue for setting up the README',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll create a private repository called 'secret-project' and then set up an initial issue for the README.",
          actions: ['CREATE_GITHUB_REPOSITORY', 'CREATE_GITHUB_ISSUE'],
        },
      },
    ],
  ] as ActionExample[][],
};

// Search Repositories Action
export const searchRepositoriesAction: Action = {
  name: 'SEARCH_GITHUB_REPOSITORIES',
  similes: ['FIND_REPOS', 'SEARCH_REPOS', 'REPO_SEARCH'],
  description:
    'Searches for GitHub repositories based on query with sorting and filtering options. Can be chained with GET_GITHUB_REPOSITORY to inspect specific results or GET_GITHUB_ACTIVITY to check repository activity',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    options: {
      query?: string;
      sort?: 'stars' | 'forks' | 'help-wanted-issues' | 'updated';
      limit?: number;
    } = {},
    callback?: HandlerCallback
  ) => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract search query from message text or options
      const text = message.content.text || '';
      const queryMatch = text.match(
        /(?:search|find|look for)\s+(?:repos?(?:itories?)?\s+)?(?:for\s+)?["\']?([^"'\n]+?)["\']?(?:\s|$)/i
      );

      const query = options.query || queryMatch?.[1];

      if (!query) {
        throw new Error('Search query is required. Please specify what repositories to search for');
      }

      logger.info(`Searching repositories for: ${query}`);
      const searchResult = await githubService.searchRepositories(query, {
        sort: options.sort || 'stars',
        per_page: options.limit || 10,
      });

      const repoList = searchResult.items
        .map(
          (repo: any) =>
            `• ${repo.full_name} (${repo.language || 'Unknown'}) - ⭐ ${repo.stargazers_count}\n  ${repo.description || 'No description'}`
        )
        .join('\n');

      const responseContent: Content = {
        text: `Found ${searchResult.total_count} repositories for "${query}" (showing ${searchResult.items.length}):\n${repoList}`,
        actions: ['SEARCH_GITHUB_REPOSITORIES'],
        source: message.content.source,
        // Include data for callbacks
        repositories: searchResult.items,
        query,
        totalCount: searchResult.total_count,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return ActionResult for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          success: true,
          repositories: searchResult.items,
          query,
          totalCount: searchResult.total_count,
          repositoryNames: searchResult.items.map((repo: any) => repo.full_name),
        },
        data: {
          actionName: 'SEARCH_GITHUB_REPOSITORIES',
          repositories: searchResult.items,
          github: {
            ...state?.github,
            lastSearchResults: searchResult,
            lastSearchQuery: query,
            repositories: {
              ...state?.github?.repositories,
              ...searchResult.items.reduce(
                (acc: any, repo: any) => {
                  acc[repo.full_name] = repo;
                  return acc;
                },
                {} as Record<string, any>
              ),
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in SEARCH_GITHUB_REPOSITORIES action:', error);
      const errorContent: Content = {
        text: `Failed to search repositories: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['SEARCH_GITHUB_REPOSITORIES'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: true,
        text: errorContent.text,
        values: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        data: {
          actionName: 'SEARCH_GITHUB_REPOSITORIES',
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Search for repositories about machine learning',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Found 50000 repositories for "machine learning" (showing 10):\n• tensorflow/tensorflow (C++) - ⭐ 185000\n  An Open Source Machine Learning Framework for Everyone\n• scikit-learn/scikit-learn (Python) - ⭐ 59000\n  Machine learning library for Python',
          actions: ['SEARCH_GITHUB_REPOSITORIES'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Find repositories about React hooks and check the most popular one for recent activity',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll search for React hooks repositories and then check the most popular one for recent activity.",
          actions: ['SEARCH_GITHUB_REPOSITORIES', 'GET_GITHUB_ACTIVITY'],
        },
      },
    ],
  ] as ActionExample[][],
};
