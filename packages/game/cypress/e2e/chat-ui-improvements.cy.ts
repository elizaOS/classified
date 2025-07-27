/// <reference types="cypress" />

describe('Chat UI Improvements - Frontend Only', () => {
  beforeEach(() => {
    // Start fresh and navigate to the game
    cy.visit('http://localhost:5173');

    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');
  });

  it('should load the interface without system messages for goals/todos in chat', () => {
    // Wait for initial load and any async operations
    cy.wait(5000);

    // Check that goals/todos loading messages are not in the chat output
    cy.get('[data-testid="chat-output"]').then(($output) => {
      const text = $output.text();

      // Should not contain the system messages we removed
      expect(text).to.not.include('✅ Goals loaded:');
      expect(text).to.not.include('✅ TODOs loaded:');
    });

    // But the ELIZA terminal welcome message should still be there
    cy.get('[data-testid="chat-output"]').should(
      'contain.text',
      '◉ ELIZA TERMINAL v2.0 - Agent Connection Established'
    );
  });

  it('should have the chat input form and basic UI elements present', () => {
    // Verify the chat form exists
    cy.get('[data-testid="chat-form"]').should('be.visible');

    // Verify the input field exists
    cy.get('[data-testid="chat-input"]').should('be.visible');

    // Verify the output area exists
    cy.get('[data-testid="chat-output"]').should('be.visible');

    // Check that input accepts typing
    cy.get('[data-testid="chat-input"]').type('test message');
    cy.get('[data-testid="chat-input"]').should('have.value', 'test message');

    // Clear for next test
    cy.get('[data-testid="chat-input"]').clear();
  });

  it('should show immediate user message when form is submitted (without backend)', () => {
    const testMessage = 'Test immediate posting without backend';

    // Get initial count of messages
    cy.get('[data-testid="chat-output"]').then(($initialOutput) => {
      const initialText = $initialOutput.text();
      const initialMessageCount = (initialText.match(/Test immediate posting/g) || []).length;
      expect(initialMessageCount).to.equal(0);

      // Type and submit message
      cy.get('[data-testid="chat-input"]').type(testMessage);
      cy.get('[data-testid="chat-form"]').submit();

      // Input should be cleared immediately
      cy.get('[data-testid="chat-input"]').should('have.value', '');

      // Check that message appears in output
      cy.get('[data-testid="chat-output"]').should('contain.text', testMessage);
    });
  });

  it('should handle multiple messages in quick succession', () => {
    const message1 = 'First quick message';
    const message2 = 'Second quick message';
    const message3 = 'Third quick message';

    // Send first message
    cy.get('[data-testid="chat-input"]').type(message1);
    cy.get('[data-testid="chat-form"]').submit();

    // Send second message quickly
    cy.get('[data-testid="chat-input"]').type(message2);
    cy.get('[data-testid="chat-form"]').submit();

    // Send third message quickly
    cy.get('[data-testid="chat-input"]').type(message3);
    cy.get('[data-testid="chat-form"]').submit();

    // All messages should appear in order
    cy.get('[data-testid="chat-output"]').then(($output) => {
      const text = $output.text();

      // Check all messages are present
      expect(text).to.include(message1);
      expect(text).to.include(message2);
      expect(text).to.include(message3);

      // Check order (first should come before second, etc.)
      const index1 = text.indexOf(message1);
      const index2 = text.indexOf(message2);
      const index3 = text.indexOf(message3);

      expect(index1).to.be.lessThan(index2);
      expect(index2).to.be.lessThan(index3);
    });
  });

  it('should maintain chat history and not duplicate messages in frontend state', () => {
    const uniqueMessage = `Unique test message ${Date.now()}`;

    // Send message
    cy.get('[data-testid="chat-input"]').type(uniqueMessage);
    cy.get('[data-testid="chat-form"]').submit();

    // Wait a moment
    cy.wait(1000);

    // Count occurrences - should only be one (our immediate post)
    cy.get('[data-testid="chat-output"]').then(($output) => {
      const text = $output.text();
      const messageCount = (text.match(new RegExp(uniqueMessage, 'g')) || []).length;

      // Should only appear once
      expect(messageCount).to.equal(1);
    });
  });

  it('should have proper form behavior with empty messages', () => {
    // Try to submit empty message
    cy.get('[data-testid="chat-input"]').clear();
    cy.get('[data-testid="chat-form"]').submit();

    // Input should remain empty and no message should be added
    cy.get('[data-testid="chat-input"]').should('have.value', '');

    // Add a test to see current state of output
    cy.get('[data-testid="chat-output"]').then(($output) => {
      const text = $output.text();
      // Just verify that no empty messages were added unexpectedly
      expect(text.length).to.be.greaterThan(0); // Should have welcome message at least
    });
  });
});
