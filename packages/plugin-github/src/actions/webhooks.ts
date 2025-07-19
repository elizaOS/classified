import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
  ModelType,
} from '@elizaos/core';
import { GitHubService } from '../services/github';
import { z } from 'zod';

// Schema for webhook evaluation
const WebhookIntentSchema = z.object({
  intent: z.enum(['create_webhook', 'list_webhooks', 'delete_webhook', 'ping_webhook', 'unclear']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  parameters: z
    .object({
      owner: z.string().optional(),
      repo: z.string().optional(),
      webhookId: z.number().optional(),
      events: z.array(z.string()).optional(),
    })
    .optional(),
});

type WebhookIntent = z.infer<typeof WebhookIntentSchema>;

// Use LLM to understand webhook-related requests instead of string matching
async function analyzeWebhookIntent(
  runtime: IAgentRuntime,
  message: Memory,
  state: State
): Promise<WebhookIntent> {
  const prompt = `Analyze this message to determine if the user wants to perform a webhook-related action:

Message: "${message.content.text}"

Context from state:
${state.data?.github?.lastRepository ? `Current repository: ${state.data.github.lastRepository.full_name}` : 'No repository context'}

Determine:
1. What webhook action they want (create, list, delete, ping, or unclear)
2. Confidence level (0-1)
3. Your reasoning
4. Extract parameters (owner, repo, webhookId, events)

Format as JSON matching this schema:
{
  "intent": "create_webhook" | "list_webhooks" | "delete_webhook" | "ping_webhook" | "unclear",
  "confidence": 0.8,
  "reasoning": "User is asking to...",
  "parameters": {
    "owner": "extracted_owner",
    "repo": "extracted_repo", 
    "webhookId": 123,
    "events": ["issues", "pull_request"]
  }
}`;

  try {
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt,
      temperature: 0.1,
      max_tokens: 500,
    });

    const parsed = WebhookIntentSchema.parse(JSON.parse(response));
    return parsed;
  } catch (error) {
    logger.warn('Failed to analyze webhook intent:', error);
    return {
      intent: 'unclear',
      confidence: 0,
      reasoning: 'Failed to parse intent',
    };
  }
}

export const createWebhookAction: Action = {
  name: 'CREATE_GITHUB_WEBHOOK',
  similes: ['SETUP_WEBHOOK', 'ADD_WEBHOOK', 'CONFIGURE_WEBHOOK'],
  description: 'Create a GitHub webhook for real-time event processing using Ngrok tunnel', // Disabled by default - webhook creation is an infrastructure change

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Create a webhook for owner/repo to listen for issues and pull requests',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll create a webhook for the repository with the appropriate events configured.",
          actions: ['CREATE_GITHUB_WEBHOOK'],
        },
      },
    ],
  ],

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    // Use LLM to determine if this is a webhook creation request
    const intent = await analyzeWebhookIntent(
      runtime,
      message,
      state || { values: {}, data: {}, text: '' }
    );
    return intent.intent === 'create_webhook' && intent.confidence > 0.7;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state: State = { values: {}, data: {}, text: '' },
    _options: any = {},
    callback: HandlerCallback = async () => []
  ): Promise<void> {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      const tunnelService = runtime.getService('tunnel') as any;

      if (!githubService) {
        throw new Error('GitHub service is not available');
      }

      if (!tunnelService || !tunnelService.isActive()) {
        throw new Error(
          'Ngrok tunnel service is not available. Please start the tunnel service first.'
        );
      }

      // Analyze the request using LLM
      const intent = await analyzeWebhookIntent(
        runtime,
        message,
        state || { values: {}, data: {}, text: '' }
      );

      if (intent.intent !== 'create_webhook') {
        await callback({
          text: "I understand you want to work with webhooks, but I'm not sure exactly what you want to create. Could you be more specific?",
          thought: `Intent analysis: ${intent.reasoning}`,
        });
        return;
      }

      // Extract parameters with fallbacks from state
      let owner = intent.parameters?.owner;
      let repo = intent.parameters?.repo;

      if (!owner || !repo) {
        // Try to get from current state
        if (state.github?.lastRepository) {
          owner = owner || state.data?.github?.lastRepository?.owner?.login;
          repo = repo || state.data?.github?.lastRepository?.name;
        } else {
          // Use LLM to ask for clarification
          const clarificationPrompt = `The user wants to create a webhook but didn't specify the repository clearly. 
          
Message: "${message.content.text}"

Please extract or ask for the missing information. If you can reasonably infer the repository, provide it. If not, ask for clarification.

Format as JSON:
{
  "needsClarification": true/false,
  "clarificationMessage": "What repository would you like...",
  "inferredOwner": "possible_owner",
  "inferredRepo": "possible_repo"
}`;

          const clarificationResponse = await runtime.useModel(ModelType.TEXT_LARGE, {
            prompt: clarificationPrompt,
            temperature: 0.3,
            max_tokens: 200,
          });

          const clarification = JSON.parse(clarificationResponse);

          if (clarification.needsClarification) {
            await callback({
              text: clarification.clarificationMessage,
              thought: 'Need repository clarification for webhook creation',
            });
            return;
          }

          owner = clarification.inferredOwner;
          repo = clarification.inferredRepo;
        }
      }

      if (!owner || !repo) {
        await callback({
          text: 'I need to know which repository you want to create a webhook for. Please specify the owner and repository name.',
          thought: 'Missing repository information',
        });
        return;
      }

      // Get tunnel URL
      const tunnelUrl = await tunnelService.getUrl();
      const webhookUrl = `${tunnelUrl}/api/github/webhook`;

      // Get webhook secret
      const webhookSecret = runtime.getSetting('GITHUB_WEBHOOK_SECRET');
      if (!webhookSecret) {
        logger.warn(
          'No webhook secret configured - webhook will be created without signature verification'
        );
      }

      // Default events or use specified events
      const events = intent.parameters?.events || [
        'issues',
        'issue_comment',
        'pull_request',
        'pull_request_review',
        'push',
      ];

      // Create the webhook
      const webhook = await githubService.createWebhook(
        owner,
        repo,
        {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
        },
        events
      );

      // Test the webhook
      await githubService.pingWebhook(owner!, repo!, webhook.id);

      await callback({
        text: `✅ Successfully created webhook for ${owner}/${repo}!

**Webhook Details:**
- ID: ${webhook.id}
- URL: ${webhookUrl}
- Events: ${events.join(', ')}
- Secret: ${webhookSecret ? 'Configured ✅' : 'Not configured ⚠️'}

The webhook has been tested with a ping and is ready to receive events.`,
        thought: `Created webhook ${webhook.id} for ${owner}/${repo}`,
        actions: ['CREATE_GITHUB_WEBHOOK'],
      });

      // Update state
      if (!state.data?.github) {
        if (!state.data) {
          state!.data = {};
        }
        state!.data.github = {};
      }
      state!.data.github.lastWebhook = {
        id: webhook.id,
        owner,
        repo,
        url: webhookUrl,
        events,
      };
    } catch (error) {
      logger.error('Failed to create GitHub webhook:', error);
      await callback({
        text: `❌ Failed to create webhook: ${error instanceof Error ? error.message : String(error)}

Common issues:
- Make sure you have admin access to the repository
- Verify your GitHub token has webhook permissions
- Check that the Ngrok tunnel is active`,
        thought: 'Error creating webhook',
      });
    }
  },
};

export const listWebhooksAction: Action = {
  name: 'LIST_GITHUB_WEBHOOKS',
  similes: ['SHOW_WEBHOOKS', 'GET_WEBHOOKS', 'VIEW_WEBHOOKS'],
  description: 'List all webhooks configured for a GitHub repository',

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'List webhooks for owner/repo',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll show you all the webhooks configured for that repository.",
          actions: ['LIST_GITHUB_WEBHOOKS'],
        },
      },
    ],
  ],

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const intent = await analyzeWebhookIntent(
      runtime,
      message,
      state || { values: {}, data: {}, text: '' }
    );
    return intent.intent === 'list_webhooks' && intent.confidence > 0.7;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state: State = { values: {}, data: {}, text: '' },
    _options: any = {},
    callback: HandlerCallback = async () => []
  ): Promise<void> {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service is not available');
      }

      const intent = await analyzeWebhookIntent(
        runtime,
        message,
        state || { values: {}, data: {}, text: '' }
      );

      let owner = intent.parameters?.owner;
      let repo = intent.parameters?.repo;

      // Try to get from state if not specified
      if (!owner || !repo) {
        if (state.github?.lastRepository) {
          owner = owner || state.data?.github?.lastRepository?.owner?.login;
          repo = repo || state.data?.github?.lastRepository?.name;
        } else {
          await callback({
            text: 'I need to know which repository you want to list webhooks for. Please specify the owner and repository name.',
            thought: 'Missing repository information',
          });
          return;
        }
      }

      const webhooks = await githubService.listWebhooks(owner!, repo!);

      if (webhooks.length === 0) {
        await callback({
          text: `No webhooks found for ${owner}/${repo}.`,
          thought: `No webhooks in ${owner}/${repo}`,
        });
        return;
      }

      let responseText = `**Webhooks for ${owner}/${repo}:**\n\n`;

      webhooks.forEach((webhook, index) => {
        responseText += `**${index + 1}. Webhook #${webhook.id}**\n`;
        responseText += `- URL: ${webhook.config.url}\n`;
        responseText += `- Events: ${webhook.events.join(', ')}\n`;
        responseText += `- Active: ${webhook.active ? '✅' : '❌'}\n`;
        responseText += `- Last Response: ${webhook.last_response?.code || 'N/A'}\n`;
        responseText += `- Created: ${new Date(webhook.created_at).toLocaleDateString()}\n\n`;
      });

      await callback({
        text: responseText,
        thought: `Listed ${webhooks.length} webhooks for ${owner}/${repo}`,
        actions: ['LIST_GITHUB_WEBHOOKS'],
      });

      // Update state
      if (!state.data?.github) {
        if (!state.data) {
          state!.data = {};
        }
        state!.data.github = {};
      }
      state!.data.github.lastWebhooks = webhooks;
    } catch (error) {
      logger.error('Failed to list GitHub webhooks:', error);
      await callback({
        text: `❌ Failed to list webhooks: ${error instanceof Error ? error.message : String(error)}`,
        thought: 'Error listing webhooks',
      });
    }
  },
};

export const deleteWebhookAction: Action = {
  name: 'DELETE_GITHUB_WEBHOOK',
  similes: ['REMOVE_WEBHOOK', 'DESTROY_WEBHOOK'],
  description: 'Delete a specific GitHub webhook from a repository', // Disabled by default - webhook deletion is an infrastructure change

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Delete webhook 12345 from owner/repo',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll delete that webhook from the repository.",
          actions: ['DELETE_GITHUB_WEBHOOK'],
        },
      },
    ],
  ],

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const intent = await analyzeWebhookIntent(
      runtime,
      message,
      state || { values: {}, data: {}, text: '' }
    );
    return intent.intent === 'delete_webhook' && intent.confidence > 0.7;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state: State = { values: {}, data: {}, text: '' },
    _options: any = {},
    callback: HandlerCallback = async () => []
  ): Promise<void> {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service is not available');
      }

      const intent = await analyzeWebhookIntent(
        runtime,
        message,
        state || { values: {}, data: {}, text: '' }
      );

      let owner = intent.parameters?.owner;
      let repo = intent.parameters?.repo;
      const webhookId = intent.parameters?.webhookId;

      if (!webhookId) {
        await callback({
          text: 'I need the webhook ID to delete. Please specify which webhook you want to delete (e.g., "delete webhook 12345").',
          thought: 'Missing webhook ID',
        });
        return;
      }

      // Try to get repository from state if not specified
      if (!owner || !repo) {
        if (state.github?.lastRepository) {
          owner = owner || state.data?.github?.lastRepository?.owner?.login;
          repo = repo || state.data?.github?.lastRepository?.name;
        } else {
          await callback({
            text: 'I need to know which repository the webhook belongs to. Please specify the owner and repository name.',
            thought: 'Missing repository information',
          });
          return;
        }
      }

      // Verify webhook exists first
      const webhooks = await githubService.listWebhooks(owner!, repo!);
      const webhook = webhooks.find((w) => w.id === webhookId);

      if (!webhook) {
        await callback({
          text: `❌ Webhook #${webhookId} not found in ${owner}/${repo}. 

Available webhooks: ${webhooks.map((w) => `#${w.id}`).join(', ') || 'None'}`,
          thought: `Webhook ${webhookId} not found`,
        });
        return;
      }

      // Delete the webhook
      await githubService.deleteWebhook(owner!, repo!, webhookId);

      await callback({
        text: `✅ Successfully deleted webhook #${webhookId} from ${owner}/${repo}.

**Deleted webhook details:**
- URL: ${webhook.config.url}
- Events: ${webhook.events.join(', ')}`,
        thought: `Deleted webhook ${webhookId} from ${owner}/${repo}`,
        actions: ['DELETE_GITHUB_WEBHOOK'],
      });
    } catch (error) {
      logger.error('Failed to delete GitHub webhook:', error);
      await callback({
        text: `❌ Failed to delete webhook: ${error instanceof Error ? error.message : String(error)}`,
        thought: 'Error deleting webhook',
      });
    }
  },
};

export const pingWebhookAction: Action = {
  name: 'PING_GITHUB_WEBHOOK',
  similes: ['TEST_WEBHOOK', 'CHECK_WEBHOOK'],
  description: 'Send a ping to test a GitHub webhook',

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Ping webhook 12345 on owner/repo',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll send a test ping to that webhook.",
          actions: ['PING_GITHUB_WEBHOOK'],
        },
      },
    ],
  ],

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const intent = await analyzeWebhookIntent(
      runtime,
      message,
      state || { values: {}, data: {}, text: '' }
    );
    return intent.intent === 'ping_webhook' && intent.confidence > 0.7;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state: State = { values: {}, data: {}, text: '' },
    _options: any = {},
    callback: HandlerCallback = async () => []
  ): Promise<void> {
    try {
      const githubService = runtime.getService<GitHubService>('github');
      if (!githubService) {
        throw new Error('GitHub service is not available');
      }

      const intent = await analyzeWebhookIntent(
        runtime,
        message,
        state || { values: {}, data: {}, text: '' }
      );

      let owner = intent.parameters?.owner;
      let repo = intent.parameters?.repo;
      const webhookId = intent.parameters?.webhookId;

      if (!webhookId) {
        await callback({
          text: 'I need the webhook ID to ping. Please specify which webhook you want to test (e.g., "ping webhook 12345").',
          thought: 'Missing webhook ID',
        });
        return;
      }

      // Try to get repository from state if not specified
      if (!owner || !repo) {
        if (state.github?.lastRepository) {
          owner = owner || state.data?.github?.lastRepository?.owner?.login;
          repo = repo || state.data?.github?.lastRepository?.name;
        } else {
          await callback({
            text: 'I need to know which repository the webhook belongs to. Please specify the owner and repository name.',
            thought: 'Missing repository information',
          });
          return;
        }
      }

      // Ping the webhook
      await githubService.pingWebhook(owner!, repo!, webhookId);

      await callback({
        text: `✅ Successfully sent ping to webhook #${webhookId} on ${owner}/${repo}.

The webhook should receive a test payload. Check your webhook endpoint logs or GitHub's webhook delivery logs to verify it was received.`,
        thought: `Pinged webhook ${webhookId} on ${owner}/${repo}`,
        actions: ['PING_GITHUB_WEBHOOK'],
      });
    } catch (error) {
      logger.error('Failed to ping GitHub webhook:', error);
      await callback({
        text: `❌ Failed to ping webhook: ${error instanceof Error ? error.message : String(error)}

Common issues:
- Webhook ID doesn't exist
- Network connectivity problems
- GitHub API rate limits`,
        thought: 'Error pinging webhook',
      });
    }
  },
};
