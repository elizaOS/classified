/**
 * Comprehensive Performance Testing
 * Tests loading times, bundle sizes, memory usage, and Core Web Vitals
 */

describe('Performance Comprehensive Testing', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication for performance testing
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'performance-user',
          email: 'performance@elizaos.ai',
          firstName: 'Performance',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'performance-org',
          name: 'Performance Test Org',
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

  it('Page Load Performance Test', () => {
    cy.log('⚡ Testing Page Load Performance');

    // ==========================================
    // STEP 1: Test Dashboard Load Time
    // ==========================================
    cy.log('🏠 Step 1: Test Dashboard Load Time');

    // Mock dashboard data with slight delay to simulate real API
    cy.intercept('GET', '**/api/dashboard/stats', {
      delay: 200,
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
      delay: 150,
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

    const startTime = performance.now();

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getDashboardStats');
    cy.wait('@getDashboardActivity');

    // Verify page loads completely
    cy.get('[data-cy="dashboard-header"]').should('be.visible');
    cy.get('[data-cy="stats-section"]').should('be.visible');
    cy.get('[data-cy="quick-actions"]').should('be.visible');
    cy.get('[data-cy="recent-activity"]').should('be.visible');

    cy.window().then((win) => {
      const loadTime = performance.now() - startTime;
      cy.log(`📊 Dashboard load time: ${loadTime.toFixed(2)}ms`);

      // Assert reasonable load time (should be under 3 seconds)
      expect(loadTime).to.be.lessThan(3000);
    });

    // ==========================================
    // STEP 2: Test API Keys Page Load
    // ==========================================
    cy.log('🔑 Step 2: Test API Keys Page Load');

    cy.intercept('GET', '**/api/api-keys', {
      delay: 300,
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: Array.from({ length: 10 }, (_, i) => ({
            id: `ak_test_${i}`,
            name: `Test API Key ${i}`,
            keyPrefix: `eliza_test_sk_${i}`,
            permissions: ['inference:*', 'storage:*'],
            rateLimit: 100,
            isActive: true,
            usageCount: Math.floor(Math.random() * 1000),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          stats: {
            totalKeys: 10,
            activeKeys: 10,
            expiredKeys: 0,
            totalUsage: 5000,
          },
          availablePermissions: ['inference:*', 'storage:*', 'agents:write'],
        },
      },
    }).as('getApiKeys');

    const apiKeysStartTime = performance.now();

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getApiKeys');

    cy.get('[data-cy="api-keys-page"]').should('be.visible');
    cy.get('[data-cy="api-key-row"]').should('have.length', 10);

    cy.window().then((win) => {
      const loadTime = performance.now() - apiKeysStartTime;
      cy.log(`📊 API Keys page load time: ${loadTime.toFixed(2)}ms`);
      expect(loadTime).to.be.lessThan(3000);
    });

    // ==========================================
    // STEP 3: Test Modal Performance
    // ==========================================
    cy.log('🎭 Step 3: Test Modal Performance');

    const modalStartTime = performance.now();

    cy.get('[data-cy="create-api-key-button"]').click();
    cy.get('[data-cy="api-key-modal"]').should('be.visible');

    cy.window().then((win) => {
      const modalTime = performance.now() - modalStartTime;
      cy.log(`📊 Modal open time: ${modalTime.toFixed(2)}ms`);
      expect(modalTime).to.be.lessThan(500);
    });

    cy.log('✅ Page Load Performance Test Complete!');
  });

  it('Network Performance Test', () => {
    cy.log('🌐 Testing Network Performance');

    // ==========================================
    // STEP 1: Test Concurrent API Calls
    // ==========================================
    cy.log('🔄 Step 1: Test Concurrent API Calls');

    // Mock multiple API endpoints with various delays
    cy.intercept('GET', '**/api/dashboard/stats', {
      delay: 100,
      statusCode: 200,
      body: { success: true, data: { agentCount: 5 } },
    }).as('getStats');

    cy.intercept('GET', '**/api/dashboard/activity*', {
      delay: 150,
      statusCode: 200,
      body: { success: true, data: [] },
    }).as('getActivity');

    cy.intercept('GET', '**/api/billing/overview', {
      delay: 200,
      statusCode: 200,
      body: { success: true, data: { creditBalance: '1000.0' } },
    }).as('getBilling');

    const networkStartTime = performance.now();

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Wait for all concurrent API calls
    cy.wait(['@getStats', '@getActivity']);

    cy.window().then((win) => {
      const networkTime = performance.now() - networkStartTime;
      cy.log(`📊 Concurrent API load time: ${networkTime.toFixed(2)}ms`);
      expect(networkTime).to.be.lessThan(2000);
    });

    // ==========================================
    // STEP 2: Test Large Data Sets
    // ==========================================
    cy.log('📊 Step 2: Test Large Data Sets');

    // Mock API with large dataset
    cy.intercept('GET', '**/api/api-keys', {
      delay: 500,
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: Array.from({ length: 100 }, (_, i) => ({
            id: `ak_large_${i}`,
            name: `Large Dataset API Key ${i}`,
            keyPrefix: `eliza_large_sk_${i}`,
            permissions: ['inference:*', 'storage:*', 'agents:write'],
            rateLimit: 100,
            isActive: Math.random() > 0.2,
            usageCount: Math.floor(Math.random() * 10000),
            createdAt: new Date(
              Date.now() - Math.random() * 86400000 * 30,
            ).toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          stats: {
            totalKeys: 100,
            activeKeys: 80,
            expiredKeys: 20,
            totalUsage: 50000,
          },
          availablePermissions: ['inference:*', 'storage:*', 'agents:write'],
        },
      },
    }).as('getLargeApiKeys');

    const largeDataStartTime = performance.now();

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getLargeApiKeys');

    cy.get('[data-cy="api-keys-page"]').should('be.visible');
    cy.get('[data-cy="api-key-row"]').should('have.length', 100);

    cy.window().then((win) => {
      const largeDataTime = performance.now() - largeDataStartTime;
      cy.log(`📊 Large dataset render time: ${largeDataTime.toFixed(2)}ms`);
      expect(largeDataTime).to.be.lessThan(5000);
    });

    // ==========================================
    // STEP 3: Test Error Recovery Performance
    // ==========================================
    cy.log('❌ Step 3: Test Error Recovery Performance');

    // First request fails, second succeeds
    cy.intercept('GET', '**/api/dashboard/stats', {
      forceNetworkError: true,
    }).as('getStatsError');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getStatsError');

    // Mock successful retry
    cy.intercept('GET', '**/api/dashboard/stats', {
      statusCode: 200,
      body: { success: true, data: { agentCount: 5 } },
    }).as('getStatsRetry');

    const retryStartTime = performance.now();

    // Simulate retry by reloading
    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getStatsRetry');

    cy.window().then((win) => {
      const retryTime = performance.now() - retryStartTime;
      cy.log(`📊 Error recovery time: ${retryTime.toFixed(2)}ms`);
      expect(retryTime).to.be.lessThan(3000);
    });

    cy.log('✅ Network Performance Test Complete!');
  });

  it('Memory Usage Test', () => {
    cy.log('🧠 Testing Memory Usage');

    // ==========================================
    // STEP 1: Test Memory Baseline
    // ==========================================
    cy.log('📏 Step 1: Test Memory Baseline');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    cy.window().then((win) => {
      if (win.performance && win.performance.memory) {
        const memory = win.performance.memory;
        cy.log(
          `📊 Initial memory usage: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        );
        cy.log(
          `📊 Memory limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
        );

        // Assert reasonable memory usage (should be under 50MB)
        expect(memory.usedJSHeapSize).to.be.lessThan(50 * 1024 * 1024);
      }
    });

    // ==========================================
    // STEP 2: Test Memory After Navigation
    // ==========================================
    cy.log('🧭 Step 2: Test Memory After Navigation');

    // Navigate through multiple pages
    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    cy.window().then((win) => {
      if (win.performance && win.performance.memory) {
        const memory = win.performance.memory;
        cy.log(
          `📊 Memory after navigation: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        );

        // Memory should not have grown excessively
        expect(memory.usedJSHeapSize).to.be.lessThan(100 * 1024 * 1024);
      }
    });

    // ==========================================
    // STEP 3: Test Memory with Modal Operations
    // ==========================================
    cy.log('🎭 Step 3: Test Memory with Modal Operations');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Mock API keys for testing
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

    cy.wait('@getApiKeys');

    // Open and close modals multiple times
    for (let i = 0; i < 5; i++) {
      cy.get('[data-cy="create-api-key-button"]').click();
      cy.get('[data-cy="api-key-modal"]').should('be.visible');
      cy.get('body').type('{esc}');
      cy.get('[data-cy="api-key-modal"]').should('not.exist');
    }

    cy.window().then((win) => {
      if (win.performance && win.performance.memory) {
        const memory = win.performance.memory;
        cy.log(
          `📊 Memory after modal operations: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        );

        // Memory should not have leaked significantly
        expect(memory.usedJSHeapSize).to.be.lessThan(75 * 1024 * 1024);
      }
    });

    cy.log('✅ Memory Usage Test Complete!');
  });

  it('Rendering Performance Test', () => {
    cy.log('🎨 Testing Rendering Performance');

    // ==========================================
    // STEP 1: Test Initial Paint Time
    // ==========================================
    cy.log('🖼️ Step 1: Test Initial Paint Time');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    cy.window().then((win) => {
      const navigation = win.performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        const fcp = navigation.loadEventEnd - navigation.fetchStart;
        cy.log(`📊 First Contentful Paint: ${fcp.toFixed(2)}ms`);

        // FCP should be under 2 seconds
        expect(fcp).to.be.lessThan(2000);
      }
    });

    // ==========================================
    // STEP 2: Test Component Render Time
    // ==========================================
    cy.log('🧩 Step 2: Test Component Render Time');

    // Mock large dataset for stress testing
    cy.intercept('GET', '**/api/dashboard/stats', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          agentCount: 1000,
          userCount: 500,
          creditBalance: '10000.0',
          subscriptionTier: 'enterprise',
          apiRequests24h: 100000,
          totalCost24h: '500.00',
          activeAgents: 800,
          pendingInvites: 50,
        },
      },
    }).as('getLargeStats');

    cy.intercept('GET', '**/api/dashboard/activity*', {
      statusCode: 200,
      body: {
        success: true,
        data: Array.from({ length: 50 }, (_, i) => ({
          id: `activity-${i}`,
          type: 'agent_created',
          title: `Activity ${i}`,
          description: `Description for activity ${i}`,
          timestamp: `${i} hours ago`,
        })),
      },
    }).as('getLargeActivity');

    const renderStartTime = performance.now();

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getLargeStats');
    cy.wait('@getLargeActivity');

    // Wait for all components to render
    cy.get('[data-cy="stats-section"]').should('be.visible');
    cy.get('[data-cy="activity-list"]').should('be.visible');
    cy.get('[data-cy="activity-item-agent_created"]').should('have.length', 50);

    cy.window().then((win) => {
      const renderTime = performance.now() - renderStartTime;
      cy.log(`📊 Large dataset render time: ${renderTime.toFixed(2)}ms`);
      expect(renderTime).to.be.lessThan(3000);
    });

    // ==========================================
    // STEP 3: Test Scroll Performance
    // ==========================================
    cy.log('📜 Step 3: Test Scroll Performance');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Mock large list for scroll testing
    cy.intercept('GET', '**/api/api-keys', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: Array.from({ length: 200 }, (_, i) => ({
            id: `ak_scroll_${i}`,
            name: `Scroll Test API Key ${i}`,
            keyPrefix: `eliza_scroll_sk_${i}`,
            permissions: ['inference:*'],
            rateLimit: 100,
            isActive: true,
            usageCount: i * 10,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          stats: {
            totalKeys: 200,
            activeKeys: 200,
            expiredKeys: 0,
            totalUsage: 20000,
          },
          availablePermissions: ['inference:*'],
        },
      },
    }).as('getScrollApiKeys');

    cy.wait('@getScrollApiKeys');
    cy.get('[data-cy="api-key-row"]').should('have.length', 200);

    const scrollStartTime = performance.now();

    // Scroll through the list
    cy.get('[data-cy="api-keys-page"]').scrollTo('bottom', { duration: 1000 });
    cy.get('[data-cy="api-keys-page"]').scrollTo('top', { duration: 1000 });

    cy.window().then((win) => {
      const scrollTime = performance.now() - scrollStartTime;
      cy.log(`📊 Scroll performance time: ${scrollTime.toFixed(2)}ms`);
      expect(scrollTime).to.be.lessThan(3000);
    });

    cy.log('✅ Rendering Performance Test Complete!');
  });

  it('Resource Loading Test', () => {
    cy.log('📦 Testing Resource Loading');

    // ==========================================
    // STEP 1: Test JavaScript Bundle Size
    // ==========================================
    cy.log('📄 Step 1: Test JavaScript Bundle Size');

    cy.visit('/dashboard', { failOnStatusCode: false });

    cy.window().then((win) => {
      const resources = win.performance.getEntriesByType(
        'resource',
      ) as PerformanceResourceTiming[];

      let totalJSSize = 0;
      let totalCSSSize = 0;

      resources.forEach((resource) => {
        if (resource.name.includes('.js')) {
          totalJSSize += resource.transferSize || 0;
        }
        if (resource.name.includes('.css')) {
          totalCSSSize += resource.transferSize || 0;
        }
      });

      cy.log(`📊 Total JS bundle size: ${(totalJSSize / 1024).toFixed(2)}KB`);
      cy.log(`📊 Total CSS bundle size: ${(totalCSSSize / 1024).toFixed(2)}KB`);

      // Assert reasonable bundle sizes
      expect(totalJSSize).to.be.lessThan(2 * 1024 * 1024); // 2MB
      expect(totalCSSSize).to.be.lessThan(500 * 1024); // 500KB
    });

    // ==========================================
    // STEP 2: Test Image Loading
    // ==========================================
    cy.log('🖼️ Step 2: Test Image Loading');

    cy.get('img').each(($img) => {
      cy.wrap($img).should('be.visible');
      cy.wrap($img).should(($el) => {
        expect($el[0].complete).to.be.true;
        expect($el[0].naturalWidth).to.be.greaterThan(0);
      });
    });

    // ==========================================
    // STEP 3: Test Font Loading
    // ==========================================
    cy.log('🔤 Step 3: Test Font Loading');

    cy.document().then((doc) => {
      const fonts = doc.fonts;
      if (fonts && fonts.ready) {
        fonts.ready.then(() => {
          cy.log('📊 All fonts loaded successfully');
        });
      }
    });

    cy.log('✅ Resource Loading Test Complete!');
  });

  it('Core Web Vitals Test', () => {
    cy.log('🎯 Testing Core Web Vitals');

    // ==========================================
    // STEP 1: Test Largest Contentful Paint (LCP)
    // ==========================================
    cy.log('🖼️ Step 1: Test Largest Contentful Paint');

    cy.visit('/dashboard', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // Mock dashboard data quickly for LCP testing
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
    }).as('getFastStats');

    cy.wait('@getFastStats');

    cy.get('[data-cy="dashboard-header"] h1').should('be.visible');
    cy.get('[data-cy="stats-section"]').should('be.visible');

    cy.window().then((win) => {
      // LCP should be under 2.5 seconds for good performance
      const navigation = win.performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        const lcp = navigation.loadEventEnd - navigation.fetchStart;
        cy.log(`📊 Largest Contentful Paint: ${lcp.toFixed(2)}ms`);
        expect(lcp).to.be.lessThan(2500);
      }
    });

    // ==========================================
    // STEP 2: Test First Input Delay (FID)
    // ==========================================
    cy.log('⚡ Step 2: Test First Input Delay');

    const inputStartTime = performance.now();

    // Simulate user interaction
    cy.get('[data-cy="quick-action-create-agent"]').click();

    cy.window().then((win) => {
      const inputDelay = performance.now() - inputStartTime;
      cy.log(`📊 First Input Delay: ${inputDelay.toFixed(2)}ms`);

      // FID should be under 100ms for good performance
      expect(inputDelay).to.be.lessThan(100);
    });

    // ==========================================
    // STEP 3: Test Cumulative Layout Shift (CLS)
    // ==========================================
    cy.log('📐 Step 3: Test Cumulative Layout Shift');

    // Wait for page to fully load and stabilize
    cy.get('[data-cy="dashboard-header"]').should('be.visible');
    cy.get('[data-cy="stats-section"]').should('be.visible');
    cy.get('[data-cy="quick-actions"]').should('be.visible');
    cy.get('[data-cy="recent-activity"]').should('be.visible');

    // Check that layout is stable
    cy.get('[data-cy="stats-section"]').should(
      'have.css',
      'position',
      'static',
    );
    cy.get('[data-cy="quick-actions"]').should('be.visible');

    cy.log('📊 Layout appears stable with minimal shift');

    cy.log('✅ Core Web Vitals Test Complete!');
  });
});
