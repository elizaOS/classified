import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  logger,
} from '@elizaos/core';
import { GitHubService } from '../services/github';
import { GitHubRepository, GitHubIssue, GitHubPullRequest } from '../types';

// GitHub Repository Context Provider
export const githubRepositoryProvider: Provider = {
  name: 'GITHUB_REPOSITORY_CONTEXT',
  description: 'Provides context about GitHub repositories from current state',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state: State | undefined
  ): Promise<ProviderResult> => {
    try {
      const githubState = state?.github;

      if (!githubState) {
        return {
          text: 'GitHub Repository context is available. I can help you search for repositories, get repository details, and manage repository-related tasks.',
          values: {},
          data: {},
        };
      }

      let contextText = '';
      const values: Record<string, any> = {};
      const data: Record<string, any> = {};

      // Current repository context
      if (githubState.lastRepository) {
        const repo = githubState.lastRepository;
        contextText += `Current Repository: ${repo.full_name}\n`;
        contextText += `Description: ${repo.description || 'No description'}\n`;
        contextText += `Language: ${repo.language || 'Unknown'}\n`;
        contextText += `Stars: ${repo.stargazers_count}\n`;
        contextText += `Forks: ${repo.forks_count}\n`;
        contextText += `Open Issues: ${repo.open_issues_count}\n`;
        contextText += `Private: ${repo.private ? 'Yes' : 'No'}\n`;

        values.currentRepository = repo.full_name;
        values.repositoryOwner = repo.owner.login;
        values.repositoryName = repo.name;
        values.repositoryLanguage = repo.language;
        values.repositoryStars = repo.stargazers_count;
        values.repositoryForks = repo.forks_count;
        values.repositoryOpenIssues = repo.open_issues_count;
        values.repositoryPrivate = repo.private;

        data.lastRepository = repo;
      }

      // Recently accessed repositories
      if (githubState.repositories && Object.keys(githubState.repositories).length > 0) {
        const recentRepos = (Object.values(githubState.repositories) as GitHubRepository[])
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 5);

        contextText += '\nRecent Repositories:\n';
        recentRepos.forEach((repo) => {
          contextText += `- ${repo.full_name} (${repo.language || 'Unknown'})\n`;
        });

        values.recentRepositories = recentRepos.map((r) => r.full_name);
        data.repositories = githubState.repositories;
      }

      // Last created repository
      if (githubState.lastCreatedRepository) {
        const repo = githubState.lastCreatedRepository;
        contextText += `\nLast Created Repository: ${repo.full_name}\n`;
        contextText += `Created: ${new Date(repo.created_at).toLocaleDateString()}\n`;

        values.lastCreatedRepository = repo.full_name;
        data.lastCreatedRepository = repo;
      }

      // If we have no context yet, provide a helpful message
      if (!contextText) {
        contextText =
          'GitHub Repository context is available. I can help you search for repositories, get repository details, and manage repository-related tasks.';
      }

      return {
        text: contextText,
        values,
        data,
      };
    } catch (error) {
      logger.error('Error in GitHub repository provider:', error);
      return {
        text: '',
        values: {},
        data: {},
      };
    }
  },
};

// GitHub Issues Context Provider
export const githubIssuesProvider: Provider = {
  name: 'GITHUB_ISSUES_CONTEXT',
  description: 'Provides context about GitHub issues from current state',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state: State | undefined
  ): Promise<ProviderResult> => {
    try {
      const githubState = state?.github;

      if (!githubState) {
        return {
          text: '',
          values: {},
          data: {},
        };
      }

      let contextText = '';
      const values: Record<string, any> = {};
      const data: Record<string, any> = {};

      // Current issue context
      if (githubState.lastIssue) {
        const issue = githubState.lastIssue;
        contextText += `Current Issue: #${issue.number} - ${issue.title}\n`;
        contextText += `State: ${issue.state}\n`;
        contextText += `Author: @${issue.user.login}\n`;
        contextText += `Created: ${new Date(issue.created_at).toLocaleDateString()}\n`;
        contextText += `Comments: ${issue.comments}\n`;

        if (issue.labels.length > 0) {
          contextText += `Labels: ${issue.labels.map((l: any) => l.name).join(', ')}\n`;
        }

        if (issue.assignees.length > 0) {
          contextText += `Assignees: ${issue.assignees.map((a: any) => `@${a.login}`).join(', ')}\n`;
        }

        values.currentIssue = issue.number;
        values.issueTitle = issue.title;
        values.issueState = issue.state;
        values.issueAuthor = issue.user.login;
        values.issueLabels = issue.labels.map((l: any) => l.name);
        values.issueAssignees = issue.assignees.map((a: any) => a.login);
        values.issueComments = issue.comments;

        data.lastIssue = issue;
      }

      // Recent issues
      if (githubState.issues && Object.keys(githubState.issues).length > 0) {
        const recentIssues = (Object.values(githubState.issues) as GitHubIssue[])
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 5);

        contextText += '\nRecent Issues:\n';
        recentIssues.forEach((issue) => {
          const repoMatch = Object.keys(githubState.issues || {}).find(
            (key) => githubState.issues![key].id === issue.id
          );
          const repoName = repoMatch?.split('#')[0] || 'unknown';
          contextText += `- ${repoName}#${issue.number}: ${issue.title} (${issue.state})\n`;
        });

        values.recentIssues = recentIssues.map((i) => `#${i.number}: ${i.title}`);
        data.issues = githubState.issues;
      }

      // Last created issue
      if (githubState.lastCreatedIssue) {
        const issue = githubState.lastCreatedIssue;
        contextText += `\nLast Created Issue: #${issue.number} - ${issue.title}\n`;
        contextText += `Created: ${new Date(issue.created_at).toLocaleDateString()}\n`;

        values.lastCreatedIssue = issue.number;
        values.lastCreatedIssueTitle = issue.title;
        data.lastCreatedIssue = issue;
      }

      // Issue search results
      if (githubState.lastIssueSearchResults) {
        const searchResults = githubState.lastIssueSearchResults;
        contextText += `\nLast Issue Search: "${githubState.lastIssueSearchQuery}"\n`;
        contextText += `Found: ${searchResults.total_count} issues\n`;

        values.lastIssueSearchQuery = githubState.lastIssueSearchQuery;
        values.lastIssueSearchCount = searchResults.total_count;
        data.lastIssueSearchResults = searchResults;
      }

      return {
        text: contextText,
        values,
        data,
      };
    } catch (error) {
      logger.error('Error in GitHub issues provider:', error);
      return {
        text: '',
        values: {},
        data: {},
      };
    }
  },
};

// GitHub Pull Requests Context Provider
export const githubPullRequestsProvider: Provider = {
  name: 'GITHUB_PULL_REQUESTS_CONTEXT',
  description: 'Provides context about GitHub pull requests from current state',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    state: State | undefined
  ): Promise<ProviderResult> => {
    try {
      const githubState = state?.github;

      if (!githubState) {
        return {
          text: '',
          values: {},
          data: {},
        };
      }

      let contextText = '';
      const values: Record<string, any> = {};
      const data: Record<string, any> = {};

      // Current pull request context
      if (githubState.lastPullRequest) {
        const pr = githubState.lastPullRequest;
        contextText += `Current Pull Request: #${pr.number} - ${pr.title}\n`;
        contextText += `State: ${pr.state}${pr.merged ? ' (merged)' : ''}\n`;
        contextText += `Draft: ${pr.draft ? 'Yes' : 'No'}\n`;
        contextText += `Author: @${pr.user.login}\n`;
        contextText += `Created: ${new Date(pr.created_at).toLocaleDateString()}\n`;
        contextText += `Head: ${pr.head.ref} → Base: ${pr.base.ref}\n`;
        contextText += `Files Changed: ${pr.changed_files}\n`;
        contextText += `Additions: +${pr.additions}, Deletions: -${pr.deletions}\n`;

        if (pr.labels.length > 0) {
          contextText += `Labels: ${pr.labels.map((l: any) => l.name).join(', ')}\n`;
        }

        if (pr.assignees.length > 0) {
          contextText += `Assignees: ${pr.assignees.map((a: any) => `@${a.login}`).join(', ')}\n`;
        }

        values.currentPullRequest = pr.number;
        values.pullRequestTitle = pr.title;
        values.pullRequestState = pr.state;
        values.pullRequestDraft = pr.draft;
        values.pullRequestMerged = pr.merged;
        values.pullRequestAuthor = pr.user.login;
        values.pullRequestHead = pr.head.ref;
        values.pullRequestBase = pr.base.ref;
        values.pullRequestFilesChanged = pr.changed_files;
        values.pullRequestAdditions = pr.additions;
        values.pullRequestDeletions = pr.deletions;
        values.pullRequestLabels = pr.labels.map((l: any) => l.name);
        values.pullRequestAssignees = pr.assignees.map((a: any) => a.login);

        data.lastPullRequest = pr;
      }

      // Recent pull requests
      if (githubState.pullRequests && Object.keys(githubState.pullRequests).length > 0) {
        const recentPRs = (Object.values(githubState.pullRequests) as GitHubPullRequest[])
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 5);

        contextText += '\nRecent Pull Requests:\n';
        recentPRs.forEach((pr) => {
          const repoMatch = Object.keys(githubState.pullRequests || {}).find(
            (key) => githubState.pullRequests![key].id === pr.id
          );
          const repoName = repoMatch?.split('#')[0] || 'unknown';
          const status = pr.merged ? 'merged' : pr.state;
          contextText += `- ${repoName}#${pr.number}: ${pr.title} (${status})\n`;
        });

        values.recentPullRequests = recentPRs.map((pr) => `#${pr.number}: ${pr.title}`);
        data.pullRequests = githubState.pullRequests;
      }

      // Last created pull request
      if (githubState.lastCreatedPullRequest) {
        const pr = githubState.lastCreatedPullRequest;
        contextText += `\nLast Created Pull Request: #${pr.number} - ${pr.title}\n`;
        contextText += `Created: ${new Date(pr.created_at).toLocaleDateString()}\n`;
        contextText += `Head: ${pr.head.ref} → Base: ${pr.base.ref}\n`;

        values.lastCreatedPullRequest = pr.number;
        values.lastCreatedPullRequestTitle = pr.title;
        values.lastCreatedPullRequestHead = pr.head.ref;
        values.lastCreatedPullRequestBase = pr.base.ref;
        data.lastCreatedPullRequest = pr;
      }

      // Last merged pull request
      if (githubState.lastMergedPullRequest) {
        const merged = githubState.lastMergedPullRequest;
        contextText += `\nLast Merged Pull Request: ${merged.owner}/${merged.repo}#${merged.pull_number}\n`;
        contextText += `Commit SHA: ${merged.sha}\n`;

        values.lastMergedPullRequest = `${merged.owner}/${merged.repo}#${merged.pull_number}`;
        values.lastMergedCommitSha = merged.sha;
        data.lastMergedPullRequest = merged;
      }

      return {
        text: contextText,
        values,
        data,
      };
    } catch (error) {
      logger.error('Error in GitHub pull requests provider:', error);
      return {
        text: '',
        values: {},
        data: {},
      };
    }
  },
};

// GitHub Activity Context Provider
export const githubActivityProvider: Provider = {
  name: 'GITHUB_ACTIVITY_CONTEXT',
  description: 'Provides context about recent GitHub activity and statistics',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state: State | undefined
  ): Promise<ProviderResult> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      const githubState = state?.github;

      if (!githubService && !githubState) {
        return {
          text: '',
          values: {},
          data: {},
        };
      }

      let contextText = '';
      const values: Record<string, any> = {};
      const data: Record<string, any> = {};

      // Activity statistics from state
      if (githubState?.activityStats) {
        const stats = githubState.activityStats;
        contextText += 'GitHub Activity Summary:\n';
        contextText += `Total Actions: ${stats.total}\n`;
        contextText += `Successful: ${stats.success}\n`;
        contextText += `Failed: ${stats.failed}\n`;
        contextText += `Success Rate: ${stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%\n`;

        values.totalActions = stats.total;
        values.successfulActions = stats.success;
        values.failedActions = stats.failed;
        values.successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;

        data.activityStats = stats;
      } else {
        contextText += 'GitHub activity context:\n';
      }

      // Recent activity from service
      if (githubService) {
        try {
          const recentActivity = githubService.getActivityLog(10);

          if (recentActivity.length > 0) {
            contextText += '\nRecent Activity (last 10 actions):\n';
            recentActivity.forEach((activity) => {
              const time = new Date(activity.timestamp).toLocaleTimeString();
              const status = activity.success ? '✅' : '❌';
              const action = activity.action.replace(/_/g, ' ').toLowerCase();
              contextText += `- ${time} ${status} ${action} ${activity.resource_type}\n`;
            });

            values.recentActivityCount = recentActivity.length;
            values.lastActivity = recentActivity[0];
            data.recentActivity = recentActivity;
          }
        } catch (error) {
          logger.warn('Could not fetch recent activity from service:', error);
        }
      }

      // Rate limit information
      if (githubState?.rateLimit) {
        const rateLimit = githubState.rateLimit;
        const usage = Math.round((rateLimit.used / rateLimit.limit) * 100);

        contextText += '\nAPI Rate Limit:\n';
        contextText += `Used: ${rateLimit.used}/${rateLimit.limit} (${usage}%)\n`;
        contextText += `Remaining: ${rateLimit.remaining}\n`;

        if (githubState.rateLimitCheckedAt) {
          contextText += `Last Checked: ${new Date(githubState.rateLimitCheckedAt).toLocaleString()}\n`;
        }

        values.rateLimitUsed = rateLimit.used;
        values.rateLimitLimit = rateLimit.limit;
        values.rateLimitRemaining = rateLimit.remaining;
        values.rateLimitUsage = usage;

        data.rateLimit = rateLimit;
      }

      return {
        text: contextText,
        values,
        data,
      };
    } catch (error) {
      logger.error('Error in GitHub activity provider:', error);
      return {
        text: '',
        values: {},
        data: {},
      };
    }
  },
};

// GitHub User Context Provider
export const githubUserProvider: Provider = {
  name: 'GITHUB_USER_CONTEXT',
  description: 'Provides context about the authenticated GitHub user',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State | undefined
  ): Promise<ProviderResult> => {
    try {
      const githubService = runtime.getService<GitHubService>('github');

      if (!githubService) {
        return {
          text: '',
          values: {},
          data: {},
        };
      }

      try {
        const user = await githubService.getCurrentUser();

        const contextText = `GitHub User: @${user.login}
Name: ${user.name || 'Not specified'}
Email: ${user.email || 'Not public'}
Bio: ${user.bio || 'No bio'}
Company: ${user.company || 'Not specified'}
Location: ${user.location || 'Not specified'}
Public Repos: ${user.public_repos}
Followers: ${user.followers}
Following: ${user.following}
Account Created: ${new Date(user.created_at).toLocaleDateString()}
Profile: ${user.html_url}`;

        const values = {
          githubUsername: user.login,
          githubName: user.name,
          githubEmail: user.email,
          githubBio: user.bio,
          githubCompany: user.company,
          githubLocation: user.location,
          githubPublicRepos: user.public_repos,
          githubFollowers: user.followers,
          githubFollowing: user.following,
          githubAccountType: user.type,
          githubProfileUrl: user.html_url,
        };

        const data = {
          currentUser: user,
        };

        return {
          text: contextText,
          values,
          data,
        };
      } catch (error) {
        logger.warn('Could not fetch GitHub user information:', error);
        return {
          text: 'GitHub user information unavailable',
          values: {},
          data: {},
        };
      }
    } catch (error) {
      logger.error('Error in GitHub user provider:', error);
      return {
        text: '',
        values: {},
        data: {},
      };
    }
  },
};
