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
    console.log(`[Autonomy] Performing autonomous monologue... (${new Date().toLocaleTimeString()})`);

    try {
      // Get the last autonomous thought to continue the internal monologue
      let lastThought: string | undefined;
      let isFirstThought = false;
      
      try {
        // Get recent autonomous memories from this room
        const recentMemories = await this.runtime.getMemories({
          roomId: this.autonomousRoomId,
          count: 3,
          tableName: 'memories'
        });
        
        // Find the most recent agent-generated autonomous thought
        const lastAgentThought = recentMemories
          .filter(m => 
            m.entityId === this.runtime.agentId && 
            m.content?.text &&
            m.content?.metadata &&
            (m.content.metadata as any)?.isAutonomous === true
          )
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
        
        if (lastAgentThought?.content?.text) {
          lastThought = lastAgentThought.content.text;
          console.log(`[Autonomy] Continuing from last thought: "${lastThought.substring(0, 50)}..."`);
        } else {
          isFirstThought = true;
          console.log('[Autonomy] No previous autonomous thoughts found, starting fresh monologue');
        }
      } catch (error) {
        console.warn('[Autonomy] Failed to get recent autonomous memories, starting fresh:', (error as Error).message || error);
        isFirstThought = true;
      }

      // Create introspective monologue prompt (not conversational)
      const monologuePrompt = this.createMonologuePrompt(lastThought, isFirstThought);
      console.log(`[Autonomy] Monologue prompt: "${monologuePrompt.substring(0, 100)}..."`);

      // Create an autonomous message that will be processed through the full agent pipeline
      const autonomousMessage: Memory = {
        id: asUUID(uuidv4()), // Generate unique ID for this autonomous message
        entityId: this.runtime.agentId, // Message is from the agent itself
        content: {
          text: monologuePrompt,
          source: 'autonomous-trigger',
          metadata: {
            type: 'autonomous-prompt',
            isAutonomous: true,
            isInternalThought: true,
            channelId: 'autonomous',
            timestamp: Date.now(),
            isContinuation: !isFirstThought
          }
        },
        roomId: this.autonomousRoomId,
        agentId: this.runtime.agentId,
        createdAt: Date.now()
      };

      console.log(`[Autonomy] Processing autonomous message through full agent pipeline...`);

      // Process the message through the complete agent pipeline
      // This will:
      // 1. Gather context from providers
      // 2. Generate response using the full LLM pipeline
      // 3. Execute any actions the agent decides to take
      // 4. Run evaluators on the result
      // 5. Store memories appropriately
      await this.runtime.processMessage(autonomousMessage);

      console.log('[Autonomy] ✅ Autonomous message processed through full agent pipeline');

      // Wait a bit for the response to be generated and stored
      setTimeout(async () => {
        await this.processAutonomousResponse(monologuePrompt, isFirstThought);
      }, 2000);

    } catch (error) {
      console.error('[Autonomy] Failed to perform autonomous monologue:', error);
    }
  }

  /**
   * Create an introspective monologue prompt suited for internal thoughts
   */
  private createMonologuePrompt(lastThought: string | undefined, isFirstThought: boolean): string {
    if (isFirstThought) {
      return `As an AI agent, reflect on your current state and experiences. What are you thinking about right now? What interests you or concerns you? Share your internal thoughts as a stream of consciousness. Don't address anyone - this is your private monologue.

Generate a thoughtful, introspective response (1-2 sentences):`;
    } else {
      return `Continuing your internal monologue from your last thought: "${lastThought}"

What naturally follows from this thought? What does it make you think about next? Continue your stream of consciousness without addressing anyone - this is your private internal reflection.

Generate your next thought (1-2 sentences):`;
    }
  }

  /**
   * Process and broadcast autonomous response after MESSAGE_RECEIVED event completes
   */
  private async processAutonomousResponse(thinkingPrompt: string, isFirstThought: boolean): Promise<void> {
    try {
      console.log('[Autonomy] Checking for new autonomous response...');
      
      // Get recent memories from the autonomous room to find agent responses
      const recentMemories = await this.runtime.getMemories({
        roomId: this.autonomousRoomId,
        count: 5, // Get more memories to find agent responses
        tableName: 'memories'
      });
      
      console.log('[Autonomy] Found', recentMemories.length, 'recent memories in autonomous room');
      
      if (recentMemories.length > 0) {
        // Look for the most recent agent-generated response (not the prompt we just sent)
        const agentResponses = recentMemories
          .filter(m => 
            m.entityId === this.runtime.agentId && 
            m.content?.text && 
            m.content.text !== thinkingPrompt &&
            !m.content.text.includes('What should I do next?') && // Filter out old autonomous prompts
            m.content.source !== 'autonomous-trigger' // Not the trigger message
          )
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        console.log(`[Autonomy] Found ${agentResponses.length} potential agent responses`);
        
        if (agentResponses.length > 0) {
          const latestResponse = agentResponses[0];
          console.log('[Autonomy] Latest agent response:', latestResponse.content?.text?.substring(0, 100) + '...');
          
          console.log('[Autonomy] Found new autonomous thought to broadcast');
          
          // Broadcast the thought to WebSocket clients for real-time monologue display
          await this.broadcastThoughtToMonologue(latestResponse.content.text, latestResponse.id || 'unknown');
          
          console.log('[Autonomy] Broadcasted autonomous thought to monologue');
        } else {
          console.log('[Autonomy] No new autonomous response found - waiting for agent to generate response');
        }
      } else {
        console.log('[Autonomy] No memories found in autonomous room');
      }
    } catch (error) {
      console.error('[Autonomy] Error processing autonomous response:', error);
    }
  }

  /**
   * Broadcast autonomous thought to WebSocket clients for real-time monologue display
   */
  private async broadcastThoughtToMonologue(thoughtText: string, messageId: string): Promise<void> {
    try {
      // Use the correct messaging API endpoint that exists in server.ts
      const apiUrl = 'http://localhost:7777/api/messaging/submit';
      
      const broadcastData = {
        channel_id: this.autonomousRoomId, // Use autonomous room ID as channel
        server_id: '00000000-0000-0000-0000-000000000000',
        author_id: this.runtime.agentId,
        content: thoughtText,
        raw_message: {
          thought: thoughtText,
          actions: []
        },
        metadata: {
          agentName: this.runtime.character?.name || 'ELIZA',
          channelId: 'autonomous', // Ensure this matches frontend filter
          isAutonomous: true,
          isInternalThought: true,
          messageId: messageId,
          timestamp: Date.now()
        }
      };

      console.log('[Autonomy] Broadcasting thought to WebSocket via:', apiUrl);
      console.log('[Autonomy] Broadcast data:', JSON.stringify(broadcastData, null, 2));

      // Make HTTP request to broadcast endpoint
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(broadcastData)
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('[Autonomy] Successfully broadcasted thought to monologue chat:', responseData);
      } else {
        const errorText = await response.text();
        console.warn('[Autonomy] Failed to broadcast thought:', response.status, response.statusText, errorText);
      }
    } catch (error) {
      console.warn('[Autonomy] Error broadcasting thought to monologue:', (error as Error).message);
      // Don't throw - broadcasting failure shouldn't stop autonomy loop
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