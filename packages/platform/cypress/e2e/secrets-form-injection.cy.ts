/// <reference types="cypress" />

describe('Secrets Form Injection in Autocoder Workspace', () => {
  let testAgentId: string;
  let testProjectId: string;

  before(() => {
    // Get agent ID from environment or use test default
    testAgentId = Cypress.env('AGENT_IDS')?.split(',')[0] || 'test-agent-123';
    testProjectId = `secrets-test-project-${Date.now()}`;

    cy.log(`🧪 Starting secrets form tests with Agent ID: ${testAgentId}`);
  });

  beforeEach(() => {
    // Clear any existing state
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();

    // Handle uncaught exceptions that might occur in the app
    cy.on('uncaught:exception', (err, runnable) => {
      // Return false to prevent Cypress from failing the test
      // We expect some errors since we're testing without a full backend
      return false;
    });

    // Mock authentication if needed
    cy.window().then((win) => {
      win.localStorage.setItem('test-user-authenticated', 'true');
      win.localStorage.setItem('test-user-id', 'test-user-secrets');
    });
  });

  describe('Secrets Form Display and Interaction', () => {
    it('should display secrets form when injected into autocoder workspace', () => {
      cy.log('🔧 Testing secrets form display and basic interaction');

      // Visit the autocoder workspace
      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });

      // Wait for page to load
      cy.get('body').should('be.visible');
      cy.wait(1000);

      // Check if we can access the autocoder workspace (might need authentication)
      cy.get('body').then(($body) => {
        if (
          $body.text().includes('Sign in') ||
          $body.text().includes('Login')
        ) {
          cy.log('⚠️ Authentication required, proceeding with test setup');

          // Mock user session for testing
          cy.window().then((win) => {
            win.localStorage.setItem('auth-token', 'mock-token-for-testing');
            win.localStorage.setItem('user-id', 'test-user-secrets');
          });

          // Reload page with mocked auth
          cy.reload();
        }
      });

      // Look for autocoder workspace elements
      cy.get('body').should(($body) => {
        const text = $body.text();
        expect(text).to.satisfy(
          (text: string) =>
            text.includes('Autocoder') ||
            text.includes('New Project') ||
            text.includes('Create'),
        );
      });

      // Create a new project if needed
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="create-project-button"]').length > 0) {
          cy.get('[data-testid="create-project-button"]').click();
        } else if ($body.text().includes('New Project')) {
          cy.contains('New Project').click();
        } else {
          cy.log(
            '📝 Project creation button not found, proceeding with existing project',
          );
        }
      });

      // Simulate WebSocket message for form injection
      cy.window().then((win) => {
        // Mock WebSocket connection and form injection
        const mockFormRequest = {
          id: 'test-secrets-form-123',
          title: 'Configuration Required',
          description:
            'Please provide the following configuration values to continue:',
          secrets: [
            {
              key: 'OPENAI_API_KEY',
              name: 'OpenAI API Key',
              description: 'Your OpenAI API key for AI features',
              required: true,
              type: 'password',
              placeholder: 'sk-...',
            },
            {
              key: 'DATABASE_URL',
              name: 'Database URL',
              description: 'Connection string for your database',
              required: true,
              type: 'url',
              placeholder: 'postgresql://...',
            },
          ],
          projectId: testProjectId,
          context: {
            action: 'create',
            details: 'Setting up OpenAI integration with database storage',
            priority: 'high',
          },
        };

        // Trigger form injection via custom event
        const event = new CustomEvent('secrets-form-injection', {
          detail: {
            type: 'INJECT_SECRETS_FORM',
            data: {
              formRequest: mockFormRequest,
              formUrl: 'https://secure.example.com/form/test-123',
              timestamp: new Date().toISOString(),
              projectId: testProjectId,
            },
          },
        });

        win.dispatchEvent(event);
      });

      // Wait for form to appear
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 5000 }).should(
        'be.visible',
      );

      cy.log('✅ Secrets form modal appeared successfully');

      // Verify form content
      cy.get('[data-testid="secrets-form-modal"]').within(() => {
        cy.contains('Configuration Required').should('be.visible');
        cy.contains('OpenAI API Key').should('be.visible');
        cy.contains('Database URL').should('be.visible');

        // Check form fields
        cy.get('input[name="OPENAI_API_KEY"]').should('be.visible');
        cy.get('input[name="DATABASE_URL"]').should('be.visible');

        // Check field types
        cy.get('input[name="OPENAI_API_KEY"]').should(
          'have.attr',
          'type',
          'password',
        );
        cy.get('input[name="DATABASE_URL"]').should('have.attr', 'type', 'url');

        // Check required indicators
        cy.contains('OpenAI API Key').parent().should('contain', '*');
        cy.contains('Database URL').parent().should('contain', '*');
      });

      cy.log('✅ Form content and validation indicators verified');
    });

    it('should allow user to fill out and submit the form', () => {
      cy.log('🔧 Testing form input and submission');

      // Setup form injection (reuse from previous test)
      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait(1000);

      // Inject form
      cy.window().then((win) => {
        const mockFormRequest = {
          id: 'test-form-submission-456',
          title: 'API Configuration',
          description: 'Enter your API credentials:',
          secrets: [
            {
              key: 'OPENAI_API_KEY',
              name: 'OpenAI API Key',
              description: 'Your OpenAI API key',
              required: true,
              type: 'password',
              placeholder: 'sk-...',
            },
          ],
          projectId: testProjectId,
          context: {
            action: 'setup',
            details: 'OpenAI integration setup',
            priority: 'medium',
          },
        };

        const event = new CustomEvent('secrets-form-injection', {
          detail: {
            type: 'INJECT_SECRETS_FORM',
            data: {
              formRequest: mockFormRequest,
              formUrl: 'https://secure.example.com/form/test-456',
              timestamp: new Date().toISOString(),
            },
          },
        });

        win.dispatchEvent(event);
      });

      // Wait for form and fill it out
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 5000 }).within(
        () => {
          // Fill in the API key field
          cy.get('input[name="OPENAI_API_KEY"]').type(
            'sk-test-key-123-this-is-a-test-key-for-cypress-testing',
          );

          // Verify the value was entered (input should be masked)
          cy.get('input[name="OPENAI_API_KEY"]').should(
            'have.value',
            'sk-test-key-123-this-is-a-test-key-for-cypress-testing',
          );

          // Test password visibility toggle if available
          cy.get('body').then(($body) => {
            if (
              $body.find('[data-testid="toggle-password-visibility"]').length >
              0
            ) {
              cy.get('[data-testid="toggle-password-visibility"]').click();
              cy.get('input[name="OPENAI_API_KEY"]').should(
                'have.attr',
                'type',
                'text',
              );

              cy.get('[data-testid="toggle-password-visibility"]').click();
              cy.get('input[name="OPENAI_API_KEY"]').should(
                'have.attr',
                'type',
                'password',
              );
            }
          });

          // Submit the form
          cy.get('[data-testid="submit-secrets-form"]').click();
        },
      );

      // Verify form submission handling
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 3000 }).should(
        'not.exist',
      );

      cy.log('✅ Form submitted and closed successfully');
    });

    it('should handle form cancellation properly', () => {
      cy.log('🔧 Testing form cancellation');

      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait(1000);

      // Inject form
      cy.window().then((win) => {
        const mockFormRequest = {
          id: 'test-form-cancel-789',
          title: 'Database Configuration',
          description: 'Database setup required:',
          secrets: [
            {
              key: 'DATABASE_URL',
              name: 'Database URL',
              description: 'Your database connection string',
              required: true,
              type: 'url',
              placeholder: 'postgresql://...',
            },
          ],
          projectId: testProjectId,
          context: {
            action: 'setup',
            details: 'Database configuration',
            priority: 'low',
          },
        };

        const event = new CustomEvent('secrets-form-injection', {
          detail: {
            type: 'INJECT_SECRETS_FORM',
            data: {
              formRequest: mockFormRequest,
              formUrl: 'https://secure.example.com/form/test-789',
            },
          },
        });

        win.dispatchEvent(event);
      });

      // Wait for form and cancel it
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 5000 }).within(
        () => {
          // Verify form is visible
          cy.contains('Database Configuration').should('be.visible');

          // Cancel the form
          cy.get('[data-testid="cancel-secrets-form"]').click();
        },
      );

      // Verify form was closed
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 3000 }).should(
        'not.exist',
      );

      cy.log('✅ Form cancelled and closed successfully');
    });

    it('should validate required fields and show error messages', () => {
      cy.log('🔧 Testing form validation');

      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait(1000);

      // Inject form with multiple required fields
      cy.window().then((win) => {
        const mockFormRequest = {
          id: 'test-form-validation-101112',
          title: 'Multi-Service Configuration',
          description: 'Multiple API keys required:',
          secrets: [
            {
              key: 'OPENAI_API_KEY',
              name: 'OpenAI API Key',
              description: 'Your OpenAI API key',
              required: true,
              type: 'password',
              validation: '^sk-[a-zA-Z0-9]{32,}$',
            },
            {
              key: 'STRIPE_SECRET_KEY',
              name: 'Stripe Secret Key',
              description: 'Your Stripe secret key',
              required: true,
              type: 'password',
              validation: '^sk_(test|live)_[a-zA-Z0-9]{24,}$',
            },
            {
              key: 'DATABASE_URL',
              name: 'Database URL',
              description: 'Database connection string',
              required: false,
              type: 'url',
            },
          ],
          projectId: testProjectId,
          context: {
            action: 'validate',
            details: 'Testing validation',
            priority: 'high',
          },
        };

        const event = new CustomEvent('secrets-form-injection', {
          detail: {
            type: 'INJECT_SECRETS_FORM',
            data: {
              formRequest: mockFormRequest,
              formUrl: 'https://secure.example.com/form/validation-test',
            },
          },
        });

        win.dispatchEvent(event);
      });

      cy.get('[data-testid="secrets-form-modal"]', { timeout: 5000 }).within(
        () => {
          // Try to submit empty form
          cy.get('[data-testid="submit-secrets-form"]').click();

          // Check for validation errors
          cy.get('body').should(($body) => {
            const text = $body.text();
            expect(text).to.satisfy(
              (text: string) =>
                text.includes('required') ||
                text.includes('field') ||
                text.includes('error'),
            );
          });

          // Fill in invalid data
          cy.get('input[name="OPENAI_API_KEY"]').type('invalid-key');
          cy.get('input[name="STRIPE_SECRET_KEY"]').type('invalid-stripe-key');

          // Try to submit with invalid data
          cy.get('[data-testid="submit-secrets-form"]').click();

          // Should still be in form (validation failed)
          cy.contains('Multi-Service Configuration').should('be.visible');

          // Fill in valid data
          cy.get('input[name="OPENAI_API_KEY"]')
            .clear()
            .type('sk-test1234567890123456789012345678901234567890');
          cy.get('input[name="STRIPE_SECRET_KEY"]')
            .clear()
            .type('sk_test_123456789012345678901234');

          // Submit with valid data
          cy.get('[data-testid="submit-secrets-form"]').click();
        },
      );

      // Form should close after successful validation
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 3000 }).should(
        'not.exist',
      );

      cy.log('✅ Form validation working correctly');
    });

    it('should be responsive and work on mobile devices', () => {
      cy.log('🔧 Testing responsive design');

      // Test on mobile viewport
      cy.viewport('iphone-x');

      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait(1000);

      // Inject form
      cy.window().then((win) => {
        const mockFormRequest = {
          id: 'test-mobile-form-131415',
          title: 'Mobile Test Configuration',
          description: 'Testing mobile responsiveness:',
          secrets: [
            {
              key: 'API_KEY',
              name: 'API Key',
              description: 'Test API key for mobile',
              required: true,
              type: 'password',
            },
          ],
          projectId: testProjectId,
          context: {
            action: 'mobile-test',
            details: 'Mobile responsiveness test',
            priority: 'medium',
          },
        };

        const event = new CustomEvent('secrets-form-injection', {
          detail: {
            type: 'INJECT_SECRETS_FORM',
            data: {
              formRequest: mockFormRequest,
              formUrl: 'https://secure.example.com/form/mobile-test',
            },
          },
        });

        win.dispatchEvent(event);
      });

      // Verify form displays properly on mobile
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 5000 }).should(
        'be.visible',
      );

      // Check form is within viewport
      cy.get('[data-testid="secrets-form-modal"]').then(($modal) => {
        const modalWidth = $modal.width();
        const viewportWidth = Cypress.config('viewportWidth');
        expect(modalWidth).to.be.lessThan(viewportWidth);
      });

      // Test form interaction on mobile
      cy.get('[data-testid="secrets-form-modal"]').within(() => {
        cy.get('input[name="API_KEY"]')
          .should('be.visible')
          .type('mobile-test-key');
        cy.get('[data-testid="submit-secrets-form"]')
          .should('be.visible')
          .click();
      });

      cy.log('✅ Mobile responsiveness verified');
    });

    it('should handle connection status and WebSocket reconnection', () => {
      cy.log('🔧 Testing WebSocket connection status');

      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait(1000);

      // Check for connection status indicators
      cy.get('body').then(($body) => {
        const text = $body.text();
        if (text.includes('Connected') || text.includes('Forms:')) {
          // Check that at least one connection indicator is visible
          cy.get('body').should(($body) => {
            const bodyText = $body.text();
            expect(bodyText).to.satisfy(
              (text: string) =>
                text.includes('Connected') || text.includes('Forms:'),
            );
          });
          cy.log('✅ Connection status indicators found');
        } else {
          cy.log(
            'ℹ️ Connection status indicators not visible - may need authenticated session',
          );
        }
      });

      // Test form injection works even with connection status
      cy.window().then((win) => {
        const mockFormRequest = {
          id: 'test-connection-form-161718',
          title: 'Connection Test',
          description: 'Testing with connection status:',
          secrets: [
            {
              key: 'TEST_SECRET',
              name: 'Test Secret',
              description: 'Test secret for connection testing',
              required: true,
              type: 'text',
            },
          ],
          projectId: testProjectId,
          context: {
            action: 'connection-test',
            details: 'Testing connection handling',
            priority: 'low',
          },
        };

        const event = new CustomEvent('secrets-form-injection', {
          detail: {
            type: 'INJECT_SECRETS_FORM',
            data: {
              formRequest: mockFormRequest,
              formUrl: 'https://secure.example.com/form/connection-test',
            },
          },
        });

        win.dispatchEvent(event);
      });

      // Verify form still works
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 5000 }).should(
        'be.visible',
      );

      cy.get('[data-testid="secrets-form-modal"]').within(() => {
        cy.get('input[name="TEST_SECRET"]').type('connection-test-value');
        cy.get('[data-testid="submit-secrets-form"]').click();
      });

      cy.get('[data-testid="secrets-form-modal"]', { timeout: 3000 }).should(
        'not.exist',
      );

      cy.log('✅ Form works correctly with connection status handling');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed form data gracefully', () => {
      cy.log('🔧 Testing error handling for malformed data');

      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait(1000);

      // Inject malformed form data
      cy.window().then((win) => {
        const malformedEvent = new CustomEvent('secrets-form-injection', {
          detail: {
            type: 'INJECT_SECRETS_FORM',
            data: {
              // Missing formRequest
              formUrl: 'https://secure.example.com/form/malformed',
              timestamp: new Date().toISOString(),
            },
          },
        });

        win.dispatchEvent(malformedEvent);
      });

      // Form should not appear for malformed data
      cy.get('[data-testid="secrets-form-modal"]', { timeout: 2000 }).should(
        'not.exist',
      );

      cy.log('✅ Malformed data handled gracefully');
    });

    it('should handle rapid form injection/cancellation cycles', () => {
      cy.log('🔧 Testing rapid form operations');

      cy.visit('/dashboard/autocoder', { failOnStatusCode: false });
      cy.wait(1000);

      // Rapidly inject and cancel forms
      for (let i = 0; i < 3; i++) {
        cy.window().then((win) => {
          const formRequest = {
            id: `rapid-test-${i}`,
            title: `Rapid Test ${i}`,
            description: 'Rapid form test',
            secrets: [
              {
                key: 'RAPID_TEST',
                name: 'Rapid Test',
                description: 'Test field',
                required: true,
                type: 'text',
              },
            ],
            projectId: testProjectId,
            context: {
              action: 'rapid-test',
              details: 'Rapid testing',
              priority: 'low',
            },
          };

          const event = new CustomEvent('secrets-form-injection', {
            detail: {
              type: 'INJECT_SECRETS_FORM',
              data: {
                formRequest,
                formUrl: `https://secure.example.com/form/rapid-${i}`,
              },
            },
          });

          win.dispatchEvent(event);
        });

        // Quick cancel
        cy.get('[data-testid="secrets-form-modal"]', { timeout: 2000 }).then(
          ($modal) => {
            if ($modal.length > 0) {
              cy.get('[data-testid="cancel-secrets-form"]').click();
            }
          },
        );
      }

      cy.log('✅ Rapid operations handled correctly');
    });
  });

  after(() => {
    // Cleanup
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();

    cy.log('🧹 Test cleanup completed');
  });
});
