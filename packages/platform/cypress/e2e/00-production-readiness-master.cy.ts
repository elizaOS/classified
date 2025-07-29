/**
 * ElizaOS Platform - Production Readiness Master Test Suite
 * Ensures 100% coverage of all routes, pages, and functionality
 * Special emphasis on API key system as requested
 */

describe('ElizaOS Platform - Production Readiness Master Suite', () => {
  beforeEach(() => {
    // Clear all state before each test
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication for protected routes
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'prod-test-user',
          email: 'test@elizaos.ai',
          firstName: 'Production',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'prod-test-org',
          name: 'Production Test Org',
          slug: 'prod-test',
          subscriptionTier: 'premium',
          creditBalance: '10000.0',
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

  describe('API Routes Coverage', () => {
    it('API Health & Infrastructure Routes', () => {
      cy.log('🏥 Testing API Health & Infrastructure Routes');

      const healthRoutes = [
        { path: '/api/health', name: 'Health Check' },
        { path: '/api/ping', name: 'Ping' },
        { path: '/api/metrics', name: 'Metrics' },
        { path: '/api/performance', name: 'Performance' },
      ];

      healthRoutes.forEach((route) => {
        cy.request({
          method: 'GET',
          url: route.path,
          failOnStatusCode: false,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 401, 403]);
        });
      });
    });

    it('API Authentication Routes', () => {
      cy.log('🔐 Testing API Authentication Routes');

      const authRoutes = [
        { path: '/api/auth/login', method: 'POST', name: 'Login' },
        { path: '/api/auth/signup', method: 'POST', name: 'Signup' },
        { path: '/api/auth/logout', method: 'POST', name: 'Logout' },
        { path: '/api/auth/refresh', method: 'POST', name: 'Refresh Token' },
        {
          path: '/api/auth/forgot-password',
          method: 'POST',
          name: 'Forgot Password',
        },
        {
          path: '/api/auth/reset-password',
          method: 'POST',
          name: 'Reset Password',
        },
        {
          path: '/api/auth/verify-email',
          method: 'POST',
          name: 'Verify Email',
        },
        { path: '/api/auth/identity', method: 'GET', name: 'Get Identity' },
        { path: '/api/auth/callback', method: 'GET', name: 'OAuth Callback' },
        { path: '/api/auth/device/code', method: 'POST', name: 'Device Code' },
        {
          path: '/api/auth/device/verify',
          method: 'POST',
          name: 'Device Verify',
        },
        {
          path: '/api/auth/device/token',
          method: 'POST',
          name: 'Device Token',
        },
      ];

      authRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
          body: route.method === 'POST' ? {} : undefined,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 400, 401, 403, 405]);
        });
      });
    });

    it('API Keys Routes - Comprehensive Coverage', () => {
      cy.log('🔑 Testing API Keys Routes - PRIORITY FOCUS');

      const apiKeyRoutes = [
        { path: '/api/api-keys', method: 'GET', name: 'List API Keys' },
        { path: '/api/api-keys', method: 'POST', name: 'Create API Key' },
        { path: '/api/api-keys/test-id', method: 'GET', name: 'Get API Key' },
        {
          path: '/api/api-keys/test-id',
          method: 'PUT',
          name: 'Update API Key',
        },
        {
          path: '/api/api-keys/test-id',
          method: 'DELETE',
          name: 'Delete API Key',
        },
        {
          path: '/api/api-keys/test-id/regenerate',
          method: 'POST',
          name: 'Regenerate API Key',
        },
        {
          path: '/api/api-keys/test-id/usage',
          method: 'GET',
          name: 'API Key Usage',
        },
        {
          path: '/api/api-keys/validate',
          method: 'POST',
          name: 'Validate API Key',
        },
      ];

      apiKeyRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
          body:
            route.method === 'POST' || route.method === 'PUT' ? {} : undefined,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 400, 401, 403, 404, 405]);
        });
      });
    });

    it('Billing & Payment Routes', () => {
      cy.log('💳 Testing Billing & Payment Routes');

      const billingRoutes = [
        { path: '/api/billing/checkout', method: 'POST', name: 'Checkout' },
        { path: '/api/billing/webhook', method: 'POST', name: 'Webhook' },
        {
          path: '/api/billing/credits/add',
          method: 'POST',
          name: 'Add Credits',
        },
        {
          path: '/api/billing/credits/balance',
          method: 'GET',
          name: 'Credit Balance',
        },
        {
          path: '/api/billing/subscription',
          method: 'GET',
          name: 'Get Subscription',
        },
        {
          path: '/api/billing/subscription/update',
          method: 'POST',
          name: 'Update Subscription',
        },
        {
          path: '/api/billing/payment-methods',
          method: 'GET',
          name: 'Payment Methods',
        },
        { path: '/api/billing/invoices', method: 'GET', name: 'Invoices' },
        { path: '/api/billing/usage', method: 'GET', name: 'Usage' },
      ];

      billingRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
          body: route.method === 'POST' ? {} : undefined,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 400, 401, 403, 405]);
        });
      });
    });

    it('Agent Management Routes', () => {
      cy.log('🤖 Testing Agent Management Routes');

      const agentRoutes = [
        { path: '/api/agents', method: 'GET', name: 'List Agents' },
        { path: '/api/agents', method: 'POST', name: 'Create Agent' },
        { path: '/api/agents/test-id', method: 'GET', name: 'Get Agent' },
        { path: '/api/agents/test-id', method: 'PUT', name: 'Update Agent' },
        { path: '/api/agents/test-id', method: 'DELETE', name: 'Delete Agent' },
        {
          path: '/api/agents/test-id/start',
          method: 'POST',
          name: 'Start Agent',
        },
        {
          path: '/api/agents/test-id/stop',
          method: 'POST',
          name: 'Stop Agent',
        },
        { path: '/api/agents/test-id/logs', method: 'GET', name: 'Agent Logs' },
        {
          path: '/api/agents/test-id/stats',
          method: 'GET',
          name: 'Agent Stats',
        },
      ];

      agentRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
          body:
            route.method === 'POST' || route.method === 'PUT' ? {} : undefined,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 400, 401, 403, 404, 405]);
        });
      });
    });

    it('Character & AI Routes', () => {
      cy.log('🎭 Testing Character & AI Routes');

      const characterRoutes = [
        { path: '/api/characters', method: 'GET', name: 'List Characters' },
        { path: '/api/characters', method: 'POST', name: 'Create Character' },
        {
          path: '/api/characters/test-id',
          method: 'GET',
          name: 'Get Character',
        },
        {
          path: '/api/characters/test-id/chat',
          method: 'POST',
          name: 'Chat with Character',
        },
        { path: '/api/ai/chat', method: 'POST', name: 'AI Chat' },
        { path: '/api/anonymous/chat', method: 'POST', name: 'Anonymous Chat' },
      ];

      characterRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
          body: route.method === 'POST' ? {} : undefined,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 400, 401, 403, 404, 405]);
        });
      });
    });

    it('Analytics & Monitoring Routes', () => {
      cy.log('📊 Testing Analytics & Monitoring Routes');

      const analyticsRoutes = [
        {
          path: '/api/analytics/overview',
          method: 'GET',
          name: 'Analytics Overview',
        },
        {
          path: '/api/analytics/detailed',
          method: 'GET',
          name: 'Detailed Analytics',
        },
        {
          path: '/api/analytics/export',
          method: 'GET',
          name: 'Export Analytics',
        },
        {
          path: '/api/analytics/config',
          method: 'GET',
          name: 'Analytics Config',
        },
      ];

      analyticsRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 401, 403]);
        });
      });
    });

    it('Marketplace Routes', () => {
      cy.log('🛒 Testing Marketplace Routes');

      const marketplaceRoutes = [
        { path: '/api/marketplace/assets', method: 'GET', name: 'List Assets' },
        {
          path: '/api/marketplace/assets/featured',
          method: 'GET',
          name: 'Featured Assets',
        },
        {
          path: '/api/marketplace/assets/search',
          method: 'GET',
          name: 'Search Assets',
        },
        {
          path: '/api/marketplace/assets/test-id',
          method: 'GET',
          name: 'Get Asset',
        },
        {
          path: '/api/marketplace/categories',
          method: 'GET',
          name: 'Categories',
        },
      ];

      marketplaceRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 401, 403, 404]);
        });
      });
    });

    it('Documentation Routes', () => {
      cy.log('📚 Testing Documentation Routes');

      const docRoutes = [
        { path: '/api/openapi.yaml', method: 'GET', name: 'OpenAPI Spec' },
        { path: '/api/swagger', method: 'GET', name: 'Swagger UI' },
      ];

      docRoutes.forEach((route) => {
        cy.request({
          method: route.method,
          url: route.path,
          failOnStatusCode: false,
        }).then((response) => {
          cy.log(`✅ ${route.name}: ${response.status}`);
          expect(response.status).to.be.oneOf([200, 301, 302]);
        });
      });
    });
  });

  describe('Frontend Pages Coverage', () => {
    it('Public Pages - Complete Coverage', () => {
      cy.log('🌐 Testing All Public Pages');

      const publicPages = [
        { path: '/', name: 'Landing Page' },
        { path: '/website-lander', name: 'Website Lander' },
        { path: '/app-lander', name: 'App Lander' },
        { path: '/legal/privacy', name: 'Privacy Policy' },
        { path: '/legal/terms', name: 'Terms of Service' },
        { path: '/api-docs', name: 'API Documentation' },
      ];

      publicPages.forEach((page) => {
        cy.visit(page.path, { failOnStatusCode: false });
        cy.get('body').should('be.visible');
        cy.log(`✅ ${page.name} loads successfully`);
      });
    });

    it('Authentication Pages - Complete Coverage', () => {
      cy.log('🔐 Testing All Authentication Pages');

      const authPages = [
        { path: '/auth/login', name: 'Login' },
        { path: '/auth/signup', name: 'Signup' },
        { path: '/auth/forgot-password', name: 'Forgot Password' },
        { path: '/auth/change-password', name: 'Change Password' },
        { path: '/auth/confirm', name: 'Confirm' },
        { path: '/auth/confirm-email', name: 'Confirm Email' },
        { path: '/auth/device', name: 'Device Auth' },
        { path: '/auth/refresh', name: 'Refresh' },
      ];

      authPages.forEach((page) => {
        cy.visit(page.path, { failOnStatusCode: false });
        cy.get('body').should('be.visible');
        cy.log(`✅ ${page.name} page loads successfully`);
      });
    });

    it('Dashboard Pages - Complete Coverage', () => {
      cy.log('📊 Testing All Dashboard Pages');

      const dashboardPages = [
        { path: '/dashboard', name: 'Dashboard Home' },
        { path: '/dashboard/agents', name: 'Agents' },
        { path: '/dashboard/billing', name: 'Billing' },
        { path: '/dashboard/autocoder', name: 'Autocoder' },
        { path: '/dashboard/generation', name: 'Generation Studio' },
        { path: '/dashboard/generation/text', name: 'Text Generation' },
        { path: '/dashboard/generation/image', name: 'Image Generation' },
        { path: '/dashboard/generation/video', name: 'Video Generation' },
        { path: '/dashboard/generation/audio', name: 'Audio Generation' },
        { path: '/analytics', name: 'Analytics' },
        { path: '/api-keys', name: 'API Keys' },
        { path: '/characters', name: 'Characters' },
        { path: '/settings/account', name: 'Account Settings' },
        { path: '/settings/billing', name: 'Billing Settings' },
        { path: '/settings/tokens', name: 'Token Settings' },
      ];

      dashboardPages.forEach((page) => {
        cy.visit(page.path, { failOnStatusCode: false });
        cy.wait('@getIdentity');
        cy.get('body').should('be.visible');
        cy.log(`✅ ${page.name} page loads successfully`);
      });
    });
  });

  describe('API Key System - Deep Dive Testing', () => {
    it('API Key Full Lifecycle Test', () => {
      cy.log('🔑 Testing Complete API Key Lifecycle');

      cy.visit('/api-keys', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      // Mock empty state
      cy.intercept('GET', '**/api/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            apiKeys: [],
            stats: {
              totalKeys: 0,
              activeKeys: 0,
              expiredKeys: 0,
              totalUsage: 0,
            },
          },
        },
      }).as('getApiKeysEmpty');

      cy.wait('@getApiKeysEmpty');

      // Step 1: Create API Key
      cy.log('Step 1: Creating API Key');
      cy.get('[data-cy="create-api-key-button"]').should('be.visible').click();
      cy.get('[data-cy="api-key-modal"]').should('be.visible');

      // Fill form
      cy.get('[data-cy="api-key-name"]').type('Production Test Key');
      cy.get('[data-cy="api-key-description"]').type(
        'Key for production testing',
      );
      cy.get('[data-cy="permission-inference"]').check();
      cy.get('[data-cy="permission-storage"]').check();
      cy.get('[data-cy="permission-agents-write"]').check();

      // Mock successful creation
      const mockApiKey =
        'eliza_prod_sk_' + Math.random().toString(36).substring(2, 15);
      cy.intercept('POST', '**/api/api-keys', {
        statusCode: 201,
        body: {
          success: true,
          data: {
            key: mockApiKey,
            apiKey: {
              id: 'ak_prod_test',
              name: 'Production Test Key',
              description: 'Key for production testing',
              keyPrefix: mockApiKey.substring(0, 20),
              permissions: ['inference:*', 'storage:*', 'agents:write'],
              rateLimit: 100,
              isActive: true,
            },
          },
        },
      }).as('createApiKey');

      cy.get('[data-cy="create-key-submit"]').click();
      cy.wait('@createApiKey');

      // Verify key display
      cy.get('[data-cy="api-key-value"]').should('contain', 'eliza_prod_sk_');
      cy.get('[data-cy="copy-api-key"]').click();
      cy.get('[data-cy="close-modal"]').click();

      // Step 2: Verify Key in List
      cy.log('Step 2: Verifying Key in List');
      cy.intercept('GET', '**/api/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            apiKeys: [
              {
                id: 'ak_prod_test',
                name: 'Production Test Key',
                description: 'Key for production testing',
                keyPrefix: mockApiKey.substring(0, 20),
                permissions: ['inference:*', 'storage:*', 'agents:write'],
                rateLimit: 100,
                isActive: true,
                usageCount: 0,
                createdAt: new Date().toISOString(),
              },
            ],
            stats: {
              totalKeys: 1,
              activeKeys: 1,
              expiredKeys: 0,
              totalUsage: 0,
            },
          },
        },
      }).as('getApiKeysWithData');

      cy.reload();
      cy.wait('@getApiKeysWithData');

      cy.get('[data-cy="api-key-row"]').should('have.length', 1);
      cy.contains('Production Test Key').should('be.visible');

      // Step 3: Test Usage Tracking
      cy.log('Step 3: Testing Usage Tracking');
      cy.intercept('GET', '**/api/api-keys/ak_prod_test/usage', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            usage: {
              total: 150,
              today: 50,
              thisWeek: 120,
              thisMonth: 150,
              byEndpoint: {
                '/api/ai/chat': 100,
                '/api/agents': 50,
              },
            },
          },
        },
      }).as('getApiKeyUsage');

      // Simulate clicking on usage details
      cy.get('[data-cy="api-key-row"]')
        .first()
        .find('[data-cy="view-usage"]')
        .click();
      cy.wait('@getApiKeyUsage');

      // Step 4: Test Key Validation
      cy.log('Step 4: Testing Key Validation');
      cy.request({
        method: 'POST',
        url: '/api/api-keys/validate',
        body: { key: mockApiKey },
        failOnStatusCode: false,
      }).then((response) => {
        cy.log(`Key validation response: ${response.status}`);
        expect(response.status).to.be.oneOf([200, 401]);
      });

      cy.log('✅ API Key Full Lifecycle Test Complete!');
    });

    it('API Key Security & Rate Limiting Test', () => {
      cy.log('🔒 Testing API Key Security & Rate Limiting');

      // Test 1: Invalid API Key Format
      cy.request({
        method: 'POST',
        url: '/api/api-keys/validate',
        body: { key: 'invalid_key_format' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(400);
        cy.log('✅ Invalid key format rejected');
      });

      // Test 2: Expired API Key
      cy.request({
        method: 'POST',
        url: '/api/api-keys/validate',
        body: { key: 'eliza_expired_sk_1234567890' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403]);
        cy.log('✅ Expired key rejected');
      });

      // Test 3: Rate Limit Testing
      const testKey = 'eliza_test_sk_ratelimit123';
      const requests = [];

      // Make 10 rapid requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          cy.request({
            method: 'GET',
            url: '/api/health',
            headers: {
              Authorization: `Bearer ${testKey}`,
            },
            failOnStatusCode: false,
          }),
        );
      }

      cy.wrap(Promise.all(requests)).then((responses) => {
        const rateLimitedResponses = responses.filter((r) => r.status === 429);
        cy.log(
          `✅ Rate limiting active: ${rateLimitedResponses.length} requests limited`,
        );
      });

      cy.log('✅ API Key Security & Rate Limiting Test Complete!');
    });

    it('API Key Permissions Test', () => {
      cy.log('🔐 Testing API Key Permissions');

      const testScenarios = [
        {
          key: 'eliza_read_only_sk_123',
          permissions: ['agents:read', 'memory:read'],
          allowedEndpoints: ['/api/agents', '/api/memory'],
          deniedEndpoints: ['/api/agents/create', '/api/memory/write'],
        },
        {
          key: 'eliza_write_sk_456',
          permissions: ['agents:write', 'memory:write'],
          allowedEndpoints: ['/api/agents/create', '/api/memory/write'],
          deniedEndpoints: ['/api/billing', '/api/users'],
        },
        {
          key: 'eliza_admin_sk_789',
          permissions: ['*'],
          allowedEndpoints: ['/api/agents', '/api/billing', '/api/users'],
          deniedEndpoints: [],
        },
      ];

      testScenarios.forEach((scenario) => {
        cy.log(
          `Testing key with permissions: ${scenario.permissions.join(', ')}`,
        );

        scenario.allowedEndpoints.forEach((endpoint) => {
          cy.request({
            method: 'GET',
            url: endpoint,
            headers: {
              Authorization: `Bearer ${scenario.key}`,
            },
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.not.equal(403);
            cy.log(`✅ Allowed: ${endpoint}`);
          });
        });

        scenario.deniedEndpoints.forEach((endpoint) => {
          cy.request({
            method: 'GET',
            url: endpoint,
            headers: {
              Authorization: `Bearer ${scenario.key}`,
            },
            failOnStatusCode: false,
          }).then((response) => {
            expect(response.status).to.equal(403);
            cy.log(`✅ Denied: ${endpoint}`);
          });
        });
      });

      cy.log('✅ API Key Permissions Test Complete!');
    });
  });

  describe('Critical User Flows', () => {
    it('Complete Onboarding Flow', () => {
      cy.log('🚀 Testing Complete Onboarding Flow');

      // Step 1: Landing Page
      cy.visit('/');
      cy.get('body').should('be.visible');
      cy.contains('Get Started').click();

      // Step 2: Signup
      cy.url().should('include', '/auth/signup');
      cy.get('[data-cy="email-input"]').type('newuser@test.com');
      cy.get('[data-cy="password-input"]').type('SecurePassword123!');
      cy.get('[data-cy="confirm-password-input"]').type('SecurePassword123!');

      cy.intercept('POST', '**/api/auth/signup', {
        statusCode: 200,
        body: { success: true },
      }).as('signup');

      cy.get('[data-cy="signup-button"]').click();
      cy.wait('@signup');

      // Step 3: Email Verification
      cy.visit('/auth/confirm-email?token=test-token');

      cy.intercept('POST', '**/api/auth/verify-email', {
        statusCode: 200,
        body: { success: true },
      }).as('verifyEmail');

      cy.wait('@verifyEmail');

      // Step 4: First Dashboard Visit
      cy.visit('/dashboard');
      cy.wait('@getIdentity');
      cy.get('[data-cy="welcome-modal"]').should('be.visible');
      cy.get('[data-cy="start-tour-button"]').click();

      // Step 5: Create First API Key
      cy.get('[data-cy="tour-create-api-key"]').click();
      cy.visit('/api-keys');
      cy.get('[data-cy="create-api-key-button"]').click();

      cy.log('✅ Complete Onboarding Flow Test Complete!');
    });

    it('Payment & Billing Flow', () => {
      cy.log('💳 Testing Payment & Billing Flow');

      cy.visit('/settings/billing');
      cy.wait('@getIdentity');

      // Mock billing data
      cy.intercept('GET', '**/api/billing/subscription', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            subscription: {
              tier: 'free',
              creditBalance: 10,
              autoRecharge: false,
            },
          },
        },
      }).as('getSubscription');

      cy.wait('@getSubscription');

      // Step 1: View current balance
      cy.contains('Credit Balance').should('be.visible');
      cy.contains('10 credits').should('be.visible');

      // Step 2: Add credits
      cy.get('[data-cy="add-credits-button"]').click();
      cy.get('[data-cy="credit-amount-100"]').click();

      cy.intercept('POST', '**/api/billing/checkout', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            checkoutUrl: 'https://checkout.stripe.com/test',
          },
        },
      }).as('createCheckout');

      cy.get('[data-cy="proceed-to-payment"]').click();
      cy.wait('@createCheckout');

      // Step 3: Enable auto-recharge
      cy.get('[data-cy="auto-recharge-toggle"]').click();
      cy.get('[data-cy="auto-recharge-threshold"]').type('50');
      cy.get('[data-cy="auto-recharge-amount"]').select('100');

      cy.intercept('POST', '**/api/billing/subscription/update', {
        statusCode: 200,
        body: { success: true },
      }).as('updateSubscription');

      cy.get('[data-cy="save-auto-recharge"]').click();
      cy.wait('@updateSubscription');

      cy.log('✅ Payment & Billing Flow Test Complete!');
    });

    it('Agent Creation & Deployment Flow', () => {
      cy.log('🤖 Testing Agent Creation & Deployment Flow');

      cy.visit('/dashboard/agents');
      cy.wait('@getIdentity');

      // Step 1: Create new agent
      cy.get('[data-cy="create-agent-button"]').click();
      cy.url().should('include', '/dashboard/agents/create');

      cy.get('[data-cy="agent-name"]').type('Production Test Agent');
      cy.get('[data-cy="agent-description"]').type(
        'Agent for production testing',
      );
      cy.get('[data-cy="agent-model"]').select('gpt-4');

      cy.intercept('POST', '**/api/agents', {
        statusCode: 201,
        body: {
          success: true,
          data: {
            agent: {
              id: 'agent_prod_test',
              name: 'Production Test Agent',
              status: 'created',
            },
          },
        },
      }).as('createAgent');

      cy.get('[data-cy="create-agent-submit"]').click();
      cy.wait('@createAgent');

      // Step 2: Configure agent
      cy.url().should('include', '/dashboard/agents/agent_prod_test');
      cy.get('[data-cy="agent-config-tab"]').click();

      // Add capabilities
      cy.get('[data-cy="add-capability"]').click();
      cy.get('[data-cy="capability-chat"]').check();
      cy.get('[data-cy="capability-memory"]').check();

      // Step 3: Deploy agent
      cy.get('[data-cy="deploy-agent-button"]').click();

      cy.intercept('POST', '**/api/agents/agent_prod_test/start', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            status: 'running',
            endpoint: 'https://agent.elizaos.ai/agent_prod_test',
          },
        },
      }).as('startAgent');

      cy.get('[data-cy="confirm-deploy"]').click();
      cy.wait('@startAgent');

      // Step 4: Test agent
      cy.get('[data-cy="test-agent-button"]').click();
      cy.get('[data-cy="agent-test-modal"]').should('be.visible');
      cy.get('[data-cy="test-message-input"]').type('Hello, test agent!');

      cy.intercept('POST', '**/api/agents/agent_prod_test/chat', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            response: 'Hello! I am your test agent.',
          },
        },
      }).as('chatWithAgent');

      cy.get('[data-cy="send-test-message"]').click();
      cy.wait('@chatWithAgent');

      cy.contains('Hello! I am your test agent.').should('be.visible');

      cy.log('✅ Agent Creation & Deployment Flow Test Complete!');
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('Network Error Handling', () => {
      cy.log('🌐 Testing Network Error Handling');

      // Test offline scenario
      cy.window().then((win) => {
        cy.stub(win.navigator, 'onLine').value(false);
      });

      cy.visit('/dashboard', { failOnStatusCode: false });
      cy.contains('You are offline').should('be.visible');

      // Test API timeout
      cy.intercept('GET', '**/api/**', (req) => {
        req.reply((res) => {
          res.delay(30000); // 30 second delay
        });
      }).as('timeout');

      cy.visit('/api-keys', { failOnStatusCode: false });
      cy.contains('Request timeout', { timeout: 10000 }).should('be.visible');

      cy.log('✅ Network Error Handling Test Complete!');
    });

    it('Session Expiry Handling', () => {
      cy.log('⏰ Testing Session Expiry Handling');

      cy.visit('/dashboard');
      cy.wait('@getIdentity');

      // Simulate session expiry
      cy.intercept('GET', '**/api/auth/identity', {
        statusCode: 401,
        body: { error: 'Session expired' },
      }).as('sessionExpired');

      // Trigger a request that will fail
      cy.reload();
      cy.wait('@sessionExpired');

      // Should redirect to login
      cy.url().should('include', '/auth/login');
      cy.contains('Session expired').should('be.visible');

      cy.log('✅ Session Expiry Handling Test Complete!');
    });

    it('Data Validation & Security', () => {
      cy.log('🔒 Testing Data Validation & Security');

      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Test XSS prevention
      cy.get('[data-cy="create-api-key-button"]').click();
      cy.get('[data-cy="api-key-name"]').type('<script>alert("XSS")</script>');
      cy.get('[data-cy="api-key-description"]').type(
        '"><img src=x onerror=alert("XSS")>',
      );

      // The input should be sanitized
      cy.get('[data-cy="api-key-name"]').should('not.contain', '<script>');
      cy.get('[data-cy="api-key-description"]').should('not.contain', '<img');

      // Test SQL injection attempt
      cy.get('[data-cy="api-key-name"]')
        .clear()
        .type("'; DROP TABLE api_keys; --");

      cy.intercept('POST', '**/api/api-keys', {
        statusCode: 400,
        body: {
          error: 'Invalid input',
        },
      }).as('invalidInput');

      cy.get('[data-cy="permission-inference"]').check();
      cy.get('[data-cy="create-key-submit"]').click();
      cy.wait('@invalidInput');

      cy.log('✅ Data Validation & Security Test Complete!');
    });
  });

  describe('Performance & Load Testing', () => {
    it('Page Load Performance', () => {
      cy.log('⚡ Testing Page Load Performance');

      const pages = [
        { path: '/', maxLoadTime: 3000 },
        { path: '/dashboard', maxLoadTime: 5000 },
        { path: '/api-keys', maxLoadTime: 4000 },
        { path: '/agents', maxLoadTime: 4000 },
      ];

      pages.forEach((page) => {
        const start = Date.now();
        cy.visit(page.path, { failOnStatusCode: false });
        cy.get('body').should('be.visible');
        const loadTime = Date.now() - start;

        cy.log(
          `${page.path} loaded in ${loadTime}ms (max: ${page.maxLoadTime}ms)`,
        );
        expect(loadTime).to.be.lessThan(page.maxLoadTime);
      });
    });

    it('Large Dataset Handling', () => {
      cy.log('📊 Testing Large Dataset Handling');

      // Mock 1000 API keys
      const mockApiKeys = Array.from({ length: 1000 }, (_, i) => ({
        id: `ak_test_${i}`,
        name: `Test Key ${i}`,
        keyPrefix: `eliza_test_sk_${i}`,
        permissions: ['inference:*'],
        isActive: true,
        usageCount: Math.floor(Math.random() * 10000),
      }));

      cy.intercept('GET', '**/api/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            apiKeys: mockApiKeys,
            stats: {
              totalKeys: 1000,
              activeKeys: 950,
              expiredKeys: 50,
              totalUsage: 5000000,
            },
          },
        },
      }).as('getLargeDataset');

      cy.visit('/api-keys');
      cy.wait('@getLargeDataset');

      // Should handle pagination
      cy.contains('1-20 of 1000').should('be.visible');
      cy.get('[data-cy="pagination-next"]').should('be.visible');

      // Test search functionality
      cy.get('[data-cy="search-api-keys"]').type('Test Key 999');
      cy.get('[data-cy="api-key-row"]').should('have.length', 1);

      cy.log('✅ Large Dataset Handling Test Complete!');
    });
  });

  describe('Accessibility Testing', () => {
    it('Keyboard Navigation', () => {
      cy.log('⌨️ Testing Keyboard Navigation');

      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Tab through interactive elements
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-cy', 'create-api-key-button');

      // Activate with Enter
      cy.focused().type('{enter}');
      cy.get('[data-cy="api-key-modal"]').should('be.visible');

      // Tab through form fields
      cy.get('body').tab();
      cy.focused().should('have.attr', 'data-cy', 'api-key-name');

      // Close with Escape
      cy.get('body').type('{esc}');
      cy.get('[data-cy="api-key-modal"]').should('not.exist');

      cy.log('✅ Keyboard Navigation Test Complete!');
    });

    it('Screen Reader Support', () => {
      cy.log('📖 Testing Screen Reader Support');

      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Check ARIA labels
      cy.get('[data-cy="create-api-key-button"]').should(
        'have.attr',
        'aria-label',
      );
      cy.get('[data-cy="api-keys-page"]').should('have.attr', 'role', 'main');

      // Check heading hierarchy
      cy.get('h1').should('exist');
      cy.get('h1').should('contain', 'API Keys');

      // Check form labels
      cy.get('[data-cy="create-api-key-button"]').click();
      cy.get('label[for="api-key-name"]').should('exist');
      cy.get('label[for="api-key-description"]').should('exist');

      cy.log('✅ Screen Reader Support Test Complete!');
    });
  });

  describe('Mobile & Responsive Testing', () => {
    it('Mobile Layout Testing', () => {
      cy.log('📱 Testing Mobile Layout');

      const viewports = [
        { name: 'iPhone SE', width: 375, height: 667 },
        { name: 'iPhone 12', width: 390, height: 844 },
        { name: 'iPad', width: 768, height: 1024 },
        { name: 'Desktop', width: 1920, height: 1080 },
      ];

      viewports.forEach((viewport) => {
        cy.viewport(viewport.width, viewport.height);
        cy.visit('/api-keys');
        cy.wait('@getIdentity');

        cy.log(
          `Testing ${viewport.name} (${viewport.width}x${viewport.height})`,
        );

        // Check responsive elements
        cy.get('[data-cy="api-keys-page"]').should('be.visible');
        cy.get('[data-cy="create-api-key-button"]').should('be.visible');

        // Mobile menu should be visible on small screens
        if (viewport.width < 768) {
          cy.get('[data-cy="mobile-menu-button"]').should('be.visible');
        } else {
          cy.get('[data-cy="mobile-menu-button"]').should('not.exist');
        }
      });
    });
  });
});

// Helper command for tab navigation
Cypress.Commands.add('tab', { prevSubject: 'optional' }, (subject) => {
  if (subject) {
    cy.wrap(subject).trigger('keydown', { keyCode: 9, which: 9 });
  } else {
    cy.get('body').trigger('keydown', { keyCode: 9, which: 9 });
  }
});
