/**
 * Common type definitions to eliminate 'as any' type casting
 */

// Metadata types
export interface BaseMetadata {
  [key: string]: unknown;
}

export interface CommonTransactionMetadata extends BaseMetadata {
  stripeCheckoutSessionId?: string;
  stripeCustomerId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeAmount?: number;
  stripeCurrency?: string;
  isAutoTopUp?: boolean;
  payment_id?: string;
  transaction_hash?: string;
  token_symbol?: string;
  amount_crypto?: string;
  amount_usd?: number;
  errorTest?: boolean;
  concurrentTest?: boolean;
  performanceTest?: boolean;
  test?: string;
}

export interface GenerationRequestWithAuth {
  type: string;
  prompt: string;
  provider?: string;
  organizationId: string;
  userId: string;
  aspect_ratio?: string;
  resolution?: string;
  num_images?: number;
  quality?: string;
  duration?: number;
  fps?: number;
  voice_id?: string;
  output_format?: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
  };
  temperature?: number;
  max_tokens?: number;
  metadata?: BaseMetadata;
}

export interface SelectChangeEvent {
  target: {
    value: string;
  };
}

export interface DatabaseRow {
  conversationId?: string;
  roomId?: string;
  worldId?: string;
  entityId?: string;
  isUnique?: boolean;
  metadata?: BaseMetadata;
}

// Status types for payload validation
export interface AuthPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  status?: 'active' | 'inactive';
  organizationStatus?: 'active' | 'suspended';
}

// Promise with metadata for cleanup tracking
export interface TrackedPromise<T> extends Promise<T> {
  _createdAt?: number;
}

// Error with status code
export interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

// UUID type alias for clarity
export type UUIDString = string;

// WorkOS type extensions (until their types are fixed)
export interface WorkOSExtended {
  users?: {
    getUser(userId: string): Promise<any>;
    createUser(data: any): Promise<any>;
    sendVerificationEmail(userId: string): Promise<void>;
  };
  passwordless?: {
    sendSession(data: any): Promise<void>;
  };
  organizationMemberships?: {
    listOrganizationMemberships(params: any): Promise<{ data: any[] }>;
    createOrganizationMembership(data: any): Promise<any>;
    deleteOrganizationMembership(membershipId: string): Promise<void>;
  };
}

// Database schema proxy type
export type SchemaProxy<T> = {
  [K in keyof T]: T[K];
};

// Runtime adapter type
export interface RuntimeAdapter {
  adapter?: {
    close(): Promise<void>;
    isReady(): Promise<boolean>;
  };
}

// Generation request types
export interface ImageGenerationRequestTyped extends GenerationRequestWithAuth {
  type: 'IMAGE';
  num_images?: number;
  quality?: 'standard' | 'high';
  aspect_ratio?: string;
  resolution?: string;
}

export interface VideoGenerationRequestTyped extends GenerationRequestWithAuth {
  type: 'VIDEO';
  duration?: number;
  fps?: number;
  motion_prompt?: string;
  seed_image_url?: string;
}

export interface AudioGenerationRequestTyped extends GenerationRequestWithAuth {
  type: 'AUDIO';
  voice_id?: string;
  output_format?: 'mp3' | 'wav' | 'flac' | 'ogg';
  voice_settings?: {
    stability: number;
    similarity_boost: number;
  };
}

// Type guards
export function isImageGenerationRequest(
  req: GenerationRequestWithAuth,
): req is ImageGenerationRequestTyped {
  return req.type === 'IMAGE';
}

export function isVideoGenerationRequest(
  req: GenerationRequestWithAuth,
): req is VideoGenerationRequestTyped {
  return req.type === 'VIDEO';
}

export function isAudioGenerationRequest(
  req: GenerationRequestWithAuth,
): req is AudioGenerationRequestTyped {
  return req.type === 'AUDIO';
}

export function hasStatusCode(error: unknown): error is ErrorWithStatus {
  return error instanceof Error && ('status' in error || 'statusCode' in error);
}

export function isAuthPayload(payload: unknown): payload is AuthPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'userId' in payload &&
    'organizationId' in payload &&
    'email' in payload
  );
}
