/**
 * RelationshipOntologyService - Core service for multi-dimensional relationship management
 *
 * This service replaces the single-type RelationshipService with a comprehensive
 * multi-dimensional relationship system that tracks multiple concurrent relationship
 * types between entities.
 */

import {
  logger,
  IAgentRuntime,
  Memory,
  UUID,
  asUUID,
  stringToUuid as _stringToUuid,
  ModelType,
  Relationship,
} from '@elizaos/core';

import {
  RelationshipMatrix,
  RelationshipDimension,
  RelationshipEvidence,
  RelationshipMetadata,
  RelationshipCategory,
  EvidenceType,
  DEFAULT_ANALYSIS_CONFIG,
  RelationshipAnalysisConfig,
  matchRelationshipPattern,
  RELATIONSHIP_TYPES,
  CompositeRelationship,
} from '../ontology/relationship-types';

import {
  calculateDimensionStrength as _calculateDimensionStrength,
  calculateStrengthFactors,
  extractRelationshipEvidence,
  updateDimension,
  createRelationshipMatrix,
  calculateCompositeRelationship,
  determineTrajectory,
} from '../ontology/dimension-calculator';

import { EventBridge, RolodexEventType } from '../managers/EventBridge';

/**
 * Service for managing multi-dimensional relationships
 */
export class RelationshipOntologyManager {
  private runtime: IAgentRuntime;
  private _eventBridge: EventBridge;
  private _config: RelationshipAnalysisConfig;
  private _matrixCache: Map<string, RelationshipMatrix> = new Map();
  private _dimensionHistory: Map<string, number[]> = new Map();

  constructor(
    runtime: IAgentRuntime,
    eventBridge: EventBridge,
    config?: Partial<RelationshipAnalysisConfig>
  ) {
    this.runtime = runtime;
    this._eventBridge = eventBridge;
    this._config = { ...DEFAULT_ANALYSIS_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    logger.info('[RelationshipOntologyManager] Initializing...');

    // Load existing relationships into cache
    await this.loadRelationships();

    logger.info('[RelationshipOntologyManager] Initialized successfully');
  }

  async stop(): Promise<void> {
    logger.info('[RelationshipOntologyManager] Stopping...');

    // Save any pending changes
    await this.persistCache();

    this._matrixCache.clear();
    this._dimensionHistory.clear();

    logger.info('[RelationshipOntologyManager] Stopped');
  }

  /**
   * Convert a RelationshipMatrix to a simple Relationship for backward compatibility
   */
  matrixToRelationship(matrix: RelationshipMatrix): Relationship {
    return this.matrixToLegacyRelationship(matrix) as Relationship;
  }

  /**
   * Analyze an interaction and update relationship matrix
   */
  async analyzeInteraction(
    sourceEntityId: UUID,
    targetEntityId: UUID,
    interaction: string,
    context?: {
      roomId?: UUID;
      messageId?: UUID;
      timestamp?: Date;
    }
  ): Promise<RelationshipMatrix> {
    logger.info('[RelationshipOntologyService] Analyzing interaction', {
      source: sourceEntityId,
      target: targetEntityId,
      interactionLength: interaction.length,
    });

    try {
      // Get or create relationship matrix
      const matrix = await this.getRelationshipMatrix(sourceEntityId, targetEntityId);

      // Extract patterns from interaction
      const patterns = matchRelationshipPattern(interaction);

      // Get recent messages for context
      const messages = await this.getRecentMessages(sourceEntityId, targetEntityId);
      messages.push({
        id: context?.messageId,
        entityId: sourceEntityId,
        agentId: this.runtime.agentId,
        roomId: context?.roomId || this.runtime.agentId, // Use agent ID as default room
        content: { text: interaction },
        createdAt: context?.timestamp?.getTime() || Date.now(),
      });

      // Extract evidence
      const evidence = await extractRelationshipEvidence(
        this.runtime,
        sourceEntityId,
        targetEntityId,
        messages
      );

      // Calculate strength factors
      const factors = calculateStrengthFactors(messages, matrix?.metadata);

      // Update or create dimensions based on patterns
      const updatedDimensions: RelationshipDimension[] = [];

      for (const pattern of patterns) {
        // Find existing dimension or create new one
        let dimension = matrix?.dimensions.find(
          (d) => d.category === pattern.category && d.type === pattern.type
        );

        if (!dimension) {
          // Create new dimension
          dimension = {
            category: pattern.category,
            type: pattern.type,
            strength: 0,
            confidence: pattern.confidence,
            evidence: [],
            firstDetected: new Date(),
            lastUpdated: new Date(),
            trajectory: 'stable',
          };
        }

        // Add pattern-specific evidence
        const patternEvidence: RelationshipEvidence = {
          type: EvidenceType.DIRECT_STATEMENT,
          content: interaction.substring(0, 200),
          weight: pattern.confidence,
          source: {
            type: 'message',
            id: context?.messageId || asUUID(`msg-${Date.now()}`),
            timestamp: context?.timestamp || new Date(),
            confidence: pattern.confidence,
          },
          timestamp: context?.timestamp || new Date(),
        };

        // Update dimension
        const updatedDimension = updateDimension(
          dimension,
          [
            patternEvidence,
            ...evidence.filter((e) => this.isRelevantEvidence(e, pattern.category)),
          ],
          factors,
          this._config
        );

        // Update trajectory
        const historyKey = `${sourceEntityId}-${targetEntityId}-${pattern.category}-${pattern.type}`;
        const history = this._dimensionHistory.get(historyKey) || [];
        history.push(updatedDimension.strength);
        if (history.length > 20) {
          history.shift();
        } // Keep last 20 data points
        this._dimensionHistory.set(historyKey, history);

        updatedDimension.trajectory = determineTrajectory(updatedDimension, history);

        updatedDimensions.push(updatedDimension);
      }

      // Preserve existing dimensions not in current patterns
      if (matrix) {
        for (const existingDim of matrix.dimensions) {
          if (
            !updatedDimensions.find(
              (d) => d.category === existingDim.category && d.type === existingDim.type
            )
          ) {
            // Decay existing dimension slightly
            const decayedDimension = {
              ...existingDim,
              strength: existingDim.strength * 0.95, // 5% decay
              lastUpdated: new Date(),
            };

            // Remove if below threshold
            if (decayedDimension.strength >= this._config.dimensionThreshold) {
              updatedDimensions.push(decayedDimension);
            }
          }
        }
      }

      // Update metadata
      const metadata: RelationshipMetadata = {
        totalInteractions: (matrix?.metadata.totalInteractions || 0) + 1,
        lastInteractionAt: new Date(),
        establishedAt: matrix?.metadata.establishedAt || new Date(),
        peakStrength: 0,
        peakStrengthAt: new Date(),
        volatility: 0,
        healthScore: 0,
      };

      // Calculate composite metrics
      const composite = calculateCompositeRelationship(updatedDimensions, metadata);

      // Update peak strength
      if (composite.overallStrength > (matrix?.metadata.peakStrength || 0)) {
        metadata.peakStrength = composite.overallStrength;
        metadata.peakStrengthAt = new Date();
      }

      // Calculate volatility
      const allHistories = updatedDimensions
        .map((d) => {
          const key = `${sourceEntityId}-${targetEntityId}-${d.category}-${d.type}`;
          return this._dimensionHistory.get(key) || [];
        })
        .flat();

      if (allHistories.length > 2) {
        const avg = allHistories.reduce((sum, s) => sum + s, 0) / allHistories.length;
        const variance =
          allHistories.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / allHistories.length;
        metadata.volatility = Math.sqrt(variance);
      }

      // Calculate health score (combination of strength, consistency, and trajectory)
      metadata.healthScore = this.calculateHealthScore(composite, metadata);

      // Create updated matrix
      const updatedMatrix = createRelationshipMatrix(
        sourceEntityId,
        targetEntityId,
        updatedDimensions,
        metadata
      );

      // Update composite with LLM-generated narrative if enabled
      if (this._config.enableInference) {
        updatedMatrix.composite.narrativeSummary = await this.generateNarrative(
          updatedMatrix,
          interaction
        );
      }

      // Cache and persist
      const cacheKey = this.getCacheKey(sourceEntityId, targetEntityId);
      this._matrixCache.set(cacheKey, updatedMatrix);
      await this.persistMatrix(updatedMatrix);

      // Emit event
      if (this._eventBridge) {
        this._eventBridge.emit({
          type: RolodexEventType.RELATIONSHIP_UPDATED,
          timestamp: Date.now(),
          relationshipId: updatedMatrix.id,
          sourceEntityId,
          targetEntityId,
          relationship: this.matrixToLegacyRelationship(updatedMatrix),
          previousStrength: matrix?.composite.overallStrength,
          currentStrength: updatedMatrix.composite.overallStrength,
          metadata: {
            dimensions: updatedMatrix.dimensions.length,
            primaryType: updatedMatrix.composite.primaryDimension?.type,
            complexity: updatedMatrix.composite.complexity,
          },
        });
      }

      return updatedMatrix;
    } catch (error) {
      logger.error('[RelationshipOntologyService] Error analyzing interaction', error);
      throw error;
    }
  }

  /**
   * Get relationship matrix between two entities
   */
  async getRelationshipMatrix(
    sourceEntityId: UUID,
    targetEntityId: UUID
  ): Promise<RelationshipMatrix | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(sourceEntityId, targetEntityId);
    const cached = this._matrixCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to load from storage
    try {
      const relationships = await this.runtime.getRelationships({
        entityId: sourceEntityId,
      });

      const relationship = relationships.find(
        (r) =>
          (r.sourceEntityId === sourceEntityId && r.targetEntityId === targetEntityId) ||
          (r.sourceEntityId === targetEntityId && r.targetEntityId === sourceEntityId)
      );

      if (relationship && relationship.metadata?.matrixData) {
        const matrix = this.deserializeMatrix(relationship.metadata.matrixData);
        this._matrixCache.set(cacheKey, matrix);
        return matrix;
      }
    } catch (error) {
      logger.warn('[RelationshipOntologyService] Error loading relationship', error);
    }

    return null;
  }

  /**
   * Get all relationship matrices for an entity
   */
  async getEntityRelationships(entityId: UUID): Promise<RelationshipMatrix[]> {
    const matrices: RelationshipMatrix[] = [];

    try {
      const relationships = await this.runtime.getRelationships({
        entityId,
      });

      for (const rel of relationships) {
        if (rel.metadata?.matrixData) {
          const matrix = this.deserializeMatrix(rel.metadata.matrixData);
          matrices.push(matrix);

          // Update cache
          const cacheKey = this.getCacheKey(matrix.sourceEntityId, matrix.targetEntityId);
          this._matrixCache.set(cacheKey, matrix);
        }
      }
    } catch (error) {
      logger.error('[RelationshipOntologyService] Error getting entity relationships', error);
    }

    return matrices;
  }

  /**
   * Filter relationships by dimension criteria
   */
  async filterRelationships(criteria: {
    entityId?: UUID;
    category?: RelationshipCategory;
    type?: string;
    minStrength?: number;
    maxComplexity?: number;
    primaryOnly?: boolean;
  }): Promise<RelationshipMatrix[]> {
    let matrices: RelationshipMatrix[] = [];

    if (criteria.entityId) {
      matrices = await this.getEntityRelationships(criteria.entityId);
    } else {
      // Get all from cache
      matrices = Array.from(this._matrixCache.values());
    }

    return matrices.filter((matrix) => {
      // Category filter
      if (criteria.category) {
        const hasCategory = matrix.dimensions.some((d) => d.category === criteria.category);
        if (!hasCategory) {
          return false;
        }
      }

      // Type filter
      if (criteria.type) {
        const hasType = matrix.dimensions.some((d) => d.type === criteria.type);
        if (!hasType) {
          return false;
        }
      }

      // Strength filter
      if (criteria.minStrength !== undefined) {
        if (criteria.primaryOnly && matrix.composite.primaryDimension) {
          if (matrix.composite.primaryDimension.strength < criteria.minStrength) {
            return false;
          }
        } else {
          if (matrix.composite.overallStrength < criteria.minStrength) {
            return false;
          }
        }
      }

      // Complexity filter
      if (criteria.maxComplexity !== undefined) {
        if (matrix.composite.complexity > criteria.maxComplexity) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Generate natural language narrative using LLM
   */
  private async generateNarrative(
    matrix: RelationshipMatrix,
    recentInteraction?: string
  ): Promise<string> {
    try {
      const source = await this.runtime.getEntityById(matrix.sourceEntityId);
      const target = await this.runtime.getEntityById(matrix.targetEntityId);

      const prompt = `Given the following multi-dimensional relationship data, provide a natural language summary of how the agent views this relationship. Focus on the narrative perspective, not the raw data.

Source Entity: ${source?.names[0] || 'Unknown'}
Target Entity: ${target?.names[0] || 'Unknown'}

Relationship Dimensions:
${matrix.dimensions
  .map((d) => {
    const typeInfo = this.getTypeInfo(d.category, d.type);
    return `- ${typeInfo?.label || d.type}: ${Math.round(d.strength * 100)}% strength (${d.trajectory})`;
  })
  .join('\n')}

Overall Strength: ${Math.round(matrix.composite.overallStrength * 100)}%
Complexity: ${matrix.composite.complexity > 0.6 ? 'High' : matrix.composite.complexity > 0.3 ? 'Medium' : 'Low'}
Trajectory: ${matrix.composite.trajectory}
Total Interactions: ${matrix.metadata.totalInteractions}
${recentInteraction ? `\nMost Recent Interaction: "${recentInteraction.substring(0, 100)}..."` : ''}

Provide a 1-2 sentence narrative summary from the agent's perspective. Be natural and conversational, mentioning specific relationship types and any complexity or changes over time.`;

      const response = await this.runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        temperature: 0.7,
        maxTokens: 150,
      });

      return response.trim();
    } catch (error) {
      logger.warn('[RelationshipOntologyService] Error generating narrative', error);
      // Fall back to default narrative
      return matrix.composite.narrativeSummary || 'Our relationship is evolving.';
    }
  }

  /**
   * Helper methods
   */

  private getCacheKey(sourceId: UUID, targetId: UUID): string {
    // Normalize order for bidirectional lookup
    return [sourceId, targetId].sort().join('-');
  }

  private isRelevantEvidence(
    evidence: RelationshipEvidence,
    category: RelationshipCategory
  ): boolean {
    // Filter evidence based on category relevance
    const categoryKeywords: Record<RelationshipCategory, string[]> = {
      [RelationshipCategory.PROFESSIONAL]: ['work', 'project', 'meeting', 'colleague', 'business'],
      [RelationshipCategory.PERSONAL]: ['friend', 'family', 'personal', 'care', 'love'],
      [RelationshipCategory.SOCIAL]: ['community', 'group', 'event', 'social', 'follow'],
      [RelationshipCategory.ADVERSARIAL]: ['disagree', 'conflict', 'dispute', 'against', 'oppose'],
      [RelationshipCategory.TRANSACTIONAL]: ['buy', 'sell', 'purchase', 'transaction', 'deal'],
      [RelationshipCategory.EDUCATIONAL]: ['learn', 'teach', 'study', 'education', 'mentor'],
      [RelationshipCategory.CREATIVE]: ['create', 'collaborate', 'art', 'music', 'write'],
      [RelationshipCategory.COMMUNITY]: ['volunteer', 'organize', 'support', 'cause', 'help'],
    };

    const keywords = categoryKeywords[category] || [];
    const content = evidence.content.toLowerCase();

    return keywords.some((keyword) => content.includes(keyword));
  }

  private calculateHealthScore(
    composite: CompositeRelationship,
    metadata: RelationshipMetadata
  ): number {
    let score = 0;

    // Strength component (40%)
    score += composite.overallStrength * 0.4;

    // Stability component (30%)
    const stability = 1 - Math.min(1, metadata.volatility);
    score += stability * 0.3;

    // Trajectory component (20%)
    if (composite.trajectory === 'improving') {
      score += 0.2;
    } else if (composite.trajectory === 'stable') {
      score += 0.15;
    } else if (composite.trajectory === 'declining') {
      score += 0.05;
    } else {
      score += 0.1;
    } // turbulent

    // Recency component (10%)
    const daysSinceInteraction = metadata.lastInteractionAt
      ? (Date.now() - metadata.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    const recencyScore = Math.max(0, 1 - daysSinceInteraction / 30);
    score += recencyScore * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private getTypeInfo(category: RelationshipCategory, type: string) {
    const categoryTypes = RELATIONSHIP_TYPES[category];
    if (!categoryTypes) {
      return null;
    }

    for (const typeInfo of Object.values(categoryTypes)) {
      if (typeInfo.id === type) {
        return typeInfo;
      }
    }

    return null;
  }

  private async getRecentMessages(
    sourceEntityId: UUID,
    targetEntityId: UUID,
    limit: number = 20
  ): Promise<Memory[]> {
    try {
      // Get messages where either entity is involved
      const memories = await this.runtime.getMemories({
        tableName: 'messages',
        roomId: this.runtime.agentId, // Use agent ID as default room instead of hardcoded value
        count: limit * 2,
        unique: false,
      });

      // Filter for messages between these entities
      return memories
        .filter(
          (m) => (m.entityId === sourceEntityId || m.entityId === targetEntityId) && m.content?.text
        )
        .slice(0, limit);
    } catch (error) {
      logger.warn('[RelationshipOntologyService] Error getting recent messages', error);
      return [];
    }
  }

  private async loadRelationships(): Promise<void> {
    try {
      // This would load all relationships with matrix data
      // For now, we'll start with an empty cache
      logger.info('[RelationshipOntologyService] Loaded 0 relationships into cache');
    } catch (error) {
      logger.error('[RelationshipOntologyService] Error loading relationships', error);
    }
  }

  private async persistCache(): Promise<void> {
    for (const matrix of this._matrixCache.values()) {
      await this.persistMatrix(matrix);
    }
  }

  private async persistMatrix(matrix: RelationshipMatrix): Promise<void> {
    try {
      // Convert to legacy format for storage
      const relationship = this.matrixToLegacyRelationship(matrix);

      // Store matrix data in metadata
      relationship.metadata = {
        ...relationship.metadata,
        matrixData: this.serializeMatrix(matrix),
      };

      // Use runtime to persist
      await this.runtime.createRelationship(relationship);
    } catch (error) {
      logger.error('[RelationshipOntologyService] Error persisting matrix', error);
    }
  }

  private serializeMatrix(matrix: RelationshipMatrix): any {
    return {
      id: matrix.id,
      sourceEntityId: matrix.sourceEntityId,
      targetEntityId: matrix.targetEntityId,
      dimensions: matrix.dimensions.map((d) => ({
        ...d,
        evidence: d.evidence.slice(0, 10), // Limit stored evidence
      })),
      composite: matrix.composite,
      metadata: matrix.metadata,
      createdAt: matrix.createdAt,
      updatedAt: matrix.updatedAt,
    };
  }

  private deserializeMatrix(data: any): RelationshipMatrix {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      metadata: {
        ...data.metadata,
        lastInteractionAt: new Date(data.metadata.lastInteractionAt),
        establishedAt: new Date(data.metadata.establishedAt),
        peakStrengthAt: new Date(data.metadata.peakStrengthAt),
      },
      dimensions: data.dimensions.map((d: any) => ({
        ...d,
        firstDetected: new Date(d.firstDetected),
        lastUpdated: new Date(d.lastUpdated),
        evidence: d.evidence.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
          source: {
            ...e.source,
            timestamp: new Date(e.source.timestamp),
          },
        })),
      })),
    };
  }

  private matrixToLegacyRelationship(matrix: RelationshipMatrix): any {
    const primary = matrix.composite.primaryDimension;

    return {
      id: matrix.id,
      sourceEntityId: matrix.sourceEntityId,
      targetEntityId: matrix.targetEntityId,
      agentId: this.runtime.agentId,
      relationshipType: primary?.type || 'unknown',
      strength: matrix.composite.overallStrength,
      tags: ['rolodex', 'multi-dimensional', ...matrix.dimensions.map((d) => d.type)],
      metadata: {
        dimensions: matrix.dimensions.length,
        primaryCategory: primary?.category,
        complexity: matrix.composite.complexity,
        trajectory: matrix.composite.trajectory,
        healthScore: matrix.metadata.healthScore,
        lastInteractionAt: matrix.metadata.lastInteractionAt?.toISOString(),
      },
    };
  }
}
