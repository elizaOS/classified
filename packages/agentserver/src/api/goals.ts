import type { IAgentRuntime, UUID } from '@elizaos/core';
import { logger } from '@elizaos/core';
import express from 'express';
import type { AgentServer } from '../server';
import { sendError, sendSuccess } from './shared/response-utils';

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
 * Global goals management (for compatibility with Tauri backend)
 */
export function createGoalsRouter(
  agents: Map<UUID, IAgentRuntime>,
  _serverInstance: AgentServer
): express.Router {
  const router = express.Router();

  // Get all goals (defaults to first active agent)
  router.get('/', async (req, res) => {
    try {
      // Find the first active agent
      const activeAgent = Array.from(agents.values())[0];
      if (!activeAgent) {
        return sendError(res, 404, 'NO_AGENTS', 'No active agents found');
      }

      // Return example goals for the active agent
      const goals: Goal[] = [
        {
          id: '1',
          name: 'Learn about user preferences',
          description: 'Understand what the user likes and dislikes to provide better assistance',
          status: 'active',
          progress: 65,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { priority: 'high', agentId: activeAgent.agentId },
        },
        {
          id: '2',
          name: 'Improve conversation skills',
          description: 'Develop better natural language understanding and generation',
          status: 'active',
          progress: 40,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { priority: 'medium', agentId: activeAgent.agentId },
        },
      ];

      sendSuccess(res, { goals });
    } catch (error) {
      logger.error('[GOALS API] Error getting goals:', error);
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
  router.post('/', async (req, res) => {
    try {
      const activeAgent = Array.from(agents.values())[0];
      if (!activeAgent) {
        return sendError(res, 404, 'NO_AGENTS', 'No active agents found');
      }

      const { name, description, metadata } = req.body;

      if (!name || !description) {
        return sendError(res, 400, 'MISSING_FIELDS', 'Name and description are required');
      }

      const newGoal: Goal = {
        id: Date.now().toString(),
        name,
        description,
        status: 'active',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { ...metadata, agentId: activeAgent.agentId },
      };

      logger.info(`[GOALS API] Created goal "${name}" for agent ${activeAgent.character.name}`);
      sendSuccess(res, { goal: newGoal }, 201);
    } catch (error) {
      logger.error('[GOALS API] Error creating goal:', error);
      sendError(
        res,
        500,
        'GOAL_CREATE_ERROR',
        'Error creating goal',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return router;
}
