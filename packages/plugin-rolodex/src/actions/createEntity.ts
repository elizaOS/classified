import {
  ModelType,
  logger,
  stringToUuid,
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type UUID,
  type ActionResult,
} from '@elizaos/core';
import type { EntityProfile } from '../types';

export const createEntityAction: Action = {
  name: 'CREATE_ENTITY',
  description: 'Create a new entity profile for tracking',
  similes: ['add person', 'new contact', 'create profile', 'register entity'],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    const createKeywords = ['create', 'add', 'new', 'register'];
    const entityKeywords = ['entity', 'person', 'contact', 'profile'];
    return (
      createKeywords.some((k) => text.includes(k)) && entityKeywords.some((k) => text.includes(k))
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const rolodexService = runtime.getService('rolodex');
      if (!rolodexService) {
        throw new Error('Rolodex service not available');
      }

      // Extract entity details from message
      const text = message.content.text || '';

      // Generate structured extraction prompt
      const extractionPrompt = `Extract entity information from this message. Return ONLY valid JSON:
      
Message: "${text}"

Return format:
{
  "name": "primary name",
  "alternateNames": ["other", "names"],
  "type": "person|organization|bot",
  "platforms": {
    "platform": "identifier"
  },
  "metadata": {
    "key": "value"
  }
}`;

      const extractedText = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: extractionPrompt,
      });

      let entityData: any;
      try {
        entityData = JSON.parse(extractedText);
      } catch {
        entityData = {
          name: text.replace(/create|add|new|entity|person|contact|profile/gi, '').trim(),
          type: 'person',
        };
      }

      const entityId = stringToUuid(entityData.name || `entity-${Date.now()}`) as UUID;

      const profile: Partial<EntityProfile> = {
        entityId,
        agentId: runtime.agentId,
        type: entityData.type || 'person',
        names: [entityData.name, ...(entityData.alternateNames || [])].filter(Boolean),
        summary: `${entityData.type} entity created via manual action`,
        tags: [],
        platforms: entityData.platforms || {},
        metadata: {
          ...entityData.metadata,
          source: 'manual_creation',
          createdBy: message.entityId,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Use the service to upsert the entity
      const upsertMethod = (rolodexService as any).upsertEntity;
      if (!upsertMethod) {
        throw new Error('Entity creation method not available');
      }

      const created = await upsertMethod.call(rolodexService, profile);

      const responseText = `Created new ${profile.type} entity "${profile.names?.[0] || 'Unknown'}" with ID ${entityId}. You can now track interactions and relationships for this entity.`;

      if (callback) {
        await callback({
          text: responseText,
          action: 'CREATE_ENTITY',
        });
      }

      return {
        success: true,
        text: responseText,
        data: {
          entityId,
          profile: created,
        },
      };
    } catch (error) {
      logger.error('[CreateEntity] Error:', error);
      const errorMsg = `Failed to create entity: ${(error as Error).message}`;

      if (callback) {
        await callback({
          text: errorMsg,
          action: 'CREATE_ENTITY',
        });
      }

      return {
        success: false,
        text: errorMsg,
        data: { error: (error as Error).message },
      };
    }
  },

  examples: [
    [
      {
        name: 'user',
        content: { text: 'create new person John Smith' },
      },
      {
        name: 'assistant',
        content: {
          text: 'Created new person entity "John Smith" with ID entity-john-smith. You can now track interactions and relationships for this entity.',
          action: 'CREATE_ENTITY',
        },
      },
    ],
  ],
};
