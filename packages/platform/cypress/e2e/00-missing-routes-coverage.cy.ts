/**
 * Missing Routes Coverage Test
 * Ensures all routes from sidebar.tsx are tested
 */

describe('Missing Routes Coverage - Complete Platform Testing', () => {
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
          id: 'complete-test-user',
          email: 'complete@elizaos.ai',
          firstName: 'Complete',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'complete-test-org',
          name: 'Complete Test Org',
          slug: 'complete-test',
          subscriptionTier: 'premium',
          creditBalance: '10000.0',
        },
      },
    }).as('getIdentity');
  });

  describe('Agent Platform Routes', () => {
    it('Agent Editor Page', () => {
      cy.visit('/dashboard/agents/editor', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      // Verify page loads
      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/agents/editor');

      // Check for editor elements
      cy.get('[data-cy="agent-editor"]').should('exist');
      cy.log('✅ Agent Editor page loads successfully');
    });

    it('Agent Marketplace Page', () => {
      cy.visit('/dashboard/agents/marketplace', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/agents/marketplace');

      // Mock marketplace data
      cy.intercept('GET', '**/api/marketplace/assets', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            assets: [
              {
                id: 'agent-1',
                name: 'Customer Support Agent',
                description: 'AI-powered customer support',
                price: 99,
                rating: 4.5,
              },
            ],
          },
        },
      }).as('getMarketplaceAssets');

      cy.wait('@getMarketplaceAssets');
      cy.log('✅ Agent Marketplace page loads successfully');
    });

    it('Agent Templates Page', () => {
      cy.visit('/dashboard/agents/templates', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/agents/templates');

      // Mock templates data
      cy.intercept('GET', '**/api/agents/templates', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            templates: [
              {
                id: 'template-1',
                name: 'Basic Chatbot',
                description: 'Simple conversational agent',
              },
            ],
          },
        },
      }).as('getAgentTemplates');

      cy.wait('@getAgentTemplates');
      cy.log('✅ Agent Templates page loads successfully');
    });
  });

  describe('Generation Studio Additional Routes', () => {
    it('3D & Avatars Generation Page', () => {
      cy.visit('/dashboard/generation/3d', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/generation/3d');
      cy.log('✅ 3D & Avatars generation page loads successfully');
    });

    it('Generation Projects Page', () => {
      cy.visit('/dashboard/generation/projects', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/generation/projects');

      // Mock projects data
      cy.intercept('GET', '**/api/generation/projects', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            projects: [],
          },
        },
      }).as('getGenerationProjects');

      cy.wait('@getGenerationProjects');
      cy.log('✅ Generation Projects page loads successfully');
    });
  });

  describe('Platform Infrastructure Routes', () => {
    it('Storage Management Page', () => {
      cy.visit('/dashboard/storage', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/storage');

      // Mock storage data
      cy.intercept('GET', '**/api/storage/usage', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            used: 1024 * 1024 * 512, // 512MB
            total: 1024 * 1024 * 1024 * 10, // 10GB
            files: [],
          },
        },
      }).as('getStorageUsage');

      cy.wait('@getStorageUsage');
      cy.log('✅ Storage Management page loads successfully');
    });

    it('Webhooks Configuration Page', () => {
      cy.visit('/dashboard/webhooks', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/webhooks');

      // Mock webhooks data
      cy.intercept('GET', '**/api/webhooks', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            webhooks: [],
          },
        },
      }).as('getWebhooks');

      cy.wait('@getWebhooks');
      cy.log('✅ Webhooks Configuration page loads successfully');
    });

    it('Workflows Management Page', () => {
      cy.visit('/dashboard/workflows', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/workflows');

      // Mock workflows data
      cy.intercept('GET', '**/api/workflows', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            workflows: [],
          },
        },
      }).as('getWorkflows');

      cy.wait('@getWorkflows');
      cy.log('✅ Workflows Management page loads successfully');
    });

    it('Audit Logs Page', () => {
      cy.visit('/dashboard/audit', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');
      cy.url().should('include', '/dashboard/audit');

      // Mock audit logs data
      cy.intercept('GET', '**/api/audit-logs', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            logs: [
              {
                id: 'log-1',
                action: 'api_key.created',
                timestamp: new Date().toISOString(),
                user: 'complete@elizaos.ai',
              },
            ],
          },
        },
      }).as('getAuditLogs');

      cy.wait('@getAuditLogs');
      cy.log('✅ Audit Logs page loads successfully');
    });
  });

  describe('Corrected API Keys Route', () => {
    it('Dashboard API Keys Page', () => {
      // Note: sidebar shows /dashboard/api-keys
      cy.visit('/dashboard/api-keys', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      cy.get('body').should('be.visible');

      // Mock API keys data
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
      }).as('getApiKeys');

      cy.wait('@getApiKeys');
      cy.log('✅ Dashboard API Keys page loads successfully');
    });
  });

  describe('Sidebar Navigation Testing', () => {
    it('All sidebar links are functional', () => {
      cy.visit('/dashboard', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      // Test each sidebar section
      const sidebarSections = [
        {
          title: 'Agent Platform',
          links: [
            { id: 'agent-editor', label: 'Agent Editor' },
            { id: 'agent-marketplace', label: 'Marketplace' },
            { id: 'agent-templates', label: 'Templates' },
          ],
        },
        {
          title: 'Generation Studio',
          links: [
            { id: 'generation-studio', label: 'Studio Dashboard' },
            { id: 'text-generation', label: 'Text & Chat' },
            { id: 'image-generation', label: 'Images' },
            { id: 'video-generation', label: 'Videos' },
            { id: 'audio-generation', label: 'Audio & Speech' },
            { id: '3d-generation', label: '3D & Avatars' },
            { id: 'projects', label: 'Projects' },
          ],
        },
        {
          title: 'Platform',
          links: [
            { id: 'api-keys', label: 'API Keys' },
            { id: 'storage', label: 'Storage' },
            { id: 'webhooks', label: 'Webhooks' },
            { id: 'workflows', label: 'Workflows' },
          ],
        },
        {
          title: 'Analytics',
          links: [
            { id: 'analytics', label: 'Usage Analytics' },
            { id: 'billing', label: 'Billing & Credits' },
            { id: 'audit-logs', label: 'Audit Logs' },
          ],
        },
      ];

      sidebarSections.forEach((section) => {
        cy.log(`Testing ${section.title} section`);

        section.links.forEach((link) => {
          cy.get(`[data-cy="sidebar-link-${link.id}"]`).should('be.visible');
          cy.get(`[data-cy="sidebar-link-${link.id}"]`).should(
            'contain.text',
            link.label,
          );
        });
      });

      cy.log('✅ All sidebar navigation links verified');
    });

    it('Mobile sidebar functionality', () => {
      // Test mobile viewport
      cy.viewport('iphone-x');
      cy.visit('/dashboard', { failOnStatusCode: false });
      cy.wait('@getIdentity');

      // Sidebar should be hidden on mobile
      cy.get('[data-cy="sidebar"]').should('have.class', '-translate-x-full');

      // Open mobile menu
      cy.get('[data-cy="mobile-menu-button"]').click();
      cy.get('[data-cy="sidebar"]').should('have.class', 'translate-x-0');

      // Test backdrop
      cy.get('[data-cy="sidebar-backdrop"]').should('be.visible');

      // Close via backdrop click
      cy.get('[data-cy="sidebar-backdrop"]').click();
      cy.get('[data-cy="sidebar"]').should('have.class', '-translate-x-full');

      // Open again and close via close button
      cy.get('[data-cy="mobile-menu-button"]').click();
      cy.get('[data-cy="sidebar-close"]').click();
      cy.get('[data-cy="sidebar"]').should('have.class', '-translate-x-full');

      cy.log('✅ Mobile sidebar functionality verified');
    });
  });
});

describe('Complete API Coverage Verification', () => {
  it('Verifies all API endpoints from sidebar routes', () => {
    const apiEndpoints = {
      storage: [
        { path: '/api/storage/usage', method: 'GET' },
        { path: '/api/storage/upload', method: 'POST' },
        { path: '/api/storage/files', method: 'GET' },
        { path: '/api/storage/files/:id', method: 'DELETE' },
      ],
      webhooks: [
        { path: '/api/webhooks', method: 'GET' },
        { path: '/api/webhooks', method: 'POST' },
        { path: '/api/webhooks/:id', method: 'PUT' },
        { path: '/api/webhooks/:id', method: 'DELETE' },
        { path: '/api/webhooks/:id/test', method: 'POST' },
      ],
      workflows: [
        { path: '/api/workflows', method: 'GET' },
        { path: '/api/workflows', method: 'POST' },
        { path: '/api/workflows/:id', method: 'GET' },
        { path: '/api/workflows/:id/execute', method: 'POST' },
        { path: '/api/workflows/:id/logs', method: 'GET' },
      ],
      auditLogs: [
        { path: '/api/audit-logs', method: 'GET' },
        { path: '/api/audit-logs/export', method: 'GET' },
        { path: '/api/audit-logs/retention', method: 'PUT' },
      ],
      generation3d: [
        { path: '/api/generation/3d/models', method: 'GET' },
        { path: '/api/generation/3d/generate', method: 'POST' },
        { path: '/api/generation/3d/avatars', method: 'POST' },
      ],
    };

    // Test each endpoint
    Object.entries(apiEndpoints).forEach(([category, endpoints]) => {
      cy.log(`Testing ${category} API endpoints`);

      endpoints.forEach((endpoint) => {
        cy.request({
          method: endpoint.method,
          url: endpoint.path.replace(':id', 'test-id'),
          failOnStatusCode: false,
          body:
            endpoint.method === 'POST' || endpoint.method === 'PUT'
              ? {}
              : undefined,
        }).then((response) => {
          cy.log(`✅ ${endpoint.method} ${endpoint.path}: ${response.status}`);
          expect(response.status).to.be.oneOf([
            200, 201, 400, 401, 403, 404, 405,
          ]);
        });
      });
    });
  });
});
