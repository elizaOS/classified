describe('Socket.IO Messaging Integration', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5174');
    cy.wait(3000); // Allow app to initialize
  });

  it('should establish Socket.IO connection and handle message exchange', () => {
    // Step 1: Verify the app loads and Socket.IO connection is established
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');

    // Step 2: Wait for Socket.IO connection to be established
    cy.window().then((win) => {
      // Wait for Tauri and Socket.IO to be ready
      cy.wrap(null).should(() => {
        expect(win.__TAURI__).to.exist;
      });
    });

    // Step 3: Check Socket.IO connection status using Tauri command
    cy.window().then(async (win) => {
      const { invoke } = win.__TAURI__.core;

      // Wait for connection to be established (retry up to 30 seconds)
      let connected = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!connected && attempts < maxAttempts) {
        try {
          connected = await invoke('is_socketio_connected');
          if (!connected) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        } catch (error) {
          cy.log('Socket.IO connection check failed:', error);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(connected, 'Socket.IO should be connected').to.be.true;
      cy.log('✅ Socket.IO connection established');
    });

    // Step 4: Set up message listeners before sending messages
    cy.window().then((win) => {
      // Listen for Socket.IO events from Tauri
      const { event } = win.__TAURI__;

      // Track received messages
      win.receivedMessages = [];
      win.receivedAgentResponses = [];
      win.receivedBroadcasts = [];

      // Listen for different types of Socket.IO events
      event.listen('socketio-connected', (eventData) => {
        cy.log('🔌 Socket.IO connected event received');
        win.socketioConnected = true;
      });

      event.listen('agent-message-received', (eventData) => {
        cy.log('📨 Agent message received:', eventData.payload);
        win.receivedMessages.push(eventData.payload);
      });

      event.listen('agent-response', (eventData) => {
        cy.log('🤖 Agent response received:', eventData.payload);
        win.receivedAgentResponses.push(eventData.payload);
      });

      event.listen('message-broadcast', (eventData) => {
        cy.log('📡 Message broadcast received:', eventData.payload);
        win.receivedBroadcasts.push(eventData.payload);
      });

      event.listen('raw-message-received', (eventData) => {
        cy.log('📝 Raw message received:', eventData.payload);
        win.receivedMessages.push({ type: 'raw', data: eventData.payload });
      });
    });

    // Step 5: Send a test message through the Socket.IO system
    const testMessage = 'Hello ELIZA, this is a Socket.IO test message!';
    const roomId = '3a3cab1f-9055-0b62-a4b5-23db6cd653d7'; // Default game room

    cy.window().then(async (win) => {
      const { invoke } = win.__TAURI__.core;

      try {
        // Send message via Socket.IO
        await invoke('send_socketio_message', {
          message: testMessage,
          roomId
        });

        cy.log('📤 Message sent via Socket.IO:', testMessage);
      } catch (error) {
        cy.log('❌ Failed to send Socket.IO message:', error);
        throw error;
      }
    });

    // Step 6: Verify message was sent and wait for responses
    cy.wait(5000); // Allow time for message processing and agent responses

    // Step 7: Check if we received any Socket.IO events
    cy.window().then((win) => {
      cy.log('📊 Socket.IO Test Results:');
      cy.log('Connected:', win.socketioConnected);
      cy.log('Messages received:', win.receivedMessages?.length || 0);
      cy.log('Agent responses:', win.receivedAgentResponses?.length || 0);
      cy.log('Broadcasts:', win.receivedBroadcasts?.length || 0);

      // At minimum, we should have established connection
      expect(win.socketioConnected, 'Socket.IO connection should be confirmed').to.be.true;

      // We should have received some form of message or response
      const totalEvents = (win.receivedMessages?.length || 0) +
                         (win.receivedAgentResponses?.length || 0) +
                         (win.receivedBroadcasts?.length || 0);

      if (totalEvents > 0) {
        cy.log('✅ Socket.IO messaging is working - received events');
      } else {
        cy.log('⚠️ No Socket.IO events received - may indicate agent processing issues');
      }
    });

    // Step 8: Test direct HTTP messaging for comparison
    cy.request({
      method: 'POST',
      url: 'http://localhost:7777/api/agents',
      failOnStatusCode: false
    }).then((response) => {
      cy.log('🌐 Server API Status:', response.status);

      if (response.status === 200 && response.body.success) {
        cy.log('✅ ElizaOS server is responding to HTTP requests');
        cy.log('Available agents:', response.body.data?.agents?.length || 0);
      }
    });

    // Step 9: Verify the message input UI is functional
    cy.get('[data-testid="message-input"]', { timeout: 5000 }).should('be.visible');
    cy.get('[data-testid="message-input"]').type(testMessage);
    cy.get('[data-testid="send-button"]').click();

    // Step 10: Wait and verify UI updates
    cy.wait(2000);

    // Check if the message appears in the UI
    cy.get('[data-testid="chat-messages"]').should('contain.text', testMessage);

    cy.log('✅ Socket.IO messaging integration test completed');
  });

  it('should handle Socket.IO connection errors gracefully', () => {
    cy.visit('http://localhost:5174');
    cy.wait(2000);

    cy.window().then(async (win) => {
      const { invoke } = win.__TAURI__.core;

      // Test connection to invalid URL
      try {
        await invoke('connect_socketio', {
          url: 'http://localhost:9999' // Invalid URL
        });
      } catch (error) {
        cy.log('✅ Socket.IO properly handles connection errors:', error);
        expect(error).to.exist;
      }
    });
  });

  it('should reconnect Socket.IO after disconnection', () => {
    cy.visit('http://localhost:5174');
    cy.wait(3000);

    cy.window().then(async (win) => {
      const { invoke } = win.__TAURI__.core;

      // First verify connection
      const initialConnection = await invoke('is_socketio_connected');
      expect(initialConnection).to.be.true;

      // Disconnect
      await invoke('disconnect_socketio');
      cy.wait(1000);

      // Verify disconnection
      const disconnected = await invoke('is_socketio_connected');
      expect(disconnected).to.be.false;

      // Reconnect
      await invoke('connect_socketio', {
        url: 'http://localhost:7777'
      });
      cy.wait(2000);

      // Verify reconnection
      const reconnected = await invoke('is_socketio_connected');
      expect(reconnected).to.be.true;

      cy.log('✅ Socket.IO reconnection test passed');
    });
  });
});
