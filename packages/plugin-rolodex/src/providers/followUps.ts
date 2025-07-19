import { type Provider, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { FollowUpManager } from '../managers';

export const followUpsProvider: Provider = {
  name: 'FOLLOW_UPS',
  description: 'Provides information about upcoming follow-ups and reminders',
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State) => {
    try {
      const followUpService = runtime.getService('followup') as unknown as FollowUpManager;
      if (!followUpService) {
        logger.warn('[FollowUpsProvider] FollowUpService not available');
        return { text: '' };
      }

      // Get all follow-ups
      const allFollowUps = await followUpService.getFollowUps();

      if (allFollowUps.length === 0) {
        return {
          text: 'No upcoming follow-ups scheduled.',
          values: { followUpCount: 0, followUps: [] },
        };
      }

      // Separate overdue and upcoming
      const now = Date.now();
      const overdue = allFollowUps.filter((f) => {
        const scheduledAt = new Date(f.scheduledFor).getTime();
        return scheduledAt < now;
      });

      const upcoming = allFollowUps.filter((f) => {
        const scheduledAt = new Date(f.scheduledFor).getTime();
        return scheduledAt >= now;
      });

      // Build text summary
      let textSummary = `You have ${allFollowUps.length} follow-up${allFollowUps.length !== 1 ? 's' : ''} scheduled:\n`;

      if (overdue.length > 0) {
        textSummary += `\nOverdue (${overdue.length}):\n`;
        for (const f of overdue) {
          const entity = await runtime.getEntityById(f.entityId);
          const name = entity?.names[0] || 'Unknown';
          const scheduledAt = new Date(f.scheduledFor);

          textSummary += `- ${name}`;
          const daysOverdue = Math.floor((now - scheduledAt.getTime()) / (1000 * 60 * 60 * 24));
          textSummary += ` (${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue)`;

          if (f.message) {
            textSummary += ` - ${f.message}`;
          }
          textSummary += '\n';
        }
      }

      if (upcoming.length > 0) {
        textSummary += `\nUpcoming (${upcoming.length}):\n`;
        for (const f of upcoming) {
          const entity = await runtime.getEntityById(f.entityId);
          const name = entity?.names[0] || 'Unknown';
          const scheduledAt = new Date(f.scheduledFor);

          textSummary += `- ${name}`;
          const daysUntil = Math.ceil((scheduledAt.getTime() - now) / (1000 * 60 * 60 * 24));
          if (daysUntil === 0) {
            textSummary += ' (today)';
          } else if (daysUntil === 1) {
            textSummary += ' (tomorrow)';
          } else {
            textSummary += ` (in ${daysUntil} days)`;
          }

          if (f.message) {
            textSummary += ` - ${f.message}`;
          }
          textSummary += '\n';
        }
      }

      // Suggest follow-ups for entities we haven't interacted with recently
      const relationshipService = runtime.getService('relationship');
      const suggestedEntities: any[] = [];

      if (relationshipService) {
        // Get all entities in the agent's rooms
        const roomIds = await runtime.getRoomsForParticipant(runtime.agentId);
        const checkedEntities = new Set<string>();

        for (const roomId of roomIds.slice(0, 3)) {
          // Limit to first 3 rooms
          const entities = await runtime.getEntitiesForRoom(roomId);

          for (const entity of entities.slice(0, 5)) {
            // Limit entities per room
            if (!entity.id || entity.id === runtime.agentId || checkedEntities.has(entity.id)) {
              continue;
            }
            checkedEntities.add(entity.id);

            // Check if there's already a follow-up scheduled
            const hasFollowUp = allFollowUps.some((f) => f.entityId === entity.id);
            if (hasFollowUp) {
              continue;
            }

            // Get relationships to check last interaction
            const relationships = await runtime.getRelationships({ entityId: entity.id });
            let lastInteraction: Date | null = null;

            for (const rel of relationships) {
              if (rel.metadata?.lastInteraction) {
                const relDate = new Date(rel.metadata.lastInteraction as string);
                if (!lastInteraction || relDate > lastInteraction) {
                  lastInteraction = relDate;
                }
              }
            }

            // Suggest if no interaction in 30+ days
            if (lastInteraction) {
              const daysSince = Math.floor(
                (now - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
              );
              if (daysSince >= 30) {
                suggestedEntities.push({
                  entityId: entity.id,
                  entityName: entity.names[0] || 'Unknown',
                  daysSinceLastContact: daysSince,
                  reason: `No contact in ${daysSince} days`,
                });
              }
            }
          }
        }
      }

      if (suggestedEntities.length > 0) {
        textSummary += '\nSuggested follow-ups:\n';
        suggestedEntities.slice(0, 3).forEach((s) => {
          textSummary += `- ${s.entityName} (${s.daysSinceLastContact} days since last contact)\n`;
        });
      }

      return {
        text: textSummary.trim(),
        values: {
          followUpCount: allFollowUps.length,
          overdueCount: overdue.length,
          upcomingCount: upcoming.length,
          suggestionsCount: suggestedEntities.length,
        },
        data: {
          followUps: allFollowUps.map((f) => ({
            id: f.id,
            entityId: f.entityId,
            scheduledFor: f.scheduledFor,
            message: f.message,
            metadata: f.metadata,
          })),
          suggestions: suggestedEntities.slice(0, 5),
        },
      };
    } catch (error) {
      logger.error('[FollowUpsProvider] Error getting follow-ups:', error);
      return { text: 'Error retrieving follow-up information.' };
    }
  },
};
