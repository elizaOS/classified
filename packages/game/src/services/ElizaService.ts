import { ElizaClient } from '@elizaos/api-client';
import { v4 as uuidv4 } from 'uuid';

export interface ElizaMessage {
  id: string;
  content: string;
  authorId: string;
  authorName?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ElizaChannel {
  id: string;
  name: string;
  type: string;
  serverId: string;
}

export class ElizaService {
  private client: ElizaClient;
  private baseUrl: string;
  private userId: string;
  private agentId: string;

  constructor(baseUrl: string, userId?: string, agentId = '00000000-0000-0000-0000-000000000001') {
    this.baseUrl = baseUrl;
    this.client = ElizaClient.create({ baseUrl });
    this.userId = userId || uuidv4();
    this.agentId = agentId;
  }

  getClient() {
    return this.client;
  }

  getUserId() {
    return this.userId;
  }

  getAgentId() {
    return this.agentId;
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.server.ping();
      return result.pong === true;
    } catch (error) {
      console.error('[ElizaService] Ping failed:', error);
      return false;
    }
  }

  async getOrCreateDmChannel(): Promise<ElizaChannel> {
    // Work around the API client limitation by calling the endpoint directly
    const response = await fetch(
      `${this.baseUrl}/api/messaging/dm-channel?targetUserId=${this.agentId}&currentUserId=${this.userId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get DM channel: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const channel = result.data;

    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      serverId: channel.messageServerId || '00000000-0000-0000-0000-000000000000',
    };
  }

  async sendMessage(
    channelId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<ElizaMessage> {
    // Get the channel to get the serverId
    const channel = await this.getChannelDetails(channelId);
    
    // Work around API client limitation - send message with all required fields
    const response = await fetch(
      `${this.baseUrl}/api/messaging/central-channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          author_id: this.userId,
          server_id: channel.serverId,
          metadata: {
            ...metadata,
            source: metadata?.source || 'terminal_gui',
            userDisplayName: metadata?.userDisplayName || 'User',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const message = result.data;

    return {
      id: message.id,
      content: message.content,
      authorId: message.author_id || message.authorId,
      authorName: metadata?.userDisplayName || 'User',
      timestamp: new Date(message.created_at || message.createdAt),
      metadata: message.metadata,
    };
  }

  async getChannelMessages(channelId: string, limit = 50): Promise<ElizaMessage[]> {
    const response = await this.client.messaging.getChannelMessages(channelId as any, { limit });
    
    return response.messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      authorId: msg.authorId,
      authorName: msg.metadata?.senderName || msg.metadata?.userDisplayName || 'Unknown',
      timestamp: new Date(msg.createdAt),
      metadata: msg.metadata,
    }));
  }

  private async getChannelDetails(channelId: string): Promise<ElizaChannel> {
    const channel = await this.client.messaging.getChannelDetails(channelId as any);
    
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      serverId: channel.messageServerId,
    };
  }
} 