/**
 * Platform type definitions index
 * Central export file for all platform types
 */

// Export API types
export * from './api';

// Export database types
export * from './database';

// Export common types (re-export from existing)
export * from './common';

// Type utility exports
export type {
  HttpStatusCode,
  ErrorCode,
  RequiredKeys,
  OptionalKeys,
  DeepPartial,
} from './api';

export type {
  StrictAgent,
  StrictGeneration,
  StrictCreditTransaction,
  StrictUser,
  StrictOrganization,
  StrictCryptoPayment,
  AgentWithStats,
  GenerationWithDetails,
  CreditTransactionWithContext,
} from './database';

// Type guards re-export
export {
  isImageGenerationRequest,
  isVideoGenerationRequest,
  isAudioGenerationRequest,
  isTextGenerationRequest,
  isWebSocketMessage,
} from './api';

export {
  isStrictCharacterConfig,
  isStrictRuntimeConfig,
  isGenerationParameters,
  isTransactionMetadata,
} from './database';
