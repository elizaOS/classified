import { type IAgentRuntime, logger } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import type {
  TrustRequirements,
  TrustDecision,
  TrustEvidenceType,
  SemanticTrustEvidence,
  TrustScore,
} from '../types/trust';
import type { AccessDecision } from '../types/permissions';
import type { ThreatAssessment } from '../types/security';

/**
 * Core Trust Provider Implementation
 *
 * This class provides trust functionality to the ElizaOS core
 * by wrapping the trust plugin's services.
 */
export class CoreTrustProvider {
  private runtime: IAgentRuntime;
  private trustService: any | null = null;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async initialize(): Promise<void> {
    // Initialize will be called after services are registered
    this.trustService = this.runtime.getService('trust');
    if (!this.trustService) {
      throw new Error(
        'Trust service not available. Ensure the trust plugin is properly initialized.'
      );
    }
  }

  private async ensureTrustService(): Promise<any> {
    if (!this.trustService) {
      this.trustService = this.runtime.getService('trust');
      if (!this.trustService) {
        throw new Error(
          'Trust service not available. Ensure the trust plugin is properly initialized.'
        );
      }
    }
    return this.trustService;
  }

  /**
   * Get trust score for an entity
   */
  async getTrustScore(entityId: UUID): Promise<TrustScore> {
    const trustService = await this.ensureTrustService();
    return trustService.getTrustScoreDetailed(entityId);
  }

  /**
   * Update trust based on semantic evidence
   */
  async updateTrustWithEvidence(entityId: UUID, evidence: SemanticTrustEvidence): Promise<void> {
    const trustService = await this.ensureTrustService();
    await trustService.updateTrustSemantic(entityId, evidence);
  }

  /**
   * Evaluate trust requirements for a decision
   */
  async evaluateTrustRequirements(
    entityId: UUID,
    requirements: TrustRequirements
  ): Promise<TrustDecision> {
    const trustService = await this.ensureTrustService();
    return trustService.evaluateTrustRequirements(entityId, requirements);
  }

  /**
   * Check permission with trust integration
   */
  async checkPermission(
    entityId: UUID,
    action: string,
    resource?: string
  ): Promise<AccessDecision> {
    const trustService = await this.ensureTrustService();
    return trustService.evaluateAccess({
      entityId,
      action,
      resource: resource || 'default',
      timestamp: Date.now(),
      context: {
        requesterEntityId: this.runtime.agentId,
      },
    });
  }

  /**
   * Evaluate threat level for an entity
   */
  async evaluateThreatLevel(entityId: UUID, context?: any): Promise<ThreatAssessment> {
    const trustService = await this.ensureTrustService();
    return trustService.assessThreat(entityId, context);
  }

  /**
   * Record activity for trust calculation
   */
  async recordActivity(
    entityId: UUID,
    activity: string,
    result: 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    const trustService = await this.ensureTrustService();

    const interaction = {
      sourceEntityId: entityId,
      targetEntityId: this.runtime.agentId,
      type:
        result === 'success' ? 'successful_completion' : ('failed_attempt' as TrustEvidenceType),
      impact: result === 'success' ? 0.1 : -0.1,
      timestamp: Date.now(),
      metadata: {
        activity,
        ...metadata,
      },
    };

    await trustService.updateTrust(interaction);
  }

  /**
   * Analyze trust evidence from a message
   */
  async analyzeTrustEvidence(entityId: UUID, message: any): Promise<SemanticTrustEvidence | null> {
    const trustService = await this.ensureTrustService();
    return trustService.analyzeTrustEvidence(entityId, message);
  }

  /**
   * Detect threats using LLM
   */
  async detectThreats(context: any): Promise<any> {
    const trustService = await this.ensureTrustService();
    return trustService.detectThreatsLLM(context);
  }
}
