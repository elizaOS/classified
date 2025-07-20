import { 
  Service, 
  type IAgentRuntime, 
  type UUID, 
  asUUID,
  type Memory,
  type Content 
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Simple autonomous loop service that can be toggled on/off via API
 * Continuously triggers agent thinking in a separate autonomous context
 */
export class AutonomyService extends Service {
  static serviceType = 'autonomy';
  
  private isRunning = false;
  private loopInterval?: NodeJS.Timeout;
  private intervalMs = 30000; // Default 30 seconds
  private autonomousRoomId: UUID; // Dedicated room for autonomous thoughts
  
  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    
    // Create dedicated autonomous room ID (consistent across restarts)
    // Use a deterministic approach to generate a valid UUID for the autonomous room
    const roomSeed = `autonomous-${runtime.agentId}`;
    this.autonomousRoomId = asUUID(uuidv4()); // For now, use random UUID - in production this could be deterministic
  }

  static async start(runtime: IAgentRuntime): Promise<AutonomyService> {
    const service = new AutonomyService(runtime);
    await service.initialize();
    return service;
  }

  async initialize(): Promise<void> {
    // Create the autonomous room if it doesn't exist
    const existingRoom = await this.runtime.getRoom(this.autonomousRoomId);
    if (!existingRoom) {
      // Get or create a default world for the autonomous room
      let defaultWorld = await this.runtime.getWorld(asUUID('00000000-0000-0000-0000-000000000000'));
      if (!defaultWorld) {
        await this.runtime.createWorld({
          id: asUUID('00000000-0000-0000-0000-000000000000'),
          name: 'Default World',
          agentId: this.runtime.agentId,
          serverId: 'autonomy'
        });
      }

      await this.runtime.createRoom({
        id: this.autonomousRoomId,
        name: 'Autonomous Thinking',
        source: 'autonomy',
        type: 'DIRECT_MESSAGE' as any,
        worldId: asUUID('00000000-0000-0000-0000-000000000000'),
        metadata: {
          purpose: 'autonomous-thinking',
          description: 'Internal room for autonomous agent thoughts and actions'
        }
      });
    }

    // Check current autonomy setting
    const autonomyEnabled = this.runtime.getSetting('AUTONOMY_ENABLED');
    const autoStart = this.runtime.getSetting('AUTONOMY_AUTO_START');
    
    // Start by default unless explicitly disabled
    // Start if autonomy is enabled, auto-start is configured, or no setting exists (default on)
    if (autonomyEnabled === true || autonomyEnabled === 'true' || 
        autoStart === true || autoStart === 'true' ||
        (autonomyEnabled === undefined && autoStart === undefined)) {
      await this.startLoop();
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

    console.log(`[Autonomy] Starting autonomous loop (interval: ${this.intervalMs}ms)`);
    
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
    console.log('[Autonomy] Performing autonomous think...');

    // Create autonomous thinking message
    const autonomousMessage: Memory = {
      id: asUUID(uuidv4()),
      entityId: this.runtime.agentId, // Agent is talking to itself
      roomId: this.autonomousRoomId,
      content: {
        text: 'What should I do next? Think about recent conversations, goals, and actions I could take.',
        source: 'autonomy-system',
        metadata: {
          type: 'autonomous-prompt',
          timestamp: Date.now()
        }
      },
      createdAt: Date.now()
    };

    try {
      // Send message to autonomous room to trigger thinking
      await this.runtime.sendMessageToTarget(
        { 
          source: 'autonomy-system',
          roomId: this.autonomousRoomId 
        },
        autonomousMessage.content
      );
      
      console.log('[Autonomy] Autonomous think message sent');
    } catch (error) {
      console.error('[Autonomy] Failed to send autonomous message:', error);
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
    if (ms < 5000) {
      console.warn('[Autonomy] Interval too short, minimum is 5 seconds');
      ms = 5000;
    }
    if (ms > 600000) {
      console.warn('[Autonomy] Interval too long, maximum is 10 minutes');
      ms = 600000;
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