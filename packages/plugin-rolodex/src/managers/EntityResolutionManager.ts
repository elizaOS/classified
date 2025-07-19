import {
  logger,
  type IAgentRuntime,
  type UUID,
  type Entity,
  type Memory,
  stringToUuid,
  ModelType,
} from '@elizaos/core';
import type {
  EntityProfile,
  PlatformIdentity,
  TrustEvent as _TrustEvent,
  BehaviorProfile as _BehaviorProfile,
} from '../types';
import { EventBridge, RolodexEventType, type EntityEvent } from '../managers/EventBridge';

// Enhanced entity resolution interfaces
export interface EntityResolutionCandidate {
  entityId: UUID;
  entity: Entity;
  profile?: EntityProfile;
  confidence: number;
  matchFactors: MatchFactor[];
  riskFactors: RiskFactor[];
  crossPlatformIndicators: CrossPlatformIndicator[];
}

export interface MatchFactor {
  type:
    | 'name_exact'
    | 'name_similar'
    | 'platform_identity'
    | 'behavioral_pattern'
    | 'contextual_hint'
    | 'trust_correlation'
    | 'network_proximity';
  confidence: number;
  evidence: string;
  weight: number;
}

export interface RiskFactor {
  type:
    | 'potential_duplicate'
    | 'impersonation_risk'
    | 'identity_conflict'
    | 'trust_inconsistency'
    | 'behavioral_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  evidence: string[];
}

export interface CrossPlatformIndicator {
  platform: string;
  identifier: string;
  verified: boolean;
  confidence: number;
  linkingEvidence: string[];
  conflictingEvidence?: string[];
  lastSeen: Date;
}

export interface ResolutionContext {
  roomId?: UUID;
  worldId?: UUID;
  sourceEntityId?: UUID;
  conversationHistory?: Memory[];
  platformContext?: {
    platform: string;
    channelId?: string;
    serverId?: string;
  };
  timeContext?: {
    timeZone?: string;
    timestamp: Date;
  };
  trustContext?: {
    requiredTrustLevel?: number;
    securitySensitive?: boolean;
  };
}

export interface EntityMergeProposal {
  primaryEntityId: UUID;
  candidateEntityIds: UUID[];
  confidence: number;
  mergeStrategy: 'absorb' | 'merge' | 'link';
  conflictResolution: Array<{
    field: string;
    primaryValue: any;
    candidateValues: any[];
    resolution: 'keep_primary' | 'merge_all' | 'manual_review';
    confidence: number;
  }>;
  preservedData: Array<{
    entityId: UUID;
    field: string;
    value: any;
    reason: string;
  }>;
  riskAssessment: {
    dataLossRisk: number;
    trustImpactRisk: number;
    relationshipImpactRisk: number;
    overallRisk: number;
  };
}

export interface IdentityGraph {
  entityId: UUID;
  platformIdentities: Map<string, PlatformIdentity>;
  crossReferences: Array<{
    targetEntityId: UUID;
    linkingFactor: string;
    confidence: number;
    bidirectional: boolean;
  }>;
  trustNetwork: Array<{
    targetEntityId: UUID;
    trustPath: UUID[];
    trustScore: number;
    pathLength: number;
  }>;
  behaviorFingerprint: {
    communicationStyle: string[];
    activityPatterns: string[];
    responseTimeProfile: number[];
    sentimentProfile: number[];
    topicAffinities: string[];
  };
}

export class EntityResolutionManager {
  private runtime: IAgentRuntime;
  private eventBridge: EventBridge;
  private identityGraphs: Map<UUID, IdentityGraph> = new Map();
  private resolutionCache: Map<string, EntityResolutionCandidate[]> = new Map();
  private mergeProposals: Map<string, EntityMergeProposal> = new Map();

  // Configuration for resolution algorithms
  private resolutionConfig = {
    // Confidence thresholds
    highConfidenceThreshold: 0.85,
    mediumConfidenceThreshold: 0.6,
    lowConfidenceThreshold: 0.3,

    // Match factor weights
    matchWeights: {
      name_exact: 0.9,
      name_similar: 0.7,
      platform_identity: 0.8,
      behavioral_pattern: 0.6,
      contextual_hint: 0.5,
      trust_correlation: 0.7,
      network_proximity: 0.4,
    },

    // Risk factor impact
    riskImpact: {
      low: 0.05,
      medium: 0.15,
      high: 0.3,
      critical: 0.5,
    },

    // Cache settings
    cacheExpiryMinutes: 30,
    maxCacheSize: 1000,

    // Merge settings
    autoMergeThreshold: 0.95,
    manualReviewThreshold: 0.75,
  };

  constructor(runtime: IAgentRuntime, eventBridge: EventBridge) {
    this.runtime = runtime;
    this.eventBridge = eventBridge;
  }

  async initialize(): Promise<void> {
    // Load existing identity graphs
    await this.loadIdentityGraphs();

    logger.info('[EntityResolutionManager] Initialized successfully');
  }

  async stop(): Promise<void> {
    this.identityGraphs.clear();
    this.resolutionCache.clear();
    this.mergeProposals.clear();

    logger.info('[EntityResolutionManager] Stopped');
  }

  /**
   * Resolve entity with sophisticated confidence scoring and context awareness
   */
  async resolveEntity(
    identifier: string,
    context: ResolutionContext,
    platformHint?: string
  ): Promise<EntityResolutionCandidate[]> {
    const cacheKey = this.generateCacheKey(identifier, context, platformHint);

    // Check cache first
    if (this.resolutionCache.has(cacheKey)) {
      const cached = this.resolutionCache.get(cacheKey)!;
      logger.debug(`[EntityResolutionManager] Cache hit for identifier: ${identifier}`);
      return cached;
    }

    logger.debug(
      `[EntityResolutionManager] Resolving entity: ${identifier} with platform hint: ${platformHint}`
    );

    try {
      // Step 1: Find potential candidates
      const candidates = await this.findCandidates(identifier, context, platformHint);

      // Step 2: Score each candidate with confidence and risk assessment
      const scoredCandidates = await Promise.all(
        candidates.map((candidate) => this.scoreCandidate(candidate, identifier, context))
      );

      // Step 3: Apply context-aware disambiguation
      const disambiguated = await this.applyContextualDisambiguation(scoredCandidates, context);

      // Step 4: Detect and handle potential duplicates/conflicts
      const finalCandidates = await this.detectAndHandleConflicts(disambiguated, context);

      // Step 5: Sort by confidence and apply final filters
      const sortedCandidates = finalCandidates
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Top 10 candidates

      // Cache the results
      this.resolutionCache.set(cacheKey, sortedCandidates);
      this.cleanupCache();

      // Emit resolution event
      if (this.eventBridge && sortedCandidates.length > 0) {
        await this.eventBridge.emit<EntityEvent>({
          type: RolodexEventType.ENTITY_RESOLVED,
          timestamp: Date.now(),
          entityId: sortedCandidates[0].entityId,
          entity: sortedCandidates[0].entity,
          source: 'entity-resolution',
          confidence: sortedCandidates[0].confidence,
          metadata: {
            identifier,
            candidateCount: sortedCandidates.length,
            resolutionContext: context,
            platformHint,
          },
        });
      }

      return sortedCandidates;
    } catch (error) {
      logger.error(`[EntityResolutionManager] Error resolving entity ${identifier}:`, error);
      return [];
    }
  }

  /**
   * Enhanced entity creation with automatic cross-platform identity detection
   */
  async createEntityWithIdentity(
    name: string,
    context: ResolutionContext,
    platformIdentities: PlatformIdentity[] = [],
    metadata: Record<string, any> = {}
  ): Promise<UUID> {
    const entityId = stringToUuid(`entity-${name}-${Date.now()}`);

    try {
      // Create the entity
      await this.runtime.createEntity({
        id: entityId,
        names: [name],
        agentId: this.runtime.agentId,
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          createdBy: 'entity-resolution',
          platformIdentities: platformIdentities.reduce(
            (acc, identity) => {
              acc[identity.platform] = identity;
              return acc;
            },
            {} as Record<string, PlatformIdentity>
          ),
        },
      });

      // Build identity graph
      const identityGraph: IdentityGraph = {
        entityId,
        platformIdentities: new Map(
          platformIdentities.map((identity) => [identity.platform, identity])
        ),
        crossReferences: [],
        trustNetwork: [],
        behaviorFingerprint: {
          communicationStyle: [],
          activityPatterns: [],
          responseTimeProfile: [],
          sentimentProfile: [],
          topicAffinities: [],
        },
      };

      this.identityGraphs.set(entityId, identityGraph);

      // Detect potential cross-references
      await this.detectCrossReferences(entityId, identityGraph);

      // Emit entity creation event
      if (this.eventBridge) {
        const entity = await this.runtime.getEntityById(entityId);
        if (entity) {
          await this.eventBridge.emit<EntityEvent>({
            type: RolodexEventType.ENTITY_CREATED,
            timestamp: Date.now(),
            entityId,
            entity,
            source: 'entity-resolution',
            metadata: {
              name,
              platformIdentities: platformIdentities.length,
              resolutionContext: context,
            },
          });
        }
      }

      logger.info(
        `[EntityResolutionManager] Created entity ${entityId} with ${platformIdentities.length} platform identities`
      );
      return entityId;
    } catch (error) {
      logger.error('[EntityResolutionManager] Error creating entity:', error);
      throw error;
    }
  }

  /**
   * Propose entity merges based on high-confidence matches
   */
  async proposeEntityMerges(entityId: UUID): Promise<EntityMergeProposal[]> {
    const identityGraph = this.identityGraphs.get(entityId);
    if (!identityGraph) {
      return [];
    }

    const proposals: EntityMergeProposal[] = [];

    try {
      // Find high-confidence cross-references
      const highConfidenceRefs = identityGraph.crossReferences
        .filter((ref) => ref.confidence > this.resolutionConfig.manualReviewThreshold)
        .sort((a, b) => b.confidence - a.confidence);

      for (const ref of highConfidenceRefs) {
        const proposal = await this.buildMergeProposal(
          entityId,
          ref.targetEntityId,
          ref.confidence
        );
        if (proposal) {
          proposals.push(proposal);
        }
      }

      return proposals;
    } catch (error) {
      logger.error(`[EntityResolutionManager] Error proposing merges for ${entityId}:`, error);
      return [];
    }
  }

  /**
   * Execute entity merge with conflict resolution
   */
  async executeMerge(proposal: EntityMergeProposal): Promise<boolean> {
    try {
      const primaryEntity = await this.runtime.getEntityById(proposal.primaryEntityId);
      if (!primaryEntity) {
        throw new Error(`Primary entity ${proposal.primaryEntityId} not found`);
      }

      logger.info(
        `[EntityResolutionManager] Executing merge: ${proposal.candidateEntityIds.length} entities into ${proposal.primaryEntityId}`
      );

      // Collect all data from candidate entities
      const candidateEntities = await Promise.all(
        proposal.candidateEntityIds.map((id) => this.runtime.getEntityById(id))
      );

      // Build merged entity data
      const mergedMetadata = { ...primaryEntity.metadata };
      const mergedNames = [...primaryEntity.names];

      for (const candidate of candidateEntities) {
        if (!candidate) {
          continue;
        }

        // Merge names
        for (const name of candidate.names) {
          if (!mergedNames.includes(name)) {
            mergedNames.push(name);
          }
        }

        // Merge metadata according to conflict resolution
        for (const resolution of proposal.conflictResolution) {
          if (resolution.resolution === 'merge_all') {
            if (Array.isArray(mergedMetadata[resolution.field])) {
              mergedMetadata[resolution.field] = [
                ...(mergedMetadata[resolution.field] as any[]),
                ...resolution.candidateValues.flat(),
              ];
            } else {
              mergedMetadata[resolution.field] = resolution.candidateValues[0];
            }
          }
        }
      }

      // Update primary entity
      await this.runtime.updateEntity({
        id: proposal.primaryEntityId,
        names: mergedNames,
        agentId: this.runtime.agentId,
        metadata: {
          ...mergedMetadata,
          mergedAt: new Date().toISOString(),
          mergedFrom: proposal.candidateEntityIds,
          mergeStrategy: proposal.mergeStrategy,
        },
      });

      // Merge identity graphs
      await this.mergeIdentityGraphs(proposal.primaryEntityId, proposal.candidateEntityIds);

      // Update relationships to point to primary entity
      await this.redirectRelationships(proposal.candidateEntityIds, proposal.primaryEntityId);

      // Remove candidate entities
      for (const candidateId of proposal.candidateEntityIds) {
        try {
          // Note: In a real implementation, you might want to archive rather than delete
          this.identityGraphs.delete(candidateId);
        } catch (error) {
          logger.warn(
            `[EntityResolutionManager] Could not remove candidate entity ${candidateId}:`,
            error
          );
        }
      }

      // Emit merge event
      if (this.eventBridge) {
        const mergedEntity = await this.runtime.getEntityById(proposal.primaryEntityId);
        if (mergedEntity) {
          await this.eventBridge.emit<EntityEvent>({
            type: RolodexEventType.ENTITY_MERGED,
            timestamp: Date.now(),
            entityId: proposal.primaryEntityId,
            entity: mergedEntity,
            mergedEntities: candidateEntities.filter((e) => e) as Entity[],
            source: 'entity-resolution',
            confidence: proposal.confidence,
            metadata: {
              mergeStrategy: proposal.mergeStrategy,
              candidateCount: proposal.candidateEntityIds.length,
              riskAssessment: proposal.riskAssessment,
            },
          });
        }
      }

      logger.info(
        `[EntityResolutionManager] Successfully merged ${proposal.candidateEntityIds.length} entities into ${proposal.primaryEntityId}`
      );
      return true;
    } catch (error) {
      logger.error('[EntityResolutionManager] Error executing merge:', error);
      return false;
    }
  }

  /**
   * Merge multiple entities into one
   */
  async mergeEntities(
    primaryId: UUID,
    candidateIds: UUID[],
    options: {
      strategy?: string;
      preserveHistory?: boolean;
      updateRelationships?: boolean;
    } = {}
  ): Promise<Entity> {
    try {
      // Use the executeMerge method with a constructed proposal
      const proposal: EntityMergeProposal = {
        primaryEntityId: primaryId,
        candidateEntityIds: candidateIds,
        confidence: 1, // High confidence since this is a direct call
        mergeStrategy: options.strategy === 'automatic' ? 'absorb' : 'merge',
        conflictResolution: [],
        preservedData: [],
        riskAssessment: {
          dataLossRisk: 0.2,
          trustImpactRisk: 0.2,
          relationshipImpactRisk: 0.3,
          overallRisk: 0.23,
        },
      };

      const success = await this.executeMerge(proposal);

      if (!success) {
        throw new Error('Merge execution failed');
      }

      const mergedEntity = await this.runtime.getEntityById(primaryId);
      if (!mergedEntity) {
        throw new Error('Merged entity not found');
      }

      return mergedEntity;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[EntityResolutionManager] Error merging entities:', error);
      throw new Error(`Failed to merge entities: ${errorMessage}`);
    }
  }

  // Private helper methods
  private async findCandidates(
    identifier: string,
    context: ResolutionContext,
    platformHint?: string
  ): Promise<EntityResolutionCandidate[]> {
    const candidates: EntityResolutionCandidate[] = [];

    try {
      // Search by name/identifier
      const entities = await this.searchEntitiesByName(identifier, context);

      for (const entity of entities) {
        candidates.push({
          entityId: entity.id as UUID,
          entity,
          confidence: 0, // Will be calculated in scoreCandidate
          matchFactors: [],
          riskFactors: [],
          crossPlatformIndicators: [],
        });
      }

      // Search by platform identity if hint provided
      if (platformHint) {
        const platformEntities = await this.searchEntitiesByPlatform(platformHint, identifier);
        for (const entity of platformEntities) {
          if (!candidates.some((c) => c.entityId === entity.id)) {
            candidates.push({
              entityId: entity.id as UUID,
              entity,
              confidence: 0,
              matchFactors: [],
              riskFactors: [],
              crossPlatformIndicators: [],
            });
          }
        }
      }

      return candidates;
    } catch (error) {
      logger.error('[EntityResolutionManager] Error finding candidates:', error);
      return [];
    }
  }

  private async scoreCandidate(
    candidate: EntityResolutionCandidate,
    identifier: string,
    context: ResolutionContext
  ): Promise<EntityResolutionCandidate> {
    try {
      // Calculate match factors
      const matchFactors = await this.calculateMatchFactors(candidate.entity, identifier, context);

      // Calculate risk factors
      const riskFactors = await this.calculateRiskFactors(candidate.entity, identifier, context);

      // Calculate cross-platform indicators
      const crossPlatformIndicators = await this.calculateCrossPlatformIndicators(candidate.entity);

      // Calculate overall confidence
      let confidence = 0;
      let totalWeight = 0;

      for (const factor of matchFactors) {
        confidence += factor.confidence * factor.weight;
        totalWeight += factor.weight;
      }

      if (totalWeight > 0) {
        confidence = confidence / totalWeight;
      }

      // Apply risk factor penalties
      for (const risk of riskFactors) {
        const penalty = this.resolutionConfig.riskImpact[risk.severity] * risk.confidence;
        confidence = Math.max(0, confidence - penalty);
      }

      return {
        ...candidate,
        confidence: Math.min(1, confidence),
        matchFactors,
        riskFactors,
        crossPlatformIndicators,
      };
    } catch (error) {
      logger.error('[EntityResolutionManager] Error scoring candidate:', error);
      return { ...candidate, confidence: 0 };
    }
  }

  private async calculateMatchFactors(
    entity: Entity,
    identifier: string,
    context: ResolutionContext
  ): Promise<MatchFactor[]> {
    const factors: MatchFactor[] = [];

    // Exact name match
    if (entity.names.some((name) => name.toLowerCase() === identifier.toLowerCase())) {
      factors.push({
        type: 'name_exact',
        confidence: 1.0,
        evidence: `Exact name match: ${identifier}`,
        weight: this.resolutionConfig.matchWeights.name_exact,
      });
    }

    // Similar name match (using LLM for semantic similarity)
    const similarityScore = await this.calculateNameSimilarity(entity.names, identifier);
    if (similarityScore > 0.7) {
      factors.push({
        type: 'name_similar',
        confidence: similarityScore,
        evidence: `Similar name match with score: ${similarityScore.toFixed(2)}`,
        weight: this.resolutionConfig.matchWeights.name_similar,
      });
    }

    // Platform identity match
    const platformIdentities = entity.metadata?.platformIdentities || {};
    for (const [platform, identity] of Object.entries(platformIdentities)) {
      if (
        typeof identity === 'object' &&
        identity !== null &&
        'handle' in identity &&
        identity.handle === identifier
      ) {
        factors.push({
          type: 'platform_identity',
          confidence: 'verified' in identity && identity.verified ? 1.0 : 0.8,
          evidence: `Platform identity match on ${platform}: ${identity.handle}`,
          weight: this.resolutionConfig.matchWeights.platform_identity,
        });
      }
    }

    // Contextual hints from conversation
    if (context.conversationHistory) {
      const contextScore = await this.analyzeContextualHints(
        entity,
        identifier,
        context.conversationHistory
      );
      if (contextScore > 0.3) {
        factors.push({
          type: 'contextual_hint',
          confidence: contextScore,
          evidence: 'Contextual evidence from conversation',
          weight: this.resolutionConfig.matchWeights.contextual_hint,
        });
      }
    }

    return factors;
  }

  private async calculateRiskFactors(
    entity: Entity,
    identifier: string,
    _context: ResolutionContext
  ): Promise<RiskFactor[]> {
    const risks: RiskFactor[] = [];

    // Check for potential duplicates
    const similarEntities = await this.findSimilarEntities(entity);
    if (similarEntities.length > 0) {
      risks.push({
        type: 'potential_duplicate',
        severity: 'medium',
        confidence: 0.7,
        description: `Found ${similarEntities.length} similar entities`,
        evidence: similarEntities.map((e) => e.names.join(', ')),
      });
    }

    // Check for identity conflicts
    const identityConflicts = await this.detectIdentityConflicts(entity, identifier);
    if (identityConflicts.length > 0) {
      risks.push({
        type: 'identity_conflict',
        severity: 'high',
        confidence: 0.8,
        description: 'Conflicting identity information detected',
        evidence: identityConflicts,
      });
    }

    return risks;
  }

  private async calculateCrossPlatformIndicators(
    entity: Entity
  ): Promise<CrossPlatformIndicator[]> {
    const indicators: CrossPlatformIndicator[] = [];
    const platformIdentities = entity.metadata?.platformIdentities || {};

    for (const [platform, identity] of Object.entries(platformIdentities)) {
      if (typeof identity === 'object' && identity !== null) {
        const identityObj = identity as any;
        indicators.push({
          platform,
          identifier: identityObj.handle || identityObj.userId || '',
          verified: identityObj.verified || false,
          confidence: identityObj.confidence || 0.5,
          linkingEvidence: ['Identity stored in entity metadata'],
          lastSeen: new Date(identityObj.lastSeen || Date.now()),
        });
      }
    }

    return indicators;
  }

  private async applyContextualDisambiguation(
    candidates: EntityResolutionCandidate[],
    context: ResolutionContext
  ): Promise<EntityResolutionCandidate[]> {
    // Apply context-based scoring adjustments
    return candidates.map((candidate) => {
      let adjustedConfidence = candidate.confidence;

      // Room/world context boost
      if (context.roomId) {
        // Check if entity has been active in this room recently
        // This would require checking interaction history
        // For now, apply a small boost for entities in the same room
        adjustedConfidence *= 1.1;
      }

      // Trust context adjustment
      if (context.trustContext?.securitySensitive) {
        // Apply stricter confidence requirements for security-sensitive contexts
        adjustedConfidence *= 0.9;
      }

      return {
        ...candidate,
        confidence: Math.min(1, adjustedConfidence),
      };
    });
  }

  private async detectAndHandleConflicts(
    candidates: EntityResolutionCandidate[],
    _context: ResolutionContext
  ): Promise<EntityResolutionCandidate[]> {
    // Group candidates by confidence level
    const highConfidence = candidates.filter(
      (c) => c.confidence > this.resolutionConfig.highConfidenceThreshold
    );
    const _mediumConfidence = candidates.filter(
      (c) =>
        c.confidence > this.resolutionConfig.mediumConfidenceThreshold &&
        c.confidence <= this.resolutionConfig.highConfidenceThreshold
    );

    // If multiple high-confidence candidates, flag for manual review
    if (highConfidence.length > 1) {
      logger.warn(
        '[EntityResolutionManager] Multiple high-confidence candidates detected, flagging for review'
      );

      // Add risk factors to all high-confidence candidates
      for (const candidate of highConfidence) {
        candidate.riskFactors.push({
          type: 'identity_conflict',
          severity: 'high',
          confidence: 0.9,
          description: 'Multiple high-confidence matches detected',
          evidence: [
            `${highConfidence.length} candidates with confidence > ${this.resolutionConfig.highConfidenceThreshold}`,
          ],
        });
      }
    }

    return candidates;
  }

  // Additional helper methods would be implemented here...
  private generateCacheKey(
    identifier: string,
    context: ResolutionContext,
    platformHint?: string
  ): string {
    const contextKey = [
      context.roomId || 'no-room',
      context.platformContext?.platform || 'no-platform',
      platformHint || 'no-hint',
    ].join('|');

    return `${identifier}:${contextKey}`;
  }

  private cleanupCache(): void {
    if (this.resolutionCache.size > this.resolutionConfig.maxCacheSize) {
      // Simple LRU cleanup - remove oldest entries
      const entries = Array.from(this.resolutionCache.entries());
      entries.slice(0, this.resolutionConfig.maxCacheSize / 2).forEach(([key]) => {
        this.resolutionCache.delete(key);
      });
    }
  }

  private async loadIdentityGraphs(): Promise<void> {
    // Implementation would load existing identity graphs from storage
    logger.debug('[EntityResolutionManager] Loading identity graphs');
  }

  private async searchEntitiesByName(
    identifier: string,
    context: ResolutionContext
  ): Promise<Entity[]> {
    // Implementation would search entities by name patterns
    const entities: Entity[] = [];

    try {
      // Get entities from room context if available
      if (context.roomId) {
        const roomEntities = await this.runtime.getEntitiesForRoom(context.roomId);
        entities.push(
          ...roomEntities.filter((e) =>
            e.names.some(
              (name) =>
                name.toLowerCase().includes(identifier.toLowerCase()) ||
                identifier.toLowerCase().includes(name.toLowerCase())
            )
          )
        );
      }
    } catch (error) {
      logger.error('[EntityResolutionManager] Error searching entities by name:', error);
    }

    return entities;
  }

  private async searchEntitiesByPlatform(platform: string, identifier: string): Promise<Entity[]> {
    const entities: Entity[] = [];

    try {
      // Search through all entities for matching platform identities
      const allRoomIds = await this.runtime.getRoomsForParticipant(this.runtime.agentId);

      for (const roomId of allRoomIds) {
        const roomEntities = await this.runtime.getEntitiesForRoom(roomId);

        for (const entity of roomEntities) {
          const platformIdentities: { [platform: string]: any } =
            entity.metadata?.platformIdentities || {};

          if (platformIdentities[platform]) {
            const identity = platformIdentities[platform];
            if (
              typeof identity === 'object' &&
              (identity.handle === identifier ||
                identity.userId === identifier ||
                identifier.toLowerCase().includes(identity.handle?.toLowerCase()))
            ) {
              entities.push(entity);
            }
          }
        }
      }
    } catch (error) {
      logger.error('[EntityResolutionManager] Error searching entities by platform:', error);
    }

    return entities;
  }

  private async calculateNameSimilarity(names: string[], identifier: string): Promise<number> {
    try {
      const prompt = `Compare these names and determine similarity to "${identifier}":
Names: ${names.join(', ')}

Consider:
- Exact matches
- Nicknames and variations
- Phonetic similarity
- Common abbreviations

Return a similarity score from 0.0 to 1.0 where:
- 1.0 = identical or clear nickname/variation
- 0.8+ = high similarity (likely same person)
- 0.6+ = moderate similarity
- 0.4+ = some similarity
- <0.4 = low/no similarity

Respond with only the numeric score (e.g., "0.85")`;

      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, { prompt });
      const score = parseFloat(response.trim());
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.error('[EntityResolutionManager] Error calculating name similarity:', error);
      return 0;
    }
  }

  private async analyzeContextualHints(
    entity: Entity,
    identifier: string,
    conversationHistory: Memory[]
  ): Promise<number> {
    try {
      if (!conversationHistory || conversationHistory.length === 0) {
        return 0;
      }

      // Get recent conversation context (last 10 messages)
      const recentMessages = conversationHistory
        .slice(-10)
        .map((m) => `${m.entityId}: ${m.content.text}`)
        .join('\n');

      const prompt = `Analyze this conversation context to determine if "${identifier}" refers to this entity:

Entity: ${entity.names.join(', ')} (${entity.metadata?.type || 'unknown'})
Entity metadata: ${JSON.stringify(entity.metadata || {}, null, 2)}

Recent conversation:
${recentMessages}

Consider:
- Direct references by name
- Pronoun usage that might refer to this entity
- Context clues (roles, relationships, topics)
- Temporal references (recent interactions)

Return a confidence score from 0.0 to 1.0 where:
- 1.0 = very strong contextual evidence
- 0.7+ = good contextual match
- 0.5+ = moderate contextual hints
- 0.3+ = weak contextual hints
- <0.3 = no relevant context

Respond with only the numeric score (e.g., "0.65")`;

      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, { prompt });
      const score = parseFloat(response.trim());
      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      logger.error('[EntityResolutionManager] Error analyzing contextual hints:', error);
      return 0;
    }
  }

  private async findSimilarEntities(entity: Entity): Promise<Entity[]> {
    const similarEntities: Entity[] = [];

    try {
      // Get all entities from all rooms
      const allRoomIds = await this.runtime.getRoomsForParticipant(this.runtime.agentId);
      const allEntities: Entity[] = [];

      for (const roomId of allRoomIds) {
        const roomEntities = await this.runtime.getEntitiesForRoom(roomId);
        allEntities.push(...roomEntities);
      }

      // Find entities with similar names or characteristics
      for (const otherEntity of allEntities) {
        if (otherEntity.id === entity.id) {
          continue;
        } // Skip self

        // Check for name similarities
        const nameSimilarity = await this.calculateNameSimilarity(
          otherEntity.names,
          entity.names.join(' ')
        );
        if (nameSimilarity > 0.6) {
          similarEntities.push(otherEntity);
          continue;
        }

        // Check for platform identity overlaps
        const entityPlatforms: { [platform: string]: any } =
          entity.metadata?.platformIdentities || {};
        const otherPlatforms: { [platform: string]: any } =
          otherEntity.metadata?.platformIdentities || {};

        for (const [platform, identity] of Object.entries(entityPlatforms)) {
          if (
            otherPlatforms[platform] &&
            typeof identity === 'object' &&
            identity !== null &&
            typeof otherPlatforms[platform] === 'object' &&
            otherPlatforms[platform] !== null
          ) {
            const id = identity as PlatformIdentity;
            const otherId = otherPlatforms[platform] as PlatformIdentity;
            if (id.handle === otherId.handle || id.userId === otherId.userId) {
              similarEntities.push(otherEntity);
              break;
            }
          }
        }
      }

      return similarEntities;
    } catch (error) {
      logger.error('[EntityResolutionManager] Error finding similar entities:', error);
      return [];
    }
  }

  private async detectIdentityConflicts(entity: Entity, identifier: string): Promise<string[]> {
    const conflicts: string[] = [];

    try {
      const platformIdentities: { [platform: string]: any } =
        entity.metadata?.platformIdentities || {};

      // Check for internal conflicts within the entity's platform identities
      const platforms = Object.keys(platformIdentities);
      for (let i = 0; i < platforms.length; i++) {
        for (let j = i + 1; j < platforms.length; j++) {
          const platform1 = platforms[i];
          const platform2 = platforms[j];
          const identity1 = platformIdentities[platform1];
          const identity2 = platformIdentities[platform2];

          if (
            typeof identity1 === 'object' &&
            identity1 !== null &&
            typeof identity2 === 'object' &&
            identity2 !== null
          ) {
            const id1 = identity1 as any;
            const id2 = identity2 as any;

            // Check for conflicting verification status
            if (
              id1.verified !== id2.verified &&
              id1.handle?.toLowerCase() === id2.handle?.toLowerCase()
            ) {
              conflicts.push(
                `Verification mismatch between ${platform1} and ${platform2} for handle ${id1.handle}`
              );
            }

            // Check for conflicting confidence scores on same handle
            if (
              id1.handle === id2.handle &&
              Math.abs((id1.confidence || 0) - (id2.confidence || 0)) > 0.3
            ) {
              conflicts.push(
                `Confidence score mismatch for handle ${id1.handle} between ${platform1} and ${platform2}`
              );
            }
          }
        }
      }

      // Check for conflicts with the current identifier being resolved
      for (const [platform, identity] of Object.entries(platformIdentities)) {
        if (typeof identity === 'object' && identity !== null) {
          const id = identity as PlatformIdentity;
          // If the identifier matches a known handle but with different verification
          if (id.handle === identifier && !id.verified) {
            conflicts.push(`Unverified platform identity for ${identifier} on ${platform}`);
          }

          // If the identifier is similar but not exact to known handles
          if (
            id.handle &&
            identifier.toLowerCase().includes(id.handle.toLowerCase()) &&
            identifier.toLowerCase() !== id.handle.toLowerCase()
          ) {
            conflicts.push(
              `Partial match between identifier "${identifier}" and known handle "${id.handle}" on ${platform}`
            );
          }
        }
      }

      return conflicts;
    } catch (error) {
      logger.error('[EntityResolutionManager] Error detecting identity conflicts:', error);
      return [];
    }
  }

  private async detectCrossReferences(entityId: UUID, identityGraph: IdentityGraph): Promise<void> {
    try {
      // Get all other entities to compare against
      const allRoomIds = await this.runtime.getRoomsForParticipant(this.runtime.agentId);
      const allEntities: Entity[] = [];

      for (const roomId of allRoomIds) {
        const roomEntities = await this.runtime.getEntitiesForRoom(roomId);
        allEntities.push(...roomEntities.filter((e) => e.id !== entityId));
      }

      // Analyze cross-references with other entities
      for (const otherEntity of allEntities) {
        const crossRefConfidence = await this.calculateCrossReferenceConfidence(
          entityId,
          identityGraph,
          otherEntity.id as UUID,
          otherEntity
        );

        if (crossRefConfidence > 0.3) {
          // Determine linking factors
          const linkingFactor = await this.determineLinkingFactor(identityGraph, otherEntity);

          // Add cross-reference
          identityGraph.crossReferences.push({
            targetEntityId: otherEntity.id as UUID,
            linkingFactor,
            confidence: crossRefConfidence,
            bidirectional: await this.isBidirectionalReference(entityId, otherEntity.id as UUID),
          });

          logger.debug(
            `[EntityResolutionManager] Added cross-reference: ${entityId} -> ${otherEntity.id} (confidence: ${crossRefConfidence.toFixed(2)})`
          );
        }
      }

      // Update the stored identity graph
      this.identityGraphs.set(entityId, identityGraph);
    } catch (error) {
      logger.error('[EntityResolutionManager] Error detecting cross-references:', error);
    }
  }

  private async calculateCrossReferenceConfidence(
    entityId: UUID,
    identityGraph: IdentityGraph,
    targetEntityId: UUID,
    targetEntity: Entity
  ): Promise<number> {
    try {
      let confidence = 0;
      let factors = 0;

      // Check platform identity overlaps
      const targetPlatforms: { [platform: string]: any } =
        targetEntity.metadata?.platformIdentities || {};
      for (const [platform, identity] of identityGraph.platformIdentities) {
        if (targetPlatforms[platform] && typeof targetPlatforms[platform] === 'object') {
          const targetIdentity = targetPlatforms[platform];
          if (
            identity.handle === targetIdentity.handle ||
            identity.userId === targetIdentity.userId
          ) {
            confidence += 0.8;
            factors++;
          } else if (
            identity.handle &&
            targetIdentity.handle &&
            identity.handle.toLowerCase().includes(targetIdentity.handle.toLowerCase())
          ) {
            confidence += 0.4;
            factors++;
          }
        }
      }

      // Check name similarities
      const currentEntity = await this.runtime.getEntityById(entityId);
      if (currentEntity) {
        const nameSimilarity = await this.calculateNameSimilarity(
          currentEntity.names,
          targetEntity.names.join(' ')
        );
        confidence += nameSimilarity * 0.6;
        factors++;
      }

      return factors > 0 ? confidence / factors : 0;
    } catch (error) {
      logger.error(
        '[EntityResolutionManager] Error calculating cross-reference confidence:',
        error
      );
      return 0;
    }
  }

  private async determineLinkingFactor(
    identityGraph: IdentityGraph,
    targetEntity: Entity
  ): Promise<string> {
    const targetPlatforms: { [platform: string]: any } =
      targetEntity.metadata?.platformIdentities || {};

    // Check for platform matches
    for (const [platform, _identity] of identityGraph.platformIdentities) {
      if (targetPlatforms[platform]) {
        return `shared_platform_${platform}`;
      }
    }

    // Check for name similarity
    const currentEntity = await this.runtime.getEntityById(identityGraph.entityId);
    if (currentEntity) {
      const nameSimilarity = await this.calculateNameSimilarity(
        currentEntity.names,
        targetEntity.names.join(' ')
      );
      if (nameSimilarity > 0.7) {
        return 'name_similarity';
      }
    }

    return 'unknown_factor';
  }

  private async isBidirectionalReference(entityId: UUID, targetEntityId: UUID): Promise<boolean> {
    // Check if the target entity also references back to this entity
    const targetGraph = this.identityGraphs.get(targetEntityId);
    if (targetGraph) {
      return targetGraph.crossReferences.some((ref) => ref.targetEntityId === entityId);
    }
    return false;
  }

  private async buildMergeProposal(
    primaryId: UUID,
    candidateId: UUID,
    confidence: number
  ): Promise<EntityMergeProposal | null> {
    try {
      const primaryEntity = await this.runtime.getEntityById(primaryId);
      const candidateEntity = await this.runtime.getEntityById(candidateId);

      if (!primaryEntity || !candidateEntity) {
        return null;
      }

      // Analyze conflicts between entities
      const conflictResolution = await this.analyzeEntityConflicts(primaryEntity, candidateEntity);

      // Calculate risk assessment
      const riskAssessment = {
        dataLossRisk: conflictResolution.length > 3 ? 0.7 : 0.3,
        trustImpactRisk: 0.2, // Low for now, would integrate with trust service
        relationshipImpactRisk: 0.4, // Medium impact on relationships
        overallRisk: 0,
      };
      riskAssessment.overallRisk =
        (riskAssessment.dataLossRisk +
          riskAssessment.trustImpactRisk +
          riskAssessment.relationshipImpactRisk) /
        3;

      const proposal: EntityMergeProposal = {
        primaryEntityId: primaryId,
        candidateEntityIds: [candidateId],
        confidence,
        mergeStrategy: confidence > 0.9 ? 'absorb' : 'merge',
        conflictResolution,
        preservedData: [],
        riskAssessment,
      };

      return proposal;
    } catch (error) {
      logger.error('[EntityResolutionManager] Error building merge proposal:', error);
      return null;
    }
  }

  private async analyzeEntityConflicts(
    primaryEntity: Entity,
    candidateEntity: Entity
  ): Promise<
    Array<{
      field: string;
      primaryValue: any;
      candidateValues: any[];
      resolution: 'keep_primary' | 'merge_all' | 'manual_review';
      confidence: number;
    }>
  > {
    const conflicts: Array<{
      field: string;
      primaryValue: any;
      candidateValues: any[];
      resolution: 'keep_primary' | 'merge_all' | 'manual_review';
      confidence: number;
    }> = [];

    // Check name conflicts
    const uniqueCandidateNames = candidateEntity.names.filter(
      (name) => !primaryEntity.names.includes(name)
    );
    if (uniqueCandidateNames.length > 0) {
      conflicts.push({
        field: 'names',
        primaryValue: primaryEntity.names,
        candidateValues: [uniqueCandidateNames],
        resolution: 'merge_all' as const,
        confidence: 0.9,
      });
    }

    // Check metadata conflicts
    const primaryMeta = primaryEntity.metadata || {};
    const candidateMeta = candidateEntity.metadata || {};

    for (const [key, value] of Object.entries(candidateMeta)) {
      if (primaryMeta[key] && primaryMeta[key] !== value) {
        conflicts.push({
          field: `metadata.${key}`,
          primaryValue: primaryMeta[key],
          candidateValues: [value],
          resolution: 'manual_review' as const,
          confidence: 0.5,
        });
      }
    }

    return conflicts;
  }

  private async mergeIdentityGraphs(primaryId: UUID, candidateIds: UUID[]): Promise<void> {
    try {
      const primaryGraph = this.identityGraphs.get(primaryId);
      if (!primaryGraph) {
        logger.warn(
          `[EntityResolutionManager] No identity graph found for primary entity ${primaryId}`
        );
        return;
      }

      // Merge platform identities from candidate graphs
      for (const candidateId of candidateIds) {
        const candidateGraph = this.identityGraphs.get(candidateId);
        if (!candidateGraph) {
          continue;
        }

        // Merge platform identities
        for (const [platform, identity] of candidateGraph.platformIdentities) {
          if (!primaryGraph.platformIdentities.has(platform)) {
            primaryGraph.platformIdentities.set(platform, identity);
          } else {
            // If platform exists, merge with higher confidence
            const existingIdentity = primaryGraph.platformIdentities.get(platform)!;
            if (identity.confidence > existingIdentity.confidence) {
              primaryGraph.platformIdentities.set(platform, {
                ...existingIdentity,
                ...identity,
                confidence: Math.max(existingIdentity.confidence, identity.confidence),
              });
            }
          }
        }

        // Merge cross-references
        for (const crossRef of candidateGraph.crossReferences) {
          // Update target entities to point to primary instead of candidate
          if (
            !primaryGraph.crossReferences.some(
              (ref) => ref.targetEntityId === crossRef.targetEntityId
            )
          ) {
            primaryGraph.crossReferences.push(crossRef);
          }
        }

        // Merge trust network
        for (const trustRef of candidateGraph.trustNetwork) {
          if (
            !primaryGraph.trustNetwork.some((ref) => ref.targetEntityId === trustRef.targetEntityId)
          ) {
            primaryGraph.trustNetwork.push(trustRef);
          }
        }

        // Merge behavior fingerprint
        primaryGraph.behaviorFingerprint.communicationStyle.push(
          ...candidateGraph.behaviorFingerprint.communicationStyle
        );
        primaryGraph.behaviorFingerprint.activityPatterns.push(
          ...candidateGraph.behaviorFingerprint.activityPatterns
        );
        primaryGraph.behaviorFingerprint.responseTimeProfile.push(
          ...candidateGraph.behaviorFingerprint.responseTimeProfile
        );
        primaryGraph.behaviorFingerprint.sentimentProfile.push(
          ...candidateGraph.behaviorFingerprint.sentimentProfile
        );
        primaryGraph.behaviorFingerprint.topicAffinities.push(
          ...candidateGraph.behaviorFingerprint.topicAffinities
        );
      }

      // Remove duplicates and clean up behavior fingerprint
      primaryGraph.behaviorFingerprint.communicationStyle = [
        ...new Set(primaryGraph.behaviorFingerprint.communicationStyle),
      ];
      primaryGraph.behaviorFingerprint.activityPatterns = [
        ...new Set(primaryGraph.behaviorFingerprint.activityPatterns),
      ];
      primaryGraph.behaviorFingerprint.topicAffinities = [
        ...new Set(primaryGraph.behaviorFingerprint.topicAffinities),
      ];

      // Update the primary graph
      this.identityGraphs.set(primaryId, primaryGraph);
    } catch (error) {
      logger.error('[EntityResolutionManager] Error merging identity graphs:', error);
    }
  }

  private async redirectRelationships(candidateIds: UUID[], primaryId: UUID): Promise<void> {
    try {
      // This would integrate with the relationship service to redirect relationships
      // For now, we'll log the intention since we don't have direct access to relationships
      logger.info(
        `[EntityResolutionManager] Would redirect relationships from entities ${candidateIds.join(', ')} to ${primaryId}`
      );

      // In a full implementation, this would:
      // 1. Get all relationships involving the candidate entities
      // 2. Update them to point to the primary entity instead
      // 3. Merge any duplicate relationships that result
      // 4. Update trust scores and other relationship metadata
    } catch (error) {
      logger.error('[EntityResolutionManager] Error redirecting relationships:', error);
    }
  }
}
