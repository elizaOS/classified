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

// Get Repository Stats Action
export const getRepositoryStatsAction: Action = {
  name: 'GET_GITHUB_REPO_STATS',
  similes: ['REPO_STATS', 'REPOSITORY_STATS', 'PROJECT_STATS', 'REPO_METRICS'],
  description:
    'Gets comprehensive statistics about a GitHub repository including contributors, commits, and activity',

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

      logger.info(`Getting stats for repository ${owner}/${repo}`);

      // Get repository info
      const repository = await githubService.getRepository(owner, repo);

      // Get contributor stats
      const contributors = await githubService.getContributorsStats(owner, repo);

      // Get commit activity
      const commitActivity = await githubService.getCommitActivityStats(owner, repo);

      // Get code frequency
      const codeFrequency = await githubService.getCodeFrequencyStats(owner, repo);

      // Get language breakdown
      const languages = await githubService.getLanguages(owner, repo);

      // Calculate stats
      const totalCommits =
        contributors?.reduce((sum: number, c: any) => sum + (c.total || 0), 0) || 0;
      const topContributors = (contributors || [])
        .sort((a: any, b: any) => (b.total || 0) - (a.total || 0))
        .slice(0, 5);

      // Recent activity (last 4 weeks)
      const recentWeeks = (commitActivity || []).slice(-4);
      const recentCommits = recentWeeks.reduce(
        (sum: number, week: any) => sum + (week.total || 0),
        0
      );

      // Code changes (last entry in code frequency)
      const codeFreqArray = Array.isArray(codeFrequency) ? codeFrequency : [];
      const lastWeekCode = codeFreqArray[codeFreqArray.length - 1] || [0, 0, 0];
      const [, additions, deletions] = lastWeekCode;

      // Language stats
      const totalBytes = Object.values(languages || {}).reduce(
        (sum: number, bytes: any) => sum + bytes,
        0
      );
      const languagePercentages = Object.entries(languages || {})
        .map(([lang, bytes]: [string, any]) => ({
          language: lang,
          percentage: ((Number(bytes) / Number(totalBytes)) * 100).toFixed(1),
        }))
        .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
        .slice(0, 5);

      const responseContent: Content = {
        text: `Repository Stats for ${owner}/${repo}:

**Basic Info:**
• Created: ${new Date(repository.created_at).toLocaleDateString()}
• Last Updated: ${new Date(repository.updated_at).toLocaleDateString()}
• Stars: ⭐ ${repository.stargazers_count}
• Forks: 🍴 ${repository.forks_count}
• Open Issues: 📝 ${repository.open_issues_count}
• Size: ${(repository.size / 1024).toFixed(1)} MB

**Contributors:**
Total Contributors: ${contributors?.length || 0}
Total Commits: ${totalCommits}

Top Contributors:
${topContributors
  .map((c: any) => `• @${c.author?.login || 'unknown'} - ${c.total} commits`)
  .join('\n')}

**Recent Activity (Last 4 weeks):**
Total Commits: ${recentCommits}
Last Week: +${Math.abs(additions)} lines, -${Math.abs(deletions)} lines

**Languages:**
${languagePercentages.map((l) => `• ${l.language}: ${l.percentage}%`).join('\n')}`,
        actions: ['GET_GITHUB_REPO_STATS'],
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
          repository: `${owner}/${repo}`,
          stats: {
            basic: {
              stars: repository.stargazers_count,
              forks: repository.forks_count,
              issues: repository.open_issues_count,
              size: repository.size,
            },
            contributors: {
              total: contributors?.length || 0,
              commits: totalCommits,
              top: topContributors,
            },
            activity: {
              recentCommits,
              additions,
              deletions,
            },
            languages: languagePercentages,
          }
  },
        data: {
          repository,
          stats: {
            contributors,
            commitActivity,
            codeFrequency,
            languages,
          },
          github: {
            ...state?.github,
            repositoryStats: {
              ...state?.github?.repositoryStats,
              [`${owner}/${repo}`]: {
                repository,
                contributors: contributors?.length || 0,
                totalCommits,
                languages: languagePercentages,
                lastUpdated: new Date().toISOString(),
              }
  },
          }
        }
      };
    } catch (error) {
      logger.error('Error in GET_GITHUB_REPO_STATS action:', error);
      const errorContent: Content = {
        text: `Failed to get repository stats: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_REPO_STATS'],
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
          text: 'Get stats for facebook/react repository',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Repository Stats for facebook/react:\n\n**Basic Info:**\n• Created: 5/29/2013\n• Last Updated: 3/21/2024\n• Stars: ⭐ 223456\n• Forks: 🍴 45678\n• Open Issues: 📝 1234\n• Size: 234.5 MB\n\n**Contributors:**\nTotal Contributors: 1584\nTotal Commits: 15234\n\nTop Contributors:\n• @gaearon - 892 commits\n• @sophiebits - 765 commits\n• @sebmarkbage - 654 commits\n• @acdlite - 543 commits\n• @zpao - 432 commits\n\n**Recent Activity (Last 4 weeks):**\nTotal Commits: 234\nLast Week: +1234 lines, -567 lines\n\n**Languages:**\n• JavaScript: 68.2%\n• TypeScript: 25.3%\n• CSS: 3.8%\n• HTML: 2.1%\n• Other: 0.6%',
          actions: ['GET_GITHUB_REPO_STATS'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Analyze the activity and health of my project repository',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Repository Stats for user/project:\n\n**Basic Info:**\n• Created: 1/15/2024\n• Last Updated: 3/21/2024\n• Stars: ⭐ 42\n• Forks: 🍴 8\n• Open Issues: 📝 5\n• Size: 12.3 MB\n\n**Contributors:**\nTotal Contributors: 3\nTotal Commits: 234\n\nTop Contributors:\n• @user - 189 commits\n• @contributor1 - 34 commits\n• @contributor2 - 11 commits\n\n**Recent Activity (Last 4 weeks):**\nTotal Commits: 45\nLast Week: +892 lines, -234 lines\n\n**Languages:**\n• TypeScript: 72.5%\n• JavaScript: 15.2%\n• CSS: 8.3%\n• HTML: 4.0%\n\nThe repository shows healthy activity with consistent commits. Consider addressing the 5 open issues to improve project health.',
          actions: ['GET_GITHUB_REPO_STATS'],
        }
  },
    ],
  ],
};

// Get Repository Traffic Action
export const getRepositoryTrafficAction: Action = {
  name: 'GET_GITHUB_REPO_TRAFFIC',
  similes: ['REPO_TRAFFIC', 'VISITOR_STATS', 'TRAFFIC_ANALYTICS'],
  description: 'Gets traffic statistics for a GitHub repository (requires push access)',

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

      logger.info(`Getting traffic stats for repository ${owner}/${repo}`);

      try {
        // Get views
        const views = await githubService.getTrafficViews(owner, repo);

        // Get clones
        const clones = await githubService.getTrafficClones(owner, repo);

        // Get popular paths
        const paths = await githubService.getTopPaths(owner, repo);

        // Get referrers
        const referrers = await githubService.getTopReferrers(owner, repo);

        const responseContent: Content = {
          text: `Traffic Stats for ${owner}/${repo}:

**Views (Last 14 days):**
• Total Views: ${views.count}
• Unique Visitors: ${views.uniques}

**Clones (Last 14 days):**
• Total Clones: ${clones.count}
• Unique Cloners: ${clones.uniques}

**Popular Content:**
${paths
  .slice(0, 5)
  .map((p: any) => `• ${p.path} - ${p.count} views (${p.uniques} unique)`)
  .join('\n')}

**Top Referrers:**
${referrers
  .slice(0, 5)
  .map((r: any) => `• ${r.referrer} - ${r.count} views (${r.uniques} unique)`)
  .join('\n')}`,
          actions: ['GET_GITHUB_REPO_TRAFFIC'],
          source: message.content.source,
        };

        if (callback) {
          await callback(responseContent);
        }

        return {
        success: true,
          text: responseContent.text,
          values: {
            repository: `${owner}/${repo}`,
            traffic: {
              views: {
                total: views.count,
                unique: views.uniques,
              },
              clones: {
                total: clones.count,
                unique: clones.uniques,
              },
              paths: paths.slice(0, 5),
              referrers: referrers.slice(0, 5),
            }
  },
          data: {
            traffic: {
              views,
              clones,
              paths,
              referrers,
            },
            github: {
              ...state?.github,
              repositoryTraffic: {
                ...state?.github?.repositoryTraffic,
                [`${owner}/${repo}`]: {
                  views,
                  clones,
                  lastUpdated: new Date().toISOString(),
                }
  },
            }
          }
        };
      } catch (error: any) {
        if (error.status === 403) {
          const responseContent: Content = {
            text: `Traffic statistics are not available for ${owner}/${repo}. This feature requires push access to the repository.`,
            actions: ['GET_GITHUB_REPO_TRAFFIC'],
            source: message.content.source,
          };

          if (callback) {
            await callback(responseContent);
          }

          return {
        success: true,
            text: responseContent.text,
            values: {
              repository: `${owner}/${repo}`,
              available: false,
            },
            data: {
              github: state?.github || {}
            }
          };
        }
        throw error;
      }
    } catch (error) {
      logger.error('Error in GET_GITHUB_REPO_TRAFFIC action:', error);
      const errorContent: Content = {
        text: `Failed to get repository traffic: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['GET_GITHUB_REPO_TRAFFIC'],
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
          text: 'Show traffic stats for my awesome-project repository',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Traffic Stats for user/awesome-project:\n\n**Views (Last 14 days):**\n• Total Views: 1,234\n• Unique Visitors: 456\n\n**Clones (Last 14 days):**\n• Total Clones: 89\n• Unique Cloners: 34\n\n**Popular Content:**\n• /README.md - 456 views (234 unique)\n• /docs/getting-started.md - 123 views (89 unique)\n• /src/index.js - 78 views (45 unique)\n• /package.json - 56 views (34 unique)\n• /LICENSE - 45 views (23 unique)\n\n**Top Referrers:**\n• google.com - 234 views (123 unique)\n• github.com - 189 views (98 unique)\n• stackoverflow.com - 78 views (45 unique)\n• reddit.com - 56 views (34 unique)\n• twitter.com - 45 views (23 unique)',
          actions: ['GET_GITHUB_REPO_TRAFFIC'],
        }
  },
    ],
  ],
};
