import {
  AgentRuntime,
  createUniqueUuid,
  logger,
  Character,
  Plugin,
  ChannelType,
  stringToUuid,
  UUID,
  IAgentRuntime,
} from '@elizaos/core';
import autonomyPlugin from '@elizaos/plugin-autonomy';
import bootstrapPlugin from '@elizaos/plugin-bootstrap';
import { experiencePlugin } from '@elizaos/plugin-experience';
import { GoalsPlugin } from '@elizaos/plugin-goals';
import KnowledgePlugin from '@elizaos/plugin-knowledge';  // Re-enabled
import openaiPlugin from '@elizaos/plugin-openai';
import personalityPlugin from '@elizaos/plugin-personality';
import { shellPlugin } from '@elizaos/plugin-shell';
import sqlPlugin, { DatabaseMigrationService } from '@elizaos/plugin-sql';
import { stagehandPlugin } from '@elizaos/plugin-stagehand';
import { TodoPlugin } from '@elizaos/plugin-todo';
import visionPlugin from '@elizaos/plugin-vision';
import { AgentServer } from '@elizaos/server';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { gameAPIPlugin } from './game-api-plugin.js';
import { terminalCharacter } from './terminal-character.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Function to start an agent runtime
async function startAgent(character: any, server: any) {
  console.log('[AGENT START] Starting agent:', character.name);
  
  let channelId: UUID | null = null;
  
  try {
    // Ensure agent ID is set
    const agentId = character.id || stringToUuid(character.name);
    console.log('[AGENT START] Agent ID:', agentId);
    
    // Create/ensure agent exists in database
    const updatedCharacter = { ...character, id: agentId, agentId: agentId };
    
    try {
      await server.database.createAgent(updatedCharacter);
    } catch (err) {
      // Agent might already exist, that's OK
      console.log('[AGENT START] Agent may already exist, continuing...');
    }

    // CRITICAL: Also create the server's default agent ID in the database
    // The server uses agent ID '00000000-0000-0000-0000-000000000002' for plugin operations
    try {
      const serverDefaultAgent = {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'DefaultServerAgent',
      };
      await server.database.createAgent(serverDefaultAgent);
      console.log('[AGENT START] Created server default agent in database');
    } catch (err) {
      console.log('[AGENT START] Server default agent may already exist, continuing...');
    }
    
    // Create a wrapped experience plugin without the evaluator that causes getCacheValue errors
    const experiencePluginWithoutEvaluator: Plugin = {
      ...experiencePlugin,
      evaluators: [], // Remove evaluators to avoid getCacheValue error
    };
    
    // Create plugin list with all required plugins
    const plugins: Plugin[] = [
      sqlPlugin,
      bootstrapPlugin,
      openaiPlugin as any,
      autonomyPlugin, // Re-enabled - UUID format issue has been fixed
      shellPlugin,
      visionPlugin,
      stagehandPlugin,
      GoalsPlugin,
      TodoPlugin,
      personalityPlugin,
      experiencePluginWithoutEvaluator, // Use wrapped version without evaluators
      KnowledgePlugin,  // Re-enabled
      gameAPIPlugin  // Our custom API routes plugin
    ];

    // Create the runtime with the character and plugins using the shared database adapter
    const runtime = new AgentRuntime({
      agentId: agentId, // Explicitly set the agent ID to avoid conflicts
      character: updatedCharacter,
      plugins,
      conversationLength: 32,
    });
    
    console.log('[AGENT START] Created runtime, agent ID:', runtime.agentId);
    console.log('[AGENT START] Character agentId:', updatedCharacter.agentId);
    console.log('[AGENT START] Character id:', updatedCharacter.id);
    
    // Initialize the runtime (this also runs plugin initialization and migrations)
    await runtime.initialize();
    console.log('[AGENT START] Runtime initialized, final agent ID:', runtime.agentId);
    
    // Register runtime with server
    server.registerAgent(runtime);
    console.log('[AGENT START] Agent registered with server');
    
    // Create initial room for the agent
    try {
      const worldId = createUniqueUuid(runtime, 'terminal-world');
      channelId = createUniqueUuid(runtime, 'terminal-room');
      
      // Ensure world exists
      await runtime.ensureWorldExists({
        id: worldId,
        name: 'Terminal World',
        agentId: runtime.agentId,
        serverId: '00000000-0000-0000-0000-000000000000',
      });
      
      // Ensure room exists
      await runtime.ensureRoomExists({
        id: channelId,
        name: 'Terminal Room',
        source: 'terminal',
        type: ChannelType.GROUP,
        channelId: channelId,
        serverId: '00000000-0000-0000-0000-000000000000',
        worldId: worldId,
      });
      
      // Add agent as participant
      await runtime.addParticipant(runtime.agentId, channelId);
      await runtime.ensureParticipantInRoom(runtime.agentId, channelId);
      await runtime.setParticipantUserState(channelId, runtime.agentId, 'FOLLOWED');
      
      console.log('[AGENT START] Created initial room:', channelId);
    } catch (roomErr) {
      console.error('[AGENT START] Failed to create initial room:', roomErr);
      // Continue anyway - room creation is not critical
    }
    
    return { runtime, channelId };
  } catch (error) {
    console.error('[AGENT START] Failed to start agent:', error);
    throw error;
  }
}

export async function startServer() {
  try {
    console.log('[BACKEND] Initializing ElizaOS Terminal Server...');

    // Clean start - ensure fresh data directory
    const dataDir = path.resolve(process.cwd(), 'data');
    
    try {
      await fs.rm(dataDir, { recursive: true, force: true });
      console.log('[BACKEND] Cleaned data directory');
    } catch (err) {
      // Ignore if directory doesn't exist
    }
    
    await fs.mkdir(dataDir, { recursive: true });
    console.log('[BACKEND] Created fresh data directory');

    // Set the database path for the sqlPlugin to use
    process.env.PGLITE_DATA_DIR = dataDir;
    process.env.DATABASE_PATH = dataDir;

    // Create and initialize server
    const server = new AgentServer();

    await server.initialize({
      dataDir,
      postgresUrl: undefined, // Use PGLite
    });
    
    console.log('[BACKEND] Server initialized with PGLite database');

    // Add file upload middleware for knowledge document uploads
    const fileUpload = await import('express-fileupload');
    server.app.use(fileUpload.default({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
      useTempFiles: true,
      tempFileDir: '/tmp/',
      createParentPath: true
    }));

    // CRITICAL: Run plugin migrations for goals and todos plugins BEFORE starting agents
    console.log('[BACKEND] Running plugin migrations for goals and todos...');
    try {
      const migrationService = new DatabaseMigrationService();
      
      const db = (server.database as any).getDatabase();
      await migrationService.initializeWithDatabase(db);
      
      const pluginsWithSchemas = [GoalsPlugin, TodoPlugin];
      migrationService.discoverAndRegisterPluginSchemas(pluginsWithSchemas);
      
      await migrationService.runAllPluginMigrations();
      
      console.log('[BACKEND] ✅ Plugin migrations completed successfully');
    } catch (migrationError) {
      console.error('[BACKEND] ❌ Plugin migration failed:', migrationError);
      throw new Error(`Plugin migration failed: ${migrationError.message}`);
    }

    console.log('[BACKEND] ✅ All plugin migrations completed');
    
    // Start the server on port 7777 BEFORE starting agents
    const PORT = 7777;
    
    // Set SERVER_PORT env var so MessageBusService knows where to connect
    process.env.SERVER_PORT = PORT.toString();
    
    await server.start(PORT);
    console.log(`[BACKEND] ✅ Server started on port ${PORT}`);
    console.log(`[BACKEND] Server running at http://localhost:${PORT}`);
    
    // Add messaging stub endpoints directly to the server for MessageBusService compatibility
    // These need to be available before the agent starts
    console.log('[BACKEND] Adding messaging stub endpoints...');
    
    // Store the terminal room channel ID for the stub endpoints
    let terminalRoomChannelId: UUID | null = null;
    
    // Stub endpoint for agent servers (MessageBusService expects this)
    server.app.get('/api/messaging/agents/:agentId/servers', (req, res) => {
      res.json({
        success: true,
        data: {
          servers: ['00000000-0000-0000-0000-000000000000'] // Default server ID
        }
      });
    });
    
    // Stub endpoint for server channels (MessageBusService expects this)
    server.app.get('/api/messaging/central-servers/:serverId/channels', (req, res) => {
      // Return the terminal room channel if it exists
      const channels = terminalRoomChannelId ? [{ id: terminalRoomChannelId }] : [];
      res.json({
        success: true,
        data: {
          channels: channels
        }
      });
    });
    
    // Stub endpoint for channel details
    server.app.get('/api/messaging/central-channels/:channelId/details', (req, res) => {
      if (req.params.channelId === terminalRoomChannelId) {
        res.json({
          success: true,
          data: {
            id: terminalRoomChannelId,
            name: 'Terminal Room',
            type: 'GROUP'
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      }
    });
    
    // Stub endpoint for channel participants
    server.app.get('/api/messaging/central-channels/:channelId/participants', (req, res) => {
      // Return the agent as a participant if this is the terminal room
      const participants = req.params.channelId === terminalRoomChannelId ? [req.query.agentId || ''] : [];
      res.json({
        success: true,
        data: participants
      });
    });
    
    // Stub endpoint for message submission (agent responses)
    server.app.post('/api/messaging/submit', (req, res) => {
      const { 
        channel_id, 
        server_id, 
        author_id, 
        content, 
        raw_message, 
        metadata 
      } = req.body;
      
      // Broadcast the message to all Socket.IO clients in the channel
      if (server.socketIO) {
        server.socketIO.to(channel_id).emit('messageBroadcast', {
          senderId: author_id,
          senderName: metadata?.agentName || 'ELIZA',
          text: content,
          channelId: channel_id,
          roomId: channel_id, // For backward compatibility
          serverId: server_id,
          createdAt: Date.now(),
          source: 'agent_response',
          id: uuidv4(), // Generate a message ID
          thought: raw_message?.thought,
          actions: raw_message?.actions,
          attachments: metadata?.attachments,
        });
        
        console.log(`[BACKEND] Broadcasted agent message to channel ${channel_id}`);
      }
      
      res.json({
        success: true,
        message: 'Message acknowledged and broadcasted'
      });
    });
    
    // Stub endpoint for message completion notification
    server.app.post('/api/messaging/complete', (req, res) => {
      res.json({
        success: true
      });
    });
    
    console.log('[BACKEND] Messaging stub endpoints added');
    
    // Now start the default Terminal agent AFTER server is running
    console.log('[BACKEND] Starting default Terminal agent...');
    const { runtime, channelId } = await startAgent(terminalCharacter, server);
    terminalRoomChannelId = channelId; // Update the global variable
    console.log('[BACKEND] ✅ Default agent started successfully');
    
    // Wait for all initialization to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test API endpoints
    console.log('[BACKEND] Testing API endpoints...');
    
    // Test health endpoint
    const healthResponse = await fetch(`http://localhost:${PORT}/api/server/health`);
    const healthData = await healthResponse.json();
    console.log('[BACKEND] Health check:', healthData.data.status);
    
    // Test agents endpoint
    const agentsResponse = await fetch(`http://localhost:${PORT}/api/agents`);
    const agentsData = await agentsResponse.json();
    console.log('[BACKEND] Active agents:', agentsData.data.agents.length);

    console.log('[BACKEND] 🎮 Game backend is ready!');
    console.log('[BACKEND] Agent ID:', runtime.agentId);
    
    return server;

  } catch (error) {
    console.error('[BACKEND] Failed to start server:', error);
    console.error('[BACKEND] Fatal error:', error);
    process.exit(1);
  }
}

// Start the server only if this file is run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('[BACKEND] Fatal error:', error);
    process.exit(1);
  });
}