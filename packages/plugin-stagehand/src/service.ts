import type { IAgentRuntime } from '@elizaos/core';
import { Service, logger } from '@elizaos/core';
import { StagehandProcessManager } from './process-manager.js';
import { StagehandServiceType } from './types';
import { StagehandWebSocketClient } from './websocket-client.js';

export class BrowserSession {
  constructor(
    public id: string,
    public createdAt: Date = new Date()
  ) {}
}

export class StagehandService extends Service {
  static serviceType = StagehandServiceType.STAGEHAND;
  capabilityDescription = 'Browser automation service using Stagehand for web interactions';

  private sessions: Map<string, BrowserSession> = new Map();
  private currentSessionId: string | null = null;
  private processManager: StagehandProcessManager;
  private client: StagehandWebSocketClient;
  private isInitialized = false;

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
    const port = parseInt(runtime.getSetting('STAGEHAND_SERVER_PORT') || '3456', 10);
    this.processManager = new StagehandProcessManager(port);
    this.client = new StagehandWebSocketClient(`ws://localhost:${port}`);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('Starting Stagehand browser automation service');
    const service = new StagehandService(runtime);
    await service.initialize();
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('Stopping Stagehand browser automation service');
    const service = runtime.getService<StagehandService>(StagehandService.serviceType);
    if (!service) {
      throw new Error('Stagehand service not found');
    }
    await service.stop();
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Starting Stagehand server process...');
      await this.processManager.start();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      logger.info('Connecting to Stagehand server...');
      await this.client.connect();

      this.isInitialized = true;
      logger.info('Stagehand service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Stagehand service:', error);
      throw error;
    }
  }

  async stop() {
    logger.info('Cleaning up browser sessions');

    for (const sessionId of this.sessions.keys()) {
      await this.destroySession(sessionId);
    }

    this.client.disconnect();
    await this.processManager.stop();
    this.isInitialized = false;
  }

  async createSession(sessionId: string): Promise<BrowserSession> {
    if (!this.isInitialized) {
      throw new Error('Stagehand service not initialized');
    }

    const response = await this.client.sendMessage('createSession', {});
    const serverSessionId = response.data?.sessionId;
    if (!serverSessionId) {
      throw new Error('Failed to create session on server');
    }
    const session = new BrowserSession(serverSessionId);
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;

    return session;
  }

  async getSession(sessionId: string): Promise<BrowserSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async getCurrentSession(): Promise<BrowserSession | undefined> {
    if (!this.currentSessionId) {
      return undefined;
    }
    return this.sessions.get(this.currentSessionId);
  }

  async getOrCreateSession(): Promise<BrowserSession> {
    // Try to get current session first
    const currentSession = await this.getCurrentSession();
    if (currentSession) {
      return currentSession;
    }

    // Create a new session if none exists
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return this.createSession(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await this.client.sendMessage('destroySession', { sessionId: session.id });
      this.sessions.delete(sessionId);
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }
    }
  }

  getClient(): StagehandWebSocketClient {
    if (!this.isInitialized) {
      throw new Error('Stagehand service not initialized');
    }
    return this.client;
  }
}
