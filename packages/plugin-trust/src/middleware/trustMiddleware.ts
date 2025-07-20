import {
  type Action,
  type ActionResult,
  type IAgentRuntime,
  logger,
  type Memory,
  type Plugin,
  type HandlerCallback,
} from '@elizaos/core';
import { TrustService } from '../services/TrustService';
import type { UUID } from '@elizaos/core';
import { TrustEvidenceType } from '../types/trust';
import { getTrustRequirement, requiresElevatedTrust } from './trustRequirements';

/**
 * Trust middleware for wrapping actions with trust verification
 */
export class TrustMiddleware {
  /**
   * Wrap a single action with trust checking
   * @param action The action to wrap
   * @param requiredTrust Optional custom trust requirement (overrides default)
   * @returns The wrapped action with trust verification
   */
  static wrapAction(action: Action, requiredTrust?: number): Action {
    const originalHandler = action.handler;
    const originalValidate = action.validate;

    return {
      ...action,
      validate: async (runtime: IAgentRuntime, message: Memory, state?: any) => {
        // Run original validation first
        if (originalValidate) {
          const valid = await originalValidate(runtime, message, state);
          if (!valid) {
            logger.debug(`[TrustMiddleware] Original validation failed for ${action.name}`);
            return false;
          }
        }

        // Skip trust check for system/agent messages
        if (message.entityId === runtime.agentId) {
          logger.debug(`[TrustMiddleware] Skipping trust check for agent action ${action.name}`);
          return true;
        }

        // Get trust engine from service
        const trustServiceWrapper = runtime.getService('trust');
        if (!trustServiceWrapper) {
          logger.error('[TrustMiddleware] Trust service not available');
          // Fail closed - if trust service is not available, deny access
          return false;
        }

        try {
          const trustServiceAny = trustServiceWrapper as any;
          const actualTrustService = trustServiceAny?.trustService as TrustService;
          if (!actualTrustService) {
            logger.error('[TrustMiddleware] Trust service not initialized');
            return false;
          }

          // Calculate current trust level
          const trustScore = await actualTrustService.getTrustScore(message.entityId);

          // Get required trust level
          const required =
            requiredTrust !== undefined ? requiredTrust : getTrustRequirement(action.name);

          // Check if trust is sufficient
          if (trustScore.overall < required) {
            logger.warn(
              `[TrustMiddleware] Insufficient trust for ${action.name}: ` +
                `${trustScore.overall.toFixed(1)} < ${required} for entity ${message.entityId}`
            );

            // Record failed attempt
            await actualTrustService.updateTrust(
              message.entityId,
              TrustEvidenceType.SECURITY_VIOLATION,
              -1,
              {
                action: action.name,
                requiredTrust: required,
                actualTrust: trustScore.overall,
                reason: 'insufficient_trust',
              }
            );

            return false;
          }

          logger.debug(
            `[TrustMiddleware] Trust check passed for ${action.name}: ` +
              `${trustScore.overall.toFixed(1)} >= ${required}`
          );

          return true;
        } catch (error) {
          logger.error(`[TrustMiddleware] Error checking trust for ${action.name}:`, error);
          // Fail closed on errors
          return false;
        }
      },

      handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: any,
        options?: any,
        callback?: HandlerCallback
      ): Promise<ActionResult> => {
        const startTime = Date.now();
        const isElevated = requiresElevatedTrust(action.name);

        // Log action execution for audit
        logger.info(
          `[TrustMiddleware] ${isElevated ? '⚠️ ELEVATED' : '✓'} Executing ${action.name} ` +
            `for entity ${message.entityId} in room ${message.roomId}`
        );

        try {
          // Execute original handler
          const result = await originalHandler(runtime, message, state, options, callback as any);

          // Record successful interaction
          const trustServiceWrapper = runtime.getService('trust');
          if (trustServiceWrapper) {
            const trustServiceAny = trustServiceWrapper as any;
            const actualTrustService = trustServiceAny?.trustService as TrustService;
            if (actualTrustService) {
              await actualTrustService.updateTrust(
                message.entityId,
                TrustEvidenceType.HELPFUL_ACTION,
                isElevated ? 2 : 1, // Higher impact for elevated actions
                {
                  action: action.name,
                  duration: Date.now() - startTime,
                  elevated: isElevated,
                }
              );
            }
          }

          // Ensure we always return ActionResult format
          if (!result || typeof result === 'boolean') {
            return {
              values: { success: !!result },
              data: { action: action.name, executed: true },
              text: result
                ? `Action ${action.name} executed successfully`
                : `Action ${action.name} returned false`,
              success: !!result,
            };
          }
          return result;
        } catch (error) {
          // Record failed interaction
          const trustServiceWrapper = runtime.getService('trust');
          if (trustServiceWrapper) {
            const trustServiceAny = trustServiceWrapper as any;
            const actualTrustService = trustServiceAny?.trustService as TrustService;
            if (actualTrustService) {
              await actualTrustService.updateTrust(
                message.entityId,
                TrustEvidenceType.HARMFUL_ACTION,
                isElevated ? -3 : -2, // Higher penalty for elevated actions
                {
                  action: action.name,
                  error: error instanceof Error ? error.message : String(error),
                  duration: Date.now() - startTime,
                  elevated: isElevated,
                }
              );
            }
          }

          logger.error(
            `[TrustMiddleware] Action ${action.name} failed for entity ${message.entityId}:`,
            error
          );

          throw error;
        }
      },
    };
  }

  /**
   * Wrap all actions in a plugin with trust checking
   * @param plugin The plugin to wrap
   * @param trustOverrides Optional map of action names to custom trust requirements
   * @returns The plugin with all actions wrapped
   */
  static wrapPlugin(plugin: Plugin, trustOverrides?: Map<string, number>): Plugin {
    if (!plugin.actions || plugin.actions.length === 0) {
      // No actions to wrap
      return plugin;
    }

    logger.info(
      `[TrustMiddleware] Wrapping ${plugin.actions.length} actions in plugin ${plugin.name}`
    );

    return {
      ...plugin,
      actions: plugin.actions.map((actionItem) => {
        // Handle actions directly (no component wrapper needed)
        const action = actionItem as Action;
        const customTrust = trustOverrides?.get(action.name);
        return TrustMiddleware.wrapAction(action, customTrust);
      }),
    };
  }

  /**
   * Get a summary of trust requirements for a plugin
   * @param plugin The plugin to analyze
   * @returns Map of action names to trust requirements
   */
  static getPluginTrustRequirements(plugin: Plugin): Map<string, number> {
    const requirements = new Map<string, number>();

    if (plugin.actions) {
      for (const actionItem of plugin.actions) {
        // Handle actions directly
        const action = actionItem as Action;
        requirements.set(action.name, getTrustRequirement(action.name));
      }
    }

    return requirements;
  }

  /**
   * Check if a user has sufficient trust for an action without executing it
   * @param runtime The agent runtime
   * @param userId The user ID to check
   * @param actionName The action name
   * @returns True if the user has sufficient trust
   */
  static async canExecuteAction(
    runtime: IAgentRuntime,
    userId: UUID,
    actionName: string
  ): Promise<boolean> {
    const trustServiceWrapper = runtime.getService('trust');
    if (!trustServiceWrapper) {
      return false;
    }

    try {
      const trustServiceAny = trustServiceWrapper as any;
      const actualTrustService = trustServiceAny?.trustService as TrustService;
      const trustScore = await actualTrustService.getTrustScore(userId);

      const required = getTrustRequirement(actionName);
      return trustScore.overall >= required;
    } catch (error) {
      logger.error('[TrustMiddleware] Error checking action permission:', error);
      return false;
    }
  }
}
