/**
 * Enhanced FAL.ai Provider
 * Integration with latest FLUX models and advanced features
 */

import {
  BaseGenerationProvider,
  ProviderCapabilities as BaseProviderCapabilities,
  ProviderGenerationResult as BaseProviderGenerationResult,
} from './BaseGenerationProvider';
import {
  GenerationRequest,
  GenerationResult,
  GenerationType,
} from '../../types';
import {
  EnhancedGenerationProvider,
  FALFluxRequest,
  ModelPricing,
  CostBreakdown,
  ProviderGenerationResult,
} from '../../types/enhanced-types';
import { logger } from '@/lib/logger';

interface FALConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  rateLimitPerSecond?: number;
}

interface FALFluxModels {
  [EnhancedGenerationProvider.FAL_FLUX_SCHNELL]: {
    endpoint: 'fal-ai/flux/schnell';
    costPerMP: 0.003;
    maxSteps: 4;
    quality: 8;
    speed: 10;
  };
  [EnhancedGenerationProvider.FAL_FLUX_DEV]: {
    endpoint: 'fal-ai/flux/dev';
    costPerMP: 0.025;
    maxSteps: 50;
    quality: 9;
    speed: 7;
  };
  [EnhancedGenerationProvider.FAL_FLUX_PRO]: {
    endpoint: 'fal-ai/flux-pro/v1.1';
    costPerMP: 0.04;
    maxSteps: 50;
    quality: 10;
    speed: 6;
  };
  [EnhancedGenerationProvider.FAL_FLUX_KONTEXT]: {
    endpoint: 'fal-ai/flux/kontext';
    costPerMP: 0.035;
    maxSteps: 50;
    quality: 9.5;
    speed: 7;
  };
}

export class EnhancedFALProvider extends BaseGenerationProvider {
  private falConfig: FALConfig;
  private models: FALFluxModels;
  private lastRequestTime = 0;
  private requestQueue: Promise<any>[] = [];

  constructor(config: FALConfig) {
    // Convert FALConfig to ProviderConfig for parent constructor
    const providerConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://fal.run',
      timeout: config.timeout || 60000,
      rateLimitPerSecond: config.rateLimitPerSecond || 2,
    };

    super(providerConfig, 'fal' as any); // Cast to satisfy GenerationProvider enum

    this.falConfig = {
      baseUrl: 'https://fal.run',
      timeout: 60000,
      rateLimitPerSecond: 2,
      ...config,
    };

    this.models = {
      [EnhancedGenerationProvider.FAL_FLUX_SCHNELL]: {
        endpoint: 'fal-ai/flux/schnell',
        costPerMP: 0.003,
        maxSteps: 4,
        quality: 8,
        speed: 10,
      },
      [EnhancedGenerationProvider.FAL_FLUX_DEV]: {
        endpoint: 'fal-ai/flux/dev',
        costPerMP: 0.025,
        maxSteps: 50,
        quality: 9,
        speed: 7,
      },
      [EnhancedGenerationProvider.FAL_FLUX_PRO]: {
        endpoint: 'fal-ai/flux-pro/v1.1',
        costPerMP: 0.04,
        maxSteps: 50,
        quality: 10,
        speed: 6,
      },
      [EnhancedGenerationProvider.FAL_FLUX_KONTEXT]: {
        endpoint: 'fal-ai/flux/kontext',
        costPerMP: 0.035,
        maxSteps: 50,
        quality: 9.5,
        speed: 7,
      },
    };
  }

  getCapabilities(): BaseProviderCapabilities {
    return {
      supportedTypes: [GenerationType.IMAGE],
      maxPromptLength: 8000,
      maxOutputs: 4,
      supportsBatch: true,
      supportsCancel: false,
      supportsProgress: false,
      qualityLevels: ['draft', 'standard', 'high', 'premium'],
      outputFormats: {
        [GenerationType.IMAGE]: ['png', 'jpeg', 'webp'],
      },
    };
  }

  async generate(
    request: GenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const startTime = Date.now();

    try {
      // Validate request type
      if (request.type !== GenerationType.IMAGE) {
        throw new Error(
          `FAL provider does not support ${request.type} generation`,
        );
      }

      const fluxRequest = request as unknown as FALFluxRequest;
      const modelConfig =
        this.models[fluxRequest.provider as keyof FALFluxModels];

      if (!modelConfig) {
        throw new Error(`Unsupported FAL model: ${fluxRequest.provider}`);
      }

      // Apply rate limiting
      await this.applyRateLimit();

      // Prepare request payload
      const payload = this.buildFALPayload(fluxRequest, modelConfig);

      logger.info('Starting FAL generation', {
        provider: fluxRequest.provider,
        endpoint: modelConfig.endpoint,
        imageSize: fluxRequest.image_size,
        numImages: fluxRequest.num_images,
      });

      // Make API request
      const response = await this.makeAPIRequest(modelConfig.endpoint, payload);

      // Process response
      const outputs = await this.processResponse(response, fluxRequest);

      // Calculate costs
      const costBreakdown = await this.calculateCost(fluxRequest, modelConfig);

      const processingTime = Date.now() - startTime;

      logger.info('FAL generation completed', {
        provider: fluxRequest.provider,
        outputs: outputs.length,
        processingTime,
        cost: costBreakdown.final_price,
      });

      return {
        outputs,
        cost: costBreakdown.final_price,
        credits_used: Math.ceil(costBreakdown.final_price * 100), // 1 credit = $0.01
        provider_id: response.request_id || `fal_${Date.now()}`,
        metadata: {
          model: modelConfig.endpoint,
          processing_time: processingTime,
          quality_rating: modelConfig.quality,
          speed_rating: modelConfig.speed,
          cost_breakdown: costBreakdown,
        },
      };
    } catch (error) {
      logger.error('FAL generation failed', error as Error, {
        provider: request.provider,
        prompt: request.prompt?.substring(0, 100),
      });
      throw error;
    }
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    const fluxRequest = request as unknown as FALFluxRequest;
    const modelConfig =
      this.models[fluxRequest.provider as keyof FALFluxModels];

    if (!modelConfig) {
      throw new Error(
        `Unsupported FAL model for cost estimation: ${fluxRequest.provider}`,
      );
    }

    const costBreakdown = await this.calculateCost(fluxRequest, modelConfig);
    return costBreakdown.final_price;
  }

  private async calculateCost(
    request: FALFluxRequest,
    modelConfig: any,
  ): Promise<CostBreakdown> {
    // Calculate megapixels based on image size
    const megapixels = this.calculateMegapixels(
      request.image_size || 'square_hd',
    );
    const numImages = request.num_images || 1;

    // Base cost calculation
    const providerCost = modelConfig.costPerMP * megapixels * numImages;
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
      cost_per_unit: finalPrice / numImages,
      provider_name: 'FAL.ai',
      model_name: modelConfig.endpoint,
      estimated_processing_time: this.estimateProcessingTime(
        request,
        modelConfig,
      ),
    };
  }

  private calculateMegapixels(imageSize: string): number {
    const sizeMap: Record<string, number> = {
      square_hd: 1.048576, // 1024x1024
      square: 0.262144, // 512x512
      portrait_4_3: 0.786432, // 768x1024
      portrait_16_9: 1.327104, // 768x1728
      landscape_4_3: 0.786432, // 1024x768
      landscape_16_9: 1.327104, // 1728x768
    };

    return sizeMap[imageSize] || 1.048576; // Default to square_hd
  }

  private estimateProcessingTime(
    request: FALFluxRequest,
    modelConfig: any,
  ): number {
    // Base processing time varies by model
    const baseTime =
      {
        [EnhancedGenerationProvider.FAL_FLUX_SCHNELL]: 2, // 2 seconds
        [EnhancedGenerationProvider.FAL_FLUX_DEV]: 8, // 8 seconds
        [EnhancedGenerationProvider.FAL_FLUX_PRO]: 15, // 15 seconds
        [EnhancedGenerationProvider.FAL_FLUX_KONTEXT]: 12, // 12 seconds
      }[request.provider] || 10;

    // Adjust for number of images and steps
    const numImages = request.num_images || 1;
    const steps = request.num_inference_steps || modelConfig.maxSteps;
    const stepMultiplier = steps / modelConfig.maxSteps;

    return Math.ceil(baseTime * numImages * stepMultiplier);
  }

  private buildFALPayload(request: FALFluxRequest, modelConfig: any): any {
    const payload: any = {
      prompt: request.prompt,
      image_size: request.image_size || 'square_hd',
      num_inference_steps: Math.min(
        request.num_inference_steps || modelConfig.maxSteps,
        modelConfig.maxSteps,
      ),
      guidance_scale: request.guidance_scale || 3.5,
      num_images: Math.min(request.num_images || 1, 4),
      enable_safety_checker: request.enable_safety_checker !== false,
    };

    // Add optional parameters
    if (request.seed) {
      payload.seed = request.seed;
    }

    if (request.lora_path) {
      payload.loras = [
        {
          path: request.lora_path,
          scale: request.lora_scale || 1.0,
        },
      ];
    }

    // Model-specific parameters
    if (request.provider === EnhancedGenerationProvider.FAL_FLUX_SCHNELL) {
      // Schnell uses fewer steps for speed
      payload.num_inference_steps = Math.min(payload.num_inference_steps, 4);
    }

    return payload;
  }

  private async makeAPIRequest(endpoint: string, payload: any): Promise<any> {
    const url = `${this.falConfig.baseUrl}/${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.falConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `FAL API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return await response.json();
  }

  private async processResponse(
    response: any,
    request: FALFluxRequest,
  ): Promise<any[]> {
    const outputs = [];

    if (response.images && Array.isArray(response.images)) {
      for (let i = 0; i < response.images.length; i++) {
        const image = response.images[i];
        outputs.push({
          id: `fal_img_${Date.now()}_${i}`,
          url: image.url,
          format: 'png',
          size: await this.estimateImageSize(image.url),
          metadata: {
            seed: image.seed,
            content_type: image.content_type || 'image/png',
            width: image.width,
            height: image.height,
            inference_steps: request.num_inference_steps,
            guidance_scale: request.guidance_scale,
          },
        });
      }
    }

    return outputs;
  }

  private async estimateImageSize(url: string): Promise<number> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 1048576; // Default 1MB
    } catch {
      return 1048576; // Default 1MB if can't determine
    }
  }

  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / (this.falConfig.rateLimitPerSecond || 2);

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  // Override the base class healthCheck method
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Simple health check with a minimal request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${this.falConfig.baseUrl}/fal-ai/flux/schnell`,
        {
          method: 'HEAD',
          headers: {
            Authorization: `Key ${this.falConfig.apiKey}`,
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

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

  // Implement the abstract method required by BaseGenerationProvider
  protected async performHealthCheck(): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${this.falConfig.baseUrl}/fal-ai/flux/schnell`,
      {
        method: 'HEAD',
        headers: {
          Authorization: `Key ${this.falConfig.apiKey}`,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`FAL health check failed: HTTP ${response.status}`);
    }
  }

  validateRequest(request: GenerationRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const fluxRequest = request as unknown as FALFluxRequest;

    // Basic validation
    if (!fluxRequest.prompt?.trim()) {
      errors.push('Prompt is required');
    }

    if (fluxRequest.prompt && fluxRequest.prompt.length > 8000) {
      errors.push('Prompt exceeds maximum length of 8000 characters');
    }

    // Validate num_images
    if (
      fluxRequest.num_images &&
      (fluxRequest.num_images < 1 || fluxRequest.num_images > 4)
    ) {
      errors.push('Number of images must be between 1 and 4');
    }

    // Validate inference steps
    if (fluxRequest.num_inference_steps) {
      const modelConfig =
        this.models[fluxRequest.provider as keyof FALFluxModels];
      if (
        modelConfig &&
        fluxRequest.num_inference_steps > modelConfig.maxSteps
      ) {
        errors.push(
          `Number of inference steps cannot exceed ${modelConfig.maxSteps} for this model`,
        );
      }
    }

    // Validate guidance scale
    if (
      fluxRequest.guidance_scale &&
      (fluxRequest.guidance_scale < 1 || fluxRequest.guidance_scale > 20)
    ) {
      errors.push('Guidance scale must be between 1 and 20');
    }

    // Validate LoRA scale
    if (
      fluxRequest.lora_scale &&
      (fluxRequest.lora_scale < 0 || fluxRequest.lora_scale > 1)
    ) {
      errors.push('LoRA scale must be between 0 and 1');
    }

    return { valid: errors.length === 0, errors };
  }

  async cleanup(): Promise<void> {
    // Wait for any pending requests to complete
    if (this.requestQueue.length > 0) {
      try {
        await Promise.allSettled(this.requestQueue);
      } catch (error) {
        logger.warn('Some FAL requests did not complete during cleanup', {
          error,
        });
      }
    }

    this.requestQueue = [];
    logger.info('FAL provider cleanup completed');
  }
}
