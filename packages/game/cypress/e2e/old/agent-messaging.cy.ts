/// <reference types="cypress" />

describe('Terminal Agent Messaging', () => {
  const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';
  const TEST_AGENT_ID = '00000000-0000-0000-0000-000000000001';
  
  it('should receive a response from the Terminal agent', () => {
    // Visit the game page
    cy.visit('http://localhost:5173');
    
    // Wait for the game to load
    cy.contains('ELIZA Terminal', { timeout: 10000 }).should('be.visible');
    
    // Look for the Terminal tab and click it
    cy.get('[role="tab"]').contains(/Terminal/i).click();
    
    // Wait for the Terminal panel to be visible
    cy.get('[role="tabpanel"]').should('be.visible');
    
    // Find the message input within the Terminal panel
    cy.get('[role="tabpanel"]').within(() => {
      // Type a test message
      cy.get('input[type="text"], textarea').type('Hello World{enter}');
      
      // Wait for our message to appear
      cy.contains('Hello World').should('be.visible');
      
      // Wait for agent response - should be immediate now!
      cy.contains(/Hello World.*classic.*program/i, { timeout: 5000 })
        .should('be.visible');
    });
  });
}); 