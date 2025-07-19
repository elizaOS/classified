import { type IAgentRuntime, type Memory, logger } from '@elizaos/core';
import type { UUID } from '@elizaos/core';

/**
 * Trust system integration examples and utilities
 * These demonstrate how other plugins should integrate with the trust system
 */

export { validateShellCommand } from './plugin-shell-integration';
export { SecretOperation, SecretSensitivity } from './plugin-secrets-integration';

/**
 * Generic trust validation utility for any plugin action
 */

export interface TrustValidationOptions {
  action: string;
  resource?: string;
  minimumTrust?: number;
  requiredDimensions?: Record<string, number>;
  minimumInteractions?: number;
  logSecurityEvents?: boolean;
}

/**
 * Generic trust validation function that any plugin can use
 */
export async function validateActionWithTrust(
  runtime: IAgentRuntime,
  message: Memory,
  options: TrustValidationOptions
): Promise<{
  allowed: boolean;
  reason: string;
  trustScore?: number;
  suggestions?: string[];
  method?: string;
}> {
  try {
    // Get trust engine service
    const trustEngine = runtime.getService('trust-engine') as any;
    if (!trustEngine) {
      logger.warn(`[TrustValidation] Trust engine not available for action ${options.action}`);
      return {
        allowed: false,
        reason: 'Trust engine not available',
      };
    }

    // Build trust requirements
    const requirements = {
      minimumTrust: options.minimumTrust || 50,
      dimensions: options.requiredDimensions,
      minimumInteractions: options.minimumInteractions,
    };

    // Build trust context
    const trustContext = {
      evaluatorId: runtime.agentId,
      action: options.action,
      worldId: message.worldId,
      roomId: message.roomId,
    };

    // Evaluate trust decision
    const decision = await trustEngine.evaluateTrustDecision(
      message.entityId,
      requirements,
      trustContext
    );

    // Log security event if denied and logging is enabled
    if (!decision.allowed && options.logSecurityEvents !== false) {
      const securityModule = runtime.getService('security-module') as any;
      if (securityModule) {
        await securityModule.logSecurityEvent({
          type: 'ACTION_DENIED',
          entityId: message.entityId,
          severity: requirements.minimumTrust > 70 ? 'high' : 'medium',
          context: {
            action: options.action,
            resource: options.resource,
            trustScore: decision.trustScore,
            requiredTrust: requirements.minimumTrust,
          },
          details: {
            reason: decision.reason,
            requirements,
          },
        });
      }
    }

    return {
      allowed: decision.allowed,
      reason: decision.reason,
      trustScore: decision.trustScore,
      suggestions: decision.suggestions,
      method: 'trust-based',
    };
  } catch (error) {
    logger.error(`[TrustValidation] Error validating action ${options.action}:`, error);
    return {
      allowed: false,
      reason: 'Trust validation error',
    };
  }
}

/**
 * Trust middleware wrapper for actions
 * Use this to automatically add trust validation to any action
 */
export function withTrustValidation<T extends (...args: any[]) => any>(
  options: TrustValidationOptions
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalHandler = descriptor.value;

    descriptor.value = async function (
      runtime: IAgentRuntime,
      message: Memory,
      state?: any,
      actionOptions?: any,
      callback?: any
    ) {
      // Validate trust before executing action
      const validation = await validateActionWithTrust(runtime, message, options);

      if (!validation.allowed) {
        logger.warn(
          `[TrustMiddleware] Action ${options.action} denied for ${message.entityId}: ${validation.reason}`
        );

        return {
          text: `Action denied: ${validation.reason}${validation.suggestions ? `\n\nSuggestions:\n${validation.suggestions.join('\n')}` : ''}`,
          error: true,
          trustDenied: true,
          trustScore: validation.trustScore,
        };
      }

      // Execute original action if validation passes
      return originalHandler.call(this, runtime, message, state, actionOptions, callback);
    };

    return descriptor;
  };
}

/**
 * Helper to record successful action completion for trust building
 */
export async function recordSuccessfulAction(
  runtime: IAgentRuntime,
  userId: UUID,
  actionName: string,
  impact: number = 1
): Promise<void> {
  try {
    const trustEngine = runtime.getService('trust-engine') as any;
    if (!trustEngine) {
      return;
    }

    await trustEngine.recordInteraction({
      sourceEntityId: userId,
      targetEntityId: runtime.agentId,
      type: 'HELPFUL_ACTION',
      timestamp: Date.now(),
      impact,
      details: {
        action: actionName,
        successful: true,
      },
      context: {
        evaluatorId: runtime.agentId,
      },
    });
  } catch (error) {
    logger.error('[TrustValidation] Failed to record successful action:', error);
  }
}

/**
 * Helper to record failed action for trust penalty
 */
export async function recordFailedAction(
  runtime: IAgentRuntime,
  userId: UUID,
  actionName: string,
  error: Error,
  impact: number = -2
): Promise<void> {
  try {
    const trustEngine = runtime.getService('trust-engine') as any;
    if (!trustEngine) {
      return;
    }

    await trustEngine.recordInteraction({
      sourceEntityId: userId,
      targetEntityId: runtime.agentId,
      type: 'HARMFUL_ACTION',
      timestamp: Date.now(),
      impact,
      details: {
        action: actionName,
        successful: false,
        error: error.message,
      },
      context: {
        evaluatorId: runtime.agentId,
      },
    });
  } catch (error) {
    logger.error('[TrustValidation] Failed to record failed action:', error);
  }
}

/**
 * Example usage in any plugin:
 *
 * import { withTrustValidation, validateActionWithTrust } from '@elizaos/plugin-trust/integrations';
 *
 * export const myAction: Action = {
 *   name: 'MY_SENSITIVE_ACTION',
 *   handler: async (runtime, message, state, options, callback) => {
 *     // Option 1: Use decorator
 *     // @withTrustValidation({
 *     //   action: 'MY_SENSITIVE_ACTION',
 *     //   minimumTrust: 60,
 *     //   requiredDimensions: { integrity: 50 }
 *     // })
 *
 *     // Option 2: Manual validation
 *     const validation = await validateActionWithTrust(runtime, message, {
 *       action: 'MY_SENSITIVE_ACTION',
 *       minimumTrust: 60,
 *       requiredDimensions: { integrity: 50 },
 *     });
 *
 *     if (!validation.allowed) {
 *       return {
 *         text: `Action denied: ${validation.reason}`,
 *         error: true,
 *         trustScore: validation.trustScore,
 *       };
 *     }
 *
 *     // Execute action...
 *     return { text: 'Action completed successfully' };
 *   }
 * };
 */
