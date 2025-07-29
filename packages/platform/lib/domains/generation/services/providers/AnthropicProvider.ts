/**
 * Anthropic Generation Provider
 * Handles text and code generation via Anthropic's Claude API
 */

import {
  GenerationRequest,
  GenerationType,
  GenerationProvider,
  TextGenerationRequest,
  CodeGenerationRequest,
} from '../../types';
import {
  BaseGenerationProvider,
  ProviderGenerationResult,
  ProviderConfig,
  ProviderCapabilities,
} from './BaseGenerationProvider';

interface AnthropicConfig extends ProviderConfig {
  version?: string;
}

export class AnthropicProvider extends BaseGenerationProvider {
  private client: any;

  constructor(config?: AnthropicConfig) {
    super(
      {
        apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY || '',
        baseUrl: config?.baseUrl || 'https://api.anthropic.com',
        timeout: config?.timeout || 60000,
        retryAttempts: config?.retryAttempts || 3,
        rateLimitPerSecond: config?.rateLimitPerSecond || 5,
      },
      GenerationProvider.ANTHROPIC,
    );

    this.initializeClient(config);
  }

  private initializeClient(config?: AnthropicConfig): void {
    this.client = {
      messages: {
        create: this.mockMessageGeneration.bind(this),
      },
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedTypes: [GenerationType.TEXT, GenerationType.CODE],
      maxPromptLength: 200000, // Claude has large context window
      maxOutputs: 1,
      supportsBatch: false,
      supportsCancel: false,
      supportsProgress: false,
      qualityLevels: ['haiku', 'sonnet', 'opus'],
      outputFormats: {
        [GenerationType.TEXT]: ['text', 'markdown'],
        [GenerationType.CODE]: ['text'],
        [GenerationType.IMAGE]: [],
        [GenerationType.VIDEO]: [],
        [GenerationType.AUDIO]: [],
        [GenerationType.THREE_D]: [],
        [GenerationType.AVATAR]: [],
        [GenerationType.MUSIC]: [],
        [GenerationType.SPEECH]: [],
        [GenerationType.DOCUMENT]: ['text', 'markdown'],
      },
    };
  }

  async generate(
    request: GenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    await this.rateLimitDelay();

    switch (request.type) {
      case GenerationType.TEXT:
        return this.generateText(request as TextGenerationRequest);
      case GenerationType.CODE:
        return this.generateCode(request as CodeGenerationRequest);
      default:
        throw new Error(
          `Generation type ${request.type} not supported by Anthropic provider`,
        );
    }
  }

  private async generateText(
    request: TextGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    try {
      const messages = [
        ...(request.context || []),
        { role: 'user', content: request.prompt },
      ];

      if (request.system_prompt) {
        messages.unshift({ role: 'system', content: request.system_prompt });
      }

      const response = await this.withRetry(async () => {
        return await this.client.messages.create({
          model: request.model || 'claude-3-sonnet-20240229',
          max_tokens: request.max_tokens || 4000,
          temperature: request.temperature || 0.7,
          messages: messages.filter((m) => m.role !== 'system'),
          system: request.system_prompt,
        });
      });

      const content = response.content[0].text;
      const tokens = this.estimateTokens(request.prompt + content);

      const output = {
        id: this.generateOutputId(),
        url: '',
        format: 'text',
        size: content.length,
        metadata: {
          content,
          model: response.model,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
            total_tokens:
              response.usage.input_tokens + response.usage.output_tokens,
          },
          stop_reason: response.stop_reason,
        },
      };

      return {
        outputs: [output],
        cost: this.calculateTextCost(response.usage),
        credits_used: Math.ceil(response.usage.output_tokens / 1000),
        metadata: {
          model: response.model,
          usage: response.usage,
        },
      };
    } catch (error) {
      throw this.handleProviderError(error);
    }
  }

  private async generateCode(
    request: CodeGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const systemPrompt = `You are an expert ${request.language} developer. Generate clean, well-documented, and production-ready code.

${request.framework ? `Use ${request.framework} framework.` : ''}
${request.style_guide ? `Follow this style guide: ${request.style_guide}` : ''}
${request.test_requirements ? 'Include comprehensive tests.' : ''}
${request.documentation ? 'Include detailed documentation and comments.' : ''}

Requirements:
${request.requirements?.map((req) => `- ${req}`).join('\n') || ''}

Return only the code with minimal explanation.`;

    const textRequest: TextGenerationRequest = {
      ...request,
      type: GenerationType.TEXT,
      system_prompt: systemPrompt,
      temperature: 0.1, // Lower temperature for code
      max_tokens: 8000,
    };

    return this.generateText(textRequest);
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    const estimatedTokens = this.estimateTokens(request.prompt);

    if (request.type === GenerationType.TEXT) {
      const textReq = request as TextGenerationRequest;
      const outputTokens = textReq.max_tokens || 4000;
      return this.estimateTextCost(estimatedTokens + outputTokens);
    }

    return 0.01;
  }

  protected async performHealthCheck(): Promise<void> {
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }],
      });
    } catch (error) {
      throw new Error(`Anthropic health check failed: ${error}`);
    }
  }

  // Helper methods

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private calculateTextCost(usage: any): number {
    // Anthropic pricing (example rates)
    const inputCostPer1k = 0.003;
    const outputCostPer1k = 0.015;

    return (
      (usage.input_tokens / 1000) * inputCostPer1k +
      (usage.output_tokens / 1000) * outputCostPer1k
    );
  }

  private estimateTextCost(totalTokens: number): number {
    return (totalTokens / 1000) * 0.009; // Average cost
  }

  // Mock method
  private async mockMessageGeneration(params: any): Promise<any> {
    const inputText = params.messages[params.messages.length - 1].content;
    const mockResponse = `Generated response for: ${inputText}`;

    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: params.model,
      content: [{ type: 'text', text: mockResponse }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: Math.ceil(inputText.length / 4),
        output_tokens: Math.ceil(mockResponse.length / 4),
      },
    };
  }
}
