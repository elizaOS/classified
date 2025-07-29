/**
 * Generation Service
 * Production-ready core business logic for multi-modal content generation
 */

import {
  GenerationRequest,
  GenerationResult,
  GenerationType,
  GenerationStatus,
  GenerationProvider,
  BatchGenerationRequest,
  BatchGenerationResult,
  GenerationAnalytics,
  Project,
  ApiResponse,
} from '../types';
import { BaseGenerationProvider } from './providers/BaseGenerationProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { ElevenLabsProvider } from './providers/ElevenLabsProvider';
import { GoogleVeoProvider } from './providers/GoogleVeoProvider';
import { StableDiffusionProvider } from './providers/StableDiffusionProvider';
import { FALProvider } from './providers/FALProvider';
import { GenerationQueueService, QueueEvents } from './GenerationQueueService';
import { getDatabaseClient } from '@/lib/database';
import { IStorageService } from '@/lib/services/storage';
import { getBillingService, addCredits, deductCredits } from '@/lib/billing';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';
import {
  isImageGenerationRequest,
  isVideoGenerationRequest,
  TrackedPromise,
} from '@/lib/types/common';

// Type aliases and extended interfaces
type DatabaseClient = ReturnType<typeof getDatabaseClient>;

// Extended billing service interface
interface ExtendedBillingService {
  getOrganizationBilling(
    organizationId: string,
  ): Promise<{ hasActiveSubscription: boolean; creditsRemaining: number }>;
  getSpendingLimits(organizationId: string): Promise<{ monthlyLimit: number }>;
  getCurrentMonthSpending(organizationId: string): Promise<number>;
  checkGenerationLimits(
    organizationId: string,
    type: GenerationType,
    provider?: GenerationProvider,
  ): Promise<{ allowed: boolean; reason?: string }>;
  reserveCredits(organizationId: string, amount: number): Promise<void>;
  releaseReservedCredits(organizationId: string): Promise<void>;
  chargeCredits(
    organizationId: string,
    amount: number,
    description: string,
  ): Promise<void>;
}

// Production configuration constants
const GENERATION_CONFIG = {
  MAX_CONCURRENT_GENERATIONS: 5,
  CREDIT_RESERVE_TIMEOUT_MS: 300000, // 5 minutes
  PROCESSING_LOCK_TIMEOUT_MS: 600000, // 10 minutes
  MAX_RETRIES: 3,
  MAX_PROMPT_LENGTH: 8000,
  MAX_BATCH_SIZE: 50,
  CLEANUP_INTERVAL_MS: 300000, // 5 minutes
} as const;

export class GenerationService {
  private providers: Map<GenerationProvider, BaseGenerationProvider> =
    new Map();
  private storage: IStorageService;
  private billing: ExtendedBillingService;
  private queueService: GenerationQueueService;

  // Concurrency and resource management
  private processingLocks = new Map<string, Promise<any>>();
  private concurrentGenerations = new Map<string, number>();
  private cleanupInterval!: NodeJS.Timeout; // Will be initialized in startCleanupInterval
  private isShuttingDown = false;

  constructor(
    storage: IStorageService,
    billing: ReturnType<typeof getBillingService>,
  ) {
    this.storage = storage;
    this.billing = this.createExtendedBilling(billing);

    // Initialize the production queue service
    this.queueService = new GenerationQueueService({
      maxConcurrentJobs: GENERATION_CONFIG.MAX_CONCURRENT_GENERATIONS,
      maxRetries: GENERATION_CONFIG.MAX_RETRIES,
      processingTimeoutMs: GENERATION_CONFIG.PROCESSING_LOCK_TIMEOUT_MS,
      pollIntervalMs: 5000, // Poll every 5 seconds
      deadLetterQueueEnabled: true,
    });

    this.initializeProviders();
    this.initializeQueueWorkers();
    this.startCleanupInterval();
  }

  private createExtendedBilling(
    billing: ReturnType<typeof getBillingService>,
  ): ExtendedBillingService {
    const reservedCredits = new Map<string, number>();

    return {
      ...billing,
      checkGenerationLimits: async (
        organizationId: string,
        type: GenerationType,
        provider?: GenerationProvider,
      ) => {
        const { creditsRemaining } =
          await billing.getOrganizationBilling(organizationId);
        const estimatedCost = this.calculateCredits(
          type,
          provider || GenerationProvider.OPENAI,
        );

        if (creditsRemaining < estimatedCost) {
          return { allowed: false, reason: 'Insufficient credits' };
        }

        const { monthlyLimit } =
          await billing.getSpendingLimits(organizationId);
        const monthlySpending =
          await billing.getCurrentMonthSpending(organizationId);

        if (monthlySpending + estimatedCost > monthlyLimit) {
          return { allowed: false, reason: 'Monthly spending limit exceeded' };
        }

        return { allowed: true };
      },
      reserveCredits: async (organizationId: string, amount: number) => {
        const current = reservedCredits.get(organizationId) || 0;
        reservedCredits.set(organizationId, current + amount);
      },
      releaseReservedCredits: async (organizationId: string) => {
        reservedCredits.delete(organizationId);
      },
      chargeCredits: async (
        organizationId: string,
        amount: number,
        description: string,
      ) => {
        await deductCredits({
          organizationId,
          userId: 'system',
          amount,
          description,
          metadata: { source: 'generation' },
        });
        reservedCredits.delete(organizationId);
      },
    };
  }

  private initializeProviders(): void {
    // Initialize all generation providers
    this.providers.set(GenerationProvider.OPENAI, new OpenAIProvider());
    this.providers.set(GenerationProvider.ANTHROPIC, new AnthropicProvider());
    this.providers.set(GenerationProvider.ELEVENLABS, new ElevenLabsProvider());
    this.providers.set(GenerationProvider.GOOGLE_VEO, new GoogleVeoProvider());
    this.providers.set(
      GenerationProvider.STABLE_DIFFUSION,
      new StableDiffusionProvider(),
    );
    this.providers.set(GenerationProvider.FAL, new FALProvider());
  }

  private initializeQueueWorkers(): void {
    // Register workers for different generation types

    // Text generation worker
    this.queueService.registerWorker(
      'text-worker',
      ['text', 'code', 'document'],
      async (job) => {
        try {
          await this.processGeneration(job.generationId);
          return { success: true };
        } catch (error) {
          logger.error('Text generation worker failed', undefined, {
            error: error instanceof Error ? error.message : String(error),
            jobId: job.id,
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retry: true,
          };
        }
      },
      2, // Allow 2 concurrent text generations
    );

    // Image generation worker
    this.queueService.registerWorker(
      'image-worker',
      ['image'],
      async (job) => {
        try {
          await this.processGeneration(job.generationId);
          return { success: true };
        } catch (error) {
          logger.error('Image generation worker failed', undefined, {
            error: error instanceof Error ? error.message : String(error),
            jobId: job.id,
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retry: true,
          };
        }
      },
      1, // Allow 1 concurrent image generation
    );

    // Video generation worker (more resource intensive)
    this.queueService.registerWorker(
      'video-worker',
      ['video'],
      async (job) => {
        try {
          await this.processGeneration(job.generationId);
          return { success: true };
        } catch (error) {
          logger.error('Video generation worker failed', undefined, {
            error: error instanceof Error ? error.message : String(error),
            jobId: job.id,
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retry: true,
          };
        }
      },
      1, // Allow 1 concurrent video generation
    );

    // Audio generation worker
    this.queueService.registerWorker(
      'audio-worker',
      ['audio', 'speech', 'music'],
      async (job) => {
        try {
          await this.processGeneration(job.generationId);
          return { success: true };
        } catch (error) {
          logger.error('Audio generation worker failed', undefined, {
            error: error instanceof Error ? error.message : String(error),
            jobId: job.id,
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retry: true,
          };
        }
      },
      1, // Allow 1 concurrent audio generation
    );

    // 3D and Avatar generation worker (most resource intensive)
    this.queueService.registerWorker(
      'special-worker',
      ['three_d', 'avatar'],
      async (job) => {
        try {
          await this.processGeneration(job.generationId);
          return { success: true };
        } catch (error) {
          logger.error('Special generation worker failed', undefined, {
            error: error instanceof Error ? error.message : String(error),
            jobId: job.id,
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retry: true,
          };
        }
      },
      1, // Allow 1 concurrent special generation
    );

    // Set up event listeners for queue monitoring
    this.queueService.on(QueueEvents.JOB_COMPLETED, (event: any) => {
      logger.info('Generation job completed', {
        jobId: event.job.id,
        generationId: event.job.generationId,
        processingTime: event.processingTime,
      });

      // Decrement concurrent counter
      const currentCount =
        this.concurrentGenerations.get(event.job.data.organizationId) || 0;
      this.concurrentGenerations.set(
        event.job.data.organizationId,
        Math.max(0, currentCount - 1),
      );
    });

    this.queueService.on(QueueEvents.JOB_FAILED, (event: any) => {
      logger.error('Generation job failed permanently', undefined, {
        jobId: event.job.id,
        generationId: event.job.generationId,
        error: event.error,
      });

      // Decrement concurrent counter
      const currentCount =
        this.concurrentGenerations.get(event.job.data.organizationId) || 0;
      this.concurrentGenerations.set(
        event.job.data.organizationId,
        Math.max(0, currentCount - 1),
      );
    });

    this.queueService.on(QueueEvents.JOB_RETRYING, (event: any) => {
      logger.warn('Generation job retrying', {
        jobId: event.job.id,
        generationId: event.job.generationId,
        attempt: event.job.attempts + 1,
        error: event.error,
      });
    });

    // Start the queue service
    this.queueService.start().catch((error) => {
      logger.error('Failed to start queue service', error);
    });

    logger.info('Generation queue workers initialized', {
      workers: 5,
      totalConcurrency: 6,
    });
  }

  /**
   * Create a new generation request with production-grade safety
   */
  async createGeneration(
    request: GenerationRequest,
  ): Promise<ApiResponse<GenerationResult>> {
    const requestId = this.generateRequestId();
    const context = {
      requestId,
      userId: request.userId,
      organizationId: request.organizationId,
    };

    try {
      // Early validation
      const validation = this.validateRequest(request);
      if (!validation.valid) {
        logger.warn('Invalid generation request', {
          context,
          errors: validation.errors,
        });
        return {
          success: false,
          error: `Invalid request: ${validation.errors.join(', ')}`,
          code: 'VALIDATION_ERROR',
        };
      }

      // Check if we're shutting down
      if (this.isShuttingDown) {
        return {
          success: false,
          error: 'Service is shutting down',
          code: 'SERVICE_UNAVAILABLE',
        };
      }

      // Create idempotency key for deduplication
      const idempotencyKey = this.createIdempotencyKey(request);

      // Check for existing generation with same key
      const db = await getDatabaseClient();
      const existingGeneration =
        await db.generations.findByIdempotencyKey(idempotencyKey);
      if (existingGeneration) {
        logger.info('Returning existing generation for idempotency key', {
          context,
          existingId: existingGeneration.id,
          idempotencyKey,
        });
        return { success: true, data: existingGeneration };
      }

      // Use processing lock to prevent race conditions
      if (this.processingLocks.has(idempotencyKey)) {
        logger.info('Waiting for existing generation request', {
          context,
          idempotencyKey,
        });
        return await this.processingLocks.get(idempotencyKey);
      }

      const promise = this.doCreateGeneration(request, idempotencyKey, context);
      this.processingLocks.set(idempotencyKey, promise);

      try {
        return await promise;
      } finally {
        this.processingLocks.delete(idempotencyKey);
      }
    } catch (error) {
      logger.error(
        'Failed to create generation:',
        error instanceof Error ? error : undefined,
        { context },
      );
      return {
        success: false,
        error: 'Failed to create generation',
        code: 'CREATION_FAILED',
      };
    }
  }

  /**
   * Internal method to create generation with transaction safety
   */
  private async doCreateGeneration(
    request: GenerationRequest,
    idempotencyKey: string,
    context: any,
  ): Promise<ApiResponse<GenerationResult>> {
    let creditsReserved = false;

    try {
      // Check concurrent generation limits
      const currentConcurrent =
        this.concurrentGenerations.get(request.organizationId) || 0;
      if (currentConcurrent >= GENERATION_CONFIG.MAX_CONCURRENT_GENERATIONS) {
        logger.warn('Concurrent generation limit exceeded', {
          context,
          current: currentConcurrent,
          limit: GENERATION_CONFIG.MAX_CONCURRENT_GENERATIONS,
        });
        return {
          success: false,
          error: 'Too many concurrent generations',
          code: 'RATE_LIMIT_EXCEEDED',
        };
      }

      // Validate user credits and limits
      const canGenerate = await this.billing.checkGenerationLimits(
        request.organizationId,
        request.type,
        request.provider,
      );

      if (!canGenerate.allowed) {
        logger.warn('Generation denied by billing service', {
          context,
          reason: canGenerate.reason,
        });
        return {
          success: false,
          error: 'Insufficient credits or limits exceeded',
          code: 'INSUFFICIENT_CREDITS',
          message: canGenerate.reason,
        };
      }

      // Select optimal provider if not specified
      const provider =
        request.provider || (await this.selectOptimalProvider(request));

      // Estimate and reserve credits
      const estimatedCost = await this.estimateGenerationCost(
        request,
        provider,
      );
      await this.billing.reserveCredits(request.organizationId, estimatedCost);
      creditsReserved = true;

      // Create generation record in database using transaction
      const db = await getDatabaseClient();
      const generation = await db.transaction(async (tx: any) => {
        const generationId = this.generateId();
        const gen = await db.generations.create(
          {
            ...request,
            id: generationId,
            provider,
            status: GenerationStatus.QUEUED,
            idempotencyKey,
            estimatedCost,
            createdAt: new Date(),
          },
          { transaction: tx },
        );

        return gen;
      });

      logger.info('Generation created successfully', {
        context,
        generationId: generation.id,
        provider,
        type: request.type,
      });

      // Increment concurrent counter
      this.concurrentGenerations.set(
        request.organizationId,
        currentConcurrent + 1,
      );

      // Queue for processing
      await this.queueGeneration(generation);

      return {
        success: true,
        data: generation,
      };
    } catch (error) {
      if (creditsReserved) {
        try {
          await this.billing.releaseReservedCredits(request.organizationId);
        } catch (releaseError: any) {
          logger.error('Failed to release reserved credits', releaseError, {
            context,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Process a generation request
   */
  async processGeneration(generationId: string): Promise<void> {
    try {
      const db = await getDatabaseClient();
      const generation = await db.generations.findById(generationId);
      if (!generation) {
        throw new Error(`Generation ${generationId} not found`);
      }

      // Update status to processing
      await this.updateGenerationStatus(
        generationId,
        GenerationStatus.PROCESSING,
      );

      const provider = this.providers.get(generation.provider);
      if (!provider) {
        throw new Error(`Provider ${generation.provider} not available`);
      }

      // Reserve credits (using type and provider)
      const creditAmount = this.calculateCredits(
        generation.type,
        generation.provider,
      );
      await this.billing.reserveCredits(
        generation.organizationId,
        creditAmount,
      );

      const startTime = Date.now();

      try {
        // Generate content - reconstruct the original request from stored generation
        // The generation object contains all the original request data
        const generationRequest: any = {
          userId: generation.userId,
          organizationId: generation.organizationId,
          type: generation.type,
          prompt: generation.prompt,
          priority: (generation as any).priority || 'normal',
          provider: generation.provider,
          metadata: generation.metadata,
          // Include any type-specific properties from the original request
          ...(generation as any),
        };

        const result = await provider.generate(generationRequest);

        // Upload outputs to storage
        const outputs = await Promise.all(
          result.outputs.map(async (output) => {
            // Fetch content from the URL
            const response = await fetch(output.url);
            if (!response.ok) {
              throw new Error(`Failed to fetch output from ${output.url}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());

            // Upload to storage
            const uploadResult = await this.storage.upload(
              `generations/${generationId}/${output.id}.${output.format}`,
              buffer,
              {
                contentType: response.headers.get('content-type') || undefined,
                metadata: {
                  organizationId: generation.organizationId,
                  generationType: generation.type,
                  provider: generation.provider,
                },
              },
            );

            return {
              ...output,
              url: uploadResult.url || uploadResult.key,
            };
          }),
        );

        const processingTime = Date.now() - startTime;

        // Update generation with results
        await db.generations.update(generationId, {
          status: GenerationStatus.COMPLETED,
          outputs,
          completedAt: new Date(),
          processing_time: processingTime,
          cost: result.cost,
          credits_used: result.credits_used,
        });

        // Charge credits
        await this.billing.chargeCredits(
          generation.organizationId,
          result.credits_used ||
            this.calculateCredits(generation.type, generation.provider),
          `Generation: ${generation.type} via ${generation.provider}`,
        );

        // Send webhook notification if configured
        const callbackUrl = (generation.metadata as any)?.callback_url;
        if (callbackUrl) {
          await this.sendWebhook(callbackUrl, {
            event: 'generation.completed',
            data: {
              ...generation,
              outputs,
              status: GenerationStatus.COMPLETED,
            },
          });
        }
      } catch (error: any) {
        // Handle generation failure
        await this.updateGenerationStatus(
          generationId,
          GenerationStatus.FAILED,
          error.message,
        );

        // Release reserved credits
        await this.billing.releaseReservedCredits(generation.organizationId);

        throw error;
      }
    } catch (error: any) {
      logger.error(`Failed to process generation ${generationId}:`, error);
      throw error;
    }
  }

  /**
   * Create batch generation request
   */
  async createBatchGeneration(
    request: BatchGenerationRequest,
  ): Promise<ApiResponse<BatchGenerationResult>> {
    try {
      const batchId = this.generateId();

      // Create individual generations
      const generations: GenerationResult[] = [];

      for (const genRequest of request.generations) {
        const result = await this.createGeneration(genRequest);
        if (result.success && result.data) {
          generations.push(result.data);
        }
      }

      const batch: BatchGenerationResult = {
        id: batchId,
        name: request.batch_name,
        organizationId: request.generations[0].organizationId,
        userId: request.generations[0].userId,
        status: GenerationStatus.QUEUED,
        total_generations: request.generations.length,
        completed_generations: 0,
        failed_generations: 0,
        generations,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const db = await getDatabaseClient();
      await db.batchGenerations.create(batch);

      return {
        success: true,
        data: batch,
      };
    } catch (error: any) {
      logger.error('Failed to create batch generation:', error);
      return {
        success: false,
        error: 'Failed to create batch generation',
        code: 'BATCH_CREATION_FAILED',
      };
    }
  }

  /**
   * Get generation by ID
   */
  async getGeneration(id: string): Promise<ApiResponse<GenerationResult>> {
    try {
      const db = await getDatabaseClient();
      const generation = await db.generations.findById(id);

      if (!generation) {
        return {
          success: false,
          error: 'Generation not found',
          code: 'NOT_FOUND',
        };
      }

      return {
        success: true,
        data: generation,
      };
    } catch (error: any) {
      logger.error(`Failed to get generation ${id}:`, error);
      return {
        success: false,
        error: 'Failed to retrieve generation',
        code: 'RETRIEVAL_FAILED',
      };
    }
  }

  /**
   * List generations with pagination and filtering
   */
  async listGenerations(params: {
    organizationId: string;
    userId?: string;
    projectId?: string;
    type?: GenerationType;
    status?: GenerationStatus;
    provider?: GenerationProvider;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<GenerationResult[]>> {
    try {
      const db = await getDatabaseClient();
      const result = await db.generations.list(params);

      return {
        success: true,
        data: result.data,
        meta: {
          total: result.total,
          page: params.page || 1,
          limit: params.limit || 20,
          hasMore: result.hasMore,
        },
      };
    } catch (error: any) {
      logger.error('Failed to list generations:', error);
      return {
        success: false,
        error: 'Failed to list generations',
        code: 'LIST_FAILED',
      };
    }
  }

  /**
   * Cancel a generation
   */
  async cancelGeneration(id: string): Promise<ApiResponse<void>> {
    try {
      const db = await getDatabaseClient();
      const generation = await db.generations.findById(id);

      if (!generation) {
        return {
          success: false,
          error: 'Generation not found',
          code: 'NOT_FOUND',
        };
      }

      if (generation.status === GenerationStatus.COMPLETED) {
        return {
          success: false,
          error: 'Cannot cancel completed generation',
          code: 'INVALID_STATUS',
        };
      }

      // Cancel with provider if processing
      if (generation.status === GenerationStatus.PROCESSING) {
        const provider = this.providers.get(generation.provider);
        if (provider && provider.cancelGeneration) {
          await provider.cancelGeneration(id);
        }
      }

      await this.updateGenerationStatus(id, GenerationStatus.CANCELLED);

      // Release any reserved credits
      await this.billing.releaseReservedCredits(generation.organizationId);

      return {
        success: true,
      };
    } catch (error: any) {
      logger.error(`Failed to cancel generation ${id}:`, error);
      return {
        success: false,
        error: 'Failed to cancel generation',
        code: 'CANCELLATION_FAILED',
      };
    }
  }

  /**
   * Get generation analytics
   */
  async getAnalytics(params: {
    organizationId: string;
    period: 'hour' | 'day' | 'week' | 'month';
    startDate: Date;
    endDate: Date;
  }): Promise<ApiResponse<GenerationAnalytics>> {
    try {
      const db = await getDatabaseClient();
      const analytics = await db.generations.getAnalytics(params);

      return {
        success: true,
        data: analytics,
      };
    } catch (error: any) {
      logger.error('Failed to get generation analytics:', error);
      return {
        success: false,
        error: 'Failed to retrieve analytics',
        code: 'ANALYTICS_FAILED',
      };
    }
  }

  // Private helper methods

  private async selectOptimalProvider(
    request: GenerationRequest,
  ): Promise<GenerationProvider> {
    // Provider selection logic based on type, quality, cost, and availability
    const typeProviders = this.getProvidersForType(request.type);

    // Get provider performance metrics
    const db = await getDatabaseClient();
    const providerMetrics = await Promise.all(
      typeProviders.map(async (provider) => {
        const metrics = await db.providerMetrics.getMetrics(
          provider,
          request.type,
        );
        return {
          provider,
          score: this.calculateProviderScore(metrics, request),
        };
      }),
    );

    // Select provider with highest score
    const bestProvider = providerMetrics.reduce((best, current) =>
      current.score > best.score ? current : best,
    );

    return bestProvider.provider;
  }

  private getProvidersForType(type: GenerationType): GenerationProvider[] {
    const providerMap: Record<GenerationType, GenerationProvider[]> = {
      [GenerationType.TEXT]: [
        GenerationProvider.OPENAI,
        GenerationProvider.ANTHROPIC,
      ],
      [GenerationType.IMAGE]: [
        GenerationProvider.OPENAI,
        GenerationProvider.STABLE_DIFFUSION,
        GenerationProvider.FAL,
      ],
      [GenerationType.VIDEO]: [
        GenerationProvider.GOOGLE_VEO,
        GenerationProvider.FAL,
      ],
      [GenerationType.AUDIO]: [
        GenerationProvider.ELEVENLABS,
        GenerationProvider.OPENAI,
      ],
      [GenerationType.SPEECH]: [
        GenerationProvider.ELEVENLABS,
        GenerationProvider.OPENAI,
      ],
      [GenerationType.MUSIC]: [GenerationProvider.FAL],
      [GenerationType.THREE_D]: [GenerationProvider.FAL],
      [GenerationType.AVATAR]: [
        GenerationProvider.READY_PLAYER_ME,
        GenerationProvider.FAL,
      ],
      [GenerationType.CODE]: [
        GenerationProvider.OPENAI,
        GenerationProvider.ANTHROPIC,
      ],
      [GenerationType.DOCUMENT]: [
        GenerationProvider.OPENAI,
        GenerationProvider.ANTHROPIC,
      ],
    };

    return providerMap[type] || [GenerationProvider.OPENAI];
  }

  private calculateProviderScore(
    metrics: any,
    request: GenerationRequest,
  ): number {
    // Scoring algorithm considering success rate, speed, cost, and quality
    const successRateWeight = 0.4;
    const speedWeight = 0.3;
    const costWeight = 0.2;
    const qualityWeight = 0.1;

    return (
      metrics.successRate * successRateWeight +
      (1 / metrics.averageProcessingTime) * speedWeight +
      (1 / metrics.averageCost) * costWeight +
      metrics.qualityScore * qualityWeight
    );
  }

  private async queueGeneration(generation: GenerationResult): Promise<void> {
    try {
      // Determine the queue name based on generation type
      const queueName = this.getQueueNameForType(generation.type);

      // Calculate priority (higher number = higher priority)
      const priority = this.calculateQueuePriority(generation);

      // Add job to the production queue with metadata
      const jobId = await this.queueService.addJob(
        generation.id,
        queueName,
        priority,
        undefined, // Schedule immediately
        {
          organizationId: generation.organizationId,
          userId: generation.userId,
          type: generation.type,
          provider: generation.provider,
          prompt: generation.prompt?.substring(0, 100), // Store truncated prompt for debugging
        },
      );

      logger.info('Generation queued successfully', {
        generationId: generation.id,
        jobId,
        queueName,
        priority,
        type: generation.type,
        provider: generation.provider,
      });
    } catch (error) {
      logger.error('Failed to queue generation', undefined, {
        error: error instanceof Error ? error.message : String(error),
        generationId: generation.id,
      });

      // Fallback: mark generation as failed
      await this.updateGenerationStatus(
        generation.id,
        GenerationStatus.FAILED,
        'Failed to queue generation',
      );
      throw error;
    }
  }

  /**
   * Get the appropriate queue name for a generation type
   */
  private getQueueNameForType(type: GenerationType): string {
    const queueMap: Record<GenerationType, string> = {
      [GenerationType.TEXT]: 'text',
      [GenerationType.CODE]: 'text',
      [GenerationType.DOCUMENT]: 'text',
      [GenerationType.IMAGE]: 'image',
      [GenerationType.VIDEO]: 'video',
      [GenerationType.AUDIO]: 'audio',
      [GenerationType.SPEECH]: 'audio',
      [GenerationType.MUSIC]: 'audio',
      [GenerationType.THREE_D]: 'three_d',
      [GenerationType.AVATAR]: 'avatar',
    };

    return queueMap[type] || 'text';
  }

  /**
   * Calculate queue priority based on generation characteristics
   */
  private calculateQueuePriority(generation: GenerationResult): number {
    let priority = 5; // Default priority

    // Higher priority for premium users (if available in metadata)
    if (generation.metadata?.tier === 'premium') {
      priority += 2;
    }

    // Higher priority for interactive generations (if applicable)
    if (generation.metadata?.interactive === true) {
      priority += 1;
    }

    // Lower priority for batch generations
    if (generation.metadata?.batch === true) {
      priority -= 1;
    }

    // Type-based priority adjustments
    switch (generation.type) {
      case GenerationType.TEXT:
      case GenerationType.CODE:
        priority += 1; // Text is generally faster
        break;
      case GenerationType.VIDEO:
      case GenerationType.THREE_D:
        priority -= 1; // Video/3D takes longer
        break;
    }

    return Math.max(1, Math.min(10, priority)); // Clamp between 1-10
  }

  private async updateGenerationStatus(
    id: string,
    status: GenerationStatus,
    error?: string,
  ): Promise<void> {
    const db = await getDatabaseClient();
    await db.generations.update(id, {
      status,
      error,
      updatedAt: new Date(),
    });
  }

  private calculateCredits(
    type: GenerationType,
    provider: GenerationProvider,
  ): number {
    // Credit calculation logic based on type and provider
    const baseCosts: Record<GenerationType, number> = {
      [GenerationType.TEXT]: 1,
      [GenerationType.IMAGE]: 5,
      [GenerationType.VIDEO]: 20,
      [GenerationType.AUDIO]: 3,
      [GenerationType.SPEECH]: 2,
      [GenerationType.MUSIC]: 10,
      [GenerationType.THREE_D]: 25,
      [GenerationType.AVATAR]: 15,
      [GenerationType.CODE]: 2,
      [GenerationType.DOCUMENT]: 1,
    };

    return baseCosts[type] || 1;
  }

  private async sendWebhook(url: string, payload: any): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ElizaOS-Platform/1.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.warn(
          `Webhook delivery failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error: any) {
      logger.error('Webhook delivery error:', error);
    }
  }

  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Production-grade helper methods

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createIdempotencyKey(request: GenerationRequest): string {
    const key = `${request.organizationId}:${request.type}:${this.hashPrompt(request.prompt)}`;
    return createHash('sha256')
      .update(key)
      .digest('hex')
      .slice(0, 32) as string;
  }

  private hashPrompt(prompt: string): string {
    return createHash('md5')
      .update(prompt.trim().toLowerCase())
      .digest('hex')
      .slice(0, 16) as string;
  }

  private validateRequest(request: GenerationRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic required fields
    if (!request.prompt?.trim()) {
      errors.push('Prompt is required');
    }

    if (!request.organizationId?.trim()) {
      errors.push('Organization ID is required');
    }

    if (!request.userId?.trim()) {
      errors.push('User ID is required');
    }

    // Prompt length validation
    if (
      request.prompt &&
      request.prompt.length > GENERATION_CONFIG.MAX_PROMPT_LENGTH
    ) {
      errors.push(
        `Prompt exceeds maximum length of ${GENERATION_CONFIG.MAX_PROMPT_LENGTH} characters`,
      );
    }

    // Security validation - check for dangerous patterns
    if (request.prompt) {
      const dangerousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /data:(?:text\/html|application\/javascript)/gi,
        /\$\{[^}]*\}/g, // Template injection
        /<%[^%]*%>/g, // Code injection
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(request.prompt)) {
          errors.push('Prompt contains potentially dangerous content');
          break;
        }
      }
    }

    // Type-specific validation
    if (request.type === GenerationType.IMAGE) {
      const imageRequest = request as any;
      if (
        imageRequest.num_images &&
        (imageRequest.num_images < 1 || imageRequest.num_images > 10)
      ) {
        errors.push('Number of images must be between 1 and 10');
      }
    }

    if (request.type === GenerationType.VIDEO) {
      const videoRequest = request as any;
      if (
        videoRequest.duration &&
        (videoRequest.duration < 1 || videoRequest.duration > 60)
      ) {
        errors.push('Video duration must be between 1 and 60 seconds');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private async estimateGenerationCost(
    request: GenerationRequest,
    provider: GenerationProvider,
  ): Promise<number> {
    try {
      const providerInstance = this.providers.get(provider);
      if (providerInstance && providerInstance.estimateCost) {
        return await providerInstance.estimateCost(request);
      }

      // Fallback to basic calculation
      return this.calculateCredits(request.type, provider);
    } catch (error) {
      logger.warn('Failed to estimate cost, using fallback', {
        error,
        provider,
        type: request.type,
      });
      return this.calculateCredits(request.type, provider);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, GENERATION_CONFIG.CLEANUP_INTERVAL_MS);
  }

  private performCleanup(): void {
    const now = Date.now();

    // Clean expired processing locks
    for (const [key, promise] of this.processingLocks.entries()) {
      // Check if promise is old (indicates a stuck operation)
      const isOld =
        promise.constructor.name === 'Promise' &&
        (promise as any)._createdAt &&
        now - (promise as any)._createdAt >
          GENERATION_CONFIG.PROCESSING_LOCK_TIMEOUT_MS;

      if (isOld) {
        this.processingLocks.delete(key);
        logger.warn('Cleaned up stuck processing lock', { key });
      }
    }

    // Reset concurrent generation counters periodically
    if (now % (60 * 60 * 1000) < GENERATION_CONFIG.CLEANUP_INTERVAL_MS) {
      // Every hour
      this.concurrentGenerations.clear();
      logger.info('Reset concurrent generation counters');
    }
  }

  /**
   * Graceful shutdown method
   */
  public async shutdown(): Promise<void> {
    logger.info('Starting GenerationService shutdown');
    this.isShuttingDown = true;

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop the queue service gracefully
    try {
      logger.info('Stopping queue service...');
      await this.queueService.stop();
      logger.info('Queue service stopped successfully');
    } catch (error) {
      logger.warn('Error stopping queue service', { error });
    }

    // Wait for ongoing operations to complete (with timeout)
    const ongoingOperations = Array.from(this.processingLocks.values());
    if (ongoingOperations.length > 0) {
      logger.info(
        `Waiting for ${ongoingOperations.length} ongoing operations to complete`,
      );

      try {
        await Promise.race([
          Promise.allSettled(ongoingOperations),
          new Promise((resolve) => setTimeout(resolve, 30000)), // 30 second timeout
        ]);
      } catch (error) {
        logger.warn('Some operations did not complete during shutdown', {
          error,
        });
      }
    }

    logger.info('GenerationService shutdown complete');
  }

  /**
   * Health check method for monitoring
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {
      timestamp: new Date().toISOString(),
      isShuttingDown: this.isShuttingDown,
      activeOperations: this.processingLocks.size,
      providers: {},
      queue: {},
    };

    let healthyProviders = 0;
    let totalProviders = 0;

    // Check provider health
    for (const [providerName, provider] of this.providers.entries()) {
      totalProviders++;
      try {
        if (provider.healthCheck) {
          const providerHealth = await provider.healthCheck();
          details.providers[providerName] = providerHealth;
          if (providerHealth.healthy) {
            healthyProviders++;
          }
        } else {
          details.providers[providerName] = {
            healthy: true,
            note: 'No health check implemented',
          };
          healthyProviders++;
        }
      } catch (error: any) {
        details.providers[providerName] = {
          healthy: false,
          error: error.message,
        };
      }
    }

    // Check queue service health
    let queueHealthy = true;
    try {
      const queueStats = await this.queueService.getQueueStats();
      details.queue = {
        healthy: true,
        stats: queueStats,
        workers: queueStats.workers,
        activeJobs: queueStats.activeJobs,
        pending: queueStats.pending,
        processing: queueStats.processing,
      };
    } catch (error: any) {
      queueHealthy = false;
      details.queue = {
        healthy: false,
        error: error.message,
      };
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (this.isShuttingDown) {
      status = 'degraded';
    } else if (healthyProviders === totalProviders && queueHealthy) {
      status = 'healthy';
    } else if (healthyProviders > 0 && queueHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    details.healthyProviders = healthyProviders;
    details.totalProviders = totalProviders;
    details.queueHealthy = queueHealthy;

    return { status, details };
  }

  /**
   * Get queue statistics for monitoring
   */
  public async getQueueStats(): Promise<any> {
    try {
      return await this.queueService.getQueueStats();
    } catch (error) {
      logger.error(
        'Failed to get queue stats',
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }

  /**
   * Cancel a queued job
   */
  public async cancelQueuedJob(jobId: string): Promise<boolean> {
    try {
      return await this.queueService.cancelJob(jobId);
    } catch (error) {
      logger.error('Failed to cancel queued job', undefined, {
        error: error instanceof Error ? error.message : String(error),
        jobId,
      });
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  public async retryFailedJob(jobId: string): Promise<boolean> {
    try {
      return await this.queueService.retryJob(jobId);
    } catch (error) {
      logger.error('Failed to retry failed job', undefined, {
        error: error instanceof Error ? error.message : String(error),
        jobId,
      });
      return false;
    }
  }
}
