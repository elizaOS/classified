/**
 * FAL.ai Generation Provider
 * Handles multi-modal generation via FAL.ai API
 */

import {
  GenerationRequest,
  GenerationType,
  GenerationProvider,
  ImageGenerationRequest,
  VideoGenerationRequest,
  ThreeDGenerationRequest,
  MusicGenerationRequest,
} from '../../types';
import {
  BaseGenerationProvider,
  ProviderGenerationResult,
  ProviderConfig,
  ProviderCapabilities,
} from './BaseGenerationProvider';

export class FALProvider extends BaseGenerationProvider {
  constructor(config?: ProviderConfig) {
    super(
      {
        apiKey: config?.apiKey || process.env.FAL_KEY || '',
        baseUrl: config?.baseUrl || 'https://fal.run/fal-ai',
        timeout: config?.timeout || 120000,
        retryAttempts: config?.retryAttempts || 3,
        rateLimitPerSecond: config?.rateLimitPerSecond || 3,
      },
      GenerationProvider.FAL,
    );
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedTypes: [
        GenerationType.IMAGE,
        GenerationType.VIDEO,
        GenerationType.THREE_D,
        GenerationType.MUSIC,
      ],
      maxPromptLength: 3000,
      maxOutputs: 8,
      supportsBatch: true,
      supportsCancel: true,
      supportsProgress: true,
      qualityLevels: ['fast', 'standard', 'high'],
      outputFormats: {
        [GenerationType.IMAGE]: ['png', 'jpg', 'webp'],
        [GenerationType.VIDEO]: ['mp4', 'webm', 'gif'],
        [GenerationType.THREE_D]: ['glb', 'obj', 'fbx'],
        [GenerationType.MUSIC]: ['mp3', 'wav', 'ogg'],
        [GenerationType.TEXT]: [],
        [GenerationType.AUDIO]: [],
        [GenerationType.AVATAR]: [],
        [GenerationType.SPEECH]: [],
        [GenerationType.CODE]: [],
        [GenerationType.DOCUMENT]: [],
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
      case GenerationType.IMAGE:
        return this.generateImage(request as ImageGenerationRequest);
      case GenerationType.VIDEO:
        return this.generateVideo(request as VideoGenerationRequest);
      case GenerationType.THREE_D:
        return this.generate3D(request as ThreeDGenerationRequest);
      case GenerationType.MUSIC:
        return this.generateMusic(request as MusicGenerationRequest);
      default:
        throw new Error(
          `Generation type ${request.type} not supported by FAL provider`,
        );
    }
  }

  private async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    // Mock implementation for FAL image generation
    const outputs = Array(request.num_images || 1)
      .fill(null)
      .map((_, i) => ({
        id: this.generateOutputId(),
        url: `https://mock-fal.ai/image-${Date.now()}-${i}.png`,
        format: 'png',
        size: this.calculateImageSize(request.resolution || '1024x1024'),
        metadata: {
          model: 'flux-pro',
          prompt: request.prompt,
          negative_prompt: request.negative_prompt,
          guidance_scale: request.guidance_scale || 3.5,
          num_inference_steps: request.steps || 28,
          seed: request.seed || Math.floor(Math.random() * 1000000),
        },
      }));

    return {
      outputs,
      cost: (request.num_images || 1) * 0.05,
      credits_used: (request.num_images || 1) * 4,
      metadata: {
        model: 'flux-pro',
        total_images: request.num_images || 1,
      },
    };
  }

  private async generateVideo(
    request: VideoGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const output = {
      id: this.generateOutputId(),
      url: `https://mock-fal.ai/video-${Date.now()}.mp4`,
      format: 'mp4',
      size: this.calculateVideoSize(
        request.duration || 5,
        request.resolution || '1080p',
      ),
      thumbnailUrl: `https://mock-fal.ai/thumbnail-${Date.now()}.jpg`,
      metadata: {
        model: 'stable-video-diffusion',
        prompt: request.prompt,
        duration: request.duration || 5,
        fps: request.fps || 24,
        resolution: request.resolution || '1080p',
        motion_bucket_id: 127,
        cond_aug: 0.02,
        seed: Math.floor(Math.random() * 1000000),
      },
    };

    return {
      outputs: [output],
      cost: (request.duration || 5) * 0.15,
      credits_used: Math.ceil((request.duration || 5) * 3),
      metadata: {
        model: 'stable-video-diffusion',
        duration: request.duration || 5,
      },
    };
  }

  private async generate3D(
    request: ThreeDGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const output = {
      id: this.generateOutputId(),
      url: `https://mock-fal.ai/model-${Date.now()}.${request.output_format || 'glb'}`,
      format: request.output_format || 'glb',
      size: 1024 * 1024 * 2, // 2MB estimated
      metadata: {
        model: 'instantmesh',
        prompt: request.prompt,
        output_format: request.output_format || 'glb',
        texture_resolution: request.texture_resolution || '1024',
        polygon_count: request.polygon_count || 'medium',
      },
    };

    return {
      outputs: [output],
      cost: 0.25,
      credits_used: 15,
      metadata: {
        model: 'instantmesh',
      },
    };
  }

  private async generateMusic(
    request: MusicGenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const output = {
      id: this.generateOutputId(),
      url: `https://mock-fal.ai/music-${Date.now()}.mp3`,
      format: 'mp3',
      size: (request.duration || 30) * 32000, // Rough estimate
      metadata: {
        model: 'musicgen-large',
        prompt: request.prompt,
        duration: request.duration || 30,
        genre: request.genre,
        mood: request.mood,
        tempo: request.tempo,
        key: request.key,
        top_k: 250,
        top_p: 0.0,
        temperature: 1.0,
      },
    };

    return {
      outputs: [output],
      cost: (request.duration || 30) * 0.02,
      credits_used: Math.ceil((request.duration || 30) / 10),
      metadata: {
        model: 'musicgen-large',
        duration: request.duration || 30,
      },
    };
  }

  async getProgress(
    generationId: string,
  ): Promise<{ progress: number; status: string }> {
    // Mock progress tracking
    return { progress: 75, status: 'processing' };
  }

  async cancelGeneration(generationId: string): Promise<void> {
    // Mock cancellation
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    switch (request.type) {
      case GenerationType.IMAGE:
        const imageReq = request as ImageGenerationRequest;
        return (imageReq.num_images || 1) * 0.05;
      case GenerationType.VIDEO:
        const videoReq = request as VideoGenerationRequest;
        return (videoReq.duration || 5) * 0.15;
      case GenerationType.THREE_D:
        return 0.25;
      case GenerationType.MUSIC:
        const musicReq = request as MusicGenerationRequest;
        return (musicReq.duration || 30) * 0.02;
      default:
        return 0;
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Mock health check
  }

  // Helper methods
  private calculateImageSize(resolution: string): number {
    const sizeMap: Record<string, number> = {
      '512x512': 512 * 512 * 3,
      '1024x1024': 1024 * 1024 * 3,
      '1536x1536': 1536 * 1536 * 3,
      '2048x2048': 2048 * 2048 * 3,
    };
    return sizeMap[resolution] || 1024 * 1024 * 3;
  }

  private calculateVideoSize(duration: number, resolution: string): number {
    const baseSizePerSecond: Record<string, number> = {
      '720p': 1024 * 1024 * 2, // 2MB per second
      '1080p': 1024 * 1024 * 5, // 5MB per second
      '4k': 1024 * 1024 * 20, // 20MB per second
    };
    const sizePerSecond =
      baseSizePerSecond[resolution] || baseSizePerSecond['1080p'];
    return duration * sizePerSecond;
  }
}
