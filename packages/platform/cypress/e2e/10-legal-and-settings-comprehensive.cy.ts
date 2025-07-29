/**
 * Comprehensive Legal Pages and Settings Testing
 * Tests privacy policy, terms of service, account settings, and all settings workflows
 */

describe('Legal Pages and Settings - Comprehensive Testing', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Mock authentication for settings pages
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        id: 'settings-user',
        email: 'settings@elizaos.ai',
        first_name: 'Settings',
        last_name: 'Tester',
        role: 'owner',
        organization: {
          id: 'settings-org',
          name: 'Settings Testing Org',
          subscription_tier: 'premium',
          credit_balance: '1000.0',
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
  });

  it('Privacy Policy - Complete Page Test', () => {
    cy.log('🔒 Testing Privacy Policy Page');

    cy.visit('/legal/privacy', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Page Structure
    // ==========================================
    cy.log('📄 Step 1: Test Page Structure');

    // Should have proper page title
    cy.title().should('include', 'Privacy Policy');

    // Should have header
    cy.get('h1').should('be.visible').and('contain.text', 'Privacy Policy');

    // Should have navigation back
    cy.get('[data-cy="back-button"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Content Sections
    // ==========================================
    cy.log('📋 Step 2: Test Content Sections');

    // Check for standard privacy policy sections
    const expectedSections = [
      'Information We Collect',
      'How We Use Information',
      'Data Sharing',
      'Data Security',
      'Your Rights',
      'Contact Us',
    ];

    expectedSections.forEach((section) => {
      cy.contains(section).should('be.visible');
    });

    // ==========================================
    // STEP 3: Test Navigation
    // ==========================================
    cy.log('🧭 Step 3: Test Navigation');

    // Test back button
    cy.get('[data-cy="back-button"]').click();
    cy.url().should('not.include', '/legal/privacy');

    // Go back to test other elements
    cy.visit('/legal/privacy', { failOnStatusCode: false });

    // ==========================================
    // STEP 4: Test Dark Theme Compliance
    // ==========================================
    cy.log('🌙 Step 4: Test Dark Theme Compliance');

    // Verify dark theme is applied
    cy.get('html').should('have.class', 'dark');

    // Text should be readable
    cy.get('h1').should('be.visible').and('have.css', 'color');
    cy.get('p').first().should('be.visible').and('have.css', 'color');

    // ==========================================
    // STEP 5: Test Responsive Design
    // ==========================================
    cy.log('📱 Step 5: Test Responsive Design');

    // Test mobile layout
    cy.viewport(375, 812);
    cy.get('h1').should('be.visible');
    cy.get('[data-cy="back-button"]').should('be.visible');

    // Test tablet layout
    cy.viewport(768, 1024);
    cy.get('h1').should('be.visible');

    cy.log('✅ Privacy Policy Test Complete!');
  });

  it('Terms of Service - Complete Page Test', () => {
    cy.log('📜 Testing Terms of Service Page');

    cy.visit('/legal/terms', { failOnStatusCode: false });

    // ==========================================
    // STEP 1: Test Page Structure
    // ==========================================
    cy.log('📄 Step 1: Test Page Structure');

    cy.title().should('include', 'Terms of Service');
    cy.get('h1').should('be.visible').and('contain.text', 'Terms of Service');
    cy.get('[data-cy="back-button"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Content Sections
    // ==========================================
    cy.log('📋 Step 2: Test Content Sections');

    const expectedSections = [
      'Acceptance of Terms',
      'Use of Service',
      'User Accounts',
      'Payment Terms',
      'Prohibited Uses',
      'Limitation of Liability',
      'Termination',
      'Governing Law',
    ];

    expectedSections.forEach((section) => {
      cy.contains(section).should('be.visible');
    });

    // ==========================================
    // STEP 3: Test Last Updated Date
    // ==========================================
    cy.log('📅 Step 3: Test Last Updated Date');

    cy.contains('Last updated').should('be.visible');
    cy.get('[data-cy="last-updated-date"]').should('be.visible');

    // ==========================================
    // STEP 4: Test Contact Information
    // ==========================================
    cy.log('📧 Step 4: Test Contact Information');

    cy.contains('Contact').should('be.visible');
    cy.get('a[href*="mailto:"]').should('exist');

    cy.log('✅ Terms of Service Test Complete!');
  });

  it('Account Settings - Complete Workflow Test', () => {
    cy.log('👤 Testing Account Settings Page');

    // Mock account settings data
    cy.intercept('GET', '**/api/settings/account', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          firstName: 'Settings',
          lastName: 'Tester',
          email: 'settings@elizaos.ai',
          profilePictureUrl: null,
          timezone: 'UTC',
          language: 'en',
          emailNotifications: true,
          pushNotifications: false,
          marketingEmails: true,
        },
      },
    }).as('getAccountSettings');

    cy.intercept('PUT', '**/api/settings/account', {
      statusCode: 200,
      body: { success: true, message: 'Settings updated successfully' },
    }).as('updateAccountSettings');

    cy.visit('/settings/account', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getAccountSettings');

    // ==========================================
    // STEP 1: Test Account Settings Form
    // ==========================================
    cy.log('📋 Step 1: Test Account Settings Form');

    cy.get('[data-cy="account-settings-form"]').should('be.visible');

    // Test form fields
    cy.get('[data-cy="firstName-input"]').should('have.value', 'Settings');
    cy.get('[data-cy="lastName-input"]').should('have.value', 'Tester');
    cy.get('[data-cy="email-input"]').should(
      'have.value',
      'settings@elizaos.ai',
    );
    cy.get('[data-cy="timezone-select"]').should('have.value', 'UTC');

    // ==========================================
    // STEP 2: Test Profile Picture Upload
    // ==========================================
    cy.log('📸 Step 2: Test Profile Picture Upload');

    cy.get('[data-cy="profile-picture-section"]').should('be.visible');
    cy.get('[data-cy="upload-profile-picture"]').should('be.visible');

    // Test upload button click
    cy.get('[data-cy="upload-profile-picture"]').click();
    cy.get('[data-cy="file-upload-modal"]').should('be.visible');
    cy.get('[data-cy="modal-close"]').click();

    // ==========================================
    // STEP 3: Test Notification Preferences
    // ==========================================
    cy.log('🔔 Step 3: Test Notification Preferences');

    cy.get('[data-cy="notification-preferences"]').should('be.visible');

    // Test email notifications toggle
    cy.get('[data-cy="email-notifications-toggle"]').should('be.checked');
    cy.get('[data-cy="push-notifications-toggle"]').should('not.be.checked');
    cy.get('[data-cy="marketing-emails-toggle"]').should('be.checked');

    // Toggle notifications
    cy.get('[data-cy="push-notifications-toggle"]').click();

    // ==========================================
    // STEP 4: Test Form Validation
    // ==========================================
    cy.log('✅ Step 4: Test Form Validation');

    // Clear required field
    cy.get('[data-cy="firstName-input"]').clear();
    cy.get('[data-cy="save-settings-button"]').click();

    // Should show validation error
    cy.get('[data-cy="firstName-error"]')
      .should('be.visible')
      .and('contain.text', 'First name is required');

    // ==========================================
    // STEP 5: Test Settings Update
    // ==========================================
    cy.log('💾 Step 5: Test Settings Update');

    // Fill form correctly
    cy.get('[data-cy="firstName-input"]').type('Updated');
    cy.get('[data-cy="lastName-input"]').clear().type('Name');

    // Save settings
    cy.get('[data-cy="save-settings-button"]').click();
    cy.wait('@updateAccountSettings');

    // Should show success message
    cy.get('[data-cy="settings-success"]')
      .should('be.visible')
      .and('contain.text', 'Settings updated successfully');

    cy.log('✅ Account Settings Test Complete!');
  });

  it('Password Change - Complete Workflow Test', () => {
    cy.log('🔑 Testing Password Change Workflow');

    cy.intercept('PUT', '**/api/auth/change-password', {
      statusCode: 200,
      body: { success: true, message: 'Password changed successfully' },
    }).as('changePassword');

    cy.visit('/settings/account', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Password Change Section
    // ==========================================
    cy.log('🔒 Step 1: Test Password Change Section');

    cy.get('[data-cy="password-change-section"]').should('be.visible');
    cy.get('[data-cy="change-password-button"]').click();

    // Should open password change modal
    cy.get('[data-cy="password-change-modal"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Password Form Validation
    // ==========================================
    cy.log('✅ Step 2: Test Password Form Validation');

    // Test empty fields
    cy.get('[data-cy="update-password-button"]').click();

    cy.get('[data-cy="current-password-error"]').should('be.visible');
    cy.get('[data-cy="new-password-error"]').should('be.visible');
    cy.get('[data-cy="confirm-password-error"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Password Strength
    // ==========================================
    cy.log('💪 Step 3: Test Password Strength');

    // Test weak password
    cy.get('[data-cy="new-password-input"]').type('123');
    cy.get('[data-cy="password-strength"]').should('contain.text', 'Weak');

    // Test strong password
    cy.get('[data-cy="new-password-input"]').clear().type('StrongPassword123!');
    cy.get('[data-cy="password-strength"]').should('contain.text', 'Strong');

    // ==========================================
    // STEP 4: Test Password Mismatch
    // ==========================================
    cy.log('❌ Step 4: Test Password Mismatch');

    cy.get('[data-cy="confirm-password-input"]').type('DifferentPassword123!');
    cy.get('[data-cy="update-password-button"]').click();

    cy.get('[data-cy="password-mismatch-error"]')
      .should('be.visible')
      .and('contain.text', 'Passwords do not match');

    // ==========================================
    // STEP 5: Test Successful Password Change
    // ==========================================
    cy.log('✅ Step 5: Test Successful Password Change');

    cy.get('[data-cy="current-password-input"]').type('currentPassword');
    cy.get('[data-cy="confirm-password-input"]')
      .clear()
      .type('StrongPassword123!');

    cy.get('[data-cy="update-password-button"]').click();
    cy.wait('@changePassword');

    // Should show success message and close modal
    cy.get('[data-cy="password-success"]').should('be.visible');
    cy.get('[data-cy="password-change-modal"]').should('not.exist');

    cy.log('✅ Password Change Test Complete!');
  });

  it('Email Verification - Workflow Test', () => {
    cy.log('📧 Testing Email Verification Workflow');

    // Mock unverified user
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        id: 'unverified-user',
        email: 'unverified@elizaos.ai',
        first_name: 'Unverified',
        last_name: 'User',
        email_verified: false,
        organization: { id: 'org', name: 'Test Org' },
      },
    }).as('getUnverifiedIdentity');

    cy.intercept('POST', '**/api/auth/resend-verification', {
      statusCode: 200,
      body: { success: true, message: 'Verification email sent' },
    }).as('resendVerification');

    cy.visit('/settings/account', { failOnStatusCode: false });
    cy.wait('@getUnverifiedIdentity');

    // ==========================================
    // STEP 1: Test Email Verification Banner
    // ==========================================
    cy.log('⚠️ Step 1: Test Email Verification Banner');

    cy.get('[data-cy="email-verification-banner"]')
      .should('be.visible')
      .and('contain.text', 'Email not verified');

    // ==========================================
    // STEP 2: Test Resend Verification
    // ==========================================
    cy.log('📤 Step 2: Test Resend Verification');

    cy.get('[data-cy="resend-verification-button"]').click();
    cy.wait('@resendVerification');

    cy.get('[data-cy="verification-sent-message"]')
      .should('be.visible')
      .and('contain.text', 'Verification email sent');

    cy.log('✅ Email Verification Test Complete!');
  });

  it('Account Deletion - Workflow Test', () => {
    cy.log('🗑️ Testing Account Deletion Workflow');

    cy.intercept('DELETE', '**/api/settings/account', {
      statusCode: 200,
      body: { success: true, message: 'Account scheduled for deletion' },
    }).as('deleteAccount');

    cy.visit('/settings/account', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    // ==========================================
    // STEP 1: Test Danger Zone Section
    // ==========================================
    cy.log('⚠️ Step 1: Test Danger Zone Section');

    cy.get('[data-cy="danger-zone"]').should('be.visible');
    cy.get('[data-cy="delete-account-button"]')
      .should('be.visible')
      .and('have.class', 'btn-destructive');

    // ==========================================
    // STEP 2: Test Deletion Confirmation
    // ==========================================
    cy.log('❌ Step 2: Test Deletion Confirmation');

    cy.get('[data-cy="delete-account-button"]').click();
    cy.get('[data-cy="delete-account-modal"]').should('be.visible');

    // Should require typing confirmation
    cy.get('[data-cy="delete-confirmation-input"]').should('be.visible');
    cy.get('[data-cy="confirm-delete-button"]').should('be.disabled');

    // ==========================================
    // STEP 3: Test Confirmation Text
    // ==========================================
    cy.log('✍️ Step 3: Test Confirmation Text');

    cy.get('[data-cy="delete-confirmation-input"]').type('DELETE');
    cy.get('[data-cy="confirm-delete-button"]').should('not.be.disabled');

    // ==========================================
    // STEP 4: Test Cancellation
    // ==========================================
    cy.log('🚫 Step 4: Test Cancellation');

    cy.get('[data-cy="cancel-delete-button"]').click();
    cy.get('[data-cy="delete-account-modal"]').should('not.exist');

    cy.log('✅ Account Deletion Test Complete!');
  });

  it('Legal and Settings - Responsive Design Test', () => {
    cy.log('📱 Testing Legal and Settings Responsive Design');

    // ==========================================
    // STEP 1: Test Legal Pages Mobile
    // ==========================================
    cy.log('📱 Step 1: Test Legal Pages Mobile');

    cy.viewport(375, 812);

    cy.visit('/legal/privacy', { failOnStatusCode: false });
    cy.get('h1').should('be.visible');
    cy.get('[data-cy="back-button"]').should('be.visible');

    cy.visit('/legal/terms', { failOnStatusCode: false });
    cy.get('h1').should('be.visible');

    // ==========================================
    // STEP 2: Test Settings Mobile
    // ==========================================
    cy.log('⚙️ Step 2: Test Settings Mobile');

    cy.visit('/settings/account', { failOnStatusCode: false });
    cy.wait('@getIdentity');

    cy.get('[data-cy="account-settings-form"]').should('be.visible');
    cy.get('[data-cy="firstName-input"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Tablet Layout
    // ==========================================
    cy.log('📱 Step 3: Test Tablet Layout');

    cy.viewport(768, 1024);

    cy.get('[data-cy="account-settings-form"]').should('be.visible');
    cy.get('[data-cy="notification-preferences"]').should('be.visible');

    cy.log('✅ Responsive Design Test Complete!');
  });

  it('Legal and Settings - Error Handling Test', () => {
    cy.log('❌ Testing Legal and Settings Error Handling');

    // ==========================================
    // STEP 1: Test Settings Load Error
    // ==========================================
    cy.log('🚨 Step 1: Test Settings Load Error');

    cy.intercept('GET', '**/api/settings/account', {
      statusCode: 500,
      body: { success: false, error: 'Failed to load settings' },
    }).as('getSettingsError');

    cy.visit('/settings/account', { failOnStatusCode: false });
    cy.wait('@getIdentity');
    cy.wait('@getSettingsError');

    cy.get('[data-cy="settings-load-error"]')
      .should('be.visible')
      .and('contain.text', 'Failed to load settings');

    // ==========================================
    // STEP 2: Test Settings Update Error
    // ==========================================
    cy.log('💾 Step 2: Test Settings Update Error');

    cy.intercept('PUT', '**/api/settings/account', {
      statusCode: 400,
      body: { success: false, error: 'Invalid data provided' },
    }).as('updateSettingsError');

    // Should have retry button
    cy.get('[data-cy="retry-load-settings"]').click();

    // Mock successful load for form interaction
    cy.intercept('GET', '**/api/settings/account', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
      },
    }).as('getSettingsSuccess');

    cy.wait('@getSettingsSuccess');

    // Try to update with error
    cy.get('[data-cy="save-settings-button"]').click();
    cy.wait('@updateSettingsError');

    cy.get('[data-cy="settings-update-error"]')
      .should('be.visible')
      .and('contain.text', 'Invalid data provided');

    cy.log('✅ Error Handling Test Complete!');
  });
});
