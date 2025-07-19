import {
  type Action,
  type ActionResult,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';
import { GitHubService } from '../services/github';
import { CreatePullRequestOptions } from '../types';

// Get Pull Request Action
export const getPullRequestAction: Action = {
  name: 'GET_GITHUB_PULL_REQUEST',
  similes: ['CHECK_PR', 'FETCH_PULL_REQUEST', 'PR_INFO', 'INSPECT_PR'],
  description: 'Retrieves information about a specific GitHub pull request',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State | undefined, options?: any, callback?: HandlerCallback): Promise<ActionResult> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract owner, repo, and PR number from message text or options
      const text = message.content.text || '';
      const prMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)\/pull\/(\d+)/);
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);
      const prNumMatch = text.match(/(?:pr\s*#?|pull\s*request\s*#?|#)(\d+)/i);

      const owner =
        options.owner ||
        prMatch?.[1] ||
        ownerRepoMatch?.[1] ||
        state?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo =
        options.repo || prMatch?.[2] || ownerRepoMatch?.[2] || state?.github?.lastRepository?.name;
      const pull_number =
        options.pull_number || parseInt(prMatch?.[3] || prNumMatch?.[1] || '0', 10);

      if (!owner || !repo || !pull_number) {
        throw new Error(
          'Repository owner, name, and PR number are required. Please specify as "owner/repo#123" or provide them in options'
        );
      }

      logger.info(`Getting pull request information for ${owner}/${repo}#${pull_number}`);
      const pr = await githubService.getPullRequest(owner, repo, pull_number);

      const labels =
        pr.labels
          ?.map((label: any) => (typeof label === 'string' ? label : label.name || ''))
          .join(', ') || '';
      const assignees = pr.assignees?.map((assignee: any) => `@${assignee.login}`).join(', ') || '';

      const responseContent: Content = {
        text: `Pull Request #${pr.number}: ${pr.title}
Repository: ${owner}/${repo}
State: ${pr.state}${pr.merged ? ' (merged)' : ''}
Draft: ${pr.draft ? 'Yes' : 'No'}
Author: @${pr.user.login}
Created: ${new Date(pr.created_at).toLocaleDateString()}
Updated: ${new Date(pr.updated_at).toLocaleDateString()}
${pr.merged_at ? `Merged: ${new Date(pr.merged_at).toLocaleDateString()}` : ''}
Comments: ${pr.comments}
Commits: ${pr.commits}
Files Changed: ${pr.changed_files}
Additions: +${pr.additions}
Deletions: -${pr.deletions}
Labels: ${labels || 'None'}
Assignees: ${assignees || 'None'}
Head: ${pr.head.ref} (${pr.head.sha.substring(0, 7)})
Base: ${pr.base.ref} (${pr.base.sha.substring(0, 7)})
Mergeable: ${pr.mergeable === null ? 'Unknown' : pr.mergeable ? 'Yes' : 'No'}

Description:
${pr.body || 'No description provided'}

URL: ${pr.html_url}`,
        actions: ['GET_GITHUB_PULL_REQUEST'],
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
          pullRequest: pr,
          repository: `${owner}/${repo}`,
          pullNumber: pull_number,
        },
        data: {
          pullRequest: pr,
          github: {
            ...state?.github,
            lastPullRequest: pr,
            pullRequests: {
              ...state?.github?.pullRequests,
              [`${owner}/${repo}#${pull_number}`]: pr,
            }
  },
        },
            };
    } catch (error) {
      logger.error('Error in GET_GITHUB_PULL_REQUEST action:', error);
      const errorContent: Content = {
        text: `Failed to get pull request information: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_PULL_REQUEST'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: false,
        text: errorContent.text,
        values: {},
        data: {}
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Get information about PR #25 in elizaOS/eliza',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Pull Request #25: Add new authentication provider\nRepository: elizaOS/eliza\nState: open\nDraft: No\nAuthor: @contributor\nCreated: 3/15/2024\nUpdated: 3/20/2024\nComments: 3\nCommits: 5\nFiles Changed: 8\nAdditions: +120\nDeletions: -15\nLabels: enhancement, authentication\nAssignees: @maintainer\nHead: feature/auth-provider (abc1234)\nBase: main (def5678)\nMergeable: Yes\n\nDescription:\nThis PR adds a new authentication provider for GitHub integration...\n\nURL: https://github.com/elizaOS/eliza/pull/25',
          actions: ['GET_GITHUB_PULL_REQUEST'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Check PR #456 in vercel/next.js and see what issues it addresses',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Pull Request #456: Fix hydration mismatch in dynamic routes\nRepository: vercel/next.js\nState: open\nDraft: No\nAuthor: @contributor\nCreated: 3/18/2024\nUpdated: 3/21/2024\nComments: 8\nCommits: 3\nFiles Changed: 12\nAdditions: +85\nDeletions: -42\nLabels: bug, hydration\nAssignees: @next-team\nHead: fix/hydration-mismatch (xyz789)\nBase: canary (abc123)\nMergeable: Yes\n\nDescription:\nFixes #445, #389 - Resolves hydration mismatches when using dynamic routes with SSR...\n\nURL: https://github.com/vercel/next.js/pull/456\n\nLet me check the referenced issues to understand what problems this PR solves...',
          actions: ['GET_GITHUB_PULL_REQUEST', 'GET_GITHUB_ISSUE'],
        }
  },
    ],
  ],
};

// List Pull Requests Action
export const listPullRequestsAction: Action = {
  name: 'LIST_GITHUB_PULL_REQUESTS',
  similes: ['LIST_PRS', 'SHOW_PULL_REQUESTS', 'GET_PRS'],
  description: 'Lists GitHub pull requests for a repository',

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State | undefined, options?: any, callback?: HandlerCallback): Promise<ActionResult> => {
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
      const prState =
        options.state ||
        (text.includes('closed') ? 'closed' : text.includes('all') ? 'all' : 'open');

      logger.info(`Listing ${prState} pull requests for ${owner}/${repo}`);
      const prs = await githubService.listPullRequests(owner, repo, {
        state: prState,
        head: options.head,
        base: options.base,
        per_page: options.limit || 10,
      });

      const prList = prs
        .map((pr: any) => {
          const labels = pr.labels ? pr.labels.map((label: any) => label.name).join(', ') : '';
          const status = pr.merged ? 'merged' : pr.state;
          const draft = pr.draft ? ' (draft)' : '';
          return `• #${pr.number}: ${pr.title} (${status}${draft})${labels ? ` [${labels}]` : ''}`;
        })
        .join('\n');

      const responseContent: Content = {
        text: `${prState.charAt(0).toUpperCase() + prState.slice(1)} pull requests for ${owner}/${repo} (${prs.length} shown):\n${prList}`,
        actions: ['LIST_GITHUB_PULL_REQUESTS'],
        source: message.content.source,
        // Include data for callbacks
        pullRequests: prs,
        repository: `${owner}/${repo}`,
        pullRequestCount: prs.length,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return result for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          pullRequests: prs,
          repository: `${owner}/${repo}`,
          pullRequestCount: prs.length,
        },
        data: {
          pullRequests: prs,
          github: {
            ...state?.github,
            lastPullRequests: prs,
            pullRequests: {
              ...state?.github?.pullRequests,
              ...prs.reduce(
                (acc: any, pr: any) => {
                  acc[`${owner}/${repo}#${pr.number}`] = pr;
                  return acc;
                },
                {} as Record<string, any>
              ),
            }
  },
        },
            };
    } catch (error) {
      logger.error('Error in LIST_GITHUB_PULL_REQUESTS action:', error);
      const errorContent: Content = {
        text: `Failed to list pull requests: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['LIST_GITHUB_PULL_REQUESTS'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: false,
        text: errorContent.text,
        values: {},
        data: {}
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'List open pull requests for elizaOS/eliza',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Open pull requests for elizaOS/eliza (3 shown):\n• #25: Add new authentication provider (open) [enhancement, authentication]\n• #24: Fix memory leak in service (open) [bug]\n• #23: Update documentation (open) (draft) [documentation]',
          actions: ['LIST_GITHUB_PULL_REQUESTS'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Show me PRs ready for review in rust-lang/rust and check their CI status',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Open pull requests for rust-lang/rust (10 shown):\n• #98765: Optimize compiler performance for large crates (open) [performance, ready-for-review]\n• #98760: Add new lint for unsafe code patterns (open) [lint, ready-for-review]\n• #98755: Fix ICE in type inference (open) [bug, ready-for-review]\n• #98750: Implement RFC 3324 (open) [rfc, ready-for-review]\n• #98745: Update LLVM to version 16 (open) [dependencies, ready-for-review]\n\nNow let me check the CI status for these pull requests...',
          actions: ['LIST_GITHUB_PULL_REQUESTS', 'GET_GITHUB_WORKFLOW_RUNS'],
        }
  },
    ],
  ],
};

// Create Pull Request Action
export const createPullRequestAction: Action = {
  name: 'CREATE_GITHUB_PULL_REQUEST',
  similes: ['NEW_PR', 'SUBMIT_PR', 'CREATE_PR', 'OPEN_PULL_REQUEST'],
  description: 'Creates a new GitHub pull request',
  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State | undefined, options?: any, callback?: HandlerCallback): Promise<ActionResult> => {
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
        text.match(/(?:title|pr)\s*[:=]\s*["\']?([^"'\n]+)["\']?/i) ||
        text.match(/(?:create|submit|open)\s+(?:pr|pull\s*request)?\s*["\']?([^"'\n]+)["\']?/i);

      const title = options.title || titleMatch?.[1];

      if (!title) {
        throw new Error('Pull request title is required. Please specify the title for the PR');
      }

      // Extract head and base branches from message text or options
      const branchMatch = text.match(
        /(?:from|head)\s*[:=]?\s*([^\s]+)(?:\s+(?:to|into|base)\s*[:=]?\s*([^\s]+))?/i
      );
      const head = options.head || branchMatch?.[1];
      const base = options.base || branchMatch?.[2] || 'main';

      if (!head) {
        throw new Error('Head branch is required. Please specify the branch to merge from');
      }

      // Extract body/description from message text or options
      const bodyMatch = text.match(
        /(?:description|body|details?)\s*[:=]\s*["\']?([^"'\n]+)["\']?/i
      );
      const body = options.body || bodyMatch?.[1];

      // Check for draft keyword
      const draft = options.draft !== undefined ? options.draft : text.includes('draft');

      const prOptions: CreatePullRequestOptions = {
        title,
        head,
        base,
        body,
        draft,
        maintainer_can_modify: options.maintainer_can_modify,
      };

      logger.info(`Creating pull request in ${owner}/${repo}: ${title}`);
      const pr = await githubService.createPullRequest(owner, repo, prOptions);

      const responseContent: Content = {
        text: `Successfully created pull request #${pr.number}: ${pr.title}
Repository: ${owner}/${repo}
State: ${pr.state}
Draft: ${pr.draft ? 'Yes' : 'No'}
Author: @${pr.user.login}
Created: ${new Date(pr.created_at).toLocaleDateString()}
Head: ${pr.head.ref}
Base: ${pr.base.ref}

${pr.body || 'No description provided'}

URL: ${pr.html_url}`,
        actions: ['CREATE_GITHUB_PULL_REQUEST'],
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
          pullRequest: pr,
          repository: `${owner}/${repo}`,
          pullNumber: pr.number,
          pullRequestUrl: pr.html_url,
        },
        data: {
          pullRequest: pr,
          github: {
            ...state?.github,
            lastPullRequest: pr,
            lastCreatedPullRequest: pr,
            pullRequests: {
              ...state?.github?.pullRequests,
              [`${owner}/${repo}#${pr.number}`]: pr,
            }
  },
        },
            };
    } catch (error) {
      logger.error('Error in CREATE_GITHUB_PULL_REQUEST action:', error);
      const errorContent: Content = {
        text: `Failed to create pull request: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['CREATE_GITHUB_PULL_REQUEST'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: false,
        text: errorContent.text,
        values: {},
        data: {}
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Create a pull request in elizaOS/eliza with title: "Add GitHub integration" from feature/github-integration to main with description: "This PR adds comprehensive GitHub integration capabilities"',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Successfully created pull request #26: Add GitHub integration\nRepository: elizaOS/eliza\nState: open\nDraft: No\nAuthor: @agent\nCreated: 3/21/2024\nHead: feature/github-integration\nBase: main\n\nThis PR adds comprehensive GitHub integration capabilities\n\nURL: https://github.com/elizaOS/eliza/pull/26',
          actions: ['CREATE_GITHUB_PULL_REQUEST'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Create a draft PR for my bugfix branch and link it to issue #789',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: "First, let me check issue #789 to understand the context...\n\nIssue #789: Database connection timeout\nRepository: user/api-server\nState: open\nLabels: bug, database, priority-high\n\nNow I'll create a draft pull request for your bugfix...\n\nSuccessfully created pull request #790: Fix database connection timeout\nRepository: user/api-server\nState: open\nDraft: Yes\nAuthor: @agent\nCreated: 3/21/2024\nHead: bugfix/db-timeout\nBase: main\n\nFixes #789 - Resolves database connection timeout issues by implementing connection pooling\n\nURL: https://github.com/user/api-server/pull/790",
          actions: ['GET_GITHUB_ISSUE', 'CREATE_GITHUB_PULL_REQUEST'],
        }
  },
    ],
  ],
};

// Merge Pull Request Action
export const mergePullRequestAction: Action = {
  name: 'MERGE_GITHUB_PULL_REQUEST',
  similes: ['MERGE_PR', 'ACCEPT_PR', 'APPROVE_PR'],
  description: 'Merges a GitHub pull request',
  validate: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<boolean> => {
    const githubService = runtime.getService<GitHubService>('github');
    return !!githubService;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State | undefined, options?: any, callback?: HandlerCallback): Promise<ActionResult> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      // Extract owner, repo, and PR number from message text or options
      const text = message.content.text || '';
      const prMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)\/pull\/(\d+)/);
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);
      const prNumMatch = text.match(/(?:pr\s*#?|pull\s*request\s*#?|#)(\d+)/i);

      const owner =
        options.owner ||
        prMatch?.[1] ||
        ownerRepoMatch?.[1] ||
        state?.github?.lastPullRequest?.base?.repo?.owner?.login ||
        state?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo =
        options.repo ||
        prMatch?.[2] ||
        ownerRepoMatch?.[2] ||
        state?.github?.lastPullRequest?.base?.repo?.name ||
        state?.github?.lastRepository?.name;
      const pull_number =
        options.pull_number ||
        parseInt(prMatch?.[3] || prNumMatch?.[1] || '0', 10) ||
        state?.github?.lastPullRequest?.number;

      if (!owner || !repo || !pull_number) {
        throw new Error(
          'Repository owner, name, and PR number are required. Please specify as "owner/repo#123" or provide them in options'
        );
      }

      // Extract merge method from text
      const mergeMethod =
        options.merge_method ||
        (text.includes('squash') ? 'squash' : text.includes('rebase') ? 'rebase' : 'merge');

      logger.info(`Merging pull request ${owner}/${repo}#${pull_number} using ${mergeMethod}`);
      const result = await githubService.mergePullRequest(owner, repo, pull_number, {
        commit_title: options.commit_title,
        commit_message: options.commit_message,
        merge_method: mergeMethod,
      });

      const responseContent: Content = {
        text: `Successfully merged pull request #${pull_number}
Repository: ${owner}/${repo}
Merge method: ${mergeMethod}
Commit SHA: ${result.sha}
Message: ${result.message}`,
        actions: ['MERGE_GITHUB_PULL_REQUEST'],
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
          merged: true,
          repository: `${owner}/${repo}`,
          pullNumber: pull_number,
          sha: result.sha,
        },
        data: {
          mergeResult: result,
          github: {
            ...state?.github,
            lastMergeResult: result,
            lastMergedPullRequest: pull_number,
          }
        }
      };
    } catch (error) {
      logger.error('Error in MERGE_GITHUB_PULL_REQUEST action:', error);
      const errorContent: Content = {
        text: `Failed to merge pull request: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['MERGE_GITHUB_PULL_REQUEST'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: false,
        text: errorContent.text,
        values: {},
        data: {}
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Merge PR #25 in elizaOS/eliza using squash method',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Successfully merged pull request #25\nRepository: elizaOS/eliza\nMerge method: squash\nCommit SHA: abc123def456\nMessage: Pull request successfully merged',
          actions: ['MERGE_GITHUB_PULL_REQUEST'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Review and merge the documentation PR if all checks pass',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: "Let me check the most recent documentation PR...\n\nPull Request #23: Update documentation (open)\nRepository: user/project\nMergeable: Yes\nAll checks passing: ✓\n\nThe PR looks good with all checks passing. I'll merge it now...\n\nSuccessfully merged pull request #23\nRepository: user/project\nMerge method: merge\nCommit SHA: def789abc123\nMessage: Merge pull request #23 from user/update-docs\n\nNow let me update the activity log...",
          actions: ['GET_GITHUB_PULL_REQUEST', 'MERGE_GITHUB_PULL_REQUEST', 'GET_GITHUB_ACTIVITY'],
        }
  },
    ],
  ],
};
