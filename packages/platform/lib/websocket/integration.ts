/**
 * WebSocket Integration Service
 * 
 * Integrates WebSocket functionality with the platform's existing API routes
 * and provides seamless real-time communication for autocoder operations.
 */

import http from 'node:http';
import { webSocketServer, type WebSocketServer } from './server';
import { logger } from './logger';

export interface WebSocketIntegrationOptions {
  httpServer: http.Server;
  enableLogging?: boolean;
}

/**
 * WebSocket Integration Manager
 * Manages the integration between WebSocket server and HTTP server
 */
export class WebSocketIntegration {
  private server: WebSocketServer;
  private httpServer?: http.Server;
  private initialized = false;

  constructor() {
    this.server = webSocketServer;
  }

  /**
   * Initialize WebSocket integration with HTTP server
   */
  public initialize(options: WebSocketIntegrationOptions): void {
    if (this.initialized) {
      logger.warn('WebSocket integration already initialized');
      return;
    }

    this.httpServer = options.httpServer;
    this.server.initialize(options.httpServer);
    this.initialized = true;

    logger.info('WebSocket integration initialized successfully');
  }

  /**
   * Send project update to subscribed clients
   */
  public sendProjectUpdate(
    projectId: string, 
    status: string, 
    message: string, 
    data?: any
  ): void {
    if (!this.initialized) {
      logger.warn('Cannot send project update: WebSocket not initialized');
      return;
    }

    this.server.sendProjectUpdate(projectId, status, message, data);
  }

  /**
   * Send build status update
   */
  public sendBuildStatus(
    projectId: string,
    status: 'queued' | 'building' | 'completed' | 'failed',
    progress?: number,
    logs?: string[]
  ): void {
    if (!this.initialized) {
      logger.warn('Cannot send build status: WebSocket not initialized');
      return;
    }

    this.server.sendBuildStatus(projectId, status, progress, logs);
  }

  /**
   * Send agent response
   */
  public sendAgentResponse(
    projectId: string,
    message: string,
    agentId: string,
    messageType: 'analysis' | 'suggestion' | 'completion'
  ): void {
    if (!this.initialized) {
      logger.warn('Cannot send agent response: WebSocket not initialized');
      return;
    }

    this.server.sendAgentResponse(projectId, message, agentId, messageType);
  }

  /**
   * Get client statistics
   */
  public getClientStats(): {
    totalClients: number;
    projectClients: { [projectId: string]: number };
    status: { initialized: boolean; clientCount: number };
  } {
    if (!this.initialized) {
      return {
        totalClients: 0,
        projectClients: {},
        status: { initialized: false, clientCount: 0 },
      };
    }

    const status = this.server.getStatus();
    
    return {
      totalClients: status.clientCount,
      projectClients: {}, // Would need to be implemented in server if needed
      status,
    };
  }

  /**
   * Check if integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown WebSocket integration
   */
  public shutdown(): void {
    if (this.initialized) {
      this.server.shutdown();
      this.initialized = false;
      this.httpServer = undefined;
      logger.info('WebSocket integration shutdown complete');
    }
  }
}

// Singleton instance
export const webSocketIntegration = new WebSocketIntegration();

/**
 * Utility function to initialize WebSocket with Next.js API
 */
export function initializeWebSocketWithNextJS(server: http.Server): void {
  webSocketIntegration.initialize({
    httpServer: server,
    enableLogging: process.env.NODE_ENV === 'development',
  });
}

/**
 * Utility function for sending project notifications
 */
export function notifyProjectUpdate(
  projectId: string,
  type: 'analysis' | 'build' | 'completion',
  message: string,
  data?: any
): void {
  switch (type) {
    case 'analysis':
      webSocketIntegration.sendProjectUpdate(projectId, 'analyzing', message, data);
      break;
    case 'build':
      webSocketIntegration.sendBuildStatus(projectId, 'building', data?.progress, data?.logs);
      break;
    case 'completion':
      webSocketIntegration.sendProjectUpdate(projectId, 'completed', message, data);
      break;
  }
}