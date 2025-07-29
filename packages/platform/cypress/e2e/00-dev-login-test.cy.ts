describe('Dev Login Functionality', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();
  });

  it('should successfully login using dev login button', () => {
    cy.devLogin();

    // Verify we're authenticated and on dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');
    cy.getCookie('auth-token').should('exist');
  });

  it('should have dashboard components visible after dev login', () => {
    cy.devLogin();

    // Check for dashboard components
    cy.get('[data-cy="dashboard-header"]').should('be.visible');
    cy.get('[data-cy="stats-section"]').should('be.visible');
    cy.get('[data-cy="quick-actions"]').should('be.visible');
    cy.get('[data-cy="recent-activity"]').should('be.visible');
  });

  it('should maintain authentication state across page refreshes', () => {
    cy.devLogin();

    // Refresh the page
    cy.reload();

    // Should still be on dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');

    // Auth token should still exist
    cy.getCookie('auth-token').should('exist');
  });

  it('should show dev login button only in development mode', () => {
    cy.visit('/auth/login');

    // The dev mode section should be visible since NODE_ENV=development
    cy.get('[data-cy="dev-mode-section"]').should('be.visible');
    cy.get('[data-cy="dev-login-btn"]').should('be.visible');
    cy.contains('Development Mode').should('be.visible');
  });
});
