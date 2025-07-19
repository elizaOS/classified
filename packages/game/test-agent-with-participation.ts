async function testAgentWithParticipation() {
  try {
    console.log('=== Testing Agent Response with Participation Fix ===\n');
    
    // 1. Check if agent is running
    console.log('1. Checking agent status...');
    const agentsResponse = await fetch('http://localhost:3000/api/agents');
    if (!agentsResponse.ok) {
      console.error('Failed to get agents:', agentsResponse.status);
      return;
    }
    
    const agentsData = await agentsResponse.json();
    const agents = agentsData.data || agentsData;
    
    if (!Array.isArray(agents) || agents.length === 0) {
      console.error('No agents found! Make sure the Terminal agent is loaded.');
      return;
    }
    
    const terminalAgent = agents.find((a: any) => a.name === 'Terminal');
    if (!terminalAgent) {
      console.error('Terminal agent not found!');
      return;
    }
    
    console.log(`   ✅ Terminal agent found: ${terminalAgent.id}`);
    console.log(`   Status: ${terminalAgent.enabled ? 'Active' : 'Inactive'}`);
    
    // 2. Get or create a channel
    console.log('\n2. Getting channels...');
    const channelsResponse = await fetch('http://localhost:3000/api/messaging/central-channels');
    if (!channelsResponse.ok) {
      console.error('Failed to get channels:', channelsResponse.status);
      return;
    }
    
    const channelsData = await channelsResponse.json();
    const channels = channelsData.data || channelsData;
    
    let channelId;
    if (Array.isArray(channels) && channels.length > 0) {
      channelId = channels[0].id;
      console.log(`   Using existing channel: ${channelId}`);
    } else {
      // Create a new channel
      console.log('   No channels found, creating one...');
      const createChannelResponse = await fetch('http://localhost:3000/api/messaging/central-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Channel',
          type: 'DIRECT',
          participantCentralUserIds: ['c42addb0-0384-4d86-a5e0-d65b4d90b110', terminalAgent.id]
        })
      });
      
      if (!createChannelResponse.ok) {
        console.error('Failed to create channel:', await createChannelResponse.text());
        return;
      }
      
      const newChannel = await createChannelResponse.json();
      channelId = newChannel.data.id;
      console.log(`   ✅ Created new channel: ${channelId}`);
    }
    
    // 3. Send a test message
    console.log('\n3. Sending test message...');
    const testMessage = 'Hello World';
    const userId = 'c42addb0-0384-4d86-a5e0-d65b4d90b110';
    
    const messageResponse = await fetch(`http://localhost:3000/api/messaging/central-channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: channelId,
        content: testMessage,
        author_id: userId,
        server_id: '00000000-0000-0000-0000-000000000000',
        metadata: {
          source: 'test_script',
          userDisplayName: 'Test User'
        }
      })
    });
    
    if (!messageResponse.ok) {
      console.error('Failed to send message:', await messageResponse.text());
      return;
    }
    
    const sentMessage = await messageResponse.json();
    console.log(`   ✅ Message sent: ${sentMessage.id}`);
    
    // 4. Wait for agent response
    console.log('\n4. Waiting for agent response...');
    let attempts = 0;
    const maxAttempts = 20; // 20 seconds
    let agentResponded = false;
    
    while (attempts < maxAttempts && !agentResponded) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      const messagesResponse = await fetch(`http://localhost:3000/api/messaging/central-channels/${channelId}/messages?limit=10`);
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const messages = messagesData.data || messagesData;
        
        // Look for agent response
        const agentMessage = messages.find((msg: any) => 
          msg.authorId === terminalAgent.id && 
          msg.createdAt > sentMessage.createdAt
        );
        
        if (agentMessage) {
          agentResponded = true;
          console.log(`\n   ✅ Agent responded!`);
          console.log(`   Message: "${agentMessage.content}"`);
          console.log(`   Response time: ${attempts} seconds`);
        } else {
          process.stdout.write(`   Waiting... (${attempts}/${maxAttempts})\r`);
        }
      }
    }
    
    if (!agentResponded) {
      console.log(`\n   ❌ No agent response after ${maxAttempts} seconds`);
      console.log('\n5. Troubleshooting...');
      console.log('   Check server logs for:');
      console.log('   - "Agent not a participant in channel" messages');
      console.log('   - Database connection errors');
      console.log('   - Plugin loading errors');
    }
    
    console.log('\n=== Test Complete ===');
    console.log(`Channel ID: ${channelId}`);
    console.log(`Agent ID: ${terminalAgent.id}`);
    console.log(`Result: ${agentResponded ? '✅ SUCCESS - Agent responded!' : '❌ FAILED - No response'}`);
    
  } catch (error) {
    console.error('\n❌ Test error:', error);
  }
}

// Run the test
testAgentWithParticipation(); 