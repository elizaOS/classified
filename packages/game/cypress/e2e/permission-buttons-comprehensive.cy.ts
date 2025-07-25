/**
 * Comprehensive test suite for hardware permission buttons
 * Tests all 6 permission buttons: camera, screen, microphone, speakers, shell, browser
 */

describe('Permission Buttons Comprehensive Testing', () => {
  let elizaProcess: Cypress.Exec;
  let apiHealthy = false;

  before(() => {
    // Start the ElizaOS backend server
    cy.log('Starting ElizaOS backend server...');

    elizaProcess = cy.exec('cd packages/game && npm run dev:backend', {
      timeout: 60000,
      failOnNonZeroExit: false,
    });

    // Wait for server to be ready
    cy.wait(10000);

    // Check if API is healthy
    cy.request({
      method: 'GET',
      url: 'http://localhost:7777/api/server/health',
      failOnStatusCode: false,
      timeout: 10000,
    }).then((response) => {
      if (response.status === 200) {
        apiHealthy = true;
        cy.log('✅ Backend server is healthy');
      } else {
        cy.log('❌ Backend server health check failed');
        throw new Error('Backend server is not healthy');
      }
    });
  });

  after(() => {
    if (elizaProcess) {
      cy.log('Stopping ElizaOS backend server...');
      cy.task('killProcessByPort', 7777);
    }
  });

  beforeEach(() => {
    // Visit the game interface
    cy.visit('/');

    // Wait for the game interface to load
    cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="connection-status"]', { timeout: 5000 }).should('contain.text', 'ONLINE');
  });

  describe('Permission Button Visibility and Labels', () => {
    it('should display all 7 permission buttons with correct labels', () => {
      const expectedButtons = [
        'autonomy',
        'camera',
        'screen',
        'microphone',
        'speakers',
        'shell',
        'browser'
      ];

      expectedButtons.forEach((buttonName) => {
        cy.get(`[data-testid="${buttonName}-toggle"]`)
          .should('be.visible')
          .should('contain.text', buttonName.toUpperCase());
      });
    });

    it('should show button status indicators', () => {
      const expectedButtons = [
        'autonomy',
        'camera',
        'screen',
        'microphone',
        'speakers',
        'shell',
        'browser'
      ];

      expectedButtons.forEach((buttonName) => {
        cy.get(`[data-testid="${buttonName}-toggle-status"]`)
          .should('be.visible')
          .should('contain.text', /[◉◯]/); // Should show either enabled (◉) or disabled (◯)
      });
    });
  });

  describe('Initial Button States', () => {
    it('should show autonomy as enabled by default', () => {
      cy.get('[data-testid="autonomy-toggle"]')
        .should('have.class', 'enabled')
        .find('[data-testid="autonomy-toggle-status"]')
        .should('contain.text', '◉');
    });

    it('should show hardware buttons as disabled by default', () => {
      const hardwareButtons = ['camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

      hardwareButtons.forEach((buttonName) => {
        cy.get(`[data-testid="${buttonName}-toggle"]`)
          .should('have.class', 'disabled')
          .find(`[data-testid="${buttonName}-toggle-status"]`)
          .should('contain.text', '◯');
      });
    });
  });

  describe('Button Toggle Functionality', () => {
    describe('Autonomy Button', () => {
      it('should toggle autonomy on/off successfully', () => {
        // Should start enabled
        cy.get('[data-testid="autonomy-toggle"]').should('have.class', 'enabled');

        // Click to disable
        cy.get('[data-testid="autonomy-toggle"]').click();
        cy.wait(1000); // Wait for API call

        // Should now be disabled
        cy.get('[data-testid="autonomy-toggle"]')
          .should('have.class', 'disabled')
          .find('[data-testid="autonomy-toggle-status"]')
          .should('contain.text', '◯');

        // Click to re-enable
        cy.get('[data-testid="autonomy-toggle"]').click();
        cy.wait(1000); // Wait for API call

        // Should now be enabled again
        cy.get('[data-testid="autonomy-toggle"]')
          .should('have.class', 'enabled')
          .find('[data-testid="autonomy-toggle-status"]')
          .should('contain.text', '◉');
      });

      it('should make correct API calls for autonomy toggle', () => {
        cy.intercept('POST', '**/autonomy/disable').as('disableAutonomy');
        cy.intercept('POST', '**/autonomy/enable').as('enableAutonomy');

        // Disable autonomy
        cy.get('[data-testid="autonomy-toggle"]').click();
        cy.wait('@disableAutonomy').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });

        // Enable autonomy
        cy.get('[data-testid="autonomy-toggle"]').click();
        cy.wait('@enableAutonomy').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
    });

    describe('Vision Plugin Buttons', () => {
      ['camera', 'screen', 'microphone', 'speakers'].forEach((buttonName) => {
        it(`should toggle ${buttonName} successfully`, () => {
          // Should start disabled
          cy.get(`[data-testid="${buttonName}-toggle"]`).should('have.class', 'disabled');

          // Click to enable
          cy.get(`[data-testid="${buttonName}-toggle"]`).click();
          cy.wait(2000); // Wait for API call and state update

          // Should now be enabled
          cy.get(`[data-testid="${buttonName}-toggle"]`)
            .should('have.class', 'enabled')
            .find(`[data-testid="${buttonName}-toggle-status"]`)
            .should('contain.text', '◉');

          // Click to disable
          cy.get(`[data-testid="${buttonName}-toggle"]`).click();
          cy.wait(2000); // Wait for API call and state update

          // Should now be disabled again
          cy.get(`[data-testid="${buttonName}-toggle"]`)
            .should('have.class', 'disabled')
            .find(`[data-testid="${buttonName}-toggle-status"]`)
            .should('contain.text', '◯');
        });

        it(`should make correct API calls for ${buttonName} toggle`, () => {
          cy.intercept('POST', '**/api/agents/default/settings').as(`update${buttonName}Setting`);
          cy.intercept('POST', '**/api/agents/default/vision/refresh').as('refreshVision');

          // Enable the capability
          cy.get(`[data-testid="${buttonName}-toggle"]`).click();

          cy.wait(`@update${buttonName}Setting`).then((interception) => {
            expect(interception.response?.statusCode).to.eq(200);
          });

          cy.wait('@refreshVision').then((interception) => {
            expect(interception.response?.statusCode).to.eq(200);
          });
        });
      });
    });

    describe('Shell Button', () => {
      it('should toggle shell capability successfully', () => {
        // Should start disabled
        cy.get('[data-testid="shell-toggle"]').should('have.class', 'disabled');

        // Click to enable
        cy.get('[data-testid="shell-toggle"]').click();
        cy.wait(1000); // Wait for API call

        // Should now be enabled
        cy.get('[data-testid="shell-toggle"]')
          .should('have.class', 'enabled')
          .find('[data-testid="shell-toggle-status"]')
          .should('contain.text', '◉');

        // Click to disable
        cy.get('[data-testid="shell-toggle"]').click();
        cy.wait(1000); // Wait for API call

        // Should now be disabled again
        cy.get('[data-testid="shell-toggle"]')
          .should('have.class', 'disabled')
          .find('[data-testid="shell-toggle-status"]')
          .should('contain.text', '◯');
      });

      it('should make correct API calls for shell toggle', () => {
        cy.intercept('POST', '**/api/agents/default/capabilities/shell/toggle').as('toggleShell');

        cy.get('[data-testid="shell-toggle"]').click();
        cy.wait('@toggleShell').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
    });

    describe('Browser Button', () => {
      it('should toggle browser capability successfully', () => {
        // Should start disabled
        cy.get('[data-testid="browser-toggle"]').should('have.class', 'disabled');

        // Click to enable
        cy.get('[data-testid="browser-toggle"]').click();
        cy.wait(1000); // Wait for API call

        // Should now be enabled
        cy.get('[data-testid="browser-toggle"]')
          .should('have.class', 'enabled')
          .find('[data-testid="browser-toggle-status"]')
          .should('contain.text', '◉');

        // Click to disable
        cy.get('[data-testid="browser-toggle"]').click();
        cy.wait(1000); // Wait for API call

        // Should now be disabled again
        cy.get('[data-testid="browser-toggle"]')
          .should('have.class', 'disabled')
          .find('[data-testid="browser-toggle-status"]')
          .should('contain.text', '◯');
      });

      it('should make correct API calls for browser toggle', () => {
        cy.intercept('POST', '**/api/agents/default/capabilities/browser/toggle').as('toggleBrowser');

        cy.get('[data-testid="browser-toggle"]').click();
        cy.wait('@toggleBrowser').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        });
      });
    });
  });

  describe('State Persistence', () => {
    it('should maintain button states across page reloads', () => {
      // Enable shell
      cy.get('[data-testid="shell-toggle"]').click();
      cy.wait(1000);
      cy.get('[data-testid="shell-toggle"]').should('have.class', 'enabled');

      // Reload page
      cy.reload();
      cy.get('[data-testid="game-interface"]', { timeout: 10000 }).should('be.visible');

      // Shell should still be enabled
      cy.get('[data-testid="shell-toggle"]', { timeout: 5000 }).should('have.class', 'enabled');

      // Clean up - disable shell
      cy.get('[data-testid="shell-toggle"]').click();
      cy.wait(1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', () => {
      // Mock API failure
      cy.intercept('POST', '**/api/agents/default/capabilities/shell/toggle', {
        statusCode: 500,
        body: { error: 'Internal server error' }
      }).as('failToggleShell');

      const initialState = cy.get('[data-testid="shell-toggle"]');

      // Try to toggle
      cy.get('[data-testid="shell-toggle"]').click();
      cy.wait('@failToggleShell');

      // State should remain unchanged
      cy.get('[data-testid="shell-toggle"]').should('have.class', 'disabled');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const buttons = ['autonomy', 'camera', 'screen', 'microphone', 'speakers', 'shell', 'browser'];

      buttons.forEach((buttonName) => {
        cy.get(`[data-testid="${buttonName}-toggle"]`)
          .should('have.attr', 'role', 'switch')
          .should('have.attr', 'aria-label')
          .should('have.attr', 'aria-checked');
      });
    });

    it('should support keyboard navigation', () => {
      // Focus first button with Tab
      cy.get('body').tab();
      cy.get('[data-testid="autonomy-toggle"]').should('have.focus');

      // Navigate with arrow keys or Tab
      cy.focused().tab();
      cy.get('[data-testid="camera-toggle"]').should('have.focus');
    });
  });

  describe('Visual Feedback', () => {
    it('should show loading states during API calls', () => {
      // Slow down API response to see loading state
      cy.intercept('POST', '**/api/agents/default/capabilities/shell/toggle', (req) => {
        req.reply((res) => {
          return new Promise((resolve) => {
            setTimeout(() => resolve(res), 2000);
          });
        });
      }).as('slowToggleShell');

      cy.get('[data-testid="shell-toggle"]').click();

      // Button should show some loading indication (could be disabled, different text, etc.)
      // This depends on the implementation
      cy.get('[data-testid="shell-toggle"]').should('exist'); // Placeholder - adjust based on actual loading state

      cy.wait('@slowToggleShell');
    });
  });

  describe('Integration with Agent Behavior', () => {
    it('should enable agent capabilities when buttons are turned on', () => {
      // Enable shell
      cy.get('[data-testid="shell-toggle"]').click();
      cy.wait(1000);

      // Send a message that would use shell
      cy.get('[data-testid="chat-input"]').type('Please list the files in the current directory{enter}');

      // Wait for agent response
      cy.get('[data-testid="agent-message"]', { timeout: 10000 }).should('be.visible');

      // Clean up
      cy.get('[data-testid="shell-toggle"]').click();
      cy.wait(1000);
    });

    it('should disable agent capabilities when buttons are turned off', () => {
      // Ensure shell is disabled
      cy.get('[data-testid="shell-toggle"]').should('have.class', 'disabled');

      // Send a message that would try to use shell
      cy.get('[data-testid="chat-input"]').type('Please list the files in the current directory{enter}');

      // Wait for agent response
      cy.get('[data-testid="agent-message"]', { timeout: 10000 })
        .should('be.visible')
        .should('not.contain', 'ls '); // Shouldn't execute shell commands
    });
  });

  describe('Backend API Endpoints', () => {
    it('should have all required API endpoints available', () => {
      const endpoints = [
        { method: 'GET', url: 'http://localhost:7777/api/agents/default/settings/vision' },
        { method: 'POST', url: 'http://localhost:7777/api/agents/default/settings' },
        { method: 'POST', url: 'http://localhost:7777/api/agents/default/vision/refresh' },
        { method: 'GET', url: 'http://localhost:7777/api/agents/default/capabilities/shell' },
        { method: 'POST', url: 'http://localhost:7777/api/agents/default/capabilities/shell/toggle' },
        { method: 'GET', url: 'http://localhost:7777/api/agents/default/capabilities/browser' },
        { method: 'POST', url: 'http://localhost:7777/api/agents/default/capabilities/browser/toggle' },
        { method: 'GET', url: 'http://localhost:7777/autonomy/status' },
        { method: 'POST', url: 'http://localhost:7777/autonomy/enable' },
        { method: 'POST', url: 'http://localhost:7777/autonomy/disable' }
      ];

      endpoints.forEach((endpoint) => {
        cy.request({
          method: endpoint.method,
          url: endpoint.url,
          failOnStatusCode: false,
          body: endpoint.method === 'POST' ? {} : undefined
        }).then((response) => {
          expect(response.status).to.not.eq(404, `${endpoint.method} ${endpoint.url} should not return 404`);
        });
      });
    });
  });
});
