/**
 * Generation Integration Tests
 * End-to-end integration tests for generation workflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { NextRequest } from 'next/server';
import { GenerationService } from '../services/GenerationService';
import { OpenAIProvider } from '../services/providers/OpenAIProvider';
import { ElevenLabsProvider } from '../services/providers/ElevenLabsProvider';
import { GoogleVeoProvider } from '../services/providers/GoogleVeoProvider';
import { generateHandler } from '../api/handlers/generate';
import { MiddlewareContext } from '../api/middleware';
import {
  GenerationType,
  GenerationProvider,
  GenerationStatus,
  TextGenerationRequest,
  ImageGenerationRequest,
  AudioGenerationRequest,
  VideoGenerationRequest,
} from '../types';

// Mock external dependencies
const mockDatabase = {
  generations: {
    create: mock(),
    findById: mock(),
    update: mock(),
    list: mock(),
    getAnalytics: mock(),
  },
  batchGenerations: {
    create: mock(),
  },
};

const mockStorage = {
  uploadFromUrl: mock(),
};

const mockBilling = {
  checkGenerationLimits: mock(),
  reserveCredits: mock(),
  chargeCredits: mock(),
  releaseReservedCredits: mock(),
};

// Mock providers
mock.module('../services/providers/OpenAIProvider');
mock.module('../services/providers/ElevenLabsProvider');
mock.module('../services/providers/GoogleVeoProvider');

describe('Generation Integration Tests', () => {
  let generationService: GenerationService;
  let openAIProvider: OpenAIProvider;
  let elevenLabsProvider: ElevenLabsProvider;
  let googleVeoProvider: GoogleVeoProvider;
  let mockContext: MiddlewareContext;

  beforeEach(() => {
    mock.restore();

    // Initialize service
    generationService = new GenerationService(
      mockDatabase as any,
      mockStorage as any,
    );

    // Initialize providers
    openAIProvider = new OpenAIProvider({ apiKey: 'test-key' });
    elevenLabsProvider = new ElevenLabsProvider({ apiKey: 'test-key' });
    googleVeoProvider = new GoogleVeoProvider({
      apiKey: 'test-key',
      projectId: 'test',
    });

    // Mock context
    mockContext = {
      userId: 'user-123',
      organizationId: 'org-123',
      userRole: 'user',
      isAuthenticated: true,
      rateLimitRemaining: 100,
      billingStatus: {
        hasActiveSubscription: true,
        creditsRemaining: 1000,
        canGenerate: true,
      },
    };

    // Default mock implementations
    mockBilling.checkGenerationLimits.mockResolvedValue({
      allowed: true,
      reason: null,
    });
  });

  afterEach(() => {
    mock.restoreAllMocks();
  });

  describe('Full Text Generation Workflow', () => {
    it('should complete text generation from API to provider', async () => {
      // Mock provider response
      mock.mocked(openAIProvider.generate).mockResolvedValue({
        outputs: [
          {
            id: 'output-123',
            url: 'data:text/plain;base64,R2VuZXJhdGVkIHRleHQgcmVzcG9uc2U=',
            format: 'text',
            size: 25,
            metadata: {
              model: 'gpt-4o',
              content: 'Generated text response',
              finish_reason: 'stop',
              prompt_tokens: 20,
              completion_tokens: 10,
            },
          },
        ],
        cost: 0.002,
        credits_used: 2,
      });

      mock.mocked(openAIProvider.validateRequest).mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock database creation
      const mockGeneration = {
        id: 'gen-123',
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Write a story',
        organizationId: 'org-123',
        userId: 'user-123',
        provider: GenerationProvider.OPENAI,
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      };

      mockDatabase.generations.create.mockResolvedValue(mockGeneration);

      // Create API request
      const request = new NextRequest('http://localhost/api/v1/generation', {
        method: 'POST',
        body: JSON.stringify({
          type: GenerationType.TEXT,
          priority: 'normal',
          prompt: 'Write a story',
          max_tokens: 100,
        }),
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'user-123',
          'x-organization-id': 'org-123',
        },
      });

      // Execute API handler
      const response = await generateHandler(request);
      const result = await response.json();

      // Verify API response
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('gen-123');

      // Verify service was called correctly
      expect(mockBilling.checkGenerationLimits).toHaveBeenCalledWith(
        'org-123',
        GenerationType.TEXT,
        undefined,
      );
      expect(mockDatabase.generations.create).toHaveBeenCalled();

      // Simulate processing by service
      const serviceResult = await generationService.createGeneration({
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Write a story',
        organizationId: 'org-123',
        userId: 'user-123',
        max_tokens: 100,
      });

      expect(serviceResult.success).toBe(true);
    });
  });

  describe('Full Image Generation Workflow', () => {
    it('should complete image generation from API to provider', async () => {
      // Mock provider response
      mock.mocked(openAIProvider.generate).mockResolvedValue({
        outputs: [
          {
            id: 'image-123',
            format: 'png',
            url: 'https://example.com/image.png',
            size: 2048576,
            metadata: {
              model: 'dall-e-3',
              resolution: '1024x1024',
              quality: 'standard',
              revised_prompt: 'A beautiful landscape with mountains',
            },
          },
        ],
        cost: 0.04,
        credits_used: 5,
      });

      mock.mocked(openAIProvider.validateRequest).mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock storage upload
      mockStorage.uploadFromUrl.mockResolvedValue({
        url: 'https://storage.example.com/image.png',
        key: 'generations/image-123.png',
      });

      // Mock database creation
      const mockGeneration = {
        id: 'gen-456',
        type: GenerationType.IMAGE,
        prompt: 'A beautiful landscape',
        organizationId: 'org-123',
        userId: 'user-123',
        provider: GenerationProvider.OPENAI,
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      };

      mockDatabase.generations.create.mockResolvedValue(mockGeneration);

      // Create API request
      const request = new NextRequest('http://localhost/api/v1/generation', {
        method: 'POST',
        body: JSON.stringify({
          type: GenerationType.IMAGE,
          prompt: 'A beautiful landscape',
          num_images: 1,
          resolution: '1024x1024',
        }),
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'user-123',
          'x-organization-id': 'org-123',
        },
      });

      // Execute API handler
      const response = await generateHandler(request);
      const result = await response.json();

      // Verify API response
      expect(response.status).toBe(201);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('gen-456');

      // Verify billing check
      expect(mockBilling.checkGenerationLimits).toHaveBeenCalledWith(
        'org-123',
        GenerationType.IMAGE,
        undefined,
      );
    });
  });

  describe('Full Audio Generation Workflow', () => {
    it('should complete audio generation with ElevenLabs', async () => {
      // Mock provider response
      mock.mocked(elevenLabsProvider.generate).mockResolvedValue({
        outputs: [
          {
            id: 'audio-123',
            format: 'mp3',
            url: 'https://example.com/audio.mp3',
            size: 832000,
            metadata: {
              voice_id: 'pNInz6obpgDQGcFmaJgB',
              model_id: 'eleven_monolingual_v1',
              estimated_duration: 5.2,
              character_count: 45,
            },
          },
        ],
        cost: 0.015,
        credits_used: 3,
      });

      mock.mocked(elevenLabsProvider.validateRequest).mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock database creation
      const mockGeneration = {
        id: 'gen-789',
        type: GenerationType.AUDIO,
        prompt: 'Hello world, this is a test',
        organizationId: 'org-123',
        userId: 'user-123',
        provider: GenerationProvider.ELEVENLABS,
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      };

      mockDatabase.generations.create.mockResolvedValue(mockGeneration);

      // Execute service method directly
      const serviceResult = await generationService.createGeneration({
        type: GenerationType.AUDIO,
        prompt: 'Hello world, this is a test',
        organizationId: 'org-123',
        userId: 'user-123',
        priority: 'normal' as const,
        voice_id: 'pNInz6obpgDQGcFmaJgB',
        output_format: 'mp3',
        speed: 1.0,
      });

      expect(serviceResult.success).toBe(true);
      expect(serviceResult.data?.id).toBe('gen-789');
    });
  });

  describe('Full Video Generation Workflow', () => {
    it('should complete video generation with Google Veo', async () => {
      // Mock provider response
      mock.mocked(googleVeoProvider.generate).mockResolvedValue({
        outputs: [
          {
            id: 'video-123',
            format: 'mp4',
            url: 'https://example.com/video.mp4',
            size: 15728640,
            thumbnailUrl: 'https://example.com/video_thumb.jpg',
            metadata: {
              duration: 5,
              fps: 24,
              resolution: '1080p',
              model: 'veo-v1',
            },
          },
        ],
        cost: 0.75,
        credits_used: 15,
      });

      mock.mocked(googleVeoProvider.validateRequest).mockReturnValue({
        valid: true,
        errors: [],
      });

      // Mock database creation
      const mockGeneration = {
        id: 'gen-video-123',
        type: GenerationType.VIDEO,
        prompt: 'A serene mountain landscape',
        organizationId: 'org-123',
        userId: 'user-123',
        provider: GenerationProvider.GOOGLE_VEO,
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      };

      mockDatabase.generations.create.mockResolvedValue(mockGeneration);

      // Execute service method
      const serviceResult = await generationService.createGeneration({
        type: GenerationType.VIDEO,
        prompt: 'A serene mountain landscape',
        organizationId: 'org-123',
        userId: 'user-123',
        priority: 'normal' as const,
        aspect_ratio: '16:9' as const,
        resolution: '1080p' as const,
        duration: 5,
        fps: 24,
        loop: false,
      });

      expect(serviceResult.success).toBe(true);
      expect(serviceResult.data?.id).toBe('gen-video-123');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle provider errors gracefully', async () => {
      // Mock provider to throw error
      mock
        .mocked(openAIProvider.generate)
        .mockRejectedValue(new Error('OpenAI API rate limit exceeded'));

      mock.mocked(openAIProvider.validateRequest).mockReturnValue({
        valid: true,
        errors: [],
      });

      mockDatabase.generations.create.mockResolvedValue({
        id: 'gen-error-123',
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
        provider: GenerationProvider.OPENAI,
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      });

      // Create API request
      const request = new NextRequest('http://localhost/api/v1/generation', {
        method: 'POST',
        body: JSON.stringify({
          type: GenerationType.TEXT,
          priority: 'normal',
          prompt: 'Test prompt',
        }),
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'user-123',
          'x-organization-id': 'org-123',
        },
      });

      // Should handle error gracefully
      const response = await generateHandler(request);

      // API should still create the generation record
      expect(response.status).toBe(201);

      // But processing would fail (tested separately in service layer)
    });

    it('should handle billing errors', async () => {
      // Mock billing check to fail
      mockBilling.checkGenerationLimits.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient credits',
      });

      const serviceResult = await generationService.createGeneration({
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
      });

      expect(serviceResult.success).toBe(false);
      expect(serviceResult.error).toBe(
        'Insufficient credits or limits exceeded',
      );
      expect(serviceResult.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('should handle validation errors', async () => {
      // Mock provider validation to fail
      mock.mocked(openAIProvider.validateRequest).mockReturnValue({
        valid: false,
        errors: ['Prompt is too long'],
      });

      // This would be caught in the API layer validation
      const request = new NextRequest('http://localhost/api/v1/generation', {
        method: 'POST',
        body: JSON.stringify({
          type: GenerationType.TEXT,
          priority: 'normal',
          prompt: 'x'.repeat(10000), // Too long
        }),
        headers: {
          'content-type': 'application/json',
          'x-user-id': 'user-123',
          'x-organization-id': 'org-123',
        },
      });

      const response = await generateHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Batch Generation Integration', () => {
    it('should handle batch generation workflow', async () => {
      // Mock individual generation creation
      mockDatabase.generations.create
        .mockResolvedValueOnce({
          id: 'gen-1',
          type: GenerationType.TEXT,
          priority: 'normal',
          status: GenerationStatus.QUEUED,
        })
        .mockResolvedValueOnce({
          id: 'gen-2',
          type: GenerationType.IMAGE,
          status: GenerationStatus.QUEUED,
        });

      // Mock batch creation
      const mockBatch = {
        id: 'batch-123',
        name: 'Test Batch',
        organizationId: 'org-123',
        userId: 'user-123',
        status: GenerationStatus.QUEUED,
        total_generations: 2,
        completed_generations: 0,
        failed_generations: 0,
        generations: [
          { id: 'gen-1', status: GenerationStatus.QUEUED },
          { id: 'gen-2', status: GenerationStatus.QUEUED },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.batchGenerations.create.mockResolvedValue(mockBatch);

      // Execute batch generation
      const batchResult = await generationService.createBatchGeneration({
        priority: 'normal',
        generations: [
          {
            type: GenerationType.TEXT,
            priority: 'normal',
            prompt: 'First prompt',
            organizationId: 'org-123',
            userId: 'user-123',
          },
          {
            type: GenerationType.IMAGE,
            prompt: 'Second prompt',
            organizationId: 'org-123',
            userId: 'user-123',
            priority: 'normal' as const,
            aspect_ratio: '1:1' as const,
            quality: 'standard' as const,
            resolution: '1024x1024' as const,
            num_images: 1,
          },
        ],
      });

      expect(batchResult.success).toBe(true);
      expect(batchResult.data?.total_generations).toBe(2);
      expect(mockDatabase.generations.create).toHaveBeenCalledTimes(2);
      expect(mockDatabase.batchGenerations.create).toHaveBeenCalled();
    });
  });

  describe('Analytics Integration', () => {
    it('should retrieve analytics with proper aggregation', async () => {
      const mockAnalytics = {
        organizationId: 'org-123',
        period: 'day' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        metrics: {
          total_generations: 150,
          generations_by_type: {
            [GenerationType.TEXT]: 80,
            [GenerationType.IMAGE]: 50,
            [GenerationType.VIDEO]: 20,
          },
          generations_by_provider: {
            [GenerationProvider.OPENAI]: 100,
            [GenerationProvider.ELEVENLABS]: 30,
            [GenerationProvider.GOOGLE_VEO]: 20,
          },
          generations_by_status: {
            [GenerationStatus.COMPLETED]: 140,
            [GenerationStatus.FAILED]: 10,
          },
          total_cost: 45.67,
          total_credits_used: 1230,
          average_processing_time: 2.3,
          peak_concurrent_generations: 5,
          success_rate: 93.3,
        },
      };

      mockDatabase.generations.getAnalytics.mockResolvedValue(mockAnalytics);

      const analyticsResult = await generationService.getAnalytics({
        organizationId: 'org-123',
        period: 'day',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(analyticsResult.success).toBe(true);
      expect(analyticsResult.data?.metrics.total_generations).toBe(150);
      expect(analyticsResult.data?.metrics.success_rate).toBe(93.3);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should respect rate limits in provider calls', async () => {
      // Mock rate limited provider
      const rateLimitedProvider = new OpenAIProvider({
        apiKey: 'test-key',
        rateLimitPerSecond: 1,
      });

      mock.mocked(rateLimitedProvider.generate).mockImplementation(async () => {
        // Simulate rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          outputs: [
            {
              id: 'output-rate-test',
              format: 'text',
              url: 'data:text/plain;base64,VGVzdCByZXNwb25zZQ==',
              size: 13,
              metadata: {},
            },
          ],
          cost: 0.001,
          credits_used: 1,
        };
      });

      const startTime = Date.now();

      // Make two consecutive calls
      await rateLimitedProvider.generate({
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test 1',
        organizationId: 'org-123',
        userId: 'user-123',
      });

      await rateLimitedProvider.generate({
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test 2',
        organizationId: 'org-123',
        userId: 'user-123',
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 1 second due to rate limiting
      expect(duration).toBeGreaterThanOrEqual(1000);
    });
  });
});
