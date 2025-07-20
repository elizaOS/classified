import { reflectionEvaluator } from './reflection';
import { relationshipExtractor } from './relationshipExtraction';

export * from './reflection';
export * from './relationshipExtraction';

// Simple debug evaluator to test if evaluators are running at all
import { type Evaluator, logger, type ActionResult } from '@elizaos/core';

export const debugEvaluator: Evaluator = {
  name: 'DEBUG_EVALUATOR',
  description: 'Debug evaluator to test if evaluators are running',
  examples: [],
  validate: async (runtime, message, _state) => {
    logger.info('[DEBUG_EVALUATOR] Validate called', {
      messageId: message.id,
      hasText: !!message.content?.text,
    });
    return true; // Always run
  },
  handler: async (runtime, message, _state): Promise<ActionResult> => {
    logger.info('[DEBUG_EVALUATOR] Handler executed!', {
      messageId: message.id,
      text: message.content?.text?.substring(0, 50) || 'No text',
    });
    return {
      success: true,
      values: { debugRan: true },
      data: { timestamp: Date.now() },
      text: 'Debug evaluator ran successfully',
    };
  },
};

export const evaluators = [relationshipExtractor, reflectionEvaluator, debugEvaluator];

// Export all evaluators
export { relationshipExtractor } from './relationshipExtraction';
export { reflectionEvaluator } from './reflection';

// Backwards compatibility
export { relationshipExtractor as relationshipExtractionEvaluator } from './relationshipExtraction';
