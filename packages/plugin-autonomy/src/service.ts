import { 
  Service, 
  type IAgentRuntime, 
  type UUID, 
  asUUID,
  type Memory,
  type Content,
  EventType
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Simple autonomous loop service that can be toggled on/off via API
 * Continuously triggers agent thinking in a separate autonomous context
 */
export class AutonomyService extends Service {
  static serviceType = 'AUTONOMY' as const;
  
  private isRunning = false;
  private loopInterval?: NodeJS.Timeout;
  private intervalMs = 1000; // Default 1 second for continuous operation
  private autonomousRoomId: UUID; // Dedicated room for autonomous thoughts
  private autonomousWorldId: UUID; // World ID for autonomous context
  
  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    
    // Use a dedicated room ID for autonomous thoughts to avoid conflicts
    // This ensures we have a clean room that's not shared with other functionality
    // Generate a proper UUID - ensure it's a valid v4 UUID format
    const roomUUID = uuidv4();
    console.log('[AUTONOMY] Generated room UUID:', roomUUID);
    this.autonomousRoomId = asUUID(roomUUID);
    this.autonomousWorldId = asUUID('00000000-0000-0000-0000-000000000001'); // Default world
    
    console.log('[AUTONOMY] Service initialized with room ID:', this.autonomousRoomId);
  }

  static async start(runtime: IAgentRuntime): Promise<AutonomyService> {
    const service = new AutonomyService(runtime);
    await service.initialize();
    return service;
  }

  async initialize(): Promise<void> {
    // The autonomous room ID is already set in the constructor
    // Don't override it here
    
    console.log(`[Autonomy] Using autonomous room ID: ${this.autonomousRoomId}`);

    // Check current autonomy setting
    const autonomyEnabled = this.runtime.getSetting('AUTONOMY_ENABLED');
    const autoStart = this.runtime.getSetting('AUTONOMY_AUTO_START');
    
    // Ensure the autonomous room exists with proper world context
    try {
      // Always ensure world exists first
      const worldId = asUUID('00000000-0000-0000-0000-000000000001'); // Use a fixed world ID for autonomy
      await this.runtime.ensureWorldExists({
        id: worldId,
        name: 'Autonomy World',
        agentId: this.runtime.agentId,
        serverId: asUUID('00000000-0000-0000-0000-000000000000'), // Default server ID
        metadata: {
          type: 'autonomy',
          description: 'World for autonomous agent thinking'
        }
      });
      
      // Store the world ID for later use
      this.autonomousWorldId = worldId;
      
      // Always ensure room exists with correct world ID
      await this.runtime.ensureRoomExists({
        id: this.autonomousRoomId,
        name: 'Autonomous Thoughts',
        worldId: worldId,
        agentId: this.runtime.agentId,
        source: 'autonomy-plugin',
        type: 'AUTONOMOUS' as any,
        metadata: {
          source: 'autonomy-plugin',
          description: 'Room for autonomous agent thinking'
        }
      });
      
      // Add agent as participant
      await this.runtime.addParticipant(this.runtime.agentId, this.autonomousRoomId);
      await this.runtime.ensureParticipantInRoom(this.runtime.agentId, this.autonomousRoomId);
      
      console.log('[Autonomy] Ensured autonomous room exists with world ID:', this.autonomousWorldId);
    } catch (error) {
      console.warn('[Autonomy] Failed to ensure autonomous room exists:', error);
      // Continue anyway - the room might be created later
    }
    
    console.log(`[Autonomy] Settings check - AUTONOMY_ENABLED: ${autonomyEnabled}, AUTONOMY_AUTO_START: ${autoStart}`);
    
    // Start disabled by default - autonomy should only run when explicitly enabled from frontend
    if (autonomyEnabled === true || autonomyEnabled === 'true') {
      console.log('[Autonomy] Autonomy is enabled in settings, starting...');
      await this.startLoop();
    } else {
      console.log('[Autonomy] Autonomy disabled by default - will wait for frontend activation');
    }

    // Set up settings monitoring (check for changes every 10 seconds)
    this.setupSettingsMonitoring();
  }

  /**
   * Monitor settings for changes and react accordingly
   */
  private setupSettingsMonitoring(): void {
    setInterval(async () => {
      try {
        const autonomyEnabled = this.runtime.getSetting('AUTONOMY_ENABLED');
        const shouldBeRunning = autonomyEnabled === true || autonomyEnabled === 'true';
        
        if (shouldBeRunning && !this.isRunning) {
          console.log('[Autonomy] Settings indicate autonomy should be enabled, starting...');
          await this.startLoop();
        } else if (!shouldBeRunning && this.isRunning) {
          console.log('[Autonomy] Settings indicate autonomy should be disabled, stopping...');
          await this.stopLoop();
        }
      } catch (error) {
        console.error('[Autonomy] Error in settings monitoring:', error);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Start the autonomous loop
   */
  async startLoop(): Promise<void> {
    if (this.isRunning) {
      console.log('[Autonomy] Loop already running');
      return;
    }

    this.isRunning = true;
    
    // Set setting to persist state
    this.runtime.setSetting('AUTONOMY_ENABLED', true);

    console.log(`[Autonomy] Starting continuous autonomous loop (${this.intervalMs}ms delay between iterations)`);
    
    // Start the loop
    this.scheduleNextThink();
  }

  /**
   * Stop the autonomous loop
   */
  async stopLoop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[Autonomy] Loop not running');
      return;
    }

    this.isRunning = false;
    
    // Clear interval and persist state
    if (this.loopInterval) {
      clearTimeout(this.loopInterval);
      this.loopInterval = undefined;
    }
    
    this.runtime.setSetting('AUTONOMY_ENABLED', false);
    console.log('[Autonomy] Stopped autonomous loop');
  }

  /**
   * Schedule next autonomous thinking iteration
   */
  private scheduleNextThink(): void {
    if (!this.isRunning) return;

    this.loopInterval = setTimeout(async () => {
      try {
        await this.performAutonomousThink();
      } catch (error) {
        console.error('[Autonomy] Error during autonomous think:', error);
      } finally {
        // Schedule next iteration if still running
        this.scheduleNextThink();
      }
    }, this.intervalMs);
  }

  /**
   * Perform one iteration of autonomous thinking
   */
  private async performAutonomousThink(): Promise<void> {
    console.log(`[Autonomy] Performing autonomous think... (${new Date().toLocaleTimeString()})`);

    // Get the last autonomous response to continue the monologue
    let promptText = 'What should I do next? Think about recent conversations, goals, and actions I could take.';
    
    try {
      // Get recent autonomous memories from this room
      const recentMemories = await this.runtime.getMemories({
        roomId: this.autonomousRoomId,
        count: 5,
        tableName: 'memories'
      });
      
      // Find the most recent agent-generated autonomous response
      const lastAgentResponse = recentMemories
        .filter(m => 
          m.entityId === this.runtime.agentId && 
          m.content?.metadata && 
          (m.content.metadata as any)?.isAutonomous &&
          m.content?.text && 
          m.content.text !== promptText // Don't use the initial prompt
        )
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      
      if (lastAgentResponse?.content?.text) {
        // Use the last response as the input for continuing the monologue
        promptText = lastAgentResponse.content.text;
        console.log(`[Autonomy] Continuing from last thought: "${promptText.substring(0, 50)}..."`);
      } else {
        console.log('[Autonomy] No previous autonomous thoughts found, starting fresh');
      }
    } catch (error) {
      console.warn('[Autonomy] Failed to get recent autonomous memories, using default prompt:', (error as Error).message || error);
    }

    // Create autonomous thinking message using the last thought or default prompt
    const messageId = uuidv4();
    const autonomousMessage: Memory = {
      id: asUUID(messageId),
      entityId: this.runtime.agentId, // Use agent's own ID to identify autonomous messages
      agentId: this.runtime.agentId,  // Required agentId field
      roomId: this.autonomousRoomId, // Use dedicated autonomous room ID
      worldId: this.autonomousWorldId, // Add worldId
      content: {
        text: promptText, // Use the last thought or default prompt
        source: 'autonomy-system',
        metadata: {
          type: 'autonomous-prompt',
          timestamp: Date.now(),
          isAutonomous: true, // Add a flag to identify autonomous messages
          isContinuation: promptText !== 'What should I do next? Think about recent conversations, goals, and actions I could take.'
        }
      },
      createdAt: Date.now()
    };
    
    console.log('[AUTONOMY] Created autonomous message with ID:', messageId);

    try {
      // Define callback to handle the agent's response
      const callback = async (responseContent: Content): Promise<Memory[]> => {
        console.log('[Autonomy] Agent generated autonomous response:', responseContent.text);
        
        // Create the response memory object with autonomous metadata
        const responseMemory: Memory = {
          id: asUUID(uuidv4()),
          entityId: this.runtime.agentId,
          agentId: this.runtime.agentId,
          content: {
            text: responseContent.text,
            actions: responseContent.actions,
            source: responseContent.source || 'autonomy-response',
            metadata: {
              ...(responseContent.metadata || {}),
              isAutonomous: true, // Mark this as an autonomous response
              timestamp: Date.now()
            }
          },
          roomId: this.autonomousRoomId, // Use autonomous room ID
          worldId: this.autonomousWorldId, // Add worldId
          createdAt: Date.now()
        };
        
        // Store it in the database
        await this.runtime.createMemory(responseMemory, 'memories');

        // Return the memory object for the callback
        return [responseMemory];
      };

      // Use emitEvent to trigger the full agent response pipeline
      // This will cause the agent to build context, call LLM, generate response, and run evaluators
      await this.runtime.emitEvent(EventType.MESSAGE_RECEIVED, {
        runtime: this.runtime,
        message: autonomousMessage,
        callback: callback,
        onComplete: () => {
          console.log('[Autonomy] MESSAGE_RECEIVED event processing completed');
        }
      });
      
      console.log('[Autonomy] Autonomous think message processed through full agent pipeline');
    } catch (error) {
      console.error('[Autonomy] Failed to process autonomous message:', error);
    }
  }

  /**
   * Check if loop is currently running
   */
  isLoopRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current loop interval in milliseconds
   */
  getLoopInterval(): number {
    return this.intervalMs;
  }

  /**
   * Set loop interval (will take effect on next iteration)
   */
  setLoopInterval(ms: number): void {
    if (ms < 100) {
      console.warn('[Autonomy] Interval too short, minimum is 100ms');
      ms = 100;
    }
    if (ms > 60000) {
      console.warn('[Autonomy] Interval too long, maximum is 1 minute');
      ms = 60000;
    }
    
    this.intervalMs = ms;
    console.log(`[Autonomy] Loop interval set to ${ms}ms`);
  }

  /**
   * Get the autonomous room ID for this agent
   */
  getAutonomousRoomId(): UUID {
    return this.autonomousRoomId;
  }

  /**
   * Enable autonomy (sets setting and starts if needed)
   */
  async enableAutonomy(): Promise<void> {
    this.runtime.setSetting('AUTONOMY_ENABLED', true);
    if (!this.isRunning) {
      await this.startLoop();
    }
  }

  /**
   * Disable autonomy (sets setting and stops if running)
   */
  async disableAutonomy(): Promise<void> {
    this.runtime.setSetting('AUTONOMY_ENABLED', false);
    if (this.isRunning) {
      await this.stopLoop();
    }
  }

  /**
   * Get current autonomy status
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    interval: number;
    autonomousRoomId: UUID;
  } {
    const enabled = this.runtime.getSetting('AUTONOMY_ENABLED');
    return {
      enabled: enabled === true || enabled === 'true',
      running: this.isRunning,
      interval: this.intervalMs,
      autonomousRoomId: this.autonomousRoomId
    };
  }

  async stop(): Promise<void> {
    await this.stopLoop();
  }

  get capabilityDescription(): string {
    return 'Autonomous loop service for continuous agent thinking and actions';
  }
}