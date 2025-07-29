/**
 * OpenAI-compatible chat completions API
 */

import { Hono, type Context } from 'hono';
import { stream } from 'hono/streaming';
import {
  streamText,
  type CoreMessage,
  type CoreTool,
  type CoreToolChoice,
} from 'ai';
import type {
  APIServiceConfig,
  CompletionRequest,
  HonoVariables,
} from '../types/index.js';
import type { MultiProviderManager } from '../providers/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { usageMiddleware } from '../middleware/usage.js';
import { validateRequest } from '../utils/validation.js';

type AppContext = Context<{ Variables: HonoVariables }>;

export function completionsRoutes(
  config: APIServiceConfig,
  providerManager: MultiProviderManager
) {
  const app = new Hono();

  // Apply authentication and usage tracking
  app.use('*', authMiddleware(config));
  app.use('*', usageMiddleware());

  /**
   * POST /v1/chat/completions
   * OpenAI-compatible chat completions endpoint
   */
  app.post('/completions', async (c: AppContext) => {
    try {
      const request = await c.req.json<CompletionRequest>();

      // Get auth data from context
      const user = c.get('user') as
        | { id: string; organizationId?: string }
        | undefined;
      const apiKey = c.get('apiKey') as
        | { id: string; permissions: string[] }
        | undefined;
      const organization = c.get('organization') as
        | {
            id: string;
            subscriptionTier: string;
            limits: {
              maxApiRequests: number;
              maxTokensPerRequest: number;
              allowedModels: string[];
              allowedProviders: string[];
            };
          }
        | undefined;

      // Validate request
      const validation = validateRequest.chatCompletion(request);
      if (!validation.success) {
        return c.json(
          {
            error: {
              message: validation.error?.message || 'Invalid request',
              type: 'invalid_request_error',
              param: validation.error?.path?.[0],
            },
          },
          400
        );
      }

      // Check if model is available
      const modelConfig = providerManager.getModelConfig(request.model);
      if (!modelConfig) {
        return c.json(
          {
            error: {
              message: `Model '${request.model}' not found`,
              type: 'invalid_request_error',
              param: 'model',
            },
          },
          404
        );
      }

      // Check organization limits
      if (organization) {
        const limits = organization.limits;

        if (
          limits.allowedModels.length > 0 &&
          !limits.allowedModels.includes(request.model)
        ) {
          return c.json(
            {
              error: {
                message: `Model '${request.model}' not allowed for your organization`,
                type: 'permission_error',
                code: 'model_not_allowed',
              },
            },
            403
          );
        }

        if (
          limits.allowedProviders.length > 0 &&
          !limits.allowedProviders.includes(modelConfig.provider)
        ) {
          return c.json(
            {
              error: {
                message: `Provider '${modelConfig.provider}' not allowed for your organization`,
                type: 'permission_error',
                code: 'provider_not_allowed',
              },
            },
            403
          );
        }

        if (
          request.max_tokens &&
          request.max_tokens > limits.maxTokensPerRequest
        ) {
          return c.json(
            {
              error: {
                message: `Requested tokens (${request.max_tokens}) exceeds limit (${limits.maxTokensPerRequest})`,
                type: 'invalid_request_error',
                param: 'max_tokens',
              },
            },
            400
          );
        }
      }

      // Handle streaming vs non-streaming
      if (request.stream) {
        return handleStreamingCompletion(
          c,
          request,
          providerManager,
          user,
          apiKey
        );
      } else {
        return handleNonStreamingCompletion(
          c,
          request,
          providerManager,
          user,
          apiKey
        );
      }
    } catch (error) {
      console.error('Chat completion error:', error);

      // Handle specific provider errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          return c.json(
            {
              error: {
                message: 'Rate limit exceeded',
                type: 'rate_limit_error',
                code: 'rate_limit_exceeded',
              },
            },
            429
          );
        }

        if (error.message.includes('quota')) {
          return c.json(
            {
              error: {
                message: 'Quota exceeded',
                type: 'quota_error',
                code: 'quota_exceeded',
              },
            },
            429
          );
        }

        if (error.message.includes('context_length')) {
          return c.json(
            {
              error: {
                message: 'Request too long',
                type: 'invalid_request_error',
                param: 'messages',
                code: 'context_length_exceeded',
              },
            },
            400
          );
        }
      }

      return c.json(
        {
          error: {
            message: 'Internal server error',
            type: 'server_error',
            code: 'internal_error',
          },
        },
        500
      );
    }
  });

  // Embeddings endpoint (if needed)
  app.post('/embeddings', async (c: AppContext) => {
    return c.json(
      {
        error: {
          message: 'Embeddings endpoint not yet implemented',
          type: 'not_implemented',
        },
      },
      501
    );
  });

  return app;
}

async function handleNonStreamingCompletion(
  c: AppContext,
  request: CompletionRequest,
  providerManager: MultiProviderManager,
  user?: { id: string; organizationId?: string },
  apiKey?: { id: string; permissions: string[] }
) {
  const startTime = Date.now();

  const response = await providerManager.generateCompletion(request);

  // Apply markup to costs
  if (response.usage) {
    const markup = 10; // 10% markup
    response.usage.prompt_cost = providerManager.calculateCostWithMarkup(
      response.usage.prompt_cost,
      markup
    );
    response.usage.completion_cost = providerManager.calculateCostWithMarkup(
      response.usage.completion_cost,
      markup
    );
    response.usage.total_cost =
      response.usage.prompt_cost + response.usage.completion_cost;
  }

  // Record usage for billing
  if (user?.organizationId && response.usage) {
    await providerManager.recordUsage(
      user.organizationId,
      request.model,
      response.usage,
      response.usage.total_cost,
      {
        userId: user.id,
        apiKeyId: apiKey?.id,
        requestId: response.id,
        processingTime: Date.now() - startTime,
      }
    );
  }

  // Set rate limit headers
  c.header('X-RateLimit-Limit', '1000');
  c.header('X-RateLimit-Remaining', '999');
  c.header('X-RateLimit-Reset', Math.floor(Date.now() / 1000 + 60).toString());

  return c.json(response);
}

async function handleStreamingCompletion(
  c: AppContext,
  request: CompletionRequest,
  providerManager: MultiProviderManager,
  user?: { id: string; organizationId?: string },
  apiKey?: { id: string; permissions: string[] }
) {
  const startTime = Date.now();

  return stream(c, async (stream) => {
    try {
      const modelConfig = providerManager.getModelConfig(request.model);
      if (!modelConfig) {
        throw new Error(`Model config not found for ${request.model}`);
      }

      const providerInfo = providerManager.getProviderForModel(request.model);
      if (!providerInfo) {
        throw new Error(`Provider not found for ${request.model}`);
      }
      const { provider } = providerInfo;

      // Convert messages format - properly typed
      const messages: CoreMessage[] = request.messages.map((msg) => {
        if (msg.role === 'system') {
          // System messages only support string content
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : msg.content
                  .map((c) => (c.type === 'text' ? c.text : '[image]'))
                  .join(' ');

          return {
            role: 'system' as const,
            content,
          };
        } else if (msg.role === 'user') {
          return {
            role: 'user' as const,
            content:
              typeof msg.content === 'string'
                ? msg.content
                : msg.content.map((c) => {
                    if (c.type === 'text') {
                      if (!c.text)
                        throw new Error('Text content missing text field');
                      return { type: 'text' as const, text: c.text };
                    } else {
                      if (!c.image_url?.url)
                        throw new Error(
                          'Image content missing image_url.url field'
                        );
                      return {
                        type: 'image' as const,
                        image: new URL(c.image_url.url),
                      };
                    }
                  }),
          };
        } else if (msg.role === 'assistant') {
          // Assistant messages only support string content or tool calls
          if (typeof msg.content === 'string') {
            return {
              role: 'assistant' as const,
              content: msg.content,
              toolCalls: msg.tool_calls?.map((tc) => ({
                toolCallId: tc.id,
                toolName: tc.function.name,
                args: JSON.parse(tc.function.arguments),
              })),
            };
          } else {
            // Convert content array to string for assistant messages
            const content = msg.content
              .map((c) => (c.type === 'text' ? c.text : '[image]'))
              .join(' ');
            return {
              role: 'assistant' as const,
              content,
              toolCalls: msg.tool_calls?.map((tc) => ({
                toolCallId: tc.id,
                toolName: tc.function.name,
                args: JSON.parse(tc.function.arguments),
              })),
            };
          }
        } else {
          // tool role
          if (!msg.tool_call_id) {
            throw new Error('Tool message missing tool_call_id');
          }
          return {
            role: 'tool' as const,
            content: [
              {
                type: 'tool-result' as const,
                toolCallId: msg.tool_call_id,
                toolName: msg.name || '',
                result:
                  typeof msg.content === 'string'
                    ? msg.content
                    : JSON.stringify(msg.content),
              },
            ],
          };
        }
      });

      // Convert tools and tool choice
      let tools: Record<string, CoreTool> | undefined;
      let toolChoice: CoreToolChoice<Record<string, CoreTool>> | undefined;

      if (request.tools) {
        tools = providerManager.convertTools(request.tools);
      }

      if (request.tool_choice) {
        if (typeof request.tool_choice === 'string') {
          toolChoice = request.tool_choice as 'none' | 'auto' | 'required';
        } else if (
          typeof request.tool_choice === 'object' &&
          'function' in request.tool_choice &&
          request.tool_choice.function
        ) {
          const toolChoiceObj = request.tool_choice as {
            type?: string;
            function?: { name?: string };
          };
          const functionName = toolChoiceObj.function?.name;
          if (functionName && typeof functionName === 'string') {
            toolChoice = {
              type: 'tool' as const,
              toolName: functionName,
            };
          }
        }
      }

      // Build options object with only defined values
      const streamOptions: Parameters<typeof streamText>[0] = {
        model: provider(request.model),
        messages,
      };

      if (request.max_tokens !== undefined) {
        streamOptions.maxTokens = request.max_tokens;
      }
      if (request.temperature !== undefined) {
        streamOptions.temperature = request.temperature;
      }
      if (request.top_p !== undefined) {
        streamOptions.topP = request.top_p;
      }
      if (request.frequency_penalty !== undefined) {
        streamOptions.frequencyPenalty = request.frequency_penalty;
      }
      if (request.presence_penalty !== undefined) {
        streamOptions.presencePenalty = request.presence_penalty;
      }
      if (request.stop !== undefined) {
        streamOptions.stopSequences =
          typeof request.stop === 'string' ? [request.stop] : request.stop;
      }
      if (tools !== undefined) {
        streamOptions.tools = tools;
      }
      if (toolChoice !== undefined) {
        streamOptions.toolChoice = toolChoice;
      }

      const result = await streamText(streamOptions);

      let totalCost = 0;

      // Stream the response
      for await (const chunk of result.textStream) {
        const streamChunk = {
          id: crypto.randomUUID(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          provider: modelConfig.provider,
          choices: [
            {
              index: 0,
              delta: { content: chunk },
              finish_reason: null,
            },
          ],
        };

        await stream.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
      }

      // Final chunk with usage info
      const usage = await result.usage;
      const inputCost = usage.promptTokens * modelConfig.inputCostPerToken;
      const outputCost =
        usage.completionTokens * modelConfig.outputCostPerToken;
      totalCost = providerManager.calculateCostWithMarkup(
        inputCost + outputCost
      );

      const finalChunk = {
        id: crypto.randomUUID(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        provider: modelConfig.provider,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
          prompt_cost: providerManager.calculateCostWithMarkup(inputCost),
          completion_cost: providerManager.calculateCostWithMarkup(outputCost),
          total_cost: totalCost,
        },
      };

      await stream.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      await stream.write('data: [DONE]\n\n');

      // Record usage for billing
      if (user?.organizationId) {
        await providerManager.recordUsage(
          user.organizationId,
          request.model,
          finalChunk.usage,
          totalCost,
          {
            userId: user.id,
            apiKeyId: apiKey?.id,
            streaming: true,
            processingTime: Date.now() - startTime,
          }
        );
      }
    } catch (error) {
      console.error('Streaming completion error:', error);

      const errorChunk = {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'server_error',
        },
      };

      await stream.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
      await stream.write('data: [DONE]\n\n');
    }
  });
}
