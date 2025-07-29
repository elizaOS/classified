/**
 * Server Agent Service
 * Integrates with external ElizaOS server instances via JWT-authenticated HTTP requests
 * This provides an alternative to local agent deployment for distributed architectures
 */

import { logger } from '@/lib/logger';
import type { Character, UUID, Agent as ElizaAgent } from '@elizaos/core';
import { createEnhancedJWT, type EnhancedJWTPayload } from '../auth/shared-jwt';

export interface ServerInstance {
  id: string;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'maintenance';
  capacity: {
    current: number;
    maximum: number;
  };
  region?: string;
  metadata?: Record<string, any>;
}

export interface ServerAgentConfig {
  character: Character;
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  plugins?: string[];
  settings?: Record<string, any>;
  serverInstanceId?: string; // Specific server, or auto-select
}

export interface ServerAgentInfo {
  agentId: UUID;
  character: Character;
  status: 'creating' | 'active' | 'inactive' | 'error';
  serverInstance: ServerInstance;
  createdAt: Date;
  lastActivity?: Date;
  error?: string;
  organizationId: string;
  userId: string;
}

export interface AgentInteractionRequest {
  roomId?: UUID;
  message: string;
  metadata?: Record<string, any>;
  attachments?: any[];
}

export interface AgentInteractionResponse {
  messageId: UUID;
  response: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Service for managing agents on external ElizaOS server instances
 */
export class ServerAgentService {
  private serverInstances = new Map<string, ServerInstance>();
  private deployedAgents = new Map<UUID, ServerAgentInfo>();
  private jwtTokenCache = new Map<string, { token: string; expiresAt: Date }>();

  constructor() {
    // Initialize with default local server instance
    this.addServerInstance({
      id: 'local-server',
      name: 'Local ElizaOS Server',
      url: process.env.ELIZA_SERVER_URL || 'http://localhost:3000',
      status: 'online',
      capacity: { current: 0, maximum: 100 },
      region: 'local',
    });
  }

  /**
   * Add a server instance to the pool
   */
  addServerInstance(server: ServerInstance): void {
    this.serverInstances.set(server.id, server);
    logger.info('[ServerAgentService] Added server instance', {
      id: server.id,
      name: server.name,
      url: server.url,
    });
  }

  /**
   * Remove a server instance
   */
  removeServerInstance(serverId: string): void {
    this.serverInstances.delete(serverId);
    logger.info('[ServerAgentService] Removed server instance', { serverId });
  }

  /**
   * Get or create JWT token for organization
   */
  private async getJWTToken(
    organizationId: string,
    userId: string,
    userEmail: string,
    userName: string,
    userRole: string,
  ): Promise<string> {
    const cacheKey = `${organizationId}:${userId}`;
    const cached = this.jwtTokenCache.get(cacheKey);

    // Check if we have a valid cached token (expires in 1 hour from now)
    if (cached && cached.expiresAt > new Date(Date.now() + 60 * 60 * 1000)) {
      return cached.token;
    }

    // Create new JWT token with enhanced payload
    const payload: Omit<EnhancedJWTPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: userId,
      email: userEmail,
      name: userName,
      organizationId,
      role: userRole,
      tenantId: organizationId, // Use organizationId as tenantId for multi-tenancy
    };

    const token = await createEnhancedJWT(payload);

    // Cache token with 6 hour expiry (shorter than token's 7-day expiry for security)
    this.jwtTokenCache.set(cacheKey, {
      token,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    logger.debug('[ServerAgentService] Created JWT token for organization', {
      organizationId,
      userId,
      email: userEmail,
    });

    return token;
  }

  /**
   * Make authenticated HTTP request to server
   */
  private async makeServerRequest(
    serverUrl: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    organizationId: string,
    userId: string,
    userEmail: string,
    userName: string,
    userRole: string,
    body?: any,
  ): Promise<any> {
    const token = await this.getJWTToken(
      organizationId,
      userId,
      userEmail,
      userName,
      userRole,
    );
    const url = `${serverUrl.replace(/\/$/, '')}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ElizaOS-Platform/1.0.0',
    };

    const options: RequestInit = {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    };

    try {
      logger.debug('[ServerAgentService] Making server request', {
        method,
        url,
        organizationId,
      });

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Server request failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      logger.error(
        `[ServerAgentService] Server request failed - Method: ${method}, URL: ${url}, Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Select best server instance for deployment
   */
  private selectServerInstance(preferredServerId?: string): ServerInstance {
    if (preferredServerId) {
      const preferred = this.serverInstances.get(preferredServerId);
      if (preferred && preferred.status === 'online') {
        return preferred;
      }
    }

    // Find server with lowest capacity usage
    const onlineServers = Array.from(this.serverInstances.values())
      .filter((s) => s.status === 'online')
      .sort(
        (a, b) =>
          a.capacity.current / a.capacity.maximum -
          b.capacity.current / b.capacity.maximum,
      );

    if (onlineServers.length === 0) {
      throw new Error('No online server instances available');
    }

    return onlineServers[0];
  }

  /**
   * Deploy agent to external server
   */
  async deployAgent(config: ServerAgentConfig): Promise<UUID> {
    logger.info('[ServerAgentService] Deploying agent to external server', {
      organizationId: config.organizationId,
      characterName: config.character.name,
      serverInstanceId: config.serverInstanceId,
    });

    try {
      // Select server instance
      const serverInstance = this.selectServerInstance(config.serverInstanceId);

      // Create agent on server via API
      const response = await this.makeServerRequest(
        serverInstance.url,
        '/api/agents',
        'POST',
        config.organizationId,
        config.userId,
        config.userEmail,
        config.userName,
        config.userRole,
        {
          characterJson: config.character,
          settings: config.settings,
          plugins: config.plugins,
        },
      );

      if (!response.success) {
        throw new Error(
          `Server agent creation failed: ${response.error?.message || 'Unknown error'}`,
        );
      }

      const agentId = response.data.id;

      // Track deployed agent
      const agentInfo: ServerAgentInfo = {
        agentId,
        character: config.character,
        status: 'active',
        serverInstance,
        createdAt: new Date(),
        organizationId: config.organizationId,
        userId: config.userId,
      };

      this.deployedAgents.set(agentId, agentInfo);

      // Update server capacity
      serverInstance.capacity.current++;

      // Start the agent on the server
      await this.startAgent(agentId);

      logger.info('[ServerAgentService] Agent deployed successfully', {
        agentId,
        serverUrl: serverInstance.url,
        organizationId: config.organizationId,
      });

      return agentId;
    } catch (error) {
      logger.error(
        `[ServerAgentService] Agent deployment failed - Error: ${error instanceof Error ? error.message : String(error)}, Organization: ${config.organizationId}, Character: ${config.character.name}`,
      );
      throw new Error(
        `Agent deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Start agent on server
   */
  async startAgent(agentId: UUID): Promise<void> {
    const agentInfo = this.deployedAgents.get(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      await this.makeServerRequest(
        agentInfo.serverInstance.url,
        `/api/agents/${agentId}/start`,
        'POST',
        agentInfo.organizationId,
        agentInfo.userId,
        '', // userEmail - would need to store this
        '', // userName - would need to store this
        'admin', // userRole - would need to store this
      );

      agentInfo.status = 'active';
      agentInfo.lastActivity = new Date();

      logger.info('[ServerAgentService] Agent started successfully', {
        agentId,
      });
    } catch (error) {
      agentInfo.status = 'error';
      agentInfo.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Stop agent on server
   */
  async stopAgent(agentId: UUID): Promise<void> {
    const agentInfo = this.deployedAgents.get(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      await this.makeServerRequest(
        agentInfo.serverInstance.url,
        `/api/agents/${agentId}/stop`,
        'POST',
        agentInfo.organizationId,
        agentInfo.userId,
        '', // userEmail - would need to store this
        '', // userName - would need to store this
        'admin', // userRole - would need to store this
      );

      agentInfo.status = 'inactive';

      logger.info('[ServerAgentService] Agent stopped successfully', {
        agentId,
      });
    } catch (error) {
      agentInfo.status = 'error';
      agentInfo.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Delete agent from server
   */
  async deleteAgent(agentId: UUID): Promise<void> {
    const agentInfo = this.deployedAgents.get(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      await this.makeServerRequest(
        agentInfo.serverInstance.url,
        `/api/agents/${agentId}`,
        'DELETE',
        agentInfo.organizationId,
        agentInfo.userId,
        '', // userEmail - would need to store this
        '', // userName - would need to store this
        'admin', // userRole - would need to store this
      );

      // Update server capacity
      agentInfo.serverInstance.capacity.current--;

      // Remove from tracking
      this.deployedAgents.delete(agentId);

      logger.info('[ServerAgentService] Agent deleted successfully', {
        agentId,
      });
    } catch (error) {
      logger.error(
        `[ServerAgentService] Agent deletion failed - Agent ID: ${agentId}, Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Get agent information
   */
  async getAgent(agentId: UUID): Promise<ServerAgentInfo | null> {
    return this.deployedAgents.get(agentId) || null;
  }

  /**
   * Get all agents for an organization
   */
  async getOrganizationAgents(
    organizationId: string,
  ): Promise<ServerAgentInfo[]> {
    return Array.from(this.deployedAgents.values()).filter(
      (agent) => agent.organizationId === organizationId,
    );
  }

  /**
   * Send message to agent and get response
   */
  async interactWithAgent(
    agentId: UUID,
    request: AgentInteractionRequest,
  ): Promise<AgentInteractionResponse> {
    const agentInfo = this.deployedAgents.get(agentId);
    if (!agentInfo) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agentInfo.status !== 'active') {
      throw new Error(
        `Agent ${agentId} is not active (status: ${agentInfo.status})`,
      );
    }

    try {
      const response = await this.makeServerRequest(
        agentInfo.serverInstance.url,
        '/api/messaging/submit',
        'POST',
        agentInfo.organizationId,
        agentInfo.userId,
        '', // userEmail - would need to store this
        '', // userName - would need to store this
        'admin', // userRole - would need to store this
        {
          channel_id: request.roomId || agentId, // Use agentId as default channel
          server_id: agentInfo.serverInstance.id,
          author_id: agentInfo.userId,
          content: request.message,
          source_type: 'platform-api',
          raw_message: request,
          metadata: request.metadata,
          attachments: request.attachments,
        },
      );

      agentInfo.lastActivity = new Date();

      return {
        messageId: response.messageId || `msg-${Date.now()}`,
        response: response.response || 'Message sent successfully',
        metadata: response.metadata,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error(
        `[ServerAgentService] Agent interaction failed - Agent ID: ${agentId}, Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Check agent health on server
   */
  async checkAgentHealth(agentId: UUID): Promise<boolean> {
    const agentInfo = this.deployedAgents.get(agentId);
    if (!agentInfo) {
      return false;
    }

    try {
      const response = await this.makeServerRequest(
        agentInfo.serverInstance.url,
        `/api/agents/${agentId}`,
        'GET',
        agentInfo.organizationId,
        agentInfo.userId,
        '', // userEmail - would need to store this
        '', // userName - would need to store this
        'admin', // userRole - would need to store this
      );

      const isHealthy = response.success && response.data?.status === 'active';

      if (isHealthy) {
        agentInfo.status = 'active';
        agentInfo.lastActivity = new Date();
      } else {
        agentInfo.status = 'error';
        agentInfo.error = 'Agent health check failed';
      }

      return isHealthy;
    } catch (error) {
      agentInfo.status = 'error';
      agentInfo.error = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /**
   * Get server instances
   */
  getServerInstances(): ServerInstance[] {
    return Array.from(this.serverInstances.values());
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    const agents = Array.from(this.deployedAgents.values());
    const servers = Array.from(this.serverInstances.values());

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.status === 'active').length,
      inactiveAgents: agents.filter((a) => a.status === 'inactive').length,
      errorAgents: agents.filter((a) => a.status === 'error').length,
      totalServers: servers.length,
      onlineServers: servers.filter((s) => s.status === 'online').length,
      organizationCounts: agents.reduce(
        (acc, agent) => {
          acc[agent.organizationId] = (acc[agent.organizationId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      serverCapacity: servers.reduce(
        (acc, server) => {
          acc[server.id] = {
            current: server.capacity.current,
            maximum: server.capacity.maximum,
            utilization: server.capacity.current / server.capacity.maximum,
          };
          return acc;
        },
        {} as Record<
          string,
          { current: number; maximum: number; utilization: number }
        >,
      ),
    };
  }

  /**
   * Clear JWT token cache (for security)
   */
  clearTokenCache(): void {
    this.jwtTokenCache.clear();
    logger.info('[ServerAgentService] JWT token cache cleared');
  }
}

// Global singleton instance
export const serverAgentService = new ServerAgentService();
