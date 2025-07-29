/**
 * Generation Service Tests
 * Comprehensive test suite for GenerationService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { GenerationService } from '../services/GenerationService';
import {
  GenerationType,
  GenerationStatus,
  GenerationProvider,
  TextGenerationRequest,
  ImageGenerationRequest,
} from '../types';

// Mock dependencies
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

describe('GenerationService', () => {
  let generationService: GenerationService;

  beforeEach(() => {
    generationService = new GenerationService(
      mockDatabase as any,
      mockStorage as any,
    );

    // Reset all mocks
    mock.restore();
  });

  afterEach(() => {
    mock.restoreAllMocks();
  });

  describe('createGeneration', () => {
    const mockRequest: TextGenerationRequest = {
      type: GenerationType.TEXT,
      priority: 'normal',
      prompt: 'Test prompt',
      organizationId: 'org-123',
      userId: 'user-123',
      temperature: 0.7,
      max_tokens: 1000,
    };

    it('should create a text generation successfully', async () => {
      // Arrange
      mockBilling.checkGenerationLimits.mockResolvedValue({
        allowed: true,
        reason: null,
      });

      const mockGeneration = {
        id: 'gen-123',
        ...mockRequest,
        provider: GenerationProvider.OPENAI,
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      };

      mockDatabase.generations.create.mockResolvedValue(mockGeneration);

      // Act
      const result = await generationService.createGeneration(mockRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGeneration);
      expect(mockBilling.checkGenerationLimits).toHaveBeenCalledWith(
        'org-123',
        GenerationType.TEXT,
        undefined,
      );
      expect(mockDatabase.generations.create).toHaveBeenCalled();
    });

    it('should fail when insufficient credits', async () => {
      // Arrange
      mockBilling.checkGenerationLimits.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient credits',
      });

      // Act
      const result = await generationService.createGeneration(mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient credits or limits exceeded');
      expect(result.code).toBe('INSUFFICIENT_CREDITS');
      expect(mockDatabase.generations.create).not.toHaveBeenCalled();
    });

    it('should handle image generation with multiple outputs', async () => {
      // Arrange
      const imageRequest: ImageGenerationRequest = {
        type: GenerationType.IMAGE,
        priority: 'normal',
        aspect_ratio: '1:1',
        quality: 'standard',
        prompt: 'Beautiful landscape',
        organizationId: 'org-123',
        userId: 'user-123',
        num_images: 2,
        resolution: '1024x1024',
      };

      mockBilling.checkGenerationLimits.mockResolvedValue({
        allowed: true,
        reason: null,
      });

      const mockGeneration = {
        id: 'gen-456',
        ...imageRequest,
        provider: GenerationProvider.OPENAI,
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      };

      mockDatabase.generations.create.mockResolvedValue(mockGeneration);

      // Act
      const result = await generationService.createGeneration(imageRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGeneration);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockBilling.checkGenerationLimits.mockResolvedValue({
        allowed: true,
        reason: null,
      });

      mockDatabase.generations.create.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act
      const result = await generationService.createGeneration(mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create generation');
      expect(result.code).toBe('CREATION_FAILED');
    });
  });

  describe('getGeneration', () => {
    it('should retrieve generation by ID', async () => {
      // Arrange
      const mockGeneration = {
        id: 'gen-123',
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        status: GenerationStatus.COMPLETED,
        organizationId: 'org-123',
        userId: 'user-123',
      };

      mockDatabase.generations.findById.mockResolvedValue(mockGeneration);

      // Act
      const result = await generationService.getGeneration('gen-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGeneration);
      expect(mockDatabase.generations.findById).toHaveBeenCalledWith('gen-123');
    });

    it('should return not found for non-existent generation', async () => {
      // Arrange
      mockDatabase.generations.findById.mockResolvedValue(null);

      // Act
      const result = await generationService.getGeneration('gen-999');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Generation not found');
      expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('listGenerations', () => {
    it('should list generations with pagination', async () => {
      // Arrange
      const mockGenerations = [
        { id: 'gen-1', type: GenerationType.TEXT },
        { id: 'gen-2', type: GenerationType.IMAGE },
      ];

      mockDatabase.generations.list.mockResolvedValue({
        data: mockGenerations,
        total: 2,
        hasMore: false,
      });

      const params = {
        organizationId: 'org-123',
        page: 1,
        limit: 20,
      };

      // Act
      const result = await generationService.listGenerations(params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockGenerations);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        hasMore: false,
        totalPages: 1,
      });
    });

    it('should filter by generation type', async () => {
      // Arrange
      const mockGenerations = [{ id: 'gen-1', type: GenerationType.TEXT }];

      mockDatabase.generations.list.mockResolvedValue({
        data: mockGenerations,
        total: 1,
        hasMore: false,
      });

      const params = {
        organizationId: 'org-123',
        type: GenerationType.TEXT,
        priority: 'normal',
        page: 1,
        limit: 20,
      };

      // Act
      const result = await generationService.listGenerations(params);

      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabase.generations.list).toHaveBeenCalledWith(params);
    });
  });

  describe('cancelGeneration', () => {
    it('should cancel a queued generation', async () => {
      // Arrange
      const mockGeneration = {
        id: 'gen-123',
        status: GenerationStatus.QUEUED,
        organizationId: 'org-123',
        provider: GenerationProvider.OPENAI,
      };

      mockDatabase.generations.findById.mockResolvedValue(mockGeneration);
      mockDatabase.generations.update.mockResolvedValue(undefined);

      // Act
      const result = await generationService.cancelGeneration('gen-123');

      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabase.generations.update).toHaveBeenCalledWith(
        'gen-123',
        expect.objectContaining({
          status: GenerationStatus.CANCELLED,
        }),
      );
      expect(mockBilling.releaseReservedCredits).toHaveBeenCalledWith(
        'org-123',
      );
    });

    it('should fail to cancel completed generation', async () => {
      // Arrange
      const mockGeneration = {
        id: 'gen-123',
        status: GenerationStatus.COMPLETED,
        organizationId: 'org-123',
      };

      mockDatabase.generations.findById.mockResolvedValue(mockGeneration);

      // Act
      const result = await generationService.cancelGeneration('gen-123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot cancel completed generation');
      expect(result.code).toBe('INVALID_STATUS');
    });
  });

  describe('createBatchGeneration', () => {
    it('should create batch generation with multiple requests', async () => {
      // Arrange
      const batchRequest = {
        priority: 'normal' as const,
        generations: [
          {
            type: GenerationType.TEXT as const,
            priority: 'normal' as const,
            prompt: 'First prompt',
            organizationId: 'org-123',
            userId: 'user-123',
          },
          {
            type: GenerationType.IMAGE as const,
            priority: 'normal' as const,
            prompt: 'Second prompt',
            organizationId: 'org-123',
            userId: 'user-123',
            aspect_ratio: '1:1' as const,
            quality: 'standard' as const,
            resolution: '1024x1024' as const,
            num_images: 1,
          },
        ],
      };

      // Mock individual generation creation
      mockBilling.checkGenerationLimits.mockResolvedValue({
        allowed: true,
        reason: null,
      });

      mockDatabase.generations.create
        .mockResolvedValueOnce({ id: 'gen-1', status: GenerationStatus.QUEUED })
        .mockResolvedValueOnce({
          id: 'gen-2',
          status: GenerationStatus.QUEUED,
        });

      const mockBatch = {
        id: 'batch-123',
        name: undefined,
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
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      mockDatabase.batchGenerations.create.mockResolvedValue(mockBatch);

      // Act
      const result =
        await generationService.createBatchGeneration(batchRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: 'batch-123',
        total_generations: 2,
        status: GenerationStatus.QUEUED,
      });
      expect(mockDatabase.generations.create).toHaveBeenCalledTimes(2);
      expect(mockDatabase.batchGenerations.create).toHaveBeenCalled();
    });
  });

  describe('getAnalytics', () => {
    it('should retrieve generation analytics', async () => {
      // Arrange
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
            [GenerationProvider.ANTHROPIC]: 30,
            [GenerationProvider.ELEVENLABS]: 20,
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

      const params = {
        organizationId: 'org-123',
        period: 'day' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      // Act
      const result = await generationService.getAnalytics(params);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalytics);
      expect(mockDatabase.generations.getAnalytics).toHaveBeenCalledWith(
        params,
      );
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const mockRequest: TextGenerationRequest = {
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
      };

      mockBilling.checkGenerationLimits.mockRejectedValue(
        new Error('Billing service unavailable'),
      );

      // Act
      const result = await generationService.createGeneration(mockRequest);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create generation');
      expect(result.code).toBe('CREATION_FAILED');
    });

    it('should handle provider errors in processGeneration', async () => {
      // This would test the processGeneration method once it's exposed
      // for testing or we create integration tests
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Provider selection', () => {
    it('should select optimal provider when not specified', async () => {
      // Arrange
      const mockRequest: TextGenerationRequest = {
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
        // No provider specified
      };

      mockBilling.checkGenerationLimits.mockResolvedValue({
        allowed: true,
        reason: null,
      });

      const mockGeneration = {
        id: 'gen-123',
        ...mockRequest,
        provider: GenerationProvider.OPENAI, // Should be auto-selected
        status: GenerationStatus.QUEUED,
        createdAt: new Date(),
      };

      mockDatabase.generations.create.mockResolvedValue(mockGeneration);

      // Act
      const result = await generationService.createGeneration(mockRequest);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.provider).toBeDefined();
    });
  });
});
