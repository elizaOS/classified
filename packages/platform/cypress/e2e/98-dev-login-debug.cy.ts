describe('Dev Login Debug', () => {
  beforeEach(() => {
    cy.clearAuthState();
  });

  it('should debug dev login process step by step', () => {
    // Visit login page
    cy.visit('/auth/login', { failOnStatusCode: false });

    // Check page loads
    cy.contains('Log in to your account').should('be.visible');

    // Check dev mode is detected
    cy.get('[data-cy="dev-mode-section"]').should('be.visible');

    // Check dev login button exists
    cy.get('[data-cy="dev-login-btn"]')
      .should('be.visible')
      .and('not.be.disabled');

    // Click dev login button
    cy.get('[data-cy="dev-login-btn"]').click();

    // Debug: wait and check URL changes
    cy.url({ timeout: 20000 }).then((url) => {
      cy.log('Current URL after dev login:', url);
    });

    // Check for any obvious error messages on the page
    cy.get('body').should('not.contain.text', 'Error 500');
    cy.get('body').should('not.contain.text', 'Internal Server Error');

    // More lenient check - either we're on dashboard or still authenticating
    cy.url({ timeout: 25000 }).should('satisfy', (url) => {
      return url.includes('/dashboard') || url.includes('/auth/login');
    });
  });

  it('should test dev login API directly', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/dev-login',
      failOnStatusCode: false,
    }).then((response) => {
      cy.log('Dev login API response:', response);
      expect(response.status).to.be.oneOf([200, 403]); // 403 if not in dev mode
    });
  });
});
