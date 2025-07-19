/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Service,
  type IAgentRuntime,
  type Memory,
  createUniqueUuid,
  type State,
  type Content,
  composePromptFromState,
  ModelType,
  parseKeyValueXml,
  messageHandlerTemplate,
  type HandlerCallback,
  asUUID,
  type UUID,
  ChannelType,
  type Task,
} from '@elizaos/core';
import {
  type OODAContext,
  OODAPhase,
  type Observation,
  ObservationType,
  type Decision,
  DecisionType,
  type ActionExecution,
  ActionStatus,
  type LoopMetrics,
  ErrorType,
  ErrorSeverity,
  type Goal,
  type ResourceStatus,
  AutonomousServiceType,
  type ErrorContext,
  type Learning,
} from './types';
import { getLogger, type AutonomyLogger } from './logging';

// Simple ID generator to replace uuid
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export class OODALoopService extends Service {
  static serviceType: string = AutonomousServiceType.AUTONOMOUS;
  capabilityDescription = 'OODA Loop autonomous decision-making service';

  private logger: AutonomyLogger;
  private currentContext: OODAContext | null = null;
  private isRunning: boolean = false;
  private isLoopActive: boolean = false; // Track if a loop is currently executing
  private goals: Goal[] = [];
  private maxConcurrentActions: number = 3;
  private actionTimeout: number = 60000; // 60 seconds
  private baseLoopDelay: number = 5000; // Base delay between loops
  private minLoopDelay: number = 1000; // Minimum 1 second between loops
  private autonomousRoomId: UUID | null = null;
  private autonomousWorldId: UUID | null = null;

  // Real action tracking
  private actionResults: {
    success: boolean;
    timestamp: number;
    actionName?: string;
    error?: string;
  }[] = [];
  private readonly maxActionHistorySize = 100;

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    this.logger = getLogger(runtime);
    this.initialize();
  }

  private async initialize() {
    // Initialize autonomous room and world
    await this.initializeAutonomousEnvironment();

    // Load goals from character config or create defaults
    this.goals = this.loadGoals();

    // Load configuration from environment
    this.loadConfiguration();

    // Start the OODA loop
    this.isRunning = true;
    this.scheduleNextLoop(0); // Start immediately
  }

  private async initializeAutonomousEnvironment() {
    // For autonomous operations, we don't need persistent rooms/worlds
    // Just use consistent UUIDs for this session
    this.autonomousWorldId = asUUID('00000000-0000-0000-0000-000000000001');
    this.autonomousRoomId = asUUID('00000000-0000-0000-0000-000000000002');

    // Try to create the world and room if they don't exist (only in environments that support it)
    if (
      typeof this.runtime.createWorld === 'function' &&
      typeof this.runtime.createRoom === 'function'
    ) {
      try {
        // Create autonomous world
        await this.runtime.createWorld({
          id: this.autonomousWorldId,
          name: 'Autonomous World',
          agentId: this.runtime.agentId,
          serverId: 'autonomous',
          metadata: {
            description: 'World for autonomous agent operations',
          },
        });

        // Create autonomous room
        await this.runtime.createRoom({
          id: this.autonomousRoomId,
          name: 'Autonomous Operations',
          agentId: this.runtime.agentId,
          source: 'autonomous',
          type: ChannelType.SELF,
          worldId: this.autonomousWorldId,
          metadata: {
            description: 'Room for autonomous agent thoughts and actions',
          },
        });
      } catch (error) {
        // Rooms/worlds might already exist or creation might fail in test environment
        this.logger.debug('World/room creation skipped', { error });
      }
    }

    this.logger.info('Autonomous environment initialized', {
      worldId: this.autonomousWorldId,
      roomId: this.autonomousRoomId,
    });
  }

  private loadConfiguration() {
    // Load timing configuration from environment
    const loopInterval = process.env.AUTONOMOUS_LOOP_INTERVAL;
    if (loopInterval) {
      this.baseLoopDelay = Math.max(parseInt(loopInterval, 10), this.minLoopDelay);
    }

    const maxConcurrent = process.env.AUTONOMOUS_MAX_CONCURRENT;
    if (maxConcurrent) {
      this.maxConcurrentActions = parseInt(maxConcurrent, 10);
    }

    const actionTimeout = process.env.AUTONOMOUS_ACTION_TIMEOUT;
    if (actionTimeout) {
      this.actionTimeout = parseInt(actionTimeout, 10);
    }

    this.logger.info('OODA Loop configuration loaded', {
      baseLoopDelay: this.baseLoopDelay,
      maxConcurrentActions: this.maxConcurrentActions,
      actionTimeout: this.actionTimeout,
    });
  }

  private loadGoals(): Goal[] {
    // Load from character settings or use defaults
    const characterGoals = this.runtime.character.settings?.goals as Goal[] | undefined;

    if (characterGoals && characterGoals.length > 0) {
      return characterGoals;
    }

    // Default goals
    return [
      {
        id: generateId(),
        description: 'Learn and improve capabilities',
        priority: 1,
        progress: 0,
      },
      {
        id: generateId(),
        description: 'Complete assigned tasks efficiently',
        priority: 2,
        progress: 0,
      },
      {
        id: generateId(),
        description: 'Maintain system health and stability',
        priority: 3,
        progress: 0,
      },
    ];
  }

  private scheduleNextLoop(delay: number) {
    if (!this.isRunning) {
      return;
    }

    // Ensure minimum delay between loops
    const actualDelay = Math.max(delay, this.minLoopDelay);

    setTimeout(async () => {
      if (!this.isRunning) {
        return;
      }

      // Only start a new loop if the previous one has completed
      if (!this.isLoopActive) {
        await this.executeOODACycle();
      } else {
        this.logger.warn('Previous OODA loop still active, skipping this cycle');
      }

      // Schedule next loop
      if (this.isRunning) {
        this.scheduleNextLoop(this.baseLoopDelay);
      }
    }, actualDelay);
  }

  private async executeOODACycle() {
    // Mark loop as active
    this.isLoopActive = true;
    const runId = generateId();
    const startTime = Date.now();

    // Initialize context for this run
    this.currentContext = {
      runId,
      startTime,
      phase: OODAPhase.OBSERVING,
      observations: [],
      orientation: {
        currentGoals: this.goals,
        activeProjects: [],
        resourceStatus: await this.getResourceStatus(),
        environmentalFactors: [],
        historicalContext: {
          recentActions: [],
          recentErrors: [],
          successPatterns: [],
          failurePatterns: [],
          learnings: [],
        },
      },
      decisions: [],
      actions: [],
      errors: [],
      metrics: {
        cycleTime: 0,
        decisionsPerCycle: 0,
        actionSuccessRate: 0,
        errorRate: 0,
        resourceEfficiency: 0,
        goalProgress: 0,
      },
    };

    await this.logger.startRun(runId);

    try {
      // Execute OODA phases with proper ElizaOS integration

      // OBSERVE - Collect providers
      const observationMemory = await this.observe();

      // ORIENT - Compose state and context
      const { state, orientMemory } = await this.orient(observationMemory);

      // DECIDE - Action planning phase using messageHandlerTemplate
      const { responseContent, responseMessages } = await this.decide(state, orientMemory);

      // If we have providers in the response, recompose state with them
      let finalState = state;
      if (responseContent?.providers?.length) {
        this.logger.info('Recomposing state with dynamic providers', {
          providers: responseContent.providers,
        });
        finalState = await this.runtime.composeState(orientMemory, responseContent.providers);
      }

      // ACT - Execute actions using processActions
      if (responseContent && !responseContent.simple) {
        await this.act(observationMemory, responseMessages, finalState);
      }

      // EVALUATE - Run evaluators
      await this.evaluate(observationMemory, finalState, responseMessages);

      // REFLECT - Learn and adapt
      await this.reflect();

      // Calculate metrics
      this.currentContext.metrics = this.calculateMetrics();
      this.logger.logMetrics({ ...this.currentContext.metrics });
    } catch (error) {
      this.logger.error('OODA cycle error', error as Error, {
        phase: this.currentContext.phase,
        runId,
      });
      this.currentContext.errors.push(error as Error);
    } finally {
      // Mark loop as complete
      this.isLoopActive = false;

      // Log cycle completion time
      const cycleTime = Date.now() - startTime;

      // Update cycle time metric even if there was an error
      if (this.currentContext) {
        // Ensure metrics object exists
        if (!this.currentContext.metrics) {
          this.currentContext.metrics = {
            cycleTime: 0,
            decisionsPerCycle: 0,
            actionSuccessRate: 0,
            errorRate: 0,
            resourceEfficiency: 0,
            goalProgress: 0,
          };
        }
        this.currentContext.metrics.cycleTime = cycleTime;
      }

      this.logger.info(`OODA cycle completed in ${cycleTime}ms`, {
        runId,
        cycleTime,
      });

      await this.logger.endRun();
    }
  }

  private async observe(): Promise<Memory> {
    this.currentContext!.phase = OODAPhase.OBSERVING;
    this.logger.observing('Starting observation phase - collecting providers');

    const observations: Observation[] = [];

    // Create an observation memory
    const observationMemory: Memory = {
      id: createUniqueUuid(this.runtime, 'observe'),
      content: {
        text: 'Autonomous agent observing environment',
        source: 'autonomous',
        thought: 'Gathering information from available providers',
      },
      roomId: this.autonomousRoomId!,
      worldId: this.autonomousWorldId!,
      agentId: this.runtime.agentId,
      entityId: this.runtime.agentId,
      createdAt: Date.now(),
    };

    // Save observation to memory if createMemory is available
    if (typeof this.runtime.createMemory === 'function') {
      try {
        await this.runtime.createMemory(observationMemory, 'messages');
      } catch (error) {
        this.logger.warn('Failed to save observation memory', { error });
      }
    }

    // Collect data from various providers
    try {
      // Get relevant providers
      const providers = this.runtime.providers.filter(
        (p) => !p.private || p.name === 'AUTONOMOUS_FEED'
      );

      // Collect provider data
      for (const provider of providers) {
        try {
          const result = await provider.get(this.runtime, observationMemory, {} as State);

          if (result && (result.text || result.data)) {
            observations.push({
              timestamp: Date.now(),
              type: ObservationType.EXTERNAL_EVENT,
              source: provider.name,
              data: result,
              relevance: this.calculateProviderRelevance(provider.name),
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to get data from provider ${provider.name}`, {
            error: error instanceof Error ? error.message : String(error),
            provider: provider.name,
          });
          // Continue with other providers
        }
      }
    } catch (error) {
      this.logger.warn('Error collecting provider data', { error });
    }

    // Observe task status
    const tasks = await this.observeTasks();
    observations.push(...tasks);

    // Observe system state
    const systemState = await this.observeSystemState();
    observations.push(systemState);

    // Observe goal progress
    const goalProgress = await this.observeGoalProgress();
    observations.push(...goalProgress);

    const actionCapabilities = await this.observeActionCapabilities();
    observations.push(...actionCapabilities);

    const fileSystemState = await this.observeFileSystemState();
    if (fileSystemState) {
      observations.push(fileSystemState);
    }

    const recentCommands = await this.observeRecentCommands();
    observations.push(...recentCommands);

    this.currentContext!.observations = observations;
    this.logger.observing('Completed observation phase', {
      observationCount: observations.length,
      types: observations.map((o) => o.type),
    });

    return observationMemory;
  }

  private calculateProviderRelevance(providerName: string): number {
    // Prioritize certain providers for autonomous operation
    const priorities: Record<string, number> = {
      AUTONOMOUS_FEED: 0.9,
      DOCUMENTATION_RESEARCH_CONTEXT: 0.8,
      GITHUB_ANALYSIS_CONTEXT: 0.8,
      SYSTEM_HEALTH_CONTEXT: 0.85,
      LEARNING_PATH_CONTEXT: 0.7,
    };

    return priorities[providerName] || 0.5;
  }

  private async observeTasks(): Promise<Observation[]> {
    const observations: Observation[] = [];

    try {
      const tasks = await this.runtime.getTasks({
        roomId: this.autonomousRoomId!,
      });

      for (const task of tasks) {
        observations.push({
          timestamp: Date.now(),
          type: ObservationType.TASK_STATUS,
          source: 'task_system',
          data: task,
          relevance: this.calculateTaskRelevance(task),
        });
      }
    } catch (error) {
      this.logger.warn('Failed to observe tasks', { error });
    }

    return observations;
  }

  private calculateTaskRelevance(task: Task): number {
    let relevance = 0.5;

    // Increase relevance for urgent tasks
    if (task.tags?.includes('urgent')) {
      relevance += 0.3;
    }
    if (task.tags?.includes('high-priority')) {
      relevance += 0.2;
    }
    if (task.tags?.includes('autonomous')) {
      relevance += 0.1;
    }

    // Recently created tasks are more relevant
    const taskCreatedAt = (task as Task & { createdAt?: number }).createdAt;
    if (taskCreatedAt) {
      const ageHours = (Date.now() - taskCreatedAt) / (1000 * 60 * 60);
      if (ageHours < 1) {
        relevance += 0.2;
      } else if (ageHours < 24) {
        relevance += 0.1;
      }
    }

    return Math.min(relevance, 1);
  }

  private async observeSystemState(): Promise<Observation> {
    const status = await this.getResourceStatus();

    return {
      timestamp: Date.now(),
      type: ObservationType.SYSTEM_STATE,
      source: 'system_monitor',
      data: status,
      relevance: this.calculateSystemRelevance(status),
    };
  }

  private calculateSystemRelevance(status: ResourceStatus): number {
    let relevance = 0.3; // Base relevance

    // Increase relevance if resources are constrained
    if (status.cpu > 80) {
      relevance += 0.3;
    }
    if (status.memory > 80) {
      relevance += 0.2;
    }
    if (status.taskSlots.used >= status.taskSlots.total) {
      relevance += 0.4;
    }

    return Math.min(relevance, 1);
  }

  private async observeGoalProgress(): Promise<Observation[]> {
    const observations: Observation[] = [];

    for (const goal of this.goals) {
      observations.push({
        timestamp: Date.now(),
        type: ObservationType.GOAL_PROGRESS,
        source: 'goal_tracker',
        data: goal,
        relevance: 0.6 + goal.priority / 10, // Higher priority = higher relevance
      });
    }

    return observations;
  }

  private async getResourceStatus(): Promise<ResourceStatus> {
    // Try to get from resource monitor service
    let resourceMonitor: Service | null = null;
    if (typeof this.runtime.getService === 'function') {
      resourceMonitor = this.runtime.getService('resource-monitor');
    }

    if (resourceMonitor && 'getResourceStatus' in resourceMonitor) {
      const status = (
        resourceMonitor as { getResourceStatus: () => ResourceStatus }
      ).getResourceStatus();
      // Update task slots based on current actions
      status.taskSlots = {
        used:
          this.currentContext?.actions.filter((a) => a.status === ActionStatus.RUNNING).length || 0,
        total: this.maxConcurrentActions,
      };
      return status;
    }

    // Fallback if no resource monitor
    const taskSlots = {
      used:
        this.currentContext?.actions.filter((a) => a.status === ActionStatus.RUNNING).length || 0,
      total: this.maxConcurrentActions,
    };

    return {
      cpu: 50, // Placeholder - could integrate with actual monitoring
      memory: 40, // Placeholder
      diskSpace: 70, // Placeholder
      apiCalls: {}, // Placeholder
      taskSlots,
    };
  }

  private async orient(observationMemory: Memory): Promise<{ state: State; orientMemory: Memory }> {
    this.currentContext!.phase = OODAPhase.ORIENTING;
    this.logger.orienting('Starting orientation phase - composing state and context');

    // Create a memory for orientation
    const orientMemory: Memory = {
      id: createUniqueUuid(this.runtime, 'orient'),
      content: {
        text: 'Analyzing current situation for autonomous decision-making',
        source: 'autonomous',
        thought: 'Orienting to current context and observations',
        inReplyTo: observationMemory.id,
      },
      roomId: observationMemory.roomId,
      worldId: observationMemory.worldId,
      agentId: this.runtime.agentId,
      entityId: this.runtime.agentId,
      createdAt: Date.now(),
    };

    // Save orientation to memory if createMemory is available
    if (typeof this.runtime.createMemory === 'function') {
      try {
        await this.runtime.createMemory(orientMemory, 'messages');
      } catch (error) {
        this.logger.warn('Failed to save orientation memory', { error });
      }
    }

    // Compose initial state with standard providers
    let state: State;
    try {
      state = await this.runtime.composeState(orientMemory, [
        'AUTONOMOUS_FEED',
        'CHARACTER',
        'RECENT_MESSAGES',
        'ENTITIES',
        'ACTIONS',
      ]);
    } catch (error) {
      this.logger.warn('Failed to compose state with all providers, trying with minimal set', {
        error,
      });
      // Try with just the autonomous feed if other providers fail
      state = await this.runtime.composeState(orientMemory, ['AUTONOMOUS_FEED']);
    }

    // Analyze observations to update orientation
    const relevantObservations = this.currentContext!.observations.filter(
      (o) => o.relevance > 0.5
    ).sort((a, b) => b.relevance - a.relevance);

    this.logger.orienting('Analyzing observations', {
      total: this.currentContext!.observations.length,
      relevant: relevantObservations.length,
    });

    // Update environmental factors based on observations
    this.updateEnvironmentalFactors(relevantObservations);

    // Identify patterns
    this.identifyPatterns(relevantObservations);

    // Update goal priorities based on observations
    this.updateGoalPriorities(relevantObservations);

    // NEW: Analyze action opportunities based on observations
    this.identifyActionOpportunities(relevantObservations, state);

    this.logger.orienting('Completed orientation phase', {
      factors: this.currentContext!.orientation.environmentalFactors.length,
      patterns: {
        success: this.currentContext!.orientation.historicalContext.successPatterns.length,
        failure: this.currentContext!.orientation.historicalContext.failurePatterns.length,
      },
    });

    return { state, orientMemory };
  }

  private updateEnvironmentalFactors(observations: Observation[]) {
    const factors = this.currentContext!.orientation.environmentalFactors;

    // Clear old factors
    factors.length = 0;

    // Analyze system state observations
    const systemObs = observations.find((o) => o.type === ObservationType.SYSTEM_STATE);
    if (systemObs) {
      const resources = systemObs.data as ResourceStatus;

      if (resources.cpu > 80) {
        factors.push({
          type: 'resource_constraint',
          description: 'High CPU usage limiting concurrent operations',
          impact: -0.5,
          timestamp: Date.now(),
        });
      }

      if (resources.taskSlots.used >= resources.taskSlots.total) {
        factors.push({
          type: 'capacity_limit',
          description: 'Maximum concurrent tasks reached',
          impact: -0.8,
          timestamp: Date.now(),
        });
      }
    }

    // Analyze error observations
    const errorObs = observations.filter((o) => o.type === ObservationType.ERROR_OCCURRED);
    if (errorObs.length > 2) {
      factors.push({
        type: 'error_surge',
        description: `${errorObs.length} errors detected in current cycle`,
        impact: -0.7,
        timestamp: Date.now(),
      });
    }
  }

  private identifyPatterns(observations: Observation[]) {
    // This is a simplified pattern identification
    // In a real implementation, this would use more sophisticated analysis

    const taskObs = observations.filter((o) => o.type === ObservationType.TASK_STATUS);
    const completedTasks = taskObs.filter((o) => {
      const taskData = o.data as Task;
      return taskData.tags?.includes('completed');
    });

    if (completedTasks.length > 0) {
      this.currentContext!.orientation.historicalContext.successPatterns.push(
        `Completed ${completedTasks.length} tasks in current cycle`
      );
    }

    const errorObs = observations.filter((o) => o.type === ObservationType.ERROR_OCCURRED);
    if (errorObs.length > 0) {
      const errorTypes = errorObs
        .map((o) => {
          const errorData = o.data as { type?: string };
          return errorData.type;
        })
        .filter(Boolean);
      this.currentContext!.orientation.historicalContext.failurePatterns.push(
        `Encountered errors: ${errorTypes.join(', ')}`
      );
    }
  }

  private updateGoalPriorities(observations: Observation[]) {
    // Dynamically adjust goal priorities based on observations
    const taskObs = observations.filter((o) => o.type === ObservationType.TASK_STATUS);
    const urgentTasks = taskObs.filter((o) => {
      const taskData = o.data as Task;
      return taskData.tags?.includes('urgent');
    });

    if (urgentTasks.length > 0) {
      // Temporarily boost task completion goal
      const taskGoal = this.goals.find((g) => g.description.includes('tasks'));
      if (taskGoal) {
        taskGoal.priority = 0.5; // Boost priority
      }
    }

    // Check system health
    const systemObs = observations.find((o) => o.type === ObservationType.SYSTEM_STATE);
    if (systemObs && systemObs.relevance > 0.7) {
      // Boost system health goal
      const healthGoal = this.goals.find((g) => g.description.includes('system health'));
      if (healthGoal) {
        healthGoal.priority = 0.8;
      }
    }
  }

  private async decide(
    state: State,
    orientMemory: Memory
  ): Promise<{
    responseContent: Content | null;
    responseMessages: Memory[];
  }> {
    this.currentContext!.phase = OODAPhase.DECIDING;
    this.logger.deciding('Starting decision phase - using messageHandlerTemplate');

    // Enhance the state with action suggestions
    if (state.values.suggestedActions && state.values.suggestedActions.length > 0) {
      state.text += `\n\nSuggested actions based on current context: ${state.values.suggestedActions.join(', ')}`;
      state.text += `\n\nAction opportunities identified: ${state.values.actionOpportunities?.join('; ') || 'none'}`;
    }

    // Add available specialty actions to state
    const specialtyActions = this.runtime.actions
      .filter((a) =>
        [
          'BROWSE_WEB',
          'FILE_OPERATION',
          'EXECUTE_COMMAND',
          'GIT_OPERATION',
          'PACKAGE_MANAGEMENT',
        ].includes(a.name)
      )
      .map((a) => `${a.name}: ${a.description}`)
      .join('\n');

    if (specialtyActions) {
      state.text += `\n\nAvailable specialty actions:\n${specialtyActions}`;
    }

    // Use messageHandlerTemplate to decide what actions and providers to use
    const prompt = composePromptFromState({
      state,
      template: messageHandlerTemplate,
    });

    let responseContent: Content | null = null;
    let retries = 0;
    const maxRetries = 3;

    // Retry if missing required fields
    while (retries < maxRetries && (!responseContent?.thought || !responseContent?.actions)) {
      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
      });

      this.logger.debug('Decision phase LLM response:', { response });

      // Parse XML response
      const parsedXml = parseKeyValueXml(response);

      if (parsedXml) {
        responseContent = {
          ...parsedXml,
          thought: parsedXml.thought || '',
          actions: parsedXml.actions || ['IGNORE'],
          providers: parsedXml.providers || [],
          text: parsedXml.text || '',
          simple: parsedXml.simple || false,
          source: 'autonomous',
          inReplyTo: orientMemory.id,
        };
      }

      retries++;
      if (!responseContent?.thought || !responseContent?.actions) {
        this.logger.warn('Missing required fields in decision response, retrying...', {
          response,
          parsedXml,
          responseContent,
        });
      }
    }

    // Create response messages
    const responseMessages: Memory[] = [];
    if (responseContent) {
      // Determine if response is simple
      const isSimple =
        responseContent.actions?.length === 1 &&
        responseContent.actions[0].toUpperCase() === 'REPLY' &&
        (!responseContent.providers || responseContent.providers.length === 0);

      responseContent.simple = isSimple;

      const responseMessage = {
        id: asUUID(generateId()),
        entityId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        content: responseContent,
        roomId: orientMemory.roomId,
        createdAt: Date.now(),
      };

      responseMessages.push(responseMessage);

      // Save decision to memory
      await this.runtime.createMemory(responseMessage, 'messages');

      // Log the decision with more detail
      this.logger.deciding('Decision made', {
        thought: responseContent.thought,
        actions: responseContent.actions,
        providers: responseContent.providers,
        suggestedActionsUsed: state.values.suggestedActions?.filter((a: string) =>
          responseContent.actions?.includes(a)
        ),
      });
    }

    // Update metrics
    this.currentContext!.metrics.decisionsPerCycle = responseContent?.actions?.length || 0;

    this.logger.deciding('Completed decision phase', {
      actions: responseContent?.actions,
      providers: responseContent?.providers,
      simple: responseContent?.simple,
    });

    return { responseContent, responseMessages };
  }

  private async act(message: Memory, responseMessages: Memory[], state: State): Promise<void> {
    this.currentContext!.phase = OODAPhase.ACTING;
    this.logger.acting('Starting action phase - using processActions');

    // Create a callback to handle action responses and track success/failure
    const callback: HandlerCallback = async (response: Content) => {
      this.logger.info('Action response received', {
        text: response.text?.substring(0, 100),
        actions: response.actions,
      });

      // Track action results for real metrics
      const actionNames = response.actions || [];
      const isSuccessful = this.isActionResponseSuccessful(response);

      // Record each action result
      for (const actionName of actionNames) {
        this.recordActionResult({
          success: isSuccessful,
          timestamp: Date.now(),
          actionName,
          error: isSuccessful ? undefined : this.extractErrorFromResponse(response),
        });
      }

      // Save action response to memory
      const actionResponseMemory = {
        id: asUUID(generateId()),
        entityId: this.runtime.agentId,
        agentId: this.runtime.agentId,
        content: response,
        roomId: message.roomId,
        createdAt: Date.now(),
      };

      await this.runtime.createMemory(actionResponseMemory, 'messages');
      return [actionResponseMemory];
    };

    // Use runtime.processActions to execute all actions
    try {
      await this.runtime.processActions(message, responseMessages, state, callback);

      this.logger.acting('Actions processed successfully');

      // Record successful completion if no actions were executed but processing succeeded
      if (
        responseMessages.length === 0 ||
        !responseMessages.some((m) => m.content.actions?.length)
      ) {
        this.recordActionResult({
          success: true,
          timestamp: Date.now(),
          actionName: 'process_complete',
        });
      }
    } catch (error) {
      this.logger.error('Error processing actions', error as Error);
      this.currentContext!.errors.push(error as Error);

      // Record failed action result
      this.recordActionResult({
        success: false,
        timestamp: Date.now(),
        actionName: 'process_actions',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async evaluate(message: Memory, state: State, responseMessages: Memory[]): Promise<void> {
    this.currentContext!.phase = OODAPhase.REFLECTING;
    this.logger.info('Running evaluators');

    // Create a callback for evaluators
    const callback: HandlerCallback = async (response: Content) => {
      this.logger.info('Evaluator response', {
        text: response.text?.substring(0, 100),
      });
      return [];
    };

    try {
      // Run evaluators
      await this.runtime.evaluate(
        message,
        state,
        true, // Always consider autonomous actions as "responding"
        callback,
        responseMessages
      );

      this.logger.info('Evaluators completed');
    } catch (error) {
      this.logger.error('Error running evaluators', error as Error);
    }
  }

  private async reflect(): Promise<void> {
    this.currentContext!.phase = OODAPhase.REFLECTING;
    this.logger.info('Starting reflection phase');

    // Calculate performance metrics
    const metrics = this.calculateMetrics();

    // Learn from this cycle
    await this.learnFromCycle(metrics);

    // Update strategies based on performance
    this.updateStrategies(metrics);

    // Update historical context
    this.updateHistoricalContext();

    this.logger.info('Completed reflection phase', {
      metrics,
      learnings: this.currentContext!.orientation.historicalContext.learnings.length,
    });
  }

  private async learnFromCycle(metrics: LoopMetrics): Promise<void> {
    const learnings: Learning[] = [];

    // Learn from successful actions
    const successes = this.currentContext!.actions.filter(
      (a) => a.status === ActionStatus.SUCCEEDED
    );

    for (const success of successes) {
      if (success.result) {
        const learning: Learning = {
          id: asUUID(generateId()),
          timestamp: Date.now(),
          context: {
            goals: this.goals.map((g) => g.description),
            environment: this.currentContext!.orientation.environmentalFactors.map(
              (f) => f.description
            ),
            observations: this.currentContext!.observations.map((o) => `${o.type}: ${o.source}`),
          },
          outcome: 'success',
          pattern: `${success.actionName} succeeded with expected results`,
          confidence: 0.8,
          applicableConditions: [
            `Action type: ${success.actionName}`,
            `Resource usage: CPU ${success.resourcesUsed.cpuTime}ms`,
          ],
        };
        learnings.push(learning);
      }
    }

    // Learn from failures
    const failures = this.currentContext!.actions.filter((a) => a.status === ActionStatus.FAILED);

    for (const failure of failures) {
      const learning: Learning = {
        id: asUUID(generateId()),
        timestamp: Date.now(),
        context: {
          goals: this.goals.map((g) => g.description),
          environment: this.currentContext!.orientation.environmentalFactors.map(
            (f) => f.description
          ),
          observations: this.currentContext!.observations.map((o) => `${o.type}: ${o.source}`),
        },
        outcome: 'failure',
        pattern: `${failure.actionName} failed: ${failure.error?.message || 'Unknown error'}`,
        confidence: 0.9,
        applicableConditions: [
          `Action type: ${failure.actionName}`,
          `Error type: ${failure.error?.name || 'Unknown'}`,
        ],
      };
      learnings.push(learning);
    }

    // Add learnings to historical context
    this.currentContext!.orientation.historicalContext.learnings.push(...learnings);
  }

  private updateStrategies(metrics: LoopMetrics): void {
    // Adjust loop timing based on activity level
    if (metrics.decisionsPerCycle === 0) {
      // No decisions made - slow down
      this.baseLoopDelay = Math.min(30000, this.baseLoopDelay * 1.5);
      this.logger.info(`Slowing down loop to ${this.baseLoopDelay}ms due to low activity`);
    } else if (metrics.decisionsPerCycle > 3) {
      // Many decisions - speed up to handle them
      this.baseLoopDelay = Math.max(this.minLoopDelay * 2, this.baseLoopDelay * 0.8);
      this.logger.info(`Speeding up loop to ${this.baseLoopDelay}ms due to high activity`);
    }

    // Adjust max concurrent actions based on success rate
    if (metrics.actionSuccessRate < 0.5 && this.maxConcurrentActions > 1) {
      this.maxConcurrentActions = Math.max(1, this.maxConcurrentActions - 1);
      this.logger.info(
        `Reducing concurrent actions to ${this.maxConcurrentActions} due to low success rate`
      );
    } else if (metrics.actionSuccessRate > 0.9 && metrics.resourceEfficiency > 0.7) {
      this.maxConcurrentActions = Math.min(5, this.maxConcurrentActions + 1);
      this.logger.info(
        `Increasing concurrent actions to ${this.maxConcurrentActions} due to high success rate`
      );
    }
  }

  private updateHistoricalContext(): void {
    const context = this.currentContext!.orientation.historicalContext;

    // For now, we'll track actions from processActions results
    // In a full implementation, we'd extract this from the runtime

    // Update patterns
    this.updatePatterns();
  }

  private updatePatterns(): void {
    const context = this.currentContext!.orientation.historicalContext;

    // Keep only recent patterns
    if (context.successPatterns.length > 10) {
      context.successPatterns = context.successPatterns.slice(-10);
    }
    if (context.failurePatterns.length > 10) {
      context.failurePatterns = context.failurePatterns.slice(-10);
    }
  }

  // Helper methods for real action tracking
  private recordActionResult(result: {
    success: boolean;
    timestamp: number;
    actionName?: string;
    error?: string;
  }): void {
    this.actionResults.push(result);

    // Keep only recent results to prevent memory bloat
    if (this.actionResults.length > this.maxActionHistorySize) {
      this.actionResults = this.actionResults.slice(-this.maxActionHistorySize);
    }

    this.logger.debug('Action result recorded', {
      success: result.success,
      actionName: result.actionName,
      error: result.error,
      totalResults: this.actionResults.length,
    });
  }

  private isActionResponseSuccessful(response: Content): boolean {
    // Determine if an action response indicates success or failure

    // Check for explicit error indicators
    if (response.actions?.some((action) => action.includes('ERROR') || action.includes('FAILED'))) {
      return false;
    }

    // Check response text for error indicators
    const responseText = response.text?.toLowerCase() || '';
    const errorPatterns = [
      'error',
      'failed',
      "couldn't",
      'unable',
      'impossible',
      'not found',
      'access denied',
      'permission denied',
      'timeout',
      'exception',
      'crash',
      'broken',
      'invalid',
    ];

    if (errorPatterns.some((pattern) => responseText.includes(pattern))) {
      return false;
    }

    // Check for success indicators
    const successPatterns = [
      'success',
      'completed',
      'done',
      'finished',
      'created',
      'saved',
      'updated',
      'processed',
      'executed',
      'found',
    ];

    if (successPatterns.some((pattern) => responseText.includes(pattern))) {
      return true;
    }

    // Default to success if no clear indicators (neutral response)
    return true;
  }

  private extractErrorFromResponse(response: Content): string | undefined {
    const responseText = response.text || '';

    // Try to extract specific error message
    const errorMatch = responseText.match(/error[:\s]+([^.]+)/i);
    if (errorMatch) {
      return errorMatch[1].trim();
    }

    // Look for failure descriptions
    const failureMatch = responseText.match(/failed[:\s]+([^.]+)/i);
    if (failureMatch) {
      return failureMatch[1].trim();
    }

    // Return general error indicator
    if (
      responseText.toLowerCase().includes('error') ||
      responseText.toLowerCase().includes('failed')
    ) {
      return responseText.substring(0, 100); // First 100 chars as error description
    }

    return undefined;
  }

  private calculateRealActionSuccessRate(): number {
    if (this.actionResults.length === 0) {
      return 1.0; // Default to 100% if no data
    }

    // Use recent results (last hour) for more relevant metrics
    const oneHourAgo = Date.now() - 3600000;
    const recentResults = this.actionResults.filter((result) => result.timestamp > oneHourAgo);

    if (recentResults.length === 0) {
      // Fall back to all results if no recent ones
      const successCount = this.actionResults.filter((result) => result.success).length;
      return successCount / this.actionResults.length;
    }

    const recentSuccessCount = recentResults.filter((result) => result.success).length;
    return recentSuccessCount / recentResults.length;
  }

  private calculateMetrics(): LoopMetrics {
    const cycleTime = Date.now() - this.currentContext!.startTime;
    const decisionsPerCycle = this.currentContext!.metrics.decisionsPerCycle;

    // Use real action tracking instead of placeholder
    const actionSuccessRate = this.calculateRealActionSuccessRate();
    const errorRate = this.currentContext!.errors.length / Math.max(1, decisionsPerCycle);

    const metrics: LoopMetrics = {
      cycleTime,
      decisionsPerCycle,
      actionSuccessRate,
      errorRate,
      resourceEfficiency: this.calculateResourceEfficiency(),
      goalProgress: this.calculateAverageGoalProgress(),
    };

    // Log metrics for debugging
    this.logger.debug('OODA metrics calculated', {
      actionSuccessRate,
      totalActionResults: this.actionResults.length,
      recentSuccesses: this.actionResults.filter(
        (r) => r.success && r.timestamp > Date.now() - 3600000
      ).length,
      recentFailures: this.actionResults.filter(
        (r) => !r.success && r.timestamp > Date.now() - 3600000
      ).length,
    });

    return metrics;
  }

  private calculateResourceEfficiency(): number {
    // Simplified calculation based on cycle time
    const targetCycleTime = 10000; // 10 seconds target
    const actualCycleTime = Date.now() - this.currentContext!.startTime;
    const efficiency = Math.max(0, 1 - actualCycleTime / targetCycleTime);
    return Math.min(efficiency, 1);
  }

  private calculateAverageGoalProgress(): number {
    if (this.goals.length === 0) {
      return 0;
    }

    const totalProgress = this.goals.reduce((sum, goal) => sum + goal.progress, 0);
    return totalProgress / this.goals.length;
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping OODA loop service');
    this.isRunning = false;

    // Wait for current loop to complete
    let waitTime = 0;
    while (this.isLoopActive && waitTime < 30000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitTime += 100;
    }

    if (this.isLoopActive) {
      this.logger.warn('Force stopping OODA loop after timeout');
    }

    // Complete current run if in progress
    if (this.currentContext) {
      await this.logger.endRun();
    }
  }

  static async start(runtime: IAgentRuntime): Promise<Service> {
    const service = new OODALoopService(runtime);
    // Wait a bit for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    return service;
  }

  // NEW: Observe available actions and their recent usage
  private async observeActionCapabilities(): Promise<Observation[]> {
    const observations: Observation[] = [];

    try {
      // Get action usage from memory
      let recentActions: Memory[] = [];
      if (typeof this.runtime.getMemories === 'function') {
        recentActions = await this.runtime.getMemories({
          roomId: this.autonomousRoomId!,
          agentId: this.runtime.agentId,
          count: 20,
          tableName: 'messages',
        });
      }

      // Analyze action usage patterns
      const actionUsage: Record<string, number> = {};
      for (const memory of recentActions) {
        if (memory.content.actions) {
          for (const action of memory.content.actions) {
            actionUsage[action] = (actionUsage[action] || 0) + 1;
          }
        }
      }

      // Check for available specialty actions
      const specialtyActions = [
        'BROWSE_WEB',
        'FILE_OPERATION',
        'EXECUTE_COMMAND',
        'GIT_OPERATION',
        'PACKAGE_MANAGEMENT',
      ];

      const availableActions = this.runtime.actions
        .filter((a) => specialtyActions.includes(a.name))
        .map((a) => ({
          name: a.name,
          description: a.description,
          recentUsage: actionUsage[a.name] || 0,
        }));

      if (availableActions.length > 0) {
        observations.push({
          timestamp: Date.now(),
          type: ObservationType.SYSTEM_STATE,
          source: 'action_analyzer',
          data: {
            availableActions,
            actionUsage,
          },
          relevance: 0.7,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to observe action capabilities', { error });
    }

    return observations;
  }

  // NEW: Check if there are file-related tasks or needs
  private async observeFileSystemState(): Promise<Observation | null> {
    try {
      // Check recent memories for file-related activities
      let recentMemories: Memory[] = [];
      if (typeof this.runtime.getMemories === 'function') {
        recentMemories = await this.runtime.getMemories({
          roomId: this.autonomousRoomId!,
          agentId: this.runtime.agentId,
          count: 10,
          tableName: 'messages',
        });
      }

      const fileRelatedActivities = recentMemories.filter(
        (m) =>
          m.content.text?.toLowerCase().includes('file') ||
          m.content.text?.toLowerCase().includes('report') ||
          (m.content.data as { filePath?: string })?.filePath
      );

      if (fileRelatedActivities.length > 0) {
        return {
          timestamp: Date.now(),
          type: ObservationType.EXTERNAL_EVENT,
          source: 'file_system_observer',
          data: {
            recentFileOperations: fileRelatedActivities.length,
            lastFileOperation: fileRelatedActivities[0]?.content.data,
          },
          relevance: 0.6,
        };
      }
    } catch (error) {
      this.logger.warn('Failed to observe file system state', { error });
    }

    return null;
  }

  // NEW: Check recent command executions
  private async observeRecentCommands(): Promise<Observation[]> {
    const observations: Observation[] = [];

    try {
      let recentMemories: Memory[] = [];
      if (typeof this.runtime.getMemories === 'function') {
        recentMemories = await this.runtime.getMemories({
          roomId: this.autonomousRoomId!,
          agentId: this.runtime.agentId,
          count: 10,
          tableName: 'messages',
        });
      }

      const commandExecutions = recentMemories.filter(
        (m) =>
          (m.content.data as { command?: string })?.command ||
          m.content.actions?.includes('EXECUTE_COMMAND')
      );

      if (commandExecutions.length > 0) {
        observations.push({
          timestamp: Date.now(),
          type: ObservationType.EXTERNAL_EVENT,
          source: 'command_history',
          data: {
            recentCommands: commandExecutions.map((m) => ({
              command: (m.content.data as { command?: string; output?: string })?.command,
              output: (m.content.data as { command?: string; output?: string })?.output?.substring(
                0,
                200
              ),
              timestamp: m.createdAt,
            })),
          },
          relevance: 0.5,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to observe recent commands', { error });
    }

    return observations;
  }

  // NEW: Identify opportunities for specific action types
  private identifyActionOpportunities(observations: Observation[], state: State) {
    const opportunities: string[] = [];

    // Check for web research opportunities
    const hasQuestions = observations.some((o) => {
      const dataWithText = o.data as { text?: string };
      return (
        dataWithText.text?.includes('?') ||
        dataWithText.text?.toLowerCase().includes('research') ||
        dataWithText.text?.toLowerCase().includes('find out')
      );
    });

    if (hasQuestions) {
      opportunities.push('BROWSE_WEB: Research questions or gather information');
      state.values.suggestedActions = state.values.suggestedActions || [];
      state.values.suggestedActions.push('BROWSE_WEB');
    }

    // Check for file creation opportunities
    const needsDocumentation = observations.some((o) => {
      const dataWithText = o.data as { text?: string };
      return (
        dataWithText.text?.toLowerCase().includes('document') ||
        dataWithText.text?.toLowerCase().includes('report') ||
        dataWithText.text?.toLowerCase().includes('save')
      );
    });

    if (needsDocumentation) {
      opportunities.push('FILE_OPERATION: Create documentation or reports');
      state.values.suggestedActions = state.values.suggestedActions || [];
      state.values.suggestedActions.push('FILE_OPERATION');
    }

    // Check for system monitoring opportunities
    const systemCheck = observations.find((o) => o.type === ObservationType.SYSTEM_STATE);
    if (systemCheck) {
      const systemData = systemCheck.data as { cpu?: number };
      if (systemData.cpu && systemData.cpu > 70) {
        opportunities.push('EXECUTE_COMMAND: Monitor system resources');
        state.values.suggestedActions = state.values.suggestedActions || [];
        state.values.suggestedActions.push('EXECUTE_COMMAND');
      }
    }

    // Check for git opportunities
    const hasCodeChanges = observations.some((o) => {
      const dataWithText = o.data as { text?: string };
      return (
        dataWithText.text?.toLowerCase().includes('code') ||
        dataWithText.text?.toLowerCase().includes('repository') ||
        dataWithText.text?.toLowerCase().includes('commit')
      );
    });

    if (hasCodeChanges) {
      opportunities.push('GIT_OPERATION: Manage code repository');
      state.values.suggestedActions = state.values.suggestedActions || [];
      state.values.suggestedActions.push('GIT_OPERATION');
    }

    // Check for package management opportunities
    const hasPackageNeeds = observations.some((o) => {
      const dataWithText = o.data as { text?: string };
      return (
        dataWithText.text?.toLowerCase().includes('install') ||
        dataWithText.text?.toLowerCase().includes('package') ||
        dataWithText.text?.toLowerCase().includes('dependency')
      );
    });

    if (hasPackageNeeds) {
      opportunities.push('PACKAGE_MANAGEMENT: Manage dependencies');
      state.values.suggestedActions = state.values.suggestedActions || [];
      state.values.suggestedActions.push('PACKAGE_MANAGEMENT');
    }

    // Store opportunities in context
    if (opportunities.length > 0) {
      this.logger.info('Identified action opportunities', { opportunities });
      state.values.actionOpportunities = opportunities;
    }
  }
}
