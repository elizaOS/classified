/**
 * Generation Domain Types
 * Defines all types for multi-modal content generation
 */

import { z } from 'zod';

// Base Generation Types
export enum GenerationType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  THREE_D = '3d',
  AVATAR = 'avatar',
  MUSIC = 'music',
  SPEECH = 'speech',
  CODE = 'code',
  DOCUMENT = 'document',
}

export enum GenerationStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum GenerationProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  ELEVENLABS = 'elevenlabs',
  GOOGLE_VEO = 'google_veo',
  RUNWAYML = 'runwayml',
  MIDJOURNEY = 'midjourney',
  STABLE_DIFFUSION = 'stable_diffusion',
  FAL = 'fal',
  REPLICATE = 'replicate',
  READY_PLAYER_ME = 'ready_player_me',
  CUSTOM = 'custom',
}

// Base Generation Request Schema
export const baseGenerationRequestSchema = z.object({
  type: z.nativeEnum(GenerationType),
  prompt: z.string().min(1).max(10000),
  provider: z.nativeEnum(GenerationProvider).optional(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  callback_url: z.string().url().optional(),
});

// Text Generation
export const textGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.TEXT),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().min(1).max(8000).optional(),
  model: z.string().optional(),
  system_prompt: z.string().optional(),
  context: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .optional(),
});

// Image Generation
export const imageGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.IMAGE),
  style: z.string().optional(),
  aspect_ratio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('1:1'),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
  resolution: z
    .enum(['512x512', '1024x1024', '1536x1536', '2048x2048'])
    .default('1024x1024'),
  num_images: z.number().min(1).max(10).default(1),
  negative_prompt: z.string().optional(),
  seed: z.number().optional(),
  guidance_scale: z.number().min(1).max(20).optional(),
  steps: z.number().min(10).max(150).optional(),
});

// Video Generation
export const videoGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.VIDEO),
  duration: z.number().min(1).max(60).default(5), // seconds
  fps: z.number().min(12).max(60).default(24),
  resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
  style: z.string().optional(),
  motion_prompt: z.string().optional(),
  seed_image_url: z.string().url().optional(),
  aspect_ratio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  loop: z.boolean().default(false),
});

// Audio Generation
export const audioGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.AUDIO),
  voice_id: z.string().optional(),
  voice_settings: z
    .object({
      stability: z.number().min(0).max(1).optional(),
      similarity_boost: z.number().min(0).max(1).optional(),
      style: z.number().min(0).max(1).optional(),
      use_speaker_boost: z.boolean().optional(),
    })
    .optional(),
  output_format: z.enum(['mp3', 'wav', 'flac']).default('mp3'),
  speed: z.number().min(0.25).max(4).default(1),
});

// Speech Generation (for text-to-speech)
export const speechGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.SPEECH),
  voice_id: z.string().optional(),
  voice_settings: z
    .object({
      stability: z.number().min(0).max(1).optional(),
      similarity_boost: z.number().min(0).max(1).optional(),
      style: z.number().min(0).max(1).optional(),
      use_speaker_boost: z.boolean().optional(),
    })
    .optional(),
  output_format: z.enum(['mp3', 'wav', 'flac']).default('mp3'),
  speed: z.number().min(0.25).max(4).default(1),
});

// Music Generation
export const musicGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.MUSIC),
  genre: z.string().optional(),
  mood: z.string().optional(),
  instruments: z.array(z.string()).optional(),
  duration: z.number().min(10).max(600).default(30), // seconds
  tempo: z.number().min(60).max(200).optional(),
  key: z.string().optional(),
  style: z.string().optional(),
});

// 3D Generation
export const threeDGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.THREE_D),
  output_format: z.enum(['obj', 'glb', 'fbx', 'stl']).default('glb'),
  texture_resolution: z.enum(['512', '1024', '2048']).default('1024'),
  polygon_count: z.enum(['low', 'medium', 'high']).default('medium'),
  style: z.string().optional(),
  reference_images: z.array(z.string().url()).optional(),
});

// Avatar Generation
export const avatarGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.AVATAR),
  avatar_type: z
    .enum(['realistic', 'cartoon', 'anime', 'vroid'])
    .default('realistic'),
  gender: z.enum(['male', 'female', 'non-binary']).optional(),
  age_range: z.enum(['child', 'teen', 'adult', 'elderly']).optional(),
  ethnicity: z.string().optional(),
  clothing_style: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  reference_image_url: z.string().url().optional(),
  output_format: z.enum(['vrm', 'glb', 'fbx']).default('vrm'),
});

// Code Generation
export const codeGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.CODE),
  language: z.string().default('typescript'),
  framework: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  style_guide: z.string().optional(),
  test_requirements: z.boolean().default(false),
  documentation: z.boolean().default(false),
});

// Document Generation
export const documentGenerationSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.DOCUMENT),
  format: z.enum(['pdf', 'docx', 'html', 'markdown']).default('pdf'),
  template: z.string().optional(),
  data: z.record(z.any()).optional(),
  styling: z
    .object({
      font: z.string().optional(),
      font_size: z.number().optional(),
      margins: z
        .object({
          top: z.number(),
          bottom: z.number(),
          left: z.number(),
          right: z.number(),
        })
        .optional(),
      header: z.string().optional(),
      footer: z.string().optional(),
    })
    .optional(),
});

// Union type for all generation requests
export const generationRequestSchema = z.discriminatedUnion('type', [
  textGenerationSchema,
  imageGenerationSchema,
  videoGenerationSchema,
  audioGenerationSchema,
  speechGenerationSchema,
  musicGenerationSchema,
  threeDGenerationSchema,
  avatarGenerationSchema,
  codeGenerationSchema,
  documentGenerationSchema,
]);

export type GenerationRequest = z.infer<typeof generationRequestSchema>;
export type TextGenerationRequest = z.infer<typeof textGenerationSchema>;
export type ImageGenerationRequest = z.infer<typeof imageGenerationSchema>;
export type VideoGenerationRequest = z.infer<typeof videoGenerationSchema>;
export type AudioGenerationRequest = z.infer<typeof audioGenerationSchema>;
export type SpeechGenerationRequest = z.infer<typeof speechGenerationSchema>;
export type MusicGenerationRequest = z.infer<typeof musicGenerationSchema>;
export type ThreeDGenerationRequest = z.infer<typeof threeDGenerationSchema>;
export type AvatarGenerationRequest = z.infer<typeof avatarGenerationSchema>;
export type CodeGenerationRequest = z.infer<typeof codeGenerationSchema>;
export type DocumentGenerationRequest = z.infer<
  typeof documentGenerationSchema
>;

// Generation Response Types
export interface GenerationResult {
  id: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string;
  provider: GenerationProvider;
  organizationId: string;
  userId: string;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  outputs: GenerationOutput[];
  metadata?: Record<string, any>;
  error?: string;
  cost?: number;
  credits_used?: number;
  processing_time?: number;
}

export interface GenerationOutput {
  id: string;
  url: string;
  format: string;
  size: number;
  metadata?: Record<string, any>;
  thumbnailUrl?: string;
  alt_text?: string;
}

// Batch Generation
export const batchGenerationSchema = z.object({
  generations: z.array(generationRequestSchema).min(1).max(100),
  batch_name: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  callback_url: z.string().url().optional(),
});

export type BatchGenerationRequest = z.infer<typeof batchGenerationSchema>;

export interface BatchGenerationResult {
  id: string;
  name?: string;
  organizationId: string;
  userId: string;
  status: GenerationStatus;
  total_generations: number;
  completed_generations: number;
  failed_generations: number;
  generations: GenerationResult[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  total_cost?: number;
  total_credits_used?: number;
}

// Project and Workspace Types
export interface Project {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  userId: string;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  default_providers: Partial<Record<GenerationType, GenerationProvider>>;
  quality_preferences: {
    image_quality: 'draft' | 'standard' | 'high';
    video_quality: '720p' | '1080p' | '4k';
    audio_quality: 'standard' | 'high';
  };
  budget_limits: {
    daily_limit?: number;
    monthly_limit?: number;
    per_generation_limit?: number;
  };
  style_presets: Record<string, any>;
}

// Generation Analytics
export interface GenerationAnalytics {
  organizationId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  metrics: {
    total_generations: number;
    generations_by_type: Record<GenerationType, number>;
    generations_by_provider: Record<GenerationProvider, number>;
    generations_by_status: Record<GenerationStatus, number>;
    total_cost: number;
    total_credits_used: number;
    average_processing_time: number;
    peak_concurrent_generations: number;
    success_rate: number;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
    totalPages: number;
  };
}
