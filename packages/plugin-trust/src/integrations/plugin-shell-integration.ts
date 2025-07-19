import { type IAgentRuntime, type Memory, logger } from '@elizaos/core';
import type { UUID } from '@elizaos/core';

/**
 * Example integration of trust system with plugin-shell
 * This demonstrates how to add trust checks to dangerous shell operations
 */

/**
 * Wrap shell action with trust validation
 * This is an example of how other plugins should integrate with the trust system
 */
export async function validateShellCommand(
  runtime: IAgentRuntime,
  message: Memory,
  command: string
): Promise<{
  allowed: boolean;
  reason: string;
  trustScore?: number;
  suggestions?: string[];
}> {
  try {
    // Get trust middleware
    const trustEngine = runtime.getService('trust-engine') as any;
    if (!trustEngine) {
      logger.warn('[ShellIntegration] Trust engine not available, denying shell access');
      return {
        allowed: false,
        reason: 'Trust engine not available',
      };
    }

    // Assess command danger level
    const dangerLevel = assessCommandDanger(command);
    const requiredTrust = getDangerBasedTrustRequirement(dangerLevel);

    // Get the entity ID from the message
    const entityId = message.agentId as UUID;

    // Get trust context
    const trustContext = {
      evaluatorId: runtime.agentId,
      action: 'EXECUTE_SHELL_COMMAND',
      worldId: message.roomId,
      roomId: message.roomId,
    };

    // Calculate trust
    const trustProfile = await trustEngine.calculateTrust(entityId, trustContext);

    // Check if trust is sufficient
    if (trustProfile.overallTrust < requiredTrust) {
      // Log security event
      const securityModule = runtime.getService('security-module') as any;
      if (securityModule) {
        await securityModule.logSecurityEvent({
          type: 'SHELL_ACCESS_DENIED',
          entityId,
          severity: dangerLevel > 3 ? 'high' : 'medium',
          context: {
            command,
            trustScore: trustProfile.overallTrust,
            requiredTrust,
            dangerLevel,
          },
          details: {
            command,
            reason: 'insufficient_trust',
          },
        });
      }

      return {
        allowed: false,
        reason: `Insufficient trust for shell command (${trustProfile.overallTrust}/${requiredTrust} required)`,
        trustScore: trustProfile.overallTrust,
        suggestions: [
          'Build trust through positive interactions',
          'Start with safer commands',
          `Your trust level: ${trustProfile.overallTrust.toFixed(1)}/100`,
          `Required for this command: ${requiredTrust}/100`,
        ],
      };
    }

    // Additional checks for high-risk commands
    if (dangerLevel >= 4) {
      const permissionSystem = runtime.getService('contextual-permissions') as any;
      if (permissionSystem) {
        const permissionCheck = await permissionSystem.checkAccess({
          entityId,
          action: 'EXECUTE_SHELL_COMMAND',
          resource: 'system',
          context: {
            worldId: message.roomId,
            roomId: message.roomId,
          },
        });

        if (!permissionCheck.allowed) {
          return {
            allowed: false,
            reason: `Permission denied: ${permissionCheck.reason}`,
            trustScore: trustProfile.overallTrust,
          };
        }
      }
    }

    // Log successful authorization
    logger.info('[ShellIntegration] Shell command authorized', {
      userId: entityId,
      command: command.substring(0, 50),
      trustScore: trustProfile.overallTrust,
      dangerLevel,
    });

    return {
      allowed: true,
      reason: 'Shell command authorized',
      trustScore: trustProfile.overallTrust,
    };
  } catch (error) {
    logger.error('[ShellIntegration] Error validating shell command:', error);
    return {
      allowed: false,
      reason: 'Trust validation error',
    };
  }
}

/**
 * Assess the danger level of a shell command
 * Returns 1-5 (1 = safe, 5 = extremely dangerous)
 */
function assessCommandDanger(command: string): number {
  const cmd = command.toLowerCase().trim();

  // Extremely dangerous commands (5)
  const criticalPatterns = [
    /rm\s+-rf\s+\//,
    /dd\s+if=.*of=\/dev\/sd/,
    /mkfs/,
    /fdisk/,
    /parted/,
    /shutdown/,
    /reboot/,
    /init\s+0/,
    /halt/,
    /:(){:|:&};:/,
    /chmod\s+777\s+\//,
    /chown\s+.*\s+\//,
  ];

  // High danger commands (4)
  const highDangerPatterns = [
    /rm\s+-rf/,
    /rm\s+-r/,
    /sudo\s+rm/,
    />\/etc\//,
    /crontab/,
    /passwd/,
    /userdel/,
    /usermod/,
    /groupdel/,
    /systemctl\s+disable/,
    /service\s+.*\s+stop/,
    /kill\s+-9/,
    /pkill/,
    /killall/,
  ];

  // Medium danger commands (3)
  const mediumDangerPatterns = [
    /rm\s+/,
    /mv\s+.*\s+\/dev\/null/,
    />\s*\/dev\/null/,
    /sudo/,
    /su\s+/,
    /chmod/,
    /chown/,
    /find.*-delete/,
    /systemctl/,
    /service/,
    /mount/,
    /umount/,
  ];

  // Low danger commands (2)
  const lowDangerPatterns = [
    /cp\s+/,
    /mv\s+/,
    /mkdir/,
    /touch/,
    /nano/,
    /vim/,
    /emacs/,
    /git\s+/,
    /npm\s+install/,
    /pip\s+install/,
    /curl/,
    /wget/,
  ];

  // Check patterns in order of danger
  for (const pattern of criticalPatterns) {
    if (pattern.test(cmd)) {
      return 5;
    }
  }
  for (const pattern of highDangerPatterns) {
    if (pattern.test(cmd)) {
      return 4;
    }
  }
  for (const pattern of mediumDangerPatterns) {
    if (pattern.test(cmd)) {
      return 3;
    }
  }
  for (const pattern of lowDangerPatterns) {
    if (pattern.test(cmd)) {
      return 2;
    }
  }

  // Default to safe (1) for simple commands like ls, ps, etc.
  return 1;
}

/**
 * Get required trust level based on command danger
 */
function getDangerBasedTrustRequirement(dangerLevel: number): number {
  const trustMapping = {
    1: 30, // Safe commands: ls, ps, pwd
    2: 50, // Low danger: cp, mv, git
    3: 70, // Medium danger: chmod, sudo
    4: 85, // High danger: rm -rf, kill
    5: 95, // Critical: rm -rf /, shutdown
  };

  return trustMapping[dangerLevel as keyof typeof trustMapping] || 50;
}

/**
 * Example usage in plugin-shell action handler:
 *
 * export const shellAction: Action = {
 *   name: 'EXECUTE_SHELL_COMMAND',
 *   handler: async (runtime, message, state, options, callback) => {
 *     const command = extractCommandFromMemory(message);
 *
 *     // Validate with trust system
 *     const validation = await validateShellCommand(runtime, message, command);
 *
 *     if (!validation.allowed) {
 *       return {
 *         text: `Command denied: ${validation.reason}`,
 *         error: true,
 *         suggestions: validation.suggestions,
 *         trustScore: validation.trustScore,
 *       };
 *     }
 *
 *     // Execute command if validation passes
 *     return executeShellCommand(command);
 *   }
 * };
 */
