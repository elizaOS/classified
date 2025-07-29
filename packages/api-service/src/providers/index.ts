/**
 * Multi-provider AI inference manager
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
// import { xai } from '@ai-sdk/xai'; // Package not available
import {
  generateText,
  embed,
  type CoreMessage,
  type CoreTool,
  type CoreToolChoice,
  type LanguageModelV1,
  type EmbeddingModel,
} from 'ai';
import type {
  APIServiceConfig,
  ModelConfig,
  CompletionRequest,
  CompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  UsageRecord,
  Usage,
  Tool,
} from '../types/index.js';
import type { UsageMetadata } from '../database/schema.js';

// Type for provider instance (AI SDK provider instances)
type ProviderInstance =
  | ReturnType<typeof createOpenAI>
  | ReturnType<typeof createAnthropic>
  | ReturnType<typeof createGoogleGenerativeAI>;

// Type for provider function that creates model instances
type ProviderFunction = (modelId: string) => LanguageModelV1;

// Type for embedding provider function
type EmbeddingProviderFunction = (modelId: string) => EmbeddingModel<string>;

export class MultiProviderManager {
  private config: APIServiceConfig;
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private providers: Map<string, ProviderInstance> = new Map();

  constructor(config: APIServiceConfig) {
    this.config = config;
    this.initializeProviders();
    this.initializeModelConfigs();
  }

  private initializeProviders(): void {
    // Initialize OpenAI
    if (this.config.providers.openai.enabled) {
      this.providers.set(
        'openai',
        createOpenAI({
          apiKey: this.config.providers.openai.apiKey,
          baseURL: this.config.providers.openai.baseURL,
        })
      );
    }

    // Initialize Anthropic
    if (this.config.providers.anthropic.enabled) {
      this.providers.set(
        'anthropic',
        createAnthropic({
          apiKey: this.config.providers.anthropic.apiKey,
          baseURL: this.config.providers.anthropic.baseURL,
        })
      );
    }

    // Initialize Google
    if (this.config.providers.google.enabled) {
      this.providers.set(
        'google',
        createGoogleGenerativeAI({
          apiKey: this.config.providers.google.apiKey,
          baseURL: this.config.providers.google.baseURL,
        })
      );
    }

    // Initialize xAI (disabled - package not available)
    // if (this.config.providers.xai.enabled) {
    //   this.providers.set('xai', {
    //     provider: xai,
    //     config: this.config.providers.xai,
    //   });
    // }

    console.log(`✅ Initialized ${this.providers.size} AI providers`);
  }

  private initializeModelConfigs(): void {
    // OpenAI models
    if (this.providers.has('openai')) {
      this.addModelConfig({
        id: 'gpt-4o',
        provider: 'openai',
        name: 'GPT-4o',
        inputCostPerToken: 0.0000025,
        outputCostPerToken: 0.00001,
        maxTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        capabilities: ['text', 'vision', 'tools'],
        description:
          'Most advanced OpenAI model with vision and tool capabilities',
      });

      this.addModelConfig({
        id: 'gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-4o Mini',
        inputCostPerToken: 0.00000015,
        outputCostPerToken: 0.0000006,
        maxTokens: 128000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        capabilities: ['text', 'vision', 'tools'],
        description: 'Faster, cheaper version of GPT-4o',
      });

      this.addModelConfig({
        id: 'o1-preview',
        provider: 'openai',
        name: 'o1-preview',
        inputCostPerToken: 0.000015,
        outputCostPerToken: 0.00006,
        maxTokens: 128000,
        supportsStreaming: false,
        supportsTools: false,
        supportsVision: false,
        capabilities: ['text', 'reasoning'],
        description: 'Advanced reasoning model for complex problems',
      });

      this.addModelConfig({
        id: 'o1-mini',
        provider: 'openai',
        name: 'o1-mini',
        inputCostPerToken: 0.000003,
        outputCostPerToken: 0.000012,
        maxTokens: 128000,
        supportsStreaming: false,
        supportsTools: false,
        supportsVision: false,
        capabilities: ['text', 'reasoning'],
        description: 'Faster reasoning model for coding and math',
      });
    }

    // Anthropic models
    if (this.providers.has('anthropic')) {
      this.addModelConfig({
        id: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        name: 'Claude 3.5 Sonnet',
        inputCostPerToken: 0.000003,
        outputCostPerToken: 0.000015,
        maxTokens: 200000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        capabilities: ['text', 'vision', 'tools'],
        description: 'Most intelligent Claude model',
      });

      this.addModelConfig({
        id: 'claude-3-5-haiku-20241022',
        provider: 'anthropic',
        name: 'Claude 3.5 Haiku',
        inputCostPerToken: 0.00000025,
        outputCostPerToken: 0.00000125,
        maxTokens: 200000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: false,
        capabilities: ['text', 'tools'],
        description: 'Fastest Claude model',
      });

      this.addModelConfig({
        id: 'claude-3-opus-20240229',
        provider: 'anthropic',
        name: 'Claude 3 Opus',
        inputCostPerToken: 0.000015,
        outputCostPerToken: 0.000075,
        maxTokens: 200000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        capabilities: ['text', 'vision', 'tools'],
        description: 'Most powerful Claude model for complex tasks',
      });
    }

    // Google models
    if (this.providers.has('google')) {
      this.addModelConfig({
        id: 'gemini-1.5-pro',
        provider: 'google',
        name: 'Gemini 1.5 Pro',
        inputCostPerToken: 0.00000125,
        outputCostPerToken: 0.000005,
        maxTokens: 2000000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        capabilities: ['text', 'vision', 'tools'],
        description: 'Advanced Gemini model with huge context window',
      });

      this.addModelConfig({
        id: 'gemini-1.5-flash',
        provider: 'google',
        name: 'Gemini 1.5 Flash',
        inputCostPerToken: 0.000000075,
        outputCostPerToken: 0.0000003,
        maxTokens: 1000000,
        supportsStreaming: true,
        supportsTools: true,
        supportsVision: true,
        capabilities: ['text', 'vision', 'tools'],
        description: 'Fast and efficient Gemini model',
      });
    }

    // xAI models (disabled - package not available)
    // if (this.providers.has('xai')) {
    //   this.addModelConfig({
    //     id: 'grok-beta',
    //     provider: 'xai',
    //     name: 'Grok Beta',
    //     inputCostPerToken: 0.000005,
    //     outputCostPerToken: 0.000015,
    //     maxTokens: 131072,
    //     supportsStreaming: true,
    //     supportsTools: false,
    //     supportsVision: false,
    //     capabilities: ['text'],
    //     description: 'xAI\'s conversational AI model',
    //   });
    // }

    // Embedding models
    if (this.providers.has('openai')) {
      this.addModelConfig({
        id: 'text-embedding-3-large',
        provider: 'openai',
        name: 'Text Embedding 3 Large',
        inputCostPerToken: 0.00000013,
        outputCostPerToken: 0,
        maxTokens: 8191,
        supportsStreaming: false,
        supportsTools: false,
        supportsVision: false,
        capabilities: ['embedding'],
        description: "OpenAI's large embedding model",
      });

      this.addModelConfig({
        id: 'text-embedding-3-small',
        provider: 'openai',
        name: 'Text Embedding 3 Small',
        inputCostPerToken: 0.00000002,
        outputCostPerToken: 0,
        maxTokens: 8191,
        supportsStreaming: false,
        supportsTools: false,
        supportsVision: false,
        capabilities: ['embedding'],
        description: "OpenAI's small embedding model",
      });
    }

    console.log(`✅ Configured ${this.modelConfigs.size} AI models`);
  }

  private addModelConfig(config: ModelConfig): void {
    this.modelConfigs.set(config.id, config);
  }

  /**
   * Get available models
   */
  getAvailableModels(): ModelConfig[] {
    return Array.from(this.modelConfigs.values());
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelId: string): ModelConfig | null {
    return this.modelConfigs.get(modelId) || null;
  }

  /**
   * Get provider for a model
   */
  getProviderForModel(
    modelId: string
  ): { provider: ProviderFunction; config: ModelConfig } | null {
    const config = this.getModelConfig(modelId);
    if (!config) {
      return null;
    }

    const providerInstance = this.providers.get(config.provider);
    if (!providerInstance) {
      return null;
    }

    return {
      provider: (modelId: string) => providerInstance(modelId),
      config,
    };
  }

  /**
   * Get embedding provider for a model
   */
  getEmbeddingProviderForModel(
    modelId: string
  ): { provider: EmbeddingProviderFunction; config: ModelConfig } | null {
    const config = this.getModelConfig(modelId);
    if (!config) {
      return null;
    }

    const providerInstance = this.providers.get(config.provider);
    if (!providerInstance) {
      return null;
    }

    // Check if provider has embedding method
    if (!('embedding' in providerInstance)) {
      throw new Error(
        `Provider ${config.provider} does not support embeddings`
      );
    }

    return {
      provider: (modelId: string) => providerInstance.embedding(modelId),
      config,
    };
  }

  /**
   * Generate completion
   */
  async generateCompletion(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const requestId = crypto.randomUUID();

    const providerInfo = this.getProviderForModel(request.model);
    if (!providerInfo) {
      throw new Error(`Model ${request.model} not available`);
    }

    const { provider, config } = providerInfo;

    try {
      // Convert our request format to Vercel AI SDK format
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

      if (request.stream) {
        // For streaming requests, return a special response that indicates streaming
        // The actual streaming is handled in the route handler
        const streamResponse: CompletionResponse & { stream: boolean } = {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          provider: config.provider,
          choices: [],
          stream: true,
        };
        return streamResponse;
      } else {
        // Handle non-streaming
        const tools = request.tools
          ? this.convertTools(request.tools)
          : undefined;
        let toolChoice: CoreToolChoice<Record<string, CoreTool>> | undefined;

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
        const generateOptions: Parameters<typeof generateText>[0] = {
          model: provider(request.model),
          messages,
        };

        if (request.max_tokens !== undefined) {
          generateOptions.maxTokens = request.max_tokens;
        }
        if (request.temperature !== undefined) {
          generateOptions.temperature = request.temperature;
        }
        if (request.top_p !== undefined) {
          generateOptions.topP = request.top_p;
        }
        if (request.frequency_penalty !== undefined) {
          generateOptions.frequencyPenalty = request.frequency_penalty;
        }
        if (request.presence_penalty !== undefined) {
          generateOptions.presencePenalty = request.presence_penalty;
        }
        if (request.stop !== undefined) {
          generateOptions.stopSequences =
            typeof request.stop === 'string' ? [request.stop] : request.stop;
        }
        if (tools !== undefined) {
          generateOptions.tools = tools;
        }
        if (toolChoice !== undefined) {
          generateOptions.toolChoice = toolChoice;
        }

        const result = await generateText(generateOptions);

        // Calculate costs
        const inputCost = result.usage.promptTokens * config.inputCostPerToken;
        const outputCost =
          result.usage.completionTokens * config.outputCostPerToken;
        const totalCost = inputCost + outputCost;

        const response: CompletionResponse = {
          id: requestId,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: request.model,
          provider: config.provider,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: result.text,
                tool_calls: result.toolCalls?.map((tc) => ({
                  id: tc.toolCallId,
                  type: 'function',
                  function: {
                    name: tc.toolName,
                    arguments: JSON.stringify(tc.args),
                  },
                })),
              },
              finish_reason:
                result.finishReason === 'stop'
                  ? 'stop'
                  : result.finishReason === 'length'
                    ? 'length'
                    : result.finishReason === 'tool-calls'
                      ? 'tool_calls'
                      : null,
            },
          ],
          usage: {
            prompt_tokens: result.usage.promptTokens,
            completion_tokens: result.usage.completionTokens,
            total_tokens: result.usage.totalTokens,
            prompt_cost: inputCost,
            completion_cost: outputCost,
            total_cost: totalCost,
          },
        };

        return response;
      }
    } catch (error) {
      console.error(`Error generating completion for ${request.model}:`, error);
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async generateEmbedding(
    request: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    const providerInfo = this.getEmbeddingProviderForModel(request.model);
    if (!providerInfo) {
      throw new Error(`Model ${request.model} not available`);
    }

    const { provider, config } = providerInfo;

    try {
      const inputs = Array.isArray(request.input)
        ? request.input
        : [request.input];
      const results = await Promise.all(
        inputs.map(async (input, index) => {
          const result = await embed({
            model: provider(request.model),
            value: input,
          });

          return {
            object: 'embedding' as const,
            index,
            embedding: result.embedding,
          };
        })
      );

      const totalTokens = inputs.reduce(
        (sum, input) => sum + this.estimateTokens(input),
        0
      );
      const totalCost = totalTokens * config.inputCostPerToken;

      return {
        object: 'list',
        data: results,
        model: request.model,
        provider: config.provider,
        usage: {
          prompt_tokens: totalTokens,
          total_tokens: totalTokens,
          total_cost: totalCost,
        },
      };
    } catch (error) {
      console.error(`Error generating embedding for ${request.model}:`, error);
      throw error;
    }
  }

  /**
   * Convert OpenAI tools format to Vercel AI SDK format
   */
  convertTools(tools: Tool[]): Record<string, CoreTool> {
    const toolsObject: Record<string, CoreTool> = {};

    tools.forEach((tool) => {
      if (tool.type === 'function') {
        toolsObject[tool.function.name] = {
          description: tool.function.description,
          parameters: tool.function.parameters,
        };
      }
    });

    return toolsObject;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate costs with markup
   */
  calculateCostWithMarkup(
    baseCost: number,
    markupPercentage: number = 10
  ): number {
    return baseCost * (1 + markupPercentage / 100);
  }

  /**
   * Record usage for billing
   */
  async recordUsage(
    organizationId: string,
    model: string,
    usage: Usage,
    cost: number,
    metadata: UsageMetadata = {}
  ): Promise<UsageRecord> {
    try {
      const { getDatabase } = await import('../database/connection.js');
      const { usageRecords } = await import('../database/schema.js');

      const db = getDatabase();
      const modelConfig = this.getModelConfig(model);

      const record = {
        organizationId,
        userId: metadata.userId || null,
        apiKeyId: metadata.apiKeyId || null,
        requestId: metadata.requestId || crypto.randomUUID(),
        model,
        provider: modelConfig?.provider || 'unknown',
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        inputCost: (usage.prompt_cost || 0).toString(),
        outputCost: (usage.completion_cost || 0).toString(),
        totalCost: cost.toString(),
        markup: (this.calculateCostWithMarkup(cost) - cost).toString(),
        finalCost: this.calculateCostWithMarkup(cost).toString(),
        processingTime: metadata.processingTime || null,
        isSuccessful: true,
        metadata,
      };

      const [insertedRecord] = await db
        .insert(usageRecords)
        .values(record)
        .returning();

      if (!insertedRecord) {
        throw new Error('Failed to insert usage record');
      }

      console.log('✅ Usage recorded to database:', {
        id: insertedRecord.id,
        model,
        cost: insertedRecord.finalCost,
        tokens: insertedRecord.inputTokens + insertedRecord.outputTokens,
      });

      // Convert database record to UsageRecord type
      return {
        id: insertedRecord.id,
        organizationId: insertedRecord.organizationId,
        userId: insertedRecord.userId ?? undefined,
        apiKeyId: insertedRecord.apiKeyId ?? undefined,
        model: insertedRecord.model,
        provider: insertedRecord.provider,
        inputTokens: insertedRecord.inputTokens,
        outputTokens: insertedRecord.outputTokens,
        inputCost: parseFloat(insertedRecord.inputCost),
        outputCost: parseFloat(insertedRecord.outputCost),
        totalCost: parseFloat(insertedRecord.totalCost),
        markup: parseFloat(insertedRecord.markup),
        finalCost: parseFloat(insertedRecord.finalCost),
        timestamp: insertedRecord.createdAt,
        requestId: insertedRecord.requestId,
        metadata: insertedRecord.metadata as UsageMetadata,
      };
    } catch (error) {
      console.error('❌ Failed to record usage to database:', error);

      // Fallback: log to console if database fails
      const fallbackRecord: UsageRecord = {
        id: crypto.randomUUID(),
        organizationId,
        userId: metadata.userId ?? undefined,
        apiKeyId: metadata.apiKeyId ?? undefined,
        model,
        provider: this.getModelConfig(model)?.provider || 'unknown',
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        inputCost: usage.prompt_cost || 0,
        outputCost: usage.completion_cost || 0,
        totalCost: cost,
        markup: this.calculateCostWithMarkup(cost) - cost,
        finalCost: this.calculateCostWithMarkup(cost),
        timestamp: new Date(),
        requestId: metadata.requestId || crypto.randomUUID(),
        metadata,
      };

      console.log('⚠️  Usage recorded to console only:', fallbackRecord);
      return fallbackRecord;
    }
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, providerInstance] of this.providers.entries()) {
      try {
        // Simple test request to check provider health
        const testModel = this.getAvailableModels().find(
          (m) => m.provider === name
        )?.id;
        if (testModel) {
          await generateText({
            model: providerInstance(testModel),
            messages: [{ role: 'user', content: 'Hello' }],
            maxTokens: 1,
          });
          health[name] = true;
        } else {
          health[name] = false;
        }
      } catch (error) {
        console.error(`Health check failed for ${name}:`, error);
        health[name] = false;
      }
    }

    return health;
  }
}
