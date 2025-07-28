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
  metadata?: any;
}

export interface TauriGoal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface TauriTodo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface TauriAgentStatus {
  name: string;
  status: 'online' | 'offline' | 'thinking';
  lastThought?: string;
  lastAction?: string;
  currentGoal?: string;
}

export interface TauriKnowledgeFile {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StartupStatus {
  phase: string;
  message: string;
  progress?: number;
  isComplete?: boolean;
  error?: string;
}

export interface ContainerStatus {
  containerRunning: boolean;
  agentHealthy: boolean;
  ollamaHealthy: boolean;
  logs: string[];
}

export interface ContainerLog {
  timestamp: Date;
  service: string;
  message: string;
  level?: 'info' | 'warn' | 'error';
}

export interface CapabilityStatus {
  enabled: boolean;
  status?: 'active' | 'inactive' | 'error';
  error?: string;
  lastUsed?: string;
  metadata?: any;
}

export interface MemoryQuery {
  type?: 'knowledge' | 'conversation' | 'goal' | 'user' | 'relationship';
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'importance';
  orderDirection?: 'asc' | 'desc';
}

export interface MemoryResult {
  id: string;
  type: string;
  content: string;
  createdAt: Date;
  importance?: number;
  metadata?: any;
}

class TauriServiceClass {
  private tauriInvoke: any = null;
  private tauriListen: any = null;
  private isTauri: boolean = false;
  private messageListeners: Set<(message: TauriMessage) => void> = new Set();
  private statusListeners: Set<(status: StartupStatus) => void> = new Set();
  private containerLogListeners: Set<(log: ContainerLog) => void> = new Set();
  private unlistenFns: Array<() => void> = [];
  private userId: string;
  private agentId: string = '2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f';
  private isInitialized = false;
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    this.userId = localStorage.getItem('game-user-id') || uuidv4();
    localStorage.setItem('game-user-id', this.userId);

    // Try to initialize Tauri immediately
    this.checkAndInitializeTauri();
  }

  private async checkAndInitializeTauri(): Promise<void> {
    try {
      // Try to import Tauri v2 APIs
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // If imports succeed, we're in Tauri environment
      this.tauriInvoke = invoke;
      this.tauriListen = listen;
      this.isTauri = true;

      // Set up event listeners
      await this.setupEventListeners();
      this.isInitialized = true;
    } catch (error) {
      // Import failed - not in Tauri environment
      this.isTauri = false;
      this.isInitialized = false;
    }
  }

  public async initialize(): Promise<void> {
    // This method is now called by components to ensure initialization
    if (this.isInitialized) return;

    // Try again in case it failed initially
    await this.checkAndInitializeTauri();
  }

  private async setupEventListeners(): Promise<void> {
    // Helper function to emit message with deduplication
    const emitMessage = (message: TauriMessage, _source: string) => {
      // Ensure message has an ID
      if (!message.id) {
        message.id = uuidv4();
      }

      // Check if we've already processed this message
      if (this.processedMessageIds.has(message.id)) {
        return;
      }

      // Add to processed set
      this.processedMessageIds.add(message.id);

      // Clean up old message IDs to prevent memory leak (keep last 1000)
      if (this.processedMessageIds.size > 1000) {
        const idsArray = Array.from(this.processedMessageIds);
        const toRemove = idsArray.slice(0, idsArray.length - 1000);
        toRemove.forEach((id) => this.processedMessageIds.delete(id));
      }

      this.messageListeners.forEach((listener) => listener(message));
    };

    // Listen for incoming messages from the agent
    const unlistenMessage = await this.tauriListen('agent-message', (event: any) => {
      const message = event.payload as TauriMessage;
      // Ensure type is set to 'agent' for agent messages
      message.type = 'agent';
      emitMessage(message, 'agent-message');
    });
    this.unlistenFns.push(unlistenMessage);

    // Listen for startup status updates
    const unlistenStatus = await this.tauriListen('startup-status', (event: any) => {
      const status = event.payload as StartupStatus;
      this.statusListeners.forEach((listener) => listener(status));
    });
    this.unlistenFns.push(unlistenStatus);

    // Listen for WebSocket events
    const unlistenWsEvent = await this.tauriListen('websocket-event', (event: any) => {
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
            metadata: messageData.metadata || {},
          };
          emitMessage(message, 'websocket-event');
        }
      }
    });
    this.unlistenFns.push(unlistenWsEvent);

    // Listen for real-time updates from the Rust WebSocket manager
    const unlistenRealtimeUpdate = await this.tauriListen('realtime-update', (event: any) => {
      // Handle different types of realtime updates
      if (event.payload.type === 'message') {
        const message = event.payload.data as TauriMessage;
        // If type isn't set and it's from the agent, set it to 'agent'
        if (!message.type && message.authorId === this.agentId) {
          message.type = 'agent';
        }
        emitMessage(message, 'realtime-update');
      }
    });
    this.unlistenFns.push(unlistenRealtimeUpdate);

    // Listen for WebSocket errors
    const unlistenWsError = await this.tauriListen('websocket-error', (event: any) => {
      // Create an error message to display in the chat
      const errorMessage: TauriMessage = {
        id: uuidv4(),
        content: event.payload.message || event.payload.error || 'WebSocket error occurred',
        type: 'error',
        authorId: 'system',
        authorName: 'System',
        timestamp: event.payload.timestamp ? new Date(event.payload.timestamp) : new Date(),
        metadata: event.payload,
      };

      // Only emit error messages that aren't related to user messages
      // (to avoid duplicating user messages as errors)
      if (!errorMessage.content.includes('Failed to process message')) {
        this.messageListeners.forEach((listener) => listener(errorMessage));
      }
    });
    this.unlistenFns.push(unlistenWsError);

    // Listen for container logs
    const unlistenContainerLog = await this.tauriListen('container-log', (event: any) => {
      const log = event.payload as ContainerLog;
      this.containerLogListeners.forEach((listener) => listener(log));
    });
    this.unlistenFns.push(unlistenContainerLog);
  }

  private async ensureInitializedAndInvoke(command: string, args?: any): Promise<any> {
    // Ensure we're initialized before trying to invoke
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.tauriInvoke) {
      throw new Error(
        'Tauri is not available. Please ensure you are running this application through Tauri.'
      );
    }

    return this.tauriInvoke(command, args);
  }

  public isRunningInTauri(): boolean {
    return this.isTauri;
  }

  public getInitializationStatus(): { isTauri: boolean; isInitialized: boolean } {
    return {
      isTauri: this.isTauri,
      isInitialized: this.isInitialized,
    };
  }

  public async ensureInitialized(): Promise<boolean> {
    if (this.isInitialized) return true;

    // Try to detect and initialize again
    await this.checkAndInitializeTauri();

    // Wait a bit for initialization
    await new Promise((resolve) => setTimeout(resolve, 200));

    return this.isInitialized;
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

  public onContainerLog(listener: (log: ContainerLog) => void): () => void {
    this.containerLogListeners.add(listener);
    return () => this.containerLogListeners.delete(listener);
  }

  // Clean up event listeners
  public destroy(): void {
    this.unlistenFns.forEach((fn) => fn());
    this.unlistenFns = [];
    this.messageListeners.clear();
    this.statusListeners.clear();
    this.containerLogListeners.clear();
  }

  // WebSocket management
  public async connectWebSocket(url: string = 'ws://localhost:7777'): Promise<void> {
    await this.ensureInitializedAndInvoke('connect_websocket', { url });
  }

  public async disconnectWebSocket(): Promise<void> {
    await this.ensureInitializedAndInvoke('disconnect_websocket');
  }

  public async joinChannel(channelId: string): Promise<void> {
    await this.ensureInitializedAndInvoke('websocket_join_channel', { channel_id: channelId });
  }

  public async isWebSocketConnected(): Promise<boolean> {
    return await this.ensureInitializedAndInvoke('is_websocket_connected');
  }

  // Message handling
  public async sendMessage(content: string): Promise<string> {
    const response = await this.ensureInitializedAndInvoke('send_message_to_agent', {
      message: content,
    });

    // Create user message for immediate UI feedback
    const userMessage: TauriMessage = {
      id: uuidv4(),
      content,
      type: 'user',
      authorId: this.userId,
      authorName: 'User',
      timestamp: new Date(),
      metadata: {},
    };

    // Notify listeners of the user message
    this.messageListeners.forEach((listener) => listener(userMessage));

    return response;
  }

  // Capability management
  public async getCapabilities(): Promise<any> {
    return await this.ensureInitializedAndInvoke('get_capabilities');
  }

  public async updateCapability(capability: string, enabled: boolean): Promise<void> {
    await this.ensureInitializedAndInvoke('update_capability', { capability, enabled });
  }

  // Settings management
  public async getSettings(): Promise<any> {
    return await this.ensureInitializedAndInvoke('get_settings');
  }

  public async updateSettings(settings: Partial<any>): Promise<void> {
    await this.ensureInitializedAndInvoke('update_settings', { settings });
  }

  // Health check
  public async checkAgentHealth(): Promise<any> {
    try {
      return await this.ensureInitializedAndInvoke('health_check');
    } catch (error) {
      console.warn('[TauriService] Health check failed:', error);
      return null;
    }
  }

  // Container management
  public async getContainerStatus(): Promise<ContainerStatus[]> {
    return await this.ensureInitializedAndInvoke('get_container_status');
  }

  public async restartContainer(name: string): Promise<void> {
    await this.ensureInitializedAndInvoke('restart_container', { name });
  }

  // Server operations
  public async checkServerStatus(): Promise<boolean> {
    const status = await this.ensureInitializedAndInvoke('check_server_status');
    return status === 'running';
  }

  public async startServer(): Promise<void> {
    await this.ensureInitializedAndInvoke('start_server');
  }

  public async stopServer(): Promise<void> {
    await this.ensureInitializedAndInvoke('stop_server');
  }

  // Data fetching methods

  public async fetchGoals(): Promise<TauriGoal[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_goals');
    if (response.success && response.data) {
      return response.data.goals || [];
    }
    return [];
  }

  public async fetchTodos(): Promise<TauriTodo[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_todos');
    if (response.success && response.data) {
      return response.data.todos || [];
    }
    return [];
  }

  public async createGoal(name: string, description: string, metadata?: any): Promise<void> {
    await this.ensureInitializedAndInvoke('create_goal', {
      name,
      description,
      metadata: metadata || {},
    });
  }

  public async createTodo(
    name: string,
    description?: string,
    priority?: number,
    todoType?: string
  ): Promise<void> {
    await this.ensureInitializedAndInvoke('create_todo', {
      name,
      description,
      priority: priority || 1,
      todo_type: todoType || 'one-off',
    });
  }

  public async fetchKnowledgeFiles(): Promise<TauriKnowledgeFile[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_knowledge_files');
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

    await this.ensureInitializedAndInvoke('upload_knowledge_file', {
      fileName: file.name,
      content: base64Content,
      mimeType: file.type,
    });
  }

  public async deleteKnowledgeFile(fileId: string): Promise<void> {
    await this.ensureInitializedAndInvoke('delete_knowledge_file', { fileId });
  }

  public async fetchMemories(limit: number = 50): Promise<TauriMessage[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_memories', {
      params: { count: limit },
    });

    // Handle different response formats
    let memories = response;

    // If response is wrapped in an object (e.g., { memories: [...] } or { data: [...] })
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      memories = response.memories || response.data || [];
    }

    // Ensure memories is an array
    if (!Array.isArray(memories)) {
      console.warn(
        '[TauriService] fetchMemories: Expected array but got:',
        typeof memories,
        memories
      );
      return [];
    }

    // Convert memories to TauriMessage format
    return memories.map((memory: any) => ({
      id: memory.id || uuidv4(),
      content: memory.content?.text || memory.content || '',
      type: memory.userId === this.userId ? 'user' : 'agent',
      authorId: memory.userId || memory.authorId || 'unknown',
      authorName: memory.userId === this.userId ? 'User' : 'Agent',
      timestamp: memory.timestamp
        ? new Date(memory.timestamp)
        : new Date(memory.createdAt || Date.now()),
      metadata: memory.metadata || {},
    }));
  }

  public async fetchMemoriesFromRoom(roomId: string, limit: number = 50): Promise<TauriMessage[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_memories', {
      params: { roomId, count: limit },
    });

    // Handle different response formats
    let memories = response;

    // If response is wrapped in an object (e.g., { memories: [...] } or { data: [...] })
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      memories = response.memories || response.data || [];
    }

    // Ensure memories is an array
    if (!Array.isArray(memories)) {
      console.warn(
        '[TauriService] fetchMemoriesFromRoom: Expected array but got:',
        typeof memories,
        memories
      );
      return [];
    }

    // Convert memories to TauriMessage format
    return memories.map((memory: any) => ({
      id: memory.id || uuidv4(),
      content: memory.content?.text || memory.content || '',
      type: memory.userId === this.userId ? 'user' : 'agent',
      authorId: memory.userId || memory.authorId || 'unknown',
      authorName: memory.userId === this.userId ? 'User' : 'Agent',
      timestamp: memory.timestamp
        ? new Date(memory.timestamp)
        : new Date(memory.createdAt || Date.now()),
      metadata: memory.metadata || {},
    }));
  }

  public async fetchPlugins(): Promise<any[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_plugins');
    if (response.success && response.data) {
      return response.data.plugins || [];
    }
    return [];
  }

  public async updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<void> {
    await this.ensureInitializedAndInvoke('update_plugin_config', { pluginId, config });
  }

  public async togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
    await this.ensureInitializedAndInvoke('toggle_plugin', { pluginId, enabled });
  }

  // Additional plugin configuration methods
  public async fetchPluginConfigs(): Promise<any> {
    const response = await this.ensureInitializedAndInvoke('fetch_plugin_configs');
    if (response.success && response.data) {
      return response.data;
    }
    return { plugins: [] };
  }

  // Configuration operations
  public async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    return await this.ensureInitializedAndInvoke('validate_configuration');
  }

  public async testConfiguration(): Promise<{ success: boolean; results: any }> {
    return await this.ensureInitializedAndInvoke('test_configuration');
  }

  public async saveConfiguration(config: any): Promise<void> {
    await this.ensureInitializedAndInvoke('save_configuration', { config });
  }

  public async loadConfiguration(): Promise<any> {
    return await this.ensureInitializedAndInvoke('load_configuration');
  }

  // Dynamic Configuration Management
  public async getAgentConfiguration(): Promise<any> {
    return await this.ensureInitializedAndInvoke('get_agent_configuration');
  }

  public async updateAgentConfiguration(updates: Record<string, any>): Promise<any> {
    return await this.ensureInitializedAndInvoke('update_agent_configuration', {
      config_updates: updates,
    });
  }

  public async getAvailableProviders(): Promise<any> {
    return await this.ensureInitializedAndInvoke('get_available_providers');
  }

  // Autonomy management
  public async toggleAutonomy(enabled: boolean): Promise<void> {
    await this.ensureInitializedAndInvoke('toggle_autonomy', { enabled });
  }

  public async getAutonomyStatus(): Promise<{ enabled: boolean; interval: number }> {
    return await this.ensureInitializedAndInvoke('get_autonomy_status');
  }

  // Alias for compatibility with GameInterface
  public async fetchAutonomyStatus(): Promise<any> {
    const response = await this.ensureInitializedAndInvoke('fetch_autonomy_status');
    if (response.success && response.data) {
      return response.data;
    }
    return { enabled: false, running: false, interval: 5000 };
  }

  // Shell/browser capability management
  public async toggleCapability(capability: string): Promise<void> {
    await this.ensureInitializedAndInvoke('toggle_capability', { capability });
  }

  public async getCapabilityStatus(
    capability: string
  ): Promise<{ enabled: boolean; service_available: boolean }> {
    return await this.ensureInitializedAndInvoke('get_capability_status', { capability });
  }

  // Vision settings management
  public async getVisionSettings(): Promise<any> {
    return await this.ensureInitializedAndInvoke('get_vision_settings');
  }

  public async updateVisionSettings(settings: any): Promise<void> {
    await this.ensureInitializedAndInvoke('update_vision_settings', { settings });
  }

  public async updateAgentSetting(key: string, value: any): Promise<void> {
    await this.ensureInitializedAndInvoke('update_agent_setting', { key, value });
  }

  public async getAgentSettings(): Promise<any> {
    return await this.ensureInitializedAndInvoke('get_agent_settings');
  }

  public async refreshVisionService(): Promise<void> {
    await this.ensureInitializedAndInvoke('refresh_vision_service');
  }

  // Agent management
  public async resetAgent(): Promise<void> {
    await this.ensureInitializedAndInvoke('reset_agent');
  }

  public async fetchLogs(logType?: string, limit?: number): Promise<any[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_logs', {
      log_type: logType,
      limit: limit || 100,
    });
    if (response.success && response.data) {
      return response.data.logs || [];
    }
    return [];
  }

  public async getAgentInfo(): Promise<{ id: string; name: string; version: string }> {
    return await this.ensureInitializedAndInvoke('get_agent_info');
  }

  // Database operations
  public async fetchDatabaseTables(): Promise<string[]> {
    const response = await this.ensureInitializedAndInvoke('fetch_db_tables');
    if (response.success && response.data) {
      return response.data.tables || [];
    }
    return [];
  }

  public async fetchDatabaseTableData(
    table: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const response = await this.ensureInitializedAndInvoke('fetch_db_table_data', {
      table,
      page,
      limit,
    });
    if (response.success && response.data) {
      return response.data;
    }
    return { data: [], total: 0, page: 1, limit };
  }

  public async fetchDatabaseStats(): Promise<any> {
    const response = await this.ensureInitializedAndInvoke('fetch_db_stats');
    if (response.success && response.data) {
      return response.data;
    }
    return { connections: 0, queries: 0, uptime: 0 };
  }

  // Frontend helper methods for API proxy
  public async proxyApiRequest(method: string, path: string, body?: any): Promise<any> {
    return await this.ensureInitializedAndInvoke('proxy_api_request', { method, path, body });
  }

  // Plugin HTTP routes
  public async fetchPluginRoutes(): Promise<
    Array<{ name: string; path: string; display_name?: string }>
  > {
    const response = await this.ensureInitializedAndInvoke('fetch_plugin_routes');
    if (response.success && response.data) {
      return response.data.routes || [];
    }
    return [];
  }

  public async fetchTabContent(route: string): Promise<string> {
    const response = await this.ensureInitializedAndInvoke('fetch_tab_content', { route });
    if (response.success && response.data) {
      return response.data.content || '';
    }
    return '';
  }
}

// Export singleton instance
export const TauriService = new TauriServiceClass();
export default TauriService;
