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
      
      if (service && serviceName === 'SHELL') {
        // Wrap shell service methods to track usage
        this.wrapShellService(service);
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
        
        // Track shell usage after successful command execution
        if (result && result.exitCode === 0) {
          logger.info('[PROGRESSION_TRACKER] Shell command executed successfully, recording capability usage');
          await this.progressionService.recordCapabilityUsed('shell');
        }
        
        return result;
      };
      
      shellService._progressionWrapped = true;
      logger.info('[PROGRESSION_TRACKER] Shell service wrapped for progression tracking');
    }
  }

  private trackAgentNaming(): void {
    // Monitor if the agent's character name changes from the default
    const defaultNames = ['ELIZA', 'Unnamed Agent', 'TestAgent', ''];
    const currentName = this.runtime.character?.name || '';
    
    // Check if agent already has a custom name
    if (currentName && !defaultNames.includes(currentName)) {
      logger.info(`[PROGRESSION_TRACKER] Agent already has custom name: ${currentName}`);
      this.progressionService.recordAgentNamed(currentName);
    }
    
    // Set up periodic checking for name changes (simple approach)
    setInterval(() => {
      const newName = this.runtime.character?.name || '';
      if (newName && !defaultNames.includes(newName) && newName !== currentName) {
        logger.info(`[PROGRESSION_TRACKER] Agent name changed to: ${newName}`);
        this.progressionService.recordAgentNamed(newName);
      }
    }, 5000); // Check every 5 seconds
  }

  // Method to manually track specific actions
  public async trackAction(actionType: string, details?: any): Promise<void> {
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
    
    return {
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