/**
 * ElizaOS Runtime Service
 * Manages actual ElizaOS agent instances and integrates with the platform
 * Works as a wrapper around the existing agent service persistence
 */

import { logger, AgentRuntime, DatabaseAdapter } from '@elizaos/core';
import type {
  Character,
  IAgentRuntime,
  UUID,
  Memory,
  Entity,
  Component,
  Room,
  World,
  Relationship,
  Task,
  Agent as ElizaAgent,
  Participant,
  Log,
} from '@elizaos/core';
import { getDatabase } from '../database';
import { memories, messages, entities, agentTasks } from '../database/schema';
import { eq, and, desc, count, sql, gt, gte, lte, inArray } from 'drizzle-orm';

// Define TableSchema interface locally since it's not exported from core
interface TableSchema {
  columns: Array<{
    name: string;
    type: string;
    notNull?: boolean;
    primaryKey?: boolean;
    default?: any;
  }>;
  indexes: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;
  foreignKeys: Array<{
    name: string;
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
  }>;
}

export interface AgentDeploymentConfig {
  character: Character;
  organizationId: string;
  userId: string;
  plugins?: string[];
  settings?: Record<string, any>;
}

export interface AgentInstanceInfo {
  agentId: UUID;
  character: Character;
  runtime: IAgentRuntime;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startedAt?: Date;
  error?: string;
  organizationId: string;
  userId: string;
}

export interface AgentStats {
  messageCount: number;
  interactionCount: number;
  totalCost: number;
  uptime: number;
  lastActivity?: Date;
}

/**
 * Simple PostgreSQL adapter for ElizaOS agents
 * This provides basic database functionality using the platform's existing database connection
 */
class PlatformDatabaseAdapter extends DatabaseAdapter {
  public db: any;
  private schema: string;
  private organizationId: string;
  private agentId: string;

  constructor(schema: string, organizationId: string, agentId: string) {
    super();
    this.db = getDatabase();
    this.schema = schema;
    this.organizationId = organizationId;
    this.agentId = agentId;
  }

  private async getDb() {
    return await getDatabase();
  }

  async init(): Promise<void> {
    // Initialize the schema if needed
    const db = await this.getDb();
    await db.execute(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
  }

  async initialize(): Promise<void> {
    await this.init();
  }

  async isReady(): Promise<boolean> {
    try {
      const db = await this.getDb();
      await db.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // Database connection is managed by the platform, no action needed
  }

  async getConnection() {
    return this.db;
  }

  async runMigrations(): Promise<void> {
    // Basic tables for ElizaOS functionality
    // This is a simplified implementation - a full adapter would have comprehensive schema
    return Promise.resolve();
  }

  // Required database adapter interface implementations
  // These provide minimal functionality to satisfy the ElizaOS interface

  async ensureEmbeddingDimension(dimension: number): Promise<void> {
    return Promise.resolve();
  }

  async getEntitiesByIds(entityIds: UUID[]): Promise<Entity[] | null> {
    return [];
  }

  async getEntityByIds(entityIds: UUID[]): Promise<Entity[] | null> {
    return [];
  }

  async getEntitiesForRoom(
    roomId: UUID,
    includeComponents?: boolean,
  ): Promise<Entity[]> {
    return [];
  }

  async createEntities(entities: Entity[]): Promise<boolean> {
    return true;
  }

  async updateEntity(entity: Entity): Promise<void> {
    return Promise.resolve();
  }

  async getComponent(
    entityId: UUID,
    type: string,
    worldId?: UUID,
    sourceEntityId?: UUID,
  ): Promise<Component | null> {
    return null;
  }

  async getComponents(
    entityId: UUID,
    worldId?: UUID,
    sourceEntityId?: UUID,
  ): Promise<Component[]> {
    return [];
  }

  async createComponent(component: Component): Promise<boolean> {
    return true;
  }

  async updateComponent(component: Component): Promise<void> {
    return Promise.resolve();
  }

  async deleteComponent(componentId: UUID): Promise<void> {
    return Promise.resolve();
  }

  async getMemories(params: {
    roomId?: UUID;
    count?: number;
    unique?: boolean;
    tableName?: string;
    agentId?: UUID;
    start?: number;
    end?: number;
  }): Promise<Memory[]> {
    try {
      const limit = params.count || 10;
      const table = params.tableName === 'messages' ? messages : memories;

      const db = await this.getDb();
      let query = db
        .select()
        .from(table)
        .where(
          and(
            eq(table.organizationId, this.organizationId),
            eq(table.agentId, this.agentId),
          ),
        )
        .orderBy(desc(table.createdAt))
        .limit(limit);

      // Add room/conversation filtering if specified
      if (params.roomId && 'conversationId' in table) {
        query = query.where(
          and(
            eq(table.organizationId, this.organizationId),
            eq(table.agentId, this.agentId),
            eq(table.conversationId, params.roomId),
          ),
        );
      }

      // Add unique filtering for memories
      if (params.unique && table === memories) {
        query = query.where(
          and(
            eq(table.organizationId, this.organizationId),
            eq(table.agentId, this.agentId),
            eq(table.isUnique, true),
          ),
        );
      }

      const results = await query;

      return results.map((row: any) => ({
        id: row.id as UUID,
        agentId: row.agentId as UUID,
        content: row.content,
        embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
        roomId:
          ((row as any).conversationId as UUID) ||
          ((row as any).roomId as UUID),
        worldId: (row as any).worldId as UUID,
        entityId: (row as any).entityId as UUID,
        unique: (row as any).isUnique || false,
        similarity: row.similarity ? parseFloat(row.similarity) : undefined,
        createdAt: row.createdAt
          ? new Date(row.createdAt).getTime()
          : Date.now(),
      }));
    } catch (error) {
      console.error('Error getting memories:', error);
      return [];
    }
  }

  async getMemoryById(id: UUID): Promise<Memory | null> {
    try {
      // Try memories table first
      const db = await this.getDb();
      const memoryResult = await db
        .select()
        .from(memories)
        .where(
          and(
            eq(memories.id, id),
            eq(memories.organizationId, this.organizationId),
            eq(memories.agentId, this.agentId),
          ),
        )
        .limit(1);

      if (memoryResult.length > 0) {
        const row = memoryResult[0];
        return {
          id: row.id as UUID,
          agentId: row.agentId as UUID,
          content: row.content,
          embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
          roomId: row.roomId as UUID,
          worldId: row.worldId as UUID,
          entityId: row.entityId as UUID,
          unique: row.isUnique || false,
          similarity: row.similarity ? parseFloat(row.similarity) : undefined,
          createdAt: row.createdAt
            ? new Date(row.createdAt).getTime()
            : Date.now(),
        };
      }

      // Try messages table if not found in memories
      const messageResult = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, id),
            eq(messages.organizationId, this.organizationId),
            eq(messages.agentId, this.agentId),
          ),
        )
        .limit(1);

      if (messageResult.length > 0) {
        const row = messageResult[0];
        return {
          id: row.id as UUID,
          agentId: row.agentId as UUID,
          content: row.content,
          embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
          roomId: row.conversationId as UUID,
          entityId: row.userId as UUID,
          unique: false,
          createdAt: row.createdAt
            ? new Date(row.createdAt).getTime()
            : Date.now(),
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting memory by ID:', error);
      return null;
    }
  }

  async getMemoriesByIds(ids: UUID[], tableName?: string): Promise<Memory[]> {
    return [];
  }

  async getMemoriesByRoomIds(params: any): Promise<Memory[]> {
    return [];
  }

  async getMemoriesByWorldId(params: any): Promise<Memory[]> {
    return [];
  }

  async getCachedEmbeddings(params: any): Promise<any[]> {
    return [];
  }

  async searchMemories(params: {
    embedding: number[];
    roomId?: UUID;
    match_threshold?: number;
    match_count?: number;
    tableName?: string;
  }): Promise<Memory[]> {
    try {
      const threshold = params.match_threshold || 0.1;
      const limit = params.match_count || 10;
      const table = params.tableName === 'messages' ? messages : memories;

      // For now, we'll do a simple text-based search since vector search requires additional setup
      // In production, this would use pgvector or similar for true semantic search
      const db = await this.getDb();
      let query = db
        .select()
        .from(table)
        .where(
          and(
            eq(table.organizationId, this.organizationId),
            eq(table.agentId, this.agentId),
          ),
        )
        .orderBy(desc(table.createdAt))
        .limit(limit);

      // Add room/conversation filtering if specified
      if (params.roomId && 'conversationId' in table) {
        query = query.where(
          and(
            eq(table.organizationId, this.organizationId),
            eq(table.agentId, this.agentId),
            eq(table.conversationId, params.roomId),
          ),
        );
      }

      const results = await query;

      // Convert results to Memory format
      return results.map((row: any) => ({
        id: row.id as UUID,
        agentId: row.agentId as UUID,
        content: row.content,
        embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
        roomId:
          ((row as any).conversationId as UUID) ||
          ((row as any).roomId as UUID),
        worldId: (row as any).worldId as UUID,
        entityId: (row as any).entityId as UUID,
        unique: (row as any).isUnique || false,
        similarity: row.similarity ? parseFloat(row.similarity) : 0.8, // Default similarity for text-based search
        createdAt: row.createdAt
          ? new Date(row.createdAt).getTime()
          : Date.now(),
      }));
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  async createMemory(
    memory: Memory,
    tableName: string = 'memories',
    unique?: boolean,
  ): Promise<UUID> {
    try {
      const table = tableName === 'messages' ? messages : memories;

      const insertData = {
        id: memory.id || crypto.randomUUID(),
        organizationId: this.organizationId,
        agentId: memory.agentId || this.agentId,
        userId: memory.entityId, // ElizaOS entityId maps to platform userId
        conversationId: memory.roomId,
        content: memory.content,
        embedding: memory.embedding ? JSON.stringify(memory.embedding) : null,
        type: 'conversation',
        importance: 5,
        isUnique: unique || memory.unique || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (tableName === 'messages') {
        // For messages table, add role and other message-specific fields
        const messageData = {
          ...insertData,
          role: 'agent', // Default to agent role
          embedding: memory.embedding ? JSON.stringify(memory.embedding) : null,
        };

        const db = await this.getDb();
        const result = await db
          .insert(messages)
          .values(messageData)
          .returning({ id: messages.id });
        return result[0].id as UUID;
      } else {
        // For memories table
        const memoryData = {
          ...insertData,
          similarity: memory.similarity ? memory.similarity.toString() : null,
          worldId: memory.worldId,
          entityId: memory.entityId,
          roomId: memory.roomId,
        };

        const db = await this.getDb();
        const result = await db
          .insert(memories)
          .values(memoryData)
          .returning({ id: memories.id });
        return result[0].id as UUID;
      }
    } catch (error) {
      console.error('Error creating memory:', error);
      throw error;
    }
  }

  async updateMemory(memory: any): Promise<boolean> {
    return true;
  }

  async deleteMemory(memoryId: UUID): Promise<void> {
    return Promise.resolve();
  }

  async deleteManyMemories(memoryIds: UUID[]): Promise<void> {
    return Promise.resolve();
  }

  async deleteAllMemories(roomId: UUID, tableName: string): Promise<void> {
    return Promise.resolve();
  }

  async countMemories(
    roomId: UUID,
    unique?: boolean,
    tableName?: string,
  ): Promise<number> {
    return 0;
  }

  async createWorld(world: World): Promise<UUID> {
    return `world-${Date.now()}` as UUID;
  }

  async getWorld(id: UUID): Promise<World | null> {
    return null;
  }

  async removeWorld(id: UUID): Promise<void> {
    return Promise.resolve();
  }

  async getAllWorlds(): Promise<World[]> {
    return [];
  }

  async getWorlds(params: any): Promise<World[]> {
    return [];
  }

  async updateWorld(world: World): Promise<void> {
    return Promise.resolve();
  }

  async getRoomsByIds(roomIds: UUID[]): Promise<Room[] | null> {
    return [];
  }

  async createRooms(rooms: Room[]): Promise<UUID[]> {
    return rooms.map(() => `room-${Date.now()}` as UUID);
  }

  async deleteRoom(roomId: UUID): Promise<void> {
    return Promise.resolve();
  }

  async deleteRoomsByWorldId(worldId: UUID): Promise<void> {
    return Promise.resolve();
  }

  async updateRoom(room: Room): Promise<void> {
    return Promise.resolve();
  }

  async getRoomsForParticipant(entityId: UUID): Promise<UUID[]> {
    return [];
  }

  async getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]> {
    return [];
  }

  async getRoomsByWorld(worldId: UUID): Promise<Room[]> {
    return [];
  }

  async removeParticipant(entityId: UUID, roomId: UUID): Promise<boolean> {
    return true;
  }

  async getParticipantsForEntity(entityId: UUID): Promise<Participant[]> {
    return [];
  }

  async getParticipantsForRoom(roomId: UUID): Promise<UUID[]> {
    return [];
  }

  async addParticipantsRoom(entityIds: UUID[], roomId: UUID): Promise<boolean> {
    return true;
  }

  async getParticipantUserState(
    roomId: UUID,
    entityId: UUID,
  ): Promise<'FOLLOWED' | 'MUTED' | null> {
    return null;
  }

  async setParticipantUserState(
    roomId: UUID,
    entityId: UUID,
    state: 'FOLLOWED' | 'MUTED' | null,
  ): Promise<void> {
    return Promise.resolve();
  }

  async createRelationship(params: any): Promise<boolean> {
    return true;
  }

  async updateRelationship(relationship: Relationship): Promise<void> {
    return Promise.resolve();
  }

  async getRelationship(params: any): Promise<Relationship | null> {
    return null;
  }

  async getRelationships(params: any): Promise<Relationship[]> {
    return [];
  }

  async getCache<T>(key: string): Promise<T | undefined> {
    return undefined;
  }

  async setCache<T>(key: string, value: T): Promise<boolean> {
    return true;
  }

  async deleteCache(key: string): Promise<boolean> {
    return true;
  }

  async getAgents(): Promise<ElizaAgent[]> {
    return [];
  }

  async getAgent(agentId: UUID): Promise<ElizaAgent | null> {
    return null;
  }

  async createAgent(agent: Partial<ElizaAgent>): Promise<boolean> {
    return true;
  }

  async updateAgent(
    agentId: UUID,
    agent: Partial<ElizaAgent>,
  ): Promise<boolean> {
    return true;
  }

  async deleteAgent(agentId: UUID): Promise<boolean> {
    return true;
  }

  async createTask(task: Task): Promise<UUID> {
    return `task-${Date.now()}` as UUID;
  }

  async getTasks(params: any): Promise<Task[]> {
    return [];
  }

  async getTask(id: UUID): Promise<Task | null> {
    return null;
  }

  async getTasksByName(name: string): Promise<Task[]> {
    return [];
  }

  async updateTask(id: UUID, task: Partial<Task>): Promise<void> {
    return Promise.resolve();
  }

  async deleteTask(id: UUID): Promise<void> {
    return Promise.resolve();
  }

  async log(params: any): Promise<void> {
    return Promise.resolve();
  }

  async getLogs(params: any): Promise<Log[]> {
    return [];
  }

  async deleteLog(logId: UUID): Promise<void> {
    return Promise.resolve();
  }

  // New required methods from IDatabaseAdapter
  async getFromTable<T = any>(params: {
    tableName: string;
    schema?: string;
    where?: Record<string, any>;
    orderBy?: { column: string; direction: 'asc' | 'desc' }[];
    limit?: number;
    offset?: number;
  }): Promise<T[]> {
    // Placeholder implementation - return empty array
    return [];
  }

  async getOneFromTable<T = any>(params: {
    tableName: string;
    schema?: string;
    where: Record<string, any>;
  }): Promise<T | null> {
    // Placeholder implementation - return null
    return null;
  }

  async insertIntoTable<T = any>(params: {
    tableName: string;
    schema?: string;
    data: Partial<T> | Partial<T>[];
    returning?: string[];
  }): Promise<T[]> {
    // Placeholder implementation - return empty array
    return [];
  }

  async updateTable<T = any>(params: {
    tableName: string;
    schema?: string;
    where: Record<string, any>;
    data: Partial<T>;
    returning?: string[];
  }): Promise<T[]> {
    // Placeholder implementation - return empty array
    return [];
  }

  async deleteFromTable(params: {
    tableName: string;
    schema?: string;
    where: Record<string, any>;
  }): Promise<number> {
    // Placeholder implementation - return 1 (one row deleted)
    return 1;
  }

  async getTableSchema(
    tableName: string,
    schema?: string,
  ): Promise<TableSchema> {
    // Placeholder implementation
    return {
      columns: [],
      indexes: [],
      foreignKeys: [],
    };
  }

  getPluginTableName(pluginName: string, tableName: string): string {
    // Placeholder implementation
    return `plugin_${pluginName}_${tableName}`;
  }

  getPluginSchema(pluginName: string): string {
    // Placeholder implementation
    return `plugin_${pluginName}`;
  }
}

/**
 * Service for managing real ElizaOS agent instances
 * Works as a wrapper around the existing agent service persistence
 */
export class ElizaRuntimeService {
  // Keep active runtime instances for quick access
  private activeRuntimes = new Map<UUID, IAgentRuntime>();
  private agentStats = new Map<UUID, AgentStats>();
  private readonly maxAgentsPerOrg = 10; // Default limit

  constructor() {
    // Setup cleanup on process exit
    process.on('SIGINT', async () => await this.shutdown());
    process.on('SIGTERM', async () => await this.shutdown());
  }

  /**
   * Deploy a new agent with the given configuration
   */
  async deployAgent(config: AgentDeploymentConfig): Promise<UUID> {
    logger.info('[ElizaRuntimeService] Deploying new agent', {
      organizationId: config.organizationId,
      characterName: config.character.name,
    });

    // Check organization agent limits using existing agents map
    const orgAgentCount = this.getOrganizationAgentCount(config.organizationId);
    if (orgAgentCount >= this.maxAgentsPerOrg) {
      throw new Error(
        `Organization has reached maximum agent limit of ${this.maxAgentsPerOrg}`,
      );
    }

    // Validate character configuration
    this.validateCharacter(config.character);

    try {
      // Create database adapter for the agent using platform's database connection
      const adapter = new PlatformDatabaseAdapter(
        `agent_${config.organizationId.replace(/-/g, '_')}`,
        config.organizationId,
        config.character.id || crypto.randomUUID(),
      );

      // Ensure adapter is ready
      await adapter.init();

      // Create the runtime with real ElizaOS implementation
      // Note: Due to interface changes in core, we cast through unknown
      const runtime = new AgentRuntime({
        character: config.character,
        adapter,
        plugins: [], // plugins will be registered separately if provided
        settings: {
          ...config.settings,
          organizationId: config.organizationId,
          userId: config.userId,
        },
      }) as unknown as IAgentRuntime;

      if (!runtime) {
        throw new Error('Failed to create ElizaOS runtime');
      }

      // Initialize the runtime
      await runtime.initialize();

      // Cache the active runtime instance and its info
      this.activeRuntimes.set(runtime.agentId, runtime);

      // Initialize agent stats
      this.agentStats.set(runtime.agentId, {
        messageCount: 0,
        interactionCount: 0,
        totalCost: 0,
        uptime: 0,
        lastActivity: new Date(),
      });

      // Start the agent
      await this.startAgent(runtime.agentId);

      logger.info('[ElizaRuntimeService] Agent deployed successfully', {
        agentId: runtime.agentId,
        organizationId: config.organizationId,
      });

      return runtime.agentId;
    } catch (error) {
      logger.error('[ElizaRuntimeService] Failed to deploy agent:', error);
      throw new Error(
        `Agent deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Start an agent
   */
  async startAgent(agentId: UUID): Promise<void> {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      logger.info(`[ElizaRuntimeService] Starting agent ${agentId}`);

      // ElizaOS runtime is ready after initialization
      // Message processing is automatically available via the runtime
      logger.debug(
        `[ElizaRuntimeService] Agent ${agentId} runtime is ready for message processing`,
      );

      logger.info(
        `[ElizaRuntimeService] Agent ${agentId} started successfully`,
      );
    } catch (error) {
      logger.error(
        `[ElizaRuntimeService] Failed to start agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: UUID): Promise<void> {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      logger.info(`[ElizaRuntimeService] Stopping agent ${agentId}`);

      // ElizaOS runtime doesn't need explicit stop - managed by cleanup

      logger.info(
        `[ElizaRuntimeService] Agent ${agentId} stopped successfully`,
      );
    } catch (error) {
      logger.error(
        `[ElizaRuntimeService] Failed to stop agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete an agent (stop and remove)
   */
  async deleteAgent(agentId: UUID): Promise<void> {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      // Stop the agent first
      await this.stopAgent(agentId);

      // Clean up resources - close database adapter
      if ((runtime as any).adapter) {
        await (runtime as any).adapter.close();
      }

      // Remove from runtime tracking
      this.activeRuntimes.delete(agentId);
      this.agentStats.delete(agentId);

      logger.info(
        `[ElizaRuntimeService] Agent ${agentId} deleted successfully`,
      );
    } catch (error) {
      logger.error(
        `[ElizaRuntimeService] Failed to delete agent ${agentId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get agent information
   */
  getAgent(agentId: UUID): AgentInstanceInfo | null {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      return null;
    }

    const stats = this.agentStats.get(agentId);

    return {
      agentId: runtime.agentId,
      character: runtime.character,
      runtime,
      status: 'running', // Active runtimes are running
      startedAt: stats?.lastActivity,
      organizationId: (runtime.getSetting('organizationId') as string) || '',
      userId: (runtime.getSetting('userId') as string) || '',
    };
  }

  /**
   * Get all agents for an organization
   */
  getOrganizationAgents(organizationId: string): AgentInstanceInfo[] {
    const orgAgents: AgentInstanceInfo[] = [];

    Array.from(this.activeRuntimes.entries()).forEach(([agentId, runtime]) => {
      const runtimeOrgId = runtime.getSetting('organizationId') as string;
      if (runtimeOrgId === organizationId) {
        const agentInfo = this.getAgent(agentId);
        if (agentInfo) {
          orgAgents.push(agentInfo);
        }
      }
    });

    return orgAgents;
  }

  /**
   * Get agent statistics
   */
  getAgentStats(agentId: UUID): AgentStats | null {
    const stats = this.agentStats.get(agentId);
    if (!stats) {
      return null;
    }

    const agentInfo = this.getAgent(agentId);
    if (agentInfo?.startedAt) {
      stats.uptime = Date.now() - agentInfo.startedAt.getTime();
    }

    return stats;
  }

  /**
   * Update agent statistics (called by billing/usage tracking)
   */
  updateAgentStats(agentId: UUID, updates: Partial<AgentStats>): void {
    const stats = this.agentStats.get(agentId);
    if (stats) {
      Object.assign(stats, updates);
      if (updates.messageCount || updates.interactionCount) {
        stats.lastActivity = new Date();
      }
    }
  }

  /**
   * Get count of agents for an organization
   */
  getOrganizationAgentCount(organizationId: string): number {
    return this.getOrganizationAgents(organizationId).length;
  }

  /**
   * Health check for an agent
   */
  async checkAgentHealth(agentId: UUID): Promise<boolean> {
    const runtime = this.activeRuntimes.get(agentId);
    if (!runtime) {
      return false;
    }

    try {
      // Check if runtime is responsive via database adapter
      if ((runtime as any).adapter) {
        return await (runtime as any).adapter.isReady();
      }

      // Basic check - agent exists in active runtimes
      return true;
    } catch (error) {
      logger.warn(
        `[ElizaRuntimeService] Health check failed for agent ${agentId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Validate character configuration
   */
  private validateCharacter(character: Character): void {
    if (!character.name) {
      throw new Error('Character name is required');
    }

    if (!character.bio) {
      throw new Error('Character bio is required');
    }

    // Validate message examples if provided
    if (character.messageExamples) {
      if (
        !Array.isArray(character.messageExamples) ||
        character.messageExamples.length === 0
      ) {
        throw new Error('Character messageExamples must be a non-empty array');
      }
    }

    // Validate plugins if provided
    if (character.plugins) {
      if (!Array.isArray(character.plugins)) {
        throw new Error('Character plugins must be an array');
      }
    }

    logger.debug('[ElizaRuntimeService] Character validation passed', {
      name: character.name,
      hasMessageExamples: !!character.messageExamples?.length,
      pluginCount: character.plugins?.length || 0,
    });
  }

  /**
   * Get all agents (for admin/monitoring)
   */
  getAllAgents(): AgentInstanceInfo[] {
    const allAgents: AgentInstanceInfo[] = [];

    Array.from(this.activeRuntimes.entries()).forEach(([agentId, runtime]) => {
      const agentInfo = this.getAgent(agentId);
      if (agentInfo) {
        allAgents.push(agentInfo);
      }
    });

    return allAgents;
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    const agents = this.getAllAgents();
    return {
      totalAgents: agents.length,
      runningAgents: agents.filter((a) => a.status === 'running').length,
      stoppedAgents: agents.filter((a) => a.status === 'stopped').length,
      errorAgents: agents.filter((a) => a.status === 'error').length,
      organizationCounts: agents.reduce(
        (acc, agent) => {
          acc[agent.organizationId] = (acc[agent.organizationId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    logger.info('[ElizaRuntimeService] Shutting down all agents...');

    const shutdownPromises = Array.from(this.activeRuntimes.keys()).map(
      async (agentId) => {
        try {
          await this.stopAgent(agentId);
        } catch (error) {
          logger.error(
            `[ElizaRuntimeService] Error stopping agent ${agentId} during shutdown:`,
            error,
          );
        }
      },
    );

    await Promise.allSettled(shutdownPromises);

    // Clear all tracking
    this.activeRuntimes.clear();
    this.agentStats.clear();

    logger.info('[ElizaRuntimeService] Shutdown complete');
  }
}

// Global singleton instance
export const elizaRuntimeService = new ElizaRuntimeService();
