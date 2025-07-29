/**
 * Complete Billing & Payment Management E2E Test
 * Tests billing settings, payment methods, auto-recharge, and payment flows
 */

describe('Billing & Payment Complete Management Test', () => {
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
          id: 'billing-test-user',
          email: 'billing@elizaos.ai',
          firstName: 'Billing',
          lastName: 'Test',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'billing-org-123',
          name: 'Billing Test Org',
          slug: 'billing-test',
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

    // Mock billing settings
    cy.intercept('GET', '**/api/v1/billing/settings', {
      statusCode: 200,
      body: {
        autoRecharge: {
          enabled: true,
          threshold: 10,
          amount: 50,
        },
        usageAlerts: {
          enabled: true,
          thresholds: [50, 80, 95],
        },
        billingContact: {
          email: 'billing@company.com',
          name: 'John Doe',
          company: 'Test Corp',
          address: {
            line1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'US',
          },
        },
        invoiceSettings: {
          frequency: 'monthly',
          autoDownload: false,
          emailCopy: true,
        },
        spendingLimits: {
          daily: 100,
          monthly: 1000,
          enabled: true,
        },
      },
    }).as('getBillingSettings');

    // Mock payment methods
    cy.intercept('GET', '**/api/v1/billing/payment-methods', {
      statusCode: 200,
      body: {
        paymentMethods: [
          {
            id: 'pm_1',
            type: 'card',
            brand: 'visa',
            last4: '4242',
            expiryMonth: 12,
            expiryYear: 2025,
            isDefault: true,
            createdAt: '2024-01-15T10:00:00Z',
          },
          {
            id: 'pm_2',
            type: 'card',
            brand: 'mastercard',
            last4: '5555',
            expiryMonth: 8,
            expiryYear: 2026,
            isDefault: false,
            createdAt: '2024-01-10T14:30:00Z',
          },
        ],
      },
    }).as('getPaymentMethods');
  });

  it('Billing Settings Page - Complete Layout Test', () => {
    cy.log('💳 Testing Complete Billing Settings Layout');

    // ==========================================
    // STEP 1: Visit Billing Settings Page
    // ==========================================
    cy.log('📋 Step 1: Visit Billing Settings Page');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettings');
    cy.wait('@getPaymentMethods');

    // Verify page structure
    cy.get('[data-cy="billing-settings-page"]').should('be.visible');
    cy.get('[data-cy="billing-title"]')
      .should('be.visible')
      .and('contain.text', 'Billing Settings');
    cy.get('[data-cy="billing-subtitle"]')
      .should('be.visible')
      .and('contain.text', 'payment methods');

    // ==========================================
    // STEP 2: Test Payment Methods Section
    // ==========================================
    cy.log('💳 Step 2: Test Payment Methods Section');

    cy.get('[data-cy="payment-methods-section"]').should('be.visible');
    cy.get('[data-cy="payment-methods-title"]')
      .should('be.visible')
      .and('contain.text', 'Payment Methods');
    cy.get('[data-cy="add-payment-method"]')
      .should('be.visible')
      .and('contain.text', 'Add Payment Method');

    // Verify payment method list
    cy.get('[data-cy="payment-methods-list"]').should('be.visible');
    cy.get('[data-cy="payment-method-pm_1"]').should('be.visible');
    cy.get('[data-cy="payment-method-pm_2"]').should('be.visible');

    // Test default payment method
    cy.get('[data-cy="payment-method-pm_1"]').within(() => {
      cy.contains('VISA').should('be.visible');
      cy.contains('4242').should('be.visible');
      cy.contains('Default').should('be.visible');
      cy.contains('12/2025').should('be.visible');
    });

    // Test non-default payment method actions
    cy.get('[data-cy="payment-method-pm_2"]').within(() => {
      cy.contains('MASTERCARD').should('be.visible');
      cy.contains('5555').should('be.visible');
      cy.get('[data-cy="set-default-pm_2"]').should('be.visible');
      cy.get('[data-cy="delete-payment-pm_2"]').should('be.visible');
    });

    // ==========================================
    // STEP 3: Test Auto-Recharge Settings
    // ==========================================
    cy.log('🔄 Step 3: Test Auto-Recharge Settings');

    cy.get('[data-cy="auto-recharge-section"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-title"]')
      .should('be.visible')
      .and('contain.text', 'Auto-Recharge');

    // Test auto-recharge toggle
    cy.get('[data-cy="auto-recharge-toggle"]').should('be.checked');

    // Test threshold and amount inputs
    cy.get('[data-cy="auto-recharge-threshold"]')
      .should('be.visible')
      .and('have.value', '10');
    cy.get('[data-cy="auto-recharge-amount"]')
      .should('be.visible')
      .and('have.value', '50');

    // ==========================================
    // STEP 4: Test Save Settings
    // ==========================================
    cy.log('💾 Step 4: Test Save Settings');

    cy.get('[data-cy="save-billing-settings"]')
      .should('be.visible')
      .and('contain.text', 'Save Billing Settings');

    cy.log('✅ Billing Settings Layout Test Complete!');
  });

  it('Payment Methods - Add & Manage Test', () => {
    cy.log('💳 Testing Payment Methods Management');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettings');
    cy.wait('@getPaymentMethods');

    // ==========================================
    // STEP 1: Open Add Payment Method Modal
    // ==========================================
    cy.log('➕ Step 1: Open Add Payment Method Modal');

    cy.get('[data-cy="add-payment-method"]').click();
    cy.get('[data-cy="payment-method-modal"]').should('be.visible');
    cy.get('[data-cy="payment-modal-title"]')
      .should('be.visible')
      .and('contain.text', 'Add Payment Method');

    // ==========================================
    // STEP 2: Test Payment Form Elements
    // ==========================================
    cy.log('📝 Step 2: Test Payment Form Elements');

    // Test form fields
    cy.get('[data-cy="card-number"]').should('be.visible');
    cy.get('[data-cy="card-expiry"]').should('be.visible');
    cy.get('[data-cy="card-cvc"]').should('be.visible');
    cy.get('[data-cy="cardholder-name"]').should('be.visible');

    // Test buttons
    cy.get('[data-cy="save-payment-method"]')
      .should('be.visible')
      .and('contain.text', 'Add Payment Method');
    cy.get('[data-cy="cancel-payment-method"]')
      .should('be.visible')
      .and('contain.text', 'Cancel');

    // ==========================================
    // STEP 3: Fill Payment Form
    // ==========================================
    cy.log('📝 Step 3: Fill Payment Form');

    cy.get('[data-cy="card-number"]').type('4242424242424242');
    cy.get('[data-cy="card-expiry"]').type('12/27');
    cy.get('[data-cy="card-cvc"]').type('123');
    cy.get('[data-cy="cardholder-name"]').type('Test User');

    // ==========================================
    // STEP 4: Test Add Payment Method
    // ==========================================
    cy.log('💳 Step 4: Test Add Payment Method');

    // Mock successful payment method addition
    cy.intercept('POST', '**/api/v1/billing/payment-methods', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'pm_new_123',
          last4: '4242',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2027,
          isDefault: false,
        },
      },
    }).as('addPaymentMethod');

    cy.get('[data-cy="save-payment-method"]').click();
    cy.wait('@addPaymentMethod');

    // Modal should close
    cy.get('[data-cy="payment-method-modal"]').should('not.exist');

    // ==========================================
    // STEP 5: Test Set Default Payment Method
    // ==========================================
    cy.log('⭐ Step 5: Test Set Default Payment Method');

    // Mock setting default payment method
    cy.intercept('PATCH', '**/api/v1/billing/payment-methods/pm_2/default', {
      statusCode: 200,
      body: { success: true },
    }).as('setDefaultPayment');

    cy.get('[data-cy="set-default-pm_2"]').click();
    cy.wait('@setDefaultPayment');

    // ==========================================
    // STEP 6: Test Delete Payment Method
    // ==========================================
    cy.log('🗑️ Step 6: Test Delete Payment Method');

    // Mock payment method deletion
    cy.intercept('DELETE', '**/api/v1/billing/payment-methods/pm_2', {
      statusCode: 200,
      body: { success: true },
    }).as('deletePaymentMethod');

    // Use window.confirm stub
    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true);
    });

    cy.get('[data-cy="delete-payment-pm_2"]').click();
    cy.wait('@deletePaymentMethod');

    // ==========================================
    // STEP 7: Test Cancel Add Payment
    // ==========================================
    cy.log('❌ Step 7: Test Cancel Add Payment');

    cy.get('[data-cy="add-payment-method"]').click();
    cy.get('[data-cy="payment-method-modal"]').should('be.visible');
    cy.get('[data-cy="cancel-payment-method"]').click();
    cy.get('[data-cy="payment-method-modal"]').should('not.exist');

    cy.log('✅ Payment Methods Management Test Complete!');
  });

  it('Auto-Recharge Settings - Configuration Test', () => {
    cy.log('🔄 Testing Auto-Recharge Configuration');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettings');
    cy.wait('@getPaymentMethods');

    // ==========================================
    // STEP 1: Test Auto-Recharge Toggle
    // ==========================================
    cy.log('🔄 Step 1: Test Auto-Recharge Toggle');

    // Should be enabled by default
    cy.get('[data-cy="auto-recharge-toggle"]').should('be.checked');

    // Threshold and amount inputs should be visible
    cy.get('[data-cy="auto-recharge-threshold"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-amount"]').should('be.visible');

    // Toggle off
    cy.get('[data-cy="auto-recharge-toggle"]').uncheck();
    cy.get('[data-cy="auto-recharge-toggle"]').should('not.be.checked');

    // Inputs should be hidden when disabled
    cy.get('[data-cy="auto-recharge-threshold"]').should('not.exist');
    cy.get('[data-cy="auto-recharge-amount"]').should('not.exist');

    // Toggle back on
    cy.get('[data-cy="auto-recharge-toggle"]').check();
    cy.get('[data-cy="auto-recharge-toggle"]').should('be.checked');

    // ==========================================
    // STEP 2: Test Threshold Configuration
    // ==========================================
    cy.log('💰 Step 2: Test Threshold Configuration');

    // Test threshold input
    cy.get('[data-cy="auto-recharge-threshold"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-threshold"]').clear().type('25');
    cy.get('[data-cy="auto-recharge-threshold"]').should('have.value', '25');

    // ==========================================
    // STEP 3: Test Amount Configuration
    // ==========================================
    cy.log('💵 Step 3: Test Amount Configuration');

    // Test amount input
    cy.get('[data-cy="auto-recharge-amount"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-amount"]').clear().type('100');
    cy.get('[data-cy="auto-recharge-amount"]').should('have.value', '100');

    // ==========================================
    // STEP 4: Test Save Settings
    // ==========================================
    cy.log('💾 Step 4: Test Save Settings');

    // Mock saving settings
    cy.intercept('PATCH', '**/api/v1/billing/settings', {
      statusCode: 200,
      body: { success: true },
    }).as('saveBillingSettings');

    cy.get('[data-cy="save-billing-settings"]').click();
    cy.wait('@saveBillingSettings');

    cy.log('✅ Auto-Recharge Configuration Test Complete!');
  });

  it('Billing Settings - Error Handling Test', () => {
    cy.log('❌ Testing Billing Settings Error Handling');

    // ==========================================
    // STEP 1: Test Settings Load Error
    // ==========================================
    cy.log('❌ Step 1: Test Settings Load Error');

    cy.intercept('GET', '**/api/v1/billing/settings', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('getBillingSettingsError');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettingsError');

    // Should show error state or fallback
    cy.contains('Failed to load billing settings').should('be.visible');

    // ==========================================
    // STEP 2: Test Payment Methods Load Error
    // ==========================================
    cy.log('❌ Step 2: Test Payment Methods Load Error');

    // Reset settings but fail payment methods
    cy.intercept('GET', '**/api/v1/billing/settings', {
      statusCode: 200,
      body: {
        autoRecharge: { enabled: false, threshold: 10, amount: 50 },
        usageAlerts: { enabled: false, thresholds: [] },
        billingContact: { email: '', name: '' },
        invoiceSettings: {
          frequency: 'monthly',
          autoDownload: false,
          emailCopy: false,
        },
        spendingLimits: { enabled: false },
      },
    }).as('getBillingSettingsFixed');

    cy.intercept('GET', '**/api/v1/billing/payment-methods', {
      statusCode: 500,
      body: { error: 'Payment methods unavailable' },
    }).as('getPaymentMethodsError');

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettingsFixed');
    cy.wait('@getPaymentMethodsError');

    // Should still show page structure
    cy.get('[data-cy="billing-settings-page"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Add Payment Method Error
    // ==========================================
    cy.log('❌ Step 3: Test Add Payment Method Error');

    // Reset payment methods to working state
    cy.intercept('GET', '**/api/v1/billing/payment-methods', {
      statusCode: 200,
      body: { paymentMethods: [] },
    }).as('getPaymentMethodsEmpty');

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettingsFixed');
    cy.wait('@getPaymentMethodsEmpty');

    // Try to add payment method with error
    cy.get('[data-cy="add-payment-method"]').click();
    cy.get('[data-cy="card-number"]').type('4000000000000002'); // Declined card
    cy.get('[data-cy="card-expiry"]').type('12/27');
    cy.get('[data-cy="card-cvc"]').type('123');
    cy.get('[data-cy="cardholder-name"]').type('Test User');

    // Mock payment method error
    cy.intercept('POST', '**/api/v1/billing/payment-methods', {
      statusCode: 400,
      body: { error: 'Card was declined' },
    }).as('addPaymentMethodError');

    cy.get('[data-cy="save-payment-method"]').click();
    cy.wait('@addPaymentMethodError');

    // Should stay in modal
    cy.get('[data-cy="payment-method-modal"]').should('be.visible');

    // ==========================================
    // STEP 4: Test Save Settings Error
    // ==========================================
    cy.log('❌ Step 4: Test Save Settings Error');

    cy.get('[data-cy="cancel-payment-method"]').click();

    // Mock save settings error
    cy.intercept('PATCH', '**/api/v1/billing/settings', {
      statusCode: 500,
      body: { error: 'Failed to save settings' },
    }).as('saveBillingSettingsError');

    cy.get('[data-cy="save-billing-settings"]').click();
    cy.wait('@saveBillingSettingsError');

    // Should show error but page should remain functional
    cy.get('[data-cy="billing-settings-page"]').should('be.visible');

    cy.log('✅ Billing Settings Error Handling Test Complete!');
  });

  it('Billing Settings - Responsive Design Test', () => {
    cy.log('📱 Testing Billing Settings Responsive Design');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettings');
    cy.wait('@getPaymentMethods');

    // ==========================================
    // STEP 1: Test Mobile Layout
    // ==========================================
    cy.log('📱 Step 1: Test Mobile Layout');

    cy.viewport('iphone-x');

    // Page should be visible and functional on mobile
    cy.get('[data-cy="billing-settings-page"]').should('be.visible');
    cy.get('[data-cy="billing-title"]').should('be.visible');

    // Payment methods section
    cy.get('[data-cy="payment-methods-section"]').should('be.visible');
    cy.get('[data-cy="add-payment-method"]').should('be.visible');

    // Auto-recharge section
    cy.get('[data-cy="auto-recharge-section"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-toggle"]').should('be.visible');

    // Save button
    cy.get('[data-cy="save-billing-settings"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Mobile Payment Modal
    // ==========================================
    cy.log('📱 Step 2: Test Mobile Payment Modal');

    cy.get('[data-cy="add-payment-method"]').click();
    cy.get('[data-cy="payment-method-modal"]').should('be.visible');

    // Form should be functional on mobile
    cy.get('[data-cy="card-number"]').should('be.visible');
    cy.get('[data-cy="card-expiry"]').should('be.visible');
    cy.get('[data-cy="card-cvc"]').should('be.visible');
    cy.get('[data-cy="cardholder-name"]').should('be.visible');

    // Buttons should be accessible
    cy.get('[data-cy="save-payment-method"]').should('be.visible');
    cy.get('[data-cy="cancel-payment-method"]').should('be.visible');

    cy.get('[data-cy="cancel-payment-method"]').click();

    // ==========================================
    // STEP 3: Test Tablet Layout
    // ==========================================
    cy.log('📱 Step 3: Test Tablet Layout');

    cy.viewport('ipad-2');

    // Should still be fully functional on tablet
    cy.get('[data-cy="billing-settings-page"]').should('be.visible');
    cy.get('[data-cy="payment-methods-section"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-section"]').should('be.visible');

    // Form inputs should be appropriately sized
    cy.get('[data-cy="auto-recharge-threshold"]').should('be.visible');
    cy.get('[data-cy="auto-recharge-amount"]').should('be.visible');

    // Reset to desktop
    cy.viewport(1280, 720);

    cy.log('✅ Billing Settings Responsive Design Test Complete!');
  });

  it('Billing Settings - Data Persistence Test', () => {
    cy.log('💾 Testing Billing Settings Data Persistence');

    cy.visit('/settings/billing', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getBillingSettings');
    cy.wait('@getPaymentMethods');

    // ==========================================
    // STEP 1: Modify Settings
    // ==========================================
    cy.log('✏️ Step 1: Modify Settings');

    // Change auto-recharge settings
    cy.get('[data-cy="auto-recharge-threshold"]').clear().type('15');
    cy.get('[data-cy="auto-recharge-amount"]').clear().type('75');

    // ==========================================
    // STEP 2: Save Settings
    // ==========================================
    cy.log('💾 Step 2: Save Settings');

    cy.intercept('PATCH', '**/api/v1/billing/settings', {
      statusCode: 200,
      body: { success: true },
    }).as('saveModifiedSettings');

    cy.get('[data-cy="save-billing-settings"]').click();
    cy.wait('@saveModifiedSettings');

    // ==========================================
    // STEP 3: Verify Persistence After Reload
    // ==========================================
    cy.log('🔄 Step 3: Verify Persistence After Reload');

    // Mock updated settings response
    cy.intercept('GET', '**/api/v1/billing/settings', {
      statusCode: 200,
      body: {
        autoRecharge: {
          enabled: true,
          threshold: 15, // Updated value
          amount: 75, // Updated value
        },
        usageAlerts: { enabled: true, thresholds: [50, 80, 95] },
        billingContact: {
          email: 'billing@company.com',
          name: 'John Doe',
          company: 'Test Corp',
        },
        invoiceSettings: {
          frequency: 'monthly',
          autoDownload: false,
          emailCopy: true,
        },
        spendingLimits: { daily: 100, monthly: 1000, enabled: true },
      },
    }).as('getUpdatedBillingSettings');

    cy.reload();
    cy.wait('@getIdentity');
    cy.wait('@getUpdatedBillingSettings');
    cy.wait('@getPaymentMethods');

    // Verify updated values are loaded
    cy.get('[data-cy="auto-recharge-threshold"]').should('have.value', '15');
    cy.get('[data-cy="auto-recharge-amount"]').should('have.value', '75');

    cy.log('✅ Billing Settings Data Persistence Test Complete!');
  });
});
