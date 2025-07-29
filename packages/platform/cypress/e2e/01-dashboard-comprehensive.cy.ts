/**
 * Comprehensive Dashboard E2E Test
 * Tests all dashboard flows, components, and interactions with complete coverage
 */

describe('Dashboard Comprehensive Test', () => {
  beforeEach(() => {
    // Clear any existing auth state
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'dashboard-test-user',
          email: 'test@elizaos.ai',
          firstName: 'Dashboard',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'dashboard-org-123',
          name: 'Dashboard Test Org',
          slug: 'dashboard-test',
          subscriptionTier: 'premium',
          creditBalance: '1000.0',
        },
        permissions: {
          canCreateAgents: true,
          canEditAgents: true,
          canDeleteAgents: true,
          canManageUsers: true,
          canAccessBilling: true,
        },
      },
    }).as('getIdentity');

    // Mock dashboard stats
    cy.intercept('GET', '**/api/dashboard/stats', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          agentCount: 5,
          userCount: 3,
          creditBalance: '1000.0',
          subscriptionTier: 'premium',
          apiRequests24h: 2500,
          totalCost24h: '12.50',
          activeAgents: 3,
          pendingInvites: 1,
        },
      },
    }).as('getDashboardStats');

    // Mock dashboard activity
    cy.intercept('GET', '**/api/dashboard/activity*', {
      statusCode: 200,
      body: {
        success: true,
        data: [
          {
            id: 'activity-1',
            type: 'agent_created',
            title: 'Agent Created',
            description: 'New agent "Customer Support Bot" created',
            timestamp: '2 hours ago',
          },
          {
            id: 'activity-2',
            type: 'user_invited',
            title: 'User Invited',
            description: 'Invited john.doe@company.com to the team',
            timestamp: '4 hours ago',
          },
          {
            id: 'activity-3',
            type: 'credit_added',
            title: 'Credits Added',
            description: 'Added $100 credits to account',
            timestamp: '1 day ago',
          },
        ],
      },
    }).as('getDashboardActivity');
  });

  it('Dashboard Page - Complete Flow Test', () => {
    cy.log('🏠 Testing Complete Dashboard Flow');

    // Visit dashboard
    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getDashboardStats');
    cy.wait('@getDashboardActivity');

    // ==========================================
    // STEP 1: Verify Dashboard Header
    // ==========================================
    cy.log('📋 Step 1: Verify Dashboard Header');

    cy.get('[data-cy="dashboard-header"]').should('be.visible');
    cy.get('[data-cy="dashboard-header"]').within(() => {
      cy.contains('Dashboard').should('be.visible');
      cy.contains("Here's what's happening").should('be.visible');
    });

    // ==========================================
    // STEP 2: Verify Stats Cards
    // ==========================================
    cy.log('📊 Step 2: Verify Stats Cards');

    cy.get('[data-cy="stats-section"]').should('be.visible');

    // Test Agents stats card
    cy.get('[data-cy="stats-agents"]').should('be.visible');
    cy.get('[data-cy="agent-count"]').should('contain.text', '5');
    cy.get('[data-cy="active-agents"]').should('contain.text', '3 active');

    // Test Team stats card
    cy.get('[data-cy="stats-team"]').should('be.visible');
    cy.get('[data-cy="user-count"]').should('contain.text', '3');
    cy.get('[data-cy="pending-invites"]').should(
      'contain.text',
      '1 pending invites',
    );

    // Test Credits stats card
    cy.get('[data-cy="stats-credits"]').should('be.visible');
    cy.get('[data-cy="credit-balance"]').should('contain.text', '$1000.0');
    cy.get('[data-cy="subscription-tier"]').should(
      'contain.text',
      'premium plan',
    );

    // Test API stats card
    cy.get('[data-cy="stats-api"]').should('be.visible');
    cy.get('[data-cy="api-requests"]').should('contain.text', '2,500');
    cy.get('[data-cy="api-cost"]').should('contain.text', '$12.50 cost');

    // ==========================================
    // STEP 3: Test Quick Actions
    // ==========================================
    cy.log('⚡ Step 3: Test Quick Actions');

    cy.get('[data-cy="quick-actions"]').should('be.visible');
    cy.get('[data-cy="quick-actions"]').within(() => {
      cy.contains('Quick Actions').should('be.visible');
    });

    // Test individual quick action buttons
    cy.get('[data-cy="quick-action-create-agent"]')
      .should('be.visible')
      .within(() => {
        cy.contains('Create Agent').should('be.visible');
        cy.contains('Build a new AI agent').should('be.visible');
        cy.contains('New').should('be.visible'); // New badge
      });

    cy.get('[data-cy="quick-action-plugin-creator"]')
      .should('be.visible')
      .within(() => {
        cy.contains('Plugin Creator').should('be.visible');
        cy.contains('Create custom plugins').should('be.visible');
        cy.contains('New').should('be.visible'); // New badge
      });

    cy.get('[data-cy="quick-action-manage-api-keys"]')
      .should('be.visible')
      .within(() => {
        cy.contains('Manage API Keys').should('be.visible');
        cy.contains('Create and manage your API keys').should('be.visible');
      });

    cy.get('[data-cy="quick-action-view-usage"]')
      .should('be.visible')
      .within(() => {
        cy.contains('View Billing').should('be.visible');
        cy.contains('Monitor your usage and billing').should('be.visible');
      });

    // ==========================================
    // STEP 4: Test Recent Activity
    // ==========================================
    cy.log('📝 Step 4: Test Recent Activity');

    cy.get('[data-cy="recent-activity"]').should('be.visible');
    cy.get('[data-cy="recent-activity"]').within(() => {
      cy.contains('Recent Activity').should('be.visible');
      cy.contains('View all').should('be.visible');
    });

    cy.get('[data-cy="activity-list"]').should('be.visible');

    // Test individual activity items
    cy.get('[data-cy="activity-item-agent_created"]')
      .should('be.visible')
      .within(() => {
        cy.get('[data-cy="activity-title"]').should(
          'contain.text',
          'Agent Created',
        );
        cy.get('[data-cy="activity-description"]').should(
          'contain.text',
          'Customer Support Bot',
        );
        cy.get('[data-cy="activity-timestamp"]').should(
          'contain.text',
          '2 hours ago',
        );
      });

    cy.get('[data-cy="activity-item-user_invited"]')
      .should('be.visible')
      .within(() => {
        cy.get('[data-cy="activity-title"]').should(
          'contain.text',
          'User Invited',
        );
        cy.get('[data-cy="activity-description"]').should(
          'contain.text',
          'john.doe@company.com',
        );
        cy.get('[data-cy="activity-timestamp"]').should(
          'contain.text',
          '4 hours ago',
        );
      });

    cy.get('[data-cy="activity-item-credit_added"]')
      .should('be.visible')
      .within(() => {
        cy.get('[data-cy="activity-title"]').should(
          'contain.text',
          'Credits Added',
        );
        cy.get('[data-cy="activity-description"]').should(
          'contain.text',
          '$100 credits',
        );
        cy.get('[data-cy="activity-timestamp"]').should(
          'contain.text',
          '1 day ago',
        );
      });

    // ==========================================
    // STEP 5: Test Navigation Links
    // ==========================================
    cy.log('🔗 Step 5: Test Navigation Links');

    // Test quick action navigation (without actually navigating)
    cy.get('[data-cy="quick-action-create-agent"]').should(
      'have.attr',
      'href',
      '/dashboard/agents/create',
    );
    cy.get('[data-cy="quick-action-plugin-creator"]').should(
      'have.attr',
      'href',
      '/dashboard/plugin-creator',
    );
    cy.get('[data-cy="quick-action-manage-api-keys"]').should(
      'have.attr',
      'href',
      '/dashboard/api-keys',
    );
    cy.get('[data-cy="quick-action-view-usage"]').should(
      'have.attr',
      'href',
      '/dashboard/billing',
    );

    // ==========================================
    // STEP 6: Test Low Credit Warning (Conditional)
    // ==========================================
    cy.log('⚠️ Step 6: Test Low Credit Warning');

    // The low credit warning should NOT appear since balance is $1000
    cy.get('body').should('not.contain.text', 'Low Credit Balance');

    // Test scenario with low credits
    cy.intercept('GET', '**/api/dashboard/stats', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          agentCount: 5,
          userCount: 3,
          creditBalance: '5.0', // Low balance
          subscriptionTier: 'premium',
          apiRequests24h: 2500,
          totalCost24h: '12.50',
          activeAgents: 3,
          pendingInvites: 1,
        },
      },
    }).as('getLowCreditStats');

    // Reload page to trigger low credit warning
    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getLowCreditStats');
    cy.wait('@getDashboardActivity');

    // Now the warning should appear
    cy.contains('Low Credit Balance').should('be.visible');
    cy.contains('Your credit balance is running low').should('be.visible');
    cy.contains('Add Credits')
      .should('be.visible')
      .and('have.attr', 'href', '/settings/billing');

    // ==========================================
    // STEP 7: Test Responsive Design
    // ==========================================
    cy.log('📱 Step 7: Test Responsive Design');

    // Test mobile viewport
    cy.viewport('iphone-x');
    cy.wait(1000); // Allow layout to settle

    // Stats should stack on mobile
    cy.get('[data-cy="stats-section"]').should('be.visible');
    cy.get('[data-cy="stats-agents"]').should('be.visible');

    // Quick actions should also be responsive
    cy.get('[data-cy="quick-actions"]').should('be.visible');

    // Reset to desktop
    cy.viewport(1280, 720);
    cy.wait(500);

    // ==========================================
    // STEP 8: Test Error Handling
    // ==========================================
    cy.log('❌ Step 8: Test Error Handling');

    // Test stats API error
    cy.intercept('GET', '**/api/dashboard/stats', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('getStatsError');

    // Test activity API error
    cy.intercept('GET', '**/api/dashboard/activity*', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('getActivityError');

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getStatsError');
    cy.wait('@getActivityError');

    // Page should still load basic structure
    cy.get('[data-cy="dashboard-header"]').should('be.visible');

    // Stats section might not load, but page should remain functional
    cy.get('body').should('not.contain.text', 'TypeError');
    cy.get('body').should('not.contain.text', 'Uncaught');

    // ==========================================
    // STEP 9: Test Performance & Loading States
    // ==========================================
    cy.log('⚡ Step 9: Test Performance & Loading States');

    // Test with delayed responses
    cy.intercept('GET', '**/api/dashboard/stats', {
      delay: 2000,
      statusCode: 200,
      body: {
        success: true,
        data: {
          agentCount: 5,
          userCount: 3,
          creditBalance: '1000.0',
          subscriptionTier: 'premium',
          apiRequests24h: 2500,
          totalCost24h: '12.50',
          activeAgents: 3,
          pendingInvites: 1,
        },
      },
    }).as('getDelayedStats');

    cy.reload();
    cy.wait('@getIdentity');

    // Should show loading state
    cy.get('.animate-pulse').should('be.visible');

    cy.wait('@getDelayedStats');

    // Loading should disappear and content should appear
    cy.get('.animate-pulse').should('not.exist');
    cy.get('[data-cy="stats-section"]').should('be.visible');

    cy.log('✅ Dashboard Comprehensive Test Complete!');
  });

  it('Dashboard Navigation Integration Test', () => {
    cy.log('🧭 Testing Dashboard Navigation Integration');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getDashboardStats');
    cy.wait('@getDashboardActivity');

    // Test clicking on quick actions (without following the link)
    cy.get('[data-cy="quick-action-create-agent"]').should('be.visible');
    cy.get('[data-cy="quick-action-manage-api-keys"]').should('be.visible');
    cy.get('[data-cy="quick-action-view-usage"]').should('be.visible');
    cy.get('[data-cy="quick-action-plugin-creator"]').should('be.visible');

    // Test activity "View all" link
    cy.get('[data-cy="recent-activity"]').within(() => {
      cy.contains('View all').should('have.attr', 'href', '/dashboard/audit');
    });

    // Verify all quick action links are correct
    cy.get('[data-cy="quick-action-create-agent"]')
      .should('have.attr', 'href')
      .and('include', '/agents/create');
    cy.get('[data-cy="quick-action-plugin-creator"]')
      .should('have.attr', 'href')
      .and('include', '/plugin-creator');
    cy.get('[data-cy="quick-action-manage-api-keys"]')
      .should('have.attr', 'href')
      .and('include', '/api-keys');
    cy.get('[data-cy="quick-action-view-usage"]')
      .should('have.attr', 'href')
      .and('include', '/billing');

    cy.log('✅ Dashboard Navigation Integration Test Complete!');
  });

  it('Dashboard Data Integrity Test', () => {
    cy.log('🔍 Testing Dashboard Data Integrity');

    // Test with different data scenarios
    const testScenarios = [
      {
        name: 'High Usage Scenario',
        stats: {
          agentCount: 25,
          userCount: 15,
          creditBalance: '2500.0',
          subscriptionTier: 'enterprise',
          apiRequests24h: 50000,
          totalCost24h: '125.75',
          activeAgents: 20,
          pendingInvites: 5,
        },
      },
      {
        name: 'Low Usage Scenario',
        stats: {
          agentCount: 1,
          userCount: 1,
          creditBalance: '50.0',
          subscriptionTier: 'free',
          apiRequests24h: 100,
          totalCost24h: '0.50',
          activeAgents: 1,
          pendingInvites: 0,
        },
      },
      {
        name: 'Zero State Scenario',
        stats: {
          agentCount: 0,
          userCount: 1,
          creditBalance: '100.0',
          subscriptionTier: 'free',
          apiRequests24h: 0,
          totalCost24h: '0.00',
          activeAgents: 0,
          pendingInvites: 0,
        },
      },
    ];

    testScenarios.forEach((scenario, index) => {
      cy.log(`📊 Testing ${scenario.name}`);

      cy.intercept('GET', '**/api/dashboard/stats', {
        statusCode: 200,
        body: {
          success: true,
          data: scenario.stats,
        },
      }).as(`getStats${index}`);

      cy.visit('/dashboard', { failOnStatusCode: false });
      cy.wait('@getIdentity');
      cy.wait(`@getStats${index}`);
      cy.wait('@getDashboardActivity');

      // Verify stats display correctly
      cy.get('[data-cy="agent-count"]').should(
        'contain.text',
        scenario.stats.agentCount.toString(),
      );
      cy.get('[data-cy="user-count"]').should(
        'contain.text',
        scenario.stats.userCount.toString(),
      );
      cy.get('[data-cy="credit-balance"]').should(
        'contain.text',
        `$${scenario.stats.creditBalance}`,
      );
      cy.get('[data-cy="subscription-tier"]').should(
        'contain.text',
        `${scenario.stats.subscriptionTier} plan`,
      );
      cy.get('[data-cy="api-requests"]').should(
        'contain.text',
        scenario.stats.apiRequests24h.toLocaleString(),
      );
      cy.get('[data-cy="api-cost"]').should(
        'contain.text',
        `$${scenario.stats.totalCost24h} cost`,
      );
      cy.get('[data-cy="active-agents"]').should(
        'contain.text',
        `${scenario.stats.activeAgents} active`,
      );
      cy.get('[data-cy="pending-invites"]').should(
        'contain.text',
        `${scenario.stats.pendingInvites} pending invites`,
      );
    });

    cy.log('✅ Dashboard Data Integrity Test Complete!');
  });
});
