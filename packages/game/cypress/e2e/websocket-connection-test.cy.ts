describe('WebSocket Connection Test', () => {
  beforeEach(() => {
    // Visit the game interface
    cy.visit('http://localhost:5174');
    cy.wait(3000); // Allow app to initialize
  });

  it('should pass comprehensive startup hello world test', () => {
    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 15000 }).should('be.visible');

    // Run the comprehensive startup test via Tauri IPC
    cy.window().then(async (win: any) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;

        try {
          // Run the comprehensive startup test
          const testResults = await invoke('run_startup_hello_world_test');
          
          // Log the full test results
          cy.log('Startup Test Results:');
          cy.log(testResults);
          
          // Check that all critical systems passed
          expect(testResults).to.include('✅ Startup manager is ready');
          expect(testResults).to.include('✅ HTTP API connection to AgentServer working');
          expect(testResults).to.include('✅ Test message sent via WebSocket');
          expect(testResults).to.include('✅ HTTP message ingestion working');
          expect(testResults).to.include('🎉 All critical systems operational!');
          
          // Take a screenshot showing successful test
          cy.screenshot('startup-test-success');
          
        } catch (error) {
          cy.log('Startup test failed:', error);
          // Take a screenshot of the failure state
          cy.screenshot('startup-test-failure');
          throw error;
        }
      } else {
        throw new Error('Tauri IPC not available');
      }
    });
  });

  it('should establish WebSocket connection with ElizaOS server', () => {
    // Verify the game interface loads
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');

    // Check connection status
    cy.get('[data-testid="connection-status"]', { timeout: 15000 }).should('contain.text', 'ONLINE');

    // Verify WebSocket connection through Tauri IPC
    cy.window().then(async (win: any) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;

        // Wait for WebSocket to be connected (with retries)
        let connected = false;
        for (let i = 0; i < 20; i++) {
          try {
            connected = await invoke('is_native_websocket_connected');
            if (connected) {break;}
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            // WebSocket service might not be ready yet
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        expect(connected, 'WebSocket should be connected to ElizaOS server').to.be.true;
        cy.log('✅ WebSocket connection verified');
      }
    });
  });

  it('should be able to send messages through the chat interface', () => {
    // Wait for interface to be ready
    cy.get('[data-testid="message-input"]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="connection-status"]').should('contain.text', 'ONLINE');

    // Send a test message
    const testMessage = 'Test message for WebSocket validation';
    cy.get('[data-testid="message-input"]').type(testMessage);
    cy.get('[data-testid="send-button"]').click();

    // Verify the message appears in chat
    cy.get('[data-testid="chat-messages"]').should('contain.text', testMessage);

    // Message should be marked as sent (appears in UI immediately)
    cy.get('[data-testid="user-message"]').last().should('contain.text', testMessage);

    cy.log('✅ Message sent through WebSocket interface');
  });

  it('should handle WebSocket disconnection gracefully', () => {
    cy.get('[data-testid="game-interface"]').should('be.visible');

    cy.window().then(async (win: any) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;

        // First verify connection
        const initialConnection = await invoke('is_native_websocket_connected');
        expect(initialConnection).to.be.true;

        // Disconnect WebSocket
        await invoke('disconnect_native_websocket');
        cy.wait(1000);

        // Verify disconnection
        const disconnected = await invoke('is_native_websocket_connected');
        expect(disconnected).to.be.false;

        cy.log('✅ WebSocket disconnection handled correctly');
      }
    });
  });
});
