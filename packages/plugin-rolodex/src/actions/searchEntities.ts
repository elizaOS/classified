import { logger } from '@elizaos/core';

import { type Action, type IAgentRuntime, type Memory, type HandlerCallback } from '@elizaos/core';
import { RolodexService } from '../services';

export const searchEntitiesAction: Action = {
  name: 'SEARCH_ENTITIES',
  description: 'Search for tracked entities using natural language queries',
  similes: ['who do I know', 'find people', 'search for', 'list entities', 'show me contacts'],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    const keywords = [
      'who',
      'find',
      'search',
      'list',
      'show',
      'entities',
      'people',
      'contacts',
      'know',
    ];
    return keywords.some((k) => text.includes(k));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: any,
    options: any,
    callback?: HandlerCallback
  ) => {
    try {
      const rolodexService = runtime.getService('rolodex') as RolodexService;
      if (!rolodexService) {
        throw new Error('RolodexService not available');
      }

      // Search entities based on the query
      const results = await rolodexService.searchEntities(
        message.content.text || '',
        10 // limit
      );

      let responseText: string;

      if (results.length === 0) {
        responseText = 'No matching entities found.';
      } else {
        responseText = `I found ${results.length} matching ${results.length === 1 ? 'entity' : 'entities'}:\n\n`;

        results.forEach((entity, index) => {
          responseText += `${index + 1}. **${entity.names.join(', ')}**\n`;
          if (entity.metadata) {
            const metadata = entity.metadata as any;
            if (metadata.type) {
              responseText += `   Type: ${metadata.type}\n`;
            }
            if (metadata.attributes) {
              responseText += `   Details: ${JSON.stringify(metadata.attributes).replace(/[{}"]/g, '').replace(/,/g, ', ')}\n`;
            }
          }
          responseText += '\n';
        });
      }

      if (callback) {
        await callback({
          text: responseText,
          metadata: {
            results,
            action: 'entities_searched',
            query: message.content.text,
          },
        });
      }

      return {
        success: true,
        data: { results },
      };
    } catch (error) {
      logger.error('Error in search entities action', error);
      if (callback) {
        await callback({
          text: 'I had trouble searching for entities. Please try again.',
          error: true,
        });
      }
      return { success: false };
    }
  },
};
