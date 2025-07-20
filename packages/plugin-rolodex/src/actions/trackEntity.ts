import { ModelType, logger } from '@elizaos/core';

import { type Action, type IAgentRuntime, type Memory, type HandlerCallback } from '@elizaos/core';
import { RolodexService } from '../services';

export const trackEntityAction: Action = {
  name: 'TRACK_ENTITY',
  description: 'Track information about people, organizations, or other entities from conversation',
  similes: ['remember', 'track', 'note about', 'save info', 'record that', 'keep in mind'],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Use LLM to detect if message contains entity information worth tracking
    const prompt = `Does this message contain information about a person, organization, or entity that should be tracked/remembered?
Message: "${message.content.text}"

Consider if the message:
- Mentions names of people, organizations, or entities
- Provides information about someone (interests, roles, connections, etc)
- Contains details worth remembering for future reference

Answer only yes or no.`;

    try {
      const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
      return (response as string).toLowerCase().includes('yes');
    } catch (error) {
      logger.error('Error validating track entity', error);
      // Fallback to keyword detection
      const keywords = ['track', 'remember', 'note', 'met', 'is a', 'works at', 'lives in'];
      return keywords.some((k) => text.includes(k));
    }
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: any,
    options: any,
    callback?: HandlerCallback
  ) => {
    try {
      const rolodexService = runtime.getService<RolodexService>('rolodex');
      if (!rolodexService) {
        throw new Error('RolodexService not available');
      }

      // Extract entity information from message using LLM
      const extractPrompt = `Extract entity information from this message:
"${message.content.text}"

Return a JSON object with:
- name: The name of the person/entity
- type: "person" or "organization"
- attributes: Any mentioned attributes (job, interests, relationships, etc)

If no clear entity is mentioned, return null.`;

      let entityInfo;
      try {
        const response = await runtime.useModel(ModelType.TEXT_LARGE, { prompt: extractPrompt });
        entityInfo = JSON.parse(response as string);
      } catch (error) {
        logger.error('Failed to extract entity info', error);
        entityInfo = null;
      }

      if (!entityInfo || !entityInfo.name) {
        if (callback) {
          await callback({
            text: "I couldn't identify who to track information about.",
            error: true,
          });
        }
        return { text: "I couldn't identify who to track information about.", success: false };
      }

      // Create or update entity
      const entity = await rolodexService.upsertEntity({
        names: [entityInfo.name],
        metadata: {
          type: entityInfo.type || 'unknown',
          attributes: entityInfo.attributes || {},
          lastUpdated: new Date().toISOString(),
          source: 'track-entity-action',
        },
      });

      // Generate response
      const responseText = `I've tracked information about ${entityInfo.name}. ${
        entityInfo.attributes
          ? `They are ${JSON.stringify(entityInfo.attributes).replace(/[{}"]/g, '').replace(/,/g, ', ')}.`
          : ''
      }`;

      if (callback) {
        await callback({
          text: responseText,
          metadata: {
            entity,
            action: 'entity_tracked',
          },
        });
      }

      return {
        data: { entity },
        text: responseText,
        success: true,
      };
    } catch (error) {
      logger.error('Error in track entity action', error);
      if (callback) {
        await callback({
          text: 'I had trouble tracking that information. Please try again.',
          error: true,
        });
      }
      return { text: 'I had trouble tracking that information. Please try again.', success: false };
    }
  },

  examples: [
    [
      {
        name: 'User',
        content: { text: 'Track that John Doe works at Apple as a product manager' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've tracked information about John Doe. John Doe is a product manager at Apple.",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: 'Remember that Sarah loves hiking and photography' },
      },
      {
        name: 'Agent',
        content: {
          text: "I've tracked information about Sarah. Sarah has interests in hiking and photography.",
        },
      },
    ],
    [
      {
        name: 'User',
        content: { text: "Note that Alice is Bob's sister and works in finance" },
      },
      {
        name: 'Agent',
        content: {
          text: "I've tracked information about Alice. Alice works in finance and is Bob's sister.",
        },
      },
    ],
  ],
};
