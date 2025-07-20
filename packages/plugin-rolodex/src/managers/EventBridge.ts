import {
  logger,
  stringToUuid,
  type IAgentRuntime,
  type UUID,
  type Entity,
  type Relationship,
  type Memory as _Memory,
} from '@elizaos/core';
// Define ContactInfo locally since it's not exported from RolodexService
interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: any;
}
import type {
  EntityProfile as _EntityProfile,
  EntityRelationship as _EntityRelationship,
} from '../types';
import { EventEmitter } from 'events';

// Event Types
export enum RolodexEventType {
  // Entity Events
  ENTITY_CREATED = 'rolodex:entity:created',
  ENTITY_UPDATED = 'rolodex:entity:updated',
  ENTITY_MERGED = 'rolodex:entity:merged',
  ENTITY_RESOLVED = 'rolodex:entity:resolved',
  ENTITY_REMOVED = 'rolodex:entity:removed',

  // Relationship Events
  RELATIONSHIP_CREATED = 'rolodex:relationship:created',
  RELATIONSHIP_UPDATED = 'rolodex:relationship:updated',
  RELATIONSHIP_STRENGTHENED = 'rolodex:relationship:strengthened',
  RELATIONSHIP_WEAKENED = 'rolodex:relationship:weakened',
  RELATIONSHIP_REMOVED = 'rolodex:relationship:removed',

  // Trust Events
  TRUST_INCREASED = 'rolodex:trust:increased',
  TRUST_DECREASED = 'rolodex:trust:decreased',
  TRUST_THRESHOLD_CROSSED = 'rolodex:trust:threshold_crossed',
  SECURITY_THREAT_DETECTED = 'rolodex:security:threat_detected',
  TRUST_VERIFICATION_REQUIRED = 'rolodex:trust:verification_required',

  // Bidirectional Verification Events
  MERGE_PROPOSAL_CREATED = 'rolodex:merge:proposal_created',
  MERGE_READY_FOR_REVIEW = 'rolodex:merge:ready_for_review',
  PLATFORM_CLAIM_RECORDED = 'rolodex:platform:claim_recorded',
  PLATFORM_CONFIRMATION_RECEIVED = 'rolodex:platform:confirmation_received',
  BIDIRECTIONAL_VERIFICATION_COMPLETED = 'rolodex:verification:bidirectional_completed',

  // Contact Events
  CONTACT_ADDED = 'rolodex:contact:added',
  CONTACT_UPDATED = 'rolodex:contact:updated',
  CONTACT_CATEGORIZED = 'rolodex:contact:categorized',
  CONTACT_PRIVACY_CHANGED = 'rolodex:contact:privacy_changed',
  CONTACT_REMOVED = 'rolodex:contact:removed',

  // Interaction Events
  INTERACTION_RECORDED = 'rolodex:interaction:recorded',
  FOLLOWUP_SCHEDULED = 'rolodex:followup:scheduled',
  FOLLOWUP_COMPLETED = 'rolodex:followup:completed',
  PATTERN_DETECTED = 'rolodex:pattern:detected',
  ANOMALY_DETECTED = 'rolodex:anomaly:detected',

  // Health Events
  RELATIONSHIP_HEALTH_CHANGED = 'rolodex:health:changed',
  RELATIONSHIP_AT_RISK = 'rolodex:health:at_risk',
  RELATIONSHIP_DORMANT = 'rolodex:health:dormant',
  RELATIONSHIP_RECOVERED = 'rolodex:health:recovered',
}

// Event Payloads
export interface EntityEvent {
  type: RolodexEventType;
  timestamp: number;
  entityId: UUID;
  entity?: Entity;
  previousEntity?: Entity;
  mergedEntities?: Entity[];
  source: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface RelationshipEvent {
  type: RolodexEventType;
  timestamp: number;
  relationshipId: UUID;
  sourceEntityId: UUID;
  targetEntityId: UUID;
  relationship?: Relationship;
  previousStrength?: number;
  currentStrength?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface TrustEvent {
  type: RolodexEventType;
  timestamp: number;
  entityId: UUID;
  previousScore: number;
  currentScore: number;
  change: number;
  threshold?: number;
  action?: string;
  evidence?: string;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface ContactEvent {
  type: RolodexEventType;
  timestamp: number;
  entityId: UUID;
  contactInfo: ContactInfo;
  previousContactInfo?: ContactInfo;
  changes?: string[];
  metadata?: Record<string, any>;
}

export interface InteractionEvent {
  type: RolodexEventType;
  timestamp: number;
  entityId: UUID;
  interactionType: string;
  content?: string;
  pattern?: {
    type: string;
    confidence: number;
    evidence: string[];
  };
  anomaly?: {
    type: string;
    severity: string;
    description: string;
  };
  metadata?: Record<string, any>;
}

export interface HealthEvent {
  type: RolodexEventType;
  timestamp: number;
  entityId: UUID;
  relationshipId: UUID;
  previousStatus?: string;
  currentStatus: string;
  healthScore: number;
  recommendations?: string[];
  metadata?: Record<string, any>;
}

// Event Handler Type
export type EventHandler<T = any> = (event: T) => void | Promise<void>;

// Event Bridge Manager
export class EventBridge {
  private runtime: IAgentRuntime;
  private eventEmitter: EventEmitter;
  private eventHistory: Map<string, any[]> = new Map();
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private crossPluginListeners: Map<string, EventHandler[]> = new Map();
  private pluginEventSubscriptions: Map<string, Set<string>> = new Map(); // plugin -> event types
  private eventTypeSubscriptions: Map<string, Set<string>> = new Map(); // event type -> plugins
  private eventFilters: Map<string, (event: any) => boolean> = new Map();

  // Event statistics
  private eventStats = {
    emitted: new Map<string, number>(),
    handled: new Map<string, number>(),
    failed: new Map<string, number>(),
    crossPluginDelivered: new Map<string, number>(),
    crossPluginFailed: new Map<string, number>(),
  };

  // Configuration
  public config = {
    maxHistorySize: 1000,
    enableCrossPluginEvents: true,
    enableEventLogging: true,
    eventBatchingEnabled: true,
    batchingIntervalMs: 100,
    enableEventDeduplication: true,
    maxRetries: 3,
    retryDelayMs: 1000,
  };

  private eventQueue: any[] = [];
  private batchTimer?: NodeJS.Timeout;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.eventEmitter = new EventEmitter();
  }

  async initialize(): Promise<void> {
    logger.info('[EventBridge] Initializing event bridge');

    // Subscribe to runtime events
    this.subscribeToRuntimeEvents();

    // Initialize cross-plugin event listeners
    this.initializeCrossPluginListeners();

    logger.info('[EventBridge] Event bridge initialized successfully');
  }

  // Emit Events
  async emit<
    T extends
      | EntityEvent
      | RelationshipEvent
      | TrustEvent
      | ContactEvent
      | InteractionEvent
      | HealthEvent,
  >(event: T): Promise<void> {
    try {
      // Add to statistics
      const count = this.eventStats.emitted.get(event.type) || 0;
      this.eventStats.emitted.set(event.type, count + 1);

      // Log event if enabled
      if (this.config.enableEventLogging) {
        logger.debug(`[EventBridge] Emitting event: ${event.type}`, event);
      }

      // Add to history
      this.addToHistory(event.type, event);

      // Emit to local handlers
      await this.emitLocal(event);

      // Emit to cross-plugin listeners if enabled
      if (this.config.enableCrossPluginEvents) {
        await this.emitCrossPlugin(event);
        await this.emitToPlugins(event);
      }

      // Emit to runtime for other plugins
      this.emitToRuntime(event);
    } catch (error) {
      logger.error(`[EventBridge] Error emitting event ${event.type}:`, error);
      const failCount = this.eventStats.failed.get(event.type) || 0;
      this.eventStats.failed.set(event.type, failCount + 1);
    }
  }

  // Subscribe to Events
  on<T = any>(eventType: RolodexEventType | string, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    logger.debug(`[EventBridge] Registered handler for event: ${eventType}`);
  }

  // Unsubscribe from Events
  off<T = any>(eventType: RolodexEventType | string, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  // Cross-Plugin Event Management
  subscribePlugin(
    pluginName: string,
    eventTypes: string[],
    filter?: (event: any) => boolean
  ): void {
    logger.info(
      `[EventBridge] Plugin ${pluginName} subscribing to events: ${eventTypes.join(', ')}`
    );

    // Track plugin subscriptions
    if (!this.pluginEventSubscriptions.has(pluginName)) {
      this.pluginEventSubscriptions.set(pluginName, new Set());
    }

    const pluginSubscriptions = this.pluginEventSubscriptions.get(pluginName)!;

    for (const eventType of eventTypes) {
      pluginSubscriptions.add(eventType);

      // Track event type subscriptions
      if (!this.eventTypeSubscriptions.has(eventType)) {
        this.eventTypeSubscriptions.set(eventType, new Set());
      }
      this.eventTypeSubscriptions.get(eventType)!.add(pluginName);

      // Store filter if provided
      if (filter) {
        this.eventFilters.set(`${pluginName}:${eventType}`, filter);
      }
    }
  }

  unsubscribePlugin(pluginName: string, eventTypes?: string[]): void {
    const pluginSubscriptions = this.pluginEventSubscriptions.get(pluginName);
    if (!pluginSubscriptions) {
      return;
    }

    const typesToRemove = eventTypes || Array.from(pluginSubscriptions);

    for (const eventType of typesToRemove) {
      pluginSubscriptions.delete(eventType);

      // Remove from event type subscriptions
      const eventSubscriptions = this.eventTypeSubscriptions.get(eventType);
      if (eventSubscriptions) {
        eventSubscriptions.delete(pluginName);
        if (eventSubscriptions.size === 0) {
          this.eventTypeSubscriptions.delete(eventType);
        }
      }

      // Remove filter
      this.eventFilters.delete(`${pluginName}:${eventType}`);
    }

    if (pluginSubscriptions.size === 0) {
      this.pluginEventSubscriptions.delete(pluginName);
    }

    logger.info(
      `[EventBridge] Plugin ${pluginName} unsubscribed from events: ${typesToRemove.join(', ')}`
    );
  }

  // Enhanced cross-plugin event emission
  async emitToPlugins<
    T extends
      | EntityEvent
      | RelationshipEvent
      | TrustEvent
      | ContactEvent
      | InteractionEvent
      | HealthEvent,
  >(event: T, targetPlugins?: string[]): Promise<{ delivered: number; failed: number }> {
    if (!this.config.enableCrossPluginEvents) {
      return { delivered: 0, failed: 0 };
    }

    let delivered = 0;
    let failed = 0;

    // Determine target plugins
    const subscribedPlugins = this.eventTypeSubscriptions.get(event.type) || new Set();
    const plugins = targetPlugins
      ? targetPlugins.filter((p) => subscribedPlugins.has(p))
      : Array.from(subscribedPlugins);

    if (plugins.length === 0) {
      return { delivered: 0, failed: 0 };
    }

    logger.debug(`[EventBridge] Emitting ${event.type} to plugins: ${plugins.join(', ')}`);

    // Emit to each plugin with retry logic
    const promises = plugins.map(async (pluginName) => {
      try {
        await this.emitToPluginWithRetry(pluginName, event);
        delivered++;

        const count = this.eventStats.crossPluginDelivered.get(event.type) || 0;
        this.eventStats.crossPluginDelivered.set(event.type, count + 1);
      } catch (error) {
        failed++;
        logger.error(
          `[EventBridge] Failed to deliver ${event.type} to plugin ${pluginName}:`,
          error
        );

        const count = this.eventStats.crossPluginFailed.get(event.type) || 0;
        this.eventStats.crossPluginFailed.set(event.type, count + 1);
      }
    });

    await Promise.allSettled(promises);

    return { delivered, failed };
  }

  private async emitToPluginWithRetry(pluginName: string, event: any, attempt = 1): Promise<void> {
    try {
      // Apply filter if configured
      const filterKey = `${pluginName}:${event.type}`;
      const filter = this.eventFilters.get(filterKey);
      if (filter && !filter(event)) {
        // Event filtered out
      }

      // Emit via runtime's plugin system
      // await this.runtime.emit(`plugin:${pluginName}:${event.type}`, event);
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelayMs * attempt));
        return this.emitToPluginWithRetry(pluginName, event, attempt + 1);
      }
      throw error;
    }
  }

  // Batch Events
  async emitBatch(events: any[]): Promise<void> {
    if (!this.config.eventBatchingEnabled) {
      // Emit events individually
      for (const event of events) {
        await this.emit(event);
      }
      return;
    }

    // Add to queue
    this.eventQueue.push(...events);

    // Reset batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Set new batch timer
    this.batchTimer = setTimeout(() => {
      this.processBatchedEvents();
    }, this.config.batchingIntervalMs);
  }

  private async processBatchedEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    logger.debug(`[EventBridge] Processing batch of ${events.length} events`);

    // Group events by type for efficient processing
    const eventsByType = new Map<string, any[]>();
    for (const event of events) {
      if (!eventsByType.has(event.type)) {
        eventsByType.set(event.type, []);
      }
      eventsByType.get(event.type)!.push(event);
    }

    // Process each type
    for (const [_type, typeEvents] of eventsByType) {
      for (const event of typeEvents) {
        await this.emit(event);
      }
    }
  }

  // Event Helpers
  emitEntityCreated(entity: Entity, source: string): Promise<void> {
    return this.emit<EntityEvent>({
      type: RolodexEventType.ENTITY_CREATED,
      timestamp: Date.now(),
      entityId: entity.id as UUID,
      entity,
      source,
    });
  }

  emitEntityUpdated(entity: Entity, previousEntity: Entity, source: string): Promise<void> {
    return this.emit<EntityEvent>({
      type: RolodexEventType.ENTITY_UPDATED,
      timestamp: Date.now(),
      entityId: entity.id as UUID,
      entity,
      previousEntity,
      source,
    });
  }

  emitRelationshipStrengthChanged(
    relationship: Relationship,
    previousStrength: number,
    currentStrength: number,
    reason: string
  ): Promise<void> {
    const eventType =
      currentStrength > previousStrength
        ? RolodexEventType.RELATIONSHIP_STRENGTHENED
        : RolodexEventType.RELATIONSHIP_WEAKENED;

    return this.emit<RelationshipEvent>({
      type: eventType,
      timestamp: Date.now(),
      relationshipId: relationship.id,
      sourceEntityId: relationship.sourceEntityId,
      targetEntityId: relationship.targetEntityId,
      relationship,
      previousStrength,
      currentStrength,
      reason,
    });
  }

  emitTrustChanged(
    entityId: UUID,
    previousScore: number,
    currentScore: number,
    evidence: string
  ): Promise<void> {
    const change = currentScore - previousScore;
    const eventType =
      change > 0 ? RolodexEventType.TRUST_INCREASED : RolodexEventType.TRUST_DECREASED;

    return this.emit<TrustEvent>({
      type: eventType,
      timestamp: Date.now(),
      entityId,
      previousScore,
      currentScore,
      change,
      evidence,
    });
  }

  emitSecurityThreat(
    entityId: UUID,
    threatLevel: 'low' | 'medium' | 'high' | 'critical',
    action: string,
    evidence: string
  ): Promise<void> {
    return this.emit<TrustEvent>({
      type: RolodexEventType.SECURITY_THREAT_DETECTED,
      timestamp: Date.now(),
      entityId,
      previousScore: 0,
      currentScore: 0,
      change: 0,
      threatLevel,
      action,
      evidence,
    });
  }

  emitPatternDetected(
    entityId: UUID,
    pattern: { type: string; confidence: number; evidence: string[] }
  ): Promise<void> {
    return this.emit<InteractionEvent>({
      type: RolodexEventType.PATTERN_DETECTED,
      timestamp: Date.now(),
      entityId,
      interactionType: 'pattern_analysis',
      pattern,
    });
  }

  emitHealthChanged(
    entityId: UUID,
    relationshipId: UUID,
    previousStatus: string,
    currentStatus: string,
    healthScore: number,
    recommendations: string[]
  ): Promise<void> {
    return this.emit<HealthEvent>({
      type: RolodexEventType.RELATIONSHIP_HEALTH_CHANGED,
      timestamp: Date.now(),
      entityId,
      relationshipId,
      previousStatus,
      currentStatus,
      healthScore,
      recommendations,
    });
  }

  // Private Methods
  private async emitLocal(event: any): Promise<void> {
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(event);
        const count = this.eventStats.handled.get(event.type) || 0;
        this.eventStats.handled.set(event.type, count + 1);
      } catch (error) {
        logger.error(`[EventBridge] Error in local handler for ${event.type}:`, error);
        const failCount = this.eventStats.failed.get(event.type) || 0;
        this.eventStats.failed.set(event.type, failCount + 1);
      }
    }
  }

  private async emitCrossPlugin(event: any): Promise<void> {
    const listeners = this.crossPluginListeners.get(event.type);
    if (!listeners || listeners.length === 0) {
      return;
    }

    for (const listener of listeners) {
      try {
        await listener(event);
      } catch (error) {
        logger.error(`[EventBridge] Error in cross-plugin listener for ${event.type}:`, error);
      }
    }
  }

  private emitToRuntime(event: any): void {
    // Emit to runtime for other plugins to listen
    try {
      // Runtime doesn't have a direct emit method
      // Could be implemented with a different approach if needed
      logger.debug(`[EventBridge] Runtime event emission not available for ${event.type}`);
    } catch (error) {
      logger.error('[EventBridge] Error emitting to runtime:', error);
    }
  }

  private addToHistory(eventType: string, event: any): void {
    if (!this.eventHistory.has(eventType)) {
      this.eventHistory.set(eventType, []);
    }

    const history = this.eventHistory.get(eventType)!;
    history.push({
      ...event,
      historicalTimestamp: Date.now(),
    });

    // Limit history size
    if (history.length > this.config.maxHistorySize) {
      history.shift();
    }
  }

  private subscribeToRuntimeEvents(): void {
    // Runtime event subscriptions would go here
    // Currently commented out as runtime doesn't expose these events directly
  }

  private initializeCrossPluginListeners(): void {
    // Cross-plugin listener initialization would go here
  }

  // Statistics Methods
  getEventStatistics(): {
    emitted: Record<string, number>;
    handled: Record<string, number>;
    failed: Record<string, number>;
    crossPluginDelivered: Record<string, number>;
    crossPluginFailed: Record<string, number>;
    queueSize: number;
    subscribedPlugins: Record<string, string[]>;
    eventSubscriptions: Record<string, string[]>;
  } {
    return {
      emitted: Object.fromEntries(this.eventStats.emitted),
      handled: Object.fromEntries(this.eventStats.handled),
      failed: Object.fromEntries(this.eventStats.failed),
      crossPluginDelivered: Object.fromEntries(this.eventStats.crossPluginDelivered),
      crossPluginFailed: Object.fromEntries(this.eventStats.crossPluginFailed),
      queueSize: this.eventQueue.length,
      subscribedPlugins: Object.fromEntries(
        Array.from(this.pluginEventSubscriptions.entries()).map(([plugin, events]) => [
          plugin,
          Array.from(events),
        ])
      ),
      eventSubscriptions: Object.fromEntries(
        Array.from(this.eventTypeSubscriptions.entries()).map(([event, plugins]) => [
          event,
          Array.from(plugins),
        ])
      ),
    };
  }

  // Plugin Management Methods
  getSubscribedPlugins(): string[] {
    return Array.from(this.pluginEventSubscriptions.keys());
  }

  getPluginSubscriptions(pluginName: string): string[] {
    const subscriptions = this.pluginEventSubscriptions.get(pluginName);
    return subscriptions ? Array.from(subscriptions) : [];
  }

  getEventSubscribers(eventType: string): string[] {
    const subscribers = this.eventTypeSubscriptions.get(eventType);
    return subscribers ? Array.from(subscribers) : [];
  }

  // Health check for cross-plugin connectivity
  async testCrossPluginConnectivity(): Promise<
    {
      pluginName: string;
      connected: boolean;
      lastResponse?: number;
      error?: string;
    }[]
  > {
    const results: Array<{
      pluginName: string;
      connected: boolean;
      lastResponse?: number;
      error?: string;
    }> = [];

    const testEvent = {
      type: 'rolodex:test:connectivity',
      timestamp: Date.now(),
      entityId: stringToUuid(`test-connectivity-${Date.now()}`),
      test: true,
    };

    for (const pluginName of this.getSubscribedPlugins()) {
      try {
        const startTime = Date.now();
        await this.emitToPluginWithRetry(pluginName, testEvent);
        const responseTime = Date.now() - startTime;

        results.push({
          pluginName,
          connected: true,
          lastResponse: responseTime,
        });
      } catch (error) {
        results.push({
          pluginName,
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  getEventHistory(eventType?: string, limit: number = 100): any[] {
    if (eventType) {
      const history = this.eventHistory.get(eventType) || [];
      return history.slice(-limit);
    }

    // Return all events sorted by timestamp
    const allEvents: any[] = [];
    for (const history of this.eventHistory.values()) {
      allEvents.push(...history);
    }

    return allEvents.sort((a, b) => b.historicalTimestamp - a.historicalTimestamp).slice(0, limit);
  }

  // Cleanup
  async stop(): Promise<void> {
    logger.info('[EventBridge] Stopping event bridge');

    // Process remaining batched events
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      await this.processBatchedEvents();
    }

    // Clear all handlers
    this.eventHandlers.clear();
    this.crossPluginListeners.clear();

    // Clear plugin subscriptions
    this.pluginEventSubscriptions.clear();
    this.eventTypeSubscriptions.clear();
    this.eventFilters.clear();

    // Clear history
    this.eventHistory.clear();

    // Remove all listeners
    this.eventEmitter.removeAllListeners();

    logger.info('[EventBridge] Event bridge stopped');
  }
}
