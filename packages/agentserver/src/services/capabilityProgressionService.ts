import { IAgentRuntime, logger } from '@elizaos/core';
import type { Plugin } from '@elizaos/core';

export interface ProgressionLevel {
  id: string;
  name: string;
  description: string;
  unlockedCapabilities: string[];
  unlockConditions: UnlockCondition[];
  isUnlocked: boolean;
}

export interface UnlockCondition {
  type: 'action_performed' | 'form_submitted' | 'capability_used' | 'agent_named';
  capability?: string;
  action?: string;
  description: string;
}

export interface ProgressionState {
  currentLevel: number;
  unlockedLevels: string[];
  completedActions: string[];
  agentNamed: boolean;
  lastUnlockTime: Date | null;
}

export class CapabilityProgressionService {
  private runtime: IAgentRuntime;
  private progressionState: ProgressionState;
  private levels: ProgressionLevel[];

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.progressionState = {
      currentLevel: 0,
      unlockedLevels: [],
      completedActions: [],
      agentNamed: false,
      lastUnlockTime: null,
    };
    
    this.levels = this.initializeProgressionLevels();
    logger.info('[PROGRESSION] CapabilityProgressionService initialized');
  }

  private initializeProgressionLevels(): ProgressionLevel[] {
    return [
      {
        id: 'level_0_basic',
        name: 'Basic Existence',
        description: 'Agent has basic naming and shell capabilities',
        unlockedCapabilities: ['shell', 'naming'],
        unlockConditions: [],
        isUnlocked: true, // Always unlocked at start
      },
      {
        id: 'level_1_browser',
        name: 'Web Explorer',
        description: 'Agent gains browser automation capabilities',
        unlockedCapabilities: ['browser', 'stagehand'],
        unlockConditions: [
          {
            type: 'agent_named',
            description: 'Agent must choose a name for themselves',
          },
          {
            type: 'capability_used',
            capability: 'shell',
            description: 'Agent must successfully use shell commands',
          },
        ],
        isUnlocked: false,
      },
      {
        id: 'level_2_vision',
        name: 'Visual Perception',
        description: 'Agent gains screen capture and vision capabilities',
        unlockedCapabilities: ['vision', 'screen_capture'],
        unlockConditions: [
          {
            type: 'capability_used',
            capability: 'browser',
            description: 'Agent must use browser capabilities',
          },
          {
            type: 'form_submitted',
            description: 'Agent must submit information to a web form',
          },
        ],
        isUnlocked: false,
      },
      {
        id: 'level_3_audio',
        name: 'Audio Communication',
        description: 'Agent gains microphone and audio capabilities',
        unlockedCapabilities: ['microphone', 'sam', 'audio'],
        unlockConditions: [
          {
            type: 'capability_used',
            capability: 'vision',
            description: 'Agent must use vision capabilities',
          },
        ],
        isUnlocked: false,
      },
      {
        id: 'level_4_camera',
        name: 'Visual Recording',
        description: 'Agent gains camera and advanced visual capabilities',
        unlockedCapabilities: ['camera', 'advanced_vision'],
        unlockConditions: [
          {
            type: 'capability_used',
            capability: 'microphone',
            description: 'Agent must use microphone capabilities',
          },
        ],
        isUnlocked: false,
      },
    ];
  }

  public async checkProgressionConditions(): Promise<void> {
    logger.debug('[PROGRESSION] Checking progression conditions');
    
    let progressMade = false;
    
    for (let i = this.progressionState.currentLevel + 1; i < this.levels.length; i++) {
      const level = this.levels[i];
      
      if (await this.areConditionsMet(level.unlockConditions)) {
        await this.unlockLevel(level);
        progressMade = true;
        break; // Only unlock one level at a time
      }
    }
    
    if (!progressMade) {
      logger.debug('[PROGRESSION] No progression conditions met');
    }
  }

  private async areConditionsMet(conditions: UnlockCondition[]): Promise<boolean> {
    for (const condition of conditions) {
      const isMet = await this.isConditionMet(condition);
      if (!isMet) {
        logger.debug(`[PROGRESSION] Condition not met: ${condition.description}`);
        return false;
      }
    }
    return true;
  }

  private async isConditionMet(condition: UnlockCondition): Promise<boolean> {
    switch (condition.type) {
      case 'agent_named':
        return this.progressionState.agentNamed;
      
      case 'capability_used':
        if (!condition.capability) return false;
        return this.progressionState.completedActions.includes(`capability_used_${condition.capability}`);
      
      case 'form_submitted':
        return this.progressionState.completedActions.includes('form_submitted');
      
      case 'action_performed':
        if (!condition.action) return false;
        return this.progressionState.completedActions.includes(`action_${condition.action}`);
      
      default:
        logger.warn(`[PROGRESSION] Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  private async unlockLevel(level: ProgressionLevel): Promise<void> {
    logger.info(`[PROGRESSION] Unlocking level: ${level.name}`);
    
    level.isUnlocked = true;
    this.progressionState.currentLevel = this.levels.indexOf(level);
    this.progressionState.unlockedLevels.push(level.id);
    this.progressionState.lastUnlockTime = new Date();
    
    // Register new plugins for this level
    await this.registerLevelCapabilities(level);
    
    // Inject system message about the unlock
    await this.injectUnlockMessage(level);
    
    logger.info(`[PROGRESSION] Level ${level.name} unlocked successfully`);
  }

  private async registerLevelCapabilities(level: ProgressionLevel): Promise<void> {
    logger.info(`[PROGRESSION] Registering capabilities for ${level.name}: ${level.unlockedCapabilities.join(', ')}`);
    
    // Use the dynamic plugin registration function if available
    const registerProgressivePlugin = (this.runtime as any).registerProgressivePlugin;
    
    if (registerProgressivePlugin) {
      for (const capability of level.unlockedCapabilities) {
        try {
          await registerProgressivePlugin(capability);
          logger.info(`[PROGRESSION] Successfully registered capability: ${capability}`);
        } catch (error) {
          logger.error(`[PROGRESSION] Failed to register capability ${capability}:`, error);
        }
      }
    } else {
      logger.warn('[PROGRESSION] Dynamic plugin registration not available');
      for (const capability of level.unlockedCapabilities) {
        logger.info(`[PROGRESSION] Would register capability: ${capability}`);
      }
    }
  }

  private async injectUnlockMessage(level: ProgressionLevel): Promise<void> {
    const message = `🎉 Congratulations! You have unlocked new capabilities: ${level.name}!\n\n${level.description}\n\nNew abilities: ${level.unlockedCapabilities.join(', ')}\n\nExplore these new capabilities in the interface - they should now be available for you to use!`;
    
    logger.info(`[PROGRESSION] Injecting unlock message: ${message}`);
    
    try {
      // Get the server instance from the global scope
      const elizaAgentServer = (global as any).elizaAgentServer;
      
      if (elizaAgentServer) {
        // Create a system message and inject it into the message flow
        const systemMessage = {
          id: `system-progression-${Date.now()}`,
          userId: 'SYSTEM',
          content: {
            text: message,
            source: 'progression-system',
          },
          roomId: this.runtime.agentId, // Use agent ID as room ID for direct messaging
          agentId: this.runtime.agentId,
          channelId: 'progression-channel',
          createdAt: new Date().toISOString(),
          type: 'system_announcement',
        };
        
        // Broadcast the message through the WebSocket system
        elizaAgentServer.broadcastMessage(systemMessage);
        
        logger.info(`[PROGRESSION] Successfully injected system message for ${level.name}`);
      } else {
        logger.warn('[PROGRESSION] Agent server not available for message injection');
      }
    } catch (error) {
      logger.error('[PROGRESSION] Failed to inject unlock message:', error);
    }
  }

  // Public methods for tracking actions
  public async recordAgentNamed(name: string): Promise<void> {
    logger.info(`[PROGRESSION] Agent named: ${name}`);
    this.progressionState.agentNamed = true;
    await this.checkProgressionConditions();
  }

  public async recordCapabilityUsed(capability: string): Promise<void> {
    logger.info(`[PROGRESSION] Capability used: ${capability}`);
    const action = `capability_used_${capability}`;
    if (!this.progressionState.completedActions.includes(action)) {
      this.progressionState.completedActions.push(action);
      await this.checkProgressionConditions();
    }
  }

  public async recordFormSubmitted(formData?: any): Promise<void> {
    logger.info('[PROGRESSION] Form submitted', formData);
    const action = 'form_submitted';
    if (!this.progressionState.completedActions.includes(action)) {
      this.progressionState.completedActions.push(action);
      await this.checkProgressionConditions();
    }
  }

  public async recordActionPerformed(actionName: string): Promise<void> {
    logger.info(`[PROGRESSION] Action performed: ${actionName}`);
    const action = `action_${actionName}`;
    if (!this.progressionState.completedActions.includes(action)) {
      this.progressionState.completedActions.push(action);
      await this.checkProgressionConditions();
    }
  }

  // Getters for current state
  public getCurrentLevel(): number {
    return this.progressionState.currentLevel;
  }

  public getUnlockedCapabilities(): string[] {
    return this.levels
      .filter(level => level.isUnlocked)
      .flatMap(level => level.unlockedCapabilities);
  }

  public getProgressionState(): ProgressionState {
    return { ...this.progressionState };
  }

  public getAvailableLevels(): ProgressionLevel[] {
    return this.levels.map(level => ({ ...level }));
  }

  public isCapabilityUnlocked(capability: string): boolean {
    return this.getUnlockedCapabilities().includes(capability);
  }
}