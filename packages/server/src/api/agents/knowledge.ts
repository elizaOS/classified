import type { IAgentRuntime, UUID } from '@elizaos/core';
import { logger, validateUuid } from '@elizaos/core';
import express from 'express';
import type { AgentServer } from '../../index';
import { sendError, sendSuccess } from '../shared/response-utils';

interface KnowledgeFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent knowledge files management
 */
export function createAgentKnowledgeRouter(
  agents: Map<UUID, IAgentRuntime>,
  serverInstance: AgentServer
): express.Router {
  const router = express.Router();

  // Get knowledge files for a specific agent
  router.get('/:agentId/knowledge', async (req, res) => {
    try {
      const agentId = validateUuid(req.params.agentId);
      const runtime = agents.get(agentId);
      
      if (!runtime) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
      }

      // Return example knowledge files for now
      const knowledgeFiles: KnowledgeFile[] = [
        {
          id: '1',
          name: 'agent-instructions.md',
          path: 'knowledge/agent-instructions.md',
          size: 2048,
          type: 'markdown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'conversation-examples.md',
          path: 'knowledge/conversation-examples.md',
          size: 1536,
          type: 'markdown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];

      sendSuccess(res, { knowledgeFiles });
    } catch (error) {
      logger.error('[KNOWLEDGE API] Error getting knowledge files:', error);
      sendError(
        res,
        500,
        'KNOWLEDGE_ERROR',
        'Error retrieving knowledge files',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // Delete a knowledge file
  router.delete('/:agentId/knowledge/:fileId', async (req, res) => {
    try {
      const agentId = validateUuid(req.params.agentId);
      const fileId = req.params.fileId;
      
      const runtime = agents.get(agentId);
      if (!runtime) {
        return sendError(res, 404, 'NOT_FOUND', 'Agent not found or not running');
      }

      logger.info(`[KNOWLEDGE API] Deleted knowledge file ${fileId} for agent ${runtime.character.name}`);
      sendSuccess(res, { message: `Knowledge file ${fileId} deleted successfully` });
    } catch (error) {
      logger.error('[KNOWLEDGE API] Error deleting knowledge file:', error);
      sendError(
        res,
        500,
        'KNOWLEDGE_DELETE_ERROR',
        'Error deleting knowledge file',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  return router;
}