import type { IAgentRuntime } from '@elizaos/core';
import { logger, stringToUuid, validateUuid, type UUID } from '@elizaos/core';
import type { IncomingMessage } from 'http';
import type { WebSocket, WebSocketServer } from 'ws';
import type { AgentServer } from '../index';

export class WebSocketRouter {
  private agents: Map<UUID, IAgentRuntime>;
  private connections: Map<WebSocket, { agentId?: UUID; channelId?: string }>;
  private serverInstance: AgentServer;

  constructor(agents: Map<UUID, IAgentRuntime>, serverInstance: AgentServer) {
    this.agents = agents;
    this.connections = new Map();
    this.serverInstance = serverInstance;
    logger.info(`[WebSocket] Router initialized with ${this.agents.size} agents`);
  }

  setupServer(wss: WebSocketServer) {
    logger.info('[WebSocket] Setting up native WebSocket server');

    wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleNewConnection(ws, request);
    });
  }

  private handleNewConnection(ws: WebSocket, request: IncomingMessage) {
    const clientIP = request.socket.remoteAddress;
    logger.info(`[WebSocket] New connection from ${clientIP}`);

    // Initialize connection metadata
    this.connections.set(ws, {});

    // Send connection confirmation
    this.sendMessage(ws, {
      type: 'connection_established',
      message: 'Connected to Eliza WebSocket server',
      timestamp: Date.now(),
    });

    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      logger.info(`[WebSocket] Connection closed: ${code} ${reason.toString()}`);
      this.connections.delete(ws);
    });

    ws.on('error', (error: Error) => {
      logger.error(`[WebSocket] Connection error: ${error.message}`, error);
      this.connections.delete(ws);
    });

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  }

  private async handleMessage(ws: WebSocket, data: Buffer) {
    try {
      const message = JSON.parse(data.toString());
      logger.debug(`[WebSocket] Received message: ${JSON.stringify(message)}`);

      switch (message.type) {
        case 'connect':
          await this.handleConnect(ws, message);
          break;
        case 'message':
          await this.handleUserMessage(ws, message);
          break;
        case 'room_joining':
          await this.handleChannelJoining(ws, message);
          break;
        case 'send_message':
          await this.handleSendMessage(ws, message);
          break;
        default:
          logger.warn(`[WebSocket] Unknown message type: ${message.type}`);
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`[WebSocket] Error parsing message: ${error}`);
      this.sendError(ws, 'Invalid JSON message');
    }
  }

  private async handleConnect(ws: WebSocket, message: any) {
    const { agent_id, channel_id } = message;

    if (agent_id && !validateUuid(agent_id)) {
      this.sendError(ws, 'Invalid agent ID format');
      return;
    }

    // Update connection metadata
    const connectionData = this.connections.get(ws) || {};
    connectionData.agentId = agent_id;
    connectionData.channelId = channel_id;
    this.connections.set(ws, connectionData);

    logger.info(`[WebSocket] Client connected to agent ${agent_id}, channel ${channel_id}`);

    this.sendMessage(ws, {
      type: 'connection_ack',
      agent_id,
      channel_id,
      message: 'Successfully connected to agent',
      timestamp: Date.now(),
    });
  }

  private async handleChannelJoining(ws: WebSocket, message: any) {
    const { roomId, agentId } = message;

    if (agentId && !validateUuid(agentId)) {
      this.sendError(ws, 'Invalid agent ID format');
      return;
    }

    // Update connection metadata
    const connectionData = this.connections.get(ws) || {};
    connectionData.agentId = agentId;
    connectionData.channelId = roomId;
    this.connections.set(ws, connectionData);

    logger.info(`[WebSocket] Client joined channel ${roomId} for agent ${agentId}`);

    this.sendMessage(ws, {
      type: 'channel_joined',
      roomId,
      agentId,
      message: 'Successfully joined channel',
      timestamp: Date.now(),
    });
  }

  private async handleUserMessage(ws: WebSocket, message: any) {
    await this.processAgentMessage(ws, {
      content: message.content,
      author: message.author || 'User',
      channel_id: message.channel_id,
      agent_id: message.agent_id,
      timestamp: message.timestamp || Date.now(),
    });
  }

  private async handleSendMessage(ws: WebSocket, message: any) {
    await this.processAgentMessage(ws, {
      content: message.content,
      author: message.senderName || message.author || 'User',
      channel_id: message.roomId || message.channelId,
      agent_id: message.agentId,
      timestamp: message.timestamp || Date.now(),
    });
  }

  private async processAgentMessage(ws: WebSocket, messageData: any) {
    const { content, author, channel_id, agent_id, timestamp } = messageData;

    if (!content || !author) {
      this.sendError(ws, 'Message content and author are required');
      return;
    }

    // Get connection data or use provided IDs
    const connectionData = this.connections.get(ws) || {};
    const targetAgentId = agent_id || connectionData.agentId;
    const targetChannelId = channel_id || connectionData.channelId;

    if (!targetAgentId) {
      this.sendError(ws, 'No agent ID specified');
      return;
    }

    if (!validateUuid(targetAgentId)) {
      this.sendError(ws, 'Invalid agent ID format');
      return;
    }

    // Instead of processing directly through agent, use the message bus system
    try {
      logger.info(
        `[WebSocket] Routing message through message bus for agent ${targetAgentId}: "${content.substring(0, 100)}..."`
      );

      // Create a message to route through the server's message ingestion system
      const messageId = crypto.randomUUID() as UUID;
      const authorId = crypto.randomUUID() as UUID; // Generate a unique ID for WebSocket users

      // Convert channel ID to UUID (use existing string or generate new UUID)
      const channelUuid = targetChannelId
        ? stringToUuid(targetChannelId)
        : (crypto.randomUUID() as UUID);

      // Create message in the database first
      const messageToCreate = {
        id: messageId,
        channelId: channelUuid,
        authorId,
        content,
        rawMessage: { content },
        sourceId: 'websocket',
        source_type: 'websocket',
        metadata: {
          agentId: targetAgentId,
          author,
          client_type: 'websocket',
          timestamp: timestamp || Date.now(),
        },
      };

      const createdMessage = await this.serverInstance.createMessage(messageToCreate);

      // Emit to the internal message bus for agent processing
      const messageForBus = {
        id: createdMessage.id!,
        channelId: createdMessage.channelId,
        serverId: '00000000-0000-0000-0000-000000000000' as UUID, // Default server ID
        authorId: createdMessage.authorId,
        authorDisplayName: author,
        content: createdMessage.content,
        rawMessage: createdMessage.rawMessage,
        sourceId: createdMessage.sourceId,
        source_type: createdMessage.source_type,
        inReplyToMessageId: undefined,
        createdAt: new Date(createdMessage.createdAt).getTime(),
        metadata: createdMessage.metadata,
      };

      // Import the message bus
      const internalMessageBus = (await import('../bus')).default;
      internalMessageBus.emit('new_message', messageForBus);

      logger.info(`[WebSocket] Message published to internal message bus: ${messageId}`);

      // Send acknowledgment back to WebSocket client
      this.sendMessage(ws, {
        type: 'message_received',
        id: messageId,
        status: 'queued',
        message: 'Message received and queued for agent processing',
        timestamp: Date.now(),
      });

      // Also broadcast to other WebSocket clients watching this channel
      if (this.serverInstance.websocket) {
        this.serverInstance.websocket.to(targetChannelId).emit('messageBroadcast', {
          senderId: authorId,
          senderName: author,
          text: content,
          roomId: targetChannelId,
          serverId: '00000000-0000-0000-0000-000000000000',
          createdAt: Date.now(),
          source: 'websocket',
          id: messageId,
        });
      }
    } catch (error) {
      logger.error(`[WebSocket] Error routing message through message bus: ${error}`);
      this.sendError(ws, 'Failed to process message');
    }
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      message: error,
      timestamp: Date.now(),
    });
  }

  // Broadcast message to all connected clients for a specific agent/channel
  public broadcastMessage(agentId: UUID, channelId: string, message: any) {
    const messageToSend = {
      type: 'message_broadcast',
      ...message,
      agent_id: agentId,
      channel_id: channelId,
      timestamp: Date.now(),
    };

    this.connections.forEach((connectionData, ws) => {
      if (
        connectionData.agentId === agentId &&
        (!channelId || connectionData.channelId === channelId)
      ) {
        this.sendMessage(ws, messageToSend);
      }
    });
  }
}
