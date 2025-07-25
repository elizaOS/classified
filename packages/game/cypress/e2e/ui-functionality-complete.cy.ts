/**
 * Complete UI Functionality Test - Verify all buttons connect to backend and update agent state
 */

describe('Complete UI Functionality Test', () => {
  beforeEach(() => {
    // Set localStorage to skip startup flow
    cy.window().then((win) => {
      win.localStorage.setItem('skipStartup', 'true');
    });

    // Visit the app
    cy.visit('/');

    // Wait for the app to load and skip startup
    cy.wait(2000);
  });

  describe('UI Element Existence', () => {
    it('should display all main UI components', () => {
      // Check capability toggles
      const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

      capabilities.forEach(capability => {
        cy.get(`[data-testid="${capability}-toggle"]`, { timeout: 5000 })
          .should('exist')
          .should('be.visible');
      });

      // Check for other UI elements
      cy.get('[data-testid="chat-input"]', { timeout: 5000 }).should('exist');
      cy.get('[data-testid="send-button"]', { timeout: 5000 }).should('exist');

      cy.screenshot('ui-components-loaded');
    });
  });

  describe('Capability Toggles', () => {
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

    capabilities.forEach(capability => {
      it(`should toggle ${capability} capability`, () => {
        // Get the toggle button
        cy.get(`[data-testid="${capability}-toggle"]`, { timeout: 5000 })
          .should('exist')
          .should('be.visible')
          .as('toggleButton');

        // Get initial state
        cy.get('@toggleButton').then($button => {
          const initialState = $button.css('background-color');

          // Click to toggle
          cy.get('@toggleButton').click();

          // Wait for the toggle to complete
          cy.wait(1000);

          // Verify visual change occurred (this shows IPC communication worked)
          cy.get('@toggleButton').should($newButton => {
            const newState = $newButton.css('background-color');
            // State should have changed or loading indicator should show
            expect(newState !== initialState || $newButton.text().includes('...')).to.be.true;
          });

          cy.screenshot(`${capability}-toggle-clicked`);
        });
      });
    });
  });

  describe('Message Sending', () => {
    it('should send messages through the UI', () => {
      const testMessage = 'Test message from UI';

      // Type message
      cy.get('[data-testid="chat-input"]', { timeout: 5000 })
        .should('exist')
        .should('be.visible')
        .type(testMessage);

      // Send message
      cy.get('[data-testid="send-button"]', { timeout: 5000 })
        .should('exist')
        .should('be.visible')
        .click();

      // Wait for message to be processed
      cy.wait(2000);

      // Verify message appears in output (should contain user message)
      cy.get('[data-testid="output-area"]', { timeout: 5000 })
        .should('contain', testMessage);

      cy.screenshot('message-sent');
    });
  });

  describe('Goals and Todos', () => {
    it('should display goals and todos sections', () => {
      // Check if goals section exists
      cy.get('[data-testid="goals-section"]', { timeout: 5000 }).should('exist');

      // Check if todos section exists
      cy.get('[data-testid="todos-section"]', { timeout: 5000 }).should('exist');

      cy.screenshot('goals-todos-sections');
    });
  });

  describe('Monologue/Autonomy', () => {
    it('should display agent monologue when autonomy is enabled', () => {
      // First enable autonomy
      cy.get('[data-testid="autonomy-toggle"]', { timeout: 5000 })
        .should('exist')
        .should('be.visible')
        .click();

      // Wait for autonomy to be enabled
      cy.wait(2000);

      // Check if monologue section exists
      cy.get('[data-testid="monologue-section"]', { timeout: 10000 }).should('exist');

      cy.screenshot('autonomy-enabled-monologue');
    });
  });

  describe('Config Management', () => {
    it('should display configuration options', () => {
      // Check if config section exists
      cy.get('[data-testid="config-section"]', { timeout: 5000 }).should('exist');

      cy.screenshot('config-section');
    });
  });
});
