/**
 * Base Generation Provider
 * Abstract interface for all generation providers
 */

import {
  GenerationRequest,
  GenerationResult,
  GenerationType,
  GenerationProvider,
  GenerationOutput,
} from '../../types';

export interface ProviderGenerationResult {
  outputs: GenerationOutput[];
  cost?: number;
  credits_used?: number;
  metadata?: Record<string, any>;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitPerSecond?: number;
}

export interface ProviderCapabilities {
  supportedTypes: GenerationType[];
  maxPromptLength: number;
  maxOutputs: number;
  supportsBatch: boolean;
  supportsCancel: boolean;
  supportsProgress: boolean;
  qualityLevels: string[];
  outputFormats: Partial<Record<GenerationType, string[]>>;
}

export abstract class BaseGenerationProvider {
  protected config: ProviderConfig;
  protected providerType: GenerationProvider;

  constructor(config: ProviderConfig, providerType: GenerationProvider) {
    this.config = config;
    this.providerType = providerType;
  }

  /**
   * Get provider capabilities
   */
  abstract getCapabilities(): ProviderCapabilities;

  /**
   * Validate if request is supported by this provider
   */
  validateRequest(request: GenerationRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const capabilities = this.getCapabilities();

    // Check if type is supported
    if (!capabilities.supportedTypes.includes(request.type)) {
      errors.push(`Generation type ${request.type} not supported`);
    }

    // Check prompt length
    if (request.prompt.length > capabilities.maxPromptLength) {
      errors.push(
        `Prompt exceeds maximum length of ${capabilities.maxPromptLength} characters`,
      );
    }

    // Type-specific validation
    this.validateTypeSpecificRequest(request, errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate content based on request
   */
  abstract generate(
    request: GenerationRequest,
  ): Promise<ProviderGenerationResult>;

  /**
   * Cancel generation (optional)
   */
  async cancelGeneration?(generationId: string): Promise<void>;

  /**
   * Get generation progress (optional)
   */
  async getProgress?(
    generationId: string,
  ): Promise<{ progress: number; status: string }>;

  /**
   * Estimate cost for generation
   */
  abstract estimateCost(request: GenerationRequest): Promise<number>;

  /**
   * Check provider health and availability
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.performHealthCheck();
      const latency = Date.now() - start;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Provider-specific health check implementation
   */
  protected abstract performHealthCheck(): Promise<void>;

  /**
   * Type-specific request validation
   */
  protected validateTypeSpecificRequest(
    request: GenerationRequest,
    errors: string[],
  ): void {
    // Override in specific providers for type-specific validation
  }

  /**
   * Rate limiting helper
   */
  protected async rateLimitDelay(): Promise<void> {
    if (this.config.rateLimitPerSecond) {
      const delay = 1000 / this.config.rateLimitPerSecond;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Retry wrapper for API calls
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts?: number,
  ): Promise<T> {
    const attempts = maxAttempts || this.config.retryAttempts || 3;
    let lastError: Error = new Error('No attempts were made');

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === attempts) {
          throw lastError;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Standard error handling
   */
  protected handleProviderError(error: any): Error {
    if (error.response) {
      // HTTP error
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
        case 401:
          return new Error(`Authentication failed: ${message}`);
        case 403:
          return new Error(`Access forbidden: ${message}`);
        case 429:
          return new Error(`Rate limit exceeded: ${message}`);
        case 500:
          return new Error(`Provider server error: ${message}`);
        default:
          return new Error(`Provider error (${status}): ${message}`);
      }
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new Error('Provider service unavailable');
    }

    if (error.code === 'ETIMEDOUT') {
      return new Error('Provider request timeout');
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Normalize output URLs for consistent format
   */
  protected normalizeOutputUrl(url: string): string {
    // Ensure HTTPS and handle various URL formats
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    if (url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }

    if (!url.startsWith('http')) {
      return `https://${url}`;
    }

    return url;
  }

  /**
   * Generate unique output ID
   */
  protected generateOutputId(): string {
    return `out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract file format from URL or content type
   */
  protected extractFormat(url: string, contentType?: string): string {
    if (contentType) {
      const formatMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'application/pdf': 'pdf',
        'text/plain': 'txt',
        'application/json': 'json',
      };

      if (formatMap[contentType]) {
        return formatMap[contentType];
      }
    }

    // Extract from URL
    const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  /**
   * Calculate file size from response headers or content
   */
  protected calculateFileSize(
    headers?: Record<string, string>,
    content?: Buffer,
  ): number {
    if (headers && headers['content-length']) {
      return parseInt(headers['content-length'], 10);
    }

    if (content) {
      return content.length;
    }

    return 0;
  }
}
