#!/usr/bin/env node

// Simple Socket.IO test server to verify the client connection works
import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 7777;
const ROOM_ID = '3a3cab1f-9055-0b62-a4b5-23db6cd653d7';
const AGENT_ID = '2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket']
});

console.log('🚀 Starting test Socket.IO server...');

// Track connections
let connectionCount = 0;

io.on('connection', (socket) => {
  connectionCount++;
  console.log(`🔌 Client connected: ${socket.id} (total: ${connectionCount})`);

  // Auto-join the game room
  socket.join(ROOM_ID);
  console.log(`📍 Auto-joined client to room: ${ROOM_ID}`);

  // Handle join room requests
  socket.on('join-room', (data) => {
    console.log('📍 Explicit join-room request:', data);
    socket.join(ROOM_ID);
    socket.emit('room-joined', { roomId: ROOM_ID, success: true });
  });

  // Handle messages with immediate echo response
  socket.on('message', (data) => {
    console.log('📨 Received message:', data);

    let messageText = '';
    if (typeof data === 'string') {
      messageText = data;
    } else if (data && data.text) {
      messageText = data.text;
    } else if (data && data.content) {
      messageText = data.content;
    } else {
      messageText = JSON.stringify(data);
    }

    // Send immediate agent response
    const agentResponse = {
      id: `response-${Date.now()}`,
      text: `Hello! I received your message: "${messageText}". The Socket.IO connection is working perfectly! 🎉✨`,
      authorId: AGENT_ID,
      senderId: AGENT_ID,
      roomId: ROOM_ID,
      timestamp: Date.now(),
      type: 'agent_response'
    };

    // Send the response via multiple Socket.IO events to match ElizaOS behavior
    setTimeout(() => {
      io.to(ROOM_ID).emit('message', agentResponse);
      io.to(ROOM_ID).emit('agent-response', agentResponse);
      io.to(ROOM_ID).emit('broadcast', { type: 'agent-response', payload: agentResponse });

      console.log(`🤖 Sent agent response: "${agentResponse.text}"`);
    }, 1000); // 1 second delay to simulate processing
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    connectionCount--;
    console.log(`❌ Client disconnected: ${socket.id} (${reason}) (remaining: ${connectionCount})`);
  });

  // Send welcome message
  socket.emit('connected', {
    message: 'Connected to test Socket.IO server',
    serverId: 'test-server',
    agentId: AGENT_ID,
    defaultRoom: ROOM_ID
  });
});

// Simple health check - only handle non-Socket.IO requests
httpServer.on('request', (req, res) => {
  // Let Socket.IO handle its own requests
  if (req.url && req.url.startsWith('/socket.io/')) {
    return; // Let Socket.IO handle this
  }

  if (req.url === '/api/server/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      server: 'test-socketio-server',
      connections: connectionCount,
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

httpServer.listen(PORT, () => {
  console.log(`✅ Test Socket.IO server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO endpoint: http://localhost:${PORT}/socket.io/`);
  console.log(`📍 Default room: ${ROOM_ID}`);
  console.log(`🆔 Agent ID: ${AGENT_ID}`);
  console.log('Ready for testing! Send a message and you should get an immediate response.');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test server...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
