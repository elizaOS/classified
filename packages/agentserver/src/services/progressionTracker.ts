import { IAgentRuntime, logger } from '@elizaos/core';
import { CapabilityProgressionService } from './capabilityProgressionService';

export class ProgressionTracker {
  private runtime: IAgentRuntime;
  private progressionService: CapabilityProgressionService;

  constructor(runtime: IAgentRuntime, progressionService: CapabilityProgressionService) {
    this.runtime = runtime;
    this.progressionService = progressionService;
    this.setupActionHooks();
  }

  private setupActionHooks(): void {
    logger.info('[PROGRESSION_TRACKER] Setting up action hooks for progression tracking');

    // Override the runtime's executeAction method to track capability usage
    const originalGetService = this.runtime.getService.bind(this.runtime);
    
    this.runtime.getService = (serviceName: string) => {
      const service = originalGetService(serviceName);
      
      if (service) {
        switch (serviceName) {
          case 'SHELL':
            this.wrapShellService(service);
            break;
          case 'goals':
            this.wrapGoalsService(service);
            break;
          case 'TODO':
            this.wrapTodoService(service);
            break;
        }
      }
      
      return service;
    };

    // Track when agents are named by monitoring character updates
    this.trackAgentNaming();
  }

  private wrapShellService(shellService: any): void {
    if (shellService.executeCommand && !shellService._progressionWrapped) {
      const originalExecuteCommand = shellService.executeCommand.bind(shellService);
      
      shellService.executeCommand = async (...args: any[]) => {
        const result = await originalExecuteCommand(...args);
        
        // Track shell usage after successful command execution (only in progression mode)
        if (result && result.exitCode === 0 && !this.progressionService.isUnlockedModeEnabled()) {
          logger.info('[PROGRESSION_TRACKER] Shell command executed successfully, recording capability usage');
          await this.progressionService.recordCapabilityUsed('shell');
        }
        
        return result;
      };
      
      shellService._progressionWrapped = true;
      logger.info('[PROGRESSION_TRACKER] Shell service wrapped for progression tracking');
    }
  }

  private wrapGoalsService(goalsService: any): void {
    if (goalsService.createGoal && !goalsService._progressionWrapped) {
      const originalCreateGoal = goalsService.createGoal.bind(goalsService);
      
      goalsService.createGoal = async (...args: any[]) => {
        const result = await originalCreateGoal(...args);
        
        if (result && !this.progressionService.isUnlockedModeEnabled()) {
          logger.info('[PROGRESSION_TRACKER] Goal created, recording capability usage');
          await this.progressionService.recordCapabilityUsed('goals');
        }
        
        return result;
      };
      
      goalsService._progressionWrapped = true;
      logger.info('[PROGRESSION_TRACKER] Goals service wrapped for progression tracking');
    }
  }

  private wrapTodoService(todoService: any): void {
    if (todoService.createTodo && !todoService._progressionWrapped) {
      const originalCreateTodo = todoService.createTodo.bind(todoService);
      
      todoService.createTodo = async (...args: any[]) => {
        const result = await originalCreateTodo(...args);
        
        if (result && !this.progressionService.isUnlockedModeEnabled()) {
          logger.info('[PROGRESSION_TRACKER] Todo created, recording capability usage');
          await this.progressionService.recordCapabilityUsed('todo');
        }
        
        return result;
      };
      
      todoService._progressionWrapped = true;
      logger.info('[PROGRESSION_TRACKER] Todo service wrapped for progression tracking');
    }
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
    setInterval(() => {
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
}