# ElizaOS GitHub Plugin

A comprehensive GitHub integration plugin for ElizaOS that provides repository
management, issue tracking, pull request workflows, and activity monitoring
capabilities.

## Features

### 🏗️ Repository Management

- **Get Repository Info**: Retrieve detailed information about any GitHub
  repository
- **List Repositories**: View your repositories with filtering and sorting
  options
- **Create Repositories**: Create new repositories with customizable settings
- **Search Repositories**: Find repositories across GitHub using advanced
  queries

### 🐛 Issue Management

- **Get Issue Details**: Fetch comprehensive information about specific issues
- **List Issues**: View issues with state, label, and milestone filtering
- **Create Issues**: Submit new issues with labels, assignees, and milestones
- **Search Issues**: Find issues across repositories using powerful search
  queries

### 🔄 Pull Request Workflows

- **Get PR Details**: Retrieve detailed pull request information
- **List Pull Requests**: View PRs with state and branch filtering
- **Create Pull Requests**: Open new PRs from feature branches
- **Merge Pull Requests**: Merge approved PRs with different merge strategies

### 📊 Activity Tracking & Monitoring

- **Activity Dashboard**: Real-time tracking of all GitHub operations performed
  by the agent
- **Rate Limit Monitoring**: Track GitHub API usage and remaining quota
- **Error Handling**: Comprehensive error tracking and reporting
- **Success Metrics**: Monitor operation success rates and performance

### 🔄 State Management & Chaining

- **Contextual State**: Actions automatically update and chain state between
  operations
- **Smart Defaults**: Use previous operation results to inform subsequent
  actions
- **Provider Integration**: Rich context providers for repositories, issues, and
  PRs

### 🔔 Webhook Integration & Real-Time Events

- **Ngrok Integration**: Automatic tunnel creation for local development
- **Webhook Management**: Create, list, delete, and test repository webhooks
- **Event Processing**: Real-time handling of GitHub events (issues, PRs,
  comments)
- **Signature Verification**: Secure webhook payload validation

### 🤖 Auto-Coding Capabilities

- **Issue Analysis**: AI-powered analysis of GitHub issues for automation
  potential
- **Automated PRs**: Create pull requests to fix simple issues automatically
- **Smart Mentions**: Respond when @mentioned in issues or comments
- **Complexity Detection**: Identifies when human intervention is needed

## Installation

```bash
# Add to your ElizaOS project
elizaos install @elizaos/plugin-github

# Or manually add to package.json
npm install @elizaos/plugin-github
```

## Configuration

The plugin uses `runtime.getSetting` to retrieve configuration values, with
fallback to environment variables.

### Runtime Configuration (Recommended)

```typescript
// Configure via agent settings
const agent = new Agent({
  settings: {
    GITHUB_TOKEN: 'ghp_your_personal_access_token_here',
    GITHUB_TOKEN: 'github_pat_your_fine_grained_token', // Alternative
    GITHUB_OWNER: 'your-username-or-org', // Optional default
  },
});
```

### Environment Variables (Fallback)

```bash
# GitHub Personal Access Token (required)
GITHUB_TOKEN=ghp_your_personal_access_token_here

# Alternative: GitHub PAT (legacy support)
GITHUB_TOKEN=ghp_your_personal_access_token_here

# Optional: Default GitHub username/organization
GITHUB_OWNER=your-username-or-org
```

The plugin will check for tokens in this order:

1. `runtime.getSetting('GITHUB_TOKEN')`
2. `runtime.getSetting('GITHUB_TOKEN')`
3. Global configuration object
4. Environment variables (`process.env.GITHUB_TOKEN` or
   `process.env.GITHUB_TOKEN`)

### Token Types Supported

1. **Personal Access Tokens (PAT)**: `ghp_...`
2. **Fine-grained Personal Access Tokens**: `github_pat_...`
3. **GitHub App tokens**: `ghs_...`
4. **OAuth App tokens**: `gho_...`
5. **User-to-server tokens**: `ghu_...`
6. **Server-to-server tokens**: `ghr_...`

### Token Permissions Required

For full functionality, your token needs these permissions:

- `repo` - Full repository access
- `read:user` - Read user profile information
- `read:org` - Read organization membership (if using organization repos)

## Usage Examples

### Repository Operations

```typescript
// Get repository information
await runtime.executeAction('GET_GITHUB_REPOSITORY', {
  owner: 'elizaOS',
  repo: 'eliza',
});

// List your repositories
await runtime.executeAction('LIST_GITHUB_REPOSITORIES', {
  type: 'owner',
  sort: 'updated',
  limit: 10,
});

// Create a new repository
await runtime.executeAction('CREATE_GITHUB_REPOSITORY', {
  name: 'my-new-project',
  description: 'A new project created by ElizaOS',
  private: false,
  auto_init: true,
});

// Search for repositories
await runtime.executeAction('SEARCH_GITHUB_REPOSITORIES', {
  query: 'language:typescript elizaos',
  sort: 'stars',
  limit: 5,
});
```

### Issue Management

```typescript
// Get issue details
await runtime.executeAction('GET_GITHUB_ISSUE', {
  owner: 'elizaOS',
  repo: 'eliza',
  issue_number: 42,
});

// Create a new issue
await runtime.executeAction('CREATE_GITHUB_ISSUE', {
  owner: 'elizaOS',
  repo: 'eliza',
  title: 'Bug: Authentication not working',
  body: 'Detailed description of the issue...',
  labels: ['bug', 'authentication'],
  assignees: ['maintainer'],
});

// List open issues
await runtime.executeAction('LIST_GITHUB_ISSUES', {
  owner: 'elizaOS',
  repo: 'eliza',
  state: 'open',
  labels: 'bug',
});

// Search issues globally
await runtime.executeAction('SEARCH_GITHUB_ISSUES', {
  query: 'is:issue is:open label:bug repo:elizaOS/eliza',
  sort: 'updated',
});
```

### Pull Request Workflows

```typescript
// Create a pull request
await runtime.executeAction('CREATE_GITHUB_PULL_REQUEST', {
  owner: 'elizaOS',
  repo: 'eliza',
  title: 'Add new GitHub integration',
  head: 'feature/github-integration',
  base: 'main',
  body: 'This PR adds comprehensive GitHub integration...',
  draft: false,
});

// Get PR details
await runtime.executeAction('GET_GITHUB_PULL_REQUEST', {
  owner: 'elizaOS',
  repo: 'eliza',
  pull_number: 25,
});

// Merge a pull request
await runtime.executeAction('MERGE_GITHUB_PULL_REQUEST', {
  owner: 'elizaOS',
  repo: 'eliza',
  pull_number: 25,
  merge_method: 'squash',
});
```

### Activity Monitoring

```typescript
// View recent activity
await runtime.executeAction('GET_GITHUB_ACTIVITY', {
  limit: 20,
  filter: 'all',
});

// Check rate limit status
await runtime.executeAction('GET_GITHUB_RATE_LIMIT');

// Clear activity log
await runtime.executeAction('CLEAR_GITHUB_ACTIVITY');
```

## Natural Language Interface

The plugin supports natural language commands:

```
"Get information about the elizaOS/eliza repository"
"Create a new repository called my-awesome-project"
"List my open issues"
"Create an issue in elizaOS/eliza about authentication bugs"
"Show me recent GitHub activity"
"What's my current GitHub rate limit?"
```

## State Management & Action Chaining

The plugin automatically manages state between operations, enabling powerful
action chaining:

### Basic State Management

```typescript
// First, get a repository (stores in state)
await getRepositoryAction.handler(runtime, message, state, {
  owner: 'elizaOS',
  repo: 'eliza',
});

// Then, create an issue (automatically uses the repository from state)
await createIssueAction.handler(runtime, message, updatedState, {
  title: 'New issue',
  body: 'Issue description',
  // owner and repo automatically filled from state
});
```

### Advanced Action Chaining

Actions can be chained together for complex workflows:

```typescript
// Example: Search → Analyze → Create Issue workflow
const workflow = async () => {
  // Step 1: Search for repositories
  const searchResult = await runtime.executeAction(
    'SEARCH_GITHUB_REPOSITORIES',
    {
      query: 'language:typescript stars:>1000',
      sort: 'stars',
    }
  );

  // Step 2: Get details of the top repository
  const topRepo = searchResult.repositories[0];
  const repoDetails = await runtime.executeAction('GET_GITHUB_REPOSITORY', {
    owner: topRepo.owner.login,
    repo: topRepo.name,
  });

  // Step 3: Check existing issues
  const issues = await runtime.executeAction('LIST_GITHUB_ISSUES', {
    owner: topRepo.owner.login,
    repo: topRepo.name,
    state: 'open',
    labels: 'enhancement',
  });

  // Step 4: Create a new issue based on analysis
  if (issues.issues.length < 5) {
    await runtime.executeAction('CREATE_GITHUB_ISSUE', {
      owner: topRepo.owner.login,
      repo: topRepo.name,
      title: 'Consider adding TypeScript strict mode',
      body: `Based on analysis, this repository could benefit from TypeScript strict mode.
             Current stars: ${repoDetails.repository.stargazers_count}
             Open enhancement issues: ${issues.issues.length}`,
    });
  }
};
```

### Complex Multi-Step Workflows

```typescript
// Repository Health Check Workflow
const checkRepositoryHealth = async (owner: string, repo: string) => {
  // Check rate limit first
  const rateLimit = await runtime.executeAction('GET_GITHUB_RATE_LIMIT');

  if (rateLimit.rateLimit.remaining < 10) {
    throw new Error('Rate limit too low for health check');
  }

  // Get repository info
  const repository = await runtime.executeAction('GET_GITHUB_REPOSITORY', {
    owner,
    repo,
  });

  // Check open issues
  const openIssues = await runtime.executeAction('LIST_GITHUB_ISSUES', {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  // Check open PRs
  const openPRs = await runtime.executeAction('LIST_GITHUB_PULL_REQUESTS', {
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  // Search for stale issues
  const staleIssues = await runtime.executeAction('SEARCH_GITHUB_ISSUES', {
    query: `repo:${owner}/${repo} is:open updated:<${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`,
  });

  return {
    repository: repository.repository,
    health: {
      stars: repository.repository.stargazers_count,
      openIssues: openIssues.issues.length,
      openPRs: openPRs.pullRequests.length,
      staleIssues: staleIssues.total_count,
      lastUpdate: repository.repository.updated_at,
    },
    recommendations: generateRecommendations(
      repository,
      openIssues,
      openPRs,
      staleIssues
    ),
  };
};
```

## HTTP API Endpoints

When the plugin is loaded, it exposes these HTTP endpoints:

- `GET /api/github/status` - Plugin status and authentication info
- `GET /api/github/activity` - Recent GitHub activity with statistics
- `GET /api/github/rate-limit` - Current GitHub API rate limit status

## Provider Context

The plugin provides rich context through these providers:

- **GITHUB_REPOSITORY_CONTEXT** - Current repository information
- **GITHUB_ISSUES_CONTEXT** - Recent issues and current issue details
- **GITHUB_PULL_REQUESTS_CONTEXT** - PR information and merge status
- **GITHUB_ACTIVITY_CONTEXT** - Activity statistics and recent operations
- **GITHUB_USER_CONTEXT** - Authenticated user information

## Actions Reference

### Repository Actions

| Action                       | Description                | Parameters                             |
| ---------------------------- | -------------------------- | -------------------------------------- |
| `GET_GITHUB_REPOSITORY`      | Get repository information | `owner`, `repo`                        |
| `LIST_GITHUB_REPOSITORIES`   | List user repositories     | `type`, `sort`, `limit`                |
| `CREATE_GITHUB_REPOSITORY`   | Create new repository      | `name`, `description`, `private`, etc. |
| `SEARCH_GITHUB_REPOSITORIES` | Search repositories        | `query`, `sort`, `limit`               |

### Issue Actions

| Action                 | Description            | Parameters                                 |
| ---------------------- | ---------------------- | ------------------------------------------ |
| `GET_GITHUB_ISSUE`     | Get issue details      | `owner`, `repo`, `issue_number`            |
| `LIST_GITHUB_ISSUES`   | List repository issues | `owner`, `repo`, `state`, `labels`         |
| `CREATE_GITHUB_ISSUE`  | Create new issue       | `owner`, `repo`, `title`, `body`, `labels` |
| `SEARCH_GITHUB_ISSUES` | Search issues          | `query`, `sort`, `limit`                   |

### Pull Request Actions

| Action                       | Description         | Parameters                                       |
| ---------------------------- | ------------------- | ------------------------------------------------ |
| `GET_GITHUB_PULL_REQUEST`    | Get PR details      | `owner`, `repo`, `pull_number`                   |
| `LIST_GITHUB_PULL_REQUESTS`  | List repository PRs | `owner`, `repo`, `state`, `head`, `base`         |
| `CREATE_GITHUB_PULL_REQUEST` | Create new PR       | `owner`, `repo`, `title`, `head`, `base`, `body` |
| `MERGE_GITHUB_PULL_REQUEST`  | Merge PR            | `owner`, `repo`, `pull_number`, `merge_method`   |

### Activity Actions

| Action                  | Description           | Parameters                         |
| ----------------------- | --------------------- | ---------------------------------- |
| `GET_GITHUB_ACTIVITY`   | Get activity log      | `limit`, `filter`, `resource_type` |
| `CLEAR_GITHUB_ACTIVITY` | Clear activity log    | None                               |
| `GET_GITHUB_RATE_LIMIT` | Get rate limit status | None                               |

## Integration with Other Plugins

This plugin is designed to work seamlessly with other ElizaOS plugins:

### Plugin Manager Integration

The GitHub plugin provides all the functionality needed by
`plugin-plugin-manager`:

```typescript
// The plugin-plugin-manager can use GitHub service directly
const githubService = runtime.getService<GitHubService>('github');

// All GitHub operations are available
await githubService.createRepository(options);
await githubService.getRepository(owner, repo);
await githubService.createPullRequest(owner, repo, prOptions);
```

### Security Features

- **Token Validation**: Automatic validation of GitHub token formats
- **Rate Limiting**: Built-in rate limit monitoring and handling
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Input Sanitization**: All inputs are validated and sanitized
- **Activity Logging**: All operations are logged for audit purposes

## Testing

The plugin includes comprehensive test coverage with multiple test suites:

### Unit Tests

```bash
# Run unit tests
npm test

# Or with elizaos
elizaos test component
```

### Integration Tests

Test how components work together:

```bash
npm test integration.test.ts
```

### Action Chaining Tests

Test complex workflows and state management:

```bash
npm test action-chaining.test.ts
```

### Runtime Scenario Tests

Test various runtime configurations:

```bash
npm test runtime-scenarios.test.ts
```

### End-to-End Tests (Requires GitHub Token)

Test with real GitHub API:

```bash
# Set your GitHub token first
export GITHUB_TOKEN=ghp_your_token_here

# Run E2E tests
npm test e2e.test.ts

# Or with elizaos
elizaos test e2e
```

**Note**: E2E tests will interact with real GitHub repositories. Use a test
account or be prepared for actual API calls.

### Webhook E2E Tests (Real GitHub Events)

Test complete webhook functionality with live events:

```bash
# Set up environment
export GITHUB_TOKEN=ghp_your_token_here
export GITHUB_OWNER=your-username
export TEST_REPO=test-webhook-repo

# Start your ElizaOS agent first
elizaos start --character github-agent.json

# Run automated E2E webhook tests
npm run test:e2e
```

This will:

- ✅ Create webhooks via Ngrok tunnel
- ✅ Test real GitHub issue mentions
- ✅ Verify auto-coding PR creation
- ✅ Test complex issue handling
- ✅ Validate webhook signature verification
- ✅ Clean up test artifacts

See [E2E_TESTING.md](./E2E_TESTING.md) for detailed testing instructions.

### Test Coverage

- **Unit Tests**: Individual component functionality
- **Integration Tests**: Component interactions
- **E2E Tests**: Real GitHub API operations
- **Action Chaining**: Complex workflow validation
- **Runtime Scenarios**: Various configuration tests

### Writing Custom Tests

```typescript
// Example test for your own workflows
describe('Custom GitHub Workflow', () => {
  it('should perform repository analysis', async () => {
    const runtime = createTestRuntime({
      settings: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      },
    });

    // Your test logic here
    const result = await runtime.executeAction('SEARCH_GITHUB_REPOSITORIES', {
      query: 'your-search-query',
    });

    expect(result.repositories).toBeDefined();
  });
});
```

## Development

### Local Development

```bash
# Start development mode with hot reload
elizaos dev

# Build the plugin
elizaos build

# Run linting
elizaos lint
```

### Environment Setup

1. Create a `.env` file with your GitHub token:

   ```bash
   GITHUB_TOKEN=your_github_token_here
   GITHUB_OWNER=your_username
   ```

2. Ensure your token has the required permissions for testing

## Troubleshooting

### Common Issues

**Authentication Failed**

- Verify your GitHub token is valid and not expired
- Check that your token has the required permissions
- Ensure the token format is correct (`ghp_...` or `github_pat_...`)

**Rate Limit Exceeded**

- Check your rate limit status: `GET_GITHUB_RATE_LIMIT`
- Wait for the rate limit to reset
- Consider using a GitHub App token for higher limits

**Permission Denied**

- Verify your token has access to the repository
- Check if the repository is private and your token has `repo` scope
- Ensure organization permissions if working with org repositories

**Network Issues**

- Check your internet connection
- Verify GitHub's status at [status.github.com](https://status.github.com)
- Try again with exponential backoff

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for your changes
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the same license as ElizaOS.

## Support

For support and questions:

- Create an issue in the ElizaOS repository
- Join the ElizaOS Discord community
- Check the ElizaOS documentation

---

**Built with ❤️ for the ElizaOS ecosystem**
