describe('Tokens Page', () => {
  beforeEach(() => {
    // Mock authentication
    cy.window().then((win) => {
      win.localStorage.setItem('token', 'mock-jwt-token');
    });

    // Mock API responses
    cy.intercept('GET', '**/api/v1/api-keys', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        },
      },
    }).as('getApiKeys');

    cy.intercept('GET', '**/api/v1/auth/me', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@elizaos.ai',
            name: 'Test User',
          },
        },
      },
    }).as('getMe');

    cy.visit('/settings/tokens');
  });

  it('should display the tokens page', () => {
    cy.get('h1').should('contain', 'API Keys');
    cy.get('p').should(
      'contain',
      'Manage your API keys for programmatic access',
    );
    cy.wait('@getApiKeys');
  });

  it('should show empty state when no API keys', () => {
    cy.wait('@getApiKeys');
    cy.get('[data-testid^="api-key-"]').should('not.exist');
    cy.contains('No API keys yet').should('be.visible');
    cy.contains('Create your first API key to get started').should(
      'be.visible',
    );
  });

  describe('Creating API Keys', () => {
    it('should create a new API key', () => {
      // Mock create API key response
      cy.intercept('POST', '**/api/v1/api-keys', {
        statusCode: 201,
        body: {
          success: true,
          data: {
            apiKey: {
              id: 'new-key-id',
              name: 'My Test Key',
              key: 'sk_live_1234567890abcdef',
              createdAt: new Date().toISOString(),
            },
          },
        },
      }).as('createApiKey');

      // Mock updated list with new key
      cy.intercept('GET', '**/api/v1/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            apiKeys: [
              {
                id: 'new-key-id',
                name: 'My Test Key',
                key: 'sk_live_...cdef',
                createdAt: new Date().toISOString(),
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        },
      }).as('getUpdatedApiKeys');

      // Fill in the form
      cy.get('[data-testid="api-key-name-input"]').type('My Test Key');
      cy.get('[data-testid="api-key-expiry-select"]').select('30d');
      cy.get('[data-testid="create-api-key-button"]').click();

      // Wait for creation
      cy.wait('@createApiKey');

      // Check success message
      cy.contains('API key created successfully').should('be.visible');

      // Check new key display
      cy.contains('Your new API key has been created').should('be.visible');
      cy.contains('sk_live_1234567890abcdef').should('be.visible');

      // Click done
      cy.contains('Done').click();

      // Check key appears in list
      cy.wait('@getUpdatedApiKeys');
      cy.get('[data-testid="api-key-new-key-id"]').should('be.visible');
      cy.contains('My Test Key').should('be.visible');
    });

    it('should validate API key name', () => {
      // Try to create without name
      cy.get('[data-testid="create-api-key-button"]').click();
      cy.contains('Please enter a name for the API key').should('be.visible');

      // Button should be disabled when name is empty
      cy.get('[data-testid="api-key-name-input"]').clear();
      cy.get('[data-testid="create-api-key-button"]').should('be.disabled');

      // Button should be enabled when name is entered
      cy.get('[data-testid="api-key-name-input"]').type('Valid Name');
      cy.get('[data-testid="create-api-key-button"]').should('not.be.disabled');
    });

    it('should handle creation errors', () => {
      cy.intercept('POST', '**/api/v1/api-keys', {
        statusCode: 400,
        body: {
          success: false,
          error: 'Invalid request',
        },
      }).as('createApiKeyError');

      cy.get('[data-testid="api-key-name-input"]').type('Test Key');
      cy.get('[data-testid="create-api-key-button"]').click();

      cy.wait('@createApiKeyError');
      cy.contains('Invalid request').should('be.visible');
    });

    it('should copy API key to clipboard', () => {
      // Mock clipboard API
      cy.window().then((win) => {
        cy.stub(win.navigator.clipboard, 'writeText').resolves();
      });

      // Create a key
      cy.intercept('POST', '**/api/v1/api-keys', {
        statusCode: 201,
        body: {
          success: true,
          data: {
            apiKey: {
              id: 'new-key-id',
              name: 'Copy Test Key',
              key: 'sk_live_copytest123',
              createdAt: new Date().toISOString(),
            },
          },
        },
      }).as('createApiKey');

      cy.get('[data-testid="api-key-name-input"]').type('Copy Test Key');
      cy.get('[data-testid="create-api-key-button"]').click();
      cy.wait('@createApiKey');

      // Click copy button
      cy.get('.bg-green-50').within(() => {
        cy.get('button').contains('Copy').parent().click();
      });

      cy.contains('Copied to clipboard').should('be.visible');

      // Verify clipboard was called
      cy.window()
        .its('navigator.clipboard.writeText')
        .should('have.been.calledWith', 'sk_live_copytest123');
    });
  });

  describe('Managing Existing API Keys', () => {
    beforeEach(() => {
      // Mock API keys list
      cy.intercept('GET', '**/api/v1/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            apiKeys: [
              {
                id: 'key-1',
                name: 'Production Key',
                key: 'sk_live_...abc1',
                createdAt: '2024-01-01T00:00:00Z',
                lastUsed: '2024-01-15T00:00:00Z',
              },
              {
                id: 'key-2',
                name: 'Development Key',
                key: 'sk_live_...xyz2',
                createdAt: '2024-01-05T00:00:00Z',
                expiresAt: '2024-02-05T00:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
          },
        },
      }).as('getApiKeysWithData');
    });

    it('should display existing API keys', () => {
      cy.wait('@getApiKeysWithData');

      // Check keys are displayed
      cy.get('[data-testid="api-key-key-1"]').should('be.visible');
      cy.get('[data-testid="api-key-key-2"]').should('be.visible');

      // Check key details
      cy.contains('Production Key').should('be.visible');
      cy.contains('sk_live_...abc1').should('be.visible');
      cy.contains('Last used: Jan 15, 2024').should('be.visible');

      cy.contains('Development Key').should('be.visible');
      cy.contains('sk_live_...xyz2').should('be.visible');
      cy.contains('Expires: Feb 5, 2024').should('be.visible');
    });

    it('should copy existing API key', () => {
      cy.window().then((win) => {
        cy.stub(win.navigator.clipboard, 'writeText').resolves();
      });

      cy.wait('@getApiKeysWithData');

      cy.get('[data-testid="copy-key-key-1"]').click();
      cy.contains('Copied to clipboard').should('be.visible');
      cy.window()
        .its('navigator.clipboard.writeText')
        .should('have.been.calledWith', 'sk_live_...abc1');
    });

    it('should delete API key', () => {
      cy.intercept('DELETE', '**/api/v1/api-keys/key-1', {
        statusCode: 200,
        body: { success: true, message: 'API key deleted' },
      }).as('deleteApiKey');

      // Mock updated list without deleted key
      cy.intercept('GET', '**/api/v1/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            apiKeys: [
              {
                id: 'key-2',
                name: 'Development Key',
                key: 'sk_live_...xyz2',
                createdAt: '2024-01-05T00:00:00Z',
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        },
      }).as('getUpdatedList');

      cy.wait('@getApiKeysWithData');

      // Stub confirm dialog
      cy.on('window:confirm', () => true);

      // Click delete button
      cy.get('[data-testid="delete-key-key-1"]').click();

      cy.wait('@deleteApiKey');
      cy.contains('API key deleted successfully').should('be.visible');

      cy.wait('@getUpdatedList');
      cy.get('[data-testid="api-key-key-1"]').should('not.exist');
      cy.get('[data-testid="api-key-key-2"]').should('be.visible');
    });

    it('should cancel delete when not confirmed', () => {
      cy.wait('@getApiKeysWithData');

      // Stub confirm dialog to cancel
      cy.on('window:confirm', () => false);

      // Click delete button
      cy.get('[data-testid="delete-key-key-1"]').click();

      // Key should still be visible
      cy.get('[data-testid="api-key-key-1"]').should('be.visible');
    });

    it('should handle delete errors', () => {
      cy.intercept('DELETE', '**/api/v1/api-keys/key-1', {
        statusCode: 500,
        body: { success: false, error: 'Server error' },
      }).as('deleteError');

      cy.wait('@getApiKeysWithData');
      cy.on('window:confirm', () => true);

      cy.get('[data-testid="delete-key-key-1"]').click();
      cy.wait('@deleteError');

      cy.contains('Failed to delete API key').should('be.visible');
      cy.get('[data-testid="api-key-key-1"]').should('be.visible');
    });
  });

  describe('Error States', () => {
    it('should handle API loading errors', () => {
      cy.intercept('GET', '**/api/v1/api-keys', {
        statusCode: 500,
        body: { success: false, error: 'Server error' },
      }).as('getApiKeysError');

      cy.visit('/settings/tokens');
      cy.wait('@getApiKeysError');

      cy.contains('Failed to load API keys').should('be.visible');
    });

    it('should handle network errors', () => {
      cy.intercept('GET', '**/api/v1/api-keys', { forceNetworkError: true }).as(
        'networkError',
      );

      cy.visit('/settings/tokens');
      cy.wait('@networkError');

      cy.contains('Failed to load API keys').should('be.visible');
    });
  });

  describe('Expiration Options', () => {
    it('should allow selecting different expiration options', () => {
      const expirationOptions = [
        { value: '30d', label: '30 days' },
        { value: '90d', label: '90 days' },
        { value: '1y', label: '1 year' },
        { value: 'never', label: 'Never' },
      ];

      expirationOptions.forEach((option) => {
        cy.get('[data-testid="api-key-expiry-select"]').select(option.value);
        cy.get('[data-testid="api-key-expiry-select"]').should(
          'have.value',
          option.value,
        );
      });
    });
  });
});
