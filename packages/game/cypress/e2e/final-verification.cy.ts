describe('Final Verification - CORS Fixed', () => {
  beforeEach(() => {
    cy.visit('/', {
      timeout: 30000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');
      }
    });
  });

  it('should load data from APIs and display in UI', () => {
    // Wait for the main interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Wait a bit for APIs to be called
    cy.wait(3000);

    // Check Goals tab - should have 4 goals
    cy.get('[data-testid="tab-goals"]', { timeout: 5000 }).click();
    cy.get('[data-testid="goals-content"]').should('be.visible');
    cy.get('[data-testid="goals-content"]').should('not.contain', 'No active goals');
    cy.get('[data-testid="goals-content"]').should('contain', 'GOALS [4]');

    // Take screenshot of goals
    cy.screenshot('goals-loaded');

    // Check TODOs tab - should have 8 todos
    cy.get('[data-testid="tab-todos"]', { timeout: 5000 }).click();
    cy.get('[data-testid="todos-content"]').should('be.visible');
    cy.get('[data-testid="todos-content"]').should('not.contain', 'No pending tasks');
    cy.get('[data-testid="todos-content"]').should('contain', 'TASKS [8]');

    // Take screenshot of todos
    cy.screenshot('todos-loaded');

    // Verify we can see specific todo items
    cy.get('[data-testid="todos-content"]').should('contain', 'Say hello to the admin');
    cy.get('[data-testid="todos-content"]').should('contain', 'Explore the knowledge base');

    // Final screenshot showing success
    cy.screenshot('final-success');
  });
});
