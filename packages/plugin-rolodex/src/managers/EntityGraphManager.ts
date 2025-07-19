import {
  type IAgentRuntime,
  type UUID,
  logger,
  ModelType as _ModelType,
  stringToUuid,
  type Memory,
  type Relationship,
  type Entity,
} from '@elizaos/core';
import { asUUID } from '@elizaos/core';
import { z } from 'zod';
import type {
  EntityProfile,
  EntitySearchResult,
  FollowUp,
  TrustEvent,
  InteractionEvent,
} from '../types';
import { DatabaseAdapter } from '../database/adapter';
import { CacheManager } from '../utils/cache';
import { BatchQueue } from '../utils/batch';
import { LLMProcessor } from '../utils/llm';
import { EventBridge } from '../managers/EventBridge';

// Schemas for structured LLM responses
const EntityExtractionSchema = z.object({
  entities: z.array(
    z.object({
      type: z.enum(['person', 'organization', 'bot', 'system']),
      names: z.array(z.string()).min(1),
      summary: z.string(),
      tags: z.array(z.string()),
      platforms: z.record(z.string()).optional(),
      metadata: z.record(z.any()).optional(),
    })
  ),
});

const RelationshipInferenceSchema = z.object({
  relationships: z.array(
    z.object({
      sourceEntity: z.string(),
      targetEntity: z.string(),
      type: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.string(),
      sentiment: z.number().min(-1).max(1),
    })
  ),
});

const TrustAnalysisSchema = z.object({
  trustDelta: z.number().min(-0.5).max(0.5),
  reason: z.string(),
  indicators: z.array(z.string()),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

// Few-shot examples for entity extraction
const ENTITY_EXTRACTION_EXAMPLES = [
  {
    context:
      "I met Sarah Chen at the AI conference. She's the CTO of TechCorp and specializes in neural networks.",
    result: {
      entities: [
        {
          type: 'person',
          names: ['Sarah Chen'],
          summary: 'CTO of TechCorp, specializes in neural networks',
          tags: ['AI', 'technology', 'executive', 'neural networks'],
          platforms: {},
          metadata: {
            role: 'CTO',
            company: 'TechCorp',
            expertise: ['neural networks', 'AI'],
          },
        },
      ],
    },
  },
  {
    context:
      'Bob from marketing (his twitter is @bob_markets) said the campaign is launching next week.',
    result: {
      entities: [
        {
          type: 'person',
          names: ['Bob'],
          summary: 'Works in marketing department',
          tags: ['marketing', 'colleague'],
          platforms: { twitter: '@bob_markets' },
          metadata: { department: 'marketing' },
        },
      ],
    },
  },
];

// Few-shot examples for relationship inference
const RELATIONSHIP_INFERENCE_EXAMPLES = [
  {
    context:
      'Alice: Thanks for the code review, Bob! Bob: No problem, happy to help with the project.',
    result: {
      relationships: [
        {
          sourceEntity: 'Alice',
          targetEntity: 'Bob',
          type: 'colleague',
          confidence: 0.9,
          evidence: 'Code review collaboration indicates professional relationship',
          sentiment: 0.8,
        },
      ],
    },
  },
  {
    context: "User: My sister Emma works at the same company. She's in the finance department.",
    result: {
      relationships: [
        {
          sourceEntity: 'User',
          targetEntity: 'Emma',
          type: 'family',
          confidence: 1.0,
          evidence: 'Explicitly stated sister relationship',
          sentiment: 0.7,
        },
      ],
    },
  },
];

export class EntityGraphManager {
  private runtime: IAgentRuntime;
  private eventBridge: EventBridge;
  private db!: DatabaseAdapter;
  private cache!: CacheManager;
  private batchQueue!: BatchQueue;
  private llm!: LLMProcessor;

  // Cache configuration
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_INTERVAL = 5000; // 5 seconds

  constructor(runtime: IAgentRuntime, eventBridge: EventBridge) {
    this.runtime = runtime;
    this.eventBridge = eventBridge;
  }

  async initialize(): Promise<void> {
    logger.info('[EntityGraphManager] Initializing...');

    // Initialize database adapter
    this.db = new DatabaseAdapter(this.runtime as any);

    // Initialize cache manager
    this.cache = new CacheManager({
      ttl: this.CACHE_TTL,
      maxSize: 10000,
    });

    // Initialize batch queue for async operations
    this.batchQueue = new BatchQueue({
      batchSize: this.BATCH_SIZE,
      interval: this.BATCH_INTERVAL,
      processor: this.processBatch.bind(this),
    });

    // Initialize LLM processor with retry logic
    this.llm = new LLMProcessor(this.runtime, {
      maxRetries: 3,
      retryDelay: 1000,
    });

    // Start the batch queue
    await this.batchQueue.start();

    logger.info('[EntityGraphManager] Initialized successfully');
  }

  async stop(): Promise<void> {
    await this.batchQueue.stop();
    await this.cache.clear();
    logger.info('[EntityGraphManager] Stopped');
  }

  // === Entity Management ===

  async createEntity(entity: Partial<Entity>): Promise<Entity> {
    const entityId = entity.id || stringToUuid(entity.names?.[0] || `entity-${Date.now()}`);
    const fullEntity: Entity = {
      id: entityId as UUID,
      agentId: entity.agentId || this.runtime.agentId,
      names: entity.names || ['Unknown'],
      metadata: entity.metadata || {},
    };

    await this.runtime.createEntity(fullEntity);
    return fullEntity;
  }

  async updateEntity(entityId: UUID, updates: Partial<Entity>): Promise<Entity> {
    const existing = await this.runtime.getEntityById(entityId);
    if (!existing) {
      throw new Error(`Entity ${entityId} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: entityId,
      agentId: existing.agentId,
    };

    await this.runtime.updateEntity(updated);
    return updated;
  }

  async getEntity(entityId: UUID): Promise<Entity | null> {
    return await this.runtime.getEntityById(entityId);
  }

  async trackEntity(
    entityId: UUID,
    context: string,
    options?: {
      source?: UUID;
      roomId?: UUID;
      updateExisting?: boolean;
    }
  ): Promise<EntityProfile> {
    try {
      // Check cache first
      const cacheKey = `entity:${entityId}`;
      const cached = await this.cache.get<EntityProfile>(cacheKey);
      if (cached && !options?.updateExisting) {
        return cached;
      }

      // Extract entity information using LLM
      const extraction = await this.extractEntities(context);
      if (!extraction.entities || extraction.entities.length === 0) {
        // If no entities found, create a basic entity from context
        logger.warn('[EntityGraphService] No entities extracted, creating basic entity');

        const profile: EntityProfile = {
          entityId,
          agentId: asUUID(this.runtime.agentId),
          type: 'unknown',
          names: [`Entity ${entityId.substring(0, 8)}`],
          summary: context.substring(0, 200),
          tags: [],
          platforms: {},
          metadata: {
            context,
            autoGenerated: true,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await this.db.createEntity(profile);
        await this.cache.set(cacheKey, profile);
        return profile;
      }

      // Use the first extracted entity
      const entityData = extraction.entities[0];

      // Check if entity exists in database
      const existing = await this.db.getEntity(asUUID(entityId));

      let profile: EntityProfile;
      if (existing && options?.updateExisting) {
        // Merge with existing data
        profile = await this.mergeEntityData(existing, entityData);
        await this.db.updateEntity(profile);
      } else if (!existing) {
        // Create new entity
        profile = {
          entityId,
          agentId: asUUID(this.runtime.agentId),
          type: entityData.type,
          names: entityData.names,
          summary: entityData.summary,
          tags: entityData.tags,
          platforms: entityData.platforms || {},
          metadata: entityData.metadata || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.db.createEntity(profile);
      } else {
        profile = existing;
      }

      // Update cache
      await this.cache.set(cacheKey, profile);

      // Track interaction if source provided
      if (options?.source && options?.roomId) {
        await this.trackInteraction({
          sourceEntityId: options.source,
          targetEntityId: entityId,
          roomId: options.roomId,
          type: 'mention',
          content: context,
        });
      }

      return profile;
    } catch (error) {
      logger.error('[EntityGraphService] Error tracking entity:', error);
      throw error;
    }
  }

  async searchEntities(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: string;
      minTrust?: number;
    }
  ): Promise<EntitySearchResult[]> {
    const cacheKey = `search:${JSON.stringify({ query, options })}`;
    const cached = await this.cache.get<EntitySearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get all entities matching basic criteria
    const entities = await this.db.searchEntities({
      type: options?.type,
      minTrust: options?.minTrust,
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });

    if (entities.length === 0) {
      return [];
    }

    // Use LLM to rank results by relevance
    const prompt = this.buildSearchRankingPrompt(query, entities);
    const rankings = await this.llm.generateStructured(
      prompt,
      z.array(
        z.object({
          index: z.number(),
          score: z.number().min(0).max(100),
          reason: z.string(),
        })
      )
    );

    // Build results with relevance scores
    const results: EntitySearchResult[] = rankings
      .filter((r) => r.score > 30) // Minimum relevance threshold
      .map((r) => {
        const entity = entities[r.index];
        return {
          ...entity,
          entity,
          relevanceScore: r.score,
          matchReason: r.reason,
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    await this.cache.set(cacheKey, results, this.CACHE_TTL / 2);
    return results;
  }

  async batchUpdateEntities(
    updates: Array<{
      entityId: UUID;
      data: Partial<EntityProfile>;
    }>
  ): Promise<void> {
    // Add to batch queue for async processing
    await this.batchQueue.add({
      type: 'entity-update',
      data: updates,
    });
  }

  // === Relationship Management ===

  async analyzeInteraction(
    sourceId: UUID,
    targetId: UUID,
    interaction: string,
    options?: {
      roomId?: UUID;
      messageId?: UUID;
    }
  ): Promise<Relationship> {
    try {
      // Record the interaction
      await this.trackInteraction({
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        roomId: options?.roomId || asUUID(this.runtime.agentId),
        messageId: options?.messageId,
        type: 'message',
        content: interaction,
      });

      // Get existing relationship if any
      const existing: Relationship | undefined = await this.db.getRelationship(
        asUUID(sourceId),
        asUUID(targetId)
      );

      // Use LLM to analyze the interaction
      const analysis = await this.inferRelationships(interaction, {
        sourceId,
        targetId,
        existing,
      });

      if (analysis.relationships.length === 0) {
        throw new Error('No relationship inference from interaction');
      }

      const inferred = analysis.relationships[0];

      // Update or create relationship
      const relationship: Relationship = {
        id: existing?.id || asUUID(stringToUuid(`${sourceId}-${targetId}`)),
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        agentId: asUUID(this.runtime.agentId),
        tags: [],
        metadata: {
          type: inferred.type,
          strength: existing
            ? Math.min(1, ((existing.metadata?.strength as number) || 0.5) + 0.1)
            : inferred.confidence * 0.7,
          sentiment: inferred.sentiment,
          lastInteraction: new Date().toISOString(),
          evidence: [...((existing?.metadata?.evidence as any[]) || []), inferred.evidence].slice(
            -10
          ),
        },
      };

      if (existing) {
        await this.db.updateRelationship(relationship);
      } else {
        await this.db.createRelationship(relationship);

        // Create reverse relationship for bidirectional access
        await this.db.createRelationship({
          ...relationship,
          id: asUUID(stringToUuid(`${targetId}-${sourceId}`)),
          sourceEntityId: targetId,
          targetEntityId: sourceId,
        });
      }

      // Clear cache for both entities
      await this.cache.delete(`relationships:${sourceId}`);
      await this.cache.delete(`relationships:${targetId}`);

      return relationship;
    } catch (error) {
      logger.error('[EntityGraphService] Error analyzing interaction:', error);
      throw error;
    }
  }

  async getEntityRelationships(
    entityId: UUID,
    options?: {
      type?: string;
      minStrength?: number;
    }
  ): Promise<Relationship[]> {
    const cacheKey = `relationships:${entityId}:${JSON.stringify(options)}`;
    const cached = await this.cache.get<Relationship[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const relationships = await this.db.getEntityRelationships(asUUID(entityId), options);
    await this.cache.set(cacheKey, relationships);

    return relationships;
  }

  // === Trust Management ===

  async updateTrust(
    entityId: UUID,
    event: {
      type: string;
      impact: number;
      reason: string;
      metadata?: Record<string, any>;
    }
  ): Promise<EntityProfile> {
    // Validate impact is within bounds
    const impact = Math.max(-0.5, Math.min(0.5, event.impact));

    // Record trust event
    await this.db.createTrustEvent({
      id: asUUID(stringToUuid(`trust-${Date.now()}`)),
      entityId,
      eventType: event.type,
      impact,
      reason: event.reason,
      metadata: event.metadata || {},
      createdAt: new Date().toISOString(),
    });

    // Get current entity
    const entity = await this.db.getEntity(asUUID(entityId));
    if (!entity) {
      throw new Error(`Entity ${entityId} not found`);
    }

    // Calculate new trust score
    const currentTrust = entity.trustScore || 0.5;
    const newTrust = Math.max(0, Math.min(1, currentTrust + impact));

    // Update entity
    entity.trustScore = newTrust;
    entity.updatedAt = new Date().toISOString();
    await this.db.updateEntity(entity);

    // Clear cache
    await this.cache.delete(`entity:${entityId}`);

    // Check if trust level crossed threshold
    if (currentTrust >= 0.7 && newTrust < 0.7) {
      logger.warn(`[EntityGraphService] Entity ${entityId} trust dropped below trusted threshold`);
    } else if (currentTrust < 0.3 && newTrust >= 0.3) {
      logger.info(`[EntityGraphService] Entity ${entityId} trust rose above suspicious threshold`);
    }

    return entity;
  }

  async analyzeTrustFromBehavior(
    entityId: UUID,
    recentMessages: Memory[]
  ): Promise<TrustEvent | null> {
    if (recentMessages.length === 0) {
      return null;
    }

    // Build context for trust analysis
    const context = this.buildTrustAnalysisContext(entityId, recentMessages);

    // Use LLM to analyze trust indicators
    const analysis = await this.llm.generateStructured(context, TrustAnalysisSchema);

    // Only update if significant change detected
    if (Math.abs(analysis.trustDelta) < 0.05) {
      return null;
    }

    await this.updateTrust(entityId, {
      type: 'behavior-analysis',
      impact: analysis.trustDelta,
      reason: analysis.reason,
      metadata: {
        indicators: analysis.indicators,
        riskLevel: analysis.riskLevel,
        messageCount: recentMessages.length,
      },
    });

    // Return the trust event
    return {
      id: asUUID(stringToUuid(`trust-${Date.now()}`)),
      entityId,
      eventType: 'behavior-analysis',
      impact: analysis.trustDelta,
      reason: analysis.reason,
      metadata: {
        indicators: analysis.indicators,
        riskLevel: analysis.riskLevel,
        messageCount: recentMessages.length,
      },
      createdAt: new Date().toISOString(),
    };
  }

  // === Follow-up Management ===

  async scheduleFollowUp(
    entityId: UUID,
    followUp: {
      message: string;
      scheduledFor: Date;
      priority?: 'low' | 'medium' | 'high';
      metadata?: Record<string, any>;
    }
  ): Promise<FollowUp> {
    const id = asUUID(stringToUuid(`followup-${Date.now()}`));

    const data: FollowUp = {
      id,
      entityId,
      message: followUp.message,
      scheduledFor: followUp.scheduledFor.toISOString(),
      completed: false,
      metadata: {
        priority: followUp.priority || 'medium',
        ...followUp.metadata,
      },
    };

    await this.db.createFollowUp(data);

    // Schedule notification
    if (followUp.scheduledFor.getTime() <= Date.now() + 86400000) {
      // Within 24 hours
      await this.batchQueue.add({
        type: 'followup-reminder',
        data,
        processAt: followUp.scheduledFor.getTime(),
      });
    }

    return data;
  }

  async getUpcomingFollowUps(options?: {
    entityId?: UUID;
    limit?: number;
    includePast?: boolean;
  }): Promise<FollowUp[]> {
    return await this.db.getFollowUps({
      entityId: options?.entityId ? asUUID(options.entityId) : undefined,
      completed: false,
      before: options?.includePast ? undefined : new Date(),
      limit: options?.limit || 20,
    });
  }

  // === Additional Public Methods ===

  async getAllRelationships(): Promise<any[]> {
    try {
      const allRelationships = await this.runtime.getRelationships({
        entityId: asUUID(this.runtime.agentId),
      });
      const results: any[] = [];

      for (const rel of allRelationships) {
        const source = await this.getEntity(rel.sourceEntityId);
        const target = await this.getEntity(rel.targetEntityId);

        if (source && target) {
          results.push({
            id: rel.id,
            source,
            target,
            relationshipType: rel.metadata?.type || 'unknown',
            metadata: rel.metadata || {},
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('[EntityGraphManager] Failed to get all relationships:', error);
      return [];
    }
  }

  async getNetworkStats(): Promise<{
    totalEntities: number;
    totalRelationships: number;
    avgRelationshipsPerEntity: number;
    strongRelationships: number;
  }> {
    try {
      const entities = await this.runtime.db.query(
        'SELECT COUNT(*) as count FROM entities WHERE agentId = ?',
        [this.runtime.agentId]
      );

      const relationships = await this.runtime.db.query(
        'SELECT COUNT(*) as count FROM relationships WHERE agentId = ?',
        [this.runtime.agentId]
      );

      const strongRelationships = await this.runtime.db.query(
        'SELECT COUNT(*) as count FROM relationships WHERE agentId = ? AND strength > ?',
        [this.runtime.agentId, 0.7]
      );

      const totalEntities = entities[0]?.count || 0;
      const totalRelationships = relationships[0]?.count || 0;

      return {
        totalEntities,
        totalRelationships,
        avgRelationshipsPerEntity: totalEntities > 0 ? totalRelationships / totalEntities : 0,
        strongRelationships: strongRelationships[0]?.count || 0,
      };
    } catch (error) {
      logger.error('[EntityGraphManager] Failed to get network stats:', error);
      return {
        totalEntities: 0,
        totalRelationships: 0,
        avgRelationshipsPerEntity: 0,
        strongRelationships: 0,
      };
    }
  }

  // === Private Helper Methods ===

  private async extractEntities(context: string): Promise<z.infer<typeof EntityExtractionSchema>> {
    const prompt = `
You are an expert at extracting entity information from conversations.

Examples:
${ENTITY_EXTRACTION_EXAMPLES.map(
  (ex) => `Context: "${ex.context}"\nExtracted: ${JSON.stringify(ex.result, null, 2)}`
).join('\n\n')}

Now extract entities from this context:
"${context}"

Respond with a JSON object matching the schema. Extract all relevant information including:
- Entity type (person, organization, bot, system)
- All names/aliases mentioned
- A brief summary
- Relevant tags
- Platform identifiers (twitter handles, discord names, etc)
- Any metadata that might be useful

Be thorough but accurate. Only extract what is clearly stated or strongly implied.`;

    return await this.llm.generateStructured(prompt, EntityExtractionSchema);
  }

  private async inferRelationships(
    context: string,
    options?: {
      sourceId?: UUID;
      targetId?: UUID;
      existing?: Relationship;
    }
  ): Promise<z.infer<typeof RelationshipInferenceSchema>> {
    const prompt = `
You are an expert at inferring relationships between entities from conversations.

Examples:
${RELATIONSHIP_INFERENCE_EXAMPLES.map(
  (ex) => `Context: "${ex.context}"\nInferred: ${JSON.stringify(ex.result, null, 2)}`
).join('\n\n')}

${
  options?.existing
    ? `
Existing relationship:
${JSON.stringify(options.existing.metadata, null, 2)}
`
    : ''
}

Now analyze this interaction:
"${context}"

${
  options?.sourceId && options?.targetId
    ? `
Source Entity ID: ${options.sourceId}
Target Entity ID: ${options.targetId}
`
    : ''
}

Infer the relationship(s) present. Consider:
- Type of relationship (colleague, friend, family, business, etc)
- Confidence in your inference (0-1)
- Evidence supporting the inference
- Sentiment of the interaction (-1 to 1)

Be conservative - only infer what is clearly supported by evidence.`;

    return await this.llm.generateStructured(prompt, RelationshipInferenceSchema);
  }

  private buildSearchRankingPrompt(query: string, entities: EntityProfile[]): string {
    return `
Rank these entities by relevance to the search query: "${query}"

Entities:
${entities
  .map(
    (e, i) =>
      `${i}. ${e.names.join(', ')} (${e.type}): ${e.summary}
   Tags: ${e.tags.join(', ')}`
  )
  .join('\n')}

Return a JSON array of objects with:
- index: entity index
- score: relevance score 0-100
- reason: brief explanation

Consider name matches, type relevance, tag overlap, and semantic similarity.`;
  }

  private buildTrustAnalysisContext(entityId: UUID, messages: Memory[]): string {
    return `
Analyze these recent messages for trust indicators:

${messages.map((m) => `${m.entityId === entityId ? 'Entity' : 'Other'}: ${m.content.text}`).join('\n')}

Look for:
- Helpful vs harmful behavior
- Consistency vs contradictions  
- Transparency vs deception
- Positive vs negative intent

Return your analysis with:
- trustDelta: change in trust score (-0.5 to 0.5)
- reason: explanation for the change
- indicators: specific behaviors observed
- riskLevel: low/medium/high

Be conservative with trust changes. Only significant patterns should result in large deltas.`;
  }

  private async mergeEntityData(existing: EntityProfile, newData: any): Promise<EntityProfile> {
    return {
      ...existing,
      names: [...new Set([...existing.names, ...newData.names])],
      summary: newData.summary || existing.summary,
      tags: [...new Set([...existing.tags, ...newData.tags])],
      platforms: { ...existing.platforms, ...newData.platforms },
      metadata: { ...existing.metadata, ...newData.metadata },
      updatedAt: new Date().toISOString(),
    };
  }

  private async trackInteraction(interaction: InteractionEvent): Promise<void> {
    try {
      // Store interaction in database
      await this.db.createInteraction(interaction);

      // Add to batch queue for sentiment analysis
      await this.batchQueue.add({
        type: 'sentiment-analysis',
        data: interaction,
      });
    } catch (error) {
      logger.error('[EntityGraphService] Error tracking interaction:', error);
      // Don't throw - interactions are supplementary
    }
  }

  private async processBatch(items: any[]): Promise<void> {
    // Group by type
    const groups = items.reduce(
      (acc, item) => {
        acc[item.type] = acc[item.type] || [];
        acc[item.type].push(item);
        return acc;
      },
      {} as Record<string, any[]>
    );

    // Process each type
    for (const [type, batch] of Object.entries(groups)) {
      try {
        switch (type) {
          case 'entity-update':
            await this.processBatchEntityUpdates(batch as any[]);
            break;
          case 'sentiment-analysis':
            await this.processBatchSentimentAnalysis(batch as any[]);
            break;
          case 'followup-reminder':
            await this.processBatchFollowUpReminders(batch as any[]);
            break;
        }
      } catch (error) {
        logger.error(`[EntityGraphService] Batch processing error for ${type}:`, error);
      }
    }
  }

  private async processBatchEntityUpdates(batch: any[]): Promise<void> {
    const updates = batch.flatMap((item) => item.data);
    await this.db.batchUpdateEntities(updates);

    // Clear cache for updated entities
    await Promise.all(updates.map((u) => this.cache.delete(`entity:${u.entityId}`)));
  }

  private async processBatchSentimentAnalysis(batch: any[]): Promise<void> {
    const interactions = batch.map((item) => item.data);

    // Analyze sentiment in batches of 10
    for (let i = 0; i < interactions.length; i += 10) {
      const chunk = interactions.slice(i, i + 10);
      const sentiments = await this.analyzeBatchSentiment(chunk);

      // Update interactions with sentiment
      await Promise.all(
        chunk.map((interaction, idx) =>
          this.db.updateInteraction({
            ...interaction,
            sentiment: sentiments[idx],
          })
        )
      );
    }
  }

  private async processBatchFollowUpReminders(batch: any[]): Promise<void> {
    // Send reminders for due follow-ups
    for (const item of batch) {
      const followUp = item.data;
      logger.info(`[EntityGraphService] Follow-up reminder: ${followUp.message}`);

      // Emit event for other systems to handle
      await this.runtime.emitEvent('followup.due', {
        data: followUp,
      });
    }
  }

  private async analyzeBatchSentiment(interactions: InteractionEvent[]): Promise<number[]> {
    const prompt = `
Analyze the sentiment of these interactions on a scale of -1 (very negative) to 1 (very positive):

${interactions.map((int, i) => `${i + 1}. "${int.content}"`).join('\n')}

Return a JSON array of numbers representing the sentiment for each interaction.`;

    const response = await this.llm.generateStructured(prompt, z.array(z.number().min(-1).max(1)));

    return response;
  }
}
