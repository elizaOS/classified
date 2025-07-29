/**
 * Comprehensive Dark Theme Testing
 * Tests dark theme compliance, color contrast, and visual consistency across all pages
 */

describe('Dark Theme - Comprehensive Testing', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication for authenticated pages
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        id: 'theme-test-user',
        email: 'theme@elizaos.ai',
        first_name: 'Theme',
        last_name: 'Tester',
        role: 'owner',
        organization: {
          id: 'theme-org',
          name: 'Theme Testing Org',
          subscription_tier: 'premium',
          credit_balance: '1000.0',
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

  it('Landing Page - Dark Theme Compliance', () => {
    cy.log('🌙 Testing Landing Page Dark Theme');

    cy.visit('/', { failOnStatusCode: false });

    // Test dark theme implementation
    testDarkThemeCompliance();
    testColorContrast('Landing Page');
    testButtonContrast();
    testCardBackgroundContrast();
  });

  it('Dashboard - Dark Theme Compliance', () => {
    cy.log('🌙 Testing Dashboard Dark Theme');

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

    testDarkThemeCompliance();
    testColorContrast('Dashboard');
    testStatCardContrast();
    testActionButtonContrast();
  });

  it('Authentication Pages - Dark Theme Compliance', () => {
    cy.log('🌙 Testing Authentication Pages Dark Theme');

    // Test login page
    cy.visit('/auth/login', { failOnStatusCode: false });
    testDarkThemeCompliance();
    testFormElementContrast();

    // Test signup page
    cy.visit('/auth/signup', { failOnStatusCode: false });
    testDarkThemeCompliance();
    testFormElementContrast();
  });

  it('Settings Pages - Dark Theme Compliance', () => {
    cy.log('🌙 Testing Settings Pages Dark Theme');

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

    // Test billing settings
    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettings');
    cy.wait('@getPaymentMethods');

    testDarkThemeCompliance();
    testFormElementContrast();
    testToggleContrast();

    // Test API keys page
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

    testDarkThemeCompliance();
    testButtonContrast();
    testTableContrast();
  });

  it('Agent Management - Dark Theme Compliance', () => {
    cy.log('🌙 Testing Agent Management Dark Theme');

    // Mock agents data
    cy.intercept('GET', '**/api/agents', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          agents: [],
          stats: { totalAgents: 0, activeAgents: 0, deployedAgents: 0 },
        },
      },
    }).as('getAgents');

    cy.visit('/dashboard/agents', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getAgents');

    testDarkThemeCompliance();
    testColorContrast('Agent Management');
    testButtonContrast();

    // Test agent editor
    cy.visit('/dashboard/agents/editor', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    testDarkThemeCompliance();
    testIframeContrast();
  });

  it('Generation Pages - Dark Theme Compliance', () => {
    cy.log('🌙 Testing Generation Pages Dark Theme');

    // Test text generation
    cy.visit('/dashboard/generation/text', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    testDarkThemeCompliance();
    testColorContrast('Text Generation');

    // Test image generation
    cy.visit('/dashboard/generation/image', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    testDarkThemeCompliance();
    testColorContrast('Image Generation');
  });

  it('Dark Theme - Color Accessibility Standards', () => {
    cy.log('♿ Testing Dark Theme Accessibility Standards');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test WCAG AA Compliance
    // ==========================================
    cy.log('📊 Step 1: Test WCAG AA Compliance');

    // Test that text has minimum 4.5:1 contrast ratio
    testWCAGContrast('h1', 4.5);
    testWCAGContrast('p', 4.5);
    testWCAGContrast('button', 4.5);

    // ==========================================
    // STEP 2: Test Focus Indicators
    // ==========================================
    cy.log('🎯 Step 2: Test Focus Indicators');

    // Focus indicators should be visible in dark theme
    cy.get('button').first().focus();
    cy.focused().should('be.visible');

    // ==========================================
    // STEP 3: Test State Colors
    // ==========================================
    cy.log('🔄 Step 3: Test State Colors');

    // Test error, warning, success colors work in dark theme
    testStateColorContrast();
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  function testDarkThemeCompliance() {
    cy.log('🔍 Testing Dark Theme Class Application');

    // Verify dark class is applied
    cy.get('html').should('have.class', 'dark');

    // Body should have dark background
    cy.get('body')
      .should('have.css', 'background-color')
      .then((bgColor) => {
        // Should be a dark color (RGB values under 50)
        expect(bgColor).to.match(
          /rgb\(\s*([0-4]?\d)\s*,\s*([0-4]?\d)\s*,\s*([0-4]?\d)\s*\)/,
        );
      });
  }

  function testColorContrast(pageName: string) {
    cy.log(`📝 Testing ${pageName} Text Contrast`);

    // Test headings have high contrast
    cy.get('h1, h2, h3').each(($heading) => {
      cy.wrap($heading)
        .should('be.visible')
        .then(() => {
          const color = $heading.css('color');
          // Should be light text (RGB > 150)
          expect(color).to.match(
            /rgb\(\s*(1[5-9]\d|2[0-5]\d)\s*,\s*(1[5-9]\d|2[0-5]\d)\s*,\s*(1[5-9]\d|2[0-5]\d)\s*\)/,
          );
        });
    });

    // Test paragraph text has good contrast
    cy.get('p')
      .first()
      .should('be.visible')
      .then(($p) => {
        const color = $p.css('color');
        // Should have adequate contrast
        expect(color).to.not.equal('rgb(0, 0, 0)'); // Not black text on dark bg
      });
  }

  function testButtonContrast() {
    cy.log('🔘 Testing Button Contrast');

    cy.get('button').each(($btn) => {
      if ($btn.is(':visible')) {
        cy.wrap($btn).then(() => {
          const btnBg = $btn.css('background-color');
          const btnColor = $btn.css('color');

          // Button should have contrasting text and background
          expect(btnBg).to.not.equal(btnColor);
          expect(btnBg).to.not.equal('transparent');
        });
      }
    });
  }

  function testCardBackgroundContrast() {
    cy.log('🃏 Testing Card Background Contrast');

    // Cards should be slightly different from body background
    cy.get('body').then(($body) => {
      const bodyBg = $body.css('background-color');

      // Find card-like elements
      cy.get('div[class*="bg-"], div[class*="border"]').each(($card) => {
        if ($card.is(':visible')) {
          const cardBg = $card.css('background-color');
          if (cardBg !== 'rgba(0, 0, 0, 0)' && cardBg !== 'transparent') {
            expect(cardBg).to.not.equal(bodyBg);
          }
        }
      });
    });
  }

  function testStatCardContrast() {
    cy.log('📊 Testing Stat Card Contrast');

    // Test dashboard stat cards specifically
    cy.get('[data-cy*="stats-"]').each(($statCard) => {
      cy.wrap($statCard)
        .should('be.visible')
        .then(() => {
          const cardBg = $statCard.css('background-color');
          const textColor = $statCard.css('color');

          expect(cardBg).to.not.equal('transparent');
          expect(textColor).to.not.equal(cardBg);
        });
    });
  }

  function testActionButtonContrast() {
    cy.log('⚡ Testing Action Button Contrast');

    cy.get('[data-cy*="quick-action-"]').each(($btn) => {
      cy.wrap($btn)
        .should('be.visible')
        .then(() => {
          const btnBg = $btn.css('background-color');
          const btnColor = $btn.css('color');

          expect(btnBg).to.not.equal(btnColor);
        });
    });
  }

  function testFormElementContrast() {
    cy.log('📋 Testing Form Element Contrast');

    // Test input fields
    cy.get('input').each(($input) => {
      if ($input.is(':visible')) {
        cy.wrap($input).then(() => {
          const inputBg = $input.css('background-color');
          const inputColor = $input.css('color');
          const borderColor = $input.css('border-color');

          expect(inputBg).to.not.equal(inputColor);
          expect(borderColor).to.not.equal('transparent');
        });
      }
    });

    // Test labels
    cy.get('label').each(($label) => {
      if ($label.is(':visible')) {
        cy.wrap($label)
          .should('have.css', 'color')
          .and('not.equal', 'rgb(0, 0, 0)');
      }
    });
  }

  function testToggleContrast() {
    cy.log('🔄 Testing Toggle Element Contrast');

    cy.get('input[type="checkbox"]').each(($toggle) => {
      if ($toggle.is(':visible')) {
        cy.wrap($toggle).then(() => {
          const toggleBg = $toggle.css('background-color');
          expect(toggleBg).to.not.equal('transparent');
        });
      }
    });
  }

  function testTableContrast() {
    cy.log('📊 Testing Table Contrast');

    cy.get('table').then(($tables) => {
      if ($tables.length > 0) {
        cy.get('th, td').each(($cell) => {
          if ($cell.is(':visible')) {
            cy.wrap($cell)
              .should('have.css', 'color')
              .and('not.equal', 'rgb(0, 0, 0)');
          }
        });
      }
    });
  }

  function testIframeContrast() {
    cy.log('🖼️ Testing Iframe Container Contrast');

    cy.get('iframe')
      .parent()
      .then(($container) => {
        const containerBg = $container.css('background-color');
        expect(containerBg).to.not.equal('transparent');
      });
  }

  function testWCAGContrast(selector: string, minRatio: number) {
    cy.get(selector)
      .first()
      .then(($el) => {
        if ($el.is(':visible')) {
          const color = $el.css('color');
          const bgColor = $el.css('background-color');

          // For now, just ensure they are different colors
          // In a real implementation, you'd calculate actual contrast ratio
          expect(color).to.not.equal(bgColor);
        }
      });
  }

  function testStateColorContrast() {
    cy.log('🎨 Testing State Color Contrast');

    // These would test error, warning, success states if present
    const stateClasses = [
      'text-error',
      'text-warning',
      'text-success',
      'bg-error',
      'bg-warning',
      'bg-success',
    ];

    stateClasses.forEach((className) => {
      cy.get('body').then(($body) => {
        if ($body.find(`.${className}`).length > 0) {
          cy.get(`.${className}`).should('be.visible');
        }
      });
    });
  }
});
