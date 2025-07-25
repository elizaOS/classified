/**
 * APIService
 * Automatically routes API calls through Tauri IPC or HTTP based on environment
 * This service provides a unified interface that works in both Tauri and browser environments
 */

import { tauriIPCService } from './TauriIPCService';

// API configuration - use environment variable or default
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || `http://localhost:${import.meta.env.VITE_BACKEND_PORT || '7777'}`;

class APIServiceClass {
  private get isTauri(): boolean {
    return typeof window !== 'undefined' &&
           ((window as any).__TAURI_INTERNALS__ || (window as any).isTauri || (window as any).__TAURI__);
  }


  private async httpFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Debug logging - only in development
    if (import.meta.env.DEV) {
      console.log('[APIService] HTTP call:', url);
    }

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  // Message sending
  public async sendMessage(message: string): Promise<string> {
    if (this.isTauri) {
      return await tauriIPCService.sendMessage(message);
    } else {
      // Fallback to HTTP (not implemented in original code)
      throw new Error('HTTP message sending not implemented - use WebSocket');
    }
  }

  // Goal management
  public async fetchGoals(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.fetchGoals();
    } else {
      return await this.httpFetch('/api/goals');
    }
  }

  // Todo management
  public async fetchTodos(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.fetchTodos();
    } else {
      return await this.httpFetch('/api/todos');
    }
  }

  // Knowledge management
  public async fetchKnowledgeFiles(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.fetchKnowledgeFiles();
    } else {
      return await this.httpFetch('/knowledge/documents');
    }
  }

  public async deleteKnowledgeFile(fileId: string): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.deleteKnowledgeFile(fileId);
    } else {
      return await this.httpFetch(`/knowledge/documents/${fileId}`, {
        method: 'DELETE',
      });
    }
  }

  public async uploadKnowledgeFile(file: File, agentId: string): Promise<any> {
    if (this.isTauri) {
      // TODO: Implement file upload through Tauri IPC
      throw new Error('File upload through Tauri IPC not yet implemented');
    } else {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agentId', agentId);

      const response = await fetch(`${API_BASE_URL}/knowledge/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    }
  }

  // Plugin configuration
  public async fetchPluginConfigs(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.fetchPluginConfigs();
    } else {
      return await this.httpFetch('/api/plugin-config');
    }
  }

  public async updatePluginConfig(plugin: string, config: any): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.updatePluginConfig(plugin, config);
    } else {
      return await this.httpFetch('/api/plugin-config', {
        method: 'POST',
        body: JSON.stringify({ plugin, config }),
      });
    }
  }

  // Configuration validation
  public async validateConfiguration(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.validateConfiguration();
    } else {
      return await this.httpFetch('/api/config/validate', {
        method: 'POST',
      });
    }
  }

  public async testConfiguration(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.testConfiguration();
    } else {
      return await this.httpFetch('/api/config/test', {
        method: 'POST',
      });
    }
  }

  // Agent management
  public async resetAgent(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.resetAgent();
    } else {
      return await this.httpFetch('/api/reset-agent', {
        method: 'POST',
      });
    }
  }

  // Autonomy management
  public async fetchAutonomyStatus(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.fetchAutonomyStatus();
    } else {
      return await this.httpFetch('/autonomy/status');
    }
  }

  public async toggleAutonomy(enabled: boolean): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.toggleAutonomy(enabled);
    } else {
      // Use capability service for HTTP
      return await this.httpFetch('/api/agents/default/capabilities/autonomy', {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
    }
  }

  public async getAutonomyStatus(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.getAutonomyStatus();
    } else {
      return await this.httpFetch('/api/agents/default/capabilities/autonomy');
    }
  }

  // Memory management
  public async fetchMemories(params: any): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.fetchMemories(params);
    } else {
      const query = new URLSearchParams(params).toString();
      return await this.httpFetch(`/api/memories?${query}`);
    }
  }

  // Capability management
  public async toggleCapability(capability: string): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.toggleCapability(capability);
    } else {
      return await this.httpFetch(`/api/agents/default/capabilities/${capability}`, {
        method: 'POST',
      });
    }
  }

  public async getCapabilityStatus(capability: string): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.getCapabilityStatus(capability);
    } else {
      return await this.httpFetch(`/api/agents/default/capabilities/${capability}`);
    }
  }

  // Vision settings
  public async getVisionSettings(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.getVisionSettings();
    } else {
      return await this.httpFetch('/api/agents/default/vision/settings');
    }
  }

  public async refreshVisionService(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.refreshVisionService();
    } else {
      return await this.httpFetch('/api/agents/default/vision/refresh', {
        method: 'POST',
      });
    }
  }

  // Agent settings
  public async getAgentSettings(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.getAgentSettings();
    } else {
      return await this.httpFetch('/api/agents/default/settings');
    }
  }

  public async updateAgentSetting(key: string, value: any): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.updateAgentSetting(key, value);
    } else {
      return await this.httpFetch('/api/agents/default/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      });
    }
  }

  // Health check
  public async healthCheck(): Promise<any> {
    if (this.isTauri) {
      return await tauriIPCService.healthCheck();
    } else {
      return await this.httpFetch('/api/server/health');
    }
  }
}

// Export singleton instance
export const apiService = new APIServiceClass();
export default apiService;
