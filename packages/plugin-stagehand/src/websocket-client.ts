import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '@elizaos/core';

export interface StagehandClientConfig {
  serverUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface RequestMessage {
  type: string;
  requestId: string;
  sessionId?: string;
  data?: any;
}

export interface ResponseMessage {
  type: string;
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class StagehandClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private isConnected = false;
  private pendingRequests = new Map<string, {
    resolve: (value: ResponseMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private clientId: string | null = null;

  constructor(config: StagehandClientConfig = {}) {
    super();
    this.serverUrl = config.serverUrl || 'ws://localhost:3456';
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => {
          logger.info(`Connected to Stagehand server at ${this.serverUrl}`);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as ResponseMessage;
            
            // Handle connection message
            if (message.type === 'connected') {
              this.clientId = (message as any).clientId;
              return;
            }

            // Handle request responses
            const pending = this.pendingRequests.get(message.requestId);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(message.requestId);
              
              if (message.success) {
                pending.resolve(message);
              } else {
                pending.reject(new Error(message.error || 'Request failed'));
              }
            }
          } catch (error) {
            logger.error('Error parsing WebSocket message:', error);
          }
        });

        this.ws.on('close', () => {
          logger.warn('Disconnected from Stagehand server');
          this.isConnected = false;
          this.emit('disconnected');
          this.handleReconnect();
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          if (!this.isConnected) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnection failed:', error);
      });
    }, this.reconnectInterval);
  }

  async sendRequest(request: Omit<RequestMessage, 'requestId'>): Promise<ResponseMessage> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Stagehand server');
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const fullRequest: RequestMessage = { ...request, requestId };

    return new Promise((resolve, reject) => {
      // Set timeout for request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send request
      this.ws!.send(JSON.stringify(fullRequest));
    });
  }

  async createSession(): Promise<string> {
    const response = await this.sendRequest({
      type: 'createSession',
    });
    return response.data.sessionId;
  }

  async destroySession(sessionId: string): Promise<void> {
    await this.sendRequest({
      type: 'destroySession',
      sessionId,
    });
  }

  async navigate(sessionId: string, url: string): Promise<{ url: string; title: string }> {
    const response = await this.sendRequest({
      type: 'navigate',
      sessionId,
      data: { url },
    });
    return response.data;
  }

  async goBack(sessionId: string): Promise<{ url: string; title: string }> {
    const response = await this.sendRequest({
      type: 'goBack',
      sessionId,
    });
    return response.data;
  }

  async goForward(sessionId: string): Promise<{ url: string; title: string }> {
    const response = await this.sendRequest({
      type: 'goForward',
      sessionId,
    });
    return response.data;
  }

  async refresh(sessionId: string): Promise<{ url: string; title: string }> {
    const response = await this.sendRequest({
      type: 'refresh',
      sessionId,
    });
    return response.data;
  }

  async click(sessionId: string, description: string): Promise<void> {
    await this.sendRequest({
      type: 'click',
      sessionId,
      data: { description },
    });
  }

  async type(sessionId: string, text: string, field: string): Promise<void> {
    await this.sendRequest({
      type: 'type',
      sessionId,
      data: { text, field },
    });
  }

  async select(sessionId: string, option: string, dropdown: string): Promise<void> {
    await this.sendRequest({
      type: 'select',
      sessionId,
      data: { option, dropdown },
    });
  }

  async extract(sessionId: string, instruction: string): Promise<{ data: string; found: boolean }> {
    const response = await this.sendRequest({
      type: 'extract',
      sessionId,
      data: { instruction },
    });
    return response.data;
  }

  async screenshot(sessionId: string): Promise<{
    screenshot: string;
    mimeType: string;
    url: string;
    title: string;
  }> {
    const response = await this.sendRequest({
      type: 'screenshot',
      sessionId,
    });
    return response.data;
  }

  async getState(sessionId: string): Promise<{
    url: string;
    title: string;
    sessionId: string;
    createdAt: Date;
  }> {
    const response = await this.sendRequest({
      type: 'getState',
      sessionId,
    });
    return response.data;
  }

  async solveCaptcha(sessionId: string): Promise<{
    captchaDetected: boolean;
    captchaType: string | null;
    siteKey: string | null;
  }> {
    const response = await this.sendRequest({
      type: 'solveCaptcha',
      sessionId,
    });
    return response.data;
  }

  disconnect(): void {
    if (this.ws) {
      // Clear pending requests
      for (const [requestId, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Client disconnected'));
      }
      this.pendingRequests.clear();

      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
} 