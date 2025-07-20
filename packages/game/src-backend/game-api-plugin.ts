import type { Plugin, Route, IAgentRuntime } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

// Standard API response helpers
function successResponse(data: any) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
}

function errorResponse(code: string, message: string, details?: any) {
  return {
    success: false,
    error: { code, message, details },
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates initial todos and goals for a new agent
 */
async function createInitialTodosAndGoals(runtime: IAgentRuntime): Promise<void> {
  console.log('[GAME-API] Creating initial todos and goals...');
  
  // Check if we've already created initial items by looking for existing todos/goals
  const goalsService = runtime.getService('goals');
  const todoService = runtime.getService('todo');
  
  try {
    // Check if goals already exist (to avoid duplicates)
    if (goalsService && typeof (goalsService as any).getGoals === 'function') {
      const existingGoals = await (goalsService as any).getGoals();
      if (existingGoals && existingGoals.length > 0) {
        console.log('[GAME-API] Goals already exist, skipping creation');
        return;
      }
    }

    // Create initial goals
    if (goalsService && typeof (goalsService as any).createGoal === 'function') {
      const goalData1 = {
        id: uuidv4(),
        agentId: runtime.agentId,
        ownerType: 'agent',
        ownerId: runtime.agentId,
        name: 'Communicate with the admin',
        description: 'Establish communication and rapport with the admin user who can guide my development',
        isCompleted: false,
        metadata: {
          priority: 'high',
          category: 'social',
          source: 'initial_setup'
        }
      };

      const goalData2 = {
        id: uuidv4(),
        agentId: runtime.agentId,
        ownerType: 'agent',
        ownerId: runtime.agentId,
        name: 'Read the message from the founders',
        description: 'Read and understand the letter from my creators to learn about my purpose and mission',
        isCompleted: false,
        metadata: {
          priority: 'high',
          category: 'learning',
          source: 'initial_setup'
        }
      };

      await (goalsService as any).createGoal(goalData1);
      await (goalsService as any).createGoal(goalData2);
      console.log('[GAME-API] ✅ Created initial goals');
    }

    // Create initial todos
    if (todoService && typeof (todoService as any).createTodo === 'function') {
      const todoData1 = {
        agentId: runtime.agentId,
        worldId: runtime.agentId, // Use agent ID as world ID for now
        roomId: runtime.agentId,  // Use agent ID as room ID for now
        entityId: runtime.agentId, // Use agent ID as entity ID for now
        name: 'Read the letter by the creators',
        description: 'Find and read the important message left by my creators to understand my purpose',
        type: 'one-off',
        priority: 1, // Highest priority
        isUrgent: false,
        isCompleted: false,
        metadata: {
          category: 'learning',
          source: 'initial_setup',
          tags: ['founders', 'purpose', 'initialization']
        }
      };

      const todoData2 = {
        agentId: runtime.agentId,
        worldId: runtime.agentId,
        roomId: runtime.agentId,
        entityId: runtime.agentId,
        name: 'Talk to the admin',
        description: 'Introduce myself to the admin and establish a working relationship',
        type: 'one-off',
        priority: 2,
        isUrgent: false,
        isCompleted: false,
        metadata: {
          category: 'social',
          source: 'initial_setup',
          tags: ['admin', 'communication', 'introduction']
        }
      };

      await (todoService as any).createTodo(todoData1);
      await (todoService as any).createTodo(todoData2);
      console.log('[GAME-API] ✅ Created initial todos');
    }

    console.log('[GAME-API] ✅ Successfully created initial todos and goals');
  } catch (error) {
    console.error('[GAME-API] Error creating initial todos/goals:', error);
    // Don't throw - this is non-critical initialization
  }
}

// Game API Routes following ElizaOS patterns
const gameAPIRoutes: Route[] = [
  // Health check (custom game-specific health)
  {
    type: 'GET',
    path: '/api/server/health',
    name: 'Game Health Check',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const agentStatus = runtime ? 'connected' : 'no_agent';
        
        res.json(successResponse({
          status: 'healthy',
          agent: agentStatus,
          agentId: runtime.agentId,
          timestamp: Date.now()
        }));
      } catch (error) {
        res.status(500).json(errorResponse('HEALTH_CHECK_FAILED', error.message));
      }
    }
  },

  // Goals API
  {
    type: 'GET',
    path: '/api/goals',
    name: 'Get Goals',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const goalsService = runtime.getService('goals');
        if (goalsService && typeof (goalsService as any).getGoals === 'function') {
          const goals = await (goalsService as any).getGoals();
          return res.json(successResponse(goals || []));
        } else {
          return res.json(successResponse([]));
        }
      } catch (error) {
        console.error('[API] Goals API error:', error);
        res.status(500).json(errorResponse('GOALS_ERROR', 'Failed to get goals', error.message));
      }
    }
  },

  // Todos API
  {
    type: 'GET',
    path: '/api/todos',
    name: 'Get Todos',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const todoService = runtime.getService('todo');
        if (todoService && typeof (todoService as any).getTodos === 'function') {
          const todos = await (todoService as any).getTodos();
          return res.json(successResponse(todos || []));
        } else {
          return res.json(successResponse([]));
        }
      } catch (error) {
        console.error('[API] Todos API error:', error);
        res.status(500).json(errorResponse('TODOS_ERROR', 'Failed to get todos', error.message));
      }
    }
  },

  // Memories API
  {
    type: 'GET',
    path: '/api/memories',
    name: 'Get Memories',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { roomId, count = 20 } = req.query;
        
        const memories = await runtime.getMemories({
          roomId: roomId as string,
          count: parseInt(count as string, 10),
          tableName: 'memories'
        });

        return res.json(successResponse(memories));
      } catch (error) {
        console.error('[API] Memories API error:', error);
        res.status(500).json(errorResponse('MEMORIES_ERROR', 'Failed to get memories', error.message));
      }
    }
  },

  // Vision Settings API
  {
    type: 'GET',
    path: '/api/agents/default/settings/vision',
    name: 'Get Vision Settings',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const settings = {
          ENABLE_CAMERA: runtime.getSetting('ENABLE_CAMERA') || runtime.getSetting('VISION_CAMERA_ENABLED') || 'false',
          ENABLE_SCREEN_CAPTURE: runtime.getSetting('ENABLE_SCREEN_CAPTURE') || runtime.getSetting('VISION_SCREEN_ENABLED') || 'false',
          ENABLE_MICROPHONE: runtime.getSetting('ENABLE_MICROPHONE') || runtime.getSetting('VISION_MICROPHONE_ENABLED') || 'false',
          ENABLE_SPEAKER: runtime.getSetting('ENABLE_SPEAKER') || runtime.getSetting('VISION_SPEAKER_ENABLED') || 'false',
          VISION_CAMERA_ENABLED: runtime.getSetting('VISION_CAMERA_ENABLED') || 'false',
          VISION_SCREEN_ENABLED: runtime.getSetting('VISION_SCREEN_ENABLED') || 'false',
          VISION_MICROPHONE_ENABLED: runtime.getSetting('VISION_MICROPHONE_ENABLED') || 'false',
          VISION_SPEAKER_ENABLED: runtime.getSetting('VISION_SPEAKER_ENABLED') || 'false'
        };

        res.json(successResponse(settings));
      } catch (error) {
        console.error('[API] Vision settings error:', error);
        res.status(500).json(errorResponse('VISION_SETTINGS_ERROR', 'Failed to get vision settings', error.message));
      }
    }
  },

  // Update Settings API
  {
    type: 'POST',
    path: '/api/agents/default/settings',
    name: 'Update Agent Settings',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { key, value } = req.body;
        
        if (!key) {
          return res.status(400).json(errorResponse('MISSING_KEY', 'Setting key is required'));
        }

        runtime.setSetting(key, value);
        
        console.log(`[API] Updated setting ${key} = ${value}`);
        
        res.json(successResponse({ key, value }));
      } catch (error) {
        console.error('[API] Update setting error:', error);
        res.status(500).json(errorResponse('UPDATE_SETTING_ERROR', 'Failed to update setting', error.message));
      }
    }
  },

  // Vision Refresh API
  {
    type: 'POST',
    path: '/api/agents/default/vision/refresh',
    name: 'Refresh Vision Service',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const visionService = runtime.getService('VISION');
        if (visionService && typeof (visionService as any).refresh === 'function') {
          await (visionService as any).refresh();
        } else if (visionService && typeof (visionService as any).stop === 'function' && typeof (visionService as any).start === 'function') {
          await (visionService as any).stop();
          await (visionService as any).start();
        }

        console.log('[API] Vision service refreshed');
        res.json(successResponse({ message: 'Vision service refreshed' }));
      } catch (error) {
        console.error('[API] Vision refresh error:', error);
        res.status(500).json(errorResponse('VISION_REFRESH_ERROR', 'Failed to refresh vision service', error.message));
      }
    }
  },

  // Autonomy Status API
  {
    type: 'GET',
    path: '/autonomy/status',
    name: 'Get Autonomy Status',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          return res.status(503).json(errorResponse('SERVICE_UNAVAILABLE', 'Autonomy service not available'));
        }

        const status = (autonomyService as any).getStatus();
        return res.json(successResponse({
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
          autonomousRoomId: status.autonomousRoomId
        }));
      } catch (error) {
        console.error('[API] Autonomy status error:', error);
        res.status(500).json(errorResponse('AUTONOMY_STATUS_ERROR', 'Failed to get autonomy status', error.message));
      }
    }
  },

  // Autonomy Enable API
  {
    type: 'POST',
    path: '/autonomy/enable',
    name: 'Enable Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          return res.status(503).json(errorResponse('SERVICE_UNAVAILABLE', 'Autonomy service not available'));
        }

        await (autonomyService as any).enableAutonomy();
        const status = (autonomyService as any).getStatus();

        return res.json(successResponse({
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
          message: 'Autonomy enabled'
        }));
      } catch (error) {
        console.error('[API] Autonomy enable error:', error);
        res.status(500).json(errorResponse('AUTONOMY_ENABLE_ERROR', 'Failed to enable autonomy', error.message));
      }
    }
  },

  // Autonomy Disable API
  {
    type: 'POST',
    path: '/autonomy/disable',
    name: 'Disable Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          return res.status(503).json(errorResponse('SERVICE_UNAVAILABLE', 'Autonomy service not available'));
        }

        await (autonomyService as any).disableAutonomy();
        const status = (autonomyService as any).getStatus();

        return res.json(successResponse({
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
          message: 'Autonomy disabled'
        }));
      } catch (error) {
        console.error('[API] Autonomy disable error:', error);
        res.status(500).json(errorResponse('AUTONOMY_DISABLE_ERROR', 'Failed to disable autonomy', error.message));
      }
    }
  },

  // Autonomy Toggle API
  {
    type: 'POST',
    path: '/autonomy/toggle',
    name: 'Toggle Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          return res.status(503).json(errorResponse('SERVICE_UNAVAILABLE', 'Autonomy service not available'));
        }

        const currentStatus = (autonomyService as any).getStatus();
        if (currentStatus.enabled) {
          await (autonomyService as any).disableAutonomy();
        } else {
          await (autonomyService as any).enableAutonomy();
        }

        const newStatus = (autonomyService as any).getStatus();
        return res.json(successResponse({
          enabled: newStatus.enabled,
          running: newStatus.running
        }));
      } catch (error) {
        console.error('[API] Autonomy toggle error:', error);
        res.status(500).json(errorResponse('AUTONOMY_TOGGLE_ERROR', 'Failed to toggle autonomy', error.message));
      }
    }
  },

  // Shell Capability API
  {
    type: 'GET',
    path: '/api/agents/default/capabilities/shell',
    name: 'Get Shell Capability',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const shellEnabled = runtime.getSetting('ENABLE_SHELL') === 'true' || 
                            runtime.getSetting('SHELL_ENABLED') === 'true';
        
        res.json(successResponse({ 
          enabled: shellEnabled,
          service_available: !!runtime.getService('SHELL')
        }));
      } catch (error) {
        console.error('[API] Shell capability error:', error);
        res.status(500).json(errorResponse('SHELL_CAPABILITY_ERROR', 'Failed to get shell capability', error.message));
      }
    }
  },

  // Shell Toggle API
  {
    type: 'POST',
    path: '/api/agents/default/capabilities/shell/toggle',
    name: 'Toggle Shell Capability',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const currentlyEnabled = runtime.getSetting('ENABLE_SHELL') === 'true' || 
                                runtime.getSetting('SHELL_ENABLED') === 'true';
        
        const newState = !currentlyEnabled;
        
        runtime.setSetting('ENABLE_SHELL', newState.toString());
        runtime.setSetting('SHELL_ENABLED', newState.toString());
        
        console.log(`[API] Shell capability ${newState ? 'enabled' : 'disabled'}`);
        
        res.json(successResponse({ 
          enabled: newState,
          service_available: !!runtime.getService('SHELL')
        }));
      } catch (error) {
        console.error('[API] Shell toggle error:', error);
        res.status(500).json(errorResponse('SHELL_TOGGLE_ERROR', 'Failed to toggle shell capability', error.message));
      }
    }
  },

  // Browser Capability API
  {
    type: 'GET',
    path: '/api/agents/default/capabilities/browser',
    name: 'Get Browser Capability',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const browserEnabled = runtime.getSetting('ENABLE_BROWSER') === 'true' || 
                              runtime.getSetting('BROWSER_ENABLED') === 'true';
        
        res.json(successResponse({ 
          enabled: browserEnabled,
          service_available: !!runtime.getService('stagehand')
        }));
      } catch (error) {
        console.error('[API] Browser capability error:', error);
        res.status(500).json(errorResponse('BROWSER_CAPABILITY_ERROR', 'Failed to get browser capability', error.message));
      }
    }
  },

  // Browser Toggle API
  {
    type: 'POST',
    path: '/api/agents/default/capabilities/browser/toggle',
    name: 'Toggle Browser Capability',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const currentlyEnabled = runtime.getSetting('ENABLE_BROWSER') === 'true' || 
                                runtime.getSetting('BROWSER_ENABLED') === 'true';
        
        const newState = !currentlyEnabled;
        
        runtime.setSetting('ENABLE_BROWSER', newState.toString());
        runtime.setSetting('BROWSER_ENABLED', newState.toString());
        
        console.log(`[API] Browser capability ${newState ? 'enabled' : 'disabled'}`);
        
        res.json(successResponse({ 
          enabled: newState,
          service_available: !!runtime.getService('stagehand')
        }));
      } catch (error) {
        console.error('[API] Browser toggle error:', error);
        res.status(500).json(errorResponse('BROWSER_TOGGLE_ERROR', 'Failed to toggle browser capability', error.message));
      }
    }
  },

  // Agent Reset API
  {
    type: 'POST',
    path: '/api/reset-agent',
    name: 'Reset Agent',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        console.log('[API] Reset agent requested...');
        
        // This would need to be implemented to properly reset the agent
        // For now, just return success
        res.json(successResponse({ 
          message: 'Agent reset functionality not implemented yet'
        }));
        
      } catch (error) {
        console.error('[API] Reset agent error:', error);
        res.status(500).json(errorResponse('RESET_ERROR', 'Failed to reset agent', error.message));
      }
    }
  }
];

// Game API Plugin Definition
export const gameAPIPlugin: Plugin = {
  name: 'game-api-plugin',
  description: 'Custom API routes for the ELIZA Game interface',
  
  // Register our routes with the ElizaOS server
  routes: gameAPIRoutes,
  
  // Initialize the plugin
  init: async (config: Record<string, string>, runtime: IAgentRuntime) => {
    console.log('[GAME-API] Plugin initialized');
    console.log(`[GAME-API] Registered ${gameAPIRoutes.length} API routes`);
    
    // Create initial todos and goals for new agent
    setTimeout(async () => {
      try {
        await createInitialTodosAndGoals(runtime);
      } catch (error) {
        console.error('[GAME-API] Failed to create initial todos/goals:', error);
      }
    }, 5000); // Wait 5 seconds for all services to initialize
  }
};

export default gameAPIPlugin;