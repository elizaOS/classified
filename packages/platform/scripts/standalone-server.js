#!/usr/bin/env node

/**
 * Standalone ElizaOS Server with Client GUI
 * Serves the built client application using @elizaos/server
 */

import { AgentServer } from '@elizaos/server';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import express from 'express';
import { logger } from '@/lib/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLATFORM_ROOT = join(__dirname, '..');
const CLIENT_STATIC_PATH = join(PLATFORM_ROOT, 'public', 'client-static');

class StandaloneElizaServer {
  constructor(options = {}) {
    this.port = options.port || process.env.PORT || 3000;
    this.host = options.host || process.env.SERVER_HOST || '0.0.0.0';
    this.agentServer = null;
    this.characterPath = options.characterPath;
    this.characterJson = options.characterJson;
  }

  async validateClientAssets() {
    if (!existsSync(CLIENT_STATIC_PATH)) {
      logger.error(
        'Client assets not found. Run "bun run build:client" first.',
      );
      process.exit(1);
    }

    const requiredFiles = ['index.html'];
    const missingFiles = requiredFiles.filter(
      (file) => !existsSync(join(CLIENT_STATIC_PATH, file)),
    );

    if (missingFiles.length > 0) {
      logger.error(`Missing client files: ${missingFiles.join(', ')}`);
      logger.error('Run "bun run build:client" to build client assets.');
      process.exit(1);
    }

    logger.info('✅ Client assets validated');
  }

  setupClientServing() {
    // Register client serving middleware with AgentServer
    this.agentServer.registerMiddleware((req, res, next) => {
      // Serve client static files
      if (req.path.startsWith('/client')) {
        const staticPath = req.path.replace('/client', '');
        const fullPath = join(CLIENT_STATIC_PATH, staticPath || 'index.html');

        if (existsSync(fullPath)) {
          // Set appropriate headers
          if (fullPath.endsWith('.html')) {
            res.setHeader(
              'Cache-Control',
              'no-cache, no-store, must-revalidate',
            );
          } else if (fullPath.includes('/assets/')) {
            res.setHeader(
              'Cache-Control',
              process.env.NODE_ENV === 'production'
                ? 'public, max-age=31536000, immutable'
                : 'no-cache',
            );
          }

          return res.sendFile(fullPath);
        } else if (
          !staticPath.includes('.') &&
          !staticPath.startsWith('/assets/')
        ) {
          // SPA routing fallback
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.sendFile(join(CLIENT_STATIC_PATH, 'index.html'));
        }
      }

      // Default route to client
      if (req.path === '/') {
        return res.redirect('/client');
      }

      next();
    });

    logger.info('✅ Client serving configured');
  }

  async createAgentIfProvided() {
    if (!this.characterPath && !this.characterJson) {
      logger.info(
        'No character provided. Server ready for agent creation via API.',
      );
      return;
    }

    try {
      const agentData = this.characterJson
        ? { characterJson: this.characterJson }
        : { characterPath: this.characterPath };

      const response = await fetch(`http://localhost:${this.port}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ELIZA_SERVER_AUTH_TOKEN && {
            'X-API-KEY': process.env.ELIZA_SERVER_AUTH_TOKEN,
          }),
        },
        body: JSON.stringify(agentData),
      });

      if (response.ok) {
        const result = await response.json();
        logger.info(
          `✅ Agent created: ${result.data.character.name} (ID: ${result.data.id})`,
        );

        // Start the agent
        const startResponse = await fetch(
          `http://localhost:${this.port}/api/agents/${result.data.id}/start`,
          {
            method: 'POST',
            headers: {
              ...(process.env.ELIZA_SERVER_AUTH_TOKEN && {
                'X-API-KEY': process.env.ELIZA_SERVER_AUTH_TOKEN,
              }),
            },
          },
        );

        if (startResponse.ok) {
          logger.info(`✅ Agent started successfully`);
        } else {
          logger.warn('Agent created but failed to start');
        }
      } else {
        const error = await response.json();
        logger.error(
          `Failed to create agent: ${error.error?.message || 'Unknown error'}`,
        );
      }
    } catch (error) {
      logger.error(`Error creating agent: ${error.message}`);
    }
  }

  async start() {
    try {
      logger.info('🚀 Starting standalone ElizaOS server...');

      // Validate client assets exist
      await this.validateClientAssets();

      // Create AgentServer instance (no constructor parameters)
      this.agentServer = new AgentServer();

      // Initialize the server with proper options
      await this.agentServer.initialize({
        postgresUrl: process.env.POSTGRES_URL,
        dataDir: process.env.PGLITE_DATA_DIR || './.elizadb',
      });

      // Setup client serving middleware
      this.setupClientServing();

      // Start the server on specified port
      this.agentServer.start(this.port);

      // Wait a moment for server to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Create agent if provided
      await this.createAgentIfProvided();

      logger.info(
        `🎉 ElizaOS server running on http://${this.host}:${this.port}`,
      );
      logger.info(
        `📱 Client GUI available at: http://localhost:${this.port}/client`,
      );
      logger.info(`🔌 API available at: http://localhost:${this.port}/api`);
      logger.info(`📊 WebSocket available at: http://localhost:${this.port}`);
    } catch (error) {
      logger.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    }
  }

  async stop() {
    if (this.agentServer) {
      await this.agentServer.stop();
      logger.info('✅ Server stopped');
    }
  }
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const options = {};

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--character' && args[i + 1]) {
      options.characterPath = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      options.port = parseInt(args[++i], 10);
    } else if (arg === '--host' && args[i + 1]) {
      options.host = args[++i];
    } else if (arg === '--help') {
      console.log(`
Usage: standalone-server.js [options]

Options:
  --character <path>   Path to character JSON file
  --port <number>      Server port (default: 3000)
  --host <string>      Server host (default: 0.0.0.0)
  --help              Show this help message

Environment Variables:
  PORT                 Server port
  SERVER_HOST          Server host
  ELIZA_SERVER_AUTH_TOKEN  API authentication token
  POSTGRES_URL         Database connection string
  NODE_ENV             Environment (development/production)

Examples:
  node standalone-server.js --character ./character.json --port 4000
  PORT=3000 node standalone-server.js
      `);
      process.exit(0);
    }
  }

  const server = new StandaloneElizaServer(options);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('\n🛑 Shutting down server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('🛑 Received SIGTERM, shutting down...');
    await server.stop();
    process.exit(0);
  });

  await server.start();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error(`Startup error: ${error.message}`);
    process.exit(1);
  });
}

export { StandaloneElizaServer };
