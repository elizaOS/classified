/**
 * Application Service
 * Handles application lifecycle operations (restart, shutdown)
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';

export class ApplicationService extends BaseTauriService {
  // Application lifecycle management
  public async restartApplication(): Promise<void> {
    try {
      await this.ensureInitializedAndInvoke('restart_application');
    } catch (error) {
      console.error('Failed to restart application:', error);
      throw new Error(`Application restart failed: ${error}`);
    }
  }

  public async shutdownApplication(): Promise<void> {
    try {
      // Clean up event listeners before shutdown
      this.destroy();

      await this.ensureInitializedAndInvoke('shutdown_application');
    } catch (error) {
      console.error('Failed to shutdown application:', error);
      throw error;
    }
  }

  // API proxy for plugin routes
  public async proxyApiRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('proxy_api_request', {
        method,
        path,
        body,
      });

      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error(`Failed to proxy ${method} ${path}:`, error);
      return {};
    }
  }

  // Plugin route management
  public async fetchPluginRoutes(): Promise<
    Array<{ path: string; method: string; description?: string }>
  > {
    try {
      const response = await this.ensureInitializedAndInvoke('get_plugin_routes');

      if (Array.isArray(response)) {
        return response as Array<{ path: string; method: string; description?: string }>;
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch plugin routes:', error);
      return [];
    }
  }

  public async fetchTabContent(route: string): Promise<string> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_tab_content', { route });
      return (response as string) || '';
    } catch (error) {
      console.error(`Failed to fetch content for route ${route}:`, error);
      return '';
    }
  }
}

// Export singleton instance
export const applicationService = new ApplicationService();
export default applicationService;
