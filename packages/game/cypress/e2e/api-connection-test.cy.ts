/**
 * API Connection Test
 * Tests the full flow: Frontend -> Tauri IPC -> Rust Backend -> Agent Server
 */

describe('API Connection End-to-End Test', () => {
  beforeEach(() => {
    cy.visit('/');
    // Wait for app to initialize
    cy.wait(3000);
  });

  it('🔌 Should establish frontend to agent connection through all layers', () => {
    cy.log('🔍 VERIFYING FULL API CONNECTION STACK');

    // Step 1: Verify the app loads and initializes
    cy.get('body').should('be.visible');
    cy.log('✅ Frontend loaded');

    // Step 2: Wait for startup to complete (look for chat interface or ready state)
    cy.get('[data-testid="message-input"], .chat-interface, input[type="text"]', { timeout: 30000 })
      .should('be.visible');
    cy.log('✅ App initialized and ready');

    // Step 3: Find and use the message input
    cy.get('[data-testid="message-input"]')
      .should('be.visible')
      .type('Test message for API connection verification{enter}');
    cy.log('✅ Message sent through frontend');

    // Step 4: Wait for agent response (this tests the full stack)
    cy.contains('Real ElizaOS agent', { timeout: 15000 })
      .should('be.visible');
    cy.log('✅ Agent response received - full API stack working!');

    // Step 5: Take screenshot for verification
    cy.screenshot('api-connection-success');

    cy.log('🎉 END-TO-END API CONNECTION TEST PASSED');
  });

  it('🔄 Should handle multiple messages correctly', () => {
    cy.log('🔍 TESTING MULTIPLE MESSAGE FLOW');

    // Wait for app to be ready
    cy.get('[data-testid="message-input"], .chat-interface, input[type="text"]', { timeout: 30000 })
      .should('be.visible');

    // Send first message
    cy.get('[data-testid="message-input"]')
      .type('First test message{enter}');

    // Wait for first response
    cy.contains('Real ElizaOS agent', { timeout: 15000 })
      .should('be.visible');
    cy.log('✅ First message processed');

    // Send second message
    cy.get('[data-testid="message-input"]')
      .type('Second test message{enter}');

    // Wait for second response
    cy.contains('Real ElizaOS agent', { timeout: 15000 })
      .should('be.visible');
    cy.log('✅ Second message processed');

    // Verify we have multiple messages in the chat
    cy.get('.message, [data-testid="message"]')
      .should('have.length.greaterThan', 2);
    cy.log('✅ Multiple messages displayed correctly');

    cy.screenshot('multiple-messages-success');
  });

  it('🛠️ Should show agent server health status', () => {
    cy.log('🔍 CHECKING AGENT SERVER HEALTH');

    // Check if there's any health indicator or status display
    // This might be in settings, diagnostics, or main interface
    cy.get('body').should('contain.text', 'connected').or('contain.text', 'healthy').or('contain.text', 'ready');
    cy.log('✅ Agent server health status visible');

    cy.screenshot('health-status-check');
  });
});
