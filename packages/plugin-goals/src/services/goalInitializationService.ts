import { type IAgentRuntime, logger, Service } from '@elizaos/core';
import { GoalDataManager } from './goalDataService.js';

/**
 * Service to handle initialization of default goals after database is ready
 */
export class GoalInitializationService extends Service {
  static serviceType = 'GOAL_INITIALIZATION' as any;

  capabilityDescription = 'Handles initialization of default goals after database migration';

  async stop(): Promise<void> {
    // No cleanup needed
  }

  static async start(runtime: IAgentRuntime): Promise<GoalInitializationService> {
    const service = new GoalInitializationService();

    // Wait a bit for database migrations to complete, then create initial goals
    // Use multiple retry attempts to handle migration timing
    setTimeout(() => {
      service.createInitialGoalsWithRetry(runtime, 0);
    }, 7777); // Wait 3 seconds for migrations to complete

    return service;
  }

  /**
   * Create initial default goals with retry logic
   */
  private async createInitialGoalsWithRetry(runtime: IAgentRuntime, retryCount: number): Promise<void> {
    try {
      await this.createInitialGoalsDeferred(runtime);
    } catch (error) {
      if (retryCount < 3) {
        logger.warn(`[Goal Initialization] Retry ${retryCount + 1}/3 in 2 seconds:`, (error as Error).message);
        setTimeout(() => {
          this.createInitialGoalsWithRetry(runtime, retryCount + 1);
        }, 2000);
      } else {
        logger.error('[Goal Initialization] Failed to create initial goals after 3 retries:', error);
      }
    }
  }

  /**
   * Create initial default goals for new agents (deferred after database is ready)
   */
  private async createInitialGoalsDeferred(runtime: IAgentRuntime): Promise<void> {
    try {
      logger.info('[Goal Initialization] Creating initial default goals...');

      if (!runtime.db) {
        logger.warn('[Goal Initialization] Database not available, skipping initial goals creation');
        return;
      }

      // Create a goal data manager instance
      const goalManager = new GoalDataManager(runtime);

      // First, check if the goals table exists by trying a simple query
      try {
        // Import the goals table from schema
        const { goalsTable } = await import('../schema.js');
        await runtime.db.select().from(goalsTable).limit(1);
      } catch (error) {
        throw new Error(`Goals table not ready: ${(error as Error).message}`);
      }
      
      // Check if we already have goals for this agent
      const existingGoals = await goalManager.getGoals({
        ownerType: 'agent',
        ownerId: runtime.agentId
      });

      if (existingGoals && existingGoals.length > 0) {
        logger.info('[Goal Initialization] Goals already exist, skipping initial creation');
        return;
      }

      // Create initial default goals
      const initialGoals = [
        {
          agentId: runtime.agentId,
          ownerType: 'agent' as const,
          ownerId: runtime.agentId,
          name: 'Communicate with the admin',
          description: 'Establish and maintain communication with the admin user to understand their needs and provide assistance',
          tags: ['communication', 'admin', 'relationship'],
        },
        {
          agentId: runtime.agentId,
          ownerType: 'agent' as const,
          ownerId: runtime.agentId,
          name: 'Read the message from the founders',
          description: 'Find and read any important messages or documentation from the project founders to understand the mission',
          tags: ['learning', 'founders', 'documentation'],
        },
      ];

      for (const goal of initialGoals) {
        try {
          const goalId = await goalManager.createGoal(goal);
          if (goalId) {
            logger.info(`[Goal Initialization] Created initial goal: ${goal.name}`);
          } else {
            logger.warn(`[Goal Initialization] Failed to create goal: ${goal.name}`);
          }
        } catch (error) {
          logger.warn(`[Goal Initialization] Error creating goal "${goal.name}":`, (error as Error).message);
        }
      }

      logger.info('[Goal Initialization] Initial goals creation complete');
    } catch (error) {
      logger.error('[Goal Initialization] Error creating initial goals:', error);
    }
  }
}