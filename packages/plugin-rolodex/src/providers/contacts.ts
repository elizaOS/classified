import { type Provider, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { RolodexService } from '../services/RolodexService';

export const contactsProvider: Provider = {
  name: 'CONTACTS',
  description: 'Provides contact information from the rolodex',
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    try {
      const rolodexService = runtime.getService<RolodexService>('rolodex');
      if (!rolodexService) {
        logger.warn('[ContactsProvider] RolodexService not available');
        return { text: '' };
      }

      // Get all entities - search with empty string to get all
      const entities = await rolodexService.searchEntities('', 1000);

      if (entities.length === 0) {
        return {
          text: 'No contacts in rolodex.',
          values: { contactCount: 0, contacts: [] },
        };
      }

      // Get entity details and categorize
      const contactDetails = entities.map((entity) => {
        const metadata = entity.metadata || {};
        return {
          id: entity.id,
          name: entity.names[0] || 'Unknown',
          type: (metadata.type as string) || 'unknown',
          tags: Array.isArray(metadata.tags) ? metadata.tags : [],
          platforms: (metadata.platforms as Record<string, string>) || {},
          lastModified: metadata.updatedAt || metadata.createdAt,
        };
      });

      // Group by type
      const grouped = contactDetails.reduce(
        (acc, contact) => {
          const type = contact.type;
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push(contact);
          return acc;
        },
        {} as Record<string, typeof contactDetails>
      );

      // Build text summary
      let textSummary = `You have ${entities.length} contacts in your rolodex:\n`;

      for (const [type, items] of Object.entries(grouped)) {
        textSummary += `\n${type.charAt(0).toUpperCase() + type.slice(1)}s (${items.length}):\n`;
        (items as typeof contactDetails).forEach((item) => {
          textSummary += `- ${item.name}`;
          if (item.tags.length > 0) {
            textSummary += ` [${item.tags.join(', ')}]`;
          }
          textSummary += '\n';
        });
      }

      return {
        text: textSummary.trim(),
        values: {
          contactCount: entities.length,
          contacts: contactDetails,
          typeCounts: Object.entries(grouped).reduce(
            (acc, [type, items]) => {
              acc[type] = (items as typeof contactDetails).length;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
        data: {
          grouped,
          fullEntities: entities,
        },
      };
    } catch (error) {
      logger.error('[ContactsProvider] Error getting contacts:', error);
      return { text: 'Error retrieving contact information.' };
    }
  },
};
