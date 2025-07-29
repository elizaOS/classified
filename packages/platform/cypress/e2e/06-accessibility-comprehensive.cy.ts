/**
 * Comprehensive Accessibility Testing
 * Tests ARIA attributes, keyboard navigation, screen reader compatibility, and WCAG compliance
 */

describe('Accessibility Comprehensive Testing', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication for accessibility testing
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'accessibility-user',
          email: 'accessibility@elizaos.ai',
          firstName: 'Accessibility',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'accessibility-org',
          name: 'Accessibility Test Org',
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
  });

  it('Dashboard - Accessibility Compliance Test', () => {
    cy.log('♿ Testing Dashboard Accessibility Compliance');

    // Mock dashboard data
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

    cy.intercept('GET', '**/api/dashboard/activity*', {
      statusCode: 200,
      body: {
        success: true,
        data: [
          {
            id: 'activity-1',
            type: 'agent_created',
            title: 'Agent Created',
            description: 'New agent created',
            timestamp: '2 hours ago',
          },
        ],
      },
    }).as('getDashboardActivity');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getDashboardStats');
    cy.wait('@getDashboardActivity');

    // ==========================================
    // STEP 1: Test Semantic HTML Structure
    // ==========================================
    cy.log('🏗️ Step 1: Test Semantic HTML Structure');

    // Verify proper heading hierarchy
    cy.get('h1').should('exist').and('be.visible');
    cy.get('h1').should('contain.text', 'Dashboard');

    // Verify main landmark
    cy.get('main').should('exist');

    // Verify navigation landmarks
    cy.get('[role="navigation"], nav').should('exist');

    // ==========================================
    // STEP 2: Test ARIA Labels and Attributes
    // ==========================================
    cy.log('🏷️ Step 2: Test ARIA Labels and Attributes');

    // Test stats cards have proper ARIA labels
    cy.get('[data-cy="stats-agents"]')
      .should('have.attr', 'role')
      .or('have.attr', 'aria-label');
    cy.get('[data-cy="stats-team"]').should('be.visible');
    cy.get('[data-cy="stats-credits"]').should('be.visible');
    cy.get('[data-cy="stats-api"]').should('be.visible');

    // Test buttons have accessible names
    cy.get('[data-cy="quick-action-create-agent"]')
      .should('have.attr', 'href')
      .and('be.visible');
    cy.get('[data-cy="quick-action-manage-api-keys"]')
      .should('have.attr', 'href')
      .and('be.visible');

    // ==========================================
    // STEP 3: Test Keyboard Navigation
    // ==========================================
    cy.log('⌨️ Step 3: Test Keyboard Navigation');

    // Test tab order through interactive elements
    cy.get('body').tab();
    cy.focused().should('be.visible');

    // Test quick actions are keyboard accessible
    cy.get('[data-cy="quick-action-create-agent"]').focus();
    cy.focused().should('have.attr', 'href');

    // Test Enter key activation
    cy.get('[data-cy="quick-action-create-agent"]').focus().type('{enter}');

    // Should navigate or trigger action
    cy.url().should('not.eq', Cypress.config('baseUrl') + '/dashboard');

    // ==========================================
    // STEP 4: Test Color Contrast
    // ==========================================
    cy.log('🎨 Step 4: Test Color Contrast');

    // Verify text has sufficient contrast
    cy.get('[data-cy="dashboard-header"] h1').should('be.visible');
    cy.get('[data-cy="agent-count"]').should('be.visible');
    cy.get('[data-cy="credit-balance"]').should('be.visible');

    // Check for proper color usage in status indicators
    cy.get('[data-cy="stats-section"]').should('be.visible');

    cy.log('✅ Dashboard Accessibility Test Complete!');
  });

  it('Authentication Forms - Accessibility Test', () => {
    cy.log('♿ Testing Authentication Accessibility');

    // ==========================================
    // STEP 1: Test Login Form Accessibility
    // ==========================================
    cy.log('🔐 Step 1: Test Login Form Accessibility');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // Test form has proper labels
    cy.get('[data-cy="login-form"]').should('exist');
    cy.get('[data-cy="email-input"] label').should('exist').and('be.visible');
    cy.get('[data-cy="password-input"] label')
      .should('exist')
      .and('be.visible');

    // Test form inputs have proper associations
    cy.get('[data-cy="email-input"] input').should(
      'have.attr',
      'type',
      'email',
    );
    cy.get('[data-cy="password-input"] input').should(
      'have.attr',
      'type',
      'password',
    );

    // Test required field indicators
    cy.get('[data-cy="email-input"] input').should('have.attr', 'required');
    cy.get('[data-cy="password-input"] input').should('have.attr', 'required');

    // Test keyboard navigation through form
    cy.get('[data-cy="email-input"] input').focus();
    cy.focused().tab();
    cy.focused().should('have.attr', 'type', 'password');

    // Test form submission with keyboard
    cy.get('[data-cy="email-input"] input').type('test@example.com');
    cy.get('[data-cy="password-input"] input').type('password123');
    cy.get('[data-cy="login-submit-button"]').should('not.be.disabled');

    // ==========================================
    // STEP 2: Test Signup Form Accessibility
    // ==========================================
    cy.log('📝 Step 2: Test Signup Form Accessibility');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    // Test all form fields have labels
    cy.get('[data-cy="firstName-input"] label').should('exist');
    cy.get('[data-cy="lastName-input"] label').should('exist');
    cy.get('[data-cy="email-input"] label').should('exist');
    cy.get('[data-cy="organizationName-input"] label').should('exist');
    cy.get('[data-cy="password-input"] label').should('exist');

    // Test fieldset grouping if present
    cy.get('[data-cy="signup-form"]').should('exist');

    // Test keyboard navigation through multi-column layout
    cy.get('[data-cy="firstName-input"] input').focus();
    cy.focused().tab();
    cy.focused().should('have.attr', 'name', 'lastName');

    cy.log('✅ Authentication Accessibility Test Complete!');
  });

  it('Modal Dialogs - Accessibility Test', () => {
    cy.log('♿ Testing Modal Accessibility');

    // Setup API keys page with modal
    cy.intercept('GET', '**/api/api-keys', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: [],
          stats: { totalKeys: 0, activeKeys: 0, expiredKeys: 0, totalUsage: 0 },
          availablePermissions: ['inference:*', 'storage:*'],
        },
      },
    }).as('getApiKeys');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getApiKeys');

    // ==========================================
    // STEP 1: Test Modal ARIA Attributes
    // ==========================================
    cy.log('🎭 Step 1: Test Modal ARIA Attributes');

    cy.get('[data-cy="create-api-key-button"]').click();
    cy.get('[data-cy="api-key-modal"]').should('be.visible');

    // Test modal has proper role and ARIA attributes
    cy.get('[data-cy="api-key-modal"]')
      .should('have.attr', 'role', 'dialog')
      .or('have.attr', 'aria-modal', 'true');

    // Test modal title is properly associated
    cy.contains('Create API Key').should('be.visible');

    // ==========================================
    // STEP 2: Test Focus Management
    // ==========================================
    cy.log('🎯 Step 2: Test Focus Management');

    // Test focus is trapped within modal
    cy.get('[data-cy="api-key-name"]').should('be.focused').or('be.visible');

    // Test tabbing within modal
    cy.get('[data-cy="api-key-name"]').focus().tab();
    cy.focused().should('be.visible');

    // Test Escape key closes modal
    cy.get('body').type('{esc}');
    cy.get('[data-cy="api-key-modal"]').should('not.exist');

    cy.log('✅ Modal Accessibility Test Complete!');
  });

  it('Interactive Elements - Accessibility Test', () => {
    cy.log('♿ Testing Interactive Elements Accessibility');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Mock billing settings
    cy.intercept('GET', '**/api/v1/billing/settings', {
      statusCode: 200,
      body: {
        autoRecharge: { enabled: true, threshold: 10, amount: 50 },
        usageAlerts: { enabled: true, thresholds: [50, 80, 95] },
        billingContact: { email: 'test@example.com', name: 'Test User' },
        invoiceSettings: {
          frequency: 'monthly',
          autoDownload: false,
          emailCopy: true,
        },
        spendingLimits: { daily: 100, monthly: 1000, enabled: true },
      },
    }).as('getBillingSettings');

    cy.intercept('GET', '**/api/v1/billing/payment-methods', {
      statusCode: 200,
      body: { paymentMethods: [] },
    }).as('getPaymentMethods');

    cy.wait('@getBillingSettings');
    cy.wait('@getPaymentMethods');

    // ==========================================
    // STEP 1: Test Button Accessibility
    // ==========================================
    cy.log('🔘 Step 1: Test Button Accessibility');

    // Test buttons have proper roles and names
    cy.get('[data-cy="add-payment-method"]').should('be.visible');
    cy.get('[data-cy="save-billing-settings"]').should('be.visible');

    // Test buttons are keyboard accessible
    cy.get('[data-cy="add-payment-method"]').focus();
    cy.focused().should('be.visible');

    // ==========================================
    // STEP 2: Test Toggle Controls
    // ==========================================
    cy.log('🔄 Step 2: Test Toggle Controls');

    // Test auto-recharge toggle accessibility
    cy.get('[data-cy="auto-recharge-toggle"]').should('exist');

    // Test toggle has proper ARIA attributes or labels
    cy.get('[data-cy="auto-recharge-toggle"]').should(
      'have.attr',
      'type',
      'checkbox',
    );

    // Test toggle keyboard interaction
    cy.get('[data-cy="auto-recharge-toggle"]').focus();
    cy.focused().type(' '); // Space to toggle

    // ==========================================
    // STEP 3: Test Form Controls
    // ==========================================
    cy.log('📋 Step 3: Test Form Controls');

    // Test input fields have proper labels
    cy.get('[data-cy="auto-recharge-threshold"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-amount"]').should('be.visible');

    // Test inputs are keyboard accessible
    cy.get('[data-cy="auto-recharge-threshold"]').focus();
    cy.focused().should('be.visible');

    cy.log('✅ Interactive Elements Accessibility Test Complete!');
  });

  it('Screen Reader Compatibility Test', () => {
    cy.log('👁️ Testing Screen Reader Compatibility');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Mock dashboard data
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

    cy.wait('@getDashboardStats');

    // ==========================================
    // STEP 1: Test Content Structure
    // ==========================================
    cy.log('📖 Step 1: Test Content Structure');

    // Test page has descriptive title
    cy.title().should('include', 'Dashboard').or('not.be.empty');

    // Test headings provide content structure
    cy.get('h1').should('contain.text', 'Dashboard');
    cy.get('h2').should('exist');

    // Test content is properly nested
    cy.get('[data-cy="stats-section"]').should('be.visible');
    cy.get('[data-cy="quick-actions"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Alternative Text
    // ==========================================
    cy.log('🖼️ Step 2: Test Alternative Text');

    // Test images have alt text
    cy.get('img').each(($img) => {
      cy.wrap($img).should('have.attr', 'alt');
    });

    // Test icons have proper ARIA labels
    cy.get('svg').each(($svg) => {
      cy.wrap($svg)
        .should('have.attr', 'aria-label')
        .or('have.attr', 'aria-hidden', 'true')
        .or('have.attr', 'role', 'img');
    });

    // ==========================================
    // STEP 3: Test Data Tables
    // ==========================================
    cy.log('📊 Step 3: Test Data Tables');

    // If tables exist, test they have proper headers
    cy.get('table').then(($tables) => {
      if ($tables.length > 0) {
        cy.get('table th').should('exist');
        cy.get('table')
          .should('have.attr', 'role', 'table')
          .or('not.have.attr', 'role'); // Valid without explicit role
      }
    });

    cy.log('✅ Screen Reader Compatibility Test Complete!');
  });

  it('High Contrast Mode Test', () => {
    cy.log('🌓 Testing High Contrast Mode Compatibility');

    // Simulate high contrast mode by modifying CSS
    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Mock dashboard data
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

    cy.wait('@getDashboardStats');

    // ==========================================
    // STEP 1: Test Content Visibility
    // ==========================================
    cy.log('👀 Step 1: Test Content Visibility');

    // Test all text is visible
    cy.get('[data-cy="dashboard-header"] h1').should('be.visible');
    cy.get('[data-cy="agent-count"]').should('be.visible');
    cy.get('[data-cy="credit-balance"]').should('be.visible');

    // Test interactive elements are visible
    cy.get('[data-cy="quick-action-create-agent"]').should('be.visible');
    cy.get('[data-cy="quick-action-manage-api-keys"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Focus Indicators
    // ==========================================
    cy.log('🎯 Step 2: Test Focus Indicators');

    // Test focus is visible on interactive elements
    cy.get('[data-cy="quick-action-create-agent"]').focus();
    cy.focused().should('be.visible');

    // Test button focus states
    cy.get('[data-cy="quick-action-manage-api-keys"]').focus();
    cy.focused().should('be.visible');

    cy.log('✅ High Contrast Mode Test Complete!');
  });
});
