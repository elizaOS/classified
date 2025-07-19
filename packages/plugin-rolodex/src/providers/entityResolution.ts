import { type Provider, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { EntityResolutionManager } from '../managers';
import type { ResolutionContext } from '../managers/EntityResolutionManager';

export const entityResolutionProvider: Provider = {
  name: 'entityResolution',
  description: 'Provides entity resolution and identity management capabilities',

  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    try {
      const resolutionService = runtime.getService(
        'entityResolution'
      ) as unknown as EntityResolutionManager;
      if (!resolutionService) {
        logger.warn('[EntityResolutionProvider] EntityResolutionManager not available');
        return { text: '' };
      }

      // Get context about recent entity resolution activities
      const roomId = message.roomId;
      const entityId = message.entityId;

      // Check for potential identity conflicts or duplicates
      const resolutionContext: ResolutionContext = {
        roomId,
        conversationHistory: state.data?.recentMessages || [],
        platformContext: {
          platform: message.content.source || 'unknown',
        },
      };

      const resolutionCandidates = await resolutionService.resolveEntity(
        entityId,
        resolutionContext,
        message.content.source
      );

      const lines: string[] = [];

      if (resolutionCandidates.length > 1) {
        lines.push('## Entity Resolution Status');
        lines.push(
          `Found ${resolutionCandidates.length} potential identity matches for current context.`
        );

        // Show high-confidence candidates
        const highConfidenceCandidates = resolutionCandidates.filter((c) => c.confidence > 0.8);
        if (highConfidenceCandidates.length > 0) {
          lines.push('\n### High Confidence Matches:');
          for (const candidate of highConfidenceCandidates.slice(0, 3)) {
            const entity = candidate.entity;
            const name = entity.names[0] || 'Unknown';
            const confidence = Math.round(candidate.confidence * 100);
            lines.push(`- ${name} (${confidence}% confidence)`);

            if (candidate.matchFactors.length > 0) {
              const topFactors = candidate.matchFactors
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 2);
              for (const factor of topFactors) {
                lines.push(`  - ${factor.type}: ${factor.evidence}`);
              }
            }
          }
        }

        // Show risk factors if any
        const riskyMatches = resolutionCandidates.filter((c) => c.riskFactors.length > 0);
        if (riskyMatches.length > 0) {
          lines.push('\n### Identity Risks Detected:');
          for (const candidate of riskyMatches.slice(0, 2)) {
            const highRisks = candidate.riskFactors.filter(
              (r) => r.severity === 'high' || r.severity === 'critical'
            );
            for (const risk of highRisks.slice(0, 2)) {
              lines.push(`- ${risk.type}: ${risk.description}`);
            }
          }
        }
      }

      // Show cross-platform identity information
      const currentEntity = resolutionCandidates.find((c) => c.entityId === entityId);
      if (currentEntity && currentEntity.crossPlatformIndicators.length > 0) {
        if (lines.length === 0) {
          lines.push('## Entity Information');
        }
        lines.push('\n### Cross-Platform Identities:');

        const verifiedPlatforms = currentEntity.crossPlatformIndicators.filter((p) => p.verified);
        const unverifiedPlatforms = currentEntity.crossPlatformIndicators.filter(
          (p) => !p.verified
        );

        if (verifiedPlatforms.length > 0) {
          lines.push('**Verified:**');
          for (const platform of verifiedPlatforms.slice(0, 3)) {
            const confidence = Math.round(platform.confidence * 100);
            lines.push(
              `- ${platform.platform}: ${platform.identifier} (${confidence}% confidence)`
            );
          }
        }

        if (unverifiedPlatforms.length > 0) {
          lines.push('**Unverified:**');
          for (const platform of unverifiedPlatforms.slice(0, 2)) {
            const confidence = Math.round(platform.confidence * 100);
            lines.push(
              `- ${platform.platform}: ${platform.identifier} (${confidence}% confidence)`
            );
          }
        }
      }

      if (lines.length === 0) {
        return {
          text: '',
          values: {
            hasResolutionData: false,
            candidateCount: 0,
            riskLevel: 'none',
          },
        };
      }

      // Calculate overall risk level
      const allRiskFactors = resolutionCandidates.flatMap((c) => c.riskFactors);
      const criticalRisks = allRiskFactors.filter((r) => r.severity === 'critical');
      const highRisks = allRiskFactors.filter((r) => r.severity === 'high');

      let riskLevel = 'low';
      if (criticalRisks.length > 0) {
        riskLevel = 'critical';
      } else if (highRisks.length > 0) {
        riskLevel = 'high';
      } else if (allRiskFactors.length > 0) {
        riskLevel = 'medium';
      }

      return {
        text: lines.join('\n'),
        values: {
          hasResolutionData: true,
          candidateCount: resolutionCandidates.length,
          highConfidenceMatches: resolutionCandidates.filter((c) => c.confidence > 0.8).length,
          riskLevel,
          riskFactorCount: allRiskFactors.length,
        },
        data: {
          resolutionCandidates,
          currentEntityMatch: currentEntity,
          riskFactors: allRiskFactors,
        },
      };
    } catch (error) {
      logger.error('[EntityResolutionProvider] Error getting resolution data:', error);
      return { text: 'Unable to retrieve entity resolution information at this time.' };
    }
  },
};
