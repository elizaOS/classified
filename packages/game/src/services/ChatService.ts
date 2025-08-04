/**
 * Chat Service
 * Handles chat messaging, WebSocket connections, and communication
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';
import { TauriMessage } from '../types/shared';
import { v4 as uuidv4 } from 'uuid';

export class ChatService extends BaseTauriService {
  private messageListeners: Set<(message: TauriMessage) => void> = new Set();

  protected async setupEventListeners(): Promise<void> {
    if (!this.tauriListen) return;

    // Set up message event listener
    const unlistenMessage = await this.tauriListen<TauriMessage>('agent_message', (event) => {
      const message = event.payload;
      this.messageListeners.forEach((listener) => listener(message));
    });

    this.unlistenFns.push(unlistenMessage);
  }

  // Message listener management
  public onMessage(listener: (message: TauriMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  // WebSocket connection methods
  public async connectWebSocket(url: string = 'ws://localhost:7777'): Promise<void> {
    return this.ensureInitializedAndInvoke('connect_websocket', { url }) as Promise<void>;
  }

  public async disconnectWebSocket(): Promise<void> {
    return this.ensureInitializedAndInvoke('disconnect_websocket') as Promise<void>;
  }

  public async joinChannel(channelId: string): Promise<void> {
    return this.ensureInitializedAndInvoke('join_channel', { channelId }) as Promise<void>;
  }

  public async isWebSocketConnected(): Promise<boolean> {
    try {
      return (await this.ensureInitializedAndInvoke('is_websocket_connected')) as boolean;
    } catch (error) {
      console.error('Failed to check WebSocket connection:', error);
      return false;
    }
  }

  // Message sending
  public async sendMessage(content: string): Promise<string> {
    try {
      const response = await this.ensureInitializedAndInvoke('send_message_to_agent', {
        message: content,
        userId: this.userId,
        agentId: this.agentId,
      });

      return response as string;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error(`Message sending failed: ${error}`);
    }
  }

  // Memory/message history
  public async fetchMemories(limit: number = 50): Promise<TauriMessage[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_agent_memories', {
        agentId: this.agentId,
        count: limit,
      });

      // Convert response to TauriMessage format
      if (Array.isArray(response)) {
        return response.map((item: any) => ({
          id: item.id || uuidv4(),
          content: item.content || item.text || '',
          type: item.type || 'system',
          authorId: item.userId || item.agentId || this.agentId,
          authorName: item.userName || item.agentName || 'Agent',
          timestamp: new Date(item.timestamp || item.createdAt || Date.now()),
          metadata: item.metadata || {},
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch memories:', error);
      return [];
    }
  }

  public async fetchMemoriesFromRoom(roomId: string, limit: number = 50): Promise<TauriMessage[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_memories_from_room', {
        roomId,
        count: limit,
      });

      // Convert response to TauriMessage format
      if (Array.isArray(response)) {
        return response.map((item: any) => ({
          id: item.id || uuidv4(),
          content: item.content || item.text || '',
          type: item.type || 'system',
          authorId: item.userId || item.agentId || this.agentId,
          authorName: item.userName || item.agentName || 'Agent',
          timestamp: new Date(item.timestamp || item.createdAt || Date.now()),
          metadata: item.metadata || {},
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch memories from room:', error);
      return [];
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();
export default chatService;
