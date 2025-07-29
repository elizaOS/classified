/**
 * Client Integration Tests
 * Tests the integration between the platform and the built client application
 */

describe('Client Integration', () => {
  const CLIENT_BASE_URL = '/client-static';
  const DEV_LOGIN_URL = '/auth/login';

  beforeEach(() => {
    // Clear any existing auth state
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Client Static Serving', () => {
    it('should serve the client index.html at /client-static', () => {
      cy.visit(CLIENT_BASE_URL);

      // Should load the client application
      cy.get('html').should('exist');
      cy.get('head title').should('contain', 'ElizaOS');

      // Should have React app root
      cy.get('#root').should('exist');
    });

    it('should serve client assets properly', () => {
      cy.visit(CLIENT_BASE_URL);

      // Check that CSS files load
      cy.get('link[rel="stylesheet"]').should('have.length.at.least', 1);

      // Check that JS files load
      cy.get('script[src*="assets"]').should('have.length.at.least', 1);
    });

    it('should handle SPA routing correctly', () => {
      // Visit a route that would normally be handled by React Router
      cy.visit(`${CLIENT_BASE_URL}/chat`);

      // Should still serve index.html (SPA routing fallback)
      cy.get('#root').should('exist');

      // Should not show 404 error
      cy.contains('404').should('not.exist');
    });

    it('should serve static assets with correct MIME types', () => {
      cy.request(`${CLIENT_BASE_URL}/favicon.ico`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-type']).to.include('image');
      });
    });
  });

  describe('Platform to Client Integration', () => {
    it('should redirect from platform login to client after dev login', () => {
      // Visit platform login page
      cy.visit(DEV_LOGIN_URL);

      // Should see dev login button
      cy.get('[data-cy="dev-login-button"]').should('be.visible');
      cy.get('[data-cy="dev-login-button"]').should(
        'contain',
        'Developer Login',
      );

      // Click dev login
      cy.get('[data-cy="dev-login-button"]').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');

      // Should be authenticated
      cy.getCookie('session-token').should('exist');
    });

    it('should be able to navigate to client from platform dashboard', () => {
      // Login first
      cy.visit(DEV_LOGIN_URL);
      cy.get('[data-cy="dev-login-button"]').click();
      cy.url().should('include', '/dashboard');

      // Navigate to client (if there's a link, otherwise visit directly)
      cy.visit(CLIENT_BASE_URL);

      // Should load client successfully
      cy.get('#root').should('exist');
    });
  });

  describe('Client Application Functionality', () => {
    beforeEach(() => {
      // Setup authenticated state by doing dev login
      cy.visit(DEV_LOGIN_URL);
      cy.get('[data-cy="dev-login-button"]').click();
      cy.url().should('include', '/dashboard');

      // Now visit the client
      cy.visit(CLIENT_BASE_URL);
    });

    it('should load the client application successfully', () => {
      // Should render the React application
      cy.get('#root').should('exist');

      // Should not show any critical errors
      cy.get('[data-cy="error-boundary"]').should('not.exist');
      cy.contains('Something went wrong').should('not.exist');
    });

    it('should handle client-side routing', () => {
      // Wait for React app to load
      cy.get('#root').should('exist');

      // Try to navigate within the client app (if navigation exists)
      cy.get('body').then(($body) => {
        // Look for common navigation elements
        const navSelectors = [
          'nav',
          '[data-cy="nav"]',
          '.navigation',
          '.sidebar',
        ];

        for (const selector of navSelectors) {
          if ($body.find(selector).length > 0) {
            cy.get(selector).should('be.visible');
            break;
          }
        }
      });
    });

    it('should be able to connect to API endpoints', () => {
      // Check if the client can make API calls
      // This would typically be tested by checking if data loads in the UI

      cy.get('#root').should('exist');

      // Wait a moment for any initial API calls
      cy.wait(1000);

      // Check for loading states or data
      cy.get('body').then(($body) => {
        // Look for signs that the app is working (not stuck in loading)
        const loadingSelectors = [
          '[data-cy="loading"]',
          '.loading',
          '.spinner',
        ];
        const hasLoading = loadingSelectors.some(
          (selector) => $body.find(selector).length > 0,
        );

        if (hasLoading) {
          // If there are loading indicators, they should eventually disappear
          cy.get('.loading, .spinner, [data-cy="loading"]', {
            timeout: 10000,
          }).should('not.exist');
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing assets gracefully', () => {
      // Try to access a non-existent asset
      cy.request({
        url: `${CLIENT_BASE_URL}/non-existent-file.js`,
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });

    it('should return index.html for unknown routes (SPA fallback)', () => {
      cy.visit(`${CLIENT_BASE_URL}/unknown-route-that-does-not-exist`);

      // Should still serve the React app
      cy.get('#root').should('exist');

      // Should not show server error page
      cy.contains('Internal Server Error').should('not.exist');
    });
  });

  describe('Performance and Caching', () => {
    it('should serve assets with appropriate cache headers', () => {
      // Test that assets have caching headers
      cy.request(`${CLIENT_BASE_URL}/assets/index-BFnDdxLa.css`).then(
        (response) => {
          expect(response.status).to.eq(200);
          expect(response.headers).to.have.property('cache-control');
          // Assets should have long cache times
          expect(response.headers['cache-control']).to.include('max-age');
        },
      );
    });

    it('should serve index.html without caching', () => {
      cy.request(CLIENT_BASE_URL).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-type']).to.include('text/html');
        // HTML should not be cached
        expect(response.headers['cache-control']).to.include('no-cache');
      });
    });
  });
});
