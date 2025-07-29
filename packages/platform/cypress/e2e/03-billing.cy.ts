/**
 * Billing E2E Tests
 * Tests billing system, payments, credits, and subscription management
 */

describe('Billing & Payments', () => {
  beforeEach(() => {
    // Setup authenticated user session
    cy.loginAsTestUser();
  });

  describe('Billing Dashboard', () => {
    beforeEach(() => {
      cy.visit('/dashboard/billing');
    });

    it('should display billing overview correctly', () => {
      cy.get('[data-testid="billing-dashboard"]').should('be.visible');
      cy.get('[data-testid="billing-title"]').should(
        'contain.text',
        'Billing & Usage',
      );

      // Credit balance section
      cy.get('[data-testid="credit-balance-card"]').should('be.visible');
      cy.get('[data-testid="current-balance"]').should('be.visible');
      cy.get('[data-testid="balance-amount"]').should(
        'match',
        /^\$\d+\.\d{2}$/,
      );

      // Usage overview
      cy.get('[data-testid="usage-overview"]').should('be.visible');
      cy.get('[data-testid="monthly-usage"]').should('be.visible');
      cy.get('[data-testid="api-calls-count"]').should('be.visible');
      cy.get('[data-testid="tokens-used"]').should('be.visible');
    });

    it('should display subscription information', () => {
      cy.get('[data-testid="subscription-card"]').should('be.visible');
      cy.get('[data-testid="current-plan"]').should('be.visible');
      cy.get('[data-testid="plan-name"]').should(
        'contain.text',
        /Free|Pro|Enterprise/,
      );

      // Plan limits
      cy.get('[data-testid="plan-limits"]').should('be.visible');
      cy.get('[data-testid="agent-limit"]').should('be.visible');
      cy.get('[data-testid="api-limit"]').should('be.visible');
      cy.get('[data-testid="storage-limit"]').should('be.visible');

      // Next billing date
      cy.get('[data-testid="next-billing-date"]').should('be.visible');
    });

    it('should show usage statistics with charts', () => {
      cy.get('[data-testid="usage-charts"]').should('be.visible');

      // Daily usage chart
      cy.get('[data-testid="daily-usage-chart"]').should('be.visible');
      cy.get('[data-testid="chart-canvas"]').should('exist');

      // Provider breakdown
      cy.get('[data-testid="provider-usage"]').should('be.visible');
      cy.get('[data-testid="provider-chart"]').should('be.visible');

      // Model usage breakdown
      cy.get('[data-testid="model-usage"]').should('be.visible');
      cy.get('[data-testid="model-list"]').should('be.visible');
    });

    it('should display recent transactions', () => {
      cy.get('[data-testid="transaction-history"]').should('be.visible');
      cy.get('[data-testid="transaction-title"]').should(
        'contain.text',
        'Recent Transactions',
      );

      cy.get('[data-testid="transaction-item"]').should('have.length.gte', 1);

      cy.get('[data-testid="transaction-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="transaction-date"]').should('be.visible');
          cy.get('[data-testid="transaction-type"]').should('be.visible');
          cy.get('[data-testid="transaction-amount"]').should('be.visible');
          cy.get('[data-testid="transaction-status"]').should('be.visible');
        });
    });

    it('should have working billing navigation', () => {
      cy.get('[data-testid="billing-nav"]').should('be.visible');

      // Test tab navigation
      cy.get('[data-testid="nav-overview"]').should('have.class', 'active');

      cy.get('[data-testid="nav-credits"]').click();
      cy.get('[data-testid="nav-credits"]').should('have.class', 'active');
      cy.get('[data-testid="credits-section"]').should('be.visible');

      cy.get('[data-testid="nav-plans"]').click();
      cy.get('[data-testid="nav-plans"]').should('have.class', 'active');
      cy.get('[data-testid="plans-section"]').should('be.visible');

      cy.get('[data-testid="nav-history"]').click();
      cy.get('[data-testid="nav-history"]').should('have.class', 'active');
      cy.get('[data-testid="history-section"]').should('be.visible');
    });
  });

  describe('Credit Management', () => {
    beforeEach(() => {
      cy.visit('/dashboard/billing?tab=credits');
    });

    it('should display credit purchase options', () => {
      cy.get('[data-testid="credit-packages"]').should('be.visible');
      cy.get('[data-testid="package-title"]').should(
        'contain.text',
        'Purchase Credits',
      );

      // Should have multiple credit packages
      cy.get('[data-testid="credit-package"]').should('have.length.gte', 3);

      cy.get('[data-testid="credit-package"]').each(($package) => {
        cy.wrap($package).within(() => {
          cy.get('[data-testid="package-amount"]').should('be.visible');
          cy.get('[data-testid="package-price"]').should('be.visible');
          cy.get('[data-testid="package-bonus"]').should('be.visible');
          cy.get('[data-testid="purchase-button"]').should('be.visible');
        });
      });
    });

    it('should handle credit purchase with Stripe', () => {
      // Mock Stripe payment intent creation
      cy.intercept('POST', '/api/billing/payment-intent', {
        statusCode: 200,
        body: {
          clientSecret: 'pi_test_client_secret',
          amount: 5000,
          currency: 'usd',
        },
      }).as('createPaymentIntent');

      // Click on $50 credit package
      cy.get('[data-testid="credit-package"]')
        .contains('$50')
        .within(() => {
          cy.get('[data-testid="purchase-button"]').click();
        });

      cy.wait('@createPaymentIntent');

      // Should open Stripe payment modal
      cy.get('[data-testid="stripe-payment-modal"]').should('be.visible');
      cy.get('[data-testid="payment-amount"]').should('contain.text', '$50.00');

      // Fill payment form (mocked Stripe elements)
      cy.get('[data-testid="card-number-input"]').type('4242424242424242');
      cy.get('[data-testid="card-expiry-input"]').type('12/25');
      cy.get('[data-testid="card-cvc-input"]').type('123');
      cy.get('[data-testid="billing-name-input"]').type('John Doe');

      // Mock successful payment
      cy.intercept('POST', '/api/billing/confirm-payment', {
        statusCode: 200,
        body: {
          success: true,
          transactionId: 'txn_test_123',
          creditsAdded: 50,
        },
      }).as('confirmPayment');

      cy.get('[data-testid="submit-payment"]').click();
      cy.wait('@confirmPayment');

      // Should show success message
      cy.get('[data-testid="payment-success"]').should('be.visible');
      cy.get('[data-testid="success-message"]').should(
        'contain.text',
        '50 credits added',
      );

      // Should update balance
      cy.get('[data-testid="current-balance"]').should('contain.text', '$50');
    });

    it('should handle payment failures gracefully', () => {
      cy.intercept('POST', '/api/billing/payment-intent', {
        statusCode: 200,
        body: {
          clientSecret: 'pi_test_client_secret',
          amount: 2500,
          currency: 'usd',
        },
      }).as('createPaymentIntent');

      cy.get('[data-testid="credit-package"]')
        .contains('$25')
        .within(() => {
          cy.get('[data-testid="purchase-button"]').click();
        });

      cy.wait('@createPaymentIntent');

      // Fill invalid card
      cy.get('[data-testid="card-number-input"]').type('4000000000000002'); // Declined card
      cy.get('[data-testid="card-expiry-input"]').type('12/25');
      cy.get('[data-testid="card-cvc-input"]').type('123');
      cy.get('[data-testid="billing-name-input"]').type('John Doe');

      // Mock payment failure
      cy.intercept('POST', '/api/billing/confirm-payment', {
        statusCode: 400,
        body: {
          error: 'Your card was declined',
          code: 'card_declined',
        },
      }).as('failedPayment');

      cy.get('[data-testid="submit-payment"]').click();
      cy.wait('@failedPayment');

      // Should show error message
      cy.get('[data-testid="payment-error"]').should('be.visible');
      cy.get('[data-testid="error-message"]').should(
        'contain.text',
        'card was declined',
      );

      // Should allow retry
      cy.get('[data-testid="retry-payment"]').should('be.visible');
    });

    it('should display auto top-up settings', () => {
      cy.get('[data-testid="auto-topup-section"]').should('be.visible');
      cy.get('[data-testid="auto-topup-title"]').should(
        'contain.text',
        'Auto Top-up',
      );

      cy.get('[data-testid="auto-topup-toggle"]').should('be.visible');
      cy.get('[data-testid="topup-threshold"]').should('be.visible');
      cy.get('[data-testid="topup-amount"]').should('be.visible');
    });

    it('should configure auto top-up settings', () => {
      // Enable auto top-up
      cy.get('[data-testid="auto-topup-toggle"]').should('not.be.checked');
      cy.get('[data-testid="auto-topup-toggle"]').click();
      cy.get('[data-testid="auto-topup-toggle"]').should('be.checked');

      // Set threshold
      cy.get('[data-testid="topup-threshold"]').clear().type('10');
      cy.get('[data-testid="topup-amount"]').clear().type('25');

      // Mock save settings
      cy.intercept('PUT', '/api/billing/auto-topup', {
        statusCode: 200,
        body: { success: true },
      }).as('saveAutoTopup');

      cy.get('[data-testid="save-auto-topup"]').click();
      cy.wait('@saveAutoTopup');

      cy.get('[data-testid="settings-saved"]').should('be.visible');
    });

    it('should show credit usage analytics', () => {
      cy.get('[data-testid="credit-analytics"]').should('be.visible');

      // Daily burn rate
      cy.get('[data-testid="burn-rate-chart"]').should('be.visible');
      cy.get('[data-testid="daily-average"]').should('be.visible');
      cy.get('[data-testid="projected-duration"]').should('be.visible');

      // Usage by service
      cy.get('[data-testid="service-breakdown"]').should('be.visible');
      cy.get('[data-testid="service-item"]').should('have.length.gte', 1);

      cy.get('[data-testid="service-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="service-name"]').should('be.visible');
          cy.get('[data-testid="service-cost"]').should('be.visible');
          cy.get('[data-testid="service-percentage"]').should('be.visible');
        });
    });
  });

  describe('Subscription Plans', () => {
    beforeEach(() => {
      cy.visit('/dashboard/billing?tab=plans');
    });

    it('should display available subscription plans', () => {
      cy.get('[data-testid="subscription-plans"]').should('be.visible');
      cy.get('[data-testid="plans-title"]').should(
        'contain.text',
        'Subscription Plans',
      );

      // Should show current plan
      cy.get('[data-testid="current-plan-indicator"]').should('be.visible');

      // Should have all plan tiers
      cy.get('[data-testid="plan-card"]').should('have.length', 3);

      // Check plan details
      cy.get('[data-testid="plan-card"]').each(($card) => {
        cy.wrap($card).within(() => {
          cy.get('[data-testid="plan-name"]').should('be.visible');
          cy.get('[data-testid="plan-price"]').should('be.visible');
          cy.get('[data-testid="plan-features"]').should('be.visible');
          cy.get('[data-testid="plan-cta"]').should('be.visible');
        });
      });
    });

    it('should handle plan upgrade', () => {
      // Click upgrade to Pro plan
      cy.get('[data-testid="plan-card"]')
        .contains('Pro')
        .within(() => {
          cy.get('[data-testid="plan-cta"]').click();
        });

      // Should show upgrade confirmation
      cy.get('[data-testid="upgrade-modal"]').should('be.visible');
      cy.get('[data-testid="upgrade-details"]').should('be.visible');
      cy.get('[data-testid="upgrade-price"]').should(
        'contain.text',
        '$29/month',
      );

      // Mock plan upgrade
      cy.intercept('POST', '/api/billing/upgrade-plan', {
        statusCode: 200,
        body: {
          success: true,
          subscriptionId: 'sub_test_123',
          planName: 'Pro',
        },
      }).as('upgradePlan');

      cy.get('[data-testid="confirm-upgrade"]').click();
      cy.wait('@upgradePlan');

      // Should show success and update UI
      cy.get('[data-testid="upgrade-success"]').should('be.visible');
      cy.get('[data-testid="current-plan-indicator"]').should(
        'contain.text',
        'Pro',
      );
    });

    it('should handle plan downgrade', () => {
      // Assume user is on Pro plan
      cy.get('[data-testid="plan-card"]')
        .contains('Free')
        .within(() => {
          cy.get('[data-testid="plan-cta"]')
            .should('contain.text', 'Downgrade')
            .click();
        });

      // Should show downgrade warning
      cy.get('[data-testid="downgrade-modal"]').should('be.visible');
      cy.get('[data-testid="downgrade-warning"]').should('be.visible');
      cy.get('[data-testid="feature-loss-list"]').should('be.visible');

      // Mock plan downgrade
      cy.intercept('POST', '/api/billing/downgrade-plan', {
        statusCode: 200,
        body: {
          success: true,
          effectiveDate: '2024-02-01',
          planName: 'Free',
        },
      }).as('downgradePlan');

      cy.get('[data-testid="confirm-downgrade"]').click();
      cy.wait('@downgradePlan');

      cy.get('[data-testid="downgrade-scheduled"]').should('be.visible');
    });

    it('should display plan comparison', () => {
      cy.get('[data-testid="compare-plans"]').click();

      cy.get('[data-testid="comparison-modal"]').should('be.visible');
      cy.get('[data-testid="comparison-table"]').should('be.visible');

      // Check feature comparison
      cy.get('[data-testid="feature-row"]').should('have.length.gte', 5);

      cy.get('[data-testid="feature-row"]').each(($row) => {
        cy.wrap($row).within(() => {
          cy.get('[data-testid="feature-name"]').should('be.visible');
          cy.get('[data-testid="free-check"]').should('exist');
          cy.get('[data-testid="pro-check"]').should('exist');
          cy.get('[data-testid="enterprise-check"]').should('exist');
        });
      });
    });

    it('should handle enterprise plan inquiry', () => {
      cy.get('[data-testid="plan-card"]')
        .contains('Enterprise')
        .within(() => {
          cy.get('[data-testid="plan-cta"]')
            .should('contain.text', 'Contact Sales')
            .click();
        });

      // Should open contact form
      cy.get('[data-testid="enterprise-contact-modal"]').should('be.visible');

      cy.get('[data-testid="company-name"]').type('Acme Corp');
      cy.get('[data-testid="contact-email"]').type('sales@acme.com');
      cy.get('[data-testid="team-size"]').select('50-100');
      cy.get('[data-testid="use-case"]').type(
        'Large scale AI agent deployment',
      );

      // Mock contact submission
      cy.intercept('POST', '/api/billing/enterprise-inquiry', {
        statusCode: 200,
        body: { success: true, ticketId: 'ENT-123' },
      }).as('enterpriseInquiry');

      cy.get('[data-testid="submit-inquiry"]').click();
      cy.wait('@enterpriseInquiry');

      cy.get('[data-testid="inquiry-success"]').should('be.visible');
      cy.get('[data-testid="ticket-id"]').should('contain.text', 'ENT-123');
    });
  });

  describe('Billing History', () => {
    beforeEach(() => {
      cy.visit('/dashboard/billing?tab=history');
    });

    it('should display transaction history', () => {
      cy.get('[data-testid="billing-history"]').should('be.visible');
      cy.get('[data-testid="history-title"]').should(
        'contain.text',
        'Billing History',
      );

      // Filters
      cy.get('[data-testid="date-filter"]').should('be.visible');
      cy.get('[data-testid="type-filter"]').should('be.visible');
      cy.get('[data-testid="status-filter"]').should('be.visible');

      // Transaction table
      cy.get('[data-testid="transaction-table"]').should('be.visible');
      cy.get('[data-testid="table-header"]').should('be.visible');

      // Transaction rows
      cy.get('[data-testid="transaction-row"]').should('have.length.gte', 1);

      cy.get('[data-testid="transaction-row"]')
        .first()
        .within(() => {
          cy.get('[data-testid="transaction-date"]').should('be.visible');
          cy.get('[data-testid="transaction-type"]').should('be.visible');
          cy.get('[data-testid="transaction-description"]').should(
            'be.visible',
          );
          cy.get('[data-testid="transaction-amount"]').should('be.visible');
          cy.get('[data-testid="transaction-status"]').should('be.visible');
          cy.get('[data-testid="download-receipt"]').should('be.visible');
        });
    });

    it('should filter transactions by date range', () => {
      // Set date filter
      cy.get('[data-testid="date-filter"]').click();
      cy.get('[data-testid="date-preset-30d"]').click();

      // Should update URL and table
      cy.url().should('include', 'period=30d');

      // Check that all transactions are within 30 days
      cy.get('[data-testid="transaction-row"]').each(($row) => {
        cy.wrap($row).within(() => {
          cy.get('[data-testid="transaction-date"]')
            .invoke('text')
            .then((dateText) => {
              const transactionDate = new Date(dateText);
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              expect(transactionDate).to.be.gte(thirtyDaysAgo);
            });
        });
      });
    });

    it('should filter transactions by type', () => {
      cy.get('[data-testid="type-filter"]').select('purchase');
      cy.url().should('include', 'type=purchase');

      // All visible transactions should be purchases
      cy.get('[data-testid="transaction-row"]').each(($row) => {
        cy.wrap($row).within(() => {
          cy.get('[data-testid="transaction-type"]').should(
            'contain.text',
            'Purchase',
          );
        });
      });
    });

    it('should download receipt for transaction', () => {
      // Mock receipt download
      cy.intercept('GET', '/api/billing/receipt/*', {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="receipt.pdf"',
        },
        body: 'mock-pdf-content',
      }).as('downloadReceipt');

      cy.get('[data-testid="transaction-row"]')
        .first()
        .within(() => {
          cy.get('[data-testid="download-receipt"]').click();
        });

      cy.wait('@downloadReceipt');

      // Verify download was triggered
      cy.readFile('cypress/downloads/receipt.pdf').should('exist');
    });

    it('should show transaction details modal', () => {
      cy.get('[data-testid="transaction-row"]').first().click();

      cy.get('[data-testid="transaction-details-modal"]').should('be.visible');
      cy.get('[data-testid="detail-transaction-id"]').should('be.visible');
      cy.get('[data-testid="detail-payment-method"]').should('be.visible');
      cy.get('[data-testid="detail-billing-address"]').should('be.visible');
      cy.get('[data-testid="detail-line-items"]').should('be.visible');

      // Close modal
      cy.get('[data-testid="close-modal"]').click();
      cy.get('[data-testid="transaction-details-modal"]').should('not.exist');
    });

    it('should paginate through transaction history', () => {
      // Check pagination controls
      cy.get('[data-testid="pagination"]').should('be.visible');
      cy.get('[data-testid="page-info"]').should('contain.text', 'Page 1');

      // Go to next page
      cy.get('[data-testid="next-page"]').click();
      cy.get('[data-testid="page-info"]').should('contain.text', 'Page 2');

      // Go back to previous page
      cy.get('[data-testid="prev-page"]').click();
      cy.get('[data-testid="page-info"]').should('contain.text', 'Page 1');
    });

    it('should export transaction history', () => {
      // Mock export
      cy.intercept('POST', '/api/billing/export', {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="transactions.csv"',
        },
        body: 'Date,Type,Amount,Status\n2024-01-15,Purchase,$50.00,Completed',
      }).as('exportTransactions');

      cy.get('[data-testid="export-button"]').click();
      cy.get('[data-testid="export-modal"]').should('be.visible');

      cy.get('[data-testid="export-format"]').select('csv');
      cy.get('[data-testid="confirm-export"]').click();

      cy.wait('@exportTransactions');
      cy.readFile('cypress/downloads/transactions.csv').should('exist');
    });
  });

  describe('Crypto Payments', () => {
    beforeEach(() => {
      cy.visit('/dashboard/billing?tab=credits');
    });

    it('should display crypto payment option', () => {
      cy.get('[data-testid="credit-package"]')
        .first()
        .within(() => {
          cy.get('[data-testid="purchase-button"]').click();
        });

      cy.get('[data-testid="payment-methods"]').should('be.visible');
      cy.get('[data-testid="payment-stripe"]').should('be.visible');
      cy.get('[data-testid="payment-crypto"]').should('be.visible');
    });

    it('should handle MetaMask crypto payment', () => {
      // Mock MetaMask availability
      cy.window().then((win) => {
        (win as any).ethereum = {
          isMetaMask: true,
          request: cy
            .stub()
            .resolves(['0x1234567890123456789012345678901234567890']),
          on: cy.stub(),
          removeListener: cy.stub(),
        };
      });

      cy.get('[data-testid="credit-package"]')
        .first()
        .within(() => {
          cy.get('[data-testid="purchase-button"]').click();
        });

      cy.get('[data-testid="payment-crypto"]').click();

      // Should show crypto payment details
      cy.get('[data-testid="crypto-payment-modal"]').should('be.visible');
      cy.get('[data-testid="payment-address"]').should('be.visible');
      cy.get('[data-testid="payment-amount"]').should('be.visible');
      cy.get('[data-testid="qr-code"]').should('be.visible');

      // Connect MetaMask
      cy.get('[data-testid="connect-metamask"]').click();

      // Mock transaction
      cy.window().then((win) => {
        (win as any).ethereum.request = cy
          .stub()
          .resolves('0xabcdef1234567890');
      });

      cy.get('[data-testid="send-transaction"]').click();

      // Mock transaction confirmation
      cy.intercept('POST', '/api/billing/crypto-payment', {
        statusCode: 200,
        body: {
          success: true,
          transactionHash: '0xabcdef1234567890',
          creditsAdded: 25,
        },
      }).as('cryptoPayment');

      cy.wait('@cryptoPayment');

      cy.get('[data-testid="crypto-success"]').should('be.visible');
      cy.get('[data-testid="transaction-hash"]').should(
        'contain.text',
        '0xabcdef',
      );
    });

    it('should handle crypto payment without MetaMask', () => {
      // Ensure no MetaMask
      cy.window().then((win) => {
        delete (win as any).ethereum;
      });

      cy.get('[data-testid="credit-package"]')
        .first()
        .within(() => {
          cy.get('[data-testid="purchase-button"]').click();
        });

      cy.get('[data-testid="payment-crypto"]').click();

      // Should show manual payment instructions
      cy.get('[data-testid="manual-crypto-payment"]').should('be.visible');
      cy.get('[data-testid="payment-address"]').should('be.visible');
      cy.get('[data-testid="copy-address"]').click();

      // Should copy to clipboard
      cy.window()
        .its('navigator.clipboard')
        .invoke('readText')
        .should('contain', '0x');

      // Manual verification
      cy.get('[data-testid="manual-verification"]').should('be.visible');
      cy.get('[data-testid="transaction-hash-input"]').type(
        '0xabcdef1234567890',
      );
      cy.get('[data-testid="verify-transaction"]').click();

      // Mock verification
      cy.intercept('POST', '/api/billing/verify-crypto', {
        statusCode: 200,
        body: { success: true, verified: true, creditsAdded: 25 },
      }).as('verifyTransaction');

      cy.wait('@verifyTransaction');
      cy.get('[data-testid="verification-success"]').should('be.visible');
    });
  });

  describe('Billing Settings', () => {
    beforeEach(() => {
      cy.visit('/dashboard/billing/settings');
    });

    it('should display billing information form', () => {
      cy.get('[data-testid="billing-settings"]').should('be.visible');
      cy.get('[data-testid="billing-info-form"]').should('be.visible');

      // Company information
      cy.get('[data-testid="company-name"]').should('be.visible');
      cy.get('[data-testid="tax-id"]').should('be.visible');

      // Billing address
      cy.get('[data-testid="billing-address"]').should('be.visible');
      cy.get('[data-testid="address-line1"]').should('be.visible');
      cy.get('[data-testid="city"]').should('be.visible');
      cy.get('[data-testid="country"]').should('be.visible');

      // Email preferences
      cy.get('[data-testid="billing-email"]').should('be.visible');
      cy.get('[data-testid="invoice-notifications"]').should('be.visible');
    });

    it('should update billing information', () => {
      cy.get('[data-testid="company-name"]').clear().type('Acme Corporation');
      cy.get('[data-testid="tax-id"]').clear().type('123-45-6789');
      cy.get('[data-testid="address-line1"]').clear().type('123 Main St');
      cy.get('[data-testid="city"]').clear().type('San Francisco');
      cy.get('[data-testid="country"]').select('US');

      // Mock save
      cy.intercept('PUT', '/api/billing/settings', {
        statusCode: 200,
        body: { success: true },
      }).as('saveBillingInfo');

      cy.get('[data-testid="save-billing-info"]').click();
      cy.wait('@saveBillingInfo');

      cy.get('[data-testid="save-success"]').should('be.visible');
    });

    it('should manage payment methods', () => {
      cy.get('[data-testid="payment-methods-section"]').should('be.visible');
      cy.get('[data-testid="payment-methods-title"]').should(
        'contain.text',
        'Payment Methods',
      );

      // Add new payment method
      cy.get('[data-testid="add-payment-method"]').click();
      cy.get('[data-testid="payment-method-modal"]').should('be.visible');

      // Fill card details
      cy.get('[data-testid="card-number"]').type('4242424242424242');
      cy.get('[data-testid="expiry"]').type('12/25');
      cy.get('[data-testid="cvc"]').type('123');
      cy.get('[data-testid="cardholder-name"]').type('John Doe');

      // Mock save payment method
      cy.intercept('POST', '/api/billing/payment-methods', {
        statusCode: 200,
        body: {
          id: 'pm_test_123',
          last4: '4242',
          brand: 'visa',
        },
      }).as('savePaymentMethod');

      cy.get('[data-testid="save-payment-method"]').click();
      cy.wait('@savePaymentMethod');

      // Should show in payment methods list
      cy.get('[data-testid="payment-method-item"]').should(
        'contain.text',
        '**** 4242',
      );
    });

    it('should set default payment method', () => {
      cy.get('[data-testid="payment-method-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="set-default"]').click();
        });

      // Mock set default
      cy.intercept('PUT', '/api/billing/payment-methods/*/default', {
        statusCode: 200,
        body: { success: true },
      }).as('setDefault');

      cy.wait('@setDefault');

      cy.get('[data-testid="payment-method-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="default-badge"]').should('be.visible');
        });
    });

    it('should delete payment method', () => {
      cy.get('[data-testid="payment-method-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="delete-payment-method"]').click();
        });

      cy.get('[data-testid="delete-confirmation"]').should('be.visible');
      cy.get('[data-testid="confirm-delete"]').click();

      // Mock delete
      cy.intercept('DELETE', '/api/billing/payment-methods/*', {
        statusCode: 200,
        body: { success: true },
      }).as('deletePaymentMethod');

      cy.wait('@deletePaymentMethod');

      cy.get('[data-testid="delete-success"]').should('be.visible');
    });
  });

  describe('Invoice Management', () => {
    beforeEach(() => {
      cy.visit('/dashboard/billing/invoices');
    });

    it('should display invoice list', () => {
      cy.get('[data-testid="invoice-list"]').should('be.visible');
      cy.get('[data-testid="invoice-title"]').should(
        'contain.text',
        'Invoices',
      );

      cy.get('[data-testid="invoice-item"]').should('have.length.gte', 1);

      cy.get('[data-testid="invoice-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="invoice-number"]').should('be.visible');
          cy.get('[data-testid="invoice-date"]').should('be.visible');
          cy.get('[data-testid="invoice-amount"]').should('be.visible');
          cy.get('[data-testid="invoice-status"]').should('be.visible');
          cy.get('[data-testid="download-invoice"]').should('be.visible');
        });
    });

    it('should download invoice PDF', () => {
      // Mock invoice download
      cy.intercept('GET', '/api/billing/invoices/*/download', {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="invoice.pdf"',
        },
        body: 'mock-invoice-pdf',
      }).as('downloadInvoice');

      cy.get('[data-testid="invoice-item"]')
        .first()
        .within(() => {
          cy.get('[data-testid="download-invoice"]').click();
        });

      cy.wait('@downloadInvoice');
      cy.readFile('cypress/downloads/invoice.pdf').should('exist');
    });

    it('should view invoice details', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.get('[data-testid="invoice-details-modal"]').should('be.visible');
      cy.get('[data-testid="invoice-header"]').should('be.visible');
      cy.get('[data-testid="billing-address"]').should('be.visible');
      cy.get('[data-testid="line-items"]').should('be.visible');
      cy.get('[data-testid="invoice-total"]').should('be.visible');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', () => {
      // Mock network error
      cy.intercept('GET', '/api/billing/overview', { forceNetworkError: true });

      cy.visit('/dashboard/billing');

      cy.get('[data-testid="network-error"]').should('be.visible');
      cy.get('[data-testid="retry-button"]').should('be.visible');

      // Test retry
      cy.intercept('GET', '/api/billing/overview', {
        statusCode: 200,
        body: { creditBalance: 25.5, usage: {} },
      });

      cy.get('[data-testid="retry-button"]').click();
      cy.get('[data-testid="billing-dashboard"]').should('be.visible');
    });

    it('should handle insufficient funds for usage', () => {
      // Mock low balance scenario
      cy.intercept('GET', '/api/billing/overview', {
        statusCode: 200,
        body: {
          creditBalance: 0.5,
          lowBalanceWarning: true,
        },
      });

      cy.visit('/dashboard/billing');

      cy.get('[data-testid="low-balance-warning"]').should('be.visible');
      cy.get('[data-testid="add-credits-cta"]').should('be.visible');
    });

    it('should handle failed auto top-up', () => {
      // Mock failed auto top-up notification
      cy.intercept('GET', '/api/billing/notifications', {
        statusCode: 200,
        body: {
          notifications: [
            {
              type: 'auto_topup_failed',
              message: 'Auto top-up failed: Card declined',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });

      cy.visit('/dashboard/billing');

      cy.get('[data-testid="notification-banner"]').should('be.visible');
      cy.get('[data-testid="notification-message"]').should(
        'contain.text',
        'Auto top-up failed',
      );
      cy.get('[data-testid="update-payment-method"]').should('be.visible');
    });
  });
});
