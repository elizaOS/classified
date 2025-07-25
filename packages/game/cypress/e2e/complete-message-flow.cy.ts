describe('Complete End-to-End Message Flow', () => {
  const TEST_MESSAGE = 'Hello ELIZA, please respond to this test message to verify the complete flow works.';
  const RESPONSE_TIMEOUT = 30000; // 30 seconds for agent response

  beforeEach(() => {
    // Visit the game and wait for it to load
    cy.visit('http://localhost:5174');
    cy.wait(3000);
  });

  it('should complete full message flow: User → Game → Socket.IO → Agent → Response → Socket.IO → Game → User', () => {
    // Step 1: Verify game interface is ready
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="connection-status"]', { timeout: 15000 }).should('contain.text', 'ONLINE');

    // Step 2: Set up message tracking
    cy.window().then((win) => {
      // Initialize tracking arrays
      win.testTracking = {
        messagesSent: [],
        messagesReceived: [],
        agentResponses: [],
        socketIOEvents: []
      };

      // Set up Socket.IO event listeners
      if (win.__TAURI__) {
        const { event } = win.__TAURI__;

        // Track agent messages
        event.listen('agent-message-received', (eventData) => {
          cy.log('📨 Agent message received:', eventData.payload);
          win.testTracking.agentResponses.push({
            type: 'agent-message',
            data: eventData.payload,
            timestamp: Date.now()
          });
        });

        // Track Socket.IO events
        event.listen('socketio-connected', () => {
          cy.log('🔌 Socket.IO connected');
          win.testTracking.socketIOEvents.push({
            type: 'connected',
            timestamp: Date.now()
          });
        });

        // Track raw messages
        event.listen('raw-message-received', (eventData) => {
          cy.log('📝 Raw message received:', eventData.payload);
          win.testTracking.messagesReceived.push({
            type: 'raw-message',
            data: eventData.payload,
            timestamp: Date.now()
          });
        });
      }
    });

    // Step 3: Verify Socket.IO connection is established
    cy.window().then(async (win) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;

        // Wait for Socket.IO connection
        let connected = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!connected && attempts < maxAttempts) {
          try {
            connected = await invoke('is_socketio_connected');
            if (!connected) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              attempts++;
            }
          } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        }

        expect(connected, 'Socket.IO must be connected for message flow test').to.be.true;
        cy.log('✅ Socket.IO connection verified');
      }
    });

    // Step 4: Record initial message count
    let initialMessageCount = 0;
    cy.get('[data-testid="chat-messages"] [data-testid]').then($messages => {
      initialMessageCount = $messages.length;
      cy.log(`Initial message count: ${initialMessageCount}`);
    });

    // Step 5: Send test message through UI
    cy.get('[data-testid="message-input"]').should('be.visible').type(TEST_MESSAGE);
    cy.get('[data-testid="send-button"]').click();

    // Step 6: Verify user message appears immediately
    cy.get('[data-testid="chat-messages"]').should('contain.text', TEST_MESSAGE);
    cy.get('[data-testid="user-message"]').last().should('contain.text', TEST_MESSAGE);

    cy.log('✅ User message sent and displayed');

    // Step 7: Wait for and verify agent response
    cy.window().then((win) => {
      // Wait for agent response with detailed monitoring
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          cy.log(`❌ Agent response timeout after ${elapsed}ms`);
          cy.log('Socket.IO events:', win.testTracking?.socketIOEvents || []);
          cy.log('Messages received:', win.testTracking?.messagesReceived || []);
          cy.log('Agent responses:', win.testTracking?.agentResponses || []);
          reject(new Error('Agent did not respond within timeout period'));
        }, RESPONSE_TIMEOUT);

        const checkForResponse = () => {
          // Check if we have any new messages beyond our initial count + user message
          cy.get('[data-testid="chat-messages"] [data-testid]').then($messages => {
            const currentMessageCount = $messages.length;
            const expectedMinimum = initialMessageCount + 2; // +1 for user message, +1 for agent response

            if (currentMessageCount >= expectedMinimum) {
              // Look for agent messages specifically
              cy.get('[data-testid="agent-message"]').then($agentMessages => {
                if ($agentMessages.length > 0) {
                  const latestAgentMessage = $agentMessages.last().text();
                  cy.log(`✅ Agent responded: "${latestAgentMessage.substring(0, 100)}..."`);
                  clearTimeout(timeout);
                  resolve(true);

                }
              });
            }

            // Check tracking data
            if (win.testTracking?.agentResponses?.length > 0) {
              cy.log('✅ Agent response detected via Socket.IO events');
              clearTimeout(timeout);
              resolve(true);
              return;
            }

            // Continue checking
            setTimeout(checkForResponse, 1000);
          });
        };

        // Start checking after a brief delay
        setTimeout(checkForResponse, 2000);
      });
    });

    // Step 8: Verify the complete flow worked
    cy.window().then((win) => {
      cy.log('🔍 Final verification of message flow...');

      // Check that we have both user and agent messages
      cy.get('[data-testid="user-message"]').should('have.length.at.least', 1);
      cy.get('[data-testid="agent-message"]').should('have.length.at.least', 1);

      // Verify our test message is present
      cy.get('[data-testid="chat-messages"]').should('contain.text', TEST_MESSAGE);

      // Log final tracking data for debugging
      cy.log('Socket.IO events:', win.testTracking?.socketIOEvents || []);
      cy.log('Messages received:', win.testTracking?.messagesReceived || []);
      cy.log('Agent responses:', win.testTracking?.agentResponses || []);

      cy.log('✅ Complete end-to-end message flow verified!');
    });
  });

  it('should handle multiple rapid messages correctly', () => {
    // Verify interface is ready
    cy.get('[data-testid="game-interface"]').should('be.visible');
    cy.get('[data-testid="connection-status"]').should('contain.text', 'ONLINE');

    // Send multiple messages rapidly
    const messages = [
      'First test message',
      'Second test message',
      'Third test message'
    ];

    messages.forEach((message, index) => {
      cy.get('[data-testid="message-input"]').clear().type(message);
      cy.get('[data-testid="send-button"]').click();
      cy.wait(1000); // Small delay between messages

      // Verify each message appears
      cy.get('[data-testid="chat-messages"]').should('contain.text', message);
    });

    // Wait for potential agent responses
    cy.wait(10000);

    // Verify all user messages are present
    messages.forEach(message => {
      cy.get('[data-testid="chat-messages"]').should('contain.text', message);
    });

    cy.log('✅ Multiple message handling verified');
  });

  it('should maintain Socket.IO connection during extended interaction', () => {
    cy.get('[data-testid="game-interface"]').should('be.visible');

    // Verify initial connection
    cy.window().then(async (win) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;
        const connected = await invoke('is_socketio_connected');
        expect(connected).to.be.true;
      }
    });

    // Send message and wait
    cy.get('[data-testid="message-input"]').type('Testing connection stability');
    cy.get('[data-testid="send-button"]').click();

    // Wait for 10 seconds (simulating extended interaction)
    cy.wait(10000);

    // Verify connection is still active
    cy.window().then(async (win) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;
        const stillConnected = await invoke('is_socketio_connected');
        expect(stillConnected, 'Socket.IO connection should remain stable').to.be.true;
      }
    });

    cy.log('✅ Socket.IO connection stability verified');
  });
});
