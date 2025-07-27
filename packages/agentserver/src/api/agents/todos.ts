import type { IAgentRuntime, UUID } from '@elizaos/core';
import { logger, validateUuid } from '@elizaos/core';
import express from 'express';
import type { AgentServer } from '../../server';
import { sendError, sendSuccess } from '../shared/response-utils';

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
 * Agent todos management operations
 */
export function createAgentTodosRouter(
  agents: Map<UUID, IAgentRuntime>,
  _serverInstance: AgentServer
): express.Router {
  const router = express.Router();

  // Get all todos for an agent
  router.get('/:agentId/todos', async (req, res) => {
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
      // For now, return some example todos
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
      logger.error('[TODOS GET] Error getting todos:', error);
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
  router.post('/:agentId/todos', async (req, res) => {
    const agentId = validateUuid(req.params.agentId);
    if (!agentId) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid agent ID format');
    }

    const runtime = agents.get(agentId);
    if (!runtime) {
      return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
    }

    const { task, priority, dueDate } = req.body;

    if (!task) {
      return sendError(res, 400, 'MISSING_FIELDS', 'Task is required');
    }

    try {
      const newTodo: Todo = {
        id: Date.now().toString(), // Simple ID generation
        task,
        completed: false,
        priority: priority || 'medium',
        dueDate,
        createdAt: new Date().toISOString(),
      };

      logger.info(`[TODOS CREATE] Created todo "${task}" for agent ${runtime.character.name}`);

      // In a full implementation, this would save to database
      sendSuccess(res, { todo: newTodo }, 201);
    } catch (error) {
      logger.error('[TODOS CREATE] Error creating todo:', error);
      sendError(
        res,
        500,
        'TODO_CREATE_ERROR',
        'Error creating todo',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Update a todo
  router.put('/:agentId/todos/:todoId', async (req, res) => {
    const agentId = validateUuid(req.params.agentId);
    if (!agentId) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid agent ID format');
    }

    const runtime = agents.get(agentId);
    if (!runtime) {
      return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
    }

    const { todoId } = req.params;
    const updates = req.body;

    try {
      // In a full implementation, this would update in database
      const updatedTodo: Todo = {
        id: todoId,
        task: updates.task || 'Updated task',
        completed: updates.completed || false,
        priority: updates.priority || 'medium',
        dueDate: updates.dueDate,
        createdAt: updates.createdAt || new Date().toISOString(),
        completedAt: updates.completed ? new Date().toISOString() : undefined,
      };

      logger.info(`[TODOS UPDATE] Updated todo ${todoId} for agent ${runtime.character.name}`);
      sendSuccess(res, { todo: updatedTodo });
    } catch (error) {
      logger.error('[TODOS UPDATE] Error updating todo:', error);
      sendError(
        res,
        500,
        'TODO_UPDATE_ERROR',
        'Error updating todo',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Delete a todo
  router.delete('/:agentId/todos/:todoId', async (req, res) => {
    const agentId = validateUuid(req.params.agentId);
    if (!agentId) {
      return sendError(res, 400, 'INVALID_ID', 'Invalid agent ID format');
    }

    const runtime = agents.get(agentId);
    if (!runtime) {
      return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
    }

    const { todoId } = req.params;

    try {
      // In a full implementation, this would delete from database
      logger.info(`[TODOS DELETE] Deleted todo ${todoId} for agent ${runtime.character.name}`);
      sendSuccess(res, { message: 'Todo deleted successfully' });
    } catch (error) {
      logger.error('[TODOS DELETE] Error deleting todo:', error);
      sendError(
        res,
        500,
        'TODO_DELETE_ERROR',
        'Error deleting todo',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return router;
}
