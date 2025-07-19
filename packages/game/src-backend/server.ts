import { AgentServer } from '@elizaos/server';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  try {
    console.log('[BACKEND] Initializing ElizaOS Terminal Server...');

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', '..', 'data');
    await fs.mkdir(dataDir, { recursive: true });

    // Create server instance
    const server = new AgentServer();

    // Initialize with PGLite for local development
    await server.initialize({
      dataDir,
      postgresUrl: undefined, // Use PGLite
    });

    console.log('[BACKEND] Server initialized with PGLite database');

    // Start the server on port 3000
    const port = parseInt(process.env.PORT || '3000', 10);
    server.start(port);

    console.log('[BACKEND] Server started on port ' + port);
    console.log('[BACKEND] Server running at http://localhost:' + port);
    console.log('[BACKEND] No agents loaded initially. Agents will be loaded via API or tests.');
    console.log('[BACKEND] Use POST /api/agents to load the Terminal agent');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('[BACKEND] Shutting down server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('[BACKEND] Shutting down server...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('[BACKEND] Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
