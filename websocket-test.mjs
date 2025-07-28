import WebSocket from 'ws';

// Connect to the agent server WebSocket
const ws = new WebSocket('ws://localhost:7777/ws');

// Use the same channel ID that the game uses
const channelId = 'e292bdf2-0baa-4677-a3a6-9426672ce6d8';
const agentId = '2fbc0c27-50f4-09f2-9fe4-9dd27d76d46f';

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server');

  // Send initial connection message
  const connectMsg = {
    type: 'connect',
    agent_id: agentId,
    channel_id: channelId,
    client_type: 'test',
  };

  ws.send(JSON.stringify(connectMsg));
  console.log('📤 Sent connection message:', connectMsg);

  // Send a test message after 1 second
  setTimeout(() => {
    const testMsg = {
      type: 'user_message',
      content: 'Hello from WebSocket test! Can you hear me?',
      author: 'TestUser',
      channel_id: channelId,
      agent_id: agentId,
    };

    ws.send(JSON.stringify(testMsg));
    console.log('📤 Sent test message:', testMsg);
  }, 1000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('📥 Received message:', JSON.stringify(msg, null, 2));

    // If it's an agent message, highlight it
    if (msg.type === 'agent_message' || msg.type === 'agent_response') {
      console.log('🤖 AGENT RESPONSE:', msg.content || msg.text);
    }
  } catch (e) {
    console.log('📥 Received raw message:', data.toString());
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', () => {
  console.log('🔚 WebSocket connection closed');
});

// Keep the script running
setTimeout(() => {
  console.log('⏰ Test complete, closing connection...');
  ws.close();
}, 30000); // 30 seconds
