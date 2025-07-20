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
import { terminalCharacter, populateSecureSecrets } from './terminal-character.js';
import { authManager } from './security/AuthenticationManager.js';
import { secureSecretsManager } from './security/SecureSecretsManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from multiple locations
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') }); // Project root

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
      console.log('[AGENT START] Agent created successfully in database');
    } catch (err) {
      // Agent might already exist, that's OK
      console.log('[AGENT START] Agent creation failed (may already exist):', err.message);
      console.log('[AGENT START] Continuing with existing agent...');
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
      console.log('[AGENT START] Server default agent creation failed (may already exist):', err.message);
      console.log('[AGENT START] Continuing with existing server agent...');
    }
    
    // Create a wrapped experience plugin without the evaluator that causes getCacheValue errors
    const experiencePluginWithoutEvaluator: Plugin = {
      ...experiencePlugin,
      evaluators: [], // Remove evaluators to avoid getCacheValue error
    };
    
    // Initialize secure secrets from environment variables
    console.log('[SECURITY] Initializing secure secrets management...');
    try {
      // Migrate existing environment secrets to secure storage
      const environmentSecrets = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY', 
        'DATABASE_URL',
        'DISCORD_APPLICATION_ID',
        'DISCORD_API_TOKEN',
        'ETH_PRIVATE_KEY',
        'SOLANA_PRIVATE_KEY'
      ];
      
      for (const secretKey of environmentSecrets) {
        const value = process.env[secretKey];
        if (value && value.trim()) {
          await secureSecretsManager.setSecret(
            secretKey,
            value,
            'system',
            secretKey.includes('PRIVATE_KEY') ? 'admin' : 'user'
          );
          console.log(`[SECURITY] Migrated ${secretKey} to secure storage`);
          
          // Clear from environment after storing securely
          delete process.env[secretKey];
        }
      }
      
      console.log('[SECURITY] Secure secrets management initialized');
    } catch (error) {
      console.error('[SECURITY] Failed to initialize secure secrets:', error);
      // Continue with startup but log the issue
    }
    
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

    // Use PGLite for local development to avoid database schema issues
    console.log('[BACKEND] Using PGLite database for local development');

    // Create and initialize server
    const server = new AgentServer();

    await server.initialize({
      dataDir
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
    
    // Add authentication middleware to protect admin endpoints
    console.log('[SECURITY] Setting up authentication middleware...');
    
    // Authentication endpoint
    server.app.post('/api/auth/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        
        const authResult = await authManager.authenticate(username, password, ip, userAgent);
        
        if (authResult) {
          res.json({
            success: true,
            data: {
              token: authResult.token,
              user: {
                id: authResult.user.id,
                username: authResult.user.username,
                roles: authResult.user.roles,
                permissions: authResult.user.permissions
              }
            }
          });
        } else {
          res.status(401).json({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' }
          });
        }
      } catch (error) {
        console.error('[AUTH] Login error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'AUTH_ERROR', message: 'Authentication failed' }
        });
      }
    });
    
    // Logout endpoint
    server.app.post('/api/auth/logout', async (req, res) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
        if (token) {
          await authManager.logout(token);
        }
        res.json({ success: true, message: 'Logged out successfully' });
      } catch (error) {
        console.error('[AUTH] Logout error:', error);
        res.status(500).json({
          success: false,
          error: { code: 'LOGOUT_ERROR', message: 'Logout failed' }
        });
      }
    });
    
    // Protect admin endpoints with authentication
    // Apply authentication middleware to specific routes
    server.app.use('/api/agents/:agentId/capabilities/:capability', authManager.authMiddleware());
    server.app.use('/api/agents/:agentId/settings', authManager.authMiddleware());
    server.app.use('/api/config/validate', authManager.authMiddleware());
    server.app.use('/api/config/test', authManager.authMiddleware());
    server.app.use('/api/plugin-config', authManager.authMiddleware());
    server.app.use('/api/reset-agent', authManager.authMiddleware());
    
    // Note: For production, also protect these routes with requirePermission middleware
    // Example: server.app.use('/api/config/validate', authManager.requirePermission('config:read'));
    
    console.log('[SECURITY] Authentication middleware configured for protected routes');

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
    const PORT = parseInt(process.env.PORT || process.env.SERVER_PORT || '7777');
    
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
    
    // Add secure secrets management endpoint
    server.app.get('/api/secrets', authManager.requirePermission('secrets:manage'), async (req, res) => {
      try {
        const user = (req as any).user;
        const secrets = secureSecretsManager.listSecrets(user.roles.includes('admin') ? 'admin' : 'user');
        
        res.json({
          success: true,
          data: {
            secrets: secrets.map(s => ({
              key: s.key,
              created: s.metadata.created,
              lastAccessed: s.metadata.lastAccessed,
              accessCount: s.metadata.accessCount,
              requiredRole: s.metadata.requiredRole
            }))
          }
        });
      } catch (error) {
        console.error('[SECURITY] Error listing secrets:', error);
        res.status(500).json({
          success: false,
          error: { code: 'SECRETS_ERROR', message: 'Failed to list secrets' }
        });
      }
    });
    
    // WORKAROUND: Add knowledge delete endpoint directly to server
    // This is needed because gameAPIPlugin routes aren't being registered correctly
    server.app.delete('/knowledge/documents/:documentId', authManager.requirePermission('config:write'), async (req, res) => {
      try {
        console.log('[BACKEND] Direct delete endpoint called for document:', req.params.documentId);
        
        // Find the runtime with the knowledge service
        let targetRuntime = null;
        for (const runtime of server.runtimes) {
          const knowledgeService = runtime.getService('knowledge');
          if (knowledgeService) {
            targetRuntime = runtime;
            break;
          }
        }
        
        if (!targetRuntime) {
          return res.status(404).json({
            success: false,
            error: { code: 'SERVICE_NOT_FOUND', message: 'Knowledge service not available' }
          });
        }
        
        const knowledgeService = targetRuntime.getService('knowledge');
        const documentId = req.params.documentId;
        
        // Use the knowledge service deleteMemory method to actually delete the document
        await (knowledgeService as any).deleteMemory(documentId);
        console.log('[BACKEND] Successfully deleted knowledge document:', documentId);
        
        res.json({
          success: true,
          data: {
            message: 'Document deleted successfully',
            documentId
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[BACKEND] Error deleting knowledge document:', error);
        res.status(500).json({
          success: false,
          error: { code: 'DELETE_FAILED', message: error.message },
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Now start the default Terminal agent AFTER server is running
    console.log('[BACKEND] Starting default Terminal agent...');
    
    // Populate character with secure secrets before starting
    const secureCharacter = await populateSecureSecrets(terminalCharacter);
    
    const { runtime, channelId } = await startAgent(secureCharacter, server);
    terminalRoomChannelId = channelId; // Update the global variable
    console.log('[BACKEND] ✅ Default agent started successfully with secure configuration');
    
    // CRITICAL: Add knowledge delete endpoint after agent runtime is available
    // This ensures the knowledge service is properly initialized
    console.log('[BACKEND] Adding knowledge delete endpoint with runtime access...');
    server.app.delete('/knowledge/documents/:documentId', async (req, res) => {
      try {
        console.log('[BACKEND] Knowledge delete endpoint called for document:', req.params.documentId);
        
        const knowledgeService = runtime.getService('knowledge');
        if (!knowledgeService) {
          console.error('[BACKEND] Knowledge service not found');
          return res.status(404).json({
            success: false,
            error: { code: 'SERVICE_NOT_FOUND', message: 'Knowledge service not available' }
          });
        }
        
        const documentId = req.params.documentId;
        console.log('[BACKEND] Attempting to delete document using knowledge service:', documentId);
        
        // Use the knowledge service deleteMemory method to actually delete the document
        await (knowledgeService as any).deleteMemory(documentId);
        console.log('[BACKEND] Successfully deleted knowledge document via deleteMemory:', documentId);
        
        res.json({
          success: true,
          data: {
            message: 'Document deleted successfully',
            documentId
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[BACKEND] Error deleting knowledge document:', error);
        res.status(500).json({
          success: false,
          error: { code: 'DELETE_FAILED', message: error.message },
          timestamp: new Date().toISOString()
        });
      }
    });
    console.log('[BACKEND] ✅ Knowledge delete endpoint added with runtime access');
    
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