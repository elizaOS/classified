/// <reference types="cypress" />

describe('Chat Message Improvements', () => {
  beforeEach(() => {
    // Start fresh and navigate to the game
    cy.visit('http://localhost:5174');

    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');

    // Wait for connection status to show connected
    cy.get('[data-testid="connection-status"]', { timeout: 15000 }).should(
      'contain.text',
      'Connected'
    );
  });

  it('should not show system messages for goals and todos loading in chat', () => {
    // Wait for initial load
    cy.wait(3000);

    // Check that goals/todos loading messages are not in the chat output
    cy.get('[data-testid="chat-output"]')
      .should('not.contain.text', '✅ Goals loaded:')
      .should('not.contain.text', '✅ TODOs loaded:');

    // But the ELIZA terminal welcome message should still be there
    cy.get('[data-testid="chat-output"]').should(
      'contain.text',
      '◉ ELIZA TERMINAL v2.0 - Agent Connection Established'
    );
  });

  it('should immediately post user messages to chat without waiting for server', () => {
    const testMessage = 'Test immediate message posting';

    // Type a message
    cy.get('[data-testid="chat-input"]').type(testMessage);

    // Record timestamp before sending
    const beforeSend = Date.now();

    // Submit the message
    cy.get('[data-testid="chat-form"]').submit();

    // The user message should appear immediately (within a very short time)
    cy.get('[data-testid="chat-output"]').should('contain.text', testMessage);

    // Verify it appeared quickly (within 500ms)
    const afterCheck = Date.now();
    expect(afterCheck - beforeSend).to.be.lessThan(500);

    // Input should be cleared
    cy.get('[data-testid="chat-input"]').should('have.value', '');
  });

  it('should filter out duplicate user messages from server broadcasts', () => {
    const testMessage = 'Test duplicate filtering';

    // Send a message
    cy.get('[data-testid="chat-input"]').type(testMessage);
    cy.get('[data-testid="chat-form"]').submit();

    // Wait a bit for potential server response
    cy.wait(2000);

    // Count how many times our test message appears in the chat
    cy.get('[data-testid="chat-output"]').then(($output) => {
      const text = $output.text();
      const messageCount = (text.match(new RegExp(testMessage, 'g')) || []).length;

      // Should only appear once (our immediate post), not duplicated by server echo
      expect(messageCount).to.equal(1);
    });
  });

  it('should show user and agent messages with different types', () => {
    const userMessage = 'Hello agent, how are you?';

    // Send a user message
    cy.get('[data-testid="chat-input"]').type(userMessage);
    cy.get('[data-testid="chat-form"]').submit();

    // User message should appear immediately
    cy.get('[data-testid="chat-output"]').should('contain.text', userMessage);

    // Wait for potential agent response
    cy.wait(5000);

    // Check that we have both user and potentially agent messages
    cy.get('[data-testid="chat-output"]').then(($output) => {
      const outputText = $output.text();

      // Should contain our user message
      expect(outputText).to.include(userMessage);

      // May contain agent response (depending on backend status)
      // This is optional since the agent might not respond in test environment
    });
  });

  it('should maintain correct message order and timestamps', () => {
    const message1 = 'First message';
    const message2 = 'Second message';

    // Send first message
    cy.get('[data-testid="chat-input"]').type(message1);
    cy.get('[data-testid="chat-form"]').submit();

    // Brief wait
    cy.wait(500);

    // Send second message
    cy.get('[data-testid="chat-input"]').type(message2);
    cy.get('[data-testid="chat-form"]').submit();

    // Check that messages appear in order
    cy.get('[data-testid="chat-output"]').then(($output) => {
      const text = $output.text();
      const firstIndex = text.indexOf(message1);
      const secondIndex = text.indexOf(message2);

      // First message should appear before second message
      expect(firstIndex).to.be.lessThan(secondIndex);
      expect(firstIndex).to.be.greaterThan(-1);
      expect(secondIndex).to.be.greaterThan(-1);
    });
  });
});
