/**
 * Generation Providers Tests
 * Tests for external AI service provider implementations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { OpenAIProvider } from '../services/providers/OpenAIProvider';
import { ElevenLabsProvider } from '../services/providers/ElevenLabsProvider';
import { GoogleVeoProvider } from '../services/providers/GoogleVeoProvider';
import {
  GenerationType,
  GenerationProvider,
  TextGenerationRequest,
  ImageGenerationRequest,
  AudioGenerationRequest,
  VideoGenerationRequest,
} from '../types';

// Mock fetch globally
const mockFetch = mock() as any;
mockFetch.preconnect = mock();
global.fetch = mockFetch;

describe('Generation Providers', () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restoreAllMocks();
  });

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({
        apiKey: 'test-api-key',
      });
    });

    describe('getCapabilities', () => {
      it('should return correct capabilities', () => {
        const capabilities = provider.getCapabilities();

        expect(capabilities.supportedTypes).toContain(GenerationType.TEXT);
        expect(capabilities.supportedTypes).toContain(GenerationType.IMAGE);
        expect(capabilities.supportedTypes).toContain(GenerationType.AUDIO);
        expect(capabilities.maxPromptLength).toBe(8000);
        expect(capabilities.supportsBatch).toBe(true);
      });
    });

    describe('validateRequest', () => {
      it('should validate text generation request', () => {
        const request: TextGenerationRequest = {
          type: GenerationType.TEXT,
          prompt: 'Test prompt',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          temperature: 0.7,
          max_tokens: 1000,
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject request with empty prompt', () => {
        const request: TextGenerationRequest = {
          type: GenerationType.TEXT,
          priority: 'normal',
          prompt: '',
          organizationId: 'org-123',
          userId: 'user-123',
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Prompt exceeds maximum length of 8000 characters',
        );
      });

      it('should reject request with prompt too long', () => {
        const request: TextGenerationRequest = {
          type: GenerationType.TEXT,
          prompt: 'a'.repeat(8001),
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Prompt exceeds maximum length of 8000 characters',
        );
      });

      it('should reject unsupported generation type', () => {
        const request = {
          type: GenerationType.VIDEO, // Not supported by OpenAI
          prompt: 'Test prompt',
          organizationId: 'org-123',
          userId: 'user-123',
        };

        const validation = provider.validateRequest(request as any);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Generation type video not supported',
        );
      });
    });

    describe('generate', () => {
      it('should generate text successfully', async () => {
        const request: TextGenerationRequest = {
          type: GenerationType.TEXT,
          priority: 'normal',
          prompt: 'Write a short story',
          organizationId: 'org-123',
          userId: 'user-123',
          temperature: 0.7,
          max_tokens: 500,
        };

        const result = await provider.generate(request);

        expect(result.outputs).toHaveLength(1);
        expect(result.outputs[0].format).toBe('text');
        expect(result.outputs[0].metadata?.content).toContain(
          'Write a short story',
        );
        expect(result.cost).toBeGreaterThan(0);
        expect(result.credits_used).toBeGreaterThan(0);
      });

      it('should generate image successfully', async () => {
        const request: ImageGenerationRequest = {
          type: GenerationType.IMAGE,
          prompt: 'A beautiful sunset',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          aspect_ratio: '1:1',
          quality: 'standard',
          num_images: 2,
          resolution: '1024x1024',
        };

        const result = await provider.generate(request);

        expect(result.outputs).toHaveLength(2);
        expect(result.outputs[0].format).toBe('png');
        expect(result.outputs[0].url).toMatch(/^https:/);
        expect(result.cost).toBeGreaterThan(0);
        expect(result.credits_used).toBe(10); // 2 images * 5 credits each
      });

      it('should generate audio/speech successfully', async () => {
        const request: AudioGenerationRequest = {
          type: GenerationType.AUDIO,
          prompt: 'Hello, this is a test message',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          speed: 1.0,
          voice_id: 'alloy',
          output_format: 'mp3',
        };

        const result = await provider.generate(request);

        expect(result.outputs).toHaveLength(1);
        expect(result.outputs[0].format).toBe('mp3');
        expect(result.outputs[0].metadata?.voice).toBe('alloy');
        expect(result.cost).toBeGreaterThan(0);
      });

      it('should handle generation errors', async () => {
        const request: TextGenerationRequest = {
          type: GenerationType.TEXT,
          priority: 'normal',
          prompt: 'Test prompt',
          organizationId: 'org-123',
          userId: 'user-123',
        };

        // Mock provider to throw error
        const errorProvider = new OpenAIProvider({
          apiKey: 'invalid-key',
        });

        await expect(errorProvider.generate(request)).rejects.toThrow();
      });
    });

    describe('estimateCost', () => {
      it('should estimate text generation cost', async () => {
        const request: TextGenerationRequest = {
          type: GenerationType.TEXT,
          priority: 'normal',
          prompt: 'Test prompt',
          organizationId: 'org-123',
          userId: 'user-123',
          max_tokens: 1000,
        };

        const cost = await provider.estimateCost(request);

        expect(cost).toBeGreaterThan(0);
        expect(typeof cost).toBe('number');
      });

      it('should estimate image generation cost', async () => {
        const request: ImageGenerationRequest = {
          type: GenerationType.IMAGE,
          prompt: 'Test image',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          aspect_ratio: '1:1',
          resolution: '1024x1024',
          num_images: 3,
          quality: 'high',
        };

        const cost = await provider.estimateCost(request);

        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeGreaterThan(0.2); // Should be higher for multiple high-quality images
      });
    });

    describe('healthCheck', () => {
      it('should pass health check with valid API key', async () => {
        const result = await provider.healthCheck();

        expect(result.healthy).toBe(true);
        expect(result.latency).toBeGreaterThan(0);
      });
    });
  });

  describe('ElevenLabsProvider', () => {
    let provider: ElevenLabsProvider;

    beforeEach(() => {
      provider = new ElevenLabsProvider({
        apiKey: 'test-elevenlabs-key',
      });
    });

    describe('getCapabilities', () => {
      it('should return audio-specific capabilities', () => {
        const capabilities = provider.getCapabilities();

        expect(capabilities.supportedTypes).toContain(GenerationType.AUDIO);
        expect(capabilities.supportedTypes).toContain(GenerationType.SPEECH);
        expect(capabilities.supportedTypes).not.toContain(GenerationType.TEXT);
        expect(capabilities.maxPromptLength).toBe(5000);
        expect(capabilities.outputFormats[GenerationType.AUDIO]).toContain(
          'mp3',
        );
      });
    });

    describe('validateRequest', () => {
      it('should validate audio generation request', () => {
        const request: AudioGenerationRequest = {
          type: GenerationType.AUDIO,
          prompt: 'Hello world',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          speed: 1.0,
          output_format: 'mp3',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
          },
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject invalid voice settings', () => {
        const request: AudioGenerationRequest = {
          type: GenerationType.AUDIO,
          prompt: 'Hello world',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          speed: 1.0,
          output_format: 'mp3',
          voice_settings: {
            stability: 1.5, // Invalid: > 1
            similarity_boost: -0.1, // Invalid: < 0
          },
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Voice stability must be between 0 and 1',
        );
        expect(validation.errors).toContain(
          'Voice similarity_boost must be between 0 and 1',
        );
      });

      it('should reject unsupported output format', () => {
        const request: AudioGenerationRequest = {
          type: GenerationType.AUDIO,
          prompt: 'Hello world',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          speed: 1.0,
          output_format: 'invalid' as any,
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Output format must be one of: mp3, wav, flac, ogg',
        );
      });
    });

    describe('generate', () => {
      it('should generate speech successfully', async () => {
        const request: AudioGenerationRequest = {
          type: GenerationType.AUDIO,
          prompt: 'This is a test speech generation',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          speed: 1.0,
          voice_id: 'pNInz6obpgDQGcFmaJgB',
          output_format: 'mp3',
        };

        const result = await provider.generate(request);

        expect(result.outputs).toHaveLength(1);
        expect(result.outputs[0].format).toBe('mp3');
        expect(result.outputs[0].metadata?.voice_id).toBe(
          'pNInz6obpgDQGcFmaJgB',
        );
        expect(result.outputs[0].metadata?.estimated_duration).toBeGreaterThan(
          0,
        );
        expect(result.cost).toBeGreaterThan(0);
      });

      it('should handle long text input', async () => {
        const longText = 'This is a very long text. '.repeat(100); // ~2500 characters

        const request: AudioGenerationRequest = {
          type: GenerationType.AUDIO,
          prompt: longText,
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          speed: 1.0,
          output_format: 'mp3',
        };

        const result = await provider.generate(request);

        expect(result.outputs).toHaveLength(1);
        expect(result.outputs[0].metadata?.model_id).toBe(
          'eleven_multilingual_v2',
        ); // Should use longer-text model
      });
    });

    describe('getVoices', () => {
      it('should retrieve available voices', async () => {
        const voices = await provider.getVoices();

        expect(Array.isArray(voices)).toBe(true);
        // Mock implementation returns empty array, real implementation would return voices
      });
    });
  });

  describe('GoogleVeoProvider', () => {
    let provider: GoogleVeoProvider;

    beforeEach(() => {
      provider = new GoogleVeoProvider({
        apiKey: 'test-google-key',
        projectId: 'test-project',
      });
    });

    describe('getCapabilities', () => {
      it('should return video-specific capabilities', () => {
        const capabilities = provider.getCapabilities();

        expect(capabilities.supportedTypes).toContain(GenerationType.VIDEO);
        expect(capabilities.supportedTypes).not.toContain(GenerationType.TEXT);
        expect(capabilities.supportsCancel).toBe(true);
        expect(capabilities.supportsProgress).toBe(true);
        expect(capabilities.outputFormats[GenerationType.VIDEO]).toContain(
          'mp4',
        );
      });
    });

    describe('validateRequest', () => {
      it('should validate video generation request', () => {
        const request: VideoGenerationRequest = {
          type: GenerationType.VIDEO,
          prompt: 'A serene mountain landscape',
          organizationId: 'org-123',
          userId: 'user-123',
          priority: 'normal',
          aspect_ratio: '16:9',
          resolution: '1080p',
          fps: 24,
          loop: false,
          duration: 5,
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should reject invalid duration', () => {
        const request: VideoGenerationRequest = {
          type: GenerationType.VIDEO,
          priority: 'normal',
          aspect_ratio: '16:9',
          resolution: '1080p',
          fps: 30,
          loop: false,
          prompt: 'Test video',
          organizationId: 'org-123',
          userId: 'user-123',
          duration: 65, // Invalid: > 60
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Video duration must be between 1 and 60 seconds',
        );
      });

      it('should reject invalid FPS', () => {
        const request: VideoGenerationRequest = {
          type: GenerationType.VIDEO,
          priority: 'normal',
          aspect_ratio: '16:9',
          resolution: '1080p',
          loop: false,
          prompt: 'Test video',
          organizationId: 'org-123',
          userId: 'user-123',
          duration: 5,
          fps: 120, // Invalid: > 60
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Video FPS must be between 12 and 60',
        );
      });

      it('should reject invalid seed image URL', () => {
        const request: VideoGenerationRequest = {
          type: GenerationType.VIDEO,
          priority: 'normal',
          aspect_ratio: '16:9',
          resolution: '1080p',
          fps: 30,
          loop: false,
          prompt: 'Test video',
          organizationId: 'org-123',
          userId: 'user-123',
          duration: 5,
          seed_image_url: 'not-a-valid-url',
        };

        const validation = provider.validateRequest(request);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain(
          'Seed image URL must be a valid URL',
        );
      });
    });

    describe('generate', () => {
      it('should generate video successfully', async () => {
        const request: VideoGenerationRequest = {
          type: GenerationType.VIDEO,
          priority: 'normal',
          aspect_ratio: '16:9',
          loop: false,
          prompt: 'A beautiful sunrise over mountains',
          organizationId: 'org-123',
          userId: 'user-123',
          duration: 5,
          fps: 24,
          resolution: '1080p',
        };

        const result = await provider.generate(request);

        expect(result.outputs).toHaveLength(1);
        expect(result.outputs[0].format).toBe('mp4');
        expect(result.outputs[0].url).toMatch(/^https:/);
        expect(result.outputs[0].thumbnailUrl).toBeDefined();
        expect(result.outputs[0].metadata?.duration).toBe(5);
        expect(result.cost).toBeGreaterThan(0);
      });

      it('should handle motion prompts', async () => {
        const request: VideoGenerationRequest = {
          type: GenerationType.VIDEO,
          priority: 'normal',
          aspect_ratio: '16:9',
          resolution: '1080p',
          fps: 30,
          loop: false,
          prompt: 'A calm lake',
          motion_prompt: 'Water ripples gently, birds fly overhead',
          organizationId: 'org-123',
          userId: 'user-123',
          duration: 3,
        };

        const result = await provider.generate(request);

        expect(result.outputs).toHaveLength(1);
        expect(result.outputs[0].metadata?.motion_prompt).toBe(
          'Water ripples gently, birds fly overhead',
        );
      });
    });

    describe('getProgress', () => {
      it('should track generation progress', async () => {
        const progress = await provider.getProgress('gen-123');

        expect(progress).toHaveProperty('progress');
        expect(progress).toHaveProperty('status');
        expect(progress.progress).toBeGreaterThanOrEqual(0);
        expect(progress.progress).toBeLessThanOrEqual(100);
      });
    });

    describe('cancelGeneration', () => {
      it('should cancel generation', async () => {
        await expect(
          provider.cancelGeneration('gen-123'),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Provider Error Handling', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({
        apiKey: 'test-key',
      });
    });

    it('should handle network errors', async () => {
      const request: TextGenerationRequest = {
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
      };

      // Mock network error
      mock.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(provider.generate(request)).rejects.toThrow();
    });

    it('should handle API rate limiting', async () => {
      const request: TextGenerationRequest = {
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
      };

      // Mock rate limit response
      mock.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          statusText: 'Too Many Requests',
        }),
      );

      await expect(provider.generate(request)).rejects.toThrow(
        'Rate limit exceeded',
      );
    });

    it('should handle authentication errors', async () => {
      const request: TextGenerationRequest = {
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
      };

      // Mock authentication error
      mock.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid API key' }), {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      await expect(provider.generate(request)).rejects.toThrow(
        'Authentication failed',
      );
    });
  });

  describe('Provider Performance', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({
        apiKey: 'test-key',
        rateLimitPerSecond: 2,
      });
    });

    it('should respect rate limiting', async () => {
      const request: TextGenerationRequest = {
        type: GenerationType.TEXT,
        priority: 'normal',
        prompt: 'Test prompt',
        organizationId: 'org-123',
        userId: 'user-123',
      };

      const startTime = Date.now();

      // Make two consecutive requests
      await provider.generate(request);
      await provider.generate(request);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 500ms due to rate limiting (1/2 requests per second = 500ms delay)
      expect(duration).toBeGreaterThanOrEqual(500);
    });
  });
});
