import { ElizaClient } from '@elizaos/api-client';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from '@elizaos/core';

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

  async addAgentToChannel(channelId: string, agentId: string): Promise<void> {
    console.log(`[ElizaService] Adding agent ${agentId} to channel ${channelId}...`);
    
    try {
      await this.client.messaging.addAgentToChannel(channelId as UUID, agentId as UUID);
      console.log(`[ElizaService] ✅ Agent ${agentId} added to channel ${channelId}`);
    } catch (error) {
      console.error(`[ElizaService] Failed to add agent to channel:`, error);
      // Don't throw error, just log it - agent might already be in channel
    }
  }

  async getOrCreateDmChannel(): Promise<ElizaChannel> {
    console.log('[ElizaService] Getting or creating admin room...');
    
    try {
      // First, try to find an existing admin room
      const serverId = '00000000-0000-0000-0000-000000000000' as UUID;
      const { channels } = await this.client.messaging.getServerChannels(serverId);
      
      console.log('[ElizaService] Found', channels.length, 'existing channels');
      
      // Look for an existing admin room with this user and agent
      const existingChannel = channels.find(channel => {
        return channel.metadata?.isAdminRoom === true &&
               channel.metadata?.userId === this.userId &&
               channel.metadata?.agentId === this.agentId;
      });
      
      if (existingChannel) {
        console.log('[ElizaService] Found existing admin room:', existingChannel.id);
        
        // Ensure the agent is added to the channel
        await this.addAgentToChannel(existingChannel.id, this.agentId);
        
        return {
          id: existingChannel.id,
          name: existingChannel.name,
          type: existingChannel.type,
          serverId: existingChannel.messageServerId || serverId,
        };
      }
      
      // No existing channel found, create a new one
      console.log('[ElizaService] No existing admin room found, creating new one...');
      
      const channel = await this.client.messaging.createChannel({
        name: 'Admin Room',
        serverId: serverId,
        participantCentralUserIds: [this.userId, this.agentId] as UUID[],
        type: 'DM' as any,
        metadata: {
          isAdminRoom: true,
          userId: this.userId,
          agentId: this.agentId,
        },
      });
      
      console.log('[ElizaService] Created admin room with ID:', channel.id);
      
      // Ensure the agent is added to the channel
      await this.addAgentToChannel(channel.id, this.agentId);
      
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        serverId: channel.messageServerId || serverId,
      };
    } catch (error) {
      console.error('[ElizaService] Failed to get or create admin room:', error);
      throw error;
    }
  }

  async sendMessage(
    channelId: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<ElizaMessage> {
    try {
      console.log('[ElizaService] Sending message via client...');

      await this.addAgentToChannel(channelId, this.agentId);
      
      const message = await this.client.messaging.postMessage(
        channelId as UUID,
        content,
        {
          ...metadata,
          source: metadata?.source || 'terminal_gui',
          userDisplayName: metadata?.userDisplayName || 'User',
          userId: this.userId,
          serverId: '00000000-0000-0000-0000-000000000000',
        }
      );

      return {
        id: message.id,
        content: message.content,
        authorId: message.authorId,
        authorName: metadata?.userDisplayName || 'User',
        timestamp: new Date(message.createdAt),
        metadata: message.metadata,
      };
    } catch (error) {
      console.error('[ElizaService] Failed to send message:', error);
      throw error;
    }
  }

  async getChannelMessages(channelId: string, limit = 50): Promise<ElizaMessage[]> {
    try {
      const result = await this.client.messaging.getChannelMessages(channelId as UUID, { limit });
      
      return result.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        authorId: msg.authorId,
        authorName: msg.metadata?.senderName || msg.metadata?.userDisplayName || 'Unknown',
        timestamp: new Date(msg.createdAt),
        metadata: msg.metadata,
      }));
    } catch (error) {
      console.error('[ElizaService] Failed to get messages:', error);
      throw error;
    }
  }

  private async getChannelDetails(channelId: string): Promise<ElizaChannel> {
    try {
      const channel = await this.client.messaging.getChannelDetails(channelId as UUID);
      
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        serverId: channel.messageServerId || '00000000-0000-0000-0000-000000000000',
      };
    } catch (error) {
      console.error('[ElizaService] Failed to get channel details:', error);
      throw error;
    }
  }
} 