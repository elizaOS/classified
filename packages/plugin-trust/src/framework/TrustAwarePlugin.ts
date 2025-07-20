import type { UUID } from '@elizaos/core';
import { type Action, type IAgentRuntime, type Memory, type Plugin, logger } from '@elizaos/core';
import { TrustService } from '../services/TrustService';
import { type ActionPermission, PermissionUtils } from '../types/permissions';

/**
 * Base class for trust-aware plugins
 * Provides automatic trust checking and permission management
 */
export abstract class TrustAwarePlugin implements Plugin {
  protected trustService: TrustService | null = null;

  /**
   * Define required trust levels for actions
   * Override in subclasses
   */
  protected abstract trustRequirements: Record<string, number>;

  /**
   * Define required permissions for actions
   * Override in subclasses
   */
  protected abstract permissions: Record<string, ActionPermission>;

  /**
   * Initialize trust-aware services
   */
  async init(config: Record<string, string>, runtime: IAgentRuntime): Promise<void> {
    // Get trust service
    const trustService = runtime.getService('trust');

    if (trustService && 'trustService' in trustService) {
      this.trustService = (trustService as any).trustService;
    }

    // Wrap actions with trust checking
    if (this.actions) {
      this.actions = this.actions.map((action) => this.wrapAction(action));
    }
  }

  /**
   * Wrap an action with trust and permission checking
   */
  protected wrapAction(action: Action): Action {
    const originalHandler = action.handler;
    const originalValidate = action.validate;

    return {
      ...action,
      validate: async (runtime: IAgentRuntime, message: Memory, state?: any) => {
        // Run original validation first
        if (originalValidate) {
          const valid = await originalValidate(runtime, message, state);
          if (!valid) {
            return false;
          }
        }

        // Check trust requirements
        const trustRequired = this.trustRequirements[action.name];
        if (trustRequired && this.trustService) {
          const trustScore = await this.trustService.getTrustScore(message.entityId);

          if (trustScore.overall < trustRequired) {
            logger.warn(
              `[TrustAware] Insufficient trust for ${action.name}: ${trustScore.overall} < ${trustRequired}`
            );
            return false;
          }
        }

        // Check permissions
        const permission = this.permissions[action.name];
        if (permission && this.trustService) {
          const allowed = await this.checkPermission(runtime, message, permission);
          if (!allowed) {
            logger.warn(`[TrustAware] Permission denied for ${action.name}`);
            return false;
          }
        }

        return true;
      },

      handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: any,
        options?: any,
        callback?: any
      ) => {
        // Log action for audit
        logger.info(`[TrustAware] Audit: ${message.entityId} executing ${action.name}`);

        // Execute original handler
        const result = await originalHandler(runtime, message, state, options, callback);

        // Update trust based on action outcome
        if (this.trustService && result) {
          // Success increases trust slightly
          await this.trustService.updateTrust(message.entityId, 'HELPFUL_ACTION' as any, 1, {
            action: action.name,
            success: true,
          });
        }

        return result;
      },
    };
  }

  /**
   * Check if user has permission to execute action
   */
  protected async checkPermission(
    runtime: IAgentRuntime,
    message: Memory,
    permission: ActionPermission
  ): Promise<boolean> {
    if (!this.trustService) {
      return true;
    } // Fallback to allow if no trust service

    const context = {
      caller: message.entityId,
      action: permission.action,
      trust: 0,
      roles: [] as string[],
    };

    // Get user's trust score
    const trustScore = await this.trustService.getTrustScore(message.entityId);
    context.trust = trustScore.overall;

    // Check unix-style permissions
    return PermissionUtils.canExecute(permission.unix, context);
  }

  /**
   * Get trust level for a user
   */
  protected async getTrustLevel(runtime: IAgentRuntime, userId: UUID): Promise<number> {
    if (!this.trustService) {
      return 0;
    }

    const trustScore = await this.trustService.getTrustScore(userId);

    return trustScore.overall;
  }

  /**
   * Check if user is trusted (>= 80 trust score)
   */
  protected async isTrusted(runtime: IAgentRuntime, userId: UUID): Promise<boolean> {
    const trust = await this.getTrustLevel(runtime, userId);
    return trust >= 80;
  }

  /**
   * Check if user is admin
   */
  protected isAdmin(userId: UUID): boolean {
    // This is a simplified check - in real implementation would check actual roles
    return false;
  }

  /**
   * Check if user is system/agent
   */
  protected isSystem(userId: UUID): boolean {
    return false;
  }

  // Required Plugin properties
  abstract name: string;
  abstract description: string;
  abstract actions?: Action[];
  abstract providers?: any[];
  abstract evaluators?: any[];
  abstract services?: any[];
}

// Example usage
export const exampleTrustAwarePlugin: Plugin = {
  name: 'example-trust-aware',
  description: 'Example of trust-aware plugin',

  actions: [
    {
      name: 'sensitive-action',
      description: 'A sensitive action requiring trust',
      examples: [],
      validate: async (runtime, message) => {
        return true; // Simple validation
      },
      handler: async (runtime, message, state) => {
        const trustServiceWrapper = runtime.getService('trust') as any;
        if (!trustServiceWrapper || !trustServiceWrapper.trustService) {
          logger.error('Trust service not available');
          return {
            success: false,
            text: 'Trust service not available',
            values: { success: false },
            data: { error: 'Trust service not available' },
          };
        }

        const trustService = trustServiceWrapper.trustService as TrustService;
        const entityId = message.entityId;

        if (!entityId) {
          return {
            success: false,
            text: 'No entity ID found in message',
            values: { success: false },
            data: { error: 'No entity ID found' },
          };
        }

        // Check if the entity has permission to perform this sensitive action
        const hasAccess = await trustService.checkPermission(
          entityId,
          'sensitive-action' as any,
          runtime.agentId,
          {
            roomId: message.roomId,
          }
        );

        if (!hasAccess.allowed) {
          return {
            success: false,
            text: 'Access denied: insufficient trust level or missing permissions',
            values: { 
              success: false,
              allowed: false,
              reason: hasAccess.reason,
            },
            data: { 
              error: 'Access denied',
              reason: hasAccess.reason,
              method: hasAccess.method,
              grantedBy: hasAccess.grantedBy,
            },
          };
        }

        // Execute the sensitive action
        logger.info('Executing sensitive action with trust verification');
        
        return {
          success: true,
          text: 'Sensitive action executed successfully',
          values: { 
            success: true,
            allowed: true,
          },
          data: { 
            actionName: 'sensitive-action',
            executedBy: entityId,
            timestamp: Date.now(),
          },
        };
      },
    },
  ],
};
