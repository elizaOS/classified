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
 * Generates configuration recommendations based on validation results
 */
function generateConfigRecommendations(validationResults: any): string[] {
  const recommendations: string[] = [];
  
  if (validationResults.overall === 'unhealthy') {
    recommendations.push('❌ Critical: No working model provider configured. Please configure at least one provider.');
  }
  
  if (validationResults.overall === 'degraded') {
    recommendations.push('⚠️ Warning: Some issues detected with model provider configuration.');
  }
  
  // Check each provider
  Object.entries(validationResults.providers).forEach(([provider, config]: [string, any]) => {
    if (config.status === 'unhealthy') {
      if (config.apiKey === 'missing') {
        recommendations.push(`🔑 Configure ${provider} API key to enable ${provider} provider.`);
      } else if (config.connectionTest?.status === 'failed') {
        recommendations.push(`🔗 ${provider} API key present but connection failed: ${config.connectionTest.message}`);
      }
    } else if (config.status === 'degraded') {
      if (config.connectionTest?.modelAvailable === false) {
        recommendations.push(`📋 ${provider} connected but model "${config.model}" not available. Check model name or permissions.`);
      }
    } else if (config.status === 'healthy') {
      recommendations.push(`✅ ${provider} configuration is working correctly.`);
    }
  });
  
  // Service recommendations
  Object.entries(validationResults.services).forEach(([service, config]: [string, any]) => {
    if (config.status === 'not_loaded' && service === validationResults.environment.MODEL_PROVIDER?.value) {
      recommendations.push(`⚙️ ${service} service not loaded. This may affect runtime performance.`);
    }
  });
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All configurations appear to be working correctly.');
  }
  
  return recommendations;
}

/**
 * Creates initial todos and goals using plugin APIs
 */
async function createInitialTodosAndGoals(runtime: IAgentRuntime): Promise<void> {
  console.log('[GAME-API] Creating initial todos and goals using plugin APIs...');
  
  try {
    // Wait for plugins to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Import the plugin services dynamically
    const { createGoalDataService } = await import('@elizaos/plugin-goals');
    const { createTodoDataService } = await import('@elizaos/plugin-todo');
    
    console.log('[GAME-API] Creating goals using Goals plugin API...');
    const goalDataService = createGoalDataService(runtime);
    
    // Check if this is a brand new agent (no existing goals)
    const existingGoals = await goalDataService.getAllGoalsForOwner('agent', runtime.agentId);
    if (existingGoals && existingGoals.length > 0) {
      console.log(`[GAME-API] Agent already has ${existingGoals.length} goals, skipping initialization`);
      return; // Don't add goals if agent already has some
    }
    
    console.log('[GAME-API] Brand new agent detected, creating initial goals and todos...');
    
    // Create starter goals using the Goals plugin service
    const starterGoals = [
      {
        agentId: runtime.agentId,
        ownerType: 'agent' as const,
        ownerId: runtime.agentId,
        name: 'Welcome to ELIZA OS',
        description: 'Get familiar with the ELIZA OS terminal interface and explore the available capabilities',
        metadata: { priority: 'high', category: 'orientation', source: 'initial_setup' },
        tags: ['orientation', 'setup']
      },
      {
        agentId: runtime.agentId,
        ownerType: 'agent' as const,
        ownerId: runtime.agentId,
        name: 'Communicate with the admin',
        description: 'Establish communication and rapport with the admin user who can guide development',
        metadata: { priority: 'high', category: 'social', source: 'initial_setup' },
        tags: ['communication', 'admin']
      },
      {
        agentId: runtime.agentId,
        ownerType: 'agent' as const,
        ownerId: runtime.agentId,
        name: 'Learn about capabilities',
        description: 'Explore and understand the various plugins and actions available in the system',
        metadata: { priority: 'medium', category: 'learning', source: 'initial_setup' },
        tags: ['learning', 'capabilities']
      },
      {
        agentId: runtime.agentId,
        ownerType: 'agent' as const,
        ownerId: runtime.agentId,
        name: 'Develop autonomy skills',
        description: 'Practice making independent decisions and taking initiative in conversations',
        metadata: { priority: 'medium', category: 'development', source: 'initial_setup' },
        tags: ['autonomy', 'growth']
      }
    ];

    let goalsCreated = 0;
    for (const goalData of starterGoals) {
      try {
        const goalId = await goalDataService.createGoal(goalData);
        if (goalId) {
          goalsCreated++;
          console.log(`[GAME-API] Created goal: ${goalData.name} (${goalId})`);
        }
      } catch (goalError) {
        console.warn(`[GAME-API] Failed to create goal "${goalData.name}":`, goalError.message);
      }
    }
    
    console.log(`[GAME-API] ✅ Created ${goalsCreated} initial goals using Goals plugin`);
    
    // Create starter todos using the Todo plugin service
    console.log('[GAME-API] Creating todos using Todo plugin API...');
    const todoDataService = createTodoDataService(runtime);
    
    // CRITICAL: Use the exact room/world IDs that the /api/todos endpoint returns
    // Based on API testing, these are the rooms that the todos plugin API monitors:
    const API_MONITORED_ROOMS = [
      { worldId: "00000000-0000-0000-0000-000000000001", roomId: "78dfa017-9548-4e2a-8e5f-b54aa4b5cb08" }, // Autonomy World
      { worldId: "cc91bfa9-aa00-0bfc-8919-09a4f073b8fe", roomId: "b14661f9-37a8-0b7b-bb9c-ee9ea36b30e5" }  // Terminal World
    ];
    
    // Use the first monitored room (Terminal World)
    const targetWorldId = API_MONITORED_ROOMS[1].worldId;  // Terminal World
    const targetRoomId = API_MONITORED_ROOMS[1].roomId;    // Terminal Room
    
    console.log(`[GAME-API] Using hardcoded API-monitored world ${targetWorldId} and room ${targetRoomId} for todos`);
    
    const starterTodos = [
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Say hello to the admin',
        description: 'Introduce yourself and start a conversation with the admin user',
        type: 'one-off' as const,
        priority: 1,
        isUrgent: true,
        metadata: { category: 'social', source: 'initial_setup', importance: 'high' },
        tags: ['communication', 'greeting', 'urgent']
      },
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Explore the knowledge base',
        description: 'Look for any documents or information that have been uploaded to learn from',
        type: 'one-off' as const,
        priority: 2,
        isUrgent: false,
        metadata: { category: 'learning', source: 'initial_setup', importance: 'medium' },
        tags: ['knowledge', 'exploration']
      },
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Test shell capabilities',
        description: 'Use the shell plugin to explore available commands and system information',
        type: 'one-off' as const,
        priority: 3,
        isUrgent: false,
        metadata: { category: 'technical', source: 'initial_setup', importance: 'medium' },
        tags: ['shell', 'capabilities', 'testing']
      },
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Learn about vision features',
        description: 'Understand the vision plugin capabilities for screen capture and image analysis',
        type: 'one-off' as const,
        priority: 4,
        isUrgent: false,
        metadata: { category: 'learning', source: 'initial_setup', importance: 'low' },
        tags: ['vision', 'capabilities', 'multimedia']
      },
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Create my first goal',
        description: 'Practice using the goals system to set a personal objective or learning target',
        type: 'one-off' as const,
        priority: 2,
        isUrgent: false,
        metadata: { category: 'goal-setting', source: 'initial_setup', importance: 'high' },
        tags: ['goals', 'self-management', 'practice']
      },
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Upload a test document',
        description: 'Try uploading a small text file to test the knowledge upload functionality',
        type: 'one-off' as const,
        priority: 5,
        isUrgent: false,
        metadata: { category: 'technical', source: 'initial_setup', importance: 'low' },
        tags: ['knowledge', 'upload', 'testing']
      },
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Review daily progress',
        description: 'Check completed tasks and reflect on learning progress',
        type: 'recurring' as const,
        priority: 3,
        isUrgent: false,
        metadata: { 
          category: 'reflection', 
          source: 'initial_setup', 
          importance: 'medium',
          recurrence: 'daily',
          nextDue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        tags: ['reflection', 'progress', 'daily']
      },
      {
        agentId: runtime.agentId,
        worldId: targetWorldId,
        roomId: targetRoomId,
        entityId: runtime.agentId,
        name: 'Understand autonomy settings',
        description: 'Learn how to control autonomous behavior and decision-making preferences',
        type: 'one-off' as const,
        priority: 4,
        isUrgent: false,
        metadata: { category: 'configuration', source: 'initial_setup', importance: 'medium' },
        tags: ['autonomy', 'settings', 'control']
      }
    ];

    let todosCreated = 0;
    for (const todoData of starterTodos) {
      try {
        const todoId = await todoDataService.createTodo(todoData);
        if (todoId) {
          todosCreated++;
          console.log(`[GAME-API] Created todo: ${todoData.name} (${todoId})`);
        }
      } catch (todoError) {
        console.warn(`[GAME-API] Failed to create todo "${todoData.name}":`, todoError.message);
      }
    }
    
    console.log(`[GAME-API] ✅ Created ${todosCreated} initial todos using Todo plugin (${starterTodos.length} total configured)`);
    console.log(`[GAME-API] ✅ Successfully created ${goalsCreated} goals and ${todosCreated} todos`);
    
  } catch (error) {
    console.error('[GAME-API] Error creating initial todos/goals:', error);
    // Don't throw - this is non-critical initialization, try fallback
    console.log('[GAME-API] Falling back to basic approach...');
    
    // Simple fallback - just log what services are available
    const goalsService = runtime.getService('goals');
    const todoService = runtime.getService('todo');
    
    console.log(`[GAME-API] Goals service available: ${!!goalsService}`);
    console.log(`[GAME-API] Todo service available: ${!!todoService}`);
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

  // NOTE: Autonomy API endpoints are now handled by the autonomy plugin's native routes
  // The autonomy plugin registers its own /autonomy/status, /autonomy/enable, /autonomy/disable routes

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
                            runtime.getSetting('SHELL_ENABLED') === 'true' ||
                            runtime.getSetting('ENABLE_SHELL') === true || 
                            runtime.getSetting('SHELL_ENABLED') === true;
        
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
                                runtime.getSetting('SHELL_ENABLED') === 'true' ||
                                runtime.getSetting('ENABLE_SHELL') === true || 
                                runtime.getSetting('SHELL_ENABLED') === true;
        
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
                              runtime.getSetting('BROWSER_ENABLED') === 'true' ||
                              runtime.getSetting('ENABLE_BROWSER') === true || 
                              runtime.getSetting('BROWSER_ENABLED') === true;
        
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
                                runtime.getSetting('BROWSER_ENABLED') === 'true' ||
                                runtime.getSetting('ENABLE_BROWSER') === true || 
                                runtime.getSetting('BROWSER_ENABLED') === true;
        
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

        console.log('[GAME-API] Upload request received:', {
          files: req.files ? Object.keys(req.files) : 'no req.files',
          body: req.body ? Object.keys(req.body) : 'no req.body',
          contentType: req.headers['content-type'],
          hasFiles: !!req.files,
          filesKeys: req.files ? Object.keys(req.files) : [],
          rawBodySize: req.body ? JSON.stringify(req.body).length : 0
        });

        let uploadedFile, fileName, contentType, fileContent;

        // Try express-fileupload format first
        if (req.files && req.files.file) {
          uploadedFile = req.files.file;
          fileName = uploadedFile.name;
          contentType = uploadedFile.mimetype || 'application/octet-stream';
          fileContent = uploadedFile.data;
        }
        // Try alternative file handling (check if uploaded via different parser)
        else if (req.body && typeof req.body === 'object') {
          // If we got a file in the body somehow
          const bodyKeys = Object.keys(req.body);
          console.log('[GAME-API] Checking body keys:', bodyKeys);
          
          // Look for file-like properties in body
          if (req.body.file) {
            const bodyFile = req.body.file;
            if (typeof bodyFile === 'string') {
              fileName = 'uploaded-file.txt';
              contentType = 'text/plain';
              fileContent = Buffer.from(bodyFile, 'utf8');
            }
          }
        }

        if (!fileContent) {
          return res.status(400).json(errorResponse('NO_FILE', 'No file uploaded or file parsing failed'));
        }

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
        console.log('[GAME-API] Attempting to delete knowledge document:', documentId);
        
        // Use the knowledge service deleteMemory method to actually delete the document
        await (knowledgeService as any).deleteMemory(documentId);
        console.log('[GAME-API] Successfully deleted knowledge document:', documentId);
        
        res.json(successResponse({
          message: 'Document deleted successfully',
          documentId
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
  },

  // Initialize goals and todos manually
  {
    type: 'POST',
    path: '/api/initialize-goals-todos',
    name: 'Initialize Goals and Todos',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        console.log('[GAME-API] Manual initialization of goals and todos requested');
        await createInitialTodosAndGoals(runtime);
        res.json(successResponse({
          message: 'Initial goals and todos created successfully'
        }));
      } catch (error) {
        console.error('[GAME-API] Failed to initialize goals and todos:', error);
        return res.status(500).json(errorResponse('INIT_ERROR', 'Failed to initialize goals and todos', error.message));
      }
    }
  },

  // Configuration Validation API
  {
    type: 'POST',
    path: '/api/config/validate',
    name: 'Validate Configuration',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        console.log('[CONFIG-VALIDATION] Starting configuration validation...');
        
        const validationResults = {
          overall: 'unknown' as 'healthy' | 'degraded' | 'unhealthy',
          providers: {} as Record<string, any>,
          environment: {} as Record<string, any>,
          services: {} as Record<string, any>,
          timestamp: Date.now()
        };

        // Check MODEL_PROVIDER environment variable
        const modelProvider = process.env.MODEL_PROVIDER || 'openai';
        validationResults.environment.MODEL_PROVIDER = {
          value: modelProvider,
          status: 'healthy',
          message: `Provider set to: ${modelProvider}`
        };

        // Validate OpenAI configuration
        if (modelProvider === 'openai' || modelProvider === 'all') {
          const openaiKey = process.env.OPENAI_API_KEY;
          const openaiModel = process.env.LANGUAGE_MODEL || 'gpt-4o-mini';
          
          validationResults.providers.openai = {
            apiKey: openaiKey ? 'present' : 'missing',
            model: openaiModel,
            status: openaiKey ? 'healthy' : 'unhealthy',
            message: openaiKey ? `OpenAI configured with model: ${openaiModel}` : 'OpenAI API key missing'
          };

          // Test OpenAI connection if key is present
          if (openaiKey) {
            try {
              const testResponse = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${openaiKey}`,
                  'Content-Type': 'application/json'
                }
              });

              if (testResponse.ok) {
                const models = await testResponse.json();
                const hasModel = models.data?.some((m: any) => m.id === openaiModel);
                validationResults.providers.openai.connectionTest = {
                  status: 'success',
                  modelAvailable: hasModel,
                  message: hasModel ? 'Connection successful and model available' : `Connection successful but model ${openaiModel} not found`
                };
                if (!hasModel) validationResults.providers.openai.status = 'degraded';
              } else {
                validationResults.providers.openai.connectionTest = {
                  status: 'failed',
                  error: `HTTP ${testResponse.status}: ${testResponse.statusText}`,
                  message: 'Failed to connect to OpenAI API'
                };
                validationResults.providers.openai.status = 'unhealthy';
              }
            } catch (error) {
              validationResults.providers.openai.connectionTest = {
                status: 'failed',
                error: error.message,
                message: 'Failed to test OpenAI connection'
              };
              validationResults.providers.openai.status = 'unhealthy';
            }
          }
        }

        // Validate Anthropic configuration
        if (modelProvider === 'anthropic' || modelProvider === 'all') {
          const anthropicKey = process.env.ANTHROPIC_API_KEY;
          const anthropicModel = process.env.LANGUAGE_MODEL || 'claude-3-haiku-20240307';
          
          validationResults.providers.anthropic = {
            apiKey: anthropicKey ? 'present' : 'missing',
            model: anthropicModel,
            status: anthropicKey ? 'healthy' : 'unhealthy',
            message: anthropicKey ? `Anthropic configured with model: ${anthropicModel}` : 'Anthropic API key missing'
          };

          // Test Anthropic connection if key is present
          if (anthropicKey) {
            try {
              // Anthropic doesn't have a simple models endpoint, so we'll test with a minimal request
              const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${anthropicKey}`,
                  'Content-Type': 'application/json',
                  'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                  model: anthropicModel,
                  max_tokens: 1,
                  messages: [{ role: 'user', content: 'test' }]
                })
              });

              if (testResponse.ok || testResponse.status === 400) {
                // 400 is expected for this minimal test request
                validationResults.providers.anthropic.connectionTest = {
                  status: 'success',
                  message: 'Connection successful'
                };
              } else {
                validationResults.providers.anthropic.connectionTest = {
                  status: 'failed',
                  error: `HTTP ${testResponse.status}: ${testResponse.statusText}`,
                  message: 'Failed to connect to Anthropic API'
                };
                validationResults.providers.anthropic.status = 'unhealthy';
              }
            } catch (error) {
              validationResults.providers.anthropic.connectionTest = {
                status: 'failed',
                error: error.message,
                message: 'Failed to test Anthropic connection'
              };
              validationResults.providers.anthropic.status = 'unhealthy';
            }
          }
        }

        // Validate Ollama configuration
        if (modelProvider === 'ollama' || modelProvider === 'all') {
          const ollamaUrl = process.env.OLLAMA_SERVER_URL || 'http://localhost:11434';
          const ollamaModel = process.env.LANGUAGE_MODEL || 'llama2';
          
          validationResults.providers.ollama = {
            serverUrl: ollamaUrl,
            model: ollamaModel,
            status: 'unknown',
            message: `Ollama configured with server: ${ollamaUrl}, model: ${ollamaModel}`
          };

          // Test Ollama connection
          try {
            const testResponse = await fetch(`${ollamaUrl}/api/version`, {
              method: 'GET',
              timeout: 5000 // 5 second timeout for local connections
            });

            if (testResponse.ok) {
              const versionData = await testResponse.json();
              
              // Check if model is available
              const modelsResponse = await fetch(`${ollamaUrl}/api/tags`);
              if (modelsResponse.ok) {
                const modelsData = await modelsResponse.json();
                const hasModel = modelsData.models?.some((m: any) => m.name === ollamaModel || m.name.startsWith(ollamaModel + ':'));
                
                validationResults.providers.ollama.connectionTest = {
                  status: 'success',
                  version: versionData.version,
                  modelAvailable: hasModel,
                  availableModels: modelsData.models?.map((m: any) => m.name) || [],
                  message: hasModel ? 'Connection successful and model available' : `Connection successful but model ${ollamaModel} not found`
                };
                validationResults.providers.ollama.status = hasModel ? 'healthy' : 'degraded';
              } else {
                validationResults.providers.ollama.connectionTest = {
                  status: 'partial',
                  version: versionData.version,
                  message: 'Connected but could not list models'
                };
                validationResults.providers.ollama.status = 'degraded';
              }
            } else {
              validationResults.providers.ollama.connectionTest = {
                status: 'failed',
                error: `HTTP ${testResponse.status}: ${testResponse.statusText}`,
                message: `Failed to connect to Ollama at ${ollamaUrl}`
              };
              validationResults.providers.ollama.status = 'unhealthy';
            }
          } catch (error) {
            validationResults.providers.ollama.connectionTest = {
              status: 'failed',
              error: error.message,
              message: `Failed to connect to Ollama at ${ollamaUrl}`
            };
            validationResults.providers.ollama.status = 'unhealthy';
          }
        }

        // Check embedding model configuration
        const embeddingModel = process.env.TEXT_EMBEDDING_MODEL || 'text-embedding-3-small';
        validationResults.environment.TEXT_EMBEDDING_MODEL = {
          value: embeddingModel,
          status: 'healthy',
          message: `Embedding model: ${embeddingModel}`
        };

        // Test runtime services
        const openaiService = runtime.getService('openai');
        const anthropicService = runtime.getService('anthropic');
        
        validationResults.services.openai = {
          loaded: !!openaiService,
          type: openaiService?.constructor?.name || 'Not loaded',
          status: openaiService ? 'healthy' : 'not_loaded'
        };

        validationResults.services.anthropic = {
          loaded: !!anthropicService,
          type: anthropicService?.constructor?.name || 'Not loaded', 
          status: anthropicService ? 'healthy' : 'not_loaded'
        };

        // Calculate overall status
        const providerStatuses = Object.values(validationResults.providers).map((p: any) => p.status);
        const hasHealthyProvider = providerStatuses.includes('healthy');
        const hasUnhealthyProvider = providerStatuses.includes('unhealthy');
        
        if (hasHealthyProvider && !hasUnhealthyProvider) {
          validationResults.overall = 'healthy';
        } else if (hasHealthyProvider && hasUnhealthyProvider) {
          validationResults.overall = 'degraded';
        } else {
          validationResults.overall = 'unhealthy';
        }

        console.log(`[CONFIG-VALIDATION] Validation complete. Overall status: ${validationResults.overall}`);
        
        res.json(successResponse({
          validation: validationResults,
          recommendations: generateConfigRecommendations(validationResults)
        }));
        
      } catch (error) {
        console.error('[CONFIG-VALIDATION] Validation failed:', error);
        res.status(500).json(errorResponse('VALIDATION_FAILED', 'Configuration validation failed', error.message));
      }
    }
  },

  // Configuration Test API - Tests actual LLM functionality
  {
    type: 'POST',
    path: '/api/config/test',
    name: 'Test Configuration',
    public: true,
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        console.log('[CONFIG-TEST] Starting configuration test...');
        
        const testResults = {
          provider: process.env.MODEL_PROVIDER || 'openai',
          model: process.env.LANGUAGE_MODEL || 'gpt-4o-mini',
          timestamp: Date.now(),
          tests: {} as Record<string, any>
        };

        // Test basic LLM completion
        try {
          console.log('[CONFIG-TEST] Testing basic LLM completion...');
          
          // Create a simple test prompt
          const testPrompt = "Respond with exactly: 'Configuration test successful'";
          
          // Use the runtime to generate completion (this will use the configured provider)
          const completion = await runtime.generateText({
            text: testPrompt,
            temperature: 0.1,
            max_tokens: 20
          });

          const responseText = completion?.trim() || '';
          const isExpectedResponse = responseText.includes('Configuration test successful');
          
          testResults.tests.llmCompletion = {
            status: isExpectedResponse ? 'success' : 'partial',
            request: testPrompt,
            response: responseText,
            expected: 'Configuration test successful',
            match: isExpectedResponse,
            message: isExpectedResponse ? 'LLM completion test passed' : 'LLM responded but not as expected'
          };
        } catch (error) {
          testResults.tests.llmCompletion = {
            status: 'failed',
            error: error.message,
            message: 'Failed to generate LLM completion'
          };
        }

        // Test embedding functionality
        try {
          console.log('[CONFIG-TEST] Testing embedding generation...');
          
          const testText = "This is a test for embedding generation";
          const embedding = await runtime.embed(testText);
          
          testResults.tests.embedding = {
            status: embedding && Array.isArray(embedding) && embedding.length > 0 ? 'success' : 'failed',
            textLength: testText.length,
            embeddingDimensions: embedding ? embedding.length : 0,
            embeddingType: typeof embedding,
            message: embedding ? `Generated ${embedding.length}-dimensional embedding` : 'Failed to generate embedding'
          };
        } catch (error) {
          testResults.tests.embedding = {
            status: 'failed',
            error: error.message,
            message: 'Failed to generate embedding'
          };
        }

        // Test memory operations
        try {
          console.log('[CONFIG-TEST] Testing memory operations...');
          
          const testRoomId = 'config-test-room';
          
          // Create a test memory
          const testMemory = await runtime.messageManager.createMemory({
            userId: runtime.agentId,
            content: {
              text: 'This is a configuration test memory',
              source: 'config_test'
            },
            roomId: testRoomId,
            agentId: runtime.agentId,
            embedding: await runtime.embed('This is a configuration test memory')
          });

          // Retrieve the memory
          const memories = await runtime.getMemories({
            roomId: testRoomId,
            count: 1
          });

          const foundMemory = memories.find(m => m.id === testMemory.id);
          
          testResults.tests.memory = {
            status: foundMemory ? 'success' : 'failed',
            memoryId: testMemory.id,
            retrieved: !!foundMemory,
            message: foundMemory ? 'Memory operations working correctly' : 'Failed to retrieve created memory'
          };
        } catch (error) {
          testResults.tests.memory = {
            status: 'failed',
            error: error.message,
            message: 'Failed to test memory operations'
          };
        }

        // Calculate overall test status
        const testStatuses = Object.values(testResults.tests).map((t: any) => t.status);
        const allSuccessful = testStatuses.every(s => s === 'success');
        const anyFailed = testStatuses.some(s => s === 'failed');
        
        const overallStatus = allSuccessful ? 'success' : anyFailed ? 'failed' : 'partial';
        
        console.log(`[CONFIG-TEST] Configuration test complete. Overall status: ${overallStatus}`);
        
        res.json(successResponse({
          overallStatus,
          testResults,
          summary: {
            total: Object.keys(testResults.tests).length,
            passed: testStatuses.filter(s => s === 'success').length,
            failed: testStatuses.filter(s => s === 'failed').length,
            partial: testStatuses.filter(s => s === 'partial').length
          }
        }));
        
      } catch (error) {
        console.error('[CONFIG-TEST] Configuration test failed:', error);
        res.status(500).json(errorResponse('TEST_FAILED', 'Configuration test failed', error.message));
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
    
    // Debug: List all registered services
    const services = (runtime as any).services || new Map();
    const serviceNames = Array.from(services.keys());
    console.log('[GAME-API] Available services at init:', serviceNames);
    
    // Specifically check for autonomy service
    const autonomyService = runtime.getService('AUTONOMY') || runtime.getService('autonomy') || runtime.getService('AutonomyService');
    console.log('[GAME-API] Autonomy service found:', !!autonomyService);
    
    if (autonomyService) {
      console.log('[GAME-API] Autonomy service type:', autonomyService.constructor.name);
      console.log('[GAME-API] Autonomy service methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(autonomyService)));
    }
    
    // Schedule initial todos and goals creation for after startup
    setTimeout(() => {
      createInitialTodosAndGoals(runtime);
    }, 3000); // Wait 3 seconds for all plugins to be fully initialized
    
    return Promise.resolve();
  }
};

export default gameAPIPlugin;