import type { IAgentRuntime, UUID } from '@elizaos/core';
import { logger } from '@elizaos/core';
import express from 'express';
import type { AgentServer } from '../server';
import { sendError, sendSuccess } from './shared/response-utils';

interface Todo {
  id: string;
  task: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Global todos management (for compatibility with Tauri backend)
 */
export function createTodosRouter(
  agents: Map<UUID, IAgentRuntime>,
  _serverInstance: AgentServer
): express.Router {
  const router = express.Router();

  // Get all todos (defaults to first active agent)
  router.get('/', async (req, res) => {
    try {
      // Find the first active agent
      const activeAgent = Array.from(agents.values())[0];
      if (!activeAgent) {
        return sendError(res, 404, 'NO_AGENTS', 'No active agents found');
      }

      // Return example todos for the active agent
      const todos: Todo[] = [
        {
          id: '1',
          task: 'Review recent conversation patterns',
          completed: false,
          priority: 'high',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          task: 'Update knowledge base with new information',
          completed: false,
          priority: 'medium',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          task: 'Test new conversation capabilities',
          completed: true,
          priority: 'low',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      ];

      sendSuccess(res, { todos });
    } catch (error) {
      logger.error('[TODOS API] Error getting todos:', error);
      sendError(
        res,
        500,
        'TODOS_ERROR',
        'Error retrieving todos',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Create a new todo
  router.post('/', async (req, res) => {
    try {
      const activeAgent = Array.from(agents.values())[0];
      if (!activeAgent) {
        return sendError(res, 404, 'NO_AGENTS', 'No active agents found');
      }

      const { task, priority, dueDate } = req.body;

      if (!task) {
        return sendError(res, 400, 'MISSING_FIELDS', 'Task is required');
      }

      const newTodo: Todo = {
        id: Date.now().toString(),
        task,
        completed: false,
        priority: priority || 'medium',
        dueDate,
        createdAt: new Date().toISOString(),
      };

      logger.info(`[TODOS API] Created todo "${task}" for agent ${activeAgent.character.name}`);
      sendSuccess(res, { todo: newTodo }, 201);
    } catch (error) {
      logger.error('[TODOS API] Error creating todo:', error);
      sendError(
        res,
        500,
        'TODO_CREATE_ERROR',
        'Error creating todo',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return router;
}
