/**
 * Configuration validation for the Knowledge plugin
 */
import type { IAgentRuntime } from '@elizaos/core';
// import { ModelType } from '@elizaos/core';
import { logger } from '@elizaos/core';

export interface ValidatedModelConfig {
  CTX_KNOWLEDGE_ENABLED: boolean;
  LOAD_DOCS_ON_STARTUP: boolean;
  MAX_INPUT_TOKENS?: number;
  MAX_OUTPUT_TOKENS?: number;
  EMBEDDING_PROVIDER: string;
  TEXT_PROVIDER?: string;
  TEXT_EMBEDDING_MODEL: string;
}

/**
 * Validates the model configuration for the Knowledge plugin
 * @param runtime The agent runtime instance
 * @returns Validated configuration object
 */
export function validateModelConfig(runtime?: IAgentRuntime): ValidatedModelConfig {
  // Check if CTX_KNOWLEDGE_ENABLED is set
  const ctxKnowledgeEnabled =
    runtime?.getSetting('CTX_KNOWLEDGE_ENABLED') === 'true' ||
    process.env.CTX_KNOWLEDGE_ENABLED === 'true' ||
    false;

  // Check if docs should be loaded on startup
  const loadDocsOnStartup =
    runtime?.getSetting('LOAD_DOCS_ON_STARTUP') !== 'false' &&
    process.env.LOAD_DOCS_ON_STARTUP !== 'false';

  // Get token limits
  const maxInputTokens = parseInt(
    runtime?.getSetting('MAX_INPUT_TOKENS') || process.env.MAX_INPUT_TOKENS || '4000',
    10
  );
  const maxOutputTokens = parseInt(
    runtime?.getSetting('MAX_OUTPUT_TOKENS') || process.env.MAX_OUTPUT_TOKENS || '4096',
    10
  );

  // Guard against NaN
  const finalMaxInputTokens = Number.isNaN(maxInputTokens) ? 4000 : maxInputTokens;
  const finalMaxOutputTokens = Number.isNaN(maxOutputTokens) ? 4096 : maxOutputTokens;

  // Get embedding provider configuration
  let embeddingProvider =
    runtime?.getSetting('EMBEDDING_PROVIDER') || process.env.EMBEDDING_PROVIDER || '';
  let textEmbeddingModel =
    runtime?.getSetting('TEXT_EMBEDDING_MODEL') || process.env.TEXT_EMBEDDING_MODEL || '';

  // Auto-detect from plugin-openai if not explicitly set
  if (!embeddingProvider && runtime) {
    // Since getModel returns a function, we can't check provider directly
    // Instead, just default to openai if not set
    embeddingProvider = 'openai';
    textEmbeddingModel = textEmbeddingModel || 'text-embedding-3-small';
    logger.info('Defaulting to OpenAI provider for embeddings');
  }

  // Get text generation provider configuration (only needed if CTX_KNOWLEDGE_ENABLED)
  let textProvider: string | undefined;
  if (ctxKnowledgeEnabled) {
    textProvider = runtime?.getSetting('TEXT_PROVIDER') || process.env.TEXT_PROVIDER || '';

    // Auto-detect text provider if not set
    if (!textProvider && runtime) {
      // Default to openai if not set
      textProvider = 'openai';
      logger.info('Defaulting to OpenAI provider for text generation');
    }
  }

  // Validate required configurations
  if (!embeddingProvider) {
    throw new Error(
      'Knowledge plugin requires an embedding provider. ' +
        'Please set EMBEDDING_PROVIDER environment variable or ensure plugin-openai is loaded.'
    );
  }

  if (!textEmbeddingModel) {
    throw new Error(
      'Knowledge plugin requires TEXT_EMBEDDING_MODEL to be set. ' +
        'Example: TEXT_EMBEDDING_MODEL=text-embedding-3-small'
    );
  }

  if (ctxKnowledgeEnabled && !textProvider) {
    throw new Error(
      'When CTX_KNOWLEDGE_ENABLED=true, TEXT_PROVIDER must be set. ' +
        'Example: TEXT_PROVIDER=openai'
    );
  }

  return {
    CTX_KNOWLEDGE_ENABLED: ctxKnowledgeEnabled,
    LOAD_DOCS_ON_STARTUP: loadDocsOnStartup,
    MAX_INPUT_TOKENS: finalMaxInputTokens,
    MAX_OUTPUT_TOKENS: finalMaxOutputTokens,
    EMBEDDING_PROVIDER: embeddingProvider,
    TEXT_PROVIDER: textProvider,
    TEXT_EMBEDDING_MODEL: textEmbeddingModel,
  };
}
