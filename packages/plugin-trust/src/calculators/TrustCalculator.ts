import { logger } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import {
  type TrustEvidenceType,
  type TrustCalculationConfig,
  type TrustProfile,
  type TrustDimensions,
  type TrustEvidence,
} from '../types/trust';

/**
 * Main trust calculation engine
 * Implements sophisticated algorithms for multi-dimensional trust scoring
 */
export class TrustCalculator {
  private config: TrustCalculationConfig;

  constructor(config: TrustCalculationConfig) {
    this.config = config;
  }

  /**
   * Calculate trust dimensions from evidence
   */
  calculateDimensions(evidence: TrustEvidence[]): TrustDimensions {
    // Initialize dimensions with baseline values
    const dimensions: TrustDimensions = {
      reliability: 50,
      competence: 50,
      integrity: 50,
      benevolence: 50,
      transparency: 50,
    };

    // Group evidence by type for analysis
    const evidenceByType = this.groupEvidenceByType(evidence);

    // Calculate each dimension based on relevant evidence
    dimensions.reliability = this.calculateReliability(evidenceByType);
    dimensions.competence = this.calculateCompetence(evidenceByType);
    dimensions.integrity = this.calculateIntegrity(evidenceByType);
    dimensions.benevolence = this.calculateBenevolence(evidenceByType);
    dimensions.transparency = this.calculateTransparency(evidenceByType);

    // Apply time decay to all dimensions
    const decayedDimensions = this.applyTimeDecay(dimensions, evidence);

    // Normalize dimensions to 0-100 range
    return this.normalizeDimensions(decayedDimensions);
  }

  /**
   * Calculate overall trust score from dimensions
   */
  calculateOverallTrust(dimensions: TrustDimensions): number {
    const weights = this.config.dimensionWeights;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [dimension, value] of Object.entries(dimensions)) {
      const weight = weights[dimension as keyof TrustDimensions];
      weightedSum += value * weight;
      totalWeight += weight;
    }

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Calculate confidence in the trust score
   */
  calculateConfidence(evidence: TrustEvidence[]): number {
    // Factors that influence confidence:
    // 1. Amount of evidence
    // 2. Recency of evidence
    // 3. Consistency of evidence
    // 4. Verification status

    const amountFactor = this.calculateAmountConfidence(evidence.length);
    const recencyFactor = this.calculateRecencyConfidence(evidence);
    const consistencyFactor = this.calculateConsistencyConfidence(evidence);
    const verificationFactor = this.calculateVerificationConfidence(evidence);

    // Weighted combination of factors
    const confidence =
      amountFactor * 0.25 +
      recencyFactor * 0.25 +
      consistencyFactor * 0.35 +
      verificationFactor * 0.15;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Calculate reliability dimension
   * Based on: promise keeping, consistent behavior, meeting deadlines
   */
  private calculateReliability(evidenceByType: Map<TrustEvidenceType, TrustEvidence[]>): number {
    let score = 50; // Start at neutral

    const promisesKept = evidenceByType.get('PROMISE_KEPT' as TrustEvidenceType) || [];
    const promisesBroken = evidenceByType.get('PROMISE_BROKEN' as TrustEvidenceType) || [];
    const consistentBehavior = evidenceByType.get('CONSISTENT_BEHAVIOR' as TrustEvidenceType) || [];
    const inconsistentBehavior =
      evidenceByType.get('INCONSISTENT_BEHAVIOR' as TrustEvidenceType) || [];

    // Calculate promise keeping ratio
    const totalPromises = promisesKept.length + promisesBroken.length;
    if (totalPromises > 0) {
      const keepRatio = promisesKept.length / totalPromises;
      score += (keepRatio - 0.5) * 40; // ±20 points based on ratio
    }

    // Factor in consistency
    const consistencyNet = consistentBehavior.length - inconsistentBehavior.length;
    score += Math.min(20, Math.max(-20, consistencyNet * 5));

    return score;
  }

  /**
   * Calculate competence dimension
   * Based on: successful actions, helpful contributions, verified skills
   */
  private calculateCompetence(evidenceByType: Map<TrustEvidenceType, TrustEvidence[]>): number {
    let score = 50;

    const helpfulActions = evidenceByType.get('HELPFUL_ACTION' as TrustEvidenceType) || [];
    const successfulTransactions =
      evidenceByType.get('SUCCESSFUL_TRANSACTION' as TrustEvidenceType) || [];
    const verifiedIdentity = evidenceByType.get('VERIFIED_IDENTITY' as TrustEvidenceType) || [];
    const communityContributions =
      evidenceByType.get('COMMUNITY_CONTRIBUTION' as TrustEvidenceType) || [];

    // Weight different types of competence evidence
    score += helpfulActions.length * 3;
    score += successfulTransactions.length * 5;
    score += verifiedIdentity.length * 10;
    score += communityContributions.length * 4;

    // Cap at reasonable bounds
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate integrity dimension
   * Based on: honest behavior, following rules, ethical actions
   */
  private calculateIntegrity(evidenceByType: Map<TrustEvidenceType, TrustEvidence[]>): number {
    let score = 50;

    const securityViolations = evidenceByType.get('SECURITY_VIOLATION' as TrustEvidenceType) || [];
    const suspiciousActivity = evidenceByType.get('SUSPICIOUS_ACTIVITY' as TrustEvidenceType) || [];
    const verifiedIdentity = evidenceByType.get('VERIFIED_IDENTITY' as TrustEvidenceType) || [];

    // Heavy penalties for security violations
    score -= securityViolations.length * 15;
    score -= suspiciousActivity.length * 10;

    // Bonus for verified identity
    score += verifiedIdentity.length * 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate benevolence dimension
   * Based on: helping others, positive interactions, community support
   */
  private calculateBenevolence(evidenceByType: Map<TrustEvidenceType, TrustEvidence[]>): number {
    let score = 50;

    const helpfulActions = evidenceByType.get('HELPFUL_ACTION' as TrustEvidenceType) || [];
    const harmfulActions = evidenceByType.get('HARMFUL_ACTION' as TrustEvidenceType) || [];
    const communityContributions =
      evidenceByType.get('COMMUNITY_CONTRIBUTION' as TrustEvidenceType) || [];

    // Positive actions increase benevolence
    score += helpfulActions.reduce((sum, ev) => sum + (ev.impact > 0 ? ev.impact : 0), 0) / 10;
    score += communityContributions.length * 5;

    // Harmful actions decrease benevolence
    score -= harmfulActions.reduce((sum, ev) => sum + Math.abs(ev.impact), 0) / 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate transparency dimension
   * Based on: open communication, identity verification, consistent identity
   */
  private calculateTransparency(evidenceByType: Map<TrustEvidenceType, TrustEvidence[]>): number {
    let score = 50;

    const verifiedIdentity = evidenceByType.get('VERIFIED_IDENTITY' as TrustEvidenceType) || [];
    const identityChanges = evidenceByType.get('IDENTITY_CHANGE' as TrustEvidenceType) || [];
    const failedVerification = evidenceByType.get('FAILED_VERIFICATION' as TrustEvidenceType) || [];

    // Verified identity greatly increases transparency
    score += verifiedIdentity.length * 15;

    // Identity changes and failed verifications decrease it
    score -= identityChanges.length * 10;
    score -= failedVerification.length * 20;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Apply time decay to dimensions based on evidence age
   */
  private applyTimeDecay(dimensions: TrustDimensions, evidence: TrustEvidence[]): TrustDimensions {
    if (evidence.length === 0) {
      return dimensions;
    }

    // Calculate average age of evidence
    const now = Date.now();
    const averageAge =
      evidence.reduce((sum, ev) => sum + (now - ev.timestamp), 0) / evidence.length;
    const ageInDays = averageAge / (24 * 60 * 60 * 1000);

    // Apply exponential decay
    const decayFactor = Math.exp(-this.config.evidenceDecayRate * ageInDays);

    // Blend current scores with baseline based on decay
    const decayed: TrustDimensions = { ...dimensions };
    for (const [key, value] of Object.entries(dimensions)) {
      decayed[key as keyof TrustDimensions] = value * decayFactor + 50 * (1 - decayFactor);
    }

    return decayed;
  }

  /**
   * Group evidence by type for easier analysis
   */
  private groupEvidenceByType(evidence: TrustEvidence[]): Map<TrustEvidenceType, TrustEvidence[]> {
    const grouped = new Map<TrustEvidenceType, TrustEvidence[]>();

    for (const ev of evidence) {
      const existing = grouped.get(ev.type) || [];
      existing.push(ev);
      grouped.set(ev.type, existing);
    }

    return grouped;
  }

  /**
   * Normalize dimensions to ensure they're in 0-100 range
   */
  private normalizeDimensions(dimensions: TrustDimensions): TrustDimensions {
    const normalized: TrustDimensions = { ...dimensions };

    for (const key of Object.keys(dimensions) as (keyof TrustDimensions)[]) {
      normalized[key] = Math.min(100, Math.max(0, Math.round(dimensions[key])));
    }

    return normalized;
  }

  /**
   * Calculate confidence based on amount of evidence
   */
  private calculateAmountConfidence(count: number): number {
    // Logarithmic growth - more evidence increases confidence but with diminishing returns
    if (count === 0) {
      return 0;
    }
    if (count >= this.config.minimumEvidenceCount * 5) {
      return 1;
    }

    return Math.min(1, Math.log(count + 1) / Math.log(this.config.minimumEvidenceCount * 5 + 1));
  }

  /**
   * Calculate confidence based on recency of evidence
   */
  private calculateRecencyConfidence(evidence: TrustEvidence[]): number {
    if (evidence.length === 0) {
      return 0;
    }

    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const oneMonth = 30 * 24 * 60 * 60 * 1000;

    // Count evidence in different time windows
    const lastWeek = evidence.filter((ev) => now - ev.timestamp < oneWeek).length;
    const lastMonth = evidence.filter((ev) => now - ev.timestamp < oneMonth).length;

    // Higher confidence if we have recent evidence
    const recencyScore = (lastWeek * 2 + lastMonth) / (evidence.length * 3);

    return Math.min(1, recencyScore);
  }

  /**
   * Calculate confidence based on consistency of evidence
   */
  private calculateConsistencyConfidence(evidence: TrustEvidence[]): number {
    if (evidence.length < 2) {
      return 0.5;
    }

    // Calculate variance in impact values
    const impacts = evidence.map((ev) => ev.impact);
    const mean = impacts.reduce((a, b) => a + b, 0) / impacts.length;
    const variance =
      impacts.reduce((sum, impact) => sum + Math.pow(impact - mean, 2), 0) / impacts.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher consistency = higher confidence
    // Normalize to 0-1 range (assuming max reasonable stdDev of 50)
    const consistencyScore = 1 - Math.min(1, stdDev / 50);

    return consistencyScore;
  }

  /**
   * Calculate confidence based on verification status
   */
  private calculateVerificationConfidence(evidence: TrustEvidence[]): number {
    if (evidence.length === 0) {
      return 0;
    }

    const verifiedCount = evidence.filter((ev) => ev.verified).length;
    const verificationRatio = verifiedCount / evidence.length;

    // Apply verification multiplier from config
    return Math.min(1, verificationRatio * this.config.verificationMultiplier);
  }

  createDefaultProfile(entityId: UUID): TrustProfile {
    return {
      entityId,
      dimensions: {
        reliability: 50,
        competence: 50,
        integrity: 50,
        benevolence: 50,
        transparency: 50,
      },
      overallTrust: 50,
      confidence: 0,
      interactionCount: 0,
      evidence: [],
      lastCalculated: Date.now(),
      calculationMethod: 'default',
      trend: {
        direction: 'stable',
        changeRate: 0,
        lastChangeAt: Date.now(),
      },
      evaluatorId: 'system' as UUID,
    };
  }

  calculateOverallScore(dimensions: TrustDimensions): number {
    const weights = this.config.dimensionWeights;
    const totalWeight =
      weights.reliability +
      weights.competence +
      weights.integrity +
      weights.benevolence +
      weights.transparency;

    if (totalWeight === 0) {
      return 50;
    }

    const weightedScore =
      dimensions.reliability * weights.reliability +
      dimensions.competence * weights.competence +
      dimensions.integrity * weights.integrity +
      dimensions.benevolence * weights.benevolence +
      dimensions.transparency * weights.transparency;

    return Math.round(weightedScore / totalWeight);
  }

  calculateProfileFromEvidence(entityId: UUID, evidence: TrustEvidence[]): TrustProfile {
    const dimensions = this.calculateDimensions(evidence);
    const overallTrust = this.calculateOverallScore(dimensions);
    const confidence = this.calculateConfidence(evidence);

    // Calculate trend based on recent evidence
    const recentEvidence = evidence
      .filter((ev) => Date.now() - ev.timestamp < 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => b.timestamp - a.timestamp);

    const trend: TrustProfile['trend'] = {
      direction: 'stable',
      changeRate: 0,
      lastChangeAt: Date.now(),
    };

    if (recentEvidence.length >= 2) {
      const recentImpacts = recentEvidence.map((ev) => ev.impact);
      const avgRecentImpact = recentImpacts.reduce((a, b) => a + b, 0) / recentImpacts.length;

      if (avgRecentImpact > 5) {
        trend.direction = 'increasing';
        trend.changeRate = avgRecentImpact / 100;
      } else if (avgRecentImpact < -5) {
        trend.direction = 'decreasing';
        trend.changeRate = Math.abs(avgRecentImpact) / 100;
      }

      trend.lastChangeAt = recentEvidence[0].timestamp;
    }

    return {
      entityId,
      dimensions,
      overallTrust,
      confidence,
      interactionCount: evidence.length,
      evidence,
      lastCalculated: Date.now(),
      calculationMethod: 'weighted_dimensions',
      trend,
      evaluatorId: 'system' as UUID,
    };
  }
}
