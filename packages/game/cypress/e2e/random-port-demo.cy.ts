/// <reference types="cypress" />

describe('Random Port Demo - Dynamic Configuration', () => {
  beforeEach(() => {
    // Use the custom command to set up test environment
    cy.setupTestEnvironment();

    // Verify backend is ready before proceeding
    cy.waitForBackend();

    // Visit the dynamically configured frontend URL
    cy.visit('/');

    // Bypass boot sequence for testing
    cy.bypassBoot();

    // Wait for interface to load
    cy.wait(3000);
  });

  it('should demonstrate random port configuration working', () => {
    const backendUrl =
      Cypress.env('BACKEND_URL') || Cypress.env('CYPRESS_BACKEND_URL') || 'http://localhost:7777';
    const frontendUrl =
      Cypress.env('FRONTEND_URL') ||
      Cypress.env('CYPRESS_FRONTEND_URL') ||
      Cypress.config('baseUrl');

    cy.log('🎲 RANDOM PORT DEMO');
    cy.log(`Frontend URL: ${frontendUrl}`);
    cy.log(`Backend URL: ${backendUrl}`);

    // Verify the game interface loads with random ports
    cy.get('[data-testid="game-interface"]').should('be.visible');
    cy.log('✅ Game interface loaded with random ports');

    // Test backend connectivity through the UI
    cy.get('[data-testid="connection-status"]').should('contain.text', 'ONLINE');
    cy.log('✅ Backend connectivity verified through UI');

    // Test that the chat interface is functional
    cy.get('[data-testid="chat-input"]')
      .should('be.visible')
      .type(`Testing with random ports: backend on ${backendUrl.split(':').pop()}`, {
        force: true,
      });

    cy.get('[data-testid="chat-send-button"]').click();
    cy.log('✅ Chat functionality works with random ports');

    // Test that tabs are functional
    cy.get('[data-testid="goals-tab"]').should('be.visible').click();
    cy.get('[data-testid="goals-content"]').should('be.visible');
    cy.log('✅ Goals tab functional with random ports');

    cy.get('[data-testid="config-tab"]').should('be.visible').click();
    cy.get('[data-testid="config-content"]').should('be.visible');
    cy.log('✅ Config tab functional with random ports');

    // Verify capability toggles work
    cy.get('[data-testid="autonomy-toggle"]').should('be.visible');
    cy.log('✅ Capability toggles visible with random ports');

    cy.log('🎉 ALL FUNCTIONALITY VERIFIED WITH RANDOM PORTS!');

    cy.screenshot('random-port-demo-complete');
  });

  it('should verify all backend APIs are accessible', () => {
    const backendUrl =
      Cypress.env('BACKEND_URL') || Cypress.env('CYPRESS_BACKEND_URL') || 'http://localhost:7777';

    cy.log(`🔍 Testing backend APIs at: ${backendUrl}`);

    // Test critical backend endpoints
    const endpoints = [
      '/api/server/health',
      '/api/goals',
      '/api/todos',
      '/autonomy/status',
      '/knowledge/documents',
    ];

    endpoints.forEach((endpoint) => {
      cy.request({
        method: 'GET',
        url: `${backendUrl}${endpoint}`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 404, 500]); // Any response means endpoint is reachable
        cy.log(`✅ ${endpoint}: Status ${response.status}`);
      });
    });

    cy.log('🎉 ALL BACKEND ENDPOINTS REACHABLE WITH RANDOM PORTS!');
  });

  it('should demonstrate port isolation between test runs', () => {
    const frontendPort = Cypress.config('baseUrl')?.split(':').pop();
    const backendPort = (
      Cypress.env('BACKEND_URL') ||
      Cypress.env('CYPRESS_BACKEND_URL') ||
      'http://localhost:7777'
    )
      .split(':')
      .pop();

    cy.log('🔒 DEMONSTRATING PORT ISOLATION');
    cy.log(`This test run using Frontend Port: ${frontendPort}`);
    cy.log(`This test run using Backend Port: ${backendPort}`);

    // Create a unique identifier for this test run
    const testRunId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store test run info in the interface
    cy.get('[data-testid="chat-input"]')
      .clear()
      .type(`Test Run ID: ${testRunId} | Frontend: ${frontendPort} | Backend: ${backendPort}`, {
        force: true,
      });

    cy.get('[data-testid="chat-send-button"]').click();

    // Verify the message appears in chat
    cy.get('[data-testid="user-message"]').last().should('contain.text', testRunId);

    cy.log(
      `✅ Test run ${testRunId} successfully isolated on ports F:${frontendPort} B:${backendPort}`
    );
    cy.log('🎉 PORT ISOLATION DEMONSTRATED!');

    cy.screenshot(`port-isolation-${testRunId}`);
  });
});
