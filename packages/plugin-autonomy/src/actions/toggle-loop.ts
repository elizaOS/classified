import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  ActionExample,
  parseBooleanFromText as _parseBooleanFromText,
} from '@elizaos/core';
import { AutonomousLoopService } from '../loop-service.js';

export const toggleLoopAction: Action = {
  name: 'TOGGLE_AUTONOMOUS_LOOP',
  similes: ['TOGGLE_LOOP', 'START_LOOP', 'STOP_LOOP', 'AUTONOMOUS_TOGGLE'],
  description: 'Toggle the autonomous loop on or off, or set a specific interval',

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Start the autonomous loop' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Starting the autonomous loop. I will now think and act continuously.',
          actions: ['TOGGLE_AUTONOMOUS_LOOP'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Stop being autonomous' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Stopping the autonomous loop. I will now only respond when directly addressed.',
          actions: ['TOGGLE_AUTONOMOUS_LOOP'],
        },
      },
    ],
    [
      {
        name: '{{user1}}',
        content: { text: 'Set autonomous interval to 60 seconds' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Setting autonomous loop interval to 60 seconds.',
          actions: ['TOGGLE_AUTONOMOUS_LOOP'],
        },
      },
    ],
  ] as ActionExample[][],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    const autonomousKeywords = [
      'autonomous',
      'auto',
      'loop',
      'continuous',
      'start thinking',
      'stop thinking',
    ];

    const actionKeywords = [
      'start',
      'stop',
      'toggle',
      'turn on',
      'turn off',
      'enable',
      'disable',
      'set interval',
    ];

    const hasAutonomousKeyword = autonomousKeywords.some((keyword) => text.includes(keyword));
    const hasActionKeyword = actionKeywords.some((keyword) => text.includes(keyword));

    return hasAutonomousKeyword && hasActionKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    try {
      const service = runtime.getService<AutonomousLoopService>('autonomous-loop');
      if (!service) {
        throw new Error('Autonomous loop service not available');
      }

      const text = message.content.text?.toLowerCase() || '';
      let responseText = '';

      // Check for interval setting
      const intervalMatch = text.match(/(\d+)\s*(second|minute|hour)/i);
      if (intervalMatch) {
        const value = parseInt(intervalMatch[1], 10);
        const unit = intervalMatch[2].toLowerCase();

        let ms = value * 1000; // Default to seconds
        if (unit.startsWith('minute')) {
          ms *= 60;
        }
        if (unit.startsWith('hour')) {
          ms *= 3600;
        }

        service.setLoopInterval(ms);
        responseText = `Set autonomous loop interval to ${value} ${unit}${value > 1 ? 's' : ''}.`;

        if (!service.isLoopRunning()) {
          await service.startLoop();
          responseText += ' Started the autonomous loop.';
        }
      }
      // Check for start/enable commands
      else if (text.includes('start') || text.includes('enable') || text.includes('turn on')) {
        if (service.isLoopRunning()) {
          responseText = 'Autonomous loop is already running.';
        } else {
          await service.startLoop();
          responseText = 'Started the autonomous loop. I will now think and act continuously.';
        }
      }
      // Check for stop/disable commands
      else if (text.includes('stop') || text.includes('disable') || text.includes('turn off')) {
        if (!service.isLoopRunning()) {
          responseText = 'Autonomous loop is already stopped.';
        } else {
          await service.stopLoop();
          responseText =
            'Stopped the autonomous loop. I will now only respond when directly addressed.';
        }
      }
      // Toggle command
      else {
        if (service.isLoopRunning()) {
          await service.stopLoop();
          responseText = 'Stopped the autonomous loop.';
        } else {
          await service.startLoop();
          responseText = 'Started the autonomous loop.';
        }
      }

      // Add status info
      const status = service.isLoopRunning() ? 'running' : 'stopped';
      const interval = Math.round(service.getLoopInterval() / 1000);
      responseText += ` (Status: ${status}, Interval: ${interval}s)`;

      if (callback) {
        await callback({
          text: responseText,
          data: {
            status: service.isLoopRunning() ? 'running' : 'stopped',
            interval: service.getLoopInterval(),
          },
        });
      }

      return true;
    } catch (error) {
      console.error('[ToggleLoop] Error:', error);

      if (callback) {
        await callback({
          text: `Error managing autonomous loop: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }

      return false;
    }
  },
};
