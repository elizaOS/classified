import { type IAgentRuntime, type UUID, logger } from '@elizaos/core';
import type { FollowUp } from '../types';
import { EventBridge } from '../managers/EventBridge';

export class FollowUpManager {
  private runtime: IAgentRuntime;
  private eventBridge: EventBridge;

  constructor(runtime: IAgentRuntime, eventBridge: EventBridge) {
    this.runtime = runtime;
    this.eventBridge = eventBridge;
  }

  async initialize(): Promise<void> {
    logger.info('[FollowUpManager] Initialized');
  }

  async stop(): Promise<void> {
    logger.info('[FollowUpManager] Stopped');
  }

  async scheduleFollowUp(
    entityId: UUID,
    message: string,
    scheduledFor: Date,
    metadata?: Record<string, any>
  ): Promise<FollowUp> {
    try {
      const followUp: FollowUp = {
        id: `followup-${entityId}-${Date.now()}`,
        entityId,
        message,
        scheduledFor: scheduledFor.toISOString(),
        completed: false,
        metadata,
      };

      // Create a task in the runtime
      await this.runtime.createTask({
        name: 'ENTITY_FOLLOWUP',
        description: `Follow up: ${message}`,
        tags: ['followup', 'entity'],
        roomId: this.runtime.agentId, // Use agent ID as room ID for now
        metadata: {
          followUp,
          entityId,
          scheduledFor: scheduledFor.toISOString(),
        },
      });

      logger.info(`Scheduled follow-up for entity ${entityId} at ${scheduledFor.toISOString()}`);
      return followUp;
    } catch (error) {
      logger.error('Error scheduling follow-up', error);
      throw error;
    }
  }

  async getFollowUps(entityId?: UUID): Promise<FollowUp[]> {
    try {
      // Get tasks with our tag
      const tasks = await this.runtime.getTasks({
        tags: ['followup'],
      });

      const followUps: FollowUp[] = [];

      for (const task of tasks) {
        if (task.metadata?.followUp) {
          const followUp = task.metadata.followUp as FollowUp;
          // Filter by entity if specified
          if (!entityId || followUp.entityId === entityId) {
            // Check if not completed
            if (!followUp.completed) {
              followUps.push(followUp);
            }
          }
        }
      }

      return followUps.sort(
        (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      );
    } catch (error) {
      logger.error('Error getting follow-ups', error);
      return [];
    }
  }

  async completeFollowUp(followUpId: string): Promise<void> {
    try {
      // For now, just log completion
      // In a real implementation, we'd mark the task as complete
      logger.info(`Marked follow-up ${followUpId} as completed`);
    } catch (error) {
      logger.error('Error completing follow-up', error);
    }
  }
}
