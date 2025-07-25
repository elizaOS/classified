import type { Plugin } from '@elizaos/core';
import { type IAgentRuntime, logger } from '@elizaos/core';

import { routes } from './apis';

// Import actions
import { cancelGoalAction } from './actions/cancelGoal';
import { completeGoalAction } from './actions/completeGoal';
import { confirmGoalAction } from './actions/confirmGoal';
import { createGoalAction } from './actions/createGoal';
import { updateGoalAction } from './actions/updateGoal';

// Import providers
import { goalsProvider } from './providers/goals';

// Import services
import { GoalDataService, GoalDataManager } from './services/goalDataService';
import { GoalInitializationService } from './services/goalInitializationService';

// Import schema
import { goalSchema } from './schema';

// Note: Table schemas are defined in schema.ts and will be automatically migrated

// Import tests
import { GoalsPluginE2ETestSuite } from './tests';
import { testSuites as e2eTestSuites } from './__tests__/e2e';


/**
 * The GoalsPlugin provides goal management functionality,
 * including creating, completing, updating, and canceling goals.
 */
export const GoalsPlugin: Plugin = {
  name: 'goals',
  description: 'Provides goal management functionality for tracking and achieving objectives.',
  providers: [goalsProvider],
  dependencies: ['@elizaos/plugin-sql'],
  testDependencies: ['@elizaos/plugin-sql'],
  actions: [
    createGoalAction,
    completeGoalAction,
    confirmGoalAction,
    updateGoalAction,
    cancelGoalAction,
  ],
  services: [GoalDataService], // Removed GoalInitializationService for now due to database timing issues
  routes,
  schema: goalSchema,
  tests: [GoalsPluginE2ETestSuite, ...e2eTestSuites],

  async init(config: Record<string, string>, runtime: IAgentRuntime): Promise<void> {
    try {
      logger.info('[Goals Plugin] Initializing...');

      // Goals tables will be created through the standard schema system
      // The tables are defined in schema.ts and will be migrated automatically
      // when the plugin schema is processed by the SQL plugin

      // Database migrations are handled by the SQL plugin
      if (runtime.db) {
        logger.info('[Goals Plugin] Database available, GoalsPlugin ready for operation');
        
        // Note: Initial goals creation will be deferred until after migrations
        // This is handled by a separate initialization service
        
      } else {
        logger.warn('[Goals Plugin] No database instance available, operations will be limited');
      }

      logger.info('[Goals Plugin] GoalsPlugin initialized successfully');
    } catch (error) {
      logger.error('[Goals Plugin] Error initializing GoalsPlugin:', error);
      throw error;
    }
  },
};

export default GoalsPlugin;

// Export data service utilities
export { createGoalDataService, GoalDataService } from './services/goalDataService';
export type { GoalData } from './services/goalDataService';

// Export schema
export { goalSchema } from './schema';
