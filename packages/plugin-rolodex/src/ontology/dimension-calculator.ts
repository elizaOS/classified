/**
 * Multi-dimensional relationship strength calculator
 *
 * This module handles the computation of relationship strengths across
 * multiple dimensions based on evidence, interactions, and patterns.
 */

import { logger as _logger, IAgentRuntime, Memory, asUUID } from '@elizaos/core';
import {
  RelationshipDimension,
  RelationshipEvidence,
  EvidenceType,
  StrengthFactors,
  RelationshipMatrix,
  CompositeRelationship,
  RelationshipMetadata,
  RelationshipCategory,
  RELATIONSHIP_TYPES,
  matchRelationshipPattern,
  DEFAULT_ANALYSIS_CONFIG,
  RelationshipAnalysisConfig,
} from './relationship-types';

/**
 * Calculate strength for a single relationship dimension
 */
export function calculateDimensionStrength(
  dimension: RelationshipDimension,
  factors: StrengthFactors,
  config: RelationshipAnalysisConfig = DEFAULT_ANALYSIS_CONFIG
): number {
  // Base strength from evidence
  let evidenceStrength = 0;
  const now = Date.now();

  for (const evidence of dimension.evidence) {
    // Apply time decay
    const ageInDays = (now - evidence.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp((-config.evidenceDecayRate * ageInDays) / 30); // Monthly decay

    // Weight by evidence type
    const typeWeight = getEvidenceTypeWeight(evidence.type);

    evidenceStrength += evidence.weight * typeWeight * decayFactor;
  }

  // Normalize evidence strength (cap at 1.0)
  evidenceStrength = Math.min(1.0, evidenceStrength / Math.max(1, dimension.evidence.length));

  // Factor-based adjustments
  const factorMultiplier = calculateFactorMultiplier(factors, dimension.category);

  // Confidence adjustment
  const confidenceAdjustment = dimension.confidence;

  // Calculate final strength
  const strength = evidenceStrength * factorMultiplier * confidenceAdjustment;

  return Math.max(0, Math.min(1, strength));
}

/**
 * Get weight multiplier for evidence types
 */
function getEvidenceTypeWeight(type: EvidenceType): number {
  const weights: Record<EvidenceType, number> = {
    [EvidenceType.DIRECT_STATEMENT]: 1.0, // Highest weight - explicit declaration
    [EvidenceType.BEHAVIORAL_INDICATOR]: 0.8, // Strong behavioral evidence
    [EvidenceType.INTERACTION_PATTERN]: 0.7, // Consistent patterns
    [EvidenceType.CONTEXTUAL_CLUE]: 0.6, // Context suggests relationship
    [EvidenceType.THIRD_PARTY]: 0.5, // Someone else mentioned it
    [EvidenceType.HISTORICAL]: 0.4, // Past evidence
    [EvidenceType.INFERRED]: 0.3, // System inference
  };

  return weights[type] || 0.5;
}

/**
 * Calculate factor multiplier based on relationship category
 */
function calculateFactorMultiplier(
  factors: StrengthFactors,
  category: RelationshipCategory
): number {
  // Different categories weight factors differently
  const categoryWeights: Record<RelationshipCategory, Partial<StrengthFactors>> = {
    [RelationshipCategory.PROFESSIONAL]: {
      interactionFrequency: 0.3,
      interactionQuality: 0.3,
      consistency: 0.2,
      contextAlignment: 0.2,
    },
    [RelationshipCategory.PERSONAL]: {
      interactionQuality: 0.3,
      reciprocity: 0.2,
      duration: 0.2,
      sentiment: 0.3,
    },
    [RelationshipCategory.SOCIAL]: {
      interactionFrequency: 0.4,
      recentActivity: 0.3,
      contextAlignment: 0.3,
    },
    [RelationshipCategory.ADVERSARIAL]: {
      sentiment: -0.5, // Negative weight
      consistency: 0.3,
      duration: 0.2,
    },
    [RelationshipCategory.TRANSACTIONAL]: {
      interactionFrequency: 0.3,
      interactionQuality: 0.4,
      consistency: 0.3,
    },
    [RelationshipCategory.EDUCATIONAL]: {
      interactionQuality: 0.4,
      duration: 0.3,
      reciprocity: 0.3,
    },
    [RelationshipCategory.CREATIVE]: {
      interactionQuality: 0.4,
      reciprocity: 0.3,
      sentiment: 0.3,
    },
    [RelationshipCategory.COMMUNITY]: {
      contextAlignment: 0.4,
      consistency: 0.3,
      sentiment: 0.3,
    },
  };

  const weights = categoryWeights[category] || {};
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [factor, value] of Object.entries(factors)) {
    const weight = (weights as any)[factor] || 0.1;
    totalWeight += Math.abs(weight);
    weightedSum += value * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Analyze interactions to extract evidence
 */
export async function extractRelationshipEvidence(
  runtime: IAgentRuntime,
  sourceEntityId: string,
  targetEntityId: string,
  messages: Memory[]
): Promise<RelationshipEvidence[]> {
  const evidence: RelationshipEvidence[] = [];

  for (const message of messages) {
    const text = message.content?.text || '';

    // Direct statements about relationships
    const patterns = matchRelationshipPattern(text);
    for (const pattern of patterns) {
      evidence.push({
        type: EvidenceType.DIRECT_STATEMENT,
        content: text.substring(0, 200),
        weight: pattern.confidence,
        source: {
          type: 'message',
          id: message.id || asUUID(`msg-${Date.now()}`),
          timestamp: new Date(message.createdAt || Date.now()),
          confidence: pattern.confidence,
        },
        timestamp: new Date(message.createdAt || Date.now()),
      });
    }

    // Behavioral indicators from interaction patterns
    if (text.includes('thank') || text.includes('appreciate') || text.includes('help')) {
      evidence.push({
        type: EvidenceType.BEHAVIORAL_INDICATOR,
        content: 'Positive interaction pattern',
        weight: 0.6,
        source: {
          type: 'message',
          id: message.id || asUUID(`msg-${Date.now()}`),
          timestamp: new Date(message.createdAt || Date.now()),
          confidence: 0.7,
        },
        timestamp: new Date(message.createdAt || Date.now()),
      });
    }

    // Contextual clues
    if (text.includes('work') || text.includes('project') || text.includes('meeting')) {
      evidence.push({
        type: EvidenceType.CONTEXTUAL_CLUE,
        content: 'Professional context detected',
        weight: 0.5,
        source: {
          type: 'message',
          id: message.id || asUUID(`msg-${Date.now()}`),
          timestamp: new Date(message.createdAt || Date.now()),
          confidence: 0.6,
        },
        timestamp: new Date(message.createdAt || Date.now()),
      });
    }
  }

  // Add interaction pattern evidence
  if (messages.length > 5) {
    evidence.push({
      type: EvidenceType.INTERACTION_PATTERN,
      content: `Frequent interactions (${messages.length} messages)`,
      weight: Math.min(1.0, messages.length / 20), // Cap at 20 messages
      source: {
        type: 'system',
        id: asUUID(`sys-${Date.now()}`),
        timestamp: new Date(),
        confidence: 0.8,
      },
      timestamp: new Date(),
    });
  }

  return evidence;
}

/**
 * Calculate strength factors from interactions
 */
export function calculateStrengthFactors(
  messages: Memory[],
  _relationshipMetadata?: RelationshipMetadata
): StrengthFactors {
  const now = Date.now();
  const sortedMessages = [...messages].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  // Interaction frequency (messages per day over relationship duration)
  const firstMessage = sortedMessages[0];
  const lastMessage = sortedMessages[sortedMessages.length - 1];
  const durationDays =
    firstMessage && lastMessage
      ? Math.max(1, (lastMessage.createdAt! - firstMessage.createdAt!) / (1000 * 60 * 60 * 24))
      : 1;
  const frequency = Math.min(1.0, messages.length / (durationDays * 2)); // Normalize to 2 messages/day max

  // Interaction quality (based on message length and content)
  const avgMessageLength =
    messages.reduce((sum, m) => sum + (m.content?.text?.length || 0), 0) /
    Math.max(1, messages.length);
  const quality = Math.min(1.0, avgMessageLength / 200); // Normalize to 200 chars

  // Reciprocity (how balanced the conversation is)
  // This would need entity IDs on messages to calculate properly
  const reciprocity = 0.7; // Default to fairly balanced

  // Consistency (regularity of interactions)
  const gaps: number[] = [];
  for (let i = 1; i < sortedMessages.length; i++) {
    const gap = (sortedMessages[i].createdAt || 0) - (sortedMessages[i - 1].createdAt || 0);
    gaps.push(gap);
  }
  const avgGap = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
  const consistency =
    avgGap > 0
      ? Math.max(
          0,
          1.0 -
            Math.sqrt(gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length) /
              avgGap
        )
      : 0.5;

  // Duration (how long the relationship has existed)
  const relationshipAgeDays = firstMessage
    ? (now - firstMessage.createdAt!) / (1000 * 60 * 60 * 24)
    : 0;
  const duration = Math.min(1.0, relationshipAgeDays / 365); // Normalize to 1 year

  // Recent activity (weight recent interactions higher)
  const recentMessages = messages.filter(
    (m) => now - (m.createdAt || 0) < 30 * 24 * 60 * 60 * 1000 // Last 30 days
  );
  const recentActivity = Math.min(1.0, recentMessages.length / 10); // Normalize to 10 recent messages

  // Sentiment analysis (simple positive/negative word detection)
  let positiveCount = 0;
  let negativeCount = 0;
  const positiveWords = ['thanks', 'great', 'good', 'appreciate', 'love', 'excellent', 'wonderful'];
  const negativeWords = ['sorry', 'bad', 'wrong', 'hate', 'terrible', 'awful', 'disappointed'];

  for (const message of messages) {
    const text = (message.content?.text || '').toLowerCase();
    positiveCount += positiveWords.filter((word) => text.includes(word)).length;
    negativeCount += negativeWords.filter((word) => text.includes(word)).length;
  }

  const sentiment =
    messages.length > 0
      ? Math.max(-1, Math.min(1, (positiveCount - negativeCount) / messages.length))
      : 0;

  // Context alignment (professional vs personal contexts)
  const professionalWords = ['work', 'project', 'meeting', 'deadline', 'business'];
  const personalWords = ['friend', 'family', 'weekend', 'fun', 'personal'];
  let professionalCount = 0;
  let personalCount = 0;

  for (const message of messages) {
    const text = (message.content?.text || '').toLowerCase();
    professionalCount += professionalWords.filter((word) => text.includes(word)).length;
    personalCount += personalWords.filter((word) => text.includes(word)).length;
  }

  const totalContextWords = professionalCount + personalCount;
  const contextAlignment =
    totalContextWords > 0 ? Math.abs(professionalCount - personalCount) / totalContextWords : 0.5;

  return {
    interactionFrequency: frequency,
    interactionQuality: quality,
    reciprocity,
    consistency,
    duration,
    recentActivity,
    sentiment: (sentiment + 1) / 2, // Normalize to 0-1
    contextAlignment: 1 - contextAlignment, // Invert so mixed context = higher score
  };
}

/**
 * Determine relationship trajectory based on historical data
 */
export function determineTrajectory(
  dimension: RelationshipDimension,
  historicalStrengths: number[]
): 'strengthening' | 'weakening' | 'stable' | 'volatile' {
  if (historicalStrengths.length < 2) {
    return 'stable';
  }

  // Calculate trend
  const recentStrengths = historicalStrengths.slice(-5); // Last 5 data points
  const avgRecent = recentStrengths.reduce((sum, s) => sum + s, 0) / recentStrengths.length;
  const avgHistorical =
    historicalStrengths.reduce((sum, s) => sum + s, 0) / historicalStrengths.length;

  // Calculate volatility
  const variance =
    historicalStrengths.reduce((sum, s) => sum + Math.pow(s - avgHistorical, 2), 0) /
    historicalStrengths.length;
  const volatility = Math.sqrt(variance);

  // Determine trajectory
  if (volatility > 0.3) {
    return 'volatile';
  }
  if (avgRecent > avgHistorical + 0.1) {
    return 'strengthening';
  }
  if (avgRecent < avgHistorical - 0.1) {
    return 'weakening';
  }
  return 'stable';
}

/**
 * Calculate composite relationship from multiple dimensions
 */
export function calculateCompositeRelationship(
  dimensions: RelationshipDimension[],
  metadata: RelationshipMetadata
): CompositeRelationship {
  if (dimensions.length === 0) {
    return {
      overallStrength: 0,
      primaryDimension: null,
      secondaryDimensions: [],
      complexity: 0,
      trajectory: 'stable',
      narrativeSummary: 'No established relationship dimensions.',
    };
  }

  // Sort dimensions by strength
  const sortedDimensions = [...dimensions].sort((a, b) => b.strength - a.strength);
  const primaryDimension = sortedDimensions[0];
  const secondaryDimensions = sortedDimensions.slice(1).filter((d) => d.strength > 0.2);

  // Calculate weighted average strength
  const totalWeight = dimensions.reduce((sum, d) => sum + d.confidence, 0);
  const overallStrength =
    totalWeight > 0
      ? dimensions.reduce((sum, d) => sum + d.strength * d.confidence, 0) / totalWeight
      : 0;

  // Calculate complexity (number of significant dimensions)
  const significantDimensions = dimensions.filter((d) => d.strength > 0.3);
  const complexity = significantDimensions.length / Math.max(1, dimensions.length);

  // Determine overall trajectory
  const trajectories = dimensions.map((d) => d.trajectory);
  let trajectory: 'improving' | 'declining' | 'stable' | 'turbulent';

  if (
    trajectories.includes('volatile') ||
    trajectories.filter((t) => t === 'volatile').length > 1
  ) {
    trajectory = 'turbulent';
  } else if (trajectories.filter((t) => t === 'strengthening').length > trajectories.length / 2) {
    trajectory = 'improving';
  } else if (trajectories.filter((t) => t === 'weakening').length > trajectories.length / 2) {
    trajectory = 'declining';
  } else {
    trajectory = 'stable';
  }

  // Generate narrative summary
  const narrativeSummary = generateRelationshipNarrative(
    primaryDimension,
    secondaryDimensions,
    overallStrength,
    complexity,
    trajectory,
    metadata
  );

  return {
    overallStrength,
    primaryDimension,
    secondaryDimensions,
    complexity,
    trajectory,
    narrativeSummary,
  };
}

/**
 * Generate natural language narrative for relationship
 */
function generateRelationshipNarrative(
  primary: RelationshipDimension,
  secondary: RelationshipDimension[],
  overallStrength: number,
  complexity: number,
  trajectory: string,
  metadata: RelationshipMetadata
): string {
  const parts: string[] = [];

  // Primary relationship
  const primaryType = getPrimaryType(primary);
  if (primaryType) {
    const strengthWord = getStrengthWord(primary.strength);
    parts.push(
      `I see them primarily as ${getArticle(primaryType.label)} ${strengthWord} ${primaryType.label.toLowerCase()}`
    );
  }

  // Secondary relationships
  if (secondary.length > 0) {
    const secondaryDescriptions = secondary
      .slice(0, 2) // Limit to top 2 secondary
      .map((dim) => {
        const type = getPrimaryType(dim);
        return type ? type.label.toLowerCase() : 'connection';
      });

    if (secondaryDescriptions.length === 1) {
      parts.push(`but also as a ${secondaryDescriptions[0]}`);
    } else {
      parts.push(`but also as a ${secondaryDescriptions.join(' and ')}`);
    }
  }

  // Complexity note
  if (complexity > 0.6) {
    parts.push("(it's a complex, multi-faceted relationship)");
  }

  // Trajectory
  if (trajectory === 'improving') {
    parts.push('and our connection has been growing stronger');
  } else if (trajectory === 'declining') {
    parts.push("though we've been growing apart lately");
  } else if (trajectory === 'turbulent') {
    parts.push('with some ups and downs along the way');
  }

  // Recent interaction
  if (metadata.lastInteractionAt) {
    const daysSince = (Date.now() - metadata.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) {
      parts.push('- we just spoke recently');
    } else if (daysSince < 7) {
      parts.push(`- we last connected ${Math.floor(daysSince)} days ago`);
    } else if (daysSince < 30) {
      parts.push("- it's been a few weeks since we last talked");
    } else {
      parts.push("- we haven't connected in a while");
    }
  }

  return `${parts.join(' ')}.`;
}

/**
 * Get relationship type info for a dimension
 */
function getPrimaryType(dimension: RelationshipDimension) {
  const categoryTypes = RELATIONSHIP_TYPES[dimension.category];
  if (!categoryTypes) {
    return null;
  }

  for (const typeInfo of Object.values(categoryTypes)) {
    if (typeInfo.id === dimension.type) {
      return typeInfo;
    }
  }

  return null;
}

/**
 * Get strength descriptor word
 */
function getStrengthWord(strength: number): string {
  if (strength > 0.8) {
    return 'very close';
  }
  if (strength > 0.6) {
    return 'good';
  }
  if (strength > 0.4) {
    return '';
  }
  if (strength > 0.2) {
    return 'casual';
  }
  return 'distant';
}

/**
 * Get article (a/an) for a word
 */
function getArticle(word: string): string {
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  return vowels.includes(word[0].toLowerCase()) ? 'an' : 'a';
}

/**
 * Update dimension with new evidence
 */
export function updateDimension(
  dimension: RelationshipDimension,
  newEvidence: RelationshipEvidence[],
  factors: StrengthFactors,
  config: RelationshipAnalysisConfig = DEFAULT_ANALYSIS_CONFIG
): RelationshipDimension {
  // Add new evidence
  const updatedEvidence = [...dimension.evidence, ...newEvidence];

  // Remove old/weak evidence if over limit
  if (updatedEvidence.length > 50) {
    updatedEvidence.sort((a, b) => b.weight * b.source.confidence - a.weight * a.source.confidence);
    updatedEvidence.splice(50);
  }

  // Recalculate strength
  const updatedDimension: RelationshipDimension = {
    ...dimension,
    evidence: updatedEvidence,
    lastUpdated: new Date(),
  };

  updatedDimension.strength = calculateDimensionStrength(updatedDimension, factors, config);

  // Update confidence based on evidence quality
  const avgConfidence =
    updatedEvidence.reduce((sum, e) => sum + e.source.confidence, 0) /
    Math.max(1, updatedEvidence.length);
  updatedDimension.confidence = Math.min(1.0, avgConfidence * 1.2); // Slight boost

  return updatedDimension;
}

/**
 * Create a new relationship matrix
 */
export function createRelationshipMatrix(
  sourceEntityId: string,
  targetEntityId: string,
  dimensions: RelationshipDimension[],
  metadata: RelationshipMetadata
): RelationshipMatrix {
  const composite = calculateCompositeRelationship(dimensions, metadata);

  return {
    id: asUUID(`rel-${sourceEntityId}-${targetEntityId}-${Date.now()}`),
    sourceEntityId: asUUID(sourceEntityId),
    targetEntityId: asUUID(targetEntityId),
    dimensions,
    composite,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
