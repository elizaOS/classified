/**
 * ElizaService - Basic types for legacy compatibility
 * These types are used by the Terminal component which may be deprecated
 */

export interface ElizaMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ElizaChannel {
  id: string;
  name: string;
  type: string;
  serverId: string;
}

export class ElizaService {
  constructor(_baseUrl: string, _userId: string, _agentId: string) {
    // Minimal implementation for compatibility
  }

  async getOrCreateDmChannel(): Promise<ElizaChannel> {
    return {
      id: 'default',
      name: 'Default Channel',
      type: 'DM',
      serverId: '00000000-0000-0000-0000-000000000000',
    };
  }

  async getChannelMessages(_channelId: string): Promise<ElizaMessage[]> {
    return [];
  }

  async sendMessage(_channelId: string, content: string): Promise<ElizaMessage> {
    return {
      id: Date.now().toString(),
      content,
      authorId: 'user',
      authorName: 'User',
      timestamp: new Date(),
      metadata: {},
    };
  }
}
