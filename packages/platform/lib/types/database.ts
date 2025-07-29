/**
 * Comprehensive database type definitions for ElizaOS platform
 * Provides strongly-typed interfaces to replace Record<string, any> patterns
 */

import type {
  Agent,
  User,
  Organization,
  CreditTransaction,
  Generation,
  CryptoPayment,
  WalletConnection,
} from '@/lib/database/schema';

// ============================================================================
// Agent and Character Types
// ============================================================================

export interface CharacterBio {
  description: string;
  background: string;
  personality: string[];
  interests: string[];
  skills: string[];
}

export interface MessageExample {
  user: string;
  content: {
    text: string;
    action?: string;
    emotion?: string;
    metadata?: MessageMetadata;
  };
}

export interface MessageMetadata {
  sentiment?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  topics?: string[];
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  [key: string]: unknown;
}

export interface KnowledgeItem {
  path: string;
  shared?: boolean;
  type?: 'file' | 'url' | 'text';
  metadata?: {
    title?: string;
    description?: string;
    tags?: string[];
    lastModified?: string;
  };
}

export interface CharacterSettings {
  responseStyle?: 'formal' | 'casual' | 'professional' | 'creative';
  verbosity?: 'concise' | 'normal' | 'detailed';
  emotionalRange?: number; // 0-1
  creativity?: number; // 0-1
  consistency?: number; // 0-1
  memoryRetention?: number; // 0-1
  personalityTraits?: string[];
  customPrompts?: {
    system?: string;
    greeting?: string;
    farewell?: string;
  };
}

export interface CharacterSecrets {
  apiKeys?: Record<string, string>;
  credentials?: Record<
    string,
    {
      username: string;
      password: string;
      metadata?: Record<string, unknown>;
    }
  >;
  tokens?: Record<
    string,
    {
      value: string;
      expiresAt?: string;
      scopes?: string[];
    }
  >;
  webhooks?: Record<
    string,
    {
      url: string;
      secret: string;
      events: string[];
    }
  >;
}

export interface StrictCharacterConfig {
  id?: string;
  name: string;
  username?: string;
  system?: string;
  bio: string | string[] | CharacterBio;
  messageExamples?: MessageExample[][];
  knowledge?: Array<string | KnowledgeItem>;
  plugins?: string[];
  settings?: CharacterSettings;
  secrets?: CharacterSecrets;
}

// ============================================================================
// Agent Runtime Configuration
// ============================================================================

export interface ModelConfiguration {
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface ProviderConfiguration {
  name: string;
  enabled: boolean;
  priority: number;
  configuration: Record<string, unknown>;
  rateLimits?: {
    requests: number;
    tokens: number;
    windowMs: number;
  };
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  encrypted: boolean;
  description?: string;
}

export interface StrictRuntimeConfig {
  models?: Record<string, ModelConfiguration>;
  providers?: ProviderConfiguration[];
  maxTokens?: number;
  temperature?: number;
  environment?: EnvironmentVariable[];
  features?: {
    memoryEnabled: boolean;
    learningEnabled: boolean;
    planningEnabled: boolean;
    toolsEnabled: boolean;
  };
  security?: {
    maxRequestSize: number;
    rateLimiting: boolean;
    contentFiltering: boolean;
    auditLogging: boolean;
  };
}

// ============================================================================
// Generation Request Metadata
// ============================================================================

export interface GenerationParameters {
  // Image generation
  aspect_ratio?: string;
  resolution?: string;
  num_images?: number;
  quality?: 'standard' | 'high';
  style?: string;
  negative_prompt?: string;

  // Video generation
  duration?: number;
  fps?: number;
  motion_prompt?: string;
  seed_image_url?: string;

  // Audio generation
  voice_id?: string;
  output_format?: 'mp3' | 'wav' | 'flac' | 'ogg';
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };

  // Text generation
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop_sequences?: string[];

  // Common
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
}

export interface GenerationOutput {
  id: string;
  url: string;
  format: string;
  size?: number;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
    codec?: string;
    frameRate?: number;
    channels?: number;
    sampleRate?: number;
    fingerprint?: string;
    cost?: number;
  };
}

export interface GenerationMetadata {
  requestSource: 'api' | 'dashboard' | 'plugin' | 'automation';
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  sessionId?: string;
  organizationId: string;
  userId: string;
  projectId?: string;
  batchId?: string;

  // Quality metrics
  qualityScore?: number;
  userRating?: number;
  processingMetrics?: {
    queueTime: number;
    processingTime: number;
    totalTime: number;
    retryCount: number;
  };

  // Cost tracking
  providerCost?: number;
  markupMultiplier?: number;
  creditsCharged?: number;

  // A/B testing
  experimentId?: string;
  variant?: string;

  // Error information
  errorCategory?: string;
  errorDetails?: Record<string, unknown>;
}

// ============================================================================
// Billing and Payment Metadata
// ============================================================================

export interface StripeMetadata {
  stripeCheckoutSessionId?: string;
  stripeCustomerId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeAmount?: number;
  stripeCurrency?: string;
  stripePaymentMethodId?: string;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
}

export interface CryptoMetadata {
  walletAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  amountCrypto: string;
  amountUsd: number;
  chainId: number;
  transactionHash?: string;
  blockNumber?: number;
  blockConfirmations?: number;
  walletType?: string;
  slippageTolerance?: number;
  gasUsed?: number;
  gasPriceGwei?: number;
}

export interface TransactionMetadata extends StripeMetadata {
  // Crypto fields
  payment_id?: string;
  transaction_hash?: string;
  token_symbol?: string;
  amount_crypto?: string;
  amount_usd?: number;
  chain_id?: number;
  wallet_address?: string;

  // Auto top-up
  isAutoTopUp?: boolean;
  autoTopUpThreshold?: number;

  // Promotions and discounts
  promotionCode?: string;
  discountAmount?: number;
  discountPercentage?: number;

  // Usage context
  generationId?: string;
  serviceType?: string;
  usageCategory?: string;

  // Testing flags
  errorTest?: boolean;
  concurrentTest?: boolean;
  performanceTest?: boolean;
  test?: string;
}

// ============================================================================
// User and Organization Metadata
// ============================================================================

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  preferredLanguage?: string;

  // Preferences
  notifications?: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
  };

  // Usage preferences
  defaultVisibility?: 'private' | 'organization' | 'public';
  preferredModels?: string[];
  customSettings?: Record<string, unknown>;
}

export interface OrganizationSettings {
  // Billing
  billingContact?: {
    name: string;
    email: string;
    phone?: string;
  };

  // Features
  features?: {
    agentSharing: boolean;
    advancedAnalytics: boolean;
    customModels: boolean;
    apiAccess: boolean;
    ssoEnabled: boolean;
  };

  // Limits
  limits?: {
    maxAgents: number;
    maxGenerationsPerMonth: number;
    maxStorageGB: number;
    maxTeamMembers: number;
  };

  // Security
  security?: {
    requireMFA: boolean;
    allowedDomains?: string[];
    ipWhitelist?: string[];
    auditLogRetentionDays: number;
  };

  // Branding
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    customDomain?: string;
  };
}

// ============================================================================
// Analytics and Metrics Metadata
// ============================================================================

export interface UsageMetrics {
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
  generationsByType: Record<string, number>;
  generationsByProvider: Record<string, number>;
  totalCost: number;
  averageCost: number;
  successRate: number;
  averageProcessingTime: number;
  topUsers: Array<{
    userId: string;
    generations: number;
    cost: number;
  }>;
  topAgents: Array<{
    agentId: string;
    interactions: number;
    cost: number;
  }>;
}

export interface PerformanceMetrics {
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    tokensPerSecond: number;
  };
  errorRates: {
    total: number;
    byProvider: Record<string, number>;
    byType: Record<string, number>;
  };
  availability: {
    uptime: number;
    incidents: number;
  };
}

// ============================================================================
// WebSocket and Real-time Data
// ============================================================================

export interface WebSocketEventData {
  // Agent events
  agentStatusChanged?: {
    agentId: string;
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
    message?: string;
  };

  // Generation events
  generationUpdated?: {
    generationId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress?: number;
    estimatedTimeRemaining?: number;
    outputs?: GenerationOutput[];
    error?: string;
  };

  // Credit events
  creditsUpdated?: {
    organizationId: string;
    newBalance: number;
    change: number;
    reason: string;
  };

  // System events
  systemMaintenance?: {
    type: 'scheduled' | 'emergency';
    startTime: string;
    estimatedDuration: number;
    affectedServices: string[];
    message: string;
  };
}

// ============================================================================
// Database Extension Types
// ============================================================================

export type StrictAgent = Omit<Agent, 'character' | 'runtimeConfig'> & {
  character: StrictCharacterConfig;
  runtimeConfig?: StrictRuntimeConfig;
};

export type StrictGeneration = Omit<
  Generation,
  'parameters' | 'outputs' | 'metadata'
> & {
  parameters: GenerationParameters;
  outputs: GenerationOutput[];
  metadata: GenerationMetadata;
};

export type StrictCreditTransaction = Omit<CreditTransaction, 'metadata'> & {
  metadata: TransactionMetadata;
};

export type StrictUser = Omit<User, 'metadata'> & {
  metadata: UserProfile;
};

export type StrictOrganization = Omit<Organization, 'metadata'> & {
  metadata: OrganizationSettings;
};

export type StrictCryptoPayment = Omit<CryptoPayment, 'metadata'> & {
  metadata: CryptoMetadata;
};

// ============================================================================
// Query Result Types
// ============================================================================

export interface AgentWithStats extends StrictAgent {
  stats: {
    totalInteractions: number;
    totalCost: number;
    averageResponseTime: number;
    lastActiveAt: string;
    successRate: number;
  };
}

export interface GenerationWithDetails extends StrictGeneration {
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  organization: Pick<Organization, 'id' | 'name'>;
  agent?: Pick<Agent, 'id' | 'name'>;
}

export interface CreditTransactionWithContext extends StrictCreditTransaction {
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  organization: Pick<Organization, 'id' | 'name'>;
  generation?: Pick<Generation, 'id' | 'type' | 'prompt'>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isStrictCharacterConfig(
  obj: unknown,
): obj is StrictCharacterConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'name' in obj &&
    typeof (obj as StrictCharacterConfig).name === 'string'
  );
}

export function isStrictRuntimeConfig(
  obj: unknown,
): obj is StrictRuntimeConfig {
  return typeof obj === 'object' && obj !== null;
}

export function isGenerationParameters(
  obj: unknown,
): obj is GenerationParameters {
  return typeof obj === 'object' && obj !== null;
}

export function isTransactionMetadata(
  obj: unknown,
): obj is TransactionMetadata {
  return typeof obj === 'object' && obj !== null;
}
