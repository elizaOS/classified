/**
 * Knowledge Plugin - Main Entry Point
 *
 * This file exports all the necessary functions and types for the Knowledge plugin.
 */
import { validateModelConfig } from './config.js';
import { KnowledgeService } from './service.js';
import { knowledgeProvider } from './provider.js';
import knowledgeTestSuite from './tests.js';
import { knowledgeActions } from './actions.js';
import { knowledgeRoutes } from './routes.js';
import { knowledgeSchema } from './schema.js';
import type { Plugin, IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';

/**
 * Knowledge Plugin - Provides Retrieval Augmented Generation capabilities
 */
export const knowledgePlugin: Plugin = {
  name: 'knowledge',
  description: 'Plugin for managing and searching knowledge',

  actions: [
    // All knowledge actions enabled - high-level productivity functionality
    ...knowledgeActions,
  ],

  providers: [knowledgeProvider],
  services: [KnowledgeService],
  routes: knowledgeRoutes,
  tests: [knowledgeTestSuite],
  schema: knowledgeSchema,
  init: async (config: Record<string, string>, runtime: IAgentRuntime) => {
    logger.info('Initializing Knowledge Plugin...');

    // Validate model configuration at plugin initialization
    try {
      await validateModelConfig(runtime);
      logger.info('Model configuration validated successfully.');
    } catch (error) {
      logger.error('Model configuration validation failed:', error);
      throw error;
    }

    logger.info(`Knowledge Plugin initialized for agent: ${runtime.agentId}`);
    logger.info(
      'Knowledge Plugin initialized. Frontend panel should be discoverable via its public route.'
    );
  },
};

export default knowledgePlugin;

export * from './types.js';
