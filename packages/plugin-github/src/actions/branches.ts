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

// List Branches Action
export const listBranchesAction: Action = {
  name: 'LIST_GITHUB_BRANCHES',
  similes: ['LIST_BRANCHES', 'SHOW_BRANCHES', 'GET_BRANCHES', 'BRANCH_LIST'],
  description: 'Lists branches in a GitHub repository, sorted by last commit date',

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
        options?.owner ||
        ownerRepoMatch?.[1] ||
        state?.data?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo =
        options?.repo || ownerRepoMatch?.[2] || state?.data?.github?.lastRepository?.name;

      if (!owner || !repo) {
        throw new Error(
          'Repository owner and name are required. Please specify as "owner/repo" or provide them in options'
        );
      }

      logger.info(`Listing branches for ${owner}/${repo}`);

      // Get all branches
      const allBranches: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const branches = await githubService.listBranches(owner, repo);

        allBranches.push(...branches);

        if (branches.length < perPage) {
          break;
        }
        page++;
      }

      // Get detailed branch info with last commit date
      const branchesWithDetails = await Promise.all(
        allBranches.slice(0, options?.limit || 20).map(async (branch) => {
          try {
            const branchData = await githubService.getBranch(owner, repo, branch.name);

            return {
              name: branch.name,
              protected: branch.protected,
              commit: {
                sha: branchData.commit.sha,
                message: branchData.commit.commit.message.split('\n')[0],
                author: branchData.commit.commit.author?.name || 'Unknown',
                date: branchData.commit.commit.author?.date || new Date().toISOString(),
              },
                  };
    } catch (error) {
            // Fallback if detailed info fails
            return {
              name: branch.name,
              protected: branch.protected,
              commit: {
                sha: branch.commit.sha,
                message: 'Unable to fetch commit details',
                author: 'Unknown',
                date: new Date().toISOString(),
              },
            };
    }
        })
      );

      // Sort by commit date (most recent first)
      branchesWithDetails.sort(
        (a, b) => new Date(b.commit.date).getTime() - new Date(a.commit.date).getTime()
      );

      // Filter by protected status if requested
      const filteredBranches =
        options?.protected !== undefined
          ? branchesWithDetails.filter((b) => b.protected === options?.protected)
          : branchesWithDetails;

      const branchList = filteredBranches
        .map((branch) => {
          const date = new Date(branch.commit.date);
          const timeAgo = getTimeAgo(date);
          return `• ${branch.name}${branch.protected ? ' 🔒' : ''}
  Last commit: ${timeAgo} by ${branch.commit.author}
  "${branch.commit.message}"
  SHA: ${branch.commit.sha.substring(0, 7)}`;
        })
        .join('\n\n');

      const responseContent: Content = {
        text: `Branches for ${owner}/${repo} (${filteredBranches.length} shown, ${allBranches.length} total):\n\n${branchList}`,
        actions: ['LIST_GITHUB_BRANCHES'],
        source: message.content.source,
        // Include data for callbacks
        branches: filteredBranches,
        repository: `${owner}/${repo}`,
        totalBranches: allBranches.length,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return result for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          branches: filteredBranches,
          repository: `${owner}/${repo}`,
          branchCount: filteredBranches.length,
          totalBranches: allBranches.length,
        },
        data: {
          branches: filteredBranches,
          github: {
            ...state?.github,
            lastBranches: filteredBranches,
            branches: {
              ...state?.github?.branches,
              [`${owner}/${repo}`]: filteredBranches,
            }
  },
        },
            };
    } catch (error) {
      logger.error('Error in LIST_GITHUB_BRANCHES action:', error);
      const errorContent: Content = {
        text: `Failed to list branches: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['LIST_GITHUB_BRANCHES'],
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
          text: 'List branches for facebook/react',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Branches for facebook/react (20 shown, 145 total):\n\n• main 🔒\n  Last commit: 2 hours ago by React Bot\n  "Update experimental API docs"\n  SHA: abc1234\n\n• 18.x 🔒\n  Last commit: 3 days ago by Dan Abramov\n  "Backport fix for hydration warning"\n  SHA: def5678\n\n• experimental\n  Last commit: 5 days ago by Andrew Clark\n  "Experimental: Add new Suspense features"\n  SHA: ghi9012',
          actions: ['LIST_GITHUB_BRANCHES'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Show me the most recently updated branches in my project repo and check for stale branches',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Branches for user/project (15 shown, 23 total):\n\n• feature/new-api\n  Last commit: 1 hour ago by You\n  "Add REST API endpoints"\n  SHA: abc1234\n\n• main 🔒\n  Last commit: 2 days ago by GitHub Actions\n  "Merge pull request #45 from user/feature/auth"\n  SHA: def5678\n\n• feature/auth\n  Last commit: 3 days ago by You\n  "Implement JWT authentication"\n  SHA: ghi9012\n\n• bugfix/memory-leak\n  Last commit: 2 weeks ago by Contributor\n  "Fix memory leak in service worker"\n  SHA: jkl3456\n\n• feature/old-feature\n  Last commit: 3 months ago by Former Contributor\n  "WIP: Started new feature"\n  SHA: mno7890\n\nI notice you have some potentially stale branches:\n- feature/old-feature: Last updated 3 months ago\n- Several other branches not shown are over 6 months old\n\nWould you like me to help identify which branches can be safely deleted?',
          actions: ['LIST_GITHUB_BRANCHES'],
        }
  },
    ],
  ],
};

// Create Branch Action
export const createBranchAction: Action = {
  name: 'CREATE_GITHUB_BRANCH',
  similes: ['NEW_BRANCH', 'MAKE_BRANCH', 'BRANCH_FROM'],
  description: 'Creates a new branch in a GitHub repository',
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

      // Extract parameters from message text or options
      const text = message.content.text || '';
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);
      const branchMatch = text.match(/(?:branch|called|named)\s+["\']?([a-zA-Z0-9._\/-]+)["\']?/i);
      const fromMatch = text.match(/(?:from|based on|off)\s+["\']?([a-zA-Z0-9._\/-]+)["\']?/i);

      const owner =
        options?.owner ||
        ownerRepoMatch?.[1] ||
        state?.data?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo =
        options?.repo || ownerRepoMatch?.[2] || state?.data?.github?.lastRepository?.name;
      const branch = options.branch || branchMatch?.[1];
      const from = options.from || fromMatch?.[1] || 'main';

      if (!owner || !repo) {
        throw new Error(
          'Repository owner and name are required. Please specify as "owner/repo" or provide them in options'
        );
      }

      if (!branch) {
        throw new Error('Branch name is required. Please specify the name for the new branch');
      }

      logger.info(`Creating branch ${branch} from ${from} in ${owner}/${repo}`);

      // Get the SHA of the source branch
      const refData = await githubService.getRef(owner, repo, `heads/${from}`);

      // Create the new branch
      await githubService.createBranch(owner, repo, branch, refData.object.sha);

      const responseContent: Content = {
        text: `Successfully created branch "${branch}" from "${from}" in ${owner}/${repo}
Branch: ${branch}
Based on: ${from} (${refData.object.sha.substring(0, 7)})
Created at: ${new Date().toLocaleString()}`,
        actions: ['CREATE_GITHUB_BRANCH'],
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
          branch,
          from,
          repository: `${owner}/${repo}`,
          sha: refData.object.sha,
        },
        data: {
          newBranch: {
            name: branch,
            sha: refData.object.sha,
            from,
          },
          github: {
            ...state?.github,
            lastCreatedBranch: branch,
          }
        }
      };
    } catch (error) {
      logger.error('Error in CREATE_GITHUB_BRANCH action:', error);
      const errorContent: Content = {
        text: `Failed to create branch: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['CREATE_GITHUB_BRANCH'],
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
          text: 'Create a new branch called feature/payment-integration from main in my project repo',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Successfully created branch "feature/payment-integration" from "main" in user/project\nBranch: feature/payment-integration\nBased on: main (abc1234)\nCreated at: 3/21/2024, 2:30:45 PM',
          actions: ['CREATE_GITHUB_BRANCH'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Create a bugfix branch for issue #123 based on the release-v2 branch',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'I\'ll create a bugfix branch for issue #123. Let me first check the issue details...\n\nIssue #123: Fix user authentication timeout\nRepository: user/api-server\nState: open\nLabels: bug, priority-high\n\nNow creating the branch...\n\nSuccessfully created branch "bugfix/issue-123-auth-timeout" from "release-v2" in user/api-server\nBranch: bugfix/issue-123-auth-timeout\nBased on: release-v2 (def5678)\nCreated at: 3/21/2024, 2:35:15 PM\n\nThe branch is ready for your fix. Would you like me to create a pull request draft for this issue?',
          actions: ['GET_GITHUB_ISSUE', 'CREATE_GITHUB_BRANCH'],
        }
  },
    ],
  ],
};

// Get Branch Protection Action
export const getBranchProtectionAction: Action = {
  name: 'GET_BRANCH_PROTECTION',
  similes: ['CHECK_PROTECTION', 'BRANCH_RULES', 'PROTECTION_STATUS'],
  description: 'Gets branch protection rules for a GitHub repository branch',

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

      // Extract parameters from message text or options
      const text = message.content.text || '';
      const ownerRepoMatch = text.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/);
      const branchMatch = text.match(/(?:branch\s+)?["\']?([a-zA-Z0-9._\/-]+)["\']?/i);

      const owner =
        options?.owner ||
        ownerRepoMatch?.[1] ||
        state?.data?.github?.lastRepository?.owner?.login ||
        runtime.getSetting('GITHUB_OWNER');
      const repo =
        options?.repo || ownerRepoMatch?.[2] || state?.data?.github?.lastRepository?.name;
      const branch =
        options.branch || branchMatch?.[1] || state?.github?.lastCreatedBranch || 'main';

      if (!owner || !repo) {
        throw new Error(
          'Repository owner and name are required. Please specify as "owner/repo" or provide them in options'
        );
      }

      logger.info(`Getting branch protection for ${branch} in ${owner}/${repo}`);

      try {
        const protection = await githubService.getBranchProtection(owner, repo, branch);

        const requiredChecks = protection.required_status_checks?.contexts || [];
        const requiredReviews = protection.required_pull_request_reviews;
        const restrictions = protection.restrictions;

        const responseContent: Content = {
          text: `Branch Protection for "${branch}" in ${owner}/${repo}:

**Status Checks:**
${protection.required_status_checks ? `✅ Required checks: ${requiredChecks.join(', ') || 'None specified'}` : '❌ No required status checks'}

**Pull Request Reviews:**
${
  requiredReviews
    ? `✅ Required approvals: ${requiredReviews.required_approving_review_count || 1}
✅ Dismiss stale reviews: ${requiredReviews.dismiss_stale_reviews ? 'Yes' : 'No'}
✅ Require code owner reviews: ${requiredReviews.require_code_owner_reviews ? 'Yes' : 'No'}`
    : '❌ No review requirements'
}

**Restrictions:**
${restrictions ? `✅ Restricted to: ${restrictions.users?.map((u: any) => `@${u.login}`).join(', ') || 'No users'}, ${restrictions.teams?.map((t: any) => t.name).join(', ') || 'No teams'}` : '❌ No push restrictions'}

**Other Settings:**
• Enforce admins: ${protection.enforce_admins?.enabled ? 'Yes' : 'No'}
• Allow force pushes: ${protection.allow_force_pushes?.enabled ? 'Yes' : 'No'}
• Allow deletions: ${protection.allow_deletions?.enabled ? 'Yes' : 'No'}
• Required linear history: ${protection.required_linear_history?.enabled ? 'Yes' : 'No'}`,
          actions: ['GET_BRANCH_PROTECTION'],
          source: message.content.source,
        };

        if (callback) {
          await callback(responseContent);
        }

        return {
        success: true,
          text: responseContent.text,
          values: {
            protection,
            branch,
            repository: `${owner}/${repo}`,
          },
          data: {
            protection,
            github: {
              ...state?.github,
              branchProtection: {
                ...state?.github?.branchProtection,
                [`${owner}/${repo}:${branch}`]: protection,
              }
  },
          },
              };
    } catch (error: any) {
        if (error.status === 404) {
          const responseContent: Content = {
            text: `Branch "${branch}" in ${owner}/${repo} has no protection rules configured.`,
            actions: ['GET_BRANCH_PROTECTION'],
            source: message.content.source,
          };

          if (callback) {
            await callback(responseContent);
          }

          return {
        success: true,
            text: responseContent.text,
            values: {
              protected: false,
              branch,
              repository: `${owner}/${repo}`,
            },
            data: {
              github: state?.github || {}
            }
          };
        }
        throw error;
      }
    } catch (error) {
      logger.error('Error in GET_BRANCH_PROTECTION action:', error);
      const errorContent: Content = {
        text: `Failed to get branch protection: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_BRANCH_PROTECTION'],
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
          text: 'Check branch protection for main branch in facebook/react',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Branch Protection for "main" in facebook/react:\n\n**Status Checks:**\n✅ Required checks: ci/circleci, continuous-integration/travis-ci\n\n**Pull Request Reviews:**\n✅ Required approvals: 2\n✅ Dismiss stale reviews: Yes\n✅ Require code owner reviews: Yes\n\n**Restrictions:**\n✅ Restricted to: @react-core-team\n\n**Other Settings:**\n• Enforce admins: No\n• Allow force pushes: No\n• Allow deletions: No\n• Required linear history: Yes',
          actions: ['GET_BRANCH_PROTECTION'],
        }
  },
    ],
  ],
};

// Helper function to get human-readable time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffMs / 604800000);
  const diffMonths = Math.floor(diffMs / 2592000000);

  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  }
  return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
}
