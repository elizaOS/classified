import { WebSocketServer } from 'ws';
import { Stagehand } from '@browserbasehq/stagehand';
import { config } from 'dotenv';
import { SessionManager } from './session-manager.js';
import { MessageHandler } from './message-handler.js';
import { Logger } from './logger.js';

// Load environment variables
config();

const PORT = process.env.STAGEHAND_SERVER_PORT || 3456;
const logger = new Logger();

// Create WebSocket server
const wss = new WebSocketServer({ port: Number(PORT) });
const sessionManager = new SessionManager(logger);
const messageHandler = new MessageHandler(sessionManager, logger);

logger.info(`Stagehand server starting on port ${PORT}`);

// Handle new connections
wss.on('connection', (ws) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  logger.info(`New client connected: ${clientId}`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    version: '1.0.0'
  }));

  // Handle messages from client
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      logger.debug(`Received message from ${clientId}:`, message);

      const response = await messageHandler.handleMessage(message, clientId);
      
      ws.send(JSON.stringify(response));
    } catch (error) {
      logger.error(`Error handling message from ${clientId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: null
      }));
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    logger.info(`Client disconnected: ${clientId}`);
    // Clean up sessions for this client
    sessionManager.cleanupClientSessions(clientId);
  });

  // Handle errors
  ws.on('error', (error) => {
    logger.error(`WebSocket error for ${clientId}:`, error);
  });
});

// Handle server shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  await sessionManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server...');
  await sessionManager.cleanup();
  process.exit(0);
});

logger.info(`Stagehand server listening on port ${PORT}`); 