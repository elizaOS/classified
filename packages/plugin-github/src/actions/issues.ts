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
import { GitHubService, type CreateIssueOptions } from '../index';

// Get Issue Action
export const getIssueAction: Action = {
  name: 'GET_GITHUB_ISSUE',
  similes: ['CHECK_ISSUE', 'FETCH_ISSUE', 'ISSUE_INFO', 'INSPECT_ISSUE'],
  description:
    'Retrieves information about a specific GitHub issue and enables chaining with actions like listing pull requests, creating related issues, or analyzing issue patterns',

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
    options: { owner?: string; repo?: string; issue_number?: number } = {},
    callback?: HandlerCallback
  ): Promise<any> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract owner, repo, and issue number from message text or options
      const text = message.content.text || '';
      const issueMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)\/issues\/(\d+)/);
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);
      const issueNumMatch = text.match(/(?:issue\s*#?|#)(\d+)/i);

      const owner =
        options.owner ||
        issueMatch?.[1] ||
        ownerRepoMatch?.[1] ||
        state?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo =
        options.repo ||
        issueMatch?.[2] ||
        ownerRepoMatch?.[2] ||
        state?.github?.lastRepository?.name;
      const issue_number =
        options.issue_number || parseInt(issueMatch?.[3] || issueNumMatch?.[1] || '0', 10);

      if (!owner || !repo || !issue_number) {
        throw new Error(
          'Repository owner, name, and issue number are required. Please specify as "owner/repo#123" or provide them in options'
        );
      }

      logger.info(`Getting issue information for ${owner}/${repo}#${issue_number}`);
      const issue = await githubService.getIssue(owner, repo, issue_number);

      const labels =
        issue.labels
          ?.map((label: any) => (typeof label === 'string' ? label : label.name || ''))
          .join(', ') || '';
      const assignees =
        issue.assignees?.map((assignee: any) => `@${assignee.login}`).join(', ') || '';

      const responseContent: Content = {
        text: `Issue #${issue.number}: ${issue.title}
Repository: ${owner}/${repo}
State: ${issue.state}
Author: @${issue.user?.login || 'unknown'}
Created: ${new Date(issue.created_at).toLocaleDateString()}
Updated: ${new Date(issue.updated_at).toLocaleDateString()}
Comments: ${issue.comments}
Labels: ${labels || 'None'}
Assignees: ${assignees || 'None'}
${issue.milestone ? `Milestone: ${issue.milestone.title}` : ''}

Description:
${issue.body || 'No description provided'}

URL: ${issue.html_url}`,
        actions: ['GET_GITHUB_ISSUE'],
        source: message.content.source,
      };

      if (callback) {
        await callback(responseContent);
      }

      return {
        success: true,
        text: responseContent.text,
        values: {
          success: true,
          issue,
          repository: `${owner}/${repo}`,
          issueNumber: issue_number,
          issueUrl: issue.html_url,
          issueState: issue.state,
        },
        data: {
          actionName: 'GET_GITHUB_ISSUE',
          issue,
          github: {
            ...state?.github,
            lastIssue: issue,
            issues: {
              ...state?.github?.issues,
              [`${owner}/${repo}#${issue_number}`]: issue,
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in GET_GITHUB_ISSUE action:', error);
      const errorContent: Content = {
        text: `Failed to get issue information: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_ISSUE'],
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
          actionName: 'GET_GITHUB_ISSUE',
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
          text: 'Get information about issue #42 in elizaOS/eliza',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Issue #42: Bug in authentication flow\nRepository: elizaOS/eliza\nState: open\nAuthor: @contributor\nCreated: 3/15/2024\nUpdated: 3/20/2024\nComments: 5\nLabels: bug, authentication\nAssignees: @maintainer\n\nDescription:\nThe authentication flow is failing when using GitHub tokens...\n\nURL: https://github.com/elizaOS/eliza/issues/42',
          actions: ['GET_GITHUB_ISSUE'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Check issue #123 in facebook/react and see if there are any related pull requests',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll check the details of issue #123 in facebook/react and then search for related pull requests.",
          actions: ['GET_GITHUB_ISSUE', 'SEARCH_GITHUB_PULL_REQUESTS'],
        },
      },
    ],
  ] as ActionExample[][],
};

// List Issues Action
export const listIssuesAction: Action = {
  name: 'LIST_GITHUB_ISSUES',
  similes: ['LIST_ISSUES', 'SHOW_ISSUES', 'GET_ISSUES'],
  description:
    'Lists GitHub issues for a repository with filtering options, enabling workflows like issue triage, bulk operations, or pattern analysis across issues',

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
      owner?: string;
      repo?: string;
      state?: 'open' | 'closed' | 'all';
      labels?: string;
      limit?: number;
    } = {},
    callback?: HandlerCallback
  ): Promise<any> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract owner and repo from message text or options
      const text = message.content.text || '';
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);

      const owner =
        options.owner ||
        ownerRepoMatch?.[1] ||
        state?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo = options.repo || ownerRepoMatch?.[2] || state?.github?.lastRepository?.name;

      if (!owner || !repo) {
        throw new Error(
          'Repository owner and name are required. Please specify as "owner/repo" or provide them in options'
        );
      }

      // Extract state filter from text
      const issueState =
        options.state ||
        (text.includes('closed') ? 'closed' : text.includes('all') ? 'all' : 'open');

      logger.info(`Listing ${issueState} issues for ${owner}/${repo}`);
      const issues = await githubService.listIssues(owner, repo, {
        state: issueState,
        labels: options.labels,
        per_page: options.limit || 10,
      });

      const issueList = issues
        .map((issue: any) => {
          const labels =
            issue.labels
              ?.map((label: any) => (typeof label === 'string' ? label : label.name || ''))
              .join(', ') || '';
          return `• #${issue.number}: ${issue.title} (${issue.state})${labels ? ` [${labels}]` : ''}`;
        })
        .join('\n');

      const responseContent: Content = {
        text: `${issueState.charAt(0).toUpperCase() + issueState.slice(1)} issues for ${owner}/${repo} (${issues.length} shown):\n${issueList}`,
        actions: ['LIST_GITHUB_ISSUES'],
        source: message.content.source,
        // Include data for callbacks
        issues,
        repository: `${owner}/${repo}`,
        issueCount: issues.length,
      };

      if (callback) {
        await callback(responseContent);
      }

      return {
        success: true,
        text: responseContent.text,
        values: {
          issues,
          repository: `${owner}/${repo}`,
          issueCount: issues.length,
        },
        data: {
          issues,
          github: {
            ...state?.data?.github, // Preserve previous github state from data
            ...state?.github, // Also check root-level github state
            lastIssues: issues,
            lastRepository: state?.data?.github?.lastRepository || state?.github?.lastRepository, // Preserve lastRepository
            issues: {
              ...state?.data?.github?.issues,
              ...state?.github?.issues,
              ...issues.reduce(
                (acc: any, issue: any) => {
                  acc[`${owner}/${repo}#${issue.number}`] = issue;
                  return acc;
                },
                {} as Record<string, any>
              ),
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in LIST_GITHUB_ISSUES action:', error);
      const errorContent: Content = {
        text: `Failed to list issues: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['LIST_GITHUB_ISSUES'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return errorContent;
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'List open issues for elizaOS/eliza',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Open issues for elizaOS/eliza (5 shown):\n• #42: Bug in authentication flow (open) [bug, authentication]\n• #41: Feature request: Add new provider (open) [enhancement]\n• #40: Documentation update needed (open) [documentation]',
          actions: ['LIST_GITHUB_ISSUES'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Show me high priority bugs in microsoft/vscode and check their activity',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Searching for high priority bugs in microsoft/vscode...\n\nOpen issues for microsoft/vscode (8 shown):\n• #1234: Critical: Editor crashes on large files (open) [bug, high-priority, crash]\n• #1230: Memory leak in extension host (open) [bug, high-priority, performance]\n• #1225: Terminal not responding after update (open) [bug, high-priority, terminal]\n• #1220: Debugger fails to attach (open) [bug, high-priority, debug]\n\nLet me check the recent activity on these critical issues...',
          actions: ['LIST_GITHUB_ISSUES', 'GET_GITHUB_ACTIVITY'],
        },
      },
    ],
  ],
};

// Create Issue Action
export const createIssueAction: Action = {
  name: 'CREATE_GITHUB_ISSUE',
  similes: ['NEW_ISSUE', 'SUBMIT_ISSUE', 'REPORT_ISSUE', 'FILE_ISSUE'],
  description:
    'Creates a new GitHub issue and enables chaining with actions like creating branches, assigning users, or linking to pull requests', // Disabled by default - issue creation modifies repository state

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
  ): Promise<any> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract owner and repo from message text or options
      const text = message.content.text || '';
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);

      const owner =
        options.owner ||
        ownerRepoMatch?.[1] ||
        state?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo = options.repo || ownerRepoMatch?.[2] || state?.github?.lastRepository?.name;

      if (!owner || !repo) {
        throw new Error(
          'Repository owner and name are required. Please specify as "owner/repo" or provide them in options'
        );
      }

      // Extract title from message text or options
      const titleMatch =
        text.match(/(?:title|issue)\s*[:=]\s*["\']?([^"'\n]+)["\']?/i) ||
        text.match(/(?:create|submit|file)\s+(?:issue|bug)?\s*["\']?([^"'\n]+)["\']?/i);

      const title = options.title || titleMatch?.[1];

      if (!title) {
        throw new Error('Issue title is required. Please specify the title for the issue');
      }

      // Extract body/description from message text or options
      const bodyMatch = text.match(
        /(?:description|body|details?)\s*[:=]\s*["\']?([^"'\n]+)["\']?/i
      );
      const body = options.body || bodyMatch?.[1];

      // Extract labels from message text or options
      const labelsMatch = text.match(/(?:labels?)\s*[:=]\s*["\']?([^"'\n]+)["\']?/i);
      const labelsText = labelsMatch?.[1];
      const labels =
        options.labels || (labelsText ? labelsText.split(/[,\s]+/).filter(Boolean) : undefined);

      const issueOptions: CreateIssueOptions = {
        title,
        body,
        labels,
        assignees: options.assignees,
        milestone: options.milestone,
      };

      logger.info(`Creating issue in ${owner}/${repo}: ${title}`);
      const issue = await githubService.createIssue(owner, repo, issueOptions);

      const responseContent: Content = {
        text: `Successfully created issue #${issue.number}: ${issue.title}
Repository: ${owner}/${repo}
State: ${issue.state}
Author: @${issue.user?.login || 'unknown'}
Created: ${new Date(issue.created_at).toLocaleDateString()}
Labels: ${
          issue.labels
            ?.map((label: any) => (typeof label === 'string' ? label : label.name || ''))
            .join(', ') || 'None'
        }

${issue.body || 'No description provided'}

URL: ${issue.html_url}`,
        actions: ['CREATE_GITHUB_ISSUE'],
        source: message.content.source,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return result for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          issue,
          repository: `${owner}/${repo}`,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
        },
        data: {
          issue,
          github: {
            ...state?.github,
            lastIssue: issue,
            lastCreatedIssue: issue,
            issues: {
              ...state?.github?.issues,
              [`${owner}/${repo}#${issue.number}`]: issue,
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in CREATE_GITHUB_ISSUE action:', error);
      const errorContent: Content = {
        text: `Failed to create issue: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['CREATE_GITHUB_ISSUE'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return errorContent;
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Create an issue in elizaOS/eliza with title: "Authentication bug" and description: "The GitHub auth is not working properly" and add labels: bug, authentication',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Successfully created issue #43: Authentication bug\nRepository: elizaOS/eliza\nState: open\nAuthor: @agent\nCreated: 3/21/2024\nLabels: bug, authentication\n\nThe GitHub auth is not working properly\n\nURL: https://github.com/elizaOS/eliza/issues/43',
          actions: ['CREATE_GITHUB_ISSUE'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Create a feature request issue in my new-project repo and then create a branch for it',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: "First, I'll create the feature request issue...\n\nSuccessfully created issue #1: Add user authentication\nRepository: user/new-project\nState: open\nAuthor: @agent\nCreated: 3/21/2024\nLabels: enhancement\n\nImplement user authentication system with JWT tokens\n\nURL: https://github.com/user/new-project/issues/1\n\nNow I'll create a feature branch for this issue...",
          actions: ['CREATE_GITHUB_ISSUE', 'CREATE_GITHUB_BRANCH'],
        },
      },
    ],
  ],
};

// Search Issues Action
export const searchIssuesAction: Action = {
  name: 'SEARCH_GITHUB_ISSUES',
  similes: ['FIND_ISSUES', 'SEARCH_BUGS', 'ISSUE_SEARCH'],
  description:
    'Searches for GitHub issues across repositories using advanced queries, enabling cross-project analysis, pattern detection, and bulk issue management workflows',

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
      sort?: 'comments' | 'reactions' | 'created' | 'updated';
      limit?: number;
    } = {},
    callback?: HandlerCallback
  ): Promise<any> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract search query from message text or options
      const text = message.content.text || '';
      const queryMatch = text.match(
        /(?:search|find|look for)\s+(?:issues?\s+)?(?:for\s+)?["\']?([^"'\n]+?)["\']?(?:\s|$)/i
      );

      const query = options.query || queryMatch?.[1];

      if (!query) {
        throw new Error('Search query is required. Please specify what issues to search for');
      }

      logger.info(`Searching issues for: ${query}`);
      const searchResult = await githubService.searchIssues(query, {
        sort: options.sort || 'updated',
        per_page: options.limit || 10,
      });

      const issueList = (searchResult.items || [])
        .map((issue: any) => {
          const labels =
            issue.labels
              ?.map((label: any) => (typeof label === 'string' ? label : label.name || ''))
              .join(', ') || '';
          const repoName = issue.html_url
            ? issue.html_url.match(/github\.com\/([^\/]+\/[^\/]+)/)?.[1] || 'unknown'
            : 'unknown';
          return `• ${repoName}#${issue.number}: ${issue.title} (${issue.state})${labels ? ` [${labels}]` : ''}`;
        })
        .join('\n');

      const responseContent: Content = {
        text: `Found ${searchResult.total_count || 0} issues for "${query}" (showing ${searchResult.items?.length || 0}):\n${issueList}`,
        actions: ['SEARCH_GITHUB_ISSUES'],
        source: message.content.source,
        // Include data for callbacks
        issues: searchResult.items || [],
        totalCount: searchResult.total_count || 0,
        query,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return result for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          issues: searchResult.items,
          totalCount: searchResult.total_count,
          query,
        },
        data: {
          issues: searchResult.items,
          github: {
            ...state?.data?.github, // Preserve previous github state from data
            ...state?.github, // Also check root-level github state
            lastIssueSearchResults: searchResult,
            lastIssueSearchQuery: query,
            lastRateLimit: state?.data?.github?.lastRateLimit || state?.github?.lastRateLimit, // Preserve lastRateLimit
            issues: {
              ...state?.data?.github?.issues,
              ...state?.github?.issues,
              ...(searchResult.items || []).reduce(
                (acc: any, issue: any) => {
                  const repoName = issue.html_url
                    ? issue.html_url.match(/github\.com\/([^\/]+\/[^\/]+)/)?.[1]
                    : null;
                  if (repoName) {
                    acc[`${repoName}#${issue.number}`] = issue;
                  }
                  return acc;
                },
                {} as Record<string, any>
              ),
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in SEARCH_GITHUB_ISSUES action:', error);
      const errorContent: Content = {
        text: `Failed to search issues: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['SEARCH_GITHUB_ISSUES'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return errorContent;
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Search for issues about authentication bugs',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Found 150 issues for "authentication bugs" (showing 10):\n• elizaOS/eliza#42: Authentication flow failing (open) [bug, authentication]\n• user/project#15: Auth token validation issue (closed) [bug]\n• company/app#88: Login authentication error (open) [bug, security]',
          actions: ['SEARCH_GITHUB_ISSUES'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Find all TypeScript migration issues across popular repos and analyze the patterns',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Found 3,250 issues for "TypeScript migration" (showing 10):\n• facebook/jest#11234: Migrate codebase to TypeScript (open) [enhancement, typescript, breaking-change]\n• expressjs/express#4567: TypeScript support roadmap (open) [enhancement, typescript, discussion]\n• webpack/webpack#8901: Convert core modules to TypeScript (in progress) [enhancement, typescript]\n• redux-saga/redux-saga#2345: TypeScript migration tracking (open) [enhancement, typescript, meta]\n\nI notice most migrations follow a phased approach. Let me check the activity on these migration efforts...',
          actions: ['SEARCH_GITHUB_ISSUES', 'GET_GITHUB_ACTIVITY'],
        },
      },
    ],
  ],
};
