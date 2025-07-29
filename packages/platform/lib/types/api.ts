/**
 * Comprehensive API type definitions for ElizaOS platform
 * This file provides strongly-typed interfaces to replace 'any' types
 */

import { z } from 'zod';
import type { Request } from 'express';

// ============================================================================
// Common API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// Request/Response Body Types
// ============================================================================

export interface RequestMetadata {
  userAgent?: string;
  ipAddress?: string;
  timestamp: number;
  requestId: string;
}

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string; // user id (changed from id to sub to match EnhancedJWTPayload)
    email: string;
    name: string; // added missing name property
    organizationId: string;
    role: string;
    tenantId: string; // added missing tenantId property
    permissions: string[];
  };
  metadata: RequestMetadata;
}

// ============================================================================
// Agent Configuration Types
// ============================================================================

export interface AgentCharacterConfig {
  name: string;
  username?: string;
  system?: string;
  bio: string | string[];
  messageExamples?: Array<
    Array<{
      user: string;
      content: {
        text: string;
        action?: string;
        metadata?: Record<string, unknown>;
      };
    }>
  >;
  knowledge?: Array<
    | string
    | {
        path: string;
        shared?: boolean;
      }
  >;
  plugins?: string[];
  settings?: Record<string, unknown>;
  secrets?: Record<string, string | number | boolean>;
}

export interface AgentRuntimeConfig {
  models?: Record<string, string>;
  providers?: string[];
  maxTokens?: number;
  temperature?: number;
  environment?: Record<string, string>;
  customSettings?: Record<string, unknown>;
}

export interface AgentCreateRequest {
  name: string;
  description?: string;
  slug?: string;
  avatarUrl?: string;
  character: AgentCharacterConfig;
  plugins?: string[];
  runtimeConfig?: AgentRuntimeConfig;
  visibility: 'private' | 'organization' | 'public';
}

export interface AgentUpdateRequest extends Partial<AgentCreateRequest> {
  id: string;
}

// ============================================================================
// Generation Request Types
// ============================================================================

export interface BaseGenerationRequest {
  type:
    | 'image'
    | 'video'
    | 'audio'
    | 'text'
    | 'music'
    | 'three_d'
    | 'avatar'
    | 'code'
    | 'document';
  prompt: string;
  provider?: string;
  organizationId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface ImageGenerationRequest extends BaseGenerationRequest {
  type: 'image';
  aspect_ratio?: string;
  resolution?: string;
  num_images?: number;
  quality?: 'standard' | 'high';
  style?: string;
  negative_prompt?: string;
}

export interface VideoGenerationRequest extends BaseGenerationRequest {
  type: 'video';
  duration?: number;
  fps?: number;
  motion_prompt?: string;
  seed_image_url?: string;
  aspect_ratio?: string;
}

export interface AudioGenerationRequest extends BaseGenerationRequest {
  type: 'audio';
  voice_id?: string;
  output_format?: 'mp3' | 'wav' | 'flac' | 'ogg';
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

export interface TextGenerationRequest extends BaseGenerationRequest {
  type: 'text';
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop_sequences?: string[];
}

export type GenerationRequest =
  | ImageGenerationRequest
  | VideoGenerationRequest
  | AudioGenerationRequest
  | TextGenerationRequest;

// ============================================================================
// Billing and Payment Types
// ============================================================================

export interface CreditTransaction {
  id: string;
  organizationId: string;
  userId: string;
  amount: number;
  type: 'purchase' | 'usage' | 'refund' | 'bonus' | 'transfer';
  description: string;
  metadata: {
    stripeCheckoutSessionId?: string;
    stripeCustomerId?: string;
    stripePaymentIntentId?: string;
    transactionHash?: string;
    tokenSymbol?: string;
    amountCrypto?: string;
    amountUsd?: number;
    generationId?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BillingConfiguration {
  currency: 'USD' | 'EUR' | 'GBP';
  taxRate?: number;
  autoTopUpEnabled: boolean;
  autoTopUpAmount?: number;
  autoTopUpThreshold?: number;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

// ============================================================================
// Crypto Payment Types
// ============================================================================

export interface CryptoPaymentRequest {
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  amountCrypto: string;
  amountUsd: number;
  amountCredits: number;
  chainId: number;
  walletType?: string;
  slippageTolerance?: number;
}

export interface CryptoPaymentStatus {
  id: string;
  status: 'pending' | 'confirmed' | 'failed' | 'expired';
  transactionHash?: string;
  blockNumber?: number;
  blockConfirmations?: number;
  createdAt: string;
  expiresAt: string;
  confirmedAt?: string;
}

// ============================================================================
// Analytics and Metrics Types
// ============================================================================

export interface GenerationMetrics {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  averageProcessingTime: number;
  totalCost: number;
  averageCost: number;
  byType: Record<
    string,
    {
      count: number;
      cost: number;
      averageTime: number;
    }
  >;
  byProvider: Record<
    string,
    {
      count: number;
      cost: number;
      successRate: number;
    }
  >;
}

export interface UsageAnalytics {
  period: 'day' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
  generations: GenerationMetrics;
  credits: {
    purchased: number;
    used: number;
    remaining: number;
  };
  costs: {
    total: number;
    byCategory: Record<string, number>;
  };
}

// ============================================================================
// Marketplace Types
// ============================================================================

export interface MarketplaceAsset {
  id: string;
  name: string;
  description: string;
  type: 'plugin' | 'template' | 'character' | 'model';
  category: string;
  tags: string[];
  price: number;
  currency: 'USD' | 'credits';
  creatorId: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  version: string;
  license: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceReview {
  id: string;
  assetId: string;
  userId: string;
  rating: number;
  comment?: string;
  helpful: number;
  verified: boolean;
  createdAt: string;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export interface WebSocketMessage<T = unknown> {
  type: string;
  event: string;
  data: T;
  timestamp: number;
  id: string;
  agentId?: string;
  roomId?: string;
}

export interface LogStreamMessage {
  level: number;
  time: number;
  msg: string;
  hostname?: string;
  pid?: number;
  agentId?: string;
  [key: string]: unknown;
}

export interface GenerationStatusMessage {
  generationId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  estimatedTimeRemaining?: number;
  error?: string;
  outputs?: Array<{
    id: string;
    url: string;
    format: string;
    metadata?: Record<string, unknown>;
  }>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isImageGenerationRequest(
  req: GenerationRequest,
): req is ImageGenerationRequest {
  return req.type === 'image';
}

export function isVideoGenerationRequest(
  req: GenerationRequest,
): req is VideoGenerationRequest {
  return req.type === 'video';
}

export function isAudioGenerationRequest(
  req: GenerationRequest,
): req is AudioGenerationRequest {
  return req.type === 'audio';
}

export function isTextGenerationRequest(
  req: GenerationRequest,
): req is TextGenerationRequest {
  return req.type === 'text';
}

export function isWebSocketMessage<T>(
  data: unknown,
): data is WebSocketMessage<T> {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'event' in data &&
    'data' in data &&
    'timestamp' in data &&
    'id' in data
  );
}

// ============================================================================
// Validation Schemas (using Zod)
// ============================================================================

export const AgentCharacterConfigSchema = z
  .object({
    name: z.string().min(1).max(100),
    username: z.string().max(50).optional(),
    system: z.string().max(5000).optional(),
    bio: z.union([z.string(), z.array(z.string())]),
    messageExamples: z
      .array(
        z.array(
          z.object({
            user: z.string(),
            content: z.object({
              text: z.string(),
              action: z.string().optional(),
              metadata: z.record(z.unknown()).optional(),
            }),
          }),
        ),
      )
      .optional(),
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
      .optional(),
    plugins: z.array(z.string()).optional(),
    settings: z.record(z.unknown()).optional(),
    secrets: z
      .record(z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .strict();

export const ImageGenerationRequestSchema = z
  .object({
    type: z.literal('image'),
    prompt: z.string().min(1).max(2000),
    provider: z.string().optional(),
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    aspect_ratio: z.string().optional(),
    resolution: z.string().optional(),
    num_images: z.number().min(1).max(10).optional(),
    quality: z.enum(['standard', 'high']).optional(),
    style: z.string().optional(),
    negative_prompt: z.string().max(1000).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).optional(),
});

// ============================================================================
// Utility Types
// ============================================================================

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Status code unions for type safety
export type HttpStatusCode =
  | 200
  | 201
  | 400
  | 401
  | 402
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | 502
  | 503;

// Common error codes
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INSUFFICIENT_CREDITS'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';
