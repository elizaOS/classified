/**
 * Stable Diffusion Generation Provider
 * Handles image generation via Stable Diffusion API
 */

import {
  GenerationRequest,
  GenerationType,
  GenerationProvider,
  ImageGenerationRequest,
} from '../../types';
import {
  BaseGenerationProvider,
  ProviderGenerationResult,
  ProviderConfig,
  ProviderCapabilities,
} from './BaseGenerationProvider';

export class StableDiffusionProvider extends BaseGenerationProvider {
  constructor(config?: ProviderConfig) {
    super(
      {
        apiKey: config?.apiKey || process.env.STABILITY_API_KEY || '',
        baseUrl: config?.baseUrl || 'https://api.stability.ai/v1',
        timeout: config?.timeout || 60000,
        retryAttempts: config?.retryAttempts || 3,
        rateLimitPerSecond: config?.rateLimitPerSecond || 2,
      },
      GenerationProvider.STABLE_DIFFUSION,
    );
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedTypes: [GenerationType.IMAGE],
      maxPromptLength: 2000,
      maxOutputs: 10,
      supportsBatch: true,
      supportsCancel: false,
      supportsProgress: false,
      qualityLevels: ['draft', 'standard', 'high'],
      outputFormats: {
        [GenerationType.IMAGE]: ['png', 'jpg', 'webp'],
        [GenerationType.TEXT]: [],
        [GenerationType.VIDEO]: [],
        [GenerationType.AUDIO]: [],
        [GenerationType.THREE_D]: [],
        [GenerationType.AVATAR]: [],
        [GenerationType.MUSIC]: [],
        [GenerationType.SPEECH]: [],
        [GenerationType.CODE]: [],
        [GenerationType.DOCUMENT]: [],
      },
    };
  }

  async generate(
    request: GenerationRequest,
  ): Promise<ProviderGenerationResult> {
    if (request.type === GenerationType.IMAGE) {
      return this.generateImage(request as ImageGenerationRequest);
    }
    throw new Error(`Generation type ${request.type} not supported`);
  }

  private async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    // Mock implementation
    const outputs = Array(request.num_images || 1)
      .fill(null)
      .map((_, i) => ({
        id: this.generateOutputId(),
        url: `https://mock-stable-diffusion.com/image-${Date.now()}-${i}.png`,
        format: 'png',
        size: 1024 * 1024,
        metadata: {
          prompt: request.prompt,
          negative_prompt: request.negative_prompt,
          steps: request.steps || 50,
          guidance_scale: request.guidance_scale || 7.5,
          seed: request.seed || Math.floor(Math.random() * 1000000),
        },
      }));

    return {
      outputs,
      cost: (request.num_images || 1) * 0.02,
      credits_used: (request.num_images || 1) * 3,
    };
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    if (request.type === GenerationType.IMAGE) {
      const imageReq = request as ImageGenerationRequest;
      return (imageReq.num_images || 1) * 0.02;
    }
    return 0;
  }

  protected async performHealthCheck(): Promise<void> {
    // Mock health check
  }
}
