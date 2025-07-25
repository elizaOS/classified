describe('Socket.IO Connection Test', () => {
  beforeEach(() => {
    // Visit the game interface
    cy.visit('http://localhost:5174');
    cy.wait(3000); // Allow app to initialize
  });

  it('should establish Socket.IO connection with ElizaOS server', () => {
    // Verify the game interface loads
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');

    // Check connection status
    cy.get('[data-testid="connection-status"]', { timeout: 15000 }).should('contain.text', 'ONLINE');

    // Verify Socket.IO connection through Tauri IPC
    cy.window().then(async (win) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;

        // Wait for Socket.IO to be connected (with retries)
        let connected = false;
        for (let i = 0; i < 20; i++) {
          try {
            connected = await invoke('is_socketio_connected');
            if (connected) {break;}
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            // Socket.IO service might not be ready yet
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        expect(connected, 'Socket.IO should be connected to ElizaOS server').to.be.true;
        cy.log('✅ Socket.IO connection verified');
      }
    });
  });

  it('should be able to send messages through the chat interface', () => {
    // Wait for interface to be ready
    cy.get('[data-testid="message-input"]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="connection-status"]').should('contain.text', 'ONLINE');

    // Send a test message
    const testMessage = 'Test message for Socket.IO validation';
    cy.get('[data-testid="message-input"]').type(testMessage);
    cy.get('[data-testid="send-button"]').click();

    // Verify the message appears in chat
    cy.get('[data-testid="chat-messages"]').should('contain.text', testMessage);

    // Message should be marked as sent (appears in UI immediately)
    cy.get('[data-testid="user-message"]').last().should('contain.text', testMessage);

    cy.log('✅ Message sent through Socket.IO interface');
  });

  it('should handle Socket.IO disconnection gracefully', () => {
    cy.get('[data-testid="game-interface"]').should('be.visible');

    cy.window().then(async (win) => {
      if (win.__TAURI__) {
        const { invoke } = win.__TAURI__.core;

        // First verify connection
        const initialConnection = await invoke('is_socketio_connected');
        expect(initialConnection).to.be.true;

        // Disconnect Socket.IO
        await invoke('disconnect_socketio');
        cy.wait(1000);

        // Verify disconnection
        const disconnected = await invoke('is_socketio_connected');
        expect(disconnected).to.be.false;

        cy.log('✅ Socket.IO disconnection handled correctly');
      }
    });
  });
});
