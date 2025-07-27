import { v4 as uuidv4 } from 'uuid';

// Test the ElizaService functionality using direct fetch calls
// This avoids the "use client" issue in the API client

async function testElizaServiceDirect() {
  console.log('🧪 Testing ElizaOS Server Integration (Direct)...\n');

  const baseUrl = 'http://localhost:7777';
  const userId = uuidv4();
  const agentId = '00000000-0000-0000-0000-000000000001';

  try {
    // Test 1: Ping
    console.log('1️⃣ Testing ping...');
    const pingResponse = await fetch(`${baseUrl}/api/server/ping`);
    const pingResult = await pingResponse.json();
    console.log('✅ Server is alive:', pingResult.pong === true);
    console.log('');

    // Test 2: Get DM channel
    console.log('2️⃣ Testing DM channel creation...');
    const channelResponse = await fetch(
      `${baseUrl}/api/messaging/dm-channel?targetUserId=${agentId}&currentUserId=${userId}`
    );
    const channelResult = await channelResponse.json();
    const channel = channelResult.data;
    console.log('✅ DM Channel:', {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      serverId: channel.serverId,
    });
    console.log('');

    // Test 3: Send a message
    console.log('3️⃣ Testing message sending...');
    const messageResponse = await fetch(
      `${baseUrl}/api/messaging/central-channels/${channel.id}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'Hello from ElizaService direct test!',
          author_id: userId,
          server_id: channel.serverId || '00000000-0000-0000-0000-000000000000',
          metadata: {
            source: 'terminal_gui',
            userDisplayName: 'User',
          },
        }),
      }
    );
    const messageResult = await messageResponse.json();
    const message = messageResult.data;
    console.log('✅ Message sent:', {
      id: message.id,
      content: message.content,
      authorId: message.author_id || message.authorId,
      timestamp: message.created_at || message.createdAt,
    });
    console.log('');

    // Test 4: Get messages
    console.log('4️⃣ Testing message retrieval...');
    const messagesResponse = await fetch(
      `${baseUrl}/api/messaging/central-channels/${channel.id}/messages?limit=50`
    );
    const messagesResult = await messagesResponse.json();
    const messages =
      messagesResult.data?.messages || messagesResult.messages || messagesResult.data || [];
    console.log(`✅ Retrieved ${messages.length} messages`);
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      console.log('Latest message:', {
        content: latestMessage.content,
        author: latestMessage.metadata?.userDisplayName || latestMessage.authorName || 'Unknown',
      });
    }
    console.log('');

    console.log('🎉 All direct server tests passed!');
    console.log('');
    console.log('ℹ️ Test Details:');
    console.log('- User ID:', userId);
    console.log('- Agent ID:', agentId);
    console.log('- Channel ID:', channel.id);
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testElizaServiceDirect().catch(console.error);
