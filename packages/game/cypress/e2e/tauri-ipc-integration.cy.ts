describe('Tauri IPC Integration Test', () => {
  beforeEach(() => {
    // Visit the game interface
    cy.visit('http://localhost:5173');

    // Wait for the interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');
  });

  it('should show agent is connected via Tauri IPC', () => {
    // Check connection status
    cy.get('[data-testid="connection-status"]').should('contain', 'ONLINE');

    // Verify Tauri service is being used (not API client)
    cy.window().then((win) => {
      // Check if __TAURI__ is available
      expect((win as any).__TAURI__).to.exist;
    });
  });

  it('should send and receive messages through Tauri IPC', () => {
    // Type a test message
    const testMessage = 'Hello from Cypress test via Tauri IPC!';

    // Find the chat input and type the message
    cy.get('[data-testid="chat-input"]').type(testMessage);

    // Send the message
    cy.get('[data-testid="chat-send-button"]').click();

    // Verify the user message appears
    cy.get('[data-testid="user-message"]')
      .last()
      .should('contain', testMessage);

    // Wait for agent response (via Tauri IPC → Rust → HTTP → ElizaOS)
    cy.get('[data-testid="agent-message"]', { timeout: 15000 })
      .should('exist')
      .and('be.visible');

    // Verify we're getting actual agent responses (not just echo)
    cy.get('[data-testid="agent-message"]')
      .last()
      .should('not.contain', 'Echo from Rust backend');
  });

  it('should toggle capabilities through Tauri IPC', () => {
    // Test autonomy toggle
    cy.get('[data-testid="autonomy-toggle"]').click();

    // Wait for the toggle to complete
    cy.wait(1000);

    // Check the status changed
    cy.get('[data-testid="autonomy-toggle-status"]')
      .should('contain', '●'); // Active state

    // Toggle it back off
    cy.get('[data-testid="autonomy-toggle"]').click();

    cy.wait(1000);

    cy.get('[data-testid="autonomy-toggle-status"]')
      .should('contain', '○'); // Inactive state
  });

  it('should fetch and display goals via Tauri IPC', () => {
    // Click on the goals tab
    cy.get('[data-testid="goals-tab"]').click();

    // Wait for goals to load
    cy.wait(2000);

    // Check that goals content is displayed
    cy.get('[data-testid="goals-content"]').should('be.visible');

    // Verify goals are fetched (even if empty)
    cy.get('.status-header').should('contain', 'GOALS');
  });

  it('should fetch and display todos via Tauri IPC', () => {
    // Click on the todos tab
    cy.get('[data-testid="todos-tab"]').click();

    // Wait for todos to load
    cy.wait(2000);

    // Check that todos content is displayed
    cy.get('[data-testid="todos-content"]').should('be.visible');

    // Verify todos header is shown
    cy.get('.status-header').should('contain', 'TASKS');
  });

  it('should show real-time agent thoughts in monologue tab', () => {
    // Click on the monologue tab
    cy.get('[data-testid="monologue-tab"]').click();

    // Wait for monologue to load
    cy.wait(2000);

    // Check that monologue content area exists
    cy.get('[data-testid="monologue-content"]').should('exist');

    // Verify monologue header
    cy.get('.status-header').should('contain', 'THOUGHTS');
  });

  it('should handle configuration updates via Tauri IPC', () => {
    // Click on the config tab
    cy.get('[data-testid="config-tab"]').click();

    // Wait for config to load
    cy.wait(1000);

    // Check that config content is displayed
    cy.get('[data-testid="config-content"]').should('be.visible');

    // Verify we can see model provider settings
    cy.get('.config-title').should('contain', 'Model Provider Settings');

    // Test configuration validation button exists
    cy.get('[data-testid="validate-config-button"]').should('exist');
  });

  it('should maintain connection through entire session', () => {
    // Send multiple messages to test stability
    const messages = [
      'First test message',
      'Second test message',
      'Third test message'
    ];

    messages.forEach((msg, index) => {
      cy.get('[data-testid="chat-input"]').type(msg);
      cy.get('[data-testid="chat-send-button"]').click();

      // Wait for each message to appear
      cy.get('[data-testid="user-message"]')
        .should('have.length.at.least', index + 1);

      // Small delay between messages
      cy.wait(2000);
    });

    // Verify connection is still online after multiple messages
    cy.get('[data-testid="connection-status"]').should('contain', 'ONLINE');

    // Verify we got agent responses
    cy.get('[data-testid="agent-message"]', { timeout: 20000 })
      .should('have.length.at.least', 1);
  });
});
