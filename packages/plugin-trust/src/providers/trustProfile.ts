import { type Provider, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';

export const trustProfileProvider: Provider = {
  name: 'trustProfile',
  description:
    'Provides detailed trust assessment and interaction history for users when agent needs to make trust-based decisions, evaluate credibility, or personalize responses based on established relationships',

  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    try {
      const trustService = runtime.getService<any>('trust');

      if (!trustService) {
        return {
          text: 'Trust service not available',
          values: {},
        };
      }

      // Get trust profile for the message sender
      const senderProfile = await trustService.getTrustScore(message.entityId);

      // Get the latest trust comment
      let latestComment: { comment: string; timestamp: number } | null = null;
      try {
        latestComment = await trustService.getLatestTrustComment(message.entityId);
      } catch (error) {
        // Trust comment retrieval is optional
      }

      // Format trust information
      const trustLevel =
        senderProfile.overall >= 80
          ? 'high trust'
          : senderProfile.overall >= 60
            ? 'good trust'
            : senderProfile.overall >= 40
              ? 'moderate trust'
              : senderProfile.overall >= 20
                ? 'low trust'
                : 'very low trust';

      const trendText = senderProfile.trend || 'stable';

      // Create the base text
      let text = `The user has ${trustLevel} (${senderProfile.overall}/100) with ${trendText} trust trend.`;

      // Add the narrative comment if available
      if (latestComment && latestComment.comment) {
        text += `\n\nTrust Assessment: ${latestComment.comment}`;
      }

      return {
        text,
        values: {
          trustScore: senderProfile.overall,
          trustLevel,
          trustTrend: senderProfile.trend,
          reliability: senderProfile.dimensions.reliability,
          competence: senderProfile.dimensions.competence,
          integrity: senderProfile.dimensions.integrity,
          benevolence: senderProfile.dimensions.benevolence,
          transparency: senderProfile.dimensions.transparency,
          hasNarrativeAssessment: !!latestComment,
          lastAssessmentDate:
            latestComment && latestComment.timestamp
              ? new Date(latestComment.timestamp).toISOString()
              : null,
        },
        data: {
          profile: senderProfile,
          latestComment,
        },
      };
    } catch (error) {
      logger.error('[TrustProfileProvider] Error fetching trust profile:', error);
      return {
        text: 'Unable to fetch trust profile',
        values: {},
      };
    }
  },
};
