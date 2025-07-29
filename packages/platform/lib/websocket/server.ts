/**
 * WebSocket Server Infrastructure for Platform Package
 * 
 * Integrates the working WebSocket infrastructure from packages/server
 * to provide real-time communication capabilities for the autocoder platform.
 */

import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp?: number;
}

export interface ProjectUpdateMessage extends WebSocketMessage {
  type: 'project_update';
  payload: {
    projectId: string;
    status: string;
    message: string;
    data?: any;
  };
}

export interface BuildStatusMessage extends WebSocketMessage {
  type: 'build_status';
  payload: {
    projectId: string;
    status: 'queued' | 'building' | 'completed' | 'failed';
    progress?: number;
    logs?: string[];
  };
}

export interface AgentResponseMessage extends WebSocketMessage {
  type: 'agent_response';
  payload: {
    projectId: string;
    message: string;
    agentId: string;
    messageType: 'analysis' | 'suggestion' | 'completion';
  };
}

/**
 * WebSocket Server Manager
 * Provides real-time communication for the autocoder platform
 */
export class WebSocketServer {
  private io: SocketIOServer | null = null;
  private connectedClients: Map<string, { projectId?: string; userId?: string }> = new Map();

  /**
   * Initialize WebSocket server with HTTP server
   */
  public initialize(httpServer: http.Server): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupEventHandlers();
    logger.info('[WebSocket] Server initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info(`[WebSocket] Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, {});

      // Handle project subscription
      socket.on('subscribe_project', (data: { projectId: string; userId?: string }) => {
        const { projectId, userId } = data;
        
        // Join project-specific room
        socket.join(`project:${projectId}`);
        
        // Update client info
        this.connectedClients.set(socket.id, { projectId, userId });
        
        logger.info(`[WebSocket] Client ${socket.id} subscribed to project ${projectId}`);
        
        // Send subscription confirmation
        socket.emit('subscription_confirmed', {
          projectId,
          message: `Subscribed to project ${projectId}`,
        });
      });

      // Handle project unsubscription
      socket.on('unsubscribe_project', (data: { projectId: string }) => {
        const { projectId } = data;
        socket.leave(`project:${projectId}`);
        
        const clientInfo = this.connectedClients.get(socket.id);
        if (clientInfo) {
          clientInfo.projectId = undefined;
          this.connectedClients.set(socket.id, clientInfo);
        }
        
        logger.info(`[WebSocket] Client ${socket.id} unsubscribed from project ${projectId}`);
      });

      // Handle user messages for projects
      socket.on('user_message', (data: { projectId: string; message: string; messageType?: string }) => {
        const { projectId, message, messageType = 'user' } = data;
        
        // Broadcast to other clients in the project room
        socket.to(`project:${projectId}`).emit('project_message', {
          type: 'user_message',
          payload: {
            projectId,
            message,
            messageType,
            senderId: socket.id,
            timestamp: Date.now(),
          },
        });
        
        logger.info(`[WebSocket] User message received for project ${projectId}: ${message.substring(0, 50)}...`);
      });

      // Handle build start requests
      socket.on('start_build', (data: { projectId: string }) => {
        const { projectId } = data;
        
        // Broadcast build start to project room
        this.broadcastToProject(projectId, {
          type: 'build_status',
          payload: {
            projectId,
            status: 'queued',
            progress: 0,
          },
        });
        
        logger.info(`[WebSocket] Build started for project ${projectId}`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        const clientInfo = this.connectedClients.get(socket.id);
        this.connectedClients.delete(socket.id);
        
        logger.info(`[WebSocket] Client ${socket.id} disconnected: ${reason}`, {
          projectId: clientInfo?.projectId,
          userId: clientInfo?.userId,
        });
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`[WebSocket] Socket error for ${socket.id}:`, error);
      });

      // Send connection confirmation
      socket.emit('connection_established', {
        socketId: socket.id,
        timestamp: Date.now(),
        message: 'Connected to Autocoder WebSocket server',
      });
    });
  }

  /**
   * Broadcast message to all clients in a project room
   */
  public broadcastToProject(projectId: string, message: WebSocketMessage): void {
    if (!this.io) {
      logger.warn('[WebSocket] Cannot broadcast: server not initialized');
      return;
    }

    message.timestamp = Date.now();
    this.io.to(`project:${projectId}`).emit('project_update', message);
    
    logger.debug(`[WebSocket] Broadcasted ${message.type} to project ${projectId}`);
  }

  /**
   * Send project update message
   */
  public sendProjectUpdate(projectId: string, status: string, message: string, data?: any): void {
    this.broadcastToProject(projectId, {
      type: 'project_update',
      payload: {
        projectId,
        status,
        message,
        data,
      },
    });
  }

  /**
   * Send build status update
   */
  public sendBuildStatus(projectId: string, status: BuildStatusMessage['payload']['status'], progress?: number, logs?: string[]): void {
    this.broadcastToProject(projectId, {
      type: 'build_status',
      payload: {
        projectId,
        status,
        progress,
        logs,
      },
    });
  }

  /**
   * Send agent response
   */
  public sendAgentResponse(projectId: string, message: string, agentId: string, messageType: AgentResponseMessage['payload']['messageType']): void {
    this.broadcastToProject(projectId, {
      type: 'agent_response',
      payload: {
        projectId,
        message,
        agentId,
        messageType,
      },
    });
  }

  /**
   * Get connected client count for a project
   */
  public getProjectClientCount(projectId: string): number {
    if (!this.io) return 0;
    
    const room = this.io.sockets.adapter.rooms.get(`project:${projectId}`);
    return room ? room.size : 0;
  }

  /**
   * Get total connected client count
   */
  public getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get server status
   */
  public getStatus(): { initialized: boolean; clientCount: number } {
    return {
      initialized: this.io !== null,
      clientCount: this.getConnectedClientCount(),
    };
  }

  /**
   * Shutdown the WebSocket server
   */
  public shutdown(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.connectedClients.clear();
      logger.info('[WebSocket] Server shutdown');
    }
  }
}

// Singleton instance
export const webSocketServer = new WebSocketServer();