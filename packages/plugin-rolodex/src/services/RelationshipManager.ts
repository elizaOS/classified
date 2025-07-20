import { logger, stringToUuid, type IAgentRuntime, type Memory, type UUID } from '@elizaos/core';
import {
  EventBridge,
  RolodexEventType,
  type HealthEvent,
  type InteractionEvent,
} from '../managers/EventBridge';
import { RolodexService } from './RolodexService';

export interface RelationshipHealth {
  entityId: UUID;
  relationshipId: UUID;
  healthScore: number; // 0-100
  lastInteractionDays: number;
  trustScore: number;
  status: 'healthy' | 'declining' | 'at_risk' | 'dormant';
  recommendedActions: string[];
}

export interface EngagementSuggestion {
  entityId: UUID;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  suggestedActions: Array<{
    action: string;
    description: string;
    impact: number;
  }>;
  nextFollowUpDate: Date;
}

export interface PatternAnalysis {
  entityId: UUID;
  patterns: Array<{
    type:
      | 'interaction_frequency'
      | 'sentiment'
      | 'response_time'
      | 'topic_shift'
      | 'engagement_depth'
      | 'communication_style';
    trend: 'positive' | 'negative' | 'stable';
    confidence: number;
    evidence: string[];
    severity?: 'low' | 'medium' | 'high';
    impact?: number;
  }>;
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
    description: string;
    confidence?: number;
    actionRequired?: boolean;
  }>;
}

export interface AutonomousDecision {
  entityId: UUID;
  decisionType:
    | 'engagement'
    | 'trust_adjustment'
    | 'privacy_change'
    | 'communication_style'
    | 'intervention';
  action: string;
  reason: string;
  confidence: number;
  estimatedImpact: number;
  scheduledFor?: Date;
  requiresApproval?: boolean;
  metadata?: Record<string, any>;
}

export interface LearningInsight {
  entityId: UUID;
  insightType: 'preference_learned' | 'behavior_pattern' | 'trust_factor' | 'communication_optimal';
  insight: string;
  evidence: string[];
  confidence: number;
  applicableToOthers: boolean;
  lastUpdated: Date;
}

export class RelationshipManager {
  private runtime: IAgentRuntime;
  private rolodexService?: RolodexService;
  private eventBridge?: EventBridge;
  private isActive: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private patternDetectionInterval?: NodeJS.Timeout;
  private decisionMakingInterval?: NodeJS.Timeout;
  private learningUpdateInterval?: NodeJS.Timeout;

  // Advanced caches for autonomous behavior
  private decisionHistory: Map<UUID, AutonomousDecision[]> = new Map();
  private learningInsights: Map<UUID, LearningInsight[]> = new Map();
  private engagementPatterns: Map<UUID, any> = new Map();
  private behaviorProfiles: Map<UUID, any> = new Map();

  // Configuration
  private config = {
    healthCheckIntervalMs: 3600000, // 1 hour
    patternCheckIntervalMs: 7200000, // 2 hours
    decisionMakingIntervalMs: 1800000, // 30 minutes
    learningUpdateIntervalMs: 14400000, // 4 hours
    decayThresholdDays: 14,
    criticalDecayDays: 30,
    minHealthScore: 40,
    autoEngagementEnabled: true,
    trustImpactThreshold: 10,
    autonomousDecisionThreshold: 0.8,
    learningConfidenceThreshold: 0.7,
    maxDecisionHistoryPerEntity: 50,
    maxLearningInsightsPerEntity: 25,
  };

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async initialize(): Promise<void> {
    logger.info('[RelationshipManager] Initializing...');

    // Get services
    this.rolodexService = this.runtime.getService('rolodex') as RolodexService;

    // Initialize event bridge
    this.eventBridge = new EventBridge(this.runtime);
    await this.eventBridge.initialize();

    // Register task workers for autonomous actions
    await this.registerTaskWorkers();

    // Subscribe to events
    this.subscribeToEvents();

    logger.info('[RelationshipManager] Initialized successfully');
  }

  async start(): Promise<void> {
    if (this.isActive) {
      return;
    }

    logger.info('[RelationshipManager] Starting autonomous operations...');
    this.isActive = true;

    // Start periodic health checks
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckIntervalMs
    );

    // Start pattern detection
    this.patternDetectionInterval = setInterval(
      () => this.detectPatterns(),
      this.config.patternCheckIntervalMs
    );

    // Start autonomous decision making
    this.decisionMakingInterval = setInterval(
      () => this.makeAutonomousDecisions(),
      this.config.decisionMakingIntervalMs
    );

    // Start learning updates
    this.learningUpdateInterval = setInterval(
      () => this.updateLearningInsights(),
      this.config.learningUpdateIntervalMs
    );

    // Perform initial checks
    await this.performHealthCheck();
    await this.detectPatterns();
    await this.makeAutonomousDecisions();
    await this.updateLearningInsights();
  }

  async stop(): Promise<void> {
    logger.info('[RelationshipManager] Stopping autonomous operations...');
    this.isActive = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.patternDetectionInterval) {
      clearInterval(this.patternDetectionInterval);
    }
    if (this.decisionMakingInterval) {
      clearInterval(this.decisionMakingInterval);
    }
    if (this.learningUpdateInterval) {
      clearInterval(this.learningUpdateInterval);
    }
  }

  private async registerTaskWorkers(): Promise<void> {
    // Worker for relationship check-ins
    this.runtime.registerTaskWorker({
      name: 'RELATIONSHIP_CHECKIN',
      execute: async (runtime, options, task) => {
        const { entityId, reason } = options as any;
        logger.info(
          `[RelationshipManager] Executing check-in for ${entityId}: ${reason}`
        );

        // Create a friendly check-in message
        const messages = [
          "Hey! It's been a while since we last connected. How have you been?",
          "Just thinking about you! What's new in your world?",
          "Hi there! Haven't heard from you in a bit. Everything going well?",
          "Hope you're doing great! Would love to catch up when you have a moment.",
        ];

        const message = messages[Math.floor(Math.random() * messages.length)];

        // Create memory for the check-in
        await runtime.createMemory(
          {
            entityId: runtime.agentId,
            roomId: task.roomId!,
            content: {
              text: message,
              metadata: {
                type: 'autonomous_checkin',
                reason,
                entityId,
              },
            },
          },
          'messages'
        );

        // Mark task as completed
        await runtime.deleteTask(task.id!);
      },
    });

    // Worker for trust-based interventions
    this.runtime.registerTaskWorker({
      name: 'TRUST_INTERVENTION',
      execute: async (runtime, options, task) => {
        const { entityId, trustIssue, suggestedAction } = options as any;
        logger.warn(
          `[RelationshipManager] Trust intervention for ${entityId}: ${trustIssue}`
        );

        // Take appropriate action based on trust issue
        switch (suggestedAction) {
          case 'verify_identity':
            await runtime.createMemory(
              {
                entityId: runtime.agentId,
                roomId: task.roomId!,
                content: {
                  text: 'I noticed some unusual activity. Could you help me verify your identity by answering a quick question about our previous conversations?',
                  metadata: {
                    type: 'trust_verification',
                    entityId,
                    issue: trustIssue,
                  },
                },
              },
              'messages'
            );
            break;

          case 'limit_interaction':
            // Set entity state to limited
            await runtime.setParticipantUserState(task.roomId!, entityId, 'MUTED');
            logger.info(
              `[RelationshipManager] Limited interaction with ${entityId} due to trust concerns`
            );
            break;

          case 'strengthen_relationship':
            await runtime.createMemory(
              {
                entityId: runtime.agentId,
                roomId: task.roomId!,
                content: {
                  text: "I value our connection and would love to understand you better. What's been on your mind lately?",
                  metadata: {
                    type: 'trust_building',
                    entityId,
                  },
                },
              },
              'messages'
            );
            break;
        }

        await runtime.deleteTask(task.id!);
      },
    });

    // Worker for pattern-based adjustments
    this.runtime.registerTaskWorker({
      name: 'PATTERN_ADJUSTMENT',
      execute: async (runtime, options, task) => {
        const { entityId, pattern, adjustment } = options as any;
        logger.info(
          `[RelationshipManager] Pattern adjustment for ${entityId}: ${pattern}`
        );

        // Apply adjustment based on detected pattern
        if (adjustment === 'increase_engagement') {
          // Schedule more frequent check-ins
          await this.scheduleEngagement(
            entityId,
            'Pattern detected: increased engagement needed',
            7
          );
        } else if (adjustment === 'reduce_frequency') {
          // Update contact preferences
          if (this.rolodexService) {
            const contact = await this.rolodexService.getEntity(entityId);
            if (contact) {
              await this.rolodexService.upsertEntity({
                id: entityId,
                metadata: {
                  ...contact.metadata,
                  preferences: {
                    ...(contact.metadata?.preferences || {}),
                    contactFrequency: 'monthly',
                  },
                },
              });
            }
          }
        }

        await runtime.deleteTask(task.id!);
      },
    });
  }

  private subscribeToEvents(): void {
    // Use EventBridge to listen for events if available
    if (this.eventBridge) {
      // Listen for trust changes through EventBridge
      this.eventBridge.on(RolodexEventType.TRUST_INCREASED, async (event: any) => {
        const change = event.change || event.currentScore - event.previousScore;
        if (Math.abs(change) > this.config.trustImpactThreshold) {
          await this.handleSignificantTrustChange(event.entityId, change);
        }
      });

      this.eventBridge.on(RolodexEventType.TRUST_DECREASED, async (event: any) => {
        const change = event.change || event.currentScore - event.previousScore;
        if (Math.abs(change) > this.config.trustImpactThreshold) {
          await this.handleSignificantTrustChange(event.entityId, change);
        }
      });

      // Listen for security threats through EventBridge
      this.eventBridge.on(RolodexEventType.SECURITY_THREAT_DETECTED, async (event: any) => {
        if (event.action === 'quarantine_suggested' || event.threatLevel === 'critical') {
          await this.quarantineEntity(event.entityId);
        }
      });

      // Listen for interaction events
      this.eventBridge.on(RolodexEventType.INTERACTION_RECORDED, async (event: any) => {
        if (event.entityId) {
          // Create a proper Memory object for compatibility
          const rooms = await this.runtime.getRoomsForParticipant(event.entityId);
          const roomId = rooms?.[0] || stringToUuid(`interaction-${event.entityId}`);

          const message: Memory = {
            id: stringToUuid(`interaction-${event.timestamp}`),
            entityId: event.entityId,
            roomId,
            agentId: this.runtime.agentId,
            content: { text: event.content || '' },
            createdAt: event.timestamp,
          };
          await this.updateRelationshipFromInteraction(message);
        }
      });

      // Listen for relationship health changes
      this.eventBridge.on(RolodexEventType.RELATIONSHIP_HEALTH_CHANGED, async (event: any) => {
        logger.info(
          `[RelationshipManager] Relationship health changed for ${event.entityId}: ${event.currentStatus}`
        );

        // Take action if health is critical
        if (event.currentStatus === 'at_risk' || event.currentStatus === 'dormant') {
          await this.handleUnhealthyRelationship(event.health);

          // Emit specific events for unhealthy relationships through EventBridge
          if (this.eventBridge) {
            const eventType =
              event.currentStatus === 'dormant'
                ? RolodexEventType.RELATIONSHIP_DORMANT
                : RolodexEventType.RELATIONSHIP_AT_RISK;

            await this.eventBridge.emit<HealthEvent>({
              type: eventType,
              timestamp: Date.now(),
              entityId: event.entityId,
              relationshipId: event.relationshipId,
              currentStatus: event.currentStatus,
              healthScore: event.healthScore,
              recommendations: event.recommendations || [],
              metadata: {
                lastInteractionDays: event.lastInteractionDays,
                trustScore: event.trustScore,
                source: 'autonomous_health_check',
              },
            });
          }
        }
      });
    }

    // Fallback to runtime events if EventBridge is not available
    // Listen for message events to update relationship health
    // this.runtime.on('message:received', async (data: any) => {
    //     const { message } = data;
    //     if (message && message.entityId) {
    //         await this.updateRelationshipFromInteraction(message);
    //     }
    // });

    // Listen for trust changes
    // this.runtime.on('rolodex:significant_trust_change', async (data: any) => {
    //     const { entityId, change } = data;
    //     if (Math.abs(change) > this.config.trustImpactThreshold) {
    //         await this.handleSignificantTrustChange(entityId, change);
    //     }
    // });

    // Listen for security threats
    // this.runtime.on('rolodex:security_threat', async (data: any) => {
    //     const { entityId, action } = data;
    //     if (action === 'quarantine_suggested') {
    //         await this.quarantineEntity(entityId);
    //     }
    // });
  }

  async performHealthCheck(): Promise<RelationshipHealth[]> {
    if (!this.isActive || !this.rolodexService) {
      return [];
    }

    logger.info('[RelationshipManager] Performing relationship health check...');
    const healthReports: RelationshipHealth[] = [];

    try {
      // Get all contacts
      const contacts = await this.rolodexService.searchEntities('', 1000);

      for (const contact of contacts) {
        const relationships = await this.runtime.getRelationships({
          entityId: contact.id!,
        });

        for (const relationship of relationships) {
          const health = await this.evaluateRelationshipHealth(contact.id!, relationship);
          healthReports.push(health);

          // Emit health check event through EventBridge
          if (this.eventBridge) {
            await this.eventBridge.emitHealthChanged(
              health.entityId,
              health.relationshipId,
              'unknown', // previous status not tracked in health check
              health.status,
              health.healthScore,
              health.recommendedActions
            );
          }

          // Take action on unhealthy relationships
          if (health.status === 'at_risk' || health.status === 'dormant') {
            await this.handleUnhealthyRelationship(health);

            // Emit specific events for unhealthy relationships through EventBridge
            if (this.eventBridge) {
              const eventType =
                health.status === 'dormant'
                  ? RolodexEventType.RELATIONSHIP_DORMANT
                  : RolodexEventType.RELATIONSHIP_AT_RISK;

              await this.eventBridge.emit<HealthEvent>({
                type: eventType,
                timestamp: Date.now(),
                entityId: health.entityId,
                relationshipId: health.relationshipId,
                currentStatus: health.status,
                healthScore: health.healthScore,
                recommendations: health.recommendedActions,
                metadata: {
                  lastInteractionDays: health.lastInteractionDays,
                  trustScore: health.trustScore,
                  source: 'autonomous_health_check',
                },
              });
            }
          }
        }
      }

      logger.info(
        `[RelationshipManager] Health check complete. Processed ${healthReports.length} relationships`
      );

      // Emit health check completion event through EventBridge
      if (this.eventBridge) {
        await this.eventBridge.emit<InteractionEvent>({
          type: RolodexEventType.PATTERN_DETECTED,
          timestamp: Date.now(),
          entityId: this.runtime.agentId,
          interactionType: 'health_check_completed',
          pattern: {
            type: 'health_check_summary',
            confidence: 1.0,
            evidence: [
              `Processed ${healthReports.length} relationships`,
              `Found ${healthReports.filter((h) => h.status === 'at_risk').length} at-risk relationships`,
              `Found ${healthReports.filter((h) => h.status === 'dormant').length} dormant relationships`,
            ],
          },
          metadata: {
            totalRelationships: healthReports.length,
            healthyCount: healthReports.filter((h) => h.status === 'healthy').length,
            decliningCount: healthReports.filter((h) => h.status === 'declining').length,
            atRiskCount: healthReports.filter((h) => h.status === 'at_risk').length,
            dormantCount: healthReports.filter((h) => h.status === 'dormant').length,
            averageHealthScore:
              healthReports.length > 0
                ? healthReports.reduce((sum, h) => sum + h.healthScore, 0) / healthReports.length
                : 0,
          },
        });
      }
    } catch (error) {
      logger.error('[RelationshipManager] Error during health check:', error);

      // Emit error event through EventBridge
      if (this.eventBridge) {
        await this.eventBridge.emit<InteractionEvent>({
          type: RolodexEventType.ANOMALY_DETECTED,
          timestamp: Date.now(),
          entityId: this.runtime.agentId,
          interactionType: 'health_check_error',
          anomaly: {
            type: 'health_check_failure',
            severity: 'medium',
            description: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          },
          metadata: {
            source: 'autonomous_health_check',
            error: error instanceof Error ? error.stack : String(error),
          },
        });
      }
    }

    return healthReports;
  }

  private async evaluateRelationshipHealth(
    entityId: UUID,
    relationship: any
  ): Promise<RelationshipHealth> {
    // Get relationship analytics
    const targetId =
      relationship.sourceEntityId === entityId
        ? relationship.targetEntityId
        : relationship.sourceEntityId;

    const profile = this.rolodexService
      ? await this.rolodexService.getEntityProfile(targetId)
      : null;

    // Get trust score
    const trustScore = this.rolodexService
      ? await this.rolodexService.getTrustScore(targetId)
      : null;
    const trustEval = {
      allowed: true,
      trustScore: trustScore?.score || 50,
      reasoning: 'Trust evaluation',
    };

    // Calculate days since last interaction
    const lastInteractionDays = profile?.lastInteractionAt
      ? Math.floor(
          (Date.now() - new Date(profile.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 999;

    // Calculate health score
    let healthScore = 100;

    // Decay based on time
    if (lastInteractionDays > this.config.criticalDecayDays) {
      healthScore -= 40;
    } else if (lastInteractionDays > this.config.decayThresholdDays) {
      healthScore -= 20;
    }

    // Factor in relationship strength
    if (profile) {
      healthScore = healthScore * 0.6 + profile.strength * 0.4;
    }

    // Factor in trust
    healthScore = healthScore * 0.7 + trustEval.trustScore * 0.3;

    // Determine status
    let status: 'healthy' | 'declining' | 'at_risk' | 'dormant';
    if (healthScore >= 70 && lastInteractionDays < this.config.decayThresholdDays) {
      status = 'healthy';
    } else if (healthScore >= 50) {
      status = 'declining';
    } else if (lastInteractionDays > this.config.criticalDecayDays) {
      status = 'dormant';
    } else {
      status = 'at_risk';
    }

    // Generate recommendations
    const recommendedActions: string[] = [];
    if (lastInteractionDays > this.config.decayThresholdDays) {
      recommendedActions.push('Schedule a check-in conversation');
    }
    if (trustEval.trustScore < 50) {
      recommendedActions.push('Build trust through consistent positive interactions');
    }
    if (profile && profile.strength < 30) {
      recommendedActions.push('Deepen relationship through meaningful conversations');
    }

    return {
      entityId,
      relationshipId: relationship.id,
      healthScore: Math.round(healthScore),
      lastInteractionDays,
      trustScore: trustEval.trustScore,
      status,
      recommendedActions,
    };
  }

  private async handleUnhealthyRelationship(health: RelationshipHealth): Promise<void> {
    logger.info(
      `[RelationshipManager] Handling unhealthy relationship: ${health.entityId} (${health.status})`
    );

    if (!this.config.autoEngagementEnabled) {
      return;
    }

    // Create engagement suggestion
    const suggestion = await this.createEngagementSuggestion(health);

    // Schedule automatic engagement based on priority
    if (suggestion.priority === 'high') {
      await this.scheduleEngagement(
        health.entityId,
        suggestion.reason,
        1 // Tomorrow
      );
    } else if (suggestion.priority === 'medium') {
      await this.scheduleEngagement(
        health.entityId,
        suggestion.reason,
        3 // In 3 days
      );
    }

    // Update trust if relationship is dormant
    if (health.status === 'dormant' && this.rolodexService) {
      await this.rolodexService.updateTrustFromInteraction(health.entityId, {
        type: 'relationship_decay',
        outcome: 'negative',
        metadata: {
          impact: -5,
          evidence: `Relationship dormant for ${health.lastInteractionDays} days`,
        },
      });
    }
  }

  async suggestEngagements(): Promise<EngagementSuggestion[]> {
    const suggestions: EngagementSuggestion[] = [];

    if (!this.rolodexService) {
      return suggestions;
    }

    // Get all relationships that need attention
    const _stats = await this.rolodexService.getNetworkStats();
    const insights = {
      needsAttention: [] as any[], // We'll need to implement this logic differently
    };

    // Create suggestions for entities needing attention
    for (const item of insights.needsAttention) {
      const health = await this.evaluateRelationshipHealth(item.entity.id as UUID, {
        id: stringToUuid(`rel-${item.entity.id}`),
      });

      const suggestion = await this.createEngagementSuggestion(health);
      suggestions.push(suggestion);
    }

    return suggestions;
  }

  private async createEngagementSuggestion(
    health: RelationshipHealth
  ): Promise<EngagementSuggestion> {
    const suggestedActions: Array<{
      action: string;
      description: string;
      impact: number;
    }> = [];

    if (health.lastInteractionDays > this.config.criticalDecayDays) {
      suggestedActions.push({
        action: 'reconnect',
        description: 'Send a thoughtful reconnection message',
        impact: 20,
      });
    } else if (health.lastInteractionDays > this.config.decayThresholdDays) {
      suggestedActions.push({
        action: 'check_in',
        description: 'Casual check-in message',
        impact: 10,
      });
    }

    if (health.trustScore < 50) {
      suggestedActions.push({
        action: 'trust_building',
        description: 'Share something personal to build trust',
        impact: 15,
      });
    }

    // Determine priority
    let priority: 'high' | 'medium' | 'low';
    if (health.status === 'dormant' || health.trustScore < 30) {
      priority = 'high';
    } else if (health.status === 'at_risk') {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Calculate next follow-up date
    let daysUntilFollowUp = 7;
    if (priority === 'high') {
      daysUntilFollowUp = 1;
    } else if (priority === 'medium') {
      daysUntilFollowUp = 3;
    }

    const nextFollowUpDate = new Date();
    nextFollowUpDate.setDate(nextFollowUpDate.getDate() + daysUntilFollowUp);

    return {
      entityId: health.entityId,
      priority,
      reason: `Relationship ${health.status}: ${health.lastInteractionDays} days since contact, trust score ${health.trustScore}`,
      suggestedActions,
      nextFollowUpDate,
    };
  }

  private async scheduleEngagement(
    entityId: UUID,
    reason: string,
    daysFromNow: number
  ): Promise<void> {
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + daysFromNow);

    // Find or create a room for this entity
    const rooms = await this.runtime.getRoomsForParticipant(entityId);
    const roomId = rooms[0] || stringToUuid(`dm-${entityId}-${this.runtime.agentId}`);

    // Create task for future engagement
    await this.runtime.createTask({
      name: 'RELATIONSHIP_CHECKIN',
      description: `Automated check-in with entity ${entityId}`,
      roomId,
      metadata: {
        entityId,
        reason,
        scheduledFor: scheduledDate.getTime(),
        type: 'autonomous_engagement',
      },
      tags: ['autonomous', 'relationship', 'check-in'],
    });

    logger.info(
      `[RelationshipManager] Scheduled engagement with ${entityId} for ${scheduledDate.toISOString()}`
    );
  }

  async detectPatterns(): Promise<void> {
    if (!this.isActive || !this.rolodexService) {
      return;
    }

    logger.info('[RelationshipManager] Running pattern detection...');

    try {
      const contacts = await this.rolodexService.searchEntities('', 1000);
      const patternsDetected: Array<{
        entityId: UUID;
        pattern: any;
        confidence: number;
      }> = [];
      const anomaliesDetected: Array<{
        entityId: UUID;
        anomaly: any;
        severity: string;
      }> = [];

      for (const contact of contacts) {
        const analysis = await this.analyzeEntityPatterns(contact.id!);

        // Take action on significant patterns
        for (const pattern of analysis.patterns) {
          if (pattern.confidence > 0.7) {
            await this.handleDetectedPattern(contact.id!, pattern);
            patternsDetected.push({
              entityId: contact.id!,
              pattern,
              confidence: pattern.confidence,
            });
          }

          // Emit all detected patterns through EventBridge
          if (this.eventBridge) {
            await this.eventBridge.emitPatternDetected(contact.id!, {
              type: pattern.type,
              confidence: pattern.confidence,
              evidence: pattern.evidence,
            });
          }
        }

        // Handle anomalies
        for (const anomaly of analysis.anomalies) {
          if (anomaly.severity === 'high') {
            await this.handleAnomaly(contact.id!, anomaly);
            anomaliesDetected.push({
              entityId: contact.id!,
              anomaly,
              severity: anomaly.severity,
            });
          }

          // Emit all anomalies through EventBridge
          if (this.eventBridge) {
            await this.eventBridge.emit<InteractionEvent>({
              type: RolodexEventType.ANOMALY_DETECTED,
              timestamp: Date.now(),
              entityId: contact.id!,
              interactionType: 'pattern_detection',
              anomaly: {
                type: anomaly.type,
                severity: anomaly.severity,
                description: anomaly.description,
              },
              metadata: {
                timestamp: anomaly.timestamp,
                source: 'autonomous_pattern_detection',
              },
            });
          }
        }
      }

      // Emit pattern detection completion event through EventBridge
      if (this.eventBridge) {
        await this.eventBridge.emit<InteractionEvent>({
          type: RolodexEventType.PATTERN_DETECTED,
          timestamp: Date.now(),
          entityId: this.runtime.agentId,
          interactionType: 'pattern_detection_completed',
          pattern: {
            type: 'pattern_detection_summary',
            confidence: 1.0,
            evidence: [
              `Analyzed ${contacts.length} contacts`,
              `Detected ${patternsDetected.length} significant patterns`,
              `Found ${anomaliesDetected.length} high-severity anomalies`,
            ],
          },
          metadata: {
            totalContacts: contacts.length,
            patternsDetected: patternsDetected.length,
            anomaliesDetected: anomaliesDetected.length,
            patternTypes: [...new Set(patternsDetected.map((p) => p.pattern.type))],
            anomalyTypes: [...new Set(anomaliesDetected.map((a) => a.anomaly.type))],
            source: 'autonomous_pattern_detection',
          },
        });
      }

      logger.info(
        `[RelationshipManager] Pattern detection complete. Found ${patternsDetected.length} patterns and ${anomaliesDetected.length} anomalies`
      );
    } catch (error) {
      logger.error('[RelationshipManager] Error during pattern detection:', error);

      // Emit error event through EventBridge
      if (this.eventBridge) {
        await this.eventBridge.emit<InteractionEvent>({
          type: RolodexEventType.ANOMALY_DETECTED,
          timestamp: Date.now(),
          entityId: this.runtime.agentId,
          interactionType: 'pattern_detection_error',
          anomaly: {
            type: 'pattern_detection_failure',
            severity: 'medium',
            description: `Pattern detection failed: ${error instanceof Error ? error.message : String(error)}`,
          },
          metadata: {
            source: 'autonomous_pattern_detection',
            error: error instanceof Error ? error.stack : String(error),
          },
        });
      }
    }
  }

  private async analyzeEntityPatterns(entityId: UUID): Promise<PatternAnalysis> {
    const patterns: any[] = [];
    const anomalies: any[] = [];

    // Get recent messages
    const messages = await this.runtime.getMemories({
      tableName: 'messages',
      entityId,
      count: 100,
    });

    if (messages.length < 10) {
      return { entityId, patterns, anomalies };
    }

    // Analyze interaction frequency
    const frequencyPattern = this.analyzeInteractionFrequency(messages);
    if (frequencyPattern) {
      patterns.push(frequencyPattern);
    }

    // Analyze response times
    const responsePattern = this.analyzeResponseTimes(messages);
    if (responsePattern) {
      patterns.push(responsePattern);
    }

    // Detect anomalies
    const messageAnomalies = this.detectMessageAnomalies(messages);
    anomalies.push(...messageAnomalies);

    return { entityId, patterns, anomalies };
  }

  private analyzeInteractionFrequency(messages: Memory[]): any {
    // Group messages by day
    const messagesByDay = new Map<string, number>();

    messages.forEach((msg) => {
      if (msg.createdAt) {
        const day = new Date(msg.createdAt).toISOString().split('T')[0];
        messagesByDay.set(day, (messagesByDay.get(day) || 0) + 1);
      }
    });

    // Calculate trend
    const days = Array.from(messagesByDay.keys()).sort();
    if (days.length < 3) {
      return null;
    }

    const recentAvg =
      Array.from(messagesByDay.values())
        .slice(-7)
        .reduce((a, b) => a + b, 0) / 7;
    const overallAvg = Array.from(messagesByDay.values()).reduce((a, b) => a + b, 0) / days.length;

    let trend: 'positive' | 'negative' | 'stable' = 'stable';
    if (recentAvg > overallAvg * 1.5) {
      trend = 'positive';
    } else if (recentAvg < overallAvg * 0.5) {
      trend = 'negative';
    }

    return {
      type: 'interaction_frequency',
      trend,
      confidence: Math.min(days.length / 30, 1), // More days = higher confidence
      evidence: [
        `Recent avg: ${recentAvg.toFixed(1)} msgs/day, Overall: ${overallAvg.toFixed(1)} msgs/day`,
      ],
    };
  }

  private analyzeResponseTimes(messages: Memory[]): any {
    const responseTimes: number[] = [];

    for (let i = 1; i < messages.length; i++) {
      const current = messages[i];
      const previous = messages[i - 1];

      if (current.entityId !== previous.entityId && current.createdAt && previous.createdAt) {
        const timeDiff =
          new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
        if (timeDiff < 86400000) {
          // Within 24 hours
          responseTimes.push(timeDiff);
        }
      }
    }

    if (responseTimes.length < 5) {
      return null;
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const recentAvg = responseTimes.slice(-5).reduce((a, b) => a + b, 0) / 5;

    let trend: 'positive' | 'negative' | 'stable' = 'stable';
    if (recentAvg < avgResponseTime * 0.7) {
      trend = 'positive';
    } else if (recentAvg > avgResponseTime * 1.3) {
      trend = 'negative';
    }

    return {
      type: 'response_time',
      trend,
      confidence: Math.min(responseTimes.length / 20, 1),
      evidence: [`Avg response: ${(avgResponseTime / 60000).toFixed(1)} min`],
    };
  }

  private detectMessageAnomalies(messages: Memory[]): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
    description: string;
    confidence?: number;
    actionRequired?: boolean;
  }> {
    const anomalies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      timestamp: Date;
      description: string;
      confidence?: number;
      actionRequired?: boolean;
    }> = [];

    // Check for sudden changes in message length
    const lengths = messages.map((m) => m.content.text?.length || 0);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    const recentMessages = messages.slice(-5);
    for (const msg of recentMessages) {
      const length = msg.content.text?.length || 0;
      if (length > avgLength * 3 || length < avgLength * 0.2) {
        anomalies.push({
          type: 'message_length_anomaly',
          severity: 'low' as const,
          timestamp: new Date(msg.createdAt || Date.now()),
          description: `Unusual message length: ${length} chars (avg: ${avgLength.toFixed(0)})`,
        });
      }
    }

    return anomalies;
  }

  private async handleDetectedPattern(entityId: UUID, pattern: any): Promise<void> {
    logger.info(`[RelationshipManager] Detected pattern for ${entityId}:`, pattern);

    // Create task for pattern-based adjustment
    const rooms = await this.runtime.getRoomsForParticipant(entityId);
    const roomId = rooms[0] || stringToUuid(`pattern-${entityId}`);

    let adjustment = 'none';
    if (pattern.type === 'interaction_frequency' && pattern.trend === 'negative') {
      adjustment = 'increase_engagement';
    } else if (pattern.type === 'response_time' && pattern.trend === 'negative') {
      adjustment = 'reduce_frequency';
    }

    if (adjustment !== 'none') {
      await this.runtime.createTask({
        name: 'PATTERN_ADJUSTMENT',
        description: 'Adjust relationship based on detected pattern',
        roomId,
        metadata: {
          entityId,
          pattern: pattern.type,
          trend: pattern.trend,
          adjustment,
        },
        tags: ['autonomous', 'pattern', 'adjustment'],
      });
    }

    // Update trust based on pattern
    if (this.rolodexService) {
      const impact = pattern.trend === 'positive' ? 3 : pattern.trend === 'negative' ? -3 : 0;
      if (impact !== 0) {
        await this.rolodexService.updateTrustFromInteraction(entityId, {
          type: 'trust_change',
          outcome: pattern.trend === 'positive' ? 'positive' : 'negative',
          metadata: {
            impact,
            evidence: `${pattern.type} trend: ${pattern.trend}`,
          },
        });
      }
    }
  }

  private async handleAnomaly(entityId: UUID, anomaly: any): Promise<void> {
    logger.warn(`[RelationshipManager] Anomaly detected for ${entityId}:`, anomaly);

    // Remove the security threat check as it's not available
    logger.warn(`[RelationshipManager] Anomaly detected for ${entityId}:`, anomaly);
  }

  private async updateRelationshipFromInteraction(message: Memory): Promise<void> {
    if (!message.entityId || message.entityId === this.runtime.agentId) {
      return;
    }

    // Update last interaction time
    const _relationships = await this.runtime.getRelationships({
      entityId: message.entityId,
    });

    // Update trust positively for interaction
    if (this.rolodexService) {
      await this.rolodexService.updateTrustFromInteraction(message.entityId, {
        type: 'interaction',
        outcome: 'positive',
        metadata: {
          impact: 1,
          evidence: 'Regular interaction',
        },
      });
    }
  }

  private async handleSignificantTrustChange(entityId: UUID, change: number): Promise<void> {
    logger.info(
      `[RelationshipManager] Significant trust change for ${entityId}: ${change}`
    );

    const rooms = await this.runtime.getRoomsForParticipant(entityId);
    const roomId = rooms[0] || stringToUuid(`trust-${entityId}`);

    let suggestedAction = 'monitor';
    if (change < -20) {
      suggestedAction = 'verify_identity';
    } else if (change < -10) {
      suggestedAction = 'limit_interaction';
    } else if (change > 10) {
      suggestedAction = 'strengthen_relationship';
    }

    await this.runtime.createTask({
      name: 'TRUST_INTERVENTION',
      description: 'Handle significant trust change',
      roomId,
      metadata: {
        entityId,
        trustChange: change,
        trustIssue: change < 0 ? 'trust_decline' : 'trust_improvement',
        suggestedAction,
      },
      tags: ['autonomous', 'trust', 'intervention'],
    });
  }

  private async quarantineEntity(entityId: UUID): Promise<void> {
    logger.warn(
      `[RelationshipManager] Quarantining entity ${entityId} due to security threat`
    );

    // Set entity to muted in all rooms
    const rooms = await this.runtime.getRoomsForParticipant(entityId);
    for (const room of rooms) {
      await this.runtime.setParticipantUserState(room, entityId, 'MUTED');
    }

    // Privacy setting not available, log instead
    logger.info(`[RelationshipManager] Would set privacy for ${entityId}`);
  }

  // ============================================================================
  // AUTONOMOUS DECISION MAKING
  // ============================================================================

  private async makeAutonomousDecisions(): Promise<void> {
    if (!this.isActive || !this.rolodexService) {
      return;
    }

    logger.info('[RelationshipManager] Making autonomous decisions...');

    try {
      const contacts = await this.rolodexService.searchEntities('', 1000);
      const decisions: AutonomousDecision[] = [];

      for (const contact of contacts) {
        const entityDecisions = await this.analyzeAndDecide(contact.id!);
        decisions.push(...entityDecisions);
      }

      // Execute high-confidence decisions automatically
      const autoExecutableDecisions = decisions.filter(
        (d) => d.confidence >= this.config.autonomousDecisionThreshold && !d.requiresApproval
      );

      for (const decision of autoExecutableDecisions) {
        await this.executeAutonomousDecision(decision);
        this.recordDecision(decision);
      }

      // Store decisions that require approval
      const approvalRequiredDecisions = decisions.filter(
        (d) => d.requiresApproval || d.confidence < this.config.autonomousDecisionThreshold
      );

      for (const decision of approvalRequiredDecisions) {
        this.recordDecision(decision);
        // Could emit event for human approval interface
        if (this.eventBridge) {
          await this.eventBridge.emit<InteractionEvent>({
            type: RolodexEventType.PATTERN_DETECTED,
            timestamp: Date.now(),
            entityId: decision.entityId,
            interactionType: 'autonomous_decision_pending',
            pattern: {
              type: decision.decisionType,
              confidence: decision.confidence,
              evidence: [decision.reason],
            },
            metadata: {
              decision,
              requiresApproval: decision.requiresApproval,
              estimatedImpact: decision.estimatedImpact,
            },
          });
        }
      }

      logger.info(
        `[RelationshipManager] Decision making complete. Executed ${autoExecutableDecisions.length} decisions, ${approvalRequiredDecisions.length} pending approval`
      );
    } catch (error) {
      logger.error(
        '[RelationshipManager] Error during autonomous decision making:',
        error
      );
    }
  }

  private async analyzeAndDecide(entityId: UUID): Promise<AutonomousDecision[]> {
    const decisions: AutonomousDecision[] = [];

    // Get entity analytics
    const profile = this.rolodexService
      ? await this.rolodexService.getEntityProfile(entityId)
      : null;

    // Get trust evaluation
    const trustScore = this.rolodexService
      ? await this.rolodexService.getTrustScore(entityId)
      : null;
    const trustEval = {
      allowed: true,
      trustScore: trustScore?.score || 50,
      reasoning: 'Learning evaluation',
    };

    // Get recent patterns
    const patterns = await this.analyzeEntityPatterns(entityId);

    // Get decision history to avoid repetitive actions
    const recentDecisions = this.decisionHistory.get(entityId) || [];
    const recentDecisionTypes = recentDecisions
      .filter((d) => Date.now() - (d.scheduledFor?.getTime() || 0) < 86400000 * 7) // Last 7 days
      .map((d) => d.decisionType);

    // Decision 1: Engagement frequency adjustment
    if (!recentDecisionTypes.includes('engagement') && profile) {
      const interactionGap = profile.lastInteractionAt
        ? Date.now() - new Date(profile.lastInteractionAt).getTime()
        : 999999999;
      const daysSinceInteraction = Math.floor(interactionGap / (1000 * 60 * 60 * 24));

      if (daysSinceInteraction > this.config.decayThresholdDays) {
        const urgency = daysSinceInteraction > this.config.criticalDecayDays ? 'high' : 'medium';
        decisions.push({
          entityId,
          decisionType: 'engagement',
          action: urgency === 'high' ? 'immediate_reconnect' : 'schedule_checkin',
          reason: `${daysSinceInteraction} days since last interaction (threshold: ${this.config.decayThresholdDays})`,
          confidence: Math.min(0.9, daysSinceInteraction / this.config.criticalDecayDays),
          estimatedImpact: urgency === 'high' ? 15 : 8,
          scheduledFor: urgency === 'high' ? new Date() : new Date(Date.now() + 86400000),
          requiresApproval: false,
          metadata: { daysSinceInteraction, urgency, profile },
        });
      }
    }

    // Decision 2: Trust-based adjustments
    if (!recentDecisionTypes.includes('trust_adjustment') && trustEval.trustScore < 40) {
      decisions.push({
        entityId,
        decisionType: 'trust_adjustment',
        action: 'increase_monitoring',
        reason: `Low trust score: ${trustEval.trustScore} (threshold: 40)`,
        confidence: 0.85,
        estimatedImpact: 5,
        requiresApproval: trustEval.trustScore < 20,
        metadata: { trustEval },
      });
    }

    // Decision 3: Communication style optimization
    const communicationPatterns = patterns.patterns.filter((p) => p.type === 'communication_style');
    if (communicationPatterns.length > 0 && !recentDecisionTypes.includes('communication_style')) {
      const negativePatterns = communicationPatterns.filter((p) => p.trend === 'negative');
      if (negativePatterns.length > 0) {
        decisions.push({
          entityId,
          decisionType: 'communication_style',
          action: 'adjust_communication_approach',
          reason: `Detected negative communication patterns: ${negativePatterns.map((p) => p.type).join(', ')}`,
          confidence: Math.max(...negativePatterns.map((p) => p.confidence)),
          estimatedImpact: 10,
          requiresApproval: false,
          metadata: { patterns: negativePatterns },
        });
      }
    }

    // Decision 4: Privacy adjustments based on trust and behavior
    if (!recentDecisionTypes.includes('privacy_change') && profile) {
      const shouldAdjustPrivacy = this.shouldAdjustPrivacy(entityId, trustEval, profile, patterns);
      if (shouldAdjustPrivacy) {
        decisions.push({
          entityId,
          decisionType: 'privacy_change',
          action: shouldAdjustPrivacy.action,
          reason: shouldAdjustPrivacy.reason,
          confidence: shouldAdjustPrivacy.confidence,
          estimatedImpact: shouldAdjustPrivacy.impact,
          requiresApproval: shouldAdjustPrivacy.requiresApproval,
          metadata: shouldAdjustPrivacy.metadata,
        });
      }
    }

    return decisions;
  }

  private shouldAdjustPrivacy(
    entityId: UUID,
    trustEval: any,
    profile: any,
    patterns: PatternAnalysis
  ): any {
    // Check if privacy should be increased (more restrictive)
    if (trustEval.trustScore < 30 || patterns.anomalies.some((a) => a.severity === 'high')) {
      return {
        action: 'increase_privacy_restrictions',
        reason: `Trust score ${trustEval.trustScore} or high-severity anomalies detected`,
        confidence: 0.9,
        impact: 8,
        requiresApproval: true,
        metadata: { currentTrust: trustEval.trustScore, anomalies: patterns.anomalies },
      };
    }

    // Check if privacy can be relaxed (less restrictive)
    if (trustEval.trustScore > 80 && profile.strength > 70) {
      return {
        action: 'relax_privacy_restrictions',
        reason: `High trust (${trustEval.trustScore}) and strong relationship (${profile.strength})`,
        confidence: 0.75,
        impact: 5,
        requiresApproval: false,
        metadata: { currentTrust: trustEval.trustScore, relationshipStrength: profile.strength },
      };
    }

    return null;
  }

  private async executeAutonomousDecision(decision: AutonomousDecision): Promise<void> {
    logger.info(
      `[RelationshipManager] Executing autonomous decision for ${decision.entityId}: ${decision.action}`
    );

    try {
      switch (decision.decisionType) {
        case 'engagement':
          await this.executeEngagementDecision(decision);
          break;

        case 'trust_adjustment':
          await this.executeTrustAdjustmentDecision(decision);
          break;

        case 'communication_style':
          await this.executeCommunicationStyleDecision(decision);
          break;

        case 'privacy_change':
          await this.executePrivacyChangeDecision(decision);
          break;

        case 'intervention':
          await this.executeInterventionDecision(decision);
          break;

        default:
          logger.warn(
            `[RelationshipManager] Unknown decision type: ${decision.decisionType}`
          );
      }

      // Emit decision executed event
      if (this.eventBridge) {
        await this.eventBridge.emit<InteractionEvent>({
          type: RolodexEventType.PATTERN_DETECTED,
          timestamp: Date.now(),
          entityId: decision.entityId,
          interactionType: 'autonomous_decision_executed',
          pattern: {
            type: decision.decisionType,
            confidence: decision.confidence,
            evidence: [decision.reason],
          },
          metadata: {
            decision,
            executedAt: Date.now(),
            estimatedImpact: decision.estimatedImpact,
          },
        });
      }
    } catch (error) {
      logger.error('[RelationshipManager] Failed to execute decision:', error);

      // Record failed decision
      decision.metadata = {
        ...decision.metadata,
        executionFailed: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async executeEngagementDecision(decision: AutonomousDecision): Promise<void> {
    if (decision.action === 'immediate_reconnect') {
      await this.scheduleEngagement(
        decision.entityId,
        'Autonomous decision: immediate reconnection needed',
        0 // Today
      );
    } else if (decision.action === 'schedule_checkin') {
      await this.scheduleEngagement(
        decision.entityId,
        'Autonomous decision: scheduled check-in',
        1 // Tomorrow
      );
    }
  }

  private async executeTrustAdjustmentDecision(decision: AutonomousDecision): Promise<void> {
    if (decision.action === 'increase_monitoring' && this.rolodexService) {
      // Update contact metadata to indicate increased monitoring
      const contact = await this.rolodexService.getEntity(decision.entityId);
      if (contact) {
        // Store monitoring info separately or in a different field
        // since ContactInfo doesn't have a notes field
        await this.rolodexService.upsertEntity({
          id: decision.entityId,
          metadata: {
            ...contact.metadata,
            tags: [
              ...(Array.isArray(contact.metadata?.tags) ? contact.metadata.tags : []),
              'enhanced-monitoring',
            ],
            customFields: {
              ...(contact.metadata?.customFields || {}),
              monitoringLevel: 'enhanced',
              monitoringReason: decision.reason,
              monitoringStartedAt: new Date().toISOString(),
            },
          },
        });
      }
    }
  }

  private async executeCommunicationStyleDecision(decision: AutonomousDecision): Promise<void> {
    if (decision.action === 'adjust_communication_approach' && this.rolodexService) {
      // Update contact preferences based on detected patterns
      const contact = await this.rolodexService.getEntity(decision.entityId);
      if (contact && contact.metadata) {
        const adjustedPreferences = this.calculateCommunicationAdjustments(
          decision.metadata?.patterns || []
        );
        await this.rolodexService.upsertEntity({
          id: decision.entityId,
          metadata: {
            ...contact.metadata,
            preferences: {
              ...(contact.metadata?.preferences || {}),
              ...adjustedPreferences,
              lastCommunicationAdjustment: Date.now(),
            },
          },
        });
      }
    }
  }

  private calculateCommunicationAdjustments(patterns: any[]): any {
    const adjustments: any = {};

    for (const pattern of patterns) {
      if (pattern.type === 'response_time' && pattern.trend === 'negative') {
        adjustments.preferredContactFrequency = 'reduced';
        adjustments.responseTimeExpectation = 'extended';
      }

      if (pattern.type === 'interaction_frequency' && pattern.trend === 'negative') {
        adjustments.contactFrequency = 'monthly';
        adjustments.engagementStyle = 'light';
      }
    }

    return adjustments;
  }

  private async executePrivacyChangeDecision(decision: AutonomousDecision): Promise<void> {
    if (!this.rolodexService) {
      return;
    }

    // Privacy setting not available, log instead
    if (decision.action === 'increase_privacy_restrictions') {
      // Privacy method not available in RolodexService, update metadata instead
      const contact = await this.rolodexService.getEntity(decision.entityId);
      if (contact) {
        await this.rolodexService.upsertEntity({
          id: decision.entityId,
          metadata: {
            ...contact.metadata,
            privacy: 'restricted',
          },
        });
      }
    } else if (decision.action === 'relax_privacy_restrictions') {
      const contact = await this.rolodexService.getEntity(decision.entityId);
      if (contact) {
        await this.rolodexService.upsertEntity({
          id: decision.entityId,
          metadata: {
            ...contact.metadata,
            privacy: 'public',
          },
        });
      }
    }
  }

  private async executeInterventionDecision(decision: AutonomousDecision): Promise<void> {
    // Create intervention task
    const rooms = await this.runtime.getRoomsForParticipant(decision.entityId);
    const roomId = rooms[0] || stringToUuid(`intervention-${decision.entityId}`);

    await this.runtime.createTask({
      name: 'TRUST_INTERVENTION',
      description: `Autonomous intervention: ${decision.reason}`,
      roomId,
      metadata: {
        entityId: decision.entityId,
        trustIssue: decision.action,
        suggestedAction: decision.metadata?.suggestedAction || 'monitor',
        autonomousDecision: true,
      },
      tags: ['autonomous', 'intervention', 'trust'],
    });
  }

  private recordDecision(decision: AutonomousDecision): void {
    const history = this.decisionHistory.get(decision.entityId) || [];
    history.push(decision);

    // Keep only recent decisions
    while (history.length > this.config.maxDecisionHistoryPerEntity) {
      history.shift();
    }

    this.decisionHistory.set(decision.entityId, history);
  }

  // ============================================================================
  // LEARNING AND ADAPTATION
  // ============================================================================

  private async updateLearningInsights(): Promise<void> {
    if (!this.isActive || !this.rolodexService) {
      return;
    }

    logger.info('[RelationshipManager] Updating learning insights...');

    try {
      const contacts = await this.rolodexService.searchEntities('', 1000);
      const newInsights: LearningInsight[] = [];

      for (const contact of contacts) {
        const entityInsights = await this.extractLearningInsights(contact.id!);
        newInsights.push(...entityInsights);

        // Update entity learning insights
        const existingInsights = this.learningInsights.get(contact.id!) || [];
        const mergedInsights = this.mergeLearningInsights(existingInsights, entityInsights);
        this.learningInsights.set(contact.id!, mergedInsights);

        // Store insights that are applicable to others
        const applicableInsights = entityInsights.filter((i) => i.applicableToOthers);
        for (const insight of applicableInsights) {
          await this.applyInsightToOtherEntities(insight, contact.id!);
        }
      }

      logger.info(
        `[RelationshipManager] Learning update complete. Generated ${newInsights.length} new insights`
      );

      // Emit learning completion event
      if (this.eventBridge) {
        await this.eventBridge.emit<InteractionEvent>({
          type: RolodexEventType.PATTERN_DETECTED,
          timestamp: Date.now(),
          entityId: this.runtime.agentId,
          interactionType: 'learning_update_completed',
          pattern: {
            type: 'learning_summary',
            confidence: 1.0,
            evidence: [
              `Generated ${newInsights.length} new insights`,
              `Updated insights for ${contacts.length} contacts`,
            ],
          },
          metadata: {
            totalInsights: newInsights.length,
            applicableInsights: newInsights.filter((i) => i.applicableToOthers).length,
            insightTypes: [...new Set(newInsights.map((i) => i.insightType))],
            source: 'autonomous_learning',
          },
        });
      }
    } catch (error) {
      logger.error('[RelationshipManager] Error during learning update:', error);
    }
  }

  private async extractLearningInsights(entityId: UUID): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    // Get interaction history
    const messages = await this.runtime.getMemories({
      tableName: 'messages',
      entityId,
      count: 200,
    });

    if (messages.length < 20) {
      return insights;
    } // Need sufficient data

    // Learn communication preferences
    const commInsight = this.learnCommunicationPreferences(entityId, messages);
    if (commInsight) {
      insights.push(commInsight);
    }

    // Learn behavioral patterns
    const behaviorInsight = this.learnBehavioralPatterns(entityId, messages);
    if (behaviorInsight) {
      insights.push(behaviorInsight);
    }

    // Learn trust factors
    const trustInsight = await this.learnTrustFactors(entityId);
    if (trustInsight) {
      insights.push(trustInsight);
    }

    return insights;
  }

  private learnCommunicationPreferences(
    entityId: UUID,
    messages: Memory[]
  ): LearningInsight | null {
    // Analyze message timing patterns
    const timings = messages
      .filter((m) => m.createdAt)
      .map((m) => new Date(m.createdAt!).getHours());

    if (timings.length < 10) {
      return null;
    }

    // Find most common communication hours
    const hourCounts = timings.reduce(
      (acc, hour) => {
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    const mostActiveHour = Object.keys(hourCounts).reduce((a, b) =>
      hourCounts[parseInt(a, 10)] > hourCounts[parseInt(b, 10)] ? a : b
    );

    const peakActivity = hourCounts[parseInt(mostActiveHour, 10)];
    const confidence = Math.min((peakActivity / timings.length) * 3, 1); // Higher if concentrated

    if (confidence < this.config.learningConfidenceThreshold) {
      return null;
    }

    return {
      entityId,
      insightType: 'communication_optimal',
      insight: `Most active during hour ${mostActiveHour}:00-${parseInt(mostActiveHour, 10) + 1}:00`,
      evidence: [
        `${peakActivity} messages during peak hour`,
        `${timings.length} total messages analyzed`,
        `Peak activity represents ${((peakActivity / timings.length) * 100).toFixed(1)}% of communication`,
      ],
      confidence,
      applicableToOthers: false,
      lastUpdated: new Date(),
    };
  }

  private learnBehavioralPatterns(entityId: UUID, messages: Memory[]): LearningInsight | null {
    // Analyze message length patterns to understand communication style
    const lengths = messages.map((m) => m.content.text?.length || 0).filter((l) => l > 0);

    if (lengths.length < 15) {
      return null;
    }

    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const shortMessages = lengths.filter((l) => l < 50).length;
    const longMessages = lengths.filter((l) => l > 200).length;

    let _communicationStyle = 'balanced';
    let insight = '';
    const evidence: string[] = [];

    if (shortMessages / lengths.length > 0.7) {
      _communicationStyle = 'concise';
      insight = 'Prefers brief, concise communication';
      evidence.push(
        `${((shortMessages / lengths.length) * 100).toFixed(1)}% of messages are under 50 characters`
      );
    } else if (longMessages / lengths.length > 0.3) {
      _communicationStyle = 'detailed';
      insight = 'Prefers detailed, thorough communication';
      evidence.push(
        `${((longMessages / lengths.length) * 100).toFixed(1)}% of messages are over 200 characters`
      );
    } else {
      insight = 'Uses balanced communication style';
      evidence.push(`Average message length: ${avgLength.toFixed(0)} characters`);
    }

    evidence.push(`Analyzed ${lengths.length} messages`);

    return {
      entityId,
      insightType: 'behavior_pattern',
      insight,
      evidence,
      confidence: 0.8,
      applicableToOthers: true, // Communication style insights can be applied to similar entities
      lastUpdated: new Date(),
    };
  }

  private async learnTrustFactors(entityId: UUID): Promise<LearningInsight | null> {
    if (!this.rolodexService) {
      return null;
    }

    const trustScore = await this.rolodexService.getTrustScore(entityId);
    const trustEval = {
      trustScore: trustScore?.score || 50,
      allowed: true,
      reasoning: 'Learning evaluation',
    };

    if (trustEval.trustScore > 70) {
      return {
        entityId,
        insightType: 'trust_factor',
        insight: 'High trust entity with consistent positive interactions',
        evidence: [
          `Trust score: ${trustEval.trustScore}`,
          'No active risk factors',
          'Consistent positive interaction history',
        ],
        confidence: 0.9,
        applicableToOthers: false,
        lastUpdated: new Date(),
      };
    }

    return null;
  }

  private mergeLearningInsights(
    existing: LearningInsight[],
    newInsights: LearningInsight[]
  ): LearningInsight[] {
    const merged = [...existing];

    for (const newInsight of newInsights) {
      const existingIndex = merged.findIndex(
        (e) => e.insightType === newInsight.insightType && e.insight === newInsight.insight
      );

      if (existingIndex >= 0) {
        // Update existing insight with new evidence
        merged[existingIndex] = {
          ...merged[existingIndex],
          evidence: [...new Set([...merged[existingIndex].evidence, ...newInsight.evidence])],
          confidence: Math.max(merged[existingIndex].confidence, newInsight.confidence),
          lastUpdated: newInsight.lastUpdated,
        };
      } else {
        merged.push(newInsight);
      }
    }

    // Keep only recent insights
    while (merged.length > this.config.maxLearningInsightsPerEntity) {
      merged.shift();
    }

    return merged;
  }

  private async applyInsightToOtherEntities(
    insight: LearningInsight,
    originEntityId: UUID
  ): Promise<void> {
    if (!this.rolodexService) {
      return;
    }

    // Find entities with similar characteristics
    const contacts = await this.rolodexService.searchEntities('', 1000);
    const similarEntities = contacts.filter(
      (c) => c.id !== originEntityId && this.areEntitiesSimilar(c.id!, originEntityId, insight)
    );

    for (const similarEntity of similarEntities.slice(0, 5)) {
      // Apply to max 5 similar entities
      const existingInsights = this.learningInsights.get(similarEntity.id!) || [];

      // Create derived insight
      const derivedInsight: LearningInsight = {
        ...insight,
        entityId: similarEntity.id!,
        insight: `${insight.insight} (derived from similar entity)`,
        evidence: [
          ...insight.evidence,
          `Derived from entity ${originEntityId}`,
          'Applied based on entity similarity',
        ],
        confidence: Math.max(0.3, insight.confidence * 0.7), // Reduced confidence for derived insights
        applicableToOthers: false, // Prevent recursive application
        lastUpdated: new Date(),
      };

      const mergedInsights = this.mergeLearningInsights(existingInsights, [derivedInsight]);
      this.learningInsights.set(similarEntity.id!, mergedInsights);
    }
  }

  private areEntitiesSimilar(entityId1: UUID, entityId2: UUID, insight: LearningInsight): boolean {
    // Simple similarity check - could be enhanced with more sophisticated logic
    if (insight.insightType === 'behavior_pattern') {
      // Check if entities have similar communication patterns
      const pattern1 = this.engagementPatterns.get(entityId1);
      const pattern2 = this.engagementPatterns.get(entityId2);

      if (pattern1 && pattern2) {
        // Simple similarity based on message frequency
        const freq1 = pattern1.messageFrequency || 0;
        const freq2 = pattern2.messageFrequency || 0;
        const similarity = 1 - Math.abs(freq1 - freq2) / Math.max(freq1, freq2, 1);
        return similarity > 0.7;
      }
    }

    return false; // Default to not similar
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  async getEntityInsights(entityId: UUID): Promise<{
    health: RelationshipHealth | null;
    patterns: PatternAnalysis;
    decisions: AutonomousDecision[];
    learningInsights: LearningInsight[];
  }> {
    // Get current health
    const relationships = await this.runtime.getRelationships({ entityId });
    const health =
      relationships.length > 0
        ? await this.evaluateRelationshipHealth(entityId, relationships[0])
        : null;

    // Get patterns
    const patterns = await this.analyzeEntityPatterns(entityId);

    // Get decision history
    const decisions = this.decisionHistory.get(entityId) || [];

    // Get learning insights
    const learningInsights = this.learningInsights.get(entityId) || [];

    return { health, patterns, decisions, learningInsights };
  }

  async getSystemStatus(): Promise<{
    isActive: boolean;
    totalEntitiesTracked: number;
    totalDecisionsMade: number;
    totalInsightsLearned: number;
    averageHealthScore: number;
    config: typeof RelationshipManager.prototype.config;
  }> {
    const totalEntitiesTracked = this.decisionHistory.size;
    const totalDecisionsMade = Array.from(this.decisionHistory.values()).reduce(
      (sum, decisions) => sum + decisions.length,
      0
    );
    const totalInsightsLearned = Array.from(this.learningInsights.values()).reduce(
      (sum, insights) => sum + insights.length,
      0
    );

    // Calculate average health score (simplified)
    let totalHealthScore = 0;
    let healthCount = 0;

    if (this.rolodexService) {
      const contacts = await this.rolodexService.searchEntities('', 1000);
      for (const contact of contacts.slice(0, 20)) {
        // Sample for performance
        const relationships = await this.runtime.getRelationships({ entityId: contact.id! });
        if (relationships.length > 0) {
          const health = await this.evaluateRelationshipHealth(contact.id!, relationships[0]);
          totalHealthScore += health.healthScore;
          healthCount++;
        }
      }
    }

    const averageHealthScore = healthCount > 0 ? Math.round(totalHealthScore / healthCount) : 0;

    return {
      isActive: this.isActive,
      totalEntitiesTracked,
      totalDecisionsMade,
      totalInsightsLearned,
      averageHealthScore,
      config: this.config,
    };
  }
}
