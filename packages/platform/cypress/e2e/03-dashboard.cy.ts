describe('Dashboard - Complete Test Suite', () => {
  beforeEach(() => {
    // Set up authenticated user state
    cy.window().then((win) => {
      win.localStorage.setItem('auth-token', 'mock-token');
    });

    // Mock authenticated user check
    cy.intercept('GET', '**/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-id',
          email: 'test@elizaos.ai',
          name: 'Test User',
        },
      },
    }).as('authCheck');

    // Mock dashboard data
    cy.intercept('GET', '**/dashboard/stats', {
      statusCode: 200,
      body: {
        totalAgents: 5,
        activeAgents: 3,
        totalConversations: 124,
        totalCredits: 1250,
      },
    }).as('dashboardStats');

    cy.intercept('GET', '**/dashboard/activity', {
      statusCode: 200,
      body: {
        recentActivity: [
          {
            type: 'agent_created',
            name: 'Support Bot',
            timestamp: Date.now() - 3600000,
          },
          {
            type: 'conversation_started',
            name: 'Chat with Trading Bot',
            timestamp: Date.now() - 7200000,
          },
        ],
      },
    }).as('dashboardActivity');
  });

  describe('Page Load and Authentication', () => {
    it('should load dashboard for authenticated users', () => {
      cy.visit('/dashboard');
      cy.wait('@authCheck');
      cy.url().should('include', '/dashboard');
      cy.get('body').should('be.visible');
    });

    it('should redirect unauthenticated users to login', () => {
      cy.clearLocalStorage();
      cy.intercept('GET', '**/auth/identity', {
        statusCode: 401,
        body: { error: 'Unauthorized' },
      }).as('unauthCheck');

      cy.visit('/dashboard');
      cy.wait('@unauthCheck');
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Dashboard Navigation', () => {
    beforeEach(() => {
      cy.visit('/dashboard');
      cy.wait('@authCheck');
    });

    it('should display main navigation sidebar', () => {
      cy.get('[data-cy="dashboard-sidebar"]').should('be.visible');

      // Check main navigation items
      cy.contains('Dashboard').should('be.visible');
      cy.contains('Agents').should('be.visible');
      cy.contains('Generation').should('be.visible');
      cy.contains('Analytics').should('be.visible');
      cy.contains('Settings').should('be.visible');
    });

    it('should handle sidebar navigation clicks', () => {
      // Test agents navigation
      cy.get('a[href="/dashboard/agents"]').click();
      cy.url().should('include', '/dashboard/agents');

      // Navigate back to dashboard
      cy.visit('/dashboard');

      // Test generation navigation
      cy.get('a[href="/dashboard/generation"]').click();
      cy.url().should('include', '/dashboard/generation');
    });

    it('should display user menu and handle logout', () => {
      cy.get('[data-cy="user-menu"]').should('be.visible').click();
      cy.get('[data-cy="user-menu-dropdown"]').should('be.visible');

      // Check user info
      cy.contains('test@elizaos.ai').should('be.visible');

      // Mock logout
      cy.intercept('POST', '**/auth/logout', {
        statusCode: 200,
        body: { success: true },
      }).as('logout');

      cy.get('[data-cy="logout"]').click();
      cy.wait('@logout');
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  describe('Dashboard Content', () => {
    beforeEach(() => {
      cy.visit('/dashboard');
      cy.wait(['@authCheck', '@dashboardStats']);
    });

    it('should display dashboard statistics cards', () => {
      // Check stats cards
      cy.contains('Total Agents').should('be.visible');
      cy.contains('5').should('be.visible'); // Total agents count

      cy.contains('Active Agents').should('be.visible');
      cy.contains('3').should('be.visible'); // Active agents count

      cy.contains('Total Conversations').should('be.visible');
      cy.contains('124').should('be.visible'); // Total conversations

      cy.contains('Credits Remaining').should('be.visible');
      cy.contains('1,250').should('be.visible'); // Credits
    });

    it('should display recent activity section', () => {
      cy.wait('@dashboardActivity');

      cy.contains('Recent Activity').should('be.visible');
      cy.contains('Support Bot').should('be.visible');
      cy.contains('Chat with Trading Bot').should('be.visible');
    });

    it('should handle quick action buttons', () => {
      // Create Agent button
      cy.get('button').contains('Create Agent').should('be.visible').click();
      cy.url().should('include', '/dashboard/agents/create');

      // Go back to dashboard
      cy.visit('/dashboard');

      // Start Generation button
      cy.get('button')
        .contains('Start Generation')
        .should('be.visible')
        .click();
      cy.url().should('include', '/dashboard/generation');
    });
  });

  describe('Dashboard API Integration', () => {
    it('should handle dashboard data loading errors', () => {
      cy.intercept('GET', '**/dashboard/stats', {
        statusCode: 500,
        body: { error: 'Server error' },
      }).as('statsError');

      cy.visit('/dashboard');
      cy.wait('@authCheck');
      cy.wait('@statsError');

      // Should display error state
      cy.contains('Error loading')
        .should('be.visible')
        .or(cy.get('[data-cy="stats-error"]').should('be.visible'));
    });

    it('should show loading states while fetching data', () => {
      // Mock slow response
      cy.intercept('GET', '**/dashboard/stats', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              statusCode: 200,
              body: {
                totalAgents: 5,
                activeAgents: 3,
                totalConversations: 124,
                totalCredits: 1250,
              },
            });
          }, 1000);
        });
      }).as('slowStats');

      cy.visit('/dashboard');
      cy.wait('@authCheck');

      // Should show loading skeletons
      cy.get('[data-cy="loading-skeleton"]')
        .should('be.visible')
        .or(cy.get('.animate-pulse').should('be.visible'));

      cy.wait('@slowStats');
      cy.get('[data-cy="loading-skeleton"]').should('not.exist');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.visit('/dashboard');
      cy.wait('@authCheck');

      // Mobile navigation should be accessible
      cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible').click();
      cy.get('[data-cy="mobile-sidebar"]').should('be.visible');

      // Stats cards should stack vertically
      cy.contains('Total Agents').should('be.visible');
      cy.contains('Active Agents').should('be.visible');
    });

    it('should work on tablet devices', () => {
      cy.viewport(768, 1024); // iPad

      cy.visit('/dashboard');
      cy.wait('@authCheck');

      // Sidebar should be visible
      cy.get('[data-cy="dashboard-sidebar"]').should('be.visible');

      // Content should be properly laid out
      cy.contains('Dashboard').should('be.visible');
      cy.contains('Total Agents').should('be.visible');
    });
  });

  describe('Theme and Accessibility', () => {
    beforeEach(() => {
      cy.visit('/dashboard');
      cy.wait('@authCheck');
    });

    it('should support theme switching', () => {
      // Toggle theme
      cy.get('[data-cy="theme-toggle"]').click();

      // Should not cause any errors
      cy.get('body').should('be.visible');
      cy.contains('Dashboard').should('be.visible');
    });

    it('should have proper ARIA labels and keyboard navigation', () => {
      // Navigation should be keyboard accessible
      cy.get('a[href="/dashboard/agents"]').focus().should('be.focused');

      // Buttons should have proper labels
      cy.get('button')
        .contains('Create Agent')
        .should('have.attr', 'aria-label')
        .or('contain.text', 'Create Agent');
    });

    it('should handle high contrast mode', () => {
      // Test high contrast mode compatibility
      cy.get('body').invoke('addClass', 'high-contrast');
      cy.contains('Dashboard').should('be.visible');
      cy.get('button').contains('Create Agent').should('be.visible');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle session expiration', () => {
      cy.visit('/dashboard');
      cy.wait('@authCheck');

      // Simulate session expiration during usage
      cy.intercept('GET', '**/dashboard/stats', {
        statusCode: 401,
        body: { error: 'Session expired' },
      }).as('sessionExpired');

      cy.reload();
      cy.wait('@sessionExpired');

      // Should redirect to login
      cy.url().should('include', '/auth/login');
    });

    it('should handle network disconnection gracefully', () => {
      cy.visit('/dashboard');
      cy.wait('@authCheck');

      // Simulate network error
      cy.intercept('GET', '**/dashboard/stats', { forceNetworkError: true }).as(
        'networkError',
      );

      cy.reload();
      cy.wait('@networkError');

      // Should show network error message
      cy.contains('network')
        .should('be.visible')
        .or(cy.contains('connection').should('be.visible'));
    });
  });

  describe('Performance', () => {
    it('should load dashboard quickly', () => {
      cy.visit('/dashboard', {
        onBeforeLoad: (win) => {
          cy.stub(win.console, 'error').as('consoleError');
        },
      });

      cy.wait('@authCheck');

      // Should not have console errors
      cy.get('@consoleError').should('not.have.been.called');

      // Key content should be visible quickly
      cy.contains('Dashboard', { timeout: 3000 }).should('be.visible');
    });
  });
});
