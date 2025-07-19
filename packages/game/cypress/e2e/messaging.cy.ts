describe('Messaging with Agent Responses', () => {
  beforeEach(() => {
    // Visit the game app
    cy.visit('http://localhost:5173');
    
    // Wait for the page to load
    cy.wait(2000);
  });

  it('should send a message and receive agent response', () => {
    // Find the terminal input
    cy.get('input[type="text"]').should('be.visible');
    
    // Type a message
    const testMessage = 'Hello Terminal!';
    cy.get('input[type="text"]').type(testMessage);
    
    // Press Enter to send
    cy.get('input[type="text"]').type('{enter}');
    
    // Verify the message was sent and appears in the output
    cy.contains(testMessage).should('be.visible');
    
    // Wait for agent response (usually takes 2-5 seconds)
    cy.wait(5000);
    
    // Look for agent response pattern (starts with ">")
    cy.contains(/^>.*STATUS.*/).should('be.visible');
    
    // Take a screenshot of the conversation
    cy.screenshot('agent-response-received');
  });

  it('should handle "Hello World" with special response', () => {
    // Type the classic greeting
    cy.get('input[type="text"]').type('Hello World');
    cy.get('input[type="text"]').type('{enter}');
    
    // Wait for agent response
    cy.wait(5000);
    
    // Check for the special "Hello World" response
    cy.contains(/Hello World!.*classic.*program/i).should('be.visible');
    
    // Take a screenshot
    cy.screenshot('hello-world-response');
  });

  it('should maintain conversation context', () => {
    // Send first message
    cy.get('input[type="text"]').type('My name is TestUser');
    cy.get('input[type="text"]').type('{enter}');
    
    // Wait for response
    cy.wait(5000);
    
    // Send follow-up message
    cy.get('input[type="text"]').type('Do you remember my name?');
    cy.get('input[type="text"]').type('{enter}');
    
    // Wait for response
    cy.wait(5000);
    
    // Check if agent remembers context
    cy.get('.terminal-output').should('contain', 'TestUser');
    
    // Take a screenshot
    cy.screenshot('conversation-context');
  });
}); 