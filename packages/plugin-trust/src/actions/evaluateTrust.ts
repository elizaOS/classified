import {
  type Action,
  type ActionResult,
  type IAgentRuntime,
  type Memory,
  type UUID,
  logger,
  type ActionExample,
  parseJSONObjectFromText,
} from '@elizaos/core';
import type { TrustProfile } from '../types/trust';
export const evaluateTrustAction: Action = {
  name: 'EVALUATE_TRUST',
  description:
    'Evaluates the trust score and profile for a specified entity. Returns detailed trust metrics including dimensions, trends, and confidence levels. Can be chained with RECORD_TRUST_INTERACTION to log trust-affecting behaviors or REQUEST_ELEVATION to check permission eligibility.',

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const trustService = runtime.getService<any>('trust');
    return !!trustService;
  },

  handler: async (runtime: IAgentRuntime, message: Memory): Promise<ActionResult> => {
    const trustService = runtime.getService<any>('trust');

    if (!trustService) {
      throw new Error('Trust service not available');
    }

    // Parse the request
    const text = message.content.text || '';
    const parsed = parseJSONObjectFromText(text);
    const requestData = parsed as {
      entityId?: string;
      entityName?: string;
      detailed?: boolean;
    } | null;

    // Try to extract entity from message if not in parsed data
    let targetEntityId: UUID | undefined;
    if (requestData?.entityId) {
      targetEntityId = requestData.entityId as UUID;
    } else if (requestData?.entityName) {
      // Try to resolve entity name to ID
      // First check if we have a rolodex or entity service
      const entityService = runtime.getService('entities') as any;
      if (entityService && typeof entityService.findByName === 'function') {
        const entity = await entityService.findByName(requestData.entityName);
        if (entity) {
          targetEntityId = entity.id;
        }
      }

      // If no entity service or entity not found, try database query
      if (!targetEntityId && runtime.getEntitiesForRoom) {
        const entities = await runtime.getEntitiesForRoom(message.roomId);
        if (entities) {
          const matchingEntity = entities.find((e) =>
            e.names?.some((name) => name.toLowerCase() === requestData.entityName!.toLowerCase())
          );
          if (matchingEntity) {
            targetEntityId = matchingEntity.id;
          }
        }
      }

      // If still not found, return helpful error
      if (!targetEntityId) {
        return {
          text: `Could not find entity with name "${requestData.entityName}". Please check the name or provide an entity ID instead.`,
          data: {
            actionName: 'EVALUATE_TRUST',
            error: 'Entity not found',
            searchedName: requestData.entityName,
          },
          values: {
            success: false,
            entityFound: false,
          },
        };
      }
    } else {
      // Default to evaluating the message sender
      targetEntityId = message.entityId;
    }

    try {
      const trustContext = {
        evaluatorId: runtime.agentId,
        roomId: message.roomId,
      };

      const trustProfile = await trustService.getTrustScore(targetEntityId);

      // Format response based on detail level
      const detailed = requestData?.detailed ?? false;

      if (detailed) {
        const dimensionText = Object.entries(trustProfile.dimensions)
          .map(([dim, score]) => `- ${dim}: ${score}/100`)
          .join('\n');

        const trendText =
          trustProfile.trend === 'improving'
            ? '📈 Improving'
            : trustProfile.trend === 'declining'
              ? '📉 Declining'
              : '➡️ Stable';

        return {
          text: `Trust Profile for ${targetEntityId}:

Overall Trust: ${trustProfile.overall}/100
Confidence: ${(trustProfile.confidence * 100).toFixed(0)}%
Trend: ${trendText}

Trust Dimensions:
${dimensionText}

Last Updated: ${new Date(trustProfile.lastUpdated).toLocaleString()}`,
          data: {
            actionName: 'EVALUATE_TRUST',
            entityId: targetEntityId,
            trustProfile,
            detailed: true,
          },
          values: {
            success: true,
            trustScore: trustProfile.overall,
            confidence: trustProfile.confidence,
          },
        };
      } else {
        const trustLevel =
          trustProfile.overall >= 80
            ? 'High'
            : trustProfile.overall >= 60
              ? 'Good'
              : trustProfile.overall >= 40
                ? 'Moderate'
                : trustProfile.overall >= 20
                  ? 'Low'
                  : 'Very Low';

        return {
          text: `Trust Level: ${trustLevel} (${trustProfile.overall}/100)`,
          data: {
            actionName: 'EVALUATE_TRUST',
            entityId: targetEntityId,
            trustScore: trustProfile.overall,
            trustLevel,
            confidence: trustProfile.confidence,
          },
          values: {
            success: true,
            trustScore: trustProfile.overall,
            trustLevel,
            confidence: trustProfile.confidence,
          },
        };
      }
    } catch (error) {
      logger.error('[EvaluateTrust] Error evaluating trust:', error);
      return {
        text: 'Failed to evaluate trust. Please try again.',
        data: {
          actionName: 'EVALUATE_TRUST',
          error: error instanceof Error ? error.message : String(error),
        },
        values: {
          success: false,
        },
      };
    }
  },

  examples: [
    // Multi-action: Evaluate trust then record interaction
    [
      {
        name: '{{user}}',
        content: {
          text: "Check Alice's trust score and record that she helped with the project",
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll evaluate Alice's trust profile and then record her helpful contribution.",
          thought: 'User wants trust evaluation followed by interaction recording',
          actions: ['EVALUATE_TRUST', 'RECORD_TRUST_INTERACTION'],
        },
      },
    ],
    // Multi-action: Evaluate trust then request elevation
    [
      {
        name: '{{user}}',
        content: {
          text: 'What is my trust score and can I get admin permissions?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll check your trust score and then process your elevation request.",
          thought: 'User wants trust evaluation followed by permission request',
          actions: ['EVALUATE_TRUST', 'REQUEST_ELEVATION'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'What is my trust score?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Trust Level: Good (65/100) based on 42 interactions',
          actions: ['EVALUATE_TRUST'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Show detailed trust profile for Alice',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: `Trust Profile for Alice:

Overall Trust: 78/100
Confidence: 85%
Interactions: 127
Trend: 📈 Increasing (+0.5 pts/day)

Trust Dimensions:
- reliability: 82/100
- competence: 75/100
- integrity: 80/100
- benevolence: 85/100
- transparency: 70/100

Last Updated: 12/20/2024, 3:45:00 PM`,
          actions: ['EVALUATE_TRUST'],
        },
      },
    ],
  ] as ActionExample[][],

  similes: [
    'check trust score',
    'evaluate trust',
    'show trust level',
    'trust rating',
    'trust profile',
    'trust assessment',
    'check reputation',
    'show trust details',
  ],
};
