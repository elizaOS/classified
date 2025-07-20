import type { IAgentRuntime, Plugin, Route } from '@elizaos/core';
import { type UUID } from '@elizaos/core';
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
  // ===== Messaging Stub Endpoints for MessageBusService Compatibility =====
  // These return minimal data to prevent connection errors in single-agent game environment
  
  // Stub endpoint for agent servers (MessageBusService expects this)
  {
    type: 'GET',
    path: '/api/messaging/agents/:agentId/servers',
    name: 'Get Agent Servers (Stub)',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      // Return default server for single-agent game
      res.json({
        success: true,
        data: {
          servers: ['00000000-0000-0000-0000-000000000000'] // Default server ID
        }
      });
    }
  },
  
  // Stub endpoint for server channels (MessageBusService expects this)
  {
    type: 'GET',
    path: '/api/messaging/central-servers/:serverId/channels',
    name: 'Get Server Channels (Stub)',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      // Return empty channels for game environment
      res.json({
        success: true,
        data: {
          channels: []
        }
      });
    }
  },
  
  // Stub endpoint for channel details
  {
    type: 'GET',
    path: '/api/messaging/central-channels/:channelId/details',
    name: 'Get Channel Details (Stub)',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
  },
  
  // Stub endpoint for channel participants
  {
    type: 'GET',
    path: '/api/messaging/central-channels/:channelId/participants',
    name: 'Get Channel Participants (Stub)',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      res.json({
        success: true,
        data: []
      });
    }
  },
  
  // Stub endpoint for message submission (agent responses)
  {
    type: 'POST',
    path: '/api/messaging/submit',
    name: 'Submit Message (Stub)',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      // Just acknowledge the message in game environment
      res.json({
        success: true,
        message: 'Message acknowledged'
      });
    }
  },
  
  // Stub endpoint for message completion notification
  {
    type: 'POST',
    path: '/api/messaging/complete',
    name: 'Message Complete (Stub)',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      res.json({
        success: true
      });
    }
  },
  
  // ===== Game-Specific Endpoints =====
  
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

  // Goals API - Legacy redirects (goals plugin now provides /api/goals directly)
  {
    type: 'GET',
    path: '/api/game/goals',
    name: 'Get Goals (Legacy)',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      // Redirect to the standard goals plugin endpoint
      return res.redirect(301, '/api/goals');
    }
  },

  // Create Goal API - Legacy redirect
  {
    type: 'POST',
    path: '/api/game/goals',
    name: 'Create Goal (Legacy)',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      // Redirect to the standard goals plugin endpoint
      return res.redirect(307, '/api/goals');
    }
  },

  // Todos API - Legacy redirects (todos plugin now provides /api/todos directly)
  {
    type: 'GET',
    path: '/api/game/todos',
    name: 'Get Todos (Legacy)',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      // Redirect to the standard todos plugin endpoint
      return res.redirect(301, '/api/todos');
    }
  },

  // Create Todo API - Legacy redirect
  {
    type: 'POST',
    path: '/api/game/todos',
    name: 'Create Todo (Legacy)',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      // Redirect to the standard todos plugin endpoint
      return res.redirect(307, '/api/todos');
    }
  },

  // Memories API
  {
    type: 'GET',
    path: '/api/game/memories',
    name: 'Get Memories',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { roomId, count = 20 } = req.query;
        
        const memories = await runtime.getMemories({
          roomId: roomId as UUID,
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
        const visionService = runtime.getService('vision');
        let settings = {
          ENABLE_CAMERA: 'false',
          ENABLE_SCREEN_CAPTURE: 'false',
          ENABLE_MICROPHONE: 'false',
          ENABLE_SPEAKER: 'false',
          VISION_CAMERA_ENABLED: 'false',
          VISION_SCREEN_ENABLED: 'false',
          VISION_MICROPHONE_ENABLED: 'false',
          VISION_SPEAKER_ENABLED: 'false'
        };

        // Get settings from runtime first
        Object.keys(settings).forEach(key => {
          const value = runtime.getSetting(key);
          if (value !== undefined) {
            settings[key] = String(value);
          }
        });

        // If vision service exists, try to get its configuration
        if (visionService && typeof (visionService as any).getConfig === 'function') {
          try {
            const visionConfig = await (visionService as any).getConfig();
            if (visionConfig) {
              // Map vision service config to our expected format
              if (visionConfig.cameraEnabled !== undefined) {
                settings.ENABLE_CAMERA = String(visionConfig.cameraEnabled);
                settings.VISION_CAMERA_ENABLED = String(visionConfig.cameraEnabled);
              }
              if (visionConfig.screenCaptureEnabled !== undefined) {
                settings.ENABLE_SCREEN_CAPTURE = String(visionConfig.screenCaptureEnabled);
                settings.VISION_SCREEN_ENABLED = String(visionConfig.screenCaptureEnabled);
              }
              if (visionConfig.microphoneEnabled !== undefined) {
                settings.ENABLE_MICROPHONE = String(visionConfig.microphoneEnabled);
                settings.VISION_MICROPHONE_ENABLED = String(visionConfig.microphoneEnabled);
              }
              if (visionConfig.speakerEnabled !== undefined) {
                settings.ENABLE_SPEAKER = String(visionConfig.speakerEnabled);
                settings.VISION_SPEAKER_ENABLED = String(visionConfig.speakerEnabled);
              }
            }
          } catch (configError) {
            console.warn('[API] Could not get vision service config:', configError.message);
          }
        }

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
        let visionService = runtime.getService('VISION') || runtime.getService('vision');
        let refreshed = false;
        
        if (visionService) {
          // Try different refresh methods
          if (typeof (visionService as any).refresh === 'function') {
            await (visionService as any).refresh();
            refreshed = true;
          } else if (typeof (visionService as any).updateConfig === 'function') {
            // Update config with current settings
            const config = {
              cameraEnabled: runtime.getSetting('ENABLE_CAMERA') === 'true',
              screenCaptureEnabled: runtime.getSetting('ENABLE_SCREEN_CAPTURE') === 'true',
              microphoneEnabled: runtime.getSetting('ENABLE_MICROPHONE') === 'true',
              speakerEnabled: runtime.getSetting('ENABLE_SPEAKER') === 'true',
            };
            await (visionService as any).updateConfig(config);
            refreshed = true;
          } else if (typeof (visionService as any).stop === 'function' && typeof (visionService as any).start === 'function') {
            // Last resort: restart the service
            await (visionService as any).stop();
            await (visionService as any).start();
            refreshed = true;
          }
        }

        if (refreshed) {
          console.log('[API] Vision service refreshed successfully');
          res.json(successResponse({ 
            message: 'Vision service refreshed',
            serviceFound: !!visionService
          }));
        } else {
          console.warn('[API] Vision service not found or refresh method not available');
          res.json(successResponse({ 
            message: 'Vision service not available for refresh',
            serviceFound: !!visionService
          }));
        }
      } catch (error) {
        console.error('[API] Vision refresh error:', error);
        res.status(500).json(errorResponse('VISION_REFRESH_ERROR', 'Failed to refresh vision service', error.message));
      }
    }
  },

  // Autonomy Status API (Stub - service temporarily disabled)
  {
    type: 'GET',
    path: '/autonomy/status',
    name: 'Get Autonomy Status',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        console.log('[AUTONOMY API] Available services:', Object.keys(runtime.services || {}));
        console.log('[AUTONOMY API] Runtime services object:', runtime.services);
        const autonomyService = runtime.getService('AUTONOMY');
        console.log('[AUTONOMY API] Looking for AUTONOMY service, found:', !!autonomyService);
        
        // Also try lowercase
        const autonomyServiceLower = runtime.getService('autonomy');
        console.log('[AUTONOMY API] Looking for autonomy service (lowercase), found:', !!autonomyServiceLower);
        
        const service = autonomyService || autonomyServiceLower;
        if (!service) {
          console.log('[AUTONOMY API] Autonomy service not found, returning error');
          return res.status(404).json(errorResponse('SERVICE_NOT_FOUND', 'Autonomy service not available'));
        }
        
        console.log('[AUTONOMY API] Found autonomy service, getting status');
        const status = (service as any).getStatus();
        return res.json(successResponse(status));
      } catch (error) {
        console.error('[API] Autonomy status error:', error);
        res.status(500).json(errorResponse('AUTONOMY_STATUS_ERROR', 'Failed to get autonomy status', error.message));
      }
    }
  },

  // Autonomy Enable API (Stub)
  {
    type: 'POST',
    path: '/autonomy/enable',
    name: 'Enable Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy');
        if (!autonomyService) {
          return res.status(503).json(errorResponse('SERVICE_UNAVAILABLE', 'Autonomy service temporarily disabled'));
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

  // Autonomy Disable API (Stub)
  {
    type: 'POST',
    path: '/autonomy/disable',
    name: 'Disable Autonomy',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy');
        if (!autonomyService) {
          return res.json(successResponse({
            enabled: false,
            running: false,
            interval: 30000,
            message: 'Autonomy service temporarily disabled'
          }));
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
        const autonomyService = runtime.getService('AUTONOMY');
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
        
        // Check for shell service with different possible names
        const shellService = runtime.getService('SHELL') || 
                           runtime.getService('shell') || 
                           runtime.getService('Shell');
        
        res.json(successResponse({ 
          enabled: shellEnabled,
          service_available: !!shellService,
          service_name: shellService ? 'found' : 'not_found'
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
        
        // Check for browser service with different possible names
        const browserService = runtime.getService('stagehand') || 
                              runtime.getService('STAGEHAND') || 
                              runtime.getService('browser') || 
                              runtime.getService('BROWSER');
        
        res.json(successResponse({ 
          enabled: browserEnabled,
          service_available: !!browserService,
          service_name: browserService ? 'found' : 'not_found'
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

  // Reset agent
  {
    type: 'POST',
    path: '/api/reset-agent',
    name: 'Reset Agent',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        console.log('[GAME-API] Starting agent reset...');
        
        const agentId = runtime.agentId;
        
        // Note: We can't directly clear all data due to API limitations
        // Instead, we'll mark existing items as completed/inactive
        
        // Clear goals if plugin is available
        const goalsService = runtime.getService('goals');
        if (goalsService) {
          try {
            const goals = await (goalsService as any).getGoals();
            for (const goal of goals || []) {
              if (typeof (goalsService as any).completeGoal === 'function') {
                await (goalsService as any).completeGoal(goal.id);
              }
            }
          } catch (err) {
            console.warn('[GAME-API] Failed to clear goals:', err);
          }
        }
        
        // Clear todos if plugin is available
        const todoService = runtime.getService('todo');
        if (todoService) {
          try {
            const todos = await (todoService as any).getTodos();
            for (const todo of todos || []) {
              if (typeof (todoService as any).completeTodo === 'function') {
                await (todoService as any).completeTodo(todo.id);
              }
            }
          } catch (err) {
            console.warn('[GAME-API] Failed to clear todos:', err);
          }
        }
        
        console.log('[GAME-API] Creating fresh initial state...');
        
        // Give it a moment to ensure operations complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create initial todos and goals again
        await createInitialTodosAndGoals(runtime);
        
        res.json(successResponse({
          message: 'Agent reset complete',
          agentId: agentId
        }));
      } catch (error) {
        console.error('[GAME-API] Error resetting agent:', error);
        res.status(500).json(errorResponse('RESET_FAILED', error.message, error));
      }
    }
  },

  // Knowledge Document Management Routes
  {
    type: 'GET',
    path: '/knowledge/documents',
    name: 'Get Knowledge Documents',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const knowledgeService = runtime.getService('knowledge');
        if (!knowledgeService) {
          return res.status(404).json(errorResponse('SERVICE_NOT_FOUND', 'Knowledge service not available'));
        }

        // Get documents from the knowledge service
        const documents = await (knowledgeService as any).getMemories({
          tableName: 'documents',
          count: 100, // Reasonable limit
          agentId: runtime.agentId
        });

        // Format documents for the frontend
        const formattedDocs = documents.map((doc: any) => ({
          id: doc.id,
          title: doc.metadata?.title || doc.metadata?.originalFilename || 'Untitled',
          originalFilename: doc.metadata?.originalFilename || 'unknown',
          contentType: doc.metadata?.contentType || 'unknown',
          createdAt: new Date(doc.createdAt || doc.metadata?.timestamp || Date.now()).toISOString(),
          size: doc.metadata?.size || 0,
          fragmentCount: doc.metadata?.fragmentCount || 0,
          metadata: doc.metadata
        }));

        res.json(successResponse({
          documents: formattedDocs,
          count: formattedDocs.length
        }));
      } catch (error) {
        console.error('[GAME-API] Error fetching knowledge documents:', error);
        res.status(500).json(errorResponse('FETCH_FAILED', error.message));
      }
    }
  },

  {
    type: 'POST',
    path: '/knowledge/upload',
    name: 'Upload Knowledge Document',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const knowledgeService = runtime.getService('knowledge');
        if (!knowledgeService) {
          return res.status(404).json(errorResponse('SERVICE_NOT_FOUND', 'Knowledge service not available'));
        }

        // Handle multipart form data upload
        if (!req.files || Object.keys(req.files).length === 0) {
          return res.status(400).json(errorResponse('NO_FILE', 'No file uploaded'));
        }

        const uploadedFile = req.files.file;
        const fileName = uploadedFile.name;
        const contentType = uploadedFile.mimetype || 'application/octet-stream';
        const fileContent = uploadedFile.data;

        console.log(`[GAME-API] Processing uploaded file: ${fileName} (${contentType})`);

        // Create knowledge options
        const knowledgeOptions = {
          clientDocumentId: uuidv4() as UUID,
          contentType,
          originalFilename: fileName,
          worldId: runtime.agentId,
          content: fileContent.toString('base64'), // Convert to base64 for storage
          roomId: runtime.agentId,
          entityId: runtime.agentId,
          agentId: runtime.agentId
        };

        // Add the knowledge
        const result = await (knowledgeService as any).addKnowledge(knowledgeOptions);

        res.json(successResponse({
          documentId: result.clientDocumentId,
          storedDocumentMemoryId: result.storedDocumentMemoryId,
          fragmentCount: result.fragmentCount,
          filename: fileName,
          message: `Successfully processed ${fileName} into ${result.fragmentCount} searchable fragments`
        }));
      } catch (error) {
        console.error('[GAME-API] Error uploading knowledge document:', error);
        res.status(500).json(errorResponse('UPLOAD_FAILED', error.message));
      }
    }
  },

  {
    type: 'DELETE',
    path: '/knowledge/documents/:documentId',
    name: 'Delete Knowledge Document',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const knowledgeService = runtime.getService('knowledge');
        if (!knowledgeService) {
          return res.status(404).json(errorResponse('SERVICE_NOT_FOUND', 'Knowledge service not available'));
        }

        const documentId = req.params.documentId;
        
        // For now, we'll just return success as the knowledge service
        // doesn't expose a direct document removal API
        console.warn('[GAME-API] Document deletion not fully implemented - knowledge service API needed');
        
        res.json(successResponse({
          message: 'Document marked for deletion',
          documentId,
          note: 'Full deletion requires knowledge service API update'
        }));
      } catch (error) {
        console.error('[GAME-API] Error deleting knowledge document:', error);
        res.status(500).json(errorResponse('DELETE_FAILED', error.message));
      }
    }
  },
  
  // Plugin Configuration Routes
  {
    type: 'GET',
    path: '/api/plugin-config',
    name: 'Get Plugin Configuration',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        // Get all services and their configurations
        const services = runtime.services;
        const configurations: any = {};

        // Get configurations for each service
        for (const [name, service] of services) {
          if (service && typeof (service as any).getConfig === 'function') {
            configurations[name] = await (service as any).getConfig();
          }
        }

        // Add current environment configurations
        configurations.environment = {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '***SET***' : 'NOT_SET',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '***SET***' : 'NOT_SET',
          GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? '***SET***' : 'NOT_SET',
          MODEL_PROVIDER: process.env.MODEL_PROVIDER || 'openai',
          TEXT_EMBEDDING_MODEL: process.env.TEXT_EMBEDDING_MODEL || 'text-embedding-3-small',
          LANGUAGE_MODEL: process.env.LANGUAGE_MODEL || 'gpt-4o-mini',
        };

        res.json(successResponse({
          configurations,
          availablePlugins: Array.from(services.keys())
        }));
      } catch (error) {
        console.error('[GAME-API] Error fetching plugin config:', error);
        res.status(500).json(errorResponse('CONFIG_FETCH_FAILED', error.message));
      }
    }
  },

  {
    type: 'POST',
    path: '/api/plugin-config',
    name: 'Update Plugin Configuration',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { plugin, config } = req.body;
        
        if (!plugin || !config) {
          return res.status(400).json(errorResponse('INVALID_REQUEST', 'Plugin and config are required'));
        }

        // Handle environment variables specially
        if (plugin === 'environment') {
          // Update process.env for the current runtime
          Object.entries(config).forEach(([key, value]) => {
            if (value && value !== '***SET***') {
              process.env[key] = value as string;
            }
          });

          res.json(successResponse({
            message: 'Environment configuration updated',
            plugin: 'environment'
          }));
        } else {
          // Update specific plugin configuration
          const service = runtime.getService(plugin);
          if (!service) {
            return res.status(404).json(errorResponse('SERVICE_NOT_FOUND', `Service ${plugin} not found`));
          }

          if (typeof (service as any).updateConfig === 'function') {
            await (service as any).updateConfig(config);
            res.json(successResponse({
              message: `Configuration updated for ${plugin}`,
              plugin
            }));
          } else {
            res.status(400).json(errorResponse('NOT_CONFIGURABLE', `Service ${plugin} does not support configuration updates`));
          }
        }
      } catch (error) {
        console.error('[GAME-API] Error updating plugin config:', error);
        res.status(500).json(errorResponse('CONFIG_UPDATE_FAILED', error.message));
      }
    }
  },

  // Debug API - Runtime State Serialization
  {
    type: 'GET',
    path: '/api/debug/runtime-state',
    name: 'Get Runtime State Debug Info',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        console.log('[GAME-API] Debug runtime state requested');

        // Safely serialize runtime state for debugging
        const debugState = {
          // Basic runtime info
          agentId: runtime.agentId,
          conversationLength: runtime.getConversationLength(),
          
          // Character information (safe to expose)
          character: {
            id: runtime.character.id,
            name: runtime.character.name,
            bio: Array.isArray(runtime.character.bio) ? runtime.character.bio.join(' ') : runtime.character.bio,
            username: runtime.character.username,
            topics: runtime.character.topics || [],
            style: runtime.character.style || {},
            plugins: runtime.character.plugins || []
          },

          // Services information
          services: Array.from(runtime.services.keys()).map(serviceKey => {
            const service = runtime.services.get(serviceKey);
            return {
              name: serviceKey,
              type: service?.constructor?.name || 'Unknown',
              // Safe service state extraction
              ...(service && typeof (service as any).getStatus === 'function' ? { status: (service as any).getStatus() } : {}),
              ...(service && typeof (service as any).getConfig === 'function' ? { hasConfig: true } : { hasConfig: false })
            };
          }),

          // Plugin information
          plugins: runtime.plugins.map(plugin => ({
            name: plugin.name,
            description: plugin.description,
            dependencies: plugin.dependencies || [],
            hasActions: (plugin.actions?.length || 0) > 0,
            hasProviders: (plugin.providers?.length || 0) > 0,
            hasEvaluators: (plugin.evaluators?.length || 0) > 0,
            hasServices: (plugin.services?.length || 0) > 0,
            hasRoutes: (plugin.routes?.length || 0) > 0,
            actionCount: plugin.actions?.length || 0,
            providerCount: plugin.providers?.length || 0,
            evaluatorCount: plugin.evaluators?.length || 0,
            serviceCount: plugin.services?.length || 0,
            routeCount: plugin.routes?.length || 0
          })),

          // Actions information
          actions: runtime.actions.map(action => ({
            name: action.name,
            description: action.description,
            hasValidate: typeof action.validate === 'function',
            hasHandler: typeof action.handler === 'function',
            exampleCount: action.examples?.length || 0
          })),

          // Providers information
          providers: runtime.providers.map(provider => ({
            name: provider.name,
            description: provider.description || 'No description',
            hasGetMethod: typeof provider.get === 'function'
          })),

          // Evaluators information
          evaluators: runtime.evaluators.map(evaluator => ({
            name: evaluator.name,
            description: evaluator.description,
            alwaysRun: evaluator.alwaysRun || false,
            hasHandler: typeof evaluator.handler === 'function'
          })),

          // Routes information
          routes: runtime.routes.map(route => ({
            type: route.type,
            path: route.path,
            name: route.name,
            public: route.public || false
          })),

          // Event handlers information
          events: Array.from(runtime.events.keys()).map(eventName => ({
            name: eventName,
            handlerCount: runtime.events.get(eventName)?.length || 0
          })),

          // Settings information (safe keys only, no sensitive data)
          settings: {
            // Only expose non-sensitive settings
            ENABLE_CAMERA: runtime.getSetting('ENABLE_CAMERA'),
            ENABLE_SCREEN_CAPTURE: runtime.getSetting('ENABLE_SCREEN_CAPTURE'),
            ENABLE_MICROPHONE: runtime.getSetting('ENABLE_MICROPHONE'),
            ENABLE_SPEAKER: runtime.getSetting('ENABLE_SPEAKER'),
            ENABLE_SHELL: runtime.getSetting('ENABLE_SHELL'),
            ENABLE_BROWSER: runtime.getSetting('ENABLE_BROWSER'),
            VISION_CAMERA_ENABLED: runtime.getSetting('VISION_CAMERA_ENABLED'),
            VISION_SCREEN_ENABLED: runtime.getSetting('VISION_SCREEN_ENABLED'),
            VISION_MICROPHONE_ENABLED: runtime.getSetting('VISION_MICROPHONE_ENABLED'),
            VISION_SPEAKER_ENABLED: runtime.getSetting('VISION_SPEAKER_ENABLED'),
            SHELL_ENABLED: runtime.getSetting('SHELL_ENABLED'),
            BROWSER_ENABLED: runtime.getSetting('BROWSER_ENABLED')
          },

          // Database connection status (if available)
          database: {
            hasConnection: typeof runtime.getConnection === 'function',
            isConnected: !!(runtime as any)?.databaseAdapter
          },

          // Memory stats (if available)
          memory: await (async () => {
            try {
              const allMemories = await runtime.getAllMemories();
              return {
                totalCount: allMemories.length,
                recentCount: allMemories.filter(m => 
                  m.createdAt && Date.now() - m.createdAt < 24 * 60 * 60 * 1000
                ).length
              };
            } catch (error) {
              return { error: 'Failed to fetch memory stats' };
            }
          })(),

          // Performance/status information
          status: {
            timestamp: Date.now(),
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch
          }
        };

        res.json(successResponse(debugState));
      } catch (error) {
        console.error('[GAME-API] Error fetching runtime debug state:', error);
        res.status(500).json(errorResponse('DEBUG_STATE_ERROR', 'Failed to fetch runtime debug state', error.message));
      }
    }
  },

  // Debug API - Service Details
  {
    type: 'GET',
    path: '/api/debug/services/:serviceName',
    name: 'Get Service Debug Info',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const serviceName = req.params.serviceName;
        const service = runtime.getService(serviceName);

        if (!service) {
          return res.status(404).json(errorResponse('SERVICE_NOT_FOUND', `Service ${serviceName} not found`));
        }

        // Safely extract service information
        const serviceInfo = {
          name: serviceName,
          type: service.constructor.name,
          
          // Common service methods/properties
          capabilityDescription: (service as any).capabilityDescription || 'No description available',
          
          // Safe method checks
          availableMethods: {
            start: typeof (service as any).start === 'function',
            stop: typeof (service as any).stop === 'function',
            getStatus: typeof (service as any).getStatus === 'function',
            getConfig: typeof (service as any).getConfig === 'function',
            updateConfig: typeof (service as any).updateConfig === 'function',
            refresh: typeof (service as any).refresh === 'function'
          },

          // Try to get status if available
          status: (typeof (service as any).getStatus === 'function' ? 
            (service as any).getStatus() : 'Status not available'),

          // Try to get configuration if available (non-sensitive only)
          config: (typeof (service as any).getConfig === 'function' ? 
            await (service as any).getConfig().catch(() => 'Config not available') : 'Config not available')
        };

        res.json(successResponse(serviceInfo));
      } catch (error) {
        console.error('[GAME-API] Error fetching service debug info:', error);
        res.status(500).json(errorResponse('SERVICE_DEBUG_ERROR', 'Failed to fetch service debug info', error.message));
      }
    }
  },

  // Memories API for Monologue Tab
  {
    type: 'GET',
    path: '/api/memories',
    name: 'Get Memories',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const { roomId, count = 20 } = req.query;
        
        if (!roomId) {
          return res.status(400).json(errorResponse('MISSING_ROOM_ID', 'Room ID is required'));
        }
        
        console.log(`[API] Fetching memories for room: ${roomId}, count: ${count}`);
        
        // Fetch memories from the specified room
        const memories = await runtime.getMemories({
          roomId: roomId as string,
          count: parseInt(count as string, 10),
          tableName: 'memories'
        });
        
        console.log(`[API] Found ${memories.length} memories for room ${roomId}`);
        
        // Return in the expected format
        res.json(successResponse(memories || []));
      } catch (error) {
        console.error('[API] Memories fetch error:', error);
        res.status(500).json(errorResponse('MEMORIES_FETCH_ERROR', 'Failed to fetch memories', error.message));
      }
    }
  },

  // Autonomy control routes (since autonomy plugin routes aren't being registered)
  {
    type: 'GET',
    path: '/autonomy/status',
    name: 'Autonomy Status',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        // Try multiple service names since we're not sure which one is registered
        let autonomyService = runtime.getService('AUTONOMY');
        
        // If not found, try the class name
        if (!autonomyService) {
          autonomyService = runtime.getService('AutonomyService');
        }
        
        // If still not found, try lowercase
        if (!autonomyService) {
          autonomyService = runtime.getService('autonomy');
        }
        
        console.log(`[API] Autonomy service lookup: ${autonomyService ? 'found' : 'not found'}`);
        
        if (!autonomyService) {
          // List all available services for debugging
          const services = (runtime as any).services || new Map();
          const serviceNames = Array.from(services.keys());
          console.log('[API] Available services:', serviceNames);
          return res.status(503).json(errorResponse('SERVICE_UNAVAILABLE', 'Autonomy service not available'));
        }

        const status = (autonomyService as any).getStatus();
        
        return res.json(successResponse({
          enabled: status.enabled,
          running: status.running,
          interval: status.interval,
          intervalSeconds: Math.round(status.interval / 1000),
          autonomousRoomId: status.autonomousRoomId,
          agentId: runtime.agentId,
          characterName: runtime.character?.name || 'Agent'
        }));
      } catch (error) {
        console.error('[API] Autonomy status error:', error);
        return res.status(500).json(errorResponse('AUTONOMY_STATUS_ERROR', 'Failed to get autonomy status', error.message));
      }
    }
  },

  {
    type: 'POST',
    path: '/autonomy/enable',
    name: 'Enable Autonomy',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY');
        
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
        return res.status(500).json(errorResponse('AUTONOMY_ENABLE_ERROR', 'Failed to enable autonomy', error.message));
      }
    }
  },

  {
    type: 'POST',
    path: '/autonomy/disable',
    name: 'Disable Autonomy',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const autonomyService = runtime.getService('AUTONOMY');
        
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
        return res.status(500).json(errorResponse('AUTONOMY_DISABLE_ERROR', 'Failed to disable autonomy', error.message));
      }
    }
  }
];

// Plugin export
export const gameAPIPlugin: Plugin = {
  name: 'game-api',
  description: 'Custom API routes for the ELIZA game',
  routes: gameAPIRoutes,
  
  init: async (config: Record<string, string>, runtime: IAgentRuntime) => {
    console.log('[GAME-API] Plugin initialized for agent:', runtime.agentId);
    
    // Create initial todos and goals on plugin initialization
    await createInitialTodosAndGoals(runtime);
    
    return Promise.resolve();
  }
};

export default gameAPIPlugin;