import { Service, type IAgentRuntime, type Memory, UUID, asUUID, Content } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

export class AutonomousLoopService extends Service {
  static serviceType = 'autonomous-loop';
  static serviceName = 'autonomous-loop';

  private isRunning = false;
  private loopInterval?: NodeJS.Timeout;
  private intervalMs = 30000; // Default 30 seconds
  private roomId?: UUID;
  private systemEntityId: UUID; // System entity ID for autonomous messages

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    // Create a consistent system entity ID for autonomous messages
    this.systemEntityId = asUUID(uuidv4().replace(/-/g, '').slice(0, 8) + '-system-autonomy-loop');
  }

  static async start(runtime: IAgentRuntime): Promise<AutonomousLoopService> {
    const service = new AutonomousLoopService(runtime);
    await service.initialize();
    return service;
  }

  async initialize(): Promise<void> {
    // Use the agent ID as the room ID for autonomous operations
    // This ensures we have a valid UUID and keeps autonomous messages separate
    this.roomId = this.runtime.agentId;

    // Check if autonomy is enabled in settings (database persisted)
    const autonomyEnabled = this.runtime.getSetting('AUTONOMY_ENABLED');

    // Check if loop should auto-start (environment variable takes precedence for initial state)
    const autoStart = this.runtime.getSetting('AUTONOMOUS_AUTO_START');

    // Start if either autonomy is enabled or auto-start is set
    if (
      autonomyEnabled === true ||
      autonomyEnabled === 'true' ||
      autoStart === true ||
      autoStart === 'true'
    ) {
      await this.startLoop();
    }
  }

  async startLoop(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Save the autonomy state to settings (persists to database)
    this.runtime.setSetting('AUTONOMY_ENABLED', true);

    // Persist the setting to database
    if (this.runtime.agentId) {
      try {
        await this.runtime.updateAgent(this.runtime.agentId, {
          settings: {
            ...this.runtime.character.settings,
            AUTONOMY_ENABLED: true,
          },
        });
      } catch (error) {
        console.error('[AutonomousLoop] Failed to persist autonomy state to database:', error);
      }
    }

    console.log(`[AutonomousLoop] Starting autonomous loop for agent ${this.runtime.agentId}`);
    
    // Emit log event if runtime supports it, otherwise just log
    const logMessage = {
      level: 'info',
      message: `Autonomous loop started (interval: ${this.intervalMs}ms)`,
      timestamp: Date.now(),
      source: 'autonomy',
    };
    
    if (typeof (this.runtime as any).emit === 'function') {
      (this.runtime as any).emit('log', logMessage);
    } else {
      console.log('[AutonomousLoop] Log:', logMessage);
    }

    // Start the loop immediately, then set interval
    await this.executeLoop();

    this.loopInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.executeLoop();
      }
    }, this.intervalMs);
  }

  async stopLoop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = undefined;
    }

    // Save the autonomy state to settings (persists to database)
    this.runtime.setSetting('AUTONOMY_ENABLED', false);

    // Persist the setting to database
    if (this.runtime.agentId) {
      try {
        await this.runtime.updateAgent(this.runtime.agentId, {
          settings: {
            ...this.runtime.character.settings,
            AUTONOMY_ENABLED: false,
          },
        });
      } catch (error) {
        console.error('[AutonomousLoop] Failed to persist autonomy state to database:', error);
      }
    }

    console.log(`[AutonomousLoop] Stopped autonomous loop for agent ${this.runtime.agentId}`);
    
    // Emit log event if runtime supports it
    const logMessage = {
      level: 'info',
      message: 'Autonomous loop stopped',
      timestamp: Date.now(),
      source: 'autonomy',
    };
    
    if (typeof (this.runtime as any).emit === 'function') {
      (this.runtime as any).emit('log', logMessage);
    } else {
      console.log('[AutonomousLoop] Log:', logMessage);
    }
  }

  async executeLoop(): Promise<void> {
    try {
      if (!this.roomId) {
        console.error('[AutonomousLoop] No room ID available for autonomous operation');
        return;
      }

      // Emit log event for loop execution
      const startLog = {
        level: 'debug',
        message: 'Executing autonomous loop iteration',
        timestamp: Date.now(),
        source: 'autonomy',
      };
      
      if (typeof (this.runtime as any).emit === 'function') {
        (this.runtime as any).emit('log', startLog);
      }

      // Create a self-message to trigger the agent's autonomous thinking
      const autonomousMessage: Memory = {
        id: asUUID(uuidv4()),
        entityId: this.systemEntityId, // Use system entity ID instead of agent ID
        roomId: this.roomId,
        content: {
          text: 'What should I do next? Think about your goals and take appropriate actions.',
          thought: 'Autonomous loop iteration - time to think and act',
          source: 'autonomy-system', // Mark as coming from autonomy system
        },
      };

      // Process the message through the normal runtime flow
      // This will trigger providers, actions, and evaluators naturally
      await this.runtime.processMessage(autonomousMessage, async (content: Content) => {
        console.log('[AutonomousLoop] Message processed:', content.text?.substring(0, 100) + '...');
        
        // Emit log with the response
        if (typeof (this.runtime as any).emit === 'function') {
          (this.runtime as any).emit('log', {
            level: 'info',
            message: `Autonomous thought: ${content.text?.substring(0, 100)}...`,
            timestamp: Date.now(),
            source: 'autonomy',
          });
        }
        
        return Promise.resolve([]); // Return empty array to indicate no further actions
      });
      
      // Emit success log
      const successLog = {
        level: 'debug',
        message: 'Autonomous loop iteration completed',
        timestamp: Date.now(),
        source: 'autonomy',
      };
      
      if (typeof (this.runtime as any).emit === 'function') {
        (this.runtime as any).emit('log', successLog);
      }
    } catch (error) {
      console.error('[AutonomousLoop] Error in loop execution:', error);
      
      // Emit error log
      const errorLog = {
        level: 'error',
        message: `Autonomous loop error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        source: 'autonomy',
      };
      
      if (typeof (this.runtime as any).emit === 'function') {
        (this.runtime as any).emit('log', errorLog);
      } else {
        console.error('[AutonomousLoop] Log:', errorLog);
      }
      
      // Don't stop the loop on individual errors, just log and continue
    }
  }

  isLoopRunning(): boolean {
    return this.isRunning;
  }

  getLoopInterval(): number {
    return this.intervalMs;
  }

  setLoopInterval(ms: number): void {
    this.intervalMs = ms;

    // Restart the loop with new interval if it's currently running
    if (this.isRunning) {
      this.stopLoop();
      this.startLoop();
    }
  }

  async stop(): Promise<void> {
    await this.stopLoop();
  }

  get capabilityDescription(): string {
    return 'Provides autonomous loop functionality that continuously triggers agent thinking and actions';
  }

  /**
   * Get the current autonomy status
   * @returns Object containing the autonomy state
   */
  getStatus(): { enabled: boolean; interval: number; lastExecution?: number } {
    return {
      enabled: this.isRunning,
      interval: this.intervalMs,
    };
  }
}
