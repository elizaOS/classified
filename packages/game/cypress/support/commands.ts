/// <reference types="cypress" />

// Custom commands for ELIZA game testing

/**
 * Custom command to set up test environment with random ports
 */
Cypress.Commands.add('setupTestEnvironment', () => {
  const backendUrl = Cypress.env('BACKEND_URL') || Cypress.env('CYPRESS_BACKEND_URL') || 'http://localhost:7777';
  const frontendUrl = Cypress.env('FRONTEND_URL') || Cypress.env('CYPRESS_FRONTEND_URL') || Cypress.config('baseUrl');

  cy.log(`Using Backend: ${backendUrl}`);
  cy.log(`Using Frontend: ${frontendUrl}`);

  // Set up localStorage for test mode
  cy.window().then((win) => {
    win.localStorage.setItem('skipBoot', 'true');
    win.localStorage.setItem('disableWebSocket', 'true');
    win.localStorage.setItem('testMode', 'true');
  });
});

/**
 * Custom command to wait for backend to be ready
 */
Cypress.Commands.add('waitForBackend', (timeout = 30000) => {
  const backendUrl = Cypress.env('BACKEND_URL') || Cypress.env('CYPRESS_BACKEND_URL') || 'http://localhost:7777';
  
  cy.request({
    method: 'GET',
    url: `${backendUrl}/api/server/health`,
    timeout,
    retryOnStatusCodeFailure: true
  }).then((response) => {
    expect(response.status).to.eq(200);
    cy.log('✅ Backend is ready');
  });
});

/**
 * Custom command to clear all test data
 */
Cypress.Commands.add('clearTestData', () => {
  const backendUrl = Cypress.env('BACKEND_URL') || Cypress.env('CYPRESS_BACKEND_URL') || 'http://localhost:7777';
  
  // Clear goals
  cy.request({
    method: 'DELETE',
    url: `${backendUrl}/api/goals/clear-test-data`,
    failOnStatusCode: false
  });
  
  // Clear todos
  cy.request({
    method: 'DELETE', 
    url: `${backendUrl}/api/todos/clear-test-data`,
    failOnStatusCode: false
  });
  
  // Clear knowledge
  cy.request({
    method: 'DELETE',
    url: `${backendUrl}/knowledge/clear-test-data`,
    failOnStatusCode: false
  });
});

/**
 * Custom command to seed test data
 */
Cypress.Commands.add('seedTestData', () => {
  const backendUrl = Cypress.env('BACKEND_URL') || Cypress.env('CYPRESS_BACKEND_URL') || 'http://localhost:7777';
  
  // Create test goals
  cy.request({
    method: 'POST',
    url: `${backendUrl}/api/goals`,
    body: {
      name: 'Test Goal 1',
      description: 'A test goal for Cypress testing',
      isCompleted: false
    },
    failOnStatusCode: false
  });
  
  // Create test todos
  cy.request({
    method: 'POST',
    url: `${backendUrl}/api/todos`,
    body: {
      name: 'Test Todo 1', 
      type: 'one-off',
      isCompleted: false
    },
    failOnStatusCode: false
  });
});

/**
 * Custom command to bypass boot sequence
 */
Cypress.Commands.add('bypassBoot', () => {
  cy.window().then((win) => {
    win.localStorage.setItem('skipBoot', 'true');
    win.localStorage.setItem('disableWebSocket', 'true');
  });
});

/**
 * Custom command to check if element exists without failing
 */
Cypress.Commands.add('elementExists', (selector: string) => {
  return cy.get('body').then(($body) => {
    return $body.find(selector).length > 0;
  });
});

/**
 * Custom command to safely click element if it exists
 */
Cypress.Commands.add('safeClick', (selector: string) => {
  cy.elementExists(selector).then((exists) => {
    if (exists) {
      cy.get(selector).first().click({ force: true });
    }
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      setupTestEnvironment(): Chainable<void>;
      waitForBackend(timeout?: number): Chainable<void>;
      clearTestData(): Chainable<void>;
      seedTestData(): Chainable<void>;
      bypassBoot(): Chainable<void>;
      elementExists(selector: string): Chainable<boolean>;
      safeClick(selector: string): Chainable<void>;
    }
  }
}