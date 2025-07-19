import { type Route, type IAgentRuntime } from '@elizaos/core';
import { AutonomousLoopService } from './loop-service.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Define the equivalent of __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the path to the frontend distribution directory
const frontendDist = path.resolve(__dirname, '../dist');
const assetsPath = path.resolve(frontendDist, 'assets');

export const autonomyRoutes: Route[] = [
  // Frontend UI routes
  {
    path: '/autonomy',
    type: 'GET',
    public: true,
    name: 'Autonomy UI',
    handler: async (_req: any, res: any, _runtime: IAgentRuntime) => {
      const indexPath = path.resolve(frontendDist, 'index.html');
      if (fs.existsSync(indexPath)) {
        const htmlContent = fs.readFileSync(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
      } else {
        res.status(404).send('Autonomy UI not found. Please build the frontend.');
      }
    },
  },
  {
    path: '/autonomy/assets/*',
    type: 'GET',
    public: true,
    name: 'Autonomy Assets',
    handler: async (req: any, res: any, _runtime: IAgentRuntime) => {
      const assetRelativePath = req.params[0];
      if (!assetRelativePath) {
        return res.status(400).send('Invalid asset path');
      }

      const filePath = path.resolve(assetsPath, assetRelativePath);

      // Basic security check to prevent path traversal
      if (!filePath.startsWith(assetsPath)) {
        return res.status(403).send('Forbidden');
      }

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).send('Asset not found');
      }
    },
  },
  // API routes
  {
    path: '/autonomy/status',
    type: 'GET',
    public: true,
    name: 'Get Autonomy Status',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService<AutonomousLoopService>('autonomous-loop');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        const status = autonomyService.getStatus();

        res.json({
          success: true,
          data: {
            enabled: status.enabled,
            interval: status.interval,
            agentId: runtime.agentId,
            characterName: runtime.character.name,
          },
        });
      } catch (error) {
        console.error('[Autonomy API] Error getting status:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get autonomy status',
        });
      }
    },
  },

  {
    path: '/autonomy/enable',
    type: 'POST',
    public: true,
    name: 'Enable Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService<AutonomousLoopService>('autonomous-loop');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        await autonomyService.startLoop();

        res.json({
          success: true,
          message: 'Autonomy enabled successfully',
          data: {
            enabled: true,
            interval: autonomyService.getLoopInterval(),
            agentId: runtime.agentId,
          },
        });
      } catch (error) {
        console.error('[Autonomy API] Error enabling autonomy:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to enable autonomy',
        });
      }
    },
  },

  {
    path: '/autonomy/disable',
    type: 'POST',
    public: true,
    name: 'Disable Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService<AutonomousLoopService>('autonomous-loop');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        await autonomyService.stopLoop();

        res.json({
          success: true,
          message: 'Autonomy disabled successfully',
          data: {
            enabled: false,
            interval: autonomyService.getLoopInterval(),
            agentId: runtime.agentId,
          },
        });
      } catch (error) {
        console.error('[Autonomy API] Error disabling autonomy:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to disable autonomy',
        });
      }
    },
  },

  {
    path: '/autonomy/toggle',
    type: 'POST',
    public: true,
    name: 'Toggle Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService<AutonomousLoopService>('autonomous-loop');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        const currentStatus = autonomyService.getStatus();

        if (currentStatus.enabled) {
          await autonomyService.stopLoop();
        } else {
          await autonomyService.startLoop();
        }

        const newStatus = autonomyService.getStatus();

        res.json({
          success: true,
          message: `Autonomy ${newStatus.enabled ? 'enabled' : 'disabled'} successfully`,
          data: {
            enabled: newStatus.enabled,
            interval: newStatus.interval,
            agentId: runtime.agentId,
          },
        });
      } catch (error) {
        console.error('[Autonomy API] Error toggling autonomy:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to toggle autonomy',
        });
      }
    },
  },

  {
    path: '/autonomy/interval',
    type: 'POST',
    public: true,
    name: 'Set Autonomy Interval',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService<AutonomousLoopService>('autonomous-loop');

        if (!autonomyService) {
          return res.status(503).json({
            success: false,
            error: 'Autonomy service not available',
          });
        }

        const { interval } = req.body;

        if (!interval || typeof interval !== 'number' || interval < 1000) {
          return res.status(400).json({
            success: false,
            error: 'Invalid interval. Must be a number >= 1000 (milliseconds)',
          });
        }

        autonomyService.setLoopInterval(interval);

        res.json({
          success: true,
          message: 'Autonomy interval updated successfully',
          data: {
            interval: autonomyService.getLoopInterval(),
            enabled: autonomyService.getStatus().enabled,
            agentId: runtime.agentId,
          },
        });
      } catch (error) {
        console.error('[Autonomy API] Error setting interval:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to set autonomy interval',
        });
      }
    },
  },
];
