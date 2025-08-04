/**
 * Agent Service
 * Handles agent management, capabilities, autonomy, and health monitoring
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';
import { HealthCheckResponse } from '../types/shared';

export class AgentService extends BaseTauriService {
  // Agent health and info
  public async checkAgentHealth(): Promise<HealthCheckResponse> {
    try {
      const response = await this.ensureInitializedAndInvoke('health_check');
      return response as HealthCheckResponse;
    } catch (error) {
      console.error('Agent health check failed:', error);
      return { status: 'unhealthy', database: false, services: {} };
    }
  }

  public async getAgentInfo(): Promise<{ id: string; name: string; version: string }> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_agent_info');
      if (response && typeof response === 'object') {
        const info = response as any;
        return {
          id: info.id || this.agentId,
          name: info.name || 'Eliza Agent',
          version: info.version || '1.0.0',
        };
      }
      return {
        id: this.agentId,
        name: 'Eliza Agent',
        version: '1.0.0',
      };
    } catch (error) {
      console.error('Failed to get agent info:', error);
      return {
        id: this.agentId,
        name: 'Eliza Agent',
        version: '1.0.0',
      };
    }
  }

  // Agent settings
  public async getAgentSettings(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_agent_settings');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to get agent settings:', error);
      return {};
    }
  }

  public async updateAgentSetting(key: string, value: unknown): Promise<void> {
    return this.ensureInitializedAndInvoke('update_agent_setting', {
      key,
      value,
    }) as Promise<void>;
  }

  // Capabilities management
  public async getCapabilities(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_capabilities');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to get capabilities:', error);
      return {};
    }
  }

  public async updateCapability(capability: string, enabled: boolean): Promise<void> {
    return this.ensureInitializedAndInvoke('update_capability', {
      capability,
      enabled,
    }) as Promise<void>;
  }

  public async toggleCapability(capability: string): Promise<void> {
    return this.ensureInitializedAndInvoke('toggle_capability', {
      capability,
    }) as Promise<void>;
  }

  public async getCapabilityStatus(
    capability: string
  ): Promise<{ enabled: boolean; available: boolean }> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_capability_status', {
        capability,
      });

      if (response && typeof response === 'object') {
        const status = response as any;
        return {
          enabled: status.enabled || false,
          available: status.available !== false, // Default to true if not specified
        };
      }

      return { enabled: false, available: true };
    } catch (error) {
      console.error(`Failed to get capability status for ${capability}:`, error);
      return { enabled: false, available: false };
    }
  }

  // Autonomy management
  public async toggleAutonomy(enabled: boolean): Promise<void> {
    return this.ensureInitializedAndInvoke('toggle_autonomy', { enabled }) as Promise<void>;
  }

  public async getAutonomyStatus(): Promise<{ enabled: boolean; interval: number }> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_autonomy_status');
      if (response && typeof response === 'object') {
        const status = response as any;
        return {
          enabled: status.enabled || false,
          interval: status.interval || 30000, // Default 30 seconds
        };
      }
      return { enabled: false, interval: 30000 };
    } catch (error) {
      console.error('Failed to get autonomy status:', error);
      return { enabled: false, interval: 30000 };
    }
  }

  public async fetchAutonomyStatus(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('fetch_autonomy_status');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to fetch autonomy status:', error);
      return {};
    }
  }

  // Vision settings
  public async getVisionSettings(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_vision_settings');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to get vision settings:', error);
      return {};
    }
  }

  public async updateVisionSettings(settings: Record<string, unknown>): Promise<void> {
    return this.ensureInitializedAndInvoke('update_vision_settings', {
      settings,
    }) as Promise<void>;
  }

  public async refreshVisionService(): Promise<void> {
    return this.ensureInitializedAndInvoke('refresh_vision_service') as Promise<void>;
  }

  // Agent lifecycle
  public async resetAgent(): Promise<void> {
    return this.ensureInitializedAndInvoke('reset_agent') as Promise<void>;
  }
}

// Export singleton instance
export const agentService = new AgentService();
export default agentService;
