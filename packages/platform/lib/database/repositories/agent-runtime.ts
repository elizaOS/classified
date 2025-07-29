/**
 * Database repository for agent runtime state management
 * Replaces in-memory storage with persistent database operations
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { getDatabase } from '../index';
import { agents } from '../schema';
import type { UUID } from '@elizaos/core';

export interface AgentRuntimeRecord {
  id: UUID;
  organizationId: string;
  runtimeAgentId: string;
  deploymentStatus: string;
  deploymentUrl?: string;
  deploymentError?: string;
  lastDeployedAt?: Date;
  character: Record<string, any>;
  plugins: string[];
  runtimeConfig: Record<string, any>;
  totalInteractions: number;
  totalCost: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentStatsRecord {
  agentId: UUID;
  messageCount: number;
  interactionCount: number;
  totalCost: number;
  uptime: number;
  lastActivity?: Date;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startedAt?: Date;
  error?: string;
}

/**
 * Repository for managing agent runtime state in the database
 */
export class AgentRuntimeRepository {
  private async getDb() {
    return await getDatabase();
  }

  /**
   * Store agent runtime information in database
   */
  async createAgentRuntime(data: {
    id: UUID;
    organizationId: string;
    runtimeAgentId: string;
    character: Record<string, any>;
    plugins: string[];
    runtimeConfig: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await (
      await this.getDb()
    )
      .insert(agents)
      .values({
        id: data.id,
        organizationId: data.organizationId,
        runtimeAgentId: data.runtimeAgentId,
        name: data.character.name || 'Unknown Agent',
        description: data.character.bio || 'Agent created via runtime service',
        slug: `runtime-${data.runtimeAgentId}`,
        character: data.character,
        plugins: data.plugins,
        runtimeConfig: data.runtimeConfig,
        deploymentStatus: 'deployed',
        deploymentUrl: null,
        deploymentError: null,
        lastDeployedAt: new Date(),
        visibility: 'private',
        isPublished: false,
        totalInteractions: 0,
        totalCost: '0',
        metadata: data.metadata || {},
        createdByUserId: sql`(SELECT id FROM users WHERE organization_id = ${data.organizationId} LIMIT 1)`,
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          runtimeAgentId: data.runtimeAgentId,
          character: data.character,
          plugins: data.plugins,
          runtimeConfig: data.runtimeConfig,
          deploymentStatus: 'deployed',
          lastDeployedAt: new Date(),
          updatedAt: new Date(),
          metadata: data.metadata || {},
        },
      });
  }

  /**
   * Get agent runtime information by runtime agent ID
   */
  async getAgentByRuntimeId(
    runtimeAgentId: string,
  ): Promise<AgentRuntimeRecord | null> {
    const [agent] = await (await this.getDb())
      .select()
      .from(agents)
      .where(eq(agents.runtimeAgentId, runtimeAgentId))
      .limit(1);

    return agent || null;
  }

  /**
   * Get all agents for an organization
   */
  async getOrganizationAgents(
    organizationId: string,
  ): Promise<AgentRuntimeRecord[]> {
    return await (
      await this.getDb()
    )
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.organizationId, organizationId),
          eq(agents.deploymentStatus, 'deployed'),
        ),
      )
      .orderBy(desc(agents.lastDeployedAt));
  }

  /**
   * Update agent deployment status
   */
  async updateDeploymentStatus(
    runtimeAgentId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await (
      await this.getDb()
    )
      .update(agents)
      .set({
        deploymentStatus: status,
        deploymentError: error || null,
        updatedAt: new Date(),
      })
      .where(eq(agents.runtimeAgentId, runtimeAgentId));
  }

  /**
   * Update agent statistics
   */
  async updateAgentStats(
    runtimeAgentId: string,
    stats: {
      totalInteractions?: number;
      totalCost?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    const updates: any = {
      updatedAt: new Date(),
    };

    if (stats.totalInteractions !== undefined) {
      updates.totalInteractions = stats.totalInteractions;
    }

    if (stats.totalCost !== undefined) {
      updates.totalCost = stats.totalCost;
    }

    if (stats.metadata) {
      updates.metadata = stats.metadata;
    }

    await (await this.getDb())
      .update(agents)
      .set(updates)
      .where(eq(agents.runtimeAgentId, runtimeAgentId));
  }

  /**
   * Delete agent runtime record
   */
  async deleteAgentRuntime(runtimeAgentId: string): Promise<void> {
    await (
      await this.getDb()
    )
      .update(agents)
      .set({
        deploymentStatus: 'stopped',
        deploymentError: null,
        updatedAt: new Date(),
      })
      .where(eq(agents.runtimeAgentId, runtimeAgentId));
  }

  /**
   * Get count of agents for an organization
   */
  async getOrganizationAgentCount(organizationId: string): Promise<number> {
    const [result] = await (
      await this.getDb()
    )
      .select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(
        and(
          eq(agents.organizationId, organizationId),
          eq(agents.deploymentStatus, 'deployed'),
        ),
      );

    return result?.count || 0;
  }

  /**
   * Check if agent runtime exists and is healthy
   */
  async checkAgentHealth(runtimeAgentId: string): Promise<{
    exists: boolean;
    status: string;
    lastActivity?: Date;
  }> {
    const [agent] = await (
      await this.getDb()
    )
      .select({
        deploymentStatus: agents.deploymentStatus,
        lastDeployedAt: agents.lastDeployedAt,
        updatedAt: agents.updatedAt,
      })
      .from(agents)
      .where(eq(agents.runtimeAgentId, runtimeAgentId))
      .limit(1);

    if (!agent) {
      return { exists: false, status: 'not_found' };
    }

    return {
      exists: true,
      status: agent.deploymentStatus,
      lastActivity: agent.updatedAt,
    };
  }

  /**
   * Get service statistics
   */
  async getServiceStats(organizationId?: string): Promise<{
    totalAgents: number;
    runningAgents: number;
    stoppedAgents: number;
    errorAgents: number;
    organizationCounts?: Record<string, number>;
  }> {
    const conditions = organizationId
      ? [eq(agents.organizationId, organizationId)]
      : [];

    const [stats] = await (
      await this.getDb()
    )
      .select({
        total: sql<number>`count(*)`,
        running: sql<number>`count(*) filter (where deployment_status = 'deployed')`,
        stopped: sql<number>`count(*) filter (where deployment_status = 'stopped')`,
        error: sql<number>`count(*) filter (where deployment_status = 'failed')`,
      })
      .from(agents)
      .where(and(...conditions));

    const result = {
      totalAgents: stats?.total || 0,
      runningAgents: stats?.running || 0,
      stoppedAgents: stats?.stopped || 0,
      errorAgents: stats?.error || 0,
      organizationCounts: {} as Record<string, number>,
    };

    // If not filtering by organization, get organization counts
    if (!organizationId) {
      const orgCounts = await (
        await this.getDb()
      )
        .select({
          organizationId: agents.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(agents)
        .where(eq(agents.deploymentStatus, 'deployed'))
        .groupBy(agents.organizationId);

      result.organizationCounts = orgCounts.reduce(
        (
          acc: Record<string, number>,
          { organizationId, count }: { organizationId: string; count: number },
        ) => {
          acc[organizationId] = count;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    return result;
  }
}

export const agentRuntimeRepository = new AgentRuntimeRepository();
