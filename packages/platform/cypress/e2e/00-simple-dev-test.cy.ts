describe('Simple Dev Test', () => {
  it('should show dev login button', () => {
    cy.visit('/auth/login', { failOnStatusCode: false });
    cy.get('[data-cy="dev-mode-section"]').should('be.visible');
    cy.get('[data-cy="dev-login-btn"]').should('be.visible');
  });

  it('should perform dev login and redirect', () => {
    // Set up intercepts first
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'a0000000-0000-4000-8000-000000000001',
            email: 'dev@elizaos.ai',
            firstName: 'Developer',
            lastName: 'User',
          },
          organization: {
            id: 'a0000000-0000-4000-8000-000000000002',
            name: 'ElizaOS Development',
          },
        },
      },
    }).as('identity');

    cy.intercept('GET', '**/api/dashboard/stats', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          agentCount: 0,
          userCount: 1,
          creditBalance: '1000.00',
          subscriptionTier: 'Premium',
          apiRequests24h: 0,
          totalCost24h: '0.00',
          activeAgents: 0,
          pendingInvites: 0,
        },
      },
    }).as('dashboardStats');

    cy.intercept('GET', '**/api/dashboard/activity*', {
      statusCode: 200,
      body: { success: true, data: [] },
    }).as('dashboardActivity');

    cy.visit('/auth/login', { failOnStatusCode: false });
    cy.get('[data-cy="dev-login-btn"]').click();

    // Should redirect to dashboard
    cy.url({ timeout: 10000 }).should('include', '/dashboard');
    cy.contains('Dashboard').should('be.visible');
  });
});
