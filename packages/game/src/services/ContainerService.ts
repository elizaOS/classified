/**
 * Container Service
 * Handles container management operations (Docker/Podman)
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';
import { ContainerStatus, ContainerLog, StartupStatus } from '../types/shared';

export class ContainerService extends BaseTauriService {
  private statusListeners: Set<(status: StartupStatus) => void> = new Set();
  private containerLogListeners: Set<(log: ContainerLog) => void> = new Set();

  protected async setupEventListeners(): Promise<void> {
    if (!this.tauriListen) return;

    // Set up startup status listener
    const unlistenStatus = await this.tauriListen<StartupStatus>('startup_status', (event) => {
      const status = event.payload;
      this.statusListeners.forEach((listener) => listener(status));
    });

    // Set up container log listener
    const unlistenContainerLog = await this.tauriListen<ContainerLog>('container_log', (event) => {
      const log = event.payload;
      this.containerLogListeners.forEach((listener) => listener(log));
    });

    this.unlistenFns.push(unlistenStatus, unlistenContainerLog);
  }

  // Event listener management
  public onStatusUpdate(listener: (status: StartupStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public onContainerLog(listener: (log: ContainerLog) => void): () => void {
    this.containerLogListeners.add(listener);
    return () => this.containerLogListeners.delete(listener);
  }

  // Container management
  public async getContainerStatus(): Promise<ContainerStatus[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_container_runtime_status');
      if (Array.isArray(response)) {
        return response as ContainerStatus[];
      }
      return [];
    } catch (error) {
      console.error('Failed to get container status:', error);
      return [];
    }
  }

  public async restartContainer(name: string): Promise<void> {
    return this.ensureInitializedAndInvoke('restart_container', { name }) as Promise<void>;
  }

  public async checkServerStatus(): Promise<boolean> {
    try {
      return (await this.ensureInitializedAndInvoke('check_server_status')) as boolean;
    } catch (error) {
      console.error('Server status check failed:', error);
      return false;
    }
  }

  public async startServer(): Promise<void> {
    return this.ensureInitializedAndInvoke('start_game_environment') as Promise<void>;
  }

  public async stopServer(): Promise<void> {
    return this.ensureInitializedAndInvoke('stop_game_environment') as Promise<void>;
  }

  // Logging
  public async fetchLogs(logType?: string, limit?: number): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_logs', {
        logType,
        limit: limit || 100,
      });

      if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      return [];
    }
  }
}

// Export singleton instance
export const containerService = new ContainerService();
export default containerService;
