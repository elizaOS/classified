/**
 * Complete API Keys Management E2E Test
 * Tests all API key flows: create, regenerate, edit, delete, permissions, and error handling
 */

describe('API Keys Complete Management Test', () => {
  beforeEach(() => {
    // Clear any existing auth state
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
          id: 'api-keys-test-user',
          email: 'test@elizaos.ai',
          firstName: 'API',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'api-keys-org-123',
          name: 'API Keys Test Org',
          slug: 'api-keys-test',
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

    // Mock API keys initial load (empty state)
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
          availablePermissions: [
            'agents:write',
            'agents:read',
            'agents:delete',
            'memory:write',
            'memory:read',
            'messaging:write',
            'messaging:read',
            'audio:write',
            'audio:read',
            'media:write',
            'media:read',
            'inference:*',
            'storage:*',
          ],
        },
      },
    }).as('getApiKeysEmpty');
  });

  it('API Keys Page - Empty State Test', () => {
    cy.log('🔑 Testing API Keys Empty State');

    // ==========================================
    // STEP 1: Visit API Keys Page
    // ==========================================
    cy.log('📋 Step 1: Visit API Keys Page');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getApiKeysEmpty');

    // Verify page structure
    cy.get('[data-cy="api-keys-page"]').should('be.visible');
    cy.get('[data-cy="api-keys-title"]')
      .should('be.visible')
      .and('contain.text', 'API Keys');
    cy.get('[data-cy="api-keys-subtitle"]')
      .should('be.visible')
      .and('contain.text', 'programmatic access');

    // ==========================================
    // STEP 2: Verify Stats Cards (Empty State)
    // ==========================================
    cy.log('📊 Step 2: Verify Stats Cards (Empty State)');

    // All stats should show 0
    cy.contains('Total Keys').parent().should('contain.text', '0');
    cy.contains('Active Keys').parent().should('contain.text', '0');
    cy.contains('Expired Keys').parent().should('contain.text', '0');
    cy.contains('Total Usage').parent().should('contain.text', '0');

    // ==========================================
    // STEP 3: Verify Empty State Message
    // ==========================================
    cy.log('📝 Step 3: Verify Empty State Message');

    cy.contains('No API keys').should('be.visible');
    cy.contains('Create your first API key').should('be.visible');
    cy.get('[data-cy="create-api-key"]').should('be.visible');

    // ==========================================
    // STEP 4: Test Create Button in Header
    // ==========================================
    cy.log('➕ Step 4: Test Create Button in Header');

    cy.get('[data-cy="create-api-key-button"]')
      .should('be.visible')
      .and('contain.text', 'Create API Key');

    cy.log('✅ API Keys Empty State Test Complete!');
  });

  it('API Keys - Create API Key Complete Flow', () => {
    cy.log('🔨 Testing Complete API Key Creation Flow');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getApiKeysEmpty');

    // ==========================================
    // STEP 1: Open Create Modal
    // ==========================================
    cy.log('📋 Step 1: Open Create Modal');

    cy.get('[data-cy="create-api-key-button"]').click();
    cy.get('[data-cy="api-key-modal"]').should('be.visible');
    cy.contains('Create API Key').should('be.visible');

    // ==========================================
    // STEP 2: Test Form Elements
    // ==========================================
    cy.log('📝 Step 2: Test Form Elements');

    // Test name input
    cy.get('[data-cy="api-key-name"]').should('be.visible');
    cy.get('[data-cy="api-key-name"]').should(
      'have.attr',
      'placeholder',
      'My API Key',
    );

    // Test description input
    cy.get('[data-cy="api-key-description"]').should('be.visible');
    cy.get('[data-cy="api-key-description"]').should(
      'have.attr',
      'placeholder',
      'Optional description',
    );

    // Test permissions checkboxes
    cy.get('[data-cy="permission-agents-write"]').should('be.visible');
    cy.get('[data-cy="permission-agents-read"]').should('be.visible');
    cy.get('[data-cy="permission-memory-write"]').should('be.visible');
    cy.get('[data-cy="permission-messaging-write"]').should('be.visible');
    cy.get('[data-cy="permission-inference"]').should('be.visible');
    cy.get('[data-cy="permission-storage"]').should('be.visible');

    // Test submit button
    cy.get('[data-cy="create-key-submit"]')
      .should('be.visible')
      .and('contain.text', 'Create API Key');

    // ==========================================
    // STEP 3: Test Form Validation
    // ==========================================
    cy.log('✅ Step 3: Test Form Validation');

    // Try to submit empty form (should fail)
    cy.get('[data-cy="create-key-submit"]').click();

    // Should see validation errors
    cy.contains('Name is required').should('be.visible');
    cy.contains('At least one permission is required').should('be.visible');

    // ==========================================
    // STEP 4: Fill Form and Create API Key
    // ==========================================
    cy.log('🔨 Step 4: Fill Form and Create API Key');

    // Fill form
    cy.get('[data-cy="api-key-name"]').type('Test API Key');
    cy.get('[data-cy="api-key-description"]').type(
      'API key for comprehensive testing',
    );

    // Select permissions
    cy.get('[data-cy="permission-inference"]').check();
    cy.get('[data-cy="permission-storage"]').check();
    cy.get('[data-cy="permission-agents-write"]').check();

    // Mock successful creation
    const mockApiKey = 'eliza_test_sk_1234567890abcdef1234567890abcdef';
    cy.intercept('POST', '**/api/api-keys', {
      statusCode: 201,
      body: {
        success: true,
        data: {
          key: mockApiKey,
          apiKey: {
            id: 'ak_test_123',
            name: 'Test API Key',
            description: 'API key for comprehensive testing',
            keyPrefix: 'eliza_test_sk_123',
            permissions: ['inference:*', 'storage:*', 'agents:write'],
            rateLimit: 100,
            isActive: true,
            usageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      },
    }).as('createApiKey');

    // Submit form
    cy.get('[data-cy="create-key-submit"]').click();
    cy.wait('@createApiKey');

    // ==========================================
    // STEP 5: Verify API Key Display
    // ==========================================
    cy.log('🔍 Step 5: Verify API Key Display');

    // Should show success message and the API key
    cy.contains('API Key Created Successfully').should('be.visible');
    cy.contains('Copy this key now').should('be.visible');
    cy.get('[data-cy="api-key-value"]')
      .should('be.visible')
      .and('contain', 'eliza_test_sk_');

    // Test copy button
    cy.get('[data-cy="copy-api-key"]').should('be.visible');
    cy.get('[data-cy="copy-api-key"]').click();

    // Close modal
    cy.get('[data-cy="close-modal"]').click();
    cy.get('[data-cy="api-key-modal"]').should('not.exist');

    cy.log('✅ API Key Creation Flow Complete!');
  });

  it('API Keys - Management Operations Test', () => {
    cy.log('⚙️ Testing API Key Management Operations');

    // Mock API keys with existing data
    cy.intercept('GET', '**/api/api-keys', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: [
            {
              id: 'ak_test_123',
              name: 'Test API Key',
              description: 'API key for testing',
              keyPrefix: 'eliza_test_sk_123',
              permissions: ['inference:*', 'storage:*', 'agents:write'],
              rateLimit: 100,
              isActive: true,
              usageCount: 150,
              createdAt: '2024-01-15T10:00:00Z',
              updatedAt: '2024-01-15T10:00:00Z',
              lastUsedAt: '2024-01-16T14:30:00Z',
            },
            {
              id: 'ak_test_456',
              name: 'Production API Key',
              description: 'Production usage key',
              keyPrefix: 'eliza_prod_sk_456',
              permissions: ['inference:*', 'messaging:write'],
              rateLimit: 1000,
              isActive: true,
              usageCount: 5000,
              createdAt: '2024-01-10T08:00:00Z',
              updatedAt: '2024-01-10T08:00:00Z',
              lastUsedAt: '2024-01-17T09:15:00Z',
            },
          ],
          stats: {
            totalKeys: 2,
            activeKeys: 2,
            expiredKeys: 0,
            totalUsage: 5150,
          },
          availablePermissions: [
            'agents:write',
            'agents:read',
            'memory:write',
            'messaging:write',
            'inference:*',
            'storage:*',
          ],
        },
      },
    }).as('getApiKeysWithData');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getApiKeysWithData');

    // ==========================================
    // STEP 1: Verify Stats with Data
    // ==========================================
    cy.log('📊 Step 1: Verify Stats with Data');

    cy.contains('Total Keys').parent().should('contain.text', '2');
    cy.contains('Active Keys').parent().should('contain.text', '2');
    cy.contains('Expired Keys').parent().should('contain.text', '0');
    cy.contains('Total Usage').parent().should('contain.text', '5,150');

    // ==========================================
    // STEP 2: Verify API Key Cards
    // ==========================================
    cy.log('🔍 Step 2: Verify API Key Cards');

    // Should have API key rows
    cy.get('[data-cy="api-key-row"]').should('have.length', 2);

    // Test first API key
    cy.get('[data-cy="api-key-row"]')
      .first()
      .within(() => {
        cy.contains('Test API Key').should('be.visible');
        cy.contains('API key for testing').should('be.visible');
        cy.contains('eliza_test_sk_123').should('be.visible');
        cy.contains('inference:*').should('be.visible');
        cy.contains('storage:*').should('be.visible');
        cy.contains('agents:write').should('be.visible');
        cy.contains('100/min').should('be.visible'); // Rate limit
        cy.contains('150').should('be.visible'); // Usage count
      });

    // ==========================================
    // STEP 3: Test API Key Actions
    // ==========================================
    cy.log('⚙️ Step 3: Test API Key Actions');

    cy.get('[data-cy="api-key-row"]')
      .first()
      .within(() => {
        cy.get('[data-cy="api-key-actions"]').should('be.visible');
        cy.get('[data-cy="edit-key"]').should('be.visible');
        cy.get('[data-cy="regenerate-key"]').should('be.visible');
        cy.get('[data-cy="delete-key"]').should('be.visible');
      });

    // ==========================================
    // STEP 4: Test Edit API Key
    // ==========================================
    cy.log('✏️ Step 4: Test Edit API Key');

    cy.get('[data-cy="api-key-row"]')
      .first()
      .within(() => {
        cy.get('[data-cy="edit-key"]').click();
      });

    // Edit modal should open with pre-filled data
    cy.contains('Edit API Key').should('be.visible');
    cy.get('input[value="Test API Key"]').should('be.visible');
    cy.get('textarea').should('contain.value', 'API key for testing');

    // Change name
    cy.get('input[value="Test API Key"]').clear().type('Updated Test API Key');

    // Mock update
    cy.intercept('PUT', '**/api/api-keys/ak_test_123', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKey: {
            id: 'ak_test_123',
            name: 'Updated Test API Key',
            description: 'API key for testing',
            keyPrefix: 'eliza_test_sk_123',
            permissions: ['inference:*', 'storage:*', 'agents:write'],
            rateLimit: 100,
            isActive: true,
            usageCount: 150,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: new Date().toISOString(),
          },
        },
      },
    }).as('updateApiKey');

    cy.contains('Save Changes').click();
    cy.wait('@updateApiKey');

    // ==========================================
    // STEP 5: Test Regenerate API Key
    // ==========================================
    cy.log('🔄 Step 5: Test Regenerate API Key');

    cy.get('[data-cy="api-key-row"]')
      .first()
      .within(() => {
        cy.get('[data-cy="regenerate-key"]').click();
      });

    // Confirmation modal should appear
    cy.contains('Regenerate API Key').should('be.visible');
    cy.contains('Are you sure you want to regenerate').should('be.visible');
    cy.contains('This will generate a new API key').should('be.visible');

    // Mock regeneration
    const newMockApiKey = 'eliza_test_sk_abcdef1234567890abcdef1234567890';
    cy.intercept('POST', '**/api/api-keys/ak_test_123/regenerate', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          key: newMockApiKey,
          apiKey: {
            id: 'ak_test_123',
            name: 'Updated Test API Key',
            description: 'API key for testing',
            keyPrefix: 'eliza_test_sk_abc',
            permissions: ['inference:*', 'storage:*', 'agents:write'],
            rateLimit: 100,
            isActive: true,
            usageCount: 150,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: new Date().toISOString(),
          },
        },
      },
    }).as('regenerateApiKey');

    cy.get('[data-cy="confirm-regenerate"]').click();
    cy.wait('@regenerateApiKey');

    // Should show new API key
    cy.get('[data-cy="api-key-modal"]').should('be.visible');
    cy.get('[data-cy="api-key-value"]').should('contain', 'eliza_test_sk_');
    cy.get('[data-cy="copy-api-key"]').click();
    cy.get('[data-cy="close-modal"]').click();

    // ==========================================
    // STEP 6: Test Delete API Key
    // ==========================================
    cy.log('🗑️ Step 6: Test Delete API Key');

    cy.get('[data-cy="api-key-row"]')
      .last()
      .within(() => {
        cy.get('[data-cy="delete-key"]').click();
      });

    // Confirmation modal should appear
    cy.contains('Delete API Key').should('be.visible');
    cy.contains('Are you sure you want to delete').should('be.visible');
    cy.contains('Production API Key').should('be.visible');
    cy.contains('This action cannot be undone').should('be.visible');

    // Mock deletion
    cy.intercept('DELETE', '**/api/api-keys?id=ak_test_456', {
      statusCode: 200,
      body: {
        success: true,
        data: {},
      },
    }).as('deleteApiKey');

    cy.get('[data-cy="confirm-delete"]').click();
    cy.wait('@deleteApiKey');

    // API key should be removed from list
    cy.get('[data-cy="api-key-row"]').should('have.length', 1);

    cy.log('✅ API Key Management Operations Test Complete!');
  });

  it('API Keys - Error Handling Test', () => {
    cy.log('❌ Testing API Keys Error Handling');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Load Error
    // ==========================================
    cy.log('❌ Step 1: Test Load Error');

    cy.intercept('GET', '**/api/api-keys', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('getApiKeysError');

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getApiKeysError');

    // Page should still load basic structure
    cy.get('[data-cy="api-keys-page"]').should('be.visible');
    cy.get('[data-cy="api-keys-title"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Create Error
    // ==========================================
    cy.log('❌ Step 2: Test Create Error');

    // Reset to working API keys endpoint
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
    }).as('getApiKeysFixed');

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getApiKeysFixed');

    // Try to create API key with error
    cy.get('[data-cy="create-api-key-button"]').click();
    cy.get('[data-cy="api-key-name"]').type('Test Error Key');
    cy.get('[data-cy="permission-inference"]').check();

    // Mock creation error
    cy.intercept('POST', '**/api/api-keys', {
      statusCode: 400,
      body: {
        success: false,
        error: { message: 'Invalid permissions' },
      },
    }).as('createApiKeyError');

    cy.get('[data-cy="create-key-submit"]').click();
    cy.wait('@createApiKeyError');

    // Should stay in modal and not show success
    cy.get('[data-cy="api-key-modal"]').should('be.visible');
    cy.contains('API Key Created Successfully').should('not.exist');

    // ==========================================
    // STEP 3: Test Network Connectivity
    // ==========================================
    cy.log('🌐 Step 3: Test Network Connectivity');

    // Mock network error
    cy.intercept('POST', '**/api/api-keys', { forceNetworkError: true }).as(
      'networkError',
    );

    cy.get('[data-cy="create-key-submit"]').click();
    cy.wait('@networkError');

    // Should handle network error gracefully
    cy.get('[data-cy="api-key-modal"]').should('be.visible');

    cy.log('✅ API Keys Error Handling Test Complete!');
  });

  it('API Keys - Permission Management Test', () => {
    cy.log('🔐 Testing API Keys Permission Management');

    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getApiKeysEmpty');

    // ==========================================
    // STEP 1: Test Permission Selection
    // ==========================================
    cy.log('✅ Step 1: Test Permission Selection');

    cy.get('[data-cy="create-api-key-button"]').click();
    cy.get('[data-cy="api-key-modal"]').should('be.visible');

    // Test different permission combinations
    const permissions = [
      'agents-write',
      'agents-read',
      'memory-write',
      'messaging-write',
      'inference',
      'storage',
    ];

    permissions.forEach((permission) => {
      cy.get(`[data-cy="permission-${permission}"]`).should('be.visible');
      cy.get(`[data-cy="permission-${permission}"]`).check();
      cy.get(`[data-cy="permission-${permission}"]`).should('be.checked');
      cy.get(`[data-cy="permission-${permission}"]`).uncheck();
      cy.get(`[data-cy="permission-${permission}"]`).should('not.be.checked');
    });

    // ==========================================
    // STEP 2: Test Permission Validation
    // ==========================================
    cy.log('✅ Step 2: Test Permission Validation');

    // Fill name but no permissions
    cy.get('[data-cy="api-key-name"]').type('Permission Test Key');
    cy.get('[data-cy="create-key-submit"]').click();

    // Should show validation error
    cy.contains('At least one permission is required').should('be.visible');

    // Select permissions
    cy.get('[data-cy="permission-inference"]').check();
    cy.get('[data-cy="permission-storage"]').check();

    // Error should disappear
    cy.contains('At least one permission is required').should('not.exist');

    // ==========================================
    // STEP 3: Test Rate Limit Configuration
    // ==========================================
    cy.log('⚡ Step 3: Test Rate Limit Configuration');

    // Rate limit input should be visible and have default value
    cy.get('input[type="number"]').should('be.visible');
    cy.get('input[type="number"]').should('have.value', '100');

    // Change rate limit
    cy.get('input[type="number"]').clear().type('500');
    cy.get('input[type="number"]').should('have.value', '500');

    // Test min/max values
    cy.get('input[type="number"]').should('have.attr', 'min', '1');
    cy.get('input[type="number"]').should('have.attr', 'max', '10000');

    cy.log('✅ API Keys Permission Management Test Complete!');
  });

  it('API Keys - Responsive Design Test', () => {
    cy.log('📱 Testing API Keys Responsive Design');

    // Mock some API keys for testing
    cy.intercept('GET', '**/api/api-keys', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          apiKeys: [
            {
              id: 'ak_mobile_test',
              name: 'Mobile Test Key',
              keyPrefix: 'eliza_mobile_sk_123',
              permissions: ['inference:*'],
              rateLimit: 100,
              isActive: true,
              usageCount: 50,
              createdAt: '2024-01-15T10:00:00Z',
              updatedAt: '2024-01-15T10:00:00Z',
            },
          ],
          stats: {
            totalKeys: 1,
            activeKeys: 1,
            expiredKeys: 0,
            totalUsage: 50,
          },
          availablePermissions: ['inference:*', 'storage:*'],
        },
      },
    }).as('getMobileApiKeys');

    // ==========================================
    // STEP 1: Test Mobile Layout
    // ==========================================
    cy.log('📱 Step 1: Test Mobile Layout');

    cy.viewport('iphone-x');
    cy.visit('/api-keys', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getMobileApiKeys');

    // Page should be visible and functional on mobile
    cy.get('[data-cy="api-keys-page"]').should('be.visible');
    cy.get('[data-cy="api-keys-title"]').should('be.visible');

    // Stats cards should stack on mobile
    cy.contains('Total Keys').should('be.visible');
    cy.contains('Active Keys').should('be.visible');

    // Create button should be visible
    cy.get('[data-cy="create-api-key-button"]').should('be.visible');

    // API key rows should be visible
    cy.get('[data-cy="api-key-row"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Mobile Modal
    // ==========================================
    cy.log('📱 Step 2: Test Mobile Modal');

    cy.get('[data-cy="create-api-key-button"]').click();
    cy.get('[data-cy="api-key-modal"]').should('be.visible');

    // Form should be functional on mobile
    cy.get('[data-cy="api-key-name"]').should('be.visible');
    cy.get('[data-cy="api-key-description"]').should('be.visible');

    // Permissions should be in a grid that works on mobile
    cy.get('[data-cy="permission-inference"]').should('be.visible');
    cy.get('[data-cy="permission-storage"]').should('be.visible');

    // Close modal
    cy.contains('Cancel').click();

    // ==========================================
    // STEP 3: Test Tablet Layout
    // ==========================================
    cy.log('📱 Step 3: Test Tablet Layout');

    cy.viewport('ipad-2');

    // Should still be fully functional on tablet
    cy.get('[data-cy="api-keys-page"]').should('be.visible');
    cy.get('[data-cy="create-api-key-button"]').should('be.visible');
    cy.get('[data-cy="api-key-row"]').should('be.visible');

    // Stats should be in a grid on tablet
    cy.contains('Total Keys').should('be.visible');
    cy.contains('Active Keys').should('be.visible');

    // Reset to desktop
    cy.viewport(1280, 720);

    cy.log('✅ API Keys Responsive Design Test Complete!');
  });
});
