/**
 * TauriService - Comprehensive Tauri IPC service
 * Replaces all WebSocket/API client usage with native Tauri IPC
 */

import { v4 as uuidv4 } from 'uuid';

export interface TauriMessage {
  id: string;
  content: string;
  type: 'user' | 'agent' | 'system' | 'error';
  authorId: string;
  authorName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TauriKnowledgeFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  content?: string;
  status: 'processing' | 'ready' | 'error';
}

export interface TauriGoal {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'paused';
  progress: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface TauriTodo {
  id: string;
  task: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TauriMemory {
  id: string;
  content: string;
  timestamp: Date;
  type: string;
  tags?: string[];
  embedding?: number[];
}

export interface TauriPlugin {
  id: string;
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

export interface AgentSettings {
  autonomy: boolean;
  capabilities: {
    shellAccess: boolean;
    webAccess: boolean;
    visionAccess: boolean;
    speechToText: boolean;
    textToSpeech: boolean;
  };
  modelProvider: string;
  apiKeys: Record<string, string>;
}

export interface StartupStatus {
  stage: string;
  message: string;
  progress: number;
  isLoading: boolean;
  error?: string;
}

export interface ContainerStatus {
  name: string;
  state: string;
  health: string;
  uptime: number;
  restart_count: number;
}

class TauriServiceClass {
  private tauriInvoke: any = null;
  private tauriListen: any = null;
  private isTauri: boolean = true;
  private userId: string;
  private agentId: string = '2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f';
  private messageListeners: Set<(message: TauriMessage) => void> = new Set();
  private statusListeners: Set<(status: StartupStatus) => void> = new Set();
  private unlistenFns: Array<() => void> = [];

  constructor() {
    this.userId = localStorage.getItem('game-user-id') || uuidv4();
    localStorage.setItem('game-user-id', this.userId);
    this.initialize();
  }

  public async initialize(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');

    this.tauriInvoke = invoke;
    this.tauriListen = listen;

    console.log('[TauriService] Initialized');
    await this.setupEventListeners();
  }

  private async setupEventListeners(): Promise<void> {
    // Listen for incoming messages from the agent
    const unlistenMessage = await this.tauriListen('agent-message', (event: any) => {
      console.log('[TauriService] Received agent message:', event.payload);
      const message = event.payload as TauriMessage;
      this.messageListeners.forEach(listener => listener(message));
    });
    this.unlistenFns.push(unlistenMessage);

    // Listen for startup status updates
    const unlistenStatus = await this.tauriListen('startup-status', (event: any) => {
      console.log('[TauriService] Startup status update:', event.payload);
      const status = event.payload as StartupStatus;
      this.statusListeners.forEach(listener => listener(status));
    });
    this.unlistenFns.push(unlistenStatus);

    // Listen for WebSocket events
    const unlistenWsEvent = await this.tauriListen('websocket-event', (event: any) => {
      console.log('[TauriService] WebSocket event:', event.payload);

      if (event.payload.type === 'message') {
        const data = event.payload.data;

        if (data.type === 'agent-message' && data.message) {
          const messageData = data.message;
          const message: TauriMessage = {
            id: messageData.id || uuidv4(),
            content: messageData.content || messageData.text || '',
            type: 'agent',
            authorId: messageData.userId || messageData.author || this.agentId,
            authorName: messageData.name || 'Agent',
            timestamp: messageData.timestamp ? new Date(messageData.timestamp) : new Date(),
            metadata: messageData.metadata || {}
          };
          this.messageListeners.forEach(listener => listener(message));
        }
      }
    });
    this.unlistenFns.push(unlistenWsEvent);

    // Listen for real-time updates from the Rust WebSocket manager
    const unlistenRealtimeUpdate = await this.tauriListen('realtime-update', (event: any) => {
      console.log('[TauriService] Realtime update:', event.payload);
      // Handle different types of realtime updates
      if (event.payload.type === 'message') {
        const message = event.payload.data as TauriMessage;
        this.messageListeners.forEach(listener => listener(message));
      }
    });
    this.unlistenFns.push(unlistenRealtimeUpdate);

    // Listen for WebSocket errors
    const unlistenWsError = await this.tauriListen('websocket-error', (event: any) => {
      console.log('[TauriService] WebSocket error:', event.payload);
      
      // Create an error message to display in the chat
      const errorMessage: TauriMessage = {
        id: uuidv4(),
        content: event.payload.message || event.payload.error || 'WebSocket error occurred',
        type: 'error',
        authorId: 'system',
        authorName: 'System',
        timestamp: event.payload.timestamp ? new Date(event.payload.timestamp) : new Date(),
        metadata: event.payload
      };
      
      // Only emit error messages that aren't related to user messages
      // (to avoid duplicating user messages as errors)
      if (!errorMessage.content.includes('Failed to process message')) {
        this.messageListeners.forEach(listener => listener(errorMessage));
      }
    });
    this.unlistenFns.push(unlistenWsError);
  }

  public isRunningInTauri(): boolean {
    return this.isTauri;
  }

  public getUserId(): string {
    return this.userId;
  }

  public getAgentId(): string {
    return this.agentId;
  }

  // Event subscription methods
  public onMessage(listener: (message: TauriMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStatusUpdate(listener: (status: StartupStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // Clean up event listeners
  public destroy(): void {
    this.unlistenFns.forEach(fn => fn());
    this.unlistenFns = [];
    this.messageListeners.clear();
    this.statusListeners.clear();
  }

  // WebSocket management
  public async connectWebSocket(url: string = 'ws://localhost:7777'): Promise<void> {
    await this.tauriInvoke('connect_websocket', { url });
  }

  public async disconnectWebSocket(): Promise<void> {
    await this.tauriInvoke('disconnect_websocket');
  }

  public async joinChannel(channelId: string): Promise<void> {
    await this.tauriInvoke('websocket_join_channel', { channel_id: channelId });
  }

  public async isWebSocketConnected(): Promise<boolean> {
    return await this.tauriInvoke('is_websocket_connected');
  }

  // Message handling
  public async sendMessage(content: string): Promise<string> {
    console.log('[TauriService] Sending message via IPC:', content);
    const response = await this.tauriInvoke('send_message_to_agent', {
      message: content
    });

    // Create user message for immediate UI feedback
    const userMessage: TauriMessage = {
      id: uuidv4(),
      content,
      type: 'user',
      authorId: this.userId,
      authorName: 'User',
      timestamp: new Date(),
      metadata: {}
    };

    // Notify listeners of the user message
    this.messageListeners.forEach(listener => listener(userMessage));

    return response;
  }

  // Capability management
  public async getCapabilities(): Promise<any> {
    return await this.tauriInvoke('get_capabilities');
  }

  public async updateCapability(capability: string, enabled: boolean): Promise<void> {
    await this.tauriInvoke('update_capability', { capability, enabled });
  }

  // Settings management
  public async getSettings(): Promise<AgentSettings> {
    return await this.tauriInvoke('get_settings');
  }

  public async updateSettings(settings: Partial<AgentSettings>): Promise<void> {
    await this.tauriInvoke('update_settings', { settings });
  }

  // Health check
  public async checkAgentHealth(): Promise<any> {
    try {
      return await this.tauriInvoke('health_check');
    } catch (error) {
      console.warn('[TauriService] Health check failed:', error);
      return null;
    }
  }

  // Container management
  public async getContainerStatus(): Promise<ContainerStatus[]> {
    return await this.tauriInvoke('get_container_status');
  }

  public async restartContainer(name: string): Promise<void> {
    await this.tauriInvoke('restart_container', { name });
  }

  // Server operations
  public async checkServerStatus(): Promise<boolean> {
    const status = await this.tauriInvoke('check_server_status');
    return status === 'running';
  }

  public async startServer(): Promise<void> {
    await this.tauriInvoke('start_server');
  }

  public async stopServer(): Promise<void> {
    await this.tauriInvoke('stop_server');
  }

  // Data fetching methods

  public async fetchGoals(): Promise<TauriGoal[]> {
    const response = await this.tauriInvoke('fetch_goals');
    if (response.success && response.data) {
      return response.data.goals || [];
    }
    return [];
  }

  public async fetchTodos(): Promise<TauriTodo[]> {
    const response = await this.tauriInvoke('fetch_todos');
    if (response.success && response.data) {
      return response.data.todos || [];
    }
    return [];
  }

  public async fetchKnowledgeFiles(): Promise<TauriKnowledgeFile[]> {
    const response = await this.tauriInvoke('fetch_knowledge_files');
    if (response.success && response.data) {
      return response.data.files || [];
    }
    return [];
  }

  public async uploadKnowledgeFile(file: File): Promise<void> {
    // Convert file to base64 for transport through Tauri IPC
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
    });
    reader.readAsDataURL(file);

    const base64Content = await base64Promise;

    await this.tauriInvoke('upload_knowledge_file', {
      fileName: file.name,
      content: base64Content,
      mimeType: file.type
    });
  }

  public async deleteKnowledgeFile(fileId: string): Promise<void> {
    await this.tauriInvoke('delete_knowledge_file', { fileId });
  }

  public async fetchMemories(limit: number = 50): Promise<TauriMessage[]> {
    const memories = await this.tauriInvoke('fetch_memories', { params: { count: limit } });

    // Convert memories to TauriMessage format
    return memories.map((memory: any) => ({
      id: memory.id || uuidv4(),
      content: memory.content?.text || memory.content || '',
      type: memory.userId === this.userId ? 'user' : 'agent',
      authorId: memory.userId || memory.authorId || 'unknown',
      authorName: memory.userId === this.userId ? 'User' : 'Agent',
      timestamp: memory.timestamp ? new Date(memory.timestamp) : new Date(memory.createdAt || Date.now()),
      metadata: memory.metadata || {}
    }));
  }

  public async fetchMemoriesFromRoom(roomId: string, limit: number = 50): Promise<TauriMessage[]> {
    const memories = await this.tauriInvoke('fetch_memories', { params: { roomId, count: limit } });

    // Convert memories to TauriMessage format
    return memories.map((memory: any) => ({
      id: memory.id || uuidv4(),
      content: memory.content?.text || memory.content || '',
      type: memory.userId === this.userId ? 'user' : 'agent',
      authorId: memory.userId || memory.authorId || 'unknown',
      authorName: memory.userId === this.userId ? 'User' : 'Agent',
      timestamp: memory.timestamp ? new Date(memory.timestamp) : new Date(memory.createdAt || Date.now()),
      metadata: memory.metadata || {}
    }));
  }

  public async fetchPlugins(): Promise<TauriPlugin[]> {
    const response = await this.tauriInvoke('fetch_plugins');
    if (response.success && response.data) {
      return response.data.plugins || [];
    }
    return [];
  }

  public async updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<void> {
    await this.tauriInvoke('update_plugin_config', { pluginId, config });
  }

  public async togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
    await this.tauriInvoke('toggle_plugin', { pluginId, enabled });
  }

  // Additional plugin configuration methods
  public async fetchPluginConfigs(): Promise<any> {
    const response = await this.tauriInvoke('fetch_plugin_configs');
    if (response.success && response.data) {
      return response.data;
    }
    return { plugins: [] };
  }

  // Configuration operations
  public async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    return await this.tauriInvoke('validate_configuration');
  }

  public async testConfiguration(): Promise<{ success: boolean; results: any }> {
    return await this.tauriInvoke('test_configuration');
  }

  public async saveConfiguration(config: any): Promise<void> {
    await this.tauriInvoke('save_configuration', { config });
  }

  public async loadConfiguration(): Promise<any> {
    return await this.tauriInvoke('load_configuration');
  }

  // Dynamic Configuration Management
  public async getAgentConfiguration(): Promise<any> {
    return await this.tauriInvoke('get_agent_configuration');
  }

  public async updateAgentConfiguration(updates: Record<string, any>): Promise<any> {
    return await this.tauriInvoke('update_agent_configuration', { config_updates: updates });
  }

  public async getAvailableProviders(): Promise<any> {
    return await this.tauriInvoke('get_available_providers');
  }

  // Autonomy management
  public async toggleAutonomy(enabled: boolean): Promise<void> {
    await this.tauriInvoke('toggle_autonomy', { enabled });
  }

  public async getAutonomyStatus(): Promise<{ enabled: boolean; interval: number }> {
    return await this.tauriInvoke('get_autonomy_status');
  }

  // Alias for compatibility with GameInterface
  public async fetchAutonomyStatus(): Promise<any> {
    const response = await this.tauriInvoke('fetch_autonomy_status');
    if (response.success && response.data) {
      return response.data;
    }
    return { enabled: false, running: false, interval: 5000 };
  }

  // Shell/browser capability management
  public async toggleCapability(capability: string): Promise<void> {
    await this.tauriInvoke('toggle_capability', { capability });
  }

  public async getCapabilityStatus(capability: string): Promise<{ enabled: boolean; service_available: boolean }> {
    return await this.tauriInvoke('get_capability_status', { capability });
  }

  // Vision settings management
  public async getVisionSettings(): Promise<any> {
    return await this.tauriInvoke('get_vision_settings');
  }

  public async updateVisionSettings(settings: any): Promise<void> {
    await this.tauriInvoke('update_vision_settings', { settings });
  }

  public async updateAgentSetting(key: string, value: any): Promise<void> {
    await this.tauriInvoke('update_agent_setting', { key, value });
  }

  public async getAgentSettings(): Promise<any> {
    return await this.tauriInvoke('get_agent_settings');
  }

  public async refreshVisionService(): Promise<void> {
    await this.tauriInvoke('refresh_vision_service');
  }

  // Agent management
  public async resetAgent(): Promise<void> {
    await this.tauriInvoke('reset_agent');
  }

  public async getAgentInfo(): Promise<{ id: string; name: string; version: string }> {
    return await this.tauriInvoke('get_agent_info');
  }

  // Database operations
  public async fetchDatabaseTables(): Promise<string[]> {
    const response = await this.tauriInvoke('fetch_db_tables');
    if (response.success && response.data) {
      return response.data.tables || [];
    }
    return [];
  }

  public async fetchDatabaseTableData(table: string, page: number = 1, limit: number = 50): Promise<any> {
    const response = await this.tauriInvoke('fetch_db_table_data', { table, page, limit });
    if (response.success && response.data) {
      return response.data;
    }
    return { data: [], total: 0, page: 1, limit };
  }

  public async fetchDatabaseStats(): Promise<any> {
    const response = await this.tauriInvoke('fetch_db_stats');
    if (response.success && response.data) {
      return response.data;
    }
    return { connections: 0, queries: 0, uptime: 0 };
  }

  // Frontend helper methods for API proxy
  public async proxyApiRequest(method: string, path: string, body?: any): Promise<any> {
    return await this.tauriInvoke('proxy_api_request', { method, path, body });
  }

  // Plugin HTTP routes
  public async fetchPluginRoutes(): Promise<Array<{ name: string; path: string; display_name?: string }>> {
    const response = await this.tauriInvoke('fetch_plugin_routes');
    if (response.success && response.data) {
      return response.data.routes || [];
    }
    return [];
  }

  public async fetchTabContent(route: string): Promise<string> {
    const response = await this.tauriInvoke('fetch_tab_content', { route });
    if (response.success && response.data) {
      return response.data.content || '';
    }
    return '';
  }
}

// Export singleton instance
export const TauriService = new TauriServiceClass();
export default TauriService;
