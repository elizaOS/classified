/**
 * Kling Video Provider
 * Integration with Kling 2.1 Master for world-class video generation
 */

import {
  BaseGenerationProvider,
  ProviderGenerationResult,
  ProviderCapabilities,
  ProviderConfig,
} from './BaseGenerationProvider';
import {
  GenerationRequest,
  GenerationProvider,
  GenerationType,
} from '../../types';
import {
  EnhancedGenerationProvider,
  KlingVideoRequest,
  CostBreakdown,
} from '../../types/enhanced-types';
import { logger } from '@/lib/logger';

interface KlingConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  rateLimitPerSecond?: number;
}

interface KlingModels {
  [EnhancedGenerationProvider.KLING_STANDARD]: {
    endpoint: 'kling-video/v1.6/text-to-video';
    costPerSecond: 0.13;
    maxDuration: 10;
    resolution: '720p';
    quality: 7;
    concurrency: 5;
  };
  [EnhancedGenerationProvider.KLING_PROFESSIONAL]: {
    endpoint: 'kling-video/v2.0/professional';
    costPerSecond: 0.192; // $0.96 for 5s
    maxDuration: 120;
    resolution: '1080p';
    quality: 9;
    concurrency: 3;
  };
  [EnhancedGenerationProvider.KLING_MASTER]: {
    endpoint: 'kling-video/v2.1/master';
    costPerSecond: 0.28;
    maxDuration: 120;
    resolution: '1080p';
    quality: 10;
    concurrency: 2;
  };
}

export class KlingVideoProvider extends BaseGenerationProvider {
  protected config: KlingConfig;
  private models: KlingModels;
  private lastRequestTime = 0;
  private activeRequests = new Map<string, Promise<any>>();

  constructor(config: KlingConfig) {
    const baseConfig: ProviderConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://fal.run/fal-ai',
      timeout: config.timeout || 300000,
      rateLimitPerSecond: config.rateLimitPerSecond || 0.5,
    };

    super(baseConfig, GenerationProvider.CUSTOM);

    this.config = {
      baseUrl: 'https://fal.run/fal-ai',
      timeout: 300000, // 5 minutes for video
      rateLimitPerSecond: 0.5, // Conservative rate limiting
      ...config,
    };

    this.models = {
      [EnhancedGenerationProvider.KLING_STANDARD]: {
        endpoint: 'kling-video/v1.6/text-to-video',
        costPerSecond: 0.13,
        maxDuration: 10,
        resolution: '720p',
        quality: 7,
        concurrency: 5,
      },
      [EnhancedGenerationProvider.KLING_PROFESSIONAL]: {
        endpoint: 'kling-video/v2.0/professional',
        costPerSecond: 0.192,
        maxDuration: 120,
        resolution: '1080p',
        quality: 9,
        concurrency: 3,
      },
      [EnhancedGenerationProvider.KLING_MASTER]: {
        endpoint: 'kling-video/v2.1/master',
        costPerSecond: 0.28,
        maxDuration: 120,
        resolution: '1080p',
        quality: 10,
        concurrency: 2,
      },
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedTypes: [GenerationType.VIDEO],
      maxPromptLength: 4000,
      maxOutputs: 1,
      supportsBatch: false,
      supportsCancel: true,
      supportsProgress: true,
      qualityLevels: ['standard', 'professional', 'master'],
      outputFormats: {
        [GenerationType.VIDEO]: ['mp4', 'webm'],
      },
    };
  }

  async generate(
    request: GenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const startTime = Date.now();
    const requestId = `kling_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate request type
      if (request.type !== GenerationType.VIDEO) {
        throw new Error(
          `Kling provider does not support ${request.type} generation`,
        );
      }

      // Convert GenerationRequest to KlingVideoRequest with proper defaults
      const klingRequest: KlingVideoRequest = {
        type: GenerationType.VIDEO,
        organizationId: request.organizationId,
        userId: request.userId,
        prompt: request.prompt,
        priority: request.priority,
        metadata: request.metadata,
        provider: EnhancedGenerationProvider.KLING_PROFESSIONAL, // Default provider
        quality_tier: (request as any).quality_tier || 'professional',
        duration: (request as any).duration || 5,
        aspect_ratio: (request as any).aspect_ratio || '16:9',
        cfg_scale: (request as any).cfg_scale || 0.5,
        physics_simulation: (request as any).physics_simulation ?? true,
        camera_controls: (request as any).camera_controls,
        motion_brush_controls: (request as any).motion_brush_controls,
        image_to_video: (request as any).image_to_video,
      };
      const modelConfig =
        this.models[klingRequest.provider as keyof KlingModels];

      if (!modelConfig) {
        throw new Error(`Unsupported Kling model: ${klingRequest.provider}`);
      }

      // Check concurrency limits
      if (this.activeRequests.size >= modelConfig.concurrency) {
        throw new Error(
          `Maximum concurrent requests reached for ${klingRequest.provider}`,
        );
      }

      // Apply rate limiting
      await this.applyRateLimit();

      // Prepare request payload
      const payload = this.buildKlingPayload(klingRequest, modelConfig);

      logger.info('Starting Kling video generation', {
        requestId,
        provider: klingRequest.provider,
        duration: klingRequest.duration,
        quality: klingRequest.quality_tier,
      });

      // Make API request with queue system
      const promise = this.makeVideoRequest(
        modelConfig.endpoint,
        payload,
        requestId,
      );
      this.activeRequests.set(requestId, promise);

      try {
        const response = await promise;

        // Process response
        const outputs = await this.processVideoResponse(response, klingRequest);

        // Calculate costs
        const costBreakdown = await this.calculateCost(
          klingRequest,
          modelConfig,
        );

        const processingTime = Date.now() - startTime;

        logger.info('Kling video generation completed', {
          requestId,
          provider: klingRequest.provider,
          outputs: outputs.length,
          processingTime,
          cost: costBreakdown.final_price,
        });

        return {
          outputs,
          cost: costBreakdown.final_price,
          credits_used: Math.ceil(costBreakdown.final_price * 100),
          metadata: {
            provider_id: requestId,
            model: modelConfig.endpoint,
            processing_time: processingTime,
            quality_rating: modelConfig.quality,
            cost_breakdown: costBreakdown,
            physics_simulation: klingRequest.physics_simulation,
            camera_controls: klingRequest.camera_controls,
          },
        };
      } finally {
        this.activeRequests.delete(requestId);
      }
    } catch (error) {
      this.activeRequests.delete(requestId);
      logger.error(
        'Kling video generation failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          requestId,
          provider: request.provider,
          prompt: request.prompt?.substring(0, 100),
        },
      );
      throw error;
    }
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    // Convert GenerationRequest to KlingVideoRequest with proper defaults
    const klingRequest: KlingVideoRequest = {
      type: GenerationType.VIDEO,
      organizationId: request.organizationId,
      userId: request.userId,
      prompt: request.prompt,
      priority: request.priority,
      metadata: request.metadata,
      provider: EnhancedGenerationProvider.KLING_PROFESSIONAL, // Default provider
      quality_tier: (request as any).quality_tier || 'professional',
      duration: (request as any).duration || 5,
      aspect_ratio: (request as any).aspect_ratio || '16:9',
      cfg_scale: (request as any).cfg_scale || 0.5,
      physics_simulation: (request as any).physics_simulation ?? true,
      camera_controls: (request as any).camera_controls,
      motion_brush_controls: (request as any).motion_brush_controls,
      image_to_video: (request as any).image_to_video,
    };
    const modelConfig = this.models[klingRequest.provider as keyof KlingModels];

    if (!modelConfig) {
      throw new Error(
        `Unsupported Kling model for cost estimation: ${klingRequest.provider}`,
      );
    }

    const costBreakdown = await this.calculateCost(klingRequest, modelConfig);
    return costBreakdown.final_price;
  }

  private async calculateCost(
    request: KlingVideoRequest,
    modelConfig: any,
  ): Promise<CostBreakdown> {
    const duration = request.duration || 5;
    const providerCost = modelConfig.costPerSecond * duration;
    const markup = 0.2; // 20% markup
    const markupAmount = providerCost * markup;
    const finalPrice = providerCost + markupAmount;

    return {
      provider_cost: providerCost,
      our_markup: markup,
      markup_amount: markupAmount,
      final_price: finalPrice,
      estimated_profit: markupAmount,
      credits_required: Math.ceil(finalPrice * 100),
      cost_per_unit: finalPrice,
      provider_name: 'Kling',
      model_name: modelConfig.endpoint,
      estimated_processing_time: this.estimateProcessingTime(
        request,
        modelConfig,
      ),
    };
  }

  private estimateProcessingTime(
    request: KlingVideoRequest,
    modelConfig: any,
  ): number {
    // Processing time varies by model and duration
    const baseTimes = {
      [EnhancedGenerationProvider.KLING_STANDARD]: 60, // 1 minute
      [EnhancedGenerationProvider.KLING_PROFESSIONAL]: 180, // 3 minutes
      [EnhancedGenerationProvider.KLING_MASTER]: 300, // 5 minutes
    };

    const baseTime = baseTimes[request.provider] || 180;
    const duration = request.duration || 5;
    const durationMultiplier = Math.max(1, duration / 5); // Scale with duration

    // Add time for advanced features
    let complexityMultiplier = 1;
    if (request.physics_simulation) {
      complexityMultiplier += 0.5;
    }
    if (request.camera_controls) {
      complexityMultiplier += 0.3;
    }
    if (request.motion_brush_controls?.length) {
      complexityMultiplier += 0.4;
    }
    if (request.image_to_video) {
      complexityMultiplier += 0.2;
    }

    return Math.ceil(baseTime * durationMultiplier * complexityMultiplier);
  }

  private buildKlingPayload(request: KlingVideoRequest, modelConfig: any): any {
    const payload: any = {
      prompt: request.prompt,
      duration: Math.min(request.duration || 5, modelConfig.maxDuration),
      aspect_ratio: request.aspect_ratio || '16:9',
      cfg_scale: request.cfg_scale || 0.5,
      mode: this.getQualityMode(request.quality_tier),
    };

    // Add physics simulation
    if (request.physics_simulation) {
      payload.physics_simulation = true;
    }

    // Add camera controls
    if (request.camera_controls) {
      payload.camera_control = {
        type: 'simple',
        config: {
          horizontal: request.camera_controls.horizontal || 0,
          vertical: request.camera_controls.vertical || 0,
          pan: request.camera_controls.pan || 0,
          tilt: request.camera_controls.tilt || 0,
          roll: request.camera_controls.roll || 0,
          zoom: request.camera_controls.zoom || 0,
        },
      };
    }

    // Add motion brush controls
    if (request.motion_brush_controls?.length) {
      payload.motion_brush = request.motion_brush_controls.map((control) => ({
        element: control.element,
        motion_type: control.motion_type,
        intensity: control.intensity,
        direction: control.direction,
      }));
    }

    // Add image-to-video
    if (request.image_to_video) {
      payload.image_url = request.image_to_video.image_url;
      payload.image_tail_type =
        request.image_to_video.image_tail_type || 'canny';
    }

    return payload;
  }

  private getQualityMode(tier?: string): string {
    switch (tier) {
      case 'standard':
        return 'std';
      case 'professional':
        return 'pro';
      case 'master':
        return 'master';
      default:
        return 'pro';
    }
  }

  private async makeVideoRequest(
    endpoint: string,
    payload: any,
    requestId: string,
  ): Promise<any> {
    const url = `${this.config.baseUrl}/${endpoint}`;

    // Use queue system for video generation
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Kling API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();

    // If we get a request_id, poll for completion
    if (result.request_id && !result.video_url) {
      return await this.pollForCompletion(result.request_id, requestId);
    }

    return result;
  }

  private async pollForCompletion(
    requestId: string,
    ourRequestId: string,
  ): Promise<any> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await fetch(
          `${this.config.baseUrl}/queue/status/${requestId}`,
          {
            headers: {
              Authorization: `Key ${this.config.apiKey}`,
            },
          },
        );

        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }

        const status = await statusResponse.json();

        if (status.status === 'COMPLETED') {
          const resultResponse = await fetch(
            `${this.config.baseUrl}/queue/result/${requestId}`,
            {
              headers: {
                Authorization: `Key ${this.config.apiKey}`,
              },
            },
          );

          if (!resultResponse.ok) {
            throw new Error(`Result fetch failed: ${resultResponse.status}`);
          }

          return await resultResponse.json();
        }

        if (status.status === 'FAILED') {
          throw new Error(
            `Video generation failed: ${status.error || 'Unknown error'}`,
          );
        }

        // Still processing, wait and try again
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;
      } catch (error) {
        logger.warn(`Polling attempt ${attempts} failed for ${ourRequestId}`, {
          error,
        });
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw new Error(
      `Video generation timed out after ${maxAttempts * 5} seconds`,
    );
  }

  private async processVideoResponse(
    response: any,
    request: KlingVideoRequest,
  ): Promise<any[]> {
    const outputs = [];

    if (response.video && response.video.url) {
      outputs.push({
        id: `kling_video_${Date.now()}`,
        url: response.video.url,
        format: 'mp4',
        size: await this.estimateVideoSize(
          response.video.url,
          request.duration || 5,
        ),
        thumbnailUrl:
          response.video.thumbnail_url ||
          (await this.generateThumbnail(response.video.url)),
        metadata: {
          duration: request.duration || 5,
          resolution: response.video.resolution || '1080p',
          fps: response.video.fps || 24,
          aspect_ratio: request.aspect_ratio || '16:9',
          physics_enabled: request.physics_simulation,
          camera_controlled: !!request.camera_controls,
          quality_tier: request.quality_tier,
        },
      });
    }

    return outputs;
  }

  private async estimateVideoSize(
    url: string,
    duration: number,
  ): Promise<number> {
    try {
      // Estimate based on duration and quality
      // 1080p video ~ 50MB per minute
      const mbPerSecond = 0.833; // ~50MB/60seconds
      return Math.ceil(duration * mbPerSecond * 1024 * 1024);
    } catch {
      return duration * 1024 * 1024; // Fallback 1MB per second
    }
  }

  private async generateThumbnail(videoUrl: string): Promise<string> {
    // In a real implementation, this would extract a frame from the video
    // For now, return a placeholder
    return `${videoUrl}?thumbnail=true`;
  }

  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / (this.config.rateLimitPerSecond || 0.5);

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: {
          Authorization: `Key ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;

      return {
        healthy: response.ok,
        latency,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validateRequest(request: GenerationRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // First validate basic requirements
    if (request.type !== GenerationType.VIDEO) {
      errors.push('Request type must be VIDEO for Kling provider');
      return { valid: false, errors };
    }

    // Convert to kling request for detailed validation
    const klingRequest: KlingVideoRequest = {
      type: GenerationType.VIDEO,
      organizationId: request.organizationId,
      userId: request.userId,
      prompt: request.prompt,
      priority: request.priority,
      metadata: request.metadata,
      provider: EnhancedGenerationProvider.KLING_PROFESSIONAL, // Default provider
      quality_tier: (request as any).quality_tier || 'professional',
      duration: (request as any).duration || 5,
      aspect_ratio: (request as any).aspect_ratio || '16:9',
      cfg_scale: (request as any).cfg_scale || 0.5,
      physics_simulation: (request as any).physics_simulation ?? true,
      camera_controls: (request as any).camera_controls,
      motion_brush_controls: (request as any).motion_brush_controls,
      image_to_video: (request as any).image_to_video,
    };

    // Basic validation
    if (!klingRequest.prompt?.trim()) {
      errors.push('Prompt is required');
    }

    if (klingRequest.prompt && klingRequest.prompt.length > 4000) {
      errors.push('Prompt exceeds maximum length of 4000 characters');
    }

    // Validate duration
    const modelConfig = this.models[klingRequest.provider as keyof KlingModels];
    if (modelConfig && klingRequest.duration) {
      if (
        klingRequest.duration < 1 ||
        klingRequest.duration > modelConfig.maxDuration
      ) {
        errors.push(
          `Duration must be between 1 and ${modelConfig.maxDuration} seconds for this model`,
        );
      }
    }

    // Validate camera controls
    if (klingRequest.camera_controls) {
      const controls = klingRequest.camera_controls;
      const validateRange = (value: number, name: string) => {
        if (value < -10 || value > 10) {
          errors.push(`${name} must be between -10 and 10`);
        }
      };

      validateRange(controls.horizontal, 'Horizontal camera control');
      validateRange(controls.vertical, 'Vertical camera control');
      validateRange(controls.pan, 'Pan camera control');
      validateRange(controls.tilt, 'Tilt camera control');
      validateRange(controls.roll, 'Roll camera control');
      validateRange(controls.zoom, 'Zoom camera control');
    }

    // Validate image-to-video
    if (klingRequest.image_to_video) {
      try {
        new URL(klingRequest.image_to_video.image_url);
      } catch {
        errors.push('Invalid image URL for image-to-video');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async cancelGeneration(generationId: string): Promise<void> {
    const activeRequest = this.activeRequests.get(generationId);
    if (activeRequest) {
      // Cancel the request if possible
      this.activeRequests.delete(generationId);
      logger.info('Cancelled Kling video generation', { generationId });
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Simple health check by attempting to get available models
    const response = await fetch(`${this.config.baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Health check failed: HTTP ${response.status}`);
    }
  }

  async cleanup(): Promise<void> {
    // Wait for active requests to complete
    if (this.activeRequests.size > 0) {
      logger.info(
        `Waiting for ${this.activeRequests.size} active Kling requests to complete`,
      );
      try {
        await Promise.allSettled(Array.from(this.activeRequests.values()));
      } catch (error) {
        logger.warn('Some Kling requests did not complete during cleanup', {
          error,
        });
      }
    }

    this.activeRequests.clear();
    logger.info('Kling provider cleanup completed');
  }
}
