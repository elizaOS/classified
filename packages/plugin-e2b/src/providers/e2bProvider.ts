import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core';
import { elizaLogger } from '@elizaos/core';
import type { E2BService } from '../services/E2BService.js';

export const e2bProvider: Provider = {
  name: 'e2b',
  description: 'Provides E2B sandbox status and execution context for code execution decisions',

  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    try {
      const e2bService = runtime.getService<E2BService>('e2b');

      if (!e2bService) {
        return {
          text: 'E2B service is not available',
          data: { available: false },
        };
      }

      // Get current sandbox status
      const sandboxes = e2bService.listSandboxes();
      const isHealthy = await e2bService.isHealthy();

      // Determine if code execution is currently possible
      const canExecuteCode = isHealthy && sandboxes.some((s) => s.isActive);

      // Get the most recent active sandbox
      const activeSandboxes = sandboxes.filter((s) => s.isActive);
      const latestSandbox = activeSandboxes.sort(
        (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
      )[0];

      // Calculate total uptime and activity stats
      const totalUptime = sandboxes.reduce((total, s) => {
        return total + (Date.now() - s.createdAt.getTime());
      }, 0);

      const recentActivity = latestSandbox
        ? Date.now() - latestSandbox.lastActivity.getTime()
        : null;

      // Provide contextual information
      let contextText = '';

      if (!isHealthy) {
        contextText = 'E2B sandboxes are currently unavailable. Code execution is not possible.';
      } else if (activeSandboxes.length === 0) {
        contextText =
          'No active sandboxes. A new sandbox will be created automatically for code execution.';
      } else if (recentActivity && recentActivity < 60000) {
        // Less than 1 minute
        contextText = `Active sandbox available (${activeSandboxes.length} total). Recent activity detected. Ready for immediate code execution.`;
      } else if (recentActivity && recentActivity < 300000) {
        // Less than 5 minutes
        contextText = `Active sandbox available (${activeSandboxes.length} total). Last used ${Math.round(recentActivity / 1000)} seconds ago. Ready for code execution.`;
      } else {
        contextText = `Active sandbox available (${activeSandboxes.length} total). May need warming up for optimal performance.`;
      }

      // Provide execution recommendations
      const recommendations = [];

      if (canExecuteCode) {
        recommendations.push('Code execution is available');

        if (activeSandboxes.length > 3) {
          recommendations.push('Multiple sandboxes active - consider cleanup');
        }

        if (recentActivity && recentActivity > 600000) {
          // 10+ minutes
          recommendations.push('Sandbox may be idle - expect slight startup delay');
        }
      } else {
        recommendations.push('Code execution currently unavailable');
        recommendations.push('Check E2B service configuration');
      }

      return {
        text: contextText,
        values: {
          canExecuteCode,
          isHealthy,
          activeSandboxCount: activeSandboxes.length,
          totalSandboxCount: sandboxes.length,
          recentActivityMs: recentActivity,
          hasRecentActivity: recentActivity ? recentActivity < 300000 : false,
        },
        data: {
          available: true,
          service: 'e2b',
          sandboxes: sandboxes.map((s) => ({
            id: s.sandboxId,
            isActive: s.isActive,
            template: s.template,
            uptime: Date.now() - s.createdAt.getTime(),
            lastActivity: Date.now() - s.lastActivity.getTime(),
            metadata: s.metadata,
          })),
          capabilities: {
            codeExecution: canExecuteCode,
            multipleLanguages: true,
            fileOperations: true,
            internetAccess: true,
            packageInstallation: true,
          },
          recommendations,
          stats: {
            totalUptime,
            averageUptimePerSandbox: sandboxes.length > 0 ? totalUptime / sandboxes.length : 0,
            oldestSandbox:
              sandboxes.length > 0
                ? Math.min(...sandboxes.map((s) => Date.now() - s.createdAt.getTime()))
                : null,
          },
        },
      };
    } catch (error) {
      elizaLogger.error('E2B provider error', { error: (error as Error).message });

      return {
        text: 'E2B status check failed',
        values: {
          canExecuteCode: false,
          isHealthy: false,
          error: (error as Error).message,
        },
        data: {
          available: false,
          error: (error as Error).message,
        },
      };
    }
  },
};
