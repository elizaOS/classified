/**
 * TauriIPCService - Bridge between frontend and Tauri backend
 * Uses IPC for direct communication with the Rust backend
 */

type InvokeFunction = (cmd: string, args?: any) => Promise<any>;
type ListenFunction = (event: string, handler: (event: any) => void) => Promise<() => void>;

export class TauriIPCServiceClass {
  private invoke: InvokeFunction | null = null;
  private listen: ListenFunction | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');
    this.invoke = invoke;
    this.listen = listen;
    console.log('[TauriIPCService] Tauri IPC initialized');
  }

  public isAvailable(): boolean {
    return this.invoke !== null;
  }

  // Messaging
  public async sendMessage(content: string): Promise<any> {
    return await this.invoke!('send_message', { content });
  }

  public async fetchMessages(channelId: string, limit?: number): Promise<any> {
    return await this.invoke!('fetch_messages', { channelId, limit });
  }

  // Data fetching methods
  public async fetchGoals(): Promise<any> {
    return await this.invoke!('fetch_goals');
  }

  public async fetchTodos(): Promise<any> {
    return await this.invoke!('fetch_todos');
  }

  public async fetchKnowledgeFiles(): Promise<any> {
    return await this.invoke!('fetch_knowledge_files');
  }

  public async deleteKnowledgeFile(fileId: string): Promise<any> {
    return await this.invoke!('delete_knowledge_file', { fileId });
  }

  // Plugin configuration
  public async fetchPluginConfigs(): Promise<any> {
    return await this.invoke!('fetch_plugin_configs');
  }

  public async updatePluginConfig(plugin: string, config: Record<string, any>): Promise<any> {
    return await this.invoke!('update_plugin_config', { plugin, config });
  }

  // Configuration
  public async validateConfiguration(): Promise<any> {
    return await this.invoke!('validate_configuration');
  }

  public async testConfiguration(): Promise<any> {
    return await this.invoke!('test_configuration');
  }

  // Database operations
  public async fetchDbTables(): Promise<any> {
    return await this.invoke!('fetch_db_tables');
  }

  public async fetchDbTableData(table: string, page?: number, limit?: number): Promise<any> {
    return await this.invoke!('fetch_db_table_data', { table, page, limit });
  }

  public async fetchDbStats(): Promise<any> {
    return await this.invoke!('fetch_db_stats');
  }

  // Agent operations
  public async resetAgent(): Promise<any> {
    return await this.invoke!('reset_agent');
  }

  // Autonomy management
  public async toggleAutonomy(enabled: boolean): Promise<any> {
    return await this.invoke!('toggle_autonomy', { enabled });
  }

  public async getAutonomyStatus(): Promise<any> {
    return await this.invoke!('get_autonomy_status');
  }

  // Memory management
  public async fetchMemories(params: any): Promise<any> {
    return await this.invoke!('fetch_memories', params);
  }

  // Capability management
  public async toggleCapability(capability: string): Promise<any> {
    return await this.invoke!('toggle_capability', { capability });
  }

  public async getCapabilityStatus(capability: string): Promise<any> {
    return await this.invoke!('get_capability_status', { capability });
  }

  // Vision settings
  public async getVisionSettings(): Promise<any> {
    return await this.invoke!('get_vision_settings');
  }

  public async refreshVisionService(): Promise<any> {
    return await this.invoke!('refresh_vision_service');
  }

  // Agent settings
  public async getAgentSettings(): Promise<any> {
    return await this.invoke!('get_agent_settings');
  }

  public async updateAgentSetting(key: string, value: any): Promise<any> {
    return await this.invoke!('update_agent_setting', { key, value });
  }

  // Health check
  public async healthCheck(): Promise<any> {
    return await this.invoke!('health_check');
  }
}

// Export singleton instance
export const tauriIPCService = new TauriIPCServiceClass();
export default tauriIPCService;
