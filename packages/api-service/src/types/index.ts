/**
 * API Service Types - OpenAI-compatible multi-provider inference
 */

import type { UsageMetadata } from '../database/schema.js';

// Hono context variables
export type HonoVariables = {
  user?: {
    id: string;
    organizationId?: string;
  };
  apiKey?: {
    id: string;
    permissions: string[];
  };
  organization?: {
    id: string;
    subscriptionTier: string;
    limits: OrganizationLimits;
  };
  requestId?: string;
  startTime?: number;
};

export interface APIServiceConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  jwtSecret: string;
  platformUrl: string;
  database: {
    url: string;
    maxConnections: number;
  };
  redis: {
    url: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  providers: ProviderConfigs;
}

export interface ProviderConfigs {
  openai: ProviderConfig;
  anthropic: ProviderConfig;
  google: ProviderConfig;
  xai: ProviderConfig;
}

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string | undefined;
  maxRetries?: number | undefined;
  timeout?: number | undefined;
  enabled: boolean;
}

export interface ModelConfig {
  id: string;
  provider: string;
  name: string;
  inputCostPerToken: number;
  outputCostPerToken: number;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  capabilities: string[];
  description: string;
}

export interface UsageRecord {
  id: string;
  organizationId: string;
  userId?: string | undefined;
  apiKeyId?: string | undefined;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  markup: number;
  finalCost: number;
  timestamp: Date;
  requestId: string;
  metadata: UsageMetadata;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: string | object;
  user?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | MessageContent[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface CompletionResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  provider: string;
  choices: Choice[];
  usage?: Usage;
  system_fingerprint?: string;
}

export interface Choice {
  index: number;
  message?: Message;
  delta?: MessageDelta;
  finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface MessageDelta {
  role?: string;
  content?: string;
  tool_calls?: ToolCall[];
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cost: number;
  completion_cost: number;
  total_cost: number;
}

export interface EmbeddingRequest {
  input: string | string[];
  model: string;
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

export interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  provider: string;
  usage: EmbeddingUsage;
}

export interface Embedding {
  object: 'embedding';
  index: number;
  embedding: number[];
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
  total_cost: number;
}

export interface ModelListResponse {
  object: 'list';
  data: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  provider: string;
  pricing: {
    input: number;
    output: number;
  };
  capabilities: string[];
  max_tokens: number;
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface PricingData {
  provider: string;
  models: Record<string, ModelPricing>;
  lastUpdated: Date;
  source: string;
}

export interface ModelPricing {
  inputCostPerToken: number;
  outputCostPerToken: number;
  currency: string;
  effectiveDate: string;
}

export interface OrganizationLimits {
  maxApiRequests: number;
  maxTokensPerRequest: number;
  allowedModels: string[];
  allowedProviders: string[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface ProxyResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  usage?: Usage;
  rateLimit?: RateLimitInfo;
  requestId: string;
  provider: string;
  model: string;
  processingTime: number;
}

export interface ProviderMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  totalCost: number;
  totalTokens: number;
  lastRequest: Date;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: boolean;
    redis: boolean;
    providers: Record<string, boolean>;
  };
  metrics: {
    requestsPerMinute: number;
    averageLatency: number;
    errorRate: number;
  };
}
