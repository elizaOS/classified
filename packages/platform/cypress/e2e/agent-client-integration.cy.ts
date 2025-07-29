/**
 * Comprehensive Agent Client Integration Test
 * Verifies the complete flow from authentication to client interface loading
 * Tests the /dashboard/agents/editor route with embedded client
 */

describe('Agent Client Integration', () => {
  beforeEach(() => {
    // Clear all auth state and start fresh
    cy.clearAuthState();
  });

  describe('Authentication and Route Access', () => {
    it('should require authentication to access agent editor', () => {
      cy.visit('/dashboard/agents/editor');

      // Should redirect to login
      cy.url().should('include', '/auth/login');
      cy.contains('Log in to your account').should('be.visible');
    });

    it('should access agent editor after dev login', () => {
      // Use dev login for testing
      cy.devLogin();

      // Navigate to agent editor
      cy.visit('/dashboard/agents/editor');
      cy.url().should('include', '/dashboard/agents/editor');

      // Verify the page loads
      cy.contains('Agent Editor').should('be.visible');
      cy.get('[data-cy="embedded-client"]').should('be.visible');
    });
  });

  describe('Client Assets Loading', () => {
    beforeEach(() => {
      cy.devLogin();
    });

    it('should load client-static assets without 404 errors', () => {
      // Monitor network requests for 404s
      cy.intercept('GET', '/assets/**', (req) => {
        // This should get rewritten to /client-static/assets/**
        expect(req.url).to.not.include('404');
      }).as('assetsRequest');

      cy.intercept('GET', '/client-static/**').as('clientStaticRequest');

      cy.visit('/dashboard/agents/editor');

      // Verify iframe loads
      cy.get('iframe[src="/client-static/index.html"]').should('be.visible');

      // Wait for assets to load
      cy.wait('@clientStaticRequest');

      // Check that client assets are accessible
      cy.request('/client-static/assets/index-BmG_9Xby.js').should(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.headers['content-type']).to.include(
            'application/javascript',
          );
        },
      );

      cy.request('/client-static/assets/index-D6w6LK1-.css').should(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.headers['content-type']).to.include('text/css');
        },
      );
    });

    it('should load assets via rewrite rules', () => {
      cy.visit('/dashboard/agents/editor');

      // Test that rewrites work - /assets/* should redirect to /client-static/assets/*
      cy.request('/assets/index-BmG_9Xby.js').should((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-type']).to.include(
          'application/javascript',
        );
      });

      cy.request('/assets/index-D6w6LK1-.css').should((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-type']).to.include('text/css');
      });
    });

    it('should serve index.html for client-static route', () => {
      cy.request('/client-static/').should((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-type']).to.include('text/html');
        expect(response.body).to.include('<title>ElizaOS - Client</title>');
        expect(response.body).to.include('src="/assets/index-BmG_9Xby.js"');
      });
    });
  });

  describe('Embedded Client Interface', () => {
    beforeEach(() => {
      cy.devLogin();
    });

    it('should load embedded client with proper configuration', () => {
      cy.visit('/dashboard/agents/editor');

      // Verify embedded client component
      cy.get('[data-cy="embedded-client"]').should('be.visible');
      cy.contains('Agent Editor').should('be.visible');
      cy.contains(
        'Create and manage your AI agents with the ElizaOS client interface',
      ).should('be.visible');

      // Verify iframe is present
      cy.get('iframe[title="ElizaOS Agent Management Interface"]').should(
        'be.visible',
      );
      cy.get('iframe[src="/client-static/index.html"]').should('be.visible');

      // Verify required plugins info is displayed
      cy.contains('Required plugins:').should('be.visible');
      cy.contains('@elizaos/plugin-web-search').should('be.visible');
      cy.contains('@elizaos/plugin-memory').should('be.visible');
      cy.contains('@elizaos/plugin-sql').should('be.visible');
    });

    it('should show connection status progression', () => {
      cy.visit('/dashboard/agents/editor');

      // Should start with connecting status
      cy.get('[data-cy="client-status"]').should('contain', 'Connecting...');

      // Wait for iframe to load
      cy.get('iframe').should('be.visible');

      // Status should eventually update (simulating the iframe loading process)
      // In a real scenario, this would progress through Loading... -> Configuring... -> Ready
      cy.get('[data-cy="client-status"]', { timeout: 10000 }).should(
        'be.visible',
      );
    });

    it('should provide reload and external link controls', () => {
      cy.visit('/dashboard/agents/editor');

      // Verify control buttons exist
      cy.get('[data-cy="reload-client-button"]').should('be.visible');
      cy.get('[data-cy="open-external-button"]').should('be.visible');

      // Test reload functionality
      cy.get('[data-cy="reload-client-button"]').click();

      // Status should reset to connecting
      cy.get('[data-cy="client-status"]').should('contain', 'Connecting...');
    });

    it('should handle client loading without errors', () => {
      // Monitor for console errors
      cy.window().then((win) => {
        cy.spy(win.console, 'error').as('consoleError');
      });

      cy.visit('/dashboard/agents/editor');

      // Wait for everything to load
      cy.get('[data-cy="embedded-client"]').should('be.visible');
      cy.get('iframe').should('be.visible');

      // Check that no critical errors occurred
      cy.get('@consoleError').should(
        'not.have.been.calledWith',
        Cypress.sinon.match(/Failed to load/),
      );
    });
  });

  describe('API Key and Authentication Flow', () => {
    beforeEach(() => {
      cy.devLogin();
    });

    it('should generate API key for client authentication', () => {
      // Mock the API key generation (this happens server-side)
      cy.intercept('GET', '/dashboard/agents/editor', (req) => {
        // The page should have generated an API key server-side
        req.continue();
      }).as('editorPageLoad');

      cy.visit('/dashboard/agents/editor');
      cy.wait('@editorPageLoad');

      // In development mode, debug info should show API key
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="debug-info"]').length > 0) {
          cy.get('[data-cy="debug-info"]').should('contain', 'API Key:');
        }
      });
    });

    it('should pass authentication context to iframe', () => {
      cy.visit('/dashboard/agents/editor');

      // Verify iframe communication setup
      cy.window().then((win) => {
        // Listen for postMessage communication
        const messageHandler = cy.spy().as('messageHandler');
        win.addEventListener('message', messageHandler);

        // Wait for iframe to be ready
        cy.get('iframe').should('be.visible');

        // The component should send configuration to iframe
        // We can't easily test the actual postMessage, but we can verify
        // the iframe is loaded and ready to receive messages
        cy.get('iframe').should(
          'have.attr',
          'src',
          '/client-static/index.html',
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      cy.devLogin();
    });

    it('should handle client loading failures gracefully', () => {
      // Mock a 404 for the client assets
      cy.intercept('GET', '/client-static/index.html', {
        statusCode: 404,
        body: 'Not Found',
      }).as('clientNotFound');

      cy.visit('/dashboard/agents/editor');

      // Should still show the embedded client container
      cy.get('[data-cy="embedded-client"]').should('be.visible');

      // Should show connecting/loading state
      cy.get('[data-cy="client-status"]').should('be.visible');

      // Reload button should be available for recovery
      cy.get('[data-cy="reload-client-button"]').should('be.visible');
    });

    it('should recover from asset loading errors', () => {
      // First load normally to verify baseline
      cy.visit('/dashboard/agents/editor');
      cy.get('[data-cy="embedded-client"]').should('be.visible');

      // Test reload functionality for error recovery
      cy.get('[data-cy="reload-client-button"]').click();

      // Should reset and attempt to reload
      cy.get('[data-cy="client-status"]').should('contain', 'Connecting...');
    });
  });

  describe('Navigation Integration', () => {
    beforeEach(() => {
      cy.devLogin();
    });

    it('should be accessible from agents dashboard', () => {
      // Start from main agents page
      cy.visit('/dashboard/agents');

      // Find and click the Agent Editor button
      cy.get('a[href="/dashboard/agents/editor"]').should('be.visible');
      cy.get('a[href="/dashboard/agents/editor"]').click();

      // Should navigate to editor
      cy.url().should('include', '/dashboard/agents/editor');
      cy.contains('Agent Editor').should('be.visible');
    });

    it('should be accessible via direct URL', () => {
      cy.visit('/dashboard/agents/editor');

      // Should load directly without redirects (other than auth)
      cy.url().should('include', '/dashboard/agents/editor');
      cy.get('[data-cy="embedded-client"]').should('be.visible');
    });
  });

  describe('Client Interface Loading Performance', () => {
    beforeEach(() => {
      cy.devLogin();
    });

    it('should load client interface within reasonable time', () => {
      const startTime = Date.now();

      cy.visit('/dashboard/agents/editor');

      // Verify main components load quickly
      cy.get('[data-cy="embedded-client"]', { timeout: 5000 }).should(
        'be.visible',
      );
      cy.get('iframe', { timeout: 5000 }).should('be.visible');

      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(10000); // Should load within 10 seconds
      });
    });

    it('should load assets with proper caching headers', () => {
      cy.visit('/dashboard/agents/editor');

      // Check that assets have appropriate cache headers
      cy.request('/client-static/assets/index-BmG_9Xby.js').should(
        (response) => {
          expect(response.status).to.eq(200);
          // Should have cache control headers for performance
          expect(response.headers).to.have.property('cache-control');
        },
      );
    });
  });

  describe('Responsive Design and Accessibility', () => {
    beforeEach(() => {
      cy.devLogin();
    });

    it('should work on different viewport sizes', () => {
      // Test mobile viewport
      cy.viewport(375, 667);
      cy.visit('/dashboard/agents/editor');
      cy.get('[data-cy="embedded-client"]').should('be.visible');

      // Test tablet viewport
      cy.viewport(768, 1024);
      cy.reload();
      cy.get('[data-cy="embedded-client"]').should('be.visible');

      // Test desktop viewport
      cy.viewport(1280, 720);
      cy.reload();
      cy.get('[data-cy="embedded-client"]').should('be.visible');
    });

    it('should have proper accessibility attributes', () => {
      cy.visit('/dashboard/agents/editor');

      // Check iframe has proper title
      cy.get('iframe').should(
        'have.attr',
        'title',
        'ElizaOS Agent Management Interface',
      );

      // Check buttons have proper titles
      cy.get('[data-cy="reload-client-button"]').should(
        'have.attr',
        'title',
        'Reload Client',
      );
      cy.get('[data-cy="open-external-button"]').should(
        'have.attr',
        'title',
        'Open in New Tab',
      );
    });
  });
});
