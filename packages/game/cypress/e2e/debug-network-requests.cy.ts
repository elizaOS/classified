describe('Debug Network Requests', () => {
  beforeEach(() => {
    // Clear localStorage and set skip boot
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.localStorage.setItem('skipBoot', 'true');
    });
  });

  it('should show network requests and console logs', () => {
    // Intercept all API requests to see what's happening
    cy.intercept('GET', 'http://localhost:7777/api/todos').as('getTodos');
    cy.intercept('GET', 'http://localhost:7777/api/goals').as('getGoals');

    // Visit the page
    cy.visit('/', {
      timeout: 30000,
      onBeforeLoad: (win) => {
        win.localStorage.setItem('skipBoot', 'true');

        // Capture console logs
        cy.spy(win.console, 'log').as('consoleLog');
        cy.spy(win.console, 'error').as('consoleError');
      }
    });

    // Wait for the main interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 30000 }).should('be.visible');

    // Wait for API requests to be made
    cy.wait('@getTodos', { timeout: 10000 }).then((interception) => {
      console.log('TODOs API Request:', interception);
      expect(interception.response?.statusCode).to.equal(200);
    });

    cy.wait('@getGoals', { timeout: 10000 }).then((interception) => {
      console.log('Goals API Request:', interception);
      expect(interception.response?.statusCode).to.equal(200);
    });

    // Check if there are any console errors
    cy.get('@consoleError').should('not.have.been.called');

    // Switch to TODOs tab to see if data appears
    cy.get('[data-testid="tab-todos"]', { timeout: 5000 }).click();

    // Take a screenshot for debugging
    cy.screenshot('debug-todos-tab');

    // Check if todos are visible (should be 8 todos)
    cy.get('[data-testid="todos-content"]').should('be.visible');
    cy.get('[data-testid="todos-content"]').should('contain', 'TASKS [');

    // Try to find todo items
    cy.get('[data-testid="todos-content"]').then(($content) => {
      cy.log('TODOs content:', $content.text());
    });

    // Check goals tab as well
    cy.get('[data-testid="tab-goals"]', { timeout: 5000 }).click();
    cy.get('[data-testid="goals-content"]').should('be.visible');
    cy.get('[data-testid="goals-content"]').should('contain', 'GOALS [');

    cy.get('[data-testid="goals-content"]').then(($content) => {
      cy.log('Goals content:', $content.text());
    });

    // Take final screenshot
    cy.screenshot('debug-final-state');
  });
});
