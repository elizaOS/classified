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
  private baseUrl: string;
  private userId: string;
  private agentId: string;

  constructor(baseUrl: string, userId?: string, agentId = '00000000-0000-0000-0000-000000000001') {
    this.baseUrl = baseUrl;
    this.userId = userId || uuidv4();
    this.agentId = agentId;
  }

  getUserId() {
    return this.userId;
  }

  getAgentId() {
    return this.agentId;
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/server/ping`);
      const result = await response.json();
      return result.pong === true;
    } catch (error) {
      console.error('[ElizaService] Ping failed:', error);
      return false;
    }
  }

  async getOrCreateDmChannel(): Promise<ElizaChannel> {
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
    
    const payload = {
      channelId: channelId,      // Server expects this
      content: content,           // Server expects this  
      author_id: this.userId,     // Server expects this
      server_id: channel.serverId, // Server expects this
      metadata: {
        ...metadata,
        source: metadata?.source || 'terminal_gui',
        userDisplayName: metadata?.userDisplayName || 'User',
      },
    };
    
    console.log('[ElizaService] Sending message with payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(
      `${this.baseUrl}/api/messaging/central-channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();
    console.log('[ElizaService] Response status:', response.status);
    console.log('[ElizaService] Response body:', responseText);

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
    }

    const result = JSON.parse(responseText);
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
    const response = await fetch(
      `${this.baseUrl}/api/messaging/central-channels/${channelId}/messages?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const messages = result.data?.messages || result.messages || result.data || [];
    
    return messages.map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      authorId: msg.authorId || msg.author_id,
      authorName: msg.metadata?.senderName || msg.metadata?.userDisplayName || 'Unknown',
      timestamp: new Date(msg.createdAt || msg.created_at),
      metadata: msg.metadata,
    }));
  }

  private async getChannelDetails(channelId: string): Promise<ElizaChannel> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/messaging/central-channels/${channelId}/details`
      );

      if (!response.ok) {
        throw new Error(`Failed to get channel details: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[ElizaService] Raw channel details response:', JSON.stringify(data, null, 2));
      
      // Check if data is nested inside a 'data' property
      const channelData = data.data || data;
      
      return {
        id: channelData.id,
        name: channelData.name,
        type: channelData.type,
        serverId: channelData.messageServerId || channelData.serverId || '00000000-0000-0000-0000-000000000000',
      };
    } catch (error) {
      console.error('Failed to get channel details:', error);
      throw error;
    }
  }
} 