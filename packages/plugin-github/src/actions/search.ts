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

// Advanced GitHub Search Action (searches repos, issues, and PRs)
export const searchGitHubAction: Action = {
  name: 'SEARCH_GITHUB',
  similes: ['GITHUB_SEARCH', 'FIND_ON_GITHUB', 'SEARCH_ALL'],
  description: 'Comprehensive GitHub search across repositories, issues, and pull requests',

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

      // Extract search query from message text or options
      const text = message.content.text || '';
      const queryMatch = text.match(
        /(?:search|find)\s+(?:for\s+)?["\']?([^"'\n]+?)["\']?(?:\s|$)/i
      );
      const query = options.query || queryMatch?.[1];

      if (!query) {
        throw new Error('Search query is required');
      }

      // Determine search type from context
      const searchType =
        options.type ||
        (text.includes('issue')
          ? 'issues'
          : text.includes('pr') || text.includes('pull request')
            ? 'pull_requests'
            : text.includes('repo')
              ? 'repositories'
              : 'all');

      const results: any = {};
      let responseText = '';

      if (searchType === 'all' || searchType === 'repositories') {
        const repos = await githubService.searchRepositories(query, {
          sort: 'stars',
          per_page: options.limit || 5,
        });
        results.repositories = repos.items;
        if (repos.items.length > 0) {
          responseText += `**Repositories (${repos.total_count} total):**\n`;
          responseText += repos.items
            .map(
              (r: any) =>
                `• ${r.full_name} - ⭐ ${r.stargazers_count} - ${r.description || 'No description'}`
            )
            .join('\n');
          responseText += '\n\n';
        }
      }

      if (searchType === 'all' || searchType === 'issues') {
        const issues = await githubService.searchIssues(`${query} is:issue`, {
          sort: 'updated',
          per_page: options.limit || 5,
        });
        results.issues = issues.items;
        if (issues.items.length > 0) {
          responseText += `**Issues (${issues.total_count} total):**\n`;
          responseText += issues.items
            .map((i: any) => {
              const repoName = i.html_url
                ? i.html_url.match(/github\.com\/([^\/]+\/[^\/]+)/)?.[1]
                : 'unknown';
              return `• ${repoName}#${i.number}: ${i.title} (${i.state})`;
            })
            .join('\n');
          responseText += '\n\n';
        }
      }

      if (searchType === 'all' || searchType === 'pull_requests') {
        const prs = await githubService.searchIssues(`${query} is:pr`, {
          sort: 'updated',
          per_page: options.limit || 5,
        });
        results.pullRequests = prs.items;
        if (prs.items.length > 0) {
          responseText += `**Pull Requests (${prs.total_count} total):**\n`;
          responseText += prs.items
            .map((pr: any) => {
              const repoName = pr.html_url
                ? pr.html_url.match(/github\.com\/([^\/]+\/[^\/]+)/)?.[1]
                : 'unknown';
              return `• ${repoName}#${pr.number}: ${pr.title} (${pr.state})`;
            })
            .join('\n');
          responseText += '\n\n';
        }
      }

      if (!responseText) {
        responseText = `No results found for "${query}"`;
      } else {
        responseText = `Search results for "${query}":\n\n${responseText.trim()}`;
      }

      const responseContent: Content = {
        text: responseText,
        actions: ['SEARCH_GITHUB'],
        source: message.content.source,
        // Include data for callbacks
        results,
        query,
        searchType,
      };

      if (callback) {
        await callback(responseContent);
      }

      // Return result for chaining
      return {
        success: true,
        text: responseContent.text,
        values: {
          results,
          query,
          searchType,
        },
        data: {
          searchResults: results,
          github: {
            ...state?.github,
            lastSearchResults: results,
            lastSearchQuery: query,
            lastSearchType: searchType,
          }
        }
      };
    } catch (error) {
      logger.error('Error in SEARCH_GITHUB action:', error);
      const errorContent: Content = {
        text: `Failed to search GitHub: ${error instanceof Error ? error.message : String(error)}`,
        actions: ['SEARCH_GITHUB'],
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
          text: 'Search GitHub for "machine learning"',
        },
      },
      {
        name: 'Assistant',
        content: {
          text: 'Search results for "machine learning":\n\n**Repositories (150,000 total):**\n• tensorflow/tensorflow - ⭐ 185000 - An Open Source Machine Learning Framework for Everyone\n• scikit-learn/scikit-learn - ⭐ 59000 - machine learning in Python\n• pytorch/pytorch - ⭐ 75000 - Tensors and Dynamic neural networks in Python\n• keras-team/keras - ⭐ 61000 - Deep Learning for humans\n• apache/spark - ⭐ 38000 - Apache Spark - A unified analytics engine\n\n**Issues (25,000 total):**\n• tensorflow/tensorflow#58432: Add support for new optimizer (open)\n• scikit-learn/scikit-learn#24567: Bug in RandomForest prediction (open)',
          actions: ['SEARCH_GITHUB'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Find everything related to "GraphQL Apollo" on GitHub',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Search results for "GraphQL Apollo":\n\n**Repositories (8,500 total):**\n• apollographql/apollo-server - ⭐ 13500 - 🌍 Spec-compliant GraphQL server\n• apollographql/apollo-client - ⭐ 19000 - 🚀 A fully-featured GraphQL client\n• apollographql/apollo - ⭐ 2300 - 🚀 The Apollo GraphQL platform\n\n**Issues (2,100 total):**\n• apollographql/apollo-client#9876: Cache invalidation not working properly (open)\n• apollographql/apollo-server#5432: Federation v2 support (closed)\n\n**Pull Requests (890 total):**\n• apollographql/apollo-client#9890: Fix subscription memory leak (open)\n• apollographql/apollo-server#5445: Add custom scalar support (merged)\n\nWould you like me to dive deeper into any of these results?',
          actions: ['SEARCH_GITHUB'],
        }
  },
    ],
    [
      {
        name: 'User',
        content: {
          text: 'Search for TypeScript issues in popular frameworks',
        }
  },
      {
        name: 'Assistant',
        content: {
          text: 'Search results for "TypeScript issues in popular frameworks":\n\n**Issues (12,345 total):**\n• microsoft/vscode#98765: TypeScript 5.0 support (open)\n• angular/angular#45678: Type inference regression in v15 (open)\n• vuejs/core#8901: TypeScript strict mode compatibility (closed)\n• facebook/react#23456: JSX transform TypeScript types (open)\n• nestjs/nest#7890: Decorator metadata issues with TS 5.0 (open)\n\n**Pull Requests (3,456 total):**\n• DefinitelyTyped/DefinitelyTyped#67890: Update React types for v18 (open)\n• microsoft/TypeScript#54321: Fix generic constraint inference (merged)\n• angular/angular#45679: Fix TypeScript 5.0 compatibility (open)\n\nThese results show active TypeScript-related development across major frameworks. Would you like me to search for something more specific?',
          actions: ['SEARCH_GITHUB'],
        }
  },
    ],
  ],
};
