/**
 * GPT-4o Vision Provider
 * Integration with OpenAI GPT-4o for vision-enhanced image generation
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
  GPT4oVisionRequest,
  CostBreakdown,
} from '../../types/enhanced-types';
import { logger } from '@/lib/logger';

interface GPT4oConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  rateLimitPerSecond?: number;
  organization?: string;
}

interface VisionCapabilities {
  understanding_modes: string[];
  supported_formats: string[];
  max_image_size: number;
  max_images_per_request: number;
  vision_model: string;
  generation_model: string;
}

export class GPT4oVisionProvider extends BaseGenerationProvider {
  private gpt4oConfig: GPT4oConfig;
  private capabilities: VisionCapabilities;
  private lastRequestTime = 0;
  private requestQueue: Promise<any>[] = [];

  constructor(config: GPT4oConfig) {
    const baseConfig: ProviderConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      timeout: config.timeout || 120000,
      rateLimitPerSecond: config.rateLimitPerSecond || 3,
    };

    super(baseConfig, GenerationProvider.OPENAI);

    this.gpt4oConfig = {
      baseUrl: 'https://api.openai.com/v1',
      timeout: 120000, // 2 minutes for vision processing
      rateLimitPerSecond: 3,
      ...config,
    };

    this.capabilities = {
      understanding_modes: ['describe', 'analyze', 'enhance', 'style_transfer'],
      supported_formats: ['png', 'jpeg', 'webp', 'gif'],
      max_image_size: 20 * 1024 * 1024, // 20MB
      max_images_per_request: 10,
      vision_model: 'gpt-4o',
      generation_model: 'dall-e-3',
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedTypes: [GenerationType.IMAGE],
      maxPromptLength: 4000,
      maxOutputs: 1,
      supportsBatch: false,
      supportsCancel: false,
      supportsProgress: false,
      qualityLevels: ['standard', 'hd'],
      outputFormats: {
        [GenerationType.IMAGE]: ['png', 'jpeg', 'webp'],
      },
    };
  }

  async generate(
    request: GenerationRequest,
  ): Promise<ProviderGenerationResult> {
    const startTime = Date.now();
    const requestId = `gpt4o_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Validate request type
      if (request.type !== GenerationType.IMAGE) {
        throw new Error(
          `GPT-4o Vision provider does not support ${request.type} generation`,
        );
      }

      // Convert GenerationRequest to GPT4oVisionRequest with proper defaults
      const visionRequest: GPT4oVisionRequest = {
        type: GenerationType.IMAGE,
        organizationId: request.organizationId,
        userId: request.userId,
        prompt: request.prompt,
        priority: request.priority,
        metadata: request.metadata,
        provider: EnhancedGenerationProvider.OPENAI_GPT4O,
        understanding_mode: (request as any).understanding_mode || 'enhance',
        detail_level: (request as any).detail_level || 'high',
        response_format: (request as any).response_format || 'url',
        reference_image: (request as any).reference_image,
        vision_prompt: (request as any).vision_prompt,
        vision_temperature: (request as any).vision_temperature,
      };

      // Apply rate limiting
      await this.applyRateLimit();

      logger.info('Starting GPT-4o Vision generation', {
        requestId,
        understanding_mode: visionRequest.understanding_mode,
        has_reference_image: !!visionRequest.reference_image,
        detail_level: visionRequest.detail_level,
      });

      // Process vision understanding if reference image provided
      let enhancedPrompt = visionRequest.prompt;
      let visionInsights = null;

      if (visionRequest.reference_image) {
        visionInsights = await this.analyzeReferenceImage(visionRequest);
        enhancedPrompt = this.enhancePromptWithVision(
          visionRequest,
          visionInsights,
        );
      }

      // Generate image with enhanced prompt
      const imageResponse = await this.generateWithDalle3(
        enhancedPrompt,
        visionRequest,
      );

      // Process response
      const outputs = await this.processVisionResponse(
        imageResponse,
        visionRequest,
        visionInsights,
      );

      // Calculate costs (vision analysis + image generation)
      const costBreakdown = await this.calculateCost(
        visionRequest,
        visionInsights,
      );

      const processingTime = Date.now() - startTime;

      logger.info('GPT-4o Vision generation completed', {
        requestId,
        outputs: outputs.length,
        processingTime,
        cost: costBreakdown.final_price,
        vision_used: !!visionInsights,
      });

      return {
        outputs,
        cost: costBreakdown.final_price,
        credits_used: Math.ceil(costBreakdown.final_price * 100),
        metadata: {
          provider_id: requestId,
          model: 'gpt-4o + dall-e-3',
          processing_time: processingTime,
          cost_breakdown: costBreakdown,
          vision_insights: visionInsights,
          understanding_mode: visionRequest.understanding_mode,
          detail_level: visionRequest.detail_level,
          enhanced_prompt: enhancedPrompt,
        },
      };
    } catch (error) {
      logger.error(
        'GPT-4o Vision generation failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          requestId,
          prompt: request.prompt?.substring(0, 100),
        },
      );
      throw error;
    }
  }

  async estimateCost(request: GenerationRequest): Promise<number> {
    // Convert GenerationRequest to GPT4oVisionRequest with proper defaults
    const visionRequest: GPT4oVisionRequest = {
      type: GenerationType.IMAGE,
      organizationId: request.organizationId,
      userId: request.userId,
      prompt: request.prompt,
      priority: request.priority,
      metadata: request.metadata,
      provider: EnhancedGenerationProvider.OPENAI_GPT4O,
      understanding_mode: (request as any).understanding_mode || 'enhance',
      detail_level: (request as any).detail_level || 'high',
      response_format: (request as any).response_format || 'url',
      reference_image: (request as any).reference_image,
      vision_prompt: (request as any).vision_prompt,
      vision_temperature: (request as any).vision_temperature,
    };

    const costBreakdown = await this.calculateCost(visionRequest, null);
    return costBreakdown.final_price;
  }

  private async analyzeReferenceImage(
    request: GPT4oVisionRequest,
  ): Promise<any> {
    try {
      // Build vision analysis prompt based on understanding mode
      const visionPrompt = this.buildVisionPrompt(request);

      const visionResponse = await this.makeOpenAIRequest('/chat/completions', {
        model: this.capabilities.vision_model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: visionPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: request.reference_image,
                  detail: request.detail_level || 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: request.vision_temperature || 0.3,
      });

      const analysis = visionResponse.choices[0]?.message?.content;

      return {
        analysis,
        understanding_mode: request.understanding_mode,
        detail_level: request.detail_level,
        tokens_used: visionResponse.usage?.total_tokens || 0,
        model_used: this.capabilities.vision_model,
      };
    } catch (error) {
      logger.warn(
        'Vision analysis failed, proceeding without vision insights',
        { error },
      );
      return null;
    }
  }

  private buildVisionPrompt(request: GPT4oVisionRequest): string {
    const { understanding_mode, vision_prompt } = request;

    if (vision_prompt) {
      return vision_prompt;
    }

    switch (understanding_mode) {
      case 'describe':
        return 'Describe this image in detail, including objects, colors, composition, style, and mood. Focus on visual elements that could be used to generate a similar image.';

      case 'analyze':
        return 'Analyze this image thoroughly. Identify the artistic style, color palette, lighting, composition techniques, and any notable visual elements. Provide insights that could guide similar image generation.';

      case 'enhance':
        return `Analyze this image and suggest enhancements for generating an improved version. Consider: ${request.prompt}. How can we enhance the visual appeal, composition, or artistic quality?`;

      case 'style_transfer':
        return `Analyze the artistic style, technique, and visual characteristics of this image. Describe how this style could be applied to: ${request.prompt}. Focus on transferable style elements.`;

      default:
        return 'Describe this image in detail, focusing on elements that would be useful for generating similar content.';
    }
  }

  private enhancePromptWithVision(
    request: GPT4oVisionRequest,
    visionInsights: any,
  ): string {
    if (!visionInsights?.analysis) {
      return request.prompt;
    }

    const basePrompt = request.prompt;
    const visionAnalysis = visionInsights.analysis;

    switch (request.understanding_mode) {
      case 'describe':
        return `${basePrompt}, incorporating these visual elements: ${visionAnalysis}`;

      case 'analyze':
        return `${basePrompt}, with artistic style and composition inspired by: ${visionAnalysis}`;

      case 'enhance':
        return `${basePrompt}, enhanced based on these insights: ${visionAnalysis}`;

      case 'style_transfer':
        return `${basePrompt}, rendered in the style described as: ${visionAnalysis}`;

      default:
        return `${basePrompt}, with visual inspiration from: ${visionAnalysis}`;
    }
  }

  private async generateWithDalle3(
    prompt: string,
    request: GPT4oVisionRequest,
  ): Promise<any> {
    // Extract DALL-E specific properties from metadata or use defaults
    const metadata = request.metadata || {};

    const dalleRequest = {
      model: this.capabilities.generation_model,
      prompt: prompt.substring(0, 4000), // DALL-E 3 limit
      n: 1, // DALL-E 3 only supports n=1
      size: this.mapSize(metadata.size || '1024x1024'),
      quality: metadata.quality || 'standard',
      response_format: request.response_format || 'url',
      style: metadata.style || 'vivid',
      user: request.userId || undefined,
    };

    return await this.makeOpenAIRequest('/images/generations', dalleRequest);
  }

  private mapSize(size: string): string {
    // Map common sizes to DALL-E 3 supported sizes
    const sizeMap: Record<string, string> = {
      square: '1024x1024',
      portrait: '1024x1792',
      landscape: '1792x1024',
      '1024x1024': '1024x1024',
      '1024x1792': '1024x1792',
      '1792x1024': '1792x1024',
    };

    return sizeMap[size] || '1024x1024';
  }

  private async processVisionResponse(
    imageResponse: any,
    request: GPT4oVisionRequest,
    visionInsights: any,
  ): Promise<any[]> {
    const outputs = [];

    if (imageResponse.data && Array.isArray(imageResponse.data)) {
      for (let i = 0; i < imageResponse.data.length; i++) {
        const image = imageResponse.data[i];
        outputs.push({
          id: `gpt4o_img_${Date.now()}_${i}`,
          url: image.url || image.b64_json,
          format: 'png',
          size: await this.estimateImageSize(image.url),
          metadata: {
            revised_prompt: image.revised_prompt,
            understanding_mode: request.understanding_mode,
            detail_level: request.detail_level,
            vision_enhanced: !!visionInsights,
            vision_analysis: visionInsights?.analysis,
            quality: request.metadata?.quality || 'standard',
            style: request.metadata?.style || 'vivid',
            model_used: this.capabilities.generation_model,
          },
        });
      }
    }

    return outputs;
  }

  private async calculateCost(
    request: GPT4oVisionRequest,
    visionInsights: any,
  ): Promise<CostBreakdown> {
    // Base DALL-E 3 costs
    const dalle3Costs = {
      standard_1024x1024: 0.04,
      standard_1024x1792: 0.08,
      standard_1792x1024: 0.08,
      hd_1024x1024: 0.08,
      hd_1024x1792: 0.12,
      hd_1792x1024: 0.12,
    };

    const metadata = request.metadata || {};
    const size = this.mapSize(metadata.size || '1024x1024');
    const quality = metadata.quality || 'standard';
    const costKey = `${quality}_${size}`;
    const imageCost = dalle3Costs[costKey as keyof typeof dalle3Costs] || 0.04;

    // Vision analysis cost (GPT-4o with vision)
    let visionCost = 0;
    if (request.reference_image) {
      const tokensUsed = visionInsights?.tokens_used || 1000;
      const inputCostPer1K = 0.01; // GPT-4o vision input cost
      const outputCostPer1K = 0.03; // GPT-4o vision output cost

      visionCost =
        (tokensUsed / 1000) * inputCostPer1K + (500 / 1000) * outputCostPer1K; // Estimate 500 output tokens
    }

    const providerCost = imageCost + visionCost;
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
      provider_name: 'OpenAI GPT-4o + DALL-E 3',
      model_name: `${this.capabilities.vision_model} + ${this.capabilities.generation_model}`,
      estimated_processing_time: this.estimateProcessingTime(
        request,
        visionInsights,
      ),
    };
  }

  private estimateProcessingTime(
    request: GPT4oVisionRequest,
    visionInsights: any,
  ): number {
    let baseTime = 15; // 15 seconds for DALL-E 3

    // Add time for vision analysis
    if (request.reference_image) {
      baseTime += 10; // 10 seconds for vision analysis
    }

    // Adjust for quality
    const metadata = request.metadata || {};
    if (metadata.quality === 'hd') {
      baseTime *= 1.5;
    }

    // Adjust for detail level
    if (request.detail_level === 'high') {
      baseTime *= 1.2;
    }

    return Math.ceil(baseTime);
  }

  private async makeOpenAIRequest(
    endpoint: string,
    payload: any,
  ): Promise<any> {
    const url = `${this.gpt4oConfig.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.gpt4oConfig.apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Organization': this.gpt4oConfig.organization || '',
        'User-Agent': 'ElizaOS-Platform/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return await response.json();
  }

  private async estimateImageSize(url?: string): Promise<number> {
    if (!url) {
      return 1024 * 1024;
    } // 1MB default

    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 1024 * 1024;
    } catch {
      return 1024 * 1024; // Default 1MB if can't determine
    }
  }

  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / (this.gpt4oConfig.rateLimitPerSecond || 3);

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  protected async performHealthCheck(): Promise<void> {
    // Simple health check with models endpoint
    const response = await fetch(`${this.gpt4oConfig.baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.gpt4oConfig.apiKey}`,
        'OpenAI-Organization': this.gpt4oConfig.organization || '',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Health check failed: HTTP ${response.status}`);
    }
  }

  validateRequest(request: GenerationRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // First validate basic requirements
    if (request.type !== GenerationType.IMAGE) {
      errors.push('Request type must be IMAGE for GPT-4o Vision provider');
      return { valid: false, errors };
    }

    // Convert to vision request for detailed validation
    const visionRequest: GPT4oVisionRequest = {
      type: GenerationType.IMAGE,
      organizationId: request.organizationId,
      userId: request.userId,
      prompt: request.prompt,
      priority: request.priority,
      metadata: request.metadata,
      provider: EnhancedGenerationProvider.OPENAI_GPT4O,
      understanding_mode: (request as any).understanding_mode || 'enhance',
      detail_level: (request as any).detail_level || 'high',
      response_format: (request as any).response_format || 'url',
      reference_image: (request as any).reference_image,
      vision_prompt: (request as any).vision_prompt,
      vision_temperature: (request as any).vision_temperature,
    };

    // Basic validation
    if (!visionRequest.prompt?.trim()) {
      errors.push('Prompt is required');
    }

    if (visionRequest.prompt && visionRequest.prompt.length > 4000) {
      errors.push('Prompt exceeds maximum length of 4000 characters');
    }

    // Validate understanding mode
    if (
      visionRequest.understanding_mode &&
      !this.capabilities.understanding_modes.includes(
        visionRequest.understanding_mode,
      )
    ) {
      errors.push(
        `Understanding mode must be one of: ${this.capabilities.understanding_modes.join(', ')}`,
      );
    }

    // Validate reference image URL
    if (visionRequest.reference_image) {
      try {
        new URL(visionRequest.reference_image);
      } catch {
        errors.push('Reference image must be a valid URL');
      }
    }

    // Validate detail level
    if (
      visionRequest.detail_level &&
      !['low', 'high'].includes(visionRequest.detail_level)
    ) {
      errors.push('Detail level must be either "low" or "high"');
    }

    // Validate vision temperature
    if (
      visionRequest.vision_temperature &&
      (visionRequest.vision_temperature < 0 ||
        visionRequest.vision_temperature > 2)
    ) {
      errors.push('Vision temperature must be between 0 and 2');
    }

    // Validate response format
    if (
      visionRequest.response_format &&
      !['url', 'b64_json'].includes(visionRequest.response_format)
    ) {
      errors.push('Response format must be either "url" or "b64_json"');
    }

    return { valid: errors.length === 0, errors };
  }

  async cleanup(): Promise<void> {
    // Wait for any pending requests to complete
    if (this.requestQueue.length > 0) {
      try {
        await Promise.allSettled(this.requestQueue);
      } catch (error) {
        logger.warn(
          'Some GPT-4o Vision requests did not complete during cleanup',
          { error },
        );
      }
    }

    this.requestQueue = [];
    logger.info('GPT-4o Vision provider cleanup completed');
  }
}
