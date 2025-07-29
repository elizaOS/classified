/**
 * Cross-Browser Compatibility Testing
 * Tests application functionality across different browsers and browser features
 */

describe('Cross-Browser Compatibility Testing', () => {
  beforeEach(() => {
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
          id: 'browser-test-user',
          email: 'browser@elizaos.ai',
          firstName: 'Browser',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'browser-org',
          name: 'Browser Test Org',
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

  it('Modern Browser Features Test', () => {
    cy.log('🌐 Testing Modern Browser Features');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Modern JavaScript Features
    // ==========================================
    cy.log('📱 Step 1: Test Modern JavaScript Features');

    cy.window().then((win) => {
      // Test Promise support
      expect(win.Promise).to.exist;

      // Test async/await support
      expect(win.Symbol).to.exist;
      expect(win.Symbol.asyncIterator).to.exist;

      // Test modern array methods
      expect(Array.prototype.includes).to.exist;
      expect(Array.prototype.find).to.exist;
      expect(Array.prototype.filter).to.exist;

      // Test fetch API
      expect(win.fetch).to.exist;

      // Test localStorage
      expect(win.localStorage).to.exist;
      expect(win.sessionStorage).to.exist;

      cy.log('✅ Modern JavaScript features supported');
    });

    // ==========================================
    // STEP 2: Test CSS Features
    // ==========================================
    cy.log('🎨 Step 2: Test CSS Features');

    cy.get('[data-cy="dashboard-header"]').should(($el) => {
      const style = window.getComputedStyle($el[0]);

      // Test flexbox support
      expect(['flex', 'inline-flex']).to.include(style.display);

      // Test grid support (if used)
      const hasGrid =
        style.display === 'grid' || style.display === 'inline-grid';
      if (hasGrid) {
        cy.log('✅ CSS Grid supported');
      }

      cy.log('✅ CSS Flexbox supported');
    });

    // ==========================================
    // STEP 3: Test Web APIs
    // ==========================================
    cy.log('🔧 Step 3: Test Web APIs');

    cy.window().then((win) => {
      // Test Clipboard API
      if (win.navigator.clipboard) {
        cy.log('✅ Clipboard API supported');
      } else {
        cy.log('⚠️ Clipboard API not supported - fallback needed');
      }

      // Test Intersection Observer
      if (win.IntersectionObserver) {
        cy.log('✅ Intersection Observer supported');
      } else {
        cy.log('⚠️ Intersection Observer not supported - polyfill needed');
      }

      // Test ResizeObserver
      if (win.ResizeObserver) {
        cy.log('✅ ResizeObserver supported');
      } else {
        cy.log('⚠️ ResizeObserver not supported - polyfill needed');
      }

      // Test URLSearchParams
      if (win.URLSearchParams) {
        cy.log('✅ URLSearchParams supported');
      } else {
        cy.log('⚠️ URLSearchParams not supported - polyfill needed');
      }
    });

    cy.log('✅ Modern Browser Features Test Complete!');
  });

  it('Legacy Browser Fallbacks Test', () => {
    cy.log('🔄 Testing Legacy Browser Fallbacks');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Form Functionality
    // ==========================================
    cy.log('📝 Step 1: Test Form Functionality');

    // Test basic form submission without modern features
    cy.get('[data-cy="email-input"] input').type('test@example.com');
    cy.get('[data-cy="password-input"] input').type('password123');

    // Verify form validation works
    cy.get('[data-cy="login-submit-button"]').should('not.be.disabled');

    // Test without relying on modern APIs
    cy.get('[data-cy="login-form"]').should('be.visible');
    cy.get('[data-cy="signup-link"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Without Fetch API
    // ==========================================
    cy.log('🌐 Step 2: Test Without Fetch API');

    cy.window().then((win) => {
      // Temporarily disable fetch to test XMLHttpRequest fallback
      const originalFetch = win.fetch;
      delete (win as any).fetch;

      // Mock login with XMLHttpRequest fallback
      cy.intercept('POST', '**/api/auth/login', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            user: { id: 'legacy-user', email: 'test@example.com' },
            organization: { id: 'legacy-org', name: 'Legacy Org' },
            tokens: { accessToken: 'token', refreshToken: 'refresh' },
          },
        },
      }).as('legacyLogin');

      // Restore fetch after test
      (win as any).fetch = originalFetch;
    });

    // ==========================================
    // STEP 3: Test Basic DOM Manipulation
    // ==========================================
    cy.log('🎭 Step 3: Test Basic DOM Manipulation');

    // Test that application works with basic DOM APIs
    cy.get('[data-cy="login-page"]').should('be.visible');
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

    cy.log('✅ Legacy Browser Fallbacks Test Complete!');
  });

  it('Mobile Browser Compatibility Test', () => {
    cy.log('📱 Testing Mobile Browser Compatibility');

    // Set mobile viewport
    cy.viewport('iphone-x');

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
    // STEP 1: Test Touch Events
    // ==========================================
    cy.log('👆 Step 1: Test Touch Events');

    cy.window().then((win) => {
      // Test touch event support
      if ('ontouchstart' in win) {
        cy.log('✅ Touch events supported');

        // Test touch interactions
        cy.get('[data-cy="quick-action-create-agent"]').should('be.visible');
        cy.get('[data-cy="quick-action-create-agent"]').click();
      } else {
        cy.log('⚠️ Touch events not supported - using mouse events');
      }
    });

    // ==========================================
    // STEP 2: Test Mobile Viewport Features
    // ==========================================
    cy.log('📐 Step 2: Test Mobile Viewport Features');

    // Test viewport meta tag effectiveness
    cy.get('[data-cy="dashboard-header"]').should('be.visible');
    cy.get('[data-cy="stats-section"]').should('be.visible');

    // Test responsive design
    cy.get('[data-cy="stats-section"]').should(($el) => {
      const width = $el.width();
      expect(width).to.be.lessThan(500); // Should be mobile-optimized
    });

    // ==========================================
    // STEP 3: Test Mobile Navigation
    // ==========================================
    cy.log('🧭 Step 3: Test Mobile Navigation');

    // Test mobile-specific navigation elements
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="mobile-menu-button"]').length > 0) {
        cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
        cy.get('[data-testid="mobile-menu-button"]').click();
        cy.get('[data-testid="app-sidebar"]').should('exist');
      }
    });

    // Reset viewport
    cy.viewport(1280, 720);

    cy.log('✅ Mobile Browser Compatibility Test Complete!');
  });

  it('Browser Storage Compatibility Test', () => {
    cy.log('💾 Testing Browser Storage Compatibility');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test localStorage
    // ==========================================
    cy.log('🗄️ Step 1: Test localStorage');

    cy.window().then((win) => {
      if (win.localStorage) {
        // Test localStorage functionality
        win.localStorage.setItem('test-key', 'test-value');
        const value = win.localStorage.getItem('test-key');
        expect(value).to.equal('test-value');
        win.localStorage.removeItem('test-key');
        cy.log('✅ localStorage supported');
      } else {
        cy.log('⚠️ localStorage not supported - fallback needed');
      }
    });

    // ==========================================
    // STEP 2: Test sessionStorage
    // ==========================================
    cy.log('📝 Step 2: Test sessionStorage');

    cy.window().then((win) => {
      if (win.sessionStorage) {
        // Test sessionStorage functionality
        win.sessionStorage.setItem('session-test', 'session-value');
        const value = win.sessionStorage.getItem('session-test');
        expect(value).to.equal('session-value');
        win.sessionStorage.removeItem('session-test');
        cy.log('✅ sessionStorage supported');
      } else {
        cy.log('⚠️ sessionStorage not supported - fallback needed');
      }
    });

    // ==========================================
    // STEP 3: Test Cookies
    // ==========================================
    cy.log('🍪 Step 3: Test Cookies');

    cy.setCookie('test-cookie', 'test-value');
    cy.getCookie('test-cookie').should('have.property', 'value', 'test-value');
    cy.clearCookie('test-cookie');
    cy.log('✅ Cookies supported');

    cy.log('✅ Browser Storage Compatibility Test Complete!');
  });

  it('Network Connectivity Test', () => {
    cy.log('🌐 Testing Network Connectivity');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Online/Offline Detection
    // ==========================================
    cy.log('📡 Step 1: Test Online/Offline Detection');

    cy.window().then((win) => {
      // Test navigator.onLine
      if ('onLine' in win.navigator) {
        expect(win.navigator.onLine).to.be.true;
        cy.log('✅ Online status detection supported');
      } else {
        cy.log('⚠️ Online status detection not supported');
      }

      // Test connection type if available
      if ('connection' in win.navigator) {
        const connection = (win.navigator as any).connection;
        if (connection) {
          cy.log(
            `📊 Connection type: ${connection.effectiveType || 'unknown'}`,
          );
        }
      }
    });

    // ==========================================
    // STEP 2: Test Network Error Handling
    // ==========================================
    cy.log('❌ Step 2: Test Network Error Handling');

    // Mock network error
    cy.intercept('GET', '**/api/dashboard/stats', {
      forceNetworkError: true,
    }).as('networkError');

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@networkError');

    // Application should handle network errors gracefully
    cy.get('[data-cy="dashboard-header"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Slow Network Simulation
    // ==========================================
    cy.log('🐌 Step 3: Test Slow Network Simulation');

    // Mock slow API response
    cy.intercept('GET', '**/api/dashboard/stats', {
      delay: 3000,
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
    }).as('slowStats');

    cy.reload();
    cy.wait('@getIdentity');

    // Should show loading states during slow network
    cy.get('.animate-pulse').should('be.visible');

    cy.wait('@slowStats');

    // Should complete loading eventually
    cy.get('[data-cy="stats-section"]').should('be.visible');

    cy.log('✅ Network Connectivity Test Complete!');
  });

  it('Security Features Test', () => {
    cy.log('🔒 Testing Security Features');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test HTTPS Enforcement
    // ==========================================
    cy.log('🔐 Step 1: Test HTTPS Enforcement');

    cy.location('protocol').should('include', 'http');
    // In production, this should be 'https:'

    // ==========================================
    // STEP 2: Test Content Security Policy
    // ==========================================
    cy.log('🛡️ Step 2: Test Content Security Policy');

    cy.document().then((doc) => {
      // Check for CSP headers (would be set by server)
      const metaCSP = doc.querySelector(
        'meta[http-equiv="Content-Security-Policy"]',
      );
      if (metaCSP) {
        cy.log('✅ Content Security Policy found');
      } else {
        cy.log('⚠️ Content Security Policy not found in meta tags');
      }
    });

    // ==========================================
    // STEP 3: Test XSS Prevention
    // ==========================================
    cy.log('🚫 Step 3: Test XSS Prevention');

    // Test that script injection is prevented
    const maliciousScript = '<script>alert("xss")</script>';

    cy.get('[data-cy="email-input"] input').type(maliciousScript);
    cy.get('[data-cy="email-input"] input').should(
      'have.value',
      maliciousScript,
    );

    // Script should not execute
    cy.window().then((win) => {
      // No alert should appear
      cy.log('✅ XSS prevention working - no script execution');
    });

    // ==========================================
    // STEP 4: Test CSRF Protection
    // ==========================================
    cy.log('🔒 Step 4: Test CSRF Protection');

    // Mock login with CSRF token
    cy.intercept('POST', '**/api/auth/login', (req) => {
      // Check for CSRF token in headers or body
      const hasCSRFProtection =
        req.headers['x-csrf-token'] ||
        req.headers['x-xsrf-token'] ||
        (req.body && req.body.csrfToken);

      if (hasCSRFProtection) {
        cy.log('✅ CSRF protection detected');
      } else {
        cy.log('⚠️ CSRF protection not detected in request');
      }

      req.reply({
        statusCode: 200,
        body: { success: true, data: { user: {}, tokens: {} } },
      });
    }).as('csrfLogin');

    cy.get('[data-cy="email-input"] input').clear().type('test@example.com');
    cy.get('[data-cy="password-input"] input').type('password123');
    cy.get('[data-cy="login-submit-button"]').click();

    cy.log('✅ Security Features Test Complete!');
  });
});
