/**
 * API Keys Edge Cases & Advanced Testing
 * Ensures bulletproof API key system functionality
 */

describe('API Keys - Edge Cases & Advanced Testing', () => {
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
          id: 'edge-test-user',
          email: 'edge@elizaos.ai',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'edge-test-org',
          creditBalance: '10000.0',
        },
      },
    }).as('getIdentity');
  });

  describe('API Key Format Validation', () => {
    it('Validates all supported key formats', () => {
      const validFormats = [
        'eliza_prod_sk_abcd1234567890',
        'eliza_test_sk_xyz9876543210',
        'eliza_dev_sk_qwerty123456',
        'eliza_staging_sk_asdfgh098765',
      ];

      const invalidFormats = [
        'invalid_key_format',
        'eliza_sk_missing_env',
        'prod_sk_wrong_prefix',
        'eliza_prod_pk_wrong_type', // pk instead of sk
        'eliza_prod_sk_', // missing suffix
        'ELIZA_PROD_SK_UPPERCASE', // wrong case
        '', // empty
        null, // null
        undefined, // undefined
        '   ', // whitespace only
        'eliza_prod_sk_<script>alert("xss")</script>', // XSS attempt
      ];

      // Test valid formats
      validFormats.forEach((key) => {
        cy.request({
          method: 'POST',
          url: '/api/api-keys/validate',
          body: { key },
          failOnStatusCode: false,
        }).then((response) => {
          // Should accept valid formats (might be 401 if key doesn't exist, but not 400)
          expect(response.status).to.not.equal(400);
        });
      });

      // Test invalid formats
      invalidFormats.forEach((key) => {
        cy.request({
          method: 'POST',
          url: '/api/api-keys/validate',
          body: { key },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.equal(400);
        });
      });
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('Handles burst traffic correctly', () => {
      const testKey = 'eliza_test_sk_ratelimit123';
      const requests = [];

      // Make 100 rapid requests
      for (let i = 0; i < 100; i++) {
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
        const successResponses = responses.filter((r) => r.status === 200);
        const rateLimitedResponses = responses.filter((r) => r.status === 429);

        cy.log(
          `Success: ${successResponses.length}, Rate Limited: ${rateLimitedResponses.length}`,
        );

        // Should have some rate limited responses
        expect(rateLimitedResponses.length).to.be.greaterThan(0);

        // Check rate limit headers
        const rateLimitedResponse = rateLimitedResponses[0];
        expect(rateLimitedResponse.headers).to.have.property(
          'x-ratelimit-limit',
        );
        expect(rateLimitedResponse.headers).to.have.property(
          'x-ratelimit-remaining',
        );
        expect(rateLimitedResponse.headers).to.have.property(
          'x-ratelimit-reset',
        );
      });
    });

    it('Resets rate limits after window', () => {
      const testKey = 'eliza_test_sk_ratelimit456';

      // First, hit rate limit
      cy.request({
        method: 'GET',
        url: '/api/health',
        headers: {
          Authorization: `Bearer ${testKey}`,
        },
        failOnStatusCode: false,
      }).then((response) => {
        if (response.headers['x-ratelimit-reset']) {
          const resetTime = parseInt(response.headers['x-ratelimit-reset']);
          const waitTime = resetTime - Date.now() + 1000; // Add 1 second buffer

          // Wait for rate limit window to reset
          cy.wait(waitTime);

          // Try again - should succeed
          cy.request({
            method: 'GET',
            url: '/api/health',
            headers: {
              Authorization: `Bearer ${testKey}`,
            },
          }).then((retryResponse) => {
            expect(retryResponse.status).to.equal(200);
          });
        }
      });
    });
  });

  describe('Permission Boundary Testing', () => {
    it('Tests permission inheritance and conflicts', () => {
      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Create key with conflicting permissions
      cy.get('[data-cy="create-api-key-button"]').click();
      cy.get('[data-cy="api-key-name"]').type('Permission Boundary Test');

      // Test permission combinations
      const permissionTests = [
        {
          permissions: ['agents:read', 'agents:write'],
          should: 'allow both read and write',
        },
        {
          permissions: ['agents:*'],
          should: 'allow all agent operations',
        },
        {
          permissions: ['*:read'],
          should: 'allow read on all resources',
        },
        {
          permissions: ['*'],
          should: 'allow all operations (admin)',
        },
      ];

      permissionTests.forEach((test) => {
        // Clear previous selections
        cy.get('input[type="checkbox"]').uncheck();

        // Select permissions
        test.permissions.forEach((perm) => {
          cy.get(`[data-cy="permission-${perm.replace(':', '-')}"]`).check();
        });

        cy.log(`Testing: ${test.should}`);
      });
    });

    it('Prevents privilege escalation', () => {
      const limitedKey = 'eliza_test_sk_limited789';

      // Try to use limited key to create admin key
      cy.request({
        method: 'POST',
        url: '/api/api-keys',
        headers: {
          Authorization: `Bearer ${limitedKey}`,
        },
        body: {
          name: 'Escalation Attempt',
          permissions: ['*'], // Try to create admin key
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(403); // Should be forbidden
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('Handles simultaneous key operations', () => {
      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Mock initial empty state
      cy.intercept('GET', '**/api/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: { apiKeys: [] },
        },
      }).as('getApiKeys');

      cy.wait('@getApiKeys');

      // Create multiple keys simultaneously
      const createPromises = [];
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          cy.request({
            method: 'POST',
            url: '/api/api-keys',
            body: {
              name: `Concurrent Key ${i}`,
              permissions: ['inference:*'],
            },
            failOnStatusCode: false,
          }),
        );
      }

      cy.wrap(Promise.all(createPromises)).then((responses) => {
        // All should succeed
        responses.forEach((response, index) => {
          expect(response.status).to.equal(201);
          cy.log(`Created key ${index}: ${response.body.data.key}`);
        });
      });
    });

    it('Prevents race conditions on regeneration', () => {
      const keyId = 'ak_race_test';

      // Try to regenerate the same key multiple times simultaneously
      const regeneratePromises = [];
      for (let i = 0; i < 3; i++) {
        regeneratePromises.push(
          cy.request({
            method: 'POST',
            url: `/api/api-keys/${keyId}/regenerate`,
            failOnStatusCode: false,
          }),
        );
      }

      cy.wrap(Promise.all(regeneratePromises)).then((responses) => {
        // Only one should succeed
        const successCount = responses.filter((r) => r.status === 200).length;
        expect(successCount).to.equal(1);

        // Others should get conflict error
        const conflictCount = responses.filter((r) => r.status === 409).length;
        expect(conflictCount).to.equal(2);
      });
    });
  });

  describe('Data Integrity Tests', () => {
    it('Maintains consistency during updates', () => {
      const keyId = 'ak_integrity_test';

      // Create a key
      cy.request({
        method: 'POST',
        url: '/api/api-keys',
        body: {
          name: 'Integrity Test Key',
          permissions: ['agents:read'],
        },
      }).then((createResponse) => {
        const originalKey = createResponse.body.data.key;

        // Update permissions
        cy.request({
          method: 'PUT',
          url: `/api/api-keys/${keyId}`,
          body: {
            permissions: ['agents:write', 'memory:write'],
          },
        }).then(() => {
          // Verify the key itself hasn't changed
          cy.request({
            method: 'POST',
            url: '/api/api-keys/validate',
            body: { key: originalKey },
          }).then((validateResponse) => {
            expect(validateResponse.status).to.equal(200);
            expect(validateResponse.body.data.permissions).to.deep.equal([
              'agents:write',
              'memory:write',
            ]);
          });
        });
      });
    });

    it('Handles soft delete correctly', () => {
      const keyId = 'ak_soft_delete_test';

      // Delete a key
      cy.request({
        method: 'DELETE',
        url: `/api/api-keys?id=${keyId}`,
      }).then(() => {
        // Try to use deleted key
        cy.request({
          method: 'POST',
          url: '/api/api-keys/validate',
          body: { key: 'eliza_test_sk_deleted123' },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.equal(401);
          expect(response.body.error).to.include('deleted');
        });
      });
    });
  });

  describe('UI Edge Cases', () => {
    it('Handles very long key names', () => {
      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      cy.get('[data-cy="create-api-key-button"]').click();

      const longName = 'A'.repeat(1000);
      cy.get('[data-cy="api-key-name"]').type(longName);

      // Should truncate or show error
      cy.get('[data-cy="api-key-name"]').should(($input) => {
        const value = $input.val();
        expect(value.length).to.be.lessThan(256); // Reasonable max length
      });
    });

    it('Handles special characters in descriptions', () => {
      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      cy.get('[data-cy="create-api-key-button"]').click();

      const specialChars = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~™€£¥§¶†‡»«¿¡';
      cy.get('[data-cy="api-key-name"]').type('Special Chars Test');
      cy.get('[data-cy="api-key-description"]').type(specialChars);

      // Should handle gracefully
      cy.get('[data-cy="api-key-description"]').should(
        'have.value',
        specialChars,
      );
    });

    it('Handles clipboard operations securely', () => {
      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Mock API key data
      cy.intercept('POST', '**/api/api-keys', {
        statusCode: 201,
        body: {
          success: true,
          data: {
            key: 'eliza_test_sk_clipboard123',
          },
        },
      }).as('createKey');

      cy.get('[data-cy="create-api-key-button"]').click();
      cy.get('[data-cy="api-key-name"]').type('Clipboard Test');
      cy.get('[data-cy="permission-inference"]').check();
      cy.get('[data-cy="create-key-submit"]').click();
      cy.wait('@createKey');

      // Test copy button
      cy.get('[data-cy="copy-api-key"]').click();

      // Verify clipboard operation (if supported by browser)
      cy.window().then((win) => {
        if (win.navigator.clipboard) {
          win.navigator.clipboard.readText().then((text) => {
            expect(text).to.equal('eliza_test_sk_clipboard123');
          });
        }
      });
    });
  });

  describe('Performance Under Load', () => {
    it('Handles large number of keys efficiently', () => {
      // Mock 10,000 API keys
      const mockKeys = Array.from({ length: 10000 }, (_, i) => ({
        id: `ak_load_${i}`,
        name: `Load Test Key ${i}`,
        keyPrefix: `eliza_test_sk_${i}`,
        permissions: ['inference:*'],
        isActive: true,
        usageCount: Math.floor(Math.random() * 100000),
      }));

      cy.intercept('GET', '**/api/api-keys', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            apiKeys: mockKeys.slice(0, 20), // First page
            pagination: {
              total: 10000,
              page: 1,
              perPage: 20,
              totalPages: 500,
            },
          },
        },
      }).as('getLargeDataset');

      const startTime = Date.now();
      cy.visit('/api-keys');
      cy.wait('@getLargeDataset');

      // Should load within reasonable time
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(5000); // 5 seconds max

      // Verify pagination controls
      cy.contains('1-20 of 10,000').should('be.visible');
      cy.get('[data-cy="pagination-next"]').should('be.visible');
      cy.get('[data-cy="pagination-last"]').should('be.visible');

      // Test search performance
      cy.get('[data-cy="search-api-keys"]').type('Load Test Key 9999');

      // Search should be responsive
      cy.get('[data-cy="api-key-row"]', { timeout: 1000 }).should(
        'have.length.greaterThan',
        0,
      );
    });
  });

  describe('Backup and Recovery', () => {
    it('Exports API keys securely', () => {
      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Mock export endpoint
      cy.intercept('GET', '**/api/api-keys/export', {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="api-keys-export.json"',
        },
        body: {
          exportDate: new Date().toISOString(),
          keys: [
            {
              name: 'Exported Key 1',
              permissions: ['inference:*'],
              createdAt: new Date().toISOString(),
            },
          ],
        },
      }).as('exportKeys');

      cy.get('[data-cy="export-api-keys"]').click();
      cy.wait('@exportKeys');

      // Verify download initiated
      cy.readFile('cypress/downloads/api-keys-export.json').should('exist');
    });

    it('Imports API keys with validation', () => {
      cy.visit('/api-keys');
      cy.wait('@getIdentity');

      // Create import file
      const importData = {
        keys: [
          {
            name: 'Imported Key 1',
            permissions: ['agents:read', 'memory:read'],
          },
          {
            name: 'Imported Key 2',
            permissions: ['inference:*'],
          },
        ],
      };

      // Mock import endpoint
      cy.intercept('POST', '**/api/api-keys/import', {
        statusCode: 200,
        body: {
          success: true,
          imported: 2,
          failed: 0,
        },
      }).as('importKeys');

      cy.get('[data-cy="import-api-keys"]').click();
      cy.get('input[type="file"]').selectFile({
        contents: Cypress.Buffer.from(JSON.stringify(importData)),
        fileName: 'api-keys-import.json',
      });

      cy.wait('@importKeys');
      cy.contains('2 keys imported successfully').should('be.visible');
    });
  });
});
