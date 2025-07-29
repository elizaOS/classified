import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { getSql } from '@/lib/database';
import { AutocoderAgentService } from '@/lib/autocoder/agent-service';
import { BuildQueueManager } from '@/lib/autocoder/build-queue-manager';
import { randomUUID } from 'crypto';

interface WebSocketClient {
  id: string;
  userId: string;
  ws: WebSocket;
  subscribedProjects: Set<string>;
  lastPing: Date;
  isAlive: boolean;
}

interface WebSocketMessage {
  type: string;
  projectId?: string;
  message?: string;
  timestamp?: string;
  data?: any;
}

class AutocoderWebSocketServer {
  private static instance: AutocoderWebSocketServer;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private agentService: AutocoderAgentService;
  private buildQueue: BuildQueueManager;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.agentService = new AutocoderAgentService();
    this.buildQueue = BuildQueueManager.getInstance();
    this.setupBuildQueueListeners();
  }

  static getInstance(): AutocoderWebSocketServer {
    if (!AutocoderWebSocketServer.instance) {
      AutocoderWebSocketServer.instance = new AutocoderWebSocketServer();
    }
    return AutocoderWebSocketServer.instance;
  }

  async initialize(server: any): Promise<void> {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({
      server,
      path: '/api/autocoder/ws',
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.startHeartbeat();
    await this.agentService.initialize();

    console.log('AutoCoder WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = parse(req.url || '', true);
    const userId = url.query.userId as string;

    if (!userId) {
      ws.close(1002, 'Missing userId parameter');
      return;
    }

    const clientId = randomUUID();
    const client: WebSocketClient = {
      id: clientId,
      userId,
      ws,
      subscribedProjects: new Set(),
      lastPing: new Date(),
      isAlive: true,
    };

    this.clients.set(clientId, client);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    ws.on('pong', () => {
      client.isAlive = true;
      client.lastPing = new Date();
    });

    // Send welcome message
    this.sendMessage(clientId, {
      type: 'CONNECTION_ESTABLISHED',
      data: {
        clientId,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(`WebSocket client ${clientId} connected for user ${userId}`);
  }

  private async handleMessage(clientId: string, data: Buffer): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'AGENT_MESSAGE':
          await this.handleAgentMessage(client, message);
          break;

        case 'SUBSCRIBE_PROJECT':
          await this.handleSubscribeProject(client, message);
          break;

        case 'UNSUBSCRIBE_PROJECT':
          await this.handleUnsubscribeProject(client, message);
          break;

        case 'PING':
          this.sendMessage(clientId, { type: 'PONG' });
          break;

        case 'PONG':
          client.isAlive = true;
          client.lastPing = new Date();
          break;

        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.sendMessage(clientId, {
        type: 'ERROR',
        data: { message: 'Invalid message format' },
      });
    }
  }

  private async handleAgentMessage(
    client: WebSocketClient,
    message: WebSocketMessage,
  ): Promise<void> {
    if (!message.projectId || !message.message) {
      return;
    }

    try {
      // Echo user message to all subscribers
      this.broadcastToProject(message.projectId, {
        type: 'USER_MESSAGE',
        projectId: message.projectId,
        message: message.message,
        timestamp: new Date().toISOString(),
      });

      // Send message to the main ElizaOS agent instead of processing locally
      await this.sendMessageToAgent(
        message.projectId,
        client.userId,
        message.message,
      );
    } catch (error) {
      console.error('Failed to handle agent message:', error);
      this.sendMessage(client.id, {
        type: 'ERROR',
        data: { message: 'Failed to process message' },
      });
    }
  }

  /**
   * Send message to the main ElizaOS agent instead of processing locally
   */
  private async sendMessageToAgent(
    projectId: string,
    userId: string,
    userMessage: string,
  ): Promise<void> {
    try {
      if (!process.env.ELIZA_AGENT_URL || !process.env.ELIZA_AGENT_TOKEN) {
        throw new Error('ElizaOS agent configuration not available');
      }

      // Send message to the main ElizaOS agent via HTTP API
      const agentResponse = await fetch(
        `${process.env.ELIZA_AGENT_URL}/api/swarm/messages/${projectId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
          },
          body: JSON.stringify({
            userId,
            message: userMessage.trim(),
            messageType: 'user',
            timestamp: new Date().toISOString(),
            source: 'platform-websocket',
            requestId: `ws-${Date.now()}`,
          }),
        },
      );

      if (!agentResponse.ok) {
        const errorText = await agentResponse.text();
        console.error('Agent response error:', errorText);
        throw new Error(`Agent responded with status ${agentResponse.status}`);
      }

      const result = await agentResponse.json();

      // The agent will handle the response and broadcast it back via WebSocket
      // or we can set up a webhook to receive agent responses
      console.log(`Message sent to agent for project ${projectId}:`, result);
    } catch (error) {
      console.error('Failed to send message to agent:', error);

      // Send fallback error response
      const errorResponse =
        'I apologize, but I encountered an error processing your message. Please try again.';

      this.broadcastToProject(projectId, {
        type: 'AGENT_MESSAGE',
        projectId,
        message: errorResponse,
        timestamp: new Date().toISOString(),
        data: { metadata: { error: true } },
      });
    }
  }

  /**
   * Handle agent responses from the main ElizaOS agent
   * This can be called by a webhook or polling mechanism
   */
  public async handleAgentResponse(
    projectId: string,
    agentMessage: string,
    metadata?: any,
  ): Promise<void> {
    try {
      // Broadcast agent response to all subscribers
      this.broadcastToProject(projectId, {
        type: 'AGENT_MESSAGE',
        projectId,
        message: agentMessage,
        timestamp: new Date().toISOString(),
        data: { metadata: metadata || {} },
      });
    } catch (error) {
      console.error('Failed to handle agent response:', error);
    }
  }

  /**
   * Set up listeners for agent responses via webhook or WebSocket
   * This allows the main ElizaOS agent to communicate back to the platform
   */
  public setupAgentListeners(): void {
    // This could be extended to set up webhook endpoints or
    // WebSocket connections to the main ElizaOS agent for real-time updates
    console.log('Agent listeners set up for swarm project updates');
  }

  private async handleSubscribeProject(
    client: WebSocketClient,
    message: WebSocketMessage,
  ): Promise<void> {
    if (!message.projectId) {
      return;
    }

    client.subscribedProjects.add(message.projectId);

    this.sendMessage(client.id, {
      type: 'SUBSCRIBED',
      projectId: message.projectId,
      data: { message: 'Successfully subscribed to project updates' },
    });

    console.log(
      `Client ${client.id} subscribed to project ${message.projectId}`,
    );
  }

  private async handleUnsubscribeProject(
    client: WebSocketClient,
    message: WebSocketMessage,
  ): Promise<void> {
    if (!message.projectId) {
      return;
    }

    client.subscribedProjects.delete(message.projectId);

    this.sendMessage(client.id, {
      type: 'UNSUBSCRIBED',
      projectId: message.projectId,
      data: { message: 'Successfully unsubscribed from project updates' },
    });

    console.log(
      `Client ${client.id} unsubscribed from project ${message.projectId}`,
    );
  }

  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`WebSocket client ${clientId} disconnected`);
  }

  private setupBuildQueueListeners(): void {
    // Set up listeners for agent-managed project updates
    // These will be triggered by the main ElizaOS agent via webhooks or polling

    this.buildQueue.on('swarm-project-started', (projectData) => {
      this.broadcastToProject(projectData.projectId, {
        type: 'PROJECT_UPDATE',
        projectId: projectData.projectId,
        data: {
          updates: {
            status: 'active',
            phase: 'analysis',
            agentCount: projectData.agentCount || 1,
          },
        },
      });
    });

    this.buildQueue.on('swarm-project-progress', (projectData) => {
      this.broadcastToProject(projectData.projectId, {
        type: 'PROJECT_UPDATE',
        projectId: projectData.projectId,
        data: {
          updates: {
            progress: projectData.progress,
            phase: projectData.phase,
            agentStatuses: projectData.agentStatuses,
          },
        },
      });
    });

    this.buildQueue.on('swarm-agent-message', (messageData) => {
      this.broadcastToProject(messageData.projectId, {
        type: 'AGENT_MESSAGE',
        projectId: messageData.projectId,
        message: messageData.message,
        timestamp: messageData.timestamp || new Date().toISOString(),
        data: {
          metadata: {
            agentId: messageData.agentId,
            agentRole: messageData.agentRole,
            source: 'swarm-agent',
          },
        },
      });
    });

    this.buildQueue.on('swarm-project-completed', (projectData) => {
      this.broadcastToProject(projectData.projectId, {
        type: 'PROJECT_UPDATE',
        projectId: projectData.projectId,
        data: {
          updates: {
            status: 'completed',
            phase: 'completed',
            artifacts: projectData.artifacts,
          },
        },
      });
    });

    this.buildQueue.on('swarm-project-failed', (projectData) => {
      this.broadcastToProject(projectData.projectId, {
        type: 'PROJECT_UPDATE',
        projectId: projectData.projectId,
        data: {
          updates: {
            status: 'failed',
            error: projectData.error,
          },
        },
      });
    });
  }

  private sendMessage(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcastToProject(
    projectId: string,
    message: WebSocketMessage,
  ): void {
    for (const client of this.clients.values()) {
      if (
        client.subscribedProjects.has(projectId) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        if (!client.isAlive) {
          console.log(`Terminating inactive client ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }

        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
    }

    console.log('AutoCoder WebSocket server shut down');
  }
}

// Export for Next.js API route
async function handleGET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'WebSocket endpoint requires WebSocket upgrade',
    },
    { status: 400 },
  );
}

// Initialize WebSocket server (this would typically be done in a server setup file)
let wsServer: AutocoderWebSocketServer | null = null;

function initializeWebSocketServer(): AutocoderWebSocketServer {
  if (!wsServer) {
    wsServer = AutocoderWebSocketServer.getInstance();
  }
  return wsServer;
}

// Export class for use in other modules (but not as route export)
export type { AutocoderWebSocketServer };

export const { GET } = wrapHandlers({ handleGET });
