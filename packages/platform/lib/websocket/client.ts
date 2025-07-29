/**
 * WebSocket Client for Platform Package
 * 
 * Provides client-side WebSocket communication capabilities
 * adapted from the working client implementation.
 */

import { io, type Socket } from 'socket.io-client';
import { logger } from './logger';
import type {
  WebSocketMessage,
  ProjectUpdateMessage,
  BuildStatusMessage,
  AgentResponseMessage,
} from './server';

export interface WebSocketClientOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
}

export type WebSocketEventHandler = (data: any) => void;

/**
 * WebSocket Client Manager
 * Handles client-side WebSocket communication for the autocoder platform
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private connectPromise: Promise<void> | null = null;
  private resolveConnect: (() => void) | null = null;
  private subscribedProjects: Set<string> = new Set();
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();

  /**
   * Initialize WebSocket connection
   */
  public initialize(options: WebSocketClientOptions = {}): void {
    if (this.socket) {
      logger.debug('WebSocket already initialized');
      return;
    }

    const url = options.url || window.location.origin;
    logger.info(`Initializing WebSocket connection to ${url}`);

    this.socket = io(url, {
      autoConnect: options.autoConnect !== false,
      reconnection: options.reconnection !== false,
    });

    this.setupEventHandlers();
    this.setupConnectionPromise();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      logger.info('Connected to WebSocket server');
      this.isConnected = true;
      this.resolveConnect?.();
      this.emit('connect');
    });

    this.socket.on('disconnect', (reason) => {
      logger.info(`Disconnected from WebSocket server: ${reason}`);
      this.isConnected = false;
      this.setupConnectionPromise();
      this.emit('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      logger.error('WebSocket connection error:', error);
      this.emit('connect_error', error);
    });

    this.socket.on('reconnect', (attempt) => {
      logger.info(`Reconnected after ${attempt} attempts`);
      this.emit('reconnect', attempt);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      logger.debug(`Reconnection attempt ${attempt}`);
      this.emit('reconnect_attempt', attempt);
    });

    // Connection confirmation
    this.socket.on('connection_established', (data) => {
      logger.info('Connection established:', data);
      this.emit('connection_established', data);
    });

    // Subscription events
    this.socket.on('subscription_confirmed', (data) => {
      logger.info('Project subscription confirmed:', data);
      this.emit('subscription_confirmed', data);
    });

    // Project-specific events
    this.socket.on('project_update', (message: WebSocketMessage) => {
      logger.debug('Project update received:', message);
      this.emit('project_update', message);
    });

    this.socket.on('project_message', (data) => {
      logger.debug('Project message received:', data);
      this.emit('project_message', data);
    });

    // Build status events
    this.socket.on('build_status', (message: BuildStatusMessage) => {
      logger.debug('Build status update:', message);
      this.emit('build_status', message);
    });

    // Agent response events
    this.socket.on('agent_response', (message: AgentResponseMessage) => {
      logger.debug('Agent response received:', message);
      this.emit('agent_response', message);
    });

    // Generic message handling
    this.socket.on('message', (data) => {
      logger.debug('Generic message received:', data);
      this.emit('message', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      logger.error('Socket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Setup connection promise for async operations
   */
  private setupConnectionPromise(): void {
    this.connectPromise = new Promise<void>((resolve) => {
      this.resolveConnect = resolve;
    });
  }

  /**
   * Wait for connection to be established
   */
  public async waitForConnection(): Promise<void> {
    if (!this.isConnected && this.connectPromise) {
      await this.connectPromise;
    }
  }

  /**
   * Subscribe to project updates
   */
  public async subscribeToProject(projectId: string, userId?: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    await this.waitForConnection();

    this.socket.emit('subscribe_project', { projectId, userId });
    this.subscribedProjects.add(projectId);
    
    logger.info(`Subscribed to project: ${projectId}`);
  }

  /**
   * Unsubscribe from project updates
   */
  public async unsubscribeFromProject(projectId: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    await this.waitForConnection();

    this.socket.emit('unsubscribe_project', { projectId });
    this.subscribedProjects.delete(projectId);
    
    logger.info(`Unsubscribed from project: ${projectId}`);
  }

  /**
   * Send user message to project
   */
  public async sendUserMessage(
    projectId: string, 
    message: string, 
    messageType?: string
  ): Promise<void> {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    await this.waitForConnection();

    this.socket.emit('user_message', {
      projectId,
      message,
      messageType: messageType || 'user',
    });
    
    logger.debug(`Sent user message to project ${projectId}: ${message.substring(0, 50)}...`);
  }

  /**
   * Start build for project
   */
  public async startBuild(projectId: string): Promise<void> {
    if (!this.socket) {
      throw new Error('WebSocket not initialized');
    }

    await this.waitForConnection();

    this.socket.emit('start_build', { projectId });
    
    logger.info(`Started build for project: ${projectId}`);
  }

  /**
   * Add event listener
   */
  public on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event listener
   */
  public off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get subscribed projects
   */
  public getSubscribedProjects(): string[] {
    return Array.from(this.subscribedProjects);
  }

  /**
   * Disconnect from server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.subscribedProjects.clear();
      this.eventHandlers.clear();
      logger.info('Disconnected from WebSocket server');
    }
  }

  /**
   * Get connection status
   */
  public getStatus(): { 
    connected: boolean; 
    subscribedProjects: number;
    socketId?: string;
  } {
    return {
      connected: this.isConnected,
      subscribedProjects: this.subscribedProjects.size,
      socketId: this.socket?.id,
    };
  }
}

// Singleton instance
export const webSocketClient = new WebSocketClient();