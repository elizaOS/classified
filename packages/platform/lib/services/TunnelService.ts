import { Service, IAgentRuntime, Metadata } from '@elizaos/core';

export interface TunnelStatus {
  active: boolean;
  url: string | null;
  port: number | null;
  startedAt: Date | null;
  uptime: number | null;
}

export interface TunnelConfig {
  port?: number;
  subdomain?: string;
  hostname?: string;
  protocol?: string;
}

export class PlatformTunnelService extends Service {
  static serviceType = 'unknown' as const;
  capabilityDescription =
    'Platform tunnel service for exposing local endpoints to external webhooks';

  private url: string | null = null;
  private port: number | null = null;
  private startedAt: Date | null = null;
  private active = false;
  config: Metadata;

  constructor(config: TunnelConfig = {}) {
    super();
    this.config = config as Metadata;
  }

  static async start(runtime: IAgentRuntime): Promise<PlatformTunnelService> {
    const service = new PlatformTunnelService();
    service.runtime = runtime;
    return service;
  }

  async startTunnel(port = 3000): Promise<string> {
    try {
      // For the platform, we'll use the configured public URL
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || `http://localhost:${port}`;

      this.url = baseUrl;
      this.port = port;
      this.startedAt = new Date();
      this.active = true;

      console.log(`Platform tunnel service started: ${this.url}`);
      return this.url;
    } catch (error) {
      console.error('Failed to start tunnel:', error);
      throw new Error(
        `Failed to start tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async stopTunnel(): Promise<void> {
    this.url = null;
    this.port = null;
    this.startedAt = null;
    this.active = false;
    console.log('Platform tunnel service stopped');
  }

  getUrl(): string | null {
    return this.url;
  }

  getPort(): number | null {
    return this.port;
  }

  isActive(): boolean {
    return this.active;
  }

  getStatus(): TunnelStatus {
    return {
      active: this.active,
      url: this.url,
      port: this.port,
      startedAt: this.startedAt,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : null,
    };
  }

  async stop(): Promise<void> {
    await this.stopTunnel();
  }

  // Webhook delivery method
  async deliverWebhook(
    webhookUrl: string,
    payload: any,
    secret: string,
  ): Promise<boolean> {
    try {
      const signature = this.generateSignature(JSON.stringify(payload), secret);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform-Signature': signature,
          'X-Platform-Delivery': new Date().toISOString(),
          'User-Agent': 'ElizaOS-Platform-Webhooks/1.0',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(
          `Webhook delivery failed: ${response.status} ${response.statusText}`,
        );
        return false;
      }

      console.log(`Webhook delivered successfully to ${webhookUrl}`);
      return true;
    } catch (error) {
      console.error(`Webhook delivery error: ${error}`);
      return false;
    }
  }

  private generateSignature(payload: string, secret: string): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  // Method to trigger webhooks for specific events
  async triggerWebhook(event: string, data: any): Promise<void> {
    try {
      // In a real implementation, this would fetch webhooks from the database
      // For now, we'll use the mock webhooks
      const webhooks = this.getActiveWebhooksForEvent(event);

      const payload = {
        event,
        data,
        timestamp: new Date().toISOString(),
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      const deliveryPromises = webhooks.map((webhook) =>
        this.deliverWebhook(webhook.url, payload, webhook.secret),
      );

      await Promise.allSettled(deliveryPromises);
    } catch (error) {
      console.error(`Failed to trigger webhook for event ${event}:`, error);
    }
  }

  private getActiveWebhooksForEvent(event: string): any[] {
    // This would typically query the database
    // For now, return empty array as we're using mock data in the API routes
    return [];
  }
}
