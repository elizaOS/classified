import { ElizaService } from '../src/services/ElizaService';

async function testElizaService() {
  console.log('🧪 Testing ElizaService Integration...\n');

  const service = new ElizaService('http://localhost:7777');

  try {
    // Test 1: Ping
    console.log('1️⃣ Testing ping...');
    const isAlive = await service.ping();
    console.log('✅ Server is alive:', isAlive);
    console.log('');

    // Test 2: Get DM channel
    console.log('2️⃣ Testing DM channel creation...');
    const channel = await service.getOrCreateDmChannel();
    console.log('✅ DM Channel:', {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      serverId: channel.serverId,
    });
    console.log('');

    // Test 3: Send a message
    console.log('3️⃣ Testing message sending...');
    const message = await service.sendMessage(channel.id, 'Hello from ElizaService test!');
    console.log('✅ Message sent:', {
      id: message.id,
      content: message.content,
      authorId: message.authorId,
      authorName: message.authorName,
      timestamp: message.timestamp,
    });
    console.log('');

    // Test 4: Get messages
    console.log('4️⃣ Testing message retrieval...');
    const messages = await service.getChannelMessages(channel.id);
    console.log(`✅ Retrieved ${messages.length} messages`);
    if (messages.length > 0) {
      console.log('Latest message:', {
        content: messages[messages.length - 1].content,
        author: messages[messages.length - 1].authorName,
      });
    }
    console.log('');

    console.log('🎉 All ElizaService tests passed!');
    console.log('');
    console.log('ℹ️ Service Details:');
    console.log('- User ID:', service.getUserId());
    console.log('- Agent ID:', service.getAgentId());
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testElizaService().catch(console.error);
