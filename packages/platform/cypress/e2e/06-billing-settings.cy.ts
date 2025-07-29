describe('Billing & Settings - Complete Test Suite', () => {
  beforeEach(() => {
    // Set up authenticated user state
    cy.window().then((win) => {
      win.localStorage.setItem('auth-token', 'mock-token');
    });

    // Mock authenticated user check
    cy.intercept('GET', '**/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-id',
          email: 'test@elizaos.ai',
          name: 'Test User',
          credits: 1000,
          subscription: {
            plan: 'production',
            status: 'active',
            nextBilling: '2024-02-01T00:00:00Z',
          },
        },
      },
    }).as('authCheck');
  });

  describe('Billing Overview', () => {
    beforeEach(() => {
      // Mock billing data
      cy.intercept('GET', '**/billing/overview', {
        statusCode: 200,
        body: {
          currentPlan: 'production',
          credits: 1000,
          monthlyUsage: 450,
          nextBilling: '2024-02-01T00:00:00Z',
          amount: 29.0,
          transactions: [
            {
              id: 'txn-1',
              type: 'subscription',
              amount: 29.0,
              date: '2024-01-01T00:00:00Z',
              status: 'completed',
            },
            {
              id: 'txn-2',
              type: 'credits',
              amount: 10.0,
              credits: 500,
              date: '2024-01-15T00:00:00Z',
              status: 'completed',
            },
          ],
        },
      }).as('billingOverview');

      cy.visit('/dashboard/billing');
      cy.wait(['@authCheck', '@billingOverview']);
    });

    it('should display billing overview correctly', () => {
      cy.url().should('include', '/dashboard/billing');

      // Check current plan display
      cy.contains('Production Plan').should('be.visible');
      cy.contains('$29/month').should('be.visible');
      cy.contains('Active').should('be.visible');

      // Check credits display
      cy.contains('1,000 credits').should('be.visible');
      cy.contains('450 used this month').should('be.visible');

      // Check next billing
      cy.contains('Next billing').should('be.visible');
      cy.contains('Feb 1, 2024').should('be.visible');
    });

    it('should display transaction history', () => {
      // Check transactions section
      cy.contains('Transaction History').should('be.visible');

      // Check individual transactions
      cy.contains('Subscription').should('be.visible');
      cy.contains('$29.00').should('be.visible');
      cy.contains('Credits Purchase').should('be.visible');
      cy.contains('$10.00').should('be.visible');
      cy.contains('500 credits').should('be.visible');

      // Check transaction statuses
      cy.contains('Completed').should('be.visible');
    });

    it('should handle plan upgrade/downgrade buttons', () => {
      // Upgrade button
      cy.get('button').contains('Upgrade Plan').should('be.visible').click();
      cy.url()
        .should('include', '/dashboard/billing')
        .and('include', 'upgrade=true');

      // Go back
      cy.visit('/dashboard/billing');

      // Add credits button
      cy.get('button').contains('Add Credits').should('be.visible').click();
      cy.url()
        .should('include', '/dashboard/billing')
        .and('include', 'add-credits=true');
    });

    it('should handle invoice downloads', () => {
      // Mock invoice download
      cy.intercept('GET', '**/billing/invoice/txn-1/download', {
        statusCode: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename=invoice-txn-1.pdf',
        },
        body: 'PDF content',
      }).as('downloadInvoice');

      cy.get('button').contains('Download Invoice').first().click();
      cy.wait('@downloadInvoice');
    });
  });

  describe('Plan Management', () => {
    beforeEach(() => {
      // Mock available plans
      cy.intercept('GET', '**/billing/plans', {
        statusCode: 200,
        body: {
          plans: [
            {
              id: 'free',
              name: 'Developer Free',
              price: 0,
              credits: 10000,
              features: [
                '10k tokens/month',
                '1GB storage',
                'Community support',
              ],
            },
            {
              id: 'production',
              name: 'Production',
              price: 29,
              credits: 50000,
              features: [
                '$50 credits included',
                'Unlimited storage',
                'Priority support',
                'Custom domains',
              ],
            },
            {
              id: 'enterprise',
              name: 'Enterprise',
              price: 99,
              credits: 200000,
              features: [
                '$200 credits included',
                'Dedicated support',
                'SLA',
                'Custom integrations',
              ],
            },
          ],
        },
      }).as('availablePlans');

      cy.visit('/dashboard/billing?upgrade=true');
      cy.wait(['@authCheck', '@availablePlans']);
    });

    it('should display available plans', () => {
      // Check all plans are displayed
      cy.contains('Developer Free').should('be.visible');
      cy.contains('Production').should('be.visible');
      cy.contains('Enterprise').should('be.visible');

      // Check plan details
      cy.contains('$0/month').should('be.visible');
      cy.contains('$29/month').should('be.visible');
      cy.contains('$99/month').should('be.visible');

      // Check features
      cy.contains('10k tokens/month').should('be.visible');
      cy.contains('Priority support').should('be.visible');
      cy.contains('Dedicated support').should('be.visible');
    });

    it('should handle plan selection and checkout', () => {
      // Mock Stripe checkout session
      cy.intercept('POST', '**/billing/checkout', {
        statusCode: 200,
        body: {
          checkoutUrl: 'https://checkout.stripe.com/test-session',
        },
      }).as('createCheckout');

      // Select enterprise plan
      cy.get('[data-plan="enterprise"]').within(() => {
        cy.get('button').contains('Upgrade').click();
      });

      cy.wait('@createCheckout');

      // Should redirect to Stripe checkout (in real scenario)
      // For testing, we can verify the API call was made
    });

    it('should handle plan cancellation', () => {
      // Mock current subscription
      cy.visit('/dashboard/billing');
      cy.wait('@authCheck');

      // Mock cancellation API
      cy.intercept('POST', '**/billing/cancel', {
        statusCode: 200,
        body: { success: true, cancelDate: '2024-02-01T00:00:00Z' },
      }).as('cancelSubscription');

      cy.get('button').contains('Cancel Plan').click();
      cy.get('[data-cy="confirm-cancellation"]').click();
      cy.wait('@cancelSubscription');

      cy.contains('Plan cancelled').should('be.visible');
      cy.contains('Your plan will remain active until Feb 1, 2024').should(
        'be.visible',
      );
    });
  });

  describe('Credits Management', () => {
    beforeEach(() => {
      // Mock credit packages
      cy.intercept('GET', '**/billing/credit-packages', {
        statusCode: 200,
        body: {
          packages: [
            { credits: 500, price: 10, bonus: 0 },
            { credits: 1000, price: 18, bonus: 100 },
            { credits: 2500, price: 40, bonus: 500 },
            { credits: 5000, price: 75, bonus: 1250 },
          ],
        },
      }).as('creditPackages');

      cy.visit('/dashboard/billing?add-credits=true');
      cy.wait(['@authCheck', '@creditPackages']);
    });

    it('should display credit packages', () => {
      // Check packages are displayed
      cy.contains('500 credits').should('be.visible');
      cy.contains('$10').should('be.visible');

      cy.contains('1,000 credits').should('be.visible');
      cy.contains('$18').should('be.visible');
      cy.contains('+100 bonus').should('be.visible');

      cy.contains('2,500 credits').should('be.visible');
      cy.contains('$40').should('be.visible');
      cy.contains('+500 bonus').should('be.visible');
    });

    it('should handle credit purchase', () => {
      // Mock purchase API
      cy.intercept('POST', '**/billing/purchase-credits', {
        statusCode: 200,
        body: {
          paymentIntentId: 'pi_test_123',
          clientSecret: 'pi_test_123_secret_test',
        },
      }).as('purchaseCredits');

      // Select credit package
      cy.get('[data-credits="1000"]').within(() => {
        cy.get('button').contains('Purchase').click();
      });

      cy.wait('@purchaseCredits');

      // Should show payment processing
      cy.contains('Processing payment').should('be.visible');
    });

    it('should show credit usage analytics', () => {
      cy.visit('/dashboard/billing');
      cy.wait('@authCheck');

      // Mock usage analytics
      cy.intercept('GET', '**/billing/usage-analytics', {
        statusCode: 200,
        body: {
          dailyUsage: [
            { date: '2024-01-01', credits: 50 },
            { date: '2024-01-02', credits: 75 },
            { date: '2024-01-03', credits: 60 },
          ],
          byType: {
            text: 200,
            image: 150,
            video: 100,
          },
        },
      }).as('usageAnalytics');

      cy.get('button').contains('View Usage').click();
      cy.wait('@usageAnalytics');

      // Should display usage chart
      cy.get('[data-cy="usage-chart"]').should('be.visible');
      cy.contains('Text Generation: 200 credits').should('be.visible');
      cy.contains('Image Generation: 150 credits').should('be.visible');
    });
  });

  describe('Account Settings', () => {
    beforeEach(() => {
      // Mock user settings
      cy.intercept('GET', '**/settings/account', {
        statusCode: 200,
        body: {
          user: {
            name: 'Test User',
            email: 'test@elizaos.ai',
            timezone: 'America/New_York',
            notifications: {
              email: true,
              billing: true,
              marketing: false,
            },
          },
        },
      }).as('accountSettings');

      cy.visit('/settings/account');
      cy.wait(['@authCheck', '@accountSettings']);
    });

    it('should display account settings form', () => {
      cy.url().should('include', '/settings/account');

      // Check form fields
      cy.get('input[name="name"]').should('have.value', 'Test User');
      cy.get('input[name="email"]').should('have.value', 'test@elizaos.ai');
      cy.get('select[name="timezone"]').should(
        'have.value',
        'America/New_York',
      );

      // Check notification preferences
      cy.get('input[name="emailNotifications"]').should('be.checked');
      cy.get('input[name="billingNotifications"]').should('be.checked');
      cy.get('input[name="marketingNotifications"]').should('not.be.checked');
    });

    it('should handle account updates', () => {
      // Update account information
      cy.get('input[name="name"]').clear().type('Updated Test User');
      cy.get('select[name="timezone"]').select('America/Los_Angeles');
      cy.get('input[name="marketingNotifications"]').check();

      // Mock update API
      cy.intercept('PUT', '**/settings/account', {
        statusCode: 200,
        body: { success: true },
      }).as('updateAccount');

      cy.get('button[type="submit"]').click();
      cy.wait('@updateAccount');

      cy.contains('Account updated successfully').should('be.visible');
    });

    it('should handle password change', () => {
      // Navigate to password change
      cy.get('button').contains('Change Password').click();
      cy.url().should('include', '/settings/account/change-password');

      // Fill password form
      cy.get('input[name="currentPassword"]').type('oldpassword');
      cy.get('input[name="newPassword"]').type('newpassword123');
      cy.get('input[name="confirmPassword"]').type('newpassword123');

      // Mock password change API
      cy.intercept('POST', '**/auth/change-password', {
        statusCode: 200,
        body: { success: true },
      }).as('changePassword');

      cy.get('button[type="submit"]').click();
      cy.wait('@changePassword');

      cy.contains('Password changed successfully').should('be.visible');
    });

    it('should handle account deletion', () => {
      // Navigate to danger zone
      cy.get('button').contains('Delete Account').click();

      // Should show confirmation modal
      cy.get('[data-cy="delete-account-modal"]').should('be.visible');
      cy.contains('This action cannot be undone').should('be.visible');

      // Type confirmation
      cy.get('input[placeholder="Type DELETE to confirm"]').type('DELETE');

      // Mock deletion API
      cy.intercept('DELETE', '**/settings/account', {
        statusCode: 200,
        body: { success: true },
      }).as('deleteAccount');

      cy.get('button').contains('Delete My Account').click();
      cy.wait('@deleteAccount');

      // Should redirect to landing page
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  describe('API Keys Management', () => {
    beforeEach(() => {
      // Mock API keys
      cy.intercept('GET', '**/api-keys', {
        statusCode: 200,
        body: {
          apiKeys: [
            {
              id: 'key-1',
              name: 'Production Key',
              prefix: 'eliza_prod_...',
              lastUsed: '2024-01-01T00:00:00Z',
              createdAt: '2023-12-01T00:00:00Z',
            },
            {
              id: 'key-2',
              name: 'Development Key',
              prefix: 'eliza_dev_...',
              lastUsed: null,
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      }).as('apiKeys');

      cy.visit('/settings/tokens');
      cy.wait(['@authCheck', '@apiKeys']);
    });

    it('should display API keys list', () => {
      cy.url().should('include', '/settings/tokens');

      // Check API keys are displayed
      cy.contains('Production Key').should('be.visible');
      cy.contains('Development Key').should('be.visible');

      // Check key details
      cy.contains('eliza_prod_...').should('be.visible');
      cy.contains('eliza_dev_...').should('be.visible');
      cy.contains('Last used').should('be.visible');
      cy.contains('Never used').should('be.visible');
    });

    it('should handle API key creation', () => {
      // Create new API key
      cy.get('button').contains('Create API Key').click();

      // Fill creation form
      cy.get('input[name="keyName"]').type('Test API Key');
      cy.get('textarea[name="description"]').type('For testing purposes');

      // Mock creation API
      cy.intercept('POST', '**/api-keys', {
        statusCode: 201,
        body: {
          id: 'key-new',
          name: 'Test API Key',
          key: 'eliza_test_1234567890abcdef',
        },
      }).as('createApiKey');

      cy.get('button[type="submit"]').click();
      cy.wait('@createApiKey');

      // Should show the new key (one time only)
      cy.contains('Your new API key').should('be.visible');
      cy.contains('eliza_test_1234567890abcdef').should('be.visible');
      cy.get('button').contains('Copy Key').should('be.visible');
    });

    it('should handle API key regeneration', () => {
      // Regenerate key
      cy.get('[data-key-id="key-1"]').within(() => {
        cy.get('button').contains('Regenerate').click();
      });

      // Confirm regeneration
      cy.get('[data-cy="confirm-regenerate"]').click();

      // Mock regeneration API
      cy.intercept('POST', '**/api-keys/key-1/regenerate', {
        statusCode: 200,
        body: {
          key: 'eliza_prod_new1234567890abcdef',
        },
      }).as('regenerateApiKey');

      cy.wait('@regenerateApiKey');

      // Should show the new key
      cy.contains('eliza_prod_new1234567890abcdef').should('be.visible');
    });

    it('should handle API key deletion', () => {
      // Delete key
      cy.get('[data-key-id="key-2"]').within(() => {
        cy.get('button').contains('Delete').click();
      });

      // Confirm deletion
      cy.get('[data-cy="confirm-delete"]').click();

      // Mock deletion API
      cy.intercept('DELETE', '**/api-keys/key-2', {
        statusCode: 200,
        body: { success: true },
      }).as('deleteApiKey');

      cy.wait('@deleteApiKey');

      // Key should be removed from list
      cy.contains('Development Key').should('not.exist');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle billing API errors', () => {
      cy.intercept('GET', '**/billing/overview', {
        statusCode: 500,
        body: { error: 'Billing service unavailable' },
      }).as('billingError');

      cy.visit('/dashboard/billing');
      cy.wait(['@authCheck', '@billingError']);

      // Should show error state
      cy.contains('Error loading billing information').should('be.visible');
      cy.get('button').contains('Retry').should('be.visible');
    });

    it('should handle payment failures', () => {
      cy.visit('/dashboard/billing?add-credits=true');
      cy.wait('@authCheck');

      // Mock payment failure
      cy.intercept('POST', '**/billing/purchase-credits', {
        statusCode: 402,
        body: { error: 'Payment failed', code: 'card_declined' },
      }).as('paymentFailure');

      cy.get('[data-credits="1000"]').within(() => {
        cy.get('button').contains('Purchase').click();
      });

      cy.wait('@paymentFailure');

      // Should show payment error
      cy.contains('Payment failed').should('be.visible');
      cy.contains('card declined').should('be.visible');
    });

    it('should handle subscription status edge cases', () => {
      // Mock past due subscription
      cy.intercept('GET', '**/auth/identity', {
        statusCode: 200,
        body: {
          user: {
            id: 'test-user-id',
            email: 'test@elizaos.ai',
            subscription: {
              plan: 'production',
              status: 'past_due',
              nextBilling: '2024-01-15T00:00:00Z',
            },
          },
        },
      }).as('pastDueUser');

      cy.visit('/dashboard/billing');
      cy.wait('@pastDueUser');

      // Should show past due warning
      cy.contains('Payment Past Due').should('be.visible');
      cy.contains('Update Payment Method').should('be.visible');
    });
  });

  describe('Responsive Design and Accessibility', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.visit('/dashboard/billing');
      cy.wait('@authCheck');

      // Billing cards should stack vertically
      cy.contains('Production Plan').should('be.visible');
      cy.contains('1,000 credits').should('be.visible');

      // Navigation should be accessible
      cy.get('button').contains('Add Credits').should('be.visible');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/settings/account');
      cy.wait('@authCheck');

      // Should be able to tab through form
      cy.get('input[name="name"]').focus().tab();
      cy.focused().should('have.attr', 'name', 'email');

      cy.tab();
      cy.focused().should('have.attr', 'name', 'timezone');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/dashboard/billing');
      cy.wait('@authCheck');

      // Plan cards should have proper labeling
      cy.get('[data-cy="current-plan"]')
        .should('have.attr', 'aria-label')
        .or('contain.text', 'Current plan');

      // Buttons should have accessible names
      cy.get('button').contains('Add Credits').should('be.visible');
    });
  });
});
