import WebSocket from 'ws';
import { logger } from '@elizaos/core';
export class StagehandWebSocketClient {
    serverUrl;
    ws = null;
    messageHandlers = new Map();
    connected = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 1000;
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.serverUrl);
                this.ws.on('open', () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    logger.info(`[Stagehand] Connected to server at ${this.serverUrl}`);
                    resolve();
                });
                this.ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        // Handle response messages with requestId
                        if (message.requestId && this.messageHandlers.has(message.requestId)) {
                            const handler = this.messageHandlers.get(message.requestId);
                            this.messageHandlers.delete(message.requestId);
                            handler(message);
                        }
                        // Log other messages
                        if (message.type === 'connected') {
                            logger.info(`[Stagehand] Server connected: ${JSON.stringify(message)}`);
                        }
                    }
                    catch (error) {
                        logger.error('[Stagehand] Error parsing message:', error);
                    }
                });
                this.ws.on('error', (error) => {
                    logger.error('[Stagehand] WebSocket error:', error);
                    if (!this.connected) {
                        reject(error);
                    }
                });
                this.ws.on('close', () => {
                    this.connected = false;
                    logger.info('[Stagehand] Disconnected from server');
                    // Attempt reconnection if not explicitly disconnected
                    if (this.ws && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.attemptReconnect();
                    }
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async attemptReconnect() {
        this.reconnectAttempts++;
        logger.info(`[Stagehand] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
        await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay * this.reconnectAttempts));
        try {
            await this.connect();
        }
        catch (error) {
            logger.error('[Stagehand] Reconnection failed:', error);
        }
    }
    async sendMessage(type, data) {
        if (!this.ws || !this.connected) {
            throw new Error('Not connected to Stagehand server');
        }
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const message = {
            type,
            requestId,
            ...data,
        };
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.messageHandlers.delete(requestId);
                reject(new Error(`Request timeout for ${type}`));
            }, 30000); // 30 second timeout
            this.messageHandlers.set(requestId, (response) => {
                clearTimeout(timeout);
                if (response.type === 'error') {
                    reject(new Error(response.error || 'Unknown error'));
                }
                else {
                    resolve(response);
                }
            });
            this.ws.send(JSON.stringify(message));
            logger.debug(`[Stagehand] Sent message: ${type} (${requestId})`);
        });
    }
    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        logger.info('[Stagehand] Client disconnected');
    }
    isConnected() {
        return this.connected;
    }
    // Convenience methods for specific actions
    async navigate(sessionId, url) {
        const response = await this.sendMessage('navigate', {
            sessionId,
            data: { url }
        });
        return response.data || { url, title: '' };
    }
    async getState(sessionId) {
        const response = await this.sendMessage('getState', { sessionId });
        return response.data || {
            url: '',
            title: '',
            sessionId,
            createdAt: new Date()
        };
    }
    async goBack(sessionId) {
        const response = await this.sendMessage('goBack', { sessionId });
        return response.data || { url: '', title: '' };
    }
    async goForward(sessionId) {
        const response = await this.sendMessage('goForward', { sessionId });
        return response.data || { url: '', title: '' };
    }
    async refresh(sessionId) {
        const response = await this.sendMessage('refresh', { sessionId });
        return response.data || { url: '', title: '' };
    }
    async click(sessionId, description) {
        await this.sendMessage('click', {
            sessionId,
            data: { description }
        });
    }
    async type(sessionId, text, field) {
        await this.sendMessage('type', {
            sessionId,
            data: { text, field }
        });
    }
    async select(sessionId, option, dropdown) {
        await this.sendMessage('select', {
            sessionId,
            data: { option, dropdown }
        });
    }
    async extract(sessionId, instruction) {
        const response = await this.sendMessage('extract', {
            sessionId,
            data: { instruction }
        });
        return response.data || { data: '', found: false };
    }
    async screenshot(sessionId) {
        const response = await this.sendMessage('screenshot', { sessionId });
        return response.data || {
            screenshot: '',
            mimeType: 'image/png',
            url: '',
            title: ''
        };
    }
    async solveCaptcha(sessionId) {
        const response = await this.sendMessage('solveCaptcha', { sessionId });
        return response.data || {
            captchaDetected: false,
            captchaType: null,
            siteKey: null
        };
    }
}
