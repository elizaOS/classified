import { logger, stringToUuid } from '@elizaos/core';
import type { EntityProfile, FollowUp, TrustEvent, InteractionEvent } from '../types';
import { type IAgentRuntime, type UUID, type Relationship, asUUID } from '@elizaos/core';

export class DatabaseAdapter {
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  // Plugin schemas should be handled through the runtime's migration system
  // by providing a schema property on the plugin object. The runtime will
  // automatically run migrations using the adapter's runPluginMigrations method.
  // See packages/plugin-sql/src/base.ts for the implementation.

  // === Entity Operations ===

  async createEntity(profile: EntityProfile): Promise<void> {
    try {
      // Store entity using runtime's createEntity
      await this.runtime.createEntity({
        id: asUUID(profile.entityId),
        agentId: asUUID(profile.agentId),
        names: profile.names,
        metadata: {
          entityProfile: profile,
          type: profile.type,
          summary: profile.summary,
          tags: profile.tags,
          platforms: profile.platforms,
          trustScore: profile.trustScore || 0.5,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });

      // Store platforms separately
      for (const [platform, handle] of Object.entries(profile.platforms || {})) {
        await this.createPlatformIdentity({
          entityId: asUUID(profile.entityId),
          platform,
          handle,
          verified: false,
        });
      }
    } catch (error) {
      logger.error('[DatabaseAdapter] Error creating entity:', error);
      throw error;
    }
  }

  async updateEntity(profile: EntityProfile): Promise<void> {
    try {
      const entity = await this.runtime.getEntityById(asUUID(profile.entityId));
      if (!entity) {
        throw new Error(`Entity ${profile.entityId} not found`);
      }

      await this.runtime.updateEntity({
        ...entity,
        names: profile.names,
        metadata: {
          ...entity.metadata,
          entityProfile: profile,
          type: profile.type,
          summary: profile.summary,
          tags: profile.tags,
          platforms: profile.platforms,
          trustScore: profile.trustScore,
          updatedAt: profile.updatedAt,
        },
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error updating entity:', error);
      throw error;
    }
  }

  async getEntity(entityId: UUID): Promise<EntityProfile | null> {
    try {
      const entity = await this.runtime.getEntityById(entityId);
      if (!entity || !entity.metadata?.entityProfile) {
        return null;
      }

      return entity.metadata.entityProfile as EntityProfile;
    } catch (error) {
      logger.error('[DatabaseAdapter] Error getting entity:', error);
      return null;
    }
  }

  async searchEntities(criteria: {
    type?: string;
    minTrust?: number;
    tags?: string[];
    limit: number;
    offset: number;
  }): Promise<EntityProfile[]> {
    try {
      // Get all rooms for the agent
      const roomIds = await this.runtime.getRoomsForParticipant(this.runtime.agentId);
      const allEntities: EntityProfile[] = [];
      const seenIds = new Set<string>();

      // Collect entities from all rooms
      for (const roomId of roomIds) {
        const entities = await this.runtime.getEntitiesForRoom(roomId);

        for (const entity of entities) {
          if (!entity.id || seenIds.has(entity.id)) {
            continue;
          }
          seenIds.add(entity.id);

          const profile = entity.metadata?.entityProfile as EntityProfile;
          if (!profile) {
            continue;
          }

          // Apply filters
          if (criteria.type && profile.type !== criteria.type) {
            continue;
          }
          if (criteria.minTrust && (profile.trustScore || 0.5) < criteria.minTrust) {
            continue;
          }
          if (criteria.tags && criteria.tags.length > 0) {
            const hasTag = criteria.tags.some((tag) => profile.tags.includes(tag));
            if (!hasTag) {
              continue;
            }
          }

          allEntities.push(profile);
        }
      }

      // Apply pagination
      return allEntities.slice(criteria.offset, criteria.offset + criteria.limit);
    } catch (error) {
      logger.error('[DatabaseAdapter] Error searching entities:', error);
      return [];
    }
  }

  async batchUpdateEntities(
    updates: Array<{
      entityId: UUID;
      data: Partial<EntityProfile>;
    }>
  ): Promise<void> {
    // Process updates in parallel with concurrency limit
    const BATCH_SIZE = 10;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async ({ entityId, data }) => {
          const existing = await this.getEntity(entityId);
          if (existing) {
            await this.updateEntity({
              ...existing,
              ...data,
              entityId,
              agentId: existing.agentId,
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString(),
            });
          }
        })
      );
    }
  }

  // === Platform Identity Operations ===

  async createPlatformIdentity(data: {
    entityId: UUID;
    platform: string;
    handle: string;
    verified: boolean;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Store as a component for now
      await this.runtime.createComponent({
        id: asUUID(stringToUuid(`platform-${data.entityId}-${data.platform}`)),
        type: 'platform_identity',
        agentId: asUUID(this.runtime.agentId),
        entityId: data.entityId,
        roomId: asUUID(this.runtime.agentId),
        worldId: asUUID(stringToUuid(`world-${this.runtime.agentId}`)),
        sourceEntityId: asUUID(this.runtime.agentId),
        data: {
          platform: data.platform,
          handle: data.handle,
          verified: data.verified,
          metadata: data.metadata || {},
        },
        createdAt: Date.now(),
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error creating platform identity:', error);
    }
  }

  // === Relationship Operations ===

  async createRelationship(relationship: Relationship): Promise<void> {
    try {
      await this.runtime.createRelationship({
        sourceEntityId: relationship.sourceEntityId,
        targetEntityId: relationship.targetEntityId,
        metadata: relationship.metadata,
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error creating relationship:', error);
      throw error;
    }
  }

  async updateRelationship(relationship: Relationship): Promise<void> {
    try {
      await this.runtime.updateRelationship(relationship);

      // Track the update as a component
      const worldId = await this.ensureWorld();
      await this.runtime.createComponent({
        id: asUUID(stringToUuid(`rel-update-${Date.now()}`)),
        entityId: asUUID(relationship.sourceEntityId),
        agentId: asUUID(this.runtime.agentId),
        roomId: asUUID(this.runtime.agentId),
        worldId, // Use ensured worldId
        sourceEntityId: asUUID(relationship.sourceEntityId),
        type: 'relationship_update',
        data: {
          targetEntityId: relationship.targetEntityId,
          metadata: relationship.metadata,
          updatedAt: new Date().toISOString(),
        },
        createdAt: Date.now(),
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error updating relationship:', error);
      throw error;
    }
  }

  async getRelationship(sourceId: UUID, targetId: UUID): Promise<Relationship | undefined> {
    try {
      const relationships = await this.runtime.getRelationships({
        entityId: sourceId,
      });

      return (
        relationships.find((r) => r.sourceEntityId === sourceId && r.targetEntityId === targetId) ||
        undefined
      );
    } catch (error) {
      logger.error('[DatabaseAdapter] Error getting relationship:', error);
      return undefined;
    }
  }

  async getEntityRelationships(
    entityId: UUID,
    options?: {
      type?: string;
      minStrength?: number;
    }
  ): Promise<Relationship[]> {
    try {
      const relationships = await this.runtime.getRelationships({
        entityId,
      });

      return relationships.filter((rel) => {
        if (options?.type && rel.metadata?.type !== options.type) {
          return false;
        }
        if (options?.minStrength) {
          const strength = typeof rel.metadata?.strength === 'number' ? rel.metadata.strength : 0;
          if (strength < options.minStrength) {
            return false;
          }
        }
        return true;
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error getting entity relationships:', error);
      return [];
    }
  }

  // === Interaction Operations ===

  async createInteraction(interaction: InteractionEvent): Promise<void> {
    try {
      const worldId = await this.ensureWorld();

      await this.runtime.createComponent({
        id: asUUID(stringToUuid(`interaction-${Date.now()}`)),
        entityId: asUUID(interaction.sourceEntityId),
        agentId: asUUID(this.runtime.agentId),
        roomId: asUUID(interaction.roomId),
        worldId, // Add worldId
        sourceEntityId: asUUID(interaction.sourceEntityId),
        type: 'interaction',
        data: {
          targetEntityId: interaction.targetEntityId,
          type: interaction.type,
          content: interaction.content,
          sentiment: interaction.sentiment,
          metadata: interaction.metadata,
          timestamp: new Date().toISOString(),
        },
        createdAt: Date.now(),
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error creating interaction:', error);
      // Don't throw, just log - interactions are supplementary data
    }
  }

  async updateInteraction(interaction: InteractionEvent & { id?: UUID }): Promise<void> {
    // For now, we just create a new interaction since we can't update components
    await this.createInteraction(interaction);
  }

  // === Follow-up Operations ===

  async createFollowUp(data: FollowUp): Promise<void> {
    try {
      // Get or create default world
      const worldId = await this.ensureWorld();

      await this.runtime.createTask({
        name: 'ENTITY_FOLLOWUP',
        description: data.message || 'Follow-up scheduled',
        tags: ['followup', 'entity', data.entityId],
        roomId: asUUID(this.runtime.agentId), // Use agent ID as room ID
        worldId, // Add worldId
        entityId: asUUID(data.entityId),
        metadata: {
          followUp: data,
          entityId: data.entityId,
          scheduledFor: data.scheduledFor,
          priority: data.metadata?.priority || 'medium',
        },
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error creating follow-up:', error);
      throw error;
    }
  }

  async getFollowUps(criteria: {
    entityId?: UUID;
    completed?: boolean;
    before?: Date;
    limit: number;
  }): Promise<FollowUp[]> {
    try {
      const tasks = await this.runtime.getTasks({
        tags: ['ENTITY_FOLLOWUP'],
      });

      return tasks
        .filter((task) => {
          const followUp = task.metadata?.followUp as FollowUp;
          if (!followUp) {
            return false;
          }

          if (criteria.entityId && followUp.entityId !== criteria.entityId) {
            return false;
          }
          if (criteria.completed !== undefined && followUp.completed !== criteria.completed) {
            return false;
          }
          if (criteria.before) {
            const scheduledDate = new Date(followUp.scheduledFor);
            if (scheduledDate > criteria.before) {
              return false;
            }
          }

          return true;
        })
        .map((task) => task.metadata?.followUp as FollowUp)
        .slice(0, criteria.limit);
    } catch (error) {
      logger.error('[DatabaseAdapter] Error getting follow-ups:', error);
      return [];
    }
  }

  // === Trust Event Operations ===

  async createTrustEvent(event: TrustEvent): Promise<void> {
    try {
      const worldId = await this.ensureWorld();
      await this.runtime.createComponent({
        id: asUUID(stringToUuid(`trust-${event.entityId}-${Date.now()}`)),
        type: 'trust_event',
        agentId: asUUID(this.runtime.agentId),
        entityId: asUUID(event.entityId),
        roomId: asUUID(this.runtime.agentId),
        worldId,
        sourceEntityId: asUUID(this.runtime.agentId),
        data: {
          eventType: event.eventType,
          impact: event.impact,
          reason: event.reason,
          metadata: event.metadata || {},
          createdAt: event.createdAt,
        },
        createdAt: Date.now(),
      });
    } catch (error) {
      logger.error('[DatabaseAdapter] Error creating trust event:', error);
    }
  }

  async getTrustEvents(
    entityId: UUID,
    options?: {
      limit?: number;
      after?: Date;
    }
  ): Promise<TrustEvent[]> {
    try {
      // Get components with proper parameters including worldId and sourceEntityId
      const worldId = await this.ensureWorld();
      const components = await this.runtime.getComponents(entityId, worldId, this.runtime.agentId);

      return components
        .filter((c) => c.type === 'trust_event')
        .map((c) => ({
          id: c.id || asUUID(stringToUuid(`trust-event-${Date.now()}`)),
          entityId: c.entityId,
          eventType: c.data.eventType as
            | 'verification'
            | 'interaction'
            | 'endorsement'
            | 'violation',
          impact: c.data.impact as number,
          reason: c.data.reason as string,
          details: c.data.reason as string, // Map reason to details
          timestamp: c.data.createdAt as string,
          metadata: c.data.metadata as Record<string, any>,
          createdAt: c.data.createdAt as string,
        }))
        .filter((event) => {
          if (options?.after) {
            const eventDate = new Date(event.createdAt);
            if (eventDate <= options.after) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, options?.limit || 50);
    } catch (error) {
      logger.error('[DatabaseAdapter] Error getting trust events:', error);
      return [];
    }
  }

  // === Private Helper Methods ===

  private async ensureWorld(): Promise<UUID> {
    const worldId = asUUID(stringToUuid(`world-${this.runtime.agentId}`));

    try {
      // Check if world exists
      const existingWorld = await this.runtime.getWorld(worldId);
      if (existingWorld) {
        return worldId;
      }
    } catch (_error) {
      // World doesn't exist, create it
    }

    // Create the world
    await this.runtime.createWorld({
      id: worldId,
      name: `Rolodex World for ${this.runtime.character.name}`,
      agentId: this.runtime.agentId,
      serverId: 'default',
      metadata: {
        type: 'rolodex',
        createdAt: new Date().toISOString(),
      },
    });

    return worldId;
  }
}
