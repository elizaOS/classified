/// <reference types="cypress" />

describe('Agent Messaging Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173');
    // Wait for the page to load - look for the ElizaOS Terminal header
    cy.contains('ElizaOS Terminal', { timeout: 10000 }).should('be.visible');
  });

  it('should receive and display agent responses in real-time', () => {
    // Wait for the input field to be ready
    cy.get('input[type="text"]', { timeout: 10000 }).should('be.visible');
    
    // Type a message
    const testMessage = 'Hello Terminal, can you respond?';
    cy.get('input[type="text"]').type(testMessage);
    
    // Send the message
    cy.get('input[type="text"]').type('{enter}');
    
    // Verify our message appears
    cy.contains(testMessage).should('be.visible');
    
    // Wait for agent response with Terminal's characteristic ">" prefix
    cy.contains('> ', { timeout: 30000 }).should('be.visible');
    
    // Take a screenshot for debugging
    cy.screenshot('agent-response-received');
  });
  
  it('should maintain conversation history', () => {
    // Wait for input to be ready
    cy.get('input[type="text"]', { timeout: 10000 }).should('be.visible');
    
    // Send first message
    cy.get('input[type="text"]').type('What is your name?{enter}');
    
    // Wait for response containing "Terminal"
    cy.contains('Terminal', { timeout: 30000 }).should('be.visible');
    
    // Send follow-up message - Hello World should trigger a special response
    cy.get('input[type="text"]').type('Hello World{enter}');
    
    // Wait for response that references "classic" programming
    cy.contains('classic', { timeout: 30000 }).should('be.visible');
    
    // Verify conversation history is maintained
    cy.get('body').should('contain.text', 'What is your name?');
    cy.get('body').should('contain.text', 'Hello World');
  });
}); 