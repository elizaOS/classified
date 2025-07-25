/**
 * Manual UI Test - Verify UI loads and basic functionality works
 */

describe('Manual UI Test', () => {
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

  it('should load the main game interface', () => {
    // Check if autonomy toggle exists
    cy.get('[data-testid="autonomy-toggle"]', { timeout: 10000 }).should('exist');

    // Take a screenshot to see what's loaded
    cy.screenshot('app-loaded');
  });

  it('should display all capability toggles', () => {
    const capabilities = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

    capabilities.forEach(capability => {
      cy.get(`[data-testid="${capability}-toggle"]`, { timeout: 5000 })
        .should('exist')
        .should('be.visible');
    });

    cy.screenshot('capability-toggles');
  });

  it('should allow clicking autonomy toggle', () => {
    cy.get('[data-testid="autonomy-toggle"]', { timeout: 10000 })
      .should('exist')
      .should('be.visible')
      .click();

    cy.screenshot('autonomy-clicked');
  });
});
