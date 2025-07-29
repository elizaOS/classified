/**
 * Enhanced Generation Types
 * Advanced types for world-class AI generation platform
 */

import { z } from 'zod';
import {
  GenerationType,
  GenerationProvider,
  baseGenerationRequestSchema,
} from './index';

// Enhanced Provider Enums with Latest Models
export enum EnhancedGenerationProvider {
  // Image Providers
  OPENAI_GPT4O = 'openai_gpt4o',
  FAL_FLUX_SCHNELL = 'fal_flux_schnell',
  FAL_FLUX_DEV = 'fal_flux_dev',
  FAL_FLUX_PRO = 'fal_flux_pro',
  FAL_FLUX_KONTEXT = 'fal_flux_kontext',

  // Video Providers
  KLING_STANDARD = 'kling_standard',
  KLING_PROFESSIONAL = 'kling_professional',
  KLING_MASTER = 'kling_master',
  GOOGLE_VEO_2 = 'google_veo_2',
  GOOGLE_VEO_3 = 'google_veo_3',
  RUNWAYML_GEN3 = 'runwayml_gen3',
  PIKA_LABS = 'pika_labs',

  // Audio/Music Providers
  ELEVENLABS_TURBO = 'elevenlabs_turbo',
  FAL_CASSETTEAI = 'fal_cassetteai',

  // Character/Avatar
  FAL_INSTANTID = 'fal_instantid',
  READY_PLAYER_ME = 'ready_player_me',

  // Legacy providers (manually added)
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
}

// GPT-4o Vision Integration
export const gpt4oVisionSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.IMAGE),
  provider: z.literal(EnhancedGenerationProvider.OPENAI_GPT4O),
  vision_prompt: z.string().optional(),
  reference_image: z.string().url().optional(),
  understanding_mode: z
    .enum(['describe', 'analyze', 'enhance', 'style_transfer'])
    .default('enhance'),
  vision_temperature: z.number().min(0).max(2).optional(),
  detail_level: z.enum(['low', 'high']).default('high'),
  response_format: z.enum(['url', 'b64_json']).default('url'),
});

// FAL.ai FLUX Models
export const falFluxSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.IMAGE),
  provider: z.enum([
    EnhancedGenerationProvider.FAL_FLUX_SCHNELL,
    EnhancedGenerationProvider.FAL_FLUX_DEV,
    EnhancedGenerationProvider.FAL_FLUX_PRO,
    EnhancedGenerationProvider.FAL_FLUX_KONTEXT,
  ]),
  image_size: z
    .enum([
      'square_hd',
      'square',
      'portrait_4_3',
      'portrait_16_9',
      'landscape_4_3',
      'landscape_16_9',
    ])
    .default('square_hd'),
  num_inference_steps: z.number().min(1).max(50).optional(),
  guidance_scale: z.number().min(1).max(20).optional(),
  num_images: z.number().min(1).max(4).default(1),
  enable_safety_checker: z.boolean().default(true),
  seed: z.number().optional(),
  lora_path: z.string().optional(), // For custom LoRA models
  lora_scale: z.number().min(0).max(1).optional(),
});

// Kling Video Generation
export const klingVideoSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.VIDEO),
  provider: z.enum([
    EnhancedGenerationProvider.KLING_STANDARD,
    EnhancedGenerationProvider.KLING_PROFESSIONAL,
    EnhancedGenerationProvider.KLING_MASTER,
  ]),
  quality_tier: z
    .enum(['standard', 'professional', 'master'])
    .default('professional'),
  duration: z.number().min(5).max(120).default(5), // 5 seconds to 2 minutes
  aspect_ratio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
  cfg_scale: z.number().min(0).max(1).default(0.5),
  physics_simulation: z.boolean().default(true),
  camera_controls: z
    .object({
      horizontal: z.number().min(-10).max(10).default(0),
      vertical: z.number().min(-10).max(10).default(0),
      pan: z.number().min(-10).max(10).default(0),
      tilt: z.number().min(-10).max(10).default(0),
      roll: z.number().min(-10).max(10).default(0),
      zoom: z.number().min(-10).max(10).default(0),
    })
    .optional(),
  motion_brush_controls: z
    .array(
      z.object({
        element: z.string(),
        motion_type: z.enum(['linear', 'circular', 'custom']),
        intensity: z.number().min(0).max(1),
        direction: z.object({
          x: z.number(),
          y: z.number(),
        }),
      }),
    )
    .optional(),
  image_to_video: z
    .object({
      image_url: z.string().url(),
      image_tail_type: z.enum(['canny', 'pose', 'depth']).default('canny'),
    })
    .optional(),
});

// Google Veo Enhanced
export const googleVeoSchema = baseGenerationRequestSchema.extend({
  type: z.literal(GenerationType.VIDEO),
  provider: z.enum([
    EnhancedGenerationProvider.GOOGLE_VEO_2,
    EnhancedGenerationProvider.GOOGLE_VEO_3,
  ]),
  model_version: z.enum(['veo-2', 'veo-3']).default('veo-3'),
  duration: z.number().min(1).max(60).default(5),
  resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
  cinematic_quality: z
    .enum(['standard', 'professional', 'cinematic'])
    .default('professional'),
  advanced_physics: z.boolean().default(true),
  temporal_consistency: z.number().min(0).max(1).default(0.8),
  scene_understanding: z.boolean().default(true),
  style_reference: z.string().optional(),
  motion_strength: z.number().min(0).max(1).default(0.7),
});

// ElizaOS Character Types - matching @elizaos/core Character type
export const elizaCharacterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  username: z.string().optional(),
  bio: z.union([z.string(), z.array(z.string())]),
  system: z.string().optional(),
  messageExamples: z
    .array(
      z.array(
        z.object({
          name: z.string(), // Changed from 'user' to 'name'
          content: z.object({
            text: z.string(),
            thought: z.string().optional(),
            actions: z.array(z.string()).optional(),
          }),
        }),
      ),
    )
    .default([]),
  postExamples: z.array(z.string()).default([]),
  knowledge: z
    .array(
      z.union([
        z.string(),
        z.object({
          path: z.string(),
          shared: z.boolean().optional(),
        }),
      ]),
    )
    .default([]),
  topics: z.array(z.string()).default([]),
  style: z
    .object({
      all: z.array(z.string()).default([]),
      chat: z.array(z.string()).default([]),
      post: z.array(z.string()).default([]),
    })
    .default({ all: [], chat: [], post: [] }),
  settings: z.record(z.any()).optional(),
  plugins: z.array(z.string()).default([]),
  voices: z
    .record(
      z.object({
        model: z.string(),
        url: z.string().optional(),
      }),
    )
    .optional(),
});

export const characterChatSchema = z.object({
  character_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
  context: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
        timestamp: z.date().optional(),
      }),
    )
    .optional(),
  maintain_personality: z.boolean().default(true),
  response_style: z.enum(['chat', 'post', 'formal']).default('chat'),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().min(50).max(2000).default(500),
});

// Crypto Payment Types
export const walletConnectionSchema = z.object({
  wallet_type: z.enum(['metamask', 'walletconnect', 'coinbase', 'rainbow']),
  chain_id: z.number(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/), // Ethereum address format
  signature: z.string(),
  message: z.string(),
});

export const cryptoTopUpSchema = z.object({
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  token_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string(), // BigNumber string
  chain_id: z.number(),
  slippage_tolerance: z.number().min(0.1).max(10).default(1), // 1%
  deadline_minutes: z.number().min(1).max(60).default(20),
});

// Enhanced Provider Model Info
export interface ProviderModel {
  id: string;
  name: string;
  provider: EnhancedGenerationProvider;
  type: GenerationType;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  quality_rating: number; // 1-10
  speed_rating: number; // 1-10 (1=slow, 10=fast)
  supported_features: string[];
}

export interface ModelCapabilities {
  max_resolution?: string;
  max_duration?: number; // seconds
  max_tokens?: number;
  supports_batch: boolean;
  supports_streaming: boolean;
  supports_custom_models: boolean;
  input_types: string[]; // ['text', 'image', 'audio']
  output_formats: string[];
}

export interface ModelPricing {
  base_cost: number;
  unit: string; // 'per_image', 'per_second', 'per_token', 'per_megapixel'
  our_markup: number; // 0.20 for 20%
  final_price: number;
  volume_discounts?: VolumeDiscount[];
}

export interface VolumeDiscount {
  min_usage: number;
  discount_percent: number;
  applies_to: 'monthly' | 'annual';
}

// Enhanced Cost Calculation
export interface CostBreakdown {
  provider_cost: number;
  our_markup: number;
  markup_amount: number;
  final_price: number;
  estimated_profit: number;
  credits_required: number;
  cost_per_unit: number;
  provider_name: string;
  model_name: string;
  estimated_processing_time: number; // seconds
}

// Crypto Payment Types
export interface TokenBalance {
  token_address: string;
  symbol: string;
  name: string;
  balance: string; // BigNumber string
  decimals: number;
  price_usd: number;
  value_usd: number;
}

export interface CryptoPayment {
  id: string;
  user_id: string;
  wallet_address: string;
  amount_crypto: string;
  token_symbol: string;
  token_address: string;
  chain_id: number;
  amount_usd: number;
  amount_credits: number;
  transaction_hash?: string;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  created_at: Date;
  confirmed_at?: Date;
  expires_at: Date;
}

// Character Chat Session
export interface CharacterChatSession {
  id: string;
  character_id: string;
  user_id: string;
  messages: ChatMessage[];
  context: ConversationContext;
  personality_state: PersonalityState;
  created_at: Date;
  updated_at: Date;
  last_active: Date;
  message_count: number;
  total_tokens: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens_used?: number;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  summary: string;
  key_topics: string[];
  emotional_state: string;
  relationship_level: number; // 0-1
  memory_items: MemoryItem[];
}

export interface PersonalityState {
  current_mood: string;
  energy_level: number; // 0-1
  conversation_style: string;
  topics_of_interest: string[];
  recent_memories: string[];
}

export interface MemoryItem {
  content: string;
  importance: number; // 0-1
  timestamp: Date;
  tags: string[];
  emotional_weight: number; // -1 to 1
}

// Union Types for All Enhanced Requests
export const enhancedGenerationRequestSchema = z.discriminatedUnion(
  'provider',
  [gpt4oVisionSchema, falFluxSchema, klingVideoSchema, googleVeoSchema],
);

// Export enhanced request types
export type GPT4oVisionRequest = z.infer<typeof gpt4oVisionSchema>;
export type FALFluxRequest = z.infer<typeof falFluxSchema>;
export type KlingVideoRequest = z.infer<typeof klingVideoSchema>;
export type GoogleVeoRequest = z.infer<typeof googleVeoSchema>;
export type CharacterChatRequest = z.infer<typeof characterChatSchema>;
export type WalletConnection = z.infer<typeof walletConnectionSchema>;
export type CryptoTopUp = z.infer<typeof cryptoTopUpSchema>;

export type EnhancedGenerationRequest = z.infer<
  typeof enhancedGenerationRequestSchema
>;

// Provider Result Types
export interface ProviderGenerationResult {
  outputs: any[];
  cost: number;
  credits_used: number;
  provider_id: string;
  metadata?: Record<string, any>;
}

export interface ProviderCapabilities {
  supportedTypes: string[];
  maxPromptLength: number;
  supportsBatch: boolean;
  supportsStreaming: boolean;
  maxConcurrent: number;
  supportedModels: string[];
  outputFormats: Record<string, string[]>;
  qualityLevels: string[];
  maxResolution: string;
  features: string[];
}
