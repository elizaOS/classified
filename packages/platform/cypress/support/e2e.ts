/// <reference types="cypress" />

// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';
import './real-agent-commands';
import './autocoder-lander-commands';

// Prevent uncaught exceptions from failing tests
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false if the error is a known issue we want to ignore
  if (
    err.message.includes('ResizeObserver loop limit exceeded') ||
    err.message.includes(
      'ResizeObserver loop completed with undelivered notifications',
    ) ||
    err.message.includes('Cannot read properties of null') ||
    err.message.includes('NetworkError')
  ) {
    return false;
  }
  // Let other errors fail the test
  return true;
});

// Add custom console log command for debugging
Cypress.Commands.add('logMessage', (message: string) => {
  cy.task('log', message);
});

// Configure default timeouts
Cypress.config('defaultCommandTimeout', 10000);
Cypress.config('requestTimeout', 10000);
Cypress.config('responseTimeout', 10000);

// Global before each hook
beforeEach(() => {
  // Clear all cookies and local storage before each test
  cy.clearCookies();
  cy.clearLocalStorage();

  // Set a consistent viewport
  cy.viewport(1280, 720);

  // Intercept API calls to backend
  cy.intercept('GET', '/api/v1/**', (req) => {
    req.headers['Accept'] = 'application/json';
  }).as('apiCall');

  // Intercept auth endpoints
  cy.intercept('POST', '/api/v1/auth/login', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        authUrl:
          'http://test.workos.com/sso/authorize?client_id=test&redirect_uri=http://localhost:3000/auth/callback',
        state: 'test_state_123',
      },
    },
  }).as('login');

  cy.intercept('POST', '/api/v1/auth/logout', {
    statusCode: 200,
    body: { success: true, data: { message: 'Logged out successfully' } },
  }).as('logout');
});

// Global after each hook
afterEach(() => {
  // Take a screenshot on failure
  if ((Cypress.currentTest as any).state === 'failed') {
    cy.screenshot(`${Cypress.currentTest.title}-failed`);
  }
});

// Enhanced project status monitoring commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Wait for a project to reach a specific phase
       */
      waitForProjectPhase(
        projectId: string,
        phase: string,
        timeout?: number,
      ): Chainable<void>;

      /**
       * Monitor project progress through all phases
       */
      monitorFullProjectProgress(projectId: string): Chainable<any>;

      /**
       * Validate project artifacts are generated correctly
       */
      validateProjectArtifacts(
        projectId: string,
        expectedTypes?: string[],
      ): Chainable<any>;

      /**
       * Test project scaling functionality
       */
      testProjectScaling(
        projectId: string,
        targetAgentCount?: number,
      ): Chainable<any>;

      /**
       * Clear all session and local storage
       */
      clearAllStorage(): Chainable<void>;

      /**
       * Check if an element has the data-testid attribute
       */
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Wait for WebSocket connection to be established
       */
      waitForWebSocketConnection(timeout?: number): Chainable<void>;

      /**
       * Extract project ID from the UI
       */
      extractProjectId(): Chainable<string>;

      /**
       * Log custom message for debugging
       */
      logMessage(message: string): Chainable<void>;
    }
  }
}

// Custom command implementations for project testing
Cypress.Commands.add(
  'waitForProjectPhase',
  (projectId: string, phase: string, timeout: number = 60000) => {
    const startTime = Date.now();

    function checkPhase() {
      if (Date.now() - startTime > timeout) {
        throw new Error(
          `Project ${projectId} did not reach phase '${phase}' within ${timeout}ms`,
        );
      }

      return cy
        .request(`/api/autocoder/swarm/status/${projectId}`)
        .then((response) => {
          if (response.body.success && response.body.project) {
            if (
              response.body.project.currentPhase === phase ||
              response.body.project.status === 'completed'
            ) {
              return;
            }
          }

          cy.wait(3000).then(checkPhase);
        });
    }

    return checkPhase();
  },
);

Cypress.Commands.add('monitorFullProjectProgress', (projectId: string) => {
  return cy.task('monitorProjectProgress', {
    projectId,
    expectedPhases: ['planning', 'research', 'coding', 'testing', 'completed'],
  });
});

Cypress.Commands.add(
  'validateProjectArtifacts',
  (
    projectId: string,
    expectedTypes: string[] = ['component', 'test', 'documentation', 'config'],
  ) => {
    return cy.task('validateProjectArtifacts', {
      projectId,
      expectedArtifactTypes: expectedTypes,
    });
  },
);

Cypress.Commands.add(
  'testProjectScaling',
  (projectId: string, targetAgentCount: number = 3) => {
    return cy.task('testProjectScaling', { projectId, targetAgentCount });
  },
);

Cypress.Commands.add('clearAllStorage', () => {
  cy.clearAllSessionStorage();
  cy.clearLocalStorage();
  cy.clearCookies();
});

Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(`[data-testid="${testId}"]`);
});

Cypress.Commands.add(
  'waitForWebSocketConnection',
  (timeout: number = 10000) => {
    const startTime = Date.now();

    function checkConnection() {
      if (Date.now() - startTime > timeout) {
        throw new Error(
          `WebSocket connection not established within ${timeout}ms`,
        );
      }

      return cy.window().then((win) => {
        // Check if WebSocket connection exists and is open
        if (
          (win as any).wsConnection &&
          (win as any).wsConnection.readyState === WebSocket.OPEN
        ) {
          return;
        }

        cy.wait(1000).then(checkConnection);
      });
    }

    return checkConnection();
  },
);

Cypress.Commands.add('extractProjectId', () => {
  return cy
    .getByTestId('project-id')
    .invoke('text')
    .then((text) => {
      return text.trim();
    });
});
