import { type Evaluator, type IAgentRuntime, type Memory, type State, logger } from '@elizaos/core';
import { TrustEvidenceType } from '../types/trust';
export const trustChangeEvaluator: Evaluator = {
  name: 'trustChangeEvaluator',
  description: 'Evaluates interactions to detect and record trust-affecting behaviors',
  alwaysRun: true,

  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State) => {
    const trustService = runtime.getService<any>('trust');
    return !!trustService;
  },

  handler: async (runtime: IAgentRuntime, message: Memory) => {
    const trustService = runtime.getService<any>('trust');

    if (!trustService) {
      return;
    }

    try {
      const content = message.content.text?.toLowerCase() || '';
      const entityId = message.entityId;

      // Use LLM evaluator if available
      const llmEvaluator = runtime.getService('llm-evaluator');
      if (llmEvaluator) {
        // Analyze behavior using LLM
        const analysis = await (llmEvaluator as any).analyzeBehavior([content], [], entityId);

        // Determine trust impact based on analysis
        let impact = 0;
        if (analysis.trustIndicators?.positive > analysis.trustIndicators?.negative) {
          impact = 0.05; // Positive trust change
        } else if (analysis.trustIndicators?.negative > analysis.trustIndicators?.positive) {
          impact = -0.05; // Negative trust change
        }

        if (impact !== 0) {
          await trustService.updateTrustScore(entityId, impact, 'llm_behavior_analysis');
          logger.debug(`[TrustChangeEvaluator] LLM-based trust updated for ${entityId}: ${impact}`);
        }

        return;
      }

      // Fallback to pattern-based evaluation
      // List of evidence types and their keywords
      const evidencePatterns: Record<string, { keywords: string[]; impact: number; type: TrustEvidenceType }> =
        {
          positive: {
            keywords: ['thank', 'helpful', 'great', 'awesome', 'excellent', 'appreciate'],
            impact: 0.05,
            type: TrustEvidenceType.HELPFUL_ACTION,
          },
          task: {
            keywords: ['completed', 'finished', 'done', 'achieved', 'accomplished'],
            impact: 0.1,
            type: TrustEvidenceType.SUCCESSFUL_TRANSACTION,
          },
          challenge: {
            keywords: ['problem', 'issue', 'error', 'failed', 'mistake'],
            impact: -0.05,
            type: TrustEvidenceType.SUSPICIOUS_ACTIVITY,
          },
          violation: {
            keywords: ['violated', 'breach', 'unauthorized', 'forbidden', 'illegal'],
            impact: -0.2,
            type: TrustEvidenceType.SECURITY_VIOLATION,
          },
        };

      // Check for evidence patterns
      for (const [key, pattern] of Object.entries(evidencePatterns)) {
        const hasKeyword = pattern.keywords.some((keyword) => content.includes(keyword));
        if (hasKeyword && entityId) {
          await trustService.updateTrustScore(entityId, pattern.impact, pattern.type);
          logger.debug(
            `[TrustChangeEvaluator] Pattern-based trust updated for ${entityId}: ${
              pattern.impact
            } (type: ${pattern.type})`
          );
          return;
        }
      }
    } catch (error) {
      logger.error('[TrustChangeEvaluator] Error evaluating trust change:', error);
    }
  },

  examples: [
    {
      prompt: 'User sends a helpful message',
      messages: [
        {
          name: 'User',
          content: {
            text: 'Thanks for helping me understand the trust system!',
          },
        },
      ],
      outcome: 'Positive behavior detected and trust increased',
    },
    {
      prompt: 'User exhibits spam behavior',
      messages: [
        {
          name: 'User',
          content: {
            text: 'SPAM SPAM SPAM SPAM SPAM',
          },
        },
      ],
      outcome: 'Negative behavior detected and trust decreased',
    },
  ],
};
