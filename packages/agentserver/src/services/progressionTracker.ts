import { IAgentRuntime, logger } from '@elizaos/core';
import { CapabilityProgressionService } from './capabilityProgressionService';

export class ProgressionTracker {
  private runtime: IAgentRuntime;
  private progressionService: CapabilityProgressionService;
  private trackingInterval: NodeJS.Timeout | null = null;
  private namingInterval: NodeJS.Timeout | null = null;

  constructor(runtime: IAgentRuntime, progressionService: CapabilityProgressionService) {
    this.runtime = runtime;
    this.progressionService = progressionService;
    this.setupTracking();
  }

  private setupTracking(): void {
    logger.info('[PROGRESSION_TRACKER] Setting up progression tracking');

    // Track when agents are named by monitoring character updates
    this.trackAgentNaming();
    
    // Set up periodic service usage checking
    this.startServiceUsageTracking();
  }

  private startServiceUsageTracking(): void {
    // Check service usage periodically rather than wrapping methods
    this.trackingInterval = setInterval(async () => {
      if (this.progressionService.isUnlockedModeEnabled()) {
        return; // Skip tracking in unlocked mode
      }

      // Check shell service usage via history
      try {
        const shellService = this.runtime.getService('SHELL');
        if (shellService && 'getHistory' in shellService) {
          const history = (shellService as any).getHistory?.();
          if (history && history.length > 0) {
            // If we have command history, shell has been used
            await this.progressionService.recordCapabilityUsed('shell');
          }
        }
      } catch {
        // Service might not be available yet
      }
    }, 10000); // Check every 10 seconds
  }

  // Method to track shell command execution - called from API endpoints
  public async trackShellCommand(command: string, exitCode: number): Promise<void> {
    if (this.progressionService.isUnlockedModeEnabled()) {
      return;
    }

    if (exitCode === 0) {
      logger.info('[PROGRESSION_TRACKER] Shell command executed successfully, recording capability usage');
      await this.progressionService.recordCapabilityUsed('shell');
    }
  }

  // Method to track goal creation - called from API endpoints
  public async trackGoalCreation(_goalData: any): Promise<void> {
    if (this.progressionService.isUnlockedModeEnabled()) {
      return;
    }

    logger.info('[PROGRESSION_TRACKER] Goal created, recording capability usage');
    await this.progressionService.recordCapabilityUsed('goals');
  }

  // Method to track todo creation - called from API endpoints
  public async trackTodoCreation(_todoData: any): Promise<void> {
    if (this.progressionService.isUnlockedModeEnabled()) {
      return;
    }

    logger.info('[PROGRESSION_TRACKER] Todo created, recording capability usage');
    await this.progressionService.recordCapabilityUsed('todo');
  }

  private trackAgentNaming(): void {
    // Skip tracking in unlocked mode
    if (this.progressionService.isUnlockedModeEnabled()) {
      logger.info('[PROGRESSION_TRACKER] Skipping agent naming tracking - unlocked mode enabled');
      return;
    }
    
    // Monitor if the agent's character name changes from the default
    const defaultNames = ['ELIZA', 'Unnamed Agent', 'TestAgent', ''];
    let currentName = this.runtime.character?.name || '';
    
    // Check if agent already has a custom name
    if (currentName && !defaultNames.includes(currentName)) {
      logger.info(`[PROGRESSION_TRACKER] Agent already has custom name: ${currentName}`);
      this.progressionService.recordAgentNamed(currentName);
    }
    
    // Set up periodic checking for name changes (simple approach)
    this.namingInterval = setInterval(() => {
      // Skip if now in unlocked mode
      if (this.progressionService.isUnlockedModeEnabled()) {
        return;
      }
      
      const newName = this.runtime.character?.name || '';
      if (newName && !defaultNames.includes(newName) && newName !== currentName) {
        logger.info(`[PROGRESSION_TRACKER] Agent name changed to: ${newName}`);
        this.progressionService.recordAgentNamed(newName);
        currentName = newName;
      }
    }, 5000); // Check every 5 seconds
  }

  // Method to manually track specific actions
  public async trackAction(actionType: string, details?: any): Promise<void> {
    // Skip tracking in unlocked mode
    if (this.progressionService.isUnlockedModeEnabled()) {
      logger.info(`[PROGRESSION_TRACKER] Skipping action tracking in unlocked mode: ${actionType}`);
      return;
    }
    
    logger.info(`[PROGRESSION_TRACKER] Manual action tracked: ${actionType}`, details);
    
    switch (actionType) {
      case 'form_submitted':
        await this.progressionService.recordFormSubmitted(details);
        break;
      case 'browser_used':
        await this.progressionService.recordCapabilityUsed('browser');
        break;
      case 'vision_used':
        await this.progressionService.recordCapabilityUsed('vision');
        break;
      case 'microphone_used':
        await this.progressionService.recordCapabilityUsed('microphone');
        break;
      default:
        await this.progressionService.recordActionPerformed(actionType);
        break;
    }
  }

  // Method to check and display current progression status
  public getProgressionStatus(): any {
    const state = this.progressionService.getProgressionState();
    const unlockedCapabilities = this.progressionService.getUnlockedCapabilities();
    const availableLevels = this.progressionService.getAvailableLevels();
    const isUnlockedMode = this.progressionService.isUnlockedModeEnabled();
    
    return {
      mode: isUnlockedMode ? 'unlocked' : 'progression',
      isUnlockedMode,
      currentLevel: state.currentLevel,
      unlockedLevels: state.unlockedLevels,
      completedActions: state.completedActions,
      agentNamed: state.agentNamed,
      unlockedCapabilities,
      availableLevels: availableLevels.map(level => ({
        id: level.id,
        name: level.name,
        description: level.description,
        isUnlocked: level.isUnlocked,
        capabilities: level.unlockedCapabilities,
      })),
    };
  }

  // Cleanup method to stop intervals
  public cleanup(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    if (this.namingInterval) {
      clearInterval(this.namingInterval);
      this.namingInterval = null;
    }
    logger.info('[PROGRESSION_TRACKER] Cleaned up tracking intervals');
  }
}