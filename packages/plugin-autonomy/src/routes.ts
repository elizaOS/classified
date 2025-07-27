import type { Route } from '@elizaos/core';

/**
 * Simple API routes for controlling autonomy via settings
 */
export const autonomyRoutes: Route[] = [
  {
    path: '/autonomy/status',
    type: 'GET',
    handler: async (req: any, res: any, runtime: any) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy');

        if (!autonomyService) {
          return res.status(503).json({
            error: 'Autonomy service not available',
          });
        }

        const status = (autonomyService as any).getStatus();

        return res.json({
          success: true,
          data: {
            enabled: status.enabled,
            running: status.running,
            interval: status.interval,
            intervalSeconds: Math.round(status.interval / 1000),
            autonomousRoomId: status.autonomousRoomId,
            agentId: runtime.agentId,
            characterName: runtime.character?.name || 'Agent',
          },
        });
      } catch (error) {
        console.error('[AutonomyAPI] Status error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  },

  {
    path: '/autonomy/enable',
    type: 'POST',
    handler: async (req: any, res: any, runtime: any) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        await (autonomyService as any).enableAutonomy();
        const status = (autonomyService as any).getStatus();

        return res.json({
          success: true,
          message: 'Autonomy enabled',
          data: {
            enabled: status.enabled,
            running: status.running,
            interval: status.interval,
          },
        });
      } catch (error) {
        console.error('[AutonomyAPI] Enable error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  },

  {
    path: '/autonomy/disable',
    type: 'POST',
    handler: async (req: any, res: any, runtime: any) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        await (autonomyService as any).disableAutonomy();
        const status = (autonomyService as any).getStatus();

        return res.json({
          success: true,
          message: 'Autonomy disabled',
          data: {
            enabled: status.enabled,
            running: status.running,
            interval: status.interval,
          },
        });
      } catch (error) {
        console.error('[AutonomyAPI] Disable error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  },

  {
    path: '/autonomy/toggle',
    type: 'POST',
    handler: async (req: any, res: any, runtime: any) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        const currentStatus = (autonomyService as any).getStatus();

        if (currentStatus.enabled) {
          await (autonomyService as any).disableAutonomy();
        } else {
          await (autonomyService as any).enableAutonomy();
        }

        const newStatus = (autonomyService as any).getStatus();

        return res.json({
          success: true,
          message: newStatus.enabled ? 'Autonomy enabled' : 'Autonomy disabled',
          data: {
            enabled: newStatus.enabled,
            running: newStatus.running,
            interval: newStatus.interval,
          },
        });
      } catch (error) {
        console.error('[AutonomyAPI] Toggle error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  },

  {
    path: '/autonomy/interval',
    type: 'POST',
    handler: async (req: any, res: any, runtime: any) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        const { interval } = req.body;

        if (typeof interval !== 'number' || interval < 5000 || interval > 600000) {
          return res.status(400).json({
            success: false,
            error: 'Interval must be a number between 5000ms (5s) and 600000ms (10m)',
          });
        }

        (autonomyService as any).setLoopInterval(interval);
        const status = (autonomyService as any).getStatus();

        return res.json({
          success: true,
          message: 'Interval updated',
          data: {
            interval: status.interval,
            intervalSeconds: Math.round(status.interval / 1000),
          },
        });
      } catch (error) {
        console.error('[AutonomyAPI] Interval error:', error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  },
];
