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

// Get User Profile Action
export const getUserProfileAction: Action = {
  name: 'GET_GITHUB_USER',
  similes: ['GET_USER', 'USER_PROFILE', 'CHECK_USER', 'USER_INFO'],
  description: 'Retrieves detailed information about a GitHub user',

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

      // Extract username from message text or options
      const text = message.content.text || '';
      const usernameMatch = text.match(/@?([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/);
      const username = options.username || usernameMatch?.[1];

      if (!username) {
        // Get current authenticated user if no username provided
        logger.info('No username provided, getting authenticated user');
        const user = await githubService.getCurrentUser();

        const responseContent: Content = {
          text: `Your GitHub Profile:
Username: @${user.login}
Name: ${user.name || 'Not set'}
Bio: ${user.bio || 'No bio'}
Company: ${user.company || 'Not specified'}
Location: ${user.location || 'Not specified'}
Email: ${user.email || 'Not public'}
Twitter: ${user.twitter_username ? `@${user.twitter_username}` : 'Not linked'}
Blog: ${user.blog || 'No blog'}

Public Repos: ${user.public_repos}
Public Gists: ${user.public_gists}
Followers: ${user.followers}
Following: ${user.following}

Created: ${new Date(user.created_at).toLocaleDateString()}
Updated: ${new Date(user.updated_at).toLocaleDateString()}

Profile URL: ${user.html_url}`,
          actions: ['GET_GITHUB_USER'],
          source: message.content.source,
        };

        if (callback) {
          await callback(responseContent);
        }

        return {
          success: true,
          text: responseContent.text,
          values: {
            user,
            username: user.login,
          },
          data: {
            user,
            github: {
              ...state?.github,
              lastUser: user,
              currentUser: user,
            }
          }
        };
      }

      // Get specific user
      logger.info(`Getting user information for ${username}`);
      const user = await githubService.getUser(username);

      const responseContent: Content = {
        text: `GitHub User: @${user.login}
Name: ${user.name || 'Not set'}
Bio: ${user.bio || 'No bio'}
Company: ${user.company || 'Not specified'}
Location: ${user.location || 'Not specified'}
Email: ${user.email || 'Not public'}
Twitter: ${user.twitter_username ? `@${user.twitter_username}` : 'Not linked'}
Blog: ${user.blog || 'No blog'}
Type: ${user.type}

Public Repos: ${user.public_repos}
Public Gists: ${user.public_gists}
Followers: ${user.followers}
Following: ${user.following}

Created: ${new Date(user.created_at).toLocaleDateString()}
Updated: ${new Date(user.updated_at).toLocaleDateString()}

Profile URL: ${user.html_url}`,
        actions: ['GET_GITHUB_USER'],
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
          user,
          username: user.login,
        },
        data: {
          user,
          github: {
            ...state?.github,
            lastUser: user,
            users: {
              ...state?.github?.users,
              [user.login]: user,
            }
  },
        },
            };
    } catch (error) {
      logger.error('Error in GET_GITHUB_USER action:', error);
      const errorContent: Content = {
        text: `Failed to get user information: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_USER'],
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
          text: 'Get information about @octocat',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub User: @octocat\nName: The Octocat\nBio: GitHub mascot\nCompany: @github\nLocation: San Francisco\nEmail: Not public\nTwitter: Not linked\nBlog: https://github.blog\nType: User\n\nPublic Repos: 8\nPublic Gists: 8\nFollowers: 3938\nFollowing: 9\n\nCreated: 1/25/2011\nUpdated: 3/21/2024\n\nProfile URL: https://github.com/octocat',
          actions: ['GET_GITHUB_USER'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Check torvalds profile and see his top repositories',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub User: @torvalds\nName: Linus Torvalds\nBio: Creator of Linux\nCompany: Linux Foundation\nLocation: Portland, OR\nEmail: Not public\nTwitter: Not linked\nBlog: Not specified\nType: User\n\nPublic Repos: 6\nPublic Gists: 0\nFollowers: 171234\nFollowing: 0\n\nCreated: 9/3/2011\nUpdated: 3/21/2024\n\nProfile URL: https://github.com/torvalds\n\nNow let me check his repositories...',
          actions: ['GET_GITHUB_USER', 'LIST_USER_REPOSITORIES'],
        }
  },
    ],
  ],
};

// Get User Stats Action
export const getUserStatsAction: Action = {
  name: 'GET_GITHUB_USER_STATS',
  similes: ['USER_STATS', 'USER_ACTIVITY', 'USER_CONTRIBUTIONS'],
  description:
    'Gets comprehensive statistics about a GitHub user including contributions and language breakdown',

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

      // Extract username from message text or options
      const text = message.content.text || '';
      const usernameMatch = text.match(/@?([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/);
      const username =
        options.username || usernameMatch?.[1] || (await githubService.getCurrentUser()).login;

      logger.info(`Getting stats for user ${username}`);

      // Get user's repositories to calculate stats
      const repos = await githubService.listUserRepositories(username, {
        type: 'owner',
        sort: 'updated',
        per_page: 100,
      });

      // Calculate language statistics
      const languageStats: Record<string, number> = {};
      let totalStars = 0;
      let totalForks = 0;
      let totalIssues = 0;

      for (const repo of repos) {
        if (repo.language) {
          languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
        }
        totalStars += repo.stargazers_count || 0;
        totalForks += repo.forks_count || 0;
        totalIssues += repo.open_issues_count || 0;
      }

      // Sort languages by count
      const sortedLanguages = Object.entries(languageStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      // Get recent activity (events)
      const events = await githubService.listUserEvents(username, {
        per_page: 100,
      });

      // Count event types
      const eventTypes: Record<string, number> = {};
      for (const event of events) {
        eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
      }

      const recentCommits = events.filter((e: any) => e.type === 'PushEvent').length;
      const recentPRs = events.filter((e: any) => e.type === 'PullRequestEvent').length;
      const recentIssues = events.filter((e: any) => e.type === 'IssuesEvent').length;

      const responseContent: Content = {
        text: `GitHub Stats for @${username}:

**Repository Statistics:**
Total Repositories: ${repos.length}
Total Stars Received: ⭐ ${totalStars}
Total Forks: 🍴 ${totalForks}
Total Open Issues: 📝 ${totalIssues}

**Top Languages:**
${sortedLanguages.map(([lang, count]) => `• ${lang}: ${count} repos`).join('\n') || 'No languages detected'}

**Recent Activity (last 100 events):**
Push Events (Commits): ${recentCommits}
Pull Request Events: ${recentPRs}
Issue Events: ${recentIssues}
Total Events: ${events.length}

**Most Popular Repositories:**
${repos
  .sort((a: any, b: any) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
  .slice(0, 5)
  .map(
    (r: any) => `• ${r.name} - ⭐ ${r.stargazers_count || 0} - ${r.description || 'No description'}`
  )
  .join('\n')}`,
        actions: ['GET_GITHUB_USER_STATS'],
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
          username,
          stats: {
            totalRepos: repos.length,
            totalStars,
            totalForks,
            totalIssues,
            languages: languageStats,
            recentActivity: {
              commits: recentCommits,
              pullRequests: recentPRs,
              issues: recentIssues,
              totalEvents: events.length,
            }
  },
        },
        data: {
          stats: {
            username,
            repositories: repos,
            languageStats,
            events,
            eventTypes,
          },
          github: {
            ...state?.github,
            userStats: {
              ...state?.github?.userStats,
              [username]: {
                repos: repos.length,
                stars: totalStars,
                forks: totalForks,
                languages: languageStats,
                lastUpdated: new Date().toISOString(),
              }
  },
          }
        }
      };
    } catch (error) {
      logger.error('Error in GET_GITHUB_USER_STATS action:', error);
      const errorContent: Content = {
        text: `Failed to get user stats: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_USER_STATS'],
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
          text: 'Get stats for @gaearon',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'GitHub Stats for @gaearon:\n\n**Repository Statistics:**\nTotal Repositories: 245\nTotal Stars Received: ⭐ 89234\nTotal Forks: 🍴 12456\nTotal Open Issues: 📝 234\n\n**Top Languages:**\n• JavaScript: 178 repos\n• TypeScript: 45 repos\n• HTML: 12 repos\n• CSS: 8 repos\n• Shell: 2 repos\n\n**Recent Activity (last 100 events):**\nPush Events (Commits): 34\nPull Request Events: 12\nIssue Events: 8\nTotal Events: 100\n\n**Most Popular Repositories:**\n• redux - ⭐ 60234 - Predictable state container for JavaScript apps\n• react-hot-loader - ⭐ 12456 - Live editing of React\n• overreacted.io - ⭐ 6789 - Personal blog by Dan Abramov\n• whatthefuck.is - ⭐ 4567 - An opinionated glossary of computer science terms\n• react-dnd - ⭐ 3456 - Drag and Drop for React',
          actions: ['GET_GITHUB_USER_STATS'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Show me my GitHub statistics and language breakdown',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: "GitHub Stats for @user:\n\n**Repository Statistics:**\nTotal Repositories: 42\nTotal Stars Received: ⭐ 156\nTotal Forks: 🍴 23\nTotal Open Issues: 📝 8\n\n**Top Languages:**\n• TypeScript: 15 repos\n• JavaScript: 12 repos\n• Python: 8 repos\n• Go: 4 repos\n• Rust: 3 repos\n\n**Recent Activity (last 100 events):**\nPush Events (Commits): 67\nPull Request Events: 8\nIssue Events: 5\nTotal Events: 100\n\n**Most Popular Repositories:**\n• awesome-project - ⭐ 45 - A really cool project\n• my-cli-tool - ⭐ 34 - Useful CLI tool for developers\n• react-components - ⭐ 28 - Reusable React components\n• api-wrapper - ⭐ 21 - API wrapper for various services\n• dotfiles - ⭐ 18 - My personal dotfiles\n\nYour most active language is TypeScript, and you've been quite active with 67 commits recently!",
          actions: ['GET_GITHUB_USER_STATS'],
        }
  },
    ],
  ],
};

// List User Repositories Action
export const listUserRepositoriesAction: Action = {
  name: 'LIST_USER_REPOSITORIES',
  similes: ['USER_REPOS', 'USER_PROJECTS', 'GET_USER_REPOS'],
  description: 'Lists repositories for a specific GitHub user',

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

      // Extract username from message text or options
      const text = message.content.text || '';
      const usernameMatch = text.match(/@?([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/);
      const username = options.username || usernameMatch?.[1] || state?.github?.lastUser?.login;

      if (!username) {
        throw new Error('Username is required. Please specify a GitHub username');
      }

      logger.info(`Listing repositories for user ${username}`);
      const repos = await githubService.listUserRepositories(username, {
        type: options.type || 'owner',
        sort: options.sort || 'updated',
        per_page: options.limit || 10,
      });

      const repoList = repos
        .map(
          (repo: any) =>
            `• ${repo.name} (${repo.language || 'Unknown'}) - ⭐ ${repo.stargazers_count}${repo.fork ? ' (fork)' : ''}${repo.description ? `\n  ${repo.description}` : ''}`
        )
        .join('\n');

      const responseContent: Content = {
        text: `Repositories for @${username} (${repos.length} shown):\n${repoList}`,
        actions: ['LIST_USER_REPOSITORIES'],
        source: message.content.source,
        // Include data for callbacks
        repositories: repos,
        username,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return result for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          repositories: repos,
          username,
          repositoryCount: repos.length,
        },
        data: {
          repositories: repos,
          github: {
            ...state?.github,
            userRepositories: {
              ...state?.github?.userRepositories,
              [username]: repos,
            }
  },
        },
            };
    } catch (error) {
      logger.error('Error in LIST_USER_REPOSITORIES action:', error);
      const errorContent: Content = {
        text: `Failed to list user repositories: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['LIST_USER_REPOSITORIES'],
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
          text: 'List repositories for @sindresorhus',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Repositories for @sindresorhus (10 shown):\n• awesome - (Unknown) - ⭐ 285234\n  😎 Awesome lists about all kinds of interesting topics\n• awesome-nodejs - (Unknown) - ⭐ 54567\n  ⚡ Delightful Node.js packages and resources\n• got - (TypeScript) - ⭐ 13456\n  🌐 Human-friendly and powerful HTTP request library for Node.js\n• ora - (JavaScript) - ⭐ 8901\n  Elegant terminal spinner\n• execa - (JavaScript) - ⭐ 5678\n  Process execution for humans\n• p-limit - (JavaScript) - ⭐ 1234\n  Run multiple promise-returning & async functions with limited concurrency',
          actions: ['LIST_USER_REPOSITORIES'],
        }
  },
    ],
  ],
};
