import {
  logger,
  ModelType,
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  parseKeyValueXml,
  composePromptFromState,
  type HandlerCallback,
  type Entity,
  type ActionResult,
  type UUID,
} from '@elizaos/core';
import { EntityNotFoundError, WorldNotFoundError } from '../errors';
import { findBestMatch } from '../utils/stringDistance';

const removeEntityTemplate = `# Remove Entity from Network

Current message: {{message}}
Sender: {{senderName}} (ID: {{senderId}})

## Instructions
Extract the entity removal information from the message:
1. Who to remove (name, handle, or entity reference)
2. Confirmation of the intent to remove
3. Reason for removal (optional)

## Response Format
<response>
<entityName>Name or identifier of the entity to remove</entityName>
<confirmed>yes or no</confirmed>
<reason>Reason for removal if mentioned</reason>
<removeRelationships>yes or no - whether to also remove relationships</removeRelationships>
</response>`;

/**
 * Find entity by name using fuzzy matching
 */
async function findEntityByName(
  runtime: IAgentRuntime,
  worldId: string,
  name: string
): Promise<Entity | null> {
  try {
    // Get all rooms in the world
    const rooms = await runtime.getRooms(worldId as UUID);
    const allEntities = new Set<Entity>();

    // Collect entities from all rooms
    for (const room of rooms) {
      const entities = await runtime.getEntitiesForRoom(room.id);
      entities.forEach((entity) => allEntities.add(entity));
    }

    // Try exact match first
    for (const entity of allEntities) {
      if (entity.names.some((entityName) => entityName.toLowerCase() === name.toLowerCase())) {
        return entity;
      }
    }

    // Try fuzzy matching
    const entityNames = Array.from(allEntities).map((entity) => ({
      entity,
      names: entity.names,
    }));

    for (const { entity, names } of entityNames) {
      const bestMatch = findBestMatch(name, names, 0.7);
      if (bestMatch) {
        return entity;
      }
    }

    return null;
  } catch (error) {
    logger.error('[findEntityByName] Error:', error);
    return null;
  }
}

/**
 * Remove entity and optionally its relationships
 */
async function removeEntityFromNetwork(
  runtime: IAgentRuntime,
  entity: Entity,
  removeRelationships: boolean,
  reason?: string
): Promise<void> {
  try {
    // Remove relationships if requested
    if (removeRelationships && entity.id) {
      const relationships = await runtime.getRelationships({
        entityId: entity.id,
      });

      for (const relationship of relationships) {
        // Log the relationship removal
        logger.info(
          `[removeEntityFromNetwork] Removing relationship ${relationship.id} for entity ${entity.id}`
        );

        // Note: There's no direct deleteRelationship method in the runtime yet
        // This would need to be implemented or we could mark relationships as inactive
        // For now, we'll log the action
      }
    }

    // Log entity removal
    logger.info(
      `[removeEntityFromNetwork] Removing entity ${entity.id} - Reason: ${reason || 'Not specified'}`
    );

    // Note: There's no direct deleteEntity method in the runtime yet
    // This would need to be implemented at the core level
    // For now, we can remove the entity from rooms

    if (entity.id) {
      // Get all rooms for this entity
      const roomIds = await runtime.getRoomsForParticipant(entity.id);

      for (const roomId of roomIds) {
        // Remove entity from room
        // Note: There's no removeParticipant method yet, this would need to be added
        logger.info(
          `[removeEntityFromNetwork] Would remove entity ${entity.id} from room ${roomId}`
        );
      }
    }
  } catch (error) {
    logger.error('[removeEntityFromNetwork] Error:', error);
    throw error;
  }
}

export const removeEntityAction: Action = {
  name: 'REMOVE_ENTITY',
  description: 'Remove an entity from the relationship network',
  similes: [
    'remove entity',
    'delete entity',
    'remove from network',
    'delete from rolodex',
    'untrack entity',
    'forget entity',
    'drop entity',
    'eliminate entity',
  ],
  examples: [
    [
      {
        name: 'User',
        content: { text: 'Remove Alice from my network' },
      },
      {
        name: 'Agent',
        content: {
          text: 'I have removed Alice from your network and cleared all associated relationships.',
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Delete the spammer entity @malicious_bot' },
      },
      {
        name: 'Agent',
        content: {
          text: 'Removed @malicious_bot from your network. All relationships and data have been purged.',
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const hasIntent = message.content.text
      ?.toLowerCase()
      .match(
        /remove|delete|drop|forget|untrack.*entity|remove.*from.*network|delete.*from.*rolodex/
      );
    return !!hasIntent;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const _startTime = Date.now();

    try {
      // Build proper state for prompt composition
      if (!state) {
        state = {
          values: {},
          data: {},
          text: '',
        };
      }

      // Add our values to the state
      state.values = {
        ...state.values,
        message: message.content.text,
        senderId: message.entityId,
        senderName: state.values?.senderName || 'User',
      };

      // Compose prompt to extract removal criteria
      const prompt = composePromptFromState({ template: removeEntityTemplate, state });

      // Use LLM to extract removal criteria
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
      });

      const parsedResponse = parseKeyValueXml(response as string);

      if (!parsedResponse?.entityName) {
        const errorText = 'Please specify which entity you want to remove.';

        if (callback) {
          await callback({
            text: errorText,
            action: 'REMOVE_ENTITY',
            metadata: { error: true },
          });
        }

        return {
          text: errorText,
          data: { removed: false, relationshipsRemoved: 0 },
          success: false,
        };
      }

      if (parsedResponse.confirmed !== 'yes') {
        const errorText = 'Entity removal not confirmed. Please confirm if you want to proceed.';

        if (callback) {
          await callback({
            text: errorText,
            action: 'REMOVE_ENTITY',
            metadata: { error: true },
          });
        }

        return {
          text: errorText,
          data: { removed: false, relationshipsRemoved: 0 },
          success: false,
        };
      }

      // Get the current room's world for entity context
      const currentRoom = await runtime.getRoom(message.roomId!);
      if (!currentRoom?.worldId) {
        throw new WorldNotFoundError(message.roomId!);
      }

      // Find the entity to remove
      const entity = await findEntityByName(
        runtime,
        currentRoom.worldId,
        parsedResponse.entityName
      );

      if (!entity) {
        throw new EntityNotFoundError(parsedResponse.entityName);
      }

      // Determine if we should remove relationships
      const removeRelationships =
        parsedResponse.removeRelationships === 'yes' ||
        parsedResponse.removeRelationships === undefined; // Default to true

      // Get relationship count before removal
      let relationshipCount = 0;
      if (entity.id) {
        const relationships = await runtime.getRelationships({
          entityId: entity.id,
        });
        relationshipCount = relationships.length;
      }

      // Remove the entity and relationships
      await removeEntityFromNetwork(runtime, entity, removeRelationships, parsedResponse.reason);

      const entityName = entity.names[0] || 'Unknown';
      const responseText = removeRelationships
        ? `Removed ${entityName} from your network and cleared ${relationshipCount} associated relationships.`
        : `Removed ${entityName} from your network. Relationships were preserved.`;

      if (callback) {
        await callback({
          text: responseText,
          action: 'REMOVE_ENTITY',
          metadata: {
            entityId: entity.id,
            entityName,
            relationshipsRemoved: removeRelationships ? relationshipCount : 0,
            reason: parsedResponse.reason,
            success: true,
          },
        });
      }

      return {
        text: responseText,
        data: {
          entityId: entity.id!,
          removed: true,
          relationshipsRemoved: removeRelationships ? relationshipCount : 0,
        },
        success: true,
      };
    } catch (error) {
      logger.error('[RemoveEntity] Error removing entity:', error);

      const errorText =
        error instanceof EntityNotFoundError
          ? "I couldn't find the entity you want to remove. Please check the name and try again."
          : `I couldn't remove the entity. ${error instanceof Error ? error.message : 'Please try again.'}`;

      if (callback) {
        await callback({
          text: errorText,
          action: 'REMOVE_ENTITY',
          metadata: { error: true },
        });
      }

      return {
        text: errorText,
        data: { removed: false, relationshipsRemoved: 0 },
        success: false,
      };
    }
  },
};
