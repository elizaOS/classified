/**
 * ElizaService - Communicates with the agent through Tauri IPC
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';

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

interface AgentMessageEvent {
  id: string;
  content: string;
  author: string;
  timestamp: number;
  channel_id?: string;
  message_type: string;
}

export class ElizaService {
  private userId: string;
  private agentId: string;
  private channelId: string | null = null;
  private messageListeners: ((message: ElizaMessage) => void)[] = [];
  private unlistenFn: UnlistenFn | null = null;

  constructor(_baseUrl: string, userId: string, agentId: string) {
    // baseUrl is ignored - we always go through Tauri
    this.userId = userId || uuidv4();
    this.agentId = agentId || '2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f';
    this.setupEventListeners();
  }

  private async setupEventListeners() {
    // Listen for agent messages from Tauri
    this.unlistenFn = await listen<AgentMessageEvent>('agent-message', (event) => {
      console.log('[ElizaService] Received agent message:', event.payload);

      const agentMessage: ElizaMessage = {
        id: event.payload.id || uuidv4(),
        content: event.payload.content,
        authorId: this.agentId,
        authorName: event.payload.author || 'ELIZA',
        timestamp: new Date(event.payload.timestamp || Date.now()),
        metadata: {
          channel_id: event.payload.channel_id,
          message_type: event.payload.message_type,
        },
      };

      // Notify all listeners
      this.messageListeners.forEach((listener) => listener(agentMessage));
    });

    // Also listen for WebSocket connection status
    await listen('websocket-connected', (event) => {
      console.log('[ElizaService] WebSocket connected:', event.payload);
    });
  }

  async ping(): Promise<boolean> {
    try {
      await invoke('health_check');
      return true;
    } catch {
      return false;
    }
  }

  async getOrCreateDmChannel(): Promise<ElizaChannel> {
    // For now, use a fixed channel ID that matches what the agent expects
    // In the future, this could create a proper DM channel
    this.channelId = 'ce5f41b4-fe24-4c01-9971-aecfed20a6bd'; // Autonomous thoughts room

    return {
      id: this.channelId,
      name: 'Game UI Channel',
      type: 'DM',
      serverId: '00000000-0000-0000-0000-000000000000',
    };
  }

  async getChannelMessages(_channelId: string): Promise<ElizaMessage[]> {
    // TODO: Implement message history retrieval through Tauri
    // For now, return empty array
    return [];
  }

  async sendMessage(_channelId: string, content: string): Promise<ElizaMessage> {
    try {
      // Send message through Tauri IPC
      const response = await invoke<string>('send_message_to_agent', {
        message: content,
      });

      // Create a message object for the UI
      const message: ElizaMessage = {
        id: uuidv4(),
        content: content,
        authorId: this.userId,
        authorName: 'User',
        timestamp: new Date(),
        metadata: {
          response: response,
        },
      };

      return message;
    } catch (error) {
      console.error('Failed to send message through Tauri:', error);
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  onMessage(listener: (message: ElizaMessage) => void): () => void {
    this.messageListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.messageListeners.indexOf(listener);
      if (index > -1) {
        this.messageListeners.splice(index, 1);
      }
    };
  }

  getUserId(): string {
    return this.userId;
  }

  getAgentId(): string {
    return this.agentId;
  }

  async cleanup() {
    if (this.unlistenFn) {
      this.unlistenFn();
    }
  }
}
