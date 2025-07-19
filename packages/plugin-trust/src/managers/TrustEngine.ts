import { type IAgentRuntime, logger } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import type { TrustDatabase } from '../database/TrustDatabase';
import { TrustCalculator } from '../calculators/TrustCalculator';
import type {
  TrustProfile,
  TrustDimensions,
  TrustEvidence,
  TrustEvidenceType,
  TrustContext,
  TrustInteraction,
  TrustCalculationConfig,
  TrustDecision,
  TrustRequirements,
  SemanticTrustEvidence,
} from '../types/trust';

/**
 * Trust Engine - Core trust calculation and management
 */
export class TrustEngine {
  private runtime!: IAgentRuntime;
  private db!: TrustDatabase;
  private calculator!: TrustCalculator;

  async initialize(
    runtime: IAgentRuntime,
    db: TrustDatabase,
    config: Partial<TrustCalculationConfig> = {}
  ): Promise<void> {
    this.runtime = runtime;
    this.db = db;

    const defaultConfig: TrustCalculationConfig = {
      recencyBias: 0.5,
      evidenceDecayRate: 0.01,
      minimumEvidenceCount: 5,
      verificationMultiplier: 1.2,
      dimensionWeights: {
        reliability: 0.2,
        competence: 0.2,
        integrity: 0.2,
        benevolence: 0.2,
        transparency: 0.2,
      },
    };

    this.calculator = new TrustCalculator({ ...defaultConfig, ...config });
    logger.info('[TrustEngine] Initialized successfully.');
  }

  async getProfile(entityId: UUID): Promise<TrustProfile> {
    const profile = await this.db.getTrustProfile(entityId);
    if (profile) {
      return profile;
    }
    return this.calculator.createDefaultProfile(entityId);
  }

  async calculateTrust(entityId: UUID, context: TrustContext): Promise<TrustProfile> {
    const profile = await this.getProfile(entityId);

    // Update last calculated time
    profile.lastCalculated = Date.now();

    return profile;
  }

  async recordSemanticEvidence(entityId: UUID, evidence: SemanticTrustEvidence): Promise<void> {
    const profile = await this.getProfile(entityId);
    const oldTrustScore = profile.overallTrust;
    const newDimensions = { ...profile.dimensions };

    for (const [dimension, impact] of Object.entries(evidence.affectedDimensions)) {
      if (dimension in newDimensions && impact !== undefined) {
        const change = (impact - 50) / 5; // Convert 0-100 to -10 to +10
        newDimensions[dimension as keyof TrustDimensions] = Math.max(
          0,
          Math.min(100, newDimensions[dimension as keyof TrustDimensions] + change)
        );
      }
    }

    const newOverall = this.calculator.calculateOverallScore(newDimensions);
    const trustChange = newOverall - oldTrustScore;

    const updatedProfile: TrustProfile = {
      ...profile,
      overallTrust: newOverall,
      dimensions: newDimensions,
      lastCalculated: Date.now(),
      interactionCount: profile.interactionCount + 1,
    };

    const trustEvidence: TrustEvidence = {
      type: 'semantic_analysis' as TrustEvidenceType,
      timestamp: evidence.timestamp,
      impact: evidence.impact,
      weight: evidence.analysisConfidence,
      description: evidence.description,
      reportedBy: evidence.reportedBy,
      verified: evidence.analysisConfidence > 0.8,
      context: evidence.context,
      targetEntityId: entityId,
      evaluatorId: this.runtime.agentId,
      metadata: {
        sentiment: evidence.sentiment,
        affectedDimensions: evidence.affectedDimensions,
        analysisConfidence: evidence.analysisConfidence,
        sourceContent: evidence.sourceContent,
      },
    };

    updatedProfile.evidence.push(trustEvidence);
    await this.db.saveTrustProfile(updatedProfile);
    await this.db.addTrustEvidence(trustEvidence);

    // Check if trust changed significantly (±10 points)
    if (Math.abs(trustChange) >= 10) {
      await this.generateTrustComment(entityId, oldTrustScore, newOverall, trustChange, evidence);
    }
  }

  private async generateTrustComment(
    entityId: UUID,
    oldTrust: number,
    newTrust: number,
    trustChange: number,
    latestEvidence: SemanticTrustEvidence
  ): Promise<void> {
    try {
      // Get the updated profile for dimensions
      const updatedProfile = await this.getProfile(entityId);

      // Get recent trust comments to include in context
      const recentComments = await this.db.getTrustCommentHistory(
        entityId,
        this.runtime.agentId,
        3
      );

      // Get recent evidence for context
      const recentEvidence = await this.db.getTrustEvidence(entityId);
      const last5Evidence = recentEvidence.slice(0, 5);

      const prompt = `Generate a narrative assessment of this user's trust level based on the following information:

Current Trust Score: ${newTrust.toFixed(1)}/100
Previous Trust Score: ${oldTrust.toFixed(1)}/100
Change: ${trustChange > 0 ? '+' : ''}${trustChange.toFixed(1)} points

Latest Event: ${latestEvidence.description}
Event Impact: ${latestEvidence.sentiment} (${latestEvidence.impact > 0 ? '+' : ''}${latestEvidence.impact})

Recent Trust History:
${recentComments.map((c) => `- ${new Date(c.timestamp).toLocaleDateString()}: Trust was ${c.trustScore.toFixed(1)} - "${c.comment}"`).join('\n') || 'No previous assessments'}

Recent Behavior Patterns:
${last5Evidence.map((e) => `- ${e.description} (${e.impact > 0 ? 'positive' : e.impact < 0 ? 'negative' : 'neutral'})`).join('\n')}

Trust Dimensions:
- Reliability: ${updatedProfile.dimensions.reliability.toFixed(1)}/100
- Competence: ${updatedProfile.dimensions.competence.toFixed(1)}/100
- Integrity: ${updatedProfile.dimensions.integrity.toFixed(1)}/100
- Benevolence: ${updatedProfile.dimensions.benevolence.toFixed(1)}/100
- Transparency: ${updatedProfile.dimensions.transparency.toFixed(1)}/100

Write a 2-3 sentence narrative assessment that:
1. Describes their overall trust standing without mentioning specific numbers
2. Explains what caused this change
3. If there were previous assessments, reference how their trust has evolved
4. Use natural language that reflects the trust level (e.g., "highly trusted member" for 80+, "establishing trust" for 40-60, "trust concerns" for <40)

Do not include the numerical score in your response. Focus on the narrative and behavioral patterns.`;

      const response = await this.runtime.useModel('TEXT_REASONING_SMALL', {
        prompt,
        temperature: 0.7,
        maxTokens: 200,
      });

      const comment = response.content.trim();

      // Save the trust comment
      await this.db.saveTrustComment({
        entityId,
        evaluatorId: this.runtime.agentId,
        trustScore: newTrust,
        trustChange,
        comment,
        metadata: {
          oldTrust,
          dimensions: updatedProfile.dimensions,
          triggeringEvent: latestEvidence.description,
          evidenceCount: recentEvidence.length,
        },
      });

      logger.info(`[TrustEngine] Generated trust comment for ${entityId}: ${comment}`);
    } catch (error) {
      logger.error('[TrustEngine] Failed to generate trust comment:', error);
    }
  }

  /** @deprecated Use recordSemanticEvidence instead. */
  async recordInteraction(interaction: TrustInteraction): Promise<void> {
    logger.warn(
      '[TrustEngine] recordInteraction is deprecated. Use recordSemanticEvidence for richer, LLM-based analysis.'
    );

    const description = `Legacy interaction: ${
      interaction.type
    }. ${interaction.details?.description || ''}`;

    const context = interaction.context || { entityId: interaction.sourceEntityId };
    if (!context.entityId) {
      context.entityId = interaction.sourceEntityId;
    }

    const semanticEvidence: SemanticTrustEvidence = {
      description,
      impact: interaction.impact,
      sentiment:
        interaction.impact > 0 ? 'positive' : interaction.impact < 0 ? 'negative' : 'neutral',
      affectedDimensions: {},
      analysisConfidence: 0.5,
      sourceContent: JSON.stringify(interaction.details),
      timestamp: interaction.timestamp,
      reportedBy: interaction.sourceEntityId,
      context: context as TrustContext,
    };

    await this.recordSemanticEvidence(interaction.sourceEntityId, semanticEvidence);
  }

  async evaluateTrustDecision(
    entityId: UUID,
    requirements: TrustRequirements,
    context: TrustContext
  ): Promise<TrustDecision> {
    const profile = await this.calculateTrust(entityId, context);

    if (profile.overallTrust < requirements.minimumTrust) {
      return {
        approved: false,
        trustScore: profile.overallTrust,
        confidence: profile.confidence,
        dimensionsChecked: {},
        reason: `Trust score ${profile.overallTrust.toFixed(1)} is below required minimum of ${requirements.minimumTrust}.`,
        suggestions: [
          'Engage in more positive community interactions.',
          'Complete verification steps.',
        ],
      };
    }

    if (requirements.dimensions) {
      for (const [dim, req] of Object.entries(requirements.dimensions)) {
        const dimension = dim as keyof TrustDimensions;
        if (profile.dimensions[dimension] < req) {
          return {
            approved: false,
            trustScore: profile.overallTrust,
            confidence: profile.confidence,
            dimensionsChecked: { [dimension]: profile.dimensions[dimension] },
            reason: `"${dimension}" score of ${profile.dimensions[dimension].toFixed(1)} is below required minimum of ${req}.`,
            suggestions: [`Improve your ${dimension} score through consistent positive actions.`],
          };
        }
      }
    }

    return {
      approved: true,
      trustScore: profile.overallTrust,
      confidence: profile.confidence,
      dimensionsChecked: requirements.dimensions || {},
      reason: 'All trust requirements met.',
    };
  }

  async stop(): Promise<void> {
    logger.info('[TrustEngine] Stopped');
  }
}
