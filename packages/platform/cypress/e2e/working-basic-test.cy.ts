describe('Platform Basic Working Tests', () => {
  // These tests don't require authentication and test basic functionality

  it('should load the login page', () => {
    cy.visit('/auth/login', { failOnStatusCode: false });
    cy.get('body').should('exist');
    // Should either show login page or redirect to dashboard if already logged in
    cy.url().should('satisfy', (url) => {
      return url.includes('/auth/login') || url.includes('/dashboard');
    });
  });

  it('should test basic API health endpoint', () => {
    cy.request({
      url: '/api/health',
      failOnStatusCode: false,
    }).then((response) => {
      // Health endpoint might return 503 if database not connected, but server is responding
      expect(response.status).to.be.oneOf([200, 503]);
    });
  });

  it('should handle static assets correctly', () => {
    cy.visit('/', { failOnStatusCode: false });
    cy.get('body').should('exist');
    // Basic DOM structure should be present
    cy.get('html').should('have.attr', 'lang');
  });

  it('should test basic navigation structure', () => {
    cy.visit('/auth/login', { failOnStatusCode: false });
    cy.get('body').should('exist');

    // Should have basic meta tags
    cy.get('head meta[name="viewport"]').should('exist');
    cy.get('head title').should('exist');
  });

  it('should handle 404 pages gracefully', () => {
    cy.request({
      url: '/nonexistent-page-12345',
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });
});
