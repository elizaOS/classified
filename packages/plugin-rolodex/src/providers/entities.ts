import { type Provider, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { RolodexService } from '../services';

export const entitiesProvider: Provider = {
  name: 'entities',
  description: 'Provides information about tracked entities',

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    try {
      const entityService = runtime.getService<RolodexService>('entity');
      if (!entityService) {
        logger.warn('[EntitiesProvider] EntityService not available');
        return { text: '' };
      }

      // Get all entities across all rooms
      const roomIds = await runtime.getRoomsForParticipant(runtime.agentId);
      const allEntities: any[] = [];
      const seenIds = new Set<string>();

      for (const roomId of roomIds) {
        const entities = await runtime.getEntitiesForRoom(roomId);

        for (const entity of entities) {
          if (!entity.id || seenIds.has(entity.id)) {
            continue;
          }
          seenIds.add(entity.id);

          // Get entity profile
          const profile = await entityService.getEntity(entity.id);
          if (profile) {
            allEntities.push({
              entity,
              profile,
            });
          }
        }
      }

      if (allEntities.length === 0) {
        return {
          text: 'No entities are currently being tracked.',
          values: { entityCount: 0, entities: [] },
        };
      }

      // Group entities by type
      const entitiesByType = new Map<string, any[]>();

      for (const { entity, profile } of allEntities) {
        const type = profile.type || 'unknown';
        const typeGroup = entitiesByType.get(type) || [];
        typeGroup.push({ entity, profile });
        entitiesByType.set(type, typeGroup);
      }

      // Build summary
      const lines: string[] = ['## Tracked Entities'];

      // Summary by type
      lines.push('\n### By Type:');
      for (const [type, entities] of entitiesByType) {
        lines.push(`- **${type}**: ${entities.length} entities`);
      }

      // List recent entities
      const recentEntities = allEntities
        .sort((a, b) => {
          const dateA = new Date(a.profile.updatedAt || a.profile.createdAt).getTime();
          const dateB = new Date(b.profile.updatedAt || b.profile.createdAt).getTime();
          return dateB - dateA;
        })
        .slice(0, 10);

      if (recentEntities.length > 0) {
        lines.push('\n### Recently Updated:');
        for (const { entity, profile } of recentEntities) {
          const name = entity.names[0] || 'Unknown';
          const lastUpdate = new Date(profile.updatedAt || profile.createdAt);
          const daysAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

          lines.push(`- ${name} (${profile.type})`);
          if (profile.summary) {
            lines.push(`  ${profile.summary}`);
          }
          if (daysAgo === 0) {
            lines.push('  Updated today');
          } else if (daysAgo === 1) {
            lines.push('  Updated yesterday');
          } else {
            lines.push(`  Updated ${daysAgo} days ago`);
          }
        }
      }

      // Entities with tags
      const taggedEntities = allEntities.filter((e) => e.profile.tags && e.profile.tags.length > 0);

      if (taggedEntities.length > 0) {
        lines.push('\n### Tagged Entities:');
        const tagCounts = new Map<string, number>();

        for (const { profile } of taggedEntities) {
          for (const tag of profile.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }

        const sortedTags = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        for (const [tag, count] of sortedTags) {
          lines.push(`- ${tag} (${count} entities)`);
        }
      }

      // Calculate statistics
      const typeCounts: Record<string, number> = {};

      for (const [type, entities] of entitiesByType) {
        typeCounts[type] = entities.length;
      }

      return {
        text: lines.join('\n'),
        values: {
          entityCount: allEntities.length,
          typeCounts,
          taggedCount: taggedEntities.length,
        },
        data: {
          entities: allEntities,
          byType: Object.fromEntries(entitiesByType),
          recentUpdates: recentEntities,
        },
      };
    } catch (error) {
      logger.error('[EntitiesProvider] Error getting entities:', error);
      return { text: 'Unable to retrieve entity information at this time.' };
    }
  },
};
