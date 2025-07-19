import type { Plugin, IAgentRuntime } from '@elizaos/core';
import { logger } from '@elizaos/core';

import { characterEvolutionEvaluator } from './evaluators/character-evolution.js';
import { modifyCharacterAction } from './actions/modify-character.js';
import { restoreCharacterAction } from './actions/restore-character.js';
import { characterEvolutionProvider } from './providers/character-evolution.js';
import { CharacterFileManager } from './services/character-file-manager.js';
import testSuites from './__tests__/e2e/index.js';
// Test imports removed - tests now use bun:test format
// Temporarily comment out scenarios until type issues are resolved
// import adminCharacterModificationScenario from './scenarios/admin-character-modification.js';
// import agentSelfModificationScenario from './scenarios/agent-self-modification.js';
// import personalityEvolutionScenario from './scenarios/personality-evolution.js';
// import personalityResistanceScenario from './scenarios/personality-resistance.js';
// import selectivePersonalityChangesScenario from './scenarios/selective-personality-changes.js';
// import coreIdentityPreservationScenario from './scenarios/core-identity-preservation.js';

/**
 * Self-Modification Plugin for ElizaOS
 *
 * Enables agents to evolve their character files over time through:
 * - Conversation analysis and learning
 * - User feedback integration
 * - Gradual personality development
 * - Safe character file management
 *
 * Features:
 * - CHARACTER_EVOLUTION evaluator: Analyzes conversations for evolution opportunities
 * - MODIFY_CHARACTER action: Handles direct character modifications
 * - CHARACTER_EVOLUTION provider: Supplies self-reflection context
 * - CharacterFileManager service: Manages safe file operations with backups
 */
export const selfModificationPlugin: Plugin = {
  name: '@elizaos/plugin-personality',
  description:
    'Enables agent self-modification and character evolution through conversation analysis and user feedback',

  // Core components
  evaluators: [characterEvolutionEvaluator],
  actions: [modifyCharacterAction, restoreCharacterAction],
  providers: [characterEvolutionProvider],
  services: [CharacterFileManager],

  // Test suites removed - now using bun:test format
  tests: testSuites,

  scenarios: [
    // adminCharacterModificationScenario,
    // agentSelfModificationScenario,
    // personalityEvolutionScenario,
    // personalityResistanceScenario,
    // selectivePersonalityChangesScenario,
    // coreIdentityPreservationScenario
  ],

  // Plugin configuration
  config: {
    // Evolution settings
    EVOLUTION_COOLDOWN_MS: 5 * 60 * 1000, // 5 minutes between evaluations
    MODIFICATION_CONFIDENCE_THRESHOLD: 0.7, // Minimum confidence for auto-modifications
    MAX_BIO_ELEMENTS: 20,
    MAX_TOPICS: 50,
    MAX_BACKUPS: 10,

    // Safety settings
    REQUIRE_ADMIN_APPROVAL: false, // Set to true in production
    ENABLE_AUTO_EVOLUTION: true,
    VALIDATE_MODIFICATIONS: true,

    // File management
    BACKUP_DIRECTORY: '.eliza/character-backups',
    CHARACTER_FILE_DETECTION: true,
  },

  async init(config: Record<string, string>, runtime: IAgentRuntime): Promise<void> {
    logger.info('Self-Modification Plugin initializing...');

    try {
      // Validate environment
      const characterFileManager =
        runtime.getService<CharacterFileManager>('character-file-manager');
      if (!characterFileManager) {
        logger.warn(
          'CharacterFileManager service not available - file modifications will be memory-only'
        );
      }

      // Log current character state
      const character = runtime.character;
      const characterStats = {
        name: character.name,
        bioElements: Array.isArray(character.bio) ? character.bio.length : 1,
        topics: character.topics?.length || 0,
        messageExamples: character.messageExamples?.length || 0,
        hasStyleConfig: !!(character.style?.all || character.style?.chat || character.style?.post),
        hasSystemPrompt: !!character.system,
      };

      logger.info('Current character state', characterStats);

      // Initialize evolution tracking using proper cache methods
      try {
        await runtime.setCache('self-modification:initialized', Date.now().toString());
        await runtime.setCache('self-modification:modification-count', '0');
        logger.info('Evolution tracking initialized');
      } catch (cacheError) {
        logger.warn('Cache initialization failed, continuing without cache', cacheError);
      }

      // Create proper initialization memory with correct structure
      try {
        const initMemory = {
          entityId: runtime.agentId,
          roomId: runtime.agentId, // Use agentId as roomId for plugin memories
          content: {
            text: `Self-modification plugin initialized. Character: ${characterStats.name}, Bio: ${characterStats.bioElements} elements, Topics: ${characterStats.topics}, System: ${characterStats.hasSystemPrompt ? 'present' : 'none'}`,
            source: 'plugin_initialization',
          },
          metadata: {
            type: 'custom' as const,
            plugin: '@elizaos/plugin-personality',
            timestamp: Date.now(),
            characterBaseline: characterStats,
          },
        };

        await runtime.createMemory(initMemory, 'plugin_events');
        logger.info('Plugin initialization memory created');
      } catch (memoryError) {
        logger.warn('Failed to create initialization memory, continuing', memoryError);
      }

      logger.info('Self-Modification Plugin initialized successfully', {
        evolutionEnabled: config.ENABLE_AUTO_EVOLUTION !== 'false',
        fileManagerAvailable: !!characterFileManager,
        confidenceThreshold: config.MODIFICATION_CONFIDENCE_THRESHOLD || '0.7',
        characterHasSystem: characterStats.hasSystemPrompt,
      });
    } catch (error) {
      logger.error('Critical error during plugin initialization', error);
      throw error;
    }
  },
};

// Export individual components for testing
export {
  characterEvolutionEvaluator,
  modifyCharacterAction,
  restoreCharacterAction,
  characterEvolutionProvider,
  CharacterFileManager,
};

// Test suites and scenarios exports removed - now using bun:test format

// Default export for easy import
export default selfModificationPlugin;
