import { type IAgentRuntime, type Memory, logger } from '@elizaos/core';
import type { UUID } from '@elizaos/core';

/**
 * Example integration of trust system with plugin-secrets-manager
 * This demonstrates how to add trust checks to secret management operations
 */

/**
 * Secret operation types with different trust requirements
 */
export enum SecretOperation {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LIST = 'LIST',
}

/**
 * Secret sensitivity levels
 */
export enum SecretSensitivity {
  LOW = 'LOW', // Public API keys, non-critical configs
  MEDIUM = 'MEDIUM', // Database URLs, service tokens
  HIGH = 'HIGH', // Admin tokens, private keys
  CRITICAL = 'CRITICAL', // Root passwords, master keys
}

/**
 * Validate secret access with trust requirements
 */
export async function validateSecretAccess(
  runtime: IAgentRuntime,
  message: Memory,
  operation: SecretOperation,
  secretName: string,
  sensitivity: SecretSensitivity = SecretSensitivity.MEDIUM
): Promise<{
  allowed: boolean;
  reason: string;
  trustScore?: number;
  suggestions?: string[];
  requiresElevation?: boolean;
}> {
  try {
    // Get trust engine
    const trustEngine = runtime.getService('trust-engine') as any;
    if (!trustEngine) {
      logger.warn('[SecretsIntegration] Trust engine not available, denying secret access');
      return {
        allowed: false,
        reason: 'Trust engine not available',
      };
    }

    // Calculate required trust based on operation and sensitivity
    const requiredTrust = calculateRequiredTrust(operation, sensitivity);
    const requiredDimensions = getRequiredDimensions(operation, sensitivity);

    // Get trust context
    const trustContext = {
      evaluatorId: runtime.agentId,
      action: `SECRET_${operation}`,
      worldId: message.worldId,
      roomId: message.roomId,
    };

    // Evaluate trust decision
    const trustDecision = await trustEngine.evaluateTrustDecision(
      message.entityId as UUID,
      {
        minimumTrust: requiredTrust,
        dimensions: requiredDimensions,
        minimumInteractions: getMinimumInteractions(sensitivity),
        minimumConfidence: getMinimumConfidence(sensitivity),
      },
      trustContext
    );

    if (!trustDecision.allowed) {
      // Log security event
      const securityModule = runtime.getService('security-module') as any;
      if (securityModule) {
        await securityModule.logSecurityEvent({
          type: 'SECRET_ACCESS_DENIED',
          entityId: message.entityId,
          severity: sensitivity === SecretSensitivity.CRITICAL ? 'critical' : 'high',
          context: {
            operation,
            secretName,
            sensitivity,
            trustScore: trustDecision.trustScore,
            requiredTrust,
          },
          details: {
            reason: trustDecision.reason,
            dimensions: trustDecision.dimensionsChecked,
          },
        });
      }

      // Check if elevation could help
      const requiresElevation =
        trustDecision.trustScore >= requiredTrust - 20 && trustDecision.trustScore >= 60;

      return {
        allowed: false,
        reason: trustDecision.reason,
        trustScore: trustDecision.trustScore,
        suggestions: trustDecision.suggestions,
        requiresElevation,
      };
    }

    // Additional permission check for critical operations
    if (sensitivity === SecretSensitivity.CRITICAL || operation === SecretOperation.DELETE) {
      const permissionSystem = runtime.getService('contextual-permissions') as any;
      if (permissionSystem) {
        const permissionCheck = await permissionSystem.checkAccess({
          entityId: message.entityId,
          action: `SECRET_${operation}`,
          resource: `secret:${secretName}`,
          context: {
            worldId: message.worldId,
            roomId: message.roomId,
          },
        });

        if (!permissionCheck.allowed) {
          return {
            allowed: false,
            reason: `Permission denied: ${permissionCheck.reason}`,
            trustScore: trustDecision.trustScore,
          };
        }
      }
    }

    // Log successful authorization
    logger.info('[SecretsIntegration] Secret access authorized', {
      entityId: message.entityId,
      operation,
      secretName,
      sensitivity,
      trustScore: trustDecision.trustScore,
    });

    // Record positive trust interaction for successful access
    await recordSecretInteraction(runtime, message.entityId, operation, true);

    return {
      allowed: true,
      reason: 'Secret access authorized',
      trustScore: trustDecision.trustScore,
    };
  } catch (error) {
    logger.error('[SecretsIntegration] Error validating secret access:', error);
    return {
      allowed: false,
      reason: 'Secret validation error',
    };
  }
}

/**
 * Calculate required trust level based on operation and sensitivity
 */
function calculateRequiredTrust(
  operation: SecretOperation,
  sensitivity: SecretSensitivity
): number {
  const baseRequirements = {
    [SecretOperation.LIST]: 40,
    [SecretOperation.READ]: 50,
    [SecretOperation.CREATE]: 60,
    [SecretOperation.UPDATE]: 70,
    [SecretOperation.DELETE]: 80,
  };

  const sensitivityMultipliers = {
    [SecretSensitivity.LOW]: 0.8,
    [SecretSensitivity.MEDIUM]: 1.0,
    [SecretSensitivity.HIGH]: 1.2,
    [SecretSensitivity.CRITICAL]: 1.4,
  };

  const baseTrust = baseRequirements[operation];
  const multiplier = sensitivityMultipliers[sensitivity];

  return Math.min(Math.round(baseTrust * multiplier), 100);
}

/**
 * Get required trust dimensions for secret operations
 */
function getRequiredDimensions(operation: SecretOperation, sensitivity: SecretSensitivity): any {
  const baseDimensions: any = {
    integrity: 50,
    competence: 40,
  };

  // Higher requirements for sensitive operations
  if (sensitivity === SecretSensitivity.CRITICAL) {
    baseDimensions.integrity = 70;
    // Transparency requirement commented out as it's not in the base trust dimensions
    // baseDimensions.transparency = 60;
  } else if (sensitivity === SecretSensitivity.HIGH) {
    baseDimensions.integrity = 60;
    // Transparency requirement commented out as it's not in the base trust dimensions
    // baseDimensions.transparency = 50;
  }

  // Additional requirements for destructive operations
  if (operation === SecretOperation.DELETE) {
    baseDimensions.integrity = Math.max(baseDimensions.integrity, 65);
    // Reliability requirement commented out as it's not in the base trust dimensions
    // baseDimensions.reliability = 60;
  } else if (operation === SecretOperation.UPDATE) {
    baseDimensions.competence = Math.max(baseDimensions.competence, 50);
  }

  return baseDimensions;
}

/**
 * Get minimum interactions required based on sensitivity
 */
function getMinimumInteractions(sensitivity: SecretSensitivity): number {
  const interactionRequirements = {
    [SecretSensitivity.LOW]: 2,
    [SecretSensitivity.MEDIUM]: 5,
    [SecretSensitivity.HIGH]: 10,
    [SecretSensitivity.CRITICAL]: 20,
  };

  return interactionRequirements[sensitivity];
}

/**
 * Get minimum confidence required based on sensitivity
 */
function getMinimumConfidence(sensitivity: SecretSensitivity): number {
  const confidenceRequirements = {
    [SecretSensitivity.LOW]: 0.3,
    [SecretSensitivity.MEDIUM]: 0.5,
    [SecretSensitivity.HIGH]: 0.7,
    [SecretSensitivity.CRITICAL]: 0.8,
  };

  return confidenceRequirements[sensitivity];
}

/**
 * Record trust interaction for secret operations
 */
async function recordSecretInteraction(
  runtime: IAgentRuntime,
  entityId: UUID,
  operation: SecretOperation,
  successful: boolean
): Promise<void> {
  try {
    const trustEngine = runtime.getService('trust-engine') as any;
    if (!trustEngine) {
      return;
    }

    const impact = successful ? getPositiveImpact(operation) : getNegativeImpact(operation);
    const evidenceType = successful ? 'HELPFUL_ACTION' : 'HARMFUL_ACTION';

    await trustEngine.recordInteraction({
      sourceEntityId: entityId,
      targetEntityId: runtime.agentId,
      type: evidenceType,
      timestamp: Date.now(),
      impact,
      details: {
        action: `SECRET_${operation}`,
        successful,
        description: `Secret ${operation.toLowerCase()} ${successful ? 'successful' : 'failed'}`,
      },
      context: {
        evaluatorId: runtime.agentId,
      },
    });
  } catch (error) {
    logger.error('[SecretsIntegration] Failed to record trust interaction:', error);
  }
}

/**
 * Get positive impact for successful secret operations
 */
function getPositiveImpact(operation: SecretOperation): number {
  const impacts = {
    [SecretOperation.LIST]: 1,
    [SecretOperation.READ]: 2,
    [SecretOperation.CREATE]: 3,
    [SecretOperation.UPDATE]: 3,
    [SecretOperation.DELETE]: 2, // Lower because it's destructive
  };

  return impacts[operation];
}

/**
 * Get negative impact for failed secret operations
 */
function getNegativeImpact(operation: SecretOperation): number {
  const impacts = {
    [SecretOperation.LIST]: -1,
    [SecretOperation.READ]: -2,
    [SecretOperation.CREATE]: -3,
    [SecretOperation.UPDATE]: -4,
    [SecretOperation.DELETE]: -5, // Higher penalty for failed destructive operations
  };

  return impacts[operation];
}

/**
 * Determine secret sensitivity from name/content patterns
 */
export function classifySecretSensitivity(
  secretName: string,
  secretValue?: string
): SecretSensitivity {
  const name = secretName.toLowerCase();
  const value = secretValue?.toLowerCase() || '';

  // Critical patterns
  if (
    name.includes('root') ||
    name.includes('admin') ||
    name.includes('master') ||
    name.includes('private_key') ||
    name.includes('ssh_key') ||
    value.includes('-----begin private key-----')
  ) {
    return SecretSensitivity.CRITICAL;
  }

  // High sensitivity patterns
  if (
    name.includes('password') ||
    name.includes('token') ||
    name.includes('secret') ||
    name.includes('api_key') ||
    name.includes('auth') ||
    value.startsWith('sk-') ||
    value.startsWith('pk_')
  ) {
    return SecretSensitivity.HIGH;
  }

  // Medium sensitivity patterns
  if (
    name.includes('url') ||
    name.includes('endpoint') ||
    name.includes('host') ||
    name.includes('database') ||
    name.includes('db_') ||
    value.includes('://')
  ) {
    return SecretSensitivity.MEDIUM;
  }

  // Default to low for things like feature flags, non-sensitive configs
  return SecretSensitivity.LOW;
}

/**
 * Example usage in plugin-secrets-manager action handler:
 *
 * export const manageSecretAction: Action = {
 *   name: 'MANAGE_SECRET',
 *   handler: async (runtime, message, state, options, callback) => {
 *     const { operation, secretName, secretValue } = parseSecretRequest(message);
 *
 *     // Classify secret sensitivity
 *     const sensitivity = classifySecretSensitivity(secretName, secretValue);
 *
 *     // Validate with trust system
 *     const validation = await validateSecretAccess(
 *       runtime,
 *       message,
 *       operation,
 *       secretName,
 *       sensitivity
 *     );
 *
 *     if (!validation.allowed) {
 *       return {
 *         text: `Secret access denied: ${validation.reason}`,
 *         error: true,
 *         suggestions: validation.suggestions,
 *         trustScore: validation.trustScore,
 *         requiresElevation: validation.requiresElevation,
 *       };
 *     }
 *
 *     // Execute secret operation if validation passes
 *     return executeSecretOperation(operation, secretName, secretValue);
 *   }
 * };
 */
