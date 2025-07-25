import type { IAgentRuntime, UUID } from '@elizaos/core';
import { validateUuid, logger } from '@elizaos/core';
import express from 'express';
import type { AgentServer } from '../../index';
import { sendError, sendSuccess } from '../shared/response-utils';

interface Goal {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'paused';
  progress: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Agent goals management operations
 */
export function createAgentGoalsRouter(
  agents: Map<UUID, IAgentRuntime>,
  serverInstance: AgentServer
): express.Router {
  const router = express.Router();

  // Get all goals for an agent
  router.get('/:agentId/goals', async (req, res) => {
    const agentId = validateUuid(req.params.agentId);
    if (!agentId) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid agent ID format');
    }

    const runtime = agents.get(agentId);
    if (!runtime) {
      return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
    }

    try {
      // In a full implementation, this would fetch from database
      // For now, return some example goals
      const goals: Goal[] = [
        {
          id: '1',
          name: 'Learn about user preferences',
          description: 'Understand what the user likes and dislikes to provide better assistance',
          status: 'active',
          progress: 65,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { priority: 'high' }
        },
        {
          id: '2', 
          name: 'Improve conversation skills',
          description: 'Develop better natural language understanding and generation',
          status: 'active',
          progress: 40,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { priority: 'medium' }
        }
      ];

      sendSuccess(res, { goals });
    } catch (error) {
      logger.error('[GOALS GET] Error getting goals:', error);
      sendError(
        res,
        500,
        'GOALS_ERROR',
        'Error retrieving goals',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Create a new goal
  router.post('/:agentId/goals', async (req, res) => {
    const agentId = validateUuid(req.params.agentId);
    if (!agentId) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid agent ID format');
    }

    const runtime = agents.get(agentId);
    if (!runtime) {
      return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
    }

    const { name, description, metadata } = req.body;

    if (!name || !description) {
      return sendError(res, 400, 'MISSING_FIELDS', 'Name and description are required');
    }

    try {
      const newGoal: Goal = {
        id: Date.now().toString(), // Simple ID generation
        name,
        description,
        status: 'active',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: metadata || {}
      };

      logger.info(`[GOALS CREATE] Created goal "${name}" for agent ${runtime.character.name}`);
      
      // In a full implementation, this would save to database
      sendSuccess(res, { goal: newGoal }, 201);
    } catch (error) {
      logger.error('[GOALS CREATE] Error creating goal:', error);
      sendError(
        res,
        500,
        'GOAL_CREATE_ERROR',
        'Error creating goal',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Update a goal
  router.put('/:agentId/goals/:goalId', async (req, res) => {
    const agentId = validateUuid(req.params.agentId);
    if (!agentId) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid agent ID format');
    }

    const runtime = agents.get(agentId);
    if (!runtime) {
      return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
    }

    const { goalId } = req.params;
    const updates = req.body;

    try {
      // In a full implementation, this would update in database
      const updatedGoal: Goal = {
        id: goalId,
        name: updates.name || 'Updated Goal',
        description: updates.description || 'Updated description',
        status: updates.status || 'active',
        progress: updates.progress || 0,
        createdAt: updates.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: updates.metadata || {}
      };

      logger.info(`[GOALS UPDATE] Updated goal ${goalId} for agent ${runtime.character.name}`);
      sendSuccess(res, { goal: updatedGoal });
    } catch (error) {
      logger.error('[GOALS UPDATE] Error updating goal:', error);
      sendError(
        res,
        500,
        'GOAL_UPDATE_ERROR',
        'Error updating goal',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Delete a goal
  router.delete('/:agentId/goals/:goalId', async (req, res) => {
    const agentId = validateUuid(req.params.agentId);
    if (!agentId) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid agent ID format');
    }

    const runtime = agents.get(agentId);
    if (!runtime) {
      return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
    }

    const { goalId } = req.params;

    try {
      // In a full implementation, this would delete from database
      logger.info(`[GOALS DELETE] Deleted goal ${goalId} for agent ${runtime.character.name}`);
      sendSuccess(res, { message: 'Goal deleted successfully' });
    } catch (error) {
      logger.error('[GOALS DELETE] Error deleting goal:', error);
      sendError(
        res,
        500,
        'GOAL_DELETE_ERROR',
        'Error deleting goal',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return router;
}