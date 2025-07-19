import {
  type Action,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
} from '@elizaos/core';
import { GitHubService } from '../services/github';

// Get GitHub Activity Action
export const getGitHubActivityAction: Action = {
  name: 'GET_GITHUB_ACTIVITY',
  similes: ['SHOW_ACTIVITY', 'GITHUB_LOG', 'ACTIVITY_LOG', 'GITHUB_HISTORY'],
  description: 'Shows recent GitHub activity performed by the agent',

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
      limit?: number;
      filter?: 'all' | 'success' | 'failed';
      resource_type?: 'repository' | 'issue' | 'pull_request';
    } = {},
    callback?: HandlerCallback
  ) => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      const limit = options.limit || 20;
      const activityLog = githubService.getActivityLog(limit);

      // Apply filters
      let filteredActivity = activityLog;

      if (options.filter && options.filter !== 'all') {
        filteredActivity = activityLog.filter((item) =>
          options.filter === 'success' ? item.success : !item.success
        );
      }

      if (options.resource_type) {
        filteredActivity = filteredActivity.filter(
          (item) => item.resource_type === options.resource_type
        );
      }

      if (filteredActivity.length === 0) {
        const responseContent: Content = {
          text: 'No GitHub activity found matching the specified criteria.',
          actions: ['GET_GITHUB_ACTIVITY'],
          source: message.content.source,
        };

        if (callback) {
          await callback(responseContent);
        }

        return {
        success: true,
          text: responseContent.text,
          values: {
            activityCount: 0,
            activity: [],
          },
          data: {
            activity: [],
            github: state?.github || {},
          },
        };
      }

      // Group activities by date
      const activityByDate = filteredActivity.reduce(
        (acc, activity) => {
          const date = new Date(activity.timestamp).toLocaleDateString();
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(activity);
          return acc;
        },
        {} as Record<string, typeof filteredActivity>
      );

      const activityText = Object.entries(activityByDate)
        .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
        .map(([date, activities]) => {
          const activityList = activities
            .map((activity) => {
              const time = new Date(activity.timestamp).toLocaleTimeString();
              const status = activity.success ? '✅' : '❌';
              const action = activity.action.replace(/_/g, ' ').toLowerCase();
              return `  ${time} ${status} ${action} ${activity.resource_type} ${activity.resource_id}${activity.error ? ` (${activity.error})` : ''}`;
            })
            .join('\n');

          return `**${date}**\n${activityList}`;
        })
        .join('\n\n');

      const successCount = filteredActivity.filter((a) => a.success).length;
      const failureCount = filteredActivity.filter((a) => !a.success).length;

      const responseContent: Content = {
        text: `GitHub Activity Log (${filteredActivity.length} entries)\nSuccess: ${successCount} | Failed: ${failureCount}\n\n${activityText}`,
        actions: ['GET_GITHUB_ACTIVITY'],
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
          activity: filteredActivity,
          activityCount: filteredActivity.length,
          successCount,
          failureCount,
        },
        data: {
          activity: filteredActivity,
          github: {
            ...state?.github,
            lastActivityLog: filteredActivity,
            activityStats: {
              total: filteredActivity.length,
              success: successCount,
              failed: failureCount,
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in GET_GITHUB_ACTIVITY action:', error);
      const errorContent: Content = {
        text: `Failed to get GitHub activity: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_ACTIVITY'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: true,
        text: errorContent.text,
        values: {
          cleared: false,
        },
        data: {
          github: {
            ...state?.github,
            lastActivityLog: [],
            activityStats: {
              total: 0,
              success: 0,
              failed: 0,
            },
          },
        },
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Show me my recent GitHub activity',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub Activity Log (5 entries)\nSuccess: 4 | Failed: 1\n\n**3/21/2024**\n  2:30 PM ✅ create issue issue elizaOS/eliza#43\n  2:25 PM ✅ get repository repository elizaOS/eliza\n  2:20 PM ❌ create repository repository invalid-name (Repository name is invalid)\n\n**3/20/2024**\n  4:15 PM ✅ list repositories repository authenticated_user\n  3:45 PM ✅ search repositories repository search',
          actions: ['GET_GITHUB_ACTIVITY'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Show me what went wrong with my recent GitHub operations and check my rate limit',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub Activity Log (3 failed entries)\nSuccess: 0 | Failed: 3\n\n**3/21/2024**\n  3:45 PM ❌ create pull_request pull_request user/repo#0 (Base branch does not exist)\n  3:30 PM ❌ merge pull_request pull_request user/repo#15 (PR has merge conflicts)\n  3:15 PM ❌ create repository repository @invalid/name (Repository name is invalid)\n\nLet me check your current API rate limit status...',
          actions: ['GET_GITHUB_ACTIVITY', 'GET_GITHUB_RATE_LIMIT'],
        },
      },
    ],
  ],
};

// Clear GitHub Activity Action
export const clearGitHubActivityAction: Action = {
  name: 'CLEAR_GITHUB_ACTIVITY',
  similes: ['CLEAR_LOG', 'RESET_ACTIVITY', 'CLEAR_HISTORY'],
  description: 'Clears the GitHub activity log',

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
    _options: {} = {},
    callback?: HandlerCallback
  ) => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      githubService.clearActivityLog();

      const responseContent: Content = {
        text: 'GitHub activity log has been cleared.',
        actions: ['CLEAR_GITHUB_ACTIVITY'],
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
          cleared: true,
        },
        data: {
          github: {
            ...state?.github,
            lastActivityLog: [],
            activityStats: {
              total: 0,
              success: 0,
              failed: 0,
            },
          },
        },
      };
    } catch (error) {
      logger.error('Error in CLEAR_GITHUB_ACTIVITY action:', error);
      const errorContent: Content = {
        text: `Failed to clear GitHub activity: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['CLEAR_GITHUB_ACTIVITY'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: true,
        text: errorContent.text,
        values: {
          cleared: false,
        },
        data: {
          github: {
            ...state?.github,
            lastActivityLog: [],
            activityStats: {
              total: 0,
              success: 0,
              failed: 0,
            },
          },
        },
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Clear my GitHub activity log',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub activity log has been cleared.',
          actions: ['CLEAR_GITHUB_ACTIVITY'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Clear the activity log and start fresh with listing my repositories',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub activity log has been cleared.\n\nNow let me list your repositories to start fresh...',
          actions: ['CLEAR_GITHUB_ACTIVITY', 'LIST_GITHUB_REPOSITORIES'],
        },
      },
    ],
  ],
};

// Get GitHub Rate Limit Action
export const getGitHubRateLimitAction: Action = {
  name: 'GET_GITHUB_RATE_LIMIT',
  similes: ['CHECK_RATE_LIMIT', 'RATE_LIMIT_STATUS', 'API_LIMITS'],
  description: 'Shows current GitHub API rate limit status',

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
    _options: {} = {},
    callback?: HandlerCallback
  ) => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service not available');
      }

      const rateLimit = await githubService.getRateLimit();
      const resetTime = new Date(rateLimit.reset * 1000);
      const now = new Date();
      const resetInMinutes = Math.ceil((resetTime.getTime() - now.getTime()) / (1000 * 60));

      const responseContent: Content & { rateLimit?: any; data?: any } = {
        text: `GitHub API Rate Limit Status:
Limit: ${rateLimit.limit} requests per hour
Used: ${rateLimit.used} requests
Remaining: ${rateLimit.remaining} requests
Reset Time: ${resetTime.toLocaleString()}
Reset In: ${resetInMinutes} minutes
Resource: ${rateLimit.resource}

Usage: ${Math.round((rateLimit.used / rateLimit.limit) * 100)}%`,
        actions: ['GET_GITHUB_RATE_LIMIT'],
        source: message.content.source,
        rateLimit,
        data: {
          ...state?.data,
          rateLimit,
        },
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return result for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          rateLimit,
          remaining: rateLimit.remaining,
          resetInMinutes,
        },
        data: {
          rateLimit,
          github: {
            ...state?.github,
            lastRateLimit: rateLimit,
          },
        },
      };
    } catch (error) {
      logger.error('Error in GET_GITHUB_RATE_LIMIT action:', error);
      const errorContent: Content = {
        text: `Failed to get rate limit status: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_RATE_LIMIT'],
        source: message.content.source,
      };

      if (callback) {
        await callback(errorContent);
      }

      return {
        success: true,
        text: errorContent.text,
        values: {
          cleared: false,
        },
        data: {
          github: {
            ...state?.github,
            lastRateLimit: null,
          },
        },
      };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: {
          text: 'Check my GitHub API rate limit',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub API Rate Limit Status:\nLimit: 5000 requests per hour\nUsed: 127 requests\nRemaining: 4873 requests\nReset Time: 3/21/2024, 3:45:00 PM\nReset In: 23 minutes\nResource: core\n\nUsage: 3%',
          actions: ['GET_GITHUB_RATE_LIMIT'],
        },
      },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Check if I have enough API calls left to search through 100 repositories',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub API Rate Limit Status:\nLimit: 5000 requests per hour\nUsed: 2341 requests\nRemaining: 2659 requests\nReset Time: 3/21/2024, 4:00:00 PM\nReset In: 35 minutes\nResource: core\n\nUsage: 47%\n\nYou have 2659 requests remaining, which is more than enough to search through 100 repositories. Each search typically uses 1-2 API calls, so you should be fine. Let me start the repository search...',
          actions: ['GET_GITHUB_RATE_LIMIT', 'SEARCH_GITHUB_REPOSITORIES'],
        },
      },
    ],
  ],
};
