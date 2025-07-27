/**
 * Startup Flow Fix Validation
 * Tests that the game properly transitions from "Ready" stage to chat interface
 */

describe('Startup Flow Fix Validation', () => {
  const baseUrl = 'http://localhost:7777';

  before(() => {
    // Verify server is running
    cy.request({
      url: `${baseUrl}/api/server/health`,
      retryOnStatusCodeFailure: true,
      timeout: 10000,
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.success).to.be.true;
      cy.log('✅ Backend server is healthy and ready');
    });
  });

  it('should detect existing server and skip to Ready state', () => {
    cy.visit('/');

    // Should detect server quickly and move to Ready state
    cy.get('[data-testid="startup-progress"]', { timeout: 10000 }).should('be.visible');

    // Should show READY stage
    cy.get('.progress-stage', { timeout: 15000 }).should('contain.text', 'READY');

    // Should show 100% progress
    cy.get('.progress-percent').should('contain.text', '100%');

    // Should automatically transition to chat interface
    cy.get('[data-testid="game-interface"]', { timeout: 5000 }).should('be.visible');

    cy.log('✅ Startup flow completed successfully');
  });

  it('should not get stuck at Ready stage', () => {
    cy.visit('/');

    // Wait for Ready stage
    cy.get('.progress-stage', { timeout: 15000 }).should('contain.text', 'READY');

    // Should transition to chat within reasonable time
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');

    // Should not show startup flow anymore
    cy.get('[data-testid="startup-progress"]').should('not.exist');

    cy.log('✅ No longer stuck at Ready stage');
  });

  it('should show chat interface elements after startup', () => {
    cy.visit('/');

    // Wait for game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 20000 }).should('be.visible');

    // Should show key chat interface elements
    cy.get('[data-testid="chat-input"]').should('be.visible');
    cy.get('[data-testid="chat-send-button"]').should('be.visible');

    // Should be able to type in message input
    cy.get('[data-testid="chat-input"]').type('Test message after startup fix');
    cy.get('[data-testid="chat-input"]').should('have.value', 'Test message after startup fix');

    cy.log('✅ Chat interface is functional after startup');
  });

  it('should handle server detection in browser mode', () => {
    // This test simulates browser mode detection
    cy.window().then((win) => {
      // Remove Tauri APIs to simulate browser mode
      delete (win as any).__TAURI_INTERNALS__;
    });

    cy.visit('/');

    // Should still detect server and complete startup
    cy.get('[data-testid="game-interface"]', { timeout: 20000 }).should('be.visible');

    cy.log('✅ Browser mode server detection works');
  });

  it('should maintain correct stage progression when server is detected', () => {
    cy.visit('/');

    // Monitor console logs for debugging
    cy.window().then((win) => {
      cy.stub(win.console, 'log').as('consoleLog');
    });

    // Should show progression through stages
    cy.get('.progress-stage', { timeout: 5000 }).should('be.visible');

    // Should reach READY stage
    cy.get('.progress-stage', { timeout: 15000 }).should('contain.text', 'READY');

    // Should transition to game interface
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');

    // Check that appropriate console logs were made
    cy.get('@consoleLog').should('have.been.called');

    cy.log('✅ Stage progression works correctly');
  });
});

// Test that the fix handles different startup scenarios
describe('Startup Scenarios After Fix', () => {
  const baseUrl = 'http://localhost:7777';

  it('should handle the case when server starts after page load', () => {
    // Simulate server not immediately available
    cy.intercept('GET', `${baseUrl}/api/server/health`, { forceNetworkError: true }).as(
      'healthCheck'
    );

    cy.visit('/');

    // Should show waiting state initially
    cy.get('[data-testid="startup-progress"]').should('be.visible');

    // Remove intercept to allow server detection
    cy.intercept('GET', `${baseUrl}/api/server/health`, { fixture: 'server-health.json' }).as(
      'healthCheckSuccess'
    );

    // Trigger retry or refresh
    cy.get('[data-testid="retry-button"]', { timeout: 10000 }).click();

    // Should now detect server and proceed
    cy.get('[data-testid="game-interface"]', { timeout: 15000 }).should('be.visible');

    cy.log('✅ Handles delayed server detection');
  });

  it('should properly display stage names', () => {
    cy.visit('/');

    // Should show properly formatted stage names
    cy.get('.progress-stage')
      .should('be.visible')
      .and(($stage) => {
        const text = $stage.text();
        // Should be uppercase and properly formatted
        expect(text).to.match(/^[A-Z\s]+$/);
        expect(text).not.to.contain('_');
      });

    cy.log('✅ Stage names are properly formatted');
  });
});
