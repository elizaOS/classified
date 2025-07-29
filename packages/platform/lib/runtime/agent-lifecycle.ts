/**
 * Agent Lifecycle Manager
 * Handles the complete lifecycle of agent instances including deployment, monitoring, and cleanup
 */

import { logger } from '@/lib/logger';
import type { UUID } from '@elizaos/core';
import {
  elizaRuntimeService,
  type AgentInstanceInfo,
  type AgentStats,
} from './eliza-service';
import { getDatabase, agents, creditTransactions } from '../database';
import { eq, and, desc } from 'drizzle-orm';

export interface AgentLifecycleEvent {
  agentId: UUID;
  event:
    | 'deployed'
    | 'started'
    | 'stopped'
    | 'deleted'
    | 'error'
    | 'health_check';
  timestamp: Date;
  organizationId: string;
  userId: string;
  data?: any;
  error?: string;
}

export interface AgentUsageData {
  agentId: UUID;
  messageCount: number;
  interactionCount: number;
  computeTime: number;
  apiCalls: number;
  cost: number;
  period: 'hour' | 'day' | 'month';
  timestamp: Date;
}

/**
 * Manages the complete lifecycle of ElizaOS agents
 */
export class AgentLifecycleManager {
  private eventLog: AgentLifecycleEvent[] = [];
  private usageData = new Map<UUID, AgentUsageData[]>();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private usageTrackingInterval: NodeJS.Timeout | null = null;
  private db = getDatabase();

  constructor() {
    this.startHealthMonitoring();
    this.startUsageTracking();
  }

  /**
   * Get database instance
   */
  private async getDb() {
    return await this.db;
  }

  /**
   * Deploy a new agent with full lifecycle management
   */
  async deployAgent(
    organizationId: string,
    userId: string,
    character: any,
    plugins: string[] = [],
  ): Promise<UUID> {
    logger.info('[AgentLifecycle] Starting agent deployment', {
      organizationId,
      userId,
      characterName: character.name,
    });

    try {
      // Check organization limits
      await this.validateOrganizationLimits(organizationId);

      // Deploy through runtime service
      const agentId = await elizaRuntimeService.deployAgent({
        character,
        organizationId,
        userId,
        plugins,
      });

      // Update database record
      await this.updateAgentDatabase(agentId, {
        status: 'running',
        deployedAt: new Date(),
        lastActivity: new Date(),
      });

      // Log lifecycle event
      await this.logEvent({
        agentId,
        event: 'deployed',
        timestamp: new Date(),
        organizationId,
        userId,
        data: {
          characterName: character.name,
          plugins,
        },
      });

      // Initialize usage tracking
      this.initializeUsageTracking(agentId);

      logger.info('[AgentLifecycle] Agent deployment completed', {
        agentId,
        organizationId,
      });

      return agentId;
    } catch (error) {
      logger.error('[AgentLifecycle] Agent deployment failed:', error as Error);

      // Log failure event
      await this.logEvent({
        agentId: 'unknown' as UUID,
        event: 'error',
        timestamp: new Date(),
        organizationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Start an existing agent
   */
  async startAgent(agentId: UUID): Promise<void> {
    logger.info(`[AgentLifecycle] Starting agent ${agentId}`);

    const agentInfo = await elizaRuntimeService.getAgent(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      await elizaRuntimeService.startAgent(agentId);

      // Update database
      await this.updateAgentDatabase(agentId, {
        status: 'running',
        lastActivity: new Date(),
      });

      // Log event
      await this.logEvent({
        agentId,
        event: 'started',
        timestamp: new Date(),
        organizationId: agentInfo.organizationId,
        userId: agentInfo.userId,
      });

      logger.info(`[AgentLifecycle] Agent ${agentId} started successfully`);
    } catch (error) {
      await this.handleAgentError(agentId, error);
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: UUID): Promise<void> {
    logger.info(`[AgentLifecycle] Stopping agent ${agentId}`);

    const agentInfo = await elizaRuntimeService.getAgent(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      await elizaRuntimeService.stopAgent(agentId);

      // Update database
      await this.updateAgentDatabase(agentId, {
        status: 'stopped',
        lastActivity: new Date(),
      });

      // Log event
      await this.logEvent({
        agentId,
        event: 'stopped',
        timestamp: new Date(),
        organizationId: agentInfo.organizationId,
        userId: agentInfo.userId,
      });

      logger.info(`[AgentLifecycle] Agent ${agentId} stopped successfully`);
    } catch (error) {
      await this.handleAgentError(agentId, error);
      throw error;
    }
  }

  /**
   * Delete an agent completely
   */
  async deleteAgent(agentId: UUID): Promise<void> {
    logger.info(`[AgentLifecycle] Deleting agent ${agentId}`);

    const agentInfo = await elizaRuntimeService.getAgent(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      // Stop if running
      if (agentInfo.status === 'running') {
        await this.stopAgent(agentId);
      }

      // Delete through runtime service
      await elizaRuntimeService.deleteAgent(agentId);

      // Archive database record instead of deleting
      await this.updateAgentDatabase(agentId, {
        status: 'deleted',
        deletedAt: new Date(),
      });

      // Clean up usage data
      this.usageData.delete(agentId);

      // Log event
      await this.logEvent({
        agentId,
        event: 'deleted',
        timestamp: new Date(),
        organizationId: agentInfo.organizationId,
        userId: agentInfo.userId,
      });

      logger.info(`[AgentLifecycle] Agent ${agentId} deleted successfully`);
    } catch (error) {
      await this.handleAgentError(agentId, error);
      throw error;
    }
  }

  /**
   * Get comprehensive agent status
   */
  async getAgentStatus(agentId: UUID): Promise<{
    agent: AgentInstanceInfo | null;
    stats: AgentStats | null;
    recentEvents: AgentLifecycleEvent[];
    health: boolean;
    usage: AgentUsageData[];
  }> {
    const agent = await elizaRuntimeService.getAgent(agentId);
    const stats = elizaRuntimeService.getAgentStats(agentId as UUID);
    const health = await elizaRuntimeService.checkAgentHealth(agentId as UUID);
    const recentEvents = this.getRecentEvents(agentId, 10);
    const usage = this.usageData.get(agentId) || [];

    return {
      agent,
      stats,
      recentEvents,
      health,
      usage: usage.slice(-24), // Last 24 periods
    };
  }

  /**
   * Get organization's agent overview
   */
  async getOrganizationOverview(organizationId: string): Promise<{
    agents: AgentInstanceInfo[];
    totalCost: number;
    totalMessages: number;
    healthyAgents: number;
    recentEvents: AgentLifecycleEvent[];
  }> {
    const agents =
      await elizaRuntimeService.getOrganizationAgents(organizationId);

    let totalCost = 0;
    let totalMessages = 0;
    let healthyAgents = 0;

    // Calculate totals and health status
    for (const agent of agents) {
      const stats = elizaRuntimeService.getAgentStats(agent.agentId);
      if (stats) {
        totalCost += stats.totalCost;
        totalMessages += stats.messageCount;
      }

      const health = await elizaRuntimeService.checkAgentHealth(agent.agentId);
      if (health) {
        healthyAgents++;
      }
    }

    const recentEvents = this.eventLog
      .filter((event) => event.organizationId === organizationId)
      .slice(-20)
      .reverse();

    return {
      agents,
      totalCost,
      totalMessages,
      healthyAgents,
      recentEvents,
    };
  }

  /**
   * Record agent usage for billing
   */
  async recordAgentUsage(
    agentId: UUID,
    messageCount: number,
    computeTime: number,
    apiCalls: number,
    cost: number,
  ): Promise<void> {
    // Update runtime stats
    elizaRuntimeService.updateAgentStats(agentId, {
      messageCount,
      totalCost: cost,
      interactionCount: apiCalls,
    });

    // Store detailed usage data
    const usageRecord: AgentUsageData = {
      agentId,
      messageCount,
      interactionCount: apiCalls,
      computeTime,
      apiCalls,
      cost,
      period: 'hour',
      timestamp: new Date(),
    };

    if (!this.usageData.has(agentId)) {
      this.usageData.set(agentId, []);
    }
    this.usageData.get(agentId)!.push(usageRecord);

    // Keep only last 30 days of usage data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const agentUsage = this.usageData.get(agentId)!;
    this.usageData.set(
      agentId,
      agentUsage.filter((usage) => usage.timestamp > thirtyDaysAgo),
    );

    // Record in billing system if cost > 0
    if (cost > 0) {
      await this.recordBillingUsage(agentId, cost);
    }
  }

  /**
   * Start health monitoring for all agents
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const agents = elizaRuntimeService.getAllAgents();

      for (const agent of agents) {
        try {
          const isHealthy = await elizaRuntimeService.checkAgentHealth(
            agent.agentId,
          );

          if (!isHealthy && agent.status === 'running') {
            logger.warn(
              `[AgentLifecycle] Agent ${agent.agentId} health check failed`,
            );

            await this.logEvent({
              agentId: agent.agentId,
              event: 'health_check',
              timestamp: new Date(),
              organizationId: agent.organizationId,
              userId: agent.userId,
              data: { healthy: false },
            });

            // Attempt to restart unhealthy agent
            try {
              await this.restartAgent(agent.agentId);
            } catch (restartError) {
              logger.error(
                `[AgentLifecycle] Failed to restart unhealthy agent ${agent.agentId}:`,
                restartError as Error,
              );
            }
          }
        } catch (error) {
          logger.error(
            `[AgentLifecycle] Health check error for agent ${agent.agentId}:`,
            error as Error,
          );
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Start usage tracking
   */
  private startUsageTracking(): void {
    this.usageTrackingInterval = setInterval(async () => {
      const agents = elizaRuntimeService.getAllAgents();

      for (const agent of agents) {
        if (agent.status === 'running') {
          try {
            // This would be integrated with actual usage metrics
            // For now, we'll simulate some usage data
            const stats = elizaRuntimeService.getAgentStats(agent.agentId);
            if (stats) {
              await this.recordAgentUsage(
                agent.agentId,
                stats.messageCount,
                1, // computeTime (would be tracked from runtime)
                stats.interactionCount,
                0.01, // Small cost for simulation
              );
            }
          } catch (error) {
            logger.error(
              `[AgentLifecycle] Usage tracking error for agent ${agent.agentId}:`,
              error as Error,
            );
          }
        }
      }
    }, 300000); // Track every 5 minutes
  }

  /**
   * Restart an agent
   */
  private async restartAgent(agentId: UUID): Promise<void> {
    logger.info(`[AgentLifecycle] Restarting agent ${agentId}`);

    try {
      await this.stopAgent(agentId);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      await this.startAgent(agentId);

      logger.info(`[AgentLifecycle] Agent ${agentId} restarted successfully`);
    } catch (error) {
      logger.error(
        `[AgentLifecycle] Failed to restart agent ${agentId}:`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Handle agent errors
   */
  private async handleAgentError(agentId: UUID, error: any): Promise<void> {
    const agentInfo = await elizaRuntimeService.getAgent(agentId);
    if (!agentInfo) {
      return;
    }

    await this.updateAgentDatabase(agentId, {
      status: 'error',
      lastError: error instanceof Error ? error.message : String(error),
      lastActivity: new Date(),
    });

    await this.logEvent({
      agentId,
      event: 'error',
      timestamp: new Date(),
      organizationId: agentInfo.organizationId,
      userId: agentInfo.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Update agent database record
   */
  private async updateAgentDatabase(
    agentId: UUID,
    updates: any,
  ): Promise<void> {
    try {
      const db = await this.getDb();
      await db
        .update(agents)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));
    } catch (error) {
      logger.error(
        `[AgentLifecycle] Failed to update agent database record for ${agentId}:`,
        error as Error,
      );
    }
  }

  /**
   * Log lifecycle event
   */
  private async logEvent(event: AgentLifecycleEvent): Promise<void> {
    this.eventLog.push(event);

    // Keep only last 1000 events in memory
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }

    logger.debug('[AgentLifecycle] Event logged', {
      agentId: event.agentId,
      event: event.event,
      organizationId: event.organizationId,
    });
  }

  /**
   * Get recent events for an agent
   */
  private getRecentEvents(
    agentId: UUID,
    limit: number = 10,
  ): AgentLifecycleEvent[] {
    return this.eventLog
      .filter((event) => event.agentId === agentId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Initialize usage tracking for an agent
   */
  private initializeUsageTracking(agentId: UUID): void {
    if (!this.usageData.has(agentId)) {
      this.usageData.set(agentId, []);
    }
  }

  /**
   * Validate organization limits
   */
  private async validateOrganizationLimits(
    organizationId: string,
  ): Promise<void> {
    const currentCount =
      await elizaRuntimeService.getOrganizationAgentCount(organizationId);

    // This would check against the organization's subscription limits
    // For now, using a simple count check
    if (currentCount >= 10) {
      throw new Error('Organization has reached maximum agent limit');
    }
  }

  /**
   * Record billing usage
   */
  private async recordBillingUsage(agentId: UUID, cost: number): Promise<void> {
    const agentInfo = await elizaRuntimeService.getAgent(agentId as any);
    if (!agentInfo) {
      return;
    }

    try {
      const db = await this.getDb();
      await db.insert(creditTransactions).values({
        organizationId: agentInfo.organizationId,
        userId: agentInfo.userId,
        type: 'usage',
        amount: (-cost).toString(), // Convert to string for decimal field
        description: `Agent usage: ${agentInfo.character.name}`,
        balanceAfter: '0', // This would be calculated from current balance
        metadata: {
          agentId,
          service: 'agent-runtime',
          characterName: agentInfo.character.name,
        },
      });
    } catch (error) {
      logger.error(
        `[AgentLifecycle] Failed to record billing usage for agent ${agentId}:`,
        error as Error,
      );
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('[AgentLifecycle] Shutting down lifecycle manager...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.usageTrackingInterval) {
      clearInterval(this.usageTrackingInterval);
    }

    await elizaRuntimeService.shutdown();

    logger.info('[AgentLifecycle] Lifecycle manager shutdown complete');
  }
}

// Global singleton instance
export const agentLifecycleManager = new AgentLifecycleManager();
