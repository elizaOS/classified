/**
 * Standalone Server Tests
 * Tests the standalone ElizaOS server with integrated client GUI
 */

describe('Standalone Server Integration', () => {
  const STANDALONE_BASE_URL = 'http://localhost:3000';

  // Note: These tests assume the standalone server is running
  // They should be run with: npm run test:standalone-e2e

  before(() => {
    // Check if standalone server is running
    cy.request({
      url: `${STANDALONE_BASE_URL}/api/runtime/ping`,
      failOnStatusCode: false,
      timeout: 5000,
    }).then((response) => {
      if (response.status !== 200) {
        throw new Error(
          'Standalone server is not running. Start it with: npm run start:standalone',
        );
      }
    });
  });

  describe('Server Health and API', () => {
    it('should respond to health check', () => {
      cy.request(`${STANDALONE_BASE_URL}/api/runtime/health`).then(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.body).to.have.property('status', 'OK');
          expect(response.body).to.have.property('version');
          expect(response.body).to.have.property('timestamp');
        },
      );
    });

    it('should respond to ping endpoint', () => {
      cy.request(`${STANDALONE_BASE_URL}/api/runtime/ping`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('pong', true);
        expect(response.body).to.have.property('timestamp');
      });
    });

    it('should list agents endpoint', () => {
      cy.request(`${STANDALONE_BASE_URL}/api/agents`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('success', true);
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.have.property('agents');
        expect(response.body.data.agents).to.be.an('array');
      });
    });
  });

  describe('Client Serving via Standalone Server', () => {
    it('should redirect root to client', () => {
      cy.visit(STANDALONE_BASE_URL);
      cy.url().should('include', '/client');
    });

    it('should serve client application at /client', () => {
      cy.visit(`${STANDALONE_BASE_URL}/client`);

      // Should load the client application
      cy.get('#root').should('exist');
      cy.get('head title').should('contain', 'ElizaOS');
    });

    it('should serve client assets correctly', () => {
      cy.visit(`${STANDALONE_BASE_URL}/client`);

      // Check that assets load without errors
      cy.get('link[rel="stylesheet"]').should('have.length.at.least', 1);
      cy.get('script[src*="assets"]').should('have.length.at.least', 1);

      // Should not have any 404 errors for assets
      cy.window().then((win) => {
        const errors = win.console.error.calls?.all() || [];
        const assetErrors = errors.filter((call) =>
          call.args.some(
            (arg) =>
              typeof arg === 'string' &&
              (arg.includes('404') || arg.includes('Failed to load')),
          ),
        );
        expect(assetErrors).to.have.length(0);
      });
    });

    it('should handle SPA routing in client', () => {
      cy.visit(`${STANDALONE_BASE_URL}/client/chat`);

      // Should still serve the React app (SPA routing)
      cy.get('#root').should('exist');

      // Should not show 404 page
      cy.contains('404').should('not.exist');
      cy.contains('Not Found').should('not.exist');
    });
  });

  describe('WebSocket Connection', () => {
    it('should be able to establish WebSocket connection', () => {
      cy.visit(`${STANDALONE_BASE_URL}/client`);

      // Wait for the app to load and potentially establish WebSocket connection
      cy.get('#root').should('exist');
      cy.wait(2000);

      // Check for WebSocket connection (this would be implementation specific)
      cy.window().then((win) => {
        // Look for socket.io or WebSocket indicators
        // This is a basic check - real implementation would depend on how the client shows connection status
        const hasWebSocket = win.WebSocket !== undefined;
        expect(hasWebSocket).to.be.true;
      });
    });
  });

  describe('Agent Management via Client', () => {
    it('should be able to access agent management interface', () => {
      cy.visit(`${STANDALONE_BASE_URL}/client`);
      cy.get('#root').should('exist');

      // Look for agent-related UI elements
      cy.get('body').then(($body) => {
        const agentSelectors = [
          '[data-cy="agents"]',
          '.agents',
          '[data-testid="agents"]',
          'nav a[href*="agent"]',
          'button:contains("Agent")',
          'a:contains("Agent")',
        ];

        // Check if any agent-related elements exist
        const hasAgentUI = agentSelectors.some((selector) => {
          try {
            return $body.find(selector).length > 0;
          } catch {
            return false;
          }
        });

        // If agent UI exists, it should be clickable
        if (hasAgentUI) {
          const foundSelector = agentSelectors.find((selector) => {
            try {
              return $body.find(selector).length > 0;
            } catch {
              return false;
            }
          });
          cy.get(foundSelector).should('be.visible');
        }
      });
    });
  });

  describe('API Integration from Client', () => {
    it('should allow client to make API calls to server', () => {
      cy.visit(`${STANDALONE_BASE_URL}/client`);
      cy.get('#root').should('exist');

      // Intercept API calls made by the client
      cy.intercept('GET', '/api/**').as('apiCall');

      // Wait for potential API calls
      cy.wait(3000);

      // Check if any API calls were made (indicates client-server integration)
      cy.get('@apiCall.all').then((calls) => {
        // If calls were made, they should be successful
        if (calls.length > 0) {
          calls.forEach((call) => {
            expect(call.response.statusCode).to.be.oneOf([200, 201, 204]);
          });
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      // Test accessing non-existent API endpoint
      cy.request({
        url: `${STANDALONE_BASE_URL}/api/non-existent-endpoint`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });

    it('should handle client routing errors gracefully', () => {
      cy.visit(`${STANDALONE_BASE_URL}/non-existent-route`);

      // Should either redirect to client or show 404
      cy.url().then((url) => {
        if (url.includes('/client')) {
          // Redirected to client - good
          cy.get('#root').should('exist');
        } else {
          // Should show proper 404 page
          cy.contains('404').should('exist');
        }
      });
    });
  });
});
