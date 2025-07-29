/**
 * OpenAI Generation Provider
 * Handles text, image, and audio generation via OpenAI APIs
 */

import {
  GenerationRequest,
  GenerationType,
  GenerationProvider,
  TextGenerationRequest,
  ImageGenerationRequest,
  AudioGenerationRequest,
  CodeGenerationRequest,
} from '../../types';
import {
  BaseGenerationProvider,
  ProviderGenerationResult,
  ProviderConfig,
  ProviderCapabilities,
} from './BaseGenerationProvider';

interface OpenAIConfig extends ProviderConfig {
  organizationId?: string;
  model?: string;
}

export class OpenAIProvider extends BaseGenerationProvider {
  private client: any; // OpenAI client would be imported

  constructor(config?: OpenAIConfig) {
    super(
      {
        apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
        baseUrl: config?.baseUrl || 'https://api.openai.com/v1',
        timeout: config?.timeout || 60000,
        retryAttempts: config?.retryAttempts || 3,
        rateLimitPerSecond: config?.rateLimitPerSecond || 10,
      },
      GenerationProvider.OPENAI,
    );

    this.initializeClient(config);
  }

  private initializeClient(config?: OpenAIConfig): void {
    // Initialize OpenAI client
    // This would use the actual OpenAI SDK
    this.client = {
      chat: {
        completions: {
          create: this.mockChatCompletion.bind(this),
        },
      },
      images: {
        generate: this.mockImageGeneration.bind(this),
      },
      audio: {
        speech: {
          create: this.mockSpeechGeneration.bind(this),
        },
      },
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedTypes: [
        GenerationType.TEXT,
        GenerationType.IMAGE,
        GenerationType.AUDIO,
        GenerationType.CODE,
      ],
      maxPromptLength: 8000,
      maxOutputs: 10,
      supportsBatch: true,
      supportsCancel: false,
      supportsProgress: false,
      qualityLevels: ['standard', 'hd'],
      outputFormats: {
        [GenerationType.TEXT]: ['text'],
        [GenerationType.IMAGE]: ['png', 'jpg'],
        [GenerationType.AUDIO]: ['mp3', 'opus', 'aac', 'flac'],
        [GenerationType.VIDEO]: [],
        [GenerationType.THREE_D]: [],
        [GenerationType.AVATAR]: [],
        [GenerationType.MUSIC]: [],
        [GenerationType.SPEECH]: ['mp3', 'opus', 'aac', 'flac'],
        [GenerationType.CODE]: ['text'],
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
      case GenerationType.IMAGE:
        return this.generateImage(request as ImageGenerationRequest);
      case GenerationType.AUDIO:
      case GenerationType.SPEECH:
        return this.generateAudio(request as AudioGenerationRequest);
      case GenerationType.CODE:
        return this.generateCode(request as CodeGenerationRequest);
      default:
        throw new Error(
          `Generation type ${request.type} not supported by OpenAI provider`,
        );
    }
  }

  private async generateText(
    request: TextGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    try {
      const response = await this.withRetry(async () => {
        return await this.client.chat.completions.create({
          model: request.model || 'gpt-4o',
          messages: [
            ...(request.context || []),
            {
              role: 'system',
              content: request.system_prompt || 'You are a helpful assistant.',
            },
            { role: 'user', content: request.prompt },
          ],
          temperature: request.temperature || 0.7,
          max_tokens: request.max_tokens || 2000,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });
      });

      const output = {
        id: this.generateOutputId(),
        url: '', // Text doesn't have URL, stored in metadata
        format: 'text',
        size: response.choices[0].message.content.length,
        metadata: {
          content: response.choices[0].message.content,
          model: response.model,
          usage: response.usage,
          finish_reason: response.choices[0].finish_reason,
        },
      };

      return {
        outputs: [output],
        cost: this.calculateTextCost(response.usage),
        credits_used: Math.ceil(response.usage.total_tokens / 1000),
        metadata: {
          model: response.model,
          usage: response.usage,
        },
      };
    } catch (error) {
      throw this.handleProviderError(error);
    }
  }

  private async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    try {
      const response = await this.withRetry(async () => {
        return await this.client.images.generate({
          model: 'dall-e-3',
          prompt: request.prompt,
          n: request.num_images || 1,
          size: this.mapResolution(request.resolution || '1024x1024'),
          quality: request.quality === 'high' ? 'hd' : 'standard',
          style: 'natural', // or 'vivid'
          response_format: 'url',
        });
      });

      const outputs = await Promise.all(
        response.data.map(async (image: any, index: number) => {
          // Download image to get actual size
          const imageResponse = await fetch(image.url);
          const imageBuffer = await imageResponse.arrayBuffer();

          return {
            id: this.generateOutputId(),
            url: this.normalizeOutputUrl(image.url),
            format: 'png',
            size: imageBuffer.byteLength,
            metadata: {
              revised_prompt: image.revised_prompt,
              index,
              quality: request.quality,
              resolution: request.resolution,
            },
          };
        }),
      );

      return {
        outputs,
        cost: this.calculateImageCost(
          request.resolution,
          request.quality,
          request.num_images,
        ),
        credits_used: (request.num_images || 1) * 5, // 5 credits per image
        metadata: {
          model: 'dall-e-3',
          total_images: request.num_images || 1,
        },
      };
    } catch (error) {
      throw this.handleProviderError(error);
    }
  }

  private async generateAudio(
    request: AudioGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    try {
      const response = await this.withRetry(async () => {
        return await this.client.audio.speech.create({
          model: 'tts-1-hd',
          voice: request.voice_id || 'alloy',
          input: request.prompt,
          response_format: request.output_format || 'mp3',
          speed: request.speed || 1.0,
        });
      });

      // Convert response to buffer to get size
      const audioBuffer = await response.arrayBuffer();

      const output = {
        id: this.generateOutputId(),
        url: '', // Would be uploaded to storage
        format: request.output_format || 'mp3',
        size: audioBuffer.byteLength,
        metadata: {
          voice: request.voice_id || 'alloy',
          model: 'tts-1-hd',
          speed: request.speed || 1.0,
          duration: this.estimateAudioDuration(
            request.prompt,
            request.speed || 1.0,
          ),
          buffer: audioBuffer, // Temporary, would be uploaded
        },
      };

      return {
        outputs: [output],
        cost: this.calculateAudioCost(request.prompt.length),
        credits_used: Math.ceil(request.prompt.length / 100), // 1 credit per 100 characters
        metadata: {
          model: 'tts-1-hd',
          characters: request.prompt.length,
        },
      };
    } catch (error) {
      throw this.handleProviderError(error);
    }
  }

  private async generateCode(
    request: CodeGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const systemPrompt = `You are an expert ${request.language} developer. Generate clean, well-documented, and production-ready code based on the user's requirements.

${request.framework ? `Use ${request.framework} framework.` : ''}
${request.style_guide ? `Follow this style guide: ${request.style_guide}` : ''}
${request.test_requirements ? 'Include comprehensive tests.' : ''}
${request.documentation ? 'Include detailed documentation and comments.' : ''}

Requirements:
${request.requirements?.map((req) => `- ${req}`).join('\n') || ''}

Return only the code without explanation unless specifically requested.`;

    const textRequest: TextGenerationRequest = {
      ...request,
      type: GenerationType.TEXT,
      system_prompt: systemPrompt,
      temperature: 0.2, // Lower temperature for more deterministic code
      max_tokens: 4000,
    };

    return this.generateText(textRequest);
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    switch (request.type) {
      case GenerationType.TEXT:
        const textReq = request as TextGenerationRequest;
        return this.estimateTextCost(
          textReq.prompt.length + (textReq.max_tokens || 2000),
        );

      case GenerationType.IMAGE:
        const imageReq = request as ImageGenerationRequest;
        return this.calculateImageCost(
          imageReq.resolution,
          imageReq.quality,
          imageReq.num_images,
        );

      case GenerationType.AUDIO:
        const audioReq = request as AudioGenerationRequest;
        return this.calculateAudioCost(audioReq.prompt.length);

      default:
        return 0.01; // Base cost
    }
  }

  protected async performHealthCheck(): Promise<void> {
    try {
      await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1,
      });
    } catch (error) {
      throw new Error(`OpenAI health check failed: ${error}`);
    }
  }

  // Helper methods

  private mapResolution(resolution: string): string {
    const resolutionMap: Record<string, string> = {
      '512x512': '512x512',
      '1024x1024': '1024x1024',
      '1536x1536': '1024x1792', // DALL-E 3 doesn't support 1536x1536
      '2048x2048': '1792x1024', // Map to closest supported
    };

    return resolutionMap[resolution] || '1024x1024';
  }

  private calculateTextCost(usage: any): number {
    // OpenAI pricing (example rates)
    const inputCostPer1k = 0.03;
    const outputCostPer1k = 0.06;

    return (
      (usage.prompt_tokens / 1000) * inputCostPer1k +
      (usage.completion_tokens / 1000) * outputCostPer1k
    );
  }

  private estimateTextCost(totalTokens: number): number {
    return (totalTokens / 1000) * 0.045; // Average cost
  }

  private calculateImageCost(
    resolution?: string,
    quality?: string,
    numImages = 1,
  ): number {
    const baseCost = quality === 'high' ? 0.08 : 0.04;
    const resolutionMultiplier =
      resolution === '1536x1536' || resolution === '2048x2048' ? 1.5 : 1;

    return baseCost * resolutionMultiplier * numImages;
  }

  private calculateAudioCost(textLength: number): number {
    // $0.015 per 1k characters
    return (textLength / 1000) * 0.015;
  }

  private estimateAudioDuration(text: string, speed: number): number {
    // Rough estimate: ~150 words per minute at normal speed
    const words = text.split(' ').length;
    const baseMinutes = words / 150;
    return (baseMinutes / speed) * 60; // Convert to seconds
  }

  // Mock methods (would be replaced with actual OpenAI SDK calls)
  private async mockChatCompletion(params: any): Promise<any> {
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model: params.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `Generated response for: ${params.messages[params.messages.length - 1].content}`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: params.messages.join(' ').length / 4,
        completion_tokens: 50,
        total_tokens: params.messages.join(' ').length / 4 + 50,
      },
    };
  }

  private async mockImageGeneration(params: any): Promise<any> {
    return {
      created: Date.now(),
      data: Array(params.n || 1)
        .fill(null)
        .map((_, i) => ({
          url: `https://oaidalleapiprodscus.blob.core.windows.net/private/mock-image-${Date.now()}-${i}.png`,
          revised_prompt: `Enhanced version of: ${params.prompt}`,
        })),
    };
  }

  private async mockSpeechGeneration(params: any): Promise<any> {
    // Return mock audio buffer
    const mockAudioData = new ArrayBuffer(params.input.length * 100); // Mock size
    return {
      arrayBuffer: async () => mockAudioData,
    };
  }
}
