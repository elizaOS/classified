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
import { TrustEvidenceType, type TrustInteraction } from '../types/trust';
import { TrustService } from '..';

export const recordTrustInteractionAction: Action = {
  name: 'RECORD_TRUST_INTERACTION',
  description:
    'Records a trust-affecting interaction between entities. Logs behaviors that impact trust scores including promises kept, helpful contributions, or negative actions. Can be chained with EVALUATE_TRUST to check updated trust levels or REQUEST_ELEVATION to verify permission changes.',

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const trustEngine = runtime.getService<TrustService>('trust');
    return !!trustEngine;
  },

  handler: async (runtime: IAgentRuntime, message: Memory): Promise<ActionResult> => {
    const trustEngine = runtime.getService<TrustService>('trust');

    if (!trustEngine) {
      throw new Error('Trust engine service not available');
    }

    // Parse the interaction details from the message
    const text = message.content.text || '';
    const parsed = parseJSONObjectFromText(text);
    const parsedContent = parsed as {
      type?: string;
      targetEntityId?: string;
      impact?: number;
      description?: string;
      verified?: boolean;
    } | null;

    if (!parsedContent || !parsedContent.type) {
      return {
        text: 'Could not parse trust interaction details. Please provide type and optionally: targetEntityId, impact, description',
        data: {
          actionName: 'RECORD_TRUST_INTERACTION',
          error: 'Missing or invalid interaction type',
        },
        values: {
          success: false,
        },
        success: false,
      };
    }

    // Extract interaction data from the parsed content
    const evidenceType = parsedContent.type as TrustEvidenceType;
    const targetEntityId = parsedContent.targetEntityId as UUID;
    const impact = parsedContent.impact !== undefined ? Number(parsedContent.impact) : undefined;

    // Validate the evidence type - use case-insensitive comparison
    const validTypes = Object.values(TrustEvidenceType);
    const normalizedType = evidenceType?.toUpperCase();
    const matchedType = validTypes.find((type) => type.toUpperCase() === normalizedType);

    if (!matchedType) {
      logger.error('[RecordTrustInteraction] Invalid evidence type:', evidenceType);
      return {
        text: `Invalid interaction type: ${evidenceType}. Valid types are: ${validTypes.join(', ')}`,
        data: {
          actionName: 'RECORD_TRUST_INTERACTION',
          error: 'Invalid interaction type',
          providedType: evidenceType,
          validTypes,
        },
        values: {
          success: false,
        },
        success: false,
      };
    }

    // Use default values if not provided
    const finalTargetEntityId = targetEntityId || runtime.agentId;
    const finalImpact = impact ?? 10; // Default impact value

    // Create trust interaction record
    const interaction: TrustInteraction = {
      sourceEntityId: message.entityId,
      targetEntityId: finalTargetEntityId,
      type: matchedType,
      timestamp: Date.now(),
      impact: finalImpact,
      details: {
        description: parsedContent.description || `Trust interaction: ${matchedType}`,
        messageId: message.id,
        roomId: message.roomId,
      },
      context: {
        entityId: message.entityId,
        evaluatorId: runtime.agentId,
        roomId: message.roomId,
      },
    };

    try {
      await trustEngine.trustEngine.recordInteraction(interaction);

      logger.info('[RecordTrustInteraction] Recorded interaction:', {
        type: matchedType,
        source: message.entityId,
        target: interaction.targetEntityId,
        impact: interaction.impact,
      });

      return {
        text: `Trust interaction recorded: ${matchedType} with impact ${
          interaction.impact > 0 ? '+' : ''
        }${interaction.impact}`,
        data: {
          actionName: 'RECORD_TRUST_INTERACTION',
          interaction,
          interactionType: matchedType,
          impact: interaction.impact,
        },
        values: {
          success: true,
          interactionType: matchedType,
          impact: interaction.impact,
          targetEntityId: interaction.targetEntityId,
        },
        success: true,
      };
    } catch (error) {
      logger.error('[RecordTrustInteraction] Error recording interaction:', error);
      return {
        text: 'Failed to record trust interaction. Please try again.',
        data: {
          actionName: 'RECORD_TRUST_INTERACTION',
          error: error instanceof Error ? error.message : String(error),
        },
        values: {
          success: false,
        },
        success: false,
      };
    }
  },

  examples: [
    // Multi-action: Record interaction then evaluate trust
    [
      {
        name: '{{user}}',
        content: {
          text: 'Record that Alice helped with the project and show her updated trust score',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll record Alice's helpful contribution and then show her updated trust profile.",
          thought: 'User wants to log positive interaction and see trust impact',
          actions: ['RECORD_TRUST_INTERACTION', 'EVALUATE_TRUST'],
        },
      },
    ],
    // Multi-action: Record negative behavior then check elevation eligibility
    [
      {
        name: '{{user}}',
        content: {
          text: 'Log that Bob was spamming and check if he can still get admin permissions',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll record Bob's spam behavior and then check his permission eligibility.",
          thought: 'User wants to log negative behavior and verify permission impact',
          actions: ['RECORD_TRUST_INTERACTION', 'REQUEST_ELEVATION'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Record that Alice kept their promise to help with the project',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Trust interaction recorded: PROMISE_KEPT with impact +15',
          actions: ['RECORD_TRUST_INTERACTION'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Log suspicious behavior from Bob who is spamming the channel',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Trust interaction recorded: SPAM_BEHAVIOR with impact -10',
          actions: ['RECORD_TRUST_INTERACTION'],
        },
      },
    ],
  ] as ActionExample[][],

  similes: [
    'record trust event',
    'log trust interaction',
    'track behavior',
    'note trustworthy action',
    'report suspicious activity',
    'document promise kept',
    'mark helpful contribution',
  ],
};
