/**
 * ElizaOS API Service - Multi-provider AI inference proxy
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import {
  getAPIServiceConfig,
  validateAPIServiceConfig,
} from './utils/config.js';
import {
  initializeDatabase,
  closeDatabase,
  checkDatabaseHealth,
} from './database/connection.js';
import { MultiProviderManager } from './providers/index.js';
import { completionsRoutes } from './routes/completions.js';
import type { APIServiceConfig } from './types/index.js';

class APIService {
  private app: Hono;
  private config: APIServiceConfig;
  private providerManager: MultiProviderManager;

  constructor() {
    this.app = new Hono();
    this.config = getAPIServiceConfig();
    this.providerManager = new MultiProviderManager(this.config);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Starting ElizaOS API Service...');

    // Validate configuration
    validateAPIServiceConfig(this.config);

    // Initialize database
    try {
      await initializeDatabase(this.config);
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      console.log(
        '⚠️  Continuing without database (some features will be limited)'
      );
    }

    // Setup middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Setup health checks
    this.setupHealthChecks();

    console.log('✅ ElizaOS API Service initialized successfully');
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use(
      '*',
      cors({
        origin: this.config.corsOrigins,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        exposeHeaders: [
          'X-Request-ID',
          'X-RateLimit-Limit',
          'X-RateLimit-Remaining',
        ],
      })
    );

    // Request logging
    this.app.use('*', logger());

    // Pretty JSON responses
    this.app.use('*', prettyJSON());

    // Global error handling
    this.app.onError((error, c) => {
      console.error('API Error:', error);

      return c.json(
        {
          error: {
            message: 'Internal server error',
            type: 'server_error',
            code: 'internal_error',
          },
        },
        500
      );
    });
  }

  private setupRoutes(): void {
    // Import routes
    const { completionsRoutes } = require('./routes/completions.js');
    const { authRoutes } = require('./routes/auth.js');

    // Add auth routes
    this.app.route('/api/auth', authRoutes(this.config));

    // Add completions routes (protected by auth)
    this.app.route('/api', completionsRoutes(this.config, this.providerManager));

    // Models endpoint
    this.app.get('/api/models', (c) => {
      const models = this.providerManager.getAvailableModels();
      return c.json({
        success: true,
        data: models,
      });
    });

    // Analytics endpoint (placeholder)
    this.app.get('/api/analytics', (c) => {
      const user = c.get('user');
      if (!user) {
        return c.json({ error: { message: 'Not authenticated' } }, 401);
      }

      // TODO: Implement real analytics
      return c.json({
        success: true,
        data: {
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0,
          byModel: [],
          byDay: [],
        },
      });
    });

    // Fallback route
    this.app.all('*', (c) => {
      return c.json(
        {
          error: {
            message: `Route ${c.req.method} ${c.req.path} not found`,
            type: 'not_found',
          },
        },
        404
      );
    });
  }

  private setupHealthChecks(): void {
    this.app.get('/health', async (c) => {
      const dbHealth = await checkDatabaseHealth();
      const providerHealth = await this.providerManager.healthCheck();

      const allHealthy =
        dbHealth && Object.values(providerHealth).some((healthy) => healthy);

      const healthStatus = {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        services: {
          database: dbHealth,
          redis: false, // TODO: Implement Redis health check
          providers: providerHealth,
        },
        metrics: {
          requestsPerMinute: 0, // TODO: Implement metrics
          averageLatency: 0,
          errorRate: 0,
        },
      };

      return c.json(healthStatus, allHealthy ? 200 : 503);
    });

    this.app.get('/health/ready', async (c) => {
      // Readiness check - can we serve requests?
      const hasProviders = this.providerManager.getAvailableModels().length > 0;

      if (hasProviders) {
        return c.json({ status: 'ready' }, 200);
      } else {
        return c.json(
          { status: 'not ready', reason: 'no providers available' },
          503
        );
      }
    });

    this.app.get('/health/live', (c) => {
      // Liveness check - is the service running?
      return c.json({ status: 'alive' }, 200);
    });
  }

  async start(): Promise<void> {
    await this.initialize();

    const server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      fetch: this.app.fetch,
    });

    console.log(
      `🌟 ElizaOS API Service running on http://${this.config.host}:${this.config.port}`
    );
    console.log(
      `📊 Health checks available at http://${this.config.host}:${this.config.port}/health`
    );

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down ElizaOS API Service...');

      server.stop();
      await closeDatabase();

      console.log('✅ ElizaOS API Service stopped gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('🛑 Received SIGTERM, shutting down...');

      server.stop();
      await closeDatabase();

      process.exit(0);
    });
  }
}

// Start the service if this file is run directly
if (import.meta.main) {
  const service = new APIService();
  service.start().catch((error) => {
    console.error('❌ Failed to start API service:', error);
    process.exit(1);
  });
}

export { APIService };
export default APIService;
