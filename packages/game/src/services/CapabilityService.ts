/**
 * Service for managing agent capabilities and settings
 */

import { apiService } from './APIService';

export interface CapabilityStatus {
  enabled: boolean;
  service_available: boolean;
}

export interface AgentSetting {
  key: string;
  value: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class CapabilityService {
  private static instance: CapabilityService;

  public static getInstance(): CapabilityService {
    if (!CapabilityService.instance) {
      CapabilityService.instance = new CapabilityService();
    }
    return CapabilityService.instance;
  }

  /**
   * Autonomy Management
   */
  async toggleAutonomy(enable: boolean): Promise<any> {
    return await apiService.toggleAutonomy(enable);
  }

  async getAutonomyStatus(): Promise<any> {
    return await apiService.getAutonomyStatus();
  }

  /**
   * Generic Capability Management (shell, browser)
   */
  async toggleCapability(capability: string): Promise<any> {
    return await apiService.toggleCapability(capability);
  }

  async getCapabilityStatus(capability: string): Promise<any> {
    return await apiService.getCapabilityStatus(capability);
  }

  /**
   * Agent Settings Management (vision capabilities)
   */
  async updateAgentSetting(key: string, value: any): Promise<any> {
    return await apiService.updateAgentSetting(key, value);
  }

  async getAgentSettings(): Promise<any> {
    return await apiService.getAgentSettings();
  }

  async getVisionSettings(): Promise<any> {
    return await apiService.getVisionSettings();
  }

  async refreshVisionService(): Promise<any> {
    return await apiService.refreshVisionService();
  }

  /**
   * Vision capability helper methods
   */
  async toggleCamera(enable: boolean): Promise<void> {
    await this.updateAgentSetting('ENABLE_CAMERA', enable);
    await this.updateAgentSetting('VISION_CAMERA_ENABLED', enable);
    await this.refreshVisionService();
  }

  async toggleScreenCapture(enable: boolean): Promise<void> {
    await this.updateAgentSetting('ENABLE_SCREEN_CAPTURE', enable);
    await this.updateAgentSetting('VISION_SCREEN_ENABLED', enable);
    await this.refreshVisionService();
  }

  async toggleMicrophone(enable: boolean): Promise<void> {
    await this.updateAgentSetting('ENABLE_MICROPHONE', enable);
    await this.updateAgentSetting('VISION_MICROPHONE_ENABLED', enable);
    await this.refreshVisionService();
  }

  async toggleSpeakers(enable: boolean): Promise<void> {
    await this.updateAgentSetting('ENABLE_SPEAKER', enable);
    await this.updateAgentSetting('VISION_SPEAKER_ENABLED', enable);
    await this.refreshVisionService();
  }

  /**
   * Get all capability statuses at once
   */
  async getAllCapabilityStatuses(): Promise<{
    autonomy: any;
    shell: any;
    browser: any;
    vision: any;
  }> {
    const [autonomy, shell, browser, vision] = await Promise.all([
      this.getAutonomyStatus(),
      this.getCapabilityStatus('shell'),
      this.getCapabilityStatus('browser'),
      this.getVisionSettings(),
    ]);

    return {
      autonomy,
      shell,
      browser,
      vision,
    };
  }

  /**
   * Goals management
   */
  async fetchGoals(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/goals', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  /**
   * Todos management
   */
  async fetchTodos(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/todos', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  /**
   * Knowledge files management
   */
  async fetchKnowledgeFiles(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/knowledge/files', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  async deleteKnowledgeFile(fileId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`/api/knowledge/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  /**
   * Plugin configuration
   */
  async fetchPluginConfigs(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/plugin-config', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  async updatePluginConfig(plugin: string, config: Record<string, any>): Promise<ApiResponse<any>> {
    const response = await fetch(`/api/plugin-config/${plugin}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    const data = await response.json();
    return data;
  }

  /**
   * Configuration validation and testing
   */
  async validateConfiguration(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/config/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  async testConfiguration(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/config/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  /**
   * Agent reset
   */
  async resetAgent(): Promise<ApiResponse<any>> {
    const response = await fetch('/api/agent/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }

  /**
   * Memory management
   */
  async fetchMemories(roomId: string, count?: number): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({ roomId });
    if (count) {
      params.append('count', count.toString());
    }

    const response = await fetch(`/api/memories?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  }
}

// Export singleton instance
export const capabilityService = CapabilityService.getInstance();
