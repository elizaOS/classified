describe('Device Authentication Flow', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearAuthState();

    // Mock device authentication API endpoints
    cy.intercept('POST', '/api/auth/device', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          device_code: 'ABCD-EFGH',
          user_code: '1234-5678',
          verification_uri: 'https://device.elizaos.ai/verify',
          expires_in: 600,
          interval: 5,
        },
      },
    }).as('deviceInit');

    cy.intercept('POST', '/api/auth/device/token', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          access_token: 'device_access_token_123',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      },
    }).as('deviceToken');

    cy.intercept('GET', '/api/auth/device/authorize?**', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          authorized: true,
          user: {
            id: 'device-user-123',
            email: 'device@elizaos.ai',
            organizationId: 'device-org-123',
          },
        },
      },
    }).as('deviceAuthorize');
  });

  it('should display device authentication page correctly', () => {
    cy.visit('/auth/device', { failOnStatusCode: false });

    // Check that the device authentication page loads
    cy.contains('Device Authentication').should('be.visible');
    cy.contains('Follow these steps to authenticate').should('be.visible');
  });

  it('should initialize device code flow', () => {
    cy.visit('/auth/device', { failOnStatusCode: false });

    // Should make initial device request
    cy.wait('@deviceInit');

    // Should display the device code
    cy.contains('ABCD-EFGH').should('be.visible');
    cy.contains('1234-5678').should('be.visible');

    // Should show verification URL
    cy.contains('device.elizaos.ai/verify').should('be.visible');
  });

  it('should handle device code input', () => {
    cy.visit('/auth/device', { failOnStatusCode: false });

    cy.wait('@deviceInit');

    // Check if there's a manual entry option
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-code-input"]').length > 0) {
        // Test manual code entry
        cy.get('[data-cy="manual-code-input"]').type('1234-5678');
        cy.get('[data-cy="verify-code-btn"]').click();

        // Should attempt authorization
        cy.wait('@deviceAuthorize');
      }
    });
  });

  it('should poll for authorization completion', () => {
    cy.visit('/auth/device', { failOnStatusCode: false });

    cy.wait('@deviceInit');

    // Device flow should start polling for completion
    // This is typically done automatically in the background

    // Simulate successful authorization after polling
    cy.wait('@deviceToken');

    // Should redirect to dashboard on success
    cy.url({ timeout: 10000 }).should('include', '/dashboard');
  });

  it('should handle device authentication errors', () => {
    // Mock error response
    cy.intercept('POST', '/api/auth/device', {
      statusCode: 400,
      body: {
        success: false,
        error: 'Device authentication failed',
      },
    }).as('deviceError');

    cy.visit('/auth/device', { failOnStatusCode: false });

    cy.wait('@deviceError');

    // Should display error message
    cy.contains('Device authentication failed').should('be.visible');
  });

  it('should handle expired device codes', () => {
    // Mock expired device code
    cy.intercept('POST', '/api/auth/device/token', {
      statusCode: 400,
      body: {
        success: false,
        error: 'expired_token',
        message: 'The device code has expired',
      },
    }).as('expiredToken');

    cy.visit('/auth/device', { failOnStatusCode: false });

    cy.wait('@deviceInit');

    // Simulate polling that results in expired token
    cy.wait('@expiredToken');

    // Should show expiration message and option to restart
    cy.contains('expired').should('be.visible');

    // Should have option to restart the flow
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="restart-device-auth"]').length > 0) {
        cy.get('[data-cy="restart-device-auth"]').should('be.visible');
      }
    });
  });

  it('should be responsive on mobile devices', () => {
    cy.viewport('iphone-x');
    cy.visit('/auth/device', { failOnStatusCode: false });

    cy.wait('@deviceInit');

    // Check that content is properly displayed on mobile
    cy.contains('ABCD-EFGH').should('be.visible');
    cy.get('body').should('not.have.css', 'overflow-x', 'scroll');

    // Device codes should be easily readable
    cy.contains('1234-5678')
      .should('be.visible')
      .and('have.css', 'font-size')
      .and('match', /^(?:[1-9]\d*\.?\d*|\d*\.?\d*[1-9]\d*)px$/); // Should have reasonable font size
  });

  it('should handle copy to clipboard functionality', () => {
    cy.visit('/auth/device', { failOnStatusCode: false });

    cy.wait('@deviceInit');

    // Check for copy buttons if they exist
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="copy-device-code"]').length > 0) {
        cy.get('[data-cy="copy-device-code"]').click();

        // Should show success feedback
        cy.contains('Copied').should('be.visible');
      }

      if ($body.find('[data-cy="copy-user-code"]').length > 0) {
        cy.get('[data-cy="copy-user-code"]').click();

        // Should show success feedback
        cy.contains('Copied').should('be.visible');
      }
    });
  });

  it('should provide clear instructions for users', () => {
    cy.visit('/auth/device', { failOnStatusCode: false });

    cy.wait('@deviceInit');

    // Should have clear step-by-step instructions
    cy.contains('Step 1').should('be.visible');
    cy.contains('Go to').should('be.visible');
    cy.contains('Enter the code').should('be.visible');

    // Instructions should be accessible
    cy.get('body').should('contain', 'device.elizaos.ai');
    cy.get('body').should('contain', '1234-5678');
  });
});
